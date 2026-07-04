---
linear: CAM-180
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: delivery
owner: devops-release
status: In Progress
version: v1
updated: 2026-06-25
---
# Delivery — กล่องของขวัญบนกองไฟ: ยก z-index เหนือตัวละคร + เลื่อนตำแหน่งลงนิด (CAM-180)

## PR & preview

PR: pending (opened after commit push — see PR number in orchestrator summary)
Branch: `fix/cam-180-gift-zindex-position`
Staging deploy: auto on merge to `staging` (campvibe-staging.vercel.app)

## Staging verify

Gate: G3 (merge into staging) — orchestrator merges after CI green.
Gate: G4 (staging sign-off) — owner verifies on the real Staging URL.

Staging verification steps (for G4):
1. Open `https://campvibe-staging.vercel.app/status/map`
2. Watch walking agents pass through the campfire area — the gift box must remain fully visible above every agent at all times (not covered by any walking character).
3. Confirm the gift box sits visibly lower than its previous position (closer to the campfire center), corresponding to `top: 48%` vs the previous `top: 44%`.
4. Click the gift box — the modal opens normally; pointer-events unchanged.

AC results (Staging — pending G4 sign-off):
- AC1 (gift above agents): pending
- AC2 (nudge down): pending
- AC3 (click opens modal): pending

## Migration

None — CSS-only change. No schema, no data, no Prisma migration.

Rollback: `git revert` the squash-merge commit on `staging` (or revert the PR merge commit on `main` if promoted). No down-migration needed.

## Release

Git tag: pending (G5 — prod promote not yet run)
Changelog entry: pending (appended at G5)
Rollback plan: revert the squash-merge commit that brought this PR into `staging` / `main`. No database rollback required (CSS-only). Command:
```
git revert <merge-commit-sha>
git push origin staging   # or main for prod
```

## Error watch

Pending — post-deploy Sentry watch window runs after staging auto-deploy + G4, and again after prod promote (G5).
Thresholds: error rate >= 2x pre-deploy baseline OR > 10% of requests erroring = rollback + notify.

## Links

`story.md` · `tech.md` · `test.md` · `.claude/rules/ops.md`

## Changelog

- v1 (2026-06-25) — created; PR staged for CI; awaiting G4 staging sign-off
