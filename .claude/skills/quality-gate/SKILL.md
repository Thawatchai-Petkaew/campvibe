---
name: quality-gate
description: Run the mandatory pre-merge quality gate — lint, typecheck, test+coverage, build, npm audit, (UI) design gate — then summarize pass/fail. Use when an atomic story is complete, before opening/merging a PR into `staging` (the "Done" criterion). Do NOT use it to decide "Released" — prod goes through `/promote-release --to prod` (smoke/tag/changelog handled separately).
---

# quality-gate

## Overview

Run the mandatory gate before merging into `staging`, summarize pass/fail, and block the merge if any step is red. A green gate is the floor for "Done" — never merge while red.

Read first: `CLAUDE.md` (Quality gates) · `std/qa.md` · `std/ops.md` (Done vs Released) · `DESIGN.md` (UI work).

## When to Use

- An atomic story is finished (code + states + validation) and you are about to open or merge a PR into `staging` (the "Done" criterion).
- Run at the repo root, on the `feature/*` branch that will open the PR into `staging`.
- Know up front whether the work touches UI — that decides whether the design gate (step 7) must run.

**NOT for:**

- Deciding "Released" — prod goes through `/promote-release --to prod` (smoke/tag/changelog handled separately).
- Doing the work itself — the gate verifies finished work, it is not where you write code.
- Opening the PR — that is `/open-pr` after the gate is green.

## Workflow

Run in order. Stop immediately on the first fail.

1. `npm run lint` → 0 errors.
2. `npm run typecheck` → 0 errors (no unjustified `any`).
3. `npm test -- --coverage` → all tests green + coverage ≥ 80% on new code (every AC covered by a test).
4. `npm run build` → succeeds (including `prisma generate`).
5. `npm audit --omit=dev` → 0 high/critical.
6. Five-Axis code-review pass — review the diff across all five axes; each must be clean before proceeding:

   - **Correctness** — logic matches the AC; edge cases, error paths, and async/await handled; no off-by-one or unhandled null.
   - **Readability** — clear names, no dead code, no commented-out blocks, no unjustified complexity.
   - **Architecture** — change fits the layering in `std/architecture.md`; no leaking of concerns; reuse over duplication.
   - **Security** — input validated, authz enforced, no secrets in code, no injection surface (see `std/security.md`).
   - **Perf** — no N+1 Prisma queries, no needless re-renders, payloads bounded (see `std/api.md`).

7. **(UI work only)** design gate: token-only (no hardcoded colors/spacing/shadows) + a11y WCAG AA (contrast, `aria-label`, focus, tap target ≥ 44px) + anti-slop audit + compare screenshots against the Design Brief.
8. Summarize every step as a pass/fail table.

## Planned automated gates (candidates)

These are not yet enforced. List them in the summary as "planned" so reviewers know what is still manual, and promote each to a numbered step once wired into `.github/workflows/ci.yml`:

- **secret-scan** — repo-wide secret detection on every PR.
- **a11y axe** — automated axe run against rendered UI (complements the manual design gate).
- **perf scorecard** — Lighthouse/bundle-size budget check.
- **pre-prod observability** — verify logging/tracing/alerts wired before promote (see `std/observability.md`).

## Common Rationalizations

| Rationalization | Reality |
| --- | --- |
| "Lint/type pass, that's enough to merge." | A green gate is not yet "Done" — Done also requires merging into `staging` + a successful migration on staging + verifying the AC on the real Staging URL (see `std/ops.md`). |
| "Coverage is over 80% on the whole repo." | Coverage measures new code, not the whole repo. Tests must assert for real — not flaky, not over-mocked. |
| "No UI changed, skip the design gate silently." | Step 7 may be skipped for non-UI work, but mark it in the table as "N/A — no UI work" and confirm there is no diff in `app/`/`components/`. |
| "One step failed but the rest are green, I'll patch later." | Any fail → stop immediately, open a Linear ticket (defect, repro + the failed criterion), block the merge. Never merge while red. |
| "It passed locally, CI is just a formality." | This gate runs locally before push; CI (`.github/workflows/ci.yml`) re-runs it server-side on every PR based on `staging`/`main` — results must match. |
| "Lint passed, so the code is fine." | Lint is not review. The Five-Axis pass (correctness/readability/architecture/security/perf) is a separate, required step. |

## Verify (exit criteria)

- [ ] A complete pass/fail table of all 7 items (UI) or 6 items + N/A (no UI), plus the planned gates listed as "planned".
- [ ] Every row reflects a real result from the command that was run — no guessing, no skipping.
- [ ] No item left "skipped" without a reason; UI work that skips step 7 confirms there is no diff in `app/`/`components/`.
- [ ] Five-Axis pass is clean across all five axes (correctness, readability, architecture, security, perf).
- [ ] All green → ready for `/open-pr` into `staging`; do NOT change Linear state to `Done` until the Staging URL is verified.
- [ ] Red → defect ticket opened + merge blocked; the story does not move.
- [ ] Before handoff: STORY-TICKET passes `node scripts/linear-sync.mjs audit` (has `## Story` + `## AC`).
