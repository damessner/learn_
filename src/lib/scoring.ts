/**
 * Score multiplier by attempt number.
 * Attempt 1 = 100%, Attempt 2 = 75%, Attempt 3 = 50%, Attempt 4+ = 25%
 */
export function getAttemptMultiplier(attemptNumber: number): number {
  if (attemptNumber === 1) return 1.0;
  if (attemptNumber === 2) return 0.75;
  if (attemptNumber === 3) return 0.5;
  return 0.25;
}