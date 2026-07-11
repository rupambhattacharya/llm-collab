import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config/schemas.js";
import { registerFileTools } from "./tools/file-tools.js";
import { registerSystemTools } from "./tools/system-tools.js";
import { registerGitHubTools } from "./tools/github-tools.js";
import { registerLinearTools } from "./tools/linear-tools.js";
import { registerChronicleTools } from "./tools/chronicle-tools.js";
import { ChronicleStore } from "../chronicle/store.js";
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

  if (config.integrations.github) {
    registerGitHubTools(server, config.integrations.github);
    logger.debug("Registered GitHub tools: github_get_issue, github_search_issues, github_list_issues, github_create_issue, github_get_pr, github_list_prs, github_create_pr, github_ci_status, github_get_repo, github_add_comment");
  }

  if (config.integrations.linear) {
    registerLinearTools(server, config.integrations.linear);
    logger.debug("Registered Linear tools: linear_get_issue, linear_search_issues, linear_list_issues, linear_create_issue, linear_update_issue, linear_list_teams, linear_list_projects");
  }

  if (ChronicleStore.isInitialized()) {
    registerChronicleTools(server, config);
    logger.debug("Registered Chronicle tools: chronicle_search, chronicle_read, chronicle_write, chronicle_ask, chronicle_graph, chronicle_timeline, chronicle_entity, chronicle_stats");
  }

  return server;
}
