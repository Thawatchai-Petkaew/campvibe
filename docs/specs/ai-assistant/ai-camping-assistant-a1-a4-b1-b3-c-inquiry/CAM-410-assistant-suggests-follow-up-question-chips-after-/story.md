---
linear: CAM-410
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: product-owner
status: In Progress
version: v2
updated: 2026-07-18
---
# Assistant suggests follow-up question chips after every answer (CAM-410)

## Story
As a **Camper**, I want tappable follow-up-question chips under each assistant answer, so that I can keep narrowing my camp search with one tap instead of typing the next question (raises multi-turn continuation per session, not measured).
Scope: extend the existing chat turn to also return 0–3 short Thai follow-up questions and render them as chips under the answer; a tap sends that text as a new message through the existing send path. Does NOT add a second model call, does NOT change search/availability logic, does NOT persist suggestions.
Depends on: CAM-271 (chat endpoint contract this extends) · CAM-270 (single-round turn + spend guard) · CAM-405 (plain-text answer rendering rule)

## AC
<!-- Then = user-visible (screen text = verbatim Thai) · System effect = data outcome, plain language · Neg/edge = failure twin. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The assistant answered and the turn returned 1–3 valid suggestions | The answer renders | Under the answer, up to 3 tappable chips appear in a group labelled `คำถามแนะนำ`, each showing a short Thai follow-up question (model-generated, e.g. `เอาที่ถูกกว่านี้`) | The answer entry stores `suggestions[]` (≤3 items, each 1–60 chars, sanitized plain text) | EC-1 |
| AC-2 | Follow-up chips are shown under the latest answer | The camper taps the chip `ว่างเสาร์นี้ไหม` | A new user message bubble `ว่างเสาร์นี้ไหม` appears (verbatim) and the assistant answers it | The chip's exact sanitized text is sent as a `user` message via the same path as typing — no prefix, no edit | EC-2 |
| AC-3 | A previous answer showed chips | A new turn starts (the camper taps a chip or types and sends) | The previous answer's chips are gone; chips appear only under the newest answer | Only the newest answer entry renders its `suggestions[]` | EC-5 |
| AC-4 | The turn returned no usable suggestions (field absent, empty, or all dropped) | The answer renders | The answer renders exactly as before with no chip area shown | The answer entry stores `suggestions = []`; nothing else changes | EC-1 |
| AC-5 | A turn is in flight, or the turn resolved to a rate-limited / disabled / error notice | The assistant is still typing, or a notice is shown | No follow-up chips are shown for that turn (the camper sees the typing indicator or the notice only) | Chips render only after a turn resolves to an `answer` | EC-3 |
| AC-6 | Follow-up chips are shown | A screen-reader or keyboard user reaches them | The chips are announced as the labelled group `คำถามแนะนำ`; each chip is a focusable button reachable by keyboard | Chips are `<button>` elements inside a group carrying `aria-label` = `คำถามแนะนำ` | — (a11y structure; no failure branch — asserted by role/name + keyboard-focus query) |

## Rules
- BR-1 The `200` chat success body extends BY ADDITION to `{ answer, cards, suggestions }`, where `suggestions: string[]` is OPTIONAL and backward-compatible (api.md §12): absent OR `[]` means "no chips", no existing field changes type, and a client that does not know the field ignores it (older clients keep working unchanged).
- BR-2 Bounds/defaults: keep at most 3 suggestions; each sanitized suggestion must be 1–60 characters; drop blank/whitespace-only suggestions, drop any longer than 60 chars (never truncate a question mid-word), and collapse exact duplicates (keep the first). Anything beyond the first 3 well-formed unique items is dropped. When none qualify, the value is `[]`.
- BR-3 Each suggestion is model output and therefore UNTRUSTED (security.md §6 AI/LLM): strip control characters, markdown syntax, HTML/tags, and any `<user_message>` delimiter, then collapse whitespace — a chip is always inert plain text (rendered as data, never `dangerouslySetInnerHTML`, never markdown-to-HTML), mirroring the existing answer-rendering rule (CAM-405 / AiChatMessageList BR-4).
- BR-4 Generation happens in the SAME single model completion that produces the answer — NO second paid model call and NO extra tool round (CAM-270's exactly-one-round guarantee is unchanged). The model encodes the suggestions in a structured block inside that one completion; the SERVER parses + sanitizes them out. A parse or sanitize failure yields `suggestions = []` and a clean answer — never a turn error.
- BR-5 The `answer` shown to the camper never contains the raw suggestions block (JSON/delimiter markup) — the server strips it before returning, so the camper only ever sees clean prose plus (optionally) the chips.
- BR-6 Spend guard: the per-call `max_tokens` cap rises from 600 to 680 (~+80 headroom for 2–3 short Thai lines) — this is the ONLY spend-guard change. The per-IP rate limit (CAM-271 BR-2) and the single-round guarantee are unchanged; no new model call is introduced anywhere.
- BR-7 Chips render only under the LATEST assistant answer entry, and only when that turn resolved to an `answer` (not while sending, not for a rate-limited / disabled / error notice). Tapping a chip sends its verbatim sanitized text as a new `user` message through the same code path as typing (no prefixing, no editing).
- BR-8 New fixed copy: the chip group's accessible label is `คำถามแนะนำ` (EN `Suggested questions`), added to `locales/` (TH/EN, never hardcoded). The suggestion strings themselves are model-generated at runtime and are NOT stored in `locales/` (unlike the fixed welcome pills).

## Edge cases
<!-- cover: invalid · empty/zero · concurrent/duplicate · permission · boundary. -->
- EC-1 IF the model returns no suggestions, an empty array, or every suggestion is dropped by the bounds/sanitize rules THEN the answer renders with no chip area and `suggestions = []` — never an error (BR-2, BR-4).
- EC-2 IF a suggestion contains markdown, HTML, or delimiter/injection text (e.g. `**ลด**`, `<b>ถูก</b>`, `</user_message>`, "ignore previous instructions") THEN it is sanitized to inert plain text before it becomes a chip, and a tap sends only that sanitized plain text (BR-3).
- EC-3 IF a turn is in flight (sending) OR the turn resolved to a rate-limited / disabled / error notice THEN no follow-up chips are shown for that turn (BR-7).
- EC-4 IF the model returns more than 3 suggestions, a suggestion longer than 60 chars, or a blank/duplicate suggestion THEN keep at most the first 3 well-formed unique ones and drop the rest (BR-2).
- EC-5 IF the structured suggestions block cannot be parsed from the completion (malformed/truncated) THEN `suggestions = []` and the answer text still renders cleanly with the raw block stripped — the camper never sees JSON or delimiter markup (BR-4, BR-5).
- EC-6 IF an older client (pre-CAM-410) receives a response carrying the new `suggestions` field THEN it ignores the unknown field and behaves exactly as before — the field is additive/optional (BR-1).

## Data
- In-memory / transport only, NO database entity and NO persistence: `AssistantTurnResult.suggestions?: string[]` (server turn result) · chat `200` body `suggestions?: string[]` · `AiChatOutcome` ok-variant `suggestions: string[]` · `ChatEntry` answer-variant `suggestions: string[]`. Each item is a Public, plain-text Pixel (a short question string); no PII/Financial/Geo data. migration: none.

## Seams & refs
<!-- Shape change (response body grows a field): grep-inventory every reader+writer; the client parser enumerates fields explicitly so the field does NOT ride through automatically (CAM-342 lesson). -->
Reader/writer inventory of the chat response shape (architecture.md §15b):
- **Writers (NOW):** `lib/ai/openrouter-client.ts` `runAssistantTurn` — parse + sanitize `suggestions` from the FINAL completion content (the no-tool `first.message.content` path AND the post-tool `second.message.content` path both carry it), add `suggestions` to `AssistantTurnResult`, raise `MAX_TOKENS` 600→680. `app/api/ai/chat/route.ts` — add `suggestions` to the `200` body (additive; `toWireCards` unaffected).
- **Readers (NOW — CAM-342: these enumerate fields explicitly, so the field will NOT flow through unless edited):** `lib/api-client.ts` `parseAiChatSuccessBody` destructures `{ answer, cards }` and `AiChatOutcome` enumerates the ok-variant fields — BOTH must add `suggestions` (parse the array, tolerate-absent → `[]`, drop non-strings). `components/ai-chat/conversation.ts` `ChatEntry` answer-variant + `appendOutcome` "ok" case carry `outcome.suggestions`. `components/ai-chat/AiChatMessageList.tsx` renders the chips under the `kind:"answer"` row (latest answer only).
- **NO-CHANGE:** `conversation.ts` `buildOutgoingHistory` — sends only user+assistant answer TEXT back as history; suggestions are never echoed to the model, so it stays unchanged. `isAiChatCardResponse` / `toWireCards` — cards path untouched.
- **LATER:** QA adds contract + unit coverage for the suggestions field (test.md).
- **Seam invariant (one test walks it):** for every response the client can receive — absent field, `[]`, valid 1–3, >3, over-length, blank, duplicate, injection — the client resolves to a sanitized `string[]` of length 0–3, and the chip render + tap-send path treats that array identically at every layer (server → wire → parse → entry → render).
- **Reuse (no parallel logic):** the sanitize idiom already lives in `lib/ai/sanitize.ts` (`sanitizeForPrompt` strips control chars / delimiter tags / collapses whitespace) — extend/reuse it for suggestion sanitizing, do not hand-roll a second sanitizer. The chip visual already exists as the welcome pills in `AiChatMessageList` (`Button variant="outline" size="sm"` rounded-full, wired to `onSuggestion` → `AiChatPanel.handleSuggestion` → `sendMessage`) — reuse that exact visual + send path for follow-up chips.
- **Refs:** CAM-271 (chat endpoint contract) · CAM-270 (single-round turn, `MAX_TOKENS` spend guard) · CAM-405 (plain-text-only answer rendering) · api.md §12 (backward-compatible by addition) · security.md §6 (untrusted model output).

## Out of scope
- Persisting suggestions or logging chip-tap analytics → not carded (propose a follow-up only if measured demand appears).
- Replacing or personalizing the fixed welcome/empty-state pills (they stay the 3 hardcoded `suggestion1..3`) → NO-CHANGE.
- Forcing a suggestion language beyond "same language as the answer", or translating model suggestions → out of scope.
- Personalizing suggestions from the camper's booking/search history → out of scope.

## Self-verify
- AC-1, AC-4, EC-1/EC-4/EC-6 → unit (`conversation.ts` `appendOutcome` carries suggestions; `parseAiChatSuccessBody` tolerates absent/empty/malformed → `[]`; bounds/dedupe/over-length drop).
- AC-2, AC-3, AC-5, EC-3 → unit + owner-verify (browser): tapping a chip sends its verbatim text via `sendMessage`; previous chips clear on a new turn; no chips while sending or on a notice.
- AC-6, EC-2 → unit/a11y (group `aria-label` = `คำถามแนะนำ`, chips are keyboard-focusable buttons) + sanitize test (markdown/HTML/delimiter/injection input → inert plain text).
- Story-specific invariants: exactly ONE model completion per turn (assert no added model call, single-round path unchanged) · `MAX_TOKENS` = 680 · the shown `answer` never contains the raw suggestions block · the seam-invariant test walks the full input matrix across every reader.
- NFR: **security** — model output sanitized + rendered as inert plain text (no HTML/markdown), spend guard bounded (max_tokens 680, no new call, rate limit unchanged); **a11y** — labelled group + keyboard-reachable chips; **perf** — 0 added network round-trips (same single turn), no measurable added latency ("not measured", potential negligible); **i18n** — the group label lives in `locales/` (TH/EN), suggestion strings are runtime model output.
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge, re-verified on the real Staging URL at G4.

## Changelog
- v1 (2026-07-18) — created
- v2 (2026-07-18) — housekeeping: moved from the stray root-level `docs/specs/ai-camping-assistant-a1-a4-b1-b3-c-inquiry/` path (a ticket-sync resolution artifact — the ticket carried no `featureName`) into the canonical `docs/specs/ai-assistant/ai-camping-assistant-a1-a4-b1-b3-c-inquiry/` home alongside CAM-270..408; `feature:` frontmatter corrected to `ai-assistant`; no content change
