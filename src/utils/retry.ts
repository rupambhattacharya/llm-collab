import pRetry, { AbortError } from "p-retry";
import { logger } from "./logger.js";

export interface RetryOptions {
  retries?: number;
  minTimeout?: number;
  maxTimeout?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  retries: 3,
  minTimeout: 1000,
  maxTimeout: 10_000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  return pRetry(fn, {
    retries: opts.retries,
    minTimeout: opts.minTimeout,
    maxTimeout: opts.maxTimeout,
    onFailedAttempt: (error) => {
      logger.debug(
        `Attempt ${error.attemptNumber}/${error.retriesLeft + error.attemptNumber} failed: ${error.message}`,
      );
      opts.onRetry?.(error, error.attemptNumber);
    },
  });
}

export { AbortError };

export interface CircuitBreakerOptions {
  threshold: number;
  resetTimeoutMs: number;
}

type CircuitState = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;
  private threshold: number;
  private resetTimeoutMs: number;

  constructor(options: CircuitBreakerOptions) {
    this.threshold = options.threshold;
    this.resetTimeoutMs = options.resetTimeoutMs;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = "half-open";
        logger.debug("Circuit breaker: half-open, allowing test request");
      } else {
        throw new Error("Circuit breaker is open — service unavailable");
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === "half-open") {
      logger.debug("Circuit breaker: closed (recovered)");
    }
    this.state = "closed";
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.threshold) {
      this.state = "open";
      logger.debug(`Circuit breaker: open after ${this.failureCount} failures`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}
