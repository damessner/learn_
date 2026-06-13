import { describe, it, expect } from "vitest";

// Local pure evaluator function to test matching and speed-decay calculations
function evaluateAnswer(
  question: {
    type: "single-choice" | "multiple-choice" | "word-ordering" | "text-input";
    timeLimit: number;
    options?: string[];
    correctOptionIdx?: number;
    correctOptionIndices?: number[];
    words?: string[];
    acceptedAnswers?: string[];
  },
  answerJson: string,
  questionStartedAt: Date,
  answeredAt: Date
): { isCorrect: boolean; points: number } {
  let isCorrect = false;

  try {
    const parsedAnswer = JSON.parse(answerJson);

    if (question.type === "single-choice") {
      const selected = Number(parsedAnswer);
      isCorrect = selected === question.correctOptionIdx;
    } else if (question.type === "multiple-choice") {
      const selected = parsedAnswer as number[];
      const correct = question.correctOptionIndices || [];
      isCorrect =
        selected.length === correct.length &&
        selected.every((idx) => correct.includes(idx));
    } else if (question.type === "word-ordering") {
      const selected = parsedAnswer as string[];
      const correct = question.words || [];
      isCorrect =
        selected.length === correct.length &&
        selected.every((val, idx) => val === correct[idx]);
    } else if (question.type === "text-input") {
      const selected = String(parsedAnswer).trim().toLowerCase();
      const accepted = (question.acceptedAnswers || []).map((a) => a.trim().toLowerCase());
      isCorrect = accepted.includes(selected);
    }
  } catch {
    // ignore
  }

  let points = 0;
  if (isCorrect) {
    const elapsedSec = (answeredAt.getTime() - questionStartedAt.getTime()) / 1000;
    const limit = question.timeLimit || 20;
    const remainingRatio = Math.max(0, Math.min(1, 1 - elapsedSec / limit));
    points = Math.round(500 + 500 * remainingRatio);
  }

  return { isCorrect, points };
}

describe("Live Quiz Core Logic", () => {
  describe("Single Choice Verification", () => {
    const question = {
      type: "single-choice" as const,
      timeLimit: 20,
      options: ["A", "B", "C", "D"],
      correctOptionIdx: 2,
    };

    it("should award points for correct selection", () => {
      const start = new Date("2026-06-13T12:00:00Z");
      const answer = new Date("2026-06-13T12:00:00Z"); // 0 seconds elapsed
      const result = evaluateAnswer(question, "2", start, answer);
      expect(result.isCorrect).toBe(true);
      expect(result.points).toBe(1000); // instant response gives max 1000 points
    });

    it("should decay points as time passes", () => {
      const start = new Date("2026-06-13T12:00:00Z");
      const answer = new Date("2026-06-13T12:00:10Z"); // 10 seconds elapsed (half of 20)
      const result = evaluateAnswer(question, "2", start, answer);
      expect(result.isCorrect).toBe(true);
      expect(result.points).toBe(750); // half decay: 500 + 500 * 0.5 = 750
    });

    it("should reject incorrect selection with 0 points", () => {
      const start = new Date("2026-06-13T12:00:00Z");
      const answer = new Date("2026-06-13T12:00:00Z");
      const result = evaluateAnswer(question, "1", start, answer);
      expect(result.isCorrect).toBe(false);
      expect(result.points).toBe(0);
    });
  });

  describe("Multiple Choice Verification", () => {
    const question = {
      type: "multiple-choice" as const,
      timeLimit: 20,
      options: ["A", "B", "C", "D"],
      correctOptionIndices: [0, 3],
    };

    it("should verify correct options order-independent", () => {
      const start = new Date("2026-06-13T12:00:00Z");
      const answer = new Date("2026-06-13T12:00:00Z");
      const result1 = evaluateAnswer(question, "[0,3]", start, answer);
      const result2 = evaluateAnswer(question, "[3,0]", start, answer);
      expect(result1.isCorrect).toBe(true);
      expect(result2.isCorrect).toBe(true);
    });

    it("should reject incomplete selections", () => {
      const start = new Date("2026-06-13T12:00:00Z");
      const answer = new Date("2026-06-13T12:00:00Z");
      const result = evaluateAnswer(question, "[0]", start, answer);
      expect(result.isCorrect).toBe(false);
    });
  });

  describe("Word Ordering Verification", () => {
    const question = {
      type: "word-ordering" as const,
      timeLimit: 30,
      words: ["The", "fox", "jumps"],
    };

    it("should accept correct sequence", () => {
      const start = new Date("2026-06-13T12:00:00Z");
      const answer = new Date("2026-06-13T12:00:00Z");
      const result = evaluateAnswer(question, '["The", "fox", "jumps"]', start, answer);
      expect(result.isCorrect).toBe(true);
    });

    it("should reject incorrect sequence", () => {
      const start = new Date("2026-06-13T12:00:00Z");
      const answer = new Date("2026-06-13T12:00:00Z");
      const result = evaluateAnswer(question, '["fox", "The", "jumps"]', start, answer);
      expect(result.isCorrect).toBe(false);
    });
  });

  describe("Text Input Verification", () => {
    const question = {
      type: "text-input" as const,
      timeLimit: 20,
      acceptedAnswers: ["Berlin", "Capital of Germany"],
    };

    it("should accept case-insensitive answers", () => {
      const start = new Date("2026-06-13T12:00:00Z");
      const answer = new Date("2026-06-13T12:00:00Z");
      const result1 = evaluateAnswer(question, '"berlin"', start, answer);
      const result2 = evaluateAnswer(question, '"BERLIN"', start, answer);
      const result3 = evaluateAnswer(question, '"  berlin  "', start, answer);
      expect(result1.isCorrect).toBe(true);
      expect(result2.isCorrect).toBe(true);
      expect(result3.isCorrect).toBe(true);
    });

    it("should accept alternative answers", () => {
      const start = new Date("2026-06-13T12:00:00Z");
      const answer = new Date("2026-06-13T12:00:00Z");
      const result = evaluateAnswer(question, '"capital of germany"', start, answer);
      expect(result.isCorrect).toBe(true);
    });
  });
});
