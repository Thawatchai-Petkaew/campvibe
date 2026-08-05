import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';
import type { NotificationDTO, NotificationMarkAllReadResponse } from '@/types/api';

// CAM-683 — supersedes CAM-73's stale contract (predates the shipped schema):
// CAM-73 named the field `href` and a `String` `type` with values like
// BOOKING_NEW; the shipped column is `link` (returned as-is, no alias) and
// `type` is the closed NotificationType enum (BOOKING/PAYMENT/REVIEW/SYSTEM/
// KYC) — this route never adds an enum value (irreversible ALTER TYPE, see
// .claude/rules/api.md #6).

// Bounded list — matches the BOOKING_LIST_LIMIT precedent
// (app/api/bookings/route.ts): newest-first `orderBy` means a cap drops the
// LEAST-relevant (oldest) rows, never the notifications the user hasn't seen
// yet (.claude/rules/performance.md — unbounded-fetch guidance).
const NOTIFICATION_LIST_LIMIT = 50;

// GET /api/notifications
// Returns the authenticated caller's own notifications only, newest first,
// capped at 50, excluding soft-deleted rows.
//
// Auth:   requireAuth() → 401 if no session.
// Authz:  scoped to session.user.id in the Prisma `where` (never a post-fetch
//         filter) — a caller can only ever see their own notifications.
// Error-code set: 401 (unauthenticated) · 500 (internal)
export async function GET() {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  try {
    const rows = await prisma.notification.findMany({
      where: { userId: session!.user!.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: NOTIFICATION_LIST_LIMIT,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        link: true,
        isRead: true,
        createdAt: true,
      },
    });

    const result: NotificationDTO[] = rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    }));

    return apiSuccess(result);
  } catch (error) {
    return apiError('Failed to fetch notifications', 500, error);
  }
}

// PATCH /api/notifications
// Marks all of the caller's unread notifications as read; returns the count
// of rows actually updated.
//
// Auth:   requireAuth() → 401 if no session.
// Authz:  `updateMany` scoped to session.user.id in the `where` — ownership
//         lives in the where clause, not a post-fetch check.
// Error-code set: 401 (unauthenticated) · 500 (internal)
export async function PATCH() {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  try {
    const result = await prisma.notification.updateMany({
      where: { userId: session!.user!.id, isRead: false, deletedAt: null },
      data: { isRead: true, readAt: new Date() },
    });

    return apiSuccess<NotificationMarkAllReadResponse>({ count: result.count });
  } catch (error) {
    return apiError('Failed to mark notifications as read', 500, error);
  }
}
