/**
 * CAM-427 — the `getCampDetail` read-only AI tool: backs the assistant's
 * floating detail card with REAL data — amenities (the `options` MasterData
 * taxonomy), verified reviews, and live upcoming-weekend availability. No new
 * schema, no new HTTP endpoint (dispatched through the existing
 * `/api/ai/chat` tool-registry, same as `searchCampsites`/`checkAvailability`
 * — ADR-009 no-forked-data-path); a lean, dedicated `select` (not the heavy
 * `getCampBySlug` detail read, which over-fetches spots/full-images/operator
 * for a page render this tool doesn't need).
 *
 * CAM-449 (S5 enrichment): extends the same lean select with more
 * DECISION-relevant, guest-safe fields the in-chat detail card (CAM-450)
 * needs — description, real total price/fees, capacity, cancellation
 * policy, verified badge, check-in/out, access, and a live per-weekend
 * remaining-guest count (`weekendAvailability`). All fields come from OUR
 * schema (no new external call); no operator/contact/KYC/payout field is
 * ever selected or returned (PDPA, mirrors the CAM-427/CAM-446 boundary).
 *
 * CAM-464 (D4): additive `facets: FacetScore[]` — derived family/beginner/
 * road_access scores computed on-read (`computeFacetScores`, rules-only v1,
 * NO table/NO migration) from the ALREADY-SELECTED `options{code,group}` +
 * `minimumAge` fields. Zero added DB cost, backward-compatible (existing
 * consumers ignore the new field).
 */
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  getCampSiteDailyAvailability,
  getEffectiveCapacity,
  getRemainingCapacityForCamps,
  type EffectiveCapacity,
} from '@/lib/campsite-availability';
import { buildReviewSummary, toReviewListItem, type ReviewListItem, type ReviewSummary } from '@/lib/review-summary';
import type { CancellationPolicyValue } from '@/lib/cancellation-policy';
import { distanceFromBangkokKm } from '@/lib/geo/distance';
import { computeFacetScores, type FacetScore } from '@/lib/facet-scores';
import type { ToolDefinition } from '@/lib/ai/tool-registry';

/** Bounded read — never an unbounded review dump (performance.md). */
const MAX_REVIEWS_RETURNED = 10;

/**
 * 🟡 Assumption (no exact count/definition was pinned by the ticket) —
 * "upcoming weekend dates" = the next N Saturday check-in nights. Default
 * chosen to cover roughly 2 months of lookahead without a wide date-range
 * scan. Confirm/adjust with the product owner if the Expression Layer story
 * needs a different count or weekend definition.
 */
const WEEKEND_LOOKAHEAD_COUNT = 8;

export const getCampDetailArgsSchema = z.object({
  campSiteId: z.string().uuid(),
});

export type GetCampDetailArgs = z.infer<typeof getCampDetailArgsSchema>;

export interface CampAmenity {
  code: string;
  group: string;
  nameTh: string;
  nameEn: string;
  icon: string | null;
}

/** CAM-449 — atomic price/fee fields (api.md rule 4: never a merged "฿1,250 incl VAT" string). */
export interface CampDetailPrice {
  low: number | null;
  high: number | null;
  currency: string;
  /** One-time additive fee (e.g. park entrance), same currency as above. */
  extraFeeAmount: number | null;
  extraFeeLabel: string | null;
  /** Free-text host context about fees — distinct from extraFeeAmount/Label. */
  feeInfo: string | null;
  isFree: boolean;
}

/**
 * CAM-449 — the camp's advertised capacity, not the live remaining count (see
 * `weekendAvailability`). CAM-449 QA fix: this is the EFFECTIVE capacity
 * (`getEffectiveCapacity`, same as `availableWeekendDates`/
 * `weekendAvailability` already use) — WHOLE-CAMP reads the raw
 * `maxGuestsPerDay`/`maxTentsPerDay` columns unchanged, PER-SPOT
 * (`useSpotView`) sums non-deleted spots instead. Never read the raw columns
 * directly here — for a PER-SPOT camp they are null while the real capacity
 * lives on its spots, which forked this field from `weekendAvailability`'s
 * basis (CAM-355/CAM-400 class bug).
 */
export interface CampDetailCapacity {
  maxGuestsPerDay: number | null;
  maxTentsPerDay: number | null;
}

export interface CampDetailLocation {
  province: string | null;
  region: string | null;
}

/**
 * CAM-449 — one upcoming Saturday's LIVE remaining-guest count, reusing the
 * canonical `getRemainingCapacityForCamps` formula (ADR-009 no-forked-data-
 * path) so this can never disagree with the catalog page's own badge math.
 * `remaining` is a GUEST count: `null` when the camp has no capacity cap set
 * (unbounded — the UI shows no number); `0` or `blockedByHost: true` both
 * mean full (the UI shows "เต็มแล้ว").
 */
export interface WeekendAvailabilityEntry {
  date: string;
  remaining: number | null;
  blockedByHost: boolean;
}

export type GetCampDetailResult =
  | {
      ok: true;
      id: string;
      nameTh: string;
      nameEn: string | null;
      description: string | null;
      amenities: CampAmenity[];
      /** Verified reviews only (capped at MAX_REVIEWS_RETURNED, most recent first). */
      reviews: ReviewListItem[];
      /**
       * G7 — the canonical "does this camp have reviews yet" signal, reused
       * from `lib/review-summary.ts` (the camp detail page's own derivation).
       * `count` reflects ALL non-deleted reviews (the same aggregate
       * `CampSite.avgRating`/`reviewCount` already track) — it can exceed
       * `reviews.length` because `reviews` is filtered to verified-only.
       */
      reviewSummary: ReviewSummary;
      price: CampDetailPrice;
      capacity: CampDetailCapacity;
      /** `null` = host has not set a policy yet (never inferred/guessed — ADR-003). */
      cancellationPolicy: CancellationPolicyValue | null;
      isVerified: boolean;
      checkInTime: string;
      checkOutTime: string;
      minimumAge: number | null;
      location: CampDetailLocation;
      directions: string | null;
      /** Haversine distance from a fixed Bangkok origin point; `null` when lat/lng is missing. */
      distanceFromBangkokKm: number | null;
      /** ISO date strings (YYYY-MM-DD) — upcoming Saturday check-in nights that are NOT full/blocked. */
      availableWeekendDates: string[];
      /**
       * CAM-449 — the live, per-Saturday sibling of `availableWeekendDates`
       * (which CAM-450 migrates to; `availableWeekendDates` stays for
       * back-compat until a follow-up cleanup removes it).
       */
      weekendAvailability: WeekendAvailabilityEntry[];
      /**
       * CAM-464 (D4) — derived family/beginner/road_access scores, computed
       * on-read from the fields already selected above (`options`,
       * `minimumAge`). A facet with no supporting evidence is OMITTED (BR-5,
       * never a fake 0-score) — the assistant answers "ข้อมูลไม่พอ" for any
       * facet absent from this array. ADDITIVE field only (api.md rule 12).
       */
      facets: FacetScore[];
    }
  | { ok: false; code: 'not_found' };

const jsonSchema = {
  type: 'object',
  properties: {
    campSiteId: { type: 'string', description: 'The CampSite id (UUID) to load the detail card for' },
  },
  required: ['campSiteId'],
  additionalProperties: false,
} as const;

/** The next `count` Saturdays (UTC midnight), starting today or the coming Saturday. */
function nextSaturdays(count: number, from: Date): Date[] {
  const SATURDAY = 6;
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const daysUntilSaturday = (SATURDAY - start.getUTCDay() + 7) % 7;
  const firstSaturday = new Date(start);
  firstSaturday.setUTCDate(firstSaturday.getUTCDate() + daysUntilSaturday);

  const out: Date[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(firstSaturday);
    d.setUTCDate(d.getUTCDate() + i * 7);
    out.push(d);
  }
  return out;
}

/**
 * Live upcoming-weekend availability for ONE camp — a single
 * `getCampSiteDailyAvailability` call across the whole lookahead window
 * (never one call per Saturday). `effectiveCapacity` is passed in (computed
 * ONCE by the caller, `executeGetCampDetail`, via `getEffectiveCapacity` —
 * CAM-449 QA fix: this function used to call `getEffectiveCapacity` itself,
 * which would have meant a SECOND call once the `capacity` result field also
 * needed it; hoisting keeps it at exactly one call total, per the perf/N+1
 * guard test) — reused unchanged from `lib/campsite-availability.ts`
 * (ADR-009). A night is "available" when it is not host-blocked and
 * (capacity is unbounded OR occupied < capacity) — the same remaining>0
 * semantics `getRemainingCapacity` already uses.
 */
async function computeAvailableWeekendDates(
  campSiteId: string,
  effectiveCapacity: EffectiveCapacity
): Promise<string[]> {
  const saturdays = nextSaturdays(WEEKEND_LOOKAHEAD_COUNT, new Date());
  const windowStart = saturdays[0];
  const windowEnd = new Date(saturdays[saturdays.length - 1]);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 1); // inclusive of the last Saturday night itself

  const daily = await getCampSiteDailyAvailability(campSiteId, windowStart, windowEnd);

  const capacity = effectiveCapacity.maxGuestsPerDay;
  const out: string[] = [];
  for (const sat of saturdays) {
    const key = sat.toISOString().split('T')[0];
    const night = daily[key];
    if (!night) {
      out.push(key); // no booking/block/hold data at all for this night — open
      continue;
    }
    const full = capacity !== null && night.bookedGuests + night.heldGuests >= capacity;
    if (!night.blockedByHost && !full) out.push(key);
  }
  return out;
}

/**
 * CAM-449 — the live, per-Saturday sibling of `computeAvailableWeekendDates`:
 * a numeric remaining-guest count (not just open/full) per weekend date,
 * reusing `getRemainingCapacityForCamps` — the EXACT same batched/canonical
 * formula the catalog page's badge already uses (ADR-009 no-forked-data-
 * path) — so this can never disagree with it.
 *
 * Bounded to WEEKEND_LOOKAHEAD_COUNT (8) calls, run in parallel — a FIXED
 * internal constant, never client-controlled, so this is not the unbounded-
 * loop DoS class CAM-401 guards against. `getRemainingCapacityForCamps`
 * accepts a batch of camp ids for ONE date range (it batches across camps,
 * not dates); since this tool is single-camp-scoped, one call per Saturday
 * is required to get a genuinely PER-DATE number. This duplicates the query
 * set `computeAvailableWeekendDates` above already ran for the same window —
 * an accepted, temporary tradeoff kept ONLY until the follow-up cleanup
 * ticket removes `availableWeekendDates` and consolidates both onto one path
 * (see the `GetCampDetailResult.availableWeekendDates` doc comment).
 */
async function computeWeekendAvailability(campSiteId: string): Promise<WeekendAvailabilityEntry[]> {
  const saturdays = nextSaturdays(WEEKEND_LOOKAHEAD_COUNT, new Date());

  return Promise.all(
    saturdays.map(async (sat) => {
      const key = sat.toISOString().split('T')[0];
      const nightEnd = new Date(sat);
      nightEnd.setUTCDate(nightEnd.getUTCDate() + 1); // exclusive checkout — one night only

      const byCampId = await getRemainingCapacityForCamps([campSiteId], sat, nightEnd);
      const forThisCamp = byCampId[campSiteId];

      return {
        date: key,
        remaining: forThisCamp ? forThisCamp.remaining : null,
        blockedByHost: forThisCamp ? forThisCamp.blockedByHost : false,
      };
    })
  );
}

export async function executeGetCampDetail(args: GetCampDetailArgs): Promise<GetCampDetailResult> {
  const campSite = await prisma.campSite.findFirst({
    where: { id: args.campSiteId, isPublished: true, isActive: true, deletedAt: null },
    select: {
      id: true,
      nameTh: true,
      nameEn: true,
      description: true,
      useSpotView: true,
      maxGuestsPerDay: true,
      maxTentsPerDay: true,
      avgRating: true,
      reviewCount: true,
      // CAM-449 — atomic price/fee fields (guest-safe; no operator/payout data).
      priceLow: true,
      priceHigh: true,
      priceCurrency: true,
      extraFeeAmount: true,
      extraFeeLabel: true,
      feeInfo: true,
      isFree: true,
      cancellationPolicy: true,
      isVerified: true,
      checkInTime: true,
      checkOutTime: true,
      minimumAge: true,
      directions: true,
      latitude: true,
      longitude: true,
      // CAM-449 — guest-safe location fields only (never operator/contact — see the module doc comment).
      location: { select: { province: true, region: true } },
      options: { select: { code: true, group: true, nameTh: true, nameEn: true, icon: true } },
      reviews: {
        where: { verified: true, deletedAt: null },
        select: { rating: true, content: true, createdAt: true, author: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: MAX_REVIEWS_RETURNED,
      },
    },
  });

  if (!campSite) {
    return { ok: false, code: 'not_found' };
  }

  // CAM-449 QA fix: ONE effective-capacity read, shared by the returned
  // `capacity` field AND `computeAvailableWeekendDates`'s own full/open
  // check — never the raw `maxGuestsPerDay`/`maxTentsPerDay` columns
  // directly (those are null for a PER-SPOT camp; the real capacity lives
  // on its spots). Same canonical source `weekendAvailability` already uses
  // via `getRemainingCapacityForCamps` (ADR-009 no-forked-data-path).
  const effectiveCapacity = await getEffectiveCapacity(prisma, {
    id: campSite.id,
    useSpotView: campSite.useSpotView,
    maxGuestsPerDay: campSite.maxGuestsPerDay,
    maxTentsPerDay: campSite.maxTentsPerDay,
  });

  const [availableWeekendDates, weekendAvailability] = await Promise.all([
    computeAvailableWeekendDates(campSite.id, effectiveCapacity),
    computeWeekendAvailability(campSite.id),
  ]);

  // CAM-464 (D4) — pure, synchronous, computed on already-fetched fields
  // (options/minimumAge); NOT a DB call, so no Promise.all batching needed.
  const facets = computeFacetScores({
    options: campSite.options.map((o) => ({ code: o.code, group: o.group })),
    minimumAge: campSite.minimumAge,
  });

  return {
    ok: true,
    id: campSite.id,
    nameTh: campSite.nameTh,
    nameEn: campSite.nameEn,
    description: campSite.description,
    amenities: campSite.options,
    reviews: campSite.reviews.map(toReviewListItem),
    reviewSummary: buildReviewSummary({
      avg: campSite.avgRating ? campSite.avgRating.toNumber() : null,
      count: campSite.reviewCount,
    }),
    price: {
      low: campSite.priceLow ? campSite.priceLow.toNumber() : null,
      high: campSite.priceHigh ? campSite.priceHigh.toNumber() : null,
      currency: campSite.priceCurrency,
      extraFeeAmount: campSite.extraFeeAmount ? campSite.extraFeeAmount.toNumber() : null,
      extraFeeLabel: campSite.extraFeeLabel,
      feeInfo: campSite.feeInfo,
      isFree: campSite.isFree,
    },
    capacity: {
      maxGuestsPerDay: effectiveCapacity.maxGuestsPerDay,
      maxTentsPerDay: effectiveCapacity.maxTentsPerDay,
    },
    cancellationPolicy: campSite.cancellationPolicy,
    isVerified: campSite.isVerified,
    checkInTime: campSite.checkInTime,
    checkOutTime: campSite.checkOutTime,
    minimumAge: campSite.minimumAge,
    location: {
      province: campSite.location?.province ?? null,
      region: campSite.location?.region ?? null,
    },
    directions: campSite.directions,
    distanceFromBangkokKm: distanceFromBangkokKm(campSite.latitude, campSite.longitude),
    availableWeekendDates,
    weekendAvailability,
    facets,
  };
}

export const getCampDetailTool: ToolDefinition<GetCampDetailArgs, GetCampDetailResult> = {
  name: 'getCampDetail',
  description:
    'Load the detail card for ONE published CampVibe campsite: description, real total price/fees, capacity, cancellation policy, verified badge, check-in/out, access, amenities, verified reviews, live per-weekend remaining-guest availability, and derived family/beginner/road_access facet scores. Answer facet questions ONLY from a facet\'s `evidence` field; when a facet is absent from `facets` or `answerable` is false, say the data is insufficient — never guess. For `road_access`, never claim a sedan specifically can enter (the source field cannot distinguish vehicle class).',
  // CAM-417 (ADR-013 D5) — public campsite detail data, offered to every caller like searchCampsites/checkAvailability.
  tier: 'guest',
  parameters: getCampDetailArgsSchema,
  jsonSchema,
  // This tool needs no caller identity; `_ctx` is server-bound and unused here.
  execute: (args, _ctx) => executeGetCampDetail(args),
};
