import { describe, it, expect } from "vitest";
import { getTodayAtReset, DAILY_RESET_HOUR, DAILY_RESET_MINUTE } from "./actions/quota";

describe("getTodayAtReset", () => {
  it("returns a Date at the configured daily reset time today", () => {
    const result = getTodayAtReset();
    expect(result.getHours()).toBe(DAILY_RESET_HOUR);
    expect(result.getMinutes()).toBe(DAILY_RESET_MINUTE);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("defaults to 07:55", () => {
    expect(DAILY_RESET_HOUR).toBe(7);
    expect(DAILY_RESET_MINUTE).toBe(55);
  });

  it("returns today's date", () => {
    const now = new Date();
    const result = getTodayAtReset();
    expect(result.getFullYear()).toBe(now.getFullYear());
    expect(result.getMonth()).toBe(now.getMonth());
    expect(result.getDate()).toBe(now.getDate());
  });
});
