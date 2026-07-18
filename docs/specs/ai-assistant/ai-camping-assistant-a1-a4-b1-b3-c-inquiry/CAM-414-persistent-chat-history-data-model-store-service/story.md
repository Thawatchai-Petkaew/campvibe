---
linear: CAM-414
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: backend-engineer
status: In Progress
version: v1
updated: 2026-07-19
---
# Persistent chat history: data model + store service (ADR-013 foundation, S2) (CAM-414)

## Story
As a **Platform** team member, I want a persistent `ChatConversation`/`ChatMessage` data model plus a single store service (`lib/ai/conversation-store.ts`), so that a later chat endpoint can save and reopen a logged-in camper's real conversation history without any caller writing its own Prisma queries against these tables.
Why: this is the foundation slice of ADR-013 (persistent chat history) — the model + atomic-write service must exist and be proven safe (caps, ownership, no partial writes) before the route/message-role/UI stories (CAM-415/416/…) can wire a visible feature on top of it.
Scope: the `ChatConversation` + `ChatMessage` Prisma models (additive migration) and three service functions — `createConversation`, `appendTurn`, `loadWindow` — with caps, eviction, ownership scoping, and typed error codes. No API route, no UI, no wiring into the chat endpoint (that is CAM-415/416).
Depends on: ADR-013 (persistent chat history — in progress, CAM-413) · reuses `lib/prisma.ts` singleton · no other model is modified except `User` gaining the `chatConversations` relation.

## AC
<!-- No UI at this layer: the "Then (user sees)" column is `—` on every row (reason: foundation lib story — the visible chat resume/history UI lands in a later story, CAM-415/416/S9). The contract lives in "System effect". -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | a logged-in user with fewer than 20 saved conversations | `createConversation(userId)` is called | — (no UI; CAM-415/416) | one new `ChatConversation` row is created for that `userId`; no existing row is touched | EC-1 |
| AC-2 | a logged-in user who already has 20 saved conversations | `createConversation(userId)` is called again | — (no UI; CAM-415/416) | the single least-recently-updated conversation for that user (and its messages, via cascade) is hard-deleted, then the new row is created — both inside ONE transaction, so the user's count never exceeds 20 | EC-1 |
| AC-3 | an existing conversation the caller owns, with N prior messages (N < 200) | `appendTurn(conversationId, userId, {userText, assistantText})` is called | — (no UI; CAM-415/416) | exactly 2 new `ChatMessage` rows are written (seq N+1 role USER, seq N+2 role ASSISTANT) and the conversation's `updatedAt` is bumped to now — all inside ONE transaction (all-or-nothing) | EC-2 |
| AC-4 | a conversation already holding 200 messages (the cap) | `appendTurn` is called again | — (no UI; CAM-415/416) | no row is written and `updatedAt` is not touched; the call returns a typed `conversation_full` result, never throws | EC-3 |
| AC-5 | `userText`/`assistantText` longer than 4000 characters | `appendTurn` is called | — (no UI; CAM-415/416) | the stored `contentText` is truncated to exactly 4000 characters; the turn still commits (defense-in-depth — the real length boundary is the caller's own zod schema, e.g. CAM-271's `MAX_CHAT_MESSAGE_LENGTH`) | EC-7 |
| AC-6 | a `conversationId` that does not exist, or belongs to a different user | `appendTurn(conversationId, userId, …)` is called | — (no UI; CAM-415/416) | no row is written; a typed `not_found` result is returned — a wrong owner is indistinguishable from a missing id (no existence leak) | EC-4 |
| AC-7 | a conversation with more than 10 messages | `loadWindow(conversationId, userId, 10)` is called | — (no UI; CAM-415/416) | returns exactly the newest 10 messages, in ascending (chronological) `seq` order | EC-5 |
| AC-8 | a `conversationId` that does not exist, or belongs to a different user | `loadWindow(conversationId, userId, …)` is called | — (no UI; CAM-415/416) | returns a typed `not_found` result; no message rows are queried | EC-4 |

## Rules
- BR-1 `MAX_CONVERSATIONS_PER_USER = 20`. `createConversation`, when the user is already at the cap, hard-deletes the single least-recently-updated conversation (`orderBy updatedAt asc, take 1`) for that user — cascading its messages via the FK (`onDelete: Cascade`) — in the SAME transaction as creating the new row, so the user's conversation count never exceeds 20. (proves AC-1, AC-2, EC-1)
- BR-2 Ownership is enforced structurally on every mutation/read: `where: { id: conversationId, userId }` — never `where: { id }` alone. A conversation owned by a different user is indistinguishable from a missing one; both return the typed `not_found` code, never a separate "forbidden" leak. (proves AC-6, AC-8, EC-4)
- BR-3 `MAX_MESSAGES_PER_CONVERSATION = 200`. `appendTurn` counts the conversation's existing messages inside the same transaction; at or above the cap, the transaction commits no row and returns a typed `conversation_full` result. (proves AC-4, EC-3)
- BR-4 `appendTurn` writes exactly 2 messages (`seq = currentMax+1` for USER, `currentMax+2` for ASSISTANT) and bumps `ChatConversation.updatedAt`, ALL inside one `prisma.$transaction` — all-or-nothing. `contentText` is truncated to `MAX_CONTENT_TEXT_LENGTH = 4000` characters before writing (defense-in-depth only; the primary length boundary is the caller's upstream zod validator). `blocks`, when its `JSON.stringify` length exceeds `MAX_BLOCKS_BYTES = 16384`, is stored as `null` instead of the oversized payload and a structured warn log is emitted (`event: chat_blocks_oversize`, conversationId + byte length — no content, no PII) — the turn still commits with `contentText` intact. A `seq` unique-constraint collision (Prisma `P2002`, two concurrent `appendTurn` calls on the SAME conversation racing for the same next seq) is caught outside the transaction and returned as a typed `concurrent_write` rejection, never an unhandled throw. (proves AC-3, AC-5, EC-2, EC-6, EC-7)
- BR-5 `loadWindow(conversationId, userId, limit=10)` first confirms ownership (`where: { id: conversationId, userId }`), then queries `ChatMessage` `where: { conversationId }` ordered `seq desc` `take: limit`, and re-sorts ascending before returning — so the result is always the newest `limit` messages in chronological order. A conversation absent or owned by another user returns the typed `not_found` code before any message query runs. (proves AC-7, AC-8, EC-4, EC-5)
- BR-6 Every function returns a typed discriminated-union result (`{ok:true,data}|{ok:false,code}`) — the service NEVER throws a raw/unexpected error to its caller. A genuinely unexpected DB error is caught, logged internally (structured, no message/stack content that could carry PII), and surfaced as the generic typed `internal_error` code. (proves every AC's error path)

## Edge cases
- EC-1 IF a user already has `MAX_CONVERSATIONS_PER_USER` (20) conversations and creates a new one THEN the least-recently-updated one is hard-deleted (with its messages, FK cascade) inside the SAME transaction as the create, so the cap is never exceeded (BR-1)
- EC-2 IF two `appendTurn` calls for the SAME conversation race for the same next `seq` THEN the unique constraint (`@@unique([conversationId, seq])`) fails one of them with `P2002`, and the store returns a typed `concurrent_write` rejection (no partial write — the whole transaction rolls back) instead of crashing (BR-4)
- EC-3 IF a conversation is already at `MAX_MESSAGES_PER_CONVERSATION` (200) THEN `appendTurn` rejects with the typed `conversation_full` code and writes nothing (BR-3)
- EC-4 IF `conversationId` does not exist or belongs to a different `userId` THEN `appendTurn`/`loadWindow` return the typed `not_found` code — ownership is enforced structurally by the query's `where` clause, never leaking existence (BR-2)
- EC-5 IF a conversation has fewer than 10 messages THEN `loadWindow` returns all of them, oldest-first (BR-5)
- EC-6 IF `blocks` serialize to more than 16KB THEN the message still commits with `contentText` intact but `blocks` stored as `null`, and a structured warn log is emitted (no PII/content in the log line) (BR-4)
- EC-7 IF `userText` or `assistantText` exceeds `MAX_CONTENT_TEXT_LENGTH` (4000) THEN it is truncated to that length before writing — the turn still commits (defense-in-depth; the primary boundary is the caller's upstream zod schema) (BR-4)

## Data
- New enum `ChatRole { USER, ASSISTANT }`.
- New model `ChatConversation`: `id` (uuid) · `userId` (FK → `User`, `onDelete: Cascade`) · `createdAt` · `updatedAt` (bumped on every appended turn — drives the least-recently-updated eviction). Indexes: `(userId, updatedAt)` · `(updatedAt)`.
- New model `ChatMessage`: `id` (uuid) · `conversationId` (FK → `ChatConversation`, `onDelete: Cascade`) · `role` (`ChatRole`) · `seq` (Int, monotonic per conversation) · `contentText` (`@db.Text`, sanitized display text only — never a raw tool/model error or the system prompt) · `blocks` (`Json?`, the rendered UI blocks the camper saw, or `null`) · `createdAt`. Constraints: `@@unique([conversationId, seq])` · index `(conversationId, seq)`.
- `User` gains the `chatConversations ChatConversation[]` relation (no other change to `User`).
- **HARD DELETE** (no `deletedAt` on either model) — an intentional divergence from this schema's usual soft-delete convention: ADR-013 favors real deletion for conversational personal data (PDPA). A 180-day retention cron is a deferred follow-up, NOT part of this migration.
- Migration: additive only (new enum + 2 new tables + 1 new FK column on the `User` side via the relation — no existing column altered, renamed, or dropped). Reversible — proven up→down→up against the local dev DB (see Self-verify).

## Seams & refs
- Reuse: `lib/prisma.ts` (the shared Prisma singleton) — no new client, no parallel connection pool.
- Naming collision (flag for CAM-415/416): `@prisma/client` generates a type named `ChatMessage` for the new model, which collides by identifier with the EXISTING per-request zod type `ChatMessage` in `lib/validations/ai-chat.ts` (the posted `{role, content}` turn array, CAM-271). Neither this story's store service nor its tests need both types in the same file, so no alias was needed here — but the route/message-role story that imports both MUST alias one (e.g. `import type { ChatMessage as ChatMessageRow } from '@prisma/client'`). Documented in the store service's file header too.
- Refs: ADR-013 (persistent chat history, in progress CAM-413) · `.claude/rules/architecture.md` §13 (crystallization — N/A here, no transactional-document snapshot) · `.claude/rules/security.md` §OWASP-1 (ownership scoping) + §AI/agent-layer (never persist tool traces / raw errors / system prompt).
- Reader/writer inventory (architecture.md 15b): this story INTRODUCES the two tables — there are no pre-existing readers/writers to inventory. The only writer is this store service; the only readers will be the later route/UI stories (CAM-415/416/…), which MUST go through this service, never a direct Prisma query against `ChatConversation`/`ChatMessage` (sharp boundary, architecture.md §2).

## Out of scope
- Wiring `appendTurn`/`loadWindow` into the live chat route + serializing the loaded window into the model's conversation context → CAM-415 (message roles) / CAM-416 (route v2).
- Conversation list / view / delete endpoints → a later story (plan's S7).
- The 180-day retention cron (hard-delete of old conversations) → a follow-up ticket, not this story.
- UI resume (login → see prior chat) + new-conversation button → a later story (plan's S9).
- Making the `MAX_MESSAGES_PER_CONVERSATION` check race-proof under true concurrent writers on the SAME conversation beyond the `P2002` seq backstop — two turns on one conversation racing exactly at the 199/200 boundary is not a realistic single-user-single-tab scenario this story optimizes for; the seq unique constraint still guarantees no corrupted/duplicate row is ever written (EC-2 covers the real race).

## Self-verify
- AC-1, AC-2 → unit (`createConversation`: under-cap creates with no delete; at-cap evicts the oldest by `updatedAt asc` then creates, both mocked inside one `$transaction`)
- AC-3 → unit (`appendTurn`: exactly 2 `chatMessage.create` calls with the correct `seq`/`role`, plus one `chatConversation.update` bumping `updatedAt`, all inside one transaction)
- AC-4 → unit (`appendTurn` at the message cap → `conversation_full`, zero `create`/`update` calls)
- AC-5 → unit (oversized `userText`/`assistantText` → stored `contentText` truncated to exactly 4000 chars, turn still commits)
- AC-6 → unit (`appendTurn` against a missing/other-user conversation → `not_found`, zero `create` calls)
- AC-7 → unit (`loadWindow` with 12 seeded messages, limit 3 → returns the newest 3 in ascending `seq` order)
- AC-8 → unit (`loadWindow` against a missing/other-user conversation → `not_found`, `chatMessage.findMany` never called)
- Story-specific: EC-2 (a `P2002` thrown from `$transaction` → `concurrent_write`, not an unhandled throw) · EC-6 (oversized `blocks` → stored `undefined`/NULL + a `console.warn` with `chat_blocks_oversize`, turn still commits) · BR-6 (any other unexpected error on `createConversation`/`appendTurn`/`loadWindow` → `internal_error`, never a raw throw) · migration up→down→up proven against the local dev DB (recorded below).
- Gate = /quality-gate · Done = merge to `dev` + AC verified on localhost (dev DB, all via `npx vitest run` — this story has no UI/route surface to click through).

### Migration self-verify (recorded, local dev DB)
1. `npx prisma migrate dev --name cam414_chat_persistence` → applied `20260718173946_cam414_chat_persistence` (2 tables, 1 enum, 2 FKs, 4 indexes — see the migration.sql diff).
2. **Down**: ran the manual inverse SQL (drop both FKs → drop `ChatMessage` → drop `ChatConversation` → drop `ChatRole`) directly against the local dev DB; confirmed via `to_regclass` that both tables were gone.
3. **Up again**: re-ran the same migration.sql's forward statements; confirmed via `prisma.chatConversation.count()` / `prisma.chatMessage.count()` (both `0`, no error) that the schema is back in the exact end-state, and `prisma migrate status` still reports "up to date" (migration history untouched by the manual round-trip).
- No existing table, column, or migration was altered — purely additive.

## Changelog
- v1 (2026-07-19) — created (spec-first, template v2). Foundation slice of the ADR-013 persistent-chat-history plan (S2 in the 10-story sequence); no UI, no route wiring — those land in CAM-415/416 and later.
