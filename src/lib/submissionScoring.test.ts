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

  it("scores gap-fill with select: format correctly", () => {
    const questions = [
      { id: "q1", type: "gap-fill", text: "I <<select:am##is##are>> a teacher." },
    ];
    const answersCorrect = {
      q1: { answers: { 0: "am" } },
    };
    const answersIncorrect = {
      q1: { answers: { 0: "is" } },
    };
    expect(scoreWorksheet(questions, answersCorrect)).toBe(100);
    expect(scoreWorksheet(questions, answersIncorrect)).toBe(0);
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

describe("scoreInteractiveReading — security: fake IDs should not inflate score", () => {
  const config = {
    id: "ir-1",
    type: "interactive-reading",
    startPage: "p1",
    pages: {
      p1: {
        text: "Page one",
        choices: [],
        questions: [
          { id: "real-q1", type: "multiple-choice", prompt: "Q1?", options: ["A", "B"], correctOptionIdx: 0 },
          { id: "real-q2", type: "multiple-choice", prompt: "Q2?", options: ["A", "B"], correctOptionIdx: 1 },
        ],
      },
    },
  };

  it("returns 0 when student submits only fake question IDs", () => {
    const answers = {
      solvedQuestions: {
        p1: { "fake-id-1": true, "fake-id-2": true, "fake-id-3": true },
      },
    };
    expect(scoreExerciseSubmission(config as any, answers)).toBe(0);
  });

  it("returns 50 when student solves 1 of 2 real questions", () => {
    const answers = {
      solvedQuestions: {
        p1: { "real-q1": true, "real-q2": false },
      },
    };
    expect(scoreExerciseSubmission(config as any, answers)).toBe(50);
  });

  it("returns 100 when all real questions solved", () => {
    const answers = {
      solvedQuestions: {
        p1: { "real-q1": true, "real-q2": true },
      },
    };
    expect(scoreExerciseSubmission(config as any, answers)).toBe(100);
  });

  it("ignores fake IDs mixed with real IDs", () => {
    const answers = {
      solvedQuestions: {
        p1: { "real-q1": true, "fake-bonus-id": true, "real-q2": false },
      },
    };
    expect(scoreExerciseSubmission(config as any, answers)).toBe(50);
  });

  it("returns 100 when exercise has no questions (participation credit)", () => {
    const emptyConfig = {
      ...config,
      pages: { p1: { text: "Read this", choices: [], questions: [] } },
    };
    expect(scoreExerciseSubmission(emptyConfig as any, {})).toBe(100);
  });
});

describe("scoreDragDrop — case normalization (fix H5)", () => {
  const config = {
    id: "dd-1",
    type: "drag-drop",
    text: "The [Grass] is green and the [Sky] is blue",
  };

  it("accepts correct answers with matching case", () => {
    const answers = { placements: { 0: "Grass", 1: "Sky" } };
    expect(scoreExerciseSubmission(config as any, answers)).toBe(100);
  });

  it("accepts correct answers with different case (post-fix)", () => {
    const answers = { placements: { 0: "grass", 1: "sky" } };
    expect(scoreExerciseSubmission(config as any, answers)).toBe(100);
  });

  it("accepts correct answers with uppercase", () => {
    const answers = { placements: { 0: "GRASS", 1: "SKY" } };
    expect(scoreExerciseSubmission(config as any, answers)).toBe(100);
  });

  it("returns 0 for completely wrong answers", () => {
    const answers = { placements: { 0: "Rain", 1: "Cloud" } };
    expect(scoreExerciseSubmission(config as any, answers)).toBe(0);
  });
});

describe("scoreOpenQuestion — spellingTolerance off (fix H4)", () => {
  it("returns 100 for any non-empty response when tolerance is off", () => {
    const config = {
      id: "oq-2",
      type: "open-question",
      question: "Write something",
      required: ["specific-keyword"],
      spellingTolerance: "off",
    };
    // With tolerance "off", the keyword check is disabled — any text returns 100
    const answers = { response: "This text does not contain the keyword at all" };
    expect(scoreExerciseSubmission(config as any, answers)).toBe(100);
  });

  it("still returns 0 for forbidden keyword match when tolerance is off", () => {
    const config = {
      id: "oq-3",
      type: "open-question",
      question: "Write something",
      forbidden: ["badword"],
      spellingTolerance: "off",
    };
    // Forbidden check still applies, but uses matchesKeyword with "off" — which returns true
    // for any text, so any text with the forbidden word would return 0
    const answers = { response: "This contains badword" };
    expect(scoreExerciseSubmission(config as any, answers)).toBe(0);
  });
});

describe("scoreOpenQuestion — forbidden keyword", () => {
  it("returns 0 when response contains a forbidden keyword", () => {
    const config = {
      id: "oq-4",
      type: "open-question",
      question: "Describe X",
      required: ["correct"],
      forbidden: ["wrong"],
      spellingTolerance: "strict",
    };
    const answers = { response: "This is wrong and also correct" };
    expect(scoreExerciseSubmission(config as any, answers)).toBe(0);
  });
});

describe("scoreWritingCoach — edge cases", () => {
  it("returns 100 when exercise has no criteria defined", () => {
    const config = {
      id: "wc-2",
      type: "writing-coach",
      prompt: "Write",
      criteria: [],
    };
    const answers = {
      text: "Hello world",
      latestFeedback: { criteria: [] },
    };
    expect(scoreExerciseSubmission(config as any, answers)).toBe(100);
  });
});

describe("scoreOrdering — edge cases", () => {
  it("returns 0 when placed and shuffled lengths differ", () => {
    const config = {
      id: "ord-1",
      type: "ordering",
      question: "Order these",
      elements: ["A", "B", "C"],
    };
    const answers = { placed: [0, 1], shuffled: ["A", "B", "C"] };
    expect(scoreExerciseSubmission(config as any, answers)).toBe(0);
  });

  it("returns 0 when placed array is empty", () => {
    const config = {
      id: "ord-2",
      type: "ordering",
      question: "Order these",
      elements: ["A", "B", "C"],
    };
    const answers = { placed: [], shuffled: [] };
    expect(scoreExerciseSubmission(config as any, answers)).toBe(0);
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

