import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerFileTools(server: McpServer): void {
  server.tool(
    "file_read",
    "Read the contents of a file",
    { path: z.string().describe("Absolute or relative file path") },
    async ({ path: filePath }) => {
      try {
        const resolved = path.resolve(filePath);
        const content = fs.readFileSync(resolved, "utf-8");
        return { content: [{ type: "text" as const, text: content }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "file_write",
    "Write content to a file (creates directories if needed)",
    {
      path: z.string().describe("Absolute or relative file path"),
      content: z.string().describe("Content to write"),
    },
    async ({ path: filePath, content }) => {
      try {
        const resolved = path.resolve(filePath);
        const dir = path.dirname(resolved);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(resolved, content, "utf-8");
        return { content: [{ type: "text" as const, text: `Written ${content.length} bytes to ${resolved}` }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "file_list",
    "List files in a directory",
    {
      path: z.string().describe("Directory path").default("."),
      recursive: z.boolean().describe("List recursively").default(false),
    },
    async ({ path: dirPath, recursive }) => {
      try {
        const resolved = path.resolve(dirPath);
        const entries = listDirectory(resolved, recursive);
        return { content: [{ type: "text" as const, text: entries.join("\n") }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "file_search",
    "Search for files by name pattern (glob-like)",
    {
      pattern: z.string().describe("File name pattern to match (e.g. '*.ts', 'config*')"),
      path: z.string().describe("Directory to search in").default("."),
    },
    async ({ pattern, path: dirPath }) => {
      try {
        const resolved = path.resolve(dirPath);
        const matches = searchFiles(resolved, pattern);
        if (matches.length === 0) {
          return { content: [{ type: "text" as const, text: "No files found" }] };
        }
        return { content: [{ type: "text" as const, text: matches.join("\n") }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );
}

function listDirectory(dirPath: string, recursive: boolean, prefix = ""): string[] {
  const entries: string[] = [];
  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    if (item.name.startsWith(".") || item.name === "node_modules") continue;
    const rel = prefix ? `${prefix}/${item.name}` : item.name;

    if (item.isDirectory()) {
      entries.push(`${rel}/`);
      if (recursive) {
        entries.push(...listDirectory(path.join(dirPath, item.name), true, rel));
      }
    } else {
      entries.push(rel);
    }
  }

  return entries;
}

function searchFiles(dirPath: string, pattern: string, prefix = ""): string[] {
  const matches: string[] = [];
  const regex = new RegExp("^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");

  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
      if (item.name === "node_modules" || item.name.startsWith(".")) continue;
      const rel = prefix ? `${prefix}/${item.name}` : item.name;

      if (item.isFile() && regex.test(item.name)) {
        matches.push(rel);
      }
      if (item.isDirectory()) {
        matches.push(...searchFiles(path.join(dirPath, item.name), pattern, rel));
      }
    }
  } catch {
    // Skip unreadable directories
  }

  return matches;
}
