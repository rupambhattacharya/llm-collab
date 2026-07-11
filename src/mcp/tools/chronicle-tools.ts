import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChronicleStore } from "../../chronicle/store.js";
import { KnowledgeGraph } from "../../chronicle/graph.js";
import { TimelineManager } from "../../chronicle/timeline.js";
import { QueryEngine } from "../../chronicle/query.js";
import { EmbeddingService } from "../../chronicle/embeddings.js";
import { AIService } from "../../services/ai-service.js";
import type { Config } from "../../config/schemas.js";

export function registerChronicleTools(server: McpServer, config: Config): void {
  server.tool(
    "chronicle_search",
    "Search the project knowledge store by keyword",
    {
      query: z.string().describe("Search query"),
      limit: z.number().optional().describe("Max results (default 10)"),
    },
    async ({ query, limit }) => {
      try {
        const store = ChronicleStore.open();
        const items = store.searchByKeyword(query, limit ?? 10);
        store.close();
        return { content: [{ type: "text" as const, text: JSON.stringify(items.map((i) => ({ id: i.id, content: i.content, type: i.type, metadata: i.metadata, created_at: i.created_at })), null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "chronicle_read",
    "Read a specific knowledge item by ID",
    {
      id: z.string().describe("Item ID"),
    },
    async ({ id }) => {
      try {
        const store = ChronicleStore.open();
        const item = store.getItem(id);
        store.close();
        if (!item) {
          return { content: [{ type: "text" as const, text: "Item not found" }], isError: true };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify({ id: item.id, content: item.content, type: item.type, metadata: item.metadata, created_at: item.created_at, updated_at: item.updated_at }, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "chronicle_write",
    "Add a knowledge item to the project store",
    {
      content: z.string().describe("Knowledge content"),
      type: z.enum(["knowledge", "decision", "context", "note"]).optional().describe("Item type (default: knowledge)"),
      metadata: z.record(z.unknown()).optional().describe("Additional metadata"),
    },
    async ({ content, type, metadata }) => {
      try {
        const store = ChronicleStore.open();
        const item = store.addItem(content, type ?? "knowledge", metadata ?? {});
        store.close();
        return { content: [{ type: "text" as const, text: JSON.stringify({ id: item.id, type: item.type, created_at: item.created_at }, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "chronicle_ask",
    "Ask a natural language question about project knowledge (RAG-powered)",
    {
      question: z.string().describe("Question to ask"),
    },
    async ({ question }) => {
      try {
        const store = ChronicleStore.open();
        const ai = new AIService(config);
        let embeddings: EmbeddingService | undefined;
        try {
          embeddings = new EmbeddingService(config);
        } catch { /* embeddings optional */ }
        const engine = new QueryEngine(store, ai, embeddings);
        const result = await engine.ask(question);
        store.close();
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "chronicle_graph",
    "Query the knowledge graph for entity relationships",
    {
      entity_name: z.string().describe("Entity name to look up"),
      entity_type: z.string().optional().describe("Entity type filter"),
      depth: z.number().optional().describe("Traversal depth (default 2)"),
    },
    async ({ entity_name, entity_type, depth }) => {
      try {
        const store = ChronicleStore.open();
        const graph = new KnowledgeGraph(store);
        const node = graph.findNode(entity_name, entity_type);
        if (!node) {
          store.close();
          return { content: [{ type: "text" as const, text: `Entity "${entity_name}" not found in knowledge graph` }] };
        }
        const result = graph.traverse(node.entity.id, depth ?? 2);
        const text = graph.formatGraphText(result);
        store.close();
        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "chronicle_timeline",
    "View the timeline of knowledge changes and decisions",
    {
      item_id: z.string().optional().describe("Filter by item ID"),
      since: z.string().optional().describe("Start date (ISO 8601)"),
      limit: z.number().optional().describe("Max results (default 20)"),
    },
    async ({ item_id, since, limit }) => {
      try {
        const store = ChronicleStore.open();
        const timeline = new TimelineManager(store);
        const entries = timeline.getRecentActivity({ since, limit: limit ?? 20 });

        let result: string;
        if (item_id) {
          const history = timeline.getItemHistory(item_id);
          result = timeline.formatTimeline(history);
        } else {
          result = timeline.formatTimeline(entries);
        }

        store.close();
        return { content: [{ type: "text" as const, text: result }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "chronicle_entity",
    "Add or find an entity in the knowledge graph",
    {
      action: z.enum(["add", "find", "list"]).describe("Action: add, find, or list entities"),
      name: z.string().optional().describe("Entity name (required for add/find)"),
      type: z.enum(["file", "function", "decision", "person", "issue", "concept"]).optional().describe("Entity type"),
      properties: z.record(z.unknown()).optional().describe("Entity properties (for add)"),
    },
    async ({ action, name, type, properties }) => {
      try {
        const store = ChronicleStore.open();

        if (action === "list") {
          const entities = store.listEntities({ type, limit: 50 });
          store.close();
          return { content: [{ type: "text" as const, text: JSON.stringify(entities, null, 2) }] };
        }

        if (!name) {
          store.close();
          return { content: [{ type: "text" as const, text: "Entity name is required for add/find" }], isError: true };
        }

        if (action === "add") {
          if (!type) {
            store.close();
            return { content: [{ type: "text" as const, text: "Entity type is required for add" }], isError: true };
          }
          const entity = store.addEntity(name, type, properties ?? {});
          store.close();
          return { content: [{ type: "text" as const, text: JSON.stringify(entity, null, 2) }] };
        }

        const entity = store.findEntity(name, type);
        store.close();
        if (!entity) {
          return { content: [{ type: "text" as const, text: `Entity "${name}" not found` }] };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(entity, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "chronicle_stats",
    "Get statistics about the project knowledge store",
    {},
    async () => {
      try {
        const store = ChronicleStore.open();
        const stats = store.stats();
        store.close();
        return { content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );
}
