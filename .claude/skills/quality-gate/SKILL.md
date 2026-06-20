---
name: quality-gate
description: Run the mandatory pre-merge quality gate — lint, typecheck, test+coverage, build, npm audit, (UI) design gate — then summarize pass/fail. Use when an atomic story is complete, before opening/merging a PR into `staging` (the "Done" criterion). Do NOT use it to decide "Released" — prod goes through `/promote-release --to prod` (smoke/tag/changelog handled separately).
---
# quality-gate — run the mandatory gate before merging into `staging`, summarize pass/fail, and block the merge if red
Read first: `CLAUDE.md` (Quality gates) · `std/qa.md` · `std/ops.md` (Done vs Released) · `DESIGN.md` (UI work)

## Input / preconditions
- The atomic story is actually finished (code + states + validation) — the gate is not where you write the work
- Run at repo root, on the `feature/*` branch that will open a PR into `staging`
- Know whether this work touches UI or not (decides whether design gate step 6 must run)

## Workflow — run in order, stop immediately on the first fail
1. `npm run lint` → 0 errors
2. `npm run typecheck` → 0 errors (no unjustified `any`)
3. `npm test -- --coverage` → all tests green + coverage ≥ 80% on new code (every AC covered by a test)
4. `npm run build` → succeeds (including `prisma generate`)
5. `npm audit --omit=dev` → 0 high/critical
6. **(UI work only)** design gate: token-only (no hardcoded colors/spacing/shadows) + a11y WCAG AA (contrast, aria-label, focus, tap target ≥44px) + anti-slop audit + compare screenshots against the Design Brief
7. Summarize every step as a pass/fail table

## Watch for / Anti-patterns
- Any step fails → stop immediately, open a Linear ticket (defect, repro + the criterion that failed), **block the merge** — never merge while red
- Coverage measures **new code**, not the whole repo; tests must assert for real, not be flaky, not over-mock
- A green gate is not yet "Done" — "Done" also requires merging into `staging` + a successful migration on staging + **verifying the AC on the real Staging URL** (see `std/ops.md`)
- Work that does not touch UI: step 6 may be skipped, but mark it in the table as "N/A — no UI work"
- This gate runs locally before push; CI (`.github/workflows/ci.yml`) re-runs it server-side on every PR based on `staging`/`main` — results must match

## Output / postconditions
- A complete pass/fail table of all 6 items (UI) or 5 items + N/A (no UI)
- All green → ready to open a PR into `staging` (`/open-pr`); do NOT change Linear state to `Done` until the Staging URL is verified
- Red → defect ticket opened + merge blocked, story does not move

## Verify
- Every row in the table reflects a real result from the command that was run (no guessing/skipping)
- No item left "skipped" without a reason (UI work that skips step 6 must confirm there is no diff in `app/`/`components/`)
- Before handoff: STORY-TICKET passes `node scripts/linear-sync.mjs audit` (has ## Story + ## AC)
