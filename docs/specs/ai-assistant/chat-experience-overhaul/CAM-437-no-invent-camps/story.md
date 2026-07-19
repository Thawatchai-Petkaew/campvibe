---
linear: CAM-437
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: story
owner: backend-engineer
status: In Progress
version: v1
updated: 2026-07-19
---
# The assistant never invents a campsite name on a zero-result search (CAM-437)

<!-- Gate class: G2 = standard class (system-prompt text only, no new API contract/schema/screen) — no separate G2 tap. -->

## Story
As a **Camper**, I want the assistant to only ever mention campsites it actually found this turn, so that I never see a confident-sounding recommendation that contradicts the "not found" message shown right below it.
Why: R2 flag, confirmed on staging — when `searchCampsites` returns 0 rows, the model still named campsites from its own training knowledge, so the correct empty-state banner (`searchAttempted && cards.length===0`) appeared UNDER a prose answer that listed camps. Root cause is a system-prompt gap: there was no rule forbidding the model from naming a campsite it wasn't given by a tool this turn.
Scope: `lib/ai/openrouter-client.ts` (`buildSystemPrompt` only — a new grounding rule + explicit zero-result instruction). No change to `searchAttempted` derivation, card mapping (`lib/read-models/ai-camp-card.ts`), or the banner gate (`conversation.ts`) — all three are already correct.
Depends on: CAM-430 (introduced `searchAttempted` + the zero-result banner gate this story stops contradicting).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | the camper's request matches no real campsite | `searchCampsites` is called and returns 0 rows | the assistant's prose answer names no specific campsite at all — it only says nothing matched and invites adjusting the search; the existing empty-state banner (`ยังไม่เจอที่ถูกใจเลย...`) is the only place mentioning "no results" | `cards: []`, `searchAttempted: true` (unchanged); the model's own answer text contains no invented campsite name | EC-1 |
| AC-2 | any turn, regardless of search result | the model drafts its answer | the model recommends/names a campsite ONLY if it appears in this turn's `searchCampsites` tool result — never one recalled from its own knowledge | prompt-level constraint only; no data/response-shape change | EC-2 |

## Rules
- BR-1 `buildSystemPrompt` includes an explicit rule: only name, describe, or recommend a campsite that appears in THIS turn's `searchCampsites` tool result; never name one from the model's own training knowledge or memory, even if asked to guess. (proves AC-2)
- BR-2 `buildSystemPrompt` includes an explicit zero-result instruction: on 0 matching campsites, say so plainly and invite the camper to adjust their search (location/dates/facilities) — never substitute an invented campsite. (proves AC-1)
- BR-3 The pre-existing anti-enumeration rule (CAM-405, "do not list or enumerate the matching campsites by name") is unchanged and still appears exactly once — this story adds a separate grounding rule, it does not alter how real matches are phrased. (regression guard)

## Edge cases
- EC-1 IF the camper explicitly asks the model to "just suggest one anyway" after a zero-result search THEN the model still declines to name an unfound campsite (BR-1)
- EC-2 IF `searchCampsites` is never called this turn (e.g. a greeting/FAQ turn) THEN the model still never names a specific campsite from its own knowledge (BR-1) — unaffected by whether `searchAttempted` is true or absent

## Data
— n/a (prompt text only; no schema, route, or store change).

## Seams & refs
- Reuse: `buildSystemPrompt()` in `lib/ai/openrouter-client.ts` (the sole owner of system-prompt text) · the existing `searchAttempted` field (CAM-430, `lib/ai/openrouter-client.ts`) and the banner gate it feeds (`conversation.ts`) — both read-only here, unchanged.
- Refs: ADR-013 (AI chat foundation) · CAM-405 (output-style rules, anti-enumeration line this story sits alongside) · CAM-430 (zero-result gate this story stops contradicting).

## Out of scope
- Any change to `searchAttempted` derivation, card mapping, or the banner gate — all confirmed correct; this is a prompt-only fix.
- Enforcing the rule server-side by scanning the model's own prose for a campsite name (out of scope — the grounding rule is a prompt-level instruction, not a post-hoc filter). If staging smoke shows the model still occasionally violates the rule, that is a follow-up ticket.

## Self-verify
- AC-1/BR-2/EC-1 → unit, prompt-assertion (`__tests__/cam-437-no-invent-camps.test.ts`): the assembled system message contains the zero-result instruction (say plainly nothing matched + invite adjusting search + never substitute).
- AC-2/BR-1/EC-2 → unit, prompt-assertion: the assembled system message contains the "only name a campsite from this turn's searchCampsites result / never from own knowledge" rule, unconditional on whether a search ran.
- BR-3 → unit, regression guard: the CAM-405 anti-enumeration line is unchanged and appears exactly once.
- No behavioral LLM call in any test (fetch mocked, mirrors the CAM-405/CAM-411 system-prompt test precedent); the real-model behavior check is the orchestrator's one controlled paid smoke on staging.
- Gate = /quality-gate · Done = merge to `dev` + AC verified (prompt content) on localhost before merge; the model's actual on-topic behavior is confirmed by the owner's staging smoke (browser/API, not unit-testable).

## Changelog
- v1 (2026-07-19) — created (spec-first, template v2, terse per the spec-lite class).
