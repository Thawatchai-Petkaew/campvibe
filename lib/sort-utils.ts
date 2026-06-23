/**
 * Pure sort helpers — no I/O, no Prisma import.
 * Extracted so QA can unit-test without a DB fixture.
 */

export interface WithReviewRatings {
  reviews: { rating: number }[];
  [key: string]: unknown;
}

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

/**
 * Sort campsites by average review rating, descending.
 * Campsites with no reviews (avgRating = null) are placed last (NULLS LAST).
 * Tie-break is stable — original order is preserved among equal averages.
 * Result is capped at 40 entries, matching the take:40 cap of every other sort mode.
 *
 * SCALE GUARD: in-memory sort is valid for catalogs up to ~200 published campsites.
 * When the catalog exceeds that threshold, replace with a stored CampSite.avgRating
 * column updated by a background job (C-2.5).
 */
export function sortByRating<T extends WithReviewRatings>(campsites: T[]): T[] {
  return [...campsites]
    .sort((a, b) => {
      const avgA = computeAvgRating(a.reviews);
      const avgB = computeAvgRating(b.reviews);
      // NULLS LAST: null always goes after a real number
      if (avgA === null && avgB === null) return 0;
      if (avgA === null) return 1;
      if (avgB === null) return -1;
      return avgB - avgA; // descending
    })
    .slice(0, 40); // cap matches all other sort modes (Rules §4)
}
