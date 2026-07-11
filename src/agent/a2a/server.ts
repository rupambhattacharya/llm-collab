import { WebSocketServer, type WebSocket } from "ws";
import { MethodRegistry, parseMessage, isRequest, isNotification, ERROR_CODES, type JsonRpcResponse } from "./protocol.js";
import { logger } from "../../utils/logger.js";
import { audit } from "../../hooks/audit-logger.js";
import * as childProcess from "node:child_process";
import * as fs from "node:fs";

export interface A2AServerOptions {
  port: number;
  host?: string;
}

export class A2AServer {
  private wss: WebSocketServer | null = null;
  private registry: MethodRegistry;
  private clients = new Set<WebSocket>();

  constructor() {
    this.registry = new MethodRegistry();
    this.registerBuiltinMethods();
  }

  private registerBuiltinMethods(): void {
    this.registry.register("shell.execute", async (params) => {
      const command = params["command"] as string;
      if (!command) throw new Error("Missing required parameter: command");

      const cwd = (params["cwd"] as string) ?? process.cwd();
      const timeout = (params["timeout"] as number) ?? 30_000;

      return new Promise((resolve) => {
        const child = childProcess.exec(command, { cwd, timeout }, (error, stdout, stderr) => {
          resolve({
            exitCode: error ? (error as NodeJS.ErrnoException & { code?: number }).code ?? 1 : 0,
            stdout: stdout.toString(),
            stderr: stderr.toString(),
          });
        });
        child.on("error", (err) => {
          resolve({ exitCode: 1, stdout: "", stderr: err.message });
        });
      });
    });

    this.registry.register("file.read", async (params) => {
      const filePath = params["path"] as string;
      if (!filePath) throw new Error("Missing required parameter: path");
      const content = fs.readFileSync(filePath, "utf-8");
      return { path: filePath, content };
    });

    this.registry.register("file.write", async (params) => {
      const filePath = params["path"] as string;
      const content = params["content"] as string;
      if (!filePath || content === undefined) throw new Error("Missing required parameters: path, content");
      fs.writeFileSync(filePath, content, "utf-8");
      return { path: filePath, written: true };
    });

    this.registry.register("agent.delegate", async (params) => {
      const task = params["task"] as string;
      const agent = (params["agent"] as string) ?? "claude";
      if (!task) throw new Error("Missing required parameter: task");
      return { delegated: true, agent, task, status: "queued" };
    });

    this.registry.register("rpc.methods", async () => {
      return { methods: this.registry.list() };
    });
  }

  registerMethod(method: string, handler: (params: Record<string, unknown>) => Promise<unknown>): void {
    this.registry.register(method, handler);
  }

  start(options: A2AServerOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({
        port: options.port,
        host: options.host ?? "127.0.0.1",
      });

      this.wss.on("listening", () => {
        audit.toolCall("a2a.server.start", { port: options.port }, "success");
        logger.debug(`A2A server listening on ${options.host ?? "127.0.0.1"}:${options.port}`);
        resolve();
      });

      this.wss.on("error", (err) => {
        audit.toolCall("a2a.server.start", { port: options.port }, "failure");
        reject(err);
      });

      this.wss.on("connection", (ws) => {
        this.clients.add(ws);
        logger.debug(`A2A client connected (${this.clients.size} total)`);

        ws.on("message", async (data) => {
          await this.handleMessage(ws, data.toString());
        });

        ws.on("close", () => {
          this.clients.delete(ws);
          logger.debug(`A2A client disconnected (${this.clients.size} total)`);
        });

        ws.on("error", (err) => {
          logger.debug(`A2A client error: ${err.message}`);
          this.clients.delete(ws);
        });
      });
    });
  }

  private async handleMessage(ws: WebSocket, raw: string): Promise<void> {
    let response: JsonRpcResponse;
    try {
      const msg = parseMessage(raw);

      if (isNotification(msg)) {
        logger.debug(`A2A notification: ${msg.method}`);
        return;
      }

      if (!isRequest(msg)) {
        return;
      }

      const startTime = Date.now();
      audit.toolCall(`a2a.${msg.method}`, msg.params);
      response = await this.registry.handle(msg);
      audit.toolCall(`a2a.${msg.method}`, msg.params, response.error ? "failure" : "success", Date.now() - startTime);
    } catch {
      response = {
        jsonrpc: "2.0",
        id: 0,
        error: { code: ERROR_CODES.PARSE_ERROR, message: "Parse error" },
      };
    }

    ws.send(JSON.stringify(response));
  }

  broadcast(method: string, params?: Record<string, unknown>): void {
    const notification = JSON.stringify({ jsonrpc: "2.0", method, params });
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) {
        client.send(notification);
      }
    }
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const client of this.clients) {
        client.close();
      }
      this.clients.clear();
      if (this.wss) {
        this.wss.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }
}
