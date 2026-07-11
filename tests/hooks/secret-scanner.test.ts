import { describe, it, expect } from "vitest";
import { scanForSecrets, handleSecretScan } from "../../src/hooks/secret-scanner.js";

describe("scanForSecrets", () => {
  it("detects AWS access keys", () => {
    const result = scanForSecrets("AKIAIOSFODNN7EXAMPLE");
    expect(result.found).toBe(true);
    expect(result.matches[0]!.pattern).toBe("AWS Access Key");
  });

  it("detects GitHub tokens", () => {
    const result = scanForSecrets("ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh12");
    expect(result.found).toBe(true);
    expect(result.matches[0]!.pattern).toBe("GitHub Token");
  });

  it("detects OpenAI API keys", () => {
    const result = scanForSecrets("sk-1234567890abcdefghijklmnopqrstuvwxyz");
    expect(result.found).toBe(true);
    expect(result.matches[0]!.pattern).toBe("OpenAI API Key");
  });

  it("detects private key headers", () => {
    const result = scanForSecrets("-----BEGIN RSA PRIVATE KEY-----");
    expect(result.found).toBe(true);
    expect(result.matches[0]!.pattern).toBe("Generic Private Key");
  });

  it("detects Slack tokens", () => {
    const result = scanForSecrets("xoxb-1234567890-abcdefghij");
    expect(result.found).toBe(true);
    expect(result.matches[0]!.pattern).toBe("Slack Token");
  });

  it("returns safe for normal text", () => {
    const result = scanForSecrets("This is a normal commit message.");
    expect(result.found).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it("detects multiple secrets on different lines", () => {
    const text = "key=AKIAIOSFODNN7EXAMPLE\ntoken=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh12";
    const result = scanForSecrets(text);
    expect(result.matches.length).toBeGreaterThanOrEqual(2);
  });

  it("masks excerpts in matches", () => {
    const result = scanForSecrets("AKIAIOSFODNN7EXAMPLE");
    expect(result.matches[0]!.excerpt).not.toBe("AKIAIOSFODNN7EXAMPLE");
    expect(result.matches[0]!.excerpt).toContain("****");
  });
});

describe("handleSecretScan", () => {
  it("returns safe for clean text", () => {
    const result = handleSecretScan("hello world");
    expect(result.safe).toBe(true);
    expect(result.text).toBe("hello world");
  });

  it("warns but passes through in warn mode", () => {
    const result = handleSecretScan("key=AKIAIOSFODNN7EXAMPLE", "warn");
    expect(result.safe).toBe(true);
  });

  it("blocks output in block mode", () => {
    const result = handleSecretScan("key=AKIAIOSFODNN7EXAMPLE", "block");
    expect(result.safe).toBe(false);
    expect(result.text).toContain("BLOCKED");
  });
});
