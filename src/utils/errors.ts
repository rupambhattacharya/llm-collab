export class LLMCollabError extends Error {
  constructor(
    message: string,
    public code: string,
    public hint?: string,
  ) {
    super(message);
    this.name = "LLMCollabError";
  }
}

export class ConfigError extends LLMCollabError {
  constructor(message: string, hint?: string) {
    super(message, "CONFIG_ERROR", hint);
    this.name = "ConfigError";
  }
}

export class AuthError extends LLMCollabError {
  constructor(message: string, hint?: string) {
    super(message, "AUTH_ERROR", hint);
    this.name = "AuthError";
  }
}

export class APIError extends LLMCollabError {
  constructor(
    message: string,
    public statusCode?: number,
    hint?: string,
  ) {
    super(message, "API_ERROR", hint);
    this.name = "APIError";
  }
}

export class MCPError extends LLMCollabError {
  constructor(message: string, hint?: string) {
    super(message, "MCP_ERROR", hint);
    this.name = "MCPError";
  }
}

export class ChronicleError extends LLMCollabError {
  constructor(message: string, hint?: string) {
    super(message, "CHRONICLE_ERROR", hint);
    this.name = "ChronicleError";
  }
}
