import { Command } from "commander";
import chalk from "chalk";
import { ConfigManager } from "../config/config-manager.js";
import { LinearService } from "../services/linear-service.js";
import { logger } from "../utils/logger.js";
import { audit } from "../hooks/audit-logger.js";

export const linearCommand = new Command("linear")
  .description("Linear operations")
  .addCommand(
    new Command("issues")
      .description("Manage Linear issues")
      .addCommand(
        new Command("list")
          .description("List issues")
          .option("--team <key>", "Filter by team key (e.g. ENG)")
          .option("--state <state>", "Filter by state name (e.g. 'In Progress')")
          .option("--limit <n>", "Max results", "20")
          .option("--json", "Output as JSON")
          .action(async (options) => {
            const startTime = Date.now();
            audit.commandStart("linear issues list");

            const config = ConfigManager.load().get();
            if (!config.integrations.linear) {
              logger.error("Linear not configured. Run 'llm-collab setup' or set integrations.linear.api_key");
              audit.commandEnd("linear issues list", "failure", Date.now() - startTime);
              return;
            }

            const linear = new LinearService(config.integrations.linear);
            const issues = await linear.listIssues({
              team: options.team,
              state: options.state,
              limit: parseInt(options.limit),
            });

            audit.commandEnd("linear issues list", "success", Date.now() - startTime);

            if (options.json) {
              logger.passThrough(JSON.stringify(issues, null, 2));
              return;
            }

            if (issues.length === 0) {
              logger.passThrough(chalk.dim("No issues found."));
              return;
            }

            logger.passThrough(chalk.bold(`Linear Issues (${issues.length}):\n`));
            for (const issue of issues) {
              const priorityColor = getPriorityColor(issue.priority);
              logger.passThrough(`  ${chalk.cyan(issue.identifier)} ${issue.title}`);
              logger.passThrough(chalk.dim(`    ${issue.state} · ${priorityColor(issue.priorityLabel)}${issue.assignee ? ` · ${issue.assignee}` : ""}`));
            }
          }),
      )
      .addCommand(
        new Command("get")
          .description("Get a specific issue")
          .argument("<id>", "Issue ID or identifier (e.g. ENG-123)")
          .option("--json", "Output as JSON")
          .action(async (id, options) => {
            const startTime = Date.now();
            audit.commandStart("linear issues get");

            const config = ConfigManager.load().get();
            if (!config.integrations.linear) {
              logger.error("Linear not configured. Run 'llm-collab setup' or set integrations.linear.api_key");
              audit.commandEnd("linear issues get", "failure", Date.now() - startTime);
              return;
            }

            const linear = new LinearService(config.integrations.linear);
            const issue = await linear.getIssue(id);

            audit.commandEnd("linear issues get", "success", Date.now() - startTime);

            if (options.json) {
              logger.passThrough(JSON.stringify(issue, null, 2));
              return;
            }

            const priorityColor = getPriorityColor(issue.priority);
            logger.passThrough(chalk.bold(`${issue.identifier} ${issue.title}`));
            logger.passThrough(`  State: ${issue.state}`);
            logger.passThrough(`  Priority: ${priorityColor(issue.priorityLabel)}`);
            if (issue.assignee) logger.passThrough(`  Assignee: ${issue.assignee}`);
            if (issue.project) logger.passThrough(`  Project: ${issue.project}`);
            if (issue.labels.length > 0) logger.passThrough(`  Labels: ${issue.labels.join(", ")}`);
            logger.passThrough(`  Created: ${formatDate(issue.created_at)}`);
            logger.passThrough(`  Updated: ${formatDate(issue.updated_at)}`);
            logger.passThrough(`  URL: ${chalk.cyan(issue.url)}`);
            if (issue.description) {
              logger.passThrough(`\n${issue.description}`);
            }
          }),
      )
      .addCommand(
        new Command("search")
          .description("Search issues")
          .argument("<query>", "Search query")
          .option("--limit <n>", "Max results", "20")
          .option("--json", "Output as JSON")
          .action(async (query, options) => {
            const startTime = Date.now();
            audit.commandStart("linear issues search");

            const config = ConfigManager.load().get();
            if (!config.integrations.linear) {
              logger.error("Linear not configured. Run 'llm-collab setup' or set integrations.linear.api_key");
              audit.commandEnd("linear issues search", "failure", Date.now() - startTime);
              return;
            }

            const linear = new LinearService(config.integrations.linear);
            const results = await linear.searchIssues(query, { limit: parseInt(options.limit) });

            audit.commandEnd("linear issues search", "success", Date.now() - startTime);

            if (options.json) {
              logger.passThrough(JSON.stringify(results, null, 2));
              return;
            }

            logger.passThrough(chalk.bold(`Search results for "${query}" (${results.total_count}):\n`));
            if (results.items.length === 0) {
              logger.passThrough(chalk.dim("  No results found."));
              return;
            }
            for (const issue of results.items) {
              logger.passThrough(`  ${chalk.cyan(issue.identifier)} ${issue.title}`);
              logger.passThrough(chalk.dim(`    ${issue.state} · ${issue.priorityLabel}`));
            }
          }),
      )
      .addCommand(
        new Command("create")
          .description("Create a new issue")
          .argument("<team-id>", "Team ID")
          .argument("<title>", "Issue title")
          .option("--description <desc>", "Issue description")
          .option("--priority <n>", "Priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low")
          .option("--json", "Output as JSON")
          .action(async (teamId, title, options) => {
            const startTime = Date.now();
            audit.commandStart("linear issues create");

            const config = ConfigManager.load().get();
            if (!config.integrations.linear) {
              logger.error("Linear not configured. Run 'llm-collab setup' or set integrations.linear.api_key");
              audit.commandEnd("linear issues create", "failure", Date.now() - startTime);
              return;
            }

            const linear = new LinearService(config.integrations.linear);
            const issue = await linear.createIssue(teamId, title, {
              description: options.description,
              priority: options.priority ? parseInt(options.priority) : undefined,
            });

            audit.commandEnd("linear issues create", "success", Date.now() - startTime);

            if (options.json) {
              logger.passThrough(JSON.stringify(issue, null, 2));
              return;
            }

            logger.passThrough(chalk.green(`Created issue ${issue.identifier}: ${issue.title}`));
            logger.passThrough(`  URL: ${chalk.cyan(issue.url)}`);
          }),
      ),
  )
  .addCommand(
    new Command("teams")
      .description("List Linear teams")
      .option("--json", "Output as JSON")
      .action(async (options) => {
        const startTime = Date.now();
        audit.commandStart("linear teams");

        const config = ConfigManager.load().get();
        if (!config.integrations.linear) {
          logger.error("Linear not configured. Run 'llm-collab setup' or set integrations.linear.api_key");
          audit.commandEnd("linear teams", "failure", Date.now() - startTime);
          return;
        }

        const linear = new LinearService(config.integrations.linear);
        const teams = await linear.listTeams();

        audit.commandEnd("linear teams", "success", Date.now() - startTime);

        if (options.json) {
          logger.passThrough(JSON.stringify(teams, null, 2));
          return;
        }

        if (teams.length === 0) {
          logger.passThrough(chalk.dim("No teams found."));
          return;
        }

        logger.passThrough(chalk.bold(`Teams (${teams.length}):\n`));
        for (const team of teams) {
          logger.passThrough(`  ${chalk.cyan(team.key)} ${team.name}`);
          if (team.description) logger.passThrough(chalk.dim(`    ${team.description}`));
        }
      }),
  )
  .addCommand(
    new Command("projects")
      .description("List Linear projects")
      .option("--limit <n>", "Max results", "20")
      .option("--json", "Output as JSON")
      .action(async (options) => {
        const startTime = Date.now();
        audit.commandStart("linear projects");

        const config = ConfigManager.load().get();
        if (!config.integrations.linear) {
          logger.error("Linear not configured. Run 'llm-collab setup' or set integrations.linear.api_key");
          audit.commandEnd("linear projects", "failure", Date.now() - startTime);
          return;
        }

        const linear = new LinearService(config.integrations.linear);
        const projects = await linear.listProjects({ limit: parseInt(options.limit) });

        audit.commandEnd("linear projects", "success", Date.now() - startTime);

        if (options.json) {
          logger.passThrough(JSON.stringify(projects, null, 2));
          return;
        }

        if (projects.length === 0) {
          logger.passThrough(chalk.dim("No projects found."));
          return;
        }

        logger.passThrough(chalk.bold(`Projects (${projects.length}):\n`));
        for (const project of projects) {
          const progress = Math.round(project.progress * 100);
          logger.passThrough(`  ${project.name} ${chalk.dim(`(${project.state})`)} — ${progress}%`);
          if (project.description) logger.passThrough(chalk.dim(`    ${project.description}`));
          if (project.targetDate) logger.passThrough(chalk.dim(`    Target: ${project.targetDate}`));
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

function getPriorityColor(priority: number): (text: string) => string {
  switch (priority) {
    case 1: return chalk.red;
    case 2: return chalk.yellow;
    case 3: return chalk.blue;
    case 4: return chalk.dim;
    default: return chalk.white;
  }
}
