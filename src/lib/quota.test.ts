import { describe, it, expect } from "vitest";
import { getMonday } from "./actions/quota";

describe("getMonday", () => {
  it("returns Monday of the same week for Tuesday", () => {
    // 2026-06-16 is Tuesday
    const tuesday = new Date(2026, 5, 16);
    const monday = getMonday(tuesday);
    expect(monday.getDay()).toBe(1); // 1 = Monday
    expect(monday.getDate()).toBe(15);
    expect(monday.getMonth()).toBe(5); // June (0-indexed 5)
  });

  it("returns Monday of the same week for Sunday", () => {
    // 2026-06-21 is Sunday
    const sunday = new Date(2026, 5, 21);
    const monday = getMonday(sunday);
    expect(monday.getDay()).toBe(1); // 1 = Monday
    expect(monday.getDate()).toBe(15);
  });

  it("returns Monday of the same week for Monday itself", () => {
    // 2026-06-15 is Monday
    const mondayVal = new Date(2026, 5, 15);
    const monday = getMonday(mondayVal);
    expect(monday.getDay()).toBe(1); // 1 = Monday
    expect(monday.getDate()).toBe(15);
  });

  it("handles boundary across month change", () => {
    // 2026-06-01 is Monday
    // 2026-06-03 is Wednesday
    const wednesday = new Date(2026, 5, 3);
    const monday = getMonday(wednesday);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(1);
    expect(monday.getMonth()).toBe(5);
  });

  it("handles boundary across year change", () => {
    // 2026-01-01 is Thursday
    // 2026-01-02 is Friday
    const friday = new Date(2026, 0, 2);
    const monday = getMonday(friday);
    expect(monday.getDay()).toBe(1); // 1 = Monday
    expect(monday.getDate()).toBe(29);
    expect(monday.getMonth()).toBe(11); // December of 2025
    expect(monday.getFullYear()).toBe(2025);
  });
});
