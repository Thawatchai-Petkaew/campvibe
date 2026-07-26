import { Prisma } from '@prisma/client';
import type { CampAvailabilityStatus } from '@/lib/campsite-availability';

/**
 * Prisma select for the catalog card listing (PERF-5 / CAM-193).
 *
 * Includes ONLY what CampgroundCard renders:
 *   - scalar card fields (id, name/slug, priceLow, createdAt)
 *   - avgRating: Decimal(2,1)? column (maintained by AGG-1 / CAM-189)
 *   - reviewCount: Int column (maintained by AGG-1 / CAM-189)
 *   - location: only province (the string the card renders — CampgroundCard.tsx:184)
 *   - images: first 5 by sortOrder (carousel shows ≤5 dots — CampgroundCard.tsx:150)
 *
 * Explicitly dropped (over-fetch culprits):
 *   - reviews      (AGG-1 / CAM-189 writes avgRating/reviewCount columns; no raw reviews needed)
 *   - spots        (availability sub-tree — not rendered on the card)
 *   - options      (full MasterData taxonomy — not rendered on the card)
 *   - operator     (full User record — name used in WHERE only, not SELECT)
 *   - _count       (not needed; reviewCount comes from the stored column)
 *   - full location (only province is read; district/subDistrict/lat/lon etc. not rendered)
 *   - all images   (unbounded — capped at take:5)
 *   - priceHigh, isVerified, isPublished, latitude, longitude
 *     (in old CampSiteCardData interface but not rendered by CampgroundCard)
 */
export const campCardSelect = {
  id: true,
  nameTh: true,
  nameEn: true,
  nameThSlug: true,
  nameEnSlug: true,
  priceLow: true,
  createdAt: true,
  avgRating: true,   // PERF-5: Decimal(2,1)? column maintained by AGG-1
  reviewCount: true, // PERF-5: Int column maintained by AGG-1
  location: {
    select: {
      province: true,
    },
  },
  images: {
    select: {
      url: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: 'asc' as const },
    take: 5,
  },
} satisfies Prisma.CampSiteSelect;

/** Inferred TypeScript type — consumers derive their type from this, never re-declare. */
export type CampCardPayload = Prisma.CampSiteGetPayload<{
  select: typeof campCardSelect;
}>;

/**
 * Serialised card shape passed from a server component to a client island
 * (PERF-5 / CAM-193). Moved here from components/CampgroundGrid.tsx (CAM-527
 * dead-code sweep — CampgroundGrid.tsx itself had no importer; this type did).
 *
 * Derived from CampCardPayload: avgRating/reviewCount come directly from the stored
 * columns (AGG-1 / CAM-189 maintains them). priceLow + avgRating are serialised to
 * number by serializeDecimals (were Decimal). createdAt is serialised to ISO string.
 */
export type CampSiteCardData = Omit<CampCardPayload, 'priceLow' | 'createdAt' | 'avgRating'> & {
  priceLow: number | null;   // Decimal serialised to number
  createdAt: string;          // Date serialised to ISO string
  /** PERF-5: stored average rating column (1dp) or null when no reviews. */
  avgRating: number | null;
  /** PERF-5: stored review count column. */
  reviewCount: number;
  /**
   * CAM-344: computed, non-persisted per-camp availability status for the
   * SELECTED dated search range. Attached ONLY when both check-in and
   * check-out dates are present in the search (BR-7); absent = fully
   * available / no date context (undated search, wishlist, similar-camps
   * reuse of this card) — the card renders no badge (CAM-342 field
   * enumeration: this field does NOT ride through campCardSelect
   * automatically, it is attached explicitly on both result surfaces).
   */
  availabilityStatus?: CampAvailabilityStatus;
};
