import { hooks, type SessionContext, type ErrorContext } from "./hook-manager.js";
import { logger } from "../utils/logger.js";

export interface WebhookConfig {
  url: string;
  events: string[];
}

async function sendWebhook(url: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      logger.debug(`Webhook ${url} returned ${response.status}`);
    }
  } catch (err) {
    logger.debug(`Webhook failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function formatSlackPayload(event: string, detail: Record<string, unknown>): Record<string, unknown> {
  const text = `*llm-collab* \`${event}\`\n${JSON.stringify(detail, null, 2)}`;
  return { text };
}

function matchesEvent(webhookEvents: string[], event: string): boolean {
  if (webhookEvents.length === 0) return true;
  return webhookEvents.includes(event);
}

export function registerWebhooks(webhooks: WebhookConfig[]): void {
  if (webhooks.length === 0) return;

  hooks.on("sessionStart", (ctx: SessionContext) => {
    for (const wh of webhooks) {
      if (matchesEvent(wh.events, "session_start")) {
        const isSlack = wh.url.includes("hooks.slack.com");
        const payload = isSlack
          ? formatSlackPayload("session_start", { sessionId: ctx.sessionId })
          : { event: "session_start", timestamp: new Date().toISOString(), data: ctx };
        sendWebhook(wh.url, payload);
      }
    }
  });

  hooks.on("sessionEnd", (ctx: SessionContext) => {
    const event = ctx.result === "failure" ? "session_failed" : "session_complete";
    for (const wh of webhooks) {
      if (matchesEvent(wh.events, event) || matchesEvent(wh.events, "session_end")) {
        const isSlack = wh.url.includes("hooks.slack.com");
        const payload = isSlack
          ? formatSlackPayload(event, { sessionId: ctx.sessionId, durationMs: ctx.durationMs, result: ctx.result })
          : { event, timestamp: new Date().toISOString(), data: ctx };
        sendWebhook(wh.url, payload);
      }
    }
  });

  hooks.on("error", (ctx: ErrorContext) => {
    for (const wh of webhooks) {
      if (matchesEvent(wh.events, "error")) {
        const message = ctx.error instanceof Error ? ctx.error.message : String(ctx.error);
        const isSlack = wh.url.includes("hooks.slack.com");
        const payload = isSlack
          ? formatSlackPayload("error", { message, context: ctx.context })
          : { event: "error", timestamp: new Date().toISOString(), data: { message, context: ctx.context } };
        sendWebhook(wh.url, payload);
      }
    }
  });

  hooks.on("budgetAlert", (ctx) => {
    for (const wh of webhooks) {
      if (matchesEvent(wh.events, "budget_alert")) {
        const isSlack = wh.url.includes("hooks.slack.com");
        const payload = isSlack
          ? formatSlackPayload("budget_alert", { currentSpend: `$${ctx.currentSpend.toFixed(4)}`, budget: `$${ctx.budgetUsd.toFixed(2)}` })
          : { event: "budget_alert", timestamp: new Date().toISOString(), data: ctx };
        sendWebhook(wh.url, payload);
      }
    }
  });
}
