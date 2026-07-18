---
linear: CAM-421
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: backend-engineer
status: In Progress
version: v1
updated: 2026-07-19
---
# Conversation endpoints: list / view / delete (ADR-013 S7) (CAM-421)

## Story
As a **Camper**, I want to list my saved AI chat conversations, reopen one to read its full history, and delete one for good, so that I can find and manage my own past chats and remove one I no longer want stored.
Why: this is the S7 slice of ADR-013 — the persisted `ChatConversation`/`ChatMessage` model (CAM-414) exists but has no read/delete surface yet; the later resume-UI story (plan's S9) needs these endpoints to already exist.
Scope: three endpoints — `GET /api/ai/conversations` (list), `GET /api/ai/conversations/[id]` (full ordered history), `DELETE /api/ai/conversations/[id]` (hard delete) — plus the three matching `lib/ai/conversation-store.ts` functions. No UI (that is plan's S9); no changes to the chat route or the persistence write path (CAM-414/415/416/420).
Depends on: CAM-414 (`ChatConversation`/`ChatMessage` model + store service, already merged) · ADR-013 D2 (hard-delete/no-soft-delete divergence) · reuses the `getOwnedBooking`/`app/api/bookings/[id]/route.ts` no-403/404-split precedent.

## AC
<!-- No UI at this layer: the "Then (user sees)" column is `—` on every row (reason: this story ships the API contract only; the resume/history screen is plan's S9). The contract lives in "System effect". -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | a logged-in camper with 3 saved conversations, updated at different times | `GET /api/ai/conversations` | — (no UI; S9) | `200 { conversations }` — an array of `{id, title, messageCount, updatedAt}`, newest `updatedAt` first; `title` is the first USER message of that conversation truncated to 60 chars (or `null` if the conversation has no message yet) | EC-1 |
| AC-2 | a conversation the camper owns, holding N ordered messages | `GET /api/ai/conversations/[id]` | — (no UI; S9) | `200` with the conversation's `id` + every message in ascending order (`contentText` + `blocks`) — the same shape `loadWindow` already returns per message, unpaginated (bounded by CAM-414's 200-message cap) | EC-3 |
| AC-3 | a conversation the camper owns | `DELETE /api/ai/conversations/[id]` | — (no UI; S9) | `200 { id }`; the row and all its messages are HARD-deleted (`onDelete: Cascade`) — no `deletedAt` flag is ever written (ADR-013 D2) | EC-4 |
| AC-4 | no session (guest) | any of the three requests | — (no UI; S9) | `401`; no store function is ever called | EC-2 |
| AC-5 | a conversation that does not exist, or belongs to a different camper | `GET`/`DELETE /api/ai/conversations/[id]` | — (no UI; S9) | `404` — identical body for "missing" and "not yours"; never a `403` (no existence leak, `getOwnedBooking` precedent) | EC-3/EC-4 |
| AC-6 | the `[id]` path segment is not a valid UUID | `GET`/`DELETE /api/ai/conversations/[id]` | — (no UI; S9) | `400`; the zod parse rejects BEFORE any Prisma query runs | EC-5 |
| AC-7 | a camper who has already called `DELETE` 30 times in the last 15 minutes | a 31st `DELETE /api/ai/conversations/[id]` | — (no UI; S9) | `429` with `Retry-After`; `deleteConversation` is never called for the 31st request | EC-6 |

## Rules
- BR-1 `listConversations(userId)` returns every `ChatConversation` `where: { userId }`, `orderBy: { updatedAt: 'desc' }`, each with a derived `title` (the conversation's oldest `role: USER` message's `contentText`, truncated to `TITLE_MAX_LENGTH = 60` chars with a trailing `…` when longer, `null` when the conversation has no USER message yet) and `messageCount` (`_count.messages`) — both computed in the SAME query as the list (nested select + `_count`), never a per-row follow-up query. No pagination: bounded by CAM-414's existing `MAX_CONVERSATIONS_PER_USER = 20` cap. (proves AC-1, EC-1)
- BR-2 Ownership is enforced structurally, inside the store's `WHERE`, on every one of the three new functions — never `where: { id }` alone. A conversation missing or owned by a different `userId` is indistinguishable: both return the typed `not_found` code, mapped by the route to the SAME `404` body (no `403`/`404` split — matches `getOwnedBooking`/`app/api/bookings/[id]/route.ts`). (proves AC-5, EC-3, EC-4)
- BR-3 `getConversationWithMessages(conversationId, userId)` confirms ownership and loads every message (`orderBy: { seq: 'asc' }`, `contentText` + `blocks` + `id`/`role`/`seq`/`createdAt`) in ONE query (nested `messages` select on the ownership-scoped `findFirst`) — never a separate ownership check followed by a second message query. (proves AC-2)
- BR-4 `deleteConversation(conversationId, userId)` HARD-deletes via `prisma.chatConversation.deleteMany({ where: { id, userId } })` — ownership and the delete are the SAME atomic statement (no separate read-then-delete race). `count === 0` (missing id OR wrong owner) maps to `not_found`; messages cascade via the existing FK (`onDelete: Cascade`). No `deletedAt` column exists on this model — this is the ADR-013 D2 intentional divergence from the house soft-delete convention, not a bug to "fix" later. (proves AC-3, EC-4)
- BR-5 Every route (`GET /api/ai/conversations`, `GET`/`DELETE /api/ai/conversations/[id]`) calls `requireAuth()` first; `userId` is read from `session.user.id` only, never from the request body/query/path. Unauthenticated → `401` before any store call. (proves AC-4, EC-2)
- BR-6 The `[id]` path param is zod-validated as a UUID (`lib/validations/ai-conversation.ts`) BEFORE any store call, on both `GET` and `DELETE /api/ai/conversations/[id]`. A non-UUID segment → `400`, store never called. (proves AC-6, EC-5)
- BR-7 `DELETE /api/ai/conversations/[id]` is rate-limited per user: `checkRateLimit('ai-convo:del:<userId>', {limit: 30, windowMs: 15*60*1000})`, runs BEFORE the id is validated or the store is called. Over budget → `429` + `Retry-After` header. (proves AC-7, EC-6)
- BR-8 Every new store function returns the SAME typed discriminated-union result as CAM-414's (`{ok:true,data}|{ok:false,code}`) — never throws a raw/unexpected error; an unexpected DB error is logged internally (structured, no content/PII) and surfaced as `internal_error`, mapped by the route to a generic `500`. (proves every AC's error path)

## Edge cases
- EC-1 IF a camper has zero saved conversations THEN `GET /api/ai/conversations` returns `200 { conversations: [] }`, not an error (BR-1)
- EC-2 IF there is no session THEN all three endpoints return `401` and no store function is ever called (BR-5)
- EC-3 IF `conversationId` does not exist THEN `GET`/`DELETE /api/ai/conversations/[id]` return the typed `not_found` code → route `404` (BR-2, BR-3, BR-4)
- EC-4 IF `conversationId` exists but belongs to a different camper THEN the SAME `not_found`/`404` as EC-3 is returned — no existence leak, no `403` (BR-2, BR-4)
- EC-5 IF the `[id]` path segment fails `z.string().uuid()` THEN the route returns `400` before any Prisma call (BR-6)
- EC-6 IF a camper's 31st `DELETE` in a rolling 15-minute window arrives THEN the route returns `429` with `Retry-After` and `deleteConversation` is never invoked (BR-7)
- EC-7 IF a conversation has been `createConversation`-created but has not yet had a turn appended (no USER message) THEN `listConversations` returns `title: null` for it, never an invented placeholder string (BR-1)

## Data
- No schema change. Reuses CAM-414's `ChatConversation` / `ChatMessage` models exactly as migrated (`prisma/migrations/20260718173946_cam414_chat_persistence`).
- `title` is NEVER a stored column — it is derived at read time from the first `ChatMessage` (`role: USER`, lowest `seq`) per conversation (architecture.md §14 "no UI-shaped columns"; §12 "compute-on-the-fly, never cache as the source of truth").
- Migration: none (additive functions + routes only).

## Seams & refs
- Reuse: `lib/ai/conversation-store.ts` (CAM-414) — this story ADDS `listConversations` / `getConversationWithMessages` / `deleteConversation` to the SAME file, following its existing typed-result style; no caller queries `ChatConversation`/`ChatMessage` directly (architecture.md sharp boundary). · `lib/auth-utils.ts` `requireAuth()` (unchanged) · `lib/api-utils.ts` `apiError`/`apiSuccess` (unchanged, same `{error}`/atomic-data shape as `app/api/bookings/[id]/route.ts`) · `lib/rate-limit.ts` `checkRateLimit` (unchanged, same per-user key pattern as `app/api/bookings/route.ts`'s `booking:create:<userId>`).
- Refs: ADR-013 (`docs/adr/ADR-013-ai-chat-persistence-agency-foundation.md`) D2 (hard-delete divergence) · `.claude/rules/api.md` (validate → authz → query → shape → errors pipeline) · `.claude/rules/security.md` OWASP-1 (ownership scoping, no id/role from the client) · `.claude/rules/architecture.md` §12/§14 (derived title, never cached as source of truth).
- Reader/writer inventory (architecture.md 15b): this story adds READERS (`listConversations`, `getConversationWithMessages`) and one additional WRITER (`deleteConversation`, a hard-delete) to `ChatConversation`/`ChatMessage`. Existing writers — `createConversation`/`appendTurn` (CAM-414) — are unchanged (NO-CHANGE). No existing reader of these tables exists yet outside CAM-414's own `loadWindow` (also NO-CHANGE, unmodified). The new `deleteConversation` is the only new mutation path; it does not affect `appendTurn`'s eviction logic (that still hard-deletes on ITS OWN cap-eviction path, independently).

## Out of scope
- The list/detail/delete UI (resume screen, "start new" button, delete confirmation) → plan's S9 (a later CAM ticket).
- The 180-day retention cron (a separate hard-delete path on age, not on user action) → CAM-422 (S8).
- Changing `appendTurn`/`loadWindow`'s existing behavior, or the live chat route (CAM-415/416/420) → not touched by this story.
- Soft-delete / undo-delete — ADR-013 D2 deliberately hard-deletes; an "undo" would require re-introducing retained personal data, which is the opposite of the PDPA posture this ADR chose.

## Self-verify
- AC-1 → unit (`listConversations`: newest-first ordering, derived+truncated title, `messageCount`, one query — `__tests__/cam-421-conversation-store.test.ts`) + integration (`GET /api/ai/conversations` 200 shape, 401 — `__tests__/cam-421-conversation-routes.test.ts`)
- AC-2 → unit (`getConversationWithMessages`: ownership + ordered messages in one query) + integration (`GET /api/ai/conversations/[id]` 200 shape)
- AC-3 → unit (`deleteConversation`: `deleteMany` ownership-scoped, no `data:` payload — proves it is a real delete, not a soft-delete update) + integration (`DELETE` 200 `{id}`)
- AC-4 → integration (401 on all three endpoints when `requireAuth` returns an error, store never called)
- AC-5 → unit + integration (two-user fixture: `OTHER_USER_ID` gets the identical `not_found`/404 as a missing id on both `GET` and `DELETE`, never `403`)
- AC-6 → integration (`not-a-uuid` path segment → 400 on both `GET` and `DELETE`, store never called)
- AC-7 → integration (real `lib/rate-limit` module, store reset between tests — 30 real `DELETE` calls succeed, the 31st is `429` with `Retry-After`, `deleteConversation` called exactly 30 times)
- Story-specific: EC-7 (empty conversation → `title: null`, never invented text) · BR-8 (an unexpected DB error on any of the three functions → `internal_error` → route `500`, never a raw throw)
- Gate = /quality-gate · Done = merge to `dev` + AC verified on localhost (dev DB, all via `npx vitest run` — this story has no UI/route surface to click through).

## Changelog
- v1 (2026-07-19) — created (spec-first, template v2). S7 of the ADR-013 10-story plan; ships the API contract only, no UI (plan's S9).
