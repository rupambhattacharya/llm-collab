export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

export const ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export type MethodHandler = (params: Record<string, unknown>) => Promise<unknown>;

export class MethodRegistry {
  private handlers = new Map<string, MethodHandler>();

  register(method: string, handler: MethodHandler): void {
    this.handlers.set(method, handler);
  }

  has(method: string): boolean {
    return this.handlers.has(method);
  }

  get(method: string): MethodHandler | undefined {
    return this.handlers.get(method);
  }

  list(): string[] {
    return Array.from(this.handlers.keys());
  }

  async handle(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const handler = this.handlers.get(request.method);
    if (!handler) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: ERROR_CODES.METHOD_NOT_FOUND,
          message: `Method not found: ${request.method}`,
        },
      };
    }

    try {
      const result = await handler(request.params ?? {});
      return { jsonrpc: "2.0", id: request.id, result };
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }
}

export function createRequest(id: string | number, method: string, params?: Record<string, unknown>): JsonRpcRequest {
  return { jsonrpc: "2.0", id, method, ...(params ? { params } : {}) };
}

export function createNotification(method: string, params?: Record<string, unknown>): JsonRpcNotification {
  return { jsonrpc: "2.0", method, ...(params ? { params } : {}) };
}

export function isRequest(msg: JsonRpcMessage): msg is JsonRpcRequest {
  return "id" in msg && "method" in msg;
}

export function isResponse(msg: JsonRpcMessage): msg is JsonRpcResponse {
  return "id" in msg && !("method" in msg);
}

export function isNotification(msg: JsonRpcMessage): msg is JsonRpcNotification {
  return !("id" in msg) && "method" in msg;
}

export function parseMessage(data: string): JsonRpcMessage {
  const parsed = JSON.parse(data) as JsonRpcMessage;
  if (parsed.jsonrpc !== "2.0") {
    throw new Error("Invalid JSON-RPC version");
  }
  return parsed;
}
