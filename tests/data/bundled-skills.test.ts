import { describe, it, expect } from "vitest";
import { BUNDLED_SKILLS, getSkillByName, searchSkills } from "../../src/data/bundled-skills.js";

describe("BUNDLED_SKILLS", () => {
  it("has three bundled skills", () => {
    expect(BUNDLED_SKILLS).toHaveLength(3);
  });

  it("each skill has required fields", () => {
    for (const skill of BUNDLED_SKILLS) {
      expect(skill.name).toBeTruthy();
      expect(skill.filename).toMatch(/\.md$/);
      expect(skill.description).toBeTruthy();
      expect(skill.content).toContain("---");
    }
  });

  it("skills have YAML frontmatter", () => {
    for (const skill of BUNDLED_SKILLS) {
      expect(skill.content).toMatch(/^---\n/);
      expect(skill.content).toMatch(/\n---\n/);
    }
  });
});

describe("getSkillByName", () => {
  it("finds existing skills", () => {
    const skill = getSkillByName("code-review");
    expect(skill).toBeDefined();
    expect(skill!.name).toBe("code-review");
  });

  it("returns undefined for unknown skills", () => {
    expect(getSkillByName("nonexistent")).toBeUndefined();
  });
});

describe("searchSkills", () => {
  it("finds skills by name", () => {
    const results = searchSkills("review");
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("code-review");
  });

  it("finds skills by description", () => {
    const results = searchSkills("chronicle");
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("chronicle-capture");
  });

  it("finds skills by content", () => {
    const results = searchSkills("budget");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty for no matches", () => {
    expect(searchSkills("zzzznonexistent")).toHaveLength(0);
  });

  it("search is case-insensitive", () => {
    const results = searchSkills("CODE-REVIEW");
    expect(results).toHaveLength(1);
  });
});
