import { describe, it, expect } from "vitest";
import {
  LLMCollabError,
  ConfigError,
  AuthError,
  APIError,
  MCPError,
  ChronicleError,
} from "../../src/utils/errors.js";

describe("LLMCollabError", () => {
  it("carries message, code, and hint", () => {
    const err = new LLMCollabError("test message", "TEST_CODE", "try this");
    expect(err.message).toBe("test message");
    expect(err.code).toBe("TEST_CODE");
    expect(err.hint).toBe("try this");
    expect(err.name).toBe("LLMCollabError");
    expect(err).toBeInstanceOf(Error);
  });

  it("hint is optional", () => {
    const err = new LLMCollabError("msg", "CODE");
    expect(err.hint).toBeUndefined();
  });
});

describe("ConfigError", () => {
  it("has CONFIG_ERROR code", () => {
    const err = new ConfigError("bad config", "check config.json");
    expect(err.code).toBe("CONFIG_ERROR");
    expect(err.name).toBe("ConfigError");
    expect(err).toBeInstanceOf(LLMCollabError);
  });
});

describe("AuthError", () => {
  it("has AUTH_ERROR code", () => {
    const err = new AuthError("unauthorized");
    expect(err.code).toBe("AUTH_ERROR");
    expect(err.name).toBe("AuthError");
  });
});

describe("APIError", () => {
  it("carries statusCode", () => {
    const err = new APIError("rate limited", 429, "retry later");
    expect(err.code).toBe("API_ERROR");
    expect(err.statusCode).toBe(429);
    expect(err.hint).toBe("retry later");
  });
});

describe("MCPError", () => {
  it("has MCP_ERROR code", () => {
    const err = new MCPError("tool failed");
    expect(err.code).toBe("MCP_ERROR");
  });
});

describe("ChronicleError", () => {
  it("has CHRONICLE_ERROR code", () => {
    const err = new ChronicleError("db locked");
    expect(err.code).toBe("CHRONICLE_ERROR");
  });
});
