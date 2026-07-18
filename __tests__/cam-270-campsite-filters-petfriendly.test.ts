/**
 * CAM-270 BR-9 — lib/campsite-filters.ts buildCampSiteWhere additive petFriendly step.
 *
 * Coverage matrix:
 *   - normal: petFriendly:true pushes { petFriendly: true } into where.AND
 *   - null/empty: petFriendly absent/false leaves the where clause unchanged (no regression for existing callers)
 *   - concurrent/ordering: petFriendly:true combined with a keyword search never clobbers where.OR
 */
import { describe, it, expect } from 'vitest';
import { buildCampSiteWhere } from '@/lib/campsite-filters';

describe('buildCampSiteWhere — petFriendly additive (BR-9)', () => {
  it('[unit] petFriendly:true pushes { petFriendly: true } into where.AND', () => {
    const where = buildCampSiteWhere({ petFriendly: true });
    expect(Array.isArray(where.AND)).toBe(true);
    expect(where.AND).toContainEqual({ petFriendly: true });
  });

  it('[unit] petFriendly absent leaves where.AND untouched (no regression)', () => {
    const where = buildCampSiteWhere({});
    expect(where.AND).toBeUndefined();
  });

  it('[unit] petFriendly:false does NOT apply a filter (absent/false = no filtering, not "must be false")', () => {
    const where = buildCampSiteWhere({ petFriendly: false });
    const andEntries = (where.AND as unknown[]) ?? [];
    expect(andEntries).not.toContainEqual({ petFriendly: true });
  });

  it('[unit] the base public gate (isActive/isPublished/deletedAt) is always present alongside petFriendly', () => {
    const where = buildCampSiteWhere({ petFriendly: true });
    expect(where.isActive).toBe(true);
    expect(where.isPublished).toBe(true);
    expect(where.deletedAt).toBeNull();
  });

  it('[unit] petFriendly:true combined with a keyword search never clobbers where.OR (additive via AND)', () => {
    const where = buildCampSiteWhere({ petFriendly: true, keyword: 'ริมน้ำ' });
    expect(Array.isArray(where.OR)).toBe(true);
    expect(where.OR).toHaveLength(4); // nameTh/nameEn/description/operator.name — unchanged shape
    expect(Array.isArray(where.AND)).toBe(true);
    expect(where.AND).toContainEqual({ petFriendly: true });
  });

  it('[unit] petFriendly:true combined with the existing guests filter stacks into the SAME where.AND array', () => {
    const where = buildCampSiteWhere({ petFriendly: true, guests: '4' });
    const andEntries = where.AND as unknown[];
    expect(andEntries).toContainEqual({ petFriendly: true });
    expect(andEntries.length).toBeGreaterThanOrEqual(2); // guests-capacity AND + petFriendly AND
  });
});
