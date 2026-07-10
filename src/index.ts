#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { configCommand } from "./commands/config-cmd.js";
import { setupCommand } from "./commands/setup.js";
import { auditCommand } from "./commands/audit.js";
import { LLMCollabError } from "./utils/errors.js";
import { logger } from "./utils/logger.js";
import { audit } from "./hooks/audit-logger.js";

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

program.addCommand(configCommand);
program.addCommand(setupCommand);
program.addCommand(auditCommand);

program.parseAsync(process.argv).then(() => {
  audit.sessionEnd(Date.now() - sessionStart);
}).catch((err: unknown) => {
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
