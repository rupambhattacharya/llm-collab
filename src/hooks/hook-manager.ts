import { EventEmitter } from "node:events";

export interface ToolCallContext {
  tool: string;
  args?: Record<string, unknown>;
  result?: "success" | "failure";
  durationMs?: number;
}

export interface InferenceContext {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  command?: string;
  durationMs?: number;
}

export interface SessionContext {
  sessionId: string;
  argv?: string[];
  durationMs?: number;
  result?: "success" | "failure";
}

export interface ErrorContext {
  error: Error | string;
  context?: string;
}

type HookEvents = {
  toolCall: [ToolCallContext];
  inference: [InferenceContext];
  sessionStart: [SessionContext];
  sessionEnd: [SessionContext];
  error: [ErrorContext];
  budgetAlert: [{ currentSpend: number; budgetUsd: number; model?: string }];
};

class HookManager extends EventEmitter<HookEvents> {
  private enabled = true;

  disable(): void {
    this.enabled = false;
  }

  enable(): void {
    this.enabled = true;
  }

  emitToolCall(ctx: ToolCallContext): void {
    if (this.enabled) this.emit("toolCall", ctx);
  }

  emitInference(ctx: InferenceContext): void {
    if (this.enabled) this.emit("inference", ctx);
  }

  emitSessionStart(ctx: SessionContext): void {
    if (this.enabled) this.emit("sessionStart", ctx);
  }

  emitSessionEnd(ctx: SessionContext): void {
    if (this.enabled) this.emit("sessionEnd", ctx);
  }

  emitError(ctx: ErrorContext): void {
    if (this.enabled) this.emit("error", ctx);
  }

  emitBudgetAlert(currentSpend: number, budgetUsd: number, model?: string): void {
    if (this.enabled) this.emit("budgetAlert", { currentSpend, budgetUsd, model });
  }
}

export const hooks = new HookManager();
