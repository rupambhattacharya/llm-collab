import type { ChronicleStore, TimelineEntry } from "./store.js";

export interface DecisionRecord {
  id: string;
  title: string;
  rationale: string;
  alternatives: string[];
  context: string;
  timestamp: string;
}

export class TimelineManager {
  private store: ChronicleStore;

  constructor(store: ChronicleStore) {
    this.store = store;
  }

  recordDecision(title: string, rationale: string, options?: { alternatives?: string[]; context?: string }): string {
    const item = this.store.addItem(
      `Decision: ${title}\n\nRationale: ${rationale}${options?.alternatives?.length ? `\n\nAlternatives considered:\n${options.alternatives.map((a) => `- ${a}`).join("\n")}` : ""}${options?.context ? `\n\nContext: ${options.context}` : ""}`,
      "decision",
      {
        title,
        rationale,
        alternatives: options?.alternatives ?? [],
        context: options?.context ?? "",
      },
    );
    return item.id;
  }

  getDecisions(options: { since?: string; until?: string; limit?: number } = {}): DecisionRecord[] {
    const items = this.store.listItems({ type: "decision", limit: options.limit ?? 50 });

    return items
      .filter((item) => {
        if (options.since && item.created_at < options.since) return false;
        if (options.until && item.created_at > options.until) return false;
        return true;
      })
      .map((item) => ({
        id: item.id,
        title: (item.metadata.title as string) ?? item.content.split("\n")[0] ?? "",
        rationale: (item.metadata.rationale as string) ?? "",
        alternatives: (item.metadata.alternatives as string[]) ?? [],
        context: (item.metadata.context as string) ?? "",
        timestamp: item.created_at,
      }));
  }

  getItemHistory(itemId: string): TimelineEntry[] {
    return this.store.getTimeline(itemId);
  }

  getRecentActivity(options: { since?: string; limit?: number } = {}): TimelineEntry[] {
    return this.store.getTimeline(undefined, {
      since: options.since,
      limit: options.limit ?? 20,
    });
  }

  getSnapshotAt(itemId: string, timestamp: string): Record<string, unknown> | null {
    const entries = this.store.getTimeline(itemId, { until: timestamp, limit: 1 });
    return entries.length > 0 ? entries[0]!.snapshot : null;
  }

  formatTimeline(entries: TimelineEntry[]): string {
    if (entries.length === 0) return "No timeline entries found.";

    const lines: string[] = [];
    for (const entry of entries) {
      const date = new Date(entry.timestamp);
      const dateStr = date.toLocaleDateString();
      const timeStr = date.toLocaleTimeString();
      const type = (entry.snapshot.type as string) ?? "update";
      const preview = truncate((entry.snapshot.content as string) ?? JSON.stringify(entry.snapshot), 80);
      lines.push(`[${dateStr} ${timeStr}] (${type}) ${preview}`);
    }
    return lines.join("\n");
  }

  formatDecisions(decisions: DecisionRecord[]): string {
    if (decisions.length === 0) return "No decisions recorded.";

    const lines: string[] = [];
    for (const d of decisions) {
      const date = new Date(d.timestamp).toLocaleDateString();
      lines.push(`[${date}] ${d.title}`);
      lines.push(`  Rationale: ${d.rationale}`);
      if (d.alternatives.length > 0) {
        lines.push(`  Alternatives: ${d.alternatives.join(", ")}`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}
