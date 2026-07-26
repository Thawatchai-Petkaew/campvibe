/**
 * cam-573-location-display.test.ts — CAM-573 AC-3/AC-4/AC-6
 *
 * Closes CAM-567: `buildLocationText` (components/CampgroundCard.tsx,
 * shared verbatim by CampgroundDetailClient.tsx) now renders district/
 * sub-district from the id-derived bilingual chain
 * (`resolveLocationDisplayNames`, `lib/read-models/camp-card.ts`) instead
 * of the raw free-text `district` column — the root cause of a Thai
 * province rendering beside an English district.
 *
 * Coverage matrix (qa.md §7):
 *   normal      — SUBDISTRICT/DISTRICT/PROVINCE depth, TH + EN, each
 *                 renders only the levels actually resolved
 *   null/empty  — no `adminArea` at all falls back to the pre-existing
 *                 raw-value/name-map behavior, never a crash
 *   boundary    — a chain with no matching AdminArea province row
 *   error/validation — n/a (pure functions, no I/O)
 *   concurrent/ordering — n/a (stateless, no shared mutable state)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdminAreaChainNode } from '../lib/read-models/camp-card';

const mockThailandLocationFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    thailandLocation: {
      findMany: (...args: unknown[]) => mockThailandLocationFindMany(...args),
    },
  },
}));

const { buildLocationText } = await import('../components/CampgroundCard');
const {
  resolveLocationDisplayNames,
  withProvinceThaiNames,
} = await import('../lib/read-models/camp-card');

beforeEach(() => {
  vi.clearAllMocks();
  mockThailandLocationFindMany.mockResolvedValue([
    { provinceNameEn: 'Chiang Mai', provinceName: 'เชียงใหม่' },
    { provinceNameEn: 'Trat', provinceName: 'ตราด' },
  ]);
});

// ---------------------------------------------------------------------------
// resolveLocationDisplayNames — the pure chain-walk
// ---------------------------------------------------------------------------
describe('resolveLocationDisplayNames — walks the AdminArea parent chain (CAM-573)', () => {
  const province: AdminAreaChainNode = { level: 'PROVINCE', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai', parent: null };
  const district: AdminAreaChainNode = {
    level: 'DISTRICT', nameTh: 'เมืองเชียงใหม่', nameEn: 'Mueang Chiang Mai',
    parent: { level: province.level, nameTh: province.nameTh, nameEn: province.nameEn, parent: null },
  };
  const subDistrict: AdminAreaChainNode = {
    level: 'SUBDISTRICT', nameTh: 'ช้างคลาน', nameEn: 'Chang Khlan',
    parent: {
      level: district.level, nameTh: district.nameTh, nameEn: district.nameEn,
      parent: { level: province.level, nameTh: province.nameTh, nameEn: province.nameEn },
    },
  };

  it('[normal] SUBDISTRICT depth resolves all 3 levels', () => {
    const result = resolveLocationDisplayNames(subDistrict);
    expect(result).toEqual({
      provinceTh: 'เชียงใหม่', provinceEn: 'Chiang Mai',
      districtTh: 'เมืองเชียงใหม่', districtEn: 'Mueang Chiang Mai',
      subDistrictTh: 'ช้างคลาน', subDistrictEn: 'Chang Khlan',
    });
  });

  it('[normal] DISTRICT depth resolves 2 levels — sub-district fields undefined', () => {
    const result = resolveLocationDisplayNames(district);
    expect(result.provinceTh).toBe('เชียงใหม่');
    expect(result.districtTh).toBe('เมืองเชียงใหม่');
    expect(result.subDistrictTh).toBeUndefined();
    expect(result.subDistrictEn).toBeUndefined();
  });

  it('[normal] PROVINCE depth resolves 1 level — district/sub-district fields undefined', () => {
    const result = resolveLocationDisplayNames(province);
    expect(result.provinceTh).toBe('เชียงใหม่');
    expect(result.districtTh).toBeUndefined();
    expect(result.subDistrictTh).toBeUndefined();
  });

  it('[null/empty] null/undefined adminArea returns every field undefined (the 2 orphan Location rows)', () => {
    expect(resolveLocationDisplayNames(null)).toEqual({});
    expect(resolveLocationDisplayNames(undefined)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// withProvinceThaiNames — prefers the id-derived chain, falls back to the
// name-based map only when `adminArea` is absent (byte-compatible with every
// pre-existing caller/test, see tech.md).
// ---------------------------------------------------------------------------
describe('withProvinceThaiNames — id-derived chain preferred, name-map fallback (CAM-573)', () => {
  it('[normal] a row WITH adminArea gets the full bilingual set, ignoring the name map', () => {
    const map = new Map([['Chiang Mai', 'WRONG-SHOULD-NOT-BE-USED']]);
    const rows: { location: { province: string | null; adminArea?: AdminAreaChainNode | null } }[] = [{
      location: {
        province: 'Chiang Mai',
        adminArea: {
          level: 'DISTRICT', nameTh: 'เมืองเชียงใหม่', nameEn: 'Mueang Chiang Mai',
          parent: { level: 'PROVINCE', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai', parent: null },
        },
      },
    }];
    const [card] = withProvinceThaiNames(rows, map);
    expect(card.location.provinceTh).toBe('เชียงใหม่');
    expect(card.location.provinceEn).toBe('Chiang Mai');
    expect(card.location.districtTh).toBe('เมืองเชียงใหม่');
    expect(card.location.districtEn).toBe('Mueang Chiang Mai');
  });

  it('[null/empty] a row with NO adminArea falls back to the name-based map for provinceTh; district fields stay undefined', () => {
    const realMap = new Map([['Chiang Mai', 'เชียงใหม่']]);
    const rows: { location: { province: string | null } }[] = [{ location: { province: 'Chiang Mai' } }];
    const [card] = withProvinceThaiNames(rows, realMap);

    expect(card.location.provinceTh).toBe('เชียงใหม่');
    expect(card.location.provinceEn).toBeUndefined();
    expect(card.location.districtTh).toBeUndefined();
  });

  it('[structural] never mutates the input card objects', () => {
    const original: { location: { province: string | null } } = { location: { province: 'Bangkok' } };
    withProvinceThaiNames([original], new Map());
    expect('provinceTh' in original.location).toBe(false);
  });

  it('[boundary] a malformed fixture with no `location` at all never throws', () => {
    const malformed = { id: 'c1' } as unknown as { location: { province: string | null } };
    expect(() => withProvinceThaiNames([malformed], new Map())).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// buildLocationText — the rendered string, TH + EN, every resolved depth
// ---------------------------------------------------------------------------
describe('buildLocationText — id-derived district/sub-district, closes CAM-567 (AC-3/AC-4)', () => {
  it('[normal] AC-3: SUBDISTRICT depth in TH mode renders "sub-district, district, province"', () => {
    const location = {
      province: 'Chiang Mai', provinceTh: 'เชียงใหม่', provinceEn: 'Chiang Mai',
      districtTh: 'เมืองเชียงใหม่', districtEn: 'Mueang Chiang Mai',
      subDistrictTh: 'ช้างคลาน', subDistrictEn: 'Chang Khlan',
    };
    expect(buildLocationText(location, 'th')).toBe('ช้างคลาน, เมืองเชียงใหม่, เชียงใหม่');
  });

  it('[normal] AC-4: the SAME row in EN mode renders the English chain, never a mixed language', () => {
    const location = {
      province: 'Chiang Mai', provinceTh: 'เชียงใหม่', provinceEn: 'Chiang Mai',
      districtTh: 'เมืองเชียงใหม่', districtEn: 'Mueang Chiang Mai',
      subDistrictTh: 'ช้างคลาน', subDistrictEn: 'Chang Khlan',
    };
    expect(buildLocationText(location, 'en')).toBe('Chang Khlan, Mueang Chiang Mai, Chiang Mai');
  });

  it('[normal] DISTRICT-only depth renders "district, province" (no sub-district level)', () => {
    const location = {
      province: 'Chiang Mai', provinceTh: 'เชียงใหม่', provinceEn: 'Chiang Mai',
      districtTh: 'เมืองเชียงใหม่', districtEn: 'Mueang Chiang Mai',
    };
    expect(buildLocationText(location, 'th')).toBe('เมืองเชียงใหม่, เชียงใหม่');
    expect(buildLocationText(location, 'en')).toBe('Mueang Chiang Mai, Chiang Mai');
  });

  it('[null/empty] PROVINCE-only depth renders province alone, no dangling comma (EC-3)', () => {
    const location = { province: 'Chiang Mai', provinceTh: 'เชียงใหม่', provinceEn: 'Chiang Mai' };
    const th = buildLocationText(location, 'th');
    expect(th).toBe('เชียงใหม่');
    expect(th).not.toContain(',');
  });

  it('[boundary] EC-6: no adminArea at all (the 2 orphan Location rows) falls back to the raw province value alone, never throws', () => {
    const location = { province: 'x' };
    expect(() => buildLocationText(location, 'th')).not.toThrow();
    expect(buildLocationText(location, 'th')).toBe('x');
  });

  it('[boundary] EC-5: no adminArea but a raw free-text district (an older/narrower caller, e.g. the detail page) falls back to the raw value for BOTH languages — pre-existing behavior, no regression', () => {
    const location = { province: 'Narathiwat', provinceTh: 'นราธิวาส', district: 'เมืองนราธิวาส' };
    expect(buildLocationText(location, 'th')).toBe('เมืองนราธิวาส, นราธิวาส');
    const locationEn = { province: 'Narathiwat', district: 'Mueang Narathiwat' };
    expect(buildLocationText(locationEn, 'en')).toBe('Mueang Narathiwat, Narathiwat');
  });

  it('[structural/regression] the literal "Thailand" never appears in any rendered value', () => {
    const rows = [
      { province: 'Chiang Mai', provinceTh: 'เชียงใหม่', provinceEn: 'Chiang Mai', districtTh: 'เมืองเชียงใหม่', districtEn: 'Mueang Chiang Mai', subDistrictTh: 'ช้างคลาน', subDistrictEn: 'Chang Khlan' },
      { province: 'Trat', provinceTh: 'ตราด', provinceEn: 'Trat' },
      { province: 'x' },
    ];
    for (const location of rows) {
      expect(buildLocationText(location, 'th')).not.toContain('Thailand');
      expect(buildLocationText(location, 'en')).not.toContain('Thailand');
    }
  });
});

// ---------------------------------------------------------------------------
// Real-dataset-shaped coverage — not one happy row (qa.md's "not just one
// happy row" discipline, matching the tech.md-measured depth distribution:
// PROVINCE-only / DISTRICT / SUBDISTRICT all represented).
// ---------------------------------------------------------------------------
describe('buildLocationText — representative depth mix (tech.md measured: 96 province-only / 23 district / 531 sub-district)', () => {
  const camps = [
    { name: 'province-only camp', location: { province: 'Trat', provinceTh: 'ตราด', provinceEn: 'Trat' }, expectTh: 'ตราด', expectEn: 'Trat' },
    { name: 'district-depth camp', location: { province: 'Krabi', provinceTh: 'กระบี่', provinceEn: 'Krabi', districtTh: 'เมืองกระบี่', districtEn: 'Mueang Krabi' }, expectTh: 'เมืองกระบี่, กระบี่', expectEn: 'Mueang Krabi, Krabi' },
    { name: 'sub-district-depth camp', location: { province: 'Chiang Mai', provinceTh: 'เชียงใหม่', provinceEn: 'Chiang Mai', districtTh: 'เมืองเชียงใหม่', districtEn: 'Mueang Chiang Mai', subDistrictTh: 'ช้างคลาน', subDistrictEn: 'Chang Khlan' }, expectTh: 'ช้างคลาน, เมืองเชียงใหม่, เชียงใหม่', expectEn: 'Chang Khlan, Mueang Chiang Mai, Chiang Mai' },
  ];

  it.each(camps)('[normal] $name renders the correct depth in both languages', ({ location, expectTh, expectEn }) => {
    expect(buildLocationText(location, 'th')).toBe(expectTh);
    expect(buildLocationText(location, 'en')).toBe(expectEn);
  });
});
