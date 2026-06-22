---
name: release-and-ops
description: Standard for CampVibe's release and operations flow — 3-env promotion, Done vs Released, safe reversible deploys, pre-launch gates, and rollout. Use when promoting code across envs (merge→staging = Done, staging→main = Released). Use when planning a migration, tag, changelog, or rollback. Use when running a pre-prod launch checklist or a feature-flag rollout. Memory for the DevOps role; pairs with std/observability.md, std/security.md, std/performance.md, DESIGN.md, std/architecture.md, CLAUDE.md.
---

# Release & Ops

## Overview

A deploy you can't reverse is a deploy you shouldn't run. CampVibe ships through three environments — Local → Staging → Production — where every change is proven on a real env before it moves up, "Done" and "Released" are deliberately separate, and every prod release carries a tag, a changelog, and a rollback plan. The goal: reversible, observable, gated releases with no shortcut to prod.

## When to Use

- Promoting code across envs: merge→`staging` (= Done) or `staging`→`main` (= Released)
- Planning or reviewing a migration, a git tag, a changelog entry, or a rollback plan
- Running the pre-launch checklist before a prod release
- Rolling a feature out behind a flag/canary (graduated rollout)
- Wiring CI/branch protection or the Vercel env mapping

**NOT for:**

- Adding logging/metrics/tracing/alerts — use `std/observability.md`
- Profiling or fixing measured slowness — use `std/performance.md`
- The pre-merge quality gate (lint/typecheck/test/build/audit) — that runs via `/quality-gate` per `CLAUDE.md`
- Security headers / authz / secret handling specifics — use `std/security.md`

## Principles

- **3-env lean** for solo/Hobby: Local Dev → Staging → Production. The old SIT+UAT collapse into a **single Staging** to stay lean; every PR gets a Vercel Preview (ephemeral) for a fast check before merge.
- **Prod always goes through Staging** — no shortcut; every change is proven on a real env before it moves up.
- **Done ≠ Released** — many stories can be Done before they ship together as one release (release train) to control risk.
- **Safe deploy = reversible** — every release must be reversible (rollback plan + reversible migration); if not, it does not ship.

## Standards

### 1. Environments (3-env)

| Env | Deploy when | Branch | Approval | DB | Role |
|---|---|---|---|---|---|
| Local Dev | — | `feature/*` | — | local Postgres | Develop + self-verify |
| Staging | auto on merge to `staging` + smoke | `staging` (integration) | G4 sign-off (before promote) | staging DB | Work is **"Done"** + acceptance/demo |
| Production | promote `staging`→`main` + tag | `main` (release) | G5 | prod DB | **"Released"** |

### 2. Vercel mapping

`feature/*` → Preview (ephemeral) · `staging` → Staging env · `main` → Production · `DATABASE_URL` separate per staging/prod · run `prisma migrate deploy` per env.

> How to set up all 3 envs (Git/Vercel/Prisma) consistently + var matrix + clickable checklist: `docs/SETUP-ENVS.md`

### 3. Definition of Done vs Released

- **Done** (story → Linear state `Done`): merged to `staging` + full quality-gate green + migration succeeded on staging + **AC verified on the real Staging URL**.
- **Released** (deployment → label `released` + git tag): promote `staging`→`main` + Production deploy + smoke green + tag + changelog + rollback plan + G5.
- `released` is a **label, not a state**; many stories can be Done before shipping together as one release.

> Full detail: `ai-planning/SYNC-ARCHITECTURE.md` §Definition of Done

### 4. Promotion rules (mandatory)

- Prod always goes through Staging (Done + G4 sign-off) — never skip.
- Every prod release has a **tag + changelog + rollback plan**.
- Migrations are **reversible + tested on Staging before prod**.
- A failure at any env → **stop the promotion + auto-open a Linear ticket** into the loop.
- Cross-env promotion happens only via `/promote-release --to <staging|prod>` (merge→staging = Done, staging→main = Released).

### 5. Git / CI

- Use `git` + `gh` CLI; branch `<type>/<kebab>` · Conventional Commits · `main` + `staging` protected.
- CI (`.github/workflows/ci.yml`) runs the server-side gate on every PR (base `staging`/`main`); CI must pass before merge.
- Flow: feature → PR into `staging` (= Done) → promote `staging`→`main` (= Released).

### 6. After deploy (observability)

- Watch errors (Sentry) for N minutes after deploy → error spike = **auto-rollback + alert**; a real error → open a bug ticket into the loop.
- Linear-side tickets are checked against the STORY-TICKET template via `node scripts/linear-sync.mjs audit`.

### 7. Pre-launch + rollout (before prod)

- **8 domains before shipping** — Code (test/build/lint green) · Security (no secrets, npm audit, authz, headers, rate-limit) · Performance (CWV pass, no N+1, image/bundle within budget — `std/performance.md`) · Accessibility (keyboard/screen-reader/contrast AA — `DESIGN.md`) · Data/Migration (reversible, tested on Staging) · Observability (log/metric/alert ready — `std/observability.md`) · Infra (prod env vars, DNS/SSL, health check) · Rollback (rollback plan + tag).
- **Graduated rollout** (if using flag/canary) — internal → 5% → 25% → 50% → 100%; **errors above baseline +10% = investigate · ≥2× = rollback**.
- **Feature flag lifecycle** — deploy off → enable one step at a time → **remove the flag within ~2 weeks** (no stale/leftover flags, no nested flags).

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll promote straight from feature/Preview to prod." | Prod always goes through Staging + G4 sign-off first. |
| "This migration is irreversible / I'll test it first on prod." | Make it reversible + test on Staging before prod. |
| "Ship the release without a tag/changelog/rollback." | All three are required for every prod release. |
| "It failed, so I'll just silently retry." | Stop the promotion + auto-open a Linear ticket. |
| "Local/Preview passed, so call it Done." | Done means AC verified on the real Staging URL. |
| "One `DATABASE_URL` across envs is simpler." | Keep staging/prod strictly separate. |

## Verify (exit criteria)

- [ ] build + `prisma migrate deploy` succeeded on the target env
- [ ] migration reversible + tested on Staging before prod
- [ ] AC verified on the **real URL** (Staging→Done / Production→smoke green)
- [ ] (prod) tag + changelog + rollback plan complete + G5 passed
- [ ] errors watched after deploy; spike → auto-rollback; real error → open a bug ticket
- [ ] Linear status synced (`linear-sync.mjs audit` passes) before closing the story
