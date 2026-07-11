# llm-collab

An open-source CLI for AI-powered multi-agent collaboration. One tool to orchestrate coding agents, connect them to your project integrations, and build persistent knowledge across sessions.

- **Launch agents** — Start Claude Code, Codex, or other agents pre-configured with MCP tools and project knowledge
- **MCP server** — 35+ tools exposing GitHub, Linear, file ops, and knowledge search to any MCP-compatible agent
- **Chronicle** — Persistent project knowledge store with semantic search, knowledge graphs, and NL Q&A
- **Relay proxy** — Local HTTP proxy that injects API keys so any tool can use your LLM provider
- **Cost tracking** — Per-session, per-model token usage and spend tracking with budget alerts
- **Hooks & auditing** — Every action logged, secret scanning, webhook notifications

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Commands](#commands)
  - [setup](#setup)
  - [agent](#agent)
  - [chat](#chat)
  - [mcp](#mcp)
  - [relay](#relay)
  - [chronicle](#chronicle)
  - [github](#github)
  - [linear](#linear)
  - [skills](#skills)
  - [costs](#costs)
  - [audit](#audit)
  - [config](#config)
  - [completions](#completions)
- [MCP Tools Reference](#mcp-tools-reference)
- [Editor Integration](#editor-integration)
- [Multi-Agent System](#multi-agent-system)
- [Hooks & Auditing](#hooks--auditing)
- [Environment Variables](#environment-variables)
- [Architecture](#architecture)
- [Development](#development)
- [License](#license)

## Installation

### Prerequisites

- **Node.js 24+** — `nvm install 24` or download from [nodejs.org](https://nodejs.org)
- **pnpm** — `npm install -g pnpm`

### Install from Source

```bash
git clone https://github.com/rupambhattacharya/llm-collab.git
cd llm-collab
pnpm install
pnpm build
```

### Make it Available Globally

Link the package so `llm-collab` works from any directory:

```bash
pnpm link --global
```

> **Troubleshooting `ERR_PNPM_NO_GLOBAL_BIN_DIR`:** pnpm needs `PNPM_HOME` set and on your `PATH`. Run `pnpm setup` once to configure it, then **open a new terminal** (or `source ~/.zshrc` / `~/.bashrc`) so the exported variable takes effect before retrying `pnpm link --global`.

Verify the installation:

```bash
llm-collab --version   # 0.1.0
llm-collab --help      # show all commands
```

To unlink later: `pnpm unlink --global`

### Alternative: Run Without Linking

```bash
# Via pnpm
pnpm start -- --help

# Via tsx (dev mode, no build needed)
npx tsx src/index.ts --help

# Via node (after building)
node dist/index.js --help
```

### Rebuilding After Updates

```bash
git pull
pnpm install    # in case deps changed
pnpm build      # rebuild dist/
# global link still points to dist/, so llm-collab picks up changes immediately
```

### Shell Completions

Generate and install tab completions for your shell:

```bash
# Bash — add to ~/.bashrc
eval "$(llm-collab completions bash)"

# Zsh — add to ~/.zshrc
eval "$(llm-collab completions zsh)"

# Fish — save to completions directory
llm-collab completions fish > ~/.config/fish/completions/llm-collab.fish
```

## Quick Start

### 1. Run the Setup Wizard

```bash
llm-collab setup
```

The wizard walks you through:
- LLM provider (Anthropic, OpenAI, Ollama, OpenRouter)
- Integrations (GitHub, Linear — all optional)
- Domain agent installation
- Skill installation

Configuration is saved to `~/.llm-collab/config.json`.

### 2. Launch an Agent

```bash
# Start Claude Code with all your MCP tools connected
llm-collab agent claude

# With a specific task
llm-collab agent claude -p "fix the auth middleware race condition"
```

### 3. Initialize Chronicle

```bash
llm-collab chronicle init
llm-collab chronicle push "Auth uses JWT with RS256, keys rotated weekly via AWS Secrets Manager"
```

### 4. Start the MCP Server

```bash
# For Claude Code, Cursor, etc.
llm-collab mcp stdio

# For web clients
llm-collab mcp http --port 3456
```

## Configuration

Config lives at `~/.llm-collab/config.json`. Values resolve in this order: **CLI args > environment variables > config file > defaults**.

### Managing Config

```bash
# View all config
llm-collab config list

# Get a specific value
llm-collab config get ai.default_model

# Set a value (auto-parses booleans and numbers)
llm-collab config set ai.default_model claude-sonnet-5
llm-collab config set relay.port 5000
llm-collab config set hooks.costs.enabled true

# Show config file path
llm-collab config path
```

### Full Config Reference

```jsonc
{
  "ai": {
    "default_provider": "anthropic",        // anthropic | openai | ollama | openrouter
    "providers": {
      "anthropic": { "api_key": "sk-ant-..." },
      "openai": { "api_key": "sk-..." },
      "ollama": { "base_url": "http://localhost:11434" },
      "openrouter": { "api_key": "sk-..." }
    },
    "default_model": "claude-sonnet-5",
    "complexity_routing": {                  // auto-select model by task complexity
      "low": "claude-haiku-4-5",
      "medium": "claude-sonnet-5",
      "high": "claude-opus-4-8"
    }
  },
  "integrations": {
    "github": {
      "token": "ghp_...",                   // GitHub personal access token
      "org": "myorg"                        // optional: default org
    },
    "linear": {
      "api_key": "lin_..."                  // Linear API key
    },
    "gitlab": {
      "url": "https://gitlab.com",
      "token": "glpat-..."
    },
    "jira": {
      "url": "https://myorg.atlassian.net",
      "email": "you@company.com",
      "token": "..."
    }
  },
  "chronicle": {
    "embedding_provider": "anthropic",      // for semantic search embeddings
    "embedding_model": "voyage-3",
    "auto_capture": true
  },
  "relay": {
    "port": 4000,                           // default relay proxy port
    "require_auth": false                   // require Bearer token for relay
  },
  "hooks": {
    "audit": {
      "enabled": true,
      "retention_days": 30
    },
    "costs": {
      "enabled": true,
      "budget_alert_usd": 50               // fire alert when session spend exceeds
    },
    "secrets": {
      "enabled": true,
      "action": "warn"                      // warn | block
    },
    "webhooks": [                           // notifications for session events
      {
        "url": "https://hooks.slack.com/services/...",
        "events": ["session_complete", "budget_alert"]
      }
    ]
  }
}
```

## Commands

### `setup`

Interactive configuration wizard. Guides you through provider keys, integrations, agent installation, and skills.

```bash
llm-collab setup
```

The wizard:
1. Asks for your preferred LLM provider and API key
2. Optionally configures GitHub and Linear integrations
3. Offers to install domain-expert sub-agents
4. Offers to install bundled skills

Safe to re-run — merges with existing config without overwriting.

---

### `agent`

Launch AI agents pre-configured with your project's MCP server, API keys, and integrations.

```bash
# Launch Claude Code
llm-collab agent claude

# With a prompt
llm-collab agent claude -p "refactor the auth module to use middleware pattern"

# Resume a previous session
llm-collab agent claude -r <session-id>

# Override model
llm-collab agent claude --model claude-opus-4-8

# Enable live streaming output
llm-collab agent claude --live

# Launch other agents
llm-collab agent codex
llm-collab agent opencode
```

#### Domain Agent Management

Domain-expert sub-agents provide specialized knowledge for GitHub, Linear, and Chronicle:

```bash
# Install domain agents to ~/.claude/agents/
llm-collab agent install

# Reinstall (overwrite existing)
llm-collab agent install --force

# List all installed agents
llm-collab agent list

# JSON output
llm-collab agent list --json
```

Installed domain agents:

| Agent | Triggers On | Tools |
|-------|-------------|-------|
| `github-expert` | Issue refs, PR URLs, CI questions | `github_*` |
| `linear-expert` | Issue keys, project references | `linear_*` |
| `chronicle-expert` | Knowledge queries, "what do we know about" | `chronicle_*` |

---

### `chat`

Interactive AI chat REPL with streaming responses and cost tracking.

```bash
# Start chat with default model
llm-collab chat

# Specify model
llm-collab chat --model claude-opus-4-8

# Set system prompt
llm-collab chat --system "You are a senior Go developer"
```

In-chat commands:

| Command | Description |
|---------|-------------|
| `/model <name>` | Switch model |
| `/model` | Show current model |
| `/system <prompt>` | Set system prompt |
| `/cost` | Show session cost |
| `/clear` | Clear history |
| `/quit` | Exit chat |

---

### `mcp`

Start the MCP (Model Context Protocol) server. Exposes 35+ tools to any MCP-compatible AI agent or editor.

```bash
# stdio transport (for Claude Code, Cursor, etc.)
llm-collab mcp stdio

# HTTP+SSE transport (for web clients)
llm-collab mcp http
llm-collab mcp http --port 8080
```

The HTTP server exposes:
- `GET /sse` — SSE event stream
- `POST /messages` — send messages to the server
- `GET /health` — health check

**Progressive disclosure**: Only tools for configured integrations are registered. If GitHub isn't configured, `github_*` tools won't appear.

---

### `relay`

Start a local HTTP proxy that accepts OpenAI-compatible requests and injects your API key. Any tool that supports a custom API base URL can use your LLM provider without needing its own key.

```bash
# Start on default port (4000)
llm-collab relay

# Custom port
llm-collab relay 8080

# Require client authentication
llm-collab relay --require-auth
```

Endpoints:
- `POST /v1/chat/completions` — proxied to upstream provider
- `GET /v1/models` — list available models
- `GET /health` — health check

When `--require-auth` is set, clients must send a Bearer token. Manage keys in `~/.llm-collab/keys/keys.json`.

**Usage with other tools:**

```bash
# Point any OpenAI-compatible tool at the relay
export OPENAI_BASE_URL=http://localhost:4000/v1

# Cursor, Continue, etc. can use this as their API endpoint
```

---

### `chronicle`

Persistent project knowledge store with SQLite, full-text search, semantic search (via embeddings), knowledge graphs, and timeline tracking.

#### Initialize

```bash
llm-collab chronicle init
```

Creates a SQLite database at `~/.llm-collab/chronicle/<project-hash>/chronicle.db`. Safe to re-run (idempotent).

#### Add Knowledge

```bash
# Add a knowledge item
llm-collab chronicle push "We chose JWT because sessions don't scale across regions"

# Add a decision record
llm-collab chronicle push "Decided to use Redis for rate limiting instead of in-memory" --type decision

# Types: knowledge (default), decision, context, note
```

#### Search

```bash
# Full-text keyword search
llm-collab chronicle search "authentication"

# Limit results
llm-collab chronicle search "database migration" --limit 5

# JSON output
llm-collab chronicle search "auth" --json
```

#### Ask Questions (RAG)

Uses retrieval-augmented generation to answer questions with citations from your knowledge store:

```bash
llm-collab chronicle ask "why did we choose JWT over sessions?"
llm-collab chronicle ask "what are the trade-offs of our caching strategy?"
```

Requires a configured LLM provider. Falls back to keyword search results if no provider is available.

#### Knowledge Graph

View and explore entities (files, functions, decisions, concepts) and their relationships:

```bash
# List all entities
llm-collab chronicle graph

# Filter by type
llm-collab chronicle graph --type decision

# Look up a specific entity and its connections
llm-collab chronicle graph --entity "auth_middleware"

# Control traversal depth
llm-collab chronicle graph --entity "auth_middleware" --depth 3
```

#### Timeline

View chronological activity and decision history:

```bash
# Recent activity
llm-collab chronicle timeline

# Decisions only
llm-collab chronicle timeline --decisions

# Filter by date
llm-collab chronicle timeline --since 2026-01-01

# Limit entries
llm-collab chronicle timeline --limit 10
```

#### Statistics

```bash
llm-collab chronicle stats
# Items: 42, Entities: 15, Relations: 28, Timeline: 42 entries
```

---

### `github`

GitHub operations via the CLI. Requires `integrations.github.token` in config.

#### Issues

```bash
# List open issues
llm-collab github issues list owner/repo

# Filter by state and labels
llm-collab github issues list owner/repo --state closed --labels bug

# Get a specific issue
llm-collab github issues get owner/repo 42

# Search issues
llm-collab github issues search "memory leak" --repo owner/repo --state open

# Create an issue
llm-collab github issues create owner/repo "Fix login timeout" \
  --body "Login times out after 30s on slow connections" \
  --labels "bug,p1" \
  --assignees "alice,bob"
```

#### Pull Requests

```bash
# List open PRs
llm-collab github prs list owner/repo

# Get a specific PR
llm-collab github prs get owner/repo 15

# Filter by state
llm-collab github prs list owner/repo --state all
```

#### CI Status

```bash
# Check CI for a branch
llm-collab github ci owner/repo main

# Check CI for a specific commit
llm-collab github ci owner/repo abc123f
```

All GitHub commands support `--json` for machine-readable output.

---

### `linear`

Linear project management operations. Requires `integrations.linear.api_key` in config.

#### Issues

```bash
# List issues
llm-collab linear issues list

# Filter by team
llm-collab linear issues list --team ENG

# Filter by state
llm-collab linear issues list --state "In Progress"

# Get a specific issue
llm-collab linear issues get ENG-123

# Search issues
llm-collab linear issues search "auth bug"

# Create an issue
llm-collab linear issues create <team-id> "Fix auth race condition" \
  --description "Race condition in the token refresh flow" \
  --priority 2
```

Priority levels: `0` = none, `1` = urgent, `2` = high, `3` = medium, `4` = low

#### Teams & Projects

```bash
# List teams
llm-collab linear teams

# List projects
llm-collab linear projects
llm-collab linear projects --limit 50
```

All Linear commands support `--json` for machine-readable output.

---

### `skills`

Skills extend agent capabilities via installable markdown files. Skills are installed to `~/.claude/skills/` and can include YAML frontmatter with model preferences, allowed tools, and readiness checks.

```bash
# List available and installed skills
llm-collab skills list

# Install a specific skill
llm-collab skills install code-review

# Install all bundled skills
llm-collab skills install

# Reinstall (overwrite existing)
llm-collab skills install --force

# Search skills
llm-collab skills search "review"
llm-collab skills search "cost"
```

#### Bundled Skills

| Skill | Description |
|-------|-------------|
| `code-review` | Structured code review with security and performance checks |
| `chronicle-capture` | Capture project knowledge and decisions into Chronicle |
| `cost-report` | Generate LLM usage and cost reports |

Skills are markdown files with optional YAML frontmatter:

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

You can create custom skills by placing `.md` files in `~/.claude/skills/`.

---

### `costs`

View token usage and cost tracking across sessions.

```bash
# Show all costs
llm-collab costs

# Today's costs
llm-collab costs --today

# This week
llm-collab costs --week

# Since a specific date
llm-collab costs --since 2026-07-01

# JSON output
llm-collab costs --json
```

Cost data is stored in `~/.llm-collab/costs/sessions.jsonl`. Budget alerts fire when session spend exceeds the configured threshold (default $50).

Configure budget alerts:

```bash
llm-collab config set hooks.costs.budget_alert_usd 100
```

---

### `audit`

View the audit trail of all CLI actions. Every command execution, config change, tool call, and error is logged to `~/.llm-collab/audit/YYYY-MM-DD.jsonl`.

```bash
# Show recent entries
llm-collab audit tail

# Show more entries
llm-collab audit tail -n 50

# Filter by event type
llm-collab audit tail -e config_change
llm-collab audit tail -e error

# Show entries for a specific date
llm-collab audit show --date 2026-07-10

# Filter by command
llm-collab audit show --command "chronicle push"

# Raw JSON output
llm-collab audit tail --json

# List dates with audit data
llm-collab audit dates
```

Event types: `session_start`, `session_end`, `command_start`, `command_end`, `config_change`, `config_read`, `tool_call`, `decision`, `error`

Sensitive values (keys matching `key`, `token`, `secret`, `password`, `credential`) are automatically redacted in audit logs.

---

### `config`

View and edit configuration directly.

```bash
# Get a value (dot notation)
llm-collab config get ai.default_model
llm-collab config get integrations.github.token

# Set a value
llm-collab config set ai.default_model claude-opus-4-8
llm-collab config set relay.port 5000

# Show all config
llm-collab config list

# Show config file path
llm-collab config path
```

---

### `completions`

Generate shell completion scripts.

```bash
llm-collab completions bash    # Bash completions
llm-collab completions zsh     # Zsh completions
llm-collab completions fish    # Fish completions
```

See [Shell Completions](#shell-completions) for installation instructions.

## MCP Tools Reference

Tools are organized by domain and only registered when the corresponding integration is configured (progressive disclosure).

### Always Available

| Tool | Description |
|------|-------------|
| `file_read` | Read file contents |
| `file_write` | Write file contents |
| `file_list` | List directory contents |
| `file_search` | Search files by name or content |
| `shell_execute` | Execute shell commands |
| `env_get` | Get environment variable |
| `system_info` | Get system information |

### Chronicle (requires `chronicle init`)

| Tool | Description |
|------|-------------|
| `chronicle_search` | Search knowledge store |
| `chronicle_read` | Read a knowledge item |
| `chronicle_write` | Add a knowledge item |
| `chronicle_ask` | RAG-powered Q&A |
| `chronicle_graph` | Query knowledge graph |
| `chronicle_timeline` | View timeline |
| `chronicle_entity` | Manage entities |
| `chronicle_stats` | Store statistics |

### GitHub (requires `integrations.github.token`)

| Tool | Description |
|------|-------------|
| `github_get_issue` | Get issue details |
| `github_search_issues` | Search issues |
| `github_list_issues` | List repository issues |
| `github_create_issue` | Create a new issue |
| `github_get_pr` | Get pull request details |
| `github_list_prs` | List pull requests |
| `github_create_pr` | Create a pull request |
| `github_ci_status` | Check CI/CD status |
| `github_get_repo` | Get repository info |
| `github_add_comment` | Add a comment to issue/PR |

### Linear (requires `integrations.linear.api_key`)

| Tool | Description |
|------|-------------|
| `linear_get_issue` | Get issue details |
| `linear_search_issues` | Search issues |
| `linear_list_issues` | List issues |
| `linear_create_issue` | Create an issue |
| `linear_update_issue` | Update an issue |
| `linear_list_teams` | List teams |
| `linear_list_projects` | List projects |

## Editor Integration

### Claude Code

```json
{
  "mcpServers": {
    "llm-collab": {
      "command": "llm-collab",
      "args": ["mcp", "stdio"]
    }
  }
}
```

Or launch Claude Code directly with MCP pre-configured:

```bash
llm-collab agent claude
```

### Cursor

Add to Cursor's MCP settings (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "llm-collab": {
      "command": "llm-collab",
      "args": ["mcp", "stdio"]
    }
  }
}
```

### VS Code (Copilot)

Add to VS Code settings or `.vscode/mcp.json`:

```json
{
  "servers": {
    "llm-collab": {
      "type": "stdio",
      "command": "llm-collab",
      "args": ["mcp", "stdio"]
    }
  }
}
```

### Windsurf / Continue / Other MCP Clients

Any editor or tool that supports MCP can connect via stdio:

```bash
llm-collab mcp stdio
```

Or via HTTP+SSE for web-based clients:

```bash
llm-collab mcp http --port 3456
# Connect to http://localhost:3456/sse
```

## Multi-Agent System

### Orchestration Agents

Four agents defined in `.claude/agents/`:

| Agent | Model | Role |
|-------|-------|------|
| `orchestrator` | Opus | Receives requests, delegates to specialists, integrates results |
| `planner` | Opus | Researches codebase, creates implementation plans |
| `coder` | Sonnet | Writes code following the plan |
| `designer` | Sonnet | UI/UX work: components, styling, terminal interfaces |

Delegation flow:

```
User Request -> Orchestrator -> Planner (if complex) -> Coder/Designer -> Orchestrator validates
```

### Domain Sub-Agents

Installed via `llm-collab agent install`, these activate on relevant signals:

- **github-expert** — Issue references, PR URLs, CI questions
- **linear-expert** — Issue keys (ENG-123), project references
- **chronicle-expert** — Knowledge queries, "what do we know about..."

### Complexity Routing

Tasks are automatically routed to the right model:

```bash
# Configure thresholds
llm-collab config set ai.complexity_routing.low claude-haiku-4-5
llm-collab config set ai.complexity_routing.medium claude-sonnet-5
llm-collab config set ai.complexity_routing.high claude-opus-4-8
```

### A2A Protocol (Agent-to-Agent)

Agents communicate via JSON-RPC 2.0 over WebSocket:

Built-in methods:
- `shell.execute` — Run shell commands
- `file.read` / `file.write` — File operations
- `agent.delegate` — Delegate to another agent
- `rpc.methods` — List available methods

## Hooks & Auditing

### Hook System

EventEmitter-based lifecycle hooks fire on key events:

| Event | When |
|-------|------|
| `toolCall` | Any MCP tool is executed |
| `inference` | An LLM call completes |
| `sessionStart` | CLI session begins |
| `sessionEnd` | CLI session ends |
| `error` | An error occurs |
| `budgetAlert` | Session spend exceeds threshold |

### Secret Scanner

Automatically scans agent output for credentials before display:

- AWS Access Keys and Secret Keys
- GitHub tokens (fine-grained and classic)
- Anthropic, OpenAI, Linear API keys
- Slack tokens and webhook URLs
- Private keys
- Generic secret assignments

Configure the action:

```bash
# Warn but allow output (default)
llm-collab config set hooks.secrets.action warn

# Block output containing secrets
llm-collab config set hooks.secrets.action block
```

### Webhook Notifications

Send notifications to Slack, Discord, or any webhook URL:

```bash
# Add a webhook (edit config directly)
llm-collab config list  # view current webhooks
```

Config example:

```json
{
  "hooks": {
    "webhooks": [
      {
        "url": "https://hooks.slack.com/services/T.../B.../xxx",
        "events": ["session_complete", "budget_alert"]
      }
    ]
  }
}
```

Slack URLs are auto-detected and formatted with rich Slack payloads.

Events: `session_start`, `session_end`, `error`, `budget_alert`. Leave `events` empty to receive all events.

### Audit Trail

Every CLI action writes to `~/.llm-collab/audit/YYYY-MM-DD.jsonl`:

```json
{
  "timestamp": "2026-07-10T15:27:12.836Z",
  "seq": 3,
  "event": "config_change",
  "detail": "relay.port: 4000 -> 5000",
  "meta": { "key": "relay.port", "sessionId": "..." }
}
```

Disable auditing for a single command:

```bash
llm-collab --no-audit config list
```

### Error Handling & Resilience

- **Typed errors** — `ConfigError`, `AuthError`, `APIError`, `MCPError`, `ChronicleError` with actionable hints
- **Retry with backoff** — Transient API failures retry automatically (exponential backoff, max 3 attempts)
- **Circuit breaker** — Persistent failures open the circuit to prevent cascading failures
- **Payload cleaning** — Large API responses are truncated and stripped of unnecessary fields for LLM consumption

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `LLM_COLLAB_DEBUG` | Enable debug logging |
| `LLM_COLLAB_CONFIG` | Override config file path |
| `LLM_COLLAB_HOME` | Override home directory (default `~/.llm-collab`) |
| `ANTHROPIC_API_KEY` | Anthropic API key (fallback if not in config) |
| `OPENAI_API_KEY` | OpenAI API key (fallback if not in config) |
| `GITHUB_TOKEN` | GitHub token (fallback if not in config) |
| `NO_COLOR` | Disable colored output |

## Architecture

```
+---------------------------------------------------+
|                  Entry Point                       |
|           src/index.ts (Commander.js)              |
+--------------------------+------------------------+
                           |
+--------------------------v------------------------+
|                Commands Layer (thin)               |
| agent | chat | mcp | relay | chronicle            |
| github | linear | skills | config | setup         |
| costs | audit | completions                        |
+--------------------------+------------------------+
                           |
+--------------------------v------------------------+
|                Services Layer (thick)              |
| ai-service | agent-service | cost-tracker          |
| github-service | linear-service                    |
| relay-server | thread-manager                      |
+-----------+------------------------------+--------+
            |                              |
+-----------v-----------+  +---------------v--------+
|   Configuration       |  |       MCP Server       |
|  ConfigManager        |  |  Tool Registry (35+)   |
|  Zod schemas          |  |  stdio / HTTP+SSE      |
|  Agent definitions    |  |  Capability gating     |
+-----------------------+  +------------------------+
            |                              |
+-----------v-----------+  +---------------v--------+
|   Hooks & Audit       |  |       Chronicle        |
|  HookManager          |  |  SQLite + FTS5         |
|  Secret scanner       |  |  Embeddings + vectors  |
|  Webhooks             |  |  Knowledge graph       |
|  Cost tracking        |  |  Timeline + NL query   |
+-----------------------+  +------------------------+
            |
+-----------v-----------+
|   A2A Protocol        |
|  JSON-RPC 2.0 / WS    |
|  Agent delegation     |
+-----------------------+
```

For the full interactive architecture diagram, see [docs/architecture.html](docs/architecture.html).

### Key Principles

- **Commands are thin** — Parse args, call service, format output
- **Services are thick** — All business logic, auth, caching, retries
- **MCP tools never throw** — Return `{ success, data }` or `{ success: false, error }`
- **Progressive disclosure** — Only show tools/features for configured integrations
- **Skills over code** — Extend agent capabilities via markdown, not code changes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 24+ |
| Language | TypeScript 5.x (strict mode) |
| CLI | Commander.js |
| Prompts | Inquirer.js |
| Validation | Zod |
| Build | tsup |
| Tests | Vitest (73 tests) |
| Database | better-sqlite3 (SQLite) |
| LLM | Vercel AI SDK (@ai-sdk/anthropic, @ai-sdk/openai) |
| MCP | @modelcontextprotocol/sdk |
| A2A | ws (WebSocket, JSON-RPC 2.0) |

## Development

```bash
# Install dependencies
pnpm install

# Run in dev mode (auto-reloads on save)
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format

# Build (output to dist/)
pnpm build
```

### Project Structure

```
src/
├── index.ts              # Entry point — Commander.js router
├── commands/             # CLI command handlers (thin)
├── services/             # Business logic (thick)
├── config/               # ConfigManager, Zod schemas, agent definitions
├── mcp/                  # MCP server, tool registry, transports
├── chronicle/            # SQLite store, embeddings, graph, timeline, query
├── hooks/                # Hook manager, audit, cost, secrets, webhooks
├── agent/a2a/            # A2A protocol (JSON-RPC 2.0 over WebSocket)
├── data/                 # Bundled skills, LLM pricing data
└── utils/                # Logger, errors, retry, payload cleaning
```

### Local File Layout

```
~/.llm-collab/
├── config.json           # Main configuration
├── keys/keys.json        # Relay client auth keys
├── chronicle/<hash>/     # Knowledge stores (per project)
│   └── chronicle.db      # SQLite database
├── audit/                # Audit logs (JSONL, one per day)
├── costs/sessions.jsonl  # Cost tracking data
└── cache/                # Response cache

~/.claude/
├── agents/               # Sub-agent definitions
└── skills/               # Installed skills
```

## Global Flags

All commands support these flags:

```bash
llm-collab --debug <command>      # Enable debug logging
llm-collab --no-audit <command>   # Disable audit logging for this command
llm-collab --version              # Show version
llm-collab --help                 # Show help
```

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

## License

MIT
