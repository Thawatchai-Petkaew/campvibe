---
name: promote-release
description: deploy/promote across envs (staging->prod) + migrate + smoke test + tag + changelog + rollback per promotion rules — use when you need to promote code across envs (merge→staging = Done, staging→main = Released). Do NOT use for opening a PR (use open-pr) or running the quality gate (use quality-gate)
---

# promote-release — deploy code across envs (staging→prod) with migrate, smoke, tag, changelog, rollback

## Overview

Promote a story across the 3-env pipeline (Local → Staging → Production) with database migration, smoke check, tag, changelog, and rollback. `merge→staging = Done`; `staging→main = Released`. State changes track the git event, not the env.

Read first: `std/ops.md` (pre-launch checklist, graduated rollout %, rollback thresholds, feature-flag lifecycle) · `ai-planning/SYNC-ARCHITECTURE.md` (Done vs Released, Linear sync) · 3-env: Local → Staging → Prod.

## When to Use

- Promoting a merged story to Staging (the "Done" criterion) — `promote-release --to staging`.
- Promoting `staging`→`main` to Production once G4 is signed off (the "Released" criterion) — `promote-release --to prod`.

**NOT for:**

- Opening a PR for a story → use `open-pr`.
- Running the mandatory pre-merge quality gate → use `quality-gate`.

## Input / preconditions

1. `promote-release --to <staging|prod>` — name the CAM-id of the story in the promote cycle.
2. `--to staging`: merged into `staging` · quality-gate fully green.
3. `--to prod`: Staging green + **G4 signed off** (do not skip) · rollback plan in place.
4. Env vars: `DATABASE_URL` separate for staging/prod · `LINEAR_API_KEY` (so `linear-sync.mjs` works).

## Workflow — `--to staging` (auto after merge into `staging`)

1. Run `prisma migrate deploy` on **staging DB** + `npm run build`.
2. Vercel deploy to Staging env (branch `staging`) + smoke/health check.
3. **Verify AC on the real Staging URL** → `node scripts/linear-sync.mjs set <CAM-id> --state "Done"` (state changes per git event, not tied to env).
4. On failure at any step → stop the promote + rollback + auto-open a Linear bug ticket.

## Workflow — `--to prod` (promote `staging`→`main`, must pass G5)

1. **Pre-condition:** Staging green + G4 sign-off (check `npm run status:gates`; do not skip).
2. Open/merge PR `staging`→`main` → Vercel Production deploy + `prisma migrate deploy` on **prod DB**.
3. Smoke/health check + `git tag vX.Y.Z` + changelog + rollback plan.
4. Run `node scripts/linear-sync.mjs release <CAM-id>` for each released story → apply label `released` (state stays `Done`, not a new state).
5. Watch Sentry for N minutes per the rollback thresholds in `std/ops.md` → error spike = auto-rollback + notify; failure = rollback + open ticket.

## Common Rationalizations

| Rationalization | Reality |
| --- | --- |
| "It's Done, so it's Released." | Done = staging state `Done`; Released = label `released` + git tag, on prod only. |
| "Just promote this `feature/*` straight to `main` to save a hop." | Prod must always go through Staging (Done + G4). Never promote `feature/*`→`main` directly. |
| "The migration is fine, run it on prod." | Migration must be reversible + tested on Staging before prod. Never run a prod migrate that hasn't passed staging. |
| "Bundle these stories into one `release` call." | Multiple `Done` stories can ship as one release train, but call `release <CAM-id>` once per story in the cycle. |
| "Just hand-edit `STATUS.json` to reflect the release." | Never edit `STATUS.json`/`linear-snapshot.json` by hand — they are generated from Linear via `npm run status:pull`. |

## Output / postconditions

- `--to staging`: Staging deploy green + staging migration succeeded + AC verified → story Linear state `Done`.
- `--to prod`: Production deploy green + tag `vX.Y.Z` + changelog + rollback plan → story label `released`.
- On failure (either case): rolled back + Linear bug ticket opened into the loop.

## Verify (exit criteria)

- [ ] Build + `prisma migrate deploy` succeed for the promoted env.
- [ ] Smoke/health check passes on the real URL (staging or prod).
- [ ] Linear state/label correct (`Done` or `released`) — check with `npm run status:linear`.
- [ ] Prod: tag + changelog complete + Sentry watched with no error spike (per `std/ops.md` thresholds) before closing the work.
