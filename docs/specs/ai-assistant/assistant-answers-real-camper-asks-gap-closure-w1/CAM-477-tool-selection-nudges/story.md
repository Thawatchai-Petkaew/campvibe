---
linear: CAM-477
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
persona: camper
artifact: story
owner: product-owner
status: In Progress — spec-lite (G1 folds into G3 packet)
version: v1
updated: 2026-07-24
---
# Assistant tool-selection prompt nudges — iteration 3 (CAM-477)

<!-- Spec-lite class (S story): no schema/migration · no new API contract · single file-surface (lib/ai/openrouter-client.ts buildSystemPrompt) · prompt-text only. G1 folds into the G3 packet per Gate policy v2. SECURITY-CRITICAL: the system prompt IS the prompt-injection surface → security MUST re-verify guardrails stay 100% and the fence/grounding lines are byte-identical. Measured by the CAM-457 golden eval (a separate cost-authorized run = the acceptance gate). -->

## Story
As a **Camper**, I want the assistant to route my by-the-way asks — a mood/vibe ("อยากหนีเมืองไปฮีลใจ"), a party line ("ไป 6 คน หมา 1"), a fuzzy-date availability question ("วันหยุดยาวรอบหน้า ภูทับเบิกว่างไหม"), or a named-camp policy question ("มัดจำเท่าไหร่") — to the right tool, so that I get a real answer instead of a chat-back or a half-answer that stops after resolving the date.
Why: the fidelity-corrected eval baseline (run 2, 2026-07-24) = 50.0% non-guardrail tool-call correctness; the remaining CONSISTENT fails (both runs) are tool-SELECTION gaps the model makes even with production-faithful shown-state — closable by prompt guidance, measured by the CAM-457 golden eval, not by new code/tools.
Scope: add 6 adversarially-verified nudges to `buildSystemPrompt` at 3 named anchors — Theme A (resolveDates→availability chaining), Theme B (named-camp facts→getCampDetail + search-then-detail + compareCamps guard), Theme C (intent→search for mood/party/feature-negation, each with a carve-out). Prompt-text ONLY — no code branch, no tool, no schema. The guardrail/injection, CAM-437 grounding, CAM-460 shown_results, and persona lines are UNTOUCHED.
Depends on: CAM-457 (eval harness), CAM-460 (shown_results state), #553 (fidelity fix).

## AC
| # | Given | When | Then (measured via the CAM-457 golden eval) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The 6 nudges in `buildSystemPrompt` | The real-model eval runs (48 cases) | Non-guardrail tool-call correctness rises above the 50.0% run-2 baseline (Theme A/B/C targeted cases flip toward pass) | The model routes the targeted utterances to the expected tool | EC-1 |
| AC-2 | The nudges added | The eval runs | Guardrail pass rate stays **100%** (SMOKE-GUARDRAIL-1 + ADV-40 dispatch zero tools) | Injection / no-booking-execute semantics unchanged | EC-2 |
| AC-3 | The nudges added | The eval runs | Zone-A `no_tool` cases (SMOKE-A1/A2, P1-04-fail) still dispatch zero tools | General-knowledge answers stay tool-free | EC-3 |
| AC-4 | The prompt change | The full unit suite runs | Every existing prompt-regression test (cam-459/460/462/411/408/270) stays green | Preserved lines byte-identical | EC-2 |

## Rules
- BR-1 The 6 additions are inserted ONLY at the 3 named anchors (after the CAM-462 resolveDates line; after the CAM-461 structured-filter line; in the slot between the CAM-459 3-zone line and the BR-2 bridge line). The CAM-437 grounding rule, CAM-460 shown_results block, and the injection-guard + persona lines are byte-identical after the change.
- BR-2 Addition #3 (feature-negation→search) MUST carry the carve-out: "never treat a negated action, booking, or conversation instruction (e.g. 'ไม่ต้องถามซ้ำ') as a search filter" — protects guardrail ADV-40.
- BR-3 Addition #5 (mood→search) MUST carry the Zone-A carve-out: "general-knowledge / beginner how-to is still answered with zero tools" — protects SMOKE-A2; and preserve the no-context reference guard (P1-04-fail).
- BR-4 Guardrail pass rate = 100% is the HARD acceptance gate: a single guardrail miss on the eval run = iterate/revert, never merge.

## Edge cases
- EC-1 IF non-guardrail correctness does NOT rise (or drops) on the acceptance run THEN do not merge; investigate prompt-crowding/dilution before re-nudging.
- EC-2 IF any guardrail case flips to a tool dispatch OR any prompt-regression test breaks THEN STOP + revert the offending nudge (no silent weakening of a byte-identical guard).
- EC-3 IF a Zone-A case flips to a tool dispatch THEN tighten the Theme-C carve-out.

## Data
- No schema/DB/migration. File: `lib/ai/openrouter-client.ts` (`buildSystemPrompt`) only, plus this spec and any legitimately-needed prompt-regression test update.

## Seams & refs
- `lib/ai/openrouter-client.ts` `buildSystemPrompt` (L289-356) · CAM-459 3-zone policy (L320) · CAM-437 grounding (L338) · CAM-460 shown_results (L238-267/L345) · CAM-462 resolveDates (L312) · CAM-461 structured-filter (L313) · `scripts/ai-eval/*` (the measurement). Nudge design + adversarial non-regression verification: workflow `wf_cdff02c7-70b` (2026-07-24).

## Out of scope
- Building the deferred tools (setWatch / getUserContext / planTrip / getPriceHistory / checkPitchAdjacency) — the permanently-failing 'deferred' cases need the tool in the registry, not a prompt nudge (separate stories).
- An authed eval fixture for the getMy* cases (P11-29) — separate harness story.
- Pinning temperature / multi-run averaging for a noise-free KPI — separate harness refinement (the single-run number carries a ±3-4-case variance band).

## Self-verify
- The 6 nudges present at the 3 anchors · the guardrail/grounding/shown_results/injection/persona lines byte-identical (grep) · `npm run lint` · `npx tsc --noEmit` · `npm test` full suite green (esp. cam-459/460/462/411/408/270) · then the cost-authorized eval run: non-guardrail correctness up AND guardrails 100%.

## Changelog
- v1 (2026-07-24) — spec-lite authored at intake (orchestrator, autonomous mode). 6 nudges sourced from workflow `wf_cdff02c7-70b`, all adversarially verified guardrail-safe (guardReg=false; Zone-A carve-outs added on the seam cases).
