---
linear: CAM-179
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: Admin
artifact: delivery
owner: devops-release
status: In Progress
version: v1
updated: 2026-06-25
---
# Delivery — fix Production card link in Scout Team modal (CAM-179)

## PR & preview

PR: opened against `staging` (see PR # in commit body).
Vercel preview: auto-generated on PR open (feature branch preview).

## Staging verify

Gate: G4 sign-off pending (story not yet at Done — awaiting CI green + staging deploy).

Verification steps (to run after merge to staging):

1. Open `https://campvibe-staging.vercel.app/status/map`.
2. Open the "ผลผลิต Scout Team" modal (HUD env picker button, shimmer-ring toggle).
3. Click the Production card: confirm new tab opens `https://campvibe.vercel.app` (NOT staging).
4. Click the Staging card: confirm new tab opens `https://campvibe-staging.vercel.app`.
5. Confirm both cards open the root/home path (no sub-path appended).

Note: the prod Vercel deploy is currently failing (separate incident, not in scope of CAM-179). AC-1 (Production card) will be fully verified once that incident is resolved + the next release is promoted. AC-2 and AC-3 (Staging card + home path) are verifiable immediately on Staging.

## Migration

None — URL constant change only. No schema, no DB, no migration.

## Release

Not yet released (staging PR open; G4 + G5 pending).

On release (staging → main promote):
- Git tag: will be cut as part of the next release train alongside other Done stories.
- Changelog: entry `fix(status-map): Production card in Scout Team modal links to prod, not staging (CAM-179)`.
- Rollback plan: revert the squash-merge commit on `staging`; or on prod, revert the squash-merge commit on `main`. Command:
  ```
  git revert <merge-commit-sha> --no-edit
  git push origin staging   # or main for prod
  ```
  No migration to undo. Revert is immediate and safe.

## Error watch

Pending — no prod deploy yet.

Post-deploy window (when promoted): watch Sentry for N minutes after prod deploy.
Rollback threshold: error rate >= 2x pre-deploy baseline, or > 10% of requests erroring.
Scope is minimal (2 lines: URL constant + href attribute); risk of regression is very low.

## Links

`tech.md` (same folder) · `test.md` (same folder) · `__tests__/cam-179-env-picker-prod-link.test.ts` · `.claude/rules/ops.md`

## Changelog
- v1 (2026-06-25) — created
