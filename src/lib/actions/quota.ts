import { prisma } from "@/lib/db";

const WINDOW_MS = 45 * 60 * 1000; // 45 minutes
const WINDOW_INPUT_LIMIT = 30;
const WINDOW_QUIZ_LIMIT = 5;

// Helper to get today's 07:55 Date
export function getTodayAt0755(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 55, 0, 0);
}

/**
 * Filters timestamps to only those within the last `windowMs` milliseconds.
 */
function filterTimestamps(timestamps: number[], windowMs: number, now: number): number[] {
  return timestamps.filter((ts) => now - ts < windowMs);
}

/**
 * Processes the user quota for a given action type.
 *
 * For TEACHER/ADMIN: returns unlimited.
 * For STUDENT:
 *   1. Checks daily reset at 07:55 — resets if needed, rejects if 0 remaining.
 *   2. Checks sliding 45-min window for the given type — rejects if at limit.
 *   3. If decrement: deducts 1 daily, adds current timestamp to the window array.
 *
 * @param userId  The user's ID.
 * @param decrement  Whether to consume one unit of quota.
 * @param type  "input" for chat inputs, "quiz" for learning sessions.
 */
export async function processUserQuota(
  userId: string,
  decrement: boolean = false,
  type: "input" | "quiz" = "input"
) {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Teachers and admins have unlimited quotas
    if (user.role === "TEACHER" || user.role === "ADMIN") {
      return {
        dailyRemaining: 999,
        dailyLimit: 999,
        dailyResetInMs: 0,
        windowInputRemaining: 999,
        windowInputLimit: 999,
        windowQuizRemaining: 999,
        windowQuizLimit: 999,
        windowResetInMs: 0,
        role: user.role,
      };
    }

    const now = new Date();
    const nowMs = now.getTime();
    const today0755 = getTodayAt0755();
    const isAfterReset = nowMs >= today0755.getTime();

    // --- Daily reset check (07:55) ---
    const lastResetMs = user.lastDailyReset.getTime();
    // Reset if lastDailyReset is before today's 07:55 AND we're past 07:55 now
    const shouldResetDaily = lastResetMs < today0755.getTime() && isAfterReset;

    let dailyRemaining = shouldResetDaily ? user.dailyLimit : user.dailyRemaining;
    let lastDailyReset = shouldResetDaily ? now : user.lastDailyReset;

    if (dailyRemaining <= 0) {
      throw new Error("You have used up your daily Socratic helping quota. Please wait for the daily refill.");
    }

    // --- Sliding window checks ---
    let windowTimestamps: number[];
    const windowLimit = type === "input" ? WINDOW_INPUT_LIMIT : WINDOW_QUIZ_LIMIT;
    const windowField =
      type === "input" ? "windowInputTimestamps" : "windowQuizTimestamps";

    try {
      windowTimestamps = JSON.parse(
        type === "input" ? user.windowInputTimestamps : user.windowQuizTimestamps
      );
    } catch {
      windowTimestamps = [];
    }

    // Filter to last 45 minutes
    const validTimestamps = filterTimestamps(windowTimestamps, WINDOW_MS, nowMs);
    const windowRemaining = Math.max(0, windowLimit - validTimestamps.length);

    if (windowRemaining <= 0) {
      const label = type === "input" ? "chat" : "quiz";
      throw new Error(
        `You have reached your 45-minute ${label} quota (${windowLimit} per window). Please wait for the window to reset.`
      );
    }

    // --- Update data if decrementing ---
    if (decrement) {
      dailyRemaining -= 1;
      validTimestamps.push(nowMs);

      const updateData: Record<string, any> = {
        dailyRemaining,
        lastDailyReset,
      };
      updateData[windowField] = JSON.stringify(validTimestamps);

      if (shouldResetDaily) {
        // When resetting, also reset the opposite window (since it's a new day)
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
    }

    // --- Calculate window reset time ---
    // Find oldest timestamp in the valid window — that's when the next slot opens (45 min after it)
    let windowResetInMs = 0;
    if (validTimestamps.length > 0) {
      const oldest = Math.min(...validTimestamps);
      const slotFreeAt = oldest + WINDOW_MS;
      windowResetInMs = Math.max(0, slotFreeAt - nowMs);
    }

    // --- Calculate daily reset time (next 07:55) ---
    const next0755 = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + (isAfterReset ? 1 : 0),
      7, 55, 0, 0
    );
    const dailyResetInMs = next0755.getTime() - nowMs;

    // Compute both window remainings for the response
    let windowInputTimestamps: number[] = [];
    let windowQuizTimestamps: number[] = [];
    try {
      windowInputTimestamps = JSON.parse(user.windowInputTimestamps);
    } catch { /* empty */ }
    try {
      windowQuizTimestamps = JSON.parse(user.windowQuizTimestamps);
    } catch { /* empty */ }

    const validInputTimestamps = filterTimestamps(windowInputTimestamps, WINDOW_MS, nowMs);
    const validQuizTimestamps = filterTimestamps(windowQuizTimestamps, WINDOW_MS, nowMs);
    const windowInputRemaining = Math.max(0, WINDOW_INPUT_LIMIT - validInputTimestamps.length);
    const windowQuizRemaining = Math.max(0, WINDOW_QUIZ_LIMIT - validQuizTimestamps.length);

    return {
      dailyRemaining,
      dailyLimit: user.dailyLimit,
      dailyResetInMs,
      windowInputRemaining,
      windowInputLimit: WINDOW_INPUT_LIMIT,
      windowQuizRemaining,
      windowQuizLimit: WINDOW_QUIZ_LIMIT,
      windowResetInMs,
      role: user.role,
    };
  });
}
