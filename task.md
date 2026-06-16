# Pre-existing Bug Sweep — Task Tracker

## Execution Checklist

- [x] 1) Create DB backup before migration work
- [x] 2) Create/apply Prisma migration for quota schema drift (`weekly*` → `window*`)
- [x] 3) Regenerate Prisma client and verify teacher dashboard query path
- [x] 4) Fix high-impact pre-existing lint/runtime defects in action files
- [x] 5) Fix high-impact pre-existing lint/runtime defects in UI/components
- [x] 6) Run verification (`build`, `test`, `lint`) and resolve residual failures
- [x] 7) Write walkthrough summary in `walkthrough.md`
