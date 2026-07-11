export interface PayloadCleanOptions {
  maxLength?: number;
  maxArrayItems?: number;
  maxDepth?: number;
  stripFields?: string[];
}

const DEFAULT_OPTIONS: Required<PayloadCleanOptions> = {
  maxLength: 50_000,
  maxArrayItems: 50,
  maxDepth: 10,
  stripFields: ["_links", "_embedded", "node_id", "performed_via_github_app"],
};

export function cleanPayload(
  data: unknown,
  options?: PayloadCleanOptions,
): unknown {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cleaned = cleanValue(data, opts, 0);
  return truncateIfNeeded(cleaned, opts.maxLength);
}

function cleanValue(
  value: unknown,
  opts: Required<PayloadCleanOptions>,
  depth: number,
): unknown {
  if (depth > opts.maxDepth) {
    return "[truncated: max depth exceeded]";
  }

  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    if (value.length > opts.maxLength) {
      return value.slice(0, opts.maxLength) + `... [truncated ${value.length - opts.maxLength} chars]`;
    }
    return value;
  }

  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    const truncated = value.length > opts.maxArrayItems;
    const items = value.slice(0, opts.maxArrayItems).map((item) => cleanValue(item, opts, depth + 1));
    if (truncated) {
      items.push(`[... ${value.length - opts.maxArrayItems} more items]`);
    }
    return items;
  }

  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const stripSet = new Set(opts.stripFields);

  for (const [key, val] of Object.entries(obj)) {
    if (stripSet.has(key)) continue;
    result[key] = cleanValue(val, opts, depth + 1);
  }

  return result;
}

function truncateIfNeeded(data: unknown, maxLength: number): unknown {
  if (data === null || data === undefined) return data;
  const json = JSON.stringify(data);
  if (json.length <= maxLength) return data;

  try {
    const parsed = JSON.parse(json.slice(0, maxLength)) as unknown;
    return parsed;
  } catch {
    return JSON.parse(JSON.stringify(data).slice(0, maxLength - 50) + ',"_truncated":true}') as unknown;
  }
}

export function summarizePayload(data: unknown): string {
  if (data === null || data === undefined) return String(data);
  if (typeof data === "string") return data.length > 100 ? data.slice(0, 97) + "..." : data;
  if (typeof data !== "object") return String(data);

  if (Array.isArray(data)) {
    return `[Array(${data.length})]`;
  }

  const keys = Object.keys(data as Record<string, unknown>);
  if (keys.length <= 5) {
    return `{${keys.join(", ")}}`;
  }
  return `{${keys.slice(0, 5).join(", ")}, ... +${keys.length - 5}}`;
}
