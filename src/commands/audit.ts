import { Command } from "commander";
import chalk from "chalk";
import { audit, type AuditEntry, type AuditEventType } from "../hooks/audit-logger.js";
import { logger } from "../utils/logger.js";

const EVENT_COLORS: Record<string, (s: string) => string> = {
  command_start: chalk.cyan,
  command_end: chalk.cyan,
  config_change: chalk.yellow,
  config_read: chalk.gray,
  tool_call: chalk.magenta,
  decision: chalk.green,
  error: chalk.red,
  session_start: chalk.blue,
  session_end: chalk.blue,
};

function formatEntry(entry: AuditEntry): string {
  const time = entry.timestamp.slice(11, 23);
  const colorFn = EVENT_COLORS[entry.event] ?? chalk.white;
  const event = colorFn(entry.event.padEnd(15));
  const seq = chalk.dim(`#${String(entry.seq).padStart(4)}`);

  const parts = [chalk.dim(time), seq, event];

  if (entry.command) parts.push(chalk.bold(entry.command));
  if (entry.detail) parts.push(entry.detail);
  if (entry.result) {
    parts.push(entry.result === "success" ? chalk.green("OK") : chalk.red("FAIL"));
  }
  if (entry.durationMs !== undefined) {
    parts.push(chalk.dim(`${entry.durationMs}ms`));
  }
  if (entry.error) parts.push(chalk.red(entry.error));

  return parts.join("  ");
}

export const auditCommand = new Command("audit")
  .description("View audit trail of all CLI actions")
  .addCommand(
    new Command("show")
      .description("Show audit log entries")
      .option("-d, --date <date>", "Date to show (YYYY-MM-DD)", new Date().toISOString().slice(0, 10))
      .option("-e, --event <type>", "Filter by event type")
      .option("-c, --command <name>", "Filter by command name")
      .option("-n, --limit <count>", "Max entries to show", "50")
      .option("-t, --tail", "Show latest entries (default: earliest)")
      .option("--json", "Output raw JSON lines")
      .action((options) => {
        const entries = audit.query({
          date: options.date,
          event: options.event as AuditEventType | undefined,
          command: options.command,
          limit: parseInt(options.limit, 10),
          tail: options.tail ?? true,
        });

        if (entries.length === 0) {
          logger.passThrough(chalk.dim(`No audit entries for ${options.date}`));
          return;
        }

        if (options.json) {
          for (const entry of entries) {
            logger.passThrough(JSON.stringify(entry));
          }
          return;
        }

        logger.passThrough(chalk.bold(`\nAudit log — ${options.date}\n`));
        for (const entry of entries) {
          logger.passThrough(formatEntry(entry));
        }
        logger.passThrough(chalk.dim(`\n${entries.length} entries shown`));
      }),
  )
  .addCommand(
    new Command("dates")
      .description("List dates with audit data")
      .action(() => {
        const dates = audit.listDates();
        if (dates.length === 0) {
          logger.passThrough(chalk.dim("No audit data yet"));
          return;
        }
        for (const date of dates) {
          logger.passThrough(date);
        }
      }),
  )
  .addCommand(
    new Command("tail")
      .description("Show the most recent audit entries")
      .option("-n, --limit <count>", "Number of entries", "20")
      .option("-e, --event <type>", "Filter by event type")
      .option("--json", "Output raw JSON lines")
      .action((options) => {
        const entries = audit.query({
          event: options.event as AuditEventType | undefined,
          limit: parseInt(options.limit, 10),
          tail: true,
        });

        if (entries.length === 0) {
          logger.passThrough(chalk.dim("No audit entries today"));
          return;
        }

        if (options.json) {
          for (const entry of entries) {
            logger.passThrough(JSON.stringify(entry));
          }
          return;
        }

        for (const entry of entries) {
          logger.passThrough(formatEntry(entry));
        }
      }),
  );
