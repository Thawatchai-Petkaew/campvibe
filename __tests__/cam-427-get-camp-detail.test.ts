/**
 * cam-427-get-camp-detail.test.ts — CAM-427 (Part 3: the assistant's floating
 * detail card) — lib/ai/tools/get-camp-detail.ts
 *
 * Coverage matrix:
 *   - normal: a found, published camp returns amenities + verified reviews +
 *     reviewSummary + availableWeekendDates
 *   - normal: amenities carry the full options relation (code/group/nameTh/
 *     nameEn/icon), not just the "first tag" the card select caps at 1
 *   - null/empty: not found / unpublished / soft-deleted → { ok:false,
 *     code:'not_found' }
 *   - null/empty: reviewCount 0 → reviewSummary.hasReviews false (G7)
 *   - boundary: an unverified review is excluded from `reviews`, but
 *     reviewSummary.count still reflects the FULL reviewCount aggregate
 *   - error/validation: a non-uuid campSiteId is rejected by zod
 *   - perf/N+1 guard: exactly ONE getCampSiteDailyAvailability call + ONE
 *     getEffectiveCapacity call for the whole weekend lookahead window —
 *     never one call per Saturday
 *   - normal: a Saturday night with no booking/block/hold data is available;
 *     a full/host-blocked Saturday is excluded from availableWeekendDates
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindFirst = vi.fn();
const mockGetCampSiteDailyAvailability = vi.fn();
const mockGetEffectiveCapacity = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

vi.mock('@/lib/campsite-availability', () => ({
  getCampSiteDailyAvailability: (...args: unknown[]) => mockGetCampSiteDailyAvailability(...args),
  getEffectiveCapacity: (...args: unknown[]) => mockGetEffectiveCapacity(...args),
}));

const { executeGetCampDetail, getCampDetailArgsSchema } = await import('@/lib/ai/tools/get-camp-detail');

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

function baseCampSite(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    nameTh: 'ลานกางเต็นท์ริมน้ำ',
    nameEn: 'Riverside Camp',
    useSpotView: false,
    maxGuestsPerDay: 20,
    maxTentsPerDay: 10,
    avgRating: null,
    reviewCount: 0,
    options: [],
    reviews: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCampSiteDailyAvailability.mockResolvedValue({});
  mockGetEffectiveCapacity.mockResolvedValue({ maxGuestsPerDay: 20, maxTentsPerDay: 10 });
});

describe('getCampDetail — error/validation', () => {
  it('[error] a non-uuid campSiteId is rejected by zod before the tool ever runs', () => {
    const parsed = getCampDetailArgsSchema.safeParse({ campSiteId: 'not-a-uuid' });
    expect(parsed.success).toBe(false);
  });
});

describe('getCampDetail — null/empty (not found)', () => {
  it('[null/empty] no matching published/active/non-deleted camp → { ok:false, code:"not_found" }', async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });

    expect(result).toEqual({ ok: false, code: 'not_found' });
    expect(mockGetCampSiteDailyAvailability).not.toHaveBeenCalled();
  });

  it('[normal] queries scoped to published+active+non-deleted (never leaks a draft/unpublished camp)', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await executeGetCampDetail({ campSiteId: VALID_UUID });

    const call = mockFindFirst.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where).toMatchObject({ id: VALID_UUID, isPublished: true, isActive: true, deletedAt: null });
  });
});

describe('getCampDetail — normal (amenities + reviews + reviewSummary)', () => {
  it('[normal] amenities carry the full options relation, reviews map to the DTO, reviewSummary reflects the aggregate', async () => {
    mockFindFirst.mockResolvedValueOnce(
      baseCampSite({
        avgRating: { toNumber: () => 4.5 },
        reviewCount: 12,
        options: [
          { code: 'RIVE', group: 'Terrain', nameTh: 'แม่น้ำ ลำธาร คลองเล็ก', nameEn: 'River, stream, or creek', icon: 'Waves' },
          { code: 'SHOW', group: 'Internal facility', nameTh: 'ห้องอาบน้ำ', nameEn: 'Showers', icon: 'ShowerHead' },
        ],
        reviews: [
          { rating: 5, content: 'ดีมาก', createdAt: new Date('2026-01-01'), author: { name: 'สมชาย' } },
        ],
      })
    );

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.amenities).toHaveLength(2);
    expect(result.amenities[0]).toEqual({ code: 'RIVE', group: 'Terrain', nameTh: 'แม่น้ำ ลำธาร คลองเล็ก', nameEn: 'River, stream, or creek', icon: 'Waves' });
    expect(result.reviews).toEqual([{ name: 'สมชาย', rating: 5, content: 'ดีมาก', createdAt: new Date('2026-01-01') }]);
    expect(result.reviewSummary).toEqual({ hasReviews: true, avgRating: 4.5, count: 12 });
  });

  it('[null/empty] reviewCount 0 → reviewSummary.hasReviews false (G7 — "ยังไม่มีรีวิว")', async () => {
    mockFindFirst.mockResolvedValueOnce(baseCampSite({ avgRating: null, reviewCount: 0, reviews: [] }));

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reviewSummary).toEqual({ hasReviews: false, avgRating: null, count: 0 });
  });

  it('[boundary] reviewSummary.count reflects the FULL aggregate even when fewer verified reviews are listed', async () => {
    // The Prisma select already filters `reviews` to verified:true (query-boundary,
    // not re-tested here — see the where clause assertion below); reviewCount is the
    // separate AGG-1 aggregate over ALL non-deleted reviews.
    mockFindFirst.mockResolvedValueOnce(
      baseCampSite({
        avgRating: { toNumber: () => 4.0 },
        reviewCount: 12,
        reviews: [{ rating: 4, content: null, createdAt: new Date('2026-01-01'), author: { name: 'A' } }],
      })
    );

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reviews).toHaveLength(1);
    expect(result.reviewSummary.count).toBe(12);
  });

  it('[normal] the reviews sub-query is scoped to verified:true, deletedAt:null, capped, most-recent-first', async () => {
    mockFindFirst.mockResolvedValueOnce(baseCampSite());
    await executeGetCampDetail({ campSiteId: VALID_UUID });

    const call = mockFindFirst.mock.calls[0][0] as { select: { reviews: { where: Record<string, unknown>; take: number; orderBy: Record<string, unknown> } } };
    expect(call.select.reviews.where).toEqual({ verified: true, deletedAt: null });
    expect(call.select.reviews.take).toBeGreaterThan(0);
    expect(call.select.reviews.orderBy).toEqual({ createdAt: 'desc' });
  });
});

describe('getCampDetail — availableWeekendDates (perf/N+1 guard)', () => {
  it('[perf] exactly ONE getCampSiteDailyAvailability call + ONE getEffectiveCapacity call for the whole lookahead window', async () => {
    mockFindFirst.mockResolvedValueOnce(baseCampSite());
    await executeGetCampDetail({ campSiteId: VALID_UUID });

    expect(mockGetCampSiteDailyAvailability).toHaveBeenCalledTimes(1);
    expect(mockGetEffectiveCapacity).toHaveBeenCalledTimes(1);
  });

  it('[normal] a Saturday with no daily-availability entry at all is treated as open', async () => {
    mockFindFirst.mockResolvedValueOnce(baseCampSite());
    mockGetCampSiteDailyAvailability.mockResolvedValueOnce({});

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.availableWeekendDates.length).toBeGreaterThan(0);
  });

  it('[boundary] a host-blocked Saturday is excluded from availableWeekendDates', async () => {
    mockFindFirst.mockResolvedValueOnce(baseCampSite());
    mockGetCampSiteDailyAvailability.mockImplementationOnce(async (_id: string, start: Date) => {
      const key = start.toISOString().split('T')[0];
      return { [key]: { bookedGuests: 0, bookedTents: 0, blockedByHost: true, heldGuests: 0 } };
    });

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The very first Saturday in the window is blocked — it must not appear.
    const firstKey = (mockGetCampSiteDailyAvailability.mock.calls[0][1] as Date).toISOString().split('T')[0];
    expect(result.availableWeekendDates).not.toContain(firstKey);
  });

  it('[boundary] a numerically-full Saturday (occupied >= capacity) is excluded', async () => {
    mockFindFirst.mockResolvedValueOnce(baseCampSite());
    mockGetEffectiveCapacity.mockResolvedValueOnce({ maxGuestsPerDay: 4, maxTentsPerDay: 2 });
    mockGetCampSiteDailyAvailability.mockImplementationOnce(async (_id: string, start: Date) => {
      const key = start.toISOString().split('T')[0];
      return { [key]: { bookedGuests: 4, bookedTents: 2, blockedByHost: false, heldGuests: 0 } };
    });

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const firstKey = (mockGetCampSiteDailyAvailability.mock.calls[0][1] as Date).toISOString().split('T')[0];
    expect(result.availableWeekendDates).not.toContain(firstKey);
  });
});
