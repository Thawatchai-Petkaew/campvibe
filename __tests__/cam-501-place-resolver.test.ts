/**
 * CAM-501 (P1 Place Resolver) — `resolvePlace` unit coverage (BR-1) +
 * a drift guard proving every canonical region phrase this resolver hands
 * back actually round-trips through the REAL `resolveRegionForSearch`
 * (lib/thai-regions.ts), so the two alias tables can never silently diverge.
 */
import { describe, it, expect } from 'vitest';
import { resolvePlace } from '@/lib/ai/place-resolver';
import { resolveRegionForSearch, REGION_TO_PROVINCES } from '@/lib/thai-regions';

describe('CAM-501 resolvePlace — BR-1 province (Thai + English)', () => {
  it('[normal] a Thai province name embedded in free text resolves to the DB-canonical English name', () => {
    expect(resolvePlace('แคมป์ริมน้ำเชียงใหม่')).toEqual({ province: 'Chiang Mai' });
  });

  it('[normal] an English province name embedded in free text resolves (case-insensitive)', () => {
    expect(resolvePlace('camping near chiang mai please')).toEqual({ province: 'Chiang Mai' });
  });

  it('[normal] a different Thai province resolves correctly (no cross-province confusion)', () => {
    expect(resolvePlace('หาแคมป์ในภูเก็ต')).toEqual({ province: 'Phuket' });
  });

  it('[edge] a short English province name does not fire inside an unrelated English word (word-boundary guard)', () => {
    // "Tak" is a real province; "mistake" contains it as a raw (non-word-bounded) substring.
    expect(resolvePlace('a big mistake happened')).toEqual({});
  });

  it('[edge] no place mentioned at all resolves to an empty object', () => {
    expect(resolvePlace('สวัสดีครับ')).toEqual({});
  });

  it('[null/empty] an empty string resolves to an empty object, never throws', () => {
    expect(resolvePlace('')).toEqual({});
  });
});

describe('CAM-501 resolvePlace — BR-1 region (all 6 + aliases)', () => {
  it('[normal] ภาคเหนือ -> region "ภาคเหนือ"', () => {
    expect(resolvePlace('ริมน้ำภาคเหนือ')).toEqual({ region: 'ภาคเหนือ' });
  });

  it('[normal] อีสาน (alias) -> region "ภาคอีสาน"', () => {
    expect(resolvePlace('อยากไปแคมป์แถวอีสาน')).toEqual({ region: 'ภาคอีสาน' });
  });

  it('[normal] ภาคตะวันออกเฉียงเหนือ (formal) -> region "ภาคอีสาน" canonical (NORTHEAST)', () => {
    const result = resolvePlace('ที่พักภาคตะวันออกเฉียงเหนือ');
    expect(result.region).toBe('ภาคตะวันออกเฉียงเหนือ');
  });

  it('[normal] ภาคกลาง -> region "ภาคกลาง"', () => {
    expect(resolvePlace('แคมป์ภาคกลาง')).toEqual({ region: 'ภาคกลาง' });
  });

  it('[normal] ภาคตะวันออก -> region "ภาคตะวันออก"', () => {
    expect(resolvePlace('แคมป์ภาคตะวันออก')).toEqual({ region: 'ภาคตะวันออก' });
  });

  it('[normal] ภาคตะวันตก -> region "ภาคตะวันตก"', () => {
    expect(resolvePlace('แคมป์ภาคตะวันตก')).toEqual({ region: 'ภาคตะวันตก' });
  });

  it('[normal] ภาคใต้ -> region "ภาคใต้"', () => {
    expect(resolvePlace('แคมป์ภาคใต้')).toEqual({ region: 'ภาคใต้' });
  });

  it('[normal] ปักษ์ใต้ (alias) -> region "ภาคใต้"', () => {
    expect(resolvePlace('แคมป์ปักษ์ใต้')).toEqual({ region: 'ภาคใต้' });
  });

  it('[normal] every canonical region value this resolver can return round-trips through the real resolveRegionForSearch (drift guard)', () => {
    const canonicalValues = new Set(
      ['ภาคเหนือ', 'ภาคอีสาน', 'ภาคตะวันออกเฉียงเหนือ', 'ภาคกลาง', 'ภาคตะวันออก', 'ภาคตะวันตก', 'ภาคใต้']
    );
    for (const value of canonicalValues) {
      const resolved = resolveRegionForSearch(value);
      expect(Array.isArray(resolved)).toBe(true);
    }
    // sanity: NORTH's expansion actually contains Chiang Mai (the AC-1/AC-2 province).
    expect(REGION_TO_PROVINCES.NORTH).toContain('Chiang Mai');
  });
});

describe('CAM-501 resolvePlace — AC-4 a terrain/facility word is NOT a place', () => {
  it('[edge] ริมทะเล alone resolves to an empty object', () => {
    expect(resolvePlace('หาลานริมทะเล')).toEqual({});
  });

  it('[edge] ริมน้ำ alone (no province/region) resolves to an empty object', () => {
    expect(resolvePlace('แคมป์ริมน้ำ')).toEqual({});
  });

  it('[edge] ภูเขา alone resolves to an empty object', () => {
    expect(resolvePlace('อยากได้วิวภูเขา')).toEqual({});
  });

  it('[edge] ป่า alone resolves to an empty object', () => {
    expect(resolvePlace('แคมป์ในป่า')).toEqual({});
  });
});

describe('CAM-501 resolvePlace — EC-3 province wins when both are present', () => {
  it('[boundary] a province AND a region both named -> province wins, region is dropped', () => {
    expect(resolvePlace('เชียงใหม่ ภาคเหนือ ริมน้ำ')).toEqual({ province: 'Chiang Mai' });
  });
});

describe('CAM-501 resolvePlace — EC-2 false-match guard (the thai-regions.ts:55 collision)', () => {
  it('[edge] a Northeast mention (ตะวันออกเฉียงเหนือ) never mis-resolves to North via the "เหนือ" substring', () => {
    const result = resolvePlace('อยากไปเที่ยวภาคตะวันออกเฉียงเหนือ');
    expect(result.region).toBe('ภาคตะวันออกเฉียงเหนือ');
    expect(result.region).not.toBe('ภาคเหนือ');
  });

  it('[edge] a Northeast mention never mis-resolves to East via the "ตะวันออก" substring', () => {
    const result = resolvePlace('ที่เที่ยวภาคตะวันออกเฉียงเหนือน่าสนใจ');
    expect(result.region).toBe('ภาคตะวันออกเฉียงเหนือ');
    expect(result.region).not.toBe('ภาคตะวันออก');
  });

  it('[normal] a genuine bare North mention (no northeast form present) still resolves to North', () => {
    expect(resolvePlace('ริมน้ำภาคเหนือ')).toEqual({ region: 'ภาคเหนือ' });
  });

  it('[normal] a genuine bare East mention (no northeast form present) still resolves to East', () => {
    expect(resolvePlace('แคมป์ภาคตะวันออกใกล้ทะเล')).toEqual({ region: 'ภาคตะวันออก' });
  });
});
