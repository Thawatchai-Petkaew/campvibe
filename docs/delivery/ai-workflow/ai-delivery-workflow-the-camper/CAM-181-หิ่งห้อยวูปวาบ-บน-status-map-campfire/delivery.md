---
linear: CAM-181
feature: ai-workflow
epic: ai-delivery-workflow-the-camper
persona: Camper
artifact: delivery
owner: devops-release
status: In Review
version: v1
updated: 2026-06-25
---
# Delivery — Ambient twinkling fireflies on /status/map campfire scene (CAM-181)

## PR & preview
PR opened into `staging` branch — see PR # in commit summary.
Vercel preview: auto-generated on `feat/cam-181-fireflies` push (ephemeral Preview env).

## Gates passed
- G1 Scope: approved (owner)
- G2 Design: approved — owner's choices: amber/gold #FFB454, 12 fireflies, twinkle-only animation (no movement), z-index 35 (in front of characters), no fireflies over campfire or gift box
- G3 Merge: pending CI on this PR (orchestrator merges after green)
- G4 Staging sign-off: pending (owner verifies on real Staging URL after merge)
- G5 Go-live: pending

## Staging verify (G4 — to be confirmed by owner after merge)
Open `campvibe-staging.vercel.app/status/map` and confirm:
1. 12 small amber dots appear across the tree/clearing area of the campfire scene.
2. Dots twinkle out of sync (staggered opacity animation, no two dots in phase).
3. No firefly appears over the campfire element or the gift box.
4. Clicking on agent characters: pointer-events pass through (firefly layer does not intercept clicks).
5. OS reduced-motion (`prefers-reduced-motion: reduce`): fireflies render as faint static dots — no animation.
6. Screen-reader: `.firefly-layer` is `aria-hidden="true"` — not announced.

## Migration
None. Decorative CSS-only feature. No schema change, no DB migration, no data access.

## Rollback plan
Revert the squash-merge commit on `staging` (the merge commit for this PR):
```bash
git revert -m 1 <merge-commit-sha>
git push origin staging
```
Vercel auto-redeploys on push. No migration rollback needed (no migration ran).

## Release
Not yet promoted to prod. After G4 sign-off:
- Promote `staging`→`main` via `/promote-release --to prod`
- No `prisma migrate deploy` needed (no migration)
- Cut git tag + changelog entry at promotion time
- Smoke: verify fireflies on `campvibe.vercel.app/status/map`

## Error watch
Pending (post-deploy to Staging). No backend surface changed — error risk is purely CSS/render.
Rollback threshold: if Sentry registers any new JS error spike (>=2x baseline) after merge, revert the squash-merge.

## Links
- `story.md` — `docs/delivery/ai-workflow/campsite-delivery-map-status-map/CAM-181-.../story.md`
- `design.md` — `docs/delivery/ai-workflow/ai-delivery-workflow-the-camper/CAM-181-.../design.md`
- `tech.md` — `docs/delivery/ai-workflow/ai-delivery-workflow-the-camper/CAM-181-.../tech.md`
- `test.md` — `docs/delivery/ai-workflow/ai-delivery-workflow-the-camper/CAM-181-.../test.md`
- `.claude/rules/ops.md`

## Changelog
- v1 (2026-06-25) — created; delivery.md authored by DevOps/Release (The Camper)
