---
linear: CAM-151
feature: ai-workflow
epic: campsite-delivery-map (CAM-150)
persona: platform
artifact: delivery
owner: devops-release
status: In Progress
version: v1
updated: 2026-06-24
---

# Delivery — S1 shared model + route shell (CAM-151)

## Status

**Built + self-verified on `feature/cam-151-status-map-shared-model` (uncommitted). PR pending.**
AC will be verified on the real Staging URL after G3 (merge to `staging`).

## PR & preview

PR: (pending — opens into `staging` for S1 + S2 together on this branch)
Staging URL (after merge): `https://campvibe-staging.vercel.app/status/map?token=…`

## Gate results

Full quality gate run on `feature/cam-151-status-map-shared-model` (S1 + S2 together), 2026-06-24:

| Check | Result |
| --- | --- |
| `npm run lint` | PASS — 0 errors, 224 warnings (all pre-existing; none in the new map/test files) |
| `npm run typecheck` | PASS — 0 errors |
| `npm test` | PASS — 42 files, 2282 tests, 0 failures (incl. 23 new in `status-map.test.ts`) |
| `npm run build` | PASS — `/status/map` compiled (dynamic route) |
| `npm run check:palette` | PASS — 0 violations (ops page exempt) |
| `npm run check:ds` | PASS — 0 violations |
| `npm audit --omit=dev` | 0 high / 0 critical (3 moderate, pre-existing: postcss → next → next-auth; no new deps added) |
| Security self-check | clean — read-only ops dashboard; token gate parity with `/status`; no DB write, no secret in client bundle |

## Staging verify (after merge, Done criterion)

| # | AC | Expected | Result |
| --- | --- | --- | --- |
| 1 | `/status` unchanged | HTML render diff = empty vs pre-refactor | verify on real URL post-deploy |
| 2 | `/status/map?token=…` | 200 + night-scene shell + loading placeholder, no error | verify on real URL post-deploy |
| 3 | `/status/map` no/wrong token | gate box "Protected dashboard" (parity with `/status`) | verify on real URL post-deploy |

## Migration

None — no Prisma schema change, no database migration. Pure refactor + new client/server files.

## Release

Not yet (pending G4 sign-off + G5 promote). Tag, changelog, and rollback plan authored at promote time.

**Rollback plan (staging, if needed):**

```bash
# Revert the squash-merge commit on staging
git revert <merge-sha> --no-edit
git push origin staging
```

Code-only change (no migration) → revert is instant and safe, no data risk. `/status` reverts to its pre-extraction self.

## Error watch

Pending — Sentry watch window starts after staging auto-deploy completes. No prod watch until G5.

## Links

`story.md` · `tech.md` · `design.md` · `test.md` · `../feature.md` · `.claude/rules/ops.md`

## Changelog

- v1 (2026-06-24) — delivery artifact created; S1 built + self-verified on `feature/cam-151-status-map-shared-model`; PR into `staging` pending (shares branch with S2/CAM-152).
