import * as fs from "node:fs";
import * as path from "node:path";
import { ConfigManager } from "../config/config-manager.js";
import { getModelCost, formatCost } from "../data/llm-costs.js";
import { logger } from "../utils/logger.js";

export interface UsageRecord {
  timestamp: string;
  sessionId: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  command?: string;
}

export interface CostSummary {
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byModel: Record<string, { inputTokens: number; outputTokens: number; costUsd: number; calls: number }>;
  byProvider: Record<string, { costUsd: number; calls: number }>;
  recordCount: number;
}

export class CostTracker {
  private sessionId: string;
  private sessionRecords: UsageRecord[] = [];

  constructor() {
    this.sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private getCostsDir(): string {
    return path.join(ConfigManager.getHomeDir(), "costs");
  }

  private getCostsPath(): string {
    return path.join(this.getCostsDir(), "sessions.jsonl");
  }

  record(model: string, provider: string, inputTokens: number, outputTokens: number, command?: string): UsageRecord {
    const costUsd = getModelCost(model, inputTokens, outputTokens);
    const record: UsageRecord = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      model,
      provider,
      inputTokens,
      outputTokens,
      costUsd,
      command,
    };

    this.sessionRecords.push(record);

    try {
      const dir = this.getCostsDir();
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.appendFileSync(this.getCostsPath(), JSON.stringify(record) + "\n", "utf-8");
    } catch {
      logger.debug("Failed to persist cost record");
    }

    return record;
  }

  getSessionSummary(): CostSummary {
    return CostTracker.summarize(this.sessionRecords);
  }

  static loadRecords(options?: { since?: Date; until?: Date }): UsageRecord[] {
    const costsPath = path.join(ConfigManager.getHomeDir(), "costs", "sessions.jsonl");
    if (!fs.existsSync(costsPath)) return [];

    const lines = fs.readFileSync(costsPath, "utf-8").split("\n").filter(Boolean);
    let records = lines.map((line) => JSON.parse(line) as UsageRecord);

    if (options?.since) {
      const sinceStr = options.since.toISOString();
      records = records.filter((r) => r.timestamp >= sinceStr);
    }
    if (options?.until) {
      const untilStr = options.until.toISOString();
      records = records.filter((r) => r.timestamp <= untilStr);
    }

    return records;
  }

  static summarize(records: UsageRecord[]): CostSummary {
    const summary: CostSummary = {
      totalCostUsd: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      byModel: {},
      byProvider: {},
      recordCount: records.length,
    };

    for (const r of records) {
      summary.totalCostUsd += r.costUsd;
      summary.totalInputTokens += r.inputTokens;
      summary.totalOutputTokens += r.outputTokens;

      if (!summary.byModel[r.model]) {
        summary.byModel[r.model] = { inputTokens: 0, outputTokens: 0, costUsd: 0, calls: 0 };
      }
      const m = summary.byModel[r.model]!;
      m.inputTokens += r.inputTokens;
      m.outputTokens += r.outputTokens;
      m.costUsd += r.costUsd;
      m.calls++;

      if (!summary.byProvider[r.provider]) {
        summary.byProvider[r.provider] = { costUsd: 0, calls: 0 };
      }
      const p = summary.byProvider[r.provider]!;
      p.costUsd += r.costUsd;
      p.calls++;
    }

    return summary;
  }

  static formatSummary(summary: CostSummary): string {
    const lines: string[] = [];
    lines.push(`Total: ${formatCost(summary.totalCostUsd)} (${summary.recordCount} calls)`);
    lines.push(`Tokens: ${summary.totalInputTokens.toLocaleString()} in / ${summary.totalOutputTokens.toLocaleString()} out`);
    lines.push("");

    if (Object.keys(summary.byModel).length > 0) {
      lines.push("By model:");
      for (const [model, data] of Object.entries(summary.byModel)) {
        lines.push(`  ${model}: ${formatCost(data.costUsd)} (${data.calls} calls)`);
      }
    }

    if (Object.keys(summary.byProvider).length > 0) {
      lines.push("");
      lines.push("By provider:");
      for (const [provider, data] of Object.entries(summary.byProvider)) {
        lines.push(`  ${provider}: ${formatCost(data.costUsd)} (${data.calls} calls)`);
      }
    }

    return lines.join("\n");
  }
}

export const costTracker = new CostTracker();
