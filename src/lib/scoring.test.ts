import { describe, it, expect } from "vitest";
import { getAttemptMultiplier } from "./scoring";

describe("getAttemptMultiplier", () => {
  it("returns 1.0 for attempt 1", () => {
    expect(getAttemptMultiplier(1)).toBe(1.0);
  });

  it("returns 0.75 for attempt 2", () => {
    expect(getAttemptMultiplier(2)).toBe(0.75);
  });

  it("returns 0.5 for attempt 3", () => {
    expect(getAttemptMultiplier(3)).toBe(0.5);
  });

  it("returns 0.25 for attempt 4", () => {
    expect(getAttemptMultiplier(4)).toBe(0.25);
  });

  it("returns 0.25 for any attempt >= 4", () => {
    expect(getAttemptMultiplier(5)).toBe(0.25);
    expect(getAttemptMultiplier(10)).toBe(0.25);
    expect(getAttemptMultiplier(100)).toBe(0.25);
  });
});
