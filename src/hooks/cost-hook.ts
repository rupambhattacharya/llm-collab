import { hooks, type InferenceContext } from "./hook-manager.js";
import { costTracker } from "../services/cost-tracker.js";
import { logger } from "../utils/logger.js";

let sessionSpend = 0;
let budgetAlertFired = false;

export function registerCostHook(budgetAlertUsd?: number): void {
  hooks.on("inference", (ctx: InferenceContext) => {
    costTracker.record(ctx.model, ctx.provider, ctx.inputTokens, ctx.outputTokens, ctx.command);
    sessionSpend += ctx.costUsd;

    if (budgetAlertUsd && budgetAlertUsd > 0 && !budgetAlertFired && sessionSpend >= budgetAlertUsd) {
      budgetAlertFired = true;
      hooks.emitBudgetAlert(sessionSpend, budgetAlertUsd);
      logger.warn(`Budget alert: session spend $${sessionSpend.toFixed(4)} exceeds $${budgetAlertUsd.toFixed(2)} threshold`);
    }
  });
}

export function getSessionSpend(): number {
  return sessionSpend;
}

export function resetSessionSpend(): void {
  sessionSpend = 0;
  budgetAlertFired = false;
}
