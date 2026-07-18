/**
 * lib/ai/conversation-store.ts — CAM-414 (ADR-013 foundation slice).
 *
 * The ONE service layer for persistent AI chat history (logged-in users
 * only). Owns every read/write of `ChatConversation` / `ChatMessage`
 * (architecture.md §4 sharp boundary) so no caller ever queries these
 * tables directly. Every function is ownership-scoped to the passed
 * `userId` (never trusts a bare id — security.md OWASP-1) and NEVER throws
 * a raw/unexpected error to its caller: every outcome is a typed
 * discriminated-union result (api.md §11), so a later route/tool layer can
 * map each `code` to a safe HTTP response without guessing.
 *
 * Naming note (Seams & refs, story.md): `@prisma/client` generates a type
 * named `ChatMessage` for the model below, which COLLIDES by name with the
 * existing per-request zod type `ChatMessage` in
 * `lib/validations/ai-chat.ts` (the posted `{role, content}` turn array,
 * CAM-271). Any future file that imports BOTH must alias one, e.g.
 * `import type { ChatMessage as ChatMessageRow } from '@prisma/client'`.
 * This file only needs the Prisma model type, so no alias is required here.
 *
 * AC → code map (docs/specs/.../CAM-414-.../story.md):
 *   AC-1/AC-2, EC-1 → createConversation (cap + least-recently-updated evict)
 *   AC-3..AC-6, EC-2/EC-3/EC-4/EC-6/EC-7 → appendTurn (one transaction)
 *   AC-7/AC-8, EC-4/EC-5 → loadWindow (ownership-scoped, newest-N-in-order)
 *
 * CAM-421 (ADR-013 S7 — conversation list/view/delete endpoints) extends this
 * file with three more ownership-scoped, typed-result functions so the new
 * routes never query ChatConversation/ChatMessage directly:
 *   AC-1 → listConversations (newest-updated-first + a display-only derived
 *          title — computed at read time, NEVER stored, per architecture.md
 *          §14 "no UI-shaped columns")
 *   AC-2 → getConversationWithMessages (ownership + full ordered history in
 *          ONE query — no separate ownership-check-then-fetch round trip)
 *   AC-3 → deleteConversation (HARD delete per ADR-013 D2; ownership enforced
 *          INSIDE deleteMany's WHERE — atomic, no check-then-act race)
 *
 * CAM-422 (ADR-013 S8 — retention cron) extends this file with the system
 * (non-user-scoped) purge function the daily cron route calls:
 *   AC-purge → purgeExpiredConversations (D2: hard-deletes ChatConversation
 *          rows idle ≥180 days, PLUS any conversation whose owning User has
 *          been soft-deleted — `onDelete: Cascade` only fires on a REAL row
 *          delete, and `User` uses the house `deletedAt` soft-delete
 *          convention, so a soft-deleted user's chat history is otherwise
 *          never swept). Single `deleteMany` — no N+1, no per-row loop.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Caps (BR-1, BR-3, BR-4) — every cap lives here, never re-derived elsewhere.
// ---------------------------------------------------------------------------

/** BR-1 — a user's conversation count never exceeds this (evict oldest). */
export const MAX_CONVERSATIONS_PER_USER = 20;
/** BR-3 — a conversation's message count never exceeds this (reject the turn). */
export const MAX_MESSAGES_PER_CONVERSATION = 200;
/** BR-4 — defense-in-depth truncation; the primary boundary is the caller's zod schema. */
export const MAX_CONTENT_TEXT_LENGTH = 4000;
/** BR-4 — `blocks` larger than this (serialized) is dropped, never the whole turn. */
export const MAX_BLOCKS_BYTES = 16 * 1024;
/** BR-5 default window size for `loadWindow`. */
export const DEFAULT_WINDOW_SIZE = 10;
/** CAM-422 (ADR-013 D2) — a conversation idle this many days or longer is purged by the retention cron. */
export const RETENTION_DAYS = 180;

// ---------------------------------------------------------------------------
// Result shape — BR-6: every function returns this, never throws raw.
// ---------------------------------------------------------------------------

export type ConversationStoreErrorCode =
  | 'not_found' // BR-2: missing OR owned by a different user — never distinguished (no existence leak)
  | 'conversation_full' // BR-3: at MAX_MESSAGES_PER_CONVERSATION
  | 'concurrent_write' // BR-4: seq unique-constraint race (P2002 backstop)
  | 'internal_error'; // BR-6: any other unexpected error, logged, never leaked

export type ConversationStoreResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ConversationStoreErrorCode };

// ---------------------------------------------------------------------------
// createConversation — AC-1, AC-2, EC-1 (BR-1)
// ---------------------------------------------------------------------------

export interface CreatedConversation {
  id: string;
}

/**
 * Creates a new conversation for `userId`. When the user is already at
 * MAX_CONVERSATIONS_PER_USER, the single least-recently-updated conversation
 * (`orderBy updatedAt asc`) is hard-deleted (cascading its messages via the
 * FK, ADR-013 divergence — no `deletedAt`) in the SAME transaction as the
 * new row, so the cap is never exceeded even under a burst of creates.
 */
export async function createConversation(
  userId: string
): Promise<ConversationStoreResult<CreatedConversation>> {
  try {
    const created = await prisma.$transaction(async (tx) => {
      const count = await tx.chatConversation.count({ where: { userId } });
      if (count >= MAX_CONVERSATIONS_PER_USER) {
        const oldest = await tx.chatConversation.findFirst({
          where: { userId },
          orderBy: { updatedAt: 'asc' },
          select: { id: true },
        });
        if (oldest) {
          await tx.chatConversation.delete({ where: { id: oldest.id } });
        }
      }
      return tx.chatConversation.create({
        data: { userId },
        select: { id: true },
      });
    });
    return { ok: true, data: created };
  } catch (error) {
    return handleUnexpectedError(error, 'createConversation');
  }
}

// ---------------------------------------------------------------------------
// appendTurn — AC-3, AC-4, AC-5, AC-6, EC-2, EC-3, EC-4, EC-6, EC-7 (BR-2..BR-4)
// ---------------------------------------------------------------------------

export interface AppendTurnInput {
  userText: string;
  assistantText: string;
  /** The rendered UI blocks (cards/chips) the camper saw for this turn, if any. */
  blocks?: unknown;
}

export interface AppendedTurn {
  userMessageId: string;
  assistantMessageId: string;
}

/**
 * Appends one turn (a USER message + the paired ASSISTANT message) to
 * `conversationId`, scoped to `userId` (BR-2 — a mismatched/missing
 * conversation returns `not_found`, never a separate "forbidden" leak).
 * Both inserts + the conversation's `updatedAt` bump run inside ONE
 * `prisma.$transaction` — all-or-nothing (BR-4).
 */
export async function appendTurn(
  conversationId: string,
  userId: string,
  input: AppendTurnInput
): Promise<ConversationStoreResult<AppendedTurn>> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const conversation = await tx.chatConversation.findFirst({
        where: { id: conversationId, userId },
        select: { id: true },
      });
      if (!conversation) {
        return { ok: false, code: 'not_found' } as const;
      }

      const messageCount = await tx.chatMessage.count({
        where: { conversationId },
      });
      if (messageCount >= MAX_MESSAGES_PER_CONVERSATION) {
        return { ok: false, code: 'conversation_full' } as const;
      }

      const last = await tx.chatMessage.findFirst({
        where: { conversationId },
        orderBy: { seq: 'desc' },
        select: { seq: true },
      });
      const nextSeq = (last?.seq ?? 0) + 1;

      const userMessage = await tx.chatMessage.create({
        data: {
          conversationId,
          role: 'USER',
          seq: nextSeq,
          contentText: truncateContentText(input.userText),
        },
        select: { id: true },
      });

      const assistantMessage = await tx.chatMessage.create({
        data: {
          conversationId,
          role: 'ASSISTANT',
          seq: nextSeq + 1,
          contentText: truncateContentText(input.assistantText),
          blocks: normalizeBlocks(input.blocks, conversationId),
        },
        select: { id: true },
      });

      await tx.chatConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return {
        ok: true,
        data: {
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
        },
      } as const;
    });

    return result;
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return { ok: false, code: 'concurrent_write' };
    }
    return handleUnexpectedError(error, 'appendTurn');
  }
}

// ---------------------------------------------------------------------------
// loadWindow — AC-7, AC-8, EC-4, EC-5 (BR-2, BR-5)
// ---------------------------------------------------------------------------

export interface ConversationMessageView {
  id: string;
  role: 'USER' | 'ASSISTANT';
  seq: number;
  contentText: string;
  blocks: unknown;
  createdAt: Date;
}

/**
 * Loads the newest `limit` messages of `conversationId`, scoped to
 * `userId` (BR-2), returned in ascending (chronological) order.
 */
export async function loadWindow(
  conversationId: string,
  userId: string,
  limit: number = DEFAULT_WINDOW_SIZE
): Promise<ConversationStoreResult<ConversationMessageView[]>> {
  try {
    const conversation = await prisma.chatConversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });
    if (!conversation) {
      return { ok: false, code: 'not_found' };
    }

    const newestFirst = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { seq: 'desc' },
      take: limit,
      select: {
        id: true,
        role: true,
        seq: true,
        contentText: true,
        blocks: true,
        createdAt: true,
      },
    });

    return { ok: true, data: newestFirst.reverse() };
  } catch (error) {
    return handleUnexpectedError(error, 'loadWindow');
  }
}

// ---------------------------------------------------------------------------
// listConversations — CAM-421 AC-1
// ---------------------------------------------------------------------------

/** CAM-421 BR-1 — a derived title is truncated to this many characters. */
export const TITLE_MAX_LENGTH = 60;

export interface ConversationListItem {
  id: string;
  /** Display-only, derived from the first USER message at read time — never stored (architecture.md §14). */
  title: string | null;
  messageCount: number;
  updatedAt: Date;
}

/**
 * Lists `userId`'s own conversations, newest-`updatedAt`-first. Each item
 * carries a display-only `title` (the conversation's first USER message,
 * truncated to `TITLE_MAX_LENGTH`) and a `messageCount` — both computed in
 * the SAME query (nested `messages` select + `_count`), never a per-row
 * follow-up query (performance.md — no N+1). Bounded by the existing
 * `MAX_CONVERSATIONS_PER_USER` cap (BR-1 above), so no pagination is needed
 * at this size.
 */
export async function listConversations(
  userId: string
): Promise<ConversationStoreResult<ConversationListItem[]>> {
  try {
    const rows = await prisma.chatConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        updatedAt: true,
        messages: {
          where: { role: 'USER' },
          orderBy: { seq: 'asc' },
          take: 1,
          select: { contentText: true },
        },
        _count: { select: { messages: true } },
      },
    });

    return {
      ok: true,
      data: rows.map((row) => ({
        id: row.id,
        title: deriveTitle(row.messages[0]?.contentText),
        messageCount: row._count.messages,
        updatedAt: row.updatedAt,
      })),
    };
  } catch (error) {
    return handleUnexpectedError(error, 'listConversations');
  }
}

// ---------------------------------------------------------------------------
// getConversationWithMessages — CAM-421 AC-2
// ---------------------------------------------------------------------------

export interface ConversationDetail {
  id: string;
  updatedAt: Date;
  messages: ConversationMessageView[];
}

/**
 * Loads `conversationId`'s full ordered message history (ascending `seq`),
 * scoped to `userId` (BR-2 precedent — a missing/other-user conversation
 * returns `not_found`, never a separate "forbidden" leak). Ownership check
 * and the message fetch run as ONE query (nested `messages` select), not two.
 */
export async function getConversationWithMessages(
  conversationId: string,
  userId: string
): Promise<ConversationStoreResult<ConversationDetail>> {
  try {
    const conversation = await prisma.chatConversation.findFirst({
      where: { id: conversationId, userId },
      select: {
        id: true,
        updatedAt: true,
        messages: {
          orderBy: { seq: 'asc' },
          select: {
            id: true,
            role: true,
            seq: true,
            contentText: true,
            blocks: true,
            createdAt: true,
          },
        },
      },
    });
    if (!conversation) {
      return { ok: false, code: 'not_found' };
    }
    return { ok: true, data: conversation };
  } catch (error) {
    return handleUnexpectedError(error, 'getConversationWithMessages');
  }
}

// ---------------------------------------------------------------------------
// deleteConversation — CAM-421 AC-3
// ---------------------------------------------------------------------------

export interface DeletedConversation {
  id: string;
}

/**
 * HARD-deletes `conversationId` (ADR-013 D2 divergence — no `deletedAt` on
 * this model; PDPA favors real erasure for conversational personal data).
 * Ownership is enforced INSIDE `deleteMany`'s WHERE (`id, userId`) so the
 * check-and-delete is ONE atomic statement, not a separate ownership read
 * followed by a delete (no TOCTOU gap). `count === 0` covers BOTH a missing
 * id and one owned by another user — the same `not_found` code, no
 * existence leak (BR-2 precedent). Messages cascade via the FK
 * (`onDelete: Cascade` on `ChatMessage.conversation`).
 */
export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<ConversationStoreResult<DeletedConversation>> {
  try {
    const { count } = await prisma.chatConversation.deleteMany({
      where: { id: conversationId, userId },
    });
    if (count === 0) {
      return { ok: false, code: 'not_found' };
    }
    return { ok: true, data: { id: conversationId } };
  } catch (error) {
    return handleUnexpectedError(error, 'deleteConversation');
  }
}

// ---------------------------------------------------------------------------
// purgeExpiredConversations — CAM-422 (ADR-013 S8, D2 retention)
// ---------------------------------------------------------------------------

export interface PurgeResult {
  purgedCount: number;
}

/**
 * System-level retention sweep — NOT ownership-scoped to one user; this is
 * the one function in this file that intentionally has no `userId` (it is
 * only ever called by the secret-guarded cron route, never by a user
 * request). HARD-deletes (D2 — no `deletedAt` flag) every `ChatConversation`
 * matching EITHER:
 *   1. idle ≥ `RETENTION_DAYS` (`updatedAt < now - 180d`), or
 *   2. owned by a `User` whose `deletedAt` is set (soft-deleted) — the FK's
 *      `onDelete: Cascade` only fires on a real row delete, and `User` never
 *      gets one (house soft-delete convention), so this sweep is the only
 *      path that ever removes a soft-deleted user's chat history.
 *
 * Both conditions run as ONE `deleteMany` (an `OR`, cascading to `ChatMessage`
 * via the existing FK) — no per-row loop (performance.md — no N+1). Returns
 * the purged CONVERSATION count only (never content) — the D2/retention
 * Confirmation ("first run proves it deleted ≥1 row, never a silent skip")
 * and observability.md field hygiene (no secret/PII in the log line).
 *
 * `now` is an injectable clock (mirrors `lib/rate-limit.ts`'s `now` option)
 * so the 180-day boundary is tested deterministically, never against the
 * real wall clock.
 */
export async function purgeExpiredConversations(
  options: { now?: () => number } = {}
): Promise<ConversationStoreResult<PurgeResult>> {
  const now = options.now ?? Date.now;
  try {
    const cutoff = new Date(now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const { count } = await prisma.chatConversation.deleteMany({
      where: {
        OR: [{ updatedAt: { lt: cutoff } }, { user: { deletedAt: { not: null } } }],
      },
    });

    // Loud, count-only line — never a silent skip (ADR-013 D2 Confirmation).
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'chat_retention_purge',
        purgedCount: count,
        cutoffDate: cutoff.toISOString(),
      })
    );

    return { ok: true, data: { purgedCount: count } };
  } catch (error) {
    return handleUnexpectedError(error, 'purgeExpiredConversations');
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * CAM-421 — derives a display-only conversation title from the first USER
 * message's `contentText`, truncated to `TITLE_MAX_LENGTH`. Returns `null`
 * when the conversation has no USER message yet (a just-created, still-empty
 * conversation) — the route/UI decides the empty-title fallback copy, this
 * function never invents placeholder text.
 */
function deriveTitle(firstUserText: string | undefined): string | null {
  if (!firstUserText) return null;
  return firstUserText.length > TITLE_MAX_LENGTH
    ? `${firstUserText.slice(0, TITLE_MAX_LENGTH)}…`
    : firstUserText;
}

/** BR-4 — defense-in-depth cap; never throws, silently truncates. */
function truncateContentText(text: string): string {
  return text.length > MAX_CONTENT_TEXT_LENGTH
    ? text.slice(0, MAX_CONTENT_TEXT_LENGTH)
    : text;
}

/**
 * BR-4 / EC-6 — when the serialized `blocks` exceed MAX_BLOCKS_BYTES, drop
 * them (store `null`) and emit a structured warn log (no PII/content — only
 * the conversationId + byte length, per observability.md field hygiene).
 * `undefined` is passed straight through as "no blocks" (Prisma omits the
 * field on create, leaving the nullable column at its NULL default).
 */
function normalizeBlocks(
  blocks: unknown,
  conversationId: string
): Prisma.InputJsonValue | undefined {
  if (blocks === undefined || blocks === null) return undefined;

  const serialized = JSON.stringify(blocks);
  if (serialized.length > MAX_BLOCKS_BYTES) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'chat_blocks_oversize',
        conversationId,
        byteLength: serialized.length,
        maxBytes: MAX_BLOCKS_BYTES,
      })
    );
    return undefined;
  }
  return blocks as Prisma.InputJsonValue;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/**
 * BR-6 — the only path that ever sees an unexpected error. Logs internally
 * (structured, no message/stack content that could carry PII) and always
 * returns the generic `internal_error` code to the caller.
 */
function handleUnexpectedError(
  error: unknown,
  operation: string
): { ok: false; code: 'internal_error' } {
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'conversation_store_error',
      operation,
      errorType: error instanceof Error ? error.name : typeof error,
    })
  );
  return { ok: false, code: 'internal_error' };
}
