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
import { buildCampSiteWhere, resolveProvinceAdminAreaIds } from '@/lib/campsite-filters';
import { aiCampCardSelect, toAiCampCard, type AiCampCard } from '@/lib/read-models/ai-camp-card';
import { getRemainingCapacityForCamps } from '@/lib/campsite-availability';
import { VALID_SORTS, orderByFor } from '@/lib/catalog-cursor';
import { resolveRegionForSearch } from '@/lib/thai-regions';
import { haversineDistanceKm } from '@/lib/geo/distance';
import { matchAdminArea, listChildAdminAreaIds, type AdminAreaMatchPrisma } from '@/lib/geo/admin-area-match';
import {
  resolveProvinceAliasToCanonicalTh,
  resolveRegionAliasToCanonicalPhrase,
  resolveZoneAliasToDistrict,
} from '@/lib/ai/place-aliases';
import provinceCentroidsData from '@/prisma/data/province-centroids.json';
import landmarkGazetteerData from '@/prisma/data/landmark-gazetteer.json';
import type { ToolDefinition } from '@/lib/ai/tool-registry';
import type { AiChatCardTag } from '@/lib/api-client';

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
  /**
   * CAM-587 — a Thai อำเภอ (district) name, Thai or English, resolved
   * server-side through the SAME shared `matchAdminArea` (lib/geo/admin-
   * area-match.ts, CAM-566) every other AdminArea lookup in this codebase
   * uses — never a forked matcher. Wins over `province`/`region` (BR-3,
   * see the precedence write-up in story.md) but loses to `near`/
   * `subDistrict` — see `subDistrict` below. An unresolvable district name
   * never falls back to a province/keyword search (honest empty — BR-2,
   * mirrors CAM-463 BR-4).
   */
  district: z.string().trim().min(1).max(100).optional(),
  /**
   * CAM-587 — a Thai ตำบล (sub-district) name, Thai or English — the MOST
   * specific location arg; wins over `district`/`province`/`region` when
   * present (still loses to `near`, a categorically different proximity
   * intent, unchanged from before this story). Same honest-empty rule as
   * `district`: an unresolvable sub-district name never silently widens to
   * its district/province.
   */
  subDistrict: z.string().trim().min(1).max(100).optional(),
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
 *
 * CAM-564 — `matchedTag` is OPTIONAL on this interface (unlike `remaining`)
 * so `check-availability.ts`/`bulk-availability.ts` — the OTHER two tools
 * that already reuse this exact `SearchCampsiteCard` shape for their own,
 * differently-sourced cards, outside this story's surface — keep
 * type-checking unchanged (api.md rule 12: additive by extension, never a
 * breaking required-field addition to a shared type). `searchCampsites`
 * itself (this file) ALWAYS sets a real value (`null` or a tag) below —
 * `null` = no taxonomy filter the camper's own search supplied matched THIS
 * card (a free-text/location-only search, or the search used no taxonomy
 * filter at all) — render no badge, never fall back to the camp's own fixed
 * default tag (that fixed fallback is exactly what CAM-547 found dishonest —
 * a badge that describes the camp, not the search). See `deriveMatchedTags`
 * below for how the ONE leading tag is chosen when more than one supplied
 * filter matches the same card.
 */
export interface SearchCampsiteCard extends AiCampCard {
  remaining: number | null;
  matchedTag?: AiChatCardTag | null;
}

/**
 * CAM-564 BR-2 — the multi-match PRIORITY order (highest first) used to pick
 * ONE leading badge when the camper's search supplies filters across more
 * than one taxonomy group and a card matches more than one of them. This is
 * a DELIBERATE editorial order, never data/arrival/DB-return order:
 *   1. terrain            — the camp's own defining physical character; the
 *                            same single-descriptor CONCEPT the retired fixed
 *                            badge already used (design continuity).
 *   2. camperStyle         — the host's own declared vibe/identity; still a
 *                            camp-level fact, one step less "physical" than terrain.
 *   3. annotatedFeatures   — a rule/right (e.g. "ก่อไฟได้") that can gate
 *                            whether the camper can even go; materially
 *                            decision-shaping, not just an amenity.
 *   4. activities          — the specific thing the camper asked to DO there;
 *                            about the trip, not the ground it sits on.
 *   5. facilities          — 6. access — 7. equipment — logistics/amenities,
 *                            deliberately least camp-defining of the seven
 *                            filterable groups (see story.md BR-2 for the
 *                            full rationale).
 * `type` (campSiteType, e.g. GLAMP) is deliberately OUT of this list: it is a
 * scalar `CampSite` column matched by plain equality, never an `options`
 * MasterData relation row — there is no per-card "did this camp actually
 * carry the tag" fact to verify for it the way there is for every group
 * below (see story.md Seams & refs).
 */
const MATCHED_TAG_GROUP_PRIORITY = [
  'terrain',
  'camperStyle',
  'annotatedFeatures',
  'activities',
  'facilities',
  'access',
  'equipment',
] as const;
export type MatchedTagGroupKey = (typeof MATCHED_TAG_GROUP_PRIORITY)[number];

/** A single-string arg is one code; an array arg (OR-within-group, CAM-461) is 1+ — either way, normalize to a code list. Absent -> []. */
function toCodeList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * CAM-564 BR-1/BR-3 — derives, per returned card, the ONE taxonomy tag that
 * honestly explains why THAT card is in these results.
 *
 * Why a second, small, BATCHED query is needed (never inferred from `args`
 * alone): `buildCampSiteWhere` ANDs each supplied GROUP against the where
 * clause, but a group's own ARRAY form is OR-within-group (CAM-461) — e.g.
 * `terrain:["RIVE","BEAC"]` guarantees a returned card has AT LEAST ONE of
 * the two, never tells the caller WHICH one. Only a real read of this card's
 * own MasterData rows (bounded to the small set of codes THIS search itself
 * supplied — never the whole taxonomy) can say which specific code the card
 * carries — anything else would be a guess dressed as a fact.
 *
 * Batched (BR-4, performance.md no-N+1): ONE extra `findMany` for the WHOLE
 * page of ≤`SEARCH_CAMPSITES_MAX_RESULTS` cards, never a per-card query in a
 * loop — the same pattern `getRemainingCapacityForCamps` already uses below.
 * Skipped entirely when the search supplied no taxonomy filter at all
 * (`candidateCodes` empty) — the common free-text/location-only case never
 * pays for a query whose answer is always "no match" (EC — no-match case).
 *
 * Fail-open (BR-5): a lookup failure never blocks the search itself — the
 * worst case is simply no badge on this turn's cards, the same fail-open
 * convention `resolveProvinceAdminAreaIds` above already uses.
 */
async function deriveMatchedTags(
  cardIds: string[],
  args: Pick<
    SearchCampsitesArgs,
    'terrain' | 'camperStyle' | 'annotatedFeatures' | 'activities' | 'facilities' | 'access' | 'equipment'
  >
): Promise<Record<string, AiChatCardTag>> {
  const codesByGroup: Record<MatchedTagGroupKey, string[]> = {
    terrain: toCodeList(args.terrain),
    camperStyle: toCodeList(args.camperStyle),
    annotatedFeatures: toCodeList(args.annotatedFeatures),
    activities: toCodeList(args.activities),
    facilities: toCodeList(args.facilities),
    access: toCodeList(args.access),
    equipment: toCodeList(args.equipment),
  };
  const candidateCodes = Array.from(new Set(MATCHED_TAG_GROUP_PRIORITY.flatMap((key) => codesByGroup[key])));

  const matchedTagByCampId: Record<string, AiChatCardTag> = {};
  if (candidateCodes.length === 0 || cardIds.length === 0) return matchedTagByCampId;

  try {
    const rows = await prisma.campSite.findMany({
      where: { id: { in: cardIds } },
      select: {
        id: true,
        options: {
          where: { code: { in: candidateCodes } },
          select: { code: true, nameTh: true, nameEn: true },
        },
      },
    });

    for (const row of rows) {
      const presentCodes = new Set(row.options.map((o) => o.code));
      for (const key of MATCHED_TAG_GROUP_PRIORITY) {
        // Within a tier, preserve the CAMPER'S own supplied order (e.g. the
        // model's own `["RIVE","BEAC"]` order) — never DB/return order.
        const winnerCode = codesByGroup[key].find((code) => presentCodes.has(code));
        if (!winnerCode) continue;
        const opt = row.options.find((o) => o.code === winnerCode);
        if (opt) matchedTagByCampId[row.id] = { nameTh: opt.nameTh, nameEn: opt.nameEn };
        break;
      }
    }
  } catch (error) {
    console.error('[CAM-564] matched-tag lookup failed (fail-open, no badge this turn)', error);
  }

  return matchedTagByCampId;
}

/**
 * CAM-709 BR-3 — resolves Thai labels for the taxonomy codes actually
 * supplied on THIS call, via ONE small batched `MasterData` read (never a
 * per-code loop) — mirrors the exact batching discipline `deriveMatchedTags`
 * above already uses (ONE `findMany`, no loop), but reads `MasterData`
 * directly rather than through `CampSite.options`: `deriveMatchedTags`'s own
 * read is scoped to `cardIds` and short-circuits entirely on a zero-result
 * search (`cardIds.length === 0`) or omits a code that lost every card in an
 * OR-array group, so it cannot be the source for an echo that must stay
 * truthful even on a zero-result search (EC-4) or for a losing OR-array code
 * that still genuinely constrained the query (BR-1). `MasterData.nameTh` is
 * a property of the CODE, not of any one camp, so a direct, independent
 * lookup is both simpler and more complete than deriving it from the
 * per-card read. Fail-open (EC-3): a lookup failure never blocks the search
 * — the reason sentence simply omits that taxonomy entry.
 */
async function resolveTaxonomyLabels(candidateCodes: string[]): Promise<Record<string, string>> {
  if (candidateCodes.length === 0) return {};

  try {
    const rows = await prisma.masterData.findMany({
      where: { code: { in: candidateCodes } },
      select: { code: true, nameTh: true },
    });
    return Object.fromEntries(rows.map((row) => [row.code, row.nameTh]));
  } catch (error) {
    console.error('[CAM-709] taxonomy label lookup failed (fail-open, entries omitted this turn)', error);
    return {};
  }
}

/**
 * CAM-709 BR-3 — one taxonomy criterion inside the `appliedFilters` echo
 * (below), Thai-labeled from MasterData. `group` names the tool's OWN
 * argument dimension (terrain/access/activities/facilities/equipment/
 * annotatedFeatures/camperStyle — the SAME `MatchedTagGroupKey` set
 * `MATCHED_TAG_GROUP_PRIORITY` already uses), never the DB's free-text
 * `MasterData.group` column, which this echo does not read.
 */
export interface SearchCampsitesAppliedTaxonomyFilter {
  group: MatchedTagGroupKey;
  code: string;
  labelTh: string;
}

/**
 * CAM-709 BR-1/BR-2/BR-4 — the honest "why these camps" echo added to
 * `SearchCampsitesResult` below: lists ONLY the arguments that ACTUALLY
 * constrained THIS call's query, so the model composes its opening reason
 * sentence from real facts in the tool result instead of recalling its own
 * tool-call arguments from memory (the exact CAM-500/CAM-501 failure mode
 * this closes off at the source, per the openrouter-client.ts honest-scope
 * clause this story extends). Every field is present ONLY when that
 * dimension really filtered the result set this call — an argument the
 * tool dropped, ignored, or could not resolve (for example `province`/
 * `sort` when `near` wins, or an unresolved district/sub-district) is
 * OMITTED entirely, never echoed as if it had applied (BR-1). Location
 * fields carry the RAW value the caller supplied (whatever language it
 * used), not the server's resolved/canonicalized form, since that is the
 * value the model itself already knows how to phrase naturally in its
 * answer. `taxonomy` is always present (possibly `[]`) so a consumer never
 * has to branch on its absence.
 */
export interface SearchCampsitesAppliedFilters {
  province?: string;
  near?: string;
  district?: string;
  subDistrict?: string;
  region?: string;
  type?: string;
  keyword?: string;
  priceMin?: number;
  priceMax?: number;
  /** Present only when `true` — a `false`/absent value never constrained the query (BR-1). */
  petFriendly?: true;
  sort?: (typeof VALID_SORTS)[number];
  taxonomy: SearchCampsitesAppliedTaxonomyFilter[];
}

/**
 * CAM-709 — the ONE resolved location dimension that actually constrained
 * this call, derived by `executeSearchCampsites` from its own already-
 * finalized branch state (never a parallel re-interpretation of `args`) so
 * this can never drift from the real behavior above it. `kind: 'district'`
 * carries whichever of `district`/`subDistrict` the caller actually
 * supplied (both, when a sub-district was scoped by a district).
 */
type AppliedLocationFilter =
  | { kind: 'near'; value: string }
  | { kind: 'province'; value: string }
  | { kind: 'region'; value: string }
  | { kind: 'district'; district?: string; subDistrict?: string };

/**
 * CAM-709 BR-1/BR-2 — assembles the `appliedFilters` echo from the args that
 * genuinely constrained this call, plus the resolved `location` decision the
 * caller already made and the `sortApplied` flag (false when `near`/an
 * unresolved place made `args.sort` moot — see the tool's own jsonSchema
 * description: "sort is ignored when near is set"). `type` additionally
 * guards against the literal `'ALL'` sentinel some callers use for "no type
 * filter" — `buildCampSiteWhere` itself never applies a `type` filter for
 * that value (BR-1: an argument the tool ignores must not echo).
 */
async function buildAppliedFilters(
  args: SearchCampsitesArgs,
  location: AppliedLocationFilter | undefined,
  sortApplied: boolean
): Promise<SearchCampsitesAppliedFilters> {
  const filters: SearchCampsitesAppliedFilters = { taxonomy: [] };

  if (location?.kind === 'near') filters.near = location.value;
  if (location?.kind === 'province') filters.province = location.value;
  if (location?.kind === 'region') filters.region = location.value;
  if (location?.kind === 'district') {
    if (location.district !== undefined) filters.district = location.district;
    if (location.subDistrict !== undefined) filters.subDistrict = location.subDistrict;
  }

  if (args.type !== undefined && args.type !== 'ALL') filters.type = args.type;
  if (args.keyword !== undefined) filters.keyword = args.keyword;
  if (args.priceMin !== undefined) filters.priceMin = args.priceMin;
  if (args.priceMax !== undefined) filters.priceMax = args.priceMax;
  if (args.petFriendly === true) filters.petFriendly = true;
  if (sortApplied && args.sort !== undefined) filters.sort = args.sort;

  const codesByGroup: Record<MatchedTagGroupKey, string[]> = {
    terrain: toCodeList(args.terrain),
    camperStyle: toCodeList(args.camperStyle),
    annotatedFeatures: toCodeList(args.annotatedFeatures),
    activities: toCodeList(args.activities),
    facilities: toCodeList(args.facilities),
    access: toCodeList(args.access),
    equipment: toCodeList(args.equipment),
  };
  const candidateCodes = Array.from(new Set(MATCHED_TAG_GROUP_PRIORITY.flatMap((key) => codesByGroup[key])));
  const labelByCode = await resolveTaxonomyLabels(candidateCodes);

  for (const group of MATCHED_TAG_GROUP_PRIORITY) {
    for (const code of codesByGroup[group]) {
      const labelTh = labelByCode[code];
      if (labelTh) filters.taxonomy.push({ group, code, labelTh }); // EC-3 — omit on a missing label
    }
  }

  return filters;
}

export interface SearchCampsitesResult {
  /** Never null — a zero-match search returns [] so the caller can render an empty state (AC-8). */
  cards: SearchCampsiteCard[];
  /** CAM-709 BR-1/BR-2 — additive (api.md rule 12): the honest "why these camps" echo, see `SearchCampsitesAppliedFilters` above. */
  appliedFilters: SearchCampsitesAppliedFilters;
}

/** CAM-404 — a province arg containing any Thai character triggers the AdminArea resolve below (CAM-574: was ThailandLocation). */
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
 * exist. CAM-574: resolve via `AdminArea` (`nameTh` ↔ `nameEn`, PROVINCE
 * level — was `ThailandLocation.provinceName`/`provinceNameEn`, retired);
 * English input is returned unchanged (no DB round-trip). CAM-458 seeds all
 * 77 provinces (was ~12) and adds the Bangkok-alias normalization above — an
 * unmapped Thai word, or any lookup error, still falls back to the raw value
 * unchanged (never throws), matching the search's prior behavior.
 *
 * CAM-587 — `resolveProvinceAliasToCanonicalTh` (the 52-province owner-
 * authored alias dataset, `prisma/data/place-aliases.json`) is consulted
 * FIRST, ahead of the pre-existing `BANGKOK_ALIASES` map: it is a strict
 * superset (Bangkok's own alias-file entry covers every `BANGKOK_ALIASES`
 * key plus more) but `BANGKOK_ALIASES` is kept as-is, never removed, so a
 * value neither table recognizes still falls through unchanged exactly as
 * before this story (byte-identical for every pre-CAM-587 caller/test).
 */
async function resolveProvinceForSearch(province: string): Promise<string> {
  if (!THAI_CHAR_PATTERN.test(province)) return province;

  const normalized = resolveProvinceAliasToCanonicalTh(province) ?? BANGKOK_ALIASES[province] ?? province;

  try {
    const match = await prisma.adminArea.findFirst({
      where: { countryCode: 'TH', level: 'PROVINCE', nameTh: { contains: normalized } },
      select: { nameEn: true },
    });
    return match?.nameEn ?? province;
  } catch {
    return province;
  }
}

/**
 * CAM-587 — layers the `place-aliases.json` `regionAliases` group (e.g.
 * "ล้านนา"→NORTH, "แดนอีสาน"→NORTHEAST) on top of the existing
 * `resolveRegionForSearch` (`lib/thai-regions.ts`, untouched — out of this
 * story's file surface). An alias hit is translated to one of the six
 * formal `ภาค`-prefixed phrases that resolver's own table already expands
 * (never a duplicate province list); no alias match falls through to the
 * original value unchanged — byte-identical to before this story for every
 * word the alias file does not cover.
 */
function resolveRegionForSearchWithAlias(region: string): string | string[] {
  const aliasCanonical = resolveRegionAliasToCanonicalPhrase(region);
  return resolveRegionForSearch(aliasCanonical ?? region);
}

/**
 * CAM-587 — resolves the ตำบล (sub-district) level: an exact, hierarchical
 * match against `AdminArea` (level SUBDISTRICT) via the SAME shared
 * `matchAdminArea` every other AdminArea lookup in this codebase uses
 * (CAM-566, never forked). `districtParentId`, when known (the camper also
 * named — or a zone alias also implied — a district), scopes the match so a
 * same-named sub-district under an unrelated district can never false-match
 * (the exact DEF-1/DEF-2 lesson `matchAdminArea`'s own tests pin). Returns
 * `null` when unresolved — the caller's honest-empty path, never a fallback.
 */
async function resolveSubDistrictAdminAreaId(
  matcherPrisma: AdminAreaMatchPrisma,
  name: string,
  districtParentId?: string
): Promise<string | null> {
  const node = await matchAdminArea(matcherPrisma, 'SUBDISTRICT', name, districtParentId);
  return node?.id ?? null;
}

/**
 * CAM-587 — resolves the อำเภอ (district) level. `place-aliases.json`'s
 * `zoneAliases` group is consulted FIRST: a zone alias (e.g. "หัวหิน",
 * "อ.หัวหิน") IS a district by the story's own framing, so it is normalized
 * to its canonical district name and run through the exact SAME
 * `matchAdminArea` call a plain-named district takes — never a parallel
 * zone-specific lookup (the "one story, not two" rule in story.md). When the
 * zone alias also names its own province and the caller did not already
 * supply a scoping `provinceParentId`, that province is resolved too (best-
 * effort disambiguation) — a failed province lookup here never blocks the
 * district match itself (fail-open, matches this file's existing
 * `resolveProvinceAdminAreaIds` catch-and-continue convention).
 *
 * On a match, returns the district's own id PLUS every sub-district beneath
 * it: a camp's `Location.adminAreaId` holds the DEEPEST level actually
 * resolved for that camp (subDistrict ?? district ?? province — the same
 * convention `resolveProvinceAdminAreaIds`, lib/campsite-filters.ts,
 * documents for the province case), so a district-only match that omitted
 * its sub-district children would silently miss every camp recorded one
 * level deeper. Returns `null` when unresolved (honest empty).
 */
async function resolveDistrictAdminAreaIds(
  matcherPrisma: AdminAreaMatchPrisma,
  name: string,
  provinceParentId?: string
): Promise<string[] | null> {
  const zoneMatch = resolveZoneAliasToDistrict(name);
  const effectiveName = zoneMatch?.districtNameTh ?? name;

  let effectiveProvinceParentId = provinceParentId;
  if (!effectiveProvinceParentId && zoneMatch) {
    try {
      const provinceNode = await matchAdminArea(matcherPrisma, 'PROVINCE', zoneMatch.provinceNameTh);
      effectiveProvinceParentId = provinceNode?.id;
    } catch (error) {
      console.error('[CAM-587] zone-alias province scoping lookup failed (fail-open, district match unscoped)', error);
    }
  }

  const districtNode = await matchAdminArea(matcherPrisma, 'DISTRICT', effectiveName, effectiveProvinceParentId);
  if (!districtNode) return null;

  const subDistrictIds = await listChildAdminAreaIds(matcherPrisma, 'SUBDISTRICT', districtNode.id);
  return [districtNode.id, ...subDistrictIds];
}

/**
 * CAM-587 BR-3 — the district/sub-district "exact-inside" family, evaluated
 * only when at least one of `district`/`subDistrict` is present (the caller
 * checks this before invoking). `province`, when ALSO supplied, is consulted
 * ONLY as a scoping hint for disambiguation (resolved through the exact SAME
 * `resolveProvinceForSearch` + `matchAdminArea` every other province lookup
 * in this file uses) — it never becomes a competing top-level filter here,
 * and if it fails to resolve to a real AdminArea node, the WHOLE lookup is
 * treated as unresolved (never silently drop the camper's own scoping intent
 * and search unscoped instead — honest failure over a possibly-wrong match).
 *
 * `subDistrict`, when present, wins outright over `district`: the district
 * arg (if also given) is used ONLY to scope the sub-district match, never as
 * an additional/wider filter of its own. See story.md's precedence write-up
 * for the full ladder (`near` > `subDistrict` > `district` > `province` >
 * `region`).
 */
async function resolveExactInsideAdminAreaIds(
  matcherPrisma: AdminAreaMatchPrisma,
  args: Pick<SearchCampsitesArgs, 'district' | 'subDistrict' | 'province'>
): Promise<string[] | null> {
  let provinceParentId: string | undefined;
  if (args.province !== undefined) {
    const resolvedProvinceName = await resolveProvinceForSearch(args.province);
    const provinceNode = await matchAdminArea(matcherPrisma, 'PROVINCE', resolvedProvinceName);
    if (!provinceNode) return null; // named province used for scoping could not itself be resolved — honest empty
    provinceParentId = provinceNode.id;
  }

  if (args.subDistrict !== undefined) {
    let districtParentId: string | undefined;
    if (args.district !== undefined) {
      const districtIds = await resolveDistrictAdminAreaIds(matcherPrisma, args.district, provinceParentId);
      if (!districtIds) return null; // named district used for scoping could not itself be resolved
      districtParentId = districtIds[0]; // the district's own id — see resolveDistrictAdminAreaIds's return shape
    }
    const subDistrictId = await resolveSubDistrictAdminAreaId(matcherPrisma, args.subDistrict, districtParentId);
    return subDistrictId ? [subDistrictId] : null;
  }

  return resolveDistrictAdminAreaIds(matcherPrisma, args.district!, provinceParentId);
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
        'ALSO accepts a well-known landmark/area name (a national park, mountain, or popular camping region that spans multiple provinces, e.g. "เขาใหญ่", "ปาย", "เขาค้อ", "ดอยอินทนนท์") — no proximity word is needed for a landmark, its name alone means "camps around here" (e.g. "ลานกางเต็นท์เขาใหญ่" -> near="เขาใหญ่"). Never set `province` for a landmark that spans multiple provinces. If the camper names a landmark you do not recognize, do not set `near` for it — use `keyword` instead. ' +
        'Do NOT use `near` for a district/town/sub-district name (e.g. "หัวหิน", "หาดใหญ่") — use `district` below instead, which resolves it exactly rather than as a fuzzy proximity guess.',
    },
    district: {
      type: 'string',
      description:
        'A Thai อำเภอ (district) or well-known town/zone name (Thai or English), e.g. "หัวหิน", "อ.หัวหิน", "ปากช่อง", "หาดใหญ่" — resolved exactly against the real administrative-area data (including common colloquial/abbreviation forms for a district). ' +
        'Use this (not `near`, not `province`) when the camper names a specific district/town rather than a whole province or a proximity ask. Combine with `province` ONLY to disambiguate a district name that exists in more than one province — never invent a province the camper did not name. ' +
        // CAM-596 — reconciles the pre-CAM-596 "do NOT guess" guidance with
        // the new server-side pre-pass hint: recognising a district is the
        // SERVER's job (it checks against real data you cannot see), not
        // yours. The first sentence below governs a turn where this turn's
        // own instructions ALREADY tell you to set `district` (a MANDATORY
        // hint); the second sentence governs a district name you decide to
        // set on your OWN initiative, with no such instruction present.
        'If this turn\'s own instructions already tell you to set `district` to a specific value, that is a confirmed match and you MUST follow it. ' +
        'On your OWN initiative (no instruction telling you to set this), if the camper names a district/town you do not recognize, do NOT guess — leave this unset and use `keyword` instead; setting it to a value that fails to resolve returns zero results.',
    },
    subDistrict: {
      type: 'string',
      description:
        'A Thai ตำบล (sub-district) name (Thai or English) — the MOST specific place filter, for when the camper names a sub-district explicitly (rare in casual chat, but exact when given). Optionally combine with `district`/`province` to disambiguate a sub-district name that repeats across districts. ' +
        // CAM-600 — same reconciliation CAM-596 gave `district` above: a
        // deterministic server-side pre-pass now exists for a CURATED,
        // camp-holding shortlist of sub-districts (place-resolver.ts's
        // `detectSubDistrict`) and pairs it with a MANDATORY `district`
        // hint — the first sentence below governs that instructed turn; the
        // second (CAM-596's original wording, unchanged) still governs a
        // sub-district name you decide to set on your OWN initiative, with
        // no such instruction present.
        'If this turn\'s own instructions already tell you to set `subDistrict` (and `district`) to specific values, that is a confirmed match and you MUST follow both. ' +
        'On your OWN initiative (no instruction telling you to set this), only set this when the camper actually named a sub-district you are confident is real — do NOT guess one; a value that fails to resolve returns zero results rather than falling back to `district`/`province`.',
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
  // CAM-587 — the district/sub-district resolved id-set (ANDed onto `where`
  // below, alongside `provinceFilter`) and the honest-empty flag it sets
  // when a named place could not be resolved — see the branch below.
  let adminAreaLocationFilter: string[] | undefined;
  let unresolvedNamedPlace = false;
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
  } else if (args.district !== undefined || args.subDistrict !== undefined) {
    // CAM-587 BR-3 — the district/sub-district "exact-inside" family: wins
    // over a bare `province`/`region` (a named administrative unit is more
    // specific than either), still loses to `near` above (unchanged). See
    // resolveExactInsideAdminAreaIds's own docblock + story.md for the full
    // precedence write-up.
    const ids = await resolveExactInsideAdminAreaIds(prisma, args);
    if (ids) {
      adminAreaLocationFilter = ids;
    } else {
      // CAM-587 — THE part that matters most: a named district/sub-district
      // (or the province supplied to scope it) that cannot be resolved
      // returns ZERO rows honestly — never a silent fallback to a bare
      // province/keyword search that "looks right" but answers a different
      // question (mirrors CAM-463 BR-4's unrecognized-region contract).
      unresolvedNamedPlace = true;
    }
  } else if (args.province !== undefined) {
    provinceFilter = await resolveProvinceForSearch(args.province);
  } else if (args.region !== undefined) {
    provinceFilter = resolveRegionForSearchWithAlias(args.region);
  }

  // CAM-709 BR-1 — derives which location arg ACTUALLY constrained this call,
  // by mirroring the exact precedence (near > district/sub-district >
  // province > region) the if/else-if chain above just applied — never a
  // parallel re-interpretation of `args`, so this cannot drift from the real
  // decision. `near` always constrains once set (both the geo path and the
  // EC-2 province-equality fallback are driven by it). A district/sub-
  // district that failed to resolve (`unresolvedNamedPlace`) is the BR-1
  // "dropped" case — it never reaches a real `where` clause, so it is never
  // echoed.
  let appliedLocationFilter: AppliedLocationFilter | undefined;
  if (args.near !== undefined) {
    appliedLocationFilter = { kind: 'near', value: args.near };
  } else if (args.district !== undefined || args.subDistrict !== undefined) {
    if (!unresolvedNamedPlace) {
      appliedLocationFilter = { kind: 'district', district: args.district, subDistrict: args.subDistrict };
    }
  } else if (args.province !== undefined) {
    appliedLocationFilter = { kind: 'province', value: args.province };
  } else if (args.region !== undefined) {
    appliedLocationFilter = { kind: 'region', value: args.region };
  }

  // CAM-461 BR-1/EC-1 — bound the model-controlled excludeIds array BEFORE
  // buildCampSiteWhere/findMany ever runs (CAM-344 lesson: cap before the
  // query, never after). Over the cap → keep the first MAX_EXCLUDE_IDS,
  // never fail the search.
  const excludeIds = args.excludeIds !== undefined ? args.excludeIds.slice(0, MAX_EXCLUDE_IDS) : undefined;

  // CAM-563 — additive safety net alongside `resolveProvinceForSearch`
  // above: that resolver already translates a Thai model-supplied province
  // to its stored English value via `ThailandLocation` (CAM-404), which is
  // correct for every camp whose `Location.province` is itself English (all
  // 650 real camps in the dev DB today). This ALSO resolves the id-subtree
  // so a FUTURE camp whose `province` was saved in Thai (CAM-559 finding)
  // still matches — never replaces the existing resolver, only OR's an
  // additional path (BR-3: write/read both during the transition). Only
  // engaged for the single-province branch, never the region-expansion
  // array (unchanged this story — see tech.md's Seams section).
  let provinceAdminAreaIds: string[] | undefined;
  if (typeof provinceFilter === 'string' && provinceFilter) {
    try {
      provinceAdminAreaIds = await resolveProvinceAdminAreaIds(prisma, provinceFilter);
    } catch (error) {
      console.error('[CAM-563] province admin-area resolution failed (fail-open, string match still applies)', error);
    }
  }

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

  // CAM-587 — the district/sub-district resolved id-set is ANDed onto
  // `buildCampSiteWhere`'s own output (an EXTENSION, never a forked where-
  // builder — mirrors exactly how the near-path's bbox clause below is
  // appended). Only ever set when `resolveExactInsideAdminAreaIds` above
  // actually resolved a place — never when `unresolvedNamedPlace` is true
  // (that path returns zero rows directly, further down, without a query).
  if (adminAreaLocationFilter) {
    const andArray = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    andArray.push({ location: { adminAreaId: { in: adminAreaLocationFilter } } });
    where.AND = andArray;
  }

  // BR-2: hard cap, never overridden by a larger model-supplied count.
  const take = Math.min(args.limit ?? SEARCH_CAMPSITES_MAX_RESULTS, SEARCH_CAMPSITES_MAX_RESULTS);

  let cards: AiCampCard[];

  if (unresolvedNamedPlace) {
    // CAM-587 — honest empty: a named district/sub-district (or the
    // province given to scope it) that could not be resolved returns ZERO
    // rows without ever running the query — never a silent fallback to a
    // broader province/keyword search (see the branch above + story.md).
    cards = [];
  } else if (nearCentroid) {
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

  // CAM-564 — the ONE "matched tag" badge per card (see deriveMatchedTags'
  // own doc comment for why a second, small, batched query is the honest way
  // to derive it — never inferred from `args` alone).
  const matchedTagByCampId = await deriveMatchedTags(
    cards.map((c) => c.id),
    args
  );

  // CAM-709 EC-2 — `sort` only genuinely constrained the RETURNED order when
  // the plain query path actually ran it: the near-path (whether resolved or
  // unresolved-to-zero) orders by distance or returns nothing, and never
  // consults `args.sort` at all (mirrors the tool's own jsonSchema note,
  // "sort is ignored when near is set").
  const sortApplied = !unresolvedNamedPlace && !nearCentroid;
  const appliedFilters = await buildAppliedFilters(args, appliedLocationFilter, sortApplied);

  return {
    cards: cards.map((card) => ({
      ...card,
      remaining: remainingByCampId[card.id]?.remaining ?? null,
      matchedTag: matchedTagByCampId[card.id] ?? null,
    })),
    appliedFilters,
  };
}

export const searchCampsitesTool: ToolDefinition<SearchCampsitesArgs, SearchCampsitesResult> = {
  name: 'searchCampsites',
  // CAM-596 — "district, sub-district" added to this headline sentence: it
  // is the FIRST thing the model reads when deciding whether a parameter is
  // relevant at all (root-cause fix — CAM-587 added both args to the schema
  // below but never updated this sentence, so the model never considered
  // them a searchable axis in the first place).
  description:
    'Search published, active CampVibe campsites by province, region, district, sub-district, type, price range, pet-friendliness, terrain, access, activities, facilities, rentable equipment, annotated features (rules/rights like alcohol-allowed, fires-allowed, firewood, wheelchair-accessible, reservable), and camper style (host-declared vibe: chic/comfy, general, difficult, indomitable/rugged). Returns at most 10 result cards. Pass startDate+endDate together when the camper gave a stay date range to get a LIVE remaining-capacity count per card. ' +
    'Pass `equipment` when the camper needs rental gear — a beginner with no equipment of their own ("มือใหม่", "ไม่มีอุปกรณ์", "มาตัวเปล่า") or anyone asking what a camp rents out. An array means the camp must offer ALL listed items (AND, not OR like the other taxonomy filters). ' +
    'Pass `region` (not `province`) when the camper asks by ภาค — "ภาคเหนือ"/"อีสาน"/"ภาคใต้" — rather than a single province; it expands to every province in that region server-side. ' +
    'Pass `near` (not `province`) when the camper asks for camps NEAR/AROUND a province rather than strictly inside it (e.g. "ใกล้กรุงเทพ", "แถวโคราช") — results are centered on that province and sorted nearest-first, including camps inside it; capped to a realistic radius. `near` also accepts a well-known landmark/area name that spans multiple provinces (e.g. "เขาใหญ่", "ปาย") — no proximity word needed for those, and never set `province` for one. ' +
    'Pass `district` (and `subDistrict` when the camper is that specific) when the camper names an อำเภอ/district or a well-known town/zone (e.g. "หัวหิน", "ปากช่อง", "หาดใหญ่") — these resolve exactly against real administrative-area data, including common Thai colloquial/abbreviation forms for provinces, regions, and districts (e.g. "กทม"→Bangkok, "โคราช"→Nakhon Ratchasima, "หัวหิน" resolves as a district). `district`/`subDistrict` win over a bare `province`/`region` when set; never guess one — an unresolved district/sub-district name returns zero results rather than a wrong-looking match. ' +
    'Pass `sort` when the camper asks for an order (cheapest/most-expensive/best-rated first) — `sort` is ignored when `near` is set, since a proximity search is always ordered by distance. ' +
    'When the camper asks for MORE, OTHER, or DIFFERENT camps than what was already shown this conversation (e.g. "ขออีก", "ไม่เอาที่แสดงไปแล้ว", "มีที่อื่นอีกไหม") — re-call this tool with the SAME filters plus `excludeIds` set to the campSiteIds listed in <shown_results>, so the search returns camps not already shown.',
  // CAM-417 (ADR-013 D5) — offered to every caller, session or not.
  tier: 'guest',
  parameters: searchCampsitesArgsSchema,
  jsonSchema,
  // CAM-417 — this tool needs no caller identity; `_ctx` is server-bound and unused here.
  execute: (args, _ctx) => executeSearchCampsites(args),
};
