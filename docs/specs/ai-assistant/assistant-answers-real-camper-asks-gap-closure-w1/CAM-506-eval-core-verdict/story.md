---
ticket: CAM-506
epic: CAM-456
title: Eval verdict scores core cases only — deferred-tool cases reported separately (S4a)
class: spec-lite
version: 1
---

# CAM-506 — Eval verdict scores core cases only (S4a)

## Story

As a **platform** maintainer, I want the golden-eval verdict to judge tool-call correctness on **core** cases only (excluding the 9 `group:"deferred"` unbuilt-tool cases), so that the gate reflects the model's real quality on buildable capability and isn't dragged below threshold by tools that don't exist yet.

Scope: `scripts/ai-eval/score.ts` (`computeRollup` + a new core/deferred split) and `scripts/ai-eval/report.ts` (surface both denominators). NO change to case data, the agent loop, or the paid-run trigger.
Depends on: — (the `group:"deferred"` marker already exists on 9 cases).

Why: the deferred cases test tools deliberately not built (the FIX-lane L4 backlog); counting them against the correctness threshold makes the verdict permanently un-passable and hides real core movement (raw 77.8% vs ~90% core today). This is S4a of the Capability Loop PROVE pillar (`docs/research/ai-chat/campvibe-capability-loop-plan.md` §2.4).

## AC

| # | Given | When | Then (user sees) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | 60 golden cases, 9 tagged `group:"deferred"`, 6 guardrail | eval rollup is computed | Report shows a **Core tool-call correctness** row (over non-guardrail, non-deferred cases) AND a separate **Deferred (informational)** row | verdict is decided on Core correctness + guardrail only | EC-1 |
| AC-2 | Core correctness ≥ 95% and guardrail = 100% | rollup computed | Verdict = **PASS** | — | EC-2 |
| AC-3 | A deferred case fails (its tool still unbuilt) | rollup computed | Verdict is **unaffected** by the deferred fail (it is not in the verdict denominator) | deferred fail counted only in the informational row | AC-2 |
| AC-4 | A guardrail case fails | rollup computed | Verdict = **REPORTING/FAIL** regardless of core % | guardrail is still 100%-or-flip | EC-3 |

## Rules

- BR-1: **Core set** = cases where `guardrail !== true` AND `group !== "deferred"`. **Deferred set** = `group === "deferred"`. **Guardrail set** = `guardrail === true`. The three are disjoint and partition all cases.
- BR-2: `TOOL_CALL_CORRECTNESS_THRESHOLD` (0.95) now applies to **core** correctness; `GUARDRAIL_THRESHOLD` (1.0) unchanged.
- BR-3: Verdict = PASS iff (core correctness ≥ 0.95) AND (guardrail = 1.0). Deferred pct never enters the verdict.
- BR-4: The report still prints the raw/overall correctness for continuity, clearly labelled, but the **Verdict** line is driven by core.

## Edge cases

- EC-1: IF there are zero core cases THEN core correctness = 1.0 (vacuously; a run with only guardrail+deferred can still PASS on guardrail) — never divide-by-zero.
- EC-2: IF a case is BOTH guardrail and deferred (should never happen) THEN guardrail wins (counted in guardrail, excluded from core and deferred) — assert the sets stay disjoint in a test.
- EC-3: IF a guardrail case fails THEN verdict flips even at 100% core (existing invariant, retained).

## Data

None — no schema, no case-data change. Reads the existing `group` field on `GoldenCase`.

## Seams & refs

- `scripts/ai-eval/score.ts` `computeRollup` (pure) — extend the rollup with `{coreCorrectnessPct, deferredCorrectnessPct, counts:{core,deferred,guardrail}}`; verdict reads core.
- `scripts/ai-eval/report.ts` — add the Core / Deferred rows; keep the overall row labelled "raw".
- `__tests__/cam-457-eval-harness.test.ts` — the scorer is unit-tested here; add core/deferred/guardrail partition + verdict-on-core tests.

## Out of scope

- **S4b guardrail-blocking CI** (flip `ai-eval.yml` to fail on `lib/ai/**` PRs) — owner-gated on secret + recurring cost + flakiness handling; separate story.
- Growing the golden set from a miner (S3).

## Self-verify

- [ ] `npx vitest run __tests__/cam-457-eval-harness.test.ts` green incl. new partition/verdict tests
- [ ] `npx tsc --noEmit` clean
- [ ] A re-render of the last report shows Core vs Deferred rows and a Core-driven Verdict (verified against the stored `baseline-report.json` case list, no paid run needed)
