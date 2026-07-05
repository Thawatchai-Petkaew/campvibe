---
name: release-and-ops
description: Standard for CampVibe's release and operations flow — 3-env promotion, Done vs Released, safe reversible deploys, pre-launch gates, and rollout. Use when promoting code across envs (merge→staging = Done, staging→main = Released). Use when planning a migration, tag, changelog, or rollback. Use when running a pre-prod launch checklist or a feature-flag rollout. Memory for the DevOps role; pairs with .claude/rules/observability.md, .claude/rules/security.md, .claude/rules/performance.md, DESIGN.md, .claude/rules/architecture.md, CLAUDE.md.
---

# Release & Ops

## Overview

A deploy you can't reverse is a deploy you shouldn't run. CampVibe ships through four layers — Local → **Dev (integration branch, no deploy)** → Staging → Production — where every change is proven locally before it integrates, "Done" and "Released" are deliberately separate, and every prod release carries a tag, a changelog, and a rollback plan. The goal: reversible, observable, gated releases with no shortcut to prod, inside the Vercel Hobby quota (100 deployments/day rolling — see §2).

## Quick Reference

**Done ≠ On-staging ≠ Released.** Done = merged to `dev` + AC verified on localhost (dev DB). `on-staging` (label) = batch-promoted `dev`→`staging`, live on the real Staging URL. Released = promoted to prod with a tag, changelog, and rollback plan.

Promote `staging`→`main` (= Released, G5):

1. Confirm Done: quality-gate green + AC verified on the **real Staging URL** + G4 sign-off.
2. `/promote-release --to prod` — the only path to prod; never promote straight from local/Preview.
3. `prisma migrate deploy` on prod (migration already reversible + tested on Staging).
4. **Tag + changelog + rollback plan** — all three, every prod release.
5. **Smoke test** on the real Production URL.
6. **Watch errors** (Sentry) for N minutes → spike = auto-rollback + alert; real error = open a bug ticket.
7. Label the story `released` (a label, not a state); sync the ticket DB (`ticket-sync.mjs audit`).

Rollout (if flagged): internal → 5% → 25% → 50% → 100% · errors **+10% over baseline = investigate · ≥2× = rollback**.

Any failure at any env → **stop the promotion + auto-open a ticket**.

## When to Use

- Promoting code across envs: merge→`staging` (= Done) or `staging`→`main` (= Released)
- Planning or reviewing a migration, a git tag, a changelog entry, or a rollback plan
- Running the pre-launch checklist before a prod release
- Rolling a feature out behind a flag/canary (graduated rollout)
- Wiring CI/branch protection or the Vercel env mapping

**NOT for:**

- Adding logging/metrics/tracing/alerts — use `.claude/rules/observability.md`
- Profiling or fixing measured slowness — use `.claude/rules/performance.md`
- The pre-merge quality gate (lint/typecheck/test/build/audit) — that runs via `/quality-gate` per `CLAUDE.md`
- Security headers / authz / secret handling specifics — use `.claude/rules/security.md`

## Prerequisites

Read first: this file · `CLAUDE.md` (the binding 3-env + Done/Released rules) · `.claude/rules/observability.md` (the after-deploy error watch) · the `promote-release` skill (the actual cross-env mechanics). Have: the G4 Staging sign-off recorded, the migration tested on Staging, and the rollback plan + tag/changelog drafted before you touch prod.

## Principles

- **Local-first, dev-integrated** (owner decision 2026-07-05): a story passes EVERYTHING locally (self-verify + G3 review + AC verified on localhost against the dev DB) before it merges anywhere; `dev` is the integration branch with **no Vercel deploy at all**, read through localhost; Staging deploys only on a batched `dev`→`staging` promote. No fix-rounds on staging.
- **Prod always goes through Staging** — no shortcut; every change is proven on a real env before it moves up.
- **Done ≠ Released** — many stories can be Done before they ship together as one release (release train) to control risk.
- **Safe deploy = reversible** — every release must be reversible (rollback plan + reversible migration); if not, it does not ship.
- **Deploy quota is a budget** (Vercel Hobby: 100 deployments/day rolling): only `staging` and `main` may create deployments — enforced by `vercel.json` `git.deploymentEnabled` allow-list, not by discipline.

## Standards

### 1. Environments (4-layer, the new layer is free)

| Env | Deploy when | Branch | Approval | DB | Role |
|---|---|---|---|---|---|
| Local | — | `feature/*` (worktrees) | — | local dev Postgres | Develop + self-verify + AC verify |
| **Dev (integration)** | **never (no Vercel deploy)** | `dev` | G3 packet per story | **local dev Postgres** (owner's localhost points here; refresh real data via `npm run db:sync-from-staging`, one-way staging→dev only) | Work is **"Done"**; owner reads via localhost |
| Staging | auto on batched promote `dev`→`staging` + smoke | `staging` (demo/pre-prod) | G4 sign-off (before prod promote) | staging DB | Label **`on-staging`** + acceptance/demo on the real URL |
| Production | promote `staging`→`main` + tag | `main` (release) | G5 | prod DB | **"Released"** |

### 2. Vercel mapping + deploy quota

`feature/*`, `dev` → **NO deployment** (blocked by `vercel.json` `git.deploymentEnabled` allow-list) · `staging` → Staging env (branch alias, preview-class) · `main` → Production · `DATABASE_URL` separate per dev/staging/prod · `prisma migrate deploy` runs in the Vercel build per env.

- **Quota facts (Vercel docs, verified 2026-07-05):** Hobby = 100 deployments/day rolling per owner; builds skipped via the Ignored Build Step **still count as full deployments** — the allow-list is the only mechanism that stops a push from creating a deployment at all. `scripts/vercel-ignore.sh` additionally skips the BUILD for docs-only staging/main pushes (saves build minutes, not quota).
- Need a one-off preview URL? `vercel deploy` via CLI (costs 1 quota; permission-gated).
- Full env/config matrix (มีแล้ว / ต้องเพิ่ม / จงใจไม่เติม): `.claude/ENV-CONFIG.md`

> How to set up the envs (Git/Vercel/Prisma) consistently + var matrix + clickable checklist: `docs/SETUP-ENVS.md`

### 3. Definition of Done vs On-staging vs Released

- **Done** (story → ticket state `Done`): full quality-gate green + G3 review passed + **AC verified on localhost against the dev DB BEFORE merge** + merged to `dev`. One PR per story carries spec + code + tests + docs together (no separate docs-only PRs; specs are read pre-merge via local links).
- **On-staging** (label `on-staging`): the story rode a batched `dev`→`staging` promote (~1-3/day or on owner request, one PR = one deploy) + staging smoke green. G4 sitting happens here on the real URL.
- **Released** (deployment → label `released` + git tag): promote `staging`→`main` + Production deploy + smoke green + tag + changelog + rollback plan + G5.
- `on-staging`/`released` are **labels, not states**; many stories can be Done before shipping together.
- **Back-merge chain (mandatory):** after every release or hotfix into `main` → back-merge `main`→`staging`→`dev` immediately (orchestrator runs it as part of promote-release) — prevents the protected-branch divergence deadlock.
- **Migrations:** developed and proven up→down→up against the local dev DB; the staging DB is first touched by `migrate deploy` inside the Vercel build at promote time. DB data sync is one-way staging→dev only.

> Full detail: `.claude/SYNC-ARCHITECTURE.md` §Definition of Done

### 4. Promotion rules (mandatory)

- Prod always goes through Staging (on-staging + G4 sign-off) — never skip.
- Every prod release has a **tag + changelog + rollback plan**.
- Migrations are **reversible + proven up→down→up on the local dev DB before promote; staging first sees them via `migrate deploy` in the promote build**.
- A failure at any env → **stop the promotion + auto-open a ticket** into the loop.
- Cross-env promotion happens only via `/promote-release --to <staging|prod>` (batched `dev`→`staging` = on-staging label, staging→main = Released). Story merges into `dev` (= Done) are the per-story pipeline, not a promotion.
- After every release/hotfix into `main`: back-merge `main`→`staging`→`dev` in the same sitting (mandatory chain).

### 5. Git / CI

- Use `git` + `gh` CLI; branch `<type>/<kebab>` · Conventional Commits · `main` + `staging` + `dev` protected.
- CI (`.github/workflows/ci.yml`) runs the server-side gate on every PR (base `dev`/`staging`/`main`); CI must pass before merge.
- Flow: story branch (spec + code + tests + docs, ONE PR) → PR into `dev` (= Done) → batched promote `dev`→`staging` (= on-staging) → promote `staging`→`main` (= Released).

### 6. After deploy (observability)

- Watch errors (Sentry) for N minutes after deploy → error spike = **auto-rollback + alert**; a real error → open a bug ticket into the loop.
- Ticket-DB tickets are checked against the story ticket template via `node scripts/ticket-sync.mjs audit`.

### 7. Pre-launch + rollout (before prod)

- **8 domains before shipping** — Code (test/build/lint green) · Security (no secrets, npm audit, authz, headers, rate-limit) · Performance (CWV pass, no N+1, image/bundle within budget — `.claude/rules/performance.md`) · Accessibility (keyboard/screen-reader/contrast AA — `DESIGN.md`) · Data/Migration (reversible, tested on Staging) · Observability (log/metric/alert ready — `.claude/rules/observability.md`) · Infra (prod env vars, DNS/SSL, health check) · Rollback (rollback plan + tag).
- **Graduated rollout** (if using flag/canary) — internal → 5% → 25% → 50% → 100%; **errors above baseline +10% = investigate · ≥2× = rollback**.
- **Feature flag lifecycle** — deploy off → enable one step at a time → **remove the flag within ~2 weeks** (no stale/leftover flags, no nested flags).

## Gate policy v2 (2026-07-04)

Owner-approved package: all gates remain owner-approved in principle. The owner authors this policy once, spot-audits it, and can revoke any pre-authorized class anytime — this is calibrated trust, not autopilot.

- **G1 Scope** — full human tap for M/L stories: spec-time is the highest-leverage checkpoint, no shortcut there. **Spec-lite class (S stories, trial-2 feedback)** — qualifies when ALL hold: no schema/migration · no new API contract (a new endpoint/contract routes to the full path) · single file-surface · expected diff ≤ ~150 lines; `story.md` (same v2 template, filled tersely) ships in the same PR as the code and G1 folds into the G3 packet (one owner tap, the packet leads with the spec summary); the PO decides the class at intake and states it on the ticket. M/L stories keep full spec-first — the spec is authored FIRST on the story's own branch and G1 taps on those files (read via local links / the PR view) before build starts; spec and code land in the same single PR into `dev` (amended 2026-07-05: no separate spec PR). Trial-2 evidence says the upfront spec pays for itself on seam-heavy work.
- **G2 Design — pre-authorized standard class.** A story qualifies as **standard change** when ALL hold: reuses existing tokens/components/flows per `DESIGN.md` · no new screen/flow/token · `check:ds` + `check:palette` green. A standard-class story skips the separate G2 tap; the G3 packet carries one line — `G2: standard class (criteria met)`. Any novel UI/flow/token routes to full human G2, as before.
- **G3 Merge — exception-first packet.** An adversarial fresh-context reviewer agent (correctness-scoped) plus the quality-gate CI run together serve as the peer review. The packet the owner sees leads with: verdict · exceptions/risks · $/story · the one-line G2 class note. The owner approves on the packet (target: sub-minute) and reads diffs only when an exception is flagged. Approval rubric = the Google standard: "approve when it definitely improves the system, not when it is perfect." The owner may approve-with-nits — the agent fixes the nit without a second tap.
- **G4 Staging — batched daily sitting.** Gate requests queue on `/status`; the owner clears them in ONE sitting per day (SLA: 1 business day). Packets stay atomic per story even when cleared in a batch — no bundling multiple stories' AC into one verify.
- **G5 Go-live** — unchanged: release train, tag/changelog/rollback, Sentry watch window = this policy's execution, not a separate track.

**Anti-rubber-stamp (mandatory companions — these are not optional extras):**

- Every retro (`/retro`) replays **all** gate rejections plus at least one real failure to the owner — automation-bias research shows ~41% of issues get silently omitted from a summary when the reviewer isn't shown the failure directly; replay the failure itself, not a paraphrase.
- The owner spot-audits a random standard-class G2 pass periodically (not every one — that would defeat the point of pre-authorization).
- A **graduated-autonomy ledger** records per-class approve/reject counts. Any NEW pre-authorized class requires ~20 clean approvals AND explicit owner ratification before it goes live.
- **Any miss demotes the class back to full-tap** — a single wrong pre-authorized pass reverts that whole class to mandatory human review until re-ratified; this is the safety valve, not a one-off exception.

## Examples

✅ **Promote to prod the right way.** Story is merged to `staging`, quality-gate green, migration reversible + already run on staging DB, and AC verified on the real Staging URL → G4 signed off. Run `/promote-release --to prod`; `prisma migrate deploy` succeeds on prod; cut a git tag + changelog entry + note the rollback plan; smoke-test the Production URL; watch Sentry for N minutes (no spike); label the story `released`. Three earlier Done stories ship together in this one release train.

❌ **Promoting straight from local.** A feature works on the local dev server, so it's pushed `feature/*`→`main` to ship faster — skipping Staging, G4, the tag/changelog, and the rollback plan. Prod always goes through Staging + G4 sign-off; this is blocked.

❌ **Calling Done "Released."** The story passed quality-gate and merged to `staging`, so it gets labeled `released`. Wrong: merged-to-staging + AC verified on the Staging URL = **Done** (state); `released` is a separate label earned only after the prod promote + tag + changelog + smoke.

## Reference Files

- `.claude/rules/observability.md` — the after-deploy error watch + alerts that gate this flow
- `.claude/rules/security.md` — secrets, authz, headers, rate-limit for the pre-launch Security domain
- `.claude/rules/performance.md` — CWV / N+1 / bundle budgets for the pre-launch Performance domain
- `docs/project/business.md` — product/business context the release serves
- the `promote-release` skill — the runnable cross-env promote/migrate/smoke/tag/changelog/rollback procedure
- `docs/RUNBOOK-db-migrations.md` — the reversible-migration runbook for steps 3 and the Data/Migration domain

## Next Steps

After G4 Staging sign-off, run `/promote-release --to prod` (= G5) to promote `staging`→`main`; on a green prod smoke, label the story `released` and **monitor** errors (Sentry) for the watch window — spike = auto-rollback, real error = open a bug ticket into the loop.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "`gh`/the script said merged, so it merged." | A chained `&& echo merged` can lie. Confirm with `gh pr view --json state`; a branch BEHIND after a concurrent merge makes the required status check "expected" and blocks even `--admin` → update the branch (merge base in) → re-run CI → merge (CAM-203). |
| "`git add -A` then branch — the tree is clean enough." | Another team's uncommitted WIP rides onto your branch and into the PR. Pre-flight `git status` before branching; stage explicit paths, never `git add -A`, when the tree may hold others' work (CAM-199). |
| "I'll promote straight from feature/Preview to prod." | Prod always goes through Staging + G4 sign-off first. |
| "This migration is irreversible / I'll test it first on prod." | Make it reversible + test on Staging before prod. |
| "Ship the release without a tag/changelog/rollback." | All three are required for every prod release. |
| "It failed, so I'll just silently retry." | Stop the promotion + auto-open a ticket. |
| "Local/Preview passed, so call it Done." | Done means AC verified on the real Staging URL. |
| "One `DATABASE_URL` across envs is simpler." | Keep staging/prod strictly separate. |
| "Add the new consistency/lint guard straight as blocking." | A grep guard catches forbidden STRINGS, not structural/role drift (CAM-221: ~90 drift passed `check-ds` with correct tokens but the wrong role / re-implemented). Use AST/co-occurrence heuristics for structural rules, and roll out **report-mode → clear the backlog to 0 → flip to blocking**; never ship a blocking guard with a non-zero backlog. Make supplementary CI checks (visual regression) advisory (`continue-on-error` + non-required) so they don't block the gate. |

## Verify (exit criteria)

- [ ] build + `prisma migrate deploy` succeeded on the target env
- [ ] migration reversible + tested on Staging before prod
- [ ] AC verified on the **real URL** (Staging→Done / Production→smoke green)
- [ ] (prod) tag + changelog + rollback plan complete + G5 passed
- [ ] errors watched after deploy; spike → auto-rollback; real error → open a bug ticket
- [ ] Ticket DB status synced (`ticket-sync.mjs audit` passes) before closing the story
