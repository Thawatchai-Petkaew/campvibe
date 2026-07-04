/**
 * cam-303-cross-source-parity.test.ts — CAM-303 (spec-lite) test-only regression
 * guard proving getCampSiteDailyAvailability / getRemainingCapacity return correct
 * combined numbers when Booking + BlockedDate + InternalHold ALL apply to the same
 * range — the interaction CAM-302's own suite left unguarded (it mocks
 * blockedDate.findMany empty in every case).
 *
 * AC -> test matrix
 * ---------------------------------------------------------------------------
 * AC-1  mixed range: open day (booking+hold) + a separate blocked day -> both
 *       functions derive the same numbers from the same three-source fixture
 *       (BR-2, BR-3 parity).
 * AC-2  Booking=2 + Hold=3 (combined 5, capacity 10) + whole-camp BlockedDate ->
 *       blocked wins; remaining forced to 0, never the numeric partial 5 (BR-1).
 * AC-3  Booking=2 + Hold=3, capacity 5, no block -> remaining 0, derived from
 *       booking + hold together in ONE getRemainingCapacity call (boundary: exactly
 *       at capacity, not over).
 * AC-4  30-day range, all three sources non-empty -> exactly 1 booking + 1
 *       blockedDate + 1 internalHold query for the whole range (no N+1).
 * BR-1  a whole-camp BlockedDate always forces "fully unavailable" over any
 *       numeric booked+held total.
 * BR-2  at least one test below populates ALL THREE mock legs simultaneously on
 *       the same fixture range (the gap CAM-302's suite left).
 * BR-3  getCampSiteDailyAvailability and getRemainingCapacity must agree on the
 *       same night from the same fixture (cross-checked directly, not re-derived).
 * ---------------------------------------------------------------------------
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: { findMany: vi.fn() },
    blockedDate: { findMany: vi.fn() },
    internalHold: { findMany: vi.fn() },
    campSite: { findUnique: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { getCampSiteDailyAvailability, getRemainingCapacity } from '@/lib/campsite-availability';

const CAMPSITE_ID = '550e8400-e29b-41d4-a716-446655440303';

/** Build a Date at midnight UTC from an ISO date string */
function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

type Mock = ReturnType<typeof vi.fn>;

/** Populate all three source legs (+ optional capacity) in one call — the BR-2 fixture shape. */
function mockThreeSources(opts: {
  bookings?: { checkInDate: Date; checkOutDate: Date; guests: number }[];
  blocked?: { startDate: Date; endDate: Date }[];
  holds?: { startDate: Date; endDate: Date; guests: number }[];
  capacity?: number | null;
}) {
  (prisma.booking.findMany as Mock).mockResolvedValue(opts.bookings ?? []);
  (prisma.blockedDate.findMany as Mock).mockResolvedValue(opts.blocked ?? []);
  (prisma.internalHold.findMany as Mock).mockResolvedValue(opts.holds ?? []);
  if (opts.capacity !== undefined) {
    (prisma.campSite.findUnique as Mock).mockResolvedValue({ maxGuestsPerDay: opts.capacity });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AC-1 + BR-2 + BR-3 — mixed range: booking + hold + blockedDate populated together', () => {
  // Open night 10-01: Booking=2 + Hold=1 (combined 3). Blocked day 10-03: whole-camp
  // block, no booking/hold at all that day — proves the block wins on its own.
  beforeEach(() => {
    mockThreeSources({
      bookings: [{ checkInDate: d('2026-10-01'), checkOutDate: d('2026-10-02'), guests: 2 }],
      holds: [{ startDate: d('2026-10-01'), endDate: d('2026-10-02'), guests: 1 }],
      blocked: [{ startDate: d('2026-10-03'), endDate: d('2026-10-03') }],
      capacity: 5,
    });
  });

  it('[ac1] the open day sums booking+hold; the blocked day is flagged, from ONE three-source call', async () => {
    const daily = await getCampSiteDailyAvailability(CAMPSITE_ID, d('2026-10-01'), d('2026-10-04'));

    expect(daily['2026-10-01'].bookedGuests).toBe(2);
    expect(daily['2026-10-01'].heldGuests).toBe(1);
    expect(daily['2026-10-01'].blockedByHost).toBe(false);
    // "เหลือ {n} ที่" -> n = capacity(5) - combined(3) = 2
    expect(5 - (daily['2026-10-01'].bookedGuests + daily['2026-10-01'].heldGuests)).toBe(2);

    expect(daily['2026-10-03'].blockedByHost).toBe(true); // "เต็มแล้ว" regardless of its own 0 usage
  });

  it('[br3] getRemainingCapacity agrees with the daily map on the open night (parity)', async () => {
    const daily = await getCampSiteDailyAvailability(CAMPSITE_ID, d('2026-10-01'), d('2026-10-04'));
    const remaining = await getRemainingCapacity(CAMPSITE_ID, d('2026-10-01'), d('2026-10-02'));

    expect(remaining.bookedGuests).toBe(daily['2026-10-01'].bookedGuests);
    expect(remaining.heldGuests).toBe(daily['2026-10-01'].heldGuests);
    expect(remaining.remaining).toBe(5 - (daily['2026-10-01'].bookedGuests + daily['2026-10-01'].heldGuests));
  });

  it('[br3] getRemainingCapacity agrees with the daily map on the blocked night (parity)', async () => {
    const daily = await getCampSiteDailyAvailability(CAMPSITE_ID, d('2026-10-01'), d('2026-10-04'));
    const remaining = await getRemainingCapacity(CAMPSITE_ID, d('2026-10-03'), d('2026-10-04'));

    expect(daily['2026-10-03'].blockedByHost).toBe(true);
    expect(remaining.blockedByHost).toBe(true);
    expect(remaining.remaining).toBe(0);
  });
});

describe('AC-2 — blocked wins over a non-empty combined total, never a numeric partial (BR-1)', () => {
  it('[ac2] Booking=2 + Hold=3 (combined 5, capacity 10) + a whole-camp block -> remaining forced to 0, not the partial 5', async () => {
    mockThreeSources({
      bookings: [{ checkInDate: d('2026-11-01'), checkOutDate: d('2026-11-02'), guests: 2 }],
      holds: [{ startDate: d('2026-11-01'), endDate: d('2026-11-02'), guests: 3 }],
      blocked: [{ startDate: d('2026-11-01'), endDate: d('2026-11-01') }],
      capacity: 10,
    });

    const result = await getRemainingCapacity(CAMPSITE_ID, d('2026-11-01'), d('2026-11-02'));

    expect(result.blockedByHost).toBe(true);
    expect(result.remaining).toBe(0); // NOT 10 - 5 = 5
  });
});

describe('AC-3 — Booking + Hold exactly fill capacity with no block (boundary)', () => {
  it('[ac3] Booking=2 + Hold=3, capacity 5, no block -> remaining 0 from ONE call', async () => {
    mockThreeSources({
      bookings: [{ checkInDate: d('2026-12-01'), checkOutDate: d('2026-12-02'), guests: 2 }],
      holds: [{ startDate: d('2026-12-01'), endDate: d('2026-12-02'), guests: 3 }],
      blocked: [],
      capacity: 5,
    });

    const result = await getRemainingCapacity(CAMPSITE_ID, d('2026-12-01'), d('2026-12-02'));

    expect(result.blockedByHost).toBe(false);
    expect(result.bookedGuests).toBe(2);
    expect(result.heldGuests).toBe(3);
    expect(result.remaining).toBe(0);
  });
});

describe('AC-4 — no N+1 across all three sources for a 30-day range', () => {
  it('[no-n+1] exactly 1 booking + 1 blockedDate + 1 internalHold query for the whole 30-day range', async () => {
    mockThreeSources({
      bookings: [{ checkInDate: d('2027-01-05'), checkOutDate: d('2027-01-07'), guests: 2 }],
      holds: [{ startDate: d('2027-01-10'), endDate: d('2027-01-11'), guests: 1 }],
      blocked: [{ startDate: d('2027-01-20'), endDate: d('2027-01-21') }],
    });

    await getCampSiteDailyAvailability(CAMPSITE_ID, d('2027-01-01'), d('2027-01-30'));

    expect(prisma.booking.findMany).toHaveBeenCalledOnce();
    expect(prisma.blockedDate.findMany).toHaveBeenCalledOnce();
    expect(prisma.internalHold.findMany).toHaveBeenCalledOnce();
  });
});
