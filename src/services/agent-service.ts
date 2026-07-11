import * as childProcess from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import type { Config } from "../config/schemas.js";
import { DOMAIN_AGENTS, generateAgentMarkdown, type SubAgentConfig } from "../config/sub-agents.js";
import { ConfigManager } from "../config/config-manager.js";
import { logger } from "../utils/logger.js";
import { audit } from "../hooks/audit-logger.js";

export type AgentType = "claude" | "codex" | "opencode";

export interface AgentLaunchOptions {
  prompt?: string;
  resume?: string;
  live?: boolean;
  model?: string;
  permissionMode?: string;
  allowedTools?: string[];
}

export class AgentService {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  resolveComplexityModel(level: "low" | "medium" | "high"): string {
    return this.config.ai.complexity_routing[level];
  }

  buildEnv(): Record<string, string> {
    const env: Record<string, string> = { ...process.env } as Record<string, string>;

    if (this.config.ai.providers.anthropic?.api_key) {
      env["ANTHROPIC_API_KEY"] = this.config.ai.providers.anthropic.api_key;
    }
    if (this.config.ai.providers.openai?.api_key) {
      env["OPENAI_API_KEY"] = this.config.ai.providers.openai.api_key;
    }

    return env;
  }

  getMcpConfig(): Record<string, { command: string; args: string[] }> {
    return {
      "llm-collab": {
        command: "npx",
        args: ["-y", "tsx", path.resolve("src/index.ts"), "mcp", "stdio"],
      },
    };
  }

  launchClaude(options: AgentLaunchOptions = {}): childProcess.ChildProcess {
    const args: string[] = [];

    if (options.prompt) {
      args.push("-p", options.prompt);
    }
    if (options.resume) {
      args.push("-r", options.resume);
    }
    if (options.model) {
      args.push("--model", options.model);
    }
    if (options.allowedTools && options.allowedTools.length > 0) {
      args.push("--allowedTools", options.allowedTools.join(","));
    }

    const env = this.buildEnv();
    const startTime = Date.now();
    audit.toolCall("agent.launch", { type: "claude", args });

    const child = childProcess.spawn("claude", args, {
      stdio: "inherit",
      env,
      shell: true,
    });

    child.on("exit", (code) => {
      audit.toolCall("agent.launch", { type: "claude" }, code === 0 ? "success" : "failure", Date.now() - startTime);
    });

    return child;
  }

  launchCodex(options: AgentLaunchOptions = {}): childProcess.ChildProcess {
    const args: string[] = [];

    if (options.prompt) {
      args.push(options.prompt);
    }
    if (options.model) {
      args.push("--model", options.model);
    }

    const env = this.buildEnv();
    const startTime = Date.now();
    audit.toolCall("agent.launch", { type: "codex", args });

    const child = childProcess.spawn("codex", args, {
      stdio: "inherit",
      env,
      shell: true,
    });

    child.on("exit", (code) => {
      audit.toolCall("agent.launch", { type: "codex" }, code === 0 ? "success" : "failure", Date.now() - startTime);
    });

    return child;
  }

  launchOpenCode(options: AgentLaunchOptions = {}): childProcess.ChildProcess {
    const args: string[] = [];

    if (options.prompt) {
      args.push("--prompt", options.prompt);
    }

    const env = this.buildEnv();
    const startTime = Date.now();
    audit.toolCall("agent.launch", { type: "opencode", args });

    const child = childProcess.spawn("opencode", args, {
      stdio: "inherit",
      env,
      shell: true,
    });

    child.on("exit", (code) => {
      audit.toolCall("agent.launch", { type: "opencode" }, code === 0 ? "success" : "failure", Date.now() - startTime);
    });

    return child;
  }

  launch(agentType: AgentType, options: AgentLaunchOptions = {}): childProcess.ChildProcess {
    switch (agentType) {
      case "claude": return this.launchClaude(options);
      case "codex": return this.launchCodex(options);
      case "opencode": return this.launchOpenCode(options);
    }
  }

  static installDomainAgents(agents?: SubAgentConfig[]): { installed: string[]; skipped: string[] } {
    const agentDir = path.join(os.homedir(), ".claude", "agents");
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }

    const toInstall = agents ?? DOMAIN_AGENTS;
    const installed: string[] = [];
    const skipped: string[] = [];

    for (const agent of toInstall) {
      const filePath = path.join(agentDir, `${agent.name}.md`);
      if (fs.existsSync(filePath)) {
        skipped.push(agent.name);
        logger.debug(`Skipping ${agent.name} — already exists at ${filePath}`);
        continue;
      }

      const content = generateAgentMarkdown(agent);
      fs.writeFileSync(filePath, content, "utf-8");
      installed.push(agent.name);
      logger.debug(`Installed ${agent.name} to ${filePath}`);
    }

    return { installed, skipped };
  }

  static getInstalledAgents(): string[] {
    const agentDir = path.join(os.homedir(), ".claude", "agents");
    if (!fs.existsSync(agentDir)) return [];

    return fs.readdirSync(agentDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""));
  }
}
