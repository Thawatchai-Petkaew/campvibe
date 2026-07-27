/**
 * lib/ai/place-aliases.ts — CAM-587
 *
 * Consumes `prisma/data/place-aliases.json` (owner-authored, PR #673; 52
 * province aliases, 4 region-alias groups, 22 zone/district aliases) at
 * runtime — the SAME "committed JSON, no DB table" pattern
 * `landmark-gazetteer.json`/`province-centroids.json` already use in
 * `lib/ai/tools/search-campsites.ts`. Before this story NOTHING consumed the
 * file; only `scripts/validate-place-aliases.mjs` referenced it.
 *
 * Where this is applied (search-campsites.ts): a province/region/district
 * alias is consulted on an ALREADY-ISOLATED tool-argument value (the model
 * put this specific word into `province`/`near`/`district`/`subDistrict`
 * because it decided that word names a place) — never a free-text scanner
 * over a whole camper sentence. That distinction is exactly why this module
 * does NOT enforce each alias's `contextGuard` flag: `contextGuard` exists to
 * gate a free-text SCANNER (see `lib/ai/place-resolver.ts`'s
 * `CONTEXT_GUARDED_LANDMARK_NAMES_TH`, where an ordinary sentence merely
 * containing "เขาใหญ่" needs a camping-context marker to avoid a false
 * match against unrelated conversational Thai). At the isolated-tool-arg
 * layer there is no surrounding sentence to guard against — the very fact
 * the model placed this word into a place-typed argument already IS the
 * place context, the same reasoning `lib/thai-regions.ts`'s own
 * `REGION_ALIASES` table documents for its own isolated-word, no-contextGuard
 * design (see that file's docblock: "this table is safe because it is
 * EXACT-match against an already-isolated, trimmed word ... a free-text
 * SCANNER over arbitrary camper sentences is a different, riskier match
 * surface"). `matchMode` (exact | substring) IS still honored per-alias —
 * that part of the contract is about avoiding a false substring match
 * (e.g. "ปากน้ำ" must never match inside "ปากน้ำโพ"), which is just as real
 * a risk at the isolated-arg layer as at the free-text layer.
 *
 * Known, accepted collision (documented, not silently resolved): the data
 * file's own note on `เมืองเพชร` flags it as ALSO a colloquial name for
 * เพชรบูรณ์ (Phetchabun), mapped here to เพชรบุรี (Phetchaburi) — the ONE
 * value the dataset encodes (an alias text can only ever map to one
 * province, enforced by `validate-place-aliases.mjs`). This story makes that
 * choice deliberately, in writing, rather than adding a disambiguation
 * mechanism no evidence yet justifies (see story.md's precedence write-up).
 *
 * Never throws (mirrors the file's own "additive & never-throw" contract,
 * `.claude/rules/api.md` "fail-open" pattern already used throughout
 * search-campsites.ts): every export here is a pure, synchronous lookup that
 * returns `undefined` on no match — never an exception, never a guess.
 */
import placeAliasesJson from '@/prisma/data/place-aliases.json';

interface AliasEntry {
  text: string;
  matchMode: 'exact' | 'substring';
  kind: string;
  contextGuard?: boolean;
}

interface ProvinceAliasEntry {
  canonicalCode: string;
  canonicalTh: string;
  canonicalEn: string;
  aliases: AliasEntry[];
}

interface RegionAliasEntry {
  canonicalRegion: 'NORTH' | 'NORTHEAST' | 'CENTRAL' | 'EAST' | 'WEST' | 'SOUTH';
  aliases: AliasEntry[];
}

interface ZoneAliasEntry {
  id: string;
  nameTh: string;
  aliases: string[];
  provinceTh: string;
  provinceCode: string;
}

interface PlaceAliasesData {
  provinceAliases: ProvinceAliasEntry[];
  regionAliases: RegionAliasEntry[];
  zoneAliases: ZoneAliasEntry[];
}

const PLACE_ALIASES = placeAliasesJson as unknown as PlaceAliasesData;

/**
 * `matchMode` applied against a single, already-trimmed isolated arg value
 * (never a whole free-text sentence — see this file's docblock): `exact` =
 * the WHOLE trimmed value must equal the alias text; `substring` = the
 * value may contain the alias text anywhere (safe per the data file's own
 * authoring rule: substring aliases are >=4 chars and distinctive).
 */
function aliasTextMatches(value: string, alias: Pick<AliasEntry, 'text' | 'matchMode'>): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return alias.matchMode === 'exact' ? trimmed === alias.text : trimmed.includes(alias.text);
}

/**
 * CAM-587 — Bangkok's own alias entry (`canonicalCode "10"`) is deliberately
 * SKIPPED here: Bangkok is already fully handled by the pre-existing, tested
 * `BANGKOK_ALIASES` map in search-campsites.ts (CAM-458), and its own alias
 * entry's `substring`-mode aliases ("กรุงเทพ", "บางกอก") would otherwise
 * change the value fed to the DB `contains` lookup for an input the old
 * mechanism already resolves correctly (byte-identical outcome, different
 * mechanism — no functional gain) and, worse, "บางกอก" as a substring would
 * newly match "บางกอกน้อย" (a real, DIFFERENT Bangkok district name that
 * happens to start with "บางกอก") — exactly the substring-collision risk
 * this codebase has been bitten by before (DEF-1/DEF-2). The data file's own
 * note calls this entry a future "supersedes `BANGKOK_ALIASES` once wired"
 * — retiring the old map in favor of this one (with a real disambiguation
 * guard for the บางกอกน้อย case) is a deliberate follow-up, not this story
 * (see story.md Out of scope). Every OTHER province's aliases are consulted
 * normally.
 */
const SKIP_CANONICAL_CODE = '10';

/**
 * Resolves a camper-supplied province alias (colloquial/abbreviation/
 * dialect/historical, e.g. "โคราช", "กทม", "อุบล") to its canonical Thai
 * province name — the SAME `canonicalTh` value `scripts/validate-place-
 * aliases.mjs` already proves matches `prisma/data/thailand-locations.json`
 * exactly, so handing it to the existing `nameTh: { contains }` AdminArea
 * lookup in `resolveProvinceForSearch` (search-campsites.ts) always resolves
 * trivially (the normalized value literally contains itself). Returns
 * `undefined` when no alias matches (never a guess, never a throw).
 */
export function resolveProvinceAliasToCanonicalTh(value: string): string | undefined {
  for (const entry of PLACE_ALIASES.provinceAliases) {
    if (entry.canonicalCode === SKIP_CANONICAL_CODE) continue;
    for (const alias of entry.aliases) {
      if (aliasTextMatches(value, alias)) return entry.canonicalTh;
    }
  }
  return undefined;
}

/**
 * The 6 formal `ภาค`-prefixed phrases `lib/thai-regions.ts`'s own
 * `REGION_ALIASES` table recognizes as an EXACT key for each region code —
 * used only to translate a `regionAliases` entry's `canonicalRegion` code
 * (e.g. `NORTH`) into a phrase `resolveRegionForSearch` already expands,
 * never a second copy of `REGION_TO_PROVINCES`'s own province list.
 */
const REGION_CODE_TO_CANONICAL_PHRASE: Readonly<Record<RegionAliasEntry['canonicalRegion'], string>> = {
  NORTH: 'ภาคเหนือ',
  NORTHEAST: 'ภาคอีสาน',
  CENTRAL: 'ภาคกลาง',
  EAST: 'ภาคตะวันออก',
  WEST: 'ภาคตะวันตก',
  SOUTH: 'ภาคใต้',
};

/**
 * Resolves a camper-supplied region alias (e.g. "ล้านนา", "แดนอีสาน") to one
 * of the canonical Thai region phrases `resolveRegionForSearch`
 * (`lib/thai-regions.ts`) already recognizes — the caller then calls that
 * existing resolver unchanged (no duplicated province-list data here).
 * `scripts/validate-place-aliases.mjs` already guarantees these alias texts
 * never collide with an existing `lib/thai-regions.ts` `REGION_ALIASES` key
 * (additive-only). Returns `undefined` when no alias matches.
 */
export function resolveRegionAliasToCanonicalPhrase(value: string): string | undefined {
  for (const entry of PLACE_ALIASES.regionAliases) {
    for (const alias of entry.aliases) {
      if (aliasTextMatches(value, alias)) return REGION_CODE_TO_CANONICAL_PHRASE[entry.canonicalRegion];
    }
  }
  return undefined;
}

/** A zone alias resolved to the district name it names, plus the province it belongs to (both Thai, both real AdminArea-seeded names) — the caller matches these through the SAME shared `matchAdminArea` a plain-named district uses (never a parallel lookup, per story.md "one story, not two"). */
export interface ZoneAliasMatch {
  districtNameTh: string;
  provinceNameTh: string;
}

/**
 * Resolves a camper-supplied zone/town name (e.g. "หัวหิน", "อ.หัวหิน",
 * "หาดใหญ่") to the district + province it names. `zoneAliases` entries carry
 * a plain `aliases: string[]` (no `matchMode` — every entry in the dataset
 * is authored as an exact alternate name, e.g. "อ.หัวหิน"/"อำเภอหัวหิน"), so
 * matching here is EXACT only (trimmed equality against `nameTh` or any
 * listed alias) — the data file's own notes flag several short zone names
 * (e.g. "เต่า", "สมุย") as real-word/substring collision risks specifically
 * because no `matchMode` field exists to mark them safe for substring
 * matching; exact-only sidesteps that risk entirely. Returns `undefined`
 * when no zone alias matches.
 */
export function resolveZoneAliasToDistrict(value: string): ZoneAliasMatch | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  for (const zone of PLACE_ALIASES.zoneAliases) {
    if (trimmed === zone.nameTh || zone.aliases.includes(trimmed)) {
      return { districtNameTh: zone.nameTh, provinceNameTh: zone.provinceTh };
    }
  }
  return undefined;
}
