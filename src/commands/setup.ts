import { Command } from "commander";
import { input, select, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { ConfigManager } from "../config/config-manager.js";
import { configSchema, type Config } from "../config/schemas.js";
import { logger } from "../utils/logger.js";
import { audit } from "../hooks/audit-logger.js";

export const setupCommand = new Command("setup")
  .description("Interactive configuration wizard")
  .action(async () => {
    const startTime = Date.now();
    audit.commandStart("setup");
    logger.passThrough(chalk.bold("\nllm-collab Setup Wizard\n"));
    logger.passThrough(chalk.dim("Configure your AI providers and integrations.\n"));

    const cm = ConfigManager.load();
    const existing = cm.get();

    const provider = await select<"anthropic" | "openai" | "ollama" | "openrouter">({
      message: "Default LLM provider:",
      choices: [
        { name: "Anthropic (Claude)", value: "anthropic" },
        { name: "OpenAI (GPT)", value: "openai" },
        { name: "Ollama (Local)", value: "ollama" },
        { name: "OpenRouter (Multi-provider)", value: "openrouter" },
      ],
      default: existing.ai.default_provider,
    });

    const providerConfig: Record<string, unknown> = {};

    if (provider === "ollama") {
      const baseUrl = await input({
        message: "Ollama base URL:",
        default: existing.ai.providers.ollama?.base_url ?? "http://localhost:11434",
      });
      providerConfig.base_url = baseUrl;
    } else {
      const existingProviders = existing.ai.providers;
      const existingKey = existingProviders[provider]?.api_key;
      const keyHint = existingKey ? ` (current: ${maskKey(existingKey)})` : "";
      const apiKey = await input({
        message: `${providerLabel(provider)} API key${keyHint}:`,
        default: existingKey ?? "",
      });
      if (apiKey) {
        providerConfig.api_key = apiKey;
      }
    }

    const wantGithub = await confirm({
      message: "Configure GitHub integration?",
      default: !!existing.integrations.github,
    });

    let githubConfig: { token: string; org?: string } | undefined;
    if (wantGithub) {
      const existingToken = existing.integrations.github?.token;
      const tokenHint = existingToken ? ` (current: ${maskKey(existingToken)})` : "";
      const token = await input({
        message: `GitHub token${tokenHint}:`,
        default: existingToken ?? "",
      });
      const org = await input({
        message: "GitHub org (optional):",
        default: existing.integrations.github?.org ?? "",
      });
      if (token) {
        githubConfig = { token, ...(org ? { org } : {}) };
      }
    }

    const wantLinear = await confirm({
      message: "Configure Linear integration?",
      default: !!existing.integrations.linear,
    });

    let linearConfig: { api_key: string } | undefined;
    if (wantLinear) {
      const existingKey = existing.integrations.linear?.api_key;
      const keyHint = existingKey ? ` (current: ${maskKey(existingKey)})` : "";
      const apiKey = await input({
        message: `Linear API key${keyHint}:`,
        default: existingKey ?? "",
      });
      if (apiKey) {
        linearConfig = { api_key: apiKey };
      }
    }

    const newConfig: Record<string, unknown> = {
      ai: {
        ...existing.ai,
        default_provider: provider,
        providers: {
          ...existing.ai.providers,
          [provider]: providerConfig,
        },
      },
      integrations: {
        ...existing.integrations,
        ...(githubConfig ? { github: githubConfig } : {}),
        ...(linearConfig ? { linear: linearConfig } : {}),
      },
      chronicle: existing.chronicle,
      relay: existing.relay,
      hooks: existing.hooks,
      night_watch: existing.night_watch,
    };

    const result = configSchema.safeParse(newConfig);
    if (!result.success) {
      audit.logError("Invalid configuration produced", "setup validation");
      audit.commandEnd("setup", "failure", Date.now() - startTime);
      logger.error("Invalid configuration produced — this is a bug.");
      process.exit(1);
    }

    cm.save(result.data);

    const configured: string[] = [provider];
    if (githubConfig) configured.push("github");
    if (linearConfig) configured.push("linear");
    audit.decision("Setup wizard completed", { provider, integrations: configured });
    audit.configChange("setup", "<wizard>", `provider=${provider}, integrations=${configured.join(",")}`);
    audit.commandEnd("setup", "success", Date.now() - startTime);

    logger.passThrough("");
    logger.passThrough(chalk.green("Configuration saved!"));
    logger.passThrough(chalk.dim(`  File: ${cm.getPath()}`));
    logger.passThrough("");
    logger.passThrough("Next steps:");
    logger.passThrough(`  ${chalk.cyan("llm-collab agent claude")}  Launch Claude Code with MCP`);
    logger.passThrough(`  ${chalk.cyan("llm-collab chat")}          Start an AI chat`);
    logger.passThrough(`  ${chalk.cyan("llm-collab config list")}   View your config`);
    logger.passThrough("");
  });

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}

function providerLabel(provider: string): string {
  const labels: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    openrouter: "OpenRouter",
  };
  return labels[provider] ?? provider;
}
