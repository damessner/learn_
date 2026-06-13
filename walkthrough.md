# Walkthrough: Critical Review Remediation (Execution)

## What was implemented

### 1) Server-authoritative scoring (integrity fix)

**Files:**
- `file:///home/damessner/opencode/learn/src/lib/submissionScoring.ts` (new)
- `file:///home/damessner/opencode/learn/src/lib/actions/submission.ts`
- `file:///home/damessner/opencode/learn/src/app/assignments/[id]/AssignmentPlayer.tsx`

**Changes:**
- Submission persistence no longer trusts client-provided scores.
- Server now computes score from exercise definition + submitted answers.
- Added payload validation (`answers` object shape + max size).
- Added score sanity validation for client payload.
- Disabled auto-awarding 100% for open-question media-only answers on server (requires teacher review path).
- Server returns computed raw score in response and UI displays returned score.

**Impact:** closes core score tampering vulnerability.

---

### 2) Asset serving hardening

**File:**
- `file:///home/damessner/opencode/learn/src/app/api/exercises/[exerciseId]/assets/[...path]/route.ts`

**Changes:**
- Added auth requirement (`401` if no session).
- Added path-part traversal rejection (`..`, slash/backslash segments).
- Blocks `index.json`/`index.md` case-insensitively.
- Restricts resolved file path to the target exercise directory only.
- Supports legacy root files and `assets/` files safely.
- Adds `X-Content-Type-Options: nosniff` header.

**Impact:** prevents config leakage/traversal and cross-exercise file reads.

---

### 3) Upload hardening

**Files:**
- `file:///home/damessner/opencode/learn/src/app/api/exercises/[exerciseId]/assets/upload/route.ts`
- `file:///home/damessner/opencode/learn/src/app/api/submissions/upload/route.ts`
- `file:///home/damessner/opencode/learn/src/lib/actions/exercise.ts`

**Changes:**
- Added extension allowlists in API upload routes.
- Explicitly blocks SVG by omission from allowlists.
- Corrected size constants (`10*1024*1024`, `20*1024*1024`).
- Sanitized outward error responses (`Upload failed`, no raw internal messages).
- Replaced submission filename randomness with `crypto.randomUUID()`.

**Impact:** reduces risky file upload vectors and information leakage.

---

### 4) Login throttling

**Files:**
- `file:///home/damessner/opencode/learn/src/lib/rateLimit.ts` (new)
- `file:///home/damessner/opencode/learn/src/app/api/auth/login/route.ts`

**Changes:**
- Added in-memory rate limiter keyed by normalized username + IP.
- 5 failed attempts in 1 minute ⇒ 5 minute block.
- Uses generic auth error text while blocked.
- Clears key on successful login.

**Impact:** raises resistance against brute-force login attempts.

---

### 5) Secure join codes

**File:**
- `file:///home/damessner/opencode/learn/src/lib/actions/auth-helpers.ts`

**Changes:**
- Replaced `Math.random()` with `crypto.randomBytes()`.
- Maintains 6-char uppercase alphanumeric format.

**Impact:** removes predictable PRNG usage for join codes.

---

### 6) Transactional critical flows

**Files:**
- `file:///home/damessner/opencode/learn/src/lib/actions/classroom.ts`
- `file:///home/damessner/opencode/learn/src/lib/actions/course.ts`

**Changes:**
- Wrapped bulk student import in `prisma.$transaction`.
- Wrapped course exercise reorder in `prisma.$transaction`.
- Wrapped assign-course (courseAssignment + assignment creates) in `prisma.$transaction`.

**Impact:** prevents partial writes in multi-step operations.

---

### 7) Boundary input/error hardening

**Files:**
- `file:///home/damessner/opencode/learn/src/lib/actions/submission.ts`
- `file:///home/damessner/opencode/learn/src/lib/actions/classroom.ts`
- `file:///home/damessner/opencode/learn/src/lib/actions/course.ts`
- `file:///home/damessner/opencode/learn/src/lib/actions/assignment.ts`
- `file:///home/damessner/opencode/learn/src/lib/actions/exercise.ts`

**Changes:**
- Added length/shape/range checks for IDs, text fields, due dates, and numeric values.
- Sanitized several outward error responses to avoid exposing internals.
- Bulk import now requires explicit password (no insecure implicit default).

---

### 8) Test infrastructure + tests

**Files added/updated:**
- `file:///home/damessner/opencode/learn/vitest.config.ts` (new)
- `file:///home/damessner/opencode/learn/package.json`
- `file:///home/damessner/opencode/learn/src/lib/scoring.test.ts` (new)
- `file:///home/damessner/opencode/learn/src/lib/points.test.ts` (new)
- `file:///home/damessner/opencode/learn/src/lib/actions/auth-helpers.test.ts` (new)
- `file:///home/damessner/opencode/learn/src/lib/rateLimit.test.ts` (new)
- `file:///home/damessner/opencode/learn/src/lib/submissionScoring.test.ts` (new)

**Coverage implemented:**
- Attempt multiplier behavior
- Points utilities
- Join code format/randomness
- Rate limiter behavior
- Submission scoring + validation behavior

---

## Verification results

### `npm run test`
- **PASS**
- Test files: 5
- Tests: 54 passed

### `npm run build`
- **PASS**
- Next build + TS completed successfully

### `npm run lint`
- **FAIL (pre-existing baseline debt)**
- 134 total issues reported (`77 errors`, `57 warnings`), mostly existing `no-explicit-any`, hooks lint issues, and JSX key/unescaped-entities issues across unrelated files.
- No additional broad lint cleanup was performed in this sprint to avoid scope explosion.

---

## Deferred / remaining follow-ups

1. API-route regression tests (auth/assets/uploads) were deferred for this sprint.
2. Current login limiter is in-memory (single-process scope); for distributed deployment, move to shared store (Redis/DB).
3. Asset access is currently authenticated but not yet enrollment/ownership-scoped per assignment context.

---

## Lint Debt Remediation Follow-up (Completed)

After the above walkthrough was documented, a dedicated repo-wide lint remediation pass was executed.

### Scope

Fixed app-layer, widget-layer, and lib-layer lint debt including:

- `@typescript-eslint/no-explicit-any`
- `@typescript-eslint/no-unused-vars`
- `react/jsx-key`
- `react/no-unescaped-entities`
- `react-hooks/immutability`
- `react-hooks/exhaustive-deps`
- `react-hooks/set-state-in-effect`
- `@next/next/no-img-element`

### Representative files touched

- `file:///home/damessner/opencode/learn/src/app/assignments/[id]/AssignmentPlayer.tsx`
- `file:///home/damessner/opencode/learn/src/app/submissions/[id]/SubmissionReviewPlayer.tsx`
- `file:///home/damessner/opencode/learn/src/app/teacher/create/WorksheetCreator.tsx`
- `file:///home/damessner/opencode/learn/src/components/widgets/Vocabulary.tsx`
- `file:///home/damessner/opencode/learn/src/components/widgets/OpenQuestion.tsx`
- `file:///home/damessner/opencode/learn/src/components/widgets/ExploreImageMap.tsx`
- `file:///home/damessner/opencode/learn/src/lib/points.ts`
- `file:///home/damessner/opencode/learn/src/lib/exercises.ts`

### Verification (post-remediation)

#### `npm run lint`
- **PASS** (0 errors, 0 warnings)

#### `npm run test`
- **PASS** (54 passed)

#### `npm run build`
- **PASS**

### Notes

- No ESLint rule relaxations/config bypasses were used.
- Behavior-preserving refactors were preferred; typing is stricter and dead code/import noise was removed.

---

## README Review & Update (Completed)

We reviewed and completely rewrote the `README.md` to reflect all recent additions in the codebase.

### Scope of README Updates

1. **Teacher Features**: Documented the unified Gradebook roster matrix, bulk student import (CSV/JSON), student password reset, Gradebook CSV export, course drag-and-drop mechanics, and soft-delete features.
2. **Student Features**: Documented autocorrect protection for iPad inputs, direct in-browser voice recording (audio submissions), picture uploads for open questions, and progress dashboard metrics.
3. **Advanced Open Question Rubric**: Documented required, bonus, and forbidden keywords, Levenshtein spelling tolerance rules, custom weights, and the media-only teacher-review flow.
4. **Security & Hardening Section**: Documented server-authoritative scoring, cryptographic secure join codes, API/asset isolation patterns, upload allowlists, brute-force rate-limiting, and Prisma database transaction wrappers.
5. **Testing suite**: Added details on running unit tests with Vitest.
6. **Project Structure & Config**: Refreshed the project layout tree mapping and documented all new optional/required environment variables (like `GEMINI_API_KEY`, `GEMINI_MODEL`, and `SESSION_SECRET`).

### Verification
- Ran `npm run test` &rarr; All 54 tests passed.
- Ran `npm run build` &rarr; Succeeded without any compile or lint errors.
