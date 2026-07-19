/**
 * CAM-427 — the `getCampDetail` read-only AI tool: backs the assistant's
 * floating detail card with REAL data — amenities (the `options` MasterData
 * taxonomy), verified reviews, and live upcoming-weekend availability. No new
 * schema, no new HTTP endpoint (dispatched through the existing
 * `/api/ai/chat` tool-registry, same as `searchCampsites`/`checkAvailability`
 * — ADR-009 no-forked-data-path); a lean, dedicated `select` (not the heavy
 * `getCampBySlug` detail read, which over-fetches spots/full-images/operator
 * for a page render this tool doesn't need).
 */
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCampSiteDailyAvailability, getEffectiveCapacity } from '@/lib/campsite-availability';
import { buildReviewSummary, toReviewListItem, type ReviewListItem, type ReviewSummary } from '@/lib/review-summary';
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

export type GetCampDetailResult =
  | {
      ok: true;
      id: string;
      nameTh: string;
      nameEn: string | null;
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
      /** ISO date strings (YYYY-MM-DD) — upcoming Saturday check-in nights that are NOT full/blocked. */
      availableWeekendDates: string[];
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
 * (never one call per Saturday) plus a single `getEffectiveCapacity` call,
 * both reused unchanged from `lib/campsite-availability.ts` (ADR-009). A
 * night is "available" when it is not host-blocked and (capacity is
 * unbounded OR occupied < capacity) — the same remaining>0 semantics
 * `getRemainingCapacity` already uses.
 */
async function computeAvailableWeekendDates(campSite: {
  id: string;
  useSpotView: boolean;
  maxGuestsPerDay: number | null;
  maxTentsPerDay: number | null;
}): Promise<string[]> {
  const saturdays = nextSaturdays(WEEKEND_LOOKAHEAD_COUNT, new Date());
  const windowStart = saturdays[0];
  const windowEnd = new Date(saturdays[saturdays.length - 1]);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 1); // inclusive of the last Saturday night itself

  const [daily, effective] = await Promise.all([
    getCampSiteDailyAvailability(campSite.id, windowStart, windowEnd),
    getEffectiveCapacity(prisma, campSite),
  ]);

  const capacity = effective.maxGuestsPerDay;
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

export async function executeGetCampDetail(args: GetCampDetailArgs): Promise<GetCampDetailResult> {
  const campSite = await prisma.campSite.findFirst({
    where: { id: args.campSiteId, isPublished: true, isActive: true, deletedAt: null },
    select: {
      id: true,
      nameTh: true,
      nameEn: true,
      useSpotView: true,
      maxGuestsPerDay: true,
      maxTentsPerDay: true,
      avgRating: true,
      reviewCount: true,
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

  const availableWeekendDates = await computeAvailableWeekendDates({
    id: campSite.id,
    useSpotView: campSite.useSpotView,
    maxGuestsPerDay: campSite.maxGuestsPerDay,
    maxTentsPerDay: campSite.maxTentsPerDay,
  });

  return {
    ok: true,
    id: campSite.id,
    nameTh: campSite.nameTh,
    nameEn: campSite.nameEn,
    amenities: campSite.options,
    reviews: campSite.reviews.map(toReviewListItem),
    reviewSummary: buildReviewSummary({
      avg: campSite.avgRating ? campSite.avgRating.toNumber() : null,
      count: campSite.reviewCount,
    }),
    availableWeekendDates,
  };
}

export const getCampDetailTool: ToolDefinition<GetCampDetailArgs, GetCampDetailResult> = {
  name: 'getCampDetail',
  description:
    'Load the detail card for ONE published CampVibe campsite: amenities, verified reviews, and upcoming available weekend dates.',
  // CAM-417 (ADR-013 D5) — public campsite detail data, offered to every caller like searchCampsites/checkAvailability.
  tier: 'guest',
  parameters: getCampDetailArgsSchema,
  jsonSchema,
  // This tool needs no caller identity; `_ctx` is server-bound and unused here.
  execute: (args, _ctx) => executeGetCampDetail(args),
};
