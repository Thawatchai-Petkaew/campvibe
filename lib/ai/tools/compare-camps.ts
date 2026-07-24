/**
 * lib/ai/tools/compare-camps.ts — CAM-473 (tech.md — all 6 G2 decisions):
 * the `compareCamps` read-only AI tool — 2-4 published camps side by side on
 * named criteria (price/capacity/facilities/cancellation policy/distance/
 * rating/verified + the CAM-464 family/beginner/road_access facets).
 *
 * Decision 1 (dedicated LEAN batch read, `getCampDetail` UNTOUCHED, CAM-355):
 * this file owns its OWN `prisma.campSite.findMany`, with the CAM-469
 * visibility gate baked in verbatim (`isActive`+`isPublished`+
 * `deletedAt: null`). `lib/ai/tools/get-camp-detail.ts`'s single-id read is
 * NOT touched, NOT extracted, NOT shared — a comparison needs only a lean
 * guest-safe subset, never the heavy per-camp weekend-availability/review
 * computations `getCampDetail` runs (N x ~10 queries a comparison would
 * otherwise discard — the exact N+1/over-fetch performance.md §3 forbids).
 *
 * Gate inheritance (the security seam, AC-5/EC-2/EC-3): an id that is
 * unpublished/inactive/soft-deleted/forged/nonexistent simply does NOT
 * appear in the read result — absent, never a partial leak and never an
 * existence oracle (an unpublished id is indistinguishable from a
 * nonexistent one, both absent). This tool never returns a per-id "dropped"
 * list; a shortfall below 2 visible camps surfaces only as the aggregate
 * `insufficient_visible` refuse (Decision 4 below).
 *
 * Capacity sub-decision (CAM-355/CAM-400 fork, refused here on purpose): the
 * `capacity` cell is the EFFECTIVE capacity via the canonical
 * `getEffectiveCapacity` (ADR-009, no fork), NEVER the raw `maxGuestsPerDay`
 * column — a per-spot camp's column is null while its real capacity lives on
 * its spots (the exact false-no-data bug `get-camp-detail.ts`'s own capacity
 * comment warns against).
 *
 * Decision 3 (matrix = VALUES + evidence, no tool-asserted verdict, P13
 * honesty): the tool returns per-camp x per-criterion VALUES only — atomic
 * fields for the scalar criteria, the CAM-464 `FacetScore` (score/
 * confidence/answerable/evidence) UNCHANGED for the 3 facet criteria. This
 * module emits no comparative-judgment field of any kind — the model
 * phrases any recommendation from the returned evidence (BR-5); a camp's
 * "suitability" depends on the camper's unstated priorities, so a tool-asserted verdict
 * would over-claim.
 *
 * Decision 4 (hard cap + de-dup BEFORE any read, CAM-344): `campIds` is
 * de-duped, THEN bounds-checked (`2..MAX_COMPARE_CAMPS`) — both checks are
 * O(1) in-memory, run before `prisma.campSite.findMany` is ever called. An
 * over-cap array is REFUSED, never silently truncated to a partial compare
 * (a truncated named set would mislead the camper about what was actually
 * compared). The refuse is a graceful discriminated union
 * (`{ ok:false, reason }`, mirrors `bulkAvailability`), never a bare zod
 * `invalid_args` — that shorthand cannot de-dup before counting
 * (`[a,a,a,a,a]` is 1 unique id) and gives the model no distinct reason to
 * phrase "narrow it down" vs "cannot compare".
 */
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getEffectiveCapacity, type EffectiveCapacity } from '@/lib/campsite-availability';
import { computeFacetScores, type FacetScore } from '@/lib/facet-scores';
import { distanceFromBangkokKm } from '@/lib/geo/distance';
import type { CampAmenity } from '@/lib/ai/tools/get-camp-detail';
import type { CancellationPolicyValue } from '@/lib/cancellation-policy';
import type { ToolDefinition } from '@/lib/ai/tool-registry';

/** Decision 4 — a comparison of more than this many camps is not a comparison; 2-3 is the sweet spot, 4 the ceiling. */
export const MAX_COMPARE_CAMPS = 4;

/**
 * Decision 2 — a closed, engineering-owned enum (ADR-003: a criteria
 * vocabulary is an engineering enum, never free-text). All 10
 * story-candidate members are admitted — each maps 1:1 to an
 * already-selected field, so full expressiveness is zero marginal cost.
 */
export const CRITERION_IDS = [
  'price', 'capacity', 'rating', 'verified', // atomic scalar/compound
  'facilities', 'cancellation_policy', 'distance', // atomic
  'family', 'beginner', 'road_access', // CAM-464 facets (evidence-carrying)
] as const;
export type CriterionId = (typeof CRITERION_IDS)[number];

/**
 * Decision 2 — used when `criteria` is omitted/empty (AC-3/EC-6): the
 * PO-recommended decision core a camper weighs on an open "อันไหนดีกว่ากัน".
 * `beginner`/`road_access`/`facilities`/`cancellation_policy`/`distance` are
 * in the vocabulary but OUT of the default (the model requests them when the
 * camper's question implies them).
 */
export const DEFAULT_COMPARE_CRITERIA: CriterionId[] = ['price', 'capacity', 'family', 'verified', 'rating'];

/** The 3 CAM-464 facet criteria — the only members that read `computeFacetScores` instead of an atomic field. */
const FACET_CRITERION_IDS: readonly CriterionId[] = ['family', 'beginner', 'road_access'];

export const compareCampsArgsSchema = z.object({
  // Per-id uuid guard only; the semantic 2..MAX_COMPARE_CAMPS bound lives in
  // executeCompareCamps (de-dup must run BEFORE the count — CAM-344; a bare
  // zod .min(2).max(4) cannot de-dup first).
  campIds: z.array(z.string().uuid()).min(1),
  // An unknown criterion -> invalid_args (via dispatchTool), NO read (BR-4).
  criteria: z.array(z.enum(CRITERION_IDS)).optional(),
});

export type CompareCampsArgs = z.infer<typeof compareCampsArgsSchema>;

/** Decision 3 — atomic price cells (api.md rule 4): NEVER a merged "฿1,250" string. */
export interface ComparePrice {
  /** = priceLow, the "from" price (CAM-470 honesty label). */
  startingPrice: number | null;
  priceHigh: number | null;
  currency: string;
  isFree: boolean;
  /** One-time additive fee (e.g. park entrance), same currency as above. */
  extraFeeAmount: number | null;
  extraFeeLabel: string | null;
  feeInfo: string | null;
}

/** Decision 1 (capacity sub-decision) — the EFFECTIVE capacity (getEffectiveCapacity), never the raw column. */
export interface CompareCapacity {
  maxGuestsPerDay: number | null;
  maxTentsPerDay: number | null;
}

export interface CompareRating {
  avgRating: number | null;
  reviewCount: number;
}

export interface CompareVerified {
  isVerified: boolean;
}

/** Atomic amenity list (code + localized name) — never a merged facilities string. */
export interface CompareFacilities {
  amenities: CampAmenity[];
}

export interface CompareCancellation {
  /** `null` = host has not set a policy yet (never inferred/guessed — ADR-003). */
  policy: CancellationPolicyValue | null;
}

export interface CompareDistance {
  /** `null` when lat/lng is missing — never treated as 0km. */
  distanceFromBangkokKm: number | null;
}

/**
 * Decision 3 — ONLY the requested criteria are populated on a given camp's
 * cells. A facet key present with value `null` = the honest "ไม่มีข้อมูล"
 * cell (the facet was requested but `computeFacetScores` produced no
 * evidence for it) — never a fabricated value or a fake 0-score (EC-4).
 */
export interface ComparisonCells {
  price?: ComparePrice;
  capacity?: CompareCapacity;
  rating?: CompareRating;
  verified?: CompareVerified;
  facilities?: CompareFacilities;
  cancellation_policy?: CompareCancellation;
  distance?: CompareDistance;
  family?: FacetScore | null;
  beginner?: FacetScore | null;
  road_access?: FacetScore | null;
}

export interface ComparisonCamp {
  id: string;
  nameTh: string;
  nameEn: string | null;
  cells: ComparisonCells;
}

/**
 * Decision 3/4 — discriminated union (api.md §11); `ok:false` never
 * fabricates a comparison. This shape carries no comparative-judgment field
 * of any kind (P13 honesty, BR-5) — the model phrases any recommendation
 * from the returned evidence.
 */
export type CompareCampsResult =
  // camps ordered by the INPUT ids (stable), visible only
  | { ok: true; criteria: CriterionId[]; camps: ComparisonCamp[] }
  | { ok: false; reason: 'too_few' | 'too_many' | 'insufficient_visible' | 'error' };

/**
 * Decision 1 — guest-safe ONLY (no operator/contact/payout/KYC field, PDPA,
 * mirrors the CAM-427/CAM-449 boundary). A dedicated, lean select — never
 * `getCampDetail`'s heavier one (which also pulls reviews + drives the
 * per-weekend availability computation this comparison does not need).
 */
const compareCampsSelect = {
  id: true,
  nameTh: true,
  nameEn: true,
  priceLow: true,
  priceHigh: true,
  priceCurrency: true,
  isFree: true,
  extraFeeAmount: true,
  extraFeeLabel: true,
  feeInfo: true,
  useSpotView: true,
  maxGuestsPerDay: true,
  maxTentsPerDay: true,
  avgRating: true,
  reviewCount: true,
  isVerified: true,
  cancellationPolicy: true,
  latitude: true,
  longitude: true,
  minimumAge: true,
  options: { select: { code: true, group: true, nameTh: true, nameEn: true, icon: true } },
} satisfies Prisma.CampSiteSelect;

type CompareCampsRow = Prisma.CampSiteGetPayload<{ select: typeof compareCampsSelect }>;

interface CriterionCellContext {
  row: CompareCampsRow;
  /** Only populated when `capacity` was actually requested (bounded Promise.all, Decision 1). */
  effectiveCapacity: EffectiveCapacity | undefined;
  /** Only computed when a facet criterion was actually requested. */
  facets: FacetScore[];
}

/**
 * Decision 2 confirmation — a `satisfies Record<CriterionId, …>` mapping
 * table: a criterion added to `CRITERION_IDS` with no builder here fails
 * `tsc`, never a silent gap. Each builder returns ONLY its own key
 * (Decision 3 — "ONLY the requested criteria are populated").
 */
const CRITERION_CELL_BUILDERS = {
  price: ({ row }) => ({
    price: {
      startingPrice: row.priceLow ? row.priceLow.toNumber() : null,
      priceHigh: row.priceHigh ? row.priceHigh.toNumber() : null,
      currency: row.priceCurrency,
      isFree: row.isFree,
      extraFeeAmount: row.extraFeeAmount ? row.extraFeeAmount.toNumber() : null,
      extraFeeLabel: row.extraFeeLabel,
      feeInfo: row.feeInfo,
    },
  }),
  capacity: ({ effectiveCapacity }) => ({
    capacity: {
      maxGuestsPerDay: effectiveCapacity?.maxGuestsPerDay ?? null,
      maxTentsPerDay: effectiveCapacity?.maxTentsPerDay ?? null,
    },
  }),
  rating: ({ row }) => ({
    rating: { avgRating: row.avgRating ? row.avgRating.toNumber() : null, reviewCount: row.reviewCount },
  }),
  verified: ({ row }) => ({ verified: { isVerified: row.isVerified } }),
  facilities: ({ row }) => ({ facilities: { amenities: row.options } }),
  cancellation_policy: ({ row }) => ({ cancellation_policy: { policy: row.cancellationPolicy } }),
  distance: ({ row }) => ({
    distance: { distanceFromBangkokKm: distanceFromBangkokKm(row.latitude, row.longitude) },
  }),
  // Every facet cell = facets.find(f => f.facet === criterion) ?? null — a
  // facet ABSENT from computeFacetScores (BR-5, never a fake 0-score) yields
  // the honest null cell (EC-4).
  family: ({ facets }) => ({ family: facets.find((f) => f.facet === 'family') ?? null }),
  beginner: ({ facets }) => ({ beginner: facets.find((f) => f.facet === 'beginner') ?? null }),
  road_access: ({ facets }) => ({ road_access: facets.find((f) => f.facet === 'road_access') ?? null }),
} satisfies Record<CriterionId, (ctx: CriterionCellContext) => ComparisonCells>;

const jsonSchema = {
  type: 'object',
  properties: {
    campIds: {
      type: 'array',
      items: {
        type: 'string',
        description: 'A CampSite id (UUID) — resolve from the campIds already shown to the camper this conversation, never invent one.',
      },
      description: `The 2-${MAX_COMPARE_CAMPS} campIds to compare.`,
    },
    criteria: {
      type: 'array',
      items: { type: 'string', enum: CRITERION_IDS },
      description: `Which comparison columns to include. Omit for the default set (${DEFAULT_COMPARE_CRITERIA.join(', ')}).`,
    },
  },
  required: ['campIds'],
  additionalProperties: false,
} as const;

export async function executeCompareCamps(args: CompareCampsArgs): Promise<CompareCampsResult> {
  // Decision 4/BR-2 (CAM-344) — de-dup FIRST, then bound; both O(1)
  // in-memory, BEFORE any DB read. Over-cap is REFUSED, never truncated
  // (AC-4/EC-1); under-2 is refused too (EC-2 neighbour).
  const ids = [...new Set(args.campIds)];
  if (ids.length < 2) return { ok: false, reason: 'too_few' };
  if (ids.length > MAX_COMPARE_CAMPS) return { ok: false, reason: 'too_many' };

  const criteria = args.criteria?.length ? [...new Set(args.criteria)] : DEFAULT_COMPARE_CRITERIA;

  try {
    // Decision 1 — the CAM-469 visibility gate baked in verbatim; an id that
    // fails it is simply absent from `rows` (no existence oracle, AC-5/EC-3).
    const rows = await prisma.campSite.findMany({
      where: { id: { in: ids }, isActive: true, isPublished: true, deletedAt: null },
      select: compareCampsSelect,
    });

    // AC-5/EC-2/EC-3 — a shortfall below 2 visible camps is an honest
    // AGGREGATE refuse; never a per-id "dropped" list (no existence oracle).
    if (rows.length < 2) return { ok: false, reason: 'insufficient_visible' };

    // Decision 1 (capacity sub-decision) — EFFECTIVE capacity, a bounded
    // Promise.all over <= MAX_COMPARE_CAMPS rows, computed ONLY when
    // `capacity` was actually requested.
    const effectiveCapacityById = new Map<string, EffectiveCapacity>();
    if (criteria.includes('capacity')) {
      const results = await Promise.all(
        rows.map((row) =>
          getEffectiveCapacity(prisma, {
            id: row.id,
            useSpotView: row.useSpotView,
            maxGuestsPerDay: row.maxGuestsPerDay,
            maxTentsPerDay: row.maxTentsPerDay,
          })
        )
      );
      rows.forEach((row, i) => effectiveCapacityById.set(row.id, results[i]));
    }

    const needsFacets = criteria.some((c) => FACET_CRITERION_IDS.includes(c));
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    // `camps` is ordered by the INPUT ids (stable) so the model's "ลานที่
    // 1/2" ordinals line up; visible-only — an id absent from `rows` is
    // simply skipped (no existence oracle).
    const orderedIds = ids.filter((id) => rowsById.has(id));

    const camps: ComparisonCamp[] = orderedIds.map((id) => {
      const row = rowsById.get(id)!;
      // Pure, synchronous, zero query (same call getCampDetail makes) —
      // computed only when a facet criterion was actually requested.
      const facets = needsFacets
        ? computeFacetScores({
            options: row.options.map((o) => ({ code: o.code, group: o.group })),
            minimumAge: row.minimumAge,
          })
        : [];

      const cells: ComparisonCells = {};
      for (const criterion of criteria) {
        Object.assign(
          cells,
          CRITERION_CELL_BUILDERS[criterion]({ row, effectiveCapacity: effectiveCapacityById.get(row.id), facets })
        );
      }

      return { id: row.id, nameTh: row.nameTh, nameEn: row.nameEn, cells };
    });

    return { ok: true, criteria, camps };
  } catch {
    // A live-read throw NEVER fabricates a comparison; refuse honestly
    // (mirrors bulkAvailability's `reason:'error'`).
    return { ok: false, reason: 'error' };
  }
}

export const compareCampsTool: ToolDefinition<CompareCampsArgs, CompareCampsResult> = {
  name: 'compareCamps',
  description:
    `Compare 2-${MAX_COMPARE_CAMPS} published CampVibe campsites side by side on named criteria. Resolve campIds from the camps already shown to the camper this conversation — never invent an id. ` +
    `criteria is one or more of: ${CRITERION_IDS.join(', ')} — omit for the default set (${DEFAULT_COMPARE_CRITERIA.join(', ')}). ` +
    'The result is VALUES + evidence only — no comparative-judgment field is included. Phrase any recommendation yourself, grounded ONLY in the returned evidence; when a cell is null/absent, say the data is insufficient for that criterion, never guess. ' +
    "For family/beginner/road_access, answer ONLY from a facet's `evidence`; for road_access, never claim a sedan specifically can enter (the source field cannot distinguish vehicle class).",
  // Public comparison data over already-shown published camps — offered to every caller, same tier as getCampDetail/bulkAvailability.
  tier: 'guest',
  parameters: compareCampsArgsSchema,
  jsonSchema,
  // No caller identity needed; `_ctx` is server-bound and unused here.
  execute: (args, _ctx) => executeCompareCamps(args),
};
