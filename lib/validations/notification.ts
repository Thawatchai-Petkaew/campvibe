import { z } from 'zod';

/**
 * CAM-683 — path-param validation for /api/notifications/[id].
 *
 * `Notification.id` is `String @id @default(uuid())` (prisma/schema.prisma:858).
 * Validated at the boundary before it ever reaches Prisma, per
 * `.claude/rules/api.md` #1 — a malformed id fails fast with 400 rather than
 * falling through to a Prisma query that would just find nothing (or, for a
 * non-uuid string, throw at the DB layer).
 */
export const notificationIdParamSchema = z.string().uuid();

export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>;
