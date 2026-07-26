import { Prisma } from '@prisma/client';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import type { CampAvailabilityStatus } from '@/lib/campsite-availability';

/**
 * Prisma select for the catalog card listing (PERF-5 / CAM-193).
 *
 * Includes ONLY what CampgroundCard renders:
 *   - scalar card fields (id, name/slug, priceLow, priceHigh, createdAt)
 *   - avgRating: Decimal(2,1)? column (maintained by AGG-1 / CAM-189)
 *   - reviewCount: Int column (maintained by AGG-1 / CAM-189)
 *   - location: province (English, unchanged) + district (CAM-545: wired
 *     through even though it is null for every row today — see the district
 *     note on `CampSiteCardData.location` below)
 *   - images: first 5 by sortOrder (carousel shows ≤5 dots — CampgroundCard.tsx:150)
 *
 * Explicitly dropped (over-fetch culprits):
 *   - reviews      (AGG-1 / CAM-189 writes avgRating/reviewCount columns; no raw reviews needed)
 *   - spots        (availability sub-tree — not rendered on the card)
 *   - options      (full MasterData taxonomy — not rendered on the card)
 *   - operator     (full User record — name used in WHERE only, not SELECT)
 *   - _count       (not needed; reviewCount comes from the stored column)
 *   - full location (only province + district are read; subDistrict/lat/lon
 *     etc. not rendered; `thaiLocationId` FK is NOT joined here — see below)
 *   - all images   (unbounded — capped at take:5)
 *   - isVerified, isPublished, latitude, longitude
 *     (in old CampSiteCardData interface but not rendered by CampgroundCard)
 *
 * CAM-545: `priceHigh` was dropped above as an over-fetch culprit but is now
 * rendered (the card shows an honest price range when the host set one —
 * see CampgroundCard.tsx's `buildCardPriceDisplay`).
 *
 * CAM-545 (rework, 2026-07-26): the Thai province name was NOT joined via
 * the `Location.thaiLocationId` FK here — that FK was populated for only 12
 * of 652 `Location` rows in the dev DB (measured), so a relation-based
 * select would have shown the Thai name for ~2% of camps. It was resolved
 * by NAME instead, via `getProvinceThaiNameMap()` + `withProvinceThaiNames()`
 * below, matching `Location.province` (English, stored) against
 * `ThailandLocation.provinceNameEn`.
 *
 * CAM-563 (investigated, deferred): `Location.adminAreaId` is now backfilled
 * for 650 of 652 rows (see `scripts/backfill-cam-563-location-admin-area
 * .mjs`'s report), and the name-match above already covers 650/650 real
 * camps today — no live defect. Selecting `adminArea` here to prefer an
 * id-based, language-agnostic derivation was tried and reverted: `campCardSelect`
 * is spread verbatim into `lib/read-models/ai-camp-card.ts`'s
 * `aiCampCardSelect`, and `CampSiteCardData` is used as a type annotation in
 * `app/wishlist/page.tsx` for an INDEPENDENTLY-shaped query — both outside
 * this story's allowed file surface, and both broke `tsc --noEmit` the
 * moment `adminArea` became a required key on the shared payload type (the
 * SAME ripple CAM-545 itself hit adding `district` — see that story's fix
 * to `ai-camp-card.ts`'s own test fixtures). Left as a follow-up: a story
 * scoped to touch `camp-card.ts` + `ai-camp-card.ts` + `wishlist/page.tsx`
 * together. `Location.province` itself is READ-ONLY here and completely
 * unchanged — `lib/campsite-filters.ts`'s province filter (and CAM-531's
 * province dropdown) depend on its current stored value.
 */
export const campCardSelect = {
  id: true,
  nameTh: true,
  nameEn: true,
  nameThSlug: true,
  nameEnSlug: true,
  priceLow: true,
  priceHigh: true,   // CAM-545: now rendered as a range on the card
  createdAt: true,
  avgRating: true,   // PERF-5: Decimal(2,1)? column maintained by AGG-1
  reviewCount: true, // PERF-5: Int column maintained by AGG-1
  location: {
    select: {
      province: true,
      // CAM-545: not populated for any camp today (see CampSiteCardData.location's
      // doc comment) — wired through so it slots in the moment the data exists.
      district: true,
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
 * columns (AGG-1 / CAM-189 maintains them). priceLow + priceHigh + avgRating are
 * serialised to number by serializeDecimals (were Decimal). createdAt is serialised
 * to ISO string.
 */
export type CampSiteCardData = Omit<CampCardPayload, 'priceLow' | 'priceHigh' | 'createdAt' | 'avgRating' | 'location'> & {
  priceLow: number | null;   // Decimal serialised to number
  priceHigh: number | null;  // CAM-545: Decimal serialised to number
  createdAt: string;          // Date serialised to ISO string
  /** PERF-5: stored average rating column (1dp) or null when no reviews. */
  avgRating: number | null;
  /** PERF-5: stored review count column. */
  reviewCount: number;
  location: CampCardPayload['location'] & {
    /**
     * CAM-545 (rework): the Thai province name, attached downstream by
     * `withProvinceThaiNames()` — a name-based match, not a DB column.
     * Optional — a province with no match falls back to `province` (EC-1).
     */
    provinceTh?: string;
  };
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

/**
 * CAM-545 (rework) — cached English→Thai province-name lookup, built once
 * from `ThailandLocation`'s province-level rows (`districtCode: ''`, the
 * seed's province-record convention — see `prisma/seed.ts`). Returned as
 * `[en, th][]` pairs (JSON-serialisable) rather than a `Map`, because
 * `unstable_cache`'s persisted store round-trips the return value through
 * serialisation — a `Map` would silently collapse to `{}`. The exported
 * `getProvinceThaiNameMap()` below builds the `Map` from these pairs on
 * every call (cheap: ~77 entries), so callers always get a real `Map`.
 *
 * `unstable_cache` (not a bespoke module-level cache) matches the existing
 * convention in `lib/catalog-cache.ts`. This wrapper takes NO runtime
 * argument, so it does not hit the CAM-353/357 "tags fixed at wrap time"
 * trap that only bites when a tag needs to vary per call. A 24h revalidate
 * is enough: CampVibe's 77-province set changes at a DB-migration event, not
 * a request-time one, and there is no write path to tag/invalidate against.
 */
const getProvinceNamePairs = unstable_cache(
  async (): Promise<[string, string][]> => {
    const rows = await prisma.thailandLocation.findMany({
      where: { districtCode: '' },
      select: { provinceNameEn: true, provinceName: true },
    });
    return rows.map((r) => [r.provinceNameEn, r.provinceName] as [string, string]);
  },
  ['province-thai-name-map'],
  { revalidate: 60 * 60 * 24 }
);

/** Public accessor — always returns a real `Map<englishProvinceName, thaiProvinceName>`. */
export async function getProvinceThaiNameMap(): Promise<Map<string, string>> {
  return new Map(await getProvinceNamePairs());
}

/**
 * Attaches `provinceTh` onto each card's `location`, via the lookup map
 * (BR-1). Never mutates the input array/objects. A province with no match
 * (an unmapped/placeholder value) leaves `provinceTh` undefined — the
 * card's `buildLocationText` falls back to the raw `province` value (EC-1).
 *
 * Defensive against a card whose `location` is missing entirely: a real
 * `campCardSelect` row always selects `location`, so this never happens on
 * a genuine card, but an unrelated test fixture (built before this function
 * existed) can legitimately omit a field it never used to need — that must
 * never 500 an endpoint that doesn't even render this one field.
 */
export function withProvinceThaiNames<T extends { location: { province: string | null } }>(
  cards: T[],
  provinceThaiNameMap: Map<string, string>
): (T & { location: T['location'] & { provinceTh?: string } })[] {
  return cards.map((card) => {
    const location = card.location ?? ({} as T['location']);
    const province = (location as { province?: string | null }).province;
    return {
      ...card,
      location: {
        ...location,
        provinceTh: province ? provinceThaiNameMap.get(province) : undefined,
      },
    };
  });
}
