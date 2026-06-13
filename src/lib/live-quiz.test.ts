import { describe, it, expect } from "vitest";
import { evaluateAnswerCorrectness, calculateLiveQuizPoints } from "@/lib/live-quiz-utils";

describe("evaluateAnswerCorrectness", () => {
  describe("single-choice", () => {
    const question = {
      type: "single-choice" as const,
      correctOptionIdx: 2,
    };

    it("returns true for correct index", () => {
      expect(evaluateAnswerCorrectness(question, 2)).toBe(true);
    });

    it("returns false for wrong index", () => {
      expect(evaluateAnswerCorrectness(question, 1)).toBe(false);
    });

    it("handles string-encoded number", () => {
      // "2" coerces to 2
      expect(evaluateAnswerCorrectness(question, "2")).toBe(true);
    });
  });

  describe("multiple-choice", () => {
    const question = {
      type: "multiple-choice" as const,
      correctOptionIndices: [0, 3],
    };

    it("returns true for exact correct set (same order)", () => {
      expect(evaluateAnswerCorrectness(question, [0, 3])).toBe(true);
    });

    it("returns true for correct set in different order", () => {
      expect(evaluateAnswerCorrectness(question, [3, 0])).toBe(true);
    });

    it("returns false for incomplete selection", () => {
      expect(evaluateAnswerCorrectness(question, [0])).toBe(false);
    });

    it("returns false for wrong indices", () => {
      expect(evaluateAnswerCorrectness(question, [1, 2])).toBe(false);
    });

    it("returns false for non-array input", () => {
      expect(evaluateAnswerCorrectness(question, "not-an-array")).toBe(false);
    });
  });

  describe("word-ordering", () => {
    const question = {
      type: "word-ordering" as const,
      words: ["The", "fox", "jumps"],
    };

    it("returns true for correct sequence", () => {
      expect(evaluateAnswerCorrectness(question, ["The", "fox", "jumps"])).toBe(true);
    });

    it("returns false for wrong sequence", () => {
      expect(evaluateAnswerCorrectness(question, ["fox", "The", "jumps"])).toBe(false);
    });

    it("returns false for empty array", () => {
      expect(evaluateAnswerCorrectness(question, [])).toBe(false);
    });

    it("returns false for non-array", () => {
      expect(evaluateAnswerCorrectness(question, "The fox jumps")).toBe(false);
    });
  });

  describe("text-input", () => {
    const question = {
      type: "text-input" as const,
      acceptedAnswers: ["Berlin", "Capital of Germany"],
    };

    it("accepts exact answer", () => {
      expect(evaluateAnswerCorrectness(question, "Berlin")).toBe(true);
    });

    it("is case-insensitive", () => {
      expect(evaluateAnswerCorrectness(question, "berlin")).toBe(true);
      expect(evaluateAnswerCorrectness(question, "BERLIN")).toBe(true);
    });

    it("trims whitespace", () => {
      expect(evaluateAnswerCorrectness(question, "  berlin  ")).toBe(true);
    });

    it("accepts alternative answers", () => {
      expect(evaluateAnswerCorrectness(question, "capital of germany")).toBe(true);
    });

    it("returns false for wrong answer", () => {
      expect(evaluateAnswerCorrectness(question, "Paris")).toBe(false);
    });

    it("returns false when no accepted answers defined", () => {
      expect(evaluateAnswerCorrectness({ type: "text-input" as const }, "anything")).toBe(false);
    });
  });

  describe("unknown type", () => {
    it("returns false for unknown question types", () => {
      // @ts-expect-error testing unknown type
      expect(evaluateAnswerCorrectness({ type: "unknown" }, "any")).toBe(false);
    });
  });
});

describe("calculateLiveQuizPoints", () => {
  const start = new Date("2026-06-13T12:00:00Z");

  it("returns 1000 for instant correct answer", () => {
    const answered = new Date("2026-06-13T12:00:00Z");
    expect(calculateLiveQuizPoints(true, start, answered, 20)).toBe(1000);
  });

  it("decays to 750 at half the time limit", () => {
    const answered = new Date("2026-06-13T12:00:10Z"); // 10s of 20s
    expect(calculateLiveQuizPoints(true, start, answered, 20)).toBe(750);
  });

  it("returns 500 at full time limit", () => {
    const answered = new Date("2026-06-13T12:00:20Z"); // 20s of 20s
    expect(calculateLiveQuizPoints(true, start, answered, 20)).toBe(500);
  });

  it("returns 500 when answer is past the time limit (clamped)", () => {
    const answered = new Date("2026-06-13T12:00:30Z"); // 30s of 20s
    expect(calculateLiveQuizPoints(true, start, answered, 20)).toBe(500);
  });

  it("returns 0 for incorrect answer regardless of speed", () => {
    const answered = new Date("2026-06-13T12:00:00Z");
    expect(calculateLiveQuizPoints(false, start, answered, 20)).toBe(0);
  });
});
