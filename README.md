# llm-collab

An open-source CLI for AI-powered multi-agent collaboration. One tool to orchestrate coding agents, connect them to your project integrations, and build persistent knowledge across sessions.

## What It Does

**llm-collab** is the glue layer between AI coding agents and your development workflow:

- **Launch agents** — Start Claude Code, Codex, or other agents pre-configured with your project's MCP tools and knowledge
- **MCP server** — 50+ tools exposing GitHub, Linear, file ops, and knowledge search to any MCP-compatible agent
- **Chronicle** — Persistent project knowledge store with semantic search, knowledge graphs, and NL Q&A across sessions
- **Night Watch** — Autonomous agent orchestration that pulls issues and processes them without human intervention
- **Day Watch** — Interactive TUI for multi-agent chat with @mention routing
- **Relay proxy** — Local HTTP proxy that injects API keys so any tool can use your LLM provider without per-tool config
- **Cost tracking** — Per-session, per-model token usage and spend tracking with budget alerts

## Features

### Multi-Agent Delegation

Orchestrator agent analyzes requests and delegates to specialists:

```
User Request -> Orchestrator (Opus)
                  |-- Planner (Opus) -> Implementation plan
                  |-- Coder (Sonnet)  -> Code changes
                  +-- Designer (Sonnet) -> UI/UX work
```

Domain sub-agents (GitHub expert, Linear expert, Chronicle expert) activate on relevant signals — an issue key triggers the right specialist automatically.

### Chronicle (Persistent Knowledge)

Your project's memory that survives across sessions:

```bash
# Initialize for current project
llm-collab chronicle init

# Add knowledge
llm-collab chronicle push "We chose JWT because sessions don't scale across regions"

# Semantic search
llm-collab chronicle search "authentication decisions"

# Ask questions with citations
llm-collab chronicle ask "why did we move away from cookie-based auth?"

# View knowledge graph
llm-collab chronicle graph --entity "auth_middleware"
```

Chronicle stores entities (files, functions, decisions, concepts), relationships between them, and a timeline of when knowledge was captured. Powered by SQLite with vector embeddings for semantic search.

### Progressive Disclosure

You only see what's relevant:

- Tools for unconfigured integrations are hidden — not broken, just absent
- Setup wizard asks only about integrations you want
- Complexity routing sends simple tasks to fast models, complex ones to powerful models
- Safety profiles scale from "none" (full autonomy) to "paranoid" (human approval for everything)

### Hooks & Auditing

Every agent action is observable:

```bash
# View audit trail
llm-collab audit --today

# Check costs
llm-collab costs --this-week --by-model

# Budget alerts fire via webhook when threshold is hit
```

Hooks fire on: tool calls, LLM inference, session start/end, errors. Configure webhooks for Slack/Discord notifications.

## Installation

### From npm

```bash
npm install -g llm-collab
# or
npx llm-collab
```

### From Source

```bash
git clone https://github.com/rupambhattacharya/llm-collab.git
cd llm-collab
pnpm install
pnpm build
pnpm link --global
```

### Standalone Binary

```bash
# Build for your platform
pnpm pkg
# Output: ./bin/llm-collab
```

## Quick Start

### 1. Setup

```bash
llm-collab setup
```

The wizard walks you through configuring:
- LLM provider (Anthropic, OpenAI, Ollama, OpenRouter)
- Integrations (GitHub, Linear, GitLab, Jira — all optional)
- Chronicle (knowledge persistence)

### 2. Launch an Agent

```bash
# Start Claude Code with all your MCP tools connected
llm-collab agent claude

# With a specific task
llm-collab agent claude -p "fix the auth middleware race condition"

# Use the relay proxy for other tools
llm-collab relay 4000
```

### 3. Use the MCP Server

```bash
# stdio (for Claude Code, Cursor, etc.)
llm-collab mcp stdio

# HTTP (for web clients)
llm-collab mcp http --port 3456
```

Configure your editor to use the MCP server:

```json
{
  "mcpServers": {
    "llm-collab": {
      "command": "npx",
      "args": ["-y", "llm-collab", "mcp", "stdio"]
    }
  }
}
```

### 4. Build Knowledge

```bash
llm-collab chronicle init
llm-collab chronicle push "Auth uses JWT with RS256, keys rotated weekly via AWS Secrets Manager"
```

## Commands

| Command | Description |
|---------|-------------|
| `llm-collab setup` | Interactive configuration wizard |
| `llm-collab agent <type>` | Launch an AI agent (claude, codex, opencode) |
| `llm-collab chat` | Interactive AI chat REPL |
| `llm-collab mcp <transport>` | Start MCP server (stdio, http) |
| `llm-collab relay <port>` | Start LLM relay proxy |
| `llm-collab chronicle <cmd>` | Knowledge store operations |
| `llm-collab nw <cmd>` | Night Watch (autonomous orchestration) |
| `llm-collab dw` | Day Watch (interactive TUI) |
| `llm-collab github <cmd>` | GitHub operations |
| `llm-collab linear <cmd>` | Linear operations |
| `llm-collab skills <cmd>` | Skill management |
| `llm-collab costs` | View token usage and costs |
| `llm-collab audit` | View audit trail |
| `llm-collab config <cmd>` | View/edit configuration |

## Architecture

```
+---------------------------------------------------+
|                  Entry Point                       |
|           src/index.ts (Commander.js)              |
+--------------------------+------------------------+
                           |
+--------------------------v------------------------+
|                Commands Layer                      |
| agent | chat | mcp | relay | chronicle | nw | dw  |
| github | linear | skills | config | setup         |
+--------------------------+------------------------+
                           |
+--------------------------v------------------------+
|                Services Layer                      |
| ai-service | mcp-service | chronicle-service      |
| github-service | linear-service | coordinator     |
| relay-server | cost-tracker | day-watch            |
+-----------+------------------------------+--------+
            |                              |
+-----------v-----------+  +---------------v--------+
|   Configuration       |  |       MCP Server       |
|  ConfigManager        |  |  Tool Registry (50+)   |
|  Zod schemas          |  |  stdio / HTTP+SSE      |
|  Agent definitions    |  |  Capability gating     |
+-----------------------+  +------------------------+
            |                              |
+-----------v-----------+  +---------------v--------+
|   Data & Assets       |  |       Chronicle        |
|  Skills, costs,       |  |  SQLite + embeddings   |
|  templates            |  |  Knowledge graph       |
|                       |  |  Timeline + NL query   |
+-----------------------+  +------------------------+
```

For the full interactive architecture diagram, see [docs/architecture.html](docs/architecture.html).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 24+ |
| Language | TypeScript 5.x (strict) |
| CLI | Commander.js |
| Prompts | Inquirer.js |
| Validation | Zod |
| Build | tsup + pkg |
| Tests | Vitest |
| Database | better-sqlite3 |
| LLM | Vercel AI SDK |
| MCP | @modelcontextprotocol/sdk |

## Configuration

Config lives at `~/.llm-collab/config.json`. Hierarchy: CLI args > env vars > config file > defaults.

```bash
# View current config
llm-collab config list

# Set a value
llm-collab config set ai.default_model claude-sonnet-5

# Set integration token
llm-collab config set integrations.github.token ghp_xxxx
```

See [CLAUDE.md](CLAUDE.md#configuration-schema) for the full config schema.

## MCP Tools

Tools are organized by domain and only registered when the integration is configured:

| Domain | Tools | Requires |
|--------|-------|----------|
| File | `file_read`, `file_write`, `file_list`, `file_search` | Always available |
| System | `shell_execute`, `env_get`, `system_info` | Always available |
| Chronicle | `chronicle_search`, `chronicle_read`, `chronicle_write`, `chronicle_ask` | Chronicle initialized |
| GitHub | `github_get_issue`, `github_search`, `github_create_pr`, ... | `github.token` |
| Linear | `linear_get_issue`, `linear_search`, `linear_create_issue`, ... | `linear.api_key` |

## Night Watch (Autonomous)

Night Watch is an autonomous agent system that polls issue trackers and processes work items:

```bash
# Start with default coordinator config
llm-collab nw start

# Check active sessions
llm-collab nw status

# View execution history
llm-collab nw audit

# Stop gracefully
llm-collab nw stop
```

### Safety Profiles

| Profile | Behavior |
|---------|----------|
| `none` | Full autonomy, no gates |
| `balanced` | PR size limits, secret scanning |
| `strict` | Above + human approval for merges |
| `paranoid` | Above + human approval for every commit |

## Skills

Skills extend agent capabilities without code changes:

```bash
# List available skills
llm-collab skills list

# Install a skill
llm-collab skills install code-review

# Skills are markdown files installed to ~/.claude/skills/
```

## Cost Tracking

Every LLM call is tracked:

```bash
# Today's usage
llm-collab costs --today

# By model
llm-collab costs --by-model

# Set budget alert ($50 default)
llm-collab config set hooks.costs.budget_alert_usd 100
```

## Development

```bash
# Install dependencies
pnpm install

# Run in dev mode (tsx watch)
pnpm dev

# Run tests
pnpm test

# Lint
pnpm lint

# Format
pnpm format

# Type check
pnpm typecheck

# Build
pnpm build

# Build standalone binary
pnpm pkg
```

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

Key principles:
- Commands are thin, services are thick
- MCP tool handlers never throw
- All config validated with Zod
- Progressive disclosure — don't show unconfigured features
- Write tests for services, snapshot tests for CLI output
- Use Commander.js pattern for all CLI commands

## License

MIT
