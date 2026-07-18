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
// Internal helpers
// ---------------------------------------------------------------------------

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
