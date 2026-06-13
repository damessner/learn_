# Task Checklist — Repo-Wide Lint Debt Remediation

## Phase 1 — Setup
- [x] 1.1 Initialize lint cleanup checklist

## Phase 2 — App layer lint fixes
- [x] 2.1 Fix `AssignmentPlayer.tsx` type + unused issues
- [x] 2.2 Fix submission review pages (`SubmissionReviewPlayer.tsx`, `/submissions/[id]/page.tsx`)
- [x] 2.3 Fix auth pages (`/login`, `/register`) error typing
- [x] 2.4 Fix teacher pages/components lint warnings/errors

## Phase 3 — Widget + lib lint fixes
- [x] 3.1 Fix widget key/deps/img/unused issues
- [x] 3.2 Remove `no-explicit-any` in `lib/points.ts`, `lib/exercises.ts`, widget type exports

## Phase 4 — Verification
- [x] 4.1 Run `npm run lint` to zero issues
- [x] 4.2 Run `npm run test`
- [x] 4.3 Run `npm run build`

## Phase 5 — Delivery
- [x] 5.1 Update `walkthrough.md` with lint-remediation verification

## Phase 6 — README Review & Update
- [x] 6.1 Review repository files and security additions
- [x] 6.2 Write comprehensive updated `README.md`
- [x] 6.3 Verify unit tests and project build pass
- [x] 6.4 Update `walkthrough.md` with release summary
