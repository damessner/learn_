# Walkthrough: Critical Platform Audit & Bug-Fix Sprint

**Date:** 2026-06-13  
**Result:** 28 bugs fixed across 15 source files + 2 test files significantly expanded.  
**Tests:** 99 passing (was 66) · TypeScript: 0 errors

---

## Summary of Changes

### Phase 1 — CRITICAL (7 fixes)

#### C1 — IDOR: Assignment ownership verification
**File:** `src/lib/actions/assignment.ts`  
`assignExercise` now verifies the target classroom belongs to the calling teacher before creating an assignment. `unassignAssignment` verifies assignment ownership before deletion. Both return `{ error: "Access denied" }` on unauthorized access.

#### C2 — IDOR: Live-quiz session ownership
**File:** `src/lib/actions/live-quiz.ts`  
All five teacher-facing quiz-control functions (`startLiveQuiz`, `endLiveQuestion`, `showLiveLeaderboard`, `nextLiveQuestion`, `finishLiveQuiz`) now verify `session.hostId === teacher.userId` before making any changes.

#### C3 — IDOR: `submitLiveAnswer` caller identity
**File:** `src/lib/actions/live-quiz.ts`  
Added two-step validation: (1) the `participantId` must belong to the given `sessionId`; (2) if the participant has a linked `userId`, the caller's session must match that userId. Prevents score stealing and impersonation.

#### C4 — Score manipulation: `scoreInteractiveReading`
**File:** `src/lib/submissionScoring.ts`  
The function now builds a `Set<string>` of all real question IDs from the exercise config before counting solved questions. Only IDs present in the valid set are counted. Sending fake IDs no longer inflates the score.

#### C5 — Path traversal: `uploadMedia` filename
**File:** `src/lib/actions/exercise.ts`  
Added filename traversal guards: rejects filenames that are empty, start with `.`, or contain `..`. Added a `path.resolve` check to confirm the target write path stays within the `assetsDir`. Size estimation check now runs before decoding (OOM prevention, M3 co-fix).

#### C6 — Path traversal: `getExerciseFromDisk`
**File:** `src/lib/exercises.ts`  
Added a format guard at the start of `getExerciseFromDisk`: IDs must match `/^[a-z0-9-]+$/` and be ≤128 characters. Returns `null` immediately for any non-conforming ID.

#### C7 — Test integrity: live quiz tests
**Files:** `src/lib/live-quiz-utils.ts` (new), `src/lib/actions/live-quiz.ts`, `src/lib/live-quiz.test.ts`  
Extracted the pure answer-evaluation logic into `src/lib/live-quiz-utils.ts` as `evaluateAnswerCorrectness` and `calculateLiveQuizPoints`. The test file now imports and tests these production functions directly (19 test cases). The `"use server"` module no longer contains a second copy of this logic.

---

### Phase 2 — HIGH (9 fixes)

#### H1 — Rate limiting on registration
**File:** `src/app/api/auth/register/route.ts`  
Added IP-based rate limiting using the existing `rateLimit.ts` module (key: `register:{ip}`). Each registration attempt is recorded; blocked IPs receive a 429 response.

#### H2 — Username case sensitivity in login
**File:** `src/app/api/auth/login/route.ts`  
Username is now lowercased before both the DB lookup and the rate-limit key. This prevents a targeted lockout where an attacker sends `Alice` to lock out the user `alice`.  
`register/route.ts` stores normalized usernames to prevent duplicate accounts differing only by case.

#### H3 — Input type/length validation
**Files:** `src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts`  
Added explicit `typeof` guards for `username` and `password`. Added length caps (username ≤64, password ≤128) that reject over-length inputs before reaching bcrypt.

#### H4 — `spellingTolerance: "off"` fix
**File:** `src/lib/submissionScoring.ts`  
`matchesKeyword` now returns `true` immediately when `spellingTolerance === "off"`, disabling the keyword check as documented. Previously, "off" was silently treated as "strict" (exact substring match).

#### H5 — `scoreDragDrop` case normalization
**File:** `src/lib/submissionScoring.ts`  
Drag-drop scoring now uses `normalize()` (trim + lowercase) on both sides of the comparison, matching the existing behavior in `scoreGapFill`. "Grass" and "grass" are now treated as equal.

#### H6 — Gemini API timeout
**File:** `src/lib/gemini.ts`  
All three fetch calls now use an `AbortController` with a 30-second timeout, wrapped in `try/finally` to clear the timeout. A hung Gemini API will now abort after 30s instead of blocking indefinitely.

#### H7 — Cryptographically secure PIN generation
**File:** `src/lib/actions/live-quiz.ts`  
Replaced `Math.floor(100000 + Math.random() * 900000)` with `crypto.randomInt(100000, 1000000)`. PINs are now generated from a CSPRNG.

#### H8 — `nextLiveQuestion` bounds check
**File:** `src/lib/actions/live-quiz.ts`  
Before advancing, the function now loads the exercise config and verifies `nextIdx < exercise.questions.length`. Returns `{ error: "No more questions. Please finish the quiz." }` if at the last question, preventing a stuck QUESTION state.

#### H9 — Remove hardcoded multiplier table
**File:** `src/lib/actions/live-quiz.ts`  
Replaced the inline ternary chain in `finishLiveQuiz` with `getAttemptMultiplier(attemptNumber)` from `@/lib/scoring`. Score multiplier logic is now defined in one place.

---

### Phase 3 — MEDIUM (7 fixes)

#### M1 — `parsedContent` field-order override
**File:** `src/lib/actions/exercise.ts`  
In `createWorksheet`, the JSON content object now spreads `parsedContent` first, then applies the validated `id`, `title`, `description`, `type`, `tags` fields on top. A user-supplied `type` field can no longer override the validated exercise type.

#### M2 — Frontmatter regex scope in `duplicateExercise`
**File:** `src/lib/actions/exercise.ts`  
The `id:` and `title:` replacement regexes in `duplicateExercise` are now scoped to the YAML frontmatter block (between `---` markers). Body text starting with `id:` on its own line is no longer incorrectly modified.

#### M3 — OOM prevention in `uploadMedia`
**File:** `src/lib/actions/exercise.ts`  
An estimated size check (`base64Data.length * 3 / 4 > 10MB`) now runs before `Buffer.from()`, preventing a large base64 string from allocating a ~750MB buffer before being rejected.

#### M4 — Consistent password minimum
**File:** `src/lib/actions/classroom.ts`  
`resetStudentPassword` minimum password length raised from 4 to 6 characters, matching the registration endpoint minimum. Error message updated.

#### M5 — Input length limits in `joinLiveSession`
**File:** `src/lib/actions/live-quiz.ts`  
PIN must now be exactly 6 numeric digits. Nickname is capped at 50 characters.

#### M6 — `feedback` type validation
**File:** `src/lib/actions/submission.ts`  
`overrideSubmissionGrade` now checks `typeof feedback !== "string"` before checking `feedback.length`. Non-string feedback values return a typed error instead of crashing at the Prisma call.

#### M7 — `getSession` structural validation
**File:** `src/lib/session.ts`  
After decrypting and parsing the session cookie, the payload is now validated: `userId` and `username` must be strings, `role` must be `"TEACHER"` or `"STUDENT"`. Malformed or migrated tokens return `null` instead of crashing downstream callers.

---

### Phase 4 — LOW + Tests (5 items)

#### L1 — Production guard on test helper
**File:** `src/lib/rateLimit.ts`  
`resetRateLimitStoreForTests` now logs a warning and returns early when `NODE_ENV === "production"`, preventing accidental invocation.

#### L2 — Remove duplicate type alias
**File:** `src/lib/submissionScoring.ts`  
Removed the `AnyRecord` type alias (identical to `UnknownRecord`). All 16 occurrences updated to use `UnknownRecord`.

#### L3 — Live quiz tests: real production code
**Files:** `src/lib/live-quiz-utils.ts`, `src/lib/live-quiz.test.ts`  
The test file now imports `evaluateAnswerCorrectness` and `calculateLiveQuizPoints` from the new pure-function module. 19 test cases cover all 4 question types, edge cases (empty arrays, non-array inputs, missing accepted answers, unknown types), and the points decay formula.

#### L4 — `submissionScoring.test.ts` expanded
**File:** `src/lib/submissionScoring.test.ts`  
Added 6 new describe blocks with 17 tests covering: fake ID injection (C4 regression test), drag-drop case normalization (H5 regression test), `spellingTolerance: "off"` (H4 regression test), forbidden keywords, writing coach with no criteria, and ordering with length mismatches.

#### L5 — `scoring.test.ts` edge cases
**File:** `src/lib/scoring.test.ts`  
Added 3 tests for `getAttemptMultiplier` with edge-case inputs: attempt 0, negative attempt numbers, and Infinity — all correctly return the 4th-tier multiplier (0.25).

---

## Files Changed (17 total)

| File | Changes |
|------|---------|
| `src/lib/actions/assignment.ts` | C1: Ownership checks |
| `src/lib/actions/live-quiz.ts` | C2, C3, H7, H8, H9, M5: Multiple security + correctness fixes |
| `src/lib/live-quiz-utils.ts` | **NEW** — Pure utility functions extracted for testability |
| `src/lib/submissionScoring.ts` | C4, H4, H5, L2: Score security + consistency fixes |
| `src/lib/actions/exercise.ts` | C5, M1, M2, M3: Path traversal + field order + regex scope |
| `src/lib/exercises.ts` | C6: Input validation guard |
| `src/app/api/auth/register/route.ts` | H1, H3: Rate limiting + input validation |
| `src/app/api/auth/login/route.ts` | H2, H3: Username normalization + input validation |
| `src/lib/gemini.ts` | H6: AbortController timeout on all fetch calls |
| `src/lib/actions/classroom.ts` | M4: Password minimum raised to 6 |
| `src/lib/actions/submission.ts` | M6: Feedback type validation |
| `src/lib/session.ts` | M7: Session payload structural validation |
| `src/lib/rateLimit.ts` | L1: Production guard on test helper |
| `src/lib/live-quiz.test.ts` | C7, L3: Rewritten to test production code |
| `src/lib/submissionScoring.test.ts` | L4: 17 new edge-case tests |
| `src/lib/scoring.test.ts` | L5: 3 edge-case tests |

---

## Verification Results

```
Test Files  6 passed (6)
     Tests  99 passed (99)   [was 66 before sprint]
  TypeScript: 0 errors (tsc --noEmit)
```

No regressions introduced. All pre-existing tests continue to pass.
