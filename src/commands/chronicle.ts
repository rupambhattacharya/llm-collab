import { Command } from "commander";
import chalk from "chalk";
import { ConfigManager } from "../config/config-manager.js";
import { ChronicleStore } from "../chronicle/store.js";
import { KnowledgeGraph } from "../chronicle/graph.js";
import { TimelineManager } from "../chronicle/timeline.js";
import { QueryEngine } from "../chronicle/query.js";
import { EmbeddingService } from "../chronicle/embeddings.js";
import { AIService } from "../services/ai-service.js";
import { logger } from "../utils/logger.js";
import { audit } from "../hooks/audit-logger.js";

export const chronicleCommand = new Command("chronicle")
  .description("Project knowledge store")
  .addCommand(
    new Command("init")
      .description("Initialize Chronicle for the current project")
      .action(async () => {
        const startTime = Date.now();
        audit.commandStart("chronicle init");

        if (ChronicleStore.isInitialized()) {
          const store = ChronicleStore.open();
          const stats = store.stats();
          store.close();
          logger.passThrough(chalk.yellow("Chronicle already initialized for this project."));
          logger.passThrough(chalk.dim(`  Database: ${ChronicleStore.getDbPath()}`));
          logger.passThrough(chalk.dim(`  Items: ${stats.items}, Entities: ${stats.entities}, Relations: ${stats.relations}`));
          audit.commandEnd("chronicle init", "success", Date.now() - startTime);
          return;
        }

        const store = ChronicleStore.init();
        store.close();

        logger.passThrough(chalk.green("Chronicle initialized!"));
        logger.passThrough(chalk.dim(`  Database: ${ChronicleStore.getDbPath()}`));
        logger.passThrough(chalk.dim(`  Project: ${process.cwd()}`));
        logger.passThrough("");
        logger.passThrough("Next steps:");
        logger.passThrough(`  ${chalk.cyan("llm-collab chronicle push")} ${chalk.dim('"<knowledge>"')}  Add knowledge`);
        logger.passThrough(`  ${chalk.cyan("llm-collab chronicle search")} ${chalk.dim('"<query>"')}   Search`);

        audit.commandEnd("chronicle init", "success", Date.now() - startTime);
      }),
  )
  .addCommand(
    new Command("push")
      .description("Add a knowledge item")
      .argument("<content>", "Knowledge content")
      .option("--type <type>", "Item type: knowledge, decision, context, note", "knowledge")
      .option("--json", "Output as JSON")
      .action(async (content, options) => {
        const startTime = Date.now();
        audit.commandStart("chronicle push");

        const store = openStore();
        if (!store) { audit.commandEnd("chronicle push", "failure", Date.now() - startTime); return; }

        const item = store.addItem(content, options.type);
        store.close();

        audit.commandEnd("chronicle push", "success", Date.now() - startTime);

        if (options.json) {
          logger.passThrough(JSON.stringify({ id: item.id, type: item.type, created_at: item.created_at }, null, 2));
          return;
        }

        logger.passThrough(chalk.green(`Added ${item.type} item: ${item.id}`));
      }),
  )
  .addCommand(
    new Command("search")
      .description("Search the knowledge store")
      .argument("<query>", "Search query")
      .option("--limit <n>", "Max results", "10")
      .option("--json", "Output as JSON")
      .action(async (query, options) => {
        const startTime = Date.now();
        audit.commandStart("chronicle search");

        const store = openStore();
        if (!store) { audit.commandEnd("chronicle search", "failure", Date.now() - startTime); return; }

        const items = store.searchByKeyword(query, parseInt(options.limit));
        store.close();

        audit.commandEnd("chronicle search", "success", Date.now() - startTime);

        if (options.json) {
          logger.passThrough(JSON.stringify(items.map((i) => ({ id: i.id, content: i.content, type: i.type, created_at: i.created_at })), null, 2));
          return;
        }

        if (items.length === 0) {
          logger.passThrough(chalk.dim("No results found."));
          return;
        }

        logger.passThrough(chalk.bold(`Search results for "${query}" (${items.length}):\n`));
        for (const item of items) {
          logger.passThrough(`  ${chalk.cyan(item.id.slice(0, 8))} ${chalk.dim(`[${item.type}]`)} ${truncate(item.content, 80)}`);
          logger.passThrough(chalk.dim(`    ${formatDate(item.created_at)}`));
        }
      }),
  )
  .addCommand(
    new Command("ask")
      .description("Ask a question about project knowledge (RAG-powered)")
      .argument("<question>", "Question to ask")
      .option("--json", "Output as JSON")
      .action(async (question, options) => {
        const startTime = Date.now();
        audit.commandStart("chronicle ask");

        const store = openStore();
        if (!store) { audit.commandEnd("chronicle ask", "failure", Date.now() - startTime); return; }

        const config = ConfigManager.load().get();
        const ai = new AIService(config);
        let embeddings: EmbeddingService | undefined;
        try {
          embeddings = new EmbeddingService(config);
        } catch { /* optional */ }

        const engine = new QueryEngine(store, ai, embeddings);

        try {
          const result = await engine.ask(question);
          store.close();

          audit.commandEnd("chronicle ask", "success", Date.now() - startTime);

          if (options.json) {
            logger.passThrough(JSON.stringify(result, null, 2));
            return;
          }

          logger.passThrough(chalk.bold("Answer:\n"));
          logger.passThrough(result.answer);

          if (result.citations.length > 0) {
            logger.passThrough(chalk.dim(`\nSources (${result.citations.length}):`));
            for (const c of result.citations) {
              logger.passThrough(chalk.dim(`  [${c.id.slice(0, 8)}] (${c.type}) ${truncate(c.content, 60)}`));
            }
          }

          if (result.model !== "none" && result.model !== "fallback") {
            logger.passThrough(chalk.dim(`\nModel: ${result.model}`));
          }
        } catch (err) {
          store.close();
          audit.commandEnd("chronicle ask", "failure", Date.now() - startTime);
          logger.error(err instanceof Error ? err.message : String(err));
        }
      }),
  )
  .addCommand(
    new Command("graph")
      .description("View the knowledge graph")
      .option("--entity <name>", "Entity name to look up")
      .option("--type <type>", "Entity type filter")
      .option("--depth <n>", "Traversal depth", "2")
      .option("--json", "Output as JSON")
      .action(async (options) => {
        const startTime = Date.now();
        audit.commandStart("chronicle graph");

        const store = openStore();
        if (!store) { audit.commandEnd("chronicle graph", "failure", Date.now() - startTime); return; }

        const graph = new KnowledgeGraph(store);

        if (options.entity) {
          const node = graph.findNode(options.entity, options.type);
          if (!node) {
            store.close();
            logger.passThrough(chalk.dim(`Entity "${options.entity}" not found.`));
            audit.commandEnd("chronicle graph", "success", Date.now() - startTime);
            return;
          }

          const result = graph.traverse(node.entity.id, parseInt(options.depth));
          store.close();

          audit.commandEnd("chronicle graph", "success", Date.now() - startTime);

          if (options.json) {
            logger.passThrough(JSON.stringify(result, null, 2));
            return;
          }

          logger.passThrough(graph.formatGraphText(result));
        } else {
          const entities = store.listEntities({ type: options.type, limit: 50 });
          store.close();

          audit.commandEnd("chronicle graph", "success", Date.now() - startTime);

          if (options.json) {
            logger.passThrough(JSON.stringify(entities, null, 2));
            return;
          }

          if (entities.length === 0) {
            logger.passThrough(chalk.dim("No entities in the knowledge graph."));
            return;
          }

          logger.passThrough(chalk.bold(`Knowledge Graph Entities (${entities.length}):\n`));
          const byType = new Map<string, typeof entities>();
          for (const e of entities) {
            const list = byType.get(e.type) ?? [];
            list.push(e);
            byType.set(e.type, list);
          }
          for (const [type, list] of byType) {
            logger.passThrough(`  ${chalk.cyan(type)} (${list.length}):`);
            for (const e of list) {
              logger.passThrough(`    ${e.name}`);
            }
          }
        }
      }),
  )
  .addCommand(
    new Command("timeline")
      .description("View the decision timeline")
      .option("--since <date>", "Start date (ISO 8601)")
      .option("--limit <n>", "Max results", "20")
      .option("--decisions", "Show only decisions")
      .option("--json", "Output as JSON")
      .action(async (options) => {
        const startTime = Date.now();
        audit.commandStart("chronicle timeline");

        const store = openStore();
        if (!store) { audit.commandEnd("chronicle timeline", "failure", Date.now() - startTime); return; }

        const timeline = new TimelineManager(store);

        audit.commandEnd("chronicle timeline", "success", Date.now() - startTime);

        if (options.decisions) {
          const decisions = timeline.getDecisions({ since: options.since, limit: parseInt(options.limit) });
          store.close();

          if (options.json) {
            logger.passThrough(JSON.stringify(decisions, null, 2));
            return;
          }

          logger.passThrough(chalk.bold("Decision Timeline:\n"));
          logger.passThrough(timeline.formatDecisions(decisions));
        } else {
          const entries = timeline.getRecentActivity({ since: options.since, limit: parseInt(options.limit) });
          store.close();

          if (options.json) {
            logger.passThrough(JSON.stringify(entries, null, 2));
            return;
          }

          logger.passThrough(chalk.bold("Timeline:\n"));
          logger.passThrough(timeline.formatTimeline(entries));
        }
      }),
  )
  .addCommand(
    new Command("stats")
      .description("Show knowledge store statistics")
      .option("--json", "Output as JSON")
      .action(async (options) => {
        const startTime = Date.now();
        audit.commandStart("chronicle stats");

        const store = openStore();
        if (!store) { audit.commandEnd("chronicle stats", "failure", Date.now() - startTime); return; }

        const stats = store.stats();
        const dbPath = store.getPath();
        store.close();

        audit.commandEnd("chronicle stats", "success", Date.now() - startTime);

        if (options.json) {
          logger.passThrough(JSON.stringify({ ...stats, path: dbPath }, null, 2));
          return;
        }

        logger.passThrough(chalk.bold("Chronicle Statistics:\n"));
        logger.passThrough(`  Items:     ${stats.items}`);
        logger.passThrough(`  Entities:  ${stats.entities}`);
        logger.passThrough(`  Relations: ${stats.relations}`);
        logger.passThrough(`  Timeline:  ${stats.timeline} entries`);
        logger.passThrough(chalk.dim(`\n  Database: ${dbPath}`));
      }),
  );

function openStore(): ChronicleStore | null {
  try {
    return ChronicleStore.open();
  } catch {
    logger.error("Chronicle not initialized. Run 'llm-collab chronicle init' first.");
    return null;
  }
}

function truncate(text: string, maxLen: number): string {
  const oneLine = text.replace(/\n/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen - 3) + "...";
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}
