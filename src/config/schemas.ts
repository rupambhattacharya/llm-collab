import { z } from "zod";

const providerConfigSchema = z.object({
  api_key: z.string().optional(),
  base_url: z.string().url().optional(),
});

const aiConfigSchema = z.object({
  default_provider: z
    .enum(["anthropic", "openai", "ollama", "openrouter"])
    .default("anthropic"),
  providers: z
    .object({
      anthropic: providerConfigSchema.optional(),
      openai: providerConfigSchema.optional(),
      ollama: providerConfigSchema.optional(),
      openrouter: providerConfigSchema.optional(),
    })
    .default({}),
  default_model: z.string().default("claude-sonnet-5"),
  complexity_routing: z
    .object({
      low: z.string().default("claude-haiku-4-5"),
      medium: z.string().default("claude-sonnet-5"),
      high: z.string().default("claude-opus-4-8"),
    })
    .default({}),
});

const githubIntegrationSchema = z.object({
  token: z.string(),
  org: z.string().optional(),
});

const linearIntegrationSchema = z.object({
  api_key: z.string(),
});

const gitlabIntegrationSchema = z.object({
  url: z.string().url(),
  token: z.string(),
});

const jiraIntegrationSchema = z.object({
  url: z.string().url(),
  email: z.string(),
  token: z.string(),
});

const integrationsConfigSchema = z.object({
  github: githubIntegrationSchema.optional(),
  linear: linearIntegrationSchema.optional(),
  gitlab: gitlabIntegrationSchema.optional(),
  jira: jiraIntegrationSchema.optional(),
});

const chronicleConfigSchema = z.object({
  embedding_provider: z
    .enum(["anthropic", "openai", "ollama"])
    .default("anthropic"),
  embedding_model: z.string().default("voyage-3"),
  auto_capture: z.boolean().default(true),
});

const relayConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(4000),
  require_auth: z.boolean().default(false),
});

const auditHookSchema = z.object({
  enabled: z.boolean().default(true),
  retention_days: z.number().int().min(1).default(30),
});

const costsHookSchema = z.object({
  enabled: z.boolean().default(true),
  budget_alert_usd: z.number().min(0).default(50),
});

const secretsHookSchema = z.object({
  enabled: z.boolean().default(true),
  action: z.enum(["warn", "block"]).default("warn"),
});

const webhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).default([]),
});

const hooksConfigSchema = z.object({
  audit: auditHookSchema.default({}),
  costs: costsHookSchema.default({}),
  secrets: secretsHookSchema.default({}),
  webhooks: z.array(webhookSchema).default([]),
});

const prGatesSchema = z.object({
  max_changed_files: z.number().int().min(1).default(20),
  deletion_ratio_threshold: z.number().min(0).max(1).default(0.5),
});

const nightWatchConfigSchema = z.object({
  safety_profile: z
    .enum(["none", "balanced", "strict", "paranoid"])
    .default("balanced"),
  max_concurrent_sessions: z.number().int().min(1).default(3),
  pr_gates: prGatesSchema.default({}),
});

export const configSchema = z.object({
  ai: aiConfigSchema.default({}),
  integrations: integrationsConfigSchema.default({}),
  chronicle: chronicleConfigSchema.default({}),
  relay: relayConfigSchema.default({}),
  hooks: hooksConfigSchema.default({}),
  night_watch: nightWatchConfigSchema.default({}),
});

export type Config = z.infer<typeof configSchema>;
export type AIConfig = z.infer<typeof aiConfigSchema>;
export type IntegrationsConfig = z.infer<typeof integrationsConfigSchema>;
