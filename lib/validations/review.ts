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
 * Booking status values that count as a verified stay.
 * Sourced from schema.prisma Booking.status comment: PENDING | CONFIRMED | CANCELLED.
 * COMPLETED is not in the current schema — only CONFIRMED qualifies.
 */
export const VERIFIED_STAY_STATUSES = ['CONFIRMED'] as const;

/**
 * Pure, DB-free helper — determines whether a user is allowed to post a review.
 * Tested directly in unit tests without any DB or session dependency.
 */
export function canReview({ hasConfirmedBooking }: { hasConfirmedBooking: boolean }): boolean {
    return hasConfirmedBooking;
}

// ---------------------------------------------------------------------------
// Legacy export kept for any existing callers — deprecated, do not use for new code.
// authorId in the body is a security anti-pattern; use reviewBodySchema instead.
// ---------------------------------------------------------------------------
export const reviewSchema = reviewBodySchema;
export type ReviewInput = ReviewBody;
