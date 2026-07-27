import { Prisma } from '@prisma/client';
import {
  campCardSelect,
  resolveLocationDisplayNames,
  type LocationDisplayNames,
} from '@/lib/read-models/camp-card';
import { buildReviewSummary } from '@/lib/review-summary';

/**
 * lib/read-models/ai-camp-card.ts — CAM-427.
 *
 * Dedicated AI-assistant card select: EXTENDS `campCardSelect` (never
 * mutates/regresses it — every other consumer of `campCardSelect`, e.g.
 * `getDefaultCatalog`, is untouched) with the ONE field the assistant card
 * needs that the shared catalog card doesn't: a "first tag" — the camp's
 * primary Terrain-group descriptor (ริมน้ำ/ป่า/ภูเขา/ชายหาด), the same
 * taxonomy group `CampgroundDetailClient.tsx` already surfaces first and
 * `lib/ai/tools/search-campsites.ts`'s own terrain args already treat as
 * "what kind of camp is this" (ADR-009 no-forked-data-path: reusing an
 * EXISTING taxonomy group, not inventing a new concept).
 *
 * `take: 1` + a deterministic `orderBy: { code: 'asc' }` (MasterData carries
 * no explicit sort-order column) keeps this a single, bounded, real DB read
 * — never an unbounded taxonomy dump (performance.md).
 */
export const aiCampCardSelect = {
  ...campCardSelect,
  options: {
    where: { group: 'Terrain' },
    select: { code: true, nameTh: true, nameEn: true },
    orderBy: { code: 'asc' as const },
    take: 1,
  },
} satisfies Prisma.CampSiteSelect;

export type AiCampCardPayload = Prisma.CampSiteGetPayload<{ select: typeof aiCampCardSelect }>;

/**
 * CAM-597 — the assistant card's location, in the SAME shape
 * `CampgroundCardData['location']` (components/CampgroundCard.tsx) already
 * carries: `province`/`district` stay the raw, English, DB-stored values
 * (unchanged contract — `Location.province` still drives
 * `lib/campsite-filters.ts`'s exact-string-equality filter, untouched by
 * this story), plus the optional bilingual `LocationDisplayNames` resolved
 * from `Location.adminAreaId`'s AdminArea chain via the SAME
 * `resolveLocationDisplayNames` CAM-573 already built (lib/read-models/
 * camp-card.ts) — never a second chain-walk implementation.
 *
 * The client renders this through the SAME `buildLocationText` the catalog
 * card uses (re-exported for the chat surface at
 * components/ai-chat/location-text.ts), so the displayed text is always in
 * the camper's CURRENT language — including right after a mid-session
 * language switch, which a pre-rendered server-side string cannot survive
 * (see this story's tech.md, "Payload shape decision").
 */
export interface AiCampCardLocation extends LocationDisplayNames {
  province: string;
  district?: string | null;
}

/** The wire-adjacent card shape every AI tool that returns cards builds — pre-`serializeDecimals`. */
export interface AiCampCard extends Omit<AiCampCardPayload, 'location'> {
  location: AiCampCardLocation;
  /**
   * G7 (real-data gap): `avgRating`/`reviewCount` already ride on
   * `campCardSelect` — this flag is the CANONICAL "does this camp have any
   * reviews yet" signal (reused from `lib/review-summary.ts`'s
   * `buildReviewSummary`, the same derivation the camp detail page already
   * uses) so the card renderer never re-derives its own `reviewCount > 0`
   * check and can show "ยังไม่มีรีวิว" instead of a 0.0 star row.
   */
  hasReviews: boolean;
}

/**
 * Maps one `aiCampCardSelect` Prisma row into the AI card shape.
 *
 * G8 (real-data gap): `Location.province` is a nullable column
 * (`prisma/schema.prisma` `province String?`) — a camp missing it must NOT
 * silently disappear from the assistant's results. The wire type
 * `AiChatCardResponse.location.province` (lib/api-client.ts) — and every
 * existing consumer of that same shape (`CampgroundCardData` /
 * `AiChatCampCard.tsx`, out of this story's surface) — is typed as a
 * required `string`, so this mapper coerces a null province to `''` at THIS
 * one boundary rather than widening that shared type. `''` is the SAME
 * coercion convention `app/wishlist/page.tsx` already uses for the identical
 * nullable-province situation (`location.province ?? ""`), not an invented
 * fabrication — the card is kept and simply renders no province text
 * (omittable, per G8), instead of the pre-existing behavior where
 * `isAiChatCardResponse`'s `typeof province === 'string'` check silently
 * dropped the entire card.
 *
 * CAM-597: also attaches the id-derived bilingual district/province names
 * via `resolveLocationDisplayNames(row.location?.adminArea)`. The row
 * already carries `adminArea` because `aiCampCardSelect` extends
 * `campCardSelect`, whose `location` select already includes it (CAM-573)
 * — no Prisma `select` change was needed on any of this story's AI tool
 * files for that reason (see tech.md). Deliberately NOT threaded through
 * the async `getProvinceThaiNameMap()`/`withProvinceThaiNames()` name-based
 * fallback the catalog list uses for its 2 orphan (no-live-camp) rows:
 * `toAiCampCard` only ever runs over rows a live, published `CampSite`
 * query returned, so `adminArea` is populated for effectively all of them
 * (650/652 backfilled `Location` rows, CAM-563). `buildLocationText`
 * already falls back to the raw `province`/`district` strings on its own
 * when `adminArea` is truly absent (CAM-573 EC-5/EC-6), so a card is never
 * dropped or left blank — an accepted, bounded gap, the same convention as
 * CAM-573's own "Known gap" note.
 */
export function toAiCampCard(row: AiCampCardPayload): AiCampCard {
  // hasReviews depends only on `count` (see buildReviewSummary) — `avg` is
  // irrelevant to that branch, so passing `null` here is safe and avoids a
  // Prisma.Decimal -> number conversion this function has no other use for.
  const { hasReviews } = buildReviewSummary({ avg: null, count: row.reviewCount });
  const displayNames = resolveLocationDisplayNames(row.location?.adminArea);

  return {
    ...row,
    location: {
      province: row.location?.province ?? '',
      district: row.location?.district ?? null,
      ...displayNames,
    },
    hasReviews,
  };
}
