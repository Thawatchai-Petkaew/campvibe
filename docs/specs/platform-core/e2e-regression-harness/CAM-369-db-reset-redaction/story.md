---
linear: CAM-369
feature: platform-core
epic: e2e-regression-harness (CAM-46)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-07-05
class: spec-lite
---
<!-- spec-lite (gate policy v2): no schema/migration · no new API contract · single file-surface (scripts/db-reset.mjs + its test) · diff well under ~150 lines. G1 folds into the G3 packet; this file ships in the same PR as the code. -->

# db-reset.mjs: hostname-only console output, closes query-string secret leak (CAM-369)

## Story
As the **Platform** (delivery team), I want `scripts/db-reset.mjs` to print only the scheme + hostname of the target database before a reset (never userinfo/path/query), so that a Prisma Postgres `?api_key=...`-style query-string secret never lands in console/CI logs.
Why: retro finding (ledger row CAM-359/db-reset) — the existing mask only replaces the userinfo segment before `@`; a query-string secret is untouched and prints raw. The successor guard (`e2e/regression/db-guard.ts`'s `describeUrlShape()`) already solved this correctly; this ticket ports the same approach into the script.
Scope: redact the pre-reset console line in `scripts/db-reset.mjs` only. No change to the guard semantics (`ALLOW_DB_RESET`, prod-detection) or the reset flow itself (drop + migrate deploy + seed). Sweep `scripts/` for any other raw/masked connection-string print (none found beyond this file — see `## Seams & refs`).
Depends on: — (follows CAM-359, no ticket dependency)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | `ALLOW_DB_RESET=1` and a valid `DATABASE_URL` with userinfo + path + query (e.g. `postgresql://user:pw@host:5432/db?api_key=secret`), target not prod | The script runs | Console line reads `⚠️  Resetting DB (drop + migrate deploy + seed): postgresql://host` — no credentials, no db name, no query string anywhere in the run's output (dev-facing, English by design — a CLI tool's own console output, not end-user UI) | No behavior change to the guard/reset flow; only the printed line changes | EC-1 |

## Rules
- BR-1 The pre-reset console line is built from `describeUrlShape(url)` — `scheme://hostname` only (IPv6 brackets stripped) — never the raw or userinfo-masked `url`. (proves AC-1)
- BR-2 Guard semantics unchanged: refuses without `ALLOW_DB_RESET=1`, without `DATABASE_URL`, or when the target looks like production (`/prod/i` on the URL, or `NODE_ENV`/`VERCEL_ENV === "production"`).

## Edge cases
- EC-1 IF the `DATABASE_URL` is not a parseable URL THEN `describeUrlShape` returns the fixed placeholder `(unparseable)` — never echoes the unparsed input string (BR-1)

## Data
- No entities/fields touched · migration: none

## Seams & refs
- Reuse: `e2e/regression/db-guard.ts`'s `describeUrlShape()` — same intent (scheme+hostname only), ported inline into `scripts/db-reset.mjs` because `scripts/*.mjs` cannot import a `.ts` module. `scripts/db-sync-from-staging.mjs` already prints hostname-only (`hostOf()`); verified during the sweep, no change needed. Sweep of `scripts/` found no other raw/masked-URL console print. Refs: CAM-359 (predecessor, introduced `describeUrlShape`).

## Out of scope
- Flipping `db-sync-from-staging.mjs`'s `hostOf()` to share the exact same helper (already safe, no leak) → no follow-up needed.
- Any `lib/` app-code connection-string logging (none found in this ticket's sweep; sweep was scoped to `scripts/` per the ticket).

## Self-verify
- AC-1 → unit (behavioral test of `describeUrlShape` + source-inspection guard that the vulnerable pattern is gone)
- Story-specific: guard semantics (`ALLOW_DB_RESET`, `looksProd`) unchanged — asserted via source-inspection
- Gate = /quality-gate · Done = merged to `dev`, AC verified on localhost per the dev-branch flow

## Changelog
- v1 (2026-07-05) — created
