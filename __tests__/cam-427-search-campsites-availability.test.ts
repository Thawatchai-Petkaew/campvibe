/**
 * cam-427-search-campsites-availability.test.ts — CAM-427 (Part 2 wiring):
 * searchCampsites' optional startDate/endDate → LIVE, batched "เหลือ N ที่"
 * per card via getRemainingCapacityForCamps (never a per-card
 * getRemainingCapacity loop, BR-5).
 *
 * Coverage matrix:
 *   - normal: no date args → every card's `remaining` is null (unknown), no
 *     availability call is made at all (cheapest path)
 *   - normal: both dates given → each card's `remaining` comes from the
 *     batched map, keyed by campId
 *   - null/empty: only one of startDate/endDate given → remaining stays null,
 *     search itself still succeeds (never blocks the result list)
 *   - perf/N+1 guard: getRemainingCapacityForCamps is called exactly ONCE for
 *     a page of N cards, never once per card
 *   - null/empty: zero-match search with dates given → cards [] (AC-8 unaffected)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindMany = vi.fn();
const mockGetRemainingCapacityForCamps = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('@/lib/campsite-availability', () => ({
  getRemainingCapacityForCamps: (...args: unknown[]) => mockGetRemainingCapacityForCamps(...args),
}));

const { executeSearchCampsites, searchCampsitesArgsSchema } = await import('@/lib/ai/tools/search-campsites');

function row(id: string) {
  return { id, reviewCount: 0, location: { province: 'Chiang Mai' }, options: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('searchCampsites — no date range (default)', () => {
  it('[normal] no startDate/endDate → every card has remaining:null, no availability call made', async () => {
    mockFindMany.mockResolvedValueOnce([row('c1'), row('c2')]);

    const args = searchCampsitesArgsSchema.parse({ province: 'เชียงใหม่' });
    const result = await executeSearchCampsites(args);

    expect(result.cards.every((c) => c.remaining === null)).toBe(true);
    expect(mockGetRemainingCapacityForCamps).not.toHaveBeenCalled();
  });
});

describe('searchCampsites — both dates given (G3 live "เหลือ N ที่")', () => {
  it('[normal] each card carries its own remaining count from the batched map', async () => {
    mockFindMany.mockResolvedValueOnce([row('c1'), row('c2')]);
    mockGetRemainingCapacityForCamps.mockResolvedValueOnce({
      c1: { capacity: 10, bookedGuests: 4, heldGuests: 0, remaining: 6, blockedByHost: false },
      c2: { capacity: 5, bookedGuests: 5, heldGuests: 0, remaining: 0, blockedByHost: false },
    });

    const args = searchCampsitesArgsSchema.parse({ startDate: '2026-09-10', endDate: '2026-09-11' });
    const result = await executeSearchCampsites(args);

    expect(result.cards.find((c) => c.id === 'c1')?.remaining).toBe(6);
    expect(result.cards.find((c) => c.id === 'c2')?.remaining).toBe(0);
  });

  it('[perf] getRemainingCapacityForCamps is called exactly ONCE for the whole page — never per card', async () => {
    mockFindMany.mockResolvedValueOnce([row('c1'), row('c2'), row('c3')]);
    mockGetRemainingCapacityForCamps.mockResolvedValueOnce({});

    const args = searchCampsitesArgsSchema.parse({ startDate: '2026-09-10', endDate: '2026-09-11' });
    await executeSearchCampsites(args);

    expect(mockGetRemainingCapacityForCamps).toHaveBeenCalledTimes(1);
    expect(mockGetRemainingCapacityForCamps).toHaveBeenCalledWith(['c1', 'c2', 'c3'], expect.any(Date), expect.any(Date));
  });

  it('[null/empty] a campId absent from the batched map (fully open / unknown) falls back to remaining:null, never crashes', async () => {
    mockFindMany.mockResolvedValueOnce([row('c1')]);
    mockGetRemainingCapacityForCamps.mockResolvedValueOnce({}); // c1 omitted

    const args = searchCampsitesArgsSchema.parse({ startDate: '2026-09-10', endDate: '2026-09-11' });
    const result = await executeSearchCampsites(args);

    expect(result.cards[0].remaining).toBeNull();
  });

  it('[null/empty] zero-match search with dates given still returns [] and never calls the availability batch', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ startDate: '2026-09-10', endDate: '2026-09-11' });
    const result = await executeSearchCampsites(args);

    expect(result.cards).toEqual([]);
    expect(mockGetRemainingCapacityForCamps).not.toHaveBeenCalled();
  });
});

describe('searchCampsites — only one date given (fail-open)', () => {
  it('[null/empty] only startDate (no endDate) → remaining stays null; search still succeeds', async () => {
    mockFindMany.mockResolvedValueOnce([row('c1')]);

    const args = searchCampsitesArgsSchema.parse({ startDate: '2026-09-10' });
    const result = await executeSearchCampsites(args);

    expect(result.cards[0].remaining).toBeNull();
    expect(mockGetRemainingCapacityForCamps).not.toHaveBeenCalled();
  });
});
