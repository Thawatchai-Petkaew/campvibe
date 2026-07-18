---
linear: CAM-423
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: frontend-engineer
status: In Progress
version: v1
updated: 2026-07-19
---
# UI resume: login re-opens the last chat + a "start new" button (ADR-013 S9) (CAM-423)

<!-- Gate class: G1 folded (ADR-013 S9 ratified, docs/adr/ADR-013-ai-chat-persistence-agency-foundation.md). G2 = standard class (reuse-only: AiChatPanel/AiChatMessageList/Button/LoadingSpinner + existing tokens, no new component/flow/token) — check:ds + check:palette green, no separate G2 tap. -->

## Story
As a **Camper**, I want the assistant panel to reopen my most recent conversation when I'm logged in, and a clearly-labelled way to start a fresh one, so that I don't lose context between visits and can still start over on purpose.
Why: CAM-414/420/421 already persist and expose conversation history via the API, but no UI reads it yet — this is the final S9 slice of ADR-013's 10-story plan that makes the persisted history actually resumable.
Scope: client-side wiring only inside the existing chat feature — `components/ai-chat/*` + the `aiChatAPI` facade in `lib/api-client.ts`. Guest behaviour is UNCHANGED (D1: stays stateless, legacy `{messages}` body, nothing loaded/persisted). No new component, token, or flow; no change to the route/store/tools.
Depends on: CAM-414 (persistence store) · CAM-420 (v2 `{conversationId?, message}` route + `blocks[]` forward-compat contract) · CAM-421 (list/get/delete conversation endpoints).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | a logged-in camper who has a saved conversation from a previous visit | opens the assistant panel | the panel opens already showing that conversation's past messages (no `กำลังโหลด…` flash longer than the fetch itself, then the restored thread) | client calls `GET /api/ai/conversations` → `GET /api/ai/conversations/[id]` for the newest one and renders its messages; the resumed `conversationId` threads the next turn | EC-1 |
| AC-2 | a logged-in camper with NO saved conversation yet | opens the assistant panel | the existing welcome state (`สวัสดี เราน้องกองไฟเอง...` + the 3 example pills) — no error, no change from today's first-time guest welcome | no conversation fetched/created until the camper actually sends a message | — (empty state, not a failure path) |
| AC-3 | a logged-in camper mid-conversation (resumed or fresh) | taps `เริ่มแชทใหม่` | the thread clears back to the welcome state | `conversationId` is cleared client-side; the NEXT sent message posts with no `conversationId`, so the route creates a new conversation | — |
| AC-4 | a guest (no session) | opens the assistant panel and chats | identical to today: byte-stable legacy `{messages}` body, in-memory-only thread, no history fetched, no `เริ่มแชทใหม่` control shown | no `GET /api/ai/conversations*` call is ever made for a guest | EC-4 |
| AC-5 | a logged-in camper's history fetch fails (network error, 401, 404, or 500) | the panel opens | the fresh welcome state — same as AC-2, never an error banner | `resuming` clears; entries stay `[]`; the camper can still chat normally (a fresh conversation is created on first send) | EC-1 |
| AC-6 | a restored assistant message whose stored `blocks` contains an unrecognized/malformed entry | the panel renders the restored thread | the plain text answer renders normally; nothing crashes, no console error | the block is parsed via the same forward-compat validator the live turn response already uses; an unrecognized block type is skipped, never thrown | EC-2 |
| AC-7 | a logged-in camper sending a turn (fresh or resumed) | taps send | the answer streams in exactly like today (typing dots -> answer) | the request posts the v2 shape `{conversationId?, message}`; the response's `conversationId` (new or unchanged) is kept for the next turn | EC-3 |

## Rules
- BR-1 On mount, if `useSession()` resolves to `authenticated`, the hook fetches the camper's own conversations (`aiChatAPI.listConversations`) exactly once per panel open and, if any exist, loads the newest (`updatedAt`-first, index 0) via `aiChatAPI.getConversation` and restores it. A guest (`unauthenticated`, or the transient `loading` status) never triggers either call (D1). (proves AC-1, AC-4)
- BR-2 Any failure in the resume fetch (empty list, a non-2xx response, or a thrown/rejected fetch) falls back to the fresh welcome state — `entries` stays `[]`, no error is surfaced to the camper. (proves AC-2, AC-5)
- BR-3 While the resume fetch is in flight (`resuming`), the composer's send action (button, Enter key, and suggestion pills) is disabled; the message log shows the existing inline spinner + `กำลังโหลด…`/`Loading…` text (loading.md: an isolated-module fetch, no new skeleton). (proves AC-1, AC-5)
- BR-4 `เริ่มแชทใหม่` clears both the rendered thread and the held `conversationId` client-side only — no DELETE call is made (deleting a conversation is CAM-421's existing endpoint, out of scope here). It renders only for an authenticated camper. (proves AC-3)
- BR-5 Every authed turn (resumed or fresh) posts `POST /api/ai/chat` as `{conversationId?, message}` (CAM-420 v2 shape) instead of the legacy `{messages}` array; a guest turn is byte-identical to pre-CAM-423 (`{messages}` array via `aiChatAPI.send`, unchanged). (proves AC-7, AC-4)
- BR-6 A restored `ASSISTANT` message's `blocks` is validated through the same `normalizeBlocks` the live turn response already uses before being (currently: never, since no block type maps to cards/suggestions yet) rendered — a structurally malformed or unrecognized-type entry is dropped/skipped, never thrown. (proves AC-6)

## Edge cases
- EC-1 IF the conversation list or detail fetch fails for any reason (network error, 401, 404, 500) THEN the panel falls back to the fresh welcome state, never an error banner or a thrown exception (BR-2)
- EC-2 IF a restored message's stored `blocks` is malformed JSON-shape or carries an unrecognized `type` THEN it is skipped/dropped by the shared normalizer and the plain text answer still renders (BR-6)
- EC-3 IF the camper's session ends (logout) between opening the panel and sending the next message THEN that turn falls back to the guest legacy path (`{messages}`, in-memory only) — no crash, no stale `conversationId` reused (BR-5)
- EC-4 IF the camper's most recently active conversation was deleted (e.g. via CAM-421's `DELETE`) between the list call and the detail call THEN the detail fetch 404s and the panel falls back to the fresh welcome state exactly like EC-1 (BR-2)

## Data
- No schema change. Reuses CAM-414's `ChatConversation`/`ChatMessage` model and CAM-420/CAM-421's existing endpoints exactly as shipped.
- No new route, tool, or store function — this story is client-only wiring (`components/ai-chat/*`, `lib/api-client.ts` facade additions only).

## Seams & refs
- Reuse: `aiChatAPI` facade (`lib/api-client.ts`, CAM-272/420) — adds `sendTurn`/`listConversations`/`getConversation`, no change to the existing `send`. `components/ai-chat/conversation.ts`'s pure state machine (CAM-272) — adds `isAuthedSession`/`restoreEntriesFromMessages`, existing exports (`buildOutgoingHistory`, `appendOutcome`, etc.) untouched so the guest path stays byte-stable. `useSession` (`next-auth/react`, the SAME live-session pattern `components/Navbar.tsx` already uses per CAM-396's lesson: read the live client status, never a server-rendered prop). `LoadingSpinner`'s existing inline-override className pattern (`h-auto w-auto gap-0`, already used by the send button) — reused for the resume indicator, no new loader component.
- Refs: ADR-013 (`docs/adr/ADR-013-ai-chat-persistence-agency-foundation.md`) D1 (guest stays stateless) · D6 (additive `blocks[]`/request-union forward-compat) · `.claude/rules/loading.md` (inline indicator for an isolated-module fetch, a11y `aria-busy`/`role=status`/`aria-live=polite`) · `.claude/rules/code.md` CAM-396 (client-side session gates read the live `useSession()` status).

## Out of scope
- Deleting a conversation from this panel, or a "history list" browsing UI (CAM-421's endpoints exist; no list/browse screen is built here).
- Merging a guest thread into an authed one on login (ADR-013's optional S10 — not built).
- Any change to `app/api/ai/chat`, `app/api/ai/conversations*`, or `lib/ai/*` (route/store/tools) — this story is UI-only.
- Rendering `aiChat.retentionNotice` copy anywhere (the key already exists from CAM-422; surfacing it is a follow-up, not required by this story's AC).

## Self-verify
- AC-1/AC-5/EC-1/EC-4 → unit (`restoreEntriesFromMessages`, `isAuthedSession`) + source-inspection (the hook's resume effect calls `listConversations`→`getConversation` and falls back gracefully on any failed/empty result) — `__tests__/cam-423-*.test.ts`
- AC-2 → source-inspection (welcome state still gates on `entries.length === 0 && !resuming`, unchanged copy)
- AC-3 → source-inspection (`startNewChat` clears `conversationId` + entries; the button is authed-only, `data-testid="btn--ai-chat-new"`)
- AC-4 → unit/source-inspection: the guest branch still calls `buildOutgoingHistory` + `aiChatAPI.send` unchanged; a fixture snapshot re-confirms the legacy request/response shapes untouched
- AC-6/EC-2 → unit (`restoreEntriesFromMessages` given a malformed/unknown-type `blocks` value never throws, resolves to `cards: []`/`suggestions: []`)
- AC-7/EC-3 → unit (`aiChatAPI.sendTurn` posts `{conversationId?, message}`, maps `conversationId` through `parseAiChatSuccessBody` same as CAM-420) + source-inspection (`runTurn` branches on `isAuthedSession(status)`)
- Design gate: token-only (Button/LoadingSpinner/MessageSquarePlus only, no new component/token), i18n (`aiChat.newChat` TH/EN added, parity + no-em-dash checks already run for every `aiChat.*` key), a11y (`role="status" aria-live="polite"` + `aria-busy` on the resume indicator, `aria-label` on the new-chat icon button, 44px tap target via `size="icon"`)
- Gate = /quality-gate · Done = merge to `dev` + AC verified on localhost (dev DB) before merge; a real login-and-reopen smoke is the browser-only part of AC-1 (owner-verify on `npm run dev`, per qa.md — a headless test can drive the same hook logic but not literally re-open the browser panel).

## Changelog
- v1 (2026-07-19) — created (spec-first, template v2, terse per the spec-lite class). S9 (final) of the ADR-013 10-story plan.
