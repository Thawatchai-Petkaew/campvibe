---
linear: CAM-422
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: backend-engineer
status: In Progress
version: v1
updated: 2026-07-19
---
# Retention cron + privacy copy (ADR-013 S8) (CAM-422)

Spec-lite class: no schema/migration (reuses CAM-414's `ChatConversation`/`ChatMessage` models
exactly as migrated) · no new/changed API contract on any EXISTING endpoint — one new system route
(`GET /api/cron/ai-chat-retention`), secret-guarded, no session/UI-facing contract · single
file-surface (`lib/ai/conversation-store.ts` + one new route + `lib/cron-auth.ts` + `vercel.json` +
locales). G1 folded into this PR's packet per ADR-013 (already ratified — "the 180-day figure" is
owner G2 tap #2, already accepted).

## Story
As **the platform** (a system cron job, no direct end-user-facing screen), I want a daily job that
hard-deletes AI chat conversations idle ≥180 days AND any conversation belonging to a soft-deleted
user, so that chat history does not outlive the retention window ADR-013 D2 committed to, and a
"deleted" user's chat history does not linger forever just because the house convention soft-deletes
`User` instead of hard-deleting it.
Why: `ChatConversation`'s `onDelete: Cascade` FK only fires on a REAL row delete of `User` — but
`User` uses the house `deletedAt` soft-delete convention, so the FK cascade never fires when an
account is "deleted." Without this sweep, a soft-deleted user's chat history (free-text PII, D2) is
retained indefinitely with no lawful basis — the exact posture D1/D2 designed against.
Scope: `purgeExpiredConversations()` in `lib/ai/conversation-store.ts` (one `deleteMany`, no N+1) +
`GET /api/cron/ai-chat-retention` (secret-guarded) + `lib/cron-auth.ts` + a `vercel.json` cron entry
(daily) + `aiChat.retentionNotice` copy (TH+EN) in `locales/translations.json`. No UI wiring of the
copy (that is a later resume-UI story, plan's S9) — this story ships the string only, ready to be
surfaced.
Depends on: CAM-414 (`ChatConversation`/`ChatMessage` models, already merged) · ADR-013 D2
(180-day hard-delete retention, ratified).

## AC
<!-- No UI at this layer: the "Then (user sees)" column is `—` on every row except the copy AC
(reason: this story ships a system cron + the copy string only; wiring the copy into a screen is
plan's S9). -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | conversations exist where `updatedAt` is older than 180 days (idle-based) | the cron route runs (or is called with the correct secret) | — (no UI; S9) | those `ChatConversation` rows (+ cascaded `ChatMessage` rows) are HARD-deleted; response is `200 { purgedCount }` | EC-1 |
| AC-2 | a conversation's owning `User` has `deletedAt` set (soft-deleted), regardless of the conversation's own `updatedAt` | the cron route runs | — (no UI; S9) | that conversation is ALSO hard-deleted in the SAME sweep (cascade alone misses it — the FK never fires on a soft-delete) | EC-2 |
| AC-3 | the request carries no `Authorization` header, or the wrong secret | `GET /api/cron/ai-chat-retention` | — (no UI; S9) | `401`; `purgeExpiredConversations` is never called | EC-3, EC-4 |
| AC-4 | `aiChat.retentionNotice` copy | (read, not a route) | `บทสนทนาของคุณจะถูกเก็บไว้ไม่เกิน 180 วัน แล้วจะถูกลบออกโดยอัตโนมัติ คุณสามารถลบบทสนทนาด้วยตัวเองได้ทุกเมื่อ` | key exists in both `en`/`th`, states the 180-day figure | — (reason: a copy-presence AC, no failure twin) |

## Rules
- BR-1 `purgeExpiredConversations({ now? })` computes `cutoff = now() - 180*24*60*60*1000` (`RETENTION_DAYS = 180`) and issues ONE `prisma.chatConversation.deleteMany({ where: { OR: [{ updatedAt: { lt: cutoff } }, { user: { deletedAt: { not: null } } }] } })` — a single query, no per-row loop (performance.md — no N+1). Messages cascade via the existing FK (`onDelete: Cascade`, CAM-414). (proves AC-1, AC-2)
- BR-2 `now` is an injectable clock (`() => number`, defaults to `Date.now`), mirroring `lib/rate-limit.ts`'s existing `now` option — the 180-day boundary is tested deterministically, never against the real wall clock. The comparator is strict `lt` (not `lte`): a conversation exactly 180 days idle to the millisecond is RETAINED; one millisecond older is purged. (proves EC-1)
- BR-3 The function returns the SAME typed discriminated-union result as CAM-414's other store functions (`{ok:true,data:{purgedCount}}|{ok:false,code:'internal_error'}`) — never throws a raw/unexpected error. (proves BR-6/error path)
- BR-4 On success, the function emits ONE structured log line — `{level:'info', event:'chat_retention_purge', purgedCount, cutoffDate}` — count and cutoff only, NEVER a conversation id/content/userId (observability.md field hygiene; ADR-013 D2 Confirmation "first run proves it deleted ≥1 row, never a silent skip"). (proves AC-1/AC-2's log hygiene)
- BR-5 `GET /api/cron/ai-chat-retention` calls `isCronRequestAuthorized(request)` (`lib/cron-auth.ts`) BEFORE calling the store — default-deny when `CRON_SECRET` is unset (never falls open, security.md OWASP-5), constant-time compared (`crypto.timingSafeEqual`) against the exact `Authorization: Bearer $CRON_SECRET` header Vercel Cron sends automatically once the env var is set on the project. (proves AC-3, EC-3, EC-4)
- BR-6 The route reads NO NextAuth session — it is a system job, not a user request; `purgeExpiredConversations` is deliberately the one store function with no `userId` scope (unlike every other function in `lib/ai/conversation-store.ts`).
- BR-7 `aiChat.retentionNotice` is added to BOTH `en` and `th` under the SAME key (structural EN/TH parity + no-em-dash-in-TH checks in `cam-272-ai-chat-i18n.test.ts` cover it automatically since they iterate every `aiChat.*` entry). (proves AC-4)

## Edge cases
- EC-1: IF nothing is eligible (no idle conversation, no soft-deleted owner) THEN `deleteMany` resolves `{count:0}` and the function returns `purgedCount: 0` — never an error (BR-1)
- EC-2: IF a conversation is recently updated (well inside 180 days) AND its owner is NOT soft-deleted THEN it is excluded by BOTH `OR` clauses and survives the sweep (BR-1)
- EC-3: IF `CRON_SECRET` is unset on the environment THEN the route returns `401` even when a well-formed `Authorization` header is present (default-deny — BR-5)
- EC-4: IF the `Authorization` header's secret is the wrong value (same or different byte length) THEN the route returns `401` before any store call (BR-5)
- EC-5: IF `purgeExpiredConversations` returns `{ok:false, code:'internal_error'}` THEN the route returns a generic `500` body (`{error:'internal_error'}`), never a Prisma stack/internal detail (api.md #5)

## Data
- No schema/migration. Reuses CAM-414's `ChatConversation` (`updatedAt`, indexed — `@@index([updatedAt])`) / `ChatMessage` models exactly as migrated, and `User.deletedAt` (existing soft-delete column, house convention).
- No new column anywhere; `purgeExpiredConversations` is a pure read+delete over existing Pixels.

## Seams & refs
- Reuse: `lib/ai/conversation-store.ts` (CAM-414/CAM-421) — this story ADDS `purgeExpiredConversations` to the SAME file, following its existing typed-result style (`ConversationStoreResult<T>`, `handleUnexpectedError`); no caller queries `ChatConversation`/`ChatMessage` directly (architecture.md sharp boundary). · `lib/rate-limit.ts`'s `{ now?: () => number }` injected-clock convention (mirrored exactly, not reinvented). · `lib/status-auth.ts`'s default-deny shape (mirrored in the NEW `lib/cron-auth.ts`, minus the local-dev bypass — a cron route has no human-in-browser use case to trade convenience for).
- Refs: ADR-013 (`docs/adr/ADR-013-ai-chat-persistence-agency-foundation.md`) D2 (hard-delete + 180-day retention, the Confirmation's "retention proof" clause) · `.claude/rules/security.md` OWASP-5 (never fall open on a missing secret) · `.claude/rules/performance.md` (single query, no N+1) · `.claude/rules/observability.md` (structured, count-only log line).
- Reader/writer inventory (architecture.md 15b): this story adds ONE new WRITER (`purgeExpiredConversations`, a hard-delete) to `ChatConversation`/`ChatMessage`, independent of the existing writers — `createConversation`/`appendTurn`'s own cap-eviction hard-deletes (CAM-414) and `deleteConversation`'s user-initiated hard-delete (CAM-421). All three writers are hard-deletes (ADR-013 D2 — no `deletedAt` column exists on this model), so there is no divergent semantics to reconcile; they simply fire on different triggers (cap overflow / user action / age-or-owner-deleted). Grep used: `chatConversation.(delete|deleteMany)` across `lib/`, `app/api/ai/`.
- New env var: `CRON_SECRET` (documented in `env.example` + `.claude/ENV-CONFIG.md`) — must be set on Vercel (staging + prod) before the cron promotes, or the daily invocation 401s silently (no purge, no crash — DevOps/owner must set it as part of the promote checklist).

## Out of scope
- The list/detail/delete UI, the retention-notice copy actually rendered on a screen → plan's S9 (a later CAM ticket).
- Changing `createConversation`/`appendTurn`/`loadWindow`/`listConversations`/`getConversationWithMessages`/`deleteConversation`'s existing behavior → not touched by this story (CAM-414/CAM-421, unchanged).
- A dedicated retention-audit table/event log beyond the structured log line → the Confirmation's bar is "loud, count-only proof it ran," not a persisted audit trail; revisit if compliance ever needs one.

## Self-verify
- AC-1/AC-2 → unit (`purgeExpiredConversations`: single `deleteMany` call, exact `where.OR` shape, injected-clock cutoff, log hygiene — `__tests__/cam-422-conversation-store-purge.test.ts`)
- AC-3 → unit (`isCronRequestAuthorized`: unset secret / missing header / wrong secret / mismatched length / correct secret — `__tests__/cam-422-cron-auth.test.ts`) + integration (`GET /api/cron/ai-chat-retention` 401/200/500 — `__tests__/cam-422-cron-retention-route.test.ts`)
- AC-4 → unit (`aiChat.retentionNotice` TH/EN verbatim + 180-day figure present — `__tests__/cam-422-retention-copy.test.ts`; structural EN/TH parity + no-em-dash already covered by the existing `cam-272-ai-chat-i18n.test.ts` iteration)
- EC-1..EC-5 → covered in the same three CAM-422 test files above
- Gate = `/quality-gate` · Done = merge to `dev` + AC verified on localhost (dev DB, all via `npx vitest run` + a manual `curl` against the local route with a real `CRON_SECRET` — this story has no UI/route surface to click through).

## Changelog
- v1 (2026-07-19) — created (spec-first, template v2). S8 of the ADR-013 10-story plan; ships the retention cron + the copy string only (no UI wiring, plan's S9).
