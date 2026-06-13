# Bug-Fix Sprint — Task Tracker

## Phase 1 — CRITICAL

- [x] C1: IDOR — `assignExercise`/`unassignAssignment` ownership check (`assignment.ts`)
- [x] C2: IDOR — Live-quiz teacher actions session ownership (`live-quiz.ts`)
- [x] C3: IDOR — `submitLiveAnswer` caller identity validation (`live-quiz.ts`)
- [x] C4: Score manipulation — `scoreInteractiveReading` fake ID exploit (`submissionScoring.ts`)
- [x] C5: Path traversal — `uploadMedia` `..` in filenames (`exercise.ts`)
- [x] C6: Path traversal — `getExerciseFromDisk` no id validation (`exercises.ts`)
- [x] C7: Test integrity — `live-quiz.test.ts` tests a local copy (`live-quiz.ts` refactor + test rewrite)

## Phase 2 — HIGH

- [x] H1: No rate limiting on register endpoint (`register/route.ts`)
- [x] H2: Username case mismatch in login (`login/route.ts`)
- [x] H3: Input type/length missing in auth routes (`login/route.ts`, `register/route.ts`)
- [x] H4: `spellingTolerance:"off"` treated as strict (`submissionScoring.ts`)
- [x] H5: `scoreDragDrop` case-sensitive inconsistency (`submissionScoring.ts`)
- [x] H6: Gemini API no timeout (`gemini.ts`)
- [x] H7: `Math.random()` for PIN generation (`live-quiz.ts`)
- [x] H8: `nextLiveQuestion` no bounds check (`live-quiz.ts`)
- [x] H9: Hardcoded multiplier in `finishLiveQuiz` (`live-quiz.ts`)

## Phase 3 — MEDIUM

- [x] M1: `parsedContent` spreads after validated fields (`exercise.ts`)
- [x] M2: Frontmatter regex unscoped in `duplicateExercise` (`exercise.ts`)
- [x] M3: Base64 decoded before size check (`exercise.ts`)
- [x] M4: `resetStudentPassword` min 4 chars (`classroom.ts`)
- [x] M5: `joinLiveSession` no length limits (`live-quiz.ts`)
- [x] M6: `feedback` type not validated (`submission.ts`)
- [x] M7: `getSession` no structural validation (`session.ts`)

## Phase 4 — LOW + Tests

- [x] L1: Test-only export not NODE_ENV guarded (`rateLimit.ts`)
- [x] L2: Duplicate type aliases in `submissionScoring.ts`
- [x] L3: Extract `evaluateAnswerCorrectness` and rewrite live-quiz tests
- [x] L4: Add 8 missing edge cases to `submissionScoring.test.ts`
- [x] L5: Add edge cases to `scoring.test.ts`

## Final Verification

- [x] All 99 tests passing
- [x] TypeScript: 0 errors (`tsc --noEmit`)
