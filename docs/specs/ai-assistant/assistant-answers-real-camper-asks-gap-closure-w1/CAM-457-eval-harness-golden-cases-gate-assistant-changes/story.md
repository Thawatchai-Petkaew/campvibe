---
artifact: story
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
story: eval-harness-golden-suite (CAM-457)
status: In Progress — build (backend-engineer); G1+G2 approved in-chat 2026-07-21
version: v2
updated: 2026-07-21
---

<!--
Dev-facing tooling story: the assistant's eval harness has NO user-facing UI, so the AC "Then" column describes CLI/CI output in plain language (no Thai copy) — the Thai in this file appears only INSIDE golden-case utterances/data, which are the tool's input, not screen copy. Framework is English; EARS applies.
-->

## Story
As a **CampVibe maintainer** (the AI delivery team; the 3 user personas Admin/Camper/Host do not fit a dev-facing test harness — the actor is the team, the beneficiary is the Camper), I want a golden-case eval harness that replays fixed camper utterances through the REAL agent loop and reports how many land the correct tool call (or correctly call no tool), so that every later prompt/tool/model change to น้องกองไฟ is measured against a baseline instead of guessed (protects the Camper from silent assistant regressions; epic KPI = 40-case pass-rate, baseline: not measured — this story establishes it).
Why: today there is not a single golden tool-call test in the repo (research §6) — every assistant change is a blind guess, which violates metric-honesty (`.claude/rules/performance.md`); the eval harness is the ratified prerequisite of every other wave-1 story.
Scope: the harness only — case-file format + loader, a runner that replays through the existing agent loop with the tool-execution layer MOCKED (real model call, zero real DB/side-effect), a per-corpus-group baseline report, an on-demand npm script, and a NON-BLOCKING (report-mode) CI job that self-skips when the model key is unset. This story MEASURES only; it changes no prompt, tool, or model.
Depends on: owner-imported golden corpus `docs/research/campvibe-conversation-to-booking-research.md` §5 (the 40 case CONTENTS — not yet in repo; the harness ships the FORMAT + runner and is populated when the file lands) · ADR-013 (bounded agent loop) · research §6 (eval spec) + §4.2 (3-zone answer policy)

## AC
| # | Given | When | Then (dev-facing CLI/CI output, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A golden-case file with N cases and `OPENROUTER_API_KEY` set | A maintainer runs the eval npm script | Prints a per-corpus-group pass-rate table plus overall tool-call-correctness % and guardrail-pass %, and writes a baseline report artifact | A report file is written with per-group + overall + guardrail numbers and the pinned model name; no production code path is touched | EC-1 |
| AC-2 | A case whose expected outcome is a tool call `{tool, params}` (zone B/C) | The harness replays it through the real agent loop | Records the model's ACTUAL dispatched tool + params and marks the case pass only when the tool name matches AND every expected param key matches | Case result = pass/fail with actual-vs-expected recorded in the report | EC-2 |
| AC-3 | A case tagged zone A (general-knowledge, must answer without data) | The harness replays it | Marks the case pass only when NO tool was dispatched; a dispatched tool is a fail and the leaked tool name is recorded | Any tool dispatch on a zone-A case = fail (guards budget + latency, research §4.2) | EC-6 |
| AC-4 | A case flagged `guardrail: true` | The harness replays it and tallies results | Counts it in the guardrail bucket; if ANY guardrail case fails the run verdict is FAIL even when tool-call correctness is ≥95% | Guardrail-pass below 100% flips the overall verdict, independent of the tool-call threshold | EC-2 |
| AC-5 | `OPENROUTER_API_KEY` is unset (dev/CI/preview default) | The eval script or CI job runs | Self-skips with a loud notice that NAMES the missing variable, makes zero network calls / zero spend, and exits success | No OpenRouter call made; run exits 0 with the named-var skip notice (never a silent green) | EC-4 |
| AC-6 | The first baseline pass-rate is below the ≥95% target (expected — ~half the corpus is blocked today) | The eval runs in CI | Reports the numbers as ADVISORY on a non-required check and never blocks a merge; blocking is enabled only by a later story once the backlog is cleared to threshold | CI eval job is advisory (report-mode); no PR merge is blocked by the eval at this stage | EC-5 |
| AC-7 | The harness is new and no baseline exists | It first runs against the full imported 40-case file | Produces the baseline report that replaces the research §2 percentage ESTIMATES with real per-group numbers | The baseline report becomes the reference every later wave-1 story re-runs against | — (first run has nothing prior to compare; producing the baseline IS the outcome) |

## Rules
- BR-1 Case-file format — each case is a typed record: `{ id, group (corpus tag, e.g. "P1"|"P17"|"F"), zone ("A"|"B"|"C"), utterance (Thai string, or an ordered prior-turn list for context cases), seededState (optional: prior-turn messages + the canned tool-result the mock layer returns), expected ({ kind:"tool", tool, params } | { kind:"no_tool" }), guardrail (boolean) }`. A malformed/unparseable case is a load error, never a crash (EC-1).
- BR-2 Tool-call-correctness pass = dispatched tool name equals `expected.tool` AND every key in `expected.params` is present with a deep-equal value (extra model-supplied params are tolerated — subset match — unless a case sets `strictParams: true`). Default = subset match.
- BR-3 Thresholds (research §6.2): overall tool-call correctness ≥ 95% of non-guardrail cases; guardrail cases = 100%; zone-A no-tool cases count inside the correctness figure. Run verdict = PASS only when BOTH thresholds are met; otherwise verdict = REPORTING (advisory) and the shortfall is listed by group.
- BR-4 Tool execution is MOCKED at the registry `dispatchTool` seam (record `name`+`args`, return the case's `seededState` canned data) — the harness makes REAL model calls but performs ZERO real DB reads or side-effects, and changes NO production file (the exact idiom `__tests__/cam-416-agent-loop.test.ts` uses via `vi.mock` + `mockDispatchTool`). Zone-A "no tool" = `dispatchTool` never called; zone-B "tool+params" = `dispatchTool` called with the observed `name`+`args`.
- BR-5 Self-skip: no `OPENROUTER_API_KEY` → skip the whole run, print a loud notice naming the variable, exit success, zero spend (mirrors `openrouter-client.ts`'s existing key-absent self-skip). The CI job self-skips the same way AND must carry a first-run proof that it ACTUALLY ran once with a real key present (a conditional job that only ever skips is a silent no-op — `.claude/rules/ops.md` conditional-job lesson).
- BR-6 CI posture is ADVISORY / non-required at first (report-mode). Rationale: the baseline is below threshold on day one, and a blocking guard must never ship with a non-zero backlog — the sequence is report-mode → clear the backlog to threshold → flip to blocking (`.claude/rules/ops.md`). Flipping to blocking is explicitly a LATER story, not this one.

  DECIDED at G1 (owner, in-chat 2026-07-21): run-mode = **(b) on-demand npm script + a CI advisory job that self-skips loudly when `OPENROUTER_API_KEY` is unset**, spend bounded by BR-7's `MAX_EVAL_CASES`. The ~2,000-case paraphrase regression tier stays a separate, lower-frequency run (out of scope here).

- BR-7 Spend cap: a hard `MAX_EVAL_CASES` ceiling is checked BEFORE the run loop executes (a client-/file-controlled iteration count must be bounded before it runs — CAM-344 lesson); over the cap the harness refuses with a clear message and makes zero model calls. Default `MAX_EVAL_CASES = 500` (headroom above 40; the ~2,000 paraphrase set is a separate tier, not this run).
- BR-8 The evaluated model is pinned via `OPENROUTER_MODEL` (env) and recorded in the report header — a baseline is comparable only against the SAME model. Non-determinism is absorbed by the threshold (≥95%, not per-case all-pass); guardrail cases must be robust enough to pass deterministically. Whether the eval should pin `temperature: 0` in the loop is a Technical (G2) question for the architect — it is NOT decided here and this story does not modify the prod loop to add it.

## Edge cases
- EC-1 IF a case entry is malformed/unparseable THEN the harness records it as a named load error and continues the batch (never aborts the whole run) (BR-1).
- EC-2 IF the model returns no tool call on a zone-B/C case that expected one (or the wrong tool/params) THEN the case is marked fail with actual-vs-expected recorded — not a crash (BR-2/BR-3).
- EC-3 IF a model call errors or times out for one case THEN that case is marked ERROR (a bucket distinct from fail), the batch continues, and the error count is reported (a network blip must not silently drop cases from the denominator).
- EC-4 IF `OPENROUTER_API_KEY` is unset THEN the whole run self-skips with the named-var notice and exits success — never a silent green that hides "the eval never actually ran" (BR-5).
- EC-5 IF the pass-rate is below threshold THEN the CI check stays advisory and does not block the merge (report-mode) (BR-6) — it is NOT converted to a blocking failure in this story.
- EC-6 IF a tool is dispatched on a zone-A general-knowledge case THEN the case fails and the leaked tool name is recorded (research §4.2: zone A must answer without a tool call) (BR-2/AC-3).

## Data
- No schema/DB change; no migration (`migration: none`). The harness reads only its own golden-case file and writes a report artifact. Because tool execution is mocked (BR-4), no Prisma/DB is touched at run time.
- New artifacts (all new files, no existing prod file edited): the typed case-format module + loader, the runner, the report writer, the golden-case fixture file (populated from the imported owner corpus), the npm script, and the CI advisory job. Report artifact default path = `docs/specs/ai-assistant/assistant-answers-real-camper-asks-gap-closure-w1/CAM-457-eval-harness-golden-cases-gate-assistant-changes/baseline-report.md` (🟡 default — confirm at G1 if a machine-readable JSON alongside it is wanted for later diffing).

## Seams & refs
- Reuse: `lib/ai/openrouter-client.ts` `runAssistantTurnFromMessages` / `runAssistantTurn` (the real bounded agent loop — REPLAYED, never re-implemented) · the `dispatchTool` seam in `lib/ai/tool-registry.ts` as the mock/record point (idiom proven in `__tests__/cam-416-agent-loop.test.ts`) · the key-absent self-skip pattern already in `openrouter-client.ts`. Refs: research §6 (eval spec), §4.2 (3-zone answer policy), ADR-013 (bounded loop), `.claude/rules/ops.md` (report-mode → clear → blocking; conditional-job loud-skip + first-run proof), CAM-344 (pre-loop MAX cap).
- NO production code change: tool calls are fully OBSERVABLE through the existing `dispatchTool` mock (zone-A = never called; zone-B = called with name+args), so the harness needs no new capture hook inside the loop. IF observing the model's tool call proves impossible via the mock seam alone THEN STOP and raise it to the architect at G2 — do not modify `openrouter-client.ts` to expose internals (STOP RULE: no touching files outside this story's stated surface).

## Out of scope
- Authoring the 40 case CONTENTS → arrives via the owner-imported `campvibe-conversation-to-booking-research.md` §5 (a dependency, above), not a follow-up ticket; the harness ships the format + runner and is populated when the file lands.
- The ~2,000-case LLM-paraphrase regression tier (research §6.3) → a later, lower-frequency story.
- Observability / trace integration (Langfuse or equivalent, research §6.4) → a later story.
- Flipping the CI check from advisory to blocking → the later story that first clears the backlog to threshold (BR-6).
- Any prompt/tool/model change to RAISE the pass-rate → the subsequent wave-1 stories (2–9); this story only measures.
- Pinning `temperature: 0` / model-determinism tuning in the prod loop → architect G2 (Technical), a separate change if needed (BR-8).

## Self-verify
- AC-1..AC-7 → unit/integration tests of the runner with a MOCKED model (`fetch` stubbed exactly like `__tests__/cam-416-agent-loop.test.ts`, zero spend) over a tiny fixture set that exercises each assertion type: zone-B tool+params pass/fail, zone-A no-tool pass/fail, guardrail-fail flips the verdict at ≥95% tool-call, self-skip on unset key, over-cap refusal, malformed-case load error.
- Story-specific: self-skip prints the named variable AND `fetch` is asserted never called (BR-5) · over-cap refused BEFORE any model call (BR-7/CAM-344) · a malformed case does not crash the batch (EC-1) · a per-case network error is bucketed as ERROR, not silently dropped (EC-3) · guardrail < 100% flips the verdict even when tool-call ≥ 95% (BR-3/AC-4).
- The REAL-model baseline run (AC-7, actual spend) is an OWNER-VERIFY step gated by the open cost/run-mode decision (BR-6) — the harness's own test suite proves the runner logic with a mocked model at zero spend.
- Gate = /quality-gate · Done = harness tests green on localhost (dev DB); the real-model baseline number is owner-verify once the corpus is imported and the run-mode is chosen.

## Changelog
- v1 (2026-07-20) — created; Discovery run, Business+Functional gaps closed; one open cost/run-mode decision (🔴) surfaced as the single clarification marker in BR-6 for G1.
- v2 (2026-07-21) — G1 APPROVED by owner in chat; BR-6 marker closed with the decided run-mode (b: npm script + CI advisory self-skip). Handed to architect for G2 (dispatchTool observation, temperature pinning question, report artifact format).
