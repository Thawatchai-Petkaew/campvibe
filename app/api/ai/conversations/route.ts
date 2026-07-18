/**
 * GET /api/ai/conversations — CAM-421 (ADR-013 S7, D2).
 *
 * Lists the SESSION user's own persisted AI chat conversations, newest
 * `updatedAt`-first. Each item carries a display-only derived `title` (the
 * conversation's first USER message, truncated — `lib/ai/conversation-store`
 * `TITLE_MAX_LENGTH`) and a `messageCount`. Reuses CAM-414's store service
 * (`listConversations`) — this route never queries `ChatConversation` /
 * `ChatMessage` directly (architecture.md sharp boundary).
 *
 * Auth:   requireAuth() → 401 if no session.
 * Authz:  ownership is enforced INSIDE `listConversations`'s WHERE
 *         (`userId` bound to the session — never a client-supplied value;
 *         there is no id in this request to check ownership against).
 * Scope:  bounded by ADR-013's existing MAX_CONVERSATIONS_PER_USER (20) cap
 *         (evict-oldest on write) — no pagination needed at this size.
 *
 * Error-code set: 401 (unauthenticated) · 500 (internal, generic message).
 */
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { listConversations } from '@/lib/ai/conversation-store';

export async function GET(_request: NextRequest) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  const result = await listConversations(session!.user!.id);
  if (!result.ok) {
    // internal_error is the only failure code listConversations can return —
    // logged internally already (handleUnexpectedError); generic message only.
    return apiError('Failed to load conversations', 500);
  }

  return apiSuccess({ conversations: result.data });
}
