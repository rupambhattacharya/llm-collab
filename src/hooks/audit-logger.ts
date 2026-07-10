import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export type AuditEventType =
  | "command_start"
  | "command_end"
  | "config_change"
  | "config_read"
  | "tool_call"
  | "decision"
  | "error"
  | "session_start"
  | "session_end";

export interface AuditEntry {
  timestamp: string;
  seq: number;
  event: AuditEventType;
  command?: string;
  args?: Record<string, unknown>;
  result?: "success" | "failure";
  detail?: string;
  durationMs?: number;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface AuditQueryOptions {
  date?: string;
  event?: AuditEventType;
  command?: string;
  limit?: number;
  tail?: boolean;
}

class AuditLogger {
  private seq = 0;
  private sessionId: string;
  private enabled = true;

  constructor() {
    this.sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private getAuditDir(): string {
    const home = process.env["LLM_COLLAB_HOME"] ?? path.join(os.homedir(), ".llm-collab");
    return path.join(home, "audit");
  }

  private getLogPath(date?: string): string {
    const d = date ?? new Date().toISOString().slice(0, 10);
    return path.join(this.getAuditDir(), `${d}.jsonl`);
  }

  private ensureDir(): void {
    const dir = this.getAuditDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  disable(): void {
    this.enabled = false;
  }

  enable(): void {
    this.enabled = true;
  }

  log(event: AuditEventType, detail?: Partial<Omit<AuditEntry, "timestamp" | "seq" | "event">>): AuditEntry {
    this.seq++;
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      seq: this.seq,
      event,
      ...detail,
      meta: {
        ...detail?.meta,
        sessionId: this.sessionId,
        pid: process.pid,
      },
    };

    if (this.enabled) {
      try {
        this.ensureDir();
        fs.appendFileSync(this.getLogPath(), JSON.stringify(entry) + "\n", "utf-8");
      } catch {
        // Audit logging must never crash the CLI
      }
    }

    return entry;
  }

  commandStart(command: string, args?: Record<string, unknown>): AuditEntry {
    return this.log("command_start", { command, args });
  }

  commandEnd(command: string, result: "success" | "failure", durationMs?: number, detail?: string): AuditEntry {
    return this.log("command_end", { command, result, durationMs, detail });
  }

  configChange(key: string, oldValue: unknown, newValue: unknown): AuditEntry {
    return this.log("config_change", {
      detail: `${key}: ${summarize(oldValue)} -> ${summarize(newValue)}`,
      meta: { key, oldValue: redact(key, oldValue), newValue: redact(key, newValue) },
    });
  }

  configRead(key?: string): AuditEntry {
    return this.log("config_read", { detail: key ?? "full config" });
  }

  toolCall(
    tool: string,
    args?: Record<string, unknown>,
    result?: "success" | "failure",
    durationMs?: number,
  ): AuditEntry {
    return this.log("tool_call", {
      command: tool,
      args,
      result,
      durationMs,
    });
  }

  decision(description: string, meta?: Record<string, unknown>): AuditEntry {
    return this.log("decision", { detail: description, meta });
  }

  logError(error: unknown, context?: string): AuditEntry {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    return this.log("error", {
      error: message,
      detail: context,
      meta: stack ? { stack } : undefined,
    });
  }

  sessionStart(meta?: Record<string, unknown>): AuditEntry {
    return this.log("session_start", {
      detail: `Session ${this.sessionId}`,
      meta: { ...meta, nodeVersion: process.version, platform: process.platform },
    });
  }

  sessionEnd(durationMs?: number, meta?: Record<string, unknown>): AuditEntry {
    return this.log("session_end", {
      detail: `Session ${this.sessionId}`,
      durationMs,
      meta,
    });
  }

  query(options: AuditQueryOptions = {}): AuditEntry[] {
    const logPath = this.getLogPath(options.date);
    if (!fs.existsSync(logPath)) return [];

    const lines = fs.readFileSync(logPath, "utf-8").split("\n").filter(Boolean);
    let entries: AuditEntry[] = lines.map((line) => JSON.parse(line) as AuditEntry);

    if (options.event) {
      entries = entries.filter((e) => e.event === options.event);
    }
    if (options.command) {
      entries = entries.filter((e) => e.command === options.command);
    }

    if (options.tail) {
      entries = entries.slice(-(options.limit ?? 20));
    } else if (options.limit) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  }

  listDates(): string[] {
    const dir = this.getAuditDir();
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => f.replace(".jsonl", ""))
      .sort();
  }

  getSessionId(): string {
    return this.sessionId;
  }
}

function summarize(value: unknown): string {
  if (value === undefined) return "<unset>";
  if (typeof value === "string") return value.length > 40 ? value.slice(0, 37) + "..." : value;
  if (typeof value === "object") return JSON.stringify(value).slice(0, 40);
  return String(value);
}

const SENSITIVE_KEYS = /key|token|secret|password|credential/i;

function redact(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.test(key) && typeof value === "string" && value.length > 4) {
    return value.slice(0, 4) + "****";
  }
  return value;
}

export const audit = new AuditLogger();
