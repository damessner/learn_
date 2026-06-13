import { describe, it, expect } from "vitest";
import { generateJoinCode } from "./auth-helpers";

describe("generateJoinCode", () => {
  it("returns a 6-character string", () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(6);
  });

  it("contains only uppercase alphanumeric characters", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateJoinCode();
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    }
  });

  it("produces different codes on successive calls", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateJoinCode());
    }
    // With 36^6 ≈ 2.1B possibilities, 100 calls should all be unique
    expect(codes.size).toBe(100);
  });
});
