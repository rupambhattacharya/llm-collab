import { describe, it, expect, beforeEach } from "vitest";

describe("HookManager", () => {
  let hooks: Awaited<typeof import("../../src/hooks/hook-manager.js")>["hooks"];

  beforeEach(async () => {
    const mod = await import("../../src/hooks/hook-manager.js");
    hooks = mod.hooks;
    hooks.enable();
    hooks.removeAllListeners();
  });

  it("emits toolCall events", () => {
    const received: string[] = [];
    hooks.on("toolCall", (ctx) => received.push(ctx.tool));
    hooks.emitToolCall({ tool: "file_read", result: "success" });
    expect(received).toEqual(["file_read"]);
  });

  it("emits inference events", () => {
    const received: string[] = [];
    hooks.on("inference", (ctx) => received.push(ctx.model));
    hooks.emitInference({
      model: "claude-sonnet-5",
      provider: "anthropic",
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.001,
    });
    expect(received).toEqual(["claude-sonnet-5"]);
  });

  it("emits session lifecycle events", () => {
    const events: string[] = [];
    hooks.on("sessionStart", () => events.push("start"));
    hooks.on("sessionEnd", () => events.push("end"));
    hooks.emitSessionStart({ sessionId: "test" });
    hooks.emitSessionEnd({ sessionId: "test", result: "success" });
    expect(events).toEqual(["start", "end"]);
  });

  it("emits error events", () => {
    const errors: string[] = [];
    hooks.on("error", (ctx) => errors.push(typeof ctx.error === "string" ? ctx.error : ctx.error.message));
    hooks.emitError({ error: "test error", context: "test" });
    hooks.emitError({ error: new Error("err object") });
    expect(errors).toEqual(["test error", "err object"]);
  });

  it("emits budget alerts", () => {
    const alerts: number[] = [];
    hooks.on("budgetAlert", (ctx) => alerts.push(ctx.currentSpend));
    hooks.emitBudgetAlert(51, 50);
    expect(alerts).toEqual([51]);
  });

  it("does not emit when disabled", () => {
    const received: string[] = [];
    hooks.on("toolCall", (ctx) => received.push(ctx.tool));
    hooks.disable();
    hooks.emitToolCall({ tool: "should_not_fire" });
    expect(received).toEqual([]);
  });

  it("resumes emitting when re-enabled", () => {
    const received: string[] = [];
    hooks.on("toolCall", (ctx) => received.push(ctx.tool));
    hooks.disable();
    hooks.emitToolCall({ tool: "no" });
    hooks.enable();
    hooks.emitToolCall({ tool: "yes" });
    expect(received).toEqual(["yes"]);
  });
});
