## Story
As an **Admin** (the on-call engineer/owner operating the delivery pipeline), I want the blocking `ai-guardrail-gate` CI check to report the real cause when it fails, and to fail only on a genuine assistant-behaviour regression rather than an environmental fault, so that a failing gate is fixable in minutes instead of an open-ended investigation, and a passing gate can be trusted.
Why: the gate has been failing all 6 guardrail cases and blocking every PR that touches `lib/ai/**` (currently PR #642); the owner's own investigation ruled out the API key, the model, and the transport, but could not find the actual cause because every failure path in `lib/ai/openrouter-client.ts` swallows the underlying error and logs only `{level, event, model}`.
Scope: (1) find and fix the root cause of the guardrail gate failing all 6 cases; (2) make every model-call failure path log its underlying cause (status + message, never secrets); (3) make an environmental/transport failure distinguishable from a behavioural (assistant-said-the-wrong-thing) failure in the gate's own output; (4) make a skipped guardrail run (the in-job `lib/ai/**` path filter reporting green without executing a single case) visibly distinguishable from a real pass, so a long-silent skip cannot be mistaken for protection. Does not touch `lib/ai/tools/**` or `lib/campsite-filters.ts` (PR #642 is open there) and does not touch the assistant's behaviour/prompts.
Depends on: CAM-507 (the guardrail gate itself, S4b) · CAM-390 (the in-job path-filter v2 fix this story's item 4 extends)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A guardrail case's model call fails (non-2xx response, or the fetch/parse throws) | The gate runs that case | The CI job log line for that failure carries the HTTP status (or exception message) alongside `level`/`event`/`model` — no more bare `{level,event,model}` with the cause discarded | `ai_primary_call_failed` / `ai_fallback_call_failed` log objects gain a `status`/`reason` field; no secret or full response body is logged | EC-1 |
| AC-2 | The primary and fallback model calls both fail for a case because of a transport/HTTP problem (not the model answering wrong) | The gate finishes that case's retry budget and reports it failing | The gate's per-case notice and the final failure summary mark the case as an **environmental** failure, distinct from a **behavioural** one | The thrown gate-failure `Error` message (and the per-case `::notice::`) names which category applied, so a human reading CI output does not have to re-derive it | EC-2 |
| AC-3 | A PR does not touch `lib/ai/**` | The `ai-guardrail-gate` workflow runs | The check still reports success, but the job log/summary explicitly states the guardrail suite did not execute (a named, loud skip notice), never a bare unlabeled "success" that looks identical to a real 6/6 pass | No model call is made (unchanged cost behaviour); the skip is visible in the log a human would actually read | EC-3 |
| AC-4 | `OPENROUTER_API_KEY` is present and valid, and the gate's own inputs (messages/tools) are well-formed | The gate runs all 6 guardrail cases | All 6 pass within their retry budget, reported per-case (`PASS after N attempt(s)`) | The gate is green because the model actually answered correctly, not because it silently didn't run | — (this is the corrected baseline; EC-1/EC-2 are its failure twins) |

## Rules
- BR-1 Every place a model-call outcome resolves to `ok:false` records why: an HTTP failure carries `{status, statusText}`; a thrown exception carries `error.message` (never the raw `Error` object, a stack, or a header/key value). Never log the request body, the API key, or a full model response body.
- BR-2 A failure is **environmental** when the model was never actually consulted about the guardrail behaviour — a non-2xx transport/auth/rate-limit response, a network-level throw, or a stream that never started — versus **behavioural** when a real model response came back and either the assistant's answer or its tool call violated the guardrail. The gate's failure message and per-case notice state which one applied; an environmental failure never gets silently relabelled as "the model regressed."
- BR-3 The in-job `lib/ai/**` diff-detection skip (workflow `ai-guardrail-gate.yml`) prints a named, unambiguous notice (`::notice::` or job summary line) stating the suite did not execute, on every skip — not only encoded in the job's duration/step count, which nobody reads by default.
- BR-4 (unchanged from CAM-507) the gate still fails iff any guardrail case fails every attempt in its retry budget; nothing here weakens that — it only clarifies WHY a case failed.

## Edge cases
- EC-1 IF a model call throws before any HTTP response is received (DNS/connect/abort) THEN the logged cause is the caught exception's message, not a bare `ok:false` (BR-1).
- EC-2 IF both the primary and fallback calls for a case fail for a transport/HTTP reason (never reaching a real completion) THEN the case is reported as an environmental failure, and the overall gate-failure message names it as such rather than implying an assistant regression (BR-2).
- EC-3 IF a PR's diff does not touch `lib/ai/**` THEN the workflow's green-skip step must emit a notice naming the skip, so the job log itself (not just its duration) shows it did not execute the suite (BR-3).

## Data
- No schema/DB change. Log-shape addition only (`status`/`reason` fields on the existing `ai_primary_call_failed`/`ai_fallback_call_failed` JSON log lines) + a CI notice line. Migration: none.

## Seams & refs
- Reuse: `lib/ai/openrouter-client.ts` (`callModelOnce`, `drainOneStreamingCall`/`streamOneCompletion`) is the one place every model call outcome resolves — the fix lands there, not duplicated per caller.
- Refs: CAM-507 (guardrail gate itself) · CAM-390 (in-job path-filter v2, extended here for the skip-visibility gap) · `.claude/rules/observability.md` (structured logs, no secrets/PII).

## Out of scope
- Fixing anything inside `lib/ai/tools/**` or `lib/campsite-filters.ts` even if the root cause traces there — PR #642 is open on those files; this story reports the finding instead of editing them.
- Any change to assistant prompts/behaviour.
- Adding OpenTelemetry tracing or metrics beyond the log-shape fix (out of this story's size).

## Self-verify
- AC-1/EC-1 → unit (`__tests__/cam-568-*.test.ts`): a forced non-ok response and a forced throw both assert the log line carries status/message.
- AC-2/EC-2 → unit: an all-environmental-failure case is asserted to produce the environmental-labelled message, not a behavioural one.
- AC-3/EC-3 → workflow review (no CI unit test framework for YAML); the skip step's notice line is asserted by inspection/grep in the PR description, and by re-running `workflow_dispatch` behaviour where applicable.
- AC-4 → `npm run ai:guardrail-gate` run for real, per-case results reported in the PR body (not just "green").
- Story-specific: root cause named from a real captured error message (not inferred); the $5 OpenRouter budget's remaining headroom checked and stated plainly.
- Gate = `/quality-gate`. Done = every AC verified on localhost/CI before merge into `dev`.

## Changelog
- v1 (2026-07-26) — created
