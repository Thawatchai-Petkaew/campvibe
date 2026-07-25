---
ticket: CAM-510
epic: CAM-508
title: Assistant always searches before answering not-found (weekly-cycle-1 FIX)
class: spec-lite
version: 1
---

# CAM-510 — Always search before answering not-found (cycle-1 FIX)

## Story

As a **camper**, I want the assistant to actually search for campsites before it tells me "ไม่พบ", so that a specific request (e.g. "a camp where kids can play in the water") gets real results instead of a dead "not found" the assistant never even looked for.

Scope: one L1 prompt rule in `buildSystemPrompt` + one behavioral golden case. NO schema, NO new tool, single file-surface (+ the fixture + the two count ceilings).
Depends on: — . Source: `/ai-chat-improve` cycle 1 (staging turn logs 2026-07-25).

Why: real miss from staging — utterance "ลานกางเต็นท์เด็กลงเล่นน้ำได้" produced `toolCalls: []` (no_tool) and the answer "ไม่พบลานกางเต็นท์...อาจจะลองปรับเงื่อนไข". The Thai prompt (line ~396) instructs an honest not-found + suggest-adjust, but nothing forces a searchCampsites call FIRST, so the model can dead-end without searching.

## AC

| # | Given | When | Then (user sees) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper asks to find/recommend a campsite by any characteristic (even a specific/compound one) | the assistant handles the turn | The assistant calls `searchCampsites` (best-guess structured filters) before any answer | a searchCampsites tool call is dispatched this turn | AC-2 |
| AC-2 | searchCampsites returns 0 cards | the assistant answers | Honest "ไม่พบ" + suggest adjusting (unchanged copy behavior) — but only AFTER a real search ran | not-found banner shows only on a real `searchAttempted && 0` | — |

## Rules

- BR-1: Any request to find/recommend/list a campsite MUST result in a `searchCampsites` call this turn BEFORE the assistant answers. The assistant must NEVER reply "ไม่พบ / ไม่มี / not found" for a camp-finding request without having called `searchCampsites` this turn. (Complements, does not replace, the existing honest-not-found rule.)
- BR-2: Prefer structured filters (terrain/activities/facilities/etc.) mapped from the described characteristic; the keyword arg stays for specific names only (existing rule, line ~435) — do not regress it.

## Edge cases

- EC-1: IF the request is NOT about finding a camp (greeting, thanks, an availability question about a named camp) THEN this rule does not force searchCampsites — it applies to find/recommend/list intents only (don't break guardrail no_tool cases or availability chaining).

## Data

None.

## Seams & refs

- `lib/ai/openrouter-client.ts` `buildSystemPrompt` — add BR-1 as one concise rule near the existing not-found/keyword rules (~line 396/435). English framework; keep it short.
- `scripts/ai-eval/golden-cases.json` — add ONE behavioral case reproducing the miss: utterance "ลานกางเต็นท์เด็กลงเล่นน้ำได้", expected `{kind:"tool", tool:"searchCampsites", params:{}}` (subset match — any params; the point is a search HAPPENS), `guardrail:false`, a new group id.
- **Two-guards trap:** adding a case changes the count — update BOTH count ceilings (`__tests__/cam-457-eval-harness.test.ts` AND `__tests__/cam-459-answer-policy-3-zones.test.ts`) or CI fails.

## Out of scope

- The keyword-concept miss ("มือใหม่" → 0, turn #2) and the zero-result relaxation (turns #2/#5) — separate cycle/CAM-483.

## Self-verify

- [ ] `npx tsc --noEmit` clean; `npm run lint` 0 errors
- [ ] The new golden case is present + both count ceilings updated
- [ ] `npx vitest run __tests__/cam-457-eval-harness.test.ts __tests__/cam-459-answer-policy-3-zones.test.ts` green (mocked, free)
- [ ] (orchestrator runs the paid `ai:eval` PROVE step — not the builder)
