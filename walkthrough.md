# Walkthrough: Pre-existing Bug Sweep + Prisma Runtime Fix

## Completed work

### 1) Resolved the runtime Prisma crash root cause

- The runtime crash (`The column main.User.windowInputTimestamps does not exist`) was caused by DB/schema drift.
- I synced the local SQLite schema to the current Prisma schema and verified `User` now contains:
  - `dailyLimit`
  - `dailyRemaining`
  - `lastDailyReset`
  - `windowInputTimestamps`
  - `windowQuizTimestamps`

Safety step taken:
- Created DB backup before schema sync: `dev.db.bak_2026-06-16_1`

### 2) Captured migration state in-repo

- Added migration file to reflect current schema history alignment:
  - `prisma/migrations/20260616165000_sync_schema_with_quota_and_aloys/migration.sql`
- Marked it as applied for the current local DB using Prisma migrate resolve.

### 3) Fixed pre-existing lint/runtime defects across backend and UI

Key areas fixed:

- **Quota + action files**
  - Removed unsafe `any` usage
  - Replaced `catch (err: any)` with `unknown` + safe guards
  - Resolved `prefer-const` and unused variables

- **UI files**
  - Fixed JSX comment textnode violations
  - Fixed unescaped quote entities in JSX
  - Removed unused vars/imports
  - Replaced `any` catch blocks and casts with concrete typing/safe narrowing

- **React hooks correctness**
  - Fixed conditional hooks violation in `OralVocabulary`
  - Removed sync `setState` calls inside effects by moving resets to event-driven paths and safe state flow

### 4) Smoke-verified key routes

Using a local production start on isolated port:

- `/teacher` → `200`
- `/student/aloys` → `200`
- `/admin` → `307` (expected redirect behavior)

## Files changed

- `prisma/migrations/20260616165000_sync_schema_with_quota_and_aloys/migration.sql` (new)
- `prisma/seed.ts`
- `src/lib/actions/quota.ts`
- `src/lib/actions/aloys.ts`
- `src/lib/tts/generator.ts`
- `src/app/manifest.ts`
- `src/app/admin/AdminClientPage.tsx`
- `src/app/student/aloys/SocraticClientPage.tsx`
- `src/app/teacher/aloys/TeacherClientPage.tsx`
- `src/app/teacher/create/WorksheetCreator.tsx`
- `src/app/teacher/create/components/ImageHotspotQuizBuilder.tsx`
- `src/app/teacher/create/components/VocabularyBuilder.tsx`
- `src/app/teacher/page.tsx`
- `src/components/widgets/OralVocabulary.tsx`
- `implementation_plan.md`
- `task.md`

## Verification results

All verification commands pass:

1. `npx prisma migrate status` → up to date
2. `npx prisma generate` → success
3. `npm run build` → success
4. `npm run test` → **101/101 tests passed**
5. `npm run lint` → success (no errors)

Additional query-path check:
- Prisma query matching teacher dashboard include path executed successfully after fix.
