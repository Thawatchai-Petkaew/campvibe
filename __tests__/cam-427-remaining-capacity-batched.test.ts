/**
 * cam-427-remaining-capacity-batched.test.ts — CAM-427 (Part 2: live "เหลือ N
 * ที่" for the AI assistant card, batched — never a per-card
 * getRemainingCapacity loop).
 *
 * `getRemainingCapacityForCamps` shares the exact batched core
 * (`computeBatchedNightlyOccupancy`) that `getAvailabilityStatusForCamps`
 * already ships and is regression-tested by — see
 * __tests__/cam-344-availability-badge.test.ts (kept green unmodified by
 * this refactor). This file covers ONLY the new numeric sibling.
 *
 * Coverage matrix:
 *   - normal: an open camp (no bookings/blocks) → remaining = capacity
 *   - normal: a partially booked camp → remaining = capacity - occupied
 *   - boundary: a fully booked night → remaining = 0
 *   - boundary: a host BlockedDate → remaining forced to 0 regardless of capacity
 *   - null/empty: capacity null (unbounded WHOLE-CAMP) → remaining null
 *   - null/empty: empty campIds / invalid range → {} (no query at all)
 *   - error/validation: a range wider than MAX_STATUS_RANGE_NIGHTS → {} (DoS guard)
 *   - normal: an unknown/not-found campId is omitted from the result map
 *   - perf/N+1 guard: ONE call to campSite/booking/blockedDate/internalHold/spot
 *     findMany for a page of MULTIPLE camps (never one round trip per camp)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: { findMany: vi.fn() },
    booking: { findMany: vi.fn() },
    blockedDate: { findMany: vi.fn() },
    internalHold: { findMany: vi.fn() },
    spot: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { getRemainingCapacityForCamps, MAX_STATUS_RANGE_NIGHTS } from '@/lib/campsite-availability';

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

const CAMP_A = 'aaaaaaaa-0000-4000-8000-000000000427';
const CAMP_B = 'aaaaaaaa-0000-4000-8000-000000000428';

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

describe('getRemainingCapacityForCamps — normal', () => {
  it('[normal] an open camp (no bookings) → remaining equals the full capacity', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: CAMP_A, useSpotView: false, maxGuestsPerDay: 20 },
    ]);

    const result = await getRemainingCapacityForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'));

    expect(result[CAMP_A]).toEqual({
      capacity: 20,
      bookedGuests: 0,
      heldGuests: 0,
      remaining: 20,
      blockedByHost: false,
    });
  });

  it('[normal] a partially booked camp → remaining = capacity - occupied', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: CAMP_A, useSpotView: false, maxGuestsPerDay: 20 },
    ]);
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { campSiteId: CAMP_A, checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 6 },
    ]);

    const result = await getRemainingCapacityForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'));
    expect(result[CAMP_A].remaining).toBe(14);
  });
});

describe('getRemainingCapacityForCamps — boundary', () => {
  it('[boundary] a fully booked night → remaining floors at 0 (never negative)', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: CAMP_A, useSpotView: false, maxGuestsPerDay: 4 },
    ]);
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { campSiteId: CAMP_A, checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 10 },
    ]);

    const result = await getRemainingCapacityForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'));
    expect(result[CAMP_A].remaining).toBe(0);
  });

  it('[boundary] a whole-camp BlockedDate forces remaining to 0 regardless of numeric headroom', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: CAMP_A, useSpotView: false, maxGuestsPerDay: 20 },
    ]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { campSiteId: CAMP_A, startDate: d('2026-09-10'), endDate: d('2026-09-10') },
    ]);

    const result = await getRemainingCapacityForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'));
    expect(result[CAMP_A]).toMatchObject({ blockedByHost: true, remaining: 0 });
  });
});

describe('getRemainingCapacityForCamps — null/empty', () => {
  it('[null/empty] capacity null (unbounded WHOLE-CAMP) → remaining null, never fabricated as 0 or Infinity', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: CAMP_A, useSpotView: false, maxGuestsPerDay: null },
    ]);

    const result = await getRemainingCapacityForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'));
    expect(result[CAMP_A].remaining).toBeNull();
  });

  it('[null/empty] empty campIds → {} immediately, no Prisma call at all', async () => {
    const result = await getRemainingCapacityForCamps([], d('2026-09-10'), d('2026-09-11'));
    expect(result).toEqual({});
    expect(prisma.campSite.findMany).not.toHaveBeenCalled();
  });

  it('[null/empty] an inverted/zero-night range → {}, no query', async () => {
    const result = await getRemainingCapacityForCamps([CAMP_A], d('2026-09-11'), d('2026-09-10'));
    expect(result).toEqual({});
    expect(prisma.campSite.findMany).not.toHaveBeenCalled();
  });

  it('[normal] a requested campId Prisma never returns (not found/deleted) is omitted from the result map', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]); // CAMP_A not found
    const result = await getRemainingCapacityForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'));
    expect(result).toEqual({});
  });
});

describe('getRemainingCapacityForCamps — error/validation (DoS guard)', () => {
  it('[error] a range wider than MAX_STATUS_RANGE_NIGHTS → {} immediately, no query, no loop', async () => {
    const start = d('2026-01-01');
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + MAX_STATUS_RANGE_NIGHTS + 10);

    const result = await getRemainingCapacityForCamps([CAMP_A], start, end);
    expect(result).toEqual({});
    expect(prisma.campSite.findMany).not.toHaveBeenCalled();
  });

  it('[error] a non-finite (Invalid Date) input → {}, never throws', async () => {
    const result = await getRemainingCapacityForCamps([CAMP_A], new Date('not-a-date'), d('2026-09-11'));
    expect(result).toEqual({});
  });
});

describe('getRemainingCapacityForCamps — perf/N+1 guard (BR-5)', () => {
  it('[perf] a page of MULTIPLE camps costs exactly ONE call per model — never one round trip per camp', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: CAMP_A, useSpotView: false, maxGuestsPerDay: 20 },
      { id: CAMP_B, useSpotView: false, maxGuestsPerDay: 10 },
    ]);

    const result = await getRemainingCapacityForCamps([CAMP_A, CAMP_B], d('2026-09-10'), d('2026-09-13'));

    expect(prisma.campSite.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.booking.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.blockedDate.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.internalHold.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.spot.findMany).toHaveBeenCalledTimes(1);
    expect(Object.keys(result)).toHaveLength(2);
  });
});
