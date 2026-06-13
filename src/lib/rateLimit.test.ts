import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
  buildRateLimitKey,
  resetRateLimitStoreForTests,
} from "./rateLimit";

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimitStoreForTests();
  });

  it("allows first attempt with no prior failures", () => {
    const result = checkRateLimit("test:user:ip");
    expect(result.blocked).toBe(false);
    expect(result.remainingMs).toBe(0);
  });

  it("records failed attempts and blocks after threshold", () => {
    const key = "login:testuser:127.0.0.1";

    // First 4 attempts should not block
    for (let i = 0; i < 4; i++) {
      const result = recordFailedAttempt(key);
      expect(result.blocked).toBe(false);
    }

    // 5th attempt should block
    const result = recordFailedAttempt(key);
    expect(result.blocked).toBe(true);
    expect(result.remainingMs).toBeGreaterThan(0);
  });

  it("returns blocked status from checkRateLimit when blocked", () => {
    const key = "login:blocked:test";
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(key);
    }

    const result = checkRateLimit(key);
    expect(result.blocked).toBe(true);
    expect(result.remainingMs).toBeGreaterThan(0);
  });

  it("clears rate limit on clearRateLimit", () => {
    const key = "login:clear:test";
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(key);
    }

    expect(checkRateLimit(key).blocked).toBe(true);

    clearRateLimit(key);

    expect(checkRateLimit(key).blocked).toBe(false);
    expect(checkRateLimit(key).remainingMs).toBe(0);
  });

  it("buildRateLimitKey combines username and ip", () => {
    const key = buildRateLimitKey("alice", "10.0.0.1");
    expect(key).toBe("login:alice:10.0.0.1");
  });

  it("uses 'unknown' when ip is not provided", () => {
    const key = buildRateLimitKey("bob");
    expect(key).toBe("login:bob:unknown");
  });
});
