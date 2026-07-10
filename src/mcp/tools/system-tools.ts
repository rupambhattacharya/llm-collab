import * as os from "node:os";
import * as childProcess from "node:child_process";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSystemTools(server: McpServer): void {
  server.tool(
    "shell_execute",
    "Execute a shell command and return stdout/stderr",
    {
      command: z.string().describe("Shell command to execute"),
      cwd: z.string().describe("Working directory").optional(),
      timeout: z.number().describe("Timeout in milliseconds").default(30000),
    },
    async ({ command, cwd, timeout }) => {
      try {
        const result = childProcess.execSync(command, {
          cwd: cwd ?? process.cwd(),
          timeout,
          encoding: "utf-8",
          maxBuffer: 1024 * 1024 * 10,
          stdio: ["pipe", "pipe", "pipe"],
        });
        return { content: [{ type: "text" as const, text: result }] };
      } catch (err) {
        if (err && typeof err === "object" && "stdout" in err && "stderr" in err) {
          const e = err as { stdout: string; stderr: string; status: number };
          const output = [e.stdout, e.stderr].filter(Boolean).join("\n");
          return { content: [{ type: "text" as const, text: `Exit code ${e.status}\n${output}` }], isError: true };
        }
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "env_get",
    "Get the value of an environment variable",
    { name: z.string().describe("Environment variable name") },
    async ({ name }) => {
      const value = process.env[name];
      if (value === undefined) {
        return { content: [{ type: "text" as const, text: `Environment variable ${name} is not set` }] };
      }
      return { content: [{ type: "text" as const, text: value }] };
    },
  );

  server.tool(
    "system_info",
    "Get system information (OS, CPU, memory, Node version)",
    {},
    async () => {
      const info = {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        hostname: os.hostname(),
        cpus: os.cpus().length,
        totalMemory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB`,
        freeMemory: `${Math.round(os.freemem() / (1024 * 1024 * 1024))}GB`,
        uptime: `${Math.round(os.uptime() / 3600)}h`,
        cwd: process.cwd(),
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(info, null, 2) }] };
    },
  );
}
