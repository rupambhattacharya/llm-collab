import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config/schemas.js";
import { registerFileTools } from "./tools/file-tools.js";
import { registerSystemTools } from "./tools/system-tools.js";
import { logger } from "../utils/logger.js";

export function buildMcpServer(config: Config): McpServer {
  const server = new McpServer({
    name: "llm-collab",
    version: "0.1.0",
  });

  registerFileTools(server);
  logger.debug("Registered file tools: file_read, file_write, file_list, file_search");

  registerSystemTools(server);
  logger.debug("Registered system tools: shell_execute, env_get, system_info");

  if (config.integrations.github?.token) {
    logger.debug("GitHub integration configured — github_* tools will be registered when implemented");
  }

  if (config.integrations.linear?.api_key) {
    logger.debug("Linear integration configured — linear_* tools will be registered when implemented");
  }

  return server;
}
