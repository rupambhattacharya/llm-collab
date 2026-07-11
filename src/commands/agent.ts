import { Command } from "commander";
import chalk from "chalk";
import { ConfigManager } from "../config/config-manager.js";
import { AgentService, type AgentType } from "../services/agent-service.js";
import { DOMAIN_AGENTS } from "../config/sub-agents.js";
import { logger } from "../utils/logger.js";
import { audit } from "../hooks/audit-logger.js";

export const agentCommand = new Command("agent")
  .description("Launch AI agents")
  .addCommand(
    new Command("claude")
      .description("Launch Claude Code with MCP tools and project context")
      .option("-p, --prompt <prompt>", "Initial prompt")
      .option("-r, --resume <session>", "Resume a previous session")
      .option("--model <model>", "Override model")
      .option("--live", "Enable live streaming output")
      .action(async (options) => {
        await launchAgent("claude", options);
      }),
  )
  .addCommand(
    new Command("codex")
      .description("Launch Codex CLI with project context")
      .option("-p, --prompt <prompt>", "Initial prompt")
      .option("--model <model>", "Override model")
      .action(async (options) => {
        await launchAgent("codex", options);
      }),
  )
  .addCommand(
    new Command("opencode")
      .description("Launch OpenCode with project context")
      .option("-p, --prompt <prompt>", "Initial prompt")
      .action(async (options) => {
        await launchAgent("opencode", options);
      }),
  )
  .addCommand(
    new Command("install")
      .description("Install domain-expert sub-agents to ~/.claude/agents/")
      .option("--force", "Overwrite existing agent files")
      .action(async (options) => {
        const startTime = Date.now();
        audit.commandStart("agent install");

        if (options.force) {
          const agents = DOMAIN_AGENTS;
          const result = AgentService.installDomainAgents(agents);
          const allInstalled = [...result.installed, ...result.skipped];
          logger.passThrough(chalk.green(`Installed ${allInstalled.length} domain agents:`));
          for (const name of allInstalled) {
            logger.passThrough(`  ${chalk.cyan(name)}`);
          }
        } else {
          const result = AgentService.installDomainAgents();

          if (result.installed.length > 0) {
            logger.passThrough(chalk.green(`Installed ${result.installed.length} domain agent(s):`));
            for (const name of result.installed) {
              logger.passThrough(`  ${chalk.cyan(name)}`);
            }
          }
          if (result.skipped.length > 0) {
            logger.passThrough(chalk.dim(`Skipped ${result.skipped.length} (already exist): ${result.skipped.join(", ")}`));
          }
          if (result.installed.length === 0 && result.skipped.length > 0) {
            logger.passThrough(chalk.dim("All domain agents already installed. Use --force to overwrite."));
          }
        }

        audit.commandEnd("agent install", "success", Date.now() - startTime);
      }),
  )
  .addCommand(
    new Command("list")
      .description("List installed agents")
      .option("--json", "Output as JSON")
      .action(async (options) => {
        const startTime = Date.now();
        audit.commandStart("agent list");

        const installed = AgentService.getInstalledAgents();
        const domainNames = new Set(DOMAIN_AGENTS.map((a) => a.name));

        audit.commandEnd("agent list", "success", Date.now() - startTime);

        if (options.json) {
          logger.passThrough(JSON.stringify({
            installed,
            domain_agents: DOMAIN_AGENTS.map((a) => ({
              name: a.name,
              description: a.description,
              model: a.model,
              installed: installed.includes(a.name),
            })),
          }, null, 2));
          return;
        }

        logger.passThrough(chalk.bold("Installed Agents:\n"));

        if (installed.length === 0) {
          logger.passThrough(chalk.dim("  No agents installed. Run 'llm-collab agent install' to set up domain experts."));
        } else {
          for (const name of installed) {
            const isDomain = domainNames.has(name);
            const badge = isDomain ? chalk.dim(" (domain expert)") : "";
            logger.passThrough(`  ${chalk.cyan(name)}${badge}`);
          }
        }

        logger.passThrough(chalk.bold("\nAvailable Domain Agents:\n"));
        for (const agent of DOMAIN_AGENTS) {
          const status = installed.includes(agent.name) ? chalk.green("installed") : chalk.yellow("not installed");
          logger.passThrough(`  ${chalk.cyan(agent.name)} [${status}]`);
          logger.passThrough(chalk.dim(`    ${agent.description}`));
        }

        logger.passThrough(chalk.bold("\nAgent Types:\n"));
        logger.passThrough(`  ${chalk.cyan("claude")}   — Launch Claude Code`);
        logger.passThrough(`  ${chalk.cyan("codex")}    — Launch Codex CLI`);
        logger.passThrough(`  ${chalk.cyan("opencode")} — Launch OpenCode`);
      }),
  );

async function launchAgent(
  type: AgentType,
  options: { prompt?: string; resume?: string; model?: string; live?: boolean },
): Promise<void> {
  const startTime = Date.now();
  audit.commandStart(`agent ${type}`, { prompt: options.prompt ? "(provided)" : undefined });

  const config = ConfigManager.load().get();
  const agentService = new AgentService(config);

  logger.passThrough(chalk.bold(`Launching ${type}...`));

  if (options.model) {
    logger.passThrough(chalk.dim(`  Model: ${options.model}`));
  }
  if (options.prompt) {
    logger.passThrough(chalk.dim(`  Prompt: ${options.prompt.slice(0, 60)}${options.prompt.length > 60 ? "..." : ""}`));
  }

  logger.passThrough("");

  const child = agentService.launch(type, {
    prompt: options.prompt,
    resume: options.resume,
    model: options.model,
    live: options.live,
  });

  await new Promise<void>((resolve) => {
    child.on("exit", (code) => {
      audit.commandEnd(`agent ${type}`, code === 0 ? "success" : "failure", Date.now() - startTime);
      resolve();
    });
    child.on("error", (err) => {
      logger.error(`Failed to launch ${type}: ${err.message}`);
      logger.info(chalk.dim(`Make sure '${type}' is installed and available in your PATH`));
      audit.commandEnd(`agent ${type}`, "failure", Date.now() - startTime, err.message);
      resolve();
    });
  });
}
