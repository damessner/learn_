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

---

## Live Quiz Standalone Exercise Type (Completed)

We implemented and hardened the "Live Quiz" exercise type—a real-time, synchronous game designed for in-class hosting.

### Scope

1. **Standalone Exercise Schema**: Registered `"live-quiz"` as a dedicated standalone exercise type in [exercises.ts](file:///home/damessner/opencode/learn/src/lib/exercises.ts) and [types.ts](file:///home/damessner/opencode/learn/src/components/widgets/types.ts).
2. **Visual Builder for Teachers**: Added [LiveQuizBuilder.tsx](file:///home/damessner/opencode/learn/src/app/teacher/create/components/LiveQuizBuilder.tsx) to let teachers construct rich quiz questions supporting four question formats:
   - **Single Choice**: standard 4-alternative Kahoot-like question
   - **Multiple Choice**: multiple checkbox selection with composite evaluation
   - **Word Ordering**: scrambled sequence builder
   - **Text Input**: free-form text input with accepted variations
3. **Synchronous Host & Player client**: 
   - Built the real-time teacher board [LiveQuizSessionHostClient.tsx](file:///home/damessner/opencode/learn/src/app/teacher/live-quiz/session/%5BsessionId%5D/LiveQuizSessionHostClient.tsx) featuring join codes (6-digit PIN), student lobby count, question transition control, dynamic polling statistics bar-chart, and final award podium.
   - Built the student game pad [LiveQuizPlayerClient.tsx](file:///home/damessner/opencode/learn/src/app/student/live-quiz/play/%5BsessionId%5D/LiveQuizPlayerClient.tsx) featuring real-time synchronization, instant speed-based point decay calculation, lobby waiting screens, and custom option shapes/colors.
4. **Clean Compilation & Type Safety**:
   - Refactored [LiveQuizPlayerClient.tsx](file:///home/damessner/opencode/learn/src/app/student/live-quiz/play/%5BsessionId%5D/LiveQuizPlayerClient.tsx) and [LiveQuizSessionHostClient.tsx](file:///home/damessner/opencode/learn/src/app/teacher/live-quiz/session/%5BsessionId%5D/LiveQuizSessionHostClient.tsx) to adhere to strict ESLint constraints (preventing `setState` within render path, escaping entities, and removing `any` type casts).
   - Fixed relational query fields mismatch in the synchronization endpoint [/api/live-quiz/sync/route.ts](file:///home/damessner/opencode/learn/src/app/api/live-quiz/sync/route.ts).

### Verification

#### `npm run lint`
- **PASS** (0 errors, 0 warnings)

#### `npm run test`
- **PASS** (66 passed - all 12 new Live Quiz scoring and evaluation unit tests fully green)

#### `npm run build`
- **PASS** (successful production optimized Turbopack build)

---

## Pixabay Image Integration & Vocabulary Picture Quiz (Completed)

We implemented Pixabay secure image search and download integration, alongside an experimental **Picture Match Stage** for the Vocabulary practice widget.

### Scope

1. **Secure API Proxy & Downloader**:
   - Created [/api/pixabay/search](file:///home/damessner/opencode/learn/src/app/api/pixabay/search/route.ts) to securely query the Pixabay API on the server side using the private key, returning lightweight image lists to the front-end.
   - Created [/api/exercises/[exerciseId]/assets/download-url](file:///home/damessner/opencode/learn/src/app/api/exercises/[exerciseId]/assets/download-url/route.ts) to safely fetch and download selected images directly to the exercise's local assets directory. Restricts target hostnames to `pixabay.com` to prevent SSRF vulnerabilities.
2. **Interactive Search modal**:
   - Built [PixabaySearchModal.tsx](file:///home/damessner/opencode/learn/src/components/PixabaySearchModal.tsx), offering teachers a premium search bar and image thumbnails grid to quickly select and attach photos.
3. **Worksheet builder integration**:
   - Attached "Search Pixabay" options next to all media and matching pair media inputs in [WorksheetQuestionsBuilder.tsx](file:///home/damessner/opencode/learn/src/app/teacher/create/components/WorksheetQuestionsBuilder.tsx).
4. **Vocabulary builder upgrades**:
   - Re-architected [VocabularyBuilder.tsx](file:///home/damessner/opencode/learn/src/app/teacher/create/components/VocabularyBuilder.tsx) to support:
     - Checkbox: "Enable experimental picture supplementation".
     - Auto-Supplement button: Automatically queries Pixabay for each word in the list and attaches the first visual search hit.
     - Individual settings: Upload local files, search Pixabay individually per word, display preview thumbnails, or remove attachments.
   - Reconciled word lists and images inside [WorksheetCreator.tsx](file:///home/damessner/opencode/learn/src/app/teacher/create/WorksheetCreator.tsx) to ensure copy-pasting vocabulary lists merges and retains existing image files.
5. **Student Picture Match stage**:
   - Added **Stage 4: Picture Match** (Picture Quiz) in [Vocabulary.tsx](file:///home/damessner/opencode/learn/src/components/widgets/Vocabulary.tsx) triggering after standard study completion.
   - Generates a 2x2 grid of choices containing the target word's image and up to 3 distractors selected from other words in the student's active vocabulary list.

### Verification

#### `npm run lint`
- **PASS** (0 errors, 0 warnings)

#### `npm run test`
- **PASS** (66 passed)

#### `npm run build`
- **PASS** (successful optimized production build compilation)
