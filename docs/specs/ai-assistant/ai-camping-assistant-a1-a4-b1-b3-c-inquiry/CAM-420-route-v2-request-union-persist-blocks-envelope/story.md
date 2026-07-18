---
linear: CAM-420
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: backend-engineer
status: In Progress
version: v1
updated: 2026-07-19
---
# Route v2: request union + optional session + persist + blocks[] envelope (ADR-013 S6) (CAM-420)

## Story
As a **Camper**, I want my questions to the assistant to be remembered when I'm signed in — and to keep working exactly as before when I'm not — so that a signed-in conversation can be resumed later while a guest's quick question is never blocked, stored, or slowed down.
Why: this is the S6 integration slice of ADR-013 — it wires the already-merged persistence store (CAM-414), agent loop (CAM-416), tiered tool registry (CAM-417), and personal tools (CAM-418/419) into the ONE live chat endpoint, and ships the additive `blocks[]` envelope shape the later rich-content stories will use.
Scope: `POST /api/ai/chat` gains a second, session-bound request shape (`{conversationId?, message}`) alongside the untouched legacy shape (`{messages}`); a new per-user rate limit on the persisted path; the `AiChatBlock` envelope type + parsing contract in `lib/api-client.ts`. No UI changes (the FE still only sends the legacy shape — that wiring is CAM-423); no migration (reuses CAM-414's `ChatConversation`/`ChatMessage` schema exactly); no block TYPE is implemented or emitted yet.
Depends on: CAM-414 (persistence store) · CAM-416 (bounded agent loop) · CAM-417 (tiered registry + `ToolContext`) · CAM-418/419 (personal tools) · CAM-421 (conversation list/view/delete, same store functions) · ADR-013 D6/D5/D7.

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | a guest (no session) posting the existing `{messages}` shape | `POST /api/ai/chat` | — (no UI change; the existing chat panel is untouched) | Behavior is BYTE-IDENTICAL to before this story: guest-tier tools only, `runAssistantTurnFromMessages` called with no `ToolContext`, `200 {answer, cards, suggestions?}`, nothing ever persisted | EC-5 |
| AC-2 | a signed-in camper, no `conversationId` in the body | `POST /api/ai/chat` with `{message}` | — (no UI change; API contract only) | A new `ChatConversation` is created for the camper; the turn runs with `authed`-tier tools available; on success the turn is persisted (2 new `ChatMessage` rows) and the response includes `conversationId` | EC-1 |
| AC-3 | a signed-in camper resuming a conversation they own, holding N prior messages | `POST /api/ai/chat` with `{conversationId, message}` | — (no UI change; API contract only) | The last 10 prior messages load (ownership-scoped) and enter the model call as real conversation history; the new turn appends (2 more rows) on success; response includes the SAME `conversationId` | EC-2 |
| AC-4 | a signed-in camper's 31st persisted-path request in a rolling 15-minute window | `POST /api/ai/chat` with `{message}` | — (no UI change; API contract only) | `429` with `Retry-After`; no model call is made, nothing is persisted | EC-3 |
| AC-5 | the assistant's model call fails or times out (any signed-in or guest request) | `POST /api/ai/chat` | — (no UI change; API contract only) | `502 assistant_error`; for the persisted path specifically, `appendTurn` is never called — zero new rows | EC-4 |
| AC-6 | no session, posting the new `{message}` shape (no `messages` key) | `POST /api/ai/chat` | — (no UI change; API contract only) | `401 unauthenticated`; no rate-limit-for-user check, no conversation read/write, no model call | EC-6 |
| AC-7 | a signed-in camper supplying a `conversationId` that does not exist, or belongs to a different camper | `POST /api/ai/chat` with `{conversationId, message}` | — (no UI change; API contract only) | `404 conversation_not_found` — identical for "missing" and "not yours" (no existence leak); no model call, nothing persisted | EC-2 |
| AC-8 | a wire response that carries an unrecognized `blocks[].type` value | the client (`lib/api-client.ts`) parses the `200` body | — (no UI change; no block-consuming component exists yet) | `parseAiChatSuccessBody` keeps the well-shaped block in the parsed outcome (never throws, never rejects the whole response) — an unknown type is a future-compat entry, not a parse error | EC-7 |

## Rules
- BR-1 The route's body is validated against a **union**, legacy-first: `chatRequestSchema` (`{messages}`, unchanged since CAM-271) tried before `chatRequestV2Schema` (`{conversationId?, message}`, new). The two shapes share no field name (`messages` vs `message`), so parsing is deterministic: an existing `{messages}` body can never accidentally match the new shape. (proves AC-1, AC-6)
- BR-2 The per-IP rate limit (`checkAssistantRateLimit`, unchanged, 30/15min) runs FIRST for every request, before the body is even parsed as JSON — identical to the pre-CAM-420 order. (proves AC-1's byte-identical guarantee)
- BR-3 `auth()` is read ONLY inside the v2 branch handler — never in the legacy branch. A `{messages}` body therefore never touches the session, guaranteeing the guest/legacy path cannot regress from a session-related change in a later story. (proves AC-1, AC-6)
- BR-4 The v2 branch requires a session: no `session.user.id` -> `401 unauthenticated`, before any rate-limit-for-user check, conversation read/write, or model call. (proves AC-6, EC-6)
- BR-5 A SECOND rate limit, per-user (`checkAssistantRateLimitForUser`, same 30/15min budget, key `ai-assistant:user:<userId>`), runs immediately after the session check, before the conversation is created/loaded and before any model call — additive to BR-2, not a replacement (the load-bearing spam control for the persisted-write path specifically). (proves AC-4, EC-3)
- BR-6 Conversation resolution: `conversationId` absent -> `createConversation(userId)` (evict-oldest per CAM-414's existing 20-conversation cap); `conversationId` present -> `loadWindow(conversationId, userId, 10)`, ownership-scoped — a missing/not-owned id returns the store's `not_found` code, mapped to `404 conversation_not_found` (no 403/404 split, CAM-421 precedent). The window size (10) is a fixed server constant, never read from the request. (proves AC-2, AC-3, AC-7, EC-1, EC-2)
- BR-7 The v2 branch builds a real `ToolContext{userId}` and calls `buildTurnMessages(history + newMessage, {source:'server'})` before `runAssistantTurnFromMessages(turnMessages, ctx)` — this is what makes `authed`-tier tools (CAM-417/418/419) available and lets a stored ASSISTANT turn re-enter as a real (not DATA-fenced) message, since it is server-persisted, not client-claimed. (proves AC-2, AC-3)
- BR-8 A turn is persisted (`appendTurn`) ONLY after `runAssistantTurnFromMessages` resolves `ok:true` (a real prose answer). `skipped:true` or `ok:false` returns the same `503`/`502` as the legacy path and NEVER calls `appendTurn` — zero new rows on any failed/self-skipped turn. (proves AC-5, EC-4)
- BR-9 Before persisting, the route sanitizes both the camper's message and the assistant's answer with the SAME `sanitizeForPrompt` sanitizer the prompt boundary already uses (capped at the store's own `MAX_CONTENT_TEXT_LENGTH`, not the shorter prompt default) — `conversation-store`'s own `truncateContentText` only bounds length, so the route itself owns stripping control characters / forged delimiter fragments before the text ever reaches the DB. (Security forward-flag)
- BR-10 If `appendTurn` itself fails after a successful answer (e.g. a race with `MAX_MESSAGES_PER_CONVERSATION`), the camper's answer is still returned (`answer`/`cards`/`suggestions` unchanged) but `conversationId` is OMITTED from the response (this turn did not land on the persisted path) and the failure is logged internally (no PII/content). The already-billed answer is never dropped for a storage hiccup.
- BR-11 `lib/api-client.ts` defines `AiChatBlock {type, v, data}` + a zod shape check; `parseAiChatSuccessBody` keeps any STRUCTURALLY well-formed block regardless of its `type` value (an unrecognized type is forward-compat data, not a parse failure) and drops only a malformed entry. No block type is implemented or emitted by any route in this story (cards/suggestions are explicitly NOT migrated into blocks here). (proves AC-8, EC-7)

## Edge cases
- EC-1 IF a signed-in camper posts `{message}` with no `conversationId` THEN a new conversation is created and its id is returned on success (BR-6)
- EC-2 IF a signed-in camper posts a `conversationId` that is missing or owned by someone else THEN the route returns `404 conversation_not_found` before any model call (BR-6)
- EC-3 IF a signed-in camper's 31st persisted-path request lands inside the rolling 15-minute window THEN the route returns `429` and neither the model nor `appendTurn` is ever reached (BR-5)
- EC-4 IF `runAssistantTurnFromMessages` resolves `ok:false` or `skipped:true` on the v2 path THEN the route returns `502`/`503` and `appendTurn` is never called (BR-8)
- EC-5 IF a request has no `messages` key AND no session THEN the legacy schema fails to match, the v2 schema matches structurally, and the route returns `401 unauthenticated` (not `400`) — the body is well-formed v2, just missing a session (BR-1, BR-4)
- EC-6 IF a request matches NEITHER shape (e.g. `messages` present but empty, or neither `messages` nor `message` present) THEN the route returns `400 invalid_request` before any auth/model work (BR-1)
- EC-7 IF the wire response's `blocks` array contains one well-formed entry with an unrecognized `type` string THEN `parseAiChatSuccessBody` keeps it in the parsed outcome without throwing (BR-11)
- EC-8 IF `appendTurn` fails after a successful model answer THEN the camper still receives their answer, but the response omits `conversationId` (BR-10)

## Data
- No schema change. Reuses CAM-414's `ChatConversation` / `ChatMessage` models and store functions (`createConversation`, `loadWindow`, `appendTurn`) exactly as migrated.
- `blocks` is NOT written by this story's `appendTurn` call (left `undefined` -> stored `null`, "a plain answer" per ADR-013 D2) — migrating `cards`/`suggestions` into the `blocks[]` envelope is explicitly out of scope here.
- Migration: none.

## Seams & refs
- Reuse: `lib/ai/conversation-store.ts` (CAM-414/421, unchanged) · `lib/ai/openrouter-client.ts` `runAssistantTurnFromMessages` (CAM-416/417/419, unchanged — this story is its first caller to ever pass a real `ToolContext`) · `lib/ai/build-turn-messages.ts` `buildTurnMessages` (CAM-415, unchanged — this story is its first caller to ever pass `{source:'server'}`) · `lib/ai/rate-limit.ts` (CAM-270, extended with one new sibling function `checkAssistantRateLimitForUser`, same constants) · `lib/ai/sanitize.ts` `sanitizeForPrompt` (CAM-270, unchanged, reused for the store-side sanitize).
- Refs: `docs/adr/ADR-013-ai-chat-persistence-agency-foundation.md` D5 (tiered registry + server-bound identity), D6 (additive contract: request union + `blocks[]` envelope), D7 (the streaming seam — this story's single `finalizeAnswer`/response-construction point is what CAM-412 will later hook, untouched here) · `.claude/rules/api.md` (validate -> authz -> query -> shape -> errors) · `.claude/rules/security.md` (per-user rate limit forward-flag, sanitize-before-store forward-flag, no userId ever read from the body).
- Reader/writer inventory (architecture.md 15b): this story adds ONE new writer path to `ChatConversation`/`ChatMessage` (the chat route itself, via the already-existing `createConversation`/`appendTurn`) and ONE new reader path (`loadWindow`, already exercised by nothing else in production until now). No existing reader/writer of these tables changes semantics — `conversation-store.ts` itself is untouched by this story (NO-CHANGE); CAM-421's list/view/delete routes are independent callers of the same functions (NO-CHANGE, unaffected).

## Out of scope
- Any UI change to the chat panel/composer (still sends only the legacy `{messages}` shape) → CAM-423 (S9, resume UI).
- Migrating `cards`/`suggestions` into the `blocks[]` envelope, or implementing any real block `type` → a later story once a rich-content journey needs one (D6 alternatives-considered, "additive by design").
- The 180-day retention cron → CAM-422 (S8, already shipped independently).
- Streaming the final answer (CAM-412) → the D7 seam is preserved (one response-construction point), not built here.

## Self-verify
- AC-1 → integration (`__tests__/cam-420-ai-chat-route-v2.test.ts`: a `{messages}` body with `auth()` mocked to throw/never-called assertion — legacy path never reads the session; same 200/429/502/503 shapes as the CAM-271 suite, which is re-run unmodified as a regression guard)
- AC-2 → integration (`{message}`, no `conversationId`, `createConversation` called with `session.user.id`; `runAssistantTurnFromMessages` called with `{userId}`; `appendTurn` called exactly once with the sanitized text; response `conversationId` equals the created id)
- AC-3 → integration (`{conversationId, message}`; `loadWindow` called with `(conversationId, userId, 10)`; the resolved history + new message are handed to `buildTurnMessages` with `{source:'server'}`; response `conversationId` unchanged)
- AC-4 → integration (real `lib/rate-limit` module, 30 real v2 calls succeed, the 31st is `429`, `runAssistantTurnFromMessages` never called on the 31st)
- AC-5 → integration (`runAssistantTurnFromMessages` resolves `ok:false`/`skipped:true` on the v2 path -> `502`/`503`, `appendTurn` asserted NOT called)
- AC-6 → integration (`auth()` mocked to resolve `null`, `{message}` body -> `401`, `checkAssistantRateLimitForUser`/conversation store never reached)
- AC-7 → integration (`loadWindow` mocked to resolve `{ok:false, code:'not_found'}` -> `404 conversation_not_found`, no model call)
- AC-8 → unit (`lib/api-client.ts`: `parseAiChatSuccessBody` given `blocks:[{type:'some_future_block', v:1, data:{...}}]` keeps it; given a malformed entry (`{type:1}`) drops only that entry)
- Story-specific: the FULL CAM-271/415/416/417 route test suites are re-run unmodified in the same session as a byte-identical regression guard (BR-1/BR-2/BR-3); `sanitizeForStore` unit-tested for control-char/delimiter stripping before persist (BR-9); `appendTurn`-fails-after-success path asserted to still return the answer with `conversationId` omitted (BR-10, EC-8).
- Gate = /quality-gate · Done = merge to `dev` + AC verified on localhost (dev DB, all via `npx vitest run` — this story has no UI surface to click through; the FE still only exercises the legacy path).

## Changelog
- v1 (2026-07-19) — created (spec-first, template v2). S6 of the ADR-013 10-story plan; integrates CAM-414/416/417/418/419 into the live route; ships the `blocks[]` envelope shape only (no block type yet).
