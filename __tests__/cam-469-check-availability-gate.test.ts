/**
 * CAM-469 AC-1/AC-2/AC-3, BR-1/BR-2/BR-3, EC-1/EC-2 —
 * lib/ai/tools/check-availability.ts — the public-visibility gate.
 *
 * Coverage matrix:
 *   - normal: a public (isActive/isPublished/deletedAt:null) campSiteId →
 *     real numbers pass through unchanged (AC-1, regression guard)
 *   - null/empty: unpublished → NO_DATA_RESULT shape, no numbers leaked (AC-2)
 *   - null/empty: inactive → same shape (AC-2)
 *   - null/empty: soft-deleted → same shape (AC-2)
 *   - null/empty: nonexistent id → same shape as unpublished, no oracle (AC-3)
 *   - boundary: the visibility gate runs BEFORE getRemainingCapacity is ever
 *     called for a gated id (BR-1, no leaked call to the shared lib)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetRemainingCapacity = vi.fn();
const mockFindFirst = vi.fn();

vi.mock('@/lib/campsite-availability', async () => {
  const actual = await vi.importActual<typeof import('@/lib/campsite-availability')>(
    '@/lib/campsite-availability'
  );
  return {
    ...actual,
    getRemainingCapacity: (...args: unknown[]) => mockGetRemainingCapacity(...args),
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

const { executeCheckAvailability, checkAvailabilityArgsSchema } = await import(
  '@/lib/ai/tools/check-availability'
);

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const NONEXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

const NO_DATA_RESULT = {
  ok: true as const,
  capacity: null,
  bookedGuests: 0,
  heldGuests: 0,
  remaining: null,
  blockedByHost: false,
};

function args(campSiteId: string) {
  return checkAvailabilityArgsSchema.parse({
    campSiteId,
    startDate: '2026-08-01',
    endDate: '2026-08-03',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkAvailability — public-visibility gate (normal, AC-1)', () => {
  it('[unit] a published+active+not-deleted campSiteId returns the real numbers unchanged', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: VALID_UUID }); // gate passes
    mockGetRemainingCapacity.mockResolvedValueOnce({
      capacity: 20,
      bookedGuests: 5,
      heldGuests: 2,
      remaining: 13,
      blockedByHost: false,
    });

    const result = await executeCheckAvailability(args(VALID_UUID));

    expect(result).toEqual({
      ok: true,
      capacity: 20,
      bookedGuests: 5,
      heldGuests: 2,
      remaining: 13,
      blockedByHost: false,
    });
    // gate query uses the same predicate getCampDetail uses (BR-2)
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: VALID_UUID, isActive: true, isPublished: true, deletedAt: null },
      select: { id: true },
    });
    expect(mockGetRemainingCapacity).toHaveBeenCalledOnce();
  });
});

describe('checkAvailability — public-visibility gate (null/empty, AC-2)', () => {
  it('[unit] an unpublished campSiteId returns the no-data shape, no numbers leaked', async () => {
    mockFindFirst.mockResolvedValueOnce(null); // findFirst filters isPublished:true → no row
    const result = await executeCheckAvailability(args(VALID_UUID));

    expect(result).toEqual(NO_DATA_RESULT);
    expect(mockGetRemainingCapacity).not.toHaveBeenCalled(); // BR-1: never reaches the shared lib
  });

  it('[unit] an inactive campSiteId returns the same no-data shape', async () => {
    mockFindFirst.mockResolvedValueOnce(null); // findFirst filters isActive:true → no row
    const result = await executeCheckAvailability(args(VALID_UUID));

    expect(result).toEqual(NO_DATA_RESULT);
    expect(mockGetRemainingCapacity).not.toHaveBeenCalled();
  });

  it('[unit] a soft-deleted campSiteId returns the same no-data shape', async () => {
    mockFindFirst.mockResolvedValueOnce(null); // findFirst filters deletedAt:null → no row
    const result = await executeCheckAvailability(args(VALID_UUID));

    expect(result).toEqual(NO_DATA_RESULT);
    expect(mockGetRemainingCapacity).not.toHaveBeenCalled();
  });
});

describe('checkAvailability — no existence oracle (AC-3)', () => {
  it('[unit] a syntactically-valid but nonexistent campSiteId returns the SAME shape as unpublished', async () => {
    mockFindFirst.mockResolvedValueOnce(null); // no row at all
    const result = await executeCheckAvailability(args(NONEXISTENT_UUID));

    expect(result).toEqual(NO_DATA_RESULT);
    expect(mockGetRemainingCapacity).not.toHaveBeenCalled();
  });
});
