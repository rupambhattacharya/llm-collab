import express, { type Request, type Response } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Config } from "../config/schemas.js";
import { ConfigManager } from "../config/config-manager.js";
import { logger } from "../utils/logger.js";
import { audit } from "../hooks/audit-logger.js";

interface KeyEntry {
  name: string;
  key: string;
}

export class RelayServer {
  private app: express.Application;
  private config: Config;
  private requireAuth: boolean;
  private clientKeys: Map<string, string> = new Map();

  constructor(config: Config, options?: { requireAuth?: boolean }) {
    this.config = config;
    this.requireAuth = options?.requireAuth ?? config.relay.require_auth;
    this.app = express();
    this.loadClientKeys();
    this.setupRoutes();
  }

  private loadClientKeys(): void {
    if (!this.requireAuth) return;

    const keysPath = path.join(ConfigManager.getHomeDir(), "keys", "keys.json");
    if (!fs.existsSync(keysPath)) {
      logger.warn("Relay auth enabled but no keys.json found");
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(keysPath, "utf-8")) as KeyEntry[];
      for (const entry of data) {
        this.clientKeys.set(entry.key, entry.name);
      }
      logger.debug(`Loaded ${this.clientKeys.size} client keys`);
    } catch {
      logger.warn("Failed to parse keys.json");
    }
  }

  private resolveUpstream(requestModel?: string): { url: string; apiKey: string; provider: string } | null {
    const model = requestModel ?? "";

    if (model.startsWith("claude")) {
      const apiKey = this.config.ai.providers.anthropic?.api_key;
      if (!apiKey) return null;
      return {
        url: this.config.ai.providers.anthropic?.base_url ?? "https://api.anthropic.com",
        apiKey,
        provider: "anthropic",
      };
    }

    const apiKey = this.config.ai.providers.openai?.api_key;
    if (!apiKey) return null;
    return {
      url: this.config.ai.providers.openai?.base_url ?? "https://api.openai.com",
      apiKey,
      provider: "openai",
    };
  }

  private setupRoutes(): void {
    this.app.use(express.json({ limit: "10mb" }));

    this.app.use((req: Request, res: Response, next) => {
      if (this.requireAuth) {
        const authHeader = req.headers["authorization"];
        const token = authHeader?.replace("Bearer ", "");
        if (!token || !this.clientKeys.has(token)) {
          audit.toolCall("relay.auth", { ip: req.ip }, "failure");
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        const clientName = this.clientKeys.get(token);
        logger.debug(`Relay auth: ${clientName}`);
      }
      next();
    });

    this.app.post("/v1/chat/completions", async (req: Request, res: Response) => {
      const body = req.body as { model?: string; stream?: boolean };
      const upstream = this.resolveUpstream(body.model);

      if (!upstream) {
        res.status(503).json({ error: "No upstream provider configured for this model" });
        return;
      }

      audit.toolCall("relay.proxy", {
        model: body.model,
        provider: upstream.provider,
        stream: body.stream,
      });

      const startTime = Date.now();

      try {
        const upstreamUrl = `${upstream.url}/v1/chat/completions`;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (upstream.provider === "anthropic") {
          headers["x-api-key"] = upstream.apiKey;
          headers["anthropic-version"] = "2023-06-01";
        } else {
          headers["Authorization"] = `Bearer ${upstream.apiKey}`;
        }

        const response = await fetch(upstreamUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (body.stream) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");

          if (response.body) {
            const reader = response.body.getReader();
            const pump = async (): Promise<void> => {
              const { done, value } = await reader.read();
              if (done) {
                res.end();
                return;
              }
              res.write(value);
              return pump();
            };
            await pump();
          } else {
            res.end();
          }
        } else {
          const data = await response.json();
          res.status(response.status).json(data);
        }

        audit.toolCall("relay.proxy", { model: body.model, provider: upstream.provider }, "success", Date.now() - startTime);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        audit.toolCall("relay.proxy", { model: body.model }, "failure", Date.now() - startTime);
        logger.error(`Relay proxy error: ${message}`);
        res.status(502).json({ error: "Upstream request failed", detail: message });
      }
    });

    this.app.get("/v1/models", (_req: Request, res: Response) => {
      const models: string[] = [];
      if (this.config.ai.providers.anthropic?.api_key) {
        models.push("claude-sonnet-5", "claude-haiku-4-5", "claude-opus-4-8");
      }
      if (this.config.ai.providers.openai?.api_key) {
        models.push("gpt-4o", "gpt-4o-mini", "o3-mini");
      }
      res.json({
        object: "list",
        data: models.map((id) => ({ id, object: "model", owned_by: "llm-collab-relay" })),
      });
    });

    this.app.get("/health", (_req: Request, res: Response) => {
      res.json({ status: "ok", uptime: process.uptime() });
    });
  }

  start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        audit.decision("Relay server started", { port, requireAuth: this.requireAuth });
        resolve();
      });
    });
  }
}
