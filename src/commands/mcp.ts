import { Command } from "commander";
import chalk from "chalk";
import { ConfigManager } from "../config/config-manager.js";
import { buildMcpServer } from "../mcp/server.js";
import { logger } from "../utils/logger.js";
import { audit } from "../hooks/audit-logger.js";

export const mcpCommand = new Command("mcp")
  .description("Start MCP server")
  .addCommand(
    new Command("stdio")
      .description("Start MCP server over stdio")
      .action(async () => {
        audit.commandStart("mcp stdio");
        const cm = ConfigManager.load();
        const config = cm.get();

        const server = buildMcpServer(config);

        const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
        const transport = new StdioServerTransport();
        await server.connect(transport);

        audit.commandEnd("mcp stdio", "success", undefined, "connected via stdio");
      }),
  )
  .addCommand(
    new Command("http")
      .description("Start MCP server over HTTP+SSE")
      .option("-p, --port <port>", "Port to listen on", "3456")
      .action(async (options: { port: string }) => {
        audit.commandStart("mcp http", { port: options.port });
        const port = parseInt(options.port, 10);

        if (isNaN(port) || port < 1 || port > 65535) {
          logger.error("Invalid port number");
          audit.commandEnd("mcp http", "failure", undefined, "invalid port");
          process.exit(1);
        }

        const cm = ConfigManager.load();
        const config = cm.get();

        const server = buildMcpServer(config);

        const { default: express } = await import("express");
        const { SSEServerTransport } = await import("@modelcontextprotocol/sdk/server/sse.js");

        const app = express();
        let sseTransport: InstanceType<typeof SSEServerTransport> | null = null;

        app.get("/sse", (req, res) => {
          sseTransport = new SSEServerTransport("/messages", res);
          server.connect(sseTransport);
        });

        app.post("/messages", (req, res) => {
          if (!sseTransport) {
            res.status(400).json({ error: "No SSE connection established" });
            return;
          }
          sseTransport.handlePostMessage(req, res);
        });

        app.get("/health", (_req, res) => {
          res.json({ status: "ok", transport: "sse" });
        });

        app.listen(port, () => {
          logger.passThrough("");
          logger.passThrough(chalk.bold("MCP Server (HTTP+SSE)"));
          logger.passThrough(`  ${chalk.green("●")} Listening on ${chalk.cyan(`http://localhost:${port}`)}`);
          logger.passThrough("");
          logger.passThrough("Endpoints:");
          logger.passThrough(`  GET  ${chalk.dim("/sse")}       — SSE event stream`);
          logger.passThrough(`  POST ${chalk.dim("/messages")}  — send messages`);
          logger.passThrough(`  GET  ${chalk.dim("/health")}    — health check`);
          logger.passThrough("");
          logger.passThrough(chalk.dim("Press Ctrl+C to stop"));
          audit.commandEnd("mcp http", "success", undefined, `listening on port ${port}`);
        });
      }),
  );
