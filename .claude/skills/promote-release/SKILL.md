---
name: promote-release
description: deploy/promote across envs (staging->prod) + migrate + smoke test + tag + changelog + rollback per promotion rules — use when you need to promote code across envs (merge→staging = Done, staging→main = Released). Do NOT use for opening a PR (use open-pr) or running the quality gate (use quality-gate)
---

# promote-release — deploy code across envs (staging→prod) with migrate, smoke, tag, changelog, rollback

## Overview

Promote a story across the 3-env pipeline (Local → Staging → Production) with database migration, smoke check, tag, changelog, and rollback. `merge→staging = Done`; `staging→main = Released`. State changes track the git event, not the env.

Read first: `.claude/rules/ops.md` (pre-launch checklist, graduated rollout %, rollback thresholds, feature-flag lifecycle) · `.claude/SYNC-ARCHITECTURE.md` (Done vs Released, ticket DB sync) · 3-env: Local → Staging → Prod.

## Quick Reference

The `staging`→`main` (Released) promotion, in order:

1. Verify **G4 Staging sign-off** — AC confirmed on the real Staging URL (`node scripts/ticket-sync.mjs gates`; do not skip).
2. Promote `staging`→`main` — open/merge the PR → Vercel Production deploy + `prisma migrate deploy` on **prod DB**.
3. Prod **smoke/health check** on the real URL.
4. `git tag vX.Y.Z` + write the **changelog** entry.
5. Watch Sentry for N minutes per the **rollback thresholds** in `.claude/rules/ops.md` → error spike = auto-rollback + notify.
6. `node scripts/ticket-sync.mjs release <CAM-id>` (once per story) → stamps `releasedAt` (state stays `Done`).

`--to staging` is the lighter cousin: migrate staging DB → deploy → smoke → verify AC on Staging URL → state `Done`. See Workflow.

## When to Use

- Promoting a merged story to Staging (the "Done" criterion) — `promote-release --to staging`.
- Promoting `staging`→`main` to Production once G4 is signed off (the "Released" criterion) — `promote-release --to prod`.

**NOT for:**

- Opening a PR for a story → use `open-pr`.
- Running the mandatory pre-merge quality gate → use `quality-gate`.

## Prerequisites

- **G4 passed** — AC verified on the real Staging URL (the "Done" criterion) before any prod promote. For `--to prod` this is non-negotiable.
- Read `.claude/rules/ops.md` first (pre-launch checklist, graduated rollout %, rollback thresholds, feature-flag lifecycle).
- Env vars: `DATABASE_URL` separate for staging/prod · `APP_BASE_URL` + `STATUS_TOKEN` (so `ticket-sync.mjs` works).
- **Cost / escalation rule:** any monetary cost (new paid infra/service) or the **G5 go-live** decision is the owner's call — escalate, do not self-approve. See `docs/project/business.md` for the cost list.

## Input / preconditions

1. `promote-release --to <staging|prod>` — name the CAM-id of the story in the promote cycle.
2. `--to staging`: merged into `staging` · quality-gate fully green.
3. `--to prod`: Staging green + **G4 signed off** (do not skip) · rollback plan in place.
4. Env vars: `DATABASE_URL` separate for staging/prod · `APP_BASE_URL` + `STATUS_TOKEN` (so `ticket-sync.mjs` works).

## Workflow — `--to staging` (auto after merge into `staging`)

1. Run `prisma migrate deploy` on **staging DB** + `npm run build`.
2. Vercel deploy to Staging env (branch `staging`) + smoke/health check.
3. **Verify AC on the real Staging URL** → `node scripts/ticket-sync.mjs set <CAM-id> --state "Done"` (state changes per git event, not tied to env; requires the ticket still `AWAITING_GATE` — see the "G4 exception" note in `.claude/agents/orchestrator.md`, this is the `complete()` verb, not the generic Approve tap).
4. On failure at any step → stop the promote + rollback + auto-open a bug ticket in the delivery ticket DB.

## Workflow — `--to prod` (promote `staging`→`main`, must pass G5)

1. **Pre-condition:** Staging green + G4 sign-off (check `node scripts/ticket-sync.mjs gates`; do not skip).
2. Open/merge PR `staging`→`main` → Vercel Production deploy + `prisma migrate deploy` on **prod DB**.
3. Smoke/health check + `git tag vX.Y.Z` + changelog + rollback plan.
4. Run `node scripts/ticket-sync.mjs release <CAM-id>` for each released story → stamps `releasedAt` (state stays `Done`, not a new state).
5. Write the story's `delivery.md`: `## Staging verify` (G4 — AC confirmed on the Staging URL) + `## Release` (G5 — tag / changelog / rollback) so the ship record is durable (see the `delivery-artifacts` skill).
6. Watch Sentry for N minutes per the rollback thresholds in `.claude/rules/ops.md` → error spike = auto-rollback + notify; failure = rollback + open ticket.

## Output / postconditions

- `--to staging`: Staging deploy green + staging migration succeeded + AC verified → story ticket state `Done`.
- `--to prod`: Production deploy green + tag `vX.Y.Z` + changelog + rollback plan → story `releasedAt` stamped.
- On failure (either case): rolled back + a bug ticket opened into the loop.

## Examples

- ✅ Promote `staging`→`main` only after AC was verified on the real Staging URL (G4), then `git tag v1.4.0` + changelog written + Sentry watched → `node scripts/ticket-sync.mjs release CAM-110`.
- ❌ Promoting straight from a green local run (no Staging hop, no G4) — prod must always go through Staging.
- ❌ Treating a story in state `Done` as `Released` — Released = `releasedAt` stamped + git tag on prod, never the staging state alone.

## Reference Files

- `.claude/rules/ops.md` — pre-launch checklist, graduated rollout %, rollback thresholds, feature-flag lifecycle.
- `.claude/rules/observability.md` — Sentry error-watch window + signals used for the rollback decision.
- `docs/project/business.md` — cost list (which spend is owner-approval / escalation per the cost rule).
- `delivery-artifacts` skill — the story's `delivery.md` where `## Staging verify` (G4) + `## Release` (G5) are written.
- Sibling skill `open-pr` — opens the `staging`→`main` PR this skill then promotes.
- `.claude/SYNC-ARCHITECTURE.md` — Done vs Released, ticket DB sync.

## Next Steps

After `release` stamps `releasedAt` → monitor the error window (Sentry) per `.claude/rules/observability.md` for the rollback-threshold duration in `.claude/rules/ops.md`. If thresholds are breached → roll back per the promotion rules + notify + open a bug ticket into the loop.

## Common Rationalizations

| Rationalization | Reality |
| --- | --- |
| "It's Done, so it's Released." | Done = staging state `Done`; Released = `releasedAt` stamped + git tag, on prod only. |
| "Just promote this `feature/*` straight to `main` to save a hop." | Prod must always go through Staging (Done + G4). Never promote `feature/*`→`main` directly. |
| "The migration is fine, run it on prod." | Migration must be reversible + tested on Staging before prod. Never run a prod migrate that hasn't passed staging. |
| "Bundle these stories into one `release` call." | Multiple `Done` stories can ship as one release train, but call `release <CAM-id>` once per story in the cycle. |
| "Just hand-edit `.claude/linear-snapshot.json` to reflect the release." | Never edit that file by hand — it is generated from the delivery ticket DB via `npm run tickets:pull`. |

## Verify (exit criteria)

- [ ] Build + `prisma migrate deploy` succeed for the promoted env.
- [ ] Smoke/health check passes on the real URL (staging or prod).
- [ ] Ticket state/`releasedAt` correct (`Done` or stamped) — check with `node scripts/ticket-sync.mjs list`.
- [ ] Prod: tag + changelog complete + Sentry watched with no error spike (per `.claude/rules/ops.md` thresholds) before closing the work.
