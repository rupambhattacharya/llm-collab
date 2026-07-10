import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { configSchema, type Config } from "./schemas.js";
import { ConfigError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export class ConfigManager {
  private static instance: ConfigManager | null = null;
  private config: Config;
  private configPath: string;

  private constructor(config: Config, configPath: string) {
    this.config = config;
    this.configPath = configPath;
  }

  static getHomeDir(): string {
    return process.env["LLM_COLLAB_HOME"] ?? path.join(os.homedir(), ".llm-collab");
  }

  static getConfigPath(): string {
    return process.env["LLM_COLLAB_CONFIG"] ?? path.join(ConfigManager.getHomeDir(), "config.json");
  }

  static load(overrides?: Partial<Config>): ConfigManager {
    if (ConfigManager.instance) return ConfigManager.instance;

    const configPath = ConfigManager.getConfigPath();
    let fileConfig: Record<string, unknown> = {};

    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, "utf-8");
        fileConfig = JSON.parse(raw) as Record<string, unknown>;
        logger.debug(`Loaded config from ${configPath}`);
      } catch (err) {
        throw new ConfigError(
          `Failed to parse config file: ${configPath}`,
          "Check that your config.json is valid JSON",
        );
      }
    } else {
      logger.debug("No config file found, using defaults");
    }

    const envConfig = ConfigManager.readEnvOverrides();
    const merged = ConfigManager.deepMerge(fileConfig, envConfig, overrides ?? {});

    const result = configSchema.safeParse(merged);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new ConfigError(
        `Invalid configuration:\n${issues}`,
        "Run 'llm-collab setup' to fix your configuration",
      );
    }

    ConfigManager.instance = new ConfigManager(result.data, configPath);
    return ConfigManager.instance;
  }

  static reset(): void {
    ConfigManager.instance = null;
  }

  get(): Config {
    return this.config;
  }

  getPath(): string {
    return this.configPath;
  }

  getValue(dotPath: string): unknown {
    const keys = dotPath.split(".");
    let current: unknown = this.config;
    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  setValue(dotPath: string, value: unknown): void {
    const keys = dotPath.split(".");
    const raw = this.readRawFile();

    let current = raw;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]!;
      if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]!] = value;

    const result = configSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new ConfigError(
        `Invalid value for ${dotPath}:\n${issues}`,
      );
    }

    this.writeRawFile(raw);
    this.config = result.data;
  }

  save(config: Config): void {
    this.config = config;
    this.writeRawFile(config as unknown as Record<string, unknown>);
  }

  ensureHomeDir(): void {
    const homeDir = ConfigManager.getHomeDir();
    if (!fs.existsSync(homeDir)) {
      fs.mkdirSync(homeDir, { recursive: true });
      logger.debug(`Created home directory: ${homeDir}`);
    }
  }

  private readRawFile(): Record<string, unknown> {
    if (fs.existsSync(this.configPath)) {
      return JSON.parse(fs.readFileSync(this.configPath, "utf-8")) as Record<string, unknown>;
    }
    return {};
  }

  private writeRawFile(data: Record<string, unknown>): void {
    this.ensureHomeDir();
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
    fs.chmodSync(this.configPath, 0o600);
    logger.debug(`Saved config to ${this.configPath}`);
  }

  private static readEnvOverrides(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const prefix = "LLM_COLLAB_";

    for (const [key, value] of Object.entries(process.env)) {
      if (!key.startsWith(prefix) || key === "LLM_COLLAB_DEBUG" || key === "LLM_COLLAB_CONFIG" || key === "LLM_COLLAB_HOME") {
        continue;
      }

      const configKey = key.slice(prefix.length).toLowerCase();
      const keys = configKey.split("__");
      let current = result;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i]!;
        if (!(k in current)) current[k] = {};
        current = current[k] as Record<string, unknown>;
      }
      current[keys[keys.length - 1]!] = value;
    }

    const envFallbacks: Record<string, string> = {
      ANTHROPIC_API_KEY: "ai.providers.anthropic.api_key",
      OPENAI_API_KEY: "ai.providers.openai.api_key",
      GITHUB_TOKEN: "integrations.github.token",
    };

    for (const [envVar, dotPath] of Object.entries(envFallbacks)) {
      const value = process.env[envVar];
      if (!value) continue;

      const keys = dotPath.split(".");
      let current = result;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i]!;
        if (!(k in current)) current[k] = {};
        current = current[k] as Record<string, unknown>;
      }
      const lastKey = keys[keys.length - 1]!;
      if (!(lastKey in current)) {
        current[lastKey] = value;
      }
    }

    return result;
  }

  private static deepMerge(
    ...objects: Record<string, unknown>[]
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const obj of objects) {
      for (const [key, value] of Object.entries(obj)) {
        if (
          value !== null &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          result[key] !== null &&
          typeof result[key] === "object" &&
          !Array.isArray(result[key])
        ) {
          result[key] = ConfigManager.deepMerge(
            result[key] as Record<string, unknown>,
            value as Record<string, unknown>,
          );
        } else {
          result[key] = value;
        }
      }
    }
    return result;
  }
}
