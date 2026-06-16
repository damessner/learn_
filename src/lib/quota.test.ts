import { describe, it, expect } from "vitest";
import { getTodayAt0755 } from "./actions/quota";

describe("getTodayAt0755", () => {
  it("returns a Date at 07:55 today", () => {
    const result = getTodayAt0755();
    expect(result.getHours()).toBe(7);
    expect(result.getMinutes()).toBe(55);
    expect(result.getSeconds()).toBe(0);
  });

  it("returns today's date", () => {
    const now = new Date();
    const result = getTodayAt0755();
    expect(result.getFullYear()).toBe(now.getFullYear());
    expect(result.getMonth()).toBe(now.getMonth());
    expect(result.getDate()).toBe(now.getDate());
  });
});
