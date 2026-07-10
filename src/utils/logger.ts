import chalk from "chalk";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_LABEL: Record<LogLevel, string> = {
  debug: chalk.gray("[debug]"),
  info: chalk.blue("[info]"),
  warn: chalk.yellow("[warn]"),
  error: chalk.red("[error]"),
};

class Logger {
  private minLevel: LogLevel;

  constructor() {
    this.minLevel = process.env["LLM_COLLAB_DEBUG"] ? "debug" : "info";
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      console.error(LEVEL_LABEL.debug, message, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.error(LEVEL_LABEL.info, message, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      console.error(LEVEL_LABEL.warn, message, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog("error")) {
      console.error(LEVEL_LABEL.error, message, ...args);
    }
  }

  passThrough(message: string): void {
    console.log(message);
  }
}

export const logger = new Logger();
