/**
 * CAM-461 Decision 1/BR-1/BR-3, EC-3 — lib/campsite-filters.ts buildCampSiteWhere
 * additive OR-within-facet-group + id-exclusion.
 *
 * Coverage matrix:
 *   - normal: a facet group passed as string[] emits ONE
 *     `{ options: { some: { code: { in: [...] } } } }` where.AND element (OR
 *     within the group — the union, AC-4)
 *   - normal: two named groups (one array, one string) co-present stay as TWO
 *     SEPARATE where.AND elements (AND across groups, still unioned within
 *     each — AC-4)
 *   - regression: the EXISTING string branch (single code + comma-multi-code)
 *     stays byte-identical to the pre-CAM-461 shape (pins the same equality
 *     shape `__tests__/cam-408-*.test.ts:61` asserts, so the 5 catalog
 *     callers passing strings are provably unaffected)
 *   - boundary/EC-3: an empty array `[]` for a group = "group not specified"
 *     (no filter), never a zero-match query
 *   - normal/BR-1: `excludeIds` (non-empty) → `where.id = { notIn: [...] }`
 *   - null/empty: `excludeIds` absent/[] leaves `where.id` untouched (no
 *     regression for every other caller)
 *   - concurrent/ordering: excludeIds + OR-group + petFriendly all coexist
 *     without clobbering each other
 */
import { describe, it, expect } from 'vitest';
import { buildCampSiteWhere } from '@/lib/campsite-filters';

describe('buildCampSiteWhere — OR-within-facet-group (CAM-461 Decision 1, AC-4)', () => {
  it('[unit] terrain:["RIVE","BEAC"] emits ONE where.AND element with code.in (the union, not AND-per-code)', () => {
    const where = buildCampSiteWhere({ terrain: ['RIVE', 'BEAC'] });
    expect(Array.isArray(where.AND)).toBe(true);
    expect(where.AND).toContainEqual({ options: { some: { code: { in: ['RIVE', 'BEAC'] } } } });
    // Never the AND-per-code shape for an array input.
    expect(where.AND).not.toContainEqual({ options: { some: { code: 'RIVE' } } });
    expect(where.AND).not.toContainEqual({ options: { some: { code: 'BEAC' } } });
  });

  it('[unit] two named groups (terrain array + access string) stay as TWO separate where.AND elements (AND-across-groups)', () => {
    const where = buildCampSiteWhere({ terrain: ['RIVE', 'BEAC'], access: 'DRIV' });
    const and = where.AND as unknown[];
    expect(and).toContainEqual({ options: { some: { code: { in: ['RIVE', 'BEAC'] } } } });
    expect(and).toContainEqual({ options: { some: { code: 'DRIV' } } });
    expect(and.length).toBe(2);
  });

  it('[unit][EC-3] an empty array for a group means "not specified" — no filter, never zero-match', () => {
    const where = buildCampSiteWhere({ terrain: [] });
    const and = (where.AND as unknown[]) ?? [];
    expect(and.some((e) => JSON.stringify(e).includes('options'))).toBe(false);
  });

  it('[unit] every facet group (access/activities/facilities/terrain) supports the array OR shape', () => {
    const where = buildCampSiteWhere({
      access: ['DRIV', 'WALK'],
      activities: ['SWIM', 'FISH'],
      facilities: ['WIFI', 'SHOW'],
      terrain: ['RIVE', 'BEAC'],
    });
    const and = where.AND as unknown[];
    expect(and).toContainEqual({ options: { some: { code: { in: ['DRIV', 'WALK'] } } } });
    expect(and).toContainEqual({ options: { some: { code: { in: ['SWIM', 'FISH'] } } } });
    expect(and).toContainEqual({ options: { some: { code: { in: ['WIFI', 'SHOW'] } } } });
    expect(and).toContainEqual({ options: { some: { code: { in: ['RIVE', 'BEAC'] } } } });
    expect(and.length).toBe(4);
  });
});

describe('buildCampSiteWhere — string branch stays byte-identical (regression, CAM-355 shared-fn risk)', () => {
  it('[unit] a single string code keeps the exact pre-CAM-461 equality shape (pins __tests__/cam-408-*.test.ts:61)', () => {
    const where = buildCampSiteWhere({ terrain: 'RIVE' });
    expect(where.AND).toContainEqual({ options: { some: { code: 'RIVE' } } });
    // Never the array/OR shape for a plain string input.
    expect(JSON.stringify(where.AND)).not.toContain('"in"');
  });

  it('[unit] a comma-multi-code string stays AND-per-code (unchanged catalog semantics, e.g. app/api/campsites/route.ts)', () => {
    const where = buildCampSiteWhere({ terrain: 'RIVE,BEAC' });
    const and = where.AND as unknown[];
    expect(and).toContainEqual({ options: { some: { code: 'RIVE' } } });
    expect(and).toContainEqual({ options: { some: { code: 'BEAC' } } });
    expect(and.length).toBe(2);
  });

  it('[unit] an undefined group still applies no filter (unchanged)', () => {
    const where = buildCampSiteWhere({});
    expect(where.AND).toBeUndefined();
  });
});

describe('buildCampSiteWhere — excludeIds id-exclusion (CAM-461 BR-1)', () => {
  it('[unit] a non-empty excludeIds array sets where.id = { notIn: [...] }', () => {
    const where = buildCampSiteWhere({ excludeIds: ['c1', 'c2', 'c3'] });
    expect(where.id).toEqual({ notIn: ['c1', 'c2', 'c3'] });
  });

  it('[unit] excludeIds absent leaves where.id untouched (no regression for every other caller)', () => {
    const where = buildCampSiteWhere({});
    expect(where.id).toBeUndefined();
  });

  it('[unit] excludeIds:[] (empty) leaves where.id untouched — same as absent', () => {
    const where = buildCampSiteWhere({ excludeIds: [] });
    expect(where.id).toBeUndefined();
  });

  it('[unit] excludeIds coexists with an OR-within-group filter and petFriendly without clobbering each other', () => {
    const where = buildCampSiteWhere({
      excludeIds: ['c1', 'c2'],
      terrain: ['RIVE', 'BEAC'],
      petFriendly: true,
    });
    expect(where.id).toEqual({ notIn: ['c1', 'c2'] });
    const and = where.AND as unknown[];
    expect(and).toContainEqual({ options: { some: { code: { in: ['RIVE', 'BEAC'] } } } });
    expect(and).toContainEqual({ petFriendly: true });
  });

  it('[unit] the base public gate (isActive/isPublished/deletedAt) is always present alongside excludeIds', () => {
    const where = buildCampSiteWhere({ excludeIds: ['c1'] });
    expect(where.isActive).toBe(true);
    expect(where.isPublished).toBe(true);
    expect(where.deletedAt).toBeNull();
  });
});
