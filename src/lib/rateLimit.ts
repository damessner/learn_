/**
 * Lightweight in-memory rate limiter for login throttling.
 *
 * Tracks failures per key (username + IP) and returns remaining
 * block time when the limit is exceeded.
 *
 * WARNING: This is in-process memory state. It resets on server
 * restart and does not scale across multiple instances. For
 * production multi-instance deployments, replace with a
 * shared store (Redis, etc.).
 */

interface RateLimitEntry {
  count: number;
  blockedUntil: number; // 0 = not blocked
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

// Configuration
const MAX_ATTEMPTS = 5;         // max failures before blocking
const WINDOW_MS = 60_000;       // 1-minute sliding window
const BLOCK_MS = 300_000;       // 5-minute block after exceeding limit

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Check if a given key is rate-limited.
 * Returns the number of milliseconds remaining in the block, or 0 if allowed.
 */
export function checkRateLimit(key: string): { blocked: boolean; remainingMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    return { blocked: false, remainingMs: 0 };
  }

  // If currently blocked, check if block has expired
  if (entry.blockedUntil > now) {
    return { blocked: true, remainingMs: entry.blockedUntil - now };
  }

  // If block expired, clear it
  if (entry.blockedUntil > 0 && entry.blockedUntil <= now) {
    store.delete(key);
    return { blocked: false, remainingMs: 0 };
  }

  // If window expired, reset
  if (entry.windowStart + WINDOW_MS < now) {
    store.delete(key);
    return { blocked: false, remainingMs: 0 };
  }

  return { blocked: false, remainingMs: 0 };
}

/**
 * Record a failed attempt for a given key.
 * If the key exceeds the max attempts within the window, it becomes blocked.
 */
export function recordFailedAttempt(key: string): { blocked: boolean; remainingMs: number } {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || entry.windowStart + WINDOW_MS < now) {
    entry = { count: 0, blockedUntil: 0, windowStart: now };
    store.set(key, entry);
  }

  entry.count++;

  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS;
    return { blocked: true, remainingMs: BLOCK_MS };
  }

  return { blocked: false, remainingMs: 0 };
}

/**
 * Clear rate-limit state for a given key (used on successful login).
 */
export function clearRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Build a composite key from username and IP (best-effort).
 */
export function buildRateLimitKey(username: string, ip?: string): string {
  return `login:${normalizeUsername(username)}:${ip ?? "unknown"}`;
}

/**
 * Test-only helper to clear in-memory limiter state.
 * Must not be called in production.
 */
export function resetRateLimitStoreForTests(): void {
  if (process.env.NODE_ENV === "production") {
    console.warn("resetRateLimitStoreForTests called in production — ignoring");
    return;
  }
  store.clear();
}
