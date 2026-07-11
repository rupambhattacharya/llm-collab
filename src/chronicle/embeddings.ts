import { embed, embedMany } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { Config } from "../config/schemas.js";
import { logger } from "../utils/logger.js";

export class EmbeddingService {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async generateEmbedding(text: string): Promise<Float64Array> {
    const { provider, model } = this.resolveEmbeddingModel();

    try {
      const result = await embed({
        model: this.createEmbeddingModel(provider, model),
        value: text,
      });

      return new Float64Array(result.embedding);
    } catch (err) {
      logger.debug(`Embedding generation failed: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  async generateEmbeddings(texts: string[]): Promise<Float64Array[]> {
    if (texts.length === 0) return [];

    const { provider, model } = this.resolveEmbeddingModel();

    try {
      const result = await embedMany({
        model: this.createEmbeddingModel(provider, model),
        values: texts,
      });

      return result.embeddings.map((e) => new Float64Array(e));
    } catch (err) {
      logger.debug(`Batch embedding generation failed: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  private resolveEmbeddingModel(): { provider: string; model: string } {
    const embeddingProvider = this.config.chronicle.embedding_provider;
    const embeddingModel = this.config.chronicle.embedding_model;

    return { provider: embeddingProvider, model: embeddingModel };
  }

  private createEmbeddingModel(provider: string, model: string) {
    switch (provider) {
      case "openai": {
        const apiKey = this.config.ai.providers.openai?.api_key;
        if (!apiKey) {
          throw new Error("OpenAI API key not configured for embeddings");
        }
        const openai = createOpenAI({ apiKey });
        return openai.embedding(model);
      }

      case "ollama": {
        const baseURL = this.config.ai.providers.ollama?.base_url ?? "http://localhost:11434/v1";
        const ollama = createOpenAI({ baseURL, apiKey: "ollama" });
        return ollama.embedding(model);
      }

      case "anthropic":
      default: {
        const apiKey = this.config.ai.providers.openai?.api_key ?? this.config.ai.providers.anthropic?.api_key;
        if (!apiKey) {
          throw new Error("No API key configured for embeddings. Configure OpenAI or Ollama provider.");
        }
        const openai = createOpenAI({ apiKey });
        return openai.embedding(model.startsWith("voyage") ? "text-embedding-3-small" : model);
      }
    }
  }
}
