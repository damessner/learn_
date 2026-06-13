/**
 * Server-authoritative submission scoring utility.
 *
 * Computes raw percentage score from submitted answers + exercise definition,
 * so client-supplied scores are never trusted for persistence.
 */

import type { ExerciseData } from "@/lib/exercises";
import { getTaskMaxPoints } from "@/lib/points";

type UnknownRecord = Record<string, unknown>;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalize(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function parseGapAnswers(text: string): string[] {
  const regex = /<<(.*?)>>|\[(.*?)\]/g;
  const answers: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = (match[1] || match[2] || "").trim();
    const correct = raw.split(/##|\|/)[0]?.trim() || "";
    answers.push(correct);
  }

  return answers;
}

function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function matchesKeyword(text: string, kw: string, spellingTolerance: string): boolean {
  const cleanText = text
    .toLowerCase()
    .replace(/[.,/#!$%\^&\*;:{}=\-_`~()?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cleanKw = kw
    .toLowerCase()
    .replace(/[.,/#!$%\^&\*;:{}=\-_`~()?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanKw) return false;

  if (spellingTolerance === "off") return true; // keyword check disabled
  if (spellingTolerance === "strict" || !spellingTolerance) {
    return cleanText.includes(cleanKw);
  }

  const textWords = cleanText.split(" ").filter(Boolean);
  const kwWords = cleanKw.split(" ").filter(Boolean);
  if (kwWords.length === 1) {
    return textWords.some((w) => getLevenshteinDistance(w, cleanKw) <= 1);
  }

  for (let i = 0; i <= textWords.length - kwWords.length; i++) {
    let match = true;
    for (let j = 0; j < kwWords.length; j++) {
      if (getLevenshteinDistance(textWords[i + j], kwWords[j]) > 1) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }

  return false;
}

function scoreMultipleChoice(config: UnknownRecord, state: unknown): number {
  const questions = asArray(config.questions);
  if (questions.length === 0) return 0;
  const stateObj = asRecord(state);
  const answers = asRecord(stateObj?.answers);
  if (!answers) return 0;

  let correct = 0;
  questions.forEach((q, idx) => {
    const question = asRecord(q);
    if (!question) return;
    if (Number(answers[idx]) === question.correctOptionIndex) correct++;
  });

  return clampScore((correct / questions.length) * 100);
}

function scoreGapFill(config: UnknownRecord, state: unknown): number {
  const correctAnswers = parseGapAnswers(String(config?.text || ""));
  if (correctAnswers.length === 0) return 0;
  const stateObj = asRecord(state);
  const answers = asRecord(stateObj?.answers);
  if (!answers) return 0;

  let correct = 0;
  correctAnswers.forEach((ans, idx) => {
    if (normalize(answers[idx]) === normalize(ans)) correct++;
  });

  return clampScore((correct / correctAnswers.length) * 100);
}

function scoreDragDrop(config: UnknownRecord, state: unknown): number {
  const correctAnswers = parseGapAnswers(String(config?.text || ""));
  if (correctAnswers.length === 0) return 0;
  const stateObj = asRecord(state);
  const placements = asRecord(stateObj?.placements);
  if (!placements) return 0;

  let correct = 0;
  correctAnswers.forEach((ans, idx) => {
    if (normalize(String(placements[idx] ?? "")) === normalize(ans)) correct++;
  });

  return clampScore((correct / correctAnswers.length) * 100);
}

function scoreCategorization(config: UnknownRecord, state: unknown): number {
  const items = asArray(config.items);
  if (items.length === 0) return 0;
  const stateObj = asRecord(state);
  const placements = asRecord(stateObj?.placements);
  if (!placements) return 0;

  let correct = 0;
  items.forEach((item) => {
    const itemObj = asRecord(item);
    if (!itemObj) return;
    if (placements[itemObj.id as string] === itemObj.category) correct++;
  });

  return clampScore((correct / items.length) * 100);
}

function scoreClickableChoice(config: UnknownRecord, state: unknown): number {
  const statements = asArray(config.statements);
  if (statements.length === 0) return 0;
  const stateObj = asRecord(state);
  const selections = asRecord(stateObj?.selections);
  if (!selections) return 0;

  let correct = 0;
  statements.forEach((stmt) => {
    const stmtObj = asRecord(stmt);
    if (!stmtObj) return;
    if (selections[stmtObj.id as string] === stmtObj.correctChoice) correct++;
  });

  return clampScore((correct / statements.length) * 100);
}

function scoreMatching(config: UnknownRecord, state: unknown): number {
  const pairs = asArray(config.pairs);
  if (pairs.length === 0) return 0;
  const stateObj = asRecord(state);
  const matches = asRecord(stateObj?.matches);
  if (!matches) return 0;

  let correct = 0;
  pairs.forEach((pair) => {
    const pairObj = asRecord(pair);
    if (!pairObj) return;
    if (matches[pairObj.id as string] === pairObj.rightText) correct++;
  });

  return clampScore((correct / pairs.length) * 100);
}

function scoreOrdering(config: UnknownRecord, state: unknown): number {
  const elements = asArray(config.elements);
  if (elements.length === 0) return 0;

  const stateObj = asRecord(state);
  const placed = asArray(stateObj?.placed);
  const shuffled = asArray(stateObj?.shuffled);
  if (placed.length === 0 || placed.length !== shuffled.length) return 0;

  let correctPositions = 0;
  placed.forEach((shuffledIdx, pos: number) => {
    if (shuffled[Number(shuffledIdx)] === elements[pos]) correctPositions++;
  });

  return clampScore((correctPositions / elements.length) * 100);
}

function scoreOpenQuestion(config: UnknownRecord, state: unknown): number {
  const stateObj = asRecord(state);
  const response = String(stateObj?.response || "");
  const audioUrl = String(stateObj?.audioUrl || "");
  const imageUrl = String(stateObj?.imageUrl || "");

  const isComplete = response.trim().length > 0 || !!audioUrl || !!imageUrl;
  if (!isComplete) return 0;

  if (response.trim().length === 0 && (audioUrl || imageUrl)) {
    // Media-only open submissions require teacher review.
    return 0;
  }

  const cleanedInput = response.toLowerCase().trim();
  const required: string[] = Array.isArray(config?.required) ? config.required : [];
  const bonus: string[] = Array.isArray(config?.bonus) ? config.bonus : [];
  const forbidden: string[] = Array.isArray(config?.forbidden) ? config.forbidden : [];
  const tolerance = String(config.spellingTolerance ?? "strict");

  const parseKw = (kwStr: string): { kw: string; weight: number } => {
    const parts = kwStr.split("##");
    const kw = parts[0].trim();
    const weight = parts.length > 1 ? parseFloat(parts[1]) : 1.0;
    return { kw, weight: Number.isFinite(weight) ? weight : 1.0 };
  };

  const forbiddenParsed = forbidden.map(parseKw);
  if (forbiddenParsed.some((p: { kw: string; weight: number }) => matchesKeyword(cleanedInput, p.kw, tolerance))) {
    return 0;
  }

  const hasNewFields = required.length > 0 || bonus.length > 0 || forbidden.length > 0;
  if (!hasNewFields) {
    const legacyKeywords = Array.isArray(config?.keywords) ? config.keywords : [];
    if (legacyKeywords.length === 0) return 100;
    return legacyKeywords.some((kw: string) => matchesKeyword(cleanedInput, kw, "strict")) ? 100 : 0;
  }

  const requiredParsed = required.map(parseKw);
  const bonusParsed = bonus.map(parseKw);
  const matchedRequired = requiredParsed.filter((p: { kw: string; weight: number }) => matchesKeyword(cleanedInput, p.kw, tolerance));
  const matchedBonus = bonusParsed.filter((p: { kw: string; weight: number }) => matchesKeyword(cleanedInput, p.kw, tolerance));

  let finalScore = 0;
  if (requiredParsed.length > 0) {
    const totalRequiredWeight = requiredParsed.reduce((acc: number, p: { kw: string; weight: number }) => acc + p.weight, 0);
    const matchedRequiredWeight = matchedRequired.reduce((acc: number, p: { kw: string; weight: number }) => acc + p.weight, 0);
    const baseScore = totalRequiredWeight > 0 ? (matchedRequiredWeight / totalRequiredWeight) * 100 : 0;
    const bonusEarned = matchedBonus.reduce((acc: number, p: { kw: string; weight: number }) => acc + p.weight * 15, 0);
    finalScore = Math.min(100, baseScore + bonusEarned);
  } else if (bonusParsed.length > 0) {
    const totalBonusWeight = bonusParsed.reduce((acc: number, p: { kw: string; weight: number }) => acc + p.weight, 0);
    const matchedBonusWeight = matchedBonus.reduce((acc: number, p: { kw: string; weight: number }) => acc + p.weight, 0);
    finalScore = totalBonusWeight > 0 ? (matchedBonusWeight / totalBonusWeight) * 100 : 0;
    finalScore = Math.min(100, finalScore);
  } else {
    finalScore = 100;
  }

  return clampScore(Math.round(finalScore));
}

function scoreImageHotspotQuiz(config: UnknownRecord, state: unknown): number {
  const tasks = asArray(config.tasks);
  if (tasks.length === 0) return 0;

  const stateObj = asRecord(state);
  const completedTaskIds = asArray(stateObj?.completedTaskIds);
  const attempts = asRecord(stateObj?.attempts) || {};

  let points = 0;
  tasks.forEach((t) => {
    const taskObj = asRecord(t);
    if (!taskObj) return;
    const taskId = String(taskObj.id || "");
    const isSolved = completedTaskIds.includes(taskId);
    const isFirstTry = Number(attempts[taskId] || 0) === 0;
    if (isSolved && isFirstTry) points++;
  });

  return clampScore((points / tasks.length) * 100);
}

function scoreInteractiveReading(config: UnknownRecord, state: unknown): number {
  const pages = config?.pages && typeof config.pages === "object" ? config.pages : {};
  const stateObj = asRecord(state);
  const solvedQuestions = asRecord(stateObj?.solvedQuestions) || {};

  // Build a set of all valid question IDs from the exercise config
  const validQuestionIds = new Set<string>();
  let total = 0;

  Object.values(pages as Record<string, unknown>).forEach((page: unknown) => {
    const pageObj = asRecord(page) || {};
    const questions = Array.isArray(pageObj?.questions) ? (pageObj.questions as unknown[]) : [];
    total += questions.length;
    questions.forEach((q) => {
      const qObj = asRecord(q);
      if (qObj?.id) validQuestionIds.add(String(qObj.id));
    });
  });

  if (total === 0) return 100;

  let points = 0;
  Object.values(solvedQuestions).forEach((pageState: unknown) => {
    const pageSolved = asRecord(pageState);
    if (!pageSolved) return;
    Object.entries(pageSolved).forEach(([qId, v]) => {
      if (validQuestionIds.has(qId) && v === true) points++;
    });
  });

  return clampScore((points / total) * 100);
}

function scoreVocabulary(config: UnknownRecord, state: unknown): number {
  const vocabList = asArray(config.vocabList);
  if (vocabList.length === 0) return 0;

  const stateObj = asRecord(state);
  const firstTryCorrect = asRecord(stateObj?.firstTryCorrect) || {};
  let points = 0;
  vocabList.forEach((_: unknown, idx: number) => {
    if (firstTryCorrect[idx] === true) points++;
  });

  return clampScore((points / vocabList.length) * 100);
}

function scoreWritingCoach(config: UnknownRecord, state: unknown): number {
  const stateObj = asRecord(state);
  if (!stateObj) return 0;

  const text = String(stateObj.text || "").trim();
  if (!text) return 0;

  const latestFeedback = asRecord(stateObj.latestFeedback);
  if (!latestFeedback) {
    return 20; // baseline score if text is written but coach feedback never requested
  }

  const criteriaFeedback = asArray(latestFeedback.criteria);
  const exerciseCriteria = asArray(config.criteria);
  if (exerciseCriteria.length === 0) return 100;

  let completedCount = 0;
  criteriaFeedback.forEach((c) => {
    const cObj = asRecord(c);
    if (cObj && cObj.status === "completed") {
      completedCount++;
    }
  });

  return clampScore(Math.round((completedCount / exerciseCriteria.length) * 100));
}

function scoreExploreImageMap(config: UnknownRecord, state: unknown): number {
  const gameMode = asRecord(config.gameMode);
  if (!gameMode || gameMode.enabled !== true) return 100;

  const challenges = asArray(gameMode.challenges);
  if (challenges.length === 0) return 100;

  const stateObj = asRecord(state);
  const completedChallenges = asArray(stateObj?.completedChallenges);
  const attempts = asRecord(stateObj?.attempts) || {};

  let points = 0;
  challenges.forEach((ch) => {
    const chObj = asRecord(ch);
    if (!chObj) return;
    const challengeId = String(chObj.id || "");
    const isCompleted = completedChallenges.includes(challengeId);
    const isFirstTry = Number(attempts[challengeId] || 0) === 0;
    if (isCompleted && isFirstTry) points++;
  });

  return clampScore((points / challenges.length) * 100);
}

function scoreLiveQuiz(config: UnknownRecord, state: unknown): number {
  const questions = asArray(config.questions);
  if (questions.length === 0) return 0;
  
  const answers = asRecord(state);
  if (!answers) return 0;

  let correct = 0;
  questions.forEach((q) => {
    const qObj = asRecord(q);
    if (!qObj) return;

    const qId = String(qObj.id || "");
    const ans = answers[qId];
    if (ans === undefined || ans === null) return;

    let isCorrect = false;
    const type = qObj.type;

    try {
      if (type === "single-choice") {
        isCorrect = Number(ans) === qObj.correctOptionIdx;
      } else if (type === "multiple-choice") {
        const selected = asArray(ans).map(Number);
        const correctIndices = asArray(qObj.correctOptionIndices).map(Number);
        isCorrect =
          selected.length === correctIndices.length &&
          selected.every((idx) => correctIndices.includes(idx));
      } else if (type === "word-ordering") {
        const selected = asArray(ans).map(String);
        const correctWords = asArray(qObj.words).map(String);
        isCorrect =
          selected.length === correctWords.length &&
          selected.every((w, idx) => w === correctWords[idx]);
      } else if (type === "text-input") {
        const selected = String(ans).trim().toLowerCase();
        const accepted = asArray(qObj.acceptedAnswers).map((a) => String(a).trim().toLowerCase());
        isCorrect = accepted.includes(selected);
      }
    } catch {
      // ignore
    }

    if (isCorrect) correct++;
  });

  return clampScore((correct / questions.length) * 100);
}

function scoreQuestionByType(question: UnknownRecord, state: unknown): number {
  switch (question.type) {
    case "multiple-choice":
      return scoreMultipleChoice({ questions: [question] }, state);
    case "gap-fill":
      return scoreGapFill(question, state);
    case "drag-drop":
      return scoreDragDrop(question, state);
    case "categorization":
      return scoreCategorization(question, state);
    case "clickable-choice":
      return scoreClickableChoice(question, state);
    case "matching":
      return scoreMatching(question, state);
    case "open-question":
      return scoreOpenQuestion(question, state);
    case "ordering":
      return scoreOrdering(question, state);
    case "media":
    case "instruction":
      return 100;
    default:
      return 0;
  }
}

export function scoreWorksheet(
  questions: UnknownRecord[],
  answers: Record<string, unknown> | null | undefined
): number {
  const answersObj = asRecord(answers);
  if (!answersObj) return 0;

  let totalMax = 0;
  let totalEarned = 0;

  for (const q of questions) {
    if (q.type === "media" || q.type === "instruction") continue;
    const maxPts = getTaskMaxPoints(q);
    const questionState = answersObj[String(q.id)];
    const childPct = scoreQuestionByType(q, questionState);
    totalMax += maxPts;
    totalEarned += (childPct / 100) * maxPts;
  }

  return totalMax > 0 ? clampScore((totalEarned / totalMax) * 100) : 0;
}

export function scoreExerciseSubmission(exercise: ExerciseData, answers: Record<string, unknown>): number {
  switch (exercise.type) {
    case "worksheet":
      return scoreWorksheet(exercise.questions, answers);
    case "multiple-choice":
      return scoreMultipleChoice(exercise, answers);
    case "gap-fill":
      return scoreGapFill(exercise, answers);
    case "drag-drop":
      return scoreDragDrop(exercise, answers);
    case "categorization":
      return scoreCategorization(exercise, answers);
    case "clickable-choice":
      return scoreClickableChoice(exercise, answers);
    case "matching":
      return scoreMatching(exercise, answers);
    case "open-question":
      return scoreOpenQuestion(exercise, answers);
    case "ordering":
      return scoreOrdering(exercise, answers);
    case "image-hotspot-quiz":
      return scoreImageHotspotQuiz(exercise, answers);
    case "interactive-reading":
      return scoreInteractiveReading(exercise, answers);
    case "vocabulary":
      return scoreVocabulary(exercise, answers);
    case "writing-coach":
      return scoreWritingCoach(exercise, answers);
    case "explore-image-map":
      return scoreExploreImageMap(exercise, answers);
    case "live-quiz":
      return scoreLiveQuiz(exercise, answers);
    case "media":
    case "instruction":
      return 100;
    default:
      return 0;
  }
}

/**
 * Legacy helper retained for unit tests and simple callers.
 */
export function scoreSimpleExercise(submittedScore: number): number {
  return clampScore(submittedScore);
}

/**
 * Validate that the answers payload is within expected bounds.
 * Returns null if valid, or an error string if invalid.
 */
export function validateAnswersPayload(
  answers: unknown,
  maxExpectedSize: number = 500_000
): string | null {
  if (answers === null || answers === undefined) {
    return "Answers payload is required";
  }

  if (typeof answers !== "object" || Array.isArray(answers)) {
    return "Answers payload must be an object";
  }

  try {
    const serialized = JSON.stringify(answers);
    if (serialized.length > maxExpectedSize) {
      return "Answers payload too large";
    }
  } catch {
    return "Answers payload could not be serialized";
  }

  return null;
}

/**
 * Validate basic client score bounds (used for sanity-checking payload only).
 */
export function validateScoreBounds(score: unknown): string | null {
  if (score === null || score === undefined) return null;
  if (typeof score !== "number" || isNaN(score)) {
    return "Score must be a valid number";
  }
  if (score < 0 || score > 100) {
    return "Score must be between 0 and 100";
  }
  return null;
}
