/**
 * CAM-270 AC-1/AC-8, BR-1/BR-2 — lib/ai/tools/search-campsites.ts
 *
 * Coverage matrix:
 *   - normal: valid filters (incl. petFriendly) → ≤10 payloads via
 *     buildCampSiteWhere + campCardSelect, public gate present in the WHERE
 *   - null/empty: zero-match search → empty cards array (AC-8), not null/error
 *   - boundary: a model-supplied limit > 10 is clamped to 10 (BR-2), never overridden
 *   - boundary: a model-supplied limit < 10 is respected
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const {
  executeSearchCampsites,
  searchCampsitesArgsSchema,
  SEARCH_CAMPSITES_MAX_RESULTS,
} = await import('@/lib/ai/tools/search-campsites');
const { campCardSelect } = await import('@/lib/read-models/camp-card');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('searchCampsites — normal (valid filters incl. petFriendly)', () => {
  it('[unit] queries via campCardSelect with the public gate present, take ≤ 10', async () => {
    mockFindMany.mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }]);

    const args = searchCampsitesArgsSchema.parse({ province: 'เชียงใหม่', petFriendly: true });
    const result = await executeSearchCampsites(args);

    expect(result.cards).toHaveLength(2);
    expect(mockFindMany).toHaveBeenCalledOnce();
    const call = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown>; select: unknown; take: number };
    expect(call.select).toBe(campCardSelect);
    expect(call.where.isActive).toBe(true);
    expect(call.where.isPublished).toBe(true);
    expect(call.where.deletedAt).toBeNull();
    expect(call.take).toBeLessThanOrEqual(SEARCH_CAMPSITES_MAX_RESULTS);
  });

  it('[unit] petFriendly:true is pushed into where.AND (additive, never clobbers OR)', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ petFriendly: true });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { AND?: unknown[] } };
    expect(Array.isArray(call.where.AND)).toBe(true);
    expect(call.where.AND).toContainEqual({ petFriendly: true });
  });

  it('[unit] petFriendly absent leaves the where clause without a petFriendly filter', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ province: 'ระยอง' });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { AND?: unknown[] } };
    const andEntries = call.where.AND ?? [];
    expect(andEntries).not.toContainEqual({ petFriendly: true });
  });
});

describe('searchCampsites — null/empty (AC-8)', () => {
  it('[unit] zero matches returns an empty cards array, not null/undefined/error', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ province: 'ไม่มีจริง' });
    const result = await executeSearchCampsites(args);

    expect(result.cards).toEqual([]);
  });
});

describe('searchCampsites — boundary (BR-2 hard cap at 10)', () => {
  it('[unit] a model-supplied limit above 10 is clamped to 10, never overridden', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ limit: 500 });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { take: number };
    expect(call.take).toBe(SEARCH_CAMPSITES_MAX_RESULTS);
  });

  it('[unit] a model-supplied limit below 10 is respected as-is', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ limit: 3 });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { take: number };
    expect(call.take).toBe(3);
  });

  it('[unit] no limit supplied defaults to the 10 cap', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({});
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { take: number };
    expect(call.take).toBe(SEARCH_CAMPSITES_MAX_RESULTS);
  });
});
