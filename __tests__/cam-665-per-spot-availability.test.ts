/**
 * cam-665-per-spot-availability.test.ts — CAM-665
 *
 * "Is THIS pitch free on these dates" — no reader in the codebase could
 * answer that before this story: getEffectiveCapacity sums all live spots
 * into one camp scalar, getCampSiteDailyAvailability/getActiveHoldsForRange
 * never filtered by spot, getRemainingCapacity/checkDateAvailabilityInTx take
 * no spotId. The ONE place per-spot exclusivity existed was a parallel query
 * inline in app/api/bookings/route.ts (ADR-012 §4 forbids exactly this fork —
 * CAM-190/CAM-267/CAM-400 all shipped from this failure class). This suite
 * proves the new spot-level reader (lib/campsite-availability.ts
 * getSpotDailyAvailability + isSpotBookedForStay), the GET route's new
 * `spotId` query param, the write gate's delegation, AND that no camp-level
 * number moved.
 *
 * Convention: mocked `@/lib/prisma` (no real DB) — mirrors
 * cam-355-per-spot-capacity-enforcement.test.ts / cam-400-capacity-
 * invariant.test.ts, the established convention for this exact seam.
 *
 * AC → test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-1  pitch with an overlapping non-cancelled booking on that spotId -> not
 *       free (Group A).
 * AC-2  pitch with a host BlockedDate on that date -> not free (Group A,
 *       reuses getBlockedDatesForRange verbatim — no new predicate).
 * AC-3  pitch with an ACTIVE InternalHold -> per this story's stated decision
 *       (spot-specific OR whole-camp hold both occupy the pitch, symmetric
 *       with BlockedDate) -> not free (Group A + a direct
 *       getActiveHoldsForRange unit proving the OR-shape + the unchanged
 *       no-spotId default).
 * AC-4  pitch with none of the above -> free (Group A).
 * AC-5  the write gate (app/api/bookings/route.ts Check 1) now delegates to
 *       isSpotBookedForStay instead of its own inline query — same external
 *       behavior (409/201), proven both behaviorally (Group D) and by source
 *       inspection (Group D, Prove-It).
 * AC-6  GET /api/campsites/[id]/availability?spotId=... states which filter
 *       was actually applied (`spotId` echoed, per-day `spotAvailable`
 *       null when not requested) — CAM-595/602 (Group C).
 * AC-7  unknown/invalid spotId -> 400, never a silent drop (Group C).
 * AC-8  REGRESSION (load-bearing): a camp NOT queried by spotId is
 *       byte-identical to before this story — hard-coded golden numbers, not
 *       recomputed from the same formula (Group E).
 * AC-9  cross-layer invariant (architecture.md §15b): GET's `available`
 *       (capacity) and `spotAvailable` (pitch) are independent signals that
 *       both agree with what POST /api/bookings actually does — walked
 *       across {spot occupied, capacity full} x {GET route, POST route}
 *       (Group F).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

type MockFn = ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports (mirrors cam-355/cam-400's
// established convention for this exact seam).
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    campSite: { findUnique: vi.fn(), findMany: vi.fn() },
    booking: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    blockedDate: { findMany: vi.fn(), findFirst: vi.fn() },
    internalHold: { findMany: vi.fn() },
    spot: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/auth-utils', () => ({ requireAuth: vi.fn() }));

// CAM-651: the booking route calls buildBookingPriceArgs (not resolveUnitPrice).
vi.mock('@/lib/booking-pricing', () => ({
  buildBookingPriceArgs: vi.fn(() => ({
    ok: true,
    input: { unitPrice: 500, unit: 'PER_SITE', quantity: 1, nights: 1, vatRate: 0 },
  })),
  computeBookingPrice: vi.fn(() => ({
    unitAmount: 500,
    subtotalAmount: 500,
    taxAmount: 0,
    vatInclusive: false,
    extraFeeAmount: 0,
    totalAmount: 500,
  })),
}));
vi.mock('@/lib/serialize', () => ({ serializeDecimals: vi.fn((x) => x) }));

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import {
  getSpotDailyAvailability,
  isSpotBookedForStay,
  getActiveHoldsForRange,
  getCampSiteDailyAvailability,
  getRemainingCapacity,
  getAvailabilityStatusForCamps,
  checkDateAvailabilityInTx,
  AvailabilityRangeTooWideError,
  MAX_STATUS_RANGE_NIGHTS,
} from '@/lib/campsite-availability';

const { GET: availabilityGET } = await import('@/app/api/campsites/[id]/availability/route');
const { POST: bookingsPOST } = await import('@/app/api/bookings/route');

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const CAMP_ID = 'aaaaaaaa-0000-4000-8000-000000000665';
const SPOT_ID = 'aaaaaaaa-0000-4000-8000-000000000666';
const OTHER_SPOT_ID = 'aaaaaaaa-0000-4000-8000-000000000667';

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

const NIGHT_ISO = '2026-11-10';
const CHECKOUT_ISO = '2026-11-11';
const NIGHT = d(NIGHT_ISO);
const CHECKOUT = d(CHECKOUT_ISO);

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function makeAvailabilityRequest(spotId?: string, campId = CAMP_ID): NextRequest {
  const qs = new URLSearchParams({ startDate: NIGHT_ISO, endDate: NIGHT_ISO });
  if (spotId !== undefined) qs.set('spotId', spotId);
  return new NextRequest(`http://localhost/api/campsites/${campId}/availability?${qs.toString()}`);
}

function makePublicCampSiteRow(opts: { useSpotView?: boolean; maxGuestsPerDay?: number | null } = {}) {
  return {
    isActive: true,
    isPublished: true,
    deletedAt: null,
    operatorId: 'operator-665',
    useSpotView: opts.useSpotView ?? false,
    maxGuestsPerDay: opts.maxGuestsPerDay ?? null,
    maxTentsPerDay: null,
  };
}

function makeBookingPostRequest(opts: {
  spotId?: string;
  guests?: number;
  checkInDate?: string;
  checkOutDate?: string;
}): NextRequest {
  return new NextRequest('http://localhost/api/bookings', {
    method: 'POST',
    body: JSON.stringify({
      campSiteId: CAMP_ID,
      spotId: opts.spotId,
      checkInDate: opts.checkInDate ?? NIGHT_ISO,
      checkOutDate: opts.checkOutDate ?? CHECKOUT_ISO,
      guests: opts.guests ?? 1,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeCampSiteRecordForPricing(capacity: number | null) {
  return {
    id: CAMP_ID,
    useSpotView: false,
    nameTh: 'แคมป์ทดสอบ CAM-665',
    nameEn: 'CAM-665 Test Camp',
    priceLow: 500,
    priceCurrency: 'THB',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    maxGuestsPerDay: capacity,
    maxTentsPerDay: null,
    extraFeeAmount: null,
    spots: [],
    location: { countryRel: { vatRate: 0, timezone: 'Asia/Bangkok' } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (requireAuth as MockFn).mockResolvedValue({
    error: null,
    session: { user: { id: 'aaaaaaaa-0000-4000-8000-0000006650ff', email: 'camper@campvibe.com', name: 'Camper' } },
  });
});

// ===========================================================================
// Group A — getSpotDailyAvailability (unit, AC-1/AC-2/AC-3/AC-4)
// ===========================================================================

describe('getSpotDailyAvailability — a pitch is a SLOT, not a capacity bucket', () => {
  beforeEach(() => {
    (prisma.booking.findMany as MockFn).mockResolvedValue([]);
    (prisma.blockedDate.findMany as MockFn).mockResolvedValue([]);
    (prisma.internalHold.findMany as MockFn).mockResolvedValue([]);
  });

  it('[unit][normal][ac-4] none of booking/block/hold -> the pitch is free', async () => {
    const result = await getSpotDailyAvailability(CAMP_ID, SPOT_ID, NIGHT, NIGHT);

    expect(result[NIGHT_ISO]).toEqual({
      bookedByGuest: false,
      blockedByHost: false,
      held: false,
      available: true,
    });
  });

  it('[unit][normal][ac-1] an overlapping non-cancelled booking on THIS spotId -> not free', async () => {
    (prisma.booking.findMany as MockFn).mockResolvedValue([
      { checkInDate: NIGHT, checkOutDate: CHECKOUT },
    ]);

    const result = await getSpotDailyAvailability(CAMP_ID, SPOT_ID, NIGHT, NIGHT);

    expect(result[NIGHT_ISO].bookedByGuest).toBe(true);
    expect(result[NIGHT_ISO].available).toBe(false);
    // The scoping + non-cancelled predicate actually sent to Prisma:
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campSiteId: CAMP_ID,
          spotId: SPOT_ID,
          status: { not: 'CANCELLED' },
        }),
      })
    );
  });

  it('[unit][boundary][ac-1] a booking whose checkOutDate equals the queried day does NOT occupy that day (checkout-day turnover, half-open convention preserved)', async () => {
    (prisma.booking.findMany as MockFn).mockResolvedValue([
      { checkInDate: d('2026-11-08'), checkOutDate: NIGHT }, // checks out exactly on NIGHT
    ]);

    const result = await getSpotDailyAvailability(CAMP_ID, SPOT_ID, NIGHT, NIGHT);

    expect(result[NIGHT_ISO].bookedByGuest).toBe(false);
    expect(result[NIGHT_ISO].available).toBe(true);
  });

  it('[unit][normal][ac-2] a BlockedDate on THIS spot -> not free (getBlockedDatesForRange reused verbatim, spotId forwarded)', async () => {
    (prisma.blockedDate.findMany as MockFn).mockResolvedValue([
      { startDate: NIGHT, endDate: NIGHT },
    ]);

    const result = await getSpotDailyAvailability(CAMP_ID, SPOT_ID, NIGHT, NIGHT);

    expect(result[NIGHT_ISO].blockedByHost).toBe(true);
    expect(result[NIGHT_ISO].available).toBe(false);
    expect(prisma.blockedDate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campSiteId: CAMP_ID,
          OR: [{ spotId: null }, { spotId: SPOT_ID }],
        }),
      })
    );
  });

  it('[unit][normal][ac-3] an ACTIVE, non-expired InternalHold -> not free (this story\'s decision)', async () => {
    (prisma.internalHold.findMany as MockFn).mockResolvedValue([
      { startDate: NIGHT, endDate: CHECKOUT, guests: 1 },
    ]);

    const result = await getSpotDailyAvailability(CAMP_ID, SPOT_ID, NIGHT, NIGHT);

    expect(result[NIGHT_ISO].held).toBe(true);
    expect(result[NIGHT_ISO].available).toBe(false);
    expect(prisma.internalHold.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ spotId: null }, { spotId: SPOT_ID }],
        }),
      })
    );
  });

  it('[unit][error/validation][ac-8-parity] a range wider than MAX_STATUS_RANGE_NIGHTS throws BEFORE any Prisma call (same guard, reused)', async () => {
    const end = new Date(NIGHT);
    end.setUTCDate(end.getUTCDate() + MAX_STATUS_RANGE_NIGHTS); // inclusive span = MAX+1

    await expect(getSpotDailyAvailability(CAMP_ID, SPOT_ID, NIGHT, end)).rejects.toThrow(
      AvailabilityRangeTooWideError
    );
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(prisma.blockedDate.findMany).not.toHaveBeenCalled();
    expect(prisma.internalHold.findMany).not.toHaveBeenCalled();
  });

  it('[unit][normal] the booking query is scoped to the REQUESTED spotId, not any other spot on the same camp', async () => {
    await getSpotDailyAvailability(CAMP_ID, OTHER_SPOT_ID, NIGHT, NIGHT);

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ spotId: OTHER_SPOT_ID }) })
    );
  });
});

// ===========================================================================
// Group A2 — getActiveHoldsForRange spotId decision, at its own source
// (AC-3, plus the "camp-level unchanged by default" half of the invariant)
// ===========================================================================

describe('getActiveHoldsForRange — spotId is optional and additive (CAM-665)', () => {
  beforeEach(() => {
    (prisma.internalHold.findMany as MockFn).mockResolvedValue([]);
  });

  it('[unit][normal] called with NO spotId -> the where clause carries NO spotId/OR predicate at all (byte-identical to pre-CAM-665)', async () => {
    await getActiveHoldsForRange(CAMP_ID, NIGHT, CHECKOUT);

    const call = (prisma.internalHold.findMany as MockFn).mock.calls[0][0];
    expect(call.where).not.toHaveProperty('OR');
    expect(call.where).not.toHaveProperty('spotId');
  });

  it('[unit][normal] called WITH spotId -> the where clause narrows to spotId:null OR spotId:<that spot>', async () => {
    await getActiveHoldsForRange(CAMP_ID, NIGHT, CHECKOUT, SPOT_ID);

    const call = (prisma.internalHold.findMany as MockFn).mock.calls[0][0];
    expect(call.where.OR).toEqual([{ spotId: null }, { spotId: SPOT_ID }]);
  });
});

// ===========================================================================
// Group B — isSpotBookedForStay (unit, AC-5 — the moved write-gate predicate)
// ===========================================================================

describe('isSpotBookedForStay — the EXACT predicate the write gate used inline before this story', () => {
  it('[unit][normal] an overlapping non-cancelled booking on this spot -> true', async () => {
    (prisma.booking.findFirst as MockFn).mockResolvedValue({ id: 'existing' });

    const result = await isSpotBookedForStay(prisma as never, CAMP_ID, SPOT_ID, NIGHT, CHECKOUT);

    expect(result).toBe(true);
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campSiteId: CAMP_ID,
          spotId: SPOT_ID,
          status: { not: 'CANCELLED' },
          AND: [{ checkInDate: { lt: CHECKOUT } }, { checkOutDate: { gt: NIGHT } }],
        }),
      })
    );
  });

  it('[unit][normal] no overlap -> false', async () => {
    (prisma.booking.findFirst as MockFn).mockResolvedValue(null);

    const result = await isSpotBookedForStay(prisma as never, CAMP_ID, SPOT_ID, NIGHT, CHECKOUT);

    expect(result).toBe(false);
  });

  it('[unit][boundary] a same-day checkout/check-in turnover is NOT a conflict (half-open lt/gt preserved)', async () => {
    // Simulates the real predicate: an existing booking checking out exactly
    // when the new stay checks in never reaches this function as an overlap
    // row in production (Prisma applies checkInDate<checkOut && checkOutDate
    // >checkIn) — asserted here via the exact args sent, matching the
    // original inline query byte-for-byte.
    (prisma.booking.findFirst as MockFn).mockResolvedValue(null);
    const checkIn = CHECKOUT; // new stay starts exactly when the old one ends
    const checkOut = d('2026-11-12');

    const result = await isSpotBookedForStay(prisma as never, CAMP_ID, SPOT_ID, checkIn, checkOut);

    expect(result).toBe(false);
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ checkInDate: { lt: checkOut } }, { checkOutDate: { gt: checkIn } }],
        }),
      })
    );
  });

  it('[unit][normal] works against a transaction client too (write-gate call shape)', async () => {
    const tx = { booking: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as Prisma.TransactionClient;

    const result = await isSpotBookedForStay(tx, CAMP_ID, SPOT_ID, NIGHT, CHECKOUT);

    expect(result).toBe(false);
    expect(tx.booking.findFirst).toHaveBeenCalledOnce();
  });
});

// ===========================================================================
// Group C — GET /api/campsites/[id]/availability?spotId=... (integration)
// ===========================================================================

describe('GET /api/campsites/[id]/availability — spotId contract (AC-6/AC-7)', () => {
  beforeEach(() => {
    (prisma.blockedDate.findMany as MockFn).mockResolvedValue([]);
    (prisma.internalHold.findMany as MockFn).mockResolvedValue([]);
  });

  it('[integration][error/validation][ac-7] a malformed spotId (not a uuid) -> 400, no DB spot lookup', async () => {
    (prisma.campSite.findUnique as MockFn).mockResolvedValue(makePublicCampSiteRow());
    (prisma.booking.findMany as MockFn).mockResolvedValue([]);

    const res = await availabilityGET(makeAvailabilityRequest('not-a-uuid'), makeParams(CAMP_ID));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid spotId parameter');
    expect(prisma.spot.findFirst).not.toHaveBeenCalled();
  });

  it('[integration][error/validation][ac-7] a well-formed but unknown/cross-camp spotId -> 400, never a silent drop', async () => {
    (prisma.campSite.findUnique as MockFn).mockResolvedValue(makePublicCampSiteRow());
    (prisma.spot.findFirst as MockFn).mockResolvedValue(null); // not found for THIS camp
    (prisma.booking.findMany as MockFn).mockResolvedValue([]);

    const res = await availabilityGET(makeAvailabilityRequest(SPOT_ID), makeParams(CAMP_ID));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid spotId parameter');
    expect(prisma.spot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: SPOT_ID, campSiteId: CAMP_ID, deletedAt: null } })
    );
  });

  it('[integration][normal][ac-6] a valid spotId is echoed back + folded into per-day spotAvailable', async () => {
    (prisma.campSite.findUnique as MockFn).mockResolvedValue(makePublicCampSiteRow({ maxGuestsPerDay: 10 }));
    (prisma.spot.findFirst as MockFn).mockResolvedValue({ id: SPOT_ID });
    (prisma.booking.findMany as MockFn).mockImplementation((args: { where?: { spotId?: string } }) => {
      if (args?.where?.spotId) {
        return Promise.resolve([{ checkInDate: NIGHT, checkOutDate: CHECKOUT }]); // this pitch is booked
      }
      return Promise.resolve([]); // camp-level: nobody else booked -> plenty of capacity room
    });

    const res = await availabilityGET(makeAvailabilityRequest(SPOT_ID), makeParams(CAMP_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.spotId).toBe(SPOT_ID);
    const day = body.availability.find((a: { date: string }) => a.date === NIGHT_ISO);
    expect(day.spotAvailable).toBe(false); // this exact pitch is occupied
    expect(day.available).toBe(true); // capacity-wise the camp still has room — independent signal
  });

  it('[integration][normal][ac-6] NO spotId -> spotAvailable is null on every day, spotId is null (filter not applied)', async () => {
    (prisma.campSite.findUnique as MockFn).mockResolvedValue(makePublicCampSiteRow({ maxGuestsPerDay: 10 }));
    (prisma.booking.findMany as MockFn).mockResolvedValue([]);

    const res = await availabilityGET(makeAvailabilityRequest(), makeParams(CAMP_ID));
    const body = await res.json();

    expect(body.spotId).toBeNull();
    const day = body.availability.find((a: { date: string }) => a.date === NIGHT_ISO);
    expect(day.spotAvailable).toBeNull();
    expect(prisma.spot.findFirst).not.toHaveBeenCalled();
  });

  it('[integration][error/validation] camp not found -> 404, unaffected by a spotId param being present', async () => {
    (prisma.campSite.findUnique as MockFn).mockResolvedValue(null);

    const res = await availabilityGET(makeAvailabilityRequest(SPOT_ID), makeParams(CAMP_ID));

    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// Group D — POST /api/bookings write-gate delegation (AC-5)
// ===========================================================================

describe('POST /api/bookings — Check 1 now delegates to isSpotBookedForStay (AC-5)', () => {
  function wireTransaction(tx: unknown) {
    (prisma.$transaction as MockFn).mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));
  }

  it('[integration][normal][regression] an overlapping non-cancelled booking on the requested spot -> 409 "Dates not available", no row created (unchanged external contract)', async () => {
    const create = vi.fn();
    const tx = {
      booking: {
        findFirst: vi.fn().mockResolvedValue({ id: 'existing' }),
        findMany: vi.fn().mockResolvedValue([]),
        create,
      },
      campSite: { findUnique: vi.fn().mockResolvedValue(makeCampSiteRecordForPricing(null)) },
      blockedDate: { findFirst: vi.fn().mockResolvedValue(null) },
      internalHold: { findMany: vi.fn().mockResolvedValue([]) },
      spot: { findMany: vi.fn().mockResolvedValue([]) },
    };
    wireTransaction(tx);

    const res = await bookingsPOST(makeBookingPostRequest({ spotId: SPOT_ID }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('Dates not available');
    expect(body.details).toBe('Selected dates overlap with an existing booking.');
    expect(create).not.toHaveBeenCalled();
  });

  it('[integration][normal][regression] no overlap -> 201, booking created (unaffected by the delegation)', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'booking-665-ok', status: 'PENDING' });
    const tx = {
      booking: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create,
      },
      campSite: { findUnique: vi.fn().mockResolvedValue(makeCampSiteRecordForPricing(null)) },
      blockedDate: { findFirst: vi.fn().mockResolvedValue(null) },
      internalHold: { findMany: vi.fn().mockResolvedValue([]) },
      spot: { findMany: vi.fn().mockResolvedValue([]) },
    };
    wireTransaction(tx);

    const res = await bookingsPOST(makeBookingPostRequest({ spotId: SPOT_ID }));

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledOnce();
  });

  it('[unit][prove-it][ac-5] source inspection: Check 1 no longer builds its own inline findFirst query — it calls isSpotBookedForStay', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'app/api/bookings/route.ts'), 'utf-8');

    expect(src).toContain('isSpotBookedForStay(');
    expect(src).toContain("import { checkDateAvailabilityInTx, isSpotBookedForStay } from '@/lib/campsite-availability';");
    // The seam defect this story fixes: no second, parallel spot-overlap
    // query object should remain inline in the route.
    expect(src).not.toMatch(/spotId:\s*data\.spotId,\s*status:\s*\{\s*not:\s*'CANCELLED'\s*\}/);
  });
});

// ===========================================================================
// Group E — camp-level REGRESSION (the load-bearing one): hard-coded golden
// numbers, not recomputed from the same formula (AC-8).
// ===========================================================================

describe('Camp-level regression — a camp NOT queried by spotId is byte-identical to before CAM-665', () => {
  it('[regression][golden] getCampSiteDailyAvailability: 3 booked + 2 held guests on one night -> the EXACT literal day object', async () => {
    (prisma.booking.findMany as MockFn).mockResolvedValue([
      { checkInDate: NIGHT, checkOutDate: CHECKOUT, guests: 3, status: 'CONFIRMED' },
    ]);
    (prisma.blockedDate.findMany as MockFn).mockResolvedValue([]);
    (prisma.internalHold.findMany as MockFn).mockResolvedValue([
      { startDate: NIGHT, endDate: CHECKOUT, guests: 2 },
    ]);

    const result = await getCampSiteDailyAvailability(CAMP_ID, NIGHT, NIGHT);

    // Hard-coded golden values (3 and 2), never `data.bookedGuests + data.heldGuests`.
    expect(result[NIGHT_ISO]).toEqual({
      bookedGuests: 3,
      bookedTents: 2, // Math.ceil(3/2)
      blockedByHost: false,
      heldGuests: 2,
    });
  });

  it('[regression][golden] getRemainingCapacity: capacity 10, booked 3, held 2 -> remaining is LITERALLY 5', async () => {
    (prisma.campSite.findUnique as MockFn).mockResolvedValue({
      useSpotView: false,
      maxGuestsPerDay: 10,
      maxTentsPerDay: null,
    });
    (prisma.booking.findMany as MockFn).mockResolvedValue([
      { checkInDate: NIGHT, checkOutDate: CHECKOUT, guests: 3, status: 'CONFIRMED' },
    ]);
    (prisma.blockedDate.findMany as MockFn).mockResolvedValue([]);
    (prisma.internalHold.findMany as MockFn).mockResolvedValue([
      { startDate: NIGHT, endDate: CHECKOUT, guests: 2 },
    ]);

    const result = await getRemainingCapacity(CAMP_ID, NIGHT, CHECKOUT);

    expect(result.capacity).toBe(10);
    expect(result.bookedGuests).toBe(3);
    expect(result.heldGuests).toBe(2);
    expect(result.remaining).toBe(5); // literal, not `10 - (3 + 2)`
    expect(result.blockedByHost).toBe(false);
  });

  it('[regression][golden] getAvailabilityStatusForCamps: exactly full on ONE night -> the literal string "FULLY_UNAVAILABLE"', async () => {
    (prisma.campSite.findMany as MockFn).mockResolvedValue([
      { id: CAMP_ID, useSpotView: false, maxGuestsPerDay: 10 },
    ]);
    (prisma.booking.findMany as MockFn).mockResolvedValue([
      { campSiteId: CAMP_ID, checkInDate: NIGHT, checkOutDate: CHECKOUT, guests: 10 },
    ]);
    (prisma.blockedDate.findMany as MockFn).mockResolvedValue([]);
    (prisma.internalHold.findMany as MockFn).mockResolvedValue([]);
    (prisma.spot.findMany as MockFn).mockResolvedValue([]);

    const result = await getAvailabilityStatusForCamps([CAMP_ID], NIGHT, CHECKOUT, 1);

    expect(result[CAMP_ID]).toBe('FULLY_UNAVAILABLE');
  });

  it('[regression][golden] checkDateAvailabilityInTx: capacity 10, booked 8 + held 1, request 2 -> rejected with the literal "(10)" in the reason', async () => {
    const tx = {
      campSite: {
        findUnique: vi.fn().mockResolvedValue({ useSpotView: false, maxGuestsPerDay: 10, maxTentsPerDay: null }),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([
          { checkInDate: NIGHT, checkOutDate: CHECKOUT, guests: 8 },
        ]),
      },
      internalHold: { findMany: vi.fn().mockResolvedValue([{ guests: 1 }]) },
    } as unknown as Prisma.TransactionClient;

    const result = await checkDateAvailabilityInTx(tx, CAMP_ID, NIGHT, 2);

    expect(result.available).toBe(false);
    expect(result.reason).toBe('Exceeds maximum guests per day (10)'); // literal, not interpolated from a re-derived value
  });

  it('[regression] getActiveHoldsForRange with NO spotId still counts a spot-specific hold row into the camp-wide pool (ADR-012 §4 default unchanged)', async () => {
    (prisma.internalHold.findMany as MockFn).mockResolvedValue([
      { startDate: NIGHT, endDate: CHECKOUT, guests: 4 }, // could be ANY spotId in the real DB — no filter applied
    ]);

    const result = await getActiveHoldsForRange(CAMP_ID, NIGHT, CHECKOUT);

    expect(result).toEqual([{ startDate: NIGHT, endDate: CHECKOUT, guests: 4 }]);
  });
});

// ===========================================================================
// Group F — cross-layer INVARIANT (architecture.md §15b): GET's `available`
// (capacity) and `spotAvailable` (pitch) are independent signals, and BOTH
// agree with what POST /api/bookings actually does. 2x2 matrix.
// ===========================================================================

describe('CAM-665 cross-layer invariant — GET route + POST route agree on both signals, per §15b', () => {
  const CAPACITY = 5;

  function wireAvailabilityMocksForCell(cell: { spotOccupied: boolean; campFull: boolean }) {
    (prisma.campSite.findUnique as MockFn).mockResolvedValue(
      makePublicCampSiteRow({ maxGuestsPerDay: CAPACITY })
    );
    (prisma.spot.findFirst as MockFn).mockResolvedValue({ id: SPOT_ID });
    (prisma.booking.findMany as MockFn).mockImplementation((args: { where?: { spotId?: string } }) => {
      if (args?.where?.spotId) {
        return Promise.resolve(cell.spotOccupied ? [{ checkInDate: NIGHT, checkOutDate: CHECKOUT }] : []);
      }
      return Promise.resolve(
        cell.campFull
          ? [{ checkInDate: NIGHT, checkOutDate: CHECKOUT, guests: CAPACITY, status: 'CONFIRMED' }]
          : []
      );
    });
    (prisma.blockedDate.findMany as MockFn).mockResolvedValue([]);
    (prisma.internalHold.findMany as MockFn).mockResolvedValue([]);
  }

  function makeCellTxMock(cell: { spotOccupied: boolean; campFull: boolean }) {
    return {
      booking: {
        findFirst: vi.fn().mockResolvedValue(cell.spotOccupied ? { id: 'existing' } : null),
        findMany: vi.fn().mockResolvedValue(
          cell.campFull ? [{ checkInDate: NIGHT, checkOutDate: CHECKOUT, guests: CAPACITY }] : []
        ),
        create: vi.fn().mockResolvedValue({ id: 'booking-665-cell', status: 'PENDING' }),
      },
      campSite: { findUnique: vi.fn().mockResolvedValue(makeCampSiteRecordForPricing(CAPACITY)) },
      blockedDate: { findFirst: vi.fn().mockResolvedValue(null) },
      internalHold: { findMany: vi.fn().mockResolvedValue([]) },
      spot: { findMany: vi.fn().mockResolvedValue([]) },
    };
  }

  const cells = [
    { label: 'free spot, room in capacity', spotOccupied: false, campFull: false, expectAccepted: true },
    { label: 'spot taken, room in capacity', spotOccupied: true, campFull: false, expectAccepted: false, expectReason: 'Dates not available' },
    { label: 'free spot, capacity full', spotOccupied: false, campFull: true, expectAccepted: false, expectReason: 'Capacity exceeded' },
    { label: 'spot taken AND capacity full', spotOccupied: true, campFull: true, expectAccepted: false, expectReason: 'Dates not available' }, // Check 1 (spot) runs before Check 2 (capacity)
  ];

  for (const cell of cells) {
    it(`[integration][ac-9] ${cell.label} — GET spotAvailable=${!cell.spotOccupied}, available=${!cell.campFull}; POST accepted=${cell.expectAccepted}`, async () => {
      // --- GET layer ---
      wireAvailabilityMocksForCell(cell);
      const getRes = await availabilityGET(makeAvailabilityRequest(SPOT_ID), makeParams(CAMP_ID));
      const getBody = await getRes.json();
      const day = getBody.availability.find((a: { date: string }) => a.date === NIGHT_ISO);

      expect(day.spotAvailable, `${cell.label}: GET spotAvailable`).toBe(!cell.spotOccupied);
      expect(day.available, `${cell.label}: GET available (capacity)`).toBe(!cell.campFull);

      // --- POST layer ---
      const tx = makeCellTxMock(cell);
      (prisma.$transaction as MockFn).mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));
      const postRes = await bookingsPOST(makeBookingPostRequest({ spotId: SPOT_ID, guests: 1 }));
      const postBody = await postRes.json();

      if (cell.expectAccepted) {
        expect(postRes.status, `${cell.label}: POST status`).toBe(201);
      } else {
        expect(postRes.status, `${cell.label}: POST status`).toBe(409);
        expect(postBody.error, `${cell.label}: POST reason`).toBe(cell.expectReason);
      }
    });
  }
});
