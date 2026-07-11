import { LinearClient } from "@linear/sdk";
import { APIError, AuthError } from "../utils/errors.js";
import { audit } from "../hooks/audit-logger.js";

export interface LinearConfig {
  api_key: string;
}

export interface LinearIssueResult {
  id: string;
  identifier: string;
  title: string;
  state: string;
  priority: number;
  priorityLabel: string;
  url: string;
  assignee: string | null;
  labels: string[];
  project: string | null;
  created_at: string;
  updated_at: string;
  description: string | null;
}

export interface LinearProjectResult {
  id: string;
  name: string;
  state: string;
  url: string;
  description: string | null;
  progress: number;
  startDate: string | null;
  targetDate: string | null;
}

export interface LinearTeamResult {
  id: string;
  name: string;
  key: string;
  description: string | null;
}

export interface LinearSearchResult {
  total_count: number;
  items: LinearIssueResult[];
}

export class LinearService {
  private client: LinearClient;

  constructor(config: LinearConfig) {
    if (!config.api_key) {
      throw new AuthError(
        "Linear API key not configured",
        "Run 'llm-collab setup' or 'llm-collab config set integrations.linear.api_key <key>'",
      );
    }

    this.client = new LinearClient({ apiKey: config.api_key });
  }

  async getIssue(issueId: string): Promise<LinearIssueResult> {
    const startTime = Date.now();
    audit.toolCall("linear.getIssue", { issueId });

    try {
      const issue = await this.client.issue(issueId);
      const state = await issue.state;
      const assignee = await issue.assignee;
      const labels = await issue.labels();
      const project = await issue.project;

      audit.toolCall("linear.getIssue", { issueId }, "success", Date.now() - startTime);

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        state: state?.name ?? "Unknown",
        priority: issue.priority,
        priorityLabel: issue.priorityLabel,
        url: issue.url,
        assignee: assignee?.name ?? null,
        labels: labels.nodes.map((l) => l.name),
        project: project?.name ?? null,
        created_at: issue.createdAt.toISOString(),
        updated_at: issue.updatedAt.toISOString(),
        description: issue.description ?? null,
      };
    } catch (err) {
      audit.toolCall("linear.getIssue", { issueId }, "failure", Date.now() - startTime);
      throw this.wrapError(err, `Failed to get issue ${issueId}`);
    }
  }

  async searchIssues(query: string, options: { limit?: number } = {}): Promise<LinearSearchResult> {
    const startTime = Date.now();
    audit.toolCall("linear.searchIssues", { query });

    try {
      const results = await this.client.searchIssues(query, {
        first: options.limit ?? 20,
      });

      const items: LinearIssueResult[] = [];
      for (const node of results.nodes) {
        const state = await node.state;
        const assignee = await node.assignee;
        const project = await node.project;

        items.push({
          id: node.id,
          identifier: node.identifier,
          title: node.title,
          state: state?.name ?? "Unknown",
          priority: node.priority,
          priorityLabel: node.priorityLabel,
          url: node.url,
          assignee: assignee?.name ?? null,
          labels: [],
          project: project?.name ?? null,
          created_at: node.createdAt.toISOString(),
          updated_at: node.updatedAt.toISOString(),
          description: node.description ?? null,
        });
      }

      audit.toolCall("linear.searchIssues", { query, totalCount: items.length }, "success", Date.now() - startTime);

      return {
        total_count: items.length,
        items,
      };
    } catch (err) {
      audit.toolCall("linear.searchIssues", { query }, "failure", Date.now() - startTime);
      throw this.wrapError(err, `Failed to search issues: "${query}"`);
    }
  }

  async listIssues(options: { team?: string; state?: string; limit?: number } = {}): Promise<LinearIssueResult[]> {
    const startTime = Date.now();
    audit.toolCall("linear.listIssues", { ...options });

    try {
      const filter: Record<string, unknown> = {};
      if (options.team) {
        filter.team = { key: { eq: options.team } };
      }
      if (options.state) {
        filter.state = { name: { eqCaseInsensitive: options.state } };
      }

      const issues = await this.client.issues({
        first: options.limit ?? 20,
        filter,
        orderBy: "updatedAt" as never,
      });

      const items: LinearIssueResult[] = [];
      for (const node of issues.nodes) {
        const state = await node.state;
        const assignee = await node.assignee;
        const labels = await node.labels();
        const project = await node.project;

        items.push({
          id: node.id,
          identifier: node.identifier,
          title: node.title,
          state: state?.name ?? "Unknown",
          priority: node.priority,
          priorityLabel: node.priorityLabel,
          url: node.url,
          assignee: assignee?.name ?? null,
          labels: labels.nodes.map((l) => l.name),
          project: project?.name ?? null,
          created_at: node.createdAt.toISOString(),
          updated_at: node.updatedAt.toISOString(),
          description: node.description ?? null,
        });
      }

      audit.toolCall("linear.listIssues", { count: items.length }, "success", Date.now() - startTime);
      return items;
    } catch (err) {
      audit.toolCall("linear.listIssues", { ...options }, "failure", Date.now() - startTime);
      throw this.wrapError(err, "Failed to list issues");
    }
  }

  async createIssue(
    teamId: string,
    title: string,
    options: { description?: string; priority?: number; labelIds?: string[]; assigneeId?: string } = {},
  ): Promise<LinearIssueResult> {
    const startTime = Date.now();
    audit.toolCall("linear.createIssue", { teamId, title });

    try {
      const result = await this.client.createIssue({
        teamId,
        title,
        description: options.description,
        priority: options.priority,
        labelIds: options.labelIds,
        assigneeId: options.assigneeId,
      });

      const issue = await result.issue;
      if (!issue) {
        throw new APIError("Failed to create issue — no issue returned");
      }

      const state = await issue.state;
      const assignee = await issue.assignee;
      const labels = await issue.labels();
      const project = await issue.project;

      audit.toolCall("linear.createIssue", { teamId, identifier: issue.identifier }, "success", Date.now() - startTime);

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        state: state?.name ?? "Unknown",
        priority: issue.priority,
        priorityLabel: issue.priorityLabel,
        url: issue.url,
        assignee: assignee?.name ?? null,
        labels: labels.nodes.map((l) => l.name),
        project: project?.name ?? null,
        created_at: issue.createdAt.toISOString(),
        updated_at: issue.updatedAt.toISOString(),
        description: issue.description ?? null,
      };
    } catch (err) {
      if (err instanceof APIError) throw err;
      audit.toolCall("linear.createIssue", { teamId, title }, "failure", Date.now() - startTime);
      throw this.wrapError(err, `Failed to create issue in team ${teamId}`);
    }
  }

  async listTeams(): Promise<LinearTeamResult[]> {
    const startTime = Date.now();
    audit.toolCall("linear.listTeams", {});

    try {
      const teams = await this.client.teams();

      audit.toolCall("linear.listTeams", { count: teams.nodes.length }, "success", Date.now() - startTime);

      return teams.nodes.map((t) => ({
        id: t.id,
        name: t.name,
        key: t.key,
        description: t.description ?? null,
      }));
    } catch (err) {
      audit.toolCall("linear.listTeams", {}, "failure", Date.now() - startTime);
      throw this.wrapError(err, "Failed to list teams");
    }
  }

  async listProjects(options: { limit?: number } = {}): Promise<LinearProjectResult[]> {
    const startTime = Date.now();
    audit.toolCall("linear.listProjects", {});

    try {
      const projects = await this.client.projects({
        first: options.limit ?? 20,
      });

      audit.toolCall("linear.listProjects", { count: projects.nodes.length }, "success", Date.now() - startTime);

      return projects.nodes.map((p) => ({
        id: p.id,
        name: p.name,
        state: p.state,
        url: p.url,
        description: p.description ?? null,
        progress: p.progress,
        startDate: p.startDate ?? null,
        targetDate: p.targetDate ?? null,
      }));
    } catch (err) {
      audit.toolCall("linear.listProjects", {}, "failure", Date.now() - startTime);
      throw this.wrapError(err, "Failed to list projects");
    }
  }

  async updateIssue(
    issueId: string,
    updates: { title?: string; description?: string; stateId?: string; priority?: number; assigneeId?: string },
  ): Promise<LinearIssueResult> {
    const startTime = Date.now();
    audit.toolCall("linear.updateIssue", { issueId, ...updates });

    try {
      const result = await this.client.updateIssue(issueId, updates);
      const issue = await result.issue;
      if (!issue) {
        throw new APIError("Failed to update issue — no issue returned");
      }

      const state = await issue.state;
      const assignee = await issue.assignee;
      const labels = await issue.labels();
      const project = await issue.project;

      audit.toolCall("linear.updateIssue", { issueId }, "success", Date.now() - startTime);

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        state: state?.name ?? "Unknown",
        priority: issue.priority,
        priorityLabel: issue.priorityLabel,
        url: issue.url,
        assignee: assignee?.name ?? null,
        labels: labels.nodes.map((l) => l.name),
        project: project?.name ?? null,
        created_at: issue.createdAt.toISOString(),
        updated_at: issue.updatedAt.toISOString(),
        description: issue.description ?? null,
      };
    } catch (err) {
      if (err instanceof APIError) throw err;
      audit.toolCall("linear.updateIssue", { issueId }, "failure", Date.now() - startTime);
      throw this.wrapError(err, `Failed to update issue ${issueId}`);
    }
  }

  private wrapError(err: unknown, context: string): APIError {
    if (err instanceof APIError) return err;
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("Authentication") || message.includes("401") || message.includes("Unauthorized")) {
      return new APIError(`${context}: Authentication failed`, 401, "Check your Linear API key: llm-collab config set integrations.linear.api_key <key>");
    }
    if (message.includes("not found") || message.includes("404")) {
      return new APIError(`${context}: Not found`, 404);
    }
    return new APIError(`${context}: ${message}`);
  }
}
