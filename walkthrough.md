# Walkthrough — Manual Account Activation

## Goal
Users can register themselves, but an admin must manually activate their account before they can log in.

## Changes Made

### 1. Database Schema
**File:** `prisma/schema.prisma`
- Added `active Boolean @default(false)` to the `User` model
- **Migration:** `prisma/migrations/20260618030853_add_user_active/`

### 2. Registration API (`src/app/api/auth/register/route.ts`)
- Removed `setSession()` call — no automatic login after registration
- Returns `{ success: true, pending: true }` to signal pending activation
- `active` defaults to `false` via Prisma schema

### 3. Login API (`src/app/api/auth/login/route.ts`)
- After password verification, checks `user.active`
- If inactive: returns `403` with `"Account not yet activated. Please contact an administrator."`
- Uses separate status code (403) so the client can distinguish from bad credentials (400)

### 4. Registration Page (`src/app/register/page.tsx`)
- On successful registration, shows a green success banner: "Registration successful! Your account is pending activation by an administrator."
- Resets form fields
- Hides the registration form on success (replaced by the success message + login link)
- Removed `useRouter` since there's no redirect after registration

### 5. Admin Server Actions (`src/lib/actions/aloys.ts`)
- `adminGetUsersAction()` — now selects `active` field in the Prisma query
- **New:** `adminSetUserActiveAction(userId, active)` — toggles activation status (admin-only)
- `adminCreateUserAction()` — sets `active: true` (admin-created users are pre-activated)

### 6. Admin Client Page (`src/app/admin/AdminClientPage.tsx`)
- `UserListItem` interface: added `active: boolean`
- Table header: added "Status" column between "Role" and "Classes"
- Status cell: green "ACTIVE" badge / amber "PENDING" badge
- New "Activate" (green) / "Deactivate" (red) toggle button per user row
- Calls `adminSetUserActiveAction` inline, then refreshes the user list

### 7. Bulk Import (`src/lib/actions/classroom.ts`)
- `bulkImportStudents()` — creates students with `active: true` (teacher-imported students are pre-activated)

### 8. Seed Data (`prisma/seed.ts`)
- All seed users (teacher, da.messner, weissenbach, student) created with `active: true`

### 9. Backfill
- Existing database users were updated to `active: true` (preserving access for pre-existing accounts)

## Behavior Summary

| Scenario | Result |
|---|---|
| User registers via `/register` | Account created (inactive), shows pending message |
| User tries to log in before activation | "Account not yet activated. Please contact an administrator." |
| Admin creates user via admin panel | Account is active immediately |
| Teacher bulk-imports students | Accounts are active immediately |
| Admin toggles activation in admin panel | User status updates immediately |
| Seed users / existing users | Active (backfilled) |
