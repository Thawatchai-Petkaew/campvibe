import { Prisma } from '@prisma/client';

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
