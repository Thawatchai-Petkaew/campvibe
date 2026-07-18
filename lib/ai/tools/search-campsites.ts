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
import { campCardSelect, type CampCardPayload } from '@/lib/read-models/camp-card';
import type { ToolDefinition } from '@/lib/ai/tool-registry';

/** BR-2 — the tool NEVER returns more than this many cards, regardless of any model-requested count. */
export const SEARCH_CAMPSITES_MAX_RESULTS = 10;

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

export const searchCampsitesArgsSchema = z.object({
  province: z.string().trim().min(1).max(100).optional(),
  type: z.string().trim().min(1).max(20).optional(),
  /** A specific campsite NAME for an exact-phrase text match — NOT for a general characteristic (see jsonSchema description). */
  keyword: z.string().trim().min(1).max(100).optional(),
  priceMin: z.number().nonnegative().optional(),
  priceMax: z.number().nonnegative().optional(),
  petFriendly: z.boolean().optional(),
  /** CAM-408 BR-3 — an unrecognized code fails zod validation before this ever reaches Prisma (dispatchTool → invalid_args, no query runs). */
  terrain: z.enum(TERRAIN_CODES).optional(),
  access: z.enum(ACCESS_CODES).optional(),
  activities: z.enum(ACTIVITY_CODES).optional(),
  facilities: z.enum(FACILITY_CODES).optional(),
  /** Model-requested result count — clamped to SEARCH_CAMPSITES_MAX_RESULTS, never honored above it (BR-2). */
  limit: z.number().int().positive().optional(),
});

export type SearchCampsitesArgs = z.infer<typeof searchCampsitesArgsSchema>;

export interface SearchCampsitesResult {
  /** Never null — a zero-match search returns [] so the caller can render an empty state (AC-8). */
  cards: CampCardPayload[];
}

/** CAM-404 — a province arg containing any Thai character triggers the ThailandLocation resolve below. */
const THAI_CHAR_PATTERN = /[ก-๙]/;

/**
 * CAM-404 — `Location.province` is stored in English (e.g. "Chiang Mai"), but
 * the model frequently emits the Thai province name it was given by the user
 * (e.g. "เชียงใหม่"). `buildCampSiteWhere` does an exact match on `province`,
 * so an un-resolved Thai value matches zero rows forever even when camps
 * exist. Resolve via `ThailandLocation` (provinceName ↔ provinceNameEn);
 * English input is returned unchanged (no DB round-trip). Coverage is
 * partial (~12 provinces seeded) — an unmapped Thai province, or any lookup
 * error, falls back to the raw value unchanged (never throws), matching the
 * search's prior behavior for those cases.
 */
async function resolveProvinceForSearch(province: string): Promise<string> {
  if (!THAI_CHAR_PATTERN.test(province)) return province;

  try {
    const match = await prisma.thailandLocation.findFirst({
      where: { provinceName: { contains: province } },
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
        'Province name in English, e.g. "Chiang Mai". Thai province names (e.g. เชียงใหม่) are also accepted and resolved to the stored English value server-side.',
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
    terrain: {
      type: 'string',
      enum: TERRAIN_CODES,
      description:
        'Terrain the campsite is set in — pick ONE that best matches the camper\'s description: RIVE = แม่น้ำ ลำธาร คลองเล็ก (river/stream/creek, e.g. "ติดน้ำ"/"ริมน้ำ"), BEAC = ชายหาด (beach/sea), MTNS = ภูเขา (mountain/surrounded by mountains, e.g. "วิวภูเขา"), FORE = ป่า (forest).',
    },
    access: {
      type: 'string',
      enum: ACCESS_CODES,
      description:
        'How campers reach the site — pick ONE: DRIV = ขับรถ (drive up), WALK = เดิน (walk in), HIKE = ไต่เขา (hike in), BAOT = เรือ (boat access only).',
    },
    activities: {
      type: 'string',
      enum: ACTIVITY_CODES,
      description:
        'A specific on-site activity the camper asked for — pick ONE: SWIM ว่ายน้ำ, HIKI เดินเล่น, SURF เล่นเซิร์ฟ, FISH ตกปลา, WILD ส่องสัตว์ป่า, BOAT พายเรือ, HORS ขี่ม้า, OFFR ออฟโรด, LIVE ดนตรีสด, CLIM ปีนเขา.',
    },
    facilities: {
      type: 'string',
      enum: FACILITY_CODES,
      description:
        'A specific facility the camper asked for — pick ONE: SHOW ห้องอาบน้ำ, TOIL ห้องน้ำ, PICN โต๊ะปิคนิค, WIFI ไวไฟ, TRAS ถังขยะ, SANI จุดทิ้งสิ่งปฏิกูล, POTA ก๊อกน้ำ, ELEC จุดจ่ายไฟฟ้า, WATE จุดจ่ายน้ำ, SINK อ่างล้างจาน, CART รถเข็น, MIMT ร้านขายของชำ, GRIL หมูกระทะ, CAFE คาเฟ่, REST ร้านอาหาร, FEIC น้ำแข็งฟรี, FEDW น้ำดื่มฟรี.',
    },
    limit: { type: 'number', description: `Max results to return (capped at ${SEARCH_CAMPSITES_MAX_RESULTS})` },
  },
  additionalProperties: false,
} as const;

export async function executeSearchCampsites(args: SearchCampsitesArgs): Promise<SearchCampsitesResult> {
  const province = args.province !== undefined ? await resolveProvinceForSearch(args.province) : undefined;

  const where = buildCampSiteWhere({
    province,
    type: args.type,
    keyword: args.keyword,
    min: args.priceMin !== undefined ? String(args.priceMin) : undefined,
    max: args.priceMax !== undefined ? String(args.priceMax) : undefined,
    petFriendly: args.petFriendly,
    terrain: args.terrain,
    access: args.access,
    activities: args.activities,
    facilities: args.facilities,
  });

  // BR-2: hard cap, never overridden by a larger model-supplied count.
  const take = Math.min(args.limit ?? SEARCH_CAMPSITES_MAX_RESULTS, SEARCH_CAMPSITES_MAX_RESULTS);

  const cards = await prisma.campSite.findMany({
    where,
    select: campCardSelect,
    take,
  });

  return { cards };
}

export const searchCampsitesTool: ToolDefinition<SearchCampsitesArgs, SearchCampsitesResult> = {
  name: 'searchCampsites',
  description:
    'Search published, active CampVibe campsites by province, type, price range, pet-friendliness, terrain, access, activities, and facilities. Returns at most 10 result cards.',
  // CAM-417 (ADR-013 D5) — offered to every caller, session or not.
  tier: 'guest',
  parameters: searchCampsitesArgsSchema,
  jsonSchema,
  // CAM-417 — this tool needs no caller identity; `_ctx` is server-bound and unused here.
  execute: (args, _ctx) => executeSearchCampsites(args),
};
