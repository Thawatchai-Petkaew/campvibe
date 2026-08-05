import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { notificationIdParamSchema } from '@/lib/validations/notification';
import type { NotificationMarkReadResponse } from '@/types/api';

// PATCH /api/notifications/[id]
// Marks ONE of the caller's own notifications as read.
//
// Auth:   requireAuth() → 401 if no session.
// Authz:  `updateMany` with `where: { id, userId, deletedAt: null }` —
//         ownership lives IN THE WHERE, not in an `if` after a fetch. Nothing
//         is mutated before the check: a wrong-owner or nonexistent id
//         matches zero rows and updates nothing.
// Existence leak: `result.count === 0` covers "not found", "belongs to
//         another user", AND "already soft-deleted" — all three collapse
//         into the SAME 404 (never 403), mirroring the no-403/404-split
//         precedent in lib/bookings.ts's getOwnedBooking (CAM-61 AC#7).
// Error-code set: 400 (invalid id) · 401 (unauthenticated) ·
//         404 (not found / not owner / soft-deleted) · 500 (internal)
export async function PATCH(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  const { id } = await context.params;
  const idValidation = notificationIdParamSchema.safeParse(id);
  if (!idValidation.success) {
    return apiError('Invalid notification id', 400);
  }

  try {
    const readAt = new Date();
    const result = await prisma.notification.updateMany({
      where: { id: idValidation.data, userId: session!.user!.id, deletedAt: null },
      data: { isRead: true, readAt },
    });

    // Same 404 for "doesn't exist" and "belongs to another user" — no
    // existence leak (no 403 anywhere in this handler).
    if (result.count === 0) {
      return apiError('Notification not found', 404);
    }

    const response: NotificationMarkReadResponse = {
      id: idValidation.data,
      isRead: true,
      readAt: readAt.toISOString(),
    };

    return apiSuccess(response);
  } catch (error) {
    return apiError('Failed to update notification', 500, error);
  }
}
