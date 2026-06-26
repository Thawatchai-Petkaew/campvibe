import { Prisma } from '@prisma/client';

/**
 * Prisma select for the catalog card listing (PERF-1 / CAM-192).
 *
 * Includes ONLY what CampgroundCard renders:
 *   - scalar card fields (id, name/slug, priceLow, createdAt)
 *   - location: only province (the string the card renders — CampgroundCard.tsx:184)
 *   - images: first 5 by sortOrder (carousel shows ≤5 dots — CampgroundCard.tsx:150)
 *   - reviews: rating only, deletedAt:null (avgRating computed server-side; AGG-1 removes this later)
 *
 * Explicitly dropped (over-fetch culprits):
 *   - spots        (availability sub-tree — not rendered on the card)
 *   - options      (full MasterData taxonomy — not rendered on the card)
 *   - operator     (full User record — name used in WHERE only, not SELECT)
 *   - _count       (not needed; reviewCount derived from reviews.length)
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
  reviews: {
    where: { deletedAt: null },
    select: { rating: true },
  },
} satisfies Prisma.CampSiteSelect;

/** Inferred TypeScript type — consumers derive their type from this, never re-declare. */
export type CampCardPayload = Prisma.CampSiteGetPayload<{
  select: typeof campCardSelect;
}>;
