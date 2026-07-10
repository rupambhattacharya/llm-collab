import { Command } from "commander";
import chalk from "chalk";
import { CostTracker } from "../services/cost-tracker.js";
import { logger } from "../utils/logger.js";
import { audit } from "../hooks/audit-logger.js";

export const costsCommand = new Command("costs")
  .description("View token usage and costs")
  .option("--today", "Show today's costs")
  .option("--week", "Show this week's costs")
  .option("--since <date>", "Show costs since date (YYYY-MM-DD)")
  .option("--json", "Output raw JSON")
  .action((options: { today?: boolean; week?: boolean; since?: string; json?: boolean }) => {
    audit.commandStart("costs", options);
    const now = new Date();
    let since: Date | undefined;

    if (options.today) {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (options.week) {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    } else if (options.since) {
      since = new Date(options.since);
      if (isNaN(since.getTime())) {
        logger.error("Invalid date format. Use YYYY-MM-DD");
        audit.commandEnd("costs", "failure");
        process.exit(1);
      }
    }

    const records = CostTracker.loadRecords({ since });

    if (records.length === 0) {
      logger.passThrough(chalk.dim("No cost data" + (since ? ` since ${since.toISOString().slice(0, 10)}` : "")));
      audit.commandEnd("costs", "success", undefined, "no data");
      return;
    }

    const summary = CostTracker.summarize(records);

    if (options.json) {
      logger.passThrough(JSON.stringify(summary, null, 2));
    } else {
      logger.passThrough(chalk.bold("\nCost Summary\n"));
      logger.passThrough(CostTracker.formatSummary(summary));
      logger.passThrough("");
    }

    audit.commandEnd("costs", "success");
  });
