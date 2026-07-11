import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import chalk from "chalk";
import { BUNDLED_SKILLS, getSkillByName, searchSkills } from "../data/bundled-skills.js";
import { logger } from "../utils/logger.js";
import { audit } from "../hooks/audit-logger.js";

const SKILLS_DIR = path.join(os.homedir(), ".claude", "skills");

function ensureSkillsDir(): void {
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }
}

function getInstalledSkills(): string[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

function installSkill(name: string, force: boolean): "installed" | "skipped" | "not_found" {
  const skill = getSkillByName(name);
  if (!skill) return "not_found";

  ensureSkillsDir();
  const filePath = path.join(SKILLS_DIR, skill.filename);

  if (fs.existsSync(filePath) && !force) {
    return "skipped";
  }

  fs.writeFileSync(filePath, skill.content, "utf-8");
  return "installed";
}

function installAllSkills(force: boolean): { installed: string[]; skipped: string[] } {
  ensureSkillsDir();
  const installed: string[] = [];
  const skipped: string[] = [];

  for (const skill of BUNDLED_SKILLS) {
    const filePath = path.join(SKILLS_DIR, skill.filename);
    if (fs.existsSync(filePath) && !force) {
      skipped.push(skill.name);
      continue;
    }
    fs.writeFileSync(filePath, skill.content, "utf-8");
    installed.push(skill.name);
  }

  return { installed, skipped };
}

export const skillsCommand = new Command("skills")
  .description("Manage agent skills")
  .addCommand(
    new Command("list")
      .description("List available and installed skills")
      .option("--json", "Output as JSON")
      .action(async (options) => {
        const startTime = Date.now();
        audit.commandStart("skills list");

        const installed = getInstalledSkills();
        const installedSet = new Set(installed);

        if (options.json) {
          logger.passThrough(
            JSON.stringify(
              {
                bundled: BUNDLED_SKILLS.map((s) => ({
                  name: s.name,
                  description: s.description,
                  installed: installedSet.has(s.name),
                })),
                installed,
                skills_dir: SKILLS_DIR,
              },
              null,
              2,
            ),
          );
          audit.commandEnd("skills list", "success", Date.now() - startTime);
          return;
        }

        logger.passThrough(chalk.bold("Bundled Skills:\n"));
        for (const skill of BUNDLED_SKILLS) {
          const status = installedSet.has(skill.name)
            ? chalk.green("installed")
            : chalk.yellow("not installed");
          logger.passThrough(`  ${chalk.cyan(skill.name)} [${status}]`);
          logger.passThrough(chalk.dim(`    ${skill.description}`));
        }

        const customSkills = installed.filter(
          (name) => !BUNDLED_SKILLS.some((s) => s.name === name),
        );
        if (customSkills.length > 0) {
          logger.passThrough(chalk.bold("\nCustom Skills:\n"));
          for (const name of customSkills) {
            logger.passThrough(`  ${chalk.cyan(name)}`);
          }
        }

        logger.passThrough("");
        logger.passThrough(chalk.dim(`Skills directory: ${SKILLS_DIR}`));

        audit.commandEnd("skills list", "success", Date.now() - startTime);
      }),
  )
  .addCommand(
    new Command("install")
      .argument("[name]", "Skill name (omit to install all bundled skills)")
      .option("--force", "Overwrite existing skill files")
      .description("Install a bundled skill")
      .action(async (name?: string, options?: { force?: boolean }) => {
        const startTime = Date.now();
        const force = options?.force ?? false;
        audit.commandStart("skills install", { name, force });

        if (name) {
          const result = installSkill(name, force);
          if (result === "not_found") {
            logger.error(`Unknown skill: ${name}`);
            logger.info(
              chalk.dim(
                `Available: ${BUNDLED_SKILLS.map((s) => s.name).join(", ")}`,
              ),
            );
            audit.commandEnd("skills install", "failure", Date.now() - startTime, "not found");
            return;
          }
          if (result === "skipped") {
            logger.passThrough(
              chalk.dim(
                `Skill '${name}' already installed. Use --force to overwrite.`,
              ),
            );
            audit.commandEnd("skills install", "success", Date.now() - startTime, "skipped");
            return;
          }
          logger.passThrough(chalk.green(`Installed skill: ${name}`));
          logger.passThrough(chalk.dim(`  ${path.join(SKILLS_DIR, name + ".md")}`));
          audit.commandEnd("skills install", "success", Date.now() - startTime);
        } else {
          const result = installAllSkills(force);

          if (result.installed.length > 0) {
            logger.passThrough(
              chalk.green(`Installed ${result.installed.length} skill(s):`),
            );
            for (const s of result.installed) {
              logger.passThrough(`  ${chalk.cyan(s)}`);
            }
          }
          if (result.skipped.length > 0) {
            logger.passThrough(
              chalk.dim(
                `Skipped ${result.skipped.length} (already exist): ${result.skipped.join(", ")}`,
              ),
            );
          }
          if (result.installed.length === 0 && result.skipped.length > 0) {
            logger.passThrough(
              chalk.dim("All skills already installed. Use --force to overwrite."),
            );
          }

          audit.commandEnd("skills install", "success", Date.now() - startTime);
        }
      }),
  )
  .addCommand(
    new Command("search")
      .argument("<query>", "Search query")
      .description("Search bundled skills by name or content")
      .action(async (query: string) => {
        const startTime = Date.now();
        audit.commandStart("skills search", { query });

        const results = searchSkills(query);
        const installed = new Set(getInstalledSkills());

        if (results.length === 0) {
          logger.passThrough(chalk.dim(`No skills matching '${query}'`));
          audit.commandEnd("skills search", "success", Date.now() - startTime, "0 results");
          return;
        }

        logger.passThrough(chalk.bold(`Found ${results.length} skill(s):\n`));
        for (const skill of results) {
          const status = installed.has(skill.name)
            ? chalk.green("installed")
            : chalk.yellow("not installed");
          logger.passThrough(`  ${chalk.cyan(skill.name)} [${status}]`);
          logger.passThrough(chalk.dim(`    ${skill.description}`));
        }

        audit.commandEnd("skills search", "success", Date.now() - startTime);
      }),
  );
