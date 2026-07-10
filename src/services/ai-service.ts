import { generateText, streamText, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { Config } from "../config/schemas.js";
import { AuthError } from "../utils/errors.js";
import { costTracker } from "./cost-tracker.js";
import { audit } from "../hooks/audit-logger.js";

export type ProviderName = "anthropic" | "openai" | "ollama" | "openrouter";

export interface StreamCallbacks {
  onText?: (text: string) => void;
  onFinish?: (result: { text: string; inputTokens: number; outputTokens: number }) => void;
}

export interface GenerateResult {
  text: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export class AIService {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  getModel(modelId?: string, providerName?: ProviderName): LanguageModel {
    const provider = providerName ?? this.config.ai.default_provider;
    const model = modelId ?? this.config.ai.default_model;
    return this.createModel(provider, model);
  }

  getModelForComplexity(level: "low" | "medium" | "high"): LanguageModel {
    const modelId = this.config.ai.complexity_routing[level];
    return this.getModel(modelId);
  }

  private createModel(provider: ProviderName, model: string): LanguageModel {
    switch (provider) {
      case "anthropic": {
        const apiKey = this.config.ai.providers.anthropic?.api_key;
        if (!apiKey) throw new AuthError("Anthropic API key not configured", "Run 'llm-collab setup' or set ANTHROPIC_API_KEY");
        const anthropic = createAnthropic({
          apiKey,
          baseURL: this.config.ai.providers.anthropic?.base_url,
        });
        return anthropic(model);
      }

      case "openai": {
        const apiKey = this.config.ai.providers.openai?.api_key;
        if (!apiKey) throw new AuthError("OpenAI API key not configured", "Run 'llm-collab setup' or set OPENAI_API_KEY");
        const openai = createOpenAI({
          apiKey,
          baseURL: this.config.ai.providers.openai?.base_url,
        });
        return openai(model);
      }

      case "ollama": {
        const baseURL = this.config.ai.providers.ollama?.base_url ?? "http://localhost:11434/v1";
        const ollama = createOpenAI({ baseURL, apiKey: "ollama" });
        return ollama(model);
      }

      case "openrouter": {
        const apiKey = this.config.ai.providers.openrouter?.api_key;
        if (!apiKey) throw new AuthError("OpenRouter API key not configured", "Run 'llm-collab setup' or set your OpenRouter API key");
        const openrouter = createOpenAI({
          apiKey,
          baseURL: this.config.ai.providers.openrouter?.base_url ?? "https://openrouter.ai/api/v1",
        });
        return openrouter(model);
      }

      default:
        throw new AuthError(`Unknown provider: ${provider}`, "Supported providers: anthropic, openai, ollama, openrouter");
    }
  }

  resolveProvider(model: string): ProviderName {
    if (model.startsWith("claude")) return "anthropic";
    if (model.startsWith("gpt") || model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4")) return "openai";
    return this.config.ai.default_provider;
  }

  async generate(prompt: string, options?: { model?: string; system?: string }): Promise<GenerateResult> {
    const modelId = options?.model ?? this.config.ai.default_model;
    const provider = this.resolveProvider(modelId);
    const model = this.getModel(modelId, provider);

    audit.toolCall("ai.generate", { model: modelId, provider, promptLength: prompt.length });
    const startTime = Date.now();

    const result = await generateText({
      model,
      prompt,
      system: options?.system,
    });

    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    const record = costTracker.record(modelId, provider, inputTokens, outputTokens, "generate");
    audit.toolCall("ai.generate", { model: modelId, provider }, "success", Date.now() - startTime);

    return {
      text: result.text,
      model: modelId,
      provider,
      inputTokens,
      outputTokens,
      costUsd: record.costUsd,
    };
  }

  async stream(prompt: string, callbacks: StreamCallbacks, options?: { model?: string; system?: string }): Promise<GenerateResult> {
    const modelId = options?.model ?? this.config.ai.default_model;
    const provider = this.resolveProvider(modelId);
    const model = this.getModel(modelId, provider);

    audit.toolCall("ai.stream", { model: modelId, provider, promptLength: prompt.length });
    const startTime = Date.now();

    const result = streamText({
      model,
      prompt,
      system: options?.system,
    });

    let fullText = "";
    for await (const textPart of result.textStream) {
      fullText += textPart;
      callbacks.onText?.(textPart);
    }

    const usage = await result.usage;
    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    const record = costTracker.record(modelId, provider, inputTokens, outputTokens, "stream");
    audit.toolCall("ai.stream", { model: modelId, provider }, "success", Date.now() - startTime);

    const finishResult = { text: fullText, inputTokens, outputTokens };
    callbacks.onFinish?.(finishResult);

    return {
      text: fullText,
      model: modelId,
      provider,
      inputTokens,
      outputTokens,
      costUsd: record.costUsd,
    };
  }
}
