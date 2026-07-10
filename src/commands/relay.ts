import { Command } from "commander";
import chalk from "chalk";
import { ConfigManager } from "../config/config-manager.js";
import { RelayServer } from "../services/relay-server.js";
import { logger } from "../utils/logger.js";
import { audit } from "../hooks/audit-logger.js";

export const relayCommand = new Command("relay")
  .argument("[port]", "Port to listen on")
  .option("--require-auth", "Require client authentication")
  .description("Start LLM relay proxy (OpenAI-compatible)")
  .action(async (portArg?: string, options?: { requireAuth?: boolean }) => {
    audit.commandStart("relay", { port: portArg, requireAuth: options?.requireAuth });
    const startTime = Date.now();

    const cm = ConfigManager.load();
    const config = cm.get();
    const port = portArg ? parseInt(portArg, 10) : config.relay.port;

    if (isNaN(port) || port < 1 || port > 65535) {
      logger.error("Invalid port number");
      audit.commandEnd("relay", "failure", Date.now() - startTime, "invalid port");
      process.exit(1);
    }

    const hasProvider = config.ai.providers.anthropic?.api_key || config.ai.providers.openai?.api_key;
    if (!hasProvider) {
      logger.error("No AI provider configured");
      logger.info(chalk.dim("Run 'llm-collab setup' to configure a provider"));
      audit.commandEnd("relay", "failure", Date.now() - startTime, "no provider");
      process.exit(1);
    }

    const relay = new RelayServer(config, { requireAuth: options?.requireAuth });
    await relay.start(port);

    logger.passThrough("");
    logger.passThrough(chalk.bold("LLM Relay Proxy"));
    logger.passThrough(`  ${chalk.green("●")} Listening on ${chalk.cyan(`http://localhost:${port}`)}`);
    logger.passThrough("");
    logger.passThrough("Endpoints:");
    logger.passThrough(`  POST ${chalk.dim("/v1/chat/completions")}  — proxied to upstream provider`);
    logger.passThrough(`  GET  ${chalk.dim("/v1/models")}            — list available models`);
    logger.passThrough(`  GET  ${chalk.dim("/health")}               — health check`);
    logger.passThrough("");

    const providers: string[] = [];
    if (config.ai.providers.anthropic?.api_key) providers.push("Anthropic");
    if (config.ai.providers.openai?.api_key) providers.push("OpenAI");
    logger.passThrough(`Providers: ${providers.join(", ")}`);
    if (options?.requireAuth) {
      logger.passThrough(chalk.yellow("Auth: required (Bearer token from ~/.llm-collab/keys/keys.json)"));
    }
    logger.passThrough("");
    logger.passThrough(chalk.dim("Press Ctrl+C to stop"));

    audit.commandEnd("relay", "success", Date.now() - startTime, `listening on port ${port}`);
  });
