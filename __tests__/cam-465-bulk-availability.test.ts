/**
 * cam-465-bulk-availability.test.ts — CAM-465 `bulkAvailability` tool
 * (tech.md Decisions 2/3/4/5, story.md AC-1..AC-6/BR-1..BR-7/EC-1..EC-6).
 *
 * `getRemainingCapacityForCamps` is FULLY mocked here (never the real DB
 * core) so this file can assert call-count/call-shape precisely (no N+1,
 * cap-before-any-call) and control per-range results directly for matrix
 * projection coverage. The REAL batched core (the 366-night guard + real
 * booking-number parity) is covered separately in
 * `__tests__/cam-465-bulk-availability-real-guard.test.ts` — that file mocks
 * only `@/lib/prisma`, keeping `getRemainingCapacityForCamps` real.
 *
 * Coverage matrix:
 *   - boundary: RANGES over MAX_DATE_SET_RANGES (13) -> over_cap, ZERO Prisma
 *     calls at all (checked BEFORE the candidate query, BR-3/EC-3)
 *   - boundary: exactly at the ranges cap (12) -> NOT refused
 *   - normal: CAMPS over SEARCH_CAMPSITES_MAX_RESULTS -> take-bound top-10
 *     page, NEVER refused (the asymmetric cap design, AC-5 reworded)
 *   - normal: a camp free for range A / full for range B -> per-range cells
 *     preserved, not collapsed (AC-3)
 *   - normal: a camp full for EVERY range stays PRESENT (AC-2/EC-1)
 *   - normal: remaining < guests -> 'full' (BR-5 numericallyFull projection)
 *   - normal: remaining === null -> 'unknown' (BR-5)
 *   - normal: a range that fail-opens (mocked {}) -> 'unknown' for every camp
 *     on THAT range only, matrix continues (EC-6)
 *   - null/empty: filter matches no published camp -> no_match, NO
 *     availability call made at all (AC-4/EC-2)
 *   - security: the candidate `where` carries the CAM-469 visibility gate
 *     (isActive/isPublished/deletedAt) — inherited via buildCampSiteWhere,
 *     not a parallel query (BR-4/AC-6/EC-5)
 *   - security: the args schema exposes NO campId/campSiteId/userId field
 *   - perf/N+1: getRemainingCapacityForCamps called exactly ONCE PER RANGE
 *     (never once per camp) for a multi-camp x multi-range request
 *   - error: a thrown live read -> { ok:false, reason:'error' }, never a
 *     fabricated free/partial result (EC-4/BR-6)
 *   - normal: tool registration shape (tier guest, name bulkAvailability)
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

const { executeBulkAvailability, bulkAvailabilityArgsSchema, bulkAvailabilityTool } = await import(
  '@/lib/ai/tools/bulk-availability'
);
const { MAX_DATE_SET_RANGES } = await import('@/lib/ai/tools/resolve-dates');
const { SEARCH_CAMPSITES_MAX_RESULTS } = await import('@/lib/ai/tools/search-campsites');

function candidateRow(id: string) {
  return { id, reviewCount: 0, location: { province: 'Chiang Mai' }, options: [] };
}

function dateRange(offsetDays: number) {
  const start = new Date('2026-09-01T00:00:00.000Z');
  start.setUTCDate(start.getUTCDate() + offsetDays);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('bulkAvailability — cap enforcement (Decision 2/BR-3, CAM-344)', () => {
  it('[boundary] RANGES over the cap (13) -> over_cap refused, ZERO Prisma calls of any kind', async () => {
    const dates = Array.from({ length: MAX_DATE_SET_RANGES + 1 }, (_, i) => dateRange(i * 3));
    const args = bulkAvailabilityArgsSchema.parse({ province: 'Chiang Mai', dates });

    const result = await executeBulkAvailability(args);

    expect(result).toEqual({ ok: false, reason: 'over_cap' });
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockGetRemainingCapacityForCamps).not.toHaveBeenCalled();
  });

  it('[boundary] RANGES exactly AT the cap (12) -> NOT refused, proceeds to the candidate query', async () => {
    const dates = Array.from({ length: MAX_DATE_SET_RANGES }, (_, i) => dateRange(i * 3));
    mockFindMany.mockResolvedValueOnce([candidateRow('c1')]);
    mockGetRemainingCapacityForCamps.mockResolvedValue({
      c1: { capacity: 10, bookedGuests: 0, heldGuests: 0, remaining: 10, blockedByHost: false },
    });

    const args = bulkAvailabilityArgsSchema.parse({ province: 'Chiang Mai', dates });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    expect(mockGetRemainingCapacityForCamps).toHaveBeenCalledTimes(MAX_DATE_SET_RANGES);
  });

  it('[normal] CAMPS over 10 (a broad filter) -> take-bound top-10 page, NEVER refused (AC-5 reworded asymmetry)', async () => {
    const tenRows = Array.from({ length: SEARCH_CAMPSITES_MAX_RESULTS }, (_, i) => candidateRow(`c${i}`));
    mockFindMany.mockResolvedValueOnce(tenRows); // simulates Prisma honoring the `take` argument below
    mockGetRemainingCapacityForCamps.mockResolvedValue({});

    const args = bulkAvailabilityArgsSchema.parse({ province: 'Chiang Mai', dates: [dateRange(0)] });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.camps).toHaveLength(SEARCH_CAMPSITES_MAX_RESULTS);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: SEARCH_CAMPSITES_MAX_RESULTS })
    );
  });
});

describe('bulkAvailability — matrix correctness (AC-1/AC-2/AC-3, BR-5)', () => {
  it('[normal] a camp free for range A, full for range B -> per-range cells preserved (not collapsed)', async () => {
    mockFindMany.mockResolvedValueOnce([candidateRow('c1')]);
    mockGetRemainingCapacityForCamps
      .mockResolvedValueOnce({ c1: { capacity: 10, bookedGuests: 2, heldGuests: 0, remaining: 8, blockedByHost: false } })
      .mockResolvedValueOnce({ c1: { capacity: 10, bookedGuests: 10, heldGuests: 0, remaining: 0, blockedByHost: false } });

    const args = bulkAvailabilityArgsSchema.parse({ dates: [dateRange(0), dateRange(7)] });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.camps[0].cells).toEqual([
        { status: 'free', remaining: 8 },
        { status: 'full' },
      ]);
    }
  });

  it('[normal] a camp full for EVERY requested range stays PRESENT in the matrix (AC-2/EC-1)', async () => {
    mockFindMany.mockResolvedValueOnce([candidateRow('c1')]);
    mockGetRemainingCapacityForCamps.mockResolvedValue({
      c1: { capacity: 5, bookedGuests: 5, heldGuests: 0, remaining: 0, blockedByHost: false },
    });

    const args = bulkAvailabilityArgsSchema.parse({ dates: [dateRange(0), dateRange(7)] });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.camps).toHaveLength(1); // never dropped
      expect(result.camps[0].cells).toEqual([{ status: 'full' }, { status: 'full' }]);
    }
  });

  it('[normal] remaining < requested guests -> full (BR-5 numericallyFull projection)', async () => {
    mockFindMany.mockResolvedValueOnce([candidateRow('c1')]);
    mockGetRemainingCapacityForCamps.mockResolvedValueOnce({
      c1: { capacity: 10, bookedGuests: 8, heldGuests: 0, remaining: 2, blockedByHost: false },
    });

    const args = bulkAvailabilityArgsSchema.parse({ guests: 3, dates: [dateRange(0)] });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.camps[0].cells).toEqual([{ status: 'full' }]);
  });

  it('[normal] remaining === null (unbounded WHOLE-CAMP, not blocked) -> unknown', async () => {
    mockFindMany.mockResolvedValueOnce([candidateRow('c1')]);
    mockGetRemainingCapacityForCamps.mockResolvedValueOnce({
      c1: { capacity: null, bookedGuests: 0, heldGuests: 0, remaining: null, blockedByHost: false },
    });

    const args = bulkAvailabilityArgsSchema.parse({ dates: [dateRange(0)] });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.camps[0].cells).toEqual([{ status: 'unknown' }]);
  });

  it('[boundary/EC-6] a range that fail-opens (mocked {}) -> unknown for every camp on THAT range only, matrix continues', async () => {
    mockFindMany.mockResolvedValueOnce([candidateRow('c1')]);
    mockGetRemainingCapacityForCamps
      .mockResolvedValueOnce({}) // range 0 fail-opened (e.g. a degenerate range)
      .mockResolvedValueOnce({ c1: { capacity: 10, bookedGuests: 0, heldGuests: 0, remaining: 10, blockedByHost: false } });

    const args = bulkAvailabilityArgsSchema.parse({ dates: [dateRange(0), dateRange(7)] });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.camps[0].cells).toEqual([{ status: 'unknown' }, { status: 'free', remaining: 10 }]);
    }
  });

  it('[normal] ranges are echoed back verbatim, defining the column order (Decision 5, positional matrix)', async () => {
    mockFindMany.mockResolvedValueOnce([candidateRow('c1')]);
    mockGetRemainingCapacityForCamps.mockResolvedValue({});
    const dates = [dateRange(0), dateRange(7)];

    const args = bulkAvailabilityArgsSchema.parse({ dates });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ranges).toEqual(dates);
  });
});

describe('bulkAvailability — empty candidate set (AC-4/EC-2)', () => {
  it('[null/empty] filter matches no published camp -> no_match, NO availability call made at all', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = bulkAvailabilityArgsSchema.parse({ province: 'Nowhere', dates: [dateRange(0)] });
    const result = await executeBulkAvailability(args);

    expect(result).toEqual({ ok: false, reason: 'no_match' });
    expect(mockGetRemainingCapacityForCamps).not.toHaveBeenCalled();
  });
});

describe('bulkAvailability — visibility gate inherited (AC-6/EC-5, BR-4, CAM-469)', () => {
  it('[security] the candidate query where-clause carries the visibility gate (via the real buildCampSiteWhere, not a parallel query)', async () => {
    mockFindMany.mockResolvedValueOnce([candidateRow('c1')]);
    mockGetRemainingCapacityForCamps.mockResolvedValue({});

    const args = bulkAvailabilityArgsSchema.parse({ province: 'Chiang Mai', dates: [dateRange(0)] });
    await executeBulkAvailability(args);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true, isPublished: true, deletedAt: null }),
      })
    );
  });

  it('[security] the args schema (zod + jsonSchema) exposes NO campId/campSiteId/userId field (no ungated raw-id surface, Decision 3)', () => {
    const shape = bulkAvailabilityArgsSchema.shape;
    expect(shape).not.toHaveProperty('campId');
    expect(shape).not.toHaveProperty('campSiteId');
    expect(shape).not.toHaveProperty('userId');

    const jsonProps = bulkAvailabilityTool.jsonSchema.properties as Record<string, unknown>;
    expect(jsonProps).not.toHaveProperty('campId');
    expect(jsonProps).not.toHaveProperty('campSiteId');
    expect(jsonProps).not.toHaveProperty('userId');
  });
});

describe('bulkAvailability — no N+1 (Decision 4, perf)', () => {
  it('[perf] getRemainingCapacityForCamps is called exactly ONCE PER RANGE for a multi-camp x multi-range request, never per camp', async () => {
    mockFindMany.mockResolvedValueOnce([candidateRow('c1'), candidateRow('c2'), candidateRow('c3')]);
    mockGetRemainingCapacityForCamps.mockResolvedValue({});

    const dates = [dateRange(0), dateRange(7), dateRange(14)];
    const args = bulkAvailabilityArgsSchema.parse({ dates });
    await executeBulkAvailability(args);

    // O(rangeCount) = 3 calls total for 3 camps x 3 ranges — NEVER O(camps x ranges) = 9.
    expect(mockGetRemainingCapacityForCamps).toHaveBeenCalledTimes(dates.length);
    expect(mockGetRemainingCapacityForCamps).toHaveBeenNthCalledWith(1, ['c1', 'c2', 'c3'], expect.any(Date), expect.any(Date));
  });
});

describe('bulkAvailability — error honesty (EC-4/BR-6)', () => {
  it('[error] a thrown live read -> { ok:false, reason:error }, never a fabricated free/partial result', async () => {
    mockFindMany.mockResolvedValueOnce([candidateRow('c1')]);
    mockGetRemainingCapacityForCamps.mockRejectedValueOnce(new Error('db down'));

    const args = bulkAvailabilityArgsSchema.parse({ dates: [dateRange(0)] });
    const result = await executeBulkAvailability(args);

    expect(result).toEqual({ ok: false, reason: 'error' });
  });
});

describe('bulkAvailability — tool registration (BR-1)', () => {
  it('[normal] guest-tier, read-only, no identity required', () => {
    expect(bulkAvailabilityTool.name).toBe('bulkAvailability');
    expect(bulkAvailabilityTool.tier).toBe('guest');
  });
});
