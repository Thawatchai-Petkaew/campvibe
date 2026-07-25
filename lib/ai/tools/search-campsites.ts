/**
 * CAM-270 AC-1/AC-8, BR-1/BR-2/BR-9 — the `searchCampsites` read-only AI tool.
 *
 * Reuses the exact same where-builder + card select every other catalog
 * caller uses (ADR-009 no-forked-data-path): `buildCampSiteWhere` always
 * gates on isActive/isPublished/deletedAt (BR-1), and `campCardSelect` is the
 * identical card payload shape the catalog grid renders — no parallel query
 * or projection is introduced for the AI layer.
 *
 * CAM-408 — real-smoke defect fix: the tool exposed no taxonomy args, so the
 * model had no way to turn "ติดน้ำ" / "วิวภูเขา" into a terrain filter and a
 * plain NL search returned zero results even though matching camps existed.
 * Adds terrain/access/activities/facilities + keyword as pure passthrough
 * args to the SAME `buildCampSiteWhere` taxonomy handling every other caller
 * already uses (`options: { some: { code } }`) — no new where-logic.
 */
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { buildCampSiteWhere } from '@/lib/campsite-filters';
import { aiCampCardSelect, toAiCampCard, type AiCampCard } from '@/lib/read-models/ai-camp-card';
import { getRemainingCapacityForCamps } from '@/lib/campsite-availability';
import { VALID_SORTS, orderByFor } from '@/lib/catalog-cursor';
import { resolveRegionForSearch } from '@/lib/thai-regions';
import type { ToolDefinition } from '@/lib/ai/tool-registry';

/** BR-2 — the tool NEVER returns more than this many cards, regardless of any model-requested count. */
export const SEARCH_CAMPSITES_MAX_RESULTS = 10;

/**
 * CAM-461 BR-1 — the model-emitted `excludeIds` array is sliced to this many
 * ids BEFORE `buildCampSiteWhere`/`findMany` ever runs (CAM-344 lesson: cap a
 * model-controlled array length before the query, never after). Over the cap
 * → keep the first MAX_EXCLUDE_IDS, never fail the search (BR-1/EC-1).
 */
export const MAX_EXCLUDE_IDS = 50;

/**
 * CAM-408 BR-3 — real MasterData taxonomy codes (source: `prisma/seed.ts`
 * `masterData`, the exact rows the DB is seeded with). `lib/filterOptions.ts`
 * was NOT reused here — it is dead code (nothing imports it) and its facility
 * codes (`KITC`, `PARK`, ...) do not exist in the real MasterData table; a
 * z.enum built from it would let the model emit a code that never matches
 * any camp, reintroducing the exact zero-result bug this story fixes.
 *
 * Each group accepts ONE code (not an array): `buildCampSiteWhere` ANDs every
 * code passed in a group (a camp must carry ALL of them) — a model emitting
 * two terrain codes for an "either/or" ask (e.g. "ริมน้ำหรือชายหาด") would
 * silently AND them and likely match nothing. Single-value sidesteps that;
 * combining multiple codes per group is out of scope for this fix.
 */
const TERRAIN_CODES = ['BEAC', 'FORE', 'RIVE', 'MTNS'] as const;
const ACCESS_CODES = ['BAOT', 'DRIV', 'HIKE', 'WALK'] as const;
const ACTIVITY_CODES = ['SWIM', 'HIKI', 'SURF', 'FISH', 'WILD', 'BOAT', 'HORS', 'OFFR', 'LIVE', 'CLIM'] as const;
const FACILITY_CODES = [
  'SHOW', 'TOIL', 'PICN', 'WIFI', 'TRAS', 'SANI', 'POTA', 'ELEC', 'WATE', 'SINK',
  'CART', 'MIMT', 'GRIL', 'CAFE', 'REST', 'FEIC', 'FEDW',
] as const;

/** Same "is this a real calendar date" check `lib/ai/tools/check-availability.ts` already uses — no new validation concept. */
const isoDate = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
  message: 'Invalid date',
});

export const searchCampsitesArgsSchema = z.object({
  province: z.string().trim().min(1).max(100).optional(),
  /**
   * CAM-463 Decision 2 — a plain STRING (like `province`), NOT `z.enum(6)`.
   * BR-2 mandates a code alias map (`อีสาน`→NORTHEAST) and BR-4/AC-6 mandate
   * the honest-fallback (an unrecognized word never fails validation — it
   * falls through to 0 rows + the banner). A hard enum would push alias
   * normalization into model judgement and turn AC-6's `ภาคสวรรค์` into
   * `invalid_args` instead of the required 0-rows-and-banner. Resolved
   * server-side by `resolveRegionForSearch` (lib/thai-regions.ts) — the model
   * never needs to know which provinces are "northern".
   */
  region: z.string().trim().min(1).max(50).optional(),
  type: z.string().trim().min(1).max(20).optional(),
  /** A specific campsite NAME for an exact-phrase text match — NOT for a general characteristic (see jsonSchema description). */
  keyword: z.string().trim().min(1).max(100).optional(),
  priceMin: z.number().nonnegative().optional(),
  priceMax: z.number().nonnegative().optional(),
  petFriendly: z.boolean().optional(),
  /**
   * CAM-408 BR-3 — an unrecognized code fails zod validation before this
   * ever reaches Prisma (dispatchTool → invalid_args, no query runs).
   * CAM-461 Decision 4/BR-3 — each group now ALSO accepts an array of codes
   * (`.or(z.array(...))`), backward-compatible by addition: a today-shaped
   * single-string call still matches the first union member and validates
   * byte-identically. Pass an ARRAY only when the camper names two-or-more
   * options in ONE group (OR-within-group, e.g. "ริมน้ำหรือชายหาด" →
   * `terrain:["RIVE","BEAC"]"`); a single string stays a single string
   * (never auto-wrapped) so `buildCampSiteWhere`'s AND-per-code shape for
   * one code is preserved exactly (see campsite-filters.ts Decision 1).
   */
  terrain: z.enum(TERRAIN_CODES).or(z.array(z.enum(TERRAIN_CODES))).optional(),
  access: z.enum(ACCESS_CODES).or(z.array(z.enum(ACCESS_CODES))).optional(),
  activities: z.enum(ACTIVITY_CODES).or(z.array(z.enum(ACTIVITY_CODES))).optional(),
  facilities: z.enum(FACILITY_CODES).or(z.array(z.enum(FACILITY_CODES))).optional(),
  /**
   * CAM-461 BR-2 — reuses the catalog's `VALID_SORTS` vocabulary verbatim
   * (ADR-009, no forked sort). Absent → `related` (BR-2 default, applied in
   * executeSearchCampsites below) — deterministic, matches the catalog default.
   */
  sort: z.enum(VALID_SORTS).optional(),
  /**
   * CAM-461 BR-1 — the model reads shown ids from the CAM-460
   * `<shown_results>` state and passes them here for "ขออีก" / "ไม่เอาที่
   * แสดงไปแล้ว". Deliberately `z.array(z.string())` — NOT `.uuid()` — a
   * mis-transcribed id simply excludes nothing (graceful under-exclude,
   * never `invalid_args`). No rejecting `.max()`: over-cap is sliced to
   * MAX_EXCLUDE_IDS in executeSearchCampsites (BR-1: "keep the first N,
   * never fail").
   */
  excludeIds: z.array(z.string()).optional(),
  /** Model-requested result count — clamped to SEARCH_CAMPSITES_MAX_RESULTS, never honored above it (BR-2). */
  limit: z.number().int().positive().optional(),
  /**
   * CAM-427 (G3) — a stay date range for LIVE "เหลือ N ที่" per card. Both
   * fields are optional and independent of one another: providing only one,
   * an unparseable string, or an inverted range never fails the search
   * (fail-open, same policy `getAvailabilityStatusForCamps` already uses) —
   * it just leaves every card's `remaining` as `null` (unknown), it never
   * blocks/empties the result list.
   */
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
});

export type SearchCampsitesArgs = z.infer<typeof searchCampsitesArgsSchema>;

/**
 * CAM-427 (G3) — `remaining` is ALWAYS present (never optional) so the card
 * renderer never has to branch on presence: `null` = no date range was
 * requested (or the range failed the DoS/inversion guard) — unknown, render
 * no live-availability text; a number = live "เหลือ N ที่" (0 = "เต็ม").
 */
export interface SearchCampsiteCard extends AiCampCard {
  remaining: number | null;
}

export interface SearchCampsitesResult {
  /** Never null — a zero-match search returns [] so the caller can render an empty state (AC-8). */
  cards: SearchCampsiteCard[];
}

/** CAM-404 — a province arg containing any Thai character triggers the ThailandLocation resolve below. */
const THAI_CHAR_PATTERN = /[ก-๙]/;

/**
 * CAM-458 BR-3/D1 — canonical Bangkok-variant alias map (exact-key), applied
 * BEFORE the `ThailandLocation` lookup below. Covers the high-frequency,
 * non-substring ways campers refer to Bangkok; substring forms (e.g.
 * `กรุงเทพ`) already resolve via the existing `contains` query and need no
 * entry. Pure + deterministic (no DB round-trip for the alias step itself);
 * scope is Bangkok only — provincial nicknames/slang are phase-2 (out of
 * scope, see story Out-of-scope).
 */
const BANGKOK_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'กทม': 'กรุงเทพมหานคร',
  'กทม.': 'กรุงเทพมหานคร',
  'กรุงเทพฯ': 'กรุงเทพมหานคร',
  'บางกอก': 'กรุงเทพมหานคร',
});

/**
 * CAM-404 — `Location.province` is stored in English (e.g. "Kanchanaburi"), but
 * the model frequently emits the Thai province name it was given by the user
 * (e.g. "กาญจนบุรี"). `buildCampSiteWhere` does an exact match on `province`,
 * so an un-resolved Thai value matches zero rows forever even when camps
 * exist. Resolve via `ThailandLocation` (provinceName ↔ provinceNameEn);
 * English input is returned unchanged (no DB round-trip). CAM-458 seeds all
 * 77 provinces (was ~12) and adds the Bangkok-alias normalization above — an
 * unmapped Thai word, or any lookup error, still falls back to the raw value
 * unchanged (never throws), matching the search's prior behavior.
 */
async function resolveProvinceForSearch(province: string): Promise<string> {
  if (!THAI_CHAR_PATTERN.test(province)) return province;

  const normalized = BANGKOK_ALIASES[province] ?? province;

  try {
    const match = await prisma.thailandLocation.findFirst({
      where: { provinceName: { contains: normalized } },
      select: { provinceNameEn: true },
    });
    return match?.provinceNameEn ?? province;
  } catch {
    return province;
  }
}

const jsonSchema = {
  type: 'object',
  properties: {
    province: {
      type: 'string',
      description:
        'Province name in English. Thai province names are also accepted and resolved to the stored English value server-side. ' +
        'OPTIONAL — set this ONLY when the camper has explicitly named a specific province, either in this message or earlier in this conversation. ' +
        'NEVER infer, guess, or default a province from a terrain/region/facility/activity word (e.g. "ริมทะเล", "ริมแม่น้ำ", "ภาคเหนือ") — those are NOT province names; leave this field unset and use `terrain`/`region`/the other filters instead.',
    },
    region: {
      type: 'string',
      description:
        'A Thai geographic region (ภาค) the camper asked about, e.g. "ภาคเหนือ" (North), "อีสาน"/"ภาคตะวันออกเฉียงเหนือ" (Northeast), "ภาคกลาง" (Central), "ภาคตะวันออก" (East), "ภาคตะวันตก" (West), "ภาคใต้" (South). Pass this when the camper names a REGION rather than a single province (e.g. "ภาคเหนือมีลานกางเต็นท์ที่ไหนบ้าง", "อยากไปแคมป์แถวอีสาน") — resolved server-side to every province in that region. If BOTH province and region are given, province wins and region is ignored.',
    },
    type: { type: 'string', description: 'Camp site type code, e.g. CAGD, GLAMP, LAKE' },
    keyword: {
      type: 'string',
      description:
        'A specific campsite NAME the camper mentioned, for an exact-phrase text match against the camp name/description. Do NOT use this for a general characteristic (terrain, facility, activity) — use the structured filters below instead; a keyword search on a general Thai word (e.g. "ภูเขา") only searches name/description text and will usually miss camps that have it as tagged structured data.',
    },
    priceMin: { type: 'number', description: 'Minimum nightly price in THB' },
    priceMax: { type: 'number', description: 'Maximum nightly price in THB' },
    petFriendly: { type: 'boolean', description: 'Only include pet-friendly camps when true' },
    /**
     * CAM-461 Decision 4 — each taxonomy prop keeps its EXISTING `type:
     * 'string', enum: CODES` shape (preserves the CAM-408 jsonSchema pin,
     * `__tests__/cam-408-*.test.ts` "jsonSchema advertises real MasterData
     * codes"); the description is extended (rather than the shape switched
     * to a formal `oneOf`) so the model knows it MAY also pass an ARRAY of
     * the same codes for an OR-within-group ask. The real validation gate
     * is zod (`z.enum(...).or(z.array(...))`, BR-4) — this jsonSchema is
     * advisory to the model only, never enforced server-side.
     */
    terrain: {
      type: 'string',
      enum: TERRAIN_CODES,
      description:
        'Terrain the campsite is set in — pick ONE that best matches the camper\'s description, or pass an ARRAY of codes when the camper names two-or-more options in one group (e.g. "ริมน้ำหรือชายหาด" → ["RIVE","BEAC"], matches EITHER). RIVE = แม่น้ำ ลำธาร คลองเล็ก (river/stream/creek, e.g. "ติดน้ำ"/"ริมน้ำ"), BEAC = ชายหาด (beach/sea), MTNS = ภูเขา (mountain/surrounded by mountains, e.g. "วิวภูเขา"), FORE = ป่า (forest).',
    },
    access: {
      type: 'string',
      enum: ACCESS_CODES,
      description:
        'How campers reach the site — pick ONE, or pass an ARRAY when the camper names two-or-more (matches EITHER): DRIV = ขับรถ (drive up), WALK = เดิน (walk in), HIKE = ไต่เขา (hike in), BAOT = เรือ (boat access only).',
    },
    activities: {
      type: 'string',
      enum: ACTIVITY_CODES,
      description:
        'A specific on-site activity the camper asked for — pick ONE, or pass an ARRAY when the camper names two-or-more (matches EITHER): SWIM ว่ายน้ำ, HIKI เดินเล่น, SURF เล่นเซิร์ฟ, FISH ตกปลา, WILD ส่องสัตว์ป่า, BOAT พายเรือ, HORS ขี่ม้า, OFFR ออฟโรด, LIVE ดนตรีสด, CLIM ปีนเขา.',
    },
    facilities: {
      type: 'string',
      enum: FACILITY_CODES,
      description:
        'A specific facility the camper asked for — pick ONE, or pass an ARRAY when the camper names two-or-more (matches EITHER): SHOW ห้องอาบน้ำ, TOIL ห้องน้ำ, PICN โต๊ะปิคนิค, WIFI ไวไฟ, TRAS ถังขยะ, SANI จุดทิ้งสิ่งปฏิกูล, POTA ก๊อกน้ำ, ELEC จุดจ่ายไฟฟ้า, WATE จุดจ่ายน้ำ, SINK อ่างล้างจาน, CART รถเข็น, MIMT ร้านขายของชำ, GRIL หมูกระทะ, CAFE คาเฟ่, REST ร้านอาหาร, FEIC น้ำแข็งฟรี, FEDW น้ำดื่มฟรี.',
    },
    sort: {
      type: 'string',
      enum: VALID_SORTS,
      description:
        'How to order the results — related (default, newest first), price_asc (ถูกไปแพง — cheapest first, free camps first), price_desc (แพงไปถูก — most expensive first), rating (รีวิว/เรตติ้งดีสุด — best-rated first, no-review camps last).',
    },
    excludeIds: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Campsite ids to EXCLUDE from the results — pass the ids listed in <shown_results> when the camper asks for more/other/different camps (e.g. "ขออีก", "ไม่เอาที่แสดงไปแล้ว", "มีที่อื่นอีกไหม") so the search returns camps NOT already shown this conversation. Omit for a normal search.',
    },
    limit: { type: 'number', description: `Max results to return (capped at ${SEARCH_CAMPSITES_MAX_RESULTS})` },
    startDate: { type: 'string', description: 'Stay start date, ISO 8601 (e.g. 2026-08-01) — only when the camper gave a date range; enables a live "เหลือ N ที่" count per card.' },
    endDate: { type: 'string', description: 'Stay checkout date (exclusive), ISO 8601 — required together with startDate.' },
  },
  additionalProperties: false,
} as const;

export async function executeSearchCampsites(args: SearchCampsitesArgs): Promise<SearchCampsitesResult> {
  // CAM-463 Decision 2/BR-3 — province is consulted FIRST: when both province
  // and region are supplied, region is dropped (never AND-ed against the
  // single province, which would empty the result — AC-4). Region alone
  // expands to its province set via the pure, synchronous
  // `resolveRegionForSearch` (no DB round-trip, unlike resolveProvinceForSearch).
  let provinceFilter: string | string[] | undefined;
  if (args.province !== undefined) {
    provinceFilter = await resolveProvinceForSearch(args.province);
  } else if (args.region !== undefined) {
    provinceFilter = resolveRegionForSearch(args.region);
  }

  // CAM-461 BR-1/EC-1 — bound the model-controlled excludeIds array BEFORE
  // buildCampSiteWhere/findMany ever runs (CAM-344 lesson: cap before the
  // query, never after). Over the cap → keep the first MAX_EXCLUDE_IDS,
  // never fail the search.
  const excludeIds = args.excludeIds !== undefined ? args.excludeIds.slice(0, MAX_EXCLUDE_IDS) : undefined;

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
    excludeIds,
  });

  // BR-2: hard cap, never overridden by a larger model-supplied count.
  const take = Math.min(args.limit ?? SEARCH_CAMPSITES_MAX_RESULTS, SEARCH_CAMPSITES_MAX_RESULTS);

  // CAM-461 BR-2/Decision 3 — reuse orderByFor verbatim (ADR-009, no forked
  // sort). Absent `sort` defaults to 'related' — makes the previously
  // order-unspecified findMany deterministic (BR-2 default, ratified at G2).
  const rows = await prisma.campSite.findMany({
    where,
    select: aiCampCardSelect,
    orderBy: orderByFor(args.sort ?? 'related'),
    take,
  });

  const cards = rows.map(toAiCampCard);

  // CAM-427 (G3): LIVE, batched remaining-capacity — ONE call for the WHOLE
  // page of cards (never a per-card getRemainingCapacity loop, BR-5). Only
  // runs when the caller supplied BOTH dates; an unparseable/inverted range
  // fails open (getRemainingCapacityForCamps returns {}) — every card just
  // keeps `remaining: null` (unknown), the search itself never fails.
  let remainingByCampId: Record<string, { remaining: number | null }> = {};
  if (args.startDate && args.endDate && cards.length > 0) {
    const start = new Date(args.startDate);
    const end = new Date(args.endDate);
    remainingByCampId = await getRemainingCapacityForCamps(
      cards.map((c) => c.id),
      start,
      end
    );
  }

  return {
    cards: cards.map((card) => ({
      ...card,
      remaining: remainingByCampId[card.id]?.remaining ?? null,
    })),
  };
}

export const searchCampsitesTool: ToolDefinition<SearchCampsitesArgs, SearchCampsitesResult> = {
  name: 'searchCampsites',
  description:
    'Search published, active CampVibe campsites by province, region, type, price range, pet-friendliness, terrain, access, activities, and facilities. Returns at most 10 result cards. Pass startDate+endDate together when the camper gave a stay date range to get a LIVE remaining-capacity count per card. ' +
    'Pass `region` (not `province`) when the camper asks by ภาค — "ภาคเหนือ"/"อีสาน"/"ภาคใต้" — rather than a single province; it expands to every province in that region server-side. ' +
    'Pass `sort` when the camper asks for an order (cheapest/most-expensive/best-rated first). ' +
    'When the camper asks for MORE, OTHER, or DIFFERENT camps than what was already shown this conversation (e.g. "ขออีก", "ไม่เอาที่แสดงไปแล้ว", "มีที่อื่นอีกไหม") — re-call this tool with the SAME filters plus `excludeIds` set to the campSiteIds listed in <shown_results>, so the search returns camps not already shown.',
  // CAM-417 (ADR-013 D5) — offered to every caller, session or not.
  tier: 'guest',
  parameters: searchCampsitesArgsSchema,
  jsonSchema,
  // CAM-417 — this tool needs no caller identity; `_ctx` is server-bound and unused here.
  execute: (args, _ctx) => executeSearchCampsites(args),
};
