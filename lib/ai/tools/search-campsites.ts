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
import { haversineDistanceKm } from '@/lib/geo/distance';
import provinceCentroidsData from '@/prisma/data/province-centroids.json';
import landmarkGazetteerData from '@/prisma/data/landmark-gazetteer.json';
import type { ToolDefinition } from '@/lib/ai/tool-registry';

/**
 * CAM-502 (P2 geo proximity) BR-1 — the committed, build-step-derived
 * province centroid table (`scripts/build-province-centroids.mjs`), keyed
 * by the SAME `Location.province` English canonical value
 * `resolveProvinceForSearch` already resolves to. A province backed by too
 * few real camps at build time is OMITTED from this table entirely (sparse
 * guard) — treated below as "no centroid available", never a crash.
 */
const PROVINCE_CENTROIDS: Readonly<
  Record<string, { lat: number; lng: number; campCount: number }>
> = provinceCentroidsData;

/**
 * CAM-502 BR-2 — "ใกล้X" caps at this radius so a proximity search never
 * silently drifts into "basically the whole country" territory. Tunable
 * const (not a magic number inline) — ~250km covers a realistic weekend-trip
 * radius from a major province without dragging in unrelated regions.
 */
export const MAX_NEAR_KM = 250;

/**
 * CAM-502 BR-2/EC-4 (CAM-344 lesson) — the candidate set pulled by the bbox
 * pre-filter is capped BEFORE the haversine sort/distance-filter ever runs,
 * independent of how many camps a real province's bbox happens to contain.
 * 475 camps exist in total today; this cap is a defensive ceiling, not a
 * tuned-to-today's-count value.
 */
export const NEAR_CANDIDATE_CAP = 500;

/**
 * CAM-503 (P3 landmark search) BR-1/BR-3 — the curated, committed landmark
 * gazetteer (`prisma/data/landmark-gazetteer.json`; hand-authored, NOT
 * data-derived the way `province-centroids.json` is, since a landmark's
 * "center" is a real-world place, not a mean of camp rows). Looked up
 * FIRST in the `near` resolution below — a landmark like เขาใหญ่ spans
 * multiple provinces and therefore has no `PROVINCE_CENTROIDS` entry of its
 * own; checking the gazetteer first is what makes that geo-radius search
 * possible at all, not merely an optimization over the province path.
 */
interface LandmarkGazetteerEntry {
  id: string;
  nameTh: string;
  aliases: string[];
  lat: number;
  lng: number;
  radiusKm: number;
  kind: string;
}

const LANDMARK_GAZETTEER: readonly LandmarkGazetteerEntry[] = landmarkGazetteerData as LandmarkGazetteerEntry[];

/**
 * Keyed by every `nameTh` + alias (+ a lowercased variant for an ASCII
 * alias, e.g. "khao yai") so an exact-string `near` value the model emits —
 * whether the resolver's own hint (BR-2, always the canonical `nameTh`) or
 * a value the model composed from its own general knowledge — resolves to
 * the same gazetteer entry. Built once at module load (pure, no DB).
 */
const LANDMARK_BY_NAME: ReadonlyMap<string, LandmarkGazetteerEntry> = (() => {
  const map = new Map<string, LandmarkGazetteerEntry>();
  for (const entry of LANDMARK_GAZETTEER) {
    for (const key of [entry.nameTh, ...entry.aliases]) {
      map.set(key, entry);
      const lower = key.toLowerCase();
      if (lower !== key) map.set(lower, entry);
    }
  }
  return map;
})();

/** CAM-503 BR-3 — exact-string gazetteer lookup (falls back to a lowercase match for an ASCII alias); undefined = not a known landmark, caller falls through to the province-centroid path. */
function findLandmark(near: string): LandmarkGazetteerEntry | undefined {
  return LANDMARK_BY_NAME.get(near) ?? LANDMARK_BY_NAME.get(near.toLowerCase());
}

const KM_PER_DEG_LAT = 111.32;

/**
 * A rectangular lat/lng bbox that FULLY CONTAINS the circle of radius
 * `radiusKm` around `center` — a cheap Prisma-level pre-filter (candidates),
 * never the final circular cut (that's the haversine distance-filter next
 * to this bbox's only caller, `executeSearchCampsites`'s near-path).
 * Exported (pure math, no DB) so `__tests__/cam-502-geo-proximity.test.ts`
 * can assert the exact bounds deterministically.
 */
export function bboxForRadius(
  center: { lat: number; lng: number },
  radiusKm: number
): { latMin: number; latMax: number; lngMin: number; lngMax: number } {
  const latDelta = radiusKm / KM_PER_DEG_LAT;
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  // Guard a near-zero cosine (would only occur at the poles — never a real
  // Thai province) so this never divides by ~0.
  const lngDelta = radiusKm / (KM_PER_DEG_LAT * (Math.abs(cosLat) > 1e-6 ? cosLat : 1e-6));
  return {
    latMin: center.lat - latDelta,
    latMax: center.lat + latDelta,
    lngMin: center.lng - lngDelta,
    lngMax: center.lng + lngDelta,
  };
}

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
/**
 * CAM-513 (S1) — 8 codes added to the original 4 (source: `prisma/seed.ts`
 * `masterData`, same sourcing discipline as the CAM-408 comment above — no
 * code that doesn't exist in the real seeded MasterData table).
 */
const TERRAIN_CODES = [
  'BEAC', 'FORE', 'RIVE', 'MTNS',
  'SEA', 'COAS', 'LAKE', 'WATF', 'SWMH', 'FILD', 'CAVE', 'FARM',
] as const;
const ACCESS_CODES = ['BAOT', 'DRIV', 'HIKE', 'WALK'] as const;
const ACTIVITY_CODES = ['SWIM', 'HIKI', 'SURF', 'FISH', 'WILD', 'BOAT', 'HORS', 'OFFR', 'LIVE', 'CLIM'] as const;
/**
 * CAM-514 (S2) — 2 codes added to the original 17 (source: `prisma/seed.ts`
 * `masterData`, same sourcing discipline as the CAM-408 comment above — no
 * code that doesn't exist in the real seeded MasterData table).
 */
const FACILITY_CODES = [
  'SHOW', 'TOIL', 'PICN', 'WIFI', 'TRAS', 'SANI', 'POTA', 'ELEC', 'WATE', 'SINK',
  'CART', 'MIMT', 'GRIL', 'CAFE', 'REST', 'FEIC', 'FEDW',
  'HOTW', 'LIGT',
] as const;

/**
 * CAM-511 BR-1 — the 11 real `Equipment for rent` MasterData codes (source:
 * `prisma/seed.ts` masterData, same sourcing discipline as the CAM-408
 * taxonomy consts above — no code that doesn't exist in the real table).
 * Rentable gear a camper without their own equipment can still book with.
 */
const EQUIPMENT_CODES = ['TENT', 'POWE', 'TFAN', 'BLKT', 'LEDL', 'GDST', 'SSTV', 'LSTV', 'CHAI', 'FYST', 'ICBK'] as const;

/**
 * CAM-515 (S3) — the 5 real `Annotated features` MasterData codes (source:
 * `prisma/seed.ts` masterData, same sourcing discipline as the CAM-408
 * taxonomy consts above — no code that doesn't exist in the real table).
 * The FIRST new MasterData group added post-launch (rules/rights the camp
 * carries, not a physical facility): ALCO ดื่มแอลกอฮอล์ได้, FIRE ก่อไฟได้,
 * FIWD มีฟืนขาย/บริการ, ADAA รองรับผู้พิการ, RESV จองล่วงหน้าได้.
 */
const ANNOTATED_CODES = ['ALCO', 'FIRE', 'FIWD', 'ADAA', 'RESV'] as const;

/**
 * CAM-516 (S4) — the 4 real `Camper style` MasterData codes (source:
 * `prisma/seed.ts` masterData, same sourcing discipline as ANNOTATED_CODES
 * above). Mirrors CAM-515 exactly for the SECOND new MasterData group: a
 * host-declared vibe/style (not a rule/right), OR-within-group semantics:
 * CHIC สบาย (สายคุณหนู), GENR ทั่วไป, DIFT ลำบาก, IDMT ทรหด.
 */
const CAMPER_STYLE_CODES = ['CHIC', 'GENR', 'DIFT', 'IDMT'] as const;

/** Same "is this a real calendar date" check `lib/ai/tools/check-availability.ts` already uses — no new validation concept. */
const isoDate = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
  message: 'Invalid date',
});

export const searchCampsitesArgsSchema = z.object({
  province: z.string().trim().min(1).max(100).optional(),
  /**
   * CAM-502 (P2 geo proximity) BR-2 — proximity search: "ใกล้/แถว X" is NOT
   * the same as `province` ("ใน X" exact-inside only) — this returns camps
   * NEAR X (including camps IN X), sorted nearest-first. Thai/English
   * accepted, same as `province` (resolved via the same
   * `resolveProvinceForSearch`). Mutually exclusive with `province`/`region`
   * in intent — when set, `near` takes precedence (EC-3) and `province`/
   * `region` are ignored for the location filter (still consulted by their
   * own non-location args, e.g. terrain, unaffected).
   */
  near: z.string().trim().min(1).max(100).optional(),
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
   * CAM-511 BR-1 — rentable equipment the camp must offer. UNLIKE the
   * terrain/access/activities/facilities groups above (whose array form is
   * OR-within-group, "matches EITHER" — CAM-461 Decision 4), an `equipment`
   * ARRAY is AND semantics — the camp must offer ALL listed items (a
   * "rents the full kit" query, e.g. a beginner with no gear needs a camp
   * that rents a tent AND a light AND power, not just one of the three).
   * See executeSearchCampsites below: an array is joined into the SAME
   * comma-separated shape `buildCampSiteWhere` already AND-per-codes for its
   * pre-CAM-461 string callers (the real "multi-facility" AND semantics),
   * rather than routed through its newer array-OR branch.
   */
  equipment: z.enum(EQUIPMENT_CODES).or(z.array(z.enum(EQUIPMENT_CODES))).optional(),
  /**
   * CAM-515 (S3) — OR-within-group semantics (CAM-461 Decision 4), same as
   * terrain/access/activities/facilities above: "ลานจิบเบียร์ริมธาร" ->
   * ALCO, "ลานก่อไฟได้" -> FIRE, "รองรับผู้พิการ"/"wheelchair" -> ADAA.
   */
  annotatedFeatures: z.enum(ANNOTATED_CODES).or(z.array(z.enum(ANNOTATED_CODES))).optional(),
  /**
   * CAM-516 (S4) — OR-within-group semantics (CAM-461 Decision 4), same as
   * terrain/access/activities/facilities/annotatedFeatures above: "ลานสบาย
   * สายคุณหนู" -> CHIC, "ลานทั่วไป" -> GENR, "ลานลำบาก" -> DIFT, "ลานสายลุย
   * ทรหด" -> IDMT.
   */
  camperStyle: z.enum(CAMPER_STYLE_CODES).or(z.array(z.enum(CAMPER_STYLE_CODES))).optional(),
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
    near: {
      type: 'string',
      description:
        'Province name (Thai or English) for a PROXIMITY search — use this instead of `province` when the camper asks for camps NEAR/AROUND a province rather than strictly inside it (e.g. "ลานกางเต็นท์ใกล้กรุงเทพ", "แคมป์แถวโคราช", "รอบๆเชียงใหม่", "ย่าน/บริเวณ" + a province). Returns camps around that province (including camps in it), sorted nearest-first. Do NOT set `province` at the same time for the same place — use `near` alone. Use `province` instead when the camper says "ใน X" (exactly inside X) or just names a province with no proximity word. ' +
        'ALSO accepts a well-known landmark/area name (a national park, mountain, or popular camping region that spans multiple provinces, e.g. "เขาใหญ่", "ปาย", "เขาค้อ", "ดอยอินทนนท์") — no proximity word is needed for a landmark, its name alone means "camps around here" (e.g. "ลานกางเต็นท์เขาใหญ่" -> near="เขาใหญ่"). Never set `province` for a landmark that spans multiple provinces. If the camper names a landmark you do not recognize, do not set `near` for it — use `keyword` instead.',
    },
    type: {
      type: 'string',
      description:
        'Camp site type code — CAGD (ลานกางเต็นท์ทั่วไป), CACP (รถเต็นท์), GLAMP (กลามปิ้ง — เต็นท์เซ็ตพร้อม สะดวกสบาย ไม่ต้องแบกอุปกรณ์), VIEW (จุดวิวสวย), LAKE, FOREST. ' +
        'Trigger words: "แกลมปิ้ง"/"กลามปิ้ง"/"glamping" → GLAMP; "วิวสวย"/"วิวดี" → VIEW. Single value only (not an array).',
    },
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
        'Terrain the campsite is set in — pick ONE that best matches the camper\'s description, or pass an ARRAY of codes when the camper names two-or-more options in one group (e.g. "ริมน้ำหรือชายหาด" → ["RIVE","BEAC"], matches EITHER). ' +
        'RIVE = แม่น้ำ ลำธาร คลองเล็ก (river/stream/creek, e.g. "ติดน้ำ"/"ริมน้ำ"), BEAC = ชายหาด (a sandy beach specifically, e.g. "หาดทราย"), MTNS = ภูเขา (mountain/surrounded by mountains, e.g. "วิวภูเขา"), FORE = ป่า (forest), ' +
        'SEA = ทะเล (the sea generally — use this rather than BEAC when the camper just says "ทะเล"/"ริมทะเล"/"วิวทะเล" without naming a sandy beach), COAS = ริมชายฝั่ง (a coastal/shoreline area, broader than one beach), LAKE = ทะเลสาบ (lake), ' +
        'WATF = น้ำตก (waterfall, e.g. "มีน้ำตก"/"ลานริมน้ำตก"), SWMH = แอ่งเล่นน้ำ (a natural swimming hole/pool, e.g. "แอ่งน้ำ"/"เด็กเล่นน้ำ"), FILD = ทุ่ง (an open field/meadow, e.g. "ทุ่งหญ้า"), CAVE = ถ้ำ (cave), FARM = ไร่ / ฟาร์มสเตย์ (farm/farmstay).',
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
        'A specific facility the camper asked for — pick ONE, or pass an ARRAY when the camper names two-or-more (matches EITHER): SHOW ห้องอาบน้ำ, TOIL ห้องน้ำ, PICN โต๊ะปิคนิค, WIFI ไวไฟ, TRAS ถังขยะ, SANI จุดทิ้งสิ่งปฏิกูล, POTA ก๊อกน้ำ, ELEC จุดจ่ายไฟฟ้า, WATE จุดจ่ายน้ำ, SINK อ่างล้างจาน, CART รถเข็น, MIMT ร้านขายของชำ, GRIL หมูกระทะ, CAFE คาเฟ่, REST ร้านอาหาร, FEIC น้ำแข็งฟรี, FEDW น้ำดื่มฟรี, ' +
        'HOTW น้ำอุ่น (hot water/shower, e.g. "น้ำอุ่น"/"อาบน้ำอุ่น" — a comfort/beginner-friendly amenity, distinct from SHOW which is just "มีห้องอาบน้ำ" with no temperature implied), LIGT ไฟส่องสว่างตลอดคืน (night lighting, e.g. "ไฟส่องสว่าง"/"ไฟกลางคืน"/"มีไฟตอนกลางคืน" — a safety/comfort amenity for a beginner camper worried about the dark).',
    },
    equipment: {
      type: 'string',
      enum: EQUIPMENT_CODES,
      description:
        'Rentable equipment/gear the camp must offer, for a camper who has no gear of their own or wants to rent — pass an ARRAY of codes when the camper needs MULTIPLE items (an array means the camp must offer ALL listed items, e.g. a beginner arriving empty-handed needs a full rental kit — this is AND, unlike the OR-within-group arrays above). TENT เต็นท์, POWE ปลั๊กสนาม, TFAN พัดลม, BLKT ผ้าห่ม, LEDL หลอดไฟ LED, GDST ผ้าปูรองเต็นท์, SSTV เตาถ่านขนาดเล็ก, LSTV เตาถ่านขนาดใหญ่, CHAI เก้าอี้, FYST ผ้าฟลายชีท, ICBK กระติกน้ำแข็ง.',
    },
    annotatedFeatures: {
      type: 'string',
      enum: ANNOTATED_CODES,
      description:
        'A rule/right the camp carries (not a physical facility) — pick ONE, or pass an ARRAY when the camper names two-or-more (matches EITHER): ' +
        'ALCO = ดื่มแอลกอฮอล์ได้ (alcohol allowed, e.g. "จิบเบียร์"/"ดื่มเบียร์"/"กินเหล้าได้ไหม"/"แอลกอฮอล์"), ' +
        'FIRE = ก่อไฟได้ (fires/campfires allowed, e.g. "ก่อไฟได้ไหม"/"กองไฟ"), ' +
        'FIWD = มีฟืนขาย/บริการ (firewood available/for sale, e.g. "มีฟืนขายไหม"/"ฟืน"), ' +
        'ADAA = รองรับผู้พิการ (wheelchair/disability accessible, e.g. "ผู้พิการ"/"wheelchair"/"รถเข็น"), ' +
        'RESV = จองล่วงหน้าได้ (can reserve/book ahead, e.g. "จองล่วงหน้าได้ไหม").',
    },
    camperStyle: {
      type: 'string',
      enum: CAMPER_STYLE_CODES,
      description:
        'The host-declared vibe/style of the camp (not a rule or a physical facility) — pick ONE, or pass an ARRAY when the camper names two-or-more (matches EITHER): ' +
        'CHIC = สบาย (สายคุณหนู) (chic/comfy/glamping-ish, e.g. "สบาย"/"สายคุณหนู"/"หรูหรา"), ' +
        'GENR = ทั่วไป (general/standard, e.g. "ทั่วไป"/"ธรรมดา"), ' +
        'DIFT = ลำบาก (difficult, e.g. "ลำบาก"/"ไม่สะดวก"), ' +
        'IDMT = ทรหด (indomitable/rugged, e.g. "ทรหด"/"สายลุย"/"โหด").',
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
  // CAM-502 (P2) BR-2/EC-3 — `near` (proximity intent) is consulted FIRST and
  // wins over both `province` and `region` when present: a camper who said
  // "ใกล้/แถว X" wants camps AROUND X, not narrowed to exactly-X or an
  // unrelated region. `near`'s own resolution below decides whether that
  // becomes a geo (bbox+haversine) search or falls back to an exact-province
  // filter (EC-2 — no centroid for that province).
  let provinceFilter: string | string[] | undefined;
  let nearCentroid: { lat: number; lng: number } | undefined;
  // CAM-503 (P3) BR-3 — the effective search radius for the geo path below;
  // defaults to the province-proximity radius (MAX_NEAR_KM) and is
  // overridden to the landmark's own curated `radiusKm` only on the
  // landmark branch just below. Declared here (not inline at each branch)
  // so the single geo-path block further down needs no `near`-kind branch
  // of its own — bbox+haversine+cap stays the ONE near-path (BR-3 "do not
  // fork"), only its origin+radius differ per source.
  let nearRadiusKm: number = MAX_NEAR_KM;
  if (args.near !== undefined) {
    // BR-3 — try the landmark gazetteer FIRST: a landmark (e.g. เขาใหญ่)
    // spans multiple provinces and has no `PROVINCE_CENTROIDS` entry, so
    // checking the province path first would always miss it, not just find
    // it more slowly.
    const landmark = findLandmark(args.near);
    if (landmark) {
      nearCentroid = { lat: landmark.lat, lng: landmark.lng };
      nearRadiusKm = landmark.radiusKm;
    } else {
      const resolvedNear = await resolveProvinceForSearch(args.near);
      const centroid = PROVINCE_CENTROIDS[resolvedNear];
      if (centroid) {
        nearCentroid = { lat: centroid.lat, lng: centroid.lng };
        // Geo path: the location filter is the bbox pushed onto `where`
        // below, NOT an exact-province equality — `provinceFilter` stays
        // unset.
      } else {
        // EC-2 — sparse/unknown centroid AND not a known landmark: fall
        // back to an exact-province filter on the resolved value itself
        // (never crash, never a fabricated point).
        provinceFilter = resolvedNear;
      }
    }
  } else if (args.province !== undefined) {
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
    // CAM-511 BR-1 — an array is joined into `buildCampSiteWhere`'s
    // comma-separated STRING shape (AND-per-code, its pre-CAM-461 path),
    // never left as an array (which would hit the newer array-OR branch) —
    // this is what gives `equipment` its "must offer ALL listed items"
    // semantics, deliberately different from terrain/access/activities/
    // facilities above.
    equipment: Array.isArray(args.equipment) ? args.equipment.join(',') : args.equipment,
    annotatedFeatures: args.annotatedFeatures,
    camperStyle: args.camperStyle,
    excludeIds,
  });

  // BR-2: hard cap, never overridden by a larger model-supplied count.
  const take = Math.min(args.limit ?? SEARCH_CAMPSITES_MAX_RESULTS, SEARCH_CAMPSITES_MAX_RESULTS);

  let cards: AiCampCard[];

  if (nearCentroid) {
    // CAM-502 (P2) BR-2 geo path — ADR-009: `where` here is `buildCampSiteWhere`'s
    // OWN output with a bbox AND-clause appended (an EXTENSION, never a
    // forked where-builder), so terrain/access/activities/facilities/etc.
    // still apply exactly as they do on every other path.
    // CAM-503 BR-3 — `nearRadiusKm` is the landmark's own curated radius
    // when `nearCentroid` came from the gazetteer, else MAX_NEAR_KM (P2,
    // province proximity) — the bbox/haversine/cap logic itself is
    // unchanged, only the radius input differs (no forked near-path).
    const bbox = bboxForRadius(nearCentroid, nearRadiusKm);
    const andArray = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    andArray.push({
      latitude: { gte: bbox.latMin, lte: bbox.latMax },
      longitude: { gte: bbox.lngMin, lte: bbox.lngMax },
    });
    where.AND = andArray;

    // CAM-344 lesson (EC-4) — cap the candidate set BEFORE the haversine
    // sort/filter runs, independent of how many camps the bbox matches.
    const candidates = await prisma.campSite.findMany({
      where,
      select: { id: true, latitude: true, longitude: true },
      take: NEAR_CANDIDATE_CAP,
    });

    // Exact circular cut (the bbox above is only a rectangular superset) +
    // ascending haversine sort + page-size cap, in that order (BR-2).
    const ranked = candidates
      .map((c) => ({ id: c.id, distanceKm: haversineDistanceKm(nearCentroid!, { lat: c.latitude, lng: c.longitude }) }))
      .filter((c) => c.distanceKm <= nearRadiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, take);

    if (ranked.length === 0) {
      // AC-4 — honest empty: no camp within radius, never mislabel/crash.
      cards = [];
    } else {
      const rankedIds = ranked.map((c) => c.id);
      const rows = await prisma.campSite.findMany({
        where: { id: { in: rankedIds } },
        select: aiCampCardSelect,
      });
      // Prisma's `id: { in: [...] }` does not preserve array order — restore
      // the haversine-ascending order explicitly (BR-2 "sort by distance").
      const rowById = new Map(rows.map((r) => [r.id, r]));
      cards = rankedIds
        .map((id) => rowById.get(id))
        .filter((row): row is (typeof rows)[number] => row !== undefined)
        .map(toAiCampCard);
    }
  } else {
    // CAM-461 BR-2/Decision 3 — reuse orderByFor verbatim (ADR-009, no forked
    // sort). Absent `sort` defaults to 'related' — makes the previously
    // order-unspecified findMany deterministic (BR-2 default, ratified at G2).
    const rows = await prisma.campSite.findMany({
      where,
      select: aiCampCardSelect,
      orderBy: orderByFor(args.sort ?? 'related'),
      take,
    });
    cards = rows.map(toAiCampCard);
  }

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
    'Search published, active CampVibe campsites by province, region, type, price range, pet-friendliness, terrain, access, activities, facilities, rentable equipment, annotated features (rules/rights like alcohol-allowed, fires-allowed, firewood, wheelchair-accessible, reservable), and camper style (host-declared vibe: chic/comfy, general, difficult, indomitable/rugged). Returns at most 10 result cards. Pass startDate+endDate together when the camper gave a stay date range to get a LIVE remaining-capacity count per card. ' +
    'Pass `equipment` when the camper needs rental gear — a beginner with no equipment of their own ("มือใหม่", "ไม่มีอุปกรณ์", "มาตัวเปล่า") or anyone asking what a camp rents out. An array means the camp must offer ALL listed items (AND, not OR like the other taxonomy filters). ' +
    'Pass `region` (not `province`) when the camper asks by ภาค — "ภาคเหนือ"/"อีสาน"/"ภาคใต้" — rather than a single province; it expands to every province in that region server-side. ' +
    'Pass `near` (not `province`) when the camper asks for camps NEAR/AROUND a province rather than strictly inside it (e.g. "ใกล้กรุงเทพ", "แถวโคราช") — results are centered on that province and sorted nearest-first, including camps inside it; capped to a realistic radius. `near` also accepts a well-known landmark/area name that spans multiple provinces (e.g. "เขาใหญ่", "ปาย") — no proximity word needed for those, and never set `province` for one. ' +
    'Pass `sort` when the camper asks for an order (cheapest/most-expensive/best-rated first) — `sort` is ignored when `near` is set, since a proximity search is always ordered by distance. ' +
    'When the camper asks for MORE, OTHER, or DIFFERENT camps than what was already shown this conversation (e.g. "ขออีก", "ไม่เอาที่แสดงไปแล้ว", "มีที่อื่นอีกไหม") — re-call this tool with the SAME filters plus `excludeIds` set to the campSiteIds listed in <shown_results>, so the search returns camps not already shown.',
  // CAM-417 (ADR-013 D5) — offered to every caller, session or not.
  tier: 'guest',
  parameters: searchCampsitesArgsSchema,
  jsonSchema,
  // CAM-417 — this tool needs no caller identity; `_ctx` is server-bound and unused here.
  execute: (args, _ctx) => executeSearchCampsites(args),
};
