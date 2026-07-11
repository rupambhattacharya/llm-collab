import { describe, it, expect } from "vitest";
import {
  MethodRegistry,
  createRequest,
  createNotification,
  isRequest,
  isResponse,
  isNotification,
  parseMessage,
  ERROR_CODES,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "../../src/agent/a2a/protocol.js";

describe("MethodRegistry", () => {
  it("registers and executes handlers", async () => {
    const registry = new MethodRegistry();
    registry.register("test.echo", async (params) => ({ echo: params["msg"] }));

    const request: JsonRpcRequest = { jsonrpc: "2.0", id: 1, method: "test.echo", params: { msg: "hello" } };
    const response = await registry.handle(request);
    expect(response.result).toEqual({ echo: "hello" });
  });

  it("returns METHOD_NOT_FOUND for unknown methods", async () => {
    const registry = new MethodRegistry();
    const request: JsonRpcRequest = { jsonrpc: "2.0", id: 1, method: "unknown" };
    const response = await registry.handle(request);
    expect(response.error?.code).toBe(ERROR_CODES.METHOD_NOT_FOUND);
  });

  it("returns INTERNAL_ERROR on handler exception", async () => {
    const registry = new MethodRegistry();
    registry.register("fail", async () => { throw new Error("boom"); });
    const response = await registry.handle({ jsonrpc: "2.0", id: 1, method: "fail" });
    expect(response.error?.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(response.error?.message).toBe("boom");
  });

  it("lists registered methods", () => {
    const registry = new MethodRegistry();
    registry.register("a", async () => 1);
    registry.register("b", async () => 2);
    expect(registry.list()).toEqual(["a", "b"]);
  });
});

describe("message helpers", () => {
  it("createRequest builds valid request", () => {
    const req = createRequest(42, "test.method", { key: "value" });
    expect(req.jsonrpc).toBe("2.0");
    expect(req.id).toBe(42);
    expect(req.method).toBe("test.method");
    expect(req.params).toEqual({ key: "value" });
  });

  it("createNotification omits id", () => {
    const notif = createNotification("log", { level: "info" });
    expect(notif.jsonrpc).toBe("2.0");
    expect(notif.method).toBe("log");
    expect("id" in notif).toBe(false);
  });
});

describe("type guards", () => {
  it("identifies requests", () => {
    const req: JsonRpcRequest = { jsonrpc: "2.0", id: 1, method: "test" };
    expect(isRequest(req)).toBe(true);
    expect(isResponse(req)).toBe(false);
    expect(isNotification(req)).toBe(false);
  });

  it("identifies responses", () => {
    const res: JsonRpcResponse = { jsonrpc: "2.0", id: 1, result: "ok" };
    expect(isResponse(res)).toBe(true);
    expect(isRequest(res)).toBe(false);
  });

  it("identifies notifications", () => {
    const notif = { jsonrpc: "2.0" as const, method: "event" };
    expect(isNotification(notif)).toBe(true);
    expect(isRequest(notif)).toBe(false);
  });
});

describe("parseMessage", () => {
  it("parses valid JSON-RPC message", () => {
    const msg = parseMessage('{"jsonrpc":"2.0","id":1,"method":"test"}');
    expect(isRequest(msg)).toBe(true);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseMessage("not json")).toThrow();
  });

  it("throws on wrong version", () => {
    expect(() => parseMessage('{"jsonrpc":"1.0","id":1}')).toThrow("Invalid JSON-RPC version");
  });
});
