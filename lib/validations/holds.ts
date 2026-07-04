import { z } from 'zod';

/**
 * CAM-302 — InternalHold write-boundary validation (reduced M1 slice, ADR-012 §4).
 *
 * Model ground truth: prisma/schema.prisma `InternalHold` (this story). Validates
 * the CREATE (POST) boundary for app/api/campsites/[id]/holds/route.ts.
 *
 * Rules (ticket `## Rules`):
 *  - BR-1: default expiry = creation time + 48 hours when the host gives none.
 *    A host-set expiry must be in the future and at most 14 days from creation;
 *    outside that range the create is rejected with the ticket's exact Thai copy.
 *  - endDate is the EXCLUSIVE checkout day (identical to Booking/BlockedDate) —
 *    must be strictly after startDate (at least 1 night held).
 *  - spotId: null/undefined = whole-camp hold; a string = single-spot hold
 *    (mirrors Booking/BlockedDate's camp-or-spot duality). The IDOR guard that
 *    a given spotId actually belongs to the campsite is enforced in the route
 *    (BR-6), not here — this schema only validates shape.
 */

export const HOLD_DEFAULT_EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 hours (BR-1)
export const HOLD_MAX_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000; // 14 days (BR-1)

// BR-1's exact Thai copy — asserted verbatim by tests (qa.md #2).
export const HOLD_EXPIRY_OUT_OF_RANGE_MESSAGE =
  'กำหนดหมดอายุต้องอยู่ระหว่างตอนนี้ถึง 14 วันข้างหน้า';

const dateOnly = z.coerce.date();

export const createHoldSchema = z
  .object({
    spotId: z.string().uuid().nullable().optional(),
    startDate: dateOnly,
    endDate: dateOnly,
    guests: z.number().int().min(1).default(1),
    note: z.string().trim().optional().nullable(),
    // Optional — BR-1 default (creation time + 48h) is applied below when omitted.
    expiresAt: z.coerce.date().optional(),
  })
  .refine((data) => data.endDate.getTime() > data.startDate.getTime(), {
    message: 'endDate must be after startDate (endDate is the exclusive checkout day)',
    path: ['endDate'],
  })
  .transform((data) => ({
    ...data,
    expiresAt: data.expiresAt ?? new Date(Date.now() + HOLD_DEFAULT_EXPIRY_MS),
  }))
  .refine((data) => data.expiresAt.getTime() > Date.now(), {
    message: HOLD_EXPIRY_OUT_OF_RANGE_MESSAGE,
    path: ['expiresAt'],
  })
  .refine((data) => data.expiresAt.getTime() <= Date.now() + HOLD_MAX_EXPIRY_MS, {
    message: HOLD_EXPIRY_OUT_OF_RANGE_MESSAGE,
    path: ['expiresAt'],
  });

export type CreateHoldInput = z.infer<typeof createHoldSchema>;
