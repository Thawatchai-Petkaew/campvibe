---
name: promote-release
description: deploy/promote across envs (staging->prod) + migrate + smoke test + tag + changelog + rollback per promotion rules — use when you need to promote code across envs (merge→staging = Done, staging→main = Released). Do NOT use for opening a PR (use open-pr) or running the quality gate (use quality-gate)
---
# promote-release — deploy/promote code across envs (staging→prod) with migrate, smoke, tag, changelog, rollback
Read first: `std/ops.md` · `ai-planning/SYNC-ARCHITECTURE.md` (Done vs Released, Linear sync) · 3-env: Local→Staging→Prod

## Input / preconditions
- `promote-release --to <staging|prod>` · specify the CAM-id of the story in the promote cycle
- `--to staging`: merged into `staging` · quality-gate fully green
- `--to prod`: Staging green + **G4 signed off** (do not skip) · rollback plan in place
- env vars: `DATABASE_URL` separate for staging/prod · `LINEAR_API_KEY` (so `linear-sync.mjs` works)

## Workflow — `--to staging` (auto after merge into `staging`)
1. `prisma migrate deploy` on **staging DB** + `npm run build`
2. Vercel deploy to Staging env (branch `staging`) + smoke/health check
3. **verify AC on the real Staging URL** → `node scripts/linear-sync.mjs set <CAM-id> --state "Done"` (state changes per git event, not tied to env)
4. fail at any step → stop the promote + rollback + open a Linear bug ticket automatically

## Workflow — `--to prod` (promote `staging`→`main`, must pass G5)
1. **pre-condition:** Staging green + G4 sign-off (check `npm run status:gates`; do not skip)
2. open/merge PR `staging`→`main` → Vercel Production deploy + `prisma migrate deploy` on **prod DB**
3. smoke/health check + `git tag vX.Y.Z` + changelog + rollback plan
4. `node scripts/linear-sync.mjs release <CAM-id>` for each released story → apply label `released` (state stays `Done`, not a new state)
5. watch Sentry for N minutes → error spike = auto-rollback + notify; fail = rollback + open ticket

## Watch for / Anti-patterns
- **Done ≠ Released:** Done = staging state `Done` · Released = label `released` + git tag on prod only
- prod must always go through Staging (Done + G4) — never promote `feature/*`→`main` directly
- migration reversible + tested on Staging before prod (do not run a migrate on prod that hasn't passed staging)
- multiple `Done` stories can be released together as one cycle (release train) — `release <CAM-id>` one at a time for each story in the cycle
- never edit `STATUS.json`/`linear-snapshot.json` by hand (generated from Linear via `npm run status:pull`)

## Output / postconditions
- `--to staging`: Staging deploy green + staging migration succeeded + AC verified → story Linear state `Done`
- `--to prod`: Production deploy green + tag `vX.Y.Z` + changelog + rollback plan → story label `released`
- fail in any case: rolled back + Linear bug ticket opened into the loop

## Verify
- build + `prisma migrate deploy` succeed for the promoted env
- smoke/health check passes on the real URL (staging or prod)
- Linear state/label correct (`Done` or `released`) — check with `npm run status:linear`
- prod: tag + changelog complete + Sentry watched with no error spike before closing the work
