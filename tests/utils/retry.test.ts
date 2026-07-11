import { describe, it, expect } from "vitest";
import { withRetry, AbortError, CircuitBreaker } from "../../src/utils/retry.js";

describe("withRetry", () => {
  it("succeeds on first attempt", async () => {
    const result = await withRetry(async () => "ok");
    expect(result).toBe("ok");
  });

  it("retries on transient failure", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error("transient");
        return "recovered";
      },
      { retries: 3, minTimeout: 50 },
    );
    expect(result).toBe("recovered");
    expect(attempts).toBe(3);
  });

  it("stops on AbortError", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new AbortError("permanent");
        },
        { retries: 5, minTimeout: 50 },
      ),
    ).rejects.toThrow("permanent");
    expect(attempts).toBe(1);
  });

  it("fails after exhausting retries", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error("always fails");
        },
        { retries: 2, minTimeout: 50 },
      ),
    ).rejects.toThrow("always fails");
    expect(attempts).toBe(3);
  });
});

describe("CircuitBreaker", () => {
  it("starts closed", () => {
    const cb = new CircuitBreaker({ threshold: 3, resetTimeoutMs: 100 });
    expect(cb.getState()).toBe("closed");
  });

  it("opens after threshold failures", async () => {
    const cb = new CircuitBreaker({ threshold: 2, resetTimeoutMs: 100 });
    await cb.execute(async () => { throw new Error("f1"); }).catch(() => {});
    expect(cb.getState()).toBe("closed");
    await cb.execute(async () => { throw new Error("f2"); }).catch(() => {});
    expect(cb.getState()).toBe("open");
  });

  it("rejects when open", async () => {
    const cb = new CircuitBreaker({ threshold: 1, resetTimeoutMs: 5000 });
    await cb.execute(async () => { throw new Error("fail"); }).catch(() => {});
    await expect(cb.execute(async () => "ok")).rejects.toThrow("Circuit breaker is open");
  });

  it("transitions to half-open after reset timeout", async () => {
    const cb = new CircuitBreaker({ threshold: 1, resetTimeoutMs: 50 });
    await cb.execute(async () => { throw new Error("fail"); }).catch(() => {});
    expect(cb.getState()).toBe("open");
    await new Promise((r) => setTimeout(r, 60));
    const result = await cb.execute(async () => "recovered");
    expect(result).toBe("recovered");
    expect(cb.getState()).toBe("closed");
  });

  it("resets state", () => {
    const cb = new CircuitBreaker({ threshold: 1, resetTimeoutMs: 100 });
    cb.execute(async () => { throw new Error("fail"); }).catch(() => {});
    cb.reset();
    expect(cb.getState()).toBe("closed");
  });
});
