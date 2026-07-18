/**
 * GET/DELETE /api/ai/conversations/[id] — CAM-421 (ADR-013 S7, D2).
 *
 * GET: the full ordered message history (contentText + blocks, ascending
 * seq) for one conversation the session user owns — for reopening a past
 * conversation.
 * DELETE: HARD-deletes the conversation (+ cascaded messages, ADR-013 D2 —
 * an intentional no-soft-delete divergence for conversational personal
 * data). Per-user rate-limited (a mutation still gets a floor guard even
 * though it costs no model spend — security.md §4/Rate limit).
 *
 * Auth:   requireAuth() → 401 if no session.
 * Authz:  ownership enforced INSIDE the store's WHERE (`id, userId`) for
 *         BOTH verbs — a missing conversation and one owned by another user
 *         are indistinguishable, both 404 (no 403/404 split; getOwnedBooking
 *         precedent, `lib/bookings.ts` / `app/api/bookings/[id]/route.ts`).
 * Input:  the `[id]` path param is zod-validated as a UUID BEFORE any query
 *         (`lib/validations/ai-conversation.ts`).
 *
 * Error-code set: 400 (id not a UUID) · 401 (unauthenticated) ·
 * 404 (not found / not owner) · 429 (DELETE rate limit) ·
 * 500 (internal, generic message).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { conversationIdParamSchema } from '@/lib/validations/ai-conversation';
import {
  getConversationWithMessages,
  deleteConversation,
} from '@/lib/ai/conversation-store';

/** DELETE per-user floor guard — modest, not a spend cap (deletes cost no model call). */
const DELETE_RATE_LIMIT = 30;
const DELETE_RATE_WINDOW_MS = 15 * 60 * 1000;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  const { id } = await context.params;
  const parsedParams = conversationIdParamSchema.safeParse({ id });
  if (!parsedParams.success) {
    return apiError('Invalid conversation id', 400);
  }

  const result = await getConversationWithMessages(parsedParams.data.id, session!.user!.id);
  if (!result.ok) {
    if (result.code === 'not_found') {
      return apiError('Conversation not found', 404);
    }
    return apiError('Failed to load conversation', 500);
  }

  return apiSuccess(result.data);
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;
  const userId = session!.user!.id;

  // Per-user rate limit — runs before body/param work, mirrors the repo's
  // other per-user write guards (app/api/bookings/route.ts booking:create).
  const rl = checkRateLimit(`ai-convo:del:${userId}`, {
    limit: DELETE_RATE_LIMIT,
    windowMs: DELETE_RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  const { id } = await context.params;
  const parsedParams = conversationIdParamSchema.safeParse({ id });
  if (!parsedParams.success) {
    return apiError('Invalid conversation id', 400);
  }

  const result = await deleteConversation(parsedParams.data.id, userId);
  if (!result.ok) {
    if (result.code === 'not_found') {
      return apiError('Conversation not found', 404);
    }
    return apiError('Failed to delete conversation', 500);
  }

  return apiSuccess({ id: result.data.id });
}
