/**
 * CAM-463 Decision 1/3, BR-1/BR-2/BR-4 — lib/thai-regions.ts: the derived
 * 6-region rollup + alias resolver.
 *
 * Coverage matrix:
 *   - normal: every one of the 6 regions resolves to its exact province list
 *   - normal: every BR-2 alias resolves to its canonical region's set
 *   - null/empty: an unrecognized word (typo, province name, nonsense)
 *     returns the RAW value unchanged — never throws (BR-4/AC-6/EC-6)
 *   - boundary: partition completeness — the flattened 6-region map equals
 *     the exact `provinceNameEn` set in prisma/data/thailand-locations.json
 *     (77, no dup, none missing) so the map can never silently drift
 *   - concurrent/ordering: exact-key collision guard — a substring like
 *     "เหนือ"/"ตะวันออก" that appears INSIDE "ตะวันออกเฉียงเหนือ" must not
 *     collide (exact-key match, not `contains`)
 */
import { describe, it, expect } from 'vitest';
import thailandLocations from '@/prisma/data/thailand-locations.json';
import { REGION_TO_PROVINCES, resolveRegionForSearch, type ThaiRegion } from '@/lib/thai-regions';

interface ProvinceEntry {
  code: string;
  nameTh: string;
  nameEn: string;
}
const ALL_PROVINCES = thailandLocations as ProvinceEntry[];

describe('REGION_TO_PROVINCES — partition completeness (CAM-463 Decision 1 confirmation)', () => {
  it('[unit][boundary] the 6-region map is an exact partition of the 77 seeded provinceNameEn values (no dup, none missing)', () => {
    const flattened = Object.values(REGION_TO_PROVINCES).flat();
    expect(flattened.length).toBe(77);

    const uniqueSet = new Set(flattened);
    expect(uniqueSet.size).toBe(77); // no province in two regions

    const seedNames = new Set(ALL_PROVINCES.map((p) => p.nameEn));
    expect(seedNames.size).toBe(77);

    // every mapped name exists in the seed
    for (const name of flattened) {
      expect(seedNames.has(name)).toBe(true);
    }
    // every seeded province is covered by the map
    for (const name of seedNames) {
      expect(uniqueSet.has(name)).toBe(true);
    }
  });

  it('[unit] region sizes match BR-1 exactly: NORTH 9 / NORTHEAST 20 / CENTRAL 22 / EAST 7 / WEST 5 / SOUTH 14', () => {
    expect(REGION_TO_PROVINCES.NORTH.length).toBe(9);
    expect(REGION_TO_PROVINCES.NORTHEAST.length).toBe(20);
    expect(REGION_TO_PROVINCES.CENTRAL.length).toBe(22);
    expect(REGION_TO_PROVINCES.EAST.length).toBe(7);
    expect(REGION_TO_PROVINCES.WEST.length).toBe(5);
    expect(REGION_TO_PROVINCES.SOUTH.length).toBe(14);
  });

  it('[unit] the lower-north provinces fall under CENTRAL and Tak falls under WEST (6-region ≠ tourism/4-region)', () => {
    const central = REGION_TO_PROVINCES.CENTRAL;
    for (const p of ['Nakhon Sawan', 'Sukhothai', 'Phitsanulok', 'Phichit', 'Phetchabun', 'Kamphaeng Phet', 'Uthai Thani']) {
      expect(central).toContain(p);
    }
    expect(REGION_TO_PROVINCES.WEST).toContain('Tak');
    expect(REGION_TO_PROVINCES.NORTH).not.toContain('Tak');
  });
});

describe('resolveRegionForSearch — formal region names (CAM-463 AC-1)', () => {
  const formalNames: Array<[string, ThaiRegion]> = [
    ['ภาคเหนือ', 'NORTH'],
    ['ภาคตะวันออกเฉียงเหนือ', 'NORTHEAST'],
    ['ภาคกลาง', 'CENTRAL'],
    ['ภาคตะวันออก', 'EAST'],
    ['ภาคตะวันตก', 'WEST'],
    ['ภาคใต้', 'SOUTH'],
  ];

  it.each(formalNames)('[unit] "%s" resolves to the exact %s province set', (word, region) => {
    const result = resolveRegionForSearch(word);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([...REGION_TO_PROVINCES[region]]);
  });
});

describe('resolveRegionForSearch — BR-2 alias normalization (CAM-463 AC-2)', () => {
  const aliases: Array<[string, ThaiRegion]> = [
    ['เหนือ', 'NORTH'],
    ['ทางเหนือ', 'NORTH'],
    ['ภาคอีสาน', 'NORTHEAST'],
    ['อีสาน', 'NORTHEAST'],
    ['กลาง', 'CENTRAL'],
    ['ตะวันออก', 'EAST'],
    ['ตะวันตก', 'WEST'],
    ['ใต้', 'SOUTH'],
    ['ปักษ์ใต้', 'SOUTH'],
  ];

  it.each(aliases)('[unit] alias "%s" normalizes to the same canonical %s province set as the formal name', (alias, region) => {
    const result = resolveRegionForSearch(alias);
    expect(result).toEqual([...REGION_TO_PROVINCES[region]]);
  });

  it('[unit] "อีสาน" and "ภาคตะวันออกเฉียงเหนือ" resolve to an IDENTICAL province set (AC-2)', () => {
    expect(resolveRegionForSearch('อีสาน')).toEqual(resolveRegionForSearch('ภาคตะวันออกเฉียงเหนือ'));
  });
});

describe('resolveRegionForSearch — exact-key match, no substring collision (CAM-463 Decision 3)', () => {
  it('[unit][concurrent] "ภาคตะวันออกเฉียงเหนือ" resolves to NORTHEAST, not falsely matching the "เหนือ"/"ตะวันออก" substrings inside it', () => {
    const result = resolveRegionForSearch('ภาคตะวันออกเฉียงเหนือ');
    expect(result).toEqual([...REGION_TO_PROVINCES.NORTHEAST]);
    expect(result).not.toEqual([...REGION_TO_PROVINCES.NORTH]);
    expect(result).not.toEqual([...REGION_TO_PROVINCES.EAST]);
  });

  it('[unit] surrounding whitespace is trimmed before the exact-key match', () => {
    const result = resolveRegionForSearch('  อีสาน  ');
    expect(result).toEqual([...REGION_TO_PROVINCES.NORTHEAST]);
  });
});

describe('resolveRegionForSearch — unrecognized word, raw passthrough (CAM-463 BR-4/AC-6/EC-6)', () => {
  it('[unit][null/empty] an unrecognized region-shaped word ("ภาคสวรรค์") returns the RAW value unchanged, never throws', () => {
    expect(() => resolveRegionForSearch('ภาคสวรรค์')).not.toThrow();
    expect(resolveRegionForSearch('ภาคสวรรค์')).toBe('ภาคสวรรค์');
  });

  it('[unit] a sub-region word out of scope ("อีสานใต้", "ล้านนา") returns the RAW value unchanged (EC-2)', () => {
    expect(resolveRegionForSearch('อีสานใต้')).toBe('อีสานใต้');
    expect(resolveRegionForSearch('ล้านนา')).toBe('ล้านนา');
  });

  it('[unit] a plain province name (not a region) returns the RAW value unchanged — no region expansion', () => {
    expect(resolveRegionForSearch('เชียงใหม่')).toBe('เชียงใหม่');
  });

  it('[unit][error] never throws on empty string / gibberish input', () => {
    expect(() => resolveRegionForSearch('')).not.toThrow();
    expect(resolveRegionForSearch('')).toBe('');
    expect(() => resolveRegionForSearch('xyz123')).not.toThrow();
    expect(resolveRegionForSearch('xyz123')).toBe('xyz123');
  });
});
