/**
 * review-summary.ts — Pure, testable helpers for CAM-79 review display.
 * No Prisma import; no side effects. QA can unit-test all exports directly.
 */

/** Client-safe DTO for a single review list item. authorId is intentionally excluded. */
export interface ReviewListItem {
    name: string;
    rating: number;
    content: string | null;
    createdAt: string | Date;
}

/** Summary shape passed from the server page to the client component. */
export interface ReviewSummary {
    hasReviews: boolean;
    avgRating: number | null;
    count: number;
}

/**
 * Round an average rating to 1 decimal place.
 * Returns null when avg is null or count is 0 (no reviews to display).
 */
export function roundAvgRating(avg: number | null): number | null {
    if (avg === null) return null;
    return Math.round(avg * 10) / 10;
}

/**
 * Build a ReviewSummary from raw aggregate values.
 * hasReviews is true only when count > 0.
 */
export function buildReviewSummary({
    avg,
    count,
}: {
    avg: number | null;
    count: number;
}): ReviewSummary {
    const hasReviews = count > 0;
    return {
        hasReviews,
        avgRating: hasReviews ? roundAvgRating(avg) : null,
        count,
    };
}

/**
 * Map a Prisma review row (with author relation) into a client-safe DTO.
 * Excludes authorId and author.id — never exposed to the client (security rule).
 */
export function toReviewListItem(review: {
    rating: number;
    content: string | null;
    createdAt: Date | string;
    author: { name: string | null } | null;
}): ReviewListItem {
    return {
        name: review.author?.name ?? 'ผู้ใช้งาน',
        rating: review.rating,
        content: review.content ?? null,
        createdAt: review.createdAt,
    };
}
