---
name: quality-gate
description: Run the mandatory pre-merge quality gate — lint, typecheck, test+coverage, build, npm audit, (UI) design gate — then summarize pass/fail. Use when an atomic story is complete, before opening/merging a PR into `staging` (the "Done" criterion). Do NOT use it to decide "Released" — prod goes through `/promote-release --to prod` (smoke/tag/changelog handled separately).
---

# quality-gate

## Overview

Run the mandatory gate before merging into `staging`, summarize pass/fail, and block the merge if any step is red. A green gate is the floor for "Done" — never merge while red.

Read first: `CLAUDE.md` (Quality gates) · `.claude/rules/qa.md` · `.claude/rules/ops.md` (Done vs Released) · `DESIGN.md` (UI work).

## Quick Reference

Run in order, at the repo root, on the `feature/*` branch. Stop on the first fail — do not continue a red gate.

1. `npm run lint` → 0 errors.
2. `npm run typecheck` → 0 errors.
3. `npm test -- --coverage` → all green + coverage ≥ 80% on new code.
4. `npm run build` → succeeds (incl. `prisma generate`).
5. `npm audit --omit=dev` → 0 high/critical.
6. Five-Axis review (correctness · readability · architecture · security · perf) → clean.
7. **(UI only)** design gate → token-only + a11y WCAG AA + anti-slop + screenshot vs Brief.
8. `node scripts/linear-sync.mjs audit` → artifact↔Linear consistency (exit non-zero on an incomplete or status-stale scaffolded story).
9. Summarize as a pass/fail table.

| Step | Command / check | Pass condition | Result |
| --- | --- | --- | --- |
| 1 | `npm run lint` | 0 errors | ☐ |
| 2 | `npm run typecheck` | 0 errors | ☐ |
| 3 | `npm test -- --coverage` | green + coverage ≥ 80% new code | ☐ |
| 4 | `npm run build` | succeeds (incl. `prisma generate`) | ☐ |
| 5 | `npm audit --omit=dev` | 0 high/critical | ☐ |
| 6 | Five-Axis review | clean on all five axes | ☐ |
| 7 | design gate (UI only) | pass, or `N/A — no UI work` | ☐ |
| 8 | `node scripts/linear-sync.mjs audit` | artifact↔Linear consistent (exit 0) | ☐ |

## When to Use

- An atomic story is finished (code + states + validation) and you are about to open or merge a PR into `staging` (the "Done" criterion).
- Run at the repo root, on the `feature/*` branch that will open the PR into `staging`.
- Know up front whether the work touches UI — that decides whether the design gate (step 7) must run.

**NOT for:**

- Deciding "Released" — prod goes through `/promote-release --to prod` (smoke/tag/changelog handled separately).
- Doing the work itself — the gate verifies finished work, it is not where you write code.
- Opening the PR — that is the `open-pr` skill, run after the gate is green.

## Prerequisites

Read first:

- `CLAUDE.md` — the Quality gates section (the mandatory pre-merge checklist).
- `.claude/rules/qa.md` — test rigor + the coverage ≥ 80% on new code rule.
- `.claude/rules/ops.md` — Done vs Released, and the 3-env flow (Local → Staging → Production).
- `DESIGN.md` — required only for UI work, for the design gate (step 7).

Have ready: a finished atomic story on its `feature/*` branch, a clean working tree, dependencies installed (`npm ci`), and the STORY-TICKET to hand.

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
   - **Architecture** — change fits the layering in `.claude/rules/architecture.md`; no leaking of concerns; reuse over duplication.
   - **Security** — input validated, authz enforced, no secrets in code, no injection surface (see `.claude/rules/security.md`).
   - **Perf** — no N+1 Prisma queries, no needless re-renders, payloads bounded (see `.claude/rules/api.md`).

7. **(UI work only)** design gate: token-only (no hardcoded colors/spacing/shadows) + a11y WCAG AA (contrast, `aria-label`, focus, tap target ≥ 44px) + anti-slop audit + compare screenshots against the Design Brief.
8. `node scripts/linear-sync.mjs audit` → artifact↔Linear consistency (exit non-zero on an incomplete or status-stale scaffolded story; keeps the `docs/delivery/` files aligned with reality — see the `delivery-artifacts` skill).
9. Summarize every step as a pass/fail table.

## Planned automated gates (candidates)

These are not yet enforced. List them in the summary as "planned" so reviewers know what is still manual, and promote each to a numbered step once wired into `.github/workflows/ci.yml`:

- **secret-scan** — repo-wide secret detection on every PR.
- **a11y axe** — automated axe run against rendered UI (complements the manual design gate).
- **perf scorecard** — Lighthouse/bundle-size budget check.
- **pre-prod observability** — verify logging/tracing/alerts wired before promote (see `.claude/rules/observability.md`).

## Examples

✅ **Correct — a red step stops the gate and opens a defect.** A UI story runs the gate and reports the full table:

| Step | Command / check | Pass condition | Result |
| --- | --- | --- | --- |
| 1 | `npm run lint` | 0 errors | ✅ 0 errors |
| 2 | `npm run typecheck` | 0 errors | ✅ 0 errors |
| 3 | `npm test -- --coverage` | green + coverage ≥ 80% new code | ❌ 2 failing, coverage 71% |
| 4 | `npm run build` | succeeds | ⏸ not run (stopped at step 3) |
| 5 | `npm audit --omit=dev` | 0 high/critical | ⏸ not run |
| 6 | Five-Axis review | clean | ⏸ not run |
| 7 | design gate (UI) | pass | ⏸ not run |

Planned (not enforced): secret-scan · a11y axe · perf scorecard · pre-prod observability. Step 3 is red → **stop**, open a Linear defect (repro + the failed criterion: coverage 71% < 80%, 2 tests failing), block the merge. The story does not move.

❌ **Wrong — "lint passed so merge."** Treating one green step as a pass, skipping typecheck/test/build/audit/Five-Axis, and merging into `staging`. Lint is not review; a green gate requires every step above, and "Done" still needs the Staging URL verified.

## Reference Files

- `.claude/rules/qa.md` — test rigor, coverage ≥ 80% on new code, real assertions (steps 3, 6).
- `.claude/rules/security.md` — the Security axis of the Five-Axis review + `npm audit` expectations (steps 5, 6).
- `.claude/rules/api.md` — the Perf axis: no N+1 Prisma queries, bounded payloads (step 6).
- `.claude/rules/architecture.md` — the Architecture axis: layering, concern boundaries, reuse over duplication (step 6).
- `.claude/rules/observability.md` — the planned pre-prod observability gate (logging/tracing/alerts).
- `delivery-artifacts` skill — owns the `audit` step (artifact↔Linear consistency under `docs/delivery/`).
- Sibling skills: `open-pr` (run after the gate is green) · `promote-release` (staging→prod, separate from this gate).

The Five-Axis review content is kept inline in the Workflow above — no `references/` directory.

## Next Steps

- All green → run the `open-pr` skill to open the PR into `staging`.
- Do NOT set the Linear state to `Done` until the AC is verified on the real Staging URL (see `.claude/rules/ops.md`).
- Released is separate — promote `staging`→`main` via the `promote-release` skill (`/promote-release --to prod`), which handles smoke/tag/changelog.

## Common Rationalizations

| Rationalization | Reality |
| --- | --- |
| "Lint/type pass, that's enough to merge." | A green gate is not yet "Done" — Done also requires merging into `staging` + a successful migration on staging + verifying the AC on the real Staging URL (see `.claude/rules/ops.md`). |
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
- [ ] `node scripts/linear-sync.mjs audit` exits 0 (no incomplete or status-stale scaffolded story in `docs/delivery/`).
- [ ] All green → ready for `/open-pr` into `staging`; do NOT change Linear state to `Done` until the Staging URL is verified.
- [ ] Red → defect ticket opened + merge blocked; the story does not move.
- [ ] Before handoff: STORY-TICKET passes `node scripts/linear-sync.mjs audit` (has `## Story` + `## AC`).
