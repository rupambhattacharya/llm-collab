import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GitHubService, type GitHubConfig } from "../../services/github-service.js";

export function registerGitHubTools(server: McpServer, config: GitHubConfig): void {
  const github = new GitHubService(config);

  server.tool(
    "github_get_issue",
    "Get a GitHub issue by number",
    {
      repo: z.string().describe("Repository (owner/repo)"),
      issue_number: z.number().describe("Issue number"),
    },
    async ({ repo, issue_number }) => {
      try {
        const issue = await github.getIssue(repo, issue_number);
        return { content: [{ type: "text" as const, text: JSON.stringify(issue, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "github_search_issues",
    "Search GitHub issues and pull requests",
    {
      query: z.string().describe("Search query"),
      repo: z.string().optional().describe("Filter by repository (owner/repo)"),
      state: z.string().optional().describe("Filter by state: open, closed"),
      labels: z.string().optional().describe("Filter by label"),
      limit: z.number().optional().describe("Max results (default 20)"),
    },
    async ({ query, repo, state, labels, limit }) => {
      try {
        const results = await github.searchIssues(query, { repo, state, labels, limit });
        return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "github_list_issues",
    "List issues for a repository",
    {
      repo: z.string().describe("Repository (owner/repo)"),
      state: z.enum(["open", "closed", "all"]).optional().describe("Issue state filter"),
      labels: z.string().optional().describe("Filter by label"),
      limit: z.number().optional().describe("Max results (default 20)"),
    },
    async ({ repo, state, labels, limit }) => {
      try {
        const issues = await github.listIssues(repo, { state, labels, limit });
        return { content: [{ type: "text" as const, text: JSON.stringify(issues, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "github_create_issue",
    "Create a new GitHub issue",
    {
      repo: z.string().describe("Repository (owner/repo)"),
      title: z.string().describe("Issue title"),
      body: z.string().optional().describe("Issue body (markdown)"),
      labels: z.array(z.string()).optional().describe("Labels to apply"),
      assignees: z.array(z.string()).optional().describe("Usernames to assign"),
    },
    async ({ repo, title, body, labels, assignees }) => {
      try {
        const issue = await github.createIssue(repo, title, body, { labels, assignees });
        return { content: [{ type: "text" as const, text: JSON.stringify(issue, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "github_get_pr",
    "Get a GitHub pull request by number",
    {
      repo: z.string().describe("Repository (owner/repo)"),
      pr_number: z.number().describe("Pull request number"),
    },
    async ({ repo, pr_number }) => {
      try {
        const pr = await github.getPR(repo, pr_number);
        return { content: [{ type: "text" as const, text: JSON.stringify(pr, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "github_list_prs",
    "List pull requests for a repository",
    {
      repo: z.string().describe("Repository (owner/repo)"),
      state: z.enum(["open", "closed", "all"]).optional().describe("PR state filter"),
      limit: z.number().optional().describe("Max results (default 20)"),
    },
    async ({ repo, state, limit }) => {
      try {
        const prs = await github.listPRs(repo, { state, limit });
        return { content: [{ type: "text" as const, text: JSON.stringify(prs, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "github_create_pr",
    "Create a new GitHub pull request",
    {
      repo: z.string().describe("Repository (owner/repo)"),
      title: z.string().describe("PR title"),
      head: z.string().describe("Head branch"),
      base: z.string().describe("Base branch"),
      body: z.string().optional().describe("PR body (markdown)"),
      draft: z.boolean().optional().describe("Create as draft PR"),
    },
    async ({ repo, title, head, base, body, draft }) => {
      try {
        const pr = await github.createPR(repo, title, head, base, body, { draft });
        return { content: [{ type: "text" as const, text: JSON.stringify(pr, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "github_ci_status",
    "Get CI/check status for a git ref",
    {
      repo: z.string().describe("Repository (owner/repo)"),
      ref: z.string().describe("Git ref (branch, tag, or SHA)"),
    },
    async ({ repo, ref }) => {
      try {
        const status = await github.getCIStatus(repo, ref);
        return { content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "github_get_repo",
    "Get repository information",
    {
      repo: z.string().describe("Repository (owner/repo)"),
    },
    async ({ repo }) => {
      try {
        const info = await github.getRepo(repo);
        return { content: [{ type: "text" as const, text: JSON.stringify(info, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "github_add_comment",
    "Add a comment to an issue or pull request",
    {
      repo: z.string().describe("Repository (owner/repo)"),
      issue_number: z.number().describe("Issue or PR number"),
      body: z.string().describe("Comment body (markdown)"),
    },
    async ({ repo, issue_number, body }) => {
      try {
        const result = await github.addComment(repo, issue_number, body);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );
}
