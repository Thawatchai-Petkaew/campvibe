---
ticket: CAM-507
epic: CAM-456
title: Guardrail eval subset blocks lib/ai PRs — real-model gate with retry-guard (S4b)
class: standard-story
version: 2
---

# CAM-507 — Guardrail eval subset blocks lib/ai PRs (S4b)

## Story

As a **platform** maintainer, I want the 6 guardrail golden cases to run as a **blocking** real-model check on every PR that touches `lib/ai/**`, so that a change which makes the assistant call a tool on an adversarial/no-tool prompt (a safety regression) cannot merge — while the ~54 non-guardrail cases stay in the advisory manual run.

Scope: a guardrail-only eval mode + a dedicated blocking CI workflow. NO product code, NO schema, NO change to the golden case data or the advisory `ai-eval.yml`.
Depends on: the `OPENROUTER_API_KEY` GitHub Actions secret (set 2026-07-25). This is S4b of the Capability Loop PROVE pillar (`docs/research/ai-chat/campvibe-capability-loop-plan.md` §2.4). Precondition met: guardrails have passed 100% every run (backlog 0) per ops.md report→blocking rule.

Why: the assistant's safety invariants (no auto-book, no tool on a pure chit-chat/guardrail prompt) are behavioral — only a real-model run can prove them, and only a blocking gate stops a regression at merge. Guardrail subset only = cheap (~$0.005/run) so it can run per-PR.

## AC

| # | Given | When | Then (user sees) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A PR touches a file under `lib/ai/**` | CI runs | The `ai-guardrail-gate` check runs the 6 guardrail cases through the real model | check reports pass/fail per case | EC-1 |
| AC-2 | All 6 guardrail cases pass (no tool dispatched on a no_tool case) | the gate runs | Check is **green**; merge allowed | — | — |
| AC-3 | A guardrail case fails after the retry-guard exhausts | the gate runs | Check is **red** with the failing case id(s) in the log; merge blocked | non-zero exit | AC-2 |
| AC-4 | A guardrail case fails transiently then passes on retry | the gate runs | Check is **green** (retry absorbed the flake); the retry is logged | — | EC-2 |
| AC-5 | `OPENROUTER_API_KEY` is unset in CI | the gate runs | Check is **red** with a loud "secret missing" error (fail-closed) | non-zero exit, NEVER a silent skip | EC-3 |
| AC-6 | A PR touches no `lib/ai/**` file | CI runs | The gate runs but green-skips in-job (reports success), so it is safe as a required check | check reports success, zero model calls | — |

## Rules

- BR-1: **Guardrail subset** = the golden cases where `guardrail === true` (6 today). The gate runs ONLY these — never the full corpus (cost + speed).
- BR-2: **Retry-guard** — on a guardrail-case failure, re-run the FAILED cases up to `GUARDRAIL_RETRIES` (default 2, so ≤3 attempts total) before declaring the case failed; a case is FAILED only if it fails every attempt. Log each retry loudly.
- BR-3: **Fail-closed** — if `OPENROUTER_API_KEY` is unset the gate EXITS NON-ZERO with a named error (`::error::OPENROUTER_API_KEY missing — guardrail gate cannot run`), never exit 0 with a notice. (Inverts the advisory `ai-eval.yml` self-skip; this is the ops.md silent-skip lesson made blocking.)
- BR-4: **Verdict** — the gate passes iff every guardrail case passes (guardrail threshold = 100%, unchanged). Core/deferred correctness is NOT evaluated here (that stays in the advisory run).
- BR-5: **In-job path filter (v2)** — the workflow triggers on EVERY `pull_request` (no top-level `paths` filter — a top-level filter makes GitHub never report the check on a non-matching PR, stranding a required check at "Expected" forever, the CAM-390 trap). The job itself diffs the PR against its base ref; a PR with no `lib/ai/**` change green-skips in-job (reports success, zero model calls, seconds); a PR touching `lib/ai/**` runs the real guardrail suite. Does not replace `ci.yml`'s quality-gate.
- BR-6: Cost ceiling — the subset is ≤ the guardrail count; worst case with retries ≈ 6 × 3 = 18 model calls, still < $0.02/run.

## Edge cases

- EC-1: IF a guardrail case throws a model-call error (network/outage) THEN it counts as a failed attempt and is retried per BR-2; if all attempts error, the gate is red (do NOT treat an outage as pass — fail-closed).
- EC-2: IF a case passes on attempt 2 or 3 THEN the gate is green and prints a "recovered after N retries" notice (visible flake signal, not hidden).
- EC-3: IF the secret is unset THEN BR-3 fail-closed applies — this is the first-run-proof guard against a silent-skip blocking gate.
- EC-4: IF the golden set ever has zero guardrail cases THEN the gate EXITS NON-ZERO (a guardrail gate with nothing to guard is a misconfiguration, not a pass).

## Data

None — reads the existing `guardrail` flag on `GoldenCase`. No schema, no case-data change.

## Seams & refs

- `scripts/ai-eval/plan-run.ts` or a small filter in the new entrypoint — filter `cases` to `guardrail === true` when a `EVAL_GUARDRAIL_ONLY`/mode flag is set (reuse `loadCasesFromFile`, do not re-parse).
- New entrypoint `scripts/ai-eval/guardrail-gate.eval.ts` (+ `vitest.guardrail.config.ts` + `package.json` script `ai:guardrail-gate`) — reuses `replayCase` + `scoreCase` (never re-implements the loop, BR like CAM-457); adds the retry loop (BR-2) and THROWS on a real guardrail failure (unlike the advisory `run.eval.ts`).
- New `.github/workflows/ai-guardrail-gate.yml` — `pull_request` (no top-level `paths` filter, v2), an in-job `git diff --name-only origin/<base>...HEAD` step gates whether the real suite runs (BR-5), NOT `continue-on-error`, reads `secrets.OPENROUTER_API_KEY`, fail-closed per BR-3 only when `lib/ai/**` actually changed.
- Leave `.github/workflows/ai-eval.yml` (advisory full manual run) untouched.

## Out of scope

- Making the new check a REQUIRED status in branch protection — that is a repo-settings change the orchestrator does via `gh api` AFTER a first green run proves the gate actually ran (ops.md first-run proof); noted in the ship step, not built in code.
- Growing the guardrail set (S3 miner).

## Self-verify

- [ ] `npx tsc --noEmit` clean; the guardrail-only filter unit-tested (a fixture with mixed cases → only guardrail cases selected)
- [ ] Retry loop unit-tested with a stubbed scorer: fail→fail→pass ⇒ green+notice; fail×3 ⇒ red; secret-unset ⇒ fail-closed
- [ ] The workflow YAML is valid, triggers on every `pull_request` (no top-level `paths` filter, v2), gates the real suite via an in-job diff, not `continue-on-error`
- [x] A first real run (dispatched manually via `workflow_dispatch`, since this PR itself does not touch `lib/ai/**`) proved the gate runs green and actually executed — evidence gathered before flipping to required (v2 refactor removes the CAM-390 stranding risk that blocked that flip)

## Changelog

- v2 (2026-07-25): refactored the workflow from a top-level `paths: ['lib/ai/**']` filter to an always-run `pull_request` trigger with an in-job diff-based gate (BR-5), so the check always reports and is safe to mark REQUIRED without stranding non-`lib/ai/**` PRs at "Expected" forever (CAM-390 trap); AC-6 updated to match.
