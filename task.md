# Implementation Checklist — Manual Account Activation

- [x] Add `active` field to User model in Prisma schema
- [x] Run Prisma migration `20260618030853_add_user_active`
- [x] Regenerate Prisma client
- [x] Update registration API — no auto-login, return `{ pending: true }`
- [x] Update login API — reject inactive accounts with 403
- [x] Update register page — show pending activation message on success
- [x] Add `adminSetUserActiveAction` server action
- [x] Update `adminGetUsersAction` to include `active` field
- [x] Update `UserListItem` interface with `active: boolean`
- [x] Add Status column (ACTIVE/PENDING badges) in admin table
- [x] Add Activate/Deactivate toggle button in admin table
- [x] Make admin-created users active by default
- [x] Make bulk-imported students active by default
- [x] Set seed users to active
- [x] Backfill existing database users to active=true
- [x] Verify TypeScript compiles without errors
