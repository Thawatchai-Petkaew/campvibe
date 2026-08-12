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
 *
 * CAM-716 — retires the deliberate v1 scope-cut on location: adds `near`
 * (proximity search, the SAME centroid/landmark/radius machinery
 * `searchCampsites` uses, shared via `lib/geo/province-proximity.ts`) and an
 * `appliedFilters` echo + per-card `matchedTag` (shared via
 * `lib/ai/tools/taxonomy-tags.ts`) so a date-led search never silently drops
 * the place the camper named — the root cause of the owner-reported
 * incident (2026-08-08): "แนะนำลานกางเต้นท์ติดริมแม่น้ำ แถวๆสระบุรี
 * เข้าพักเสาร์หน้า" returned Yala camps under a sentence claiming แถวสระบุรี.
 */
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { buildCampSiteWhere, resolveProvinceAdminAreaIds } from '@/lib/campsite-filters';
import { aiCampCardSelect, toAiCampCard, type AiCampCard } from '@/lib/read-models/ai-camp-card';
import { getRemainingCapacityForCamps, type RemainingCapacityResult } from '@/lib/campsite-availability';
import { VALID_SORTS, orderByFor } from '@/lib/catalog-cursor';
import { resolveRegionForSearch } from '@/lib/thai-regions';
import { MAX_NEAR_KM, resolveNearOrigin, rankCampsiteIdsByProximity } from '@/lib/geo/province-proximity';
import { deriveMatchedTags, buildTaxonomyEcho, type AppliedTaxonomyFilter } from '@/lib/ai/tools/taxonomy-tags';
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
 * NOTE (deliberate v1 scope-cut, `province` ONLY): unlike `searchCampsites`,
 * `province` is NOT run through the Thai-character `AdminArea`-based
 * Thai/English resolution — an English province value passes through
 * unchanged to `buildCampSiteWhere`'s existing string-equality contract,
 * same as every other catalog caller that never resolves Thai names. CAM-716
 * deliberately does NOT extend this cut to `near` below: `near` is a brand
 * new capability on this tool, and BR-1 mandates it carry the SAME full
 * Thai/English semantics `searchCampsites`'s own `near` already has (via the
 * shared `resolveNearOrigin`) — so the asymmetry between `province` (still
 * English-only) and `near` (Thai+English) is intentional, not an oversight.
 */
export const bulkAvailabilityArgsSchema = z.object({
  province: z.string().trim().min(1).max(100).optional(),
  /**
   * CAM-716 BR-1 — proximity search: "ใกล้/แถว X" is NOT the same as
   * `province` ("ใน X" exact-inside only) — this returns camps NEAR X
   * (including camps IN X), nearest-first. Reuses the EXACT same
   * centroid/landmark/radius-cap machinery `searchCampsites`'s own `near`
   * already uses (`lib/geo/province-proximity.ts`, shared — never a second
   * port). Wins over `province`/`region` when set (mirrors
   * `searchCampsites`'s own precedence).
   */
  near: z.string().trim().min(1).max(100).optional(),
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

/**
 * CAM-716 BR-3 — the honest "why these camps" echo, mirroring
 * `SearchCampsitesAppliedFilters` (search-campsites.ts, CAM-709) minus the
 * dimensions bulkAvailability does not offer this round (`district`/
 * `subDistrict`, out of scope — see story.md). Present ONLY when that
 * dimension actually constrained THIS call; `taxonomy` is always present
 * (possibly `[]`).
 */
export interface BulkAvailabilityAppliedFilters {
  province?: string;
  near?: string;
  region?: string;
  type?: string;
  keyword?: string;
  priceMin?: number;
  priceMax?: number;
  /** Present only when `true` — a `false`/absent value never constrained the query. */
  petFriendly?: true;
  sort?: (typeof VALID_SORTS)[number];
  taxonomy: AppliedTaxonomyFilter[];
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
       *
       * CAM-716 BR-4 — each card now also carries `matchedTag` (via the
       * shared `deriveMatchedTags`), the SAME per-card taxonomy badge
       * `searchCampsites` cards carry (AC-3 parity).
       */
      cards: SearchCampsiteCard[];
      /** CAM-716 BR-3 — additive (api.md rule 12): the honest "why these camps" echo, see `BulkAvailabilityAppliedFilters` above. Always present on an `ok:true` result. */
      appliedFilters: BulkAvailabilityAppliedFilters;
    }
  | {
      ok: false;
      reason: 'over_cap' | 'no_match' | 'error';
      /**
       * CAM-716 EC-2 — additive/optional: present ONLY when this call's own
       * `near` argument was set and the candidate set (near-filtered or its
       * EC-3 province fallback) came back empty, so the honest-zero reason
       * sentence can still name the place truthfully instead of falling
       * back to the model's own memory of the argument it passed (the exact
       * CAM-500-class risk this story closes). The pre-existing
       * province/region-only `no_match` path is UNCHANGED — no `near` set
       * means no `appliedFilters`, byte-identical to before this story.
       */
      appliedFilters?: BulkAvailabilityAppliedFilters;
    };

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
    near: {
      type: 'string',
      description:
        'Province name (Thai or English) for a PROXIMITY search — use this instead of `province` when the camper asks for camps NEAR/AROUND a province rather than strictly inside it (e.g. "ลานกางเต็นท์ใกล้กรุงเทพ", "แคมป์แถวโคราช"). Returns camps around that province (including camps in it), sorted nearest-first. Do NOT set `province` at the same time for the same place — use `near` alone. ' +
        'ALSO accepts a well-known landmark/area name (a national park, mountain, or popular camping region that spans multiple provinces, e.g. "เขาใหญ่", "ปาย") — no proximity word needed for a landmark. Never set `province` for a landmark that spans multiple provinces.',
    },
    region: {
      type: 'string',
      description:
        'A Thai geographic region (ภาค) the camper asked about, e.g. "ภาคเหนือ", "อีสาน", "ภาคใต้" — resolved server-side to every province in that region. If BOTH province and region are given, province wins.',
    },
    type: {
      type: 'string',
      description:
        'Camp site type code — CAGD (ลานกางเต็นท์ทั่วไป), CACP (รถเต็นท์), GLAMP (กลามปิ้ง — เต็นท์เซ็ตพร้อม สะดวกสบาย ไม่ต้องแบกอุปกรณ์), VIEW (จุดวิวสวย), LAKE, FOREST. ' +
        'Trigger words: "แกลมปิ้ง"/"กลามปิ้ง"/"glamping" → GLAMP; "วิวสวย"/"วิวดี" → VIEW. Single value only (not an array).',
    },
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
    sort: { type: 'string', enum: VALID_SORTS, description: 'How to order the candidate camps (default: related). Ignored when `near` is set (a proximity search is always ordered by distance).' },
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

/**
 * CAM-716 — the ONE resolved location dimension that actually constrained
 * this call, mirroring `search-campsites.ts`'s own `AppliedLocationFilter`
 * (minus `district`, out of scope this round — see story.md).
 */
type BulkAppliedLocationFilter =
  | { kind: 'near'; value: string }
  | { kind: 'province'; value: string }
  | { kind: 'region'; value: string };

/**
 * CAM-716 BR-3 — assembles the `appliedFilters` echo from the args that
 * genuinely constrained this call, mirroring `search-campsites.ts`'s own
 * `buildAppliedFilters` (CAM-709). `type` guards against the literal `'ALL'`
 * sentinel some callers use for "no type filter", same as search's own rule.
 */
async function buildBulkAppliedFilters(
  args: BulkAvailabilityArgs,
  location: BulkAppliedLocationFilter | undefined,
  sortApplied: boolean
): Promise<BulkAvailabilityAppliedFilters> {
  const filters: BulkAvailabilityAppliedFilters = { taxonomy: [] };

  if (location?.kind === 'near') filters.near = location.value;
  if (location?.kind === 'province') filters.province = location.value;
  if (location?.kind === 'region') filters.region = location.value;

  if (args.type !== undefined && args.type !== 'ALL') filters.type = args.type;
  if (args.keyword !== undefined) filters.keyword = args.keyword;
  if (args.priceMin !== undefined) filters.priceMin = args.priceMin;
  if (args.priceMax !== undefined) filters.priceMax = args.priceMax;
  if (args.petFriendly === true) filters.petFriendly = true;
  if (sortApplied && args.sort !== undefined) filters.sort = args.sort;

  // CAM-716 BR-3 — the SAME shared taxonomy-echo builder search-campsites.ts
  // uses (lib/ai/tools/taxonomy-tags.ts) — one algorithm, identical echo.
  filters.taxonomy = await buildTaxonomyEcho(prisma, args);

  return filters;
}

export async function executeBulkAvailability(args: BulkAvailabilityArgs): Promise<BulkAvailabilityResult> {
  // Decision 2/BR-3/EC-3 — RANGES is the model-controlled array: refuse BEFORE
  // ANY DB call (O(1) check, before buildCampSiteWhere/findMany even runs).
  if (args.dates.length > MAX_DATE_SET_RANGES) {
    return { ok: false, reason: 'over_cap' };
  }

  // CAM-716 BR-1/BR-2 — `near` (proximity intent) is consulted FIRST and
  // wins over both `province` and `region` when present, mirroring
  // `searchCampsites`'s own precedence exactly. `resolveNearOrigin` (shared,
  // lib/geo/province-proximity.ts) decides whether this becomes a geo
  // (bbox+haversine) search or falls back to an exact-province filter
  // (EC-3 — no centroid for that province, never a crash).
  let provinceFilter: string | string[] | undefined;
  let nearCentroid: { lat: number; lng: number } | undefined;
  let nearRadiusKm: number = MAX_NEAR_KM;
  if (args.near !== undefined) {
    const origin = await resolveNearOrigin(prisma, args.near);
    if (origin.kind === 'geo') {
      nearCentroid = origin.centroid;
      nearRadiusKm = origin.radiusKm;
      // Geo path: the location filter is the bbox pushed onto `where` below
      // (inside rankCampsiteIdsByProximity), NOT an exact-province equality
      // — `provinceFilter` stays unset.
    } else {
      // EC-3 — sparse/unknown centroid AND not a known landmark: fall back
      // to an exact-province filter on the resolved value itself (never
      // crash, never a fabricated point).
      provinceFilter = origin.province;
    }
  } else if (args.province !== undefined) {
    provinceFilter = args.province;
  } else if (args.region !== undefined) {
    provinceFilter = resolveRegionForSearch(args.region);
  }

  // CAM-716 BR-3 — derives which location arg ACTUALLY constrained this
  // call, mirroring the exact precedence the if/else-if chain above just
  // applied — never a parallel re-interpretation of `args`.
  let appliedLocationFilter: BulkAppliedLocationFilter | undefined;
  if (args.near !== undefined) {
    appliedLocationFilter = { kind: 'near', value: args.near };
  } else if (args.province !== undefined) {
    appliedLocationFilter = { kind: 'province', value: args.province };
  } else if (args.region !== undefined) {
    appliedLocationFilter = { kind: 'region', value: args.region };
  }
  // CAM-709 EC-2 parity — `sort` only genuinely constrains the RETURNED
  // order on the plain query path; the near-path always orders by distance.
  const sortApplied = !nearCentroid;

  // CAM-573 — additive safety net alongside `buildCampSiteWhere`'s legacy
  // string-equality match: resolves the incoming province NAME (Thai or
  // English) to its AdminArea subtree ids so a camp stored in the OTHER
  // language for the same real province still matches (CAM-559 finding;
  // same mechanism `lib/ai/tools/search-campsites.ts` already wires in for
  // its single-province branch — this closes the identical gap here, since
  // this tool's own schema doc deliberately does NOT run a plain `province`
  // value through the Thai-character resolver, see the schema doc note
  // above). Only engaged for the single-province branch, never the
  // region-expansion array. Fail-open: a lookup error never blocks the
  // read, it just leaves the legacy exact-string match as the only path.
  let provinceAdminAreaIds: string[] | undefined;
  if (typeof provinceFilter === 'string' && provinceFilter) {
    try {
      provinceAdminAreaIds = await resolveProvinceAdminAreaIds(prisma, provinceFilter);
    } catch (error) {
      console.error('[CAM-573] province admin-area resolution failed (fail-open, string match still applies)', error);
    }
  }

  // Decision 3/BR-4 — buildCampSiteWhere ALREADY gates isActive/isPublished/
  // deletedAt (CAM-469 visibility, inherited for free, AC-6/EC-5).
  const where = buildCampSiteWhere({
    province: provinceFilter,
    provinceAdminAreaIds,
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
  // CAM-716 — the near-geo path branches through the SAME shared ranking
  // core (bbox candidate query + haversine sort + cap) searchCampsites uses;
  // the plain province/region/taxonomy path is UNCHANGED (a single ordered
  // findMany).
  let cards: AiCampCard[];
  if (nearCentroid) {
    const rankedIds = await rankCampsiteIdsByProximity(
      prisma,
      where,
      nearCentroid,
      nearRadiusKm,
      SEARCH_CAMPSITES_MAX_RESULTS
    );
    if (rankedIds.length === 0) {
      cards = [];
    } else {
      const rows = await prisma.campSite.findMany({
        where: { id: { in: rankedIds } },
        select: aiCampCardSelect,
      });
      // Prisma's `id: { in: [...] }` does not preserve array order — restore
      // the haversine-ascending order explicitly.
      const rowById = new Map(rows.map((r) => [r.id, r]));
      cards = rankedIds
        .map((id) => rowById.get(id))
        .filter((row): row is (typeof rows)[number] => row !== undefined)
        .map(toAiCampCard);
    }
  } else {
    const rows = await prisma.campSite.findMany({
      where,
      select: aiCampCardSelect,
      orderBy: orderByFor(args.sort ?? 'related'),
      take: SEARCH_CAMPSITES_MAX_RESULTS,
    });
    cards = rows.map(toAiCampCard);
  }

  // AC-4/EC-2 — an empty candidate set is an honest no_match; NO availability
  // query runs (never a fabricated { ok:true, camps: [] }).
  // CAM-716 EC-2 — when THIS call's own `near` argument was set, the echo
  // rides along even on this empty branch (the exact incident shape: "no
  // camps matched near Saraburi" must still let the model name the place
  // honestly, never fall back to memory). The pre-existing province/region-
  // only no_match path is UNCHANGED — no `near` -> no echo, byte-identical.
  if (cards.length === 0) {
    if (args.near !== undefined) {
      const appliedFilters = await buildBulkAppliedFilters(args, appliedLocationFilter, sortApplied);
      return { ok: false, reason: 'no_match', appliedFilters };
    }
    return { ok: false, reason: 'no_match' };
  }

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

  // CAM-716 BR-4 — the SAME shared "matched tag" badge deriver
  // search-campsites.ts uses (lib/ai/tools/taxonomy-tags.ts), applied over
  // this call's own candidate camps — AC-3 parity: a bulk card's badge means
  // the same thing a normal-search card's badge means.
  const matchedTagByCampId = await deriveMatchedTags(prisma, campIds, args);

  // CAM-485 BR-1 — top-level `cards[]`: only camps with >=1 free cell,
  // `remaining` from the FIRST free cell (deterministic — a multi-range ask
  // never averages/aggregates). Reuses the SAME `cards` (AiCampCard[])
  // already queried above — no second query.
  const availableCards: SearchCampsiteCard[] = [];
  for (const card of cards) {
    const cells = cellsByCampId.get(card.id) ?? [];
    const firstFree = cells.find(
      (cell): cell is Extract<CellStatus, { status: 'free' }> => cell.status === 'free'
    );
    if (firstFree) {
      availableCards.push({
        ...card,
        remaining: firstFree.remaining,
        matchedTag: matchedTagByCampId[card.id] ?? null,
      });
    }
  }

  const appliedFilters = await buildBulkAppliedFilters(args, appliedLocationFilter, sortApplied);

  return {
    ok: true,
    ranges: args.dates.map((r) => ({ startDate: r.startDate, endDate: r.endDate })),
    // AC-2/AC-3/EC-1 — every candidate camp row is emitted, full-everywhere
    // camps included; per-range status is preserved, never collapsed.
    camps: cards.map((card) => ({ ...card, cells: cellsByCampId.get(card.id) ?? [] })),
    cards: availableCards,
    appliedFilters,
  };
}

export const bulkAvailabilityTool: ToolDefinition<BulkAvailabilityArgs, BulkAvailabilityResult> = {
  name: 'bulkAvailability',
  description:
    'Check LIVE availability for MANY published CampVibe campsites across MULTIPLE date ranges in ONE call — use this instead of calling checkAvailability repeatedly when the camper asks about several dates or wants to know which camps (matching a filter) are free. ' +
    // CAM-717 (2026-08-12) — placed as the SECOND sentence, right at the
    // point the model is choosing THIS call's own arguments (higher
    // salience than a system-prompt paragraph for a small model — see
    // story.md/test.md for the measured comparison): if a searchCampsites
    // call already ran this turn for the same request, its filter
    // arguments (province/near/region/terrain/access/activities/
    // facilities/annotatedFeatures/camperStyle/type/price/petFriendly/
    // keyword) MUST be copied onto this call unchanged — never dropped
    // just because this is a different tool. Fixes a real, repro'd defect:
    // a taxonomy filter like terrain set on searchCampsites silently not
    // surviving onto this call, so the availability check below ran over a
    // wider, wrong candidate set than the camper actually asked for.
    'If you already called searchCampsites earlier THIS turn for the SAME request, you MUST copy every filter argument that call used onto THIS call too (province, near, region, terrain, access, activities, facilities, annotatedFeatures, camperStyle, type, price, petFriendly, keyword) — never drop, narrow, or forget one just because you are switching tools; only `dates`/`guests` are new here. ' +
    // CAM-505 — names the ONE-camp-many-dates case explicitly: even one
    // named camp still routes here (via `keyword`) once the question spans
    // multiple candidate dates or asks a superlative ("which date is best").
    'This also applies to ONE specific named camp when the question spans multiple candidate dates or asks a superlative ("which Saturday is freest") — set `keyword` to that camp\'s name rather than calling checkAvailability once per date. ' +
    `Accepts a candidate-camp filter (same vocabulary as searchCampsites, including \`near\` for a proximity search — e.g. "แถวสระบุรี") plus a \`dates\` array (pass the resolveDates tool's output directly, up to ${MAX_DATE_SET_RANGES} ranges — over that the tool refuses and asks to narrow the dates). ` +
    `Returns at most ${SEARCH_CAMPSITES_MAX_RESULTS} candidate camps (the top matches for the filter) x every requested range, with each cell free/full/unknown. A camp full for every range is still shown, never omitted.`,
  // Read-only, no identity needed — same tier as searchCampsites/checkAvailability/resolveDates.
  tier: 'guest',
  parameters: bulkAvailabilityArgsSchema,
  jsonSchema,
  execute: (args, _ctx) => executeBulkAvailability(args),
};
