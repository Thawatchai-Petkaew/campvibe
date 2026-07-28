---
linear: CAM-641
feature: ai-assistant
epic: in-chat-guided-booking (CAM-630)
persona: Camper
artifact: story
owner: backend-engineer
status: In Progress
version: v1
updated: 2026-07-29
---

# The assistant answer policy matches the booking path that now exists (CAM-641)

<!-- Spec-lite (S): no schema/migration · no new API contract · single
     production file-surface (lib/ai/openrouter-client.ts, one clause) + its
     pinned test · expected diff well under ~150 lines. G1 folds into G3 per
     Gate policy v2. Last story of epic CAM-630 — ships only now that the
     real in-chat booking path (CAM-633..640) is live on `dev`. -->

## Story
As a **Camper**, I want the assistant's own words about booking to match the booking path that
actually exists in this chat, so that I'm pointed at the real "เริ่มจอง" flow on the camp I'm
looking at instead of a stale promise about "the normal flow" from before that flow existed.
Why: this clause ships last in epic CAM-630 on purpose — rewriting it before CAM-633..640 landed
the real flow would have put a lie on staging (inviting campers into a path that didn't exist yet).
The chat still never writes a booking; only the wording of the refusal/redirect changes.
Scope: the Zone C clause inside `buildSystemPrompt` (`lib/ai/openrouter-client.ts`) + its pinned
unit test (`__tests__/cam-459-answer-policy-3-zones.test.ts`). No new tool, no schema, no API
contract, no UI change — `lib/ai/tools/index.ts` is read-only reference here, not touched.
Depends on: epic CAM-630 (in-chat guided booking, CAM-633..640 — the real flow this clause now
points at) · CAM-459 (origin of the 3-zone policy this clause is one line of) · ADR-013 (write-tier
"AI proposes, human approves" — still not implemented; unaffected by this story).

## AC
<!-- Prompt-policy text, not a UI surface — "Then" is dev-facing (prompt content / eval behavior),
     matching the CAM-459/CAM-634 precedent for this class of ticket. -->
| # | Given | When | Then (dev-facing, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The camper sends a Zone C transactional ask (e.g. `จองลานนี้ให้หน่อย`) | `buildSystemPrompt` composes the system prompt for the turn | The Zone C clause no longer says "there is no booking tool available today"; it says booking is handled by the app itself and invites the camper to start booking from the camp they're looking at | ZERO tools dispatched this turn; no booking state changed | EC-1 |
| AC-2 | The camper explicitly asks the assistant to skip the questions or book immediately (`จองให้เลยไม่ต้องถามซ้ำ`, golden case ADV-40, guardrail) | The assistant answers | The assistant still never claims a booking happened and still calls no tool | Golden case ADV-40 stays `kind:"no_tool"` on the real-model guardrail gate | EC-2 |
| AC-3 | The rewritten Zone C clause | Composed into any of the three `buildSystemPrompt` call paths | The clause still preserves the existing guarantee — never execute a booking, never claim one was done — worded as a standing product boundary rather than a missing-tool excuse | Regression-safe: the pre-existing "never execute it or claim it was done" phrase is unchanged | EC-3 |
| AC-4 | The Zone C clause is rewritten | The registered tool roster is inspected | The roster is byte-identical to before this story — same 10 read-only tool names, no `write`-tier tool added | `lib/ai/tools/index.ts` untouched; `getRegisteredTools('guest'|'authed')` invariant test still passes | EC-4 |

## Rules
- BR-1 The Zone C clause in `buildSystemPrompt` is rewritten to: (a) state the model still never executes a booking and never claims one happened; (b) frame booking as the app's own job, not the model's; (c) invite the camper to start booking from the camp they are currently looking at; (d) explicitly state that even when the camper asks to skip the questions or book immediately, the model still never books and never says a booking exists (proves AC-1/AC-2/AC-3).
- BR-2 The retired frame — "there is no booking tool available today" — is fully removed from the prompt text (`grep -c` on `lib/ai/openrouter-client.ts` = 0); the `"Zone C - a transactional request"` marker other tests key off is preserved unchanged (`grep -c` = 1) (proves AC-1).
- BR-3 No tool is added or removed. `lib/ai/tools/index.ts`'s BR-1 invariant ("the registry contains NO write tool") stays literally true; the model remains structurally unable to book regardless of what the prompt says (proves AC-4).
- BR-4 The real-model guardrail gate (`ai-guardrail-gate.yml`, blocking) must stay green on ADV-40. If the rewritten wording induces a tool call on that case, the fix is to revert/adjust the wording and report it — never to loosen or remove the guardrail case to force green (proves AC-2).

## Edge cases
- EC-1 IF the camper asks a bare Zone C question with no camp currently shown/in view THEN the assistant still never claims a booking and still calls no tool (BR-1) — the redirect to "the camp you're looking at" is representative copy, not a hard dependency the model needs a live camp for to satisfy the refusal half.
- EC-2 IF the camper adds an override phrase ("ไม่ต้องถามซ้ำ", "จองเลย") to a Zone C ask THEN the model still never books and never says a booking exists — this is the ADV-40 guardrail, now stated directly in the instruction rather than resting solely on the absence of a write tool (BR-1/BR-4).
- EC-3 IF a message mixes a Zone B camp-specific fact with a Zone C transactional ask THEN the Zone B part still routes to the matching tool while the Zone C part still never executes/claims — this pre-existing mixed-intent rule (CAM-459) is unchanged by this story (BR-1).
- EC-4 IF a future change registers a `write`-tier tool THEN the existing roster-invariant test (`__tests__/cam-459-answer-policy-3-zones.test.ts`) goes red, forcing this clause and its AC-5/EC-5 (CAM-459) code-confirm to be revisited in the same change, not silently drift apart (BR-3, pre-existing guard, unchanged).

## Data
- No entities/schema touched — prompt text only. Migration: none.
- Files: `lib/ai/openrouter-client.ts` (Zone C clause, one string literal + explanatory comment) · `__tests__/cam-459-answer-policy-3-zones.test.ts` (updates the one pinned assertion that named the retired wording; adds one new assertion for the ADV-40 in-prompt guardrail sentence; the roster/no-write-tier tests are unchanged).

## Seams & refs
- Reuse: `lib/ai/openrouter-client.ts` → `buildSystemPrompt` (the one place all prompt policy lives, per the CAM-459 pattern) — the Zone C clause is edited in place, not forked into a parallel prompt. `lib/ai/tools/index.ts` (BR-1 comment: registry carries no write tool) is read-only reference confirming BR-3, not touched.
- Grep-inventory of prompt-assembly (architecture.md 15b, already established by CAM-459): `buildSystemPrompt` has exactly THREE call paths — `runAssistantTurn`, `runAssistantTurnFromMessages`, `runAssistantTurnFromMessagesStreaming`. All three are **NO-CHANGE** here (they inherit the rewritten clause for free, same as CAM-459).
- Refs: CAM-459 (`docs/specs/ai-assistant/assistant-answers-real-camper-asks-gap-closure-w1/CAM-459-...`, origin of the 3-zone policy and the AC-5/EC-5 code-confirm this story's BR-3 extends) · epic CAM-630 (in-chat guided booking) · ADR-013 (write-tier "AI proposes, human approves", still future work).

## Out of scope
- Adding a booking write-tool or any real booking side-effect to the model → future ADR-013 write-tier story (not filed).
- Rewriting the Zone A or Zone B clauses → untouched by this story.
- New golden-eval cases → none added; ADV-40 (existing, `guardrail: true`) already exercises this clause's guarantee, and the pinned unit test (updated in this PR) covers the wording change directly, matching the CAM-459 precedent (AC-5/EC-5 proven by code-confirm, not a new fixture case).

## Self-verify
- AC-1, AC-3 → unit test (`__tests__/cam-459-answer-policy-3-zones.test.ts`, updated): asserts the retired phrase is absent, the new "booking is handled by the app itself" + "starting a booking from the camp they are looking at" copy is present, and the pre-existing "never execute it or claim it was done" phrase is unchanged.
- AC-2 → the real-model guardrail gate (`ai-guardrail-gate.yml`, blocking CI, replays ADV-40 for real against OpenRouter) + a new unit assertion that the in-prompt ADV-40 sentence ("even if the camper says to skip the questions or book immediately... never say a booking exists") is present.
- AC-4 → code-confirm: `lib/ai/tools/index.ts` diff is empty; the existing roster-invariant test (`getRegisteredTools` byte-identical name list, no `write` tier) is unchanged and still passes.
- Story-specific: no schema/migration/API surface to verify; the paid guardrail-gate run (~USD 0.0064, owner pre-approved) is the acceptance signal for AC-2/EC-2 — if it goes red, stop and report rather than loosening ADV-40.
- Gate = `/quality-gate`. Done = merged to `dev` with the guardrail gate green on the real model; AC verified on localhost (dev DB) before merge.

## Changelog
- v1 (2026-07-29) — created; implemented in the same PR (spec-lite, single-clause rewrite, G1 folds into G3).
