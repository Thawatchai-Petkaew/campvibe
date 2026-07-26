/**
 * Pure sort helpers — no I/O, no Prisma import.
 * Extracted so QA can unit-test without a DB fixture.
 *
 * CAM-527: sortByRating + its WithReviewRatings generic constraint were removed
 * here (dead code — no caller; the in-memory rating sort was replaced by a DB
 * `orderBy avgRating` in PERF-5/CAM-193, and app/wishlist/page.tsx — the only
 * other consumer of this module — only ever called computeAvgRating).
 */

/**
 * Compute AVG(Review.rating) per campsite.
 * Returns null when the campsite has no reviews.
 *
 * Source field: Review.rating (Int 1–5).
 * Soft-deleted reviews are already excluded by the Prisma query that feeds this function.
 */
export function computeAvgRating(reviews: { rating: number }[]): number | null {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return sum / reviews.length;
}
