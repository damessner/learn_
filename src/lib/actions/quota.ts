import { prisma } from "@/lib/db";

// Helper to get the Monday of the week for calendar week comparison
export function getMonday(d: Date): Date {
  const dateCopy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = dateCopy.getDay();
  // day: 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  // We want to calculate the diff to the previous Monday.
  // If Sunday (0), diff is -6. If Monday (1), diff is 0. If Tuesday (2), diff is -1, etc.
  const diff = dateCopy.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(dateCopy.setDate(diff));
}

/**
 * Checks if the daily or weekly boundaries have passed and updates the user's quota.
 * If decrement is true, it also deducts 1 from the remaining quotas (for students).
 */
export async function processUserQuota(
  userId: string,
  decrement: boolean = false
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
        weeklyRemaining: 999,
        weeklyLimit: 999,
        dailyResetInMs: 0,
        weeklyResetInMs: 0,
        role: user.role,
      };
    }

    const now = new Date();
    
    // Check daily boundary
    const dNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dLast = new Date(
      user.lastDailyReset.getFullYear(),
      user.lastDailyReset.getMonth(),
      user.lastDailyReset.getDate()
    );
    const isNewDay = dNow.getTime() !== dLast.getTime();

    // Check weekly boundary
    const mNow = getMonday(now);
    const mLast = getMonday(user.lastWeeklyReset);
    const isNewWeek =
      mNow.getTime() !== mLast.getTime() ||
      Math.abs(now.getTime() - user.lastWeeklyReset.getTime()) >= 7 * 24 * 60 * 60 * 1000;

    let dailyRemaining = isNewDay ? user.dailyLimit : user.dailyRemaining;
    let weeklyRemaining = isNewWeek ? user.weeklyLimit : user.weeklyRemaining;
    let lastDailyReset = isNewDay ? now : user.lastDailyReset;
    let lastWeeklyReset = isNewWeek ? now : user.lastWeeklyReset;

    // Calculate time until next resets
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const dailyResetInMs = nextMidnight.getTime() - now.getTime();

    const nextMonday = new Date(mNow.getFullYear(), mNow.getMonth(), mNow.getDate() + 7);
    const weeklyResetInMs = nextMonday.getTime() - now.getTime();

    if (decrement) {
      if (dailyRemaining <= 0) {
        throw new Error("You have used up your daily Socratic helping quota. Please wait for the daily refill.");
      }
      if (weeklyRemaining <= 0) {
        throw new Error("You have used up your weekly Socratic helping quota. Please wait for the weekly refill.");
      }

      dailyRemaining -= 1;
      weeklyRemaining -= 1;
    }

    // Save changes back to DB if any reset or decrement occurred
    if (isNewDay || isNewWeek || decrement) {
      await tx.user.update({
        where: { id: userId },
        data: {
          dailyRemaining,
          weeklyRemaining,
          lastDailyReset,
          lastWeeklyReset,
        },
      });
    }

    return {
      dailyRemaining,
      dailyLimit: user.dailyLimit,
      weeklyRemaining,
      weeklyLimit: user.weeklyLimit,
      dailyResetInMs,
      weeklyResetInMs,
      role: user.role,
    };
  });
}
