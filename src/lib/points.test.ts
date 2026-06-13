import { describe, it, expect } from "vitest";
import { getTaskMaxPoints, getExerciseMaxPoints } from "./points";

describe("getTaskMaxPoints", () => {
  it("returns 0 for media type", () => {
    expect(getTaskMaxPoints({ type: "media" })).toBe(0);
  });

  it("returns 0 for instruction type", () => {
    expect(getTaskMaxPoints({ type: "instruction" })).toBe(0);
  });

  it("returns 1 for multiple-choice", () => {
    expect(getTaskMaxPoints({ type: "multiple-choice" })).toBe(1);
  });

  it("returns gap count for gap-fill", () => {
    const q = { type: "gap-fill", text: "The <<cat>> sat on the <<mat>>." };
    expect(getTaskMaxPoints(q)).toBe(2);
  });

  it("returns 1 for gap-fill with no gaps", () => {
    const q = { type: "gap-fill", text: "No gaps here." };
    expect(getTaskMaxPoints(q)).toBe(1);
  });

  it("returns items length for categorization", () => {
    const q = { type: "categorization", items: [{ id: "a" }, { id: "b" }, { id: "c" }] };
    expect(getTaskMaxPoints(q)).toBe(3);
  });

  it("returns 1 for categorization with no items", () => {
    const q = { type: "categorization" };
    expect(getTaskMaxPoints(q)).toBe(1);
  });

  it("returns statements length for clickable-choice", () => {
    const q = { type: "clickable-choice", statements: [{ id: "a" }, { id: "b" }] };
    expect(getTaskMaxPoints(q)).toBe(2);
  });

  it("returns pairs length for matching", () => {
    const q = { type: "matching", pairs: [{ id: "a" }] };
    expect(getTaskMaxPoints(q)).toBe(1);
  });

  it("returns 1 for open-question", () => {
    expect(getTaskMaxPoints({ type: "open-question" })).toBe(1);
  });

  it("returns 1 for ordering", () => {
    expect(getTaskMaxPoints({ type: "ordering" })).toBe(1);
  });

  it("returns 1 for unknown type", () => {
    expect(getTaskMaxPoints({ type: "unknown-type" })).toBe(1);
  });
});

describe("getExerciseMaxPoints", () => {
  it("sums worksheet question max points", () => {
    const exercise = {
      type: "worksheet",
      questions: [
        { id: "q1", type: "multiple-choice" },
        { id: "q2", type: "gap-fill", text: "<<hello>> <<world>>" },
        { id: "q3", type: "media" },
        { id: "q4", type: "instruction" },
      ],
    };
    // q1=1, q2=2, q3=0, q4=0 => total 3
    expect(getExerciseMaxPoints(exercise)).toBe(3);
  });

  it("returns tasks length for image-hotspot-quiz", () => {
    const exercise = { type: "image-hotspot-quiz", tasks: [{ id: "a" }, { id: "b" }, { id: "c" }] };
    expect(getExerciseMaxPoints(exercise)).toBe(3);
  });

  it("returns 1 for image-hotspot-quiz with no tasks", () => {
    const exercise = { type: "image-hotspot-quiz" };
    expect(getExerciseMaxPoints(exercise)).toBe(1);
  });

  it("counts questions in interactive-reading pages", () => {
    const exercise = {
      type: "interactive-reading",
      pages: {
        p1: { questions: [{ id: "q1" }, { id: "q2" }] },
        p2: { questions: [{ id: "q3" }] },
        p3: { questions: [] },
      },
    };
    expect(getExerciseMaxPoints(exercise)).toBe(3);
  });

  it("returns 1 for explore-image-map", () => {
    expect(getExerciseMaxPoints({ type: "explore-image-map" })).toBe(1);
  });

  it("returns questions length for multiple-choice", () => {
    const exercise = { type: "multiple-choice", questions: [{ id: "a" }, { id: "b" }] };
    expect(getExerciseMaxPoints(exercise)).toBe(2);
  });

  it("returns 1 for vocabulary with no vocabList", () => {
    expect(getExerciseMaxPoints({ type: "vocabulary" })).toBe(1);
  });

  it("returns vocabList length for vocabulary", () => {
    const exercise = { type: "vocabulary", vocabList: [{ word: "a", translation: "b" }] };
    expect(getExerciseMaxPoints(exercise)).toBe(1);
  });
});
