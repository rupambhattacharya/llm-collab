import { Command } from "commander";
import chalk from "chalk";
import { ConfigManager } from "../config/config-manager.js";
import { logger } from "../utils/logger.js";
import { ConfigError } from "../utils/errors.js";
import { audit } from "../hooks/audit-logger.js";

export const configCommand = new Command("config")
  .description("View and edit configuration")
  .addCommand(
    new Command("get")
      .argument("<key>", "Config key in dot notation (e.g. ai.default_model)")
      .description("Get a configuration value")
      .action((key: string) => {
        audit.commandStart("config get", { key });
        const cm = ConfigManager.load();
        const value = cm.getValue(key);
        if (value === undefined) {
          audit.commandEnd("config get", "failure", undefined, `key not found: ${key}`);
          logger.error(`Key not found: ${key}`);
          process.exit(1);
        }
        audit.configRead(key);
        audit.commandEnd("config get", "success");
        if (typeof value === "object") {
          logger.passThrough(JSON.stringify(value, null, 2));
        } else {
          logger.passThrough(String(value));
        }
      }),
  )
  .addCommand(
    new Command("set")
      .argument("<key>", "Config key in dot notation")
      .argument("<value>", "Value to set")
      .description("Set a configuration value")
      .action((key: string, value: string) => {
        audit.commandStart("config set", { key, value });
        const cm = ConfigManager.load();
        const oldValue = cm.getValue(key);

        let parsed: unknown = value;
        if (value === "true") parsed = true;
        else if (value === "false") parsed = false;
        else if (/^\d+$/.test(value)) parsed = parseInt(value, 10);
        else if (/^\d+\.\d+$/.test(value)) parsed = parseFloat(value);

        try {
          cm.setValue(key, parsed);
          audit.configChange(key, oldValue, parsed);
          audit.commandEnd("config set", "success");
          logger.passThrough(`${chalk.green("Set")} ${key} = ${JSON.stringify(parsed)}`);
        } catch (err) {
          audit.logError(err, `config set ${key}`);
          audit.commandEnd("config set", "failure");
          if (err instanceof ConfigError) {
            logger.error(err.message);
            if (err.hint) logger.info(err.hint);
            process.exit(1);
          }
          throw err;
        }
      }),
  )
  .addCommand(
    new Command("list")
      .description("Show all configuration")
      .action(() => {
        audit.commandStart("config list");
        audit.configRead();
        const cm = ConfigManager.load();
        audit.commandEnd("config list", "success");
        logger.passThrough(JSON.stringify(cm.get(), null, 2));
      }),
  )
  .addCommand(
    new Command("path")
      .description("Show config file path")
      .action(() => {
        audit.commandStart("config path");
        audit.commandEnd("config path", "success");
        logger.passThrough(ConfigManager.getConfigPath());
      }),
  );
