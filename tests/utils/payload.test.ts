import { describe, it, expect } from "vitest";
import { cleanPayload, summarizePayload } from "../../src/utils/payload.js";

describe("cleanPayload", () => {
  it("passes through small objects unchanged", () => {
    const data = { id: 1, name: "test" };
    expect(cleanPayload(data)).toEqual(data);
  });

  it("truncates arrays", () => {
    const data = { items: Array.from({ length: 100 }, (_, i) => i) };
    const cleaned = cleanPayload(data, { maxArrayItems: 5 }) as { items: unknown[] };
    expect(cleaned.items).toHaveLength(6);
    expect(cleaned.items[5]).toBe("[... 95 more items]");
  });

  it("strips specified fields", () => {
    const data = { id: 1, _links: { self: "/api" }, name: "test" };
    const cleaned = cleanPayload(data, { stripFields: ["_links"] }) as Record<string, unknown>;
    expect(cleaned).toEqual({ id: 1, name: "test" });
  });

  it("limits depth", () => {
    const data = { a: { b: { c: { d: "deep" } } } };
    const cleaned = cleanPayload(data, { maxDepth: 2 }) as Record<string, unknown>;
    expect((cleaned.a as Record<string, unknown>).b).toEqual({
      c: "[truncated: max depth exceeded]",
    });
  });

  it("handles null and undefined", () => {
    expect(cleanPayload(null)).toBeNull();
    expect(cleanPayload(undefined)).toBeUndefined();
  });

  it("handles primitives", () => {
    expect(cleanPayload(42)).toBe(42);
    expect(cleanPayload(true)).toBe(true);
    expect(cleanPayload("hello")).toBe("hello");
  });
});

describe("summarizePayload", () => {
  it("summarizes arrays", () => {
    expect(summarizePayload([1, 2, 3])).toBe("[Array(3)]");
  });

  it("summarizes objects with few keys", () => {
    expect(summarizePayload({ id: 1, name: "test" })).toBe("{id, name}");
  });

  it("truncates objects with many keys", () => {
    const obj = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 };
    expect(summarizePayload(obj)).toBe("{a, b, c, d, e, ... +2}");
  });

  it("truncates long strings", () => {
    const long = "x".repeat(200);
    const result = summarizePayload(long);
    expect(result.length).toBeLessThanOrEqual(103);
    expect(result).toContain("...");
  });

  it("handles null/undefined", () => {
    expect(summarizePayload(null)).toBe("null");
    expect(summarizePayload(undefined)).toBe("undefined");
  });
});
