import { Command } from "commander";
import chalk from "chalk";
import { configCommand } from "./commands/config-cmd.js";
import { setupCommand } from "./commands/setup.js";
import { auditCommand } from "./commands/audit.js";
import { chatCommand } from "./commands/chat.js";
import { relayCommand } from "./commands/relay.js";
import { costsCommand } from "./commands/costs.js";
import { mcpCommand } from "./commands/mcp.js";
import { githubCommand } from "./commands/github.js";
import { linearCommand } from "./commands/linear.js";
import { chronicleCommand } from "./commands/chronicle.js";
import { agentCommand } from "./commands/agent.js";
import { skillsCommand } from "./commands/skills.js";
import { completionsCommand } from "./commands/completions.js";
import { LLMCollabError } from "./utils/errors.js";
import { logger } from "./utils/logger.js";
import { audit } from "./hooks/audit-logger.js";
import { hooks } from "./hooks/hook-manager.js";
import { registerCostHook } from "./hooks/cost-hook.js";
import { registerWebhooks } from "./hooks/webhook.js";
import { ConfigManager } from "./config/config-manager.js";

const sessionStart = Date.now();

const program = new Command()
  .name("llm-collab")
  .version("0.1.0")
  .description("Open-source CLI for AI-powered multi-agent collaboration")
  .option("--debug", "Enable debug logging")
  .option("--no-audit", "Disable audit logging")
  .hook("preAction", (thisCommand) => {
    if (thisCommand.opts()["debug"]) {
      process.env["LLM_COLLAB_DEBUG"] = "1";
    }
    if (thisCommand.opts()["audit"] === false) {
      audit.disable();
    }
  });

audit.sessionStart({ argv: process.argv.slice(2) });

try {
  const config = ConfigManager.load().get();
  if (config.hooks.costs.enabled) {
    registerCostHook(config.hooks.costs.budget_alert_usd);
  }
  if (config.hooks.webhooks.length > 0) {
    registerWebhooks(config.hooks.webhooks);
  }
  hooks.emitSessionStart({ sessionId: audit.getSessionId(), argv: process.argv.slice(2) });
} catch {
  // Config may not exist yet (first run); hooks init is best-effort
}

program.addCommand(configCommand);
program.addCommand(setupCommand);
program.addCommand(auditCommand);
program.addCommand(chatCommand);
program.addCommand(relayCommand);
program.addCommand(costsCommand);
program.addCommand(mcpCommand);
program.addCommand(githubCommand);
program.addCommand(linearCommand);
program.addCommand(chronicleCommand);
program.addCommand(agentCommand);
program.addCommand(skillsCommand);
program.addCommand(completionsCommand);

program.parseAsync(process.argv).then(() => {
  hooks.emitSessionEnd({ sessionId: audit.getSessionId(), durationMs: Date.now() - sessionStart, result: "success" });
  audit.sessionEnd(Date.now() - sessionStart);
}).catch((err: unknown) => {
  hooks.emitError({ error: err instanceof Error ? err : String(err), context: "top-level" });
  hooks.emitSessionEnd({ sessionId: audit.getSessionId(), durationMs: Date.now() - sessionStart, result: "failure" });
  audit.logError(err, "top-level");
  audit.sessionEnd(Date.now() - sessionStart, { result: "failure" });

  if (err instanceof LLMCollabError) {
    logger.error(err.message);
    if (err.hint) {
      logger.info(chalk.dim(`Hint: ${err.hint}`));
    }
    if (process.env["LLM_COLLAB_DEBUG"]) {
      logger.debug(err.stack ?? "");
    }
    process.exit(1);
  }

  if (err instanceof Error) {
    logger.error(err.message);
    if (process.env["LLM_COLLAB_DEBUG"]) {
      logger.debug(err.stack ?? "");
    }
    process.exit(1);
  }

  logger.error(String(err));
  process.exit(1);
});
