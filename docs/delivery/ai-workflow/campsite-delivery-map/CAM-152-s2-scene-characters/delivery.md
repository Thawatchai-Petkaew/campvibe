---
linear: CAM-152
feature: ai-workflow
epic: campsite-delivery-map (CAM-150)
persona: platform
artifact: delivery
owner: devops-release
status: In Progress
version: v1
updated: 2026-06-24
---

# Delivery — S2 static scene + characters (CAM-152)

## Status

**Built + self-verified on `feature/cam-151-status-map-shared-model` (uncommitted). PR pending.**
AC will be verified on the real Staging URL after G3 (merge to `staging`). S2 shares this branch + PR with S1 (CAM-151).

## PR & preview

PR: (pending — opens into `staging`; carries S1 + S2)
Staging URL (after merge): `https://campvibe-staging.vercel.app/status/map?token=…`

## Gate results

Full quality gate run on `feature/cam-151-status-map-shared-model` (S1 + S2 together), 2026-06-24:

| Check | Result |
| --- | --- |
| `npm run lint` | PASS — 0 errors, 224 warnings (all pre-existing; none in the new map/test files) |
| `npm run typecheck` | PASS — 0 errors |
| `npm test` | PASS — 42 files, 2282 tests, 0 failures (incl. 23 new in `status-map.test.ts`) |
| `npm run build` | PASS — `/status/map` compiled (dynamic route) |
| `npm run check:palette` | PASS — 0 violations (ops page exempt; mockup palette carried over) |
| `npm run check:ds` | PASS — 0 violations |
| `npm audit --omit=dev` | 0 high / 0 critical (3 moderate, pre-existing: postcss → next → next-auth; no new deps added) |
| Security self-check | clean — read-only ops dashboard; sprites are static assets; no DB write, no secret in client bundle |
| Sprites | 15 files in `public/status-map/sprites/`, all < 20KB (≪ 200KB) |
| No base64 in bundle | `grep data:image` → 0 in scene + assets |

## Staging verify (after merge, Done criterion)

| # | AC | Expected | Result |
| --- | --- | --- | --- |
| 1 | `/status/map?token=…` | night scene + 7 role characters + You at fixed stations (at-rest pose) | verify on real URL post-deploy |
| 2 | role with active story | that character glows + badge shows the task id | verify on real URL post-deploy |
| 3 | role with no active story | at-rest, no glow | verify on real URL post-deploy |
| 4 | N gates awaiting | You shows `⚑N` (hidden at N=0) | verify on real URL post-deploy |
| 5 | network panel | sprites load from `/status-map/sprites/`, not base64; each < 200KB | verify on real URL post-deploy |
| — | parity | character workload matches `/status` for the same data set | verify on real URL post-deploy |

## Migration

None — no Prisma schema change, no database migration. New static sprite assets + client scene code only.

## Release

Not yet (pending G4 sign-off + G5 promote). Tag, changelog, and rollback plan authored at promote time.

**Rollback plan (staging, if needed):**

```bash
# Revert the squash-merge commit on staging
git revert <merge-sha> --no-edit
git push origin staging
```

Code + static-asset change (no migration) → revert is instant and safe, no data risk. `/status/map` reverts to the S1 shell.

## Error watch

Pending — Sentry watch window starts after staging auto-deploy completes. No prod watch until G5.

## Links

`story.md` · `tech.md` · `design.md` · `test.md` · `../feature.md` · `../CAM-151-s1-shared-model-route-shell/delivery.md` · `.claude/rules/ops.md`

## Changelog

- v1 (2026-06-24) — delivery artifact created; S2 built + self-verified on `feature/cam-151-status-map-shared-model`; PR into `staging` pending (shares branch with S1/CAM-151).
