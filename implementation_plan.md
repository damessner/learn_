# Implementation Plan: Critical Platform Audit & Bug-Fix Sprint

**Date:** 2026-06-13  
**Scope:** Full security, correctness, reliability, performance, and maintainability audit of the Next.js 16 educational platform.

---

## Audit Summary

Two independent deep-audits (auth+session+API layer; business-logic+scoring+exercises) identified **23 confirmed bugs** across five severity tiers, plus **5 test-coverage gaps**. All findings are catalogued below with precise fix plans.

---

## Priority Tiers at a Glance

| Tier | Count | Impact |
|------|-------|--------|
| CRITICAL | 7 | Privilege escalation, score manipulation, path traversal |
| HIGH | 9 | Missing auth hardening, scoring correctness, reliability |
| MEDIUM | 7 | Input validation gaps, inconsistent logic, type safety |
| LOW/Tests | 5 | Code hygiene, missing test coverage |

---

## Phase 1 — CRITICAL Fixes

### C1 · IDOR: `assignExercise` / `unassignAssignment` missing classroom ownership check
**File:** [file:///home/damessner/opencode/learn/src/lib/actions/assignment.ts](file:///home/damessner/opencode/learn/src/lib/actions/assignment.ts)  
**Problem:** `assignExercise` creates an assignment in any `classroomId` without verifying the classroom belongs to the calling teacher. `unassignAssignment` deletes any assignment by ID regardless of ownership. Any authenticated teacher can pollute or delete another teacher's classroom assignments.  
**Fix:**
- `assignExercise`: Before creating, query `prisma.classroom.findFirst({ where: { id: classroomId, teacherId: teacher.userId } })` and return `{ error: "Access denied" }` if not found.
- `unassignAssignment`: Before deleting, query `prisma.assignment.findUnique` with `include: { classroom: true }`, verify `classroom.teacherId === teacher.userId`.

---

### C2 · IDOR: All live-quiz teacher actions — no session ownership verification
**File:** [file:///home/damessner/opencode/learn/src/lib/actions/live-quiz.ts](file:///home/damessner/opencode/learn/src/lib/actions/live-quiz.ts)  
**Problem:** `startLiveQuiz`, `endLiveQuestion`, `showLiveLeaderboard`, `nextLiveQuestion`, and `finishLiveQuiz` all call `requireTeacher()` but never verify the `sessionId` belongs to the calling teacher. Any teacher can hijack another teacher's live quiz — end their questions, advance slides, or finalize their quiz.  
**Fix:** After `requireTeacher()` in each of these functions, add:
```ts
const session = await prisma.liveQuizSession.findUnique({ where: { id: sessionId } });
if (!session || session.hostId !== teacher.userId) {
  throw new Error("Access denied");
}
```
For `startLiveQuiz`, the session fetch can be combined with the update. For `nextLiveQuestion`, the already-present fetch is sufficient — add the ownership check after it.

---

### C3 · IDOR: `submitLiveAnswer` — no caller identity validation
**File:** [file:///home/damessner/opencode/learn/src/lib/actions/live-quiz.ts](file:///home/damessner/opencode/learn/src/lib/actions/live-quiz.ts) (lines 135–236)  
**Problem:** Any caller can submit answers attributed to any `participantId` in any session. A malicious student can inflate another participant's score or submit on behalf of a guest without any ownership check.  
**Fix:** After the session check:
1. Fetch `prisma.liveParticipant.findUnique({ where: { id: participantId } })`.
2. Verify `participant.sessionId === sessionId` (participant belongs to this session).
3. If the participant has a linked `userId`, get the current session via `getSession()` and verify `participant.userId === callerSession.userId`.

---

### C4 · Score manipulation: `scoreInteractiveReading` accepts fake question IDs
**File:** [file:///home/damessner/opencode/learn/src/lib/submissionScoring.ts](file:///home/damessner/opencode/learn/src/lib/submissionScoring.ts) (lines 303–328)  
**Problem:** The function counts every `true` value in `solvedQuestions` regardless of whether the key is an actual question ID from the exercise config. A student can send `solvedQuestions: { "page-1": { "fake-id-1": true, "fake-id-2": true } }` and earn 100% without answering any real questions.  
**Fix:** Build a `Set<string>` of all valid question IDs from `config.pages` before counting, then only count solved entries whose IDs are in that set:
```ts
// Collect all valid question IDs from the config
const validQuestionIds = new Set<string>();
Object.values(pages).forEach((page) => {
  const questions = Array.isArray((page as AnyRecord)?.questions)
    ? ((page as AnyRecord).questions as unknown[])
    : [];
  questions.forEach((q) => {
    const qObj = asRecord(q);
    if (qObj?.id) validQuestionIds.add(String(qObj.id));
  });
});

// Only count solved questions whose IDs are in the valid set
Object.values(solvedQuestions).forEach((pageState) => {
  const pageSolved = asRecord(pageState);
  if (!pageSolved) return;
  Object.entries(pageSolved).forEach(([qId, v]) => {
    if (validQuestionIds.has(qId) && v === true) points++;
  });
});
```

---

### C5 · Path traversal: `uploadMedia` — `..` passes filename sanitization
**File:** [file:///home/damessner/opencode/learn/src/lib/actions/exercise.ts](file:///home/damessner/opencode/learn/src/lib/actions/exercise.ts) (lines 151, 160)  
**Problem:** `filename.replace(/[^a-zA-Z0-9.-]/g, "_")` preserves `.` characters, so a filename of `..` or `...jpg` passes, allowing writes outside the `assets/` directory via `path.join`.  
**Fix:** After computing `cleanFilename`:
1. Reject if `cleanFilename` starts with `.` or contains `..`.
2. Verify the resolved path stays within `assetsDir` with a prefix check:
```ts
const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
if (cleanFilename.startsWith(".") || cleanFilename.includes("..") || cleanFilename.length === 0) {
  return { error: "Invalid filename" };
}
const targetPath = path.join(assetsDir, cleanFilename);
if (!targetPath.startsWith(assetsDir + path.sep) && targetPath !== assetsDir) {
  return { error: "Invalid filename" };
}
```

---

### C6 · Path traversal: `getExerciseFromDisk` — no `id` format validation
**File:** [file:///home/damessner/opencode/learn/src/lib/exercises.ts](file:///home/damessner/opencode/learn/src/lib/exercises.ts) (line 398)  
**Problem:** `getExerciseFromDisk(id)` calls `path.join(EXERCISES_DIR, id)` with no validation. Callers from `live-quiz.ts` and `submission.ts` pass IDs that originate from the database (so low risk in production), but callers must validate `id` at the boundary.  
**Fix:** Add a format guard at the top of `getExerciseFromDisk`:
```ts
if (!id || !/^[a-z0-9-]+$/.test(id) || id.length > 128) return null;
```

---

### C7 · Test integrity: `live-quiz.test.ts` tests a local copy, not production code
**File:** [file:///home/damessner/opencode/learn/src/lib/live-quiz.test.ts](file:///home/damessner/opencode/learn/src/lib/live-quiz.test.ts)  
**Problem:** The `evaluateAnswer` function is defined locally inside the test file and mirrors the logic in `submitLiveAnswer`. Any regression in the production function won't be caught.  
**Fix:** Extract the answer-evaluation logic from `submitLiveAnswer` into a pure, exported function `evaluateAnswerCorrectness(question, parsedAnswer): boolean` in `src/lib/actions/live-quiz.ts`. Rewrite `live-quiz.test.ts` to import and test that function directly.

---

## Phase 2 — HIGH Priority Fixes

### H1 · No rate limiting on `/api/auth/register`
**File:** [file:///home/damessner/opencode/learn/src/app/api/auth/register/route.ts](file:///home/damessner/opencode/learn/src/app/api/auth/register/route.ts)  
**Problem:** Unauthenticated callers can create unlimited user accounts in a tight loop (each triggers bcrypt.hash + DB write), enabling DoS and storage exhaustion.  
**Fix:** Add IP-based rate limiting via the existing `rateLimit.ts` module using a `register:{ip}` key. Cap at 10 registrations per IP per 10-minute window.

---

### H2 · Username case sensitivity mismatch in login
**File:** [file:///home/damessner/opencode/learn/src/app/api/auth/login/route.ts](file:///home/damessner/opencode/learn/src/app/api/auth/login/route.ts) (lines 29, 40)  
**Problem:** The rate-limit key uses `normalizeUsername(username)` (lowercased), but the Prisma lookup uses the raw `username`. If the DB is case-sensitive (SQLite default), `Alice` and `alice` yield the same rate-limit bucket but different users — enabling targeted account lockout of user `alice` by sending requests for `Alice`.  
**Fix:** Normalize username to lowercase before **both** the DB lookup and the rate-limit key:
```ts
const normalizedUsername = username.trim().toLowerCase();
// use normalizedUsername for prisma.user.findUnique({ where: { username: normalizedUsername } })
```
Also normalize username at registration time to prevent duplicate accounts differing only in case.

---

### H3 · Input type/length validation missing in auth routes
**Files:** [file:///home/damessner/opencode/learn/src/app/api/auth/login/route.ts](file:///home/damessner/opencode/learn/src/app/api/auth/login/route.ts), [file:///home/damessner/opencode/learn/src/app/api/auth/register/route.ts](file:///home/damessner/opencode/learn/src/app/api/auth/register/route.ts)  
**Problem:** `username` and `password` are destructured from `request.json()` without type guards or length limits. Non-string inputs or multi-megabyte passwords reach bcrypt, causing undefined behavior or CPU/memory waste.  
**Fix:** After destructuring, validate:
```ts
if (typeof username !== "string" || typeof password !== "string") {
  return NextResponse.json({ error: "Invalid input" }, { status: 400 });
}
if (username.length > 64 || password.length > 128) {
  return NextResponse.json({ error: "Input too long" }, { status: 400 });
}
```

---

### H4 · `spellingTolerance: "off"` treated same as "strict" in `matchesKeyword`
**File:** [file:///home/damessner/opencode/learn/src/lib/submissionScoring.ts](file:///home/damessner/opencode/learn/src/lib/submissionScoring.ts) (line 80)  
**Problem:** The condition groups `"off"` with `"strict"` (exact substring match). The schema explicitly allows `"off"` as a distinct value — its intended semantics are the most permissive: the keyword check is disabled and any non-empty response is accepted.  
**Fix:** Separate `"off"` from `"strict"`:
```ts
if (spellingTolerance === "off") return true; // keyword check disabled
if (spellingTolerance === "strict" || !spellingTolerance) {
  return cleanText.includes(cleanKw);
}
// "lenient": Levenshtein
```

---

### H5 · `scoreDragDrop` case-sensitive vs `scoreGapFill` case-insensitive
**File:** [file:///home/damessner/opencode/learn/src/lib/submissionScoring.ts](file:///home/damessner/opencode/learn/src/lib/submissionScoring.ts) (line 145)  
**Problem:** `scoreDragDrop` compares `String(placements[idx]).trim() === ans.trim()` (case-sensitive), while `scoreGapFill` uses `normalize()` (lowercase + trim). A drag-drop answer "Grass" would be marked wrong if the correct answer is "grass".  
**Fix:** Apply `normalize()` to both sides:
```ts
if (normalize(placements[idx]) === normalize(ans)) correct++;
```

---

### H6 · Gemini API calls have no timeout
**File:** [file:///home/damessner/opencode/learn/src/lib/gemini.ts](file:///home/damessner/opencode/learn/src/lib/gemini.ts)  
**Problem:** All three Gemini fetch calls (`fetchWritingCoachFeedback`, `fetchVocabContextChallenge`, `fetchAiCoachReply`) have no `AbortController` timeout. A slow or hung API blocks the request indefinitely.  
**Fix:** Wrap each fetch with an `AbortController` and a 30-second timeout:
```ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30_000);
try {
  const response = await fetch(url, { ..., signal: controller.signal });
  // ...
} finally {
  clearTimeout(timeoutId);
}
```

---

### H7 · `Math.random()` used for live-quiz PIN generation
**File:** [file:///home/damessner/opencode/learn/src/lib/actions/live-quiz.ts](file:///home/damessner/opencode/learn/src/lib/actions/live-quiz.ts) (line 9)  
**Problem:** `Math.random()` is not cryptographically secure. For a 6-digit PIN with 900,000 possibilities, biased or predictable output could allow an attacker to guess active session PINs.  
**Fix:**
```ts
import crypto from "crypto";
function generatePin(): string {
  return crypto.randomInt(100000, 1000000).toString();
}
```

---

### H8 · `nextLiveQuestion` — no upper-bound check on question index
**File:** [file:///home/damessner/opencode/learn/src/lib/actions/live-quiz.ts](file:///home/damessner/opencode/learn/src/lib/actions/live-quiz.ts) (lines 273–292)  
**Problem:** When the teacher advances past the last question, the session enters `QUESTION` status with an out-of-bounds `currentQuestionIdx`. Students receive "Question not found" but the session is stuck in a QUESTION state permanently (until `finishLiveQuiz` is called separately).  
**Fix:** Load the exercise config and check bounds before advancing:
```ts
const exercise = getExerciseFromDisk(session.exerciseId);
const nextIdx = session.currentQuestionIdx + 1;
if (!exercise || nextIdx >= exercise.questions.length) {
  return { error: "No more questions. Please finish the quiz." };
}
```

---

### H9 · `finishLiveQuiz` hardcodes multiplier, duplicating `getAttemptMultiplier`
**File:** [file:///home/damessner/opencode/learn/src/lib/actions/live-quiz.ts](file:///home/damessner/opencode/learn/src/lib/actions/live-quiz.ts) (line 365)  
**Problem:** Inline ternary chain `attemptNumber === 1 ? 1.0 : attemptNumber === 2 ? 0.75 : ...` duplicates `getAttemptMultiplier` from `src/lib/scoring.ts`. If the scoring rules change, only one copy gets updated.  
**Fix:** Import and use `getAttemptMultiplier`:
```ts
import { getAttemptMultiplier } from "@/lib/scoring";
// ...
const multiplier = getAttemptMultiplier(attemptNumber);
```

---

## Phase 3 — MEDIUM Priority Fixes

### M1 · `createWorksheet`: `parsedContent` spread overrides validated fields
**File:** [file:///home/damessner/opencode/learn/src/lib/actions/exercise.ts](file:///home/damessner/opencode/learn/src/lib/actions/exercise.ts) (lines 84–92)  
**Problem:** `const jsonContent = { id, title, description, type, tags, ...parsedContent }` — a malicious teacher can send JSON with a `type` field that overrides the validated `type`, changing an exercise type post-validation.  
**Fix:** Ensure spread comes before (lower priority than) the validated fields:
```ts
const jsonContent = { ...parsedContent, id, title, description, type, tags: tags || "" };
```

---

### M2 · `duplicateExercise`: frontmatter regex is unscoped
**File:** [file:///home/damessner/opencode/learn/src/lib/actions/exercise.ts](file:///home/damessner/opencode/learn/src/lib/actions/exercise.ts) (lines 249–250)  
**Problem:** `content.replace(/^id:\s*.*$/m, ...)` uses multiline mode and will match `id:` at the start of any line in the document body, not just in the frontmatter block. A question that happens to start with `id:` will be incorrectly replaced.  
**Fix:** Scope the replacement to the frontmatter block only by finding the `---` markers and replacing only within that range.

---

### M3 · `uploadMedia`: base64 decoded before size check
**File:** [file:///home/damessner/opencode/learn/src/lib/actions/exercise.ts](file:///home/damessner/opencode/learn/src/lib/actions/exercise.ts) (lines 156–158)  
**Problem:** `Buffer.from(base64Data, "base64")` allocates the full buffer before the size check, allowing OOM on very large inputs.  
**Fix:** Check the estimated decoded size before allocating:
```ts
const estimatedBytes = (base64Data.length * 3) / 4;
if (estimatedBytes > 10 * 1024 * 1024) {
  return { error: "Upload failed: File exceeds the 10MB limit." };
}
const buffer = Buffer.from(base64Data, "base64");
if (buffer.length > 10 * 1024 * 1024) {
  return { error: "Upload failed: File exceeds the 10MB limit." };
}
```

---

### M4 · `resetStudentPassword`: minimum 4 chars, inconsistent with registration (6) and bulk import (8)
**File:** [file:///home/damessner/opencode/learn/src/lib/actions/classroom.ts](file:///home/damessner/opencode/learn/src/lib/actions/classroom.ts) (line 48)  
**Problem:** A teacher can set a student's password to 4 characters, weaker than the 6-char minimum enforced at registration.  
**Fix:** Raise the minimum to 6 to match registration:
```ts
if (!newPasswordStr || newPasswordStr.length < 6 || newPasswordStr.length > 128) {
  return { error: "Password must be between 6 and 128 characters." };
}
```

---

### M5 · `joinLiveSession`: no length limits on `pin` or `nickname`
**File:** [file:///home/damessner/opencode/learn/src/lib/actions/live-quiz.ts](file:///home/damessner/opencode/learn/src/lib/actions/live-quiz.ts) (lines 55–61)  
**Problem:** A 1MB nickname string is accepted and stored. No limit enables storage bloat and potential DB column overflow.  
**Fix:**
```ts
if (cleanPin.length > 6 || cleanPin.length < 6) {
  return { error: "PIN must be exactly 6 digits." };
}
if (cleanNickname.length > 50) {
  return { error: "Nickname must be 50 characters or fewer." };
}
```

---

### M6 · `overrideSubmissionGrade`: `feedback` type not validated
**File:** [file:///home/damessner/opencode/learn/src/lib/actions/submission.ts](file:///home/damessner/opencode/learn/src/lib/actions/submission.ts) (lines 133–135)  
**Problem:** `feedback && feedback.length > 5000` — if `feedback` is a non-string (e.g., a number), `.length` is `undefined`, the check is skipped, and Prisma throws a runtime error that surfaces as a generic "Failed to override grade".  
**Fix:**
```ts
if (feedback !== undefined && feedback !== null && typeof feedback !== "string") {
  return { error: "Feedback must be a string" };
}
if (typeof feedback === "string" && feedback.length > 5000) {
  return { error: "Feedback must be 5000 characters or fewer" };
}
```

---

### M7 · `getSession`: no structural validation after decryption
**File:** [file:///home/damessner/opencode/learn/src/lib/session.ts](file:///home/damessner/opencode/learn/src/lib/session.ts) (lines 51–55)  
**Problem:** `JSON.parse(decrypted) as SessionData` — the cast is unsafe. If the session payload is ever malformed (e.g., migrated away from an old format), it will return an incomplete object that crashes downstream when `session.userId` is accessed.  
**Fix:** Add a minimal runtime validation:
```ts
const parsed = JSON.parse(decrypted);
if (
  typeof parsed?.userId !== "string" ||
  typeof parsed?.username !== "string" ||
  (parsed?.role !== "TEACHER" && parsed?.role !== "STUDENT")
) {
  return null;
}
return parsed as SessionData;
```

---

## Phase 4 — LOW Priority & Test Coverage

### L1 · `rateLimit.ts`: test-only export not guarded by NODE_ENV
**File:** [file:///home/damessner/opencode/learn/src/lib/rateLimit.ts](file:///home/damessner/opencode/learn/src/lib/rateLimit.ts) (lines 102–104)  
**Fix:** Guard with `if (process.env.NODE_ENV !== "production")` or add a comment documenting the risk.

### L2 · `submissionScoring.ts`: duplicate type aliases
**File:** [file:///home/damessner/opencode/learn/src/lib/submissionScoring.ts](file:///home/damessner/opencode/learn/src/lib/submissionScoring.ts) (lines 11–12)  
**Fix:** Remove `AnyRecord`, use `UnknownRecord` throughout.

### L3 · Live-quiz: extract pure `evaluateAnswerCorrectness` function and write real tests
**Files:** [file:///home/damessner/opencode/learn/src/lib/actions/live-quiz.ts](file:///home/damessner/opencode/learn/src/lib/actions/live-quiz.ts), [file:///home/damessner/opencode/learn/src/lib/live-quiz.test.ts](file:///home/damessner/opencode/learn/src/lib/live-quiz.test.ts)  
**Fix:** Extract the answer-checking block in `submitLiveAnswer` into an exported pure function. Rewrite the test file to import and test it.

### L4 · Add missing test cases to `submissionScoring.test.ts`
**File:** [file:///home/damessner/opencode/learn/src/lib/submissionScoring.test.ts](file:///home/damessner/opencode/learn/src/lib/submissionScoring.test.ts)  
**Cases to add:**
- `scoreInteractiveReading` with fake question IDs (should NOT inflate score post-fix)
- `scoreInteractiveReading` with 0 total questions (should return 100)
- `scoreDragDrop` with mismatched case (should pass post-fix)
- `scoreOpenQuestion` with `spellingTolerance: "off"` (should return 100 post-fix)
- `scoreOpenQuestion` with forbidden keyword match (should return 0)
- `scoreWritingCoach` with 0 criteria (returns 100)
- `scoreOrdering` with mismatched `placed`/`shuffled` lengths (returns 0)
- `scoreMatching` with trailing whitespace in `rightText`

### L5 · Add missing edge cases to `scoring.test.ts`
**File:** [file:///home/damessner/opencode/learn/src/lib/scoring.test.ts](file:///home/damessner/opencode/learn/src/lib/scoring.test.ts)  
**Cases to add:**
- `getAttemptMultiplier(0)` → `0.25` (should not special-case; document this)
- `getAttemptMultiplier(5)` → `0.25`
- `getAttemptMultiplier(Infinity)` → `0.25`

---

## Files Modified

| File | Phase |
|------|-------|
| `src/lib/actions/assignment.ts` | C1 |
| `src/lib/actions/live-quiz.ts` | C2, C3, H7, H8, H9, M5, L3 |
| `src/lib/submissionScoring.ts` | C4, H4, H5, L2 |
| `src/lib/actions/exercise.ts` | C5, M1, M2, M3 |
| `src/lib/exercises.ts` | C6 |
| `src/lib/live-quiz.test.ts` | C7, L3 |
| `src/app/api/auth/register/route.ts` | H1, H3 |
| `src/app/api/auth/login/route.ts` | H2, H3 |
| `src/lib/gemini.ts` | H6 |
| `src/lib/actions/classroom.ts` | M4 |
| `src/lib/actions/submission.ts` | M6 |
| `src/lib/session.ts` | M7 |
| `src/lib/rateLimit.ts` | L1 |
| `src/lib/submissionScoring.test.ts` | L4 |
| `src/lib/scoring.test.ts` | L5 |

---

## Execution Checklist (`task.md`)

Will be created at approval. Each item maps 1:1 to a fix above, tracked with `[ ]` / `[/]` / `[x]`.

---

## Out of Scope (by design or deferred)

- **In-memory rate limiter**: acceptable for single-instance SQLite deployment; noted with production warning.
- **CSRF tokens**: `SameSite=Lax` provides adequate CSRF protection; full token system deferred.
- **`__Host-` cookie prefix**: requires HTTPS enforcement at infra level; deferred.
- **`scoreInteractiveReading` returning 100 for 0 questions**: intentional (no questions = full participation credit).
- **`scoreWritingCoach` returning 100 for 0 criteria**: intentional (no rubric = full credit).
- **Course multi-tenancy**: Courses are deliberately global (no `createdById`) per current design.
- **Redis rate limiting**: no multi-instance deployment; in-memory is sufficient for this stack.
