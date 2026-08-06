---
name: promote-release
description: deploy/promote across envs + migrate + smoke test + tag + changelog + rollback per promotion rules — use when you need to promote code across envs (batched dev→staging = on-staging, staging→main = Released). Do NOT use for opening a story PR (use open-pr) or running the quality gate (use quality-gate)
---

# promote-release — deploy code across envs (dev→staging→prod) with migrate, smoke, tag, changelog, rollback

## Overview

Promote stories across the 4-layer pipeline (Local → Dev (no deploy) → Staging → Production) with database migration, smoke check, tag, changelog, and rollback. Stories are already **Done** on `dev`; the batched `dev`→`staging` promote adds the **`on-staging`** label; `staging`→`main` = **Released**.

Read first: `.claude/rules/ops.md` (pre-launch checklist, graduated rollout %, rollback thresholds, feature-flag lifecycle) · `.claude/SYNC-ARCHITECTURE.md` (Done vs Released, ticket DB sync) · 4-layer: Local → Dev → Staging → Prod.

## Quick Reference

The `staging`→`main` (Released) promotion, in order:

1. Verify **G4 Staging sign-off** — AC confirmed on the real Staging URL (`node scripts/ticket-sync.mjs gates`; do not skip).
2. **Engine pre-check** — `SELECT version()` on prod and confirm every pending migration's version-dependent construct runs there (open now: CAM-670 needs Postgres 15+). An unverified engine blocks the promote; `migrate deploy` runs inside the build, so this fails the deploy, not a test.
3. Promote `staging`→`main` — open/merge the PR → Vercel Production deploy + `prisma migrate deploy` on **prod DB**.
4. Prod **smoke/health check** on the real URL.
5. `git tag vX.Y.Z` + write the **changelog** entry.
6. Watch Sentry for N minutes per the **rollback thresholds** in `.claude/rules/ops.md` → error spike = auto-rollback + notify.
7. `node scripts/ticket-sync.mjs release <CAM-id>` (once per story) → stamps `releasedAt` (state stays `Done`).

`--to staging` is the batched promote: open the promote PR `dev`→`staging` → merge on green CI → auto deploy + migrate + smoke → `ticket-sync stage <CAM-id>` per story (the `on-staging` label). See Workflow.

## When to Use

- Batch-promoting Done stories `dev`→`staging` (the `on-staging` label) — `promote-release --to staging`.
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
2. `--to staging`: every story in the batch is Done on `dev` (merged + quality-gate green + AC verified on localhost).
3. `--to prod`: Staging green + **G4 signed off** (do not skip) · rollback plan in place.
4. Env vars: `DATABASE_URL` separate for staging/prod · `APP_BASE_URL` + `STATUS_TOKEN` (so `ticket-sync.mjs` works).

## Workflow — `--to staging` (the batched `dev`→`staging` promote)

1. Confirm every story in the batch is Done on `dev` (`node scripts/ticket-sync.mjs list`) and `dev` is green.
2. Open the promote PR `dev`→`staging` (`gh pr create --base staging --head dev`) → wait for green CI → merge.
3. The merge auto-deploys Staging: Vercel build runs `prisma migrate deploy` on the **staging DB** → smoke/health check on the real Staging URL (confirm the NEW build is live, not a stale one).
4. Label each story: `node scripts/ticket-sync.mjs stage <CAM-id>` (stamps `stagedAt` + `on-staging`); G4 sitting then verifies AC on the real Staging URL.
5. On failure at any step → stop the promote + rollback + auto-open a bug ticket in the delivery ticket DB.

## Workflow — `--to prod` (promote `staging`→`main`, must pass G5)

1. **Pre-condition:** Staging green + G4 sign-off (check `node scripts/ticket-sync.mjs gates`; do not skip).
2. **Engine pre-check (blocking).** `prisma migrate deploy` runs INSIDE the Vercel production build — a migration the prod engine cannot execute fails the deploy, not a test. Before opening the PR, diff the pending migrations against what prod's engine actually supports and prove it, don't reason it: `SELECT version()` on the prod DB, then confirm every version-dependent construct in those files. **Open now: CAM-670 ships column-scoped `ON DELETE SET NULL (col)`, which requires Postgres 15+** (staging measured 17.2, local 16.14, prod NOT yet verified). Record the measured version in the release notes; an unverified engine is a blocked promote.
3. Open/merge PR `staging`→`main` → Vercel Production deploy + `prisma migrate deploy` on **prod DB**.
4. Smoke/health check + `git tag vX.Y.Z` + changelog + rollback plan.
5. Run `node scripts/ticket-sync.mjs release <CAM-id>` for each released story → stamps `releasedAt` (state stays `Done`, not a new state).
6. Write the story's `release.md`: `## Staging verify` (G4 — AC confirmed on the Staging URL) + `## Release` (G5 — tag / changelog / rollback) so the ship record is durable (see the `delivery-artifacts` skill).
7. Watch Sentry for N minutes per the rollback thresholds in `.claude/rules/ops.md` → error spike = auto-rollback + notify; failure = rollback + open ticket.

## Output / postconditions

- `--to staging`: Staging deploy green + staging migration succeeded → each story labeled `on-staging` (state stays `Done`); G4 verifies AC on the real Staging URL.
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
- `delivery-artifacts` skill — the story's `release.md` where `## Staging verify` (G4) + `## Release` (G5) are written.
- Sibling skill `open-pr` — opens the story PR into `dev`; this skill owns the cross-env promote PRs.
- `.claude/SYNC-ARCHITECTURE.md` — Done vs Released, ticket DB sync.

## Next Steps

After `release` stamps `releasedAt` → monitor the error window (Sentry) per `.claude/rules/observability.md` for the rollback-threshold duration in `.claude/rules/ops.md`. If thresholds are breached → roll back per the promotion rules + notify + open a bug ticket into the loop.

## Common Rationalizations

| Rationalization | Reality |
| --- | --- |
| "It's Done, so it's Released." | Done = merged to `dev` + localhost AC verify; `on-staging` and `released` are labels earned by the promotes. Released = `releasedAt` stamped + git tag, on prod only. |
| "Just promote this `feature/*` straight to `main` to save a hop." | Prod must always go through Staging (Done + G4). Never promote `feature/*`→`main` directly. |
| "The migration is fine, run it on prod." | Migration must be reversible + tested on Staging before prod. Never run a prod migrate that hasn't passed staging. |
| "Bundle these stories into one `release` call." | Multiple `Done` stories can ship as one release train, but call `release <CAM-id>` once per story in the cycle. |
| "Just hand-edit `.claude/linear-snapshot.json` to reflect the release." | Never edit that file by hand — it is generated from the delivery ticket DB via `npm run tickets:pull`. |

## Verify (exit criteria)

- [ ] Build + `prisma migrate deploy` succeed for the promoted env.
- [ ] Smoke/health check passes on the real URL (staging or prod).
- [ ] Ticket labels/timestamps correct (`on-staging`/`stagedAt` or `releasedAt`) — check with `node scripts/ticket-sync.mjs list`.
- [ ] Prod: tag + changelog complete + Sentry watched with no error spike (per `.claude/rules/ops.md` thresholds) before closing the work.
