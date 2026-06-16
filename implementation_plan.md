# Implementation Plan: Pre-existing Bug Sweep + Prisma Runtime Fix

**Date:** 2026-06-16  
**Status:** Planning (no source edits yet)  
**Primary incident:** `PrismaClientKnownRequestError` due to missing DB column `User.windowInputTimestamps`

---

## 1) Refined Objective

Stabilize the app by fixing schema/runtime drift and resolving high-impact pre-existing bugs, starting with the Prisma runtime crash on teacher dashboard queries.

---

## 2) What was confirmed during read-only investigation

### A. Root cause of reported runtime crash

- Prisma schema expects new quota fields:
  - [`windowInputTimestamps`](file:///home/damessner/opencode/learn/prisma/schema.prisma)
  - [`windowQuizTimestamps`](file:///home/damessner/opencode/learn/prisma/schema.prisma)
- Runtime query path that loads `User` rows (via teacher dashboard includes):
  - [`TeacherDashboard` query](file:///home/damessner/opencode/learn/src/app/teacher/page.tsx)
- Local SQLite `dev.db` still has legacy columns:
  - `weeklyLimit`, `weeklyRemaining`, `lastWeeklyReset`
  - and **does not** have `windowInputTimestamps` / `windowQuizTimestamps`

### B. Why migration status looked “up to date” anyway

- Existing migration files do **not** contain the quota field transition:
  - [`prisma/migrations/`](file:///home/damessner/opencode/learn/prisma/migrations)
- So migration history is “consistent” with itself, but drifted from current schema.

### C. Additional pre-existing issues found (baseline quality scan)

- `npm run lint` currently reports multiple errors/warnings (hooks misuse, `any`, JSX issues), including:
  - Hook-order/effect issues in [`OralVocabulary.tsx`](file:///home/damessner/opencode/learn/src/components/widgets/OralVocabulary.tsx)
  - `set-state-in-effect` rule violation in [`ImageHotspotQuizBuilder.tsx`](file:///home/damessner/opencode/learn/src/app/teacher/create/components/ImageHotspotQuizBuilder.tsx)
  - Type-safety issues in [`quota.ts`](file:///home/damessner/opencode/learn/src/lib/actions/quota.ts), [`aloys.ts`](file:///home/damessner/opencode/learn/src/lib/actions/aloys.ts), and others.

---

## 3) Implementation plan (phased)

## Phase 0 — Safety prep

1. Confirm current branch/clean tree.
2. Snapshot DB file before migration work (`dev.db` backup).

## Phase 1 — Fix schema/runtime drift (critical)

1. Create Prisma migration for quota model transition:
   - **From legacy:** `weeklyLimit`, `weeklyRemaining`, `lastWeeklyReset`
   - **To current:** `windowInputTimestamps`, `windowQuizTimestamps`
2. Apply migration locally.
3. Regenerate Prisma client.
4. Verify DB columns match schema.

Target files/paths:
- Schema: [prisma/schema.prisma](file:///home/damessner/opencode/learn/prisma/schema.prisma)
- New migration file (to create): [prisma/migrations/<timestamp>_quota_window_transition/migration.sql](file:///home/damessner/opencode/learn/prisma/migrations)
- Prisma client usage: [src/lib/db.ts](file:///home/damessner/opencode/learn/src/lib/db.ts)

## Phase 2 — Runtime robustness for quota code path

1. Tighten quota action typing and remove unsafe `any` in update payload.
2. Ensure daily reset + window counters compute against post-update values consistently.
3. Keep admin/teacher unlimited behavior intact.

Target files:
- [src/lib/actions/quota.ts](file:///home/damessner/opencode/learn/src/lib/actions/quota.ts)
- [src/lib/actions/aloys.ts](file:///home/damessner/opencode/learn/src/lib/actions/aloys.ts)

## Phase 3 — Pre-existing bug cleanup (high-value lint/runtime defects)

1. Fix hook-order and effect anti-patterns in oral vocabulary widget.
2. Fix effect-driven state reset pattern in hotspot builder.
3. Resolve type/JSX issues in manifest/admin/student/teacher UI files that are currently lint-blocking.

Target files:
- [src/components/widgets/OralVocabulary.tsx](file:///home/damessner/opencode/learn/src/components/widgets/OralVocabulary.tsx)
- [src/app/teacher/create/components/ImageHotspotQuizBuilder.tsx](file:///home/damessner/opencode/learn/src/app/teacher/create/components/ImageHotspotQuizBuilder.tsx)
- [src/app/admin/AdminClientPage.tsx](file:///home/damessner/opencode/learn/src/app/admin/AdminClientPage.tsx)
- [src/app/student/aloys/SocraticClientPage.tsx](file:///home/damessner/opencode/learn/src/app/student/aloys/SocraticClientPage.tsx)
- [src/app/teacher/aloys/TeacherClientPage.tsx](file:///home/damessner/opencode/learn/src/app/teacher/aloys/TeacherClientPage.tsx)
- [src/app/manifest.ts](file:///home/damessner/opencode/learn/src/app/manifest.ts)
- [src/lib/tts/generator.ts](file:///home/damessner/opencode/learn/src/lib/tts/generator.ts)

## Phase 4 — Verification

Run, in order:

1. `npx prisma migrate status`
2. `npx prisma migrate dev` (or equivalent migration apply for current environment)
3. `npx prisma generate`
4. `npm run build`
5. `npm run test`
6. `npm run lint`
7. Smoke test key routes:
   - `/teacher`
   - `/student/aloys`
   - `/admin`

---

## 4) Expected outcome

1. No Prisma runtime crash caused by missing quota columns.
2. Teacher dashboard loads reliably.
3. Quota system works with current schema fields.
4. Lint error count reduced to zero (or documented residuals if explicitly deferred).

---

## 5) Risks and mitigations

- **Risk:** SQLite migration can require table redefinition.
  - **Mitigation:** DB backup before migration.
- **Risk:** Broad bug sweep may touch many UI files.
  - **Mitigation:** Execute in phases; verify after each phase.
- **Risk:** “All pre-existing bugs” can be open-ended.
  - **Mitigation:** Treat lint/runtime/build failures as concrete closure criteria unless scope is narrowed.
