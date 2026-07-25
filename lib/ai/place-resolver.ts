/**
 * CAM-501 (P1 Place Resolver) BR-1 — a deterministic, pure pre-pass that
 * parses an explicit Thai/English PROVINCE name or a Thai REGION (ภาค) out
 * of free-form camper text, so the model is never left to guess/infer/drop
 * a place the camper actually named (root-cause fix for the CAM-500 P0
 * over-correction: "แคมป์ริมน้ำเชียงใหม่" made the model drop
 * province=เชียงใหม่ entirely and answer with RIVE camps from anywhere in
 * the country while falsely claiming they were "ในเชียงใหม่").
 *
 * Reuses the SAME 77-province gazetteer `resolveProvinceForSearch`
 * (lib/ai/tools/search-campsites.ts) and `resolveRegionForSearch`
 * (lib/thai-regions.ts) already resolve against — no new province list is
 * hand-written here (BR-1). Unlike `resolveProvinceForSearch`, this is a
 * PURE, synchronous function: no DB round-trip, no `async` — it only needs
 * to decide WHETHER the camper named a place at all, not resolve a
 * DB-backed alias; the tool call itself still runs the real DB-backed
 * resolution once the model (now hinted, BR-2) sets the argument.
 *
 * province wins over region when both are present (mirrors the tool's own
 * "province wins" rule, `executeSearchCampsites` — CAM-463 Decision 2/BR-3).
 * A terrain/facility word (ริมน้ำ/ริมทะเล/ภูเขา/ป่า) is never treated as a
 * place (AC-4) — it simply never appears in either candidate list below.
 */
import thailandLocations from '@/prisma/data/thailand-locations.json';

export interface ResolvedPlace {
  /** DB-canonical English province name (`Location.province` / `ThailandLocation.provinceNameEn`), e.g. "Chiang Mai". */
  province?: string;
  /**
   * Canonical Thai region phrase, e.g. "ภาคเหนือ" — always one of the exact
   * keys `resolveRegionForSearch`'s alias table (`lib/thai-regions.ts`)
   * recognizes, so the tool always expands it (never falls through to the
   * raw-passthrough / zero-rows path).
   */
  region?: string;
}

interface ProvinceEntry {
  nameTh: string;
  nameEn: string;
}

const PROVINCES: readonly ProvinceEntry[] = (thailandLocations as ReadonlyArray<{ nameTh: string; nameEn: string }>).map(
  (p) => ({ nameTh: p.nameTh, nameEn: p.nameEn })
);

/**
 * Thai names, longest-first (defensive — `__tests__/cam-458-thailand-locations-data.test.ts`
 * already proves no full `nameTh` is an ambiguous substring of another real
 * province's `nameTh`, so any order is actually safe for THAT collision;
 * longest-first is kept anyway as the same defensive idiom the region list
 * below needs for real, and it costs nothing).
 */
const PROVINCES_BY_TH_LENGTH_DESC = [...PROVINCES].sort((a, b) => b.nameTh.length - a.nameTh.length);
const PROVINCES_BY_EN_LENGTH_DESC = [...PROVINCES].sort((a, b) => b.nameEn.length - a.nameEn.length);

/** Escapes a string for safe interpolation into a `RegExp` source. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * EC-4 (MVP-accepted): Thai has no built-in word-boundary marker, so a
 * province's Thai name is matched as a plain substring — the SAME tolerance
 * `resolveProvinceForSearch`'s own DB `contains` lookup already has in
 * production; a minor over-match (a camp NAME that happens to contain a
 * province's Thai name) is accepted per story EC-4, not solved here.
 *
 * English names get an explicit `\b...\b` word-boundary check instead
 * (English text IS space-delimited, so this is free precision this file
 * doesn't have to give up) — guards common short names like "Tak" or "Nan"
 * from firing inside an unrelated English word (e.g. "attack").
 */
function detectProvince(text: string): string | undefined {
  for (const p of PROVINCES_BY_TH_LENGTH_DESC) {
    if (p.nameTh.length > 0 && text.includes(p.nameTh)) return p.nameEn;
  }

  const lower = text.toLowerCase();
  for (const p of PROVINCES_BY_EN_LENGTH_DESC) {
    if (p.nameEn.length === 0) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(p.nameEn.toLowerCase())}\\b`);
    if (pattern.test(lower)) return p.nameEn;
  }

  return undefined;
}

type ThaiRegionName = 'NORTH' | 'NORTHEAST' | 'CENTRAL' | 'EAST' | 'WEST' | 'SOUTH';

interface RegionAlias {
  alias: string;
  /**
   * The exact canonical phrase to hand back — deliberately one of
   * `lib/thai-regions.ts`'s own `REGION_ALIASES` keys (verified by this
   * file's own drift-guard test calling the real `resolveRegionForSearch`
   * against every canonical value), so the resulting hint always resolves.
   */
  canonical: string;
  region: ThaiRegionName;
}

/**
 * BR-1/EC-2 — mirrors (does not import; `lib/thai-regions.ts`'s
 * `REGION_ALIASES` is a private, EXACT-match-only lookup meant for an
 * already-isolated word, not a free-text scanner) the alias set
 * `lib/thai-regions.ts` recognizes. Kept intentionally small and 1:1 with
 * that table; `__tests__/cam-501-place-resolver.test.ts` asserts every
 * `canonical` value here round-trips through the real
 * `resolveRegionForSearch` so the two can never silently drift apart.
 */
const REGION_ALIASES: readonly RegionAlias[] = [
  { alias: 'ภาคตะวันออกเฉียงเหนือ', canonical: 'ภาคตะวันออกเฉียงเหนือ', region: 'NORTHEAST' },
  { alias: 'ตะวันออกเฉียงเหนือ', canonical: 'ภาคตะวันออกเฉียงเหนือ', region: 'NORTHEAST' },
  { alias: 'ภาคอีสาน', canonical: 'ภาคอีสาน', region: 'NORTHEAST' },
  { alias: 'อีสาน', canonical: 'ภาคอีสาน', region: 'NORTHEAST' },
  { alias: 'ภาคเหนือ', canonical: 'ภาคเหนือ', region: 'NORTH' },
  { alias: 'ทางเหนือ', canonical: 'ภาคเหนือ', region: 'NORTH' },
  { alias: 'เหนือ', canonical: 'ภาคเหนือ', region: 'NORTH' },
  { alias: 'ภาคกลาง', canonical: 'ภาคกลาง', region: 'CENTRAL' },
  { alias: 'กลาง', canonical: 'ภาคกลาง', region: 'CENTRAL' },
  { alias: 'ภาคตะวันออก', canonical: 'ภาคตะวันออก', region: 'EAST' },
  { alias: 'ตะวันออก', canonical: 'ภาคตะวันออก', region: 'EAST' },
  { alias: 'ภาคตะวันตก', canonical: 'ภาคตะวันตก', region: 'WEST' },
  { alias: 'ตะวันตก', canonical: 'ภาคตะวันตก', region: 'WEST' },
  { alias: 'ปักษ์ใต้', canonical: 'ภาคใต้', region: 'SOUTH' },
  { alias: 'ภาคใต้', canonical: 'ภาคใต้', region: 'SOUTH' },
  { alias: 'ใต้', canonical: 'ภาคใต้', region: 'SOUTH' },
];

/**
 * EC-2 — sorted longest-alias-first so, e.g., "ตะวันออกเฉียงเหนือ" (18
 * chars) is always checked BEFORE the shorter "เหนือ" (5 chars) it
 * textually contains: exactly the collision `lib/thai-regions.ts:55`'s
 * comment names ("เหนือ"/"ตะวันออก" are substrings of
 * "ตะวันออกเฉียงเหนือ"). Without this ordering a naive first-match scan
 * would mis-resolve a Northeast mention as North (or East).
 */
const REGION_ALIASES_BY_LENGTH_DESC = [...REGION_ALIASES].sort((a, b) => b.alias.length - a.alias.length);

function detectRegion(text: string): string | undefined {
  for (const entry of REGION_ALIASES_BY_LENGTH_DESC) {
    if (text.includes(entry.alias)) return entry.canonical;
  }
  return undefined;
}

/**
 * BR-1 — the resolver itself. Province wins when both a province and a
 * region are found in the same text (EC-3); neither is set when neither is
 * found (AC-4 — a bare terrain/facility word resolves to `{}`).
 */
export function resolvePlace(text: string): ResolvedPlace {
  if (!text) return {};

  const province = detectProvince(text);
  if (province) return { province };

  const region = detectRegion(text);
  if (region) return { region };

  return {};
}
