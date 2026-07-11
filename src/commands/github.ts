import { Command } from "commander";
import chalk from "chalk";
import { ConfigManager } from "../config/config-manager.js";
import { GitHubService } from "../services/github-service.js";
import { logger } from "../utils/logger.js";
import { audit } from "../hooks/audit-logger.js";

export const githubCommand = new Command("github")
  .description("GitHub operations")
  .addCommand(
    new Command("issues")
      .description("Manage GitHub issues")
      .addCommand(
        new Command("list")
          .description("List issues for a repository")
          .argument("<repo>", "Repository (owner/repo)")
          .option("--state <state>", "Filter by state: open, closed, all", "open")
          .option("--labels <labels>", "Filter by label")
          .option("--limit <n>", "Max results", "20")
          .option("--json", "Output as JSON")
          .action(async (repo, options) => {
            const startTime = Date.now();
            audit.commandStart("github issues list");

            const config = ConfigManager.load().get();
            if (!config.integrations.github) {
              logger.error("GitHub not configured. Run 'llm-collab setup' or set integrations.github.token");
              audit.commandEnd("github issues list", "failure", Date.now() - startTime);
              return;
            }

            const github = new GitHubService(config.integrations.github);
            const issues = await github.listIssues(repo, {
              state: options.state as "open" | "closed" | "all",
              labels: options.labels,
              limit: parseInt(options.limit),
            });

            audit.commandEnd("github issues list", "success", Date.now() - startTime);

            if (options.json) {
              logger.passThrough(JSON.stringify(issues, null, 2));
              return;
            }

            if (issues.length === 0) {
              logger.passThrough(chalk.dim("No issues found."));
              return;
            }

            logger.passThrough(chalk.bold(`Issues for ${repo} (${issues.length}):\n`));
            for (const issue of issues) {
              const stateColor = issue.state === "open" ? chalk.green : chalk.red;
              const labels = issue.labels.length > 0 ? chalk.dim(` [${issue.labels.join(", ")}]`) : "";
              logger.passThrough(`  ${stateColor(`#${issue.number}`)} ${issue.title}${labels}`);
              logger.passThrough(chalk.dim(`    by ${issue.author} · ${formatDate(issue.updated_at)}`));
            }
          }),
      )
      .addCommand(
        new Command("get")
          .description("Get a specific issue")
          .argument("<repo>", "Repository (owner/repo)")
          .argument("<number>", "Issue number")
          .option("--json", "Output as JSON")
          .action(async (repo, number, options) => {
            const startTime = Date.now();
            audit.commandStart("github issues get");

            const config = ConfigManager.load().get();
            if (!config.integrations.github) {
              logger.error("GitHub not configured. Run 'llm-collab setup' or set integrations.github.token");
              audit.commandEnd("github issues get", "failure", Date.now() - startTime);
              return;
            }

            const github = new GitHubService(config.integrations.github);
            const issue = await github.getIssue(repo, parseInt(number));

            audit.commandEnd("github issues get", "success", Date.now() - startTime);

            if (options.json) {
              logger.passThrough(JSON.stringify(issue, null, 2));
              return;
            }

            const stateColor = issue.state === "open" ? chalk.green : chalk.red;
            logger.passThrough(chalk.bold(`#${issue.number} ${issue.title}`));
            logger.passThrough(`  State: ${stateColor(issue.state)}`);
            logger.passThrough(`  Author: ${issue.author}`);
            if (issue.assignees.length > 0) {
              logger.passThrough(`  Assignees: ${issue.assignees.join(", ")}`);
            }
            if (issue.labels.length > 0) {
              logger.passThrough(`  Labels: ${issue.labels.join(", ")}`);
            }
            logger.passThrough(`  Created: ${formatDate(issue.created_at)}`);
            logger.passThrough(`  Updated: ${formatDate(issue.updated_at)}`);
            logger.passThrough(`  Comments: ${issue.comments}`);
            logger.passThrough(`  URL: ${chalk.cyan(issue.url)}`);
            if (issue.body) {
              logger.passThrough(`\n${issue.body}`);
            }
          }),
      )
      .addCommand(
        new Command("search")
          .description("Search issues")
          .argument("<query>", "Search query")
          .option("--repo <repo>", "Filter by repository")
          .option("--state <state>", "Filter by state")
          .option("--labels <labels>", "Filter by label")
          .option("--limit <n>", "Max results", "20")
          .option("--json", "Output as JSON")
          .action(async (query, options) => {
            const startTime = Date.now();
            audit.commandStart("github issues search");

            const config = ConfigManager.load().get();
            if (!config.integrations.github) {
              logger.error("GitHub not configured. Run 'llm-collab setup' or set integrations.github.token");
              audit.commandEnd("github issues search", "failure", Date.now() - startTime);
              return;
            }

            const github = new GitHubService(config.integrations.github);
            const results = await github.searchIssues(query, {
              repo: options.repo,
              state: options.state,
              labels: options.labels,
              limit: parseInt(options.limit),
            });

            audit.commandEnd("github issues search", "success", Date.now() - startTime);

            if (options.json) {
              logger.passThrough(JSON.stringify(results, null, 2));
              return;
            }

            logger.passThrough(chalk.bold(`Search results for "${query}" (${results.total_count} total):\n`));
            if (results.items.length === 0) {
              logger.passThrough(chalk.dim("  No results found."));
              return;
            }
            for (const item of results.items) {
              const stateColor = item.state === "open" ? chalk.green : chalk.red;
              logger.passThrough(`  ${stateColor(`#${item.number}`)} ${item.title}`);
              logger.passThrough(chalk.dim(`    by ${item.author} · ${formatDate(item.updated_at)}`));
            }
          }),
      )
      .addCommand(
        new Command("create")
          .description("Create a new issue")
          .argument("<repo>", "Repository (owner/repo)")
          .argument("<title>", "Issue title")
          .option("--body <body>", "Issue body")
          .option("--labels <labels>", "Comma-separated labels")
          .option("--assignees <assignees>", "Comma-separated assignees")
          .option("--json", "Output as JSON")
          .action(async (repo, title, options) => {
            const startTime = Date.now();
            audit.commandStart("github issues create");

            const config = ConfigManager.load().get();
            if (!config.integrations.github) {
              logger.error("GitHub not configured. Run 'llm-collab setup' or set integrations.github.token");
              audit.commandEnd("github issues create", "failure", Date.now() - startTime);
              return;
            }

            const github = new GitHubService(config.integrations.github);
            const issue = await github.createIssue(repo, title, options.body, {
              labels: options.labels?.split(",").map((l: string) => l.trim()),
              assignees: options.assignees?.split(",").map((a: string) => a.trim()),
            });

            audit.commandEnd("github issues create", "success", Date.now() - startTime);

            if (options.json) {
              logger.passThrough(JSON.stringify(issue, null, 2));
              return;
            }

            logger.passThrough(chalk.green(`Created issue #${issue.number}: ${issue.title}`));
            logger.passThrough(`  URL: ${chalk.cyan(issue.url)}`);
          }),
      ),
  )
  .addCommand(
    new Command("prs")
      .description("Manage GitHub pull requests")
      .addCommand(
        new Command("list")
          .description("List pull requests")
          .argument("<repo>", "Repository (owner/repo)")
          .option("--state <state>", "Filter by state: open, closed, all", "open")
          .option("--limit <n>", "Max results", "20")
          .option("--json", "Output as JSON")
          .action(async (repo, options) => {
            const startTime = Date.now();
            audit.commandStart("github prs list");

            const config = ConfigManager.load().get();
            if (!config.integrations.github) {
              logger.error("GitHub not configured. Run 'llm-collab setup' or set integrations.github.token");
              audit.commandEnd("github prs list", "failure", Date.now() - startTime);
              return;
            }

            const github = new GitHubService(config.integrations.github);
            const prs = await github.listPRs(repo, {
              state: options.state as "open" | "closed" | "all",
              limit: parseInt(options.limit),
            });

            audit.commandEnd("github prs list", "success", Date.now() - startTime);

            if (options.json) {
              logger.passThrough(JSON.stringify(prs, null, 2));
              return;
            }

            if (prs.length === 0) {
              logger.passThrough(chalk.dim("No pull requests found."));
              return;
            }

            logger.passThrough(chalk.bold(`Pull requests for ${repo} (${prs.length}):\n`));
            for (const pr of prs) {
              const stateColor = pr.state === "open" ? chalk.green : chalk.red;
              const draft = pr.draft ? chalk.dim(" (draft)") : "";
              logger.passThrough(`  ${stateColor(`#${pr.number}`)} ${pr.title}${draft}`);
              logger.passThrough(chalk.dim(`    ${pr.head} → ${pr.base} · by ${pr.author} · ${formatDate(pr.updated_at)}`));
            }
          }),
      )
      .addCommand(
        new Command("get")
          .description("Get a specific pull request")
          .argument("<repo>", "Repository (owner/repo)")
          .argument("<number>", "PR number")
          .option("--json", "Output as JSON")
          .action(async (repo, number, options) => {
            const startTime = Date.now();
            audit.commandStart("github prs get");

            const config = ConfigManager.load().get();
            if (!config.integrations.github) {
              logger.error("GitHub not configured. Run 'llm-collab setup' or set integrations.github.token");
              audit.commandEnd("github prs get", "failure", Date.now() - startTime);
              return;
            }

            const github = new GitHubService(config.integrations.github);
            const pr = await github.getPR(repo, parseInt(number));

            audit.commandEnd("github prs get", "success", Date.now() - startTime);

            if (options.json) {
              logger.passThrough(JSON.stringify(pr, null, 2));
              return;
            }

            const stateColor = pr.state === "open" ? chalk.green : chalk.red;
            const draft = pr.draft ? chalk.dim(" (draft)") : "";
            logger.passThrough(chalk.bold(`#${pr.number} ${pr.title}${draft}`));
            logger.passThrough(`  State: ${stateColor(pr.state)}`);
            logger.passThrough(`  Branch: ${pr.head} → ${pr.base}`);
            logger.passThrough(`  Author: ${pr.author}`);
            if (pr.labels.length > 0) {
              logger.passThrough(`  Labels: ${pr.labels.join(", ")}`);
            }
            logger.passThrough(`  Mergeable: ${pr.mergeable === null ? "unknown" : pr.mergeable ? "yes" : "no"}`);
            logger.passThrough(`  Created: ${formatDate(pr.created_at)}`);
            logger.passThrough(`  Updated: ${formatDate(pr.updated_at)}`);
            logger.passThrough(`  URL: ${chalk.cyan(pr.url)}`);
            if (pr.body) {
              logger.passThrough(`\n${pr.body}`);
            }
          }),
      ),
  )
  .addCommand(
    new Command("ci")
      .description("Check CI status")
      .argument("<repo>", "Repository (owner/repo)")
      .argument("<ref>", "Git ref (branch, tag, or SHA)")
      .option("--json", "Output as JSON")
      .action(async (repo, ref, options) => {
        const startTime = Date.now();
        audit.commandStart("github ci");

        const config = ConfigManager.load().get();
        if (!config.integrations.github) {
          logger.error("GitHub not configured. Run 'llm-collab setup' or set integrations.github.token");
          audit.commandEnd("github ci", "failure", Date.now() - startTime);
          return;
        }

        const github = new GitHubService(config.integrations.github);
        const status = await github.getCIStatus(repo, ref);

        audit.commandEnd("github ci", "success", Date.now() - startTime);

        if (options.json) {
          logger.passThrough(JSON.stringify(status, null, 2));
          return;
        }

        const stateColor = status.state === "success" ? chalk.green : status.state === "failure" ? chalk.red : chalk.yellow;
        logger.passThrough(chalk.bold(`CI Status for ${repo}@${ref}: ${stateColor(status.state)}\n`));

        if (status.check_runs.length > 0) {
          logger.passThrough("  Check Runs:");
          for (const check of status.check_runs) {
            const icon = check.conclusion === "success" ? chalk.green("✓") : check.conclusion === "failure" ? chalk.red("✗") : chalk.yellow("●");
            logger.passThrough(`    ${icon} ${check.name} (${check.status}${check.conclusion ? ` / ${check.conclusion}` : ""})`);
          }
        }

        if (status.statuses.length > 0) {
          logger.passThrough("  Statuses:");
          for (const s of status.statuses) {
            const icon = s.state === "success" ? chalk.green("✓") : s.state === "failure" ? chalk.red("✗") : chalk.yellow("●");
            logger.passThrough(`    ${icon} ${s.context}: ${s.description ?? s.state}`);
          }
        }
      }),
  );

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}
