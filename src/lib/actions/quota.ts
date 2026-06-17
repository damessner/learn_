import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

const WINDOW_MS = 45 * 60 * 1000; // 45 minutes
const WINDOW_INPUT_LIMIT = 30;
const WINDOW_QUIZ_LIMIT = 5;

// Daily reset time: 07:55 local time each day
export const DAILY_RESET_HOUR = 7;
export const DAILY_RESET_MINUTE = 55;

// Helper to get today's daily-reset Date (today at DAILY_RESET_HOUR:DAILY_RESET_MINUTE).
export function getTodayAtReset(): Date {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    DAILY_RESET_HOUR,
    DAILY_RESET_MINUTE,
    0,
    0
  );
}

/**
 * Filters timestamps to only those within the last `windowMs` milliseconds.
 */
function filterTimestamps(timestamps: number[], windowMs: number, now: number): number[] {
  return timestamps.filter((ts) => now - ts < windowMs);
}

/**
 * Loads current quota counters (read-only) and returns the snapshot.
 * Does not consume any quota.
 */
async function readUserQuota(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.role === "TEACHER" || user.role === "ADMIN") {
    return {
      user,
      dailyRemaining: 999,
      dailyLimit: 999,
      windowInputRemaining: 999,
      windowInputLimit: 999,
      windowQuizRemaining: 999,
      windowQuizLimit: 999,
      validInput: [] as number[],
      validQuiz: [] as number[],
      shouldResetDaily: false,
      isTeacherOrAdmin: true,
    };
  }

  const now = new Date();
  const nowMs = now.getTime();
  const todayReset = getTodayAtReset();
  const isAfterReset = nowMs >= todayReset.getTime();

  // Daily reset: if lastDailyReset is before today's reset time AND we're past it now
  const shouldResetDaily =
    user.lastDailyReset.getTime() < todayReset.getTime() && isAfterReset;

  const dailyRemaining = shouldResetDaily ? user.dailyLimit : user.dailyRemaining;

  // Window timestamps
  let inputTimestamps: number[] = [];
  let quizTimestamps: number[] = [];
  try {
    inputTimestamps = JSON.parse(user.windowInputTimestamps);
  } catch {
    inputTimestamps = [];
  }
  try {
    quizTimestamps = JSON.parse(user.windowQuizTimestamps);
  } catch {
    quizTimestamps = [];
  }

  const validInput = filterTimestamps(inputTimestamps, WINDOW_MS, nowMs);
  const validQuiz = filterTimestamps(quizTimestamps, WINDOW_MS, nowMs);

  return {
    user,
    dailyRemaining,
    dailyLimit: user.dailyLimit,
    windowInputRemaining: Math.max(0, WINDOW_INPUT_LIMIT - validInput.length),
    windowInputLimit: WINDOW_INPUT_LIMIT,
    windowQuizRemaining: Math.max(0, WINDOW_QUIZ_LIMIT - validQuiz.length),
    windowQuizLimit: WINDOW_QUIZ_LIMIT,
    isTeacherOrAdmin: false,
    validInput,
    validQuiz,
    shouldResetDaily,
  };
}

/**
 * Computes the public quota snapshot object from a `readUserQuota` result.
 * Pure function — does NOT open any Prisma transaction, so it's safe to
 * call inside an existing transaction without nesting.
 */
function buildSnapshotFromRead(
  snap: Awaited<ReturnType<typeof readUserQuota>>
) {
  const nowMs = Date.now();
  const todayReset = getTodayAtReset();
  const isAfterReset = nowMs >= todayReset.getTime();

  const nextReset = new Date(
    todayReset.getFullYear(),
    todayReset.getMonth(),
    todayReset.getDate() + (isAfterReset ? 1 : 0),
    DAILY_RESET_HOUR,
    DAILY_RESET_MINUTE,
    0,
    0
  );
  const dailyResetInMs = nextReset.getTime() - nowMs;

  // Window reset = when oldest timestamp in the valid window falls out
  let windowResetInMs = 0;
  const oldestSet = [...(snap.validInput ?? []), ...(snap.validQuiz ?? [])];
  if (oldestSet.length > 0) {
    const oldest = Math.min(...oldestSet);
    const slotFreeAt = oldest + WINDOW_MS;
    windowResetInMs = Math.max(0, slotFreeAt - nowMs);
  }

  return {
    dailyRemaining: snap.dailyRemaining,
    dailyLimit: snap.dailyLimit,
    dailyResetInMs,
    windowInputRemaining: snap.windowInputRemaining,
    windowInputLimit: snap.windowInputLimit,
    windowQuizRemaining: snap.windowQuizRemaining,
    windowQuizLimit: snap.windowQuizLimit,
    windowResetInMs,
    role: snap.user.role,
  };
}

// ----- Teacher/admin unlimited response -----
function unlimitedSnapshot(role: string) {
  return {
    dailyRemaining: 999,
    dailyLimit: 999,
    dailyResetInMs: 0,
    windowInputRemaining: 999,
    windowInputLimit: 999,
    windowQuizRemaining: 999,
    windowQuizLimit: 999,
    windowResetInMs: 0,
    role,
  };
}

/**
 * Returns the public quota view for a user.
 */
export async function getUserQuotaSnapshot(userId: string) {
  return await prisma.$transaction(async (tx) => {
    const snap = await readUserQuota(tx, userId);

    if (snap.isTeacherOrAdmin) {
      return unlimitedSnapshot(snap.user.role);
    }

    return buildSnapshotFromRead(snap);
  });
}

/**
 * Backwards-compatible entry point: returns the quota snapshot.
 * Use this from server actions that need to *check* the quota without
 * consuming it (e.g. the UI refresh action).
 */
export async function processUserQuota(
  userId: string,
  decrement: boolean = false,
  type: "input" | "quiz" = "input"
) {
  if (!decrement) {
    return await getUserQuotaSnapshot(userId);
  }
  return await consumeUserQuota(userId, type);
}

/**
 * Atomically decrements 1 unit of quota for the given action type.
 *
 * Throws if the user is at the daily cap or window limit.
 *
 * Call this AFTER the underlying work (AI generation, etc.) has succeeded,
 * so a failed upstream call never costs the student a quota slot.
 */
export async function consumeUserQuota(
  userId: string,
  type: "input" | "quiz" = "input"
) {
  return await prisma.$transaction(async (tx) => {
    const snap = await readUserQuota(tx, userId);

    if (snap.isTeacherOrAdmin) {
      // No-op: unlimited
      return unlimitedSnapshot(snap.user.role);
    }

    if (snap.dailyRemaining <= 0) {
      throw new Error(
        "You have used up your daily Socratic helping quota. Please wait for the daily refill."
      );
    }

    if (snap.windowInputRemaining <= 0 && type === "input") {
      throw new Error(
        `You have reached your 45-minute chat quota (${WINDOW_INPUT_LIMIT} per window). Please wait for the window to reset.`
      );
    }
    if (snap.windowQuizRemaining <= 0 && type === "quiz") {
      throw new Error(
        `You have reached your 45-minute quiz quota (${WINDOW_QUIZ_LIMIT} per window). Please wait for the window to reset.`
      );
    }

    const nowMs = Date.now();
    const todayReset = getTodayAtReset();
    const isAfterReset = nowMs >= todayReset.getTime();
    const lastResetMs = snap.user.lastDailyReset.getTime();
    const shouldResetDaily =
      lastResetMs < todayReset.getTime() && isAfterReset;

    const newDailyRemaining = snap.dailyRemaining - 1;
    const newLastReset = shouldResetDaily ? new Date() : snap.user.lastDailyReset;

    // Only add the new timestamp to the relevant window type.
    const updatedInput = type === "input" ? [...snap.validInput, nowMs] : snap.validInput;
    const updatedQuiz = type === "quiz" ? [...snap.validQuiz, nowMs] : snap.validQuiz;

    const updateData: Record<string, string | number | Date> = {
      dailyRemaining: newDailyRemaining,
      lastDailyReset: newLastReset,
      windowInputTimestamps: JSON.stringify(updatedInput),
      windowQuizTimestamps: JSON.stringify(updatedQuiz),
    };

    // When a daily reset happens, also clear the opposite window so the
    // student doesn't carry stale timestamps into a new day.
    if (shouldResetDaily) {
      if (type === "input") {
        updateData.windowQuizTimestamps = "[]";
      } else {
        updateData.windowInputTimestamps = "[]";
      }
    }

    await tx.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Build response from the updated snap — do NOT call getUserQuotaSnapshot
    // here (which would open a nested transaction). Instead use the pure
    // helper that requires no DB round-trip.
    const finalInput = updateData.windowInputTimestamps === "[]" ? [] : updatedInput;
    const finalQuiz = updateData.windowQuizTimestamps === "[]" ? [] : updatedQuiz;
    return buildSnapshotFromRead({
      ...snap,
      dailyRemaining: newDailyRemaining,
      validInput: finalInput,
      validQuiz: finalQuiz,
    });
  });
}
