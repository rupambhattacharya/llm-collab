import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { ConfigManager } from "../../src/config/config-manager.js";

describe("ConfigManager", () => {
  let tmpDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "llm-collab-test-"));
    originalEnv = process.env["LLM_COLLAB_HOME"];
    process.env["LLM_COLLAB_HOME"] = tmpDir;
  });

  afterEach(() => {
    ConfigManager.reset();
    if (originalEnv !== undefined) {
      process.env["LLM_COLLAB_HOME"] = originalEnv;
    } else {
      delete process.env["LLM_COLLAB_HOME"];
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads with defaults when no config file exists", () => {
    const cm = ConfigManager.load();
    const config = cm.get();
    expect(config.ai.default_provider).toBe("anthropic");
    expect(config.ai.default_model).toBe("claude-sonnet-5");
    expect(config.relay.port).toBe(4000);
  });

  it("saves and reloads config", () => {
    const cm = ConfigManager.load();
    const config = cm.get();
    config.relay.port = 5000;
    cm.save(config);

    const cm2 = ConfigManager.load();
    expect(cm2.get().relay.port).toBe(5000);
  });

  it("supports dot-notation get", () => {
    const cm = ConfigManager.load();
    expect(cm.getValue("ai.default_provider")).toBe("anthropic");
    expect(cm.getValue("relay.port")).toBe(4000);
  });

  it("supports dot-notation set", () => {
    const cm = ConfigManager.load();
    cm.setValue("relay.port", 9999);
    expect(cm.getValue("relay.port")).toBe(9999);
  });

  it("returns config file path", () => {
    const cm = ConfigManager.load();
    expect(cm.getPath()).toContain("config.json");
  });

  it("preserves existing config on save", () => {
    const cm = ConfigManager.load();
    const config = cm.get();
    config.ai.providers.anthropic = { api_key: "test-key" };
    cm.save(config);

    const cm2 = ConfigManager.load();
    cm2.setValue("relay.port", 8080);
    expect(cm2.get().ai.providers.anthropic?.api_key).toBe("test-key");
  });
});
