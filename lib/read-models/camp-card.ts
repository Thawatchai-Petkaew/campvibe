import { Prisma } from '@prisma/client';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import type { CampAvailabilityStatus } from '@/lib/campsite-availability';

/**
 * CAM-573 — the AdminArea node select every location-display reader shares.
 * Walks a `Location`'s `adminArea` (the DEEPEST node CAM-563's backfill
 * resolved for it — sub-district ?? district ?? province) UP its `parent`
 * chain to recover the shallower levels, max 2 hops (Thailand's admin
 * hierarchy is exactly 3 levels: province -> district -> sub-district). ONE
 * bounded, nested select per row — a single query (Prisma compiles a nested
 * select into joins/batched queries), never a per-row loop (no N+1,
 * performance.md).
 */
export const adminAreaChainSelect = {
  level: true,
  nameTh: true,
  nameEn: true,
  parent: {
    select: {
      level: true,
      nameTh: true,
      nameEn: true,
      parent: {
        select: { level: true, nameTh: true, nameEn: true },
      },
    },
  },
} satisfies Prisma.AdminAreaSelect;

export type AdminAreaChainNode = Prisma.AdminAreaGetPayload<{ select: typeof adminAreaChainSelect }>;

/**
 * Prisma select for the catalog card listing (PERF-5 / CAM-193).
 *
 * Includes ONLY what CampgroundCard renders:
 *   - scalar card fields (id, name/slug, priceLow, priceHigh, createdAt)
 *   - avgRating: Decimal(2,1)? column (maintained by AGG-1 / CAM-189)
 *   - reviewCount: Int column (maintained by AGG-1 / CAM-189)
 *   - location: province (English, unchanged) + district (free text, kept
 *     selected for shape stability — see the CAM-573 note below) + the
 *     resolved AdminArea chain (CAM-573 — district/sub-district display)
 *   - images: first 5 by sortOrder (carousel shows ≤5 dots — CampgroundCard.tsx:150)
 *
 * Explicitly dropped (over-fetch culprits):
 *   - reviews      (AGG-1 / CAM-189 writes avgRating/reviewCount columns; no raw reviews needed)
 *   - spots        (availability sub-tree — not rendered on the card)
 *   - options      (full MasterData taxonomy — not rendered on the card)
 *   - operator     (full User record — name used in WHERE only, not SELECT)
 *   - _count       (not needed; reviewCount comes from the stored column)
 *   - full location (only province + district + adminArea are read;
 *     subDistrict/lat/lon etc. not rendered; `thaiLocationId` FK is NOT
 *     joined here — see below)
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
 * CAM-563 (investigated, deferred) / CAM-573 (this follow-up, delivered):
 * `Location.adminAreaId` is backfilled for 650 of 652 rows (see
 * `scripts/backfill-cam-563-location-admin-area.mjs`'s report). CAM-563
 * tried selecting `adminArea` here and reverted because it rippled into
 * `lib/read-models/ai-camp-card.ts` and `app/wishlist/page.tsx` (both
 * outside ITS allowed surface at the time) — CAM-573 is exactly that
 * promised follow-up (both files are in ITS surface). The ripple turned
 * out to be a non-issue for `ai-camp-card.ts`: `AiCampCard.location`
 * already `Omit`s `location` entirely and re-adds a narrow
 * `{province:string}` shape, so it compiles unchanged against the widened
 * payload (verified structurally — no edit needed there); `wishlist
 * /page.tsx` gets its own explicit `adminArea` select (CAM-573, that file).
 *
 * `Location.province` itself is READ-ONLY here and completely unchanged —
 * `lib/campsite-filters.ts`'s province filter (and CAM-531's province
 * dropdown) depend on its current stored value. `district` (free text)
 * stays selected too (still written per BR-3 — out of this story's scope
 * to change), but display now prefers the id-derived bilingual name (see
 * `withProvinceThaiNames` below) — it is kept selected only for shape
 * stability, not read by `buildLocationText` anymore.
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
      district: true,
      // CAM-573 — the resolved AdminArea chain; see adminAreaChainSelect's
      // doc comment above.
      adminArea: { select: adminAreaChainSelect },
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
 * The bilingual display names CAM-573 derives from a Location's resolved
 * AdminArea chain — see `resolveLocationDisplayNames` below. All optional:
 * absent when `adminArea` itself is null (the 2 orphan `Location` rows with
 * no live camp, verified against the dev DB — see tech.md) or when the
 * chain did not resolve to that depth (e.g. a camp whose `adminAreaId`
 * stops at PROVINCE never gets a `districtTh`/`districtEn`).
 */
export interface LocationDisplayNames {
  /** Bilingual province name. Falls back to the raw `Location.province` string in `withProvinceThaiNames` when absent (EC-1: the 2 orphan/unmatched rows). */
  provinceTh?: string;
  provinceEn?: string;
  /** Bilingual district name — populated only when `adminArea` resolved to DISTRICT depth or deeper. */
  districtTh?: string;
  districtEn?: string;
  /** Bilingual sub-district name — populated only when `adminArea` resolved to SUBDISTRICT depth. */
  subDistrictTh?: string;
  subDistrictEn?: string;
}

/**
 * Derives the bilingual province/district/sub-district display names from a
 * Location's resolved AdminArea chain (CAM-573 — closes CAM-567: a Thai
 * user no longer sees an English district next to a Thai province, because
 * both now derive from the SAME id-based source instead of a province-only
 * name-match). `adminArea` is the DEEPEST node CAM-563's backfill resolved
 * (subDistrict ?? district ?? province) — this walks its `parent` chain UP
 * to recover the shallower levels, never guessing a level that was not
 * actually resolved (mirrors the "stop at the deepest matched level"
 * contract `lib/geo/admin-area-match.ts` and the CAM-563 backfill share).
 *
 * `null`/`undefined` (the 2 orphan `Location` rows with no live camp,
 * verified against the dev DB) returns every field `undefined` — the
 * caller (`withProvinceThaiNames`) falls back to the legacy free-text
 * `province` column alone, never a stray "undefined, undefined" or a
 * dangling leading comma.
 */
export function resolveLocationDisplayNames(
  adminArea: AdminAreaChainNode | null | undefined
): LocationDisplayNames {
  if (!adminArea) return {};

  const subDistrict = adminArea.level === 'SUBDISTRICT' ? adminArea : null;
  const district =
    adminArea.level === 'DISTRICT' ? adminArea :
    adminArea.level === 'SUBDISTRICT' ? adminArea.parent :
    null;
  const province =
    adminArea.level === 'PROVINCE' ? adminArea :
    adminArea.level === 'DISTRICT' ? adminArea.parent :
    adminArea.level === 'SUBDISTRICT' ? (adminArea.parent?.parent ?? null) :
    null;

  return {
    provinceTh: province?.nameTh,
    provinceEn: province?.nameEn,
    districtTh: district?.nameTh,
    districtEn: district?.nameEn,
    subDistrictTh: subDistrict?.nameTh,
    subDistrictEn: subDistrict?.nameEn,
  };
}

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
  location: Omit<CampCardPayload['location'], 'adminArea'> & LocationDisplayNames;
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
 *
 * CAM-573: kept as the FALLBACK path (province-only, name-based) for a card
 * whose `adminArea` did not resolve (the 2 orphan rows) — the id-derived
 * chain (`resolveLocationDisplayNames`) is preferred whenever present.
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
 * Attaches the bilingual display names onto each card's `location` (BR-1).
 * Never mutates the input array/objects.
 *
 * CAM-573: prefers the id-derived chain (`resolveLocationDisplayNames`,
 * read off `location.adminArea` when the caller's select included it) —
 * this is what closes CAM-567 (a Thai user no longer sees an English
 * district next to a Thai province). Falls back to the pre-existing
 * name-based `provinceThaiNameMap` lookup for `provinceTh` ONLY when the
 * id-derived value is absent — either because the caller's row has no
 * `adminArea` field at all (an older/narrower selection — kept
 * byte-compatible with every existing test fixture and the one caller this
 * story could not extend, `app/campgrounds/[slug]/page.tsx`'s `getCampBySlug`
 * — see tech.md "Known gap") or because the 2 orphan rows have no resolved
 * AdminArea. `district`/`subDistrict` have NO free-text-based fallback (the
 * raw `district` column is not read for display any more — see
 * `campCardSelect`'s doc comment); a card whose chain didn't reach that
 * depth simply renders one level shallower (province-only or
 * district+province), never a wrong-language guess.
 *
 * The function NAME/SIGNATURE is unchanged from before CAM-573 (still
 * `(cards, provinceThaiNameMap) => enriched cards`) — this function is
 * called from 2 files outside this story's surface
 * (`app/api/campsites/route.ts`, `app/campgrounds/[slug]/page.tsx`) that
 * this story cannot edit; keeping the signature identical means both keep
 * compiling and both automatically pick up the enhancement the moment their
 * own row includes an `adminArea` field (already true for
 * `app/api/campsites/route.ts`, which selects via the shared
 * `campCardSelect`; not yet true for the detail page — see tech.md).
 *
 * Defensive against a card whose `location` is missing entirely: a real
 * `campCardSelect` row always selects `location`, so this never happens on
 * a genuine card, but an unrelated test fixture (built before this function
 * existed) can legitimately omit a field it never used to need — that must
 * never 500 an endpoint that doesn't even render this one field.
 */
export function withProvinceThaiNames<
  T extends { location: { province: string | null; adminArea?: AdminAreaChainNode | null } }
>(
  cards: T[],
  provinceThaiNameMap: Map<string, string>
): (T & { location: T['location'] & LocationDisplayNames })[] {
  return cards.map((card) => {
    const location = card.location ?? ({} as T['location']);
    const province = (location as { province?: string | null }).province;
    const adminArea = (location as { adminArea?: AdminAreaChainNode | null }).adminArea ?? null;
    const idDerived = resolveLocationDisplayNames(adminArea);
    return {
      ...card,
      location: {
        ...location,
        provinceTh: idDerived.provinceTh ?? (province ? provinceThaiNameMap.get(province) : undefined),
        provinceEn: idDerived.provinceEn,
        districtTh: idDerived.districtTh,
        districtEn: idDerived.districtEn,
        subDistrictTh: idDerived.subDistrictTh,
        subDistrictEn: idDerived.subDistrictEn,
      },
    };
  });
}
