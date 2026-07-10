import { Command } from "commander";
import * as readline from "node:readline";
import chalk from "chalk";
import { ConfigManager } from "../config/config-manager.js";
import { AIService } from "../services/ai-service.js";
import { costTracker } from "../services/cost-tracker.js";
import { formatCost } from "../data/llm-costs.js";
import { logger } from "../utils/logger.js";
import { audit } from "../hooks/audit-logger.js";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const chatCommand = new Command("chat")
  .option("-m, --model <model>", "Model to use")
  .option("-s, --system <prompt>", "System prompt")
  .description("Interactive AI chat")
  .action(async (options: { model?: string; system?: string }) => {
    audit.commandStart("chat", options);
    const startTime = Date.now();

    const cm = ConfigManager.load();
    const config = cm.get();
    const ai = new AIService(config);

    const modelId = options.model ?? config.ai.default_model;
    const provider = ai.resolveProvider(modelId);

    logger.passThrough(chalk.bold("\nllm-collab Chat\n"));
    logger.passThrough(`  Model: ${chalk.cyan(modelId)} (${provider})`);
    if (options.system) {
      logger.passThrough(`  System: ${chalk.dim(options.system.slice(0, 60))}${options.system.length > 60 ? "..." : ""}`);
    }
    logger.passThrough(chalk.dim("  Type /quit to exit, /model to switch, /cost to see spending\n"));

    const history: Message[] = [];
    let currentModel = modelId;
    let systemPrompt = options.system;

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.green("you > "),
    });

    const handleInput = async (line: string): Promise<void> => {
      const input = line.trim();
      if (!input) {
        rl.prompt();
        return;
      }

      if (input === "/quit" || input === "/exit") {
        const summary = costTracker.getSessionSummary();
        if (summary.recordCount > 0) {
          logger.passThrough(chalk.dim(`\nSession cost: ${formatCost(summary.totalCostUsd)} (${summary.recordCount} messages)`));
        }
        audit.commandEnd("chat", "success", Date.now() - startTime, `${history.length} messages`);
        rl.close();
        return;
      }

      if (input === "/cost") {
        const summary = costTracker.getSessionSummary();
        if (summary.recordCount === 0) {
          logger.passThrough(chalk.dim("No messages yet"));
        } else {
          logger.passThrough(chalk.dim(CostTracker_formatSummary(summary)));
        }
        rl.prompt();
        return;
      }

      if (input.startsWith("/model")) {
        const newModel = input.split(" ")[1];
        if (newModel) {
          currentModel = newModel;
          logger.passThrough(chalk.dim(`Switched to ${currentModel}`));
          audit.decision("Model switch in chat", { from: modelId, to: currentModel });
        } else {
          logger.passThrough(chalk.dim(`Current model: ${currentModel}`));
        }
        rl.prompt();
        return;
      }

      if (input.startsWith("/system")) {
        systemPrompt = input.slice("/system".length).trim() || undefined;
        logger.passThrough(chalk.dim(systemPrompt ? `System prompt set` : "System prompt cleared"));
        rl.prompt();
        return;
      }

      if (input === "/clear") {
        history.length = 0;
        logger.passThrough(chalk.dim("History cleared"));
        rl.prompt();
        return;
      }

      history.push({ role: "user", content: input });

      const prompt = buildPrompt(history, systemPrompt);

      process.stdout.write(chalk.blue("assistant > "));

      try {
        const result = await ai.stream(
          prompt,
          { onText: (text) => process.stdout.write(text) },
          { model: currentModel, system: systemPrompt },
        );

        process.stdout.write("\n");
        history.push({ role: "assistant", content: result.text });

        const costStr = formatCost(result.costUsd);
        const tokenStr = `${result.inputTokens}in/${result.outputTokens}out`;
        logger.passThrough(chalk.dim(`  [${costStr} · ${tokenStr} · ${currentModel}]`));
        logger.passThrough("");
      } catch (err) {
        process.stdout.write("\n");
        const message = err instanceof Error ? err.message : String(err);
        logger.error(message);
        audit.logError(err, "chat stream");
        history.pop();
      }

      rl.prompt();
    };

    rl.on("line", (line) => {
      handleInput(line).catch((err) => {
        logger.error(err instanceof Error ? err.message : String(err));
        rl.prompt();
      });
    });

    rl.on("close", () => {
      audit.commandEnd("chat", "success", Date.now() - startTime);
      process.exit(0);
    });

    rl.prompt();
  });

function buildPrompt(history: Message[], _system?: string): string {
  return history.map((m) => `${m.role}: ${m.content}`).join("\n\n");
}

function CostTracker_formatSummary(summary: ReturnType<typeof costTracker.getSessionSummary>): string {
  const lines: string[] = [];
  lines.push(`Session: ${formatCost(summary.totalCostUsd)} (${summary.recordCount} calls)`);
  lines.push(`Tokens: ${summary.totalInputTokens.toLocaleString()} in / ${summary.totalOutputTokens.toLocaleString()} out`);
  for (const [model, data] of Object.entries(summary.byModel)) {
    lines.push(`  ${model}: ${formatCost(data.costUsd)} (${data.calls}x)`);
  }
  return lines.join("\n");
}
