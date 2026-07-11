# llm-collab

Open-source CLI for AI-powered multi-agent collaboration, MCP integration, and autonomous workflows.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 24+ |
| Language | TypeScript 5.x (strict mode) |
| CLI framework | Commander.js |
| Interactive prompts | Inquirer.js |
| Validation | Zod |
| Build | tsup (library/CLI bundle) |
| Binary | pkg (standalone executable) |
| Testing | Vitest |
| Database | better-sqlite3 (Chronicle) |
| LLM | Vercel AI SDK (@ai-sdk/anthropic, @ai-sdk/openai) |
| MCP | @modelcontextprotocol/sdk |
| Package manager | pnpm |

## Quick Reference

```bash
# Dev
pnpm dev              # Run in dev mode (tsx watch)
pnpm test             # Run tests (vitest)
pnpm lint             # Lint (eslint)
pnpm format           # Format (prettier)
pnpm typecheck        # Type check (tsc --noEmit)
pnpm build            # Build with tsup
pnpm pkg              # Build standalone binary

# Launch
llm-collab agent claude          # Launch Claude Code with MCP + agents
llm-collab agent claude -p "fix the auth bug"  # With prompt
llm-collab mcp stdio             # Start MCP server (stdio)
llm-collab mcp http --port 3456  # Start MCP server (HTTP+SSE)
llm-collab relay 4000            # Start LLM relay proxy on port 4000
llm-collab chat                  # Interactive AI chat

# Integrations
llm-collab setup                 # Interactive config wizard
llm-collab config set github.token <token>
llm-collab github issues search "bug"
llm-collab linear issues list

# Knowledge
llm-collab chronicle init        # Initialize project knowledge store
llm-collab chronicle search "auth middleware decisions"
llm-collab chronicle ask "why did we choose JWT over sessions?"

# Skills
llm-collab skills list
llm-collab skills install <name>
```

## Architecture

### Layer Stack

```
Entry Point (src/index.ts)
    | Commander.js CLI router — registers commands, global error handling
    v
Commands Layer (src/commands/)
    | Thin orchestration: parse args -> call service -> format output
    v
Services Layer (src/services/)
    | Thick business logic: auth, API wrapping, caching, typed errors
    v
+---------------------+----------------------+
| Configuration       | MCP Server           |
| (src/config/)       | (src/mcp/)           |
| ConfigManager       | Tool Registry (50+)  |
| Zod schemas         | stdio/HTTP+SSE       |
| Agent definitions   | Capability gating    |
+---------------------+----------------------+
    |
    v
+---------------------+----------------------+
| Data & Assets       | Chronicle (Knowledge)|
| (src/data/)         | (src/chronicle/)     |
| Skills, costs,      | SQLite + embeddings  |
| templates           | Knowledge graph      |
+---------------------+----------------------+
```

### Key Principles

| Principle | Implementation |
|-----------|---------------|
| Commands are thin | Parse args -> call service -> format output. No business logic. |
| Services are thick | All business logic, auth, caching, retries live in services. |
| MCP tools never throw | Return `{ success, data }` or `{ success: false, error }`. |
| Config is centralized | Single ConfigManager singleton, validated with Zod. |
| Progressive disclosure | Only show tools/features for configured integrations. |
| Skills over code | Extend agent capabilities via markdown files, not code changes. |
| Bundle-friendly | tsup bundles to single CJS/ESM entry. No dynamic requires. |
| Every action observable | Hooks fire on tool calls, inference, sessions. Full audit trail. |

## File Structure

```
llm-collab/
├── src/
│   ├── index.ts                     # Entry point — Commander.js CLI router
│   ├── commands/                    # CLI command handlers (thin)
│   │   ├── agent.ts                 # Launch AI agents (claude, codex, etc.)
│   │   ├── chat.ts                  # Interactive AI chat REPL
│   │   ├── chronicle.ts             # Knowledge store commands
│   │   ├── config-cmd.ts            # Config view/edit
│   │   ├── github.ts                # GitHub operations
│   │   ├── linear.ts                # Linear operations
│   │   ├── mcp.ts                   # MCP server start
│   │   ├── relay.ts                 # LLM relay proxy
│   │   ├── setup.ts                 # Interactive config wizard
│   │   └── skills.ts                # Skill management
│   │
│   ├── services/                    # Business logic (thick)
│   │   ├── ai-service.ts            # LLM provider abstraction
│   │   ├── chronicle-service.ts     # Knowledge persistence + graph
│   │   ├── cost-tracker.ts          # Token usage & cost tracking
│   │   ├── github-service.ts        # GitHub REST/GraphQL API
│   │   ├── linear-service.ts        # Linear API
│   │   ├── mcp-service.ts           # MCP tool registry & execution
│   │   ├── relay-server.ts          # HTTP proxy with key injection
│   │   └── thread-manager.ts        # Thread CRUD, @mention routing
│   │
│   ├── config/                      # Configuration
│   │   ├── config-manager.ts        # Singleton: CLI > ENV > file > defaults
│   │   ├── schemas.ts               # Zod schemas for all config
│   │   ├── sub-agents.ts            # Domain agent definitions
│   │   └── setup/                   # Interactive wizard steps
│   │
│   ├── mcp/                         # MCP server internals
│   │   ├── context.ts               # Tool execution context
│   │   ├── prompts.ts               # AI prompt templates
│   │   ├── transports.ts            # stdio, HTTP+SSE, WebSocket
│   │   └── tools/                   # Tool handlers by domain
│   │       ├── chronicle-tools.ts   # Knowledge graph tools
│   │       ├── file-tools.ts        # File read/write/list
│   │       ├── github-tools.ts      # GitHub operations
│   │       ├── linear-tools.ts      # Linear operations
│   │       └── system-tools.ts      # Shell, env, system info
│   │
│   ├── chronicle/                   # Knowledge system
│   │   ├── store.ts                 # SQLite persistence layer (better-sqlite3)
│   │   ├── embeddings.ts            # Vector embedding generation
│   │   ├── graph.ts                 # Knowledge graph (entities + relations)
│   │   ├── timeline.ts              # Temporal versioning
│   │   └── query.ts                 # NL query engine
│   │
│   ├── hooks/                       # Auditing & lifecycle hooks
│   │   ├── hook-manager.ts          # Hook registration & dispatch
│   │   ├── audit-hook.ts            # Action logging
│   │   ├── cost-hook.ts             # Token/cost tracking per action
│   │   ├── secret-scanner.ts        # Detect credentials in output
│   │   └── webhook.ts               # External notifications (Slack, etc.)
│   │
│   ├── agent/                       # Agent-to-agent communication
│   │   ├── a2a/                     # A2A protocol (JSON-RPC 2.0)
│   │   │   ├── server.ts            # WebSocket server
│   │   │   ├── client.ts            # WebSocket client
│   │   │   └── protocol.ts          # Message types & handlers
│   │   └── bridges/                 # Agent tool adapters
│   │       ├── claude-bridge.ts     # Claude Code subprocess
│   │       ├── codex-bridge.ts      # Codex CLI adapter
│   │       └── generic-bridge.ts    # Generic agent adapter
│   │
│   ├── data/                        # Embedded assets
│   │   ├── bundled-skills.ts        # Skill markdown as TS strings
│   │   ├── llm-costs.ts             # Token pricing per model
│   │   └── templates/               # Agent & prompt templates
│   │
│   ├── utils/                       # Shared utilities
│   │   ├── logger.ts                # Structured logging
│   │   ├── errors.ts                # Typed error classes
│   │   └── format.ts                # Output formatters (chalk)
│   │
│   └── types/                       # Shared TypeScript types
│       └── index.ts
│
├── tests/                           # Test files mirror src/ structure
│   ├── services/
│   ├── chronicle/
│   └── mcp/
│
├── .claude/
│   ├── agents/                      # Claude Code agent definitions
│   │   ├── orchestrator.md          # Opus 4.6 — delegates to specialists
│   │   ├── planner.md               # Opus 4.6 — creates implementation plans
│   │   ├── coder.md                 # Sonnet 5 — writes code
│   │   └── designer.md              # Sonnet 5 — UI/UX work
│   └── settings.json                # Claude Code project settings
│
├── docs/
│   ├── architecture.html            # Visual architecture diagram
│   ├── CONTRIBUTING.md              # Contribution guide
│   └── guides/                      # Feature-specific guides
│
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript config (strict)
├── tsup.config.ts                   # Build config
├── vitest.config.ts                 # Test config
├── .eslintrc.cjs                    # Lint config
├── .prettierrc                      # Format config
├── CLAUDE.md                        # This file
├── README.md                        # Open-source docs
└── LICENSE                          # MIT
```

## Commander.js Pattern

All commands follow this pattern:

```typescript
// src/commands/github.ts
import { Command } from "commander";
import { ConfigManager } from "../config/config-manager.js";
import { GitHubService } from "../services/github-service.js";

export const githubCommand = new Command("github")
  .description("GitHub operations")
  .addCommand(
    new Command("issues")
      .command("search <query>")
      .option("--repo <repo>", "Target repository")
      .option("--state <state>", "Issue state", "open")
      .action(async (query, options) => {
        const config = ConfigManager.load();
        const github = new GitHubService(config.integrations.github);
        const results = await github.searchIssues(query, options);
        // format and output
      })
  );
```

The entry point wires commands together:

```typescript
// src/index.ts
#!/usr/bin/env node
import { Command } from "commander";
import { githubCommand } from "./commands/github.js";
import { agentCommand } from "./commands/agent.js";
// ...

const program = new Command()
  .name("llm-collab")
  .version("0.1.0")
  .description("AI-powered multi-agent collaboration CLI")
  .option("--debug", "Enable debug logging")
  .option("--config <path>", "Config file path");

program.addCommand(agentCommand);
program.addCommand(githubCommand);
// ... register all commands

program.parseAsync(process.argv).catch((err) => {
  // global error handler with typed errors
  process.exit(1);
});
```

## Implementation Phases

### Phase 1: Foundation (MVP)

**Goal:** Bootable CLI with config system and one working command.

1. **Project bootstrap**
   - `package.json` with scripts (dev, test, build, lint, format, typecheck, pkg)
   - `tsconfig.json` with strict mode, ESM output, path aliases
   - `tsup.config.ts` for building CLI bundle
   - `src/index.ts` with Commander.js router and global error handler
   - Debug logging via `LLM_COLLAB_DEBUG` env var

2. **Configuration system**
   - `ConfigManager` singleton: CLI args > `LLM_COLLAB_*` env vars > `~/.llm-collab/config.json` > defaults
   - Zod schemas for all config sections
   - `llm-collab config get/set` commands

3. **Setup wizard**
   - `llm-collab setup` — Inquirer.js prompts for provider keys, integrations
   - Progressive: only ask for what's relevant
   - Validate connections during setup

4. **Logger**
   - Levels: debug, info, warn, error
   - `passThrough` for user-facing output
   - Structured JSON mode for machine consumption
   - Uses chalk for colored terminal output; respects `NO_COLOR`

### Phase 2: LLM Integration

**Goal:** Multi-provider AI access with cost tracking.

5. **AI service abstraction**
   - Provider interface: Anthropic, OpenAI, Ollama, OpenRouter, any OpenAI-compatible
   - Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`) for unified streaming
   - Model selection with fallback chains

6. **Relay server**
   - `llm-collab relay <port>` — Express.js HTTP proxy
   - Accepts OpenAI-compatible requests, injects API key from config
   - No client-side key management needed
   - Optional client auth (`--require-auth`) with named keys in `~/.llm-collab/keys/keys.json`

7. **Chat REPL**
   - `llm-collab chat` — streaming terminal chat
   - Conversation history, model selection
   - Token usage and cost display per message
   - Cost tracking hooks fire on every inference

8. **Cost tracking system**
   - `src/data/llm-costs.ts` — pricing data for all models
   - Per-session, per-model, per-tool cost accumulation
   - `llm-collab costs` command to view spending
   - Hook: `onInference` fires with token counts + cost

### Phase 3: MCP Server

**Goal:** AI agents can use project integrations via MCP.

9. **MCP core**
   - `@modelcontextprotocol/sdk` server
   - Tool registry pattern: name -> JSON Schema -> handler
   - MCPToolContext injects authenticated services
   - Handlers never throw — return `{ success, data }` or `{ success: false, error }`

10. **Capability gating (progressive disclosure)**
    - Only register tools for configured integrations
    - `INTEGRATION_TOOL_MAP`: prefix -> config check function
    - Example: `github_*` tools only if `config.integrations.github.token` exists

11. **Transports**
    - stdio (default for Claude Code)
    - HTTP + SSE via Express.js (for web clients)
    - WebSocket via ws (for real-time / A2A)

12. **Core tools**
    - File: `file_read`, `file_write`, `file_list`, `file_search`
    - System: `shell_execute`, `env_get`, `system_info`
    - Chronicle: `chronicle_search`, `chronicle_read`, `chronicle_write`, `chronicle_ask`

### Phase 4: Service Integrations

**Goal:** Connect to external systems (all optional via capability gating).

13. **GitHub service**
    - Issues, PRs, search, CI status
    - Octokit for REST + GraphQL
    - MCP tools: `github_get_issue`, `github_search`, `github_create_pr`, etc.

14. **Linear service**
    - Issues, projects, cycles
    - `@linear/sdk` GraphQL client
    - MCP tools: `linear_get_issue`, `linear_search`, `linear_create_issue`

15. **Additional integrations (pluggable)**
    - GitLab (via `@gitbeaker/rest`)
    - Jira (REST API via `jira.js`)
    - Confluence (REST API)
    - Each follows the same pattern: service class + MCP tools + capability gate

### Phase 5: Chronicle (Knowledge System)

**Goal:** Persistent project memory with knowledge graph and semantic search.

16. **Chronicle store**
    - `better-sqlite3` database at `~/.llm-collab/chronicle/<project-hash>/chronicle.db`
    - Schema: items (id, content, metadata JSON, embedding BLOB, created_at, updated_at)
    - Schema: entities (id, name, type, properties JSON)
    - Schema: relations (from_id, to_id, type, metadata JSON)
    - Schema: timeline (id, item_id, snapshot JSON, timestamp)

17. **Embeddings**
    - Generate embeddings via configured LLM provider (Anthropic Voyage, OpenAI)
    - Fallback: local embedding model via Ollama
    - Cosine similarity search in-process
    - Hybrid: keyword (FTS5) + vector search

18. **Knowledge graph**
    - Entity extraction from conversations, code, and decisions
    - Entity types: file, function, decision, person, issue, concept
    - Relation types: depends_on, authored_by, decided_in, blocks, implements
    - Graph traversal queries: "what depends on auth_middleware?"
    - `llm-collab chronicle graph` — visualize entity graph

19. **Timeline & versioning**
    - Snapshot items over time
    - "What did we know about X on date Y?"
    - Decision log: records architectural decisions with rationale

20. **NL query engine**
    - `llm-collab chronicle ask "why did we choose JWT?"` — answers with citations
    - Uses RAG: semantic search -> context assembly -> LLM answer
    - MCP tool: `chronicle_ask` for agent access

21. **CLI commands**
    - `llm-collab chronicle init` — initialize for current project
    - `llm-collab chronicle push <content>` — add knowledge item
    - `llm-collab chronicle search <query>` — semantic search
    - `llm-collab chronicle ask <question>` — NL Q&A
    - `llm-collab chronicle graph [--entity <name>]` — show graph
    - `llm-collab chronicle timeline` — show decision timeline

### Phase 6: Agent System & Multi-Agent Delegation

**Goal:** Orchestrated multi-agent workflows with specialized agents.

22. **Sub-agent definitions**
    - `src/config/sub-agents.ts` — agent configs as `SubAgentConfig` objects
    - Each: name, description (trigger conditions), system prompt, tools[], temperature
    - Domain agents: github-expert, linear-expert, chronicle-expert
    - Export to `~/.claude/agents/` as YAML frontmatter + markdown

23. **Agent launcher**
    - `llm-collab agent claude` — configures and spawns Claude Code
    - Sets `ANTHROPIC_BASE_URL` (if relay), injects MCP endpoints
    - Uses `child_process.spawn()` with `--permission-mode`, `--allowed-tools`, `--live`
    - Flags: `-p <prompt>`, `-r <session>`, `--live`
    - Also: `llm-collab agent codex`, `llm-collab agent opencode`

24. **Multi-agent delegation**
    - Orchestrator (Opus 4.6) receives request, analyzes, delegates
    - Planner (Opus 4.6) researches and creates implementation plan
    - Coder (Sonnet 5) implements following the plan
    - Designer (Sonnet 5) handles UI/UX work
    - Agents defined in `.claude/agents/` — see agent definitions section

25. **Complexity routing**
    - Low complexity -> Haiku (fast, cheap)
    - Medium -> Sonnet (balanced)
    - High -> Opus with extended thinking
    - Configurable thresholds

### Phase 7: Skills System

**Goal:** Extend agent capabilities via installable markdown files.

32. **Bundled skills**
    - Embedded as TypeScript strings in `src/data/bundled-skills.ts`
    - Installed to `~/.claude/skills/` on setup
    - Never overwrites user edits (idempotent)

33. **Skill format**
    ```yaml
    ---
    userInvocable: true
    allowedTools: [github_*, chronicle_*]
    model: claude-sonnet-5
    readinessCheck: "gh auth status"
    requiredEnvVars:
      - name: GITHUB_TOKEN
        description: GitHub personal access token
        required: true
    ---
    Skill instructions in markdown...
    ```

34. **Skill commands**
    - `llm-collab skills list` — show available/installed
    - `llm-collab skills install <name>` — install a skill
    - `llm-collab skills search <query>` — find skills

### Phase 8: Hooks & Auditing

**Goal:** Comprehensive auditing, cost tracking, and lifecycle hooks.

26. **Hook system**
    - `HookManager` — EventEmitter-based lifecycle hooks
    - Hook types: `onToolCall`, `onInference`, `onSessionStart`, `onSessionEnd`, `onError`
    - Hooks receive context (tool name, tokens, cost, duration)

27. **Audit hook**
    - Log every tool execution with timestamp, tool, input summary, result status
    - Stored in `~/.llm-collab/audit/` as JSONL files (one per day)
    - `llm-collab audit` command to query

28. **Cost hook**
    - Track token usage per model, per session, per tool
    - Configurable budget alerts
    - `llm-collab costs --today` / `--this-week` / `--by-model`

29. **Secret scanner**
    - Regex patterns for common credential formats (AWS keys, tokens, passwords)
    - Runs on agent outputs before display/commit
    - Configurable: warn or block

30. **Webhook notifications**
    - Slack, Discord, generic webhook (via `node-fetch`)
    - Events: session_start, session_complete, session_failed, budget_alert
    - Configurable in config.json

### Phase 9: A2A Protocol (Agent-to-Agent)

**Goal:** Agents can delegate to other agents via structured protocol.

31. **A2A server**
    - JSON-RPC 2.0 over WebSocket (`ws` package)
    - Methods: `shell.execute`, `file.read`, `file.write`, `agent.delegate`
    - Optional TLS

32. **A2A client**
    - Connect to running agents
    - Send commands, stream results

### Phase 10: Error Handling & Resilience

**Goal:** Graceful degradation, retries, and clear error reporting.

33. **Typed errors**
    - `ConfigError`, `AuthError`, `APIError`, `MCPError`, `ChronicleError`
    - Each carries: message, code, actionable hint
    - All extend a base `LLMCollabError` class

34. **Retry strategies**
    - Exponential backoff for transient API failures (via `p-retry`)
    - Circuit breaker for persistent failures
    - Graceful degradation: if GitHub is down, other tools still work

35. **Payload cleaning**
    - Truncate large API responses for LLM consumption
    - Strip unnecessary fields
    - Configurable max payload size

### Phase 11: Testing

36. **Unit tests**
    - Vitest with describe/it/beforeEach
    - Mocks for external APIs (msw for HTTP mocking)
    - Snapshot tests for CLI output

37. **Integration tests**
    - MCP smoke tests: verify tool registration
    - Chronicle tests: write -> search -> verify
    - Config tests: hierarchy resolution

38. **Arena benchmarking**
    - Skills arena: LLM-as-judge scoring
    - Agents arena: scenario-based evaluation

### Phase 12: Distribution

39. **Compilation & distribution**
    - `tsup` for ESM + CJS bundle
    - `pkg` for standalone binary (macOS, Linux, Windows)
    - npm publish (`npx llm-collab`)
    - Homebrew formula
    - Shell completions generation (zsh/bash/fish) via Commander's built-in

## Configuration Schema

```jsonc
// ~/.llm-collab/config.json
{
  "ai": {
    "default_provider": "anthropic",
    "providers": {
      "anthropic": { "api_key": "sk-..." },
      "openai": { "api_key": "sk-..." },
      "ollama": { "base_url": "http://localhost:11434" },
      "openrouter": { "api_key": "sk-..." }
    },
    "default_model": "claude-sonnet-5",
    "complexity_routing": {
      "low": "claude-haiku-4-5",
      "medium": "claude-sonnet-5",
      "high": "claude-opus-4-8"
    }
  },
  "integrations": {
    "github": { "token": "ghp_...", "org": "myorg" },
    "linear": { "api_key": "lin_..." },
    "gitlab": { "url": "https://gitlab.com", "token": "glpat-..." },
    "jira": { "url": "https://myorg.atlassian.net", "email": "...", "token": "..." }
  },
  "chronicle": {
    "embedding_provider": "anthropic",
    "embedding_model": "voyage-3",
    "auto_capture": true
  },
  "relay": {
    "port": 4000,
    "require_auth": false
  },
  "hooks": {
    "audit": { "enabled": true, "retention_days": 30 },
    "costs": { "enabled": true, "budget_alert_usd": 50 },
    "secrets": { "enabled": true, "action": "warn" },
    "webhooks": [
      { "url": "https://hooks.slack.com/...", "events": ["session_complete", "budget_alert"] }
    ]
  }
}
```

## Agent Definitions

Four agents in `.claude/agents/`:

| Agent | Model | Role |
|-------|-------|------|
| orchestrator | Opus 4.6 | Receives requests, delegates to specialists, integrates results |
| planner | Opus 4.6 | Researches codebase, creates implementation plans |
| coder | Sonnet 5 | Writes code following mandatory principles, uses context7 MCP |
| designer | Sonnet 5 | UI/UX work: components, styling, terminal interfaces |

Delegation flow: User -> Orchestrator -> Planner (if complex) -> Coder/Designer -> Orchestrator validates

## Sub-Agent Definitions (Domain Experts)

Installed to `~/.claude/agents/` via `llm-collab setup`:

| Agent | Triggers On | Tools |
|-------|-------------|-------|
| github-expert | Issue refs, PR URLs, CI questions | github_* |
| linear-expert | Issue keys, project references | linear_* |
| chronicle-expert | Knowledge queries, "what do we know about" | chronicle_* |

## Naming Conventions

- **Files:** kebab-case for all files (`config-manager.ts`, `github-service.ts`)
- **Functions:** verb-first camelCase (`getUser`, `createIssue`)
- **Booleans:** question-form (`isValid`, `hasPermission`)
- **Constants:** UPPER_SNAKE_CASE
- **Types/Interfaces:** PascalCase, no `I` prefix
- **Config keys:** snake_case in JSON, camelCase in TypeScript
- **CLI commands:** kebab-case (`config-cmd`, `relay`)
- **MCP tools:** snake_case with domain prefix (`github_get_issue`, `chronicle_search`)

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `LLM_COLLAB_DEBUG` | Enable debug logging |
| `LLM_COLLAB_CONFIG` | Override config file path |
| `LLM_COLLAB_HOME` | Override home directory (default `~/.llm-collab`) |
| `ANTHROPIC_API_KEY` | Anthropic API key (fallback) |
| `OPENAI_API_KEY` | OpenAI API key (fallback) |
| `GITHUB_TOKEN` | GitHub token (fallback) |
| `NO_COLOR` | Disable colored output |

## Security Model

| Layer | Mechanism |
|-------|-----------|
| Credential storage | Config file with restricted permissions (600) |
| Secret scanning | Regex patterns on agent output before display/commit |
| Relay auth | Optional client authentication with named keys |
| MCP tool gating | Only register tools for configured integrations |
| Audit trail | All tool executions logged with timestamps |

## Local File Layout

```
~/.llm-collab/
├── config.json              # Main configuration
├── keys/                    # Relay client auth keys
│   └── keys.json
├── chronicle/               # Knowledge stores (per project)
│   └── <project-hash>/
│       └── chronicle.db     # SQLite database (better-sqlite3)
├── audit/                   # Audit logs
│   └── 2026-07-10.jsonl
├── costs/                   # Cost tracking data
│   └── sessions.jsonl
└── cache/                   # Response cache (TTL-based)

~/.claude/
├── agents/                  # Sub-agent definitions
│   ├── github-expert.md
│   ├── linear-expert.md
│   └── chronicle-expert.md
├── skills/                  # Installed skills
│   ├── code-review.md
│   ├── chronicle-capture.md
│   └── cost-report.md
└── settings.json            # Claude Code settings (hooks, permissions)
```

## Key Dependencies

| Category | Package | Purpose |
|----------|---------|---------|
| CLI | commander | Command parsing, subcommands, help generation |
| CLI | inquirer | Interactive prompts for setup wizard |
| CLI | chalk | Terminal colors (respects NO_COLOR) |
| CLI | ora | Spinners for async operations |
| AI | ai (Vercel AI SDK) | Unified LLM provider interface |
| AI | @ai-sdk/anthropic | Anthropic provider |
| AI | @ai-sdk/openai | OpenAI-compatible provider |
| MCP | @modelcontextprotocol/sdk | MCP server implementation |
| Validation | zod | Schema validation for config & API responses |
| Database | better-sqlite3 | Chronicle persistence (SQLite) |
| HTTP | express | Relay server, HTTP+SSE transport |
| HTTP | ws | WebSocket for A2A protocol |
| GitHub | @octokit/rest | GitHub REST API |
| GitHub | @octokit/graphql | GitHub GraphQL API |
| Linear | @linear/sdk | Linear API client |
| GitLab | @gitbeaker/rest | GitLab API client |
| Testing | vitest | Test runner, assertions, mocks |
| Testing | msw | HTTP mocking for API tests |
| Build | tsup | TypeScript bundler |
| Build | tsx | TypeScript execution (dev mode) |
| Build | pkg | Standalone binary compilation |
| Utilities | gray-matter | YAML frontmatter parsing |
| Utilities | p-retry | Retry with exponential backoff |

## Implementation Progress

### Phase 1: Foundation (MVP) — COMPLETE

All items implemented and tested:

| Component | File(s) | Status |
|-----------|---------|--------|
| Project bootstrap | `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts` | Done |
| Entry point | `src/index.ts` | Done — Commander.js router, global error handler, `--debug`, `--no-audit` |
| Typed errors | `src/utils/errors.ts` | Done — `LLMCollabError`, `ConfigError`, `AuthError`, `APIError`, `MCPError`, `ChronicleError` |
| Logger | `src/utils/logger.ts` | Done — debug/info/warn/error to stderr, `passThrough` to stdout, chalk colors |
| ConfigManager | `src/config/config-manager.ts` | Done — singleton, CLI > ENV > file > defaults, Zod validation, dot-notation get/set |
| Config schemas | `src/config/schemas.ts` | Done — all sections: ai, integrations, chronicle, relay, hooks |
| Config command | `src/commands/config-cmd.ts` | Done — `config get/set/list/path`, auto-parse booleans/numbers |
| Setup wizard | `src/commands/setup.ts` | Done — `@inquirer/prompts`, provider + GitHub + Linear setup, merges existing |
| Audit logger | `src/hooks/audit-logger.ts` | Done — JSONL to `~/.llm-collab/audit/YYYY-MM-DD.jsonl`, session/command/config/tool/decision/error events |
| Audit command | `src/commands/audit.ts` | Done — `audit show`, `audit tail`, `audit dates`, `--json`, `--event`, `--command` filters |

**Tested commands:**
- `llm-collab --help` / `--version`
- `llm-collab config get/set/list/path`
- `llm-collab setup` (interactive wizard)
- `llm-collab audit tail` / `audit tail -e config_change --json`
- Typecheck passes (`npx tsc --noEmit`)

### Phase 2: LLM Integration — COMPLETE

All items implemented and tested:

| Component | File(s) | Status |
|-----------|---------|--------|
| AI service | `src/services/ai-service.ts` | Done — Vercel AI SDK, Anthropic/OpenAI/Ollama/OpenRouter, streaming, generate |
| Relay server | `src/services/relay-server.ts` | Done — Express.js proxy, key injection, optional client auth, SSE streaming |
| Relay command | `src/commands/relay.ts` | Done — `relay [port]`, `--require-auth`, provider auto-detection |
| Chat REPL | `src/commands/chat.ts` | Done — streaming chat, `/model`, `/cost`, `/system`, `/clear`, `/quit` |
| LLM costs | `src/data/llm-costs.ts` | Done — pricing for Anthropic + OpenAI models, `getModelCost()`, `formatCost()` |
| Cost tracker | `src/services/cost-tracker.ts` | Done — JSONL persistence, per-session/model/provider summaries |
| Costs command | `src/commands/costs.ts` | Done — `costs --today`, `--week`, `--since`, `--json` |

**Dependencies added:** `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `express`, `@types/express`

**Tested commands:**
- `llm-collab chat --help` / `llm-collab relay --help`
- `llm-collab costs --today`
- `llm-collab --help` (shows all 6 commands)
- Typecheck passes (`npx tsc --noEmit`)

### Phase 3: MCP Server — COMPLETE

All items implemented and tested:

| Component | File(s) | Status |
|-----------|---------|--------|
| MCP server builder | `src/mcp/server.ts` | Done — McpServer with capability gating, tool registration |
| File tools | `src/mcp/tools/file-tools.ts` | Done — `file_read`, `file_write`, `file_list`, `file_search` |
| System tools | `src/mcp/tools/system-tools.ts` | Done — `shell_execute`, `env_get`, `system_info` |
| MCP command | `src/commands/mcp.ts` | Done — `mcp stdio` and `mcp http --port` |
| Capability gating | `src/mcp/server.ts` | Done — only registers tools for configured integrations |

**Dependencies added:** `@modelcontextprotocol/sdk`

**Tested commands:**
- `llm-collab mcp --help` (shows stdio/http subcommands)
- `llm-collab mcp http --help` (shows port option)
- Typecheck passes (`npx tsc --noEmit`)

### Phase 4: Service Integrations — COMPLETE

All items implemented and tested:

| Component | File(s) | Status |
|-----------|---------|--------|
| GitHub service | `src/services/github-service.ts` | Done — Octokit REST + GraphQL, issues, PRs, search, CI status, comments |
| GitHub MCP tools | `src/mcp/tools/github-tools.ts` | Done — 10 tools: get_issue, search_issues, list_issues, create_issue, get_pr, list_prs, create_pr, ci_status, get_repo, add_comment |
| GitHub CLI | `src/commands/github.ts` | Done — `github issues list/get/search/create`, `github prs list/get`, `github ci` |
| Linear service | `src/services/linear-service.ts` | Done — @linear/sdk, issues, search, teams, projects, create/update |
| Linear MCP tools | `src/mcp/tools/linear-tools.ts` | Done — 7 tools: get_issue, search_issues, list_issues, create_issue, update_issue, list_teams, list_projects |
| Linear CLI | `src/commands/linear.ts` | Done — `linear issues list/get/search/create`, `linear teams`, `linear projects` |
| MCP capability gating | `src/mcp/server.ts` | Done — registers github_*/linear_* tools only when configured |

**Dependencies added:** `@octokit/rest`, `@octokit/graphql`, `@linear/sdk`

**Tested commands:**
- `llm-collab --help` (shows all 9 commands)
- `llm-collab github --help` / `github issues --help` / `github prs --help`
- `llm-collab linear --help` / `linear issues --help`
- `llm-collab github issues list <repo>` (graceful error when unconfigured)
- `llm-collab linear issues list` (graceful error when unconfigured)
- Typecheck passes (`npx tsc --noEmit`)

### Phase 5: Chronicle (Knowledge System) — COMPLETE

All items implemented and tested:

| Component | File(s) | Status |
|-----------|---------|--------|
| Chronicle store | `src/chronicle/store.ts` | Done — SQLite persistence (better-sqlite3), items/entities/relations/timeline tables, FTS5 full-text search, cosine similarity vector search, WAL mode |
| Embeddings | `src/chronicle/embeddings.ts` | Done — Vercel AI SDK embedding generation, OpenAI/Ollama provider support, batch embedding |
| Knowledge graph | `src/chronicle/graph.ts` | Done — entity/relation management, graph traversal with depth control, text formatting |
| Timeline | `src/chronicle/timeline.ts` | Done — decision records, item history, temporal snapshots, formatted output |
| NL query engine | `src/chronicle/query.ts` | Done — hybrid search (keyword + semantic), RAG-powered Q&A with citations, graceful LLM fallback |
| Chronicle MCP tools | `src/mcp/tools/chronicle-tools.ts` | Done — 8 tools: search, read, write, ask, graph, timeline, entity, stats |
| Chronicle CLI | `src/commands/chronicle.ts` | Done — `chronicle init/push/search/ask/graph/timeline/stats` |
| MCP capability gating | `src/mcp/server.ts` | Done — registers chronicle_* tools only when initialized |

**Dependencies added:** `better-sqlite3`, `@types/better-sqlite3`

**Tested commands:**
- `llm-collab --help` (shows all 10 commands)
- `llm-collab chronicle --help` (shows 7 subcommands)
- `llm-collab chronicle init` (creates SQLite DB, idempotent)
- `llm-collab chronicle push "..."` (adds knowledge/decision items)
- `llm-collab chronicle search "query"` (FTS5 keyword search)
- `llm-collab chronicle stats` (shows item/entity/relation counts)
- `llm-collab chronicle timeline` (shows chronological activity)
- Typecheck passes (`npx tsc --noEmit`)

### Phase 6: Agent System & Multi-Agent Delegation — COMPLETE

All items implemented and tested:

| Component | File(s) | Status |
|-----------|---------|--------|
| Sub-agent definitions | `src/config/sub-agents.ts` | Done — `SubAgentConfig` interface, 3 domain agents (github-expert, linear-expert, chronicle-expert) with system prompts, scoped tools, model assignments, `generateAgentMarkdown()` for YAML frontmatter export |
| Agent service | `src/services/agent-service.ts` | Done — `AgentService` class: launches Claude/Codex/OpenCode via `child_process.spawn()`, builds env with API keys, generates MCP config, `installDomainAgents()` writes to `~/.claude/agents/` (idempotent), `getInstalledAgents()`, complexity routing (low/medium/high -> model) |
| Agent CLI | `src/commands/agent.ts` | Done — `agent claude/codex/opencode` (`-p`, `-r`, `--model`, `--live` flags), `agent install` (idempotent, `--force`), `agent list` (`--json`) |
| Entry point wiring | `src/index.ts` | Done — `agentCommand` imported and registered (11 total commands) |

**Dependencies added:** none — reuses `child_process` (Node built-in) and existing `gray-matter`/`zod` infra

**Tested commands:**
- `llm-collab --help` (shows all 11 commands)
- `llm-collab agent --help` (shows claude/codex/opencode/install/list subcommands)
- `llm-collab agent install` (writes domain agents to `~/.claude/agents/`, idempotent on rerun)
- `llm-collab agent list` / `agent list --json`
- Typecheck passes (`npx tsc --noEmit`)

### Phase 7: Skills System — COMPLETE

All items implemented and tested:

| Component | File(s) | Status |
|-----------|---------|--------|
| Bundled skills | `src/data/bundled-skills.ts` | Done — `BundledSkill` interface, 3 skills (code-review, chronicle-capture, cost-report) as TS strings, `getSkillByName()`, `searchSkills()` |
| Skills CLI | `src/commands/skills.ts` | Done — `skills list` (--json), `skills install [name]` (--force, single or all), `skills search <query>` |
| Setup wizard integration | `src/commands/setup.ts` | Done — prompts for domain agent + skills install after config save |
| Entry point wiring | `src/index.ts` | Done — `skillsCommand` registered (12 total commands) |

**Dependencies added:** none — reuses existing `gray-matter` infra

**Tested commands:**
- `llm-collab --help` (shows all 12 commands)
- `llm-collab skills list` / `skills list --json`
- `llm-collab skills install code-review` (single install)
- `llm-collab skills install` (all bundled, idempotent)
- `llm-collab skills search "review"` / `skills search "chronicle"`
- Typecheck passes (`npx tsc --noEmit`)

### Phase 8: Hooks & Auditing — COMPLETE

All items implemented and tested:

| Component | File(s) | Status |
|-----------|---------|--------|
| Hook manager | `src/hooks/hook-manager.ts` | Done — EventEmitter-based lifecycle hooks: `onToolCall`, `onInference`, `onSessionStart`, `onSessionEnd`, `onError`, `onBudgetAlert`. Typed contexts, enable/disable toggle |
| Cost hook | `src/hooks/cost-hook.ts` | Done — registers on inference events, tracks session spend, fires budget alerts when threshold exceeded |
| Secret scanner | `src/hooks/secret-scanner.ts` | Done — regex patterns for AWS keys, GitHub tokens, API keys, private keys, generic secrets. Warn or block modes, excerpt masking |
| Webhook notifications | `src/hooks/webhook.ts` | Done — sends events to Slack/Discord/generic webhook URLs. Auto-detects Slack format. Supports session_start, session_complete, session_failed, error, budget_alert events |
| Entry point wiring | `src/index.ts` | Done — initializes cost hook + webhooks from config, emits session start/end/error events |

**Dependencies added:** none

**Tested:** typecheck clean, hook events fire correctly, secret scanner detects AWS/GitHub/OpenAI keys/private keys, disable toggle works, CLI commands still function with hooks active.

### Phases 9–12 — NOT STARTED

See phase descriptions above for full details.

## Files Implemented So Far

```
src/
├── index.ts                 # Entry point — Commander.js, audit session tracking
├── commands/
│   ├── agent.ts             # Agent launcher CLI (claude/codex/opencode, install, list)
│   ├── audit.ts             # Audit log viewer (show/tail/dates)
│   ├── chat.ts              # Interactive AI chat REPL with streaming
│   ├── chronicle.ts         # Chronicle CLI (init, push, search, ask, graph, timeline, stats)
│   ├── config-cmd.ts        # Config get/set/list/path with audit logging
│   ├── costs.ts             # Token usage and cost viewer
│   ├── github.ts            # GitHub CLI (issues, PRs, CI status)
│   ├── linear.ts            # Linear CLI (issues, teams, projects)
│   ├── mcp.ts               # MCP server command (stdio/http)
│   ├── relay.ts             # LLM relay proxy command
│   ├── setup.ts             # Interactive wizard with audit logging
│   └── skills.ts            # Skills CLI (list, install, search)
├── chronicle/
│   ├── embeddings.ts        # Vector embedding generation (Vercel AI SDK)
│   ├── graph.ts             # Knowledge graph (entities, relations, traversal)
│   ├── query.ts             # NL query engine (RAG with citations)
│   ├── store.ts             # SQLite persistence layer (better-sqlite3)
│   └── timeline.ts          # Temporal versioning and decision log
├── config/
│   ├── config-manager.ts    # ConfigManager singleton
│   ├── schemas.ts           # Zod schemas for all config
│   └── sub-agents.ts        # Domain agent definitions (github/linear/chronicle-expert)
├── data/
│   ├── bundled-skills.ts    # Bundled skills as TS strings (code-review, chronicle-capture, cost-report)
│   └── llm-costs.ts         # Model pricing data
├── hooks/
│   ├── audit-logger.ts      # JSONL audit logger singleton
│   ├── cost-hook.ts         # Inference cost tracking + budget alerts
│   ├── hook-manager.ts      # EventEmitter lifecycle hooks
│   ├── secret-scanner.ts    # Credential detection in output
│   └── webhook.ts           # Slack/Discord/generic webhook notifications
├── mcp/
│   ├── server.ts            # MCP server builder with capability gating
│   └── tools/
│       ├── chronicle-tools.ts # 8 Chronicle MCP tools (search, read, write, ask, graph, timeline, entity, stats)
│       ├── file-tools.ts    # file_read, file_write, file_list, file_search
│       ├── github-tools.ts  # 10 GitHub MCP tools (issues, PRs, CI, comments)
│       ├── linear-tools.ts  # 7 Linear MCP tools (issues, teams, projects)
│       └── system-tools.ts  # shell_execute, env_get, system_info
├── services/
│   ├── agent-service.ts     # Agent launcher (spawn Claude/Codex/OpenCode), domain agent install
│   ├── ai-service.ts        # Multi-provider LLM abstraction (Vercel AI SDK)
│   ├── cost-tracker.ts      # Token/cost tracking with JSONL persistence
│   ├── github-service.ts    # GitHub REST + GraphQL via Octokit
│   ├── linear-service.ts    # Linear API via @linear/sdk
│   └── relay-server.ts      # Express.js HTTP proxy with key injection
└── utils/
    ├── errors.ts            # Typed error classes
    └── logger.ts            # Structured logger
```

## How to Resume Development

```bash
# Ensure correct Node version
nvm use 24

# Install deps (if needed)
pnpm install

# Verify current state
pnpm typecheck              # Should pass clean
npx tsx src/index.ts --help  # Should show all 12 commands

# Continue with remaining phases (see phase descriptions above)
# Next up: Phase 9 (A2A Protocol) — hooks & auditing (Phase 8) are now complete.
```

## Audit Log Format

Every CLI action writes a JSONL line to `~/.llm-collab/audit/YYYY-MM-DD.jsonl`:

```json
{
  "timestamp": "2026-07-10T15:27:12.836Z",
  "seq": 3,
  "event": "config_change",
  "detail": "relay.port: 4000 -> 5000",
  "meta": {
    "key": "relay.port",
    "oldValue": 4000,
    "newValue": 5000,
    "sessionId": "1783697232823-37a02h",
    "pid": 49731
  }
}
```

Event types: `session_start`, `session_end`, `command_start`, `command_end`, `config_change`, `config_read`, `tool_call`, `decision`, `error`

Sensitive values (keys matching `/key|token|secret|password|credential/i`) are auto-redacted in audit logs.
