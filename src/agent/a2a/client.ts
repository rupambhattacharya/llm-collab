import WebSocket from "ws";
import { createRequest, parseMessage, isResponse, type JsonRpcResponse } from "./protocol.js";
import { logger } from "../../utils/logger.js";

export interface A2AClientOptions {
  url: string;
  timeout?: number;
}

export class A2AClient {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pending = new Map<string | number, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private defaultTimeout: number;
  private url: string;
  private notificationHandlers = new Map<string, (params: Record<string, unknown>) => void>();

  constructor(options: A2AClientOptions) {
    this.url = options.url;
    this.defaultTimeout = options.timeout ?? 30_000;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on("open", () => {
        logger.debug(`A2A connected to ${this.url}`);
        resolve();
      });

      this.ws.on("error", (err) => {
        reject(err);
      });

      this.ws.on("message", (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on("close", () => {
        logger.debug("A2A connection closed");
        for (const [, entry] of this.pending) {
          clearTimeout(entry.timer);
          entry.reject(new Error("Connection closed"));
        }
        this.pending.clear();
      });
    });
  }

  private handleMessage(raw: string): void {
    try {
      const msg = parseMessage(raw);

      if (isResponse(msg)) {
        const entry = this.pending.get(msg.id);
        if (entry) {
          clearTimeout(entry.timer);
          this.pending.delete(msg.id);
          entry.resolve(msg);
        }
        return;
      }

      if ("method" in msg && !("id" in msg)) {
        const handler = this.notificationHandlers.get(msg.method);
        if (handler && msg.params) {
          handler(msg.params);
        }
      }
    } catch (err) {
      logger.debug(`A2A parse error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async call(method: string, params?: Record<string, unknown>, timeout?: number): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }

    const id = ++this.requestId;
    const request = createRequest(id, method, params);
    const timeoutMs = timeout ?? this.defaultTimeout;

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (response) => {
          if (response.error) {
            reject(new Error(`${response.error.message} (code: ${response.error.code})`));
          } else {
            resolve(response.result);
          }
        },
        reject,
        timer,
      });

      this.ws!.send(JSON.stringify(request));
    });
  }

  onNotification(method: string, handler: (params: Record<string, unknown>) => void): void {
    this.notificationHandlers.set(method, handler);
  }

  async shellExecute(command: string, cwd?: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return this.call("shell.execute", { command, cwd }) as Promise<{ exitCode: number; stdout: string; stderr: string }>;
  }

  async fileRead(path: string): Promise<{ path: string; content: string }> {
    return this.call("file.read", { path }) as Promise<{ path: string; content: string }>;
  }

  async fileWrite(path: string, content: string): Promise<{ path: string; written: boolean }> {
    return this.call("file.write", { path, content }) as Promise<{ path: string; written: boolean }>;
  }

  async delegate(task: string, agent?: string): Promise<{ delegated: boolean; agent: string; task: string; status: string }> {
    return this.call("agent.delegate", { task, agent }) as Promise<{ delegated: boolean; agent: string; task: string; status: string }>;
  }

  async listMethods(): Promise<{ methods: string[] }> {
    return this.call("rpc.methods") as Promise<{ methods: string[] }>;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
