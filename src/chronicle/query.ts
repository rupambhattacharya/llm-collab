import type { ChronicleStore, ChronicleItem } from "./store.js";
import type { EmbeddingService } from "./embeddings.js";
import type { AIService } from "../services/ai-service.js";
import { logger } from "../utils/logger.js";

export interface QueryResult {
  answer: string;
  citations: Array<{
    id: string;
    content: string;
    type: string;
    relevance: "keyword" | "semantic";
    score?: number;
  }>;
  model: string;
}

export class QueryEngine {
  private store: ChronicleStore;
  private embeddings: EmbeddingService | null;
  private ai: AIService;

  constructor(store: ChronicleStore, ai: AIService, embeddings?: EmbeddingService) {
    this.store = store;
    this.ai = ai;
    this.embeddings = embeddings ?? null;
  }

  async search(query: string, limit = 10): Promise<Array<{ item: ChronicleItem; relevance: "keyword" | "semantic"; score?: number }>> {
    const keywordResults = this.store.searchByKeyword(query, limit);
    const results: Array<{ item: ChronicleItem; relevance: "keyword" | "semantic"; score?: number }> = keywordResults.map((item) => ({
      item,
      relevance: "keyword" as const,
    }));

    if (this.embeddings) {
      try {
        const queryEmbedding = await this.embeddings.generateEmbedding(query);
        const semanticResults = this.store.searchByEmbedding(queryEmbedding, limit);

        const existingIds = new Set(results.map((r) => r.item.id));
        for (const sr of semanticResults) {
          if (!existingIds.has(sr.item.id)) {
            results.push({ item: sr.item, relevance: "semantic", score: sr.score });
          }
        }
      } catch (err) {
        logger.debug(`Semantic search failed, using keyword results only: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return results.slice(0, limit);
  }

  async ask(question: string): Promise<QueryResult> {
    const searchResults = await this.search(question, 10);

    if (searchResults.length === 0) {
      return {
        answer: "No relevant knowledge found in the Chronicle. Try adding knowledge with 'llm-collab chronicle push'.",
        citations: [],
        model: "none",
      };
    }

    const context = searchResults
      .map((r, i) => `[${i + 1}] (${r.item.type}) ${r.item.content}`)
      .join("\n\n");

    const system = `You are a knowledge assistant answering questions about a software project based on stored knowledge items. Answer concisely based ONLY on the provided context. Cite sources using [n] notation. If the context doesn't contain enough information, say so.`;

    const prompt = `Context:\n${context}\n\nQuestion: ${question}`;

    try {
      const result = await this.ai.generate(prompt, { system });

      return {
        answer: result.text,
        citations: searchResults.map((r) => ({
          id: r.item.id,
          content: truncate(r.item.content, 200),
          type: r.item.type,
          relevance: r.relevance,
          score: r.score,
        })),
        model: result.model,
      };
    } catch (err) {
      logger.debug(`LLM query failed: ${err instanceof Error ? err.message : String(err)}`);
      return {
        answer: `Found ${searchResults.length} relevant items but could not generate an answer (LLM unavailable). Results:\n\n${searchResults.map((r, i) => `${i + 1}. [${r.item.type}] ${truncate(r.item.content, 100)}`).join("\n")}`,
        citations: searchResults.map((r) => ({
          id: r.item.id,
          content: truncate(r.item.content, 200),
          type: r.item.type,
          relevance: r.relevance,
          score: r.score,
        })),
        model: "fallback",
      };
    }
  }
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}
