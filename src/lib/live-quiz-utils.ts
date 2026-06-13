/**
 * Pure utility functions for Live Quiz logic.
 * Extracted to a separate file for testability (no server-side dependencies).
 */

export type LiveQuizQuestionType = "single-choice" | "multiple-choice" | "word-ordering" | "text-input";

export interface LiveQuizQuestion {
  type: LiveQuizQuestionType;
  correctOptionIdx?: number;
  correctOptionIndices?: number[];
  words?: string[];
  acceptedAnswers?: string[];
}

/**
 * Pure function: evaluates whether a parsed answer is correct for a given question.
 */
export function evaluateAnswerCorrectness(
  question: LiveQuizQuestion,
  parsedAnswer: unknown
): boolean {
  if (question.type === "single-choice") {
    const selected = Number(parsedAnswer);
    return selected === question.correctOptionIdx;
  } else if (question.type === "multiple-choice") {
    const selected = Array.isArray(parsedAnswer) ? (parsedAnswer as number[]) : [];
    const correct = question.correctOptionIndices || [];
    return (
      selected.length === correct.length &&
      selected.every((idx) => correct.includes(idx))
    );
  } else if (question.type === "word-ordering") {
    const selected = Array.isArray(parsedAnswer) ? (parsedAnswer as string[]) : [];
    const correct = question.words || [];
    return (
      selected.length === correct.length &&
      selected.every((val, idx) => val === correct[idx])
    );
  } else if (question.type === "text-input") {
    const selected = String(parsedAnswer).trim().toLowerCase();
    const accepted = (question.acceptedAnswers || []).map((a) => a.trim().toLowerCase());
    return accepted.includes(selected);
  }
  return false;
}

/**
 * Calculate speed-based points for a correct answer.
 * Points range: 500 (slowest correct) to 1000 (instant correct).
 */
export function calculateLiveQuizPoints(
  isCorrect: boolean,
  questionStartedAt: Date,
  answeredAt: Date,
  timeLimit: number
): number {
  if (!isCorrect) return 0;
  const elapsedSec = (answeredAt.getTime() - questionStartedAt.getTime()) / 1000;
  const remainingRatio = Math.max(0, Math.min(1, 1 - elapsedSec / timeLimit));
  return Math.round(500 + 500 * remainingRatio);
}
