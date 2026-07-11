import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LinearService, type LinearConfig } from "../../services/linear-service.js";

export function registerLinearTools(server: McpServer, config: LinearConfig): void {
  const linear = new LinearService(config);

  server.tool(
    "linear_get_issue",
    "Get a Linear issue by ID or identifier (e.g. ENG-123)",
    {
      issue_id: z.string().describe("Issue ID or identifier (e.g. ENG-123)"),
    },
    async ({ issue_id }) => {
      try {
        const issue = await linear.getIssue(issue_id);
        return { content: [{ type: "text" as const, text: JSON.stringify(issue, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "linear_search_issues",
    "Search Linear issues by text query",
    {
      query: z.string().describe("Search query"),
      limit: z.number().optional().describe("Max results (default 20)"),
    },
    async ({ query, limit }) => {
      try {
        const results = await linear.searchIssues(query, { limit });
        return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "linear_list_issues",
    "List Linear issues with optional filters",
    {
      team: z.string().optional().describe("Filter by team key (e.g. ENG)"),
      state: z.string().optional().describe("Filter by state name (e.g. In Progress)"),
      limit: z.number().optional().describe("Max results (default 20)"),
    },
    async ({ team, state, limit }) => {
      try {
        const issues = await linear.listIssues({ team, state, limit });
        return { content: [{ type: "text" as const, text: JSON.stringify(issues, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "linear_create_issue",
    "Create a new Linear issue",
    {
      team_id: z.string().describe("Team ID to create the issue in"),
      title: z.string().describe("Issue title"),
      description: z.string().optional().describe("Issue description (markdown)"),
      priority: z.number().optional().describe("Priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low"),
      assignee_id: z.string().optional().describe("Assignee user ID"),
    },
    async ({ team_id, title, description, priority, assignee_id }) => {
      try {
        const issue = await linear.createIssue(team_id, title, {
          description,
          priority,
          assigneeId: assignee_id,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(issue, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "linear_update_issue",
    "Update an existing Linear issue",
    {
      issue_id: z.string().describe("Issue ID or identifier"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      state_id: z.string().optional().describe("New state ID"),
      priority: z.number().optional().describe("New priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low"),
      assignee_id: z.string().optional().describe("New assignee user ID"),
    },
    async ({ issue_id, title, description, state_id, priority, assignee_id }) => {
      try {
        const issue = await linear.updateIssue(issue_id, {
          title,
          description,
          stateId: state_id,
          priority,
          assigneeId: assignee_id,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(issue, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "linear_list_teams",
    "List all Linear teams",
    {},
    async () => {
      try {
        const teams = await linear.listTeams();
        return { content: [{ type: "text" as const, text: JSON.stringify(teams, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.tool(
    "linear_list_projects",
    "List Linear projects",
    {
      limit: z.number().optional().describe("Max results (default 20)"),
    },
    async ({ limit }) => {
      try {
        const projects = await linear.listProjects({ limit });
        return { content: [{ type: "text" as const, text: JSON.stringify(projects, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );
}
