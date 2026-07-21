/**
 * CAM-458 — `prisma/data/thailand-locations.json` completeness (BR-1/D3).
 * Pure JSON assertions, no DB / no mock — this is what actually proves the
 * seed DATA is complete, since a mocked resolver test (cam-458-province-resolve)
 * cannot see the real file contents.
 *
 * Coverage matrix:
 *   - normal: exactly 77 province-level entries; every entry has non-empty
 *     nameTh + nameEn and a `districts` array.
 *   - boundary: unique provinceCode across all 77; unique Thai names; unique
 *     English names (no duplicate/collision from the 65 newly-added rows).
 *   - normal: spot-check Bangkok (code 10) and Bueng Kan (code 38).
 *   - regression: none of the original 12 seeded rows (code + names) was
 *     lost or altered by the 65-row addition.
 */
import { describe, it, expect } from 'vitest';
import thailandLocations from '@/prisma/data/thailand-locations.json';

interface ProvinceEntry {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
  districts: Array<{ code: string; nameTh: string; nameEn: string }>;
}

const provinces = thailandLocations as ProvinceEntry[];

/** The original 12 seeded rows (pre-CAM-458) — must survive the 65-row addition unchanged. */
const ORIGINAL_12: Array<{ code: string; nameTh: string; nameEn: string }> = [
  { code: '10', nameTh: 'กรุงเทพมหานคร', nameEn: 'Bangkok' },
  { code: '11', nameTh: 'สมุทรปราการ', nameEn: 'Samut Prakan' },
  { code: '30', nameTh: 'นครราชสีมา', nameEn: 'Nakhon Ratchasima' },
  { code: '50', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai' },
  { code: '57', nameTh: 'เชียงราย', nameEn: 'Chiang Rai' },
  { code: '58', nameTh: 'แม่ฮ่องสอน', nameEn: 'Mae Hong Son' },
  { code: '67', nameTh: 'เพชรบูรณ์', nameEn: 'Phetchabun' },
  { code: '42', nameTh: 'เลย', nameEn: 'Loei' },
  { code: '81', nameTh: 'กระบี่', nameEn: 'Krabi' },
  { code: '83', nameTh: 'ภูเก็ต', nameEn: 'Phuket' },
  { code: '84', nameTh: 'สุราษฎร์ธานี', nameEn: 'Surat Thani' },
  { code: '23', nameTh: 'ตราด', nameEn: 'Trat' },
];

describe('thailand-locations.json — 77-province completeness (CAM-458 BR-1 normal)', () => {
  it('[unit] has exactly 77 province-level entries', () => {
    expect(provinces).toHaveLength(77);
  });

  it('[unit] every entry has a non-empty provinceCode, nameTh, nameEn, and a districts array', () => {
    for (const p of provinces) {
      expect(p.code.length).toBeGreaterThan(0);
      expect(p.nameTh.length).toBeGreaterThan(0);
      expect(p.nameEn.length).toBeGreaterThan(0);
      expect(Array.isArray(p.districts)).toBe(true);
    }
  });
});

describe('thailand-locations.json — uniqueness (CAM-458 BR-1 boundary)', () => {
  it('[unit] every provinceCode is unique across all 77 rows', () => {
    const codes = provinces.map((p) => p.code);
    expect(new Set(codes).size).toBe(77);
  });

  it('[unit] every Thai province name (nameTh) is unique', () => {
    const names = provinces.map((p) => p.nameTh);
    expect(new Set(names).size).toBe(77);
  });

  it('[unit] every English province name (nameEn) is unique', () => {
    const names = provinces.map((p) => p.nameEn);
    expect(new Set(names).size).toBe(77);
  });
});

describe('thailand-locations.json — spot checks (CAM-458 BR-1 normal)', () => {
  it('[unit] Bangkok is code 10', () => {
    const bangkok = provinces.find((p) => p.nameEn === 'Bangkok');
    expect(bangkok?.code).toBe('10');
    expect(bangkok?.nameTh).toBe('กรุงเทพมหานคร');
  });

  it('[unit] Bueng Kan (a newly-seeded province, AC-1 example) is code 38', () => {
    const buengKan = provinces.find((p) => p.nameEn === 'Bueng Kan');
    expect(buengKan?.code).toBe('38');
    expect(buengKan?.nameTh).toBe('บึงกาฬ');
  });
});

describe('thailand-locations.json — no row lost from the original 12 (CAM-458 regression)', () => {
  it.each(ORIGINAL_12)('[unit] original province code $code ($nameEn) is present unchanged', ({ code, nameTh, nameEn }) => {
    const row = provinces.find((p) => p.code === code);
    expect(row).toBeDefined();
    expect(row?.nameTh).toBe(nameTh);
    expect(row?.nameEn).toBe(nameEn);
  });
});
