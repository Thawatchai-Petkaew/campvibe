---
linear: CAM-466
feature: platform-hardening
epic: platform-hardening (CAM-46)
persona: platform
artifact: story
owner: product-owner
status: In Progress — spec-lite (G1 folds into G3 packet)
version: v2
updated: 2026-07-21
---
# Clear npm audit highs — refile shadcn dep chain (CAM-466)

<!-- Spec-lite class (S story): no schema/migration · no new API contract · single file-surface (package.json + package-lock.json) · hand-written diff ≤ ~10 lines (lockfile is generated). G1 folds into the G3 packet per Gate policy v2. -->

## Story
As the **platform** (maintainer-facing), I want the two HIGH advisories in `npm audit --omit=dev` cleared at their real root — the `shadcn` CLI misfiled as a runtime dependency, dragging `brace-expansion` (GHSA-3jxr-9vmj-r5cp) and `js-yaml` (GHSA-52cp-r559-cp3m) chains into the production audit — so that the 0-high/critical gate criterion is restored and PR #538 (and all future gates) can pass on their own merits.
Why: v1 of this spec named the wrong chain (next→postcss/next-auth) — build-time ground truth (2026-07-21) shows that chain is MODERATE (CVSS 6.1) and unfixable within current majors upstream; the actual HIGHs come via `shadcn`, which is a codegen CLI with zero runtime imports (verified: no `from 'shadcn'` anywhere in app/lib/components/scripts) sitting in `dependencies`.
Scope: (1) move `shadcn` from `dependencies` → `devDependencies` (dependency hygiene — dev tooling must not count against the production audit); (2) IF any high remains under `--omit=dev` after the refile, add minimal npm `overrides` (e.g. brace-expansion, js-yaml patched ranges) — no major bumps; (3) document the accepted remainder (next→postcss moderates, unfixable upstream) in the PR body.
Depends on: —

## AC
| # | Given | When | Then (dev-facing, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The repo after the refile (+ overrides if needed) | `npm audit --omit=dev` runs | Reports 0 high and 0 critical; remaining moderates listed with count | Audit gate criterion restored repo-wide | EC-1 |
| AC-2 | The updated lockfile | Full quality gate runs (lint, typecheck, `npm test`, build in CI) | All green — no regression | `shadcn` CLI still usable via devDependencies (`npx shadcn` unaffected) | EC-2 |
| AC-3 | The full audit WITHOUT `--omit=dev` | `npm audit` runs | The shadcn-chain advisories may still appear under dev — stated, not hidden; tracked as dev-only exposure | Honest reporting of what moved vs what was fixed | EC-1 |

## Rules
- BR-1 Root-cause first: refile `shadcn` to devDependencies (it is build-time codegen tooling; zero runtime imports verified). Overrides are the fallback for anything still high under `--omit=dev`, at the smallest patched ranges; `npm audit fix --force` forbidden.
- BR-2 No major bumps of `next`/`next-auth` in this story; the next→postcss MODERATE chain is accepted + documented (no upstream fix exists) — it does not violate the gate (gate = high/critical only).

## Edge cases
- EC-1 IF a high remains after refile + minimal overrides THEN report the exact advisory + why, and STOP for orchestrator routing (no silent partial fix).
- EC-2 IF any test/build breaks THEN fix only trivially-mechanical breakage here; anything behavioral → STOP + raise.

## Data
- No schema/DB/migration. Files: `package.json`, `package-lock.json` only (plus this spec).

## Seams & refs
- `.claude/rules/security.md` (0 high/critical gate) · CAM-458 ticket comments (discovery context) · v1→v2 pivot evidence: backend STOP-report 2026-07-21 (audit ground truth) · shadcn runtime-import check: `grep -rn "from 'shadcn'" app lib components scripts` → 0 hits.

## Out of scope
- Major-version upgrades of next/next-auth · the next→postcss moderates (accepted, unfixable upstream) · dev-only audit noise (visible without `--omit=dev`) · any feature/code refactor.

## Self-verify
- `npm audit --omit=dev` → 0 high/critical (paste counts before/after) · `npx shadcn --help` still runs (CLI intact) · `npm run lint` · `npx tsc --noEmit` · `npm test` full suite · CI green (build proof).

## Changelog
- v1 (2026-07-21) — spec-lite authored at intake naming the next/postcss/next-auth chain as the HIGH source (per initial security-report attribution).
- v2 (2026-07-21) — re-entered Discovery on backend STOP-report: audit ground truth shows next-chain = moderate/unfixable; real HIGHs come via `shadcn` misfiled in `dependencies`. Scope corrected to refile-shadcn + minimal overrides fallback; folder renamed to match retitled ticket.
