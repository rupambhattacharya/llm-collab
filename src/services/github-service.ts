import { Octokit } from "@octokit/rest";
import { graphql } from "@octokit/graphql";
import { APIError, AuthError } from "../utils/errors.js";
import { audit } from "../hooks/audit-logger.js";

export interface GitHubConfig {
  token: string;
  org?: string;
}

export interface IssueResult {
  number: number;
  title: string;
  state: string;
  url: string;
  author: string;
  labels: string[];
  assignees: string[];
  created_at: string;
  updated_at: string;
  body: string | null;
  comments: number;
}

export interface PRResult {
  number: number;
  title: string;
  state: string;
  url: string;
  author: string;
  head: string;
  base: string;
  draft: boolean;
  mergeable: boolean | null;
  labels: string[];
  created_at: string;
  updated_at: string;
  body: string | null;
}

export interface RepoResult {
  full_name: string;
  description: string | null;
  url: string;
  stars: number;
  language: string | null;
  updated_at: string;
}

export interface SearchResult {
  total_count: number;
  items: IssueResult[];
}

export interface CIStatus {
  state: string;
  statuses: Array<{
    context: string;
    state: string;
    description: string | null;
    target_url: string | null;
  }>;
  check_runs: Array<{
    name: string;
    status: string;
    conclusion: string | null;
    url: string | null;
  }>;
}

export class GitHubService {
  private octokit: Octokit;
  private graphqlClient: typeof graphql;
  private defaultOrg?: string;

  constructor(config: GitHubConfig) {
    if (!config.token) {
      throw new AuthError(
        "GitHub token not configured",
        "Run 'llm-collab setup' or 'llm-collab config set integrations.github.token <token>'",
      );
    }

    this.octokit = new Octokit({ auth: config.token });
    this.graphqlClient = graphql.defaults({
      headers: { authorization: `token ${config.token}` },
    });
    this.defaultOrg = config.org;
  }

  private parseRepo(repo: string): { owner: string; repo: string } {
    const parts = repo.split("/");
    if (parts.length === 2) {
      return { owner: parts[0]!, repo: parts[1]! };
    }
    if (parts.length === 1 && this.defaultOrg) {
      return { owner: this.defaultOrg, repo: parts[0]! };
    }
    throw new APIError(
      `Invalid repo format: "${repo}". Expected "owner/repo"`,
      undefined,
      this.defaultOrg ? undefined : "Set a default org: llm-collab config set integrations.github.org <org>",
    );
  }

  async getIssue(repo: string, issueNumber: number): Promise<IssueResult> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    audit.toolCall("github.getIssue", { repo, issueNumber });
    const startTime = Date.now();

    try {
      const { data } = await this.octokit.issues.get({
        owner,
        repo: repoName,
        issue_number: issueNumber,
      });

      audit.toolCall("github.getIssue", { repo, issueNumber }, "success", Date.now() - startTime);

      return {
        number: data.number,
        title: data.title,
        state: data.state,
        url: data.html_url,
        author: data.user?.login ?? "unknown",
        labels: data.labels.map((l) => (typeof l === "string" ? l : l.name ?? "")),
        assignees: data.assignees?.map((a) => a.login) ?? [],
        created_at: data.created_at,
        updated_at: data.updated_at,
        body: data.body ?? null,
        comments: data.comments,
      };
    } catch (err) {
      audit.toolCall("github.getIssue", { repo, issueNumber }, "failure", Date.now() - startTime);
      throw this.wrapError(err, `Failed to get issue #${issueNumber} from ${repo}`);
    }
  }

  async searchIssues(
    query: string,
    options: { repo?: string; state?: string; labels?: string; limit?: number } = {},
  ): Promise<SearchResult> {
    const startTime = Date.now();
    audit.toolCall("github.searchIssues", { query, ...options });

    let q = query;
    if (options.repo) q += ` repo:${options.repo}`;
    if (options.state) q += ` state:${options.state}`;
    if (options.labels) q += ` label:${options.labels}`;

    try {
      const { data } = await this.octokit.search.issuesAndPullRequests({
        q,
        per_page: options.limit ?? 20,
        sort: "updated",
        order: "desc",
      });

      audit.toolCall("github.searchIssues", { query, totalCount: data.total_count }, "success", Date.now() - startTime);

      return {
        total_count: data.total_count,
        items: data.items.map((item) => ({
          number: item.number,
          title: item.title,
          state: item.state,
          url: item.html_url,
          author: item.user?.login ?? "unknown",
          labels: item.labels.map((l) => (typeof l === "string" ? l : l.name ?? "")),
          assignees: item.assignees?.map((a) => a.login) ?? [],
          created_at: item.created_at,
          updated_at: item.updated_at,
          body: item.body ?? null,
          comments: item.comments,
        })),
      };
    } catch (err) {
      audit.toolCall("github.searchIssues", { query }, "failure", Date.now() - startTime);
      throw this.wrapError(err, `Failed to search issues: "${query}"`);
    }
  }

  async listIssues(
    repo: string,
    options: { state?: "open" | "closed" | "all"; labels?: string; limit?: number } = {},
  ): Promise<IssueResult[]> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    const startTime = Date.now();
    audit.toolCall("github.listIssues", { repo, ...options });

    try {
      const { data } = await this.octokit.issues.listForRepo({
        owner,
        repo: repoName,
        state: options.state ?? "open",
        labels: options.labels,
        per_page: options.limit ?? 20,
        sort: "updated",
        direction: "desc",
      });

      audit.toolCall("github.listIssues", { repo, count: data.length }, "success", Date.now() - startTime);

      return data
        .filter((item) => !item.pull_request)
        .map((item) => ({
          number: item.number,
          title: item.title,
          state: item.state,
          url: item.html_url,
          author: item.user?.login ?? "unknown",
          labels: item.labels.map((l) => (typeof l === "string" ? l : l.name ?? "")),
          assignees: item.assignees?.map((a) => a.login) ?? [],
          created_at: item.created_at,
          updated_at: item.updated_at,
          body: item.body ?? null,
          comments: item.comments,
        }));
    } catch (err) {
      audit.toolCall("github.listIssues", { repo }, "failure", Date.now() - startTime);
      throw this.wrapError(err, `Failed to list issues for ${repo}`);
    }
  }

  async createIssue(
    repo: string,
    title: string,
    body?: string,
    options: { labels?: string[]; assignees?: string[] } = {},
  ): Promise<IssueResult> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    const startTime = Date.now();
    audit.toolCall("github.createIssue", { repo, title });

    try {
      const { data } = await this.octokit.issues.create({
        owner,
        repo: repoName,
        title,
        body,
        labels: options.labels,
        assignees: options.assignees,
      });

      audit.toolCall("github.createIssue", { repo, number: data.number }, "success", Date.now() - startTime);

      return {
        number: data.number,
        title: data.title,
        state: data.state,
        url: data.html_url,
        author: data.user?.login ?? "unknown",
        labels: data.labels.map((l) => (typeof l === "string" ? l : l.name ?? "")),
        assignees: data.assignees?.map((a) => a.login) ?? [],
        created_at: data.created_at,
        updated_at: data.updated_at,
        body: data.body ?? null,
        comments: data.comments,
      };
    } catch (err) {
      audit.toolCall("github.createIssue", { repo, title }, "failure", Date.now() - startTime);
      throw this.wrapError(err, `Failed to create issue in ${repo}`);
    }
  }

  async getPR(repo: string, prNumber: number): Promise<PRResult> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    const startTime = Date.now();
    audit.toolCall("github.getPR", { repo, prNumber });

    try {
      const { data } = await this.octokit.pulls.get({
        owner,
        repo: repoName,
        pull_number: prNumber,
      });

      audit.toolCall("github.getPR", { repo, prNumber }, "success", Date.now() - startTime);

      return {
        number: data.number,
        title: data.title,
        state: data.state,
        url: data.html_url,
        author: data.user?.login ?? "unknown",
        head: data.head.ref,
        base: data.base.ref,
        draft: data.draft ?? false,
        mergeable: data.mergeable,
        labels: data.labels.map((l) => l.name ?? ""),
        created_at: data.created_at,
        updated_at: data.updated_at,
        body: data.body ?? null,
      };
    } catch (err) {
      audit.toolCall("github.getPR", { repo, prNumber }, "failure", Date.now() - startTime);
      throw this.wrapError(err, `Failed to get PR #${prNumber} from ${repo}`);
    }
  }

  async listPRs(
    repo: string,
    options: { state?: "open" | "closed" | "all"; limit?: number } = {},
  ): Promise<PRResult[]> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    const startTime = Date.now();
    audit.toolCall("github.listPRs", { repo, ...options });

    try {
      const { data } = await this.octokit.pulls.list({
        owner,
        repo: repoName,
        state: options.state ?? "open",
        per_page: options.limit ?? 20,
        sort: "updated",
        direction: "desc",
      });

      audit.toolCall("github.listPRs", { repo, count: data.length }, "success", Date.now() - startTime);

      return data.map((item) => ({
        number: item.number,
        title: item.title,
        state: item.state,
        url: item.html_url,
        author: item.user?.login ?? "unknown",
        head: item.head.ref,
        base: item.base.ref,
        draft: item.draft ?? false,
        mergeable: null,
        labels: item.labels.map((l) => l.name ?? ""),
        created_at: item.created_at,
        updated_at: item.updated_at,
        body: item.body ?? null,
      }));
    } catch (err) {
      audit.toolCall("github.listPRs", { repo }, "failure", Date.now() - startTime);
      throw this.wrapError(err, `Failed to list PRs for ${repo}`);
    }
  }

  async createPR(
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string,
    options: { draft?: boolean } = {},
  ): Promise<PRResult> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    const startTime = Date.now();
    audit.toolCall("github.createPR", { repo, title, head, base });

    try {
      const { data } = await this.octokit.pulls.create({
        owner,
        repo: repoName,
        title,
        body,
        head,
        base,
        draft: options.draft,
      });

      audit.toolCall("github.createPR", { repo, number: data.number }, "success", Date.now() - startTime);

      return {
        number: data.number,
        title: data.title,
        state: data.state,
        url: data.html_url,
        author: data.user?.login ?? "unknown",
        head: data.head.ref,
        base: data.base.ref,
        draft: data.draft ?? false,
        mergeable: data.mergeable,
        labels: data.labels.map((l) => l.name ?? ""),
        created_at: data.created_at,
        updated_at: data.updated_at,
        body: data.body ?? null,
      };
    } catch (err) {
      audit.toolCall("github.createPR", { repo, title }, "failure", Date.now() - startTime);
      throw this.wrapError(err, `Failed to create PR in ${repo}`);
    }
  }

  async getCIStatus(repo: string, ref: string): Promise<CIStatus> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    const startTime = Date.now();
    audit.toolCall("github.getCIStatus", { repo, ref });

    try {
      const [statusResult, checksResult] = await Promise.all([
        this.octokit.repos.getCombinedStatusForRef({ owner, repo: repoName, ref }),
        this.octokit.checks.listForRef({ owner, repo: repoName, ref }).catch(() => null),
      ]);

      audit.toolCall("github.getCIStatus", { repo, ref }, "success", Date.now() - startTime);

      return {
        state: statusResult.data.state,
        statuses: statusResult.data.statuses.map((s) => ({
          context: s.context,
          state: s.state,
          description: s.description,
          target_url: s.target_url,
        })),
        check_runs: checksResult?.data.check_runs.map((c) => ({
          name: c.name,
          status: c.status,
          conclusion: c.conclusion,
          url: c.html_url,
        })) ?? [],
      };
    } catch (err) {
      audit.toolCall("github.getCIStatus", { repo, ref }, "failure", Date.now() - startTime);
      throw this.wrapError(err, `Failed to get CI status for ${repo}@${ref}`);
    }
  }

  async getRepo(repo: string): Promise<RepoResult> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    const startTime = Date.now();
    audit.toolCall("github.getRepo", { repo });

    try {
      const { data } = await this.octokit.repos.get({ owner, repo: repoName });
      audit.toolCall("github.getRepo", { repo }, "success", Date.now() - startTime);

      return {
        full_name: data.full_name,
        description: data.description,
        url: data.html_url,
        stars: data.stargazers_count,
        language: data.language,
        updated_at: data.updated_at ?? data.created_at,
      };
    } catch (err) {
      audit.toolCall("github.getRepo", { repo }, "failure", Date.now() - startTime);
      throw this.wrapError(err, `Failed to get repo ${repo}`);
    }
  }

  async addComment(repo: string, issueNumber: number, body: string): Promise<{ id: number; url: string }> {
    const { owner, repo: repoName } = this.parseRepo(repo);
    const startTime = Date.now();
    audit.toolCall("github.addComment", { repo, issueNumber });

    try {
      const { data } = await this.octokit.issues.createComment({
        owner,
        repo: repoName,
        issue_number: issueNumber,
        body,
      });

      audit.toolCall("github.addComment", { repo, issueNumber }, "success", Date.now() - startTime);
      return { id: data.id, url: data.html_url };
    } catch (err) {
      audit.toolCall("github.addComment", { repo, issueNumber }, "failure", Date.now() - startTime);
      throw this.wrapError(err, `Failed to add comment to #${issueNumber} in ${repo}`);
    }
  }

  private wrapError(err: unknown, context: string): APIError {
    if (err instanceof APIError) return err;
    const status = (err as { status?: number }).status;
    const message = err instanceof Error ? err.message : String(err);

    if (status === 401 || status === 403) {
      return new APIError(`${context}: Authentication failed`, status, "Check your GitHub token: llm-collab config set integrations.github.token <token>");
    }
    if (status === 404) {
      return new APIError(`${context}: Not found`, status, "Check the repository name and issue/PR number");
    }
    if (status === 422) {
      return new APIError(`${context}: Validation failed — ${message}`, status);
    }
    return new APIError(`${context}: ${message}`, status);
  }
}
