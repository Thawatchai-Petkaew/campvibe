import { z } from 'zod';

/**
 * Schema for the POST /api/reviews request body.
 * authorId is intentionally excluded — it is derived from the authenticated session only.
 */
export const reviewBodySchema = z.object({
    campSiteId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().min(1).max(120).optional(),
    // Reviews must carry meaningful text when provided — guards against empty/whitespace spam (security S-06).
    content: z.string().trim().min(10).optional(),
    visitDate: z.string().datetime({ offset: true }).optional(),
});

export type ReviewBody = z.infer<typeof reviewBodySchema>;

/**
 * Booking status values that count as a verified stay (CAM-269 PREP-3).
 * BookingStatus (schema.prisma) is PENDING | CONFIRMED | PAID | CANCELLED | COMPLETED.
 * Only COMPLETED qualifies — a CONFIRMED/PAID booking is a reservation, not yet a stay
 * that happened. The caller must ALSO check `checkInDate` has passed (see canReview
 * below and the query in app/api/reviews/route.ts) — a booking can be marked COMPLETED
 * ahead of the stay date by a host/admin mistake, so status alone is not sufficient.
 */
export const VERIFIED_STAY_STATUSES = ['COMPLETED'] as const;

/**
 * Pure, DB-free helper — determines whether a user is allowed to post a review.
 * Tested directly in unit tests without any DB or session dependency.
 *
 * This is the single seam for verified-stay eligibility. `hasQualifyingBooking` is
 * true when the caller found at least one Booking for this user+campSite with
 * status in VERIFIED_STAY_STATUSES AND checkInDate <= now (both conditions are the
 * DB query's job, not this function's — this function stays a pure decision).
 *
 * Future seam (ADR-012, pending — do not implement yet): a ManualStay / a
 * Booking(source=MANUAL) row could supply a second, independent signal. When that
 * lands, extend the destructured input (e.g. `hasManualStay`) and OR it in here —
 * every existing caller keeps working unchanged because the parameter is additive.
 */
export function canReview({ hasQualifyingBooking }: { hasQualifyingBooking: boolean }): boolean {
    return hasQualifyingBooking;
}

/**
 * Pure, DB-free helper — has the stay's check-in date already passed?
 * "ผ่านวันเข้าพัก" (Rules): a booking dated in the future must never qualify as a
 * verified stay even if its status is already COMPLETED (e.g. a host mistake).
 * `now` is injectable so tests never depend on the real clock.
 */
export function hasStayOccurred(checkInDate: Date, now: Date = new Date()): boolean {
    return checkInDate.getTime() <= now.getTime();
}

// ---------------------------------------------------------------------------
// Legacy export kept for any existing callers — deprecated, do not use for new code.
// authorId in the body is a security anti-pattern; use reviewBodySchema instead.
// ---------------------------------------------------------------------------
export const reviewSchema = reviewBodySchema;
export type ReviewInput = ReviewBody;
