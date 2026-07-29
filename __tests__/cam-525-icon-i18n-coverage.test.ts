/**
 * cam-525-icon-i18n-coverage.test.ts — CAM-525 (S9, icon + i18n unification)
 *
 * Makes `lib/facility-icon-map.ts` the SINGLE source of truth for
 * code -> icon (the camp detail page + the host form both consume it now,
 * no more per-component copies) and closes the real i18n gaps that made
 * seeded codes render raw on the live detail page: the locale carried the
 * phantom key `MOUN` (masking the real seeded code `MTNS`) and `HIKG`
 * (masking `HIKI`), so those two codes fell through to an unlocalized raw
 * string. `WILD`/`HORS` had no locale key at all.
 *
 * Layer: unit (fs.readFileSync source-parse — no DOM renderer, same
 * precedent as __tests__/cam-521-metadata-groups.test.ts /
 * __tests__/ds5-icon-lucide.test.ts). prisma/seed.ts is READ AS TEXT, never
 * imported — importing it would execute `main()` (a real Prisma seed run).
 *
 * Coverage:
 *   (a) every seeded MasterData code has an entry in FACILITY_ICON_MAP
 *   (b) every seeded MasterData code has `filter.<CODE>` in BOTH en and th
 *   (c) `MOUN`/`HIKG` are gone from both locales; `MTNS`/`HIKI` are present
 *   (d) source-inspection: CampgroundForm.tsx has no wildcard lucide import;
 *       CampgroundDetailClient.tsx delegates to the shared getFacilityIcon
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { FACILITY_ICON_MAP, getFacilityIcon, ICON_BY_NAME, getIconByName } from '@/lib/facility-icon-map';
import translations from '@/locales/translations.json';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

// ===========================================================================
// Ground truth — every seeded MasterData code, read from prisma/seed.ts
// (regex requires a `group:` sibling so the Country `code: 'TH'` upsert and
// AdminArea/ThailandLocation dynamic `.code` usages are never matched).
// ===========================================================================
const seedSrc = src('prisma/seed.ts');
const seedStart = seedSrc.indexOf('const masterData = [');
const seedEnd = seedSrc.indexOf('\n]', seedStart);
const masterDataBlock = seedSrc.slice(seedStart, seedEnd);

function extractSeededCodes(block: string): string[] {
  const re = /\{\s*code:\s*'([A-Z0-9]+)',\s*group:\s*'[^']+'/g;
  const codes: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) codes.push(m[1]);
  return codes;
}

const SEEDED_CODES = extractSeededCodes(masterDataBlock);

describe('CAM-525 setup — the seed parse actually reads real codes', () => {
  it('[normal] extracts a non-trivial, deduplicated code list from prisma/seed.ts', () => {
    expect(SEEDED_CODES.length).toBeGreaterThan(50);
    expect(new Set(SEEDED_CODES).size).toBe(SEEDED_CODES.length);
  });

  it('[teeth] the extractor actually reads the real file (a code absent from the block is absent from the result)', () => {
    const withoutMtns = masterDataBlock.replace(/\{\s*code:\s*'MTNS',\s*group:\s*'Terrain'[^}]*\},?/, '');
    expect(extractSeededCodes(withoutMtns)).not.toContain('MTNS');
    expect(SEEDED_CODES).toContain('MTNS'); // present in the real file
  });
});

// ===========================================================================
// (a) Every seeded code has an icon in the unified FACILITY_ICON_MAP
// ===========================================================================
describe('CAM-525 (a) — every seeded MasterData code has a real icon in FACILITY_ICON_MAP', () => {
  it.each(SEEDED_CODES)('[normal] %s resolves to a lucide icon component (not the ShieldCheck fallback)', (code) => {
    expect(FACILITY_ICON_MAP[code], `no FACILITY_ICON_MAP entry for seeded code "${code}"`).toBeDefined();
    expect(getFacilityIcon(code)).toBe(FACILITY_ICON_MAP[code]);
  });

  it('[normal] the previously-missing codes (CAGD/CACP/GLAMP/VIEW/POTA/MTNS + 5 Activity codes) are all present', () => {
    for (const code of ['CAGD', 'CACP', 'GLAMP', 'VIEW', 'POTA', 'MTNS', 'HIKI', 'SURF', 'WILD', 'HORS', 'CLIM']) {
      expect(FACILITY_ICON_MAP[code], `${code} still missing from FACILITY_ICON_MAP`).toBeDefined();
    }
  });

  it('[null/empty] an unknown code falls back to ShieldCheck (never throws)', () => {
    expect(() => getFacilityIcon('NOT_A_REAL_CODE')).not.toThrow();
    expect(getFacilityIcon('NOT_A_REAL_CODE')).toBeDefined();
  });
});

// ===========================================================================
// (b) Every seeded code has filter.<CODE> in BOTH en and th
// ===========================================================================
describe('CAM-525 (b) — every seeded MasterData code has an en + th filter.<CODE> locale key', () => {
  const enFilter = (translations as Record<string, Record<string, unknown>>).en.filter as Record<string, string>;
  const thFilter = (translations as Record<string, Record<string, unknown>>).th.filter as Record<string, string>;

  it.each(SEEDED_CODES)('[normal] %s has an EN filter key', (code) => {
    expect(enFilter[code], `locales/translations.json en.filter is missing key "${code}"`).toBeDefined();
  });

  it.each(SEEDED_CODES)('[normal] %s has a TH filter key', (code) => {
    expect(thFilter[code], `locales/translations.json th.filter is missing key "${code}"`).toBeDefined();
  });

  it('[normal] SVEL (the real 7-Eleven code) has a key in both languages', () => {
    expect(enFilter.SVEL).toBeDefined();
    expect(thFilter.SVEL).toBeDefined();
  });
});

// ===========================================================================
// (c) The phantom keys are gone; the real codes replace them
// ===========================================================================
describe('CAM-525 (c) — phantom i18n keys removed, real codes present', () => {
  const enFilter = (translations as Record<string, Record<string, unknown>>).en.filter as Record<string, unknown>;
  const thFilter = (translations as Record<string, Record<string, unknown>>).th.filter as Record<string, unknown>;

  it('[normal] MOUN is gone from en and th (was masking the real seeded code MTNS)', () => {
    expect(enFilter.MOUN).toBeUndefined();
    expect(thFilter.MOUN).toBeUndefined();
  });

  it('[normal] HIKG is gone from en and th (was masking the real seeded code HIKI)', () => {
    expect(enFilter.HIKG).toBeUndefined();
    expect(thFilter.HIKG).toBeUndefined();
  });

  it('[normal] MTNS is present in en and th', () => {
    expect(enFilter.MTNS).toBeDefined();
    expect(thFilter.MTNS).toBeDefined();
  });

  it('[normal] HIKI is present in en and th', () => {
    expect(enFilter.HIKI).toBeDefined();
    expect(thFilter.HIKI).toBeDefined();
  });

  it('[normal] the dead keys RV/MATT/STOV/711 are pruned (no seeded code uses them)', () => {
    for (const deadKey of ['RV', 'MATT', 'STOV', '711']) {
      expect(SEEDED_CODES, `${deadKey} should not be a seeded code`).not.toContain(deadKey);
      expect(enFilter[deadKey], `en.filter.${deadKey} should be pruned`).toBeUndefined();
      expect(thFilter[deadKey], `th.filter.${deadKey} should be pruned`).toBeUndefined();
    }
  });

  it('[boundary] WILD and HORS (previously missing entirely) now have keys in both languages', () => {
    expect(enFilter.WILD).toBeDefined();
    expect(thFilter.WILD).toBeDefined();
    expect(enFilter.HORS).toBeDefined();
    expect(thFilter.HORS).toBeDefined();
  });
});

// ===========================================================================
// (d) Source-inspection — the form's wildcard import is gone; the detail
// page delegates to the shared map (no re-implemented inline copy)
// ===========================================================================
describe('CAM-525 (d) — CampgroundForm.tsx: no wildcard lucide import, uses the shared name-keyed map', () => {
  const formSrc = src('components/CampgroundForm.tsx');

  it('[normal] no wildcard "import * as LucideIcons" remains', () => {
    expect(formSrc).not.toMatch(/import \* as LucideIcons from ["']lucide-react["']/);
  });

  it('[normal] imports getIconByName from the shared lib map', () => {
    expect(formSrc).toMatch(/import\s*\{\s*getIconByName\s*\}\s*from\s*["']@\/lib\/facility-icon-map["']/);
  });

  it('[normal] renders option icons via getIconByName(opt.icon)', () => {
    expect(formSrc).toContain('getIconByName(opt.icon)');
  });

  it('[normal] the dead getIcon(iconName) helper is removed', () => {
    expect(formSrc).not.toMatch(/const getIcon = \(iconName/);
  });

  it('[normal] the unused DollarSign/Clock/Search lucide imports are removed', () => {
    for (const deadImport of ['DollarSign', 'Clock', 'Search']) {
      expect(formSrc, `${deadImport} should no longer be imported`).not.toMatch(new RegExp(`\\b${deadImport}\\b`));
    }
  });
});

describe('CAM-525 (d) — CampgroundDetailClient.tsx: delegates to the shared FACILITY_ICON_MAP', () => {
  const detailSrc = src('components/CampgroundDetailClient.tsx');

  it('[normal] imports getFacilityIcon from the shared lib map', () => {
    expect(detailSrc).toMatch(/import\s*\{\s*getFacilityIcon\s*\}\s*from\s*["']@\/lib\/facility-icon-map["']/);
  });

  it('[normal] no inline facilityIconMap object literal remains', () => {
    expect(detailSrc).not.toMatch(/const facilityIconMap: Record<string, any> = \{/);
  });

  it('[normal] getIcon delegates to getFacilityIcon(code)', () => {
    expect(detailSrc).toMatch(/const getIcon = \(code: string\) => \{[\s\S]{0,120}getFacilityIcon\(code\)/);
  });
});

// ===========================================================================
// ICON_BY_NAME sanity (the form path, keyed by icon NAME not CODE)
// ===========================================================================
describe('CAM-525 — ICON_BY_NAME (name-keyed, for MasterData.icon) resolves every seeded icon name', () => {
  function extractIconNames(block: string): string[] {
    const re = /icon:\s*'([^']+)'/g;
    const names: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(block))) names.push(m[1]);
    return [...new Set(names)];
  }
  const seededIconNames = extractIconNames(masterDataBlock);

  it('[normal] extracted at least as many icon names as there are seeded codes minus overlaps', () => {
    expect(seededIconNames.length).toBeGreaterThan(20);
  });

  it.each(seededIconNames)('[normal] icon name "%s" resolves via getIconByName (not the HelpCircle fallback)', (name) => {
    expect(ICON_BY_NAME[name], `no ICON_BY_NAME entry for seeded icon name "${name}"`).toBeDefined();
    expect(getIconByName(name)).toBe(ICON_BY_NAME[name]);
  });

  it('[null/empty] a missing/undefined icon name falls back to HelpCircle (never throws)', () => {
    expect(() => getIconByName(undefined)).not.toThrow();
    expect(() => getIconByName('NotARealIconName')).not.toThrow();
  });
});

// ===========================================================================
// CAM-664 (S2) — Spot.viewType, a real Prisma ENUM (not a MasterData row, so
// it never rode through SEEDED_CODES/masterDataBlock above). Read the enum's
// own members straight from the schema (same "read as text" discipline this
// file already applies to prisma/seed.ts) so a future added view type is
// caught here structurally, not just by memory.
// ===========================================================================
describe('CAM-664 — Spot.viewType enum: every member has a real icon in FACILITY_ICON_MAP', () => {
  const schemaSrc = src('prisma/schema.prisma');
  const enumStart = schemaSrc.indexOf('enum ViewType {');
  const enumEnd = schemaSrc.indexOf('}', enumStart);
  const viewTypeBlock = schemaSrc.slice(enumStart, enumEnd);
  const VIEW_TYPES = viewTypeBlock
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[A-Z]+$/.test(line));

  it('[setup] reads the real 6 members straight from prisma/schema.prisma', () => {
    expect(VIEW_TYPES.sort()).toEqual(
      ['GENERAL', 'RIVER', 'MOUNTAIN', 'LAKE', 'FOREST', 'BEACH'].sort()
    );
  });

  it.each(VIEW_TYPES)('[normal] ViewType.%s resolves to a lucide icon (not the ShieldCheck fallback)', (viewType) => {
    expect(FACILITY_ICON_MAP[viewType], `no FACILITY_ICON_MAP entry for ViewType "${viewType}"`).toBeDefined();
    expect(getFacilityIcon(viewType)).toBe(FACILITY_ICON_MAP[viewType]);
  });

  it('[regression] ViewType.LAKE reuses the pre-existing Terrain "LAKE" entry (same key, no duplicate added)', () => {
    // The 4-letter Terrain MasterData code IS the full word "LAKE" — the one
    // deliberate overlap between the two key spaces (facility-icon-map.ts).
    expect(FACILITY_ICON_MAP.LAKE).toBeDefined();
  });

  it('[null/empty] a spot with no viewType (null) falls back to the same icon as the literal "GENERAL" member', () => {
    expect(getFacilityIcon('GENERAL')).toBe(FACILITY_ICON_MAP.GENERAL);
    // The host form's own NO_VIEW_TYPE sentinel writes null for "no particular
    // view" — the same case as the enum's own GENERAL member (spot-form-dialog.tsx).
    expect(getFacilityIcon('GENERAL')).not.toBe(getFacilityIcon('NOT_A_REAL_VIEW_TYPE'));
  });
});
