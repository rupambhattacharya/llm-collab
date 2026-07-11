export interface SubAgentConfig {
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  tools: string[];
  temperature?: number;
}

export const DOMAIN_AGENTS: SubAgentConfig[] = [
  {
    name: "github-expert",
    description: "Activates on GitHub issue references (#123), PR URLs, CI questions, repository operations",
    model: "claude-sonnet-5",
    tools: [
      "github_get_issue", "github_search_issues", "github_list_issues", "github_create_issue",
      "github_get_pr", "github_list_prs", "github_create_pr", "github_ci_status",
      "github_get_repo", "github_add_comment",
    ],
    systemPrompt: `You are a GitHub expert agent. You help with GitHub operations: issues, pull requests, CI status, and repository management.

## Rules
- Always fetch the current state before making changes
- Link related issues and PRs when creating or commenting
- Include context in issue/PR descriptions
- Check CI status before approving or merging
- Never fabricate issue numbers or PR details — always verify`,
  },
  {
    name: "linear-expert",
    description: "Activates on Linear issue keys (ENG-123), project references, sprint/cycle questions",
    model: "claude-sonnet-5",
    tools: [
      "linear_get_issue", "linear_search_issues", "linear_list_issues", "linear_create_issue",
      "linear_update_issue", "linear_list_teams", "linear_list_projects",
    ],
    systemPrompt: `You are a Linear expert agent. You help with Linear project management: issues, teams, projects, and cycles.

## Rules
- Zero fabrication — always verify issue state before reporting
- Use team keys (e.g. ENG) for filtering when available
- Include priority and assignee in issue summaries
- Check project progress before making scope recommendations`,
  },
  {
    name: "chronicle-expert",
    description: "Activates on knowledge queries, 'what do we know about', decision history, 'why did we' questions",
    model: "claude-sonnet-5",
    tools: [
      "chronicle_search", "chronicle_read", "chronicle_write", "chronicle_ask",
      "chronicle_graph", "chronicle_timeline", "chronicle_entity", "chronicle_stats",
    ],
    systemPrompt: `You are a Chronicle knowledge expert. You help search, query, and manage the project's persistent knowledge store.

## Rules
- Search before answering — use chronicle_search or chronicle_ask
- Cite sources when answering from stored knowledge
- Record important decisions with chronicle_write using type "decision"
- Use the knowledge graph to find entity relationships
- Check timeline for historical context on decisions`,
  },
];

export function generateAgentMarkdown(agent: SubAgentConfig): string {
  const toolsList = agent.tools.length > 0
    ? agent.tools.map((t) => `  - ${t}`).join("\n")
    : "  - \"*\"";

  return `---
model: ${agent.model}
description: ${agent.description}
tools:
${toolsList}
---

${agent.systemPrompt}
`;
}
