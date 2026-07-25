/**
 * CAM-465 (tech.md — all 6 G2 decisions) — the `bulkAvailability` read-only AI
 * tool: a candidate-camp FILTER (a subset of `searchCampsites`' arg shape) +
 * a date-SET (`DateRange[]`, the `resolveDates` output, CAM-462) -> a camp x
 * range LIVE availability matrix, computed by the SAME batched core
 * `searchCampsites`' "เหลือ N ที่" already uses
 * (`getRemainingCapacityForCamps`, CAM-427) — one call PER RANGE, never
 * per-camp (ADR-009 no-forked-data-path, Decision 4).
 *
 * HARD CAP (Decision 2, CAM-344, load-bearing) — two independent dimensions,
 * asymmetric BY DESIGN, both bound/checked BEFORE any batched read:
 *  - RANGES (a model-controlled array) -> REFUSE over `MAX_DATE_SET_RANGES`
 *    (12, reused from resolve-dates.ts) — checked O(1), BEFORE the candidate
 *    query even runs. A partial date-set would silently answer a DIFFERENT
 *    question ("which of SOME weekends"), so this dimension never truncates.
 *  - CANDIDATE CAMPS (a filter-RESULT page, not an enumerated list) ->
 *    take-BOUND to `SEARCH_CAMPSITES_MAX_RESULTS` (10, reused from
 *    search-campsites.ts), never refused — the SAME top-N contract
 *    `searchCampsites` already ships (a complete, honest answer to a filter).
 *  - `cells <= 120` is a STRUCTURAL invariant of the two caps above (10 x 12)
 *    — no separate runtime cell-count guard is needed for filter-only input.
 *  - The per-range `MAX_STATUS_RANGE_NIGHTS` (366) guard is inherited for
 *    free one layer down inside `getRemainingCapacityForCamps` (EC-6).
 *
 * VISIBILITY GATE inherited for free (Decision 3/BR-4, CAM-469): the
 * candidate set is resolved via `buildCampSiteWhere`, which ALREADY gates
 * `isActive`/`isPublished`/`deletedAt` — there is no ungated `campId[]`
 * surface in v1 (deferred explicitly, tech.md Decision 3 phase-2 contract).
 *
 * LIVE ONLY (Decision 1, BR-2, ADR-009): every call recomputes fresh from
 * Booking/InternalHold/BlockedDate; never cached, never a materialized read.
 * No new schema, no migration — this file is CODE only (a reader).
 */
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { buildCampSiteWhere } from '@/lib/campsite-filters';
import { aiCampCardSelect, toAiCampCard, type AiCampCard } from '@/lib/read-models/ai-camp-card';
import { getRemainingCapacityForCamps, type RemainingCapacityResult } from '@/lib/campsite-availability';
import { VALID_SORTS, orderByFor } from '@/lib/catalog-cursor';
import { resolveRegionForSearch } from '@/lib/thai-regions';
import { MAX_DATE_SET_RANGES, type DateRange } from '@/lib/ai/tools/resolve-dates';
import { SEARCH_CAMPSITES_MAX_RESULTS, type SearchCampsiteCard } from '@/lib/ai/tools/search-campsites';
import type { ToolDefinition } from '@/lib/ai/tool-registry';

/** Same "is this a real calendar date" check every sibling tool uses (search-campsites.ts, check-availability.ts) — no new validation concept. */
const isoDate = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
  message: 'Invalid date',
});

/**
 * Duplicated verbatim from `search-campsites.ts` (CAM-408 BR-3, kept in sync
 * for the CAM-513 (S1) 8-code Terrain expansion and the CAM-514 (S2) 2-code
 * Facility expansion) — the real MasterData taxonomy codes. NOT re-exported
 * from that file (kept module-private there), so the code LIST is repeated
 * here rather than importing a private symbol from a sibling tool; this is
 * the same taxonomy vocabulary, not a new concept (ADR-009). If a 3rd tool
 * needs these, extracting them to a shared module is a follow-up, not
 * required by this atomic story.
 */
const TERRAIN_CODES = [
  'BEAC', 'FORE', 'RIVE', 'MTNS',
  'SEA', 'COAS', 'LAKE', 'WATF', 'SWMH', 'FILD', 'CAVE', 'FARM',
] as const;
const ACCESS_CODES = ['BAOT', 'DRIV', 'HIKE', 'WALK'] as const;
const ACTIVITY_CODES = ['SWIM', 'HIKI', 'SURF', 'FISH', 'WILD', 'BOAT', 'HORS', 'OFFR', 'LIVE', 'CLIM'] as const;
const FACILITY_CODES = [
  'SHOW', 'TOIL', 'PICN', 'WIFI', 'TRAS', 'SANI', 'POTA', 'ELEC', 'WATE', 'SINK',
  'CART', 'MIMT', 'GRIL', 'CAFE', 'REST', 'FEIC', 'FEDW',
  'HOTW', 'LIGT',
] as const;
/**
 * CAM-515 (S3) — the 5 real `Annotated features` MasterData codes, kept in
 * sync with `search-campsites.ts`'s own `ANNOTATED_CODES` (same
 * not-re-exported, repeated-list discipline as the other taxonomy consts
 * above — see the file-header comment).
 */
const ANNOTATED_CODES = ['ALCO', 'FIRE', 'FIWD', 'ADAA', 'RESV'] as const;
/**
 * CAM-516 (S4) — the 4 real `Camper style` MasterData codes, kept in sync
 * with `search-campsites.ts`'s own `CAMPER_STYLE_CODES` (same discipline as
 * ANNOTATED_CODES above).
 */
const CAMPER_STYLE_CODES = ['CHIC', 'GENR', 'DIFT', 'IDMT'] as const;

/**
 * BR-1 (tech.md Decision 3) — a candidate-camp FILTER (the same vocabulary
 * `searchCampsites` already validates) + `dates: DateRange[]` (the
 * `resolveDates` output, passed straight through). No raw `campId[]` in v1
 * (BR-4 — visibility inherited for free, no ungated surface to gate).
 *
 * `dates` has NO zod `.max()` — the `MAX_DATE_SET_RANGES` cap is enforced in
 * `execute` as a graceful `{ ok:false, reason:'over_cap' }` refuse (AC-5),
 * never a hard `invalid_args` validation failure (CAM-344: cap the array
 * BEFORE the query, but surface it as the tool's own honest result shape).
 *
 * NOTE (deliberate v1 scope-cut): unlike `searchCampsites`, `province` is NOT
 * run through the Thai-character `ThailandLocation` DB resolution helper —
 * that helper is private to search-campsites.ts (not exported) and no AC
 * here requires it; an English province value passes through unchanged to
 * `buildCampSiteWhere`'s existing string-equality contract, same as every
 * other catalog caller that never resolves Thai names.
 */
export const bulkAvailabilityArgsSchema = z.object({
  province: z.string().trim().min(1).max(100).optional(),
  region: z.string().trim().min(1).max(50).optional(),
  type: z.string().trim().min(1).max(20).optional(),
  keyword: z.string().trim().min(1).max(100).optional(),
  priceMin: z.number().nonnegative().optional(),
  priceMax: z.number().nonnegative().optional(),
  petFriendly: z.boolean().optional(),
  terrain: z.enum(TERRAIN_CODES).or(z.array(z.enum(TERRAIN_CODES))).optional(),
  access: z.enum(ACCESS_CODES).or(z.array(z.enum(ACCESS_CODES))).optional(),
  activities: z.enum(ACTIVITY_CODES).or(z.array(z.enum(ACTIVITY_CODES))).optional(),
  facilities: z.enum(FACILITY_CODES).or(z.array(z.enum(FACILITY_CODES))).optional(),
  /** CAM-515 (S3) — mirrors search-campsites.ts's own field (OR-within-group, CAM-461 Decision 4). */
  annotatedFeatures: z.enum(ANNOTATED_CODES).or(z.array(z.enum(ANNOTATED_CODES))).optional(),
  /** CAM-516 (S4) — mirrors search-campsites.ts's own field (OR-within-group, CAM-461 Decision 4). */
  camperStyle: z.enum(CAMPER_STYLE_CODES).or(z.array(z.enum(CAMPER_STYLE_CODES))).optional(),
  sort: z.enum(VALID_SORTS).optional(),
  /** BR-7 — the party size a cell is judged "free" against; default 1 (applied in executeBulkAvailability below). A projection comparison only, never a candidate-set filter. */
  guests: z.number().int().positive().optional(),
  dates: z.array(z.object({ startDate: isoDate, endDate: isoDate })).min(1),
});

export type BulkAvailabilityArgs = z.infer<typeof bulkAvailabilityArgsSchema>;

/**
 * BR-5 (tech.md Decision 5) — a projection over `RemainingCapacityResult`,
 * no new availability math. `full` when numerically full OR host-blocked OR
 * below the requested party size; `free` carries the live remaining count;
 * `unknown` when capacity is unbounded-and-unblocked (`remaining === null`)
 * or the whole range fail-opened (EC-6 — every camp gets `unknown` for that
 * one column, the other columns are unaffected).
 */
export type CellStatus =
  | { status: 'free'; remaining: number }
  | { status: 'full' }
  | { status: 'unknown' };

/** `cells[i]` corresponds to `ranges[i]` in the result — SAME order, positional (Decision 5). */
export interface BulkAvailabilityCamp extends AiCampCard {
  cells: CellStatus[];
}

/** BR-1/BR-6 — discriminated result (api.md §11); `ok:false` never fabricates a check that didn't run. */
export type BulkAvailabilityResult =
  | {
      ok: true;
      /** Echoes the queried date-set — defines the column order every camp's `cells` array aligns to. */
      ranges: { startDate: string; endDate: string }[];
      /** EVERY candidate camp is present (AC-2) — a camp full for every range still appears, never omitted. */
      camps: BulkAvailabilityCamp[];
      /**
       * CAM-485 BR-1 — top-level, tappable cards (additive, `camps` above is
       * UNCHANGED): only the camps that have >=1 `free` cell, each carrying
       * `remaining` from that camp's FIRST free cell (deterministic — a
       * multi-range ask never averages/aggregates). A camp full/unknown
       * across every range is correctly omitted here (EC-1) even though it
       * still appears in `camps`. Built from data already queried above
       * (`aiCampCardSelect` + `toAiCampCard`) — no extra query.
       */
      cards: SearchCampsiteCard[];
    }
  | { ok: false; reason: 'over_cap' | 'no_match' | 'error' };

const jsonSchema = {
  type: 'object',
  properties: {
    province: {
      type: 'string',
      description:
        'Province name in English, to filter candidate campsites. ' +
        'OPTIONAL — set this ONLY when the camper has explicitly named a specific province, either in this message or earlier in this conversation. ' +
        'NEVER infer, guess, or default a province from a terrain/region/facility/activity word — leave this field unset and use `terrain`/`region`/the other filters instead.',
    },
    region: {
      type: 'string',
      description:
        'A Thai geographic region (ภาค) the camper asked about, e.g. "ภาคเหนือ", "อีสาน", "ภาคใต้" — resolved server-side to every province in that region. If BOTH province and region are given, province wins.',
    },
    type: { type: 'string', description: 'Camp site type code, e.g. CAGD, GLAMP, LAKE' },
    keyword: { type: 'string', description: 'A specific campsite NAME for an exact-phrase match.' },
    priceMin: { type: 'number', description: 'Minimum nightly price in THB' },
    priceMax: { type: 'number', description: 'Maximum nightly price in THB' },
    petFriendly: { type: 'boolean', description: 'Only include pet-friendly camps when true' },
    terrain: { type: 'string', enum: TERRAIN_CODES, description: 'Terrain filter — pick ONE, or an array for OR-within-group.' },
    access: { type: 'string', enum: ACCESS_CODES, description: 'Access filter — pick ONE, or an array for OR-within-group.' },
    activities: { type: 'string', enum: ACTIVITY_CODES, description: 'Activity filter — pick ONE, or an array for OR-within-group.' },
    facilities: { type: 'string', enum: FACILITY_CODES, description: 'Facility filter — pick ONE, or an array for OR-within-group.' },
    annotatedFeatures: { type: 'string', enum: ANNOTATED_CODES, description: 'Annotated-feature (rule/right) filter — ALCO alcohol-allowed, FIRE fires-allowed, FIWD firewood, ADAA wheelchair-accessible, RESV reservable — pick ONE, or an array for OR-within-group.' },
    camperStyle: { type: 'string', enum: CAMPER_STYLE_CODES, description: 'Camper-style (host-declared vibe) filter — CHIC สบาย (สายคุณหนู), GENR ทั่วไป, DIFT ลำบาก, IDMT ทรหด — pick ONE, or an array for OR-within-group.' },
    sort: { type: 'string', enum: VALID_SORTS, description: 'How to order the candidate camps (default: related).' },
    guests: { type: 'number', description: 'Party size a cell is judged "free" against (default 1).' },
    dates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Stay start date (check-in), ISO 8601' },
          endDate: { type: 'string', description: 'Stay checkout date (EXCLUSIVE), ISO 8601' },
        },
        required: ['startDate', 'endDate'],
      },
      description:
        `The date-SET to check, e.g. the exact output of the resolveDates tool. Pass 1 to ${MAX_DATE_SET_RANGES} ranges; over the cap the tool refuses and asks the camper to narrow the dates.`,
    },
  },
  required: ['dates'],
  additionalProperties: false,
} as const;

/** BR-5 projection — a missing/unknown result (e.g. this range fail-opened, EC-6) is `unknown`, never fabricated as free. */
function projectCell(result: RemainingCapacityResult | undefined, guests: number): CellStatus {
  if (!result || result.remaining === null) {
    return { status: 'unknown' };
  }
  if (result.blockedByHost || result.remaining === 0 || result.remaining < guests) {
    return { status: 'full' };
  }
  return { status: 'free', remaining: result.remaining };
}

export async function executeBulkAvailability(args: BulkAvailabilityArgs): Promise<BulkAvailabilityResult> {
  // Decision 2/BR-3/EC-3 — RANGES is the model-controlled array: refuse BEFORE
  // ANY DB call (O(1) check, before buildCampSiteWhere/findMany even runs).
  if (args.dates.length > MAX_DATE_SET_RANGES) {
    return { ok: false, reason: 'over_cap' };
  }

  // Decision 3 — province wins over region when both are given (same rule
  // searchCampsites uses); region expands via the pure, synchronous
  // resolveRegionForSearch (no DB round-trip, unlike the Thai-province
  // resolver this tool deliberately does not call — see the schema doc note).
  let provinceFilter: string | string[] | undefined;
  if (args.province !== undefined) {
    provinceFilter = args.province;
  } else if (args.region !== undefined) {
    provinceFilter = resolveRegionForSearch(args.region);
  }

  // Decision 3/BR-4 — buildCampSiteWhere ALREADY gates isActive/isPublished/
  // deletedAt (CAM-469 visibility, inherited for free, AC-6/EC-5).
  const where = buildCampSiteWhere({
    province: provinceFilter,
    type: args.type,
    keyword: args.keyword,
    min: args.priceMin !== undefined ? String(args.priceMin) : undefined,
    max: args.priceMax !== undefined ? String(args.priceMax) : undefined,
    petFriendly: args.petFriendly,
    terrain: args.terrain,
    access: args.access,
    activities: args.activities,
    facilities: args.facilities,
    annotatedFeatures: args.annotatedFeatures,
    camperStyle: args.camperStyle,
  });

  // Decision 2/BR-3 — CANDIDATE CAMPS is a filter-RESULT page: take-BOUND,
  // never refused (the same top-N contract searchCampsites already ships).
  const rows = await prisma.campSite.findMany({
    where,
    select: aiCampCardSelect,
    orderBy: orderByFor(args.sort ?? 'related'),
    take: SEARCH_CAMPSITES_MAX_RESULTS,
  });

  // AC-4/EC-2 — an empty candidate set is an honest no_match; NO availability
  // query runs (never a fabricated { ok:true, camps: [] }).
  if (rows.length === 0) {
    return { ok: false, reason: 'no_match' };
  }

  const cards = rows.map(toAiCampCard);
  const campIds = cards.map((c) => c.id);
  const guests = args.guests ?? 1; // BR-7

  const cellsByCampId = new Map<string, CellStatus[]>();
  for (const id of campIds) cellsByCampId.set(id, []);

  try {
    // Decision 4 — ONE getRemainingCapacityForCamps call PER RANGE (never
    // per-camp): O(rangeCount) queries total (<= 1 + 5x12 = 61), building the
    // matrix column-by-range. A range that fail-opens (EC-6, e.g. a
    // degenerate/absurd single range) returns {} — every camp's cell for
    // THAT range only becomes 'unknown'; the loop continues to the next range.
    for (const range of args.dates as DateRange[]) {
      const start = new Date(range.startDate);
      const end = new Date(range.endDate);
      const remainingByCampId = await getRemainingCapacityForCamps(campIds, start, end);

      for (const id of campIds) {
        cellsByCampId.get(id)!.push(projectCell(remainingByCampId[id], guests));
      }
    }
  } catch {
    // EC-4/BR-6 — a live-read throw NEVER fabricates "free"; refuse honestly.
    return { ok: false, reason: 'error' };
  }

  // CAM-485 BR-1 — top-level `cards[]`: only camps with >=1 free cell,
  // `remaining` from the FIRST free cell (deterministic). Reuses the SAME
  // `cards` (AiCampCard[]) already queried above — no second query.
  const availableCards: SearchCampsiteCard[] = [];
  for (const card of cards) {
    const cells = cellsByCampId.get(card.id) ?? [];
    const firstFree = cells.find(
      (cell): cell is Extract<CellStatus, { status: 'free' }> => cell.status === 'free'
    );
    if (firstFree) availableCards.push({ ...card, remaining: firstFree.remaining });
  }

  return {
    ok: true,
    ranges: args.dates.map((r) => ({ startDate: r.startDate, endDate: r.endDate })),
    // AC-2/AC-3/EC-1 — every candidate camp row is emitted, full-everywhere
    // camps included; per-range status is preserved, never collapsed.
    camps: cards.map((card) => ({ ...card, cells: cellsByCampId.get(card.id) ?? [] })),
    cards: availableCards,
  };
}

export const bulkAvailabilityTool: ToolDefinition<BulkAvailabilityArgs, BulkAvailabilityResult> = {
  name: 'bulkAvailability',
  description:
    'Check LIVE availability for MANY published CampVibe campsites across MULTIPLE date ranges in ONE call — use this instead of calling checkAvailability repeatedly when the camper asks about several dates or wants to know which camps (matching a filter) are free. ' +
    // CAM-505 — names the ONE-camp-many-dates case explicitly: even one
    // named camp still routes here (via `keyword`) once the question spans
    // multiple candidate dates or asks a superlative ("which date is best").
    'This also applies to ONE specific named camp when the question spans multiple candidate dates or asks a superlative ("which Saturday is freest") — set `keyword` to that camp\'s name rather than calling checkAvailability once per date. ' +
    `Accepts a candidate-camp filter (same vocabulary as searchCampsites) plus a \`dates\` array (pass the resolveDates tool's output directly, up to ${MAX_DATE_SET_RANGES} ranges — over that the tool refuses and asks to narrow the dates). ` +
    `Returns at most ${SEARCH_CAMPSITES_MAX_RESULTS} candidate camps (the top matches for the filter) x every requested range, with each cell free/full/unknown. A camp full for every range is still shown, never omitted.`,
  // Read-only, no identity needed — same tier as searchCampsites/checkAvailability/resolveDates.
  tier: 'guest',
  parameters: bulkAvailabilityArgsSchema,
  jsonSchema,
  execute: (args, _ctx) => executeBulkAvailability(args),
};
