import { z } from 'zod';

/**
 * CAM-56 — BlockedDate write-boundary validation.
 *
 * Model ground truth: prisma/schema.prisma `BlockedDate` (added under the S7 seam;
 * CAM-267/CAM-190 already wired the READ path — see lib/campsite-availability.ts).
 * This schema validates the CREATE (POST) boundary for the write API this story adds.
 *
 * Rules (ticket `## Rules`):
 *  - reason: free text, optional, max 200 chars
 *  - startDate must be today or future (compared in Asia/Bangkok, UTC+7, no DST)
 *  - startDate must not be after endDate
 *  - a single block spans at most 90 days (inclusive of both endpoints)
 */

export const BLOCKED_DATE_REASON_MAX_LENGTH = 200;
export const BLOCKED_DATE_MAX_RANGE_DAYS = 90;

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7, Thailand observes no DST

/**
 * Today's calendar date in Asia/Bangkok, normalized to UTC midnight so it can be
 * compared directly against a `@db.Date` value (Prisma/JS represent a stored
 * calendar day as a UTC-midnight Date).
 */
export function getBangkokTodayDateOnly(now: Date = new Date()): Date {
  const bkk = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  return new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()));
}

const dateOnly = z.coerce.date();

export const createBlockedDateSchema = z
  .object({
    startDate: dateOnly,
    endDate: dateOnly,
    // null/undefined = whole-camp block; a string = single-spot block (mirrors
    // Booking's camp/spot duality — Spot.blockedDates relation).
    spotId: z.string().uuid().nullable().optional(),
    reason: z
      .string()
      .trim()
      .max(
        BLOCKED_DATE_REASON_MAX_LENGTH,
        `Reason cannot exceed ${BLOCKED_DATE_REASON_MAX_LENGTH} characters`
      )
      .optional()
      .nullable(),
  })
  .refine((data) => data.startDate.getTime() <= data.endDate.getTime(), {
    message: 'startDate must not be after endDate',
    path: ['endDate'],
  })
  .refine((data) => data.startDate.getTime() >= getBangkokTodayDateOnly().getTime(), {
    message: 'Cannot block a date in the past',
    path: ['startDate'],
  })
  .refine(
    (data) => {
      const days = Math.round((data.endDate.getTime() - data.startDate.getTime()) / 86_400_000) + 1;
      return days <= BLOCKED_DATE_MAX_RANGE_DAYS;
    },
    {
      message: `Cannot block more than ${BLOCKED_DATE_MAX_RANGE_DAYS} days per request`,
      path: ['endDate'],
    }
  );

export type CreateBlockedDateInput = z.infer<typeof createBlockedDateSchema>;
