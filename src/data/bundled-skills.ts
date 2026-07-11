export interface BundledSkill {
  name: string;
  filename: string;
  description: string;
  content: string;
}

export const BUNDLED_SKILLS: BundledSkill[] = [
  {
    name: "code-review",
    filename: "code-review.md",
    description: "Automated code review with GitHub integration",
    content: `---
userInvocable: true
allowedTools:
  - github_get_pr
  - github_list_prs
  - github_add_comment
  - file_read
  - file_list
  - file_search
  - shell_execute
model: claude-sonnet-5
readinessCheck: "gh auth status"
requiredEnvVars:
  - name: GITHUB_TOKEN
    description: GitHub personal access token
    required: true
---

# Code Review

Review code changes for quality, correctness, and best practices.

## Workflow

1. **Identify changes**: Use \`git diff\` or fetch the PR diff via \`github_get_pr\`
2. **Analyze each file**: Read changed files, understand context
3. **Check for issues**:
   - Logic errors or edge cases
   - Security vulnerabilities (injection, XSS, auth bypass)
   - Performance concerns (N+1 queries, unbounded loops)
   - Missing error handling at system boundaries
   - Type safety issues
4. **Report findings**: Post review comments via \`github_add_comment\` or output to terminal

## Review Checklist

- [ ] No hardcoded secrets or credentials
- [ ] Input validation at system boundaries
- [ ] Error handling for external API calls
- [ ] Tests cover new logic paths
- [ ] No breaking changes to public APIs without version bump
- [ ] Dependencies are pinned or version-ranged appropriately

## Output Format

For each finding, report:
- **File and line**: Where the issue is
- **Severity**: critical / warning / suggestion
- **Description**: What's wrong and why
- **Fix**: Suggested remediation
`,
  },
  {
    name: "chronicle-capture",
    filename: "chronicle-capture.md",
    description: "Capture decisions and knowledge to Chronicle",
    content: `---
userInvocable: true
allowedTools:
  - chronicle_write
  - chronicle_search
  - chronicle_read
  - chronicle_graph
  - chronicle_entity
  - chronicle_timeline
  - file_read
  - shell_execute
model: claude-sonnet-5
---

# Chronicle Capture

Capture important decisions, context, and knowledge into the project's Chronicle store.

## When to Capture

- Architectural decisions (ADRs)
- Why a particular technology or approach was chosen
- Non-obvious constraints or requirements
- Important conversations or decisions from meetings
- Workarounds and their reasons
- Dependency choices and trade-offs

## Workflow

1. **Search first**: Use \`chronicle_search\` to check if this knowledge already exists
2. **Capture the item**: Use \`chronicle_write\` with the appropriate type:
   - \`decision\` — for architectural/design decisions
   - \`knowledge\` — for general project knowledge
   - \`context\` — for situational context
   - \`note\` — for quick observations
3. **Link entities**: Add entities and relations to build the knowledge graph
4. **Verify**: Search again to confirm the item was stored correctly

## Decision Record Format

When capturing decisions, use this structure:

\`\`\`
## Decision: [Title]

**Status**: accepted | proposed | superseded
**Date**: YYYY-MM-DD
**Context**: What is the situation that requires a decision?
**Decision**: What was decided?
**Rationale**: Why was this chosen over alternatives?
**Alternatives considered**: What else was evaluated?
**Consequences**: What are the implications?
\`\`\`

## Entity Types

- \`file\` — source files involved in the decision
- \`function\` — specific functions or APIs
- \`decision\` — the decision itself
- \`person\` — who made or influenced the decision
- \`issue\` — related issues or tickets
- \`concept\` — abstract concepts (e.g., "auth", "caching")
`,
  },
  {
    name: "cost-report",
    filename: "cost-report.md",
    description: "Generate LLM usage and cost reports",
    content: `---
userInvocable: true
allowedTools:
  - shell_execute
  - file_read
  - file_list
model: claude-sonnet-5
---

# Cost Report

Generate reports on LLM token usage and costs across sessions.

## Workflow

1. **Gather data**: Read cost tracking files from \`~/.llm-collab/costs/sessions.jsonl\`
2. **Analyze**: Aggregate by provider, model, time period
3. **Report**: Format as a clear summary

## Report Sections

### Summary
- Total spend for the period
- Total tokens (input + output)
- Number of sessions

### By Provider
- Anthropic vs OpenAI vs Ollama breakdown
- Cost per provider

### By Model
- Which models are used most
- Cost-per-model ranking
- Token efficiency (output/input ratio)

### Trends
- Daily/weekly spend trend
- Usage patterns (peak hours, heavy days)

### Recommendations
- If budget alerts are approaching threshold
- If cheaper models could handle certain workloads
- If high-cost sessions could benefit from caching

## Output Format

Present as a formatted table for terminal output, or JSON if \`--json\` flag is used.
`,
  },
];

export function getSkillByName(name: string): BundledSkill | undefined {
  return BUNDLED_SKILLS.find((s) => s.name === name);
}

export function searchSkills(query: string): BundledSkill[] {
  const q = query.toLowerCase();
  return BUNDLED_SKILLS.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.content.toLowerCase().includes(q),
  );
}
