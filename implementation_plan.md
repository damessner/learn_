# Implementation Plan: Repo-Wide Lint Debt Remediation

## Refined Prompt

Fix substantial pre-existing repository-wide lint debt and bring the codebase to a clean state where lint/test/build pass.

---

## Clarification Applied

Assuming your request means:

1. Fix **both lint errors and warnings** (full clean run).
2. Keep existing lint rules unchanged.
3. Refactors across many files are allowed where needed to satisfy rules safely.

---

## Current Baseline (fresh run)

- `npm run lint` reports **125 problems**:
  - **67 errors**
  - **58 warnings**
- Dominant categories:
  - `@typescript-eslint/no-explicit-any` (largest)
  - `@typescript-eslint/no-unused-vars`
  - `react/jsx-key`
  - `react-hooks/*` correctness/perf rules
  - `react/no-unescaped-entities`
  - `@next/next/no-img-element`

---

## Remediation Strategy (staged)

## Phase 1 — Correctness-first lint blockers

### 1.1 Fix render immutability violation
- `file:///home/damessner/opencode/learn/src/app/teacher/classrooms/[id]/students/[studentId]/page.tsx`

### 1.2 Fix setState-in-effect violation and related dependency warnings
- `file:///home/damessner/opencode/learn/src/components/widgets/Vocabulary.tsx`
- `file:///home/damessner/opencode/learn/src/components/widgets/InteractiveReading.tsx`

### 1.3 Fix missing JSX keys
- `file:///home/damessner/opencode/learn/src/components/widgets/ExploreImageMap.tsx`
- `file:///home/damessner/opencode/learn/src/components/widgets/ImageHotspotQuiz.tsx`
- `file:///home/damessner/opencode/learn/src/app/teacher/create/components/ImageHotspotQuizBuilder.tsx`

---

## Phase 2 — Type-safety sweep (`no-explicit-any`)

High-density targets first:

- `file:///home/damessner/opencode/learn/src/app/teacher/create/WorksheetCreator.tsx`
- `file:///home/damessner/opencode/learn/src/app/assignments/[id]/AssignmentPlayer.tsx`
- `file:///home/damessner/opencode/learn/src/app/submissions/[id]/SubmissionReviewPlayer.tsx`

Then supporting files:

- `file:///home/damessner/opencode/learn/src/lib/points.ts`
- `file:///home/damessner/opencode/learn/src/lib/exercises.ts`
- `file:///home/damessner/opencode/learn/src/components/widgets/types.ts`
- `file:///home/damessner/opencode/learn/src/components/widgets/index.ts`
- `file:///home/damessner/opencode/learn/src/components/widgets/OpenQuestion.tsx`
- `file:///home/damessner/opencode/learn/src/components/widgets/ExploreImageMap.tsx`
- `file:///home/damessner/opencode/learn/src/components/widgets/InteractiveReading.tsx`
- `file:///home/damessner/opencode/learn/src/app/teacher/create/components/InteractiveReadingBuilder.tsx`
- `file:///home/damessner/opencode/learn/src/app/teacher/create/components/WorksheetQuestionsBuilder.tsx`
- `file:///home/damessner/opencode/learn/src/app/submissions/[id]/page.tsx`
- `file:///home/damessner/opencode/learn/src/app/login/page.tsx`
- `file:///home/damessner/opencode/learn/src/app/register/page.tsx`

Approach:

- Replace `any` with concrete interfaces/unions for config/state where possible.
- Use `unknown` + narrowing for dynamic payloads.
- For unavoidable generic maps, use `Record<string, unknown>` and local typed guards.

---

## Phase 3 — Unused vars/imports cleanup

Primary files:

- `file:///home/damessner/opencode/learn/src/app/teacher/create/WorksheetCreator.tsx`
- `file:///home/damessner/opencode/learn/src/app/assignments/[id]/AssignmentPlayer.tsx`
- `file:///home/damessner/opencode/learn/src/app/teacher/classrooms/[id]/page.tsx`
- `file:///home/damessner/opencode/learn/src/app/teacher/AssignExerciseForm.tsx`
- `file:///home/damessner/opencode/learn/src/app/submissions/[id]/SubmissionReviewPlayer.tsx`

And remaining warning files from lint output.

Approach:

- Remove dead imports/state.
- Rename unused catch params to omitted form (`catch {}`) where appropriate.
- Keep behavior unchanged.

---

## Phase 4 — Markup and framework-specific cleanup

### 4.1 Escape unescaped entities
- `file:///home/damessner/opencode/learn/src/app/submissions/[id]/SubmissionReviewPlayer.tsx`
- `file:///home/damessner/opencode/learn/src/app/teacher/create/WorksheetCreator.tsx`

### 4.2 Replace `<img>` with `next/image` where lint requires
- `file:///home/damessner/opencode/learn/src/components/widgets/OpenQuestion.tsx`

---

## Phase 5 — Verification and stabilization

Run in order:

1. `npm run lint`
2. `npm run test`
3. `npm run build`

If new issues appear from stricter typing, perform targeted fixes and rerun all three.

---

## Expected Outcome

- `npm run lint` → **0 errors, 0 warnings**
- `npm run test` → pass
- `npm run build` → pass

---

## Risk Notes

1. Broad `any` removal can surface latent type design gaps in widget configs.
2. `next/image` migration in dynamic content areas may need explicit width/height handling.
3. Large-file refactors (especially `WorksheetCreator.tsx`) will be done incrementally to minimize regressions.
