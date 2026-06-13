/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import {
  scoreWorksheet,
  scoreExerciseSubmission,
  scoreSimpleExercise,
  validateAnswersPayload,
  validateScoreBounds,
} from "./submissionScoring";

describe("validateAnswersPayload", () => {
  it("returns null for valid object", () => {
    expect(validateAnswersPayload({ answer: 42 })).toBeNull();
  });

  it("returns error for null", () => {
    expect(validateAnswersPayload(null)).toBe("Answers payload is required");
  });

  it("returns error for undefined", () => {
    expect(validateAnswersPayload(undefined)).toBe("Answers payload is required");
  });

  it("returns error for non-object", () => {
    expect(validateAnswersPayload("string")).toBe("Answers payload must be an object");
  });

  it("returns error for arrays", () => {
    expect(validateAnswersPayload([1, 2, 3])).toBe("Answers payload must be an object");
  });

  it("returns error for oversized payload", () => {
    const large = { data: "x".repeat(600_000) };
    expect(validateAnswersPayload(large, 500_000)).toBe("Answers payload too large");
  });
});

describe("validateScoreBounds", () => {
  it("returns null for null/undefined", () => {
    expect(validateScoreBounds(null)).toBeNull();
    expect(validateScoreBounds(undefined)).toBeNull();
  });

  it("returns null for valid score in range", () => {
    expect(validateScoreBounds(0)).toBeNull();
    expect(validateScoreBounds(50)).toBeNull();
    expect(validateScoreBounds(100)).toBeNull();
  });

  it("returns error for non-number", () => {
    expect(validateScoreBounds("abc")).toBe("Score must be a valid number");
    expect(validateScoreBounds(NaN)).toBe("Score must be a valid number");
  });

  it("returns error for out of range", () => {
    expect(validateScoreBounds(-1)).toBe("Score must be between 0 and 100");
    expect(validateScoreBounds(101)).toBe("Score must be between 0 and 100");
  });
});

describe("scoreWorksheet", () => {
  it("returns 0 with no answers", () => {
    expect(scoreWorksheet([{ id: "q1", type: "multiple-choice" }], null)).toBe(0);
  });

  it("computes weighted average correctly", () => {
    const questions = [
      {
        id: "q1",
        type: "multiple-choice",
        question: "Q1",
        options: ["A", "B"],
        correctOptionIndex: 0,
      }, // max=1
      { id: "q2", type: "gap-fill", text: "<<a>> <<b>>" }, // max=2
      { id: "q3", type: "instruction" },                // excluded (max=0)
    ];

    const answers = {
      q1: { answers: { 0: 0 } },
      q2: { answers: { 0: "a", 1: "x" } },
    };

    // q1: 1*100% = 1, q2: 2*50% = 1, total: 2/3 = 66.66%
    const result = scoreWorksheet(questions, answers);
    expect(result).toBeCloseTo(66.666, 1);
  });

  it("returns 0 for all excluded question types", () => {
    const questions = [
      { id: "q1", type: "media" },
      { id: "q2", type: "instruction" },
    ];
    expect(scoreWorksheet(questions, {})).toBe(0);
  });
});

describe("scoreExerciseSubmission", () => {
  it("scores top-level multiple-choice", () => {
    const exercise = {
      id: "mc-1",
      title: "MC",
      description: "",
      type: "multiple-choice",
      questions: [
        { id: "q1", question: "One?", options: ["A", "B"], correctOptionIndex: 0 },
        { id: "q2", question: "Two?", options: ["A", "B"], correctOptionIndex: 1 },
      ],
    } as any;

    const answers = { answers: { 0: 0, 1: 1 } };
    expect(scoreExerciseSubmission(exercise, answers)).toBe(100);
  });

  it("scores open-question media-only as 0 server-side", () => {
    const exercise = {
      id: "oq-1",
      title: "Open",
      description: "",
      type: "open-question",
      question: "Describe",
      keywords: ["hello"],
      allowAudio: true,
    } as any;

    const answers = { response: "", audioUrl: "/uploads/submissions/a.wav", imageUrl: "" };
    expect(scoreExerciseSubmission(exercise, answers)).toBe(0);
  });

  it("scores worksheet using question-level state", () => {
    const exercise = {
      id: "ws-1",
      title: "Worksheet",
      description: "",
      type: "worksheet",
      questions: [
        {
          id: "q1",
          type: "multiple-choice",
          question: "MC",
          options: ["A", "B"],
          correctOptionIndex: 0,
        },
        {
          id: "q2",
          type: "gap-fill",
          text: "The <<cat>> and <<dog>>",
        },
      ],
    } as any;

    const answers = {
      q1: { answers: { 0: 0 } },
      q2: { answers: { 0: "cat", 1: "bird" } },
    };

    // q1: 100% of 1 point, q2: 50% of 2 points => 2/3 => 66.66%
    expect(scoreExerciseSubmission(exercise, answers)).toBeCloseTo(66.666, 1);
  });
});

describe("scoreSimpleExercise", () => {
  it("returns clamped score within bounds", () => {
    expect(scoreSimpleExercise(85)).toBe(85);
    expect(scoreSimpleExercise(0)).toBe(0);
    expect(scoreSimpleExercise(100)).toBe(100);
  });

  it("clamps score below 0 to 0", () => {
    expect(scoreSimpleExercise(-10)).toBe(0);
  });

  it("clamps score above 100 to 100", () => {
    expect(scoreSimpleExercise(150)).toBe(100);
  });

  it("returns 0 for NaN", () => {
    expect(scoreSimpleExercise(NaN)).toBe(0);
  });
});

describe("scoreWritingCoach", () => {
  const config = {
    id: "coach-1",
    type: "writing-coach",
    prompt: "Write a letter",
    criteria: [
      { id: "c1", name: "Greeting", description: "Say hello" },
      { id: "c2", name: "Content", description: "Body of text" },
      { id: "c3", name: "Signoff", description: "Say goodbye" },
    ],
  };

  it("returns 0 if state is missing or text is empty", () => {
    expect(scoreExerciseSubmission(config as any, {})).toBe(0);
    expect(scoreExerciseSubmission(config as any, { text: "" })).toBe(0);
  });

  it("returns 20 baseline participation if text exists but no feedback was fetched", () => {
    expect(scoreExerciseSubmission(config as any, { text: "Hello my friend. How are you? Goodbye." })).toBe(20);
  });

  it("computes score from criteria completion status", () => {
    const answers1 = {
      text: "Hello my friend. How are you? Goodbye.",
      latestFeedback: {
        overallFeedback: "Good work",
        criteria: [
          { id: "c1", status: "completed" },
          { id: "c2", status: "needs_work" },
          { id: "c3", status: "needs_work" },
        ],
      },
    };
    // 1/3 completed = 33%
    expect(scoreExerciseSubmission(config as any, answers1)).toBe(33);

    const answers2 = {
      text: "Hello my friend. How are you? Goodbye.",
      latestFeedback: {
        overallFeedback: "Perfect work",
        criteria: [
          { id: "c1", status: "completed" },
          { id: "c2", status: "completed" },
          { id: "c3", status: "completed" },
        ],
      },
    };
    // 3/3 completed = 100%
    expect(scoreExerciseSubmission(config as any, answers2)).toBe(100);
  });
});

