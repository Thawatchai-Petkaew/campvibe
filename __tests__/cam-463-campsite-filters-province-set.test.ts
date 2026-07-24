/**
 * CAM-463 Decision 4 — lib/campsite-filters.ts buildCampSiteWhere: additive
 * `province: string | string[]` widening (reuses the CAM-461 widening
 * TECHNIQUE, applied to the location filter this time).
 *
 * Coverage matrix:
 *   - regression: the EXISTING string branch stays BYTE-IDENTICAL to the
 *     pre-CAM-463 shape (`where.location.province = "Chiang Mai"`, plain
 *     equality, no `in`) — proves every one of the 5+ catalog callers
 *     (app/api/campsites/route.ts, cursor counts, etc.) is unaffected
 *     (CAM-355 shared-fn risk lesson)
 *   - normal: a province array emits `{ in: [...] }` (the province-SET match
 *     a resolved region needs)
 *   - boundary/EC: an empty array means "no province filter", never a
 *     zero-match query (mirrors addOptionFilter's guard)
 *   - null/empty: province absent leaves where.location untouched (unchanged)
 *   - concurrent/ordering: province (array) + district co-present don't
 *     clobber each other
 */
import { describe, it, expect } from 'vitest';
import { buildCampSiteWhere } from '@/lib/campsite-filters';

describe('buildCampSiteWhere — province STRING branch stays byte-identical (regression, CAM-463 Decision 4)', () => {
  it('[unit] a single-province string call produces plain equality — identical to pre-CAM-463 (pins every catalog caller)', () => {
    const where = buildCampSiteWhere({ province: 'Chiang Mai' });
    expect(where.location?.province).toBe('Chiang Mai');
    expect(JSON.stringify(where.location)).not.toContain('"in"');
  });

  it('[unit] province + district together stay the unchanged combined shape', () => {
    const where = buildCampSiteWhere({ province: 'Chiang Mai', district: 'Mueang' });
    expect(where.location?.province).toBe('Chiang Mai');
    expect(where.location?.district).toBe('Mueang');
  });

  it('[unit] province absent leaves where.location untouched (unchanged behavior for every other caller)', () => {
    const where = buildCampSiteWhere({});
    expect(where.location).toBeUndefined();
  });

  it('[unit] the base public gate (isActive/isPublished/deletedAt) is always present alongside a string province', () => {
    const where = buildCampSiteWhere({ province: 'Chiang Mai' });
    expect(where.isActive).toBe(true);
    expect(where.isPublished).toBe(true);
    expect(where.deletedAt).toBeNull();
  });
});

describe('buildCampSiteWhere — province ARRAY branch (NEW, CAM-463 Decision 4, region-set matching)', () => {
  it('[unit] a province array emits an `in`-set — the region-expansion shape', () => {
    const northProvinces = ['Chiang Mai', 'Lamphun', 'Lampang', 'Uttaradit', 'Phrae', 'Nan', 'Phayao', 'Chiang Rai', 'Mae Hong Son'];
    const where = buildCampSiteWhere({ province: northProvinces });
    expect(where.location?.province).toEqual({ in: northProvinces });
  });

  it('[unit][boundary] a single-element array still takes the array/`in` branch, not the string equality branch', () => {
    const where = buildCampSiteWhere({ province: ['Chiang Mai'] });
    expect(where.location?.province).toEqual({ in: ['Chiang Mai'] });
  });

  it('[unit][boundary][EC] an empty province array means "no province filter" — never a zero-match query', () => {
    const where = buildCampSiteWhere({ province: [] });
    expect(where.location?.province).toBeUndefined();
  });

  it('[unit] a falsy entry inside the array is filtered out before deciding "empty" (defense for non-zod callers)', () => {
    const where = buildCampSiteWhere({ province: ['Chiang Mai', ''] });
    expect(where.location?.province).toEqual({ in: ['Chiang Mai'] });
  });

  it('[unit][concurrent] province array + district co-present do not clobber each other', () => {
    const where = buildCampSiteWhere({ province: ['Chiang Mai', 'Chiang Rai'], district: 'Mueang' });
    expect(where.location?.province).toEqual({ in: ['Chiang Mai', 'Chiang Rai'] });
    expect(where.location?.district).toBe('Mueang');
  });

  it('[unit] a province array coexists with an unrelated taxonomy filter (terrain) without cross-clobbering', () => {
    const where = buildCampSiteWhere({ province: ['Krabi', 'Phuket'], terrain: 'BEAC' });
    expect(where.location?.province).toEqual({ in: ['Krabi', 'Phuket'] });
    expect(where.AND).toContainEqual({ options: { some: { code: 'BEAC' } } });
  });
});
