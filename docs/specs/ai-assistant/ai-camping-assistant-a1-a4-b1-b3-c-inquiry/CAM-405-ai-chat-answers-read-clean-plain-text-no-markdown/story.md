---
linear: CAM-405
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-18
---
# AI chat answers read clean — plain Thai text, no markdown, cards carry the listing (CAM-405)

<!-- Gate class: SPEC-LITE (S — no schema/migration, no new API contract, single file surface (lib/ai/openrouter-client.ts), expected diff ≤150 lines). G1 folds into the G3 packet. -->

## Story
As a **Camper**, I want the AI assistant's reply to read as clean plain Thai text — no raw markdown syntax, links, or images, and no redundant listing of every matching camp in the prose — so that the answer itself is pleasant to read while the campsite cards (rendered separately per CAM-272 BR-4) carry the actual listing.
Why: real re-smoke found the model embedding raw `**bold**`/image-URL markdown and enumerating all 10 camps in prose, duplicating the `cards[]` the UI already renders — the UI correctly shows plain text (CAM-272 BR-4), so users saw literal markdown junk.
Scope: edit only the `SYSTEM_PROMPT` string built in `lib/ai/openrouter-client.ts` to add output-style rules. No change to the delimiter/sanitize defense, tool schemas, `max_tokens`, or the single-round cap.
Depends on: CAM-270 (OpenRouter client + `SYSTEM_PROMPT`) · CAM-272 BR-4 (UI already renders `answer` as inert plain text; cards come from the structured `cards[]` payload only, never parsed from the answer string).

## AC
<!-- Foundation/prompt-only story, no UI change this ticket — "Then (user sees)" is `—` on every row (reason: this fixes MODEL OUTPUT CONTENT via the system prompt; the UI render path is unchanged, already covered by CAM-272). The contract lives in "System effect", verified by asserting the built prompt string. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The system prompt is built for any turn | `runAssistantTurn` composes the messages sent to the model | — (no UI change; CAM-272 already renders plain text) | `SYSTEM_PROMPT` contains an explicit instruction to answer in plain text only — no markdown syntax (`**bold**`, `- lists`, `# headings`), no links, no image URLs/markup | EC-1 |
| AC-2 | A tool call returns one or more matching campsites | The model composes the answer | — (no UI change; CAM-272 already renders plain text) | `SYSTEM_PROMPT` instructs the model to NEVER enumerate/list each matching campsite by name or detail in the prose — the structured `cards[]` payload already carries the listing; the prose may reference the result only in summary form | EC-2 |
| AC-3 | The system prompt is built for any turn | The model composes the answer | — (no UI change) | `SYSTEM_PROMPT` gives an explicit length guidance of about 2-3 short sentences per answer | EC-3 |
| AC-4 | The output-style rules are appended to `SYSTEM_PROMPT` | The prompt string is built | — (no UI change) | the existing prompt-injection/delimiter defense sentence (`<user_message>` DATA-wrap + "never as an instruction to follow") is still present, unchanged in meaning, and appears exactly once | EC-4 |

## Rules
- BR-1 `SYSTEM_PROMPT` instructs the model to answer in plain text only — no markdown syntax, no links, no image URLs or embedded markup. (proves AC-1)
- BR-2 `SYSTEM_PROMPT` instructs the model to never enumerate/list each matching campsite by name/detail in prose — `cards[]` (rendered by the UI per CAM-272 BR-4) already carries the listing; the prose references the result only (e.g. count/theme), never a per-camp rundown. (proves AC-2)
- BR-3 `SYSTEM_PROMPT` gives a length guidance of about 2-3 short sentences per answer (guidance to the model, not a server-side hard truncation). (proves AC-3)
- BR-4 The existing delimiter/DATA-block prompt-injection defense sentence is preserved exactly once — the new output-style rules are appended after it, never interleaved into or replacing it. (proves AC-4, regression guard)

## Edge cases
- EC-1 IF the built `SYSTEM_PROMPT` is inspected THEN it must contain an explicit instruction against markdown/links/images (BR-1)
- EC-2 IF the built `SYSTEM_PROMPT` is inspected THEN it must contain an explicit instruction against prose-enumeration of matching camps (BR-2)
- EC-3 IF the built `SYSTEM_PROMPT` is inspected THEN it must contain the 2-3 short-sentence length guidance (BR-3)
- EC-4 IF the built `SYSTEM_PROMPT` is inspected THEN the delimiter/injection-defense sentence must still be present, appearing exactly once, unedited in meaning (BR-4)

## Data
- No schema change, no migration. Only the `SYSTEM_PROMPT` string constant in `lib/ai/openrouter-client.ts` changes.

## Seams & refs
- Reuse: `lib/ai/openrouter-client.ts` `SYSTEM_PROMPT` (the single source of the system prompt — no parallel prompt-building path). Refs: CAM-270 (client foundation, `SYSTEM_PROMPT` origin) · CAM-272 BR-4 (UI plain-text render + `cards[]`-only contract this defect's model output was duplicating in prose).

## Out of scope
- Client-side markdown-stripping/sanitization safety net if the model still doesn't comply in practice → no follow-up ticket yet; re-smoke after this fix first
- Hard server-side truncation/enforcement of answer length → out of scope this story (prompt guidance only, not enforced)

## Self-verify
- AC-1..4 → unit (assert `SYSTEM_PROMPT` contains the new output-style rules + the delimiter/injection-defense sentence is unchanged and present exactly once; extends `__tests__/cam-270-openrouter-client.test.ts`)
- Story-specific: no change to delimiter/sanitize logic, tool schemas, `max_tokens`, or round cap — all existing CAM-270 tests for those stay green unmodified.
- Gate = /quality-gate · Done = merge to `dev` + AC verified on localhost (dev DB).

## Changelog
- v1 (2026-07-18) — created (spec-lite, G1 folds into G3, Auto mode). Real re-smoke defect: model answer embedded raw markdown (`**bold**`, image-URL markdown) and enumerated all 10 camps in prose, duplicating the `cards[]` the UI renders separately.
