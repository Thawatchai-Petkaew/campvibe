/**
 * cam-355-per-spot-capacity-enforcement.test.ts — CAM-355
 *
 * Per-spot capacity ENFORCEMENT parity (T-B read-through): every enforcement/
 * display reader must derive effective capacity from the SAME rule — WHOLE-
 * CAMP reads the stored column unchanged; PER-SPOT sums non-deleted spots
 * live, never falling back to the stale column (even when the derived total
 * is 0). Full story:
 * docs/specs/data-trust/availability-correctness-ว่างจริง-blockeddate-part/
 * CAM-355-per-spot-capacity-enforcement/story.md
 *
 * AC -> test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-1  16-total per-spot camp (spots 4/6/6), 10 booked -> remaining 6
 *       (getRemainingCapacity, derived not column).
 * AC-2  same camp fully booked (16 booked) -> remaining 0.
 * AC-3  booking that would exceed 16 is REJECTED by the write gate — the
 *       mandatory oracle (checkDateAvailabilityInTx + the real POST route).
 * AC-4  whole-camp (useSpotView=false) enforcement/badge/remaining are
 *       BYTE-FOR-BYTE unchanged (BR-8 regression guard).
 * AC-5  catalog badge classifies per-spot camps against the derived total,
 *       not the column; query count stays O(1) per page (5 grouped queries).
 * AC-6  a stale stored column (0/null/999) is never read for a per-spot camp
 *       — enforcement/remaining/badge all use the derived 16.
 * AC-7  zero-spot per-spot camp -> effective capacity 0 -> every booking
 *       rejected, no column fallback (BR-6).
 * EC-1  a spot soft-deleted between page-load and the tx re-checks LIVE
 *       inside the transaction — a stale client total is rejected.
 * EC-2  two racing bookings for the last unit of per-spot capacity resolve to
 *       exactly one success + one rejection.
 * EC-3  the stale column is never read for capacity on a per-spot camp.
 * EC-4  boundary: booked+held+requested === total -> accepted (`>` not `>=`).
 * EC-5  a spot-sum read failure on the WRITE path fails CLOSED (propagates,
 *       no booking created); the catalog badge fail-open contract is
 *       untouched (existing behavior, not re-asserted here).
 * BR-4  perf: the PER-SPOT sum is hoisted ONCE per booking transaction (not
 *       once per night) — the query-count guard.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports (mirrors cam-57-atomic-lock.test.ts).
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    campSite: { findUnique: vi.fn(), findMany: vi.fn() },
    booking: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    blockedDate: { findFirst: vi.fn(), findMany: vi.fn() },
    internalHold: { findMany: vi.fn() },
    spot: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireAuth: vi.fn(),
}));

// CAM-651: the route now calls buildBookingPriceArgs (not resolveUnitPrice)
// directly, so that is what must be mocked here.
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

vi.mock('@/lib/serialize', () => ({
  serializeDecimals: vi.fn((x) => x),
}));

// GET /api/campsites/[id]/availability imports '@/lib/auth' (NextAuth) for its
// lazy non-public-camp gate — mocked here purely so importing the real route
// module never pulls in next-auth's runtime resolution in this suite (mirrors
// cam-302-internal-holds.test.ts's established convention). Every fixture in
// Group G is a public camp, so `auth()` is never actually invoked.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import {
  getEffectiveCapacity,
  getRemainingCapacity,
  getAvailabilityStatusForCamps,
  checkDateAvailabilityInTx,
} from '@/lib/campsite-availability';
import { calculateSpotCapacity, getCampSiteWithCapacity } from '@/lib/spot-aggregation';

const { POST: bookingsPOST } = await import('@/app/api/bookings/route');
const { GET: availabilityGET } = await import('@/app/api/campsites/[id]/availability/route');

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const CAMP_ID = 'aaaaaaaa-0000-4000-8000-000000000355';
const SPOT_ID = 'aaaaaaaa-0000-4000-8000-000000000356';
const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000357';

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** The AC-1 fixture: 3 non-deleted spots holding 4, 6, 6 people (derived total 16). */
const SPOTS_16 = [
  { maxCampers: 4, maxTents: 1, environment: null },
  { maxCampers: 6, maxTents: 1, environment: null },
  { maxCampers: 6, maxTents: 1, environment: null },
];

function makeSession(userId = USER_ID) {
  return { user: { id: userId, email: 'camper@campvibe.com', name: 'Camper' } };
}

function makePostRequest(body: Record<string, unknown> = {}): NextRequest {
  const defaultBody = {
    campSiteId: CAMP_ID,
    checkInDate: '2026-09-10',
    checkOutDate: '2026-09-11',
    guests: 6,
  };
  return new NextRequest('http://localhost/api/bookings', {
    method: 'POST',
    body: JSON.stringify({ ...defaultBody, ...body }),
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Minimal Prisma.TransactionClient mock for checkDateAvailabilityInTx unit
 * tests. `spots` represents the ALREADY-FILTERED (deletedAt: null) result a
 * real query would return — mirrors the convention in
 * cam-352-spot-aggregation-soft-delete.test.ts.
 */
function makeTxMock(opts: {
  campSite: { useSpotView: boolean; maxGuestsPerDay: number | null; maxTentsPerDay: number | null };
  bookings?: { checkInDate: Date; checkOutDate: Date; guests: number }[];
  holds?: { guests: number }[];
  spots?: { maxCampers: number | null; maxTents: number | null; environment?: null }[];
}): Prisma.TransactionClient {
  return {
    campSite: { findUnique: vi.fn().mockResolvedValue(opts.campSite) },
    booking: { findMany: vi.fn().mockResolvedValue(opts.bookings ?? []) },
    internalHold: { findMany: vi.fn().mockResolvedValue(opts.holds ?? []) },
    spot: { findMany: vi.fn().mockResolvedValue(opts.spots ?? []) },
  } as unknown as Prisma.TransactionClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// Group A: getEffectiveCapacity — the ONE derivation helper (BR-1/BR-2/BR-6)
// ===========================================================================

describe('getEffectiveCapacity — mode-driven derivation (BR-1/BR-2/BR-6)', () => {
  it('[normal] WHOLE-CAMP (useSpotView=false) reads the stored column unchanged', async () => {
    const result = await getEffectiveCapacity(prisma, {
      id: CAMP_ID,
      useSpotView: false,
      maxGuestsPerDay: 50,
      maxTentsPerDay: 20,
    });

    expect(result).toEqual({ maxGuestsPerDay: 50, maxTentsPerDay: 20 });
    expect(prisma.spot.findMany).not.toHaveBeenCalled();
  });

  it('[normal] PER-SPOT sums non-deleted spots for guests AND tents (AC-1 fixture: 4+6+6=16 guests, 1+1+1=3 tents)', async () => {
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(SPOTS_16);

    const result = await getEffectiveCapacity(prisma, {
      id: CAMP_ID,
      useSpotView: true,
      maxGuestsPerDay: 999, // stale — must be ignored
      maxTentsPerDay: 999,
    });

    expect(result).toEqual({ maxGuestsPerDay: 16, maxTentsPerDay: 3 });
    const call = (prisma.spot.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where).toEqual({ campSiteId: CAMP_ID, deletedAt: null });
  });

  it('[boundary][ac-7] PER-SPOT with zero live spots derives 0 (a real cap), never falls back to the stale column', async () => {
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getEffectiveCapacity(prisma, {
      id: CAMP_ID,
      useSpotView: true,
      maxGuestsPerDay: 999,
      maxTentsPerDay: 999,
    });

    expect(result).toEqual({ maxGuestsPerDay: 0, maxTentsPerDay: 0 });
  });

  it('[ac-6] a stale column (0/null/999) is ignored entirely for PER-SPOT — only the derived sum is returned', async () => {
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(SPOTS_16);

    const staleZero = await getEffectiveCapacity(prisma, {
      id: CAMP_ID, useSpotView: true, maxGuestsPerDay: 0, maxTentsPerDay: 0,
    });
    const staleNull = await getEffectiveCapacity(prisma, {
      id: CAMP_ID, useSpotView: true, maxGuestsPerDay: null, maxTentsPerDay: null,
    });

    expect(staleZero.maxGuestsPerDay).toBe(16);
    expect(staleNull.maxGuestsPerDay).toBe(16);
  });

  it('[tx-variant] accepts a Prisma.TransactionClient so the write gate can read snapshot-consistent inside the SAME tx (EC-1/EC-2)', async () => {
    const tx = {
      spot: { findMany: vi.fn().mockResolvedValue(SPOTS_16) },
    } as unknown as Prisma.TransactionClient;

    const result = await getEffectiveCapacity(tx, {
      id: CAMP_ID, useSpotView: true, maxGuestsPerDay: null, maxTentsPerDay: null,
    });

    expect(result.maxGuestsPerDay).toBe(16);
  });
});

// ===========================================================================
// Group B: getCampSiteWithCapacity fold-in — display agrees with enforcement (BR-6)
// ===========================================================================

describe('getCampSiteWithCapacity — BR-6 fold-in: no || fallback for a zero-derived PER-SPOT camp', () => {
  it('[ac-7] zero non-deleted spots -> maxGuestsPerDay/maxTentsPerDay are 0, NOT the stale manual column', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMP_ID,
      useSpotView: true,
      spots: [],
      maxGuestsPerDay: 999, // stale manual fallback value — must NOT win
      maxTentsPerDay: 999,
      groundType: null,
    });
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getCampSiteWithCapacity(CAMP_ID);

    expect(result?.maxGuestsPerDay).toBe(0);
    expect(result?.maxTentsPerDay).toBe(0);
  });

  it('[regression] a non-zero derived total still overrides the stale column exactly as before (unaffected by the fold-in)', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMP_ID,
      useSpotView: true,
      spots: [{ id: 'live', maxCampers: 6, maxTents: 2, deletedAt: null }],
      maxGuestsPerDay: 999,
      maxTentsPerDay: 999,
      groundType: null,
    });
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { maxCampers: 6, maxTents: 2, environment: null },
    ]);

    const result = await getCampSiteWithCapacity(CAMP_ID);

    expect(result?.maxGuestsPerDay).toBe(6);
    expect(result?.maxTentsPerDay).toBe(2);
  });
});

// ===========================================================================
// Group C: checkDateAvailabilityInTx — THE MANDATORY ORACLE (AC-3/AC-7/EC-2/
// EC-4/EC-5) — the booking write gate must reject an over-book against the
// DERIVED per-spot total, never the stale column.
// ===========================================================================

describe('checkDateAvailabilityInTx — PER-SPOT write-gate oracle (AC-3/AC-6/AC-7/EC-1/EC-3/EC-4/EC-5)', () => {
  const testDate = d('2026-09-10');

  it('[MANDATORY ORACLE][ac-3] a per-spot camp (derived total 16) with 10 already booked REJECTS a request for 7 (10+7=17 > 16) reading the DERIVED total, not the stale column', async () => {
    const tx = makeTxMock({
      campSite: { useSpotView: true, maxGuestsPerDay: 999, maxTentsPerDay: null }, // stale column must be ignored
      bookings: [{ checkInDate: testDate, checkOutDate: d('2026-09-11'), guests: 10 }],
      spots: SPOTS_16,
    });

    const result = await checkDateAvailabilityInTx(tx, CAMP_ID, testDate, 7);

    expect(result.available).toBe(false);
    // BR-7: the internal reason string reflects the DERIVED number (16), never the stale 999.
    expect(result.reason).toBe('Exceeds maximum guests per day (16)');
  });

  it('[boundary][ec-4] the SAME camp accepts a request for exactly 6 (10+6=16, the inclusive boundary — "> total" rejects, "= total" accepts)', async () => {
    const tx = makeTxMock({
      campSite: { useSpotView: true, maxGuestsPerDay: 999, maxTentsPerDay: null },
      bookings: [{ checkInDate: testDate, checkOutDate: d('2026-09-11'), guests: 10 }],
      spots: SPOTS_16,
    });

    const result = await checkDateAvailabilityInTx(tx, CAMP_ID, testDate, 6);

    expect(result.available).toBe(true);
  });

  it('[ac-7] a PER-SPOT camp with ZERO non-deleted spots rejects every booking (effective capacity 0, never unbounded/stale-column)', async () => {
    const tx = makeTxMock({
      campSite: { useSpotView: true, maxGuestsPerDay: null, maxTentsPerDay: null }, // null column would mean "unbounded" on the whole-camp branch
      bookings: [],
      spots: [],
    });

    const result = await checkDateAvailabilityInTx(tx, CAMP_ID, testDate, 1);

    expect(result.available).toBe(false);
    expect(result.reason).toBe('Exceeds maximum guests per day (0)');
  });

  it('[ac-7] all-null-per-spot-value spots also derive 0 (never treated as unbounded)', async () => {
    const tx = makeTxMock({
      campSite: { useSpotView: true, maxGuestsPerDay: 50, maxTentsPerDay: null },
      bookings: [],
      spots: [
        { maxCampers: null, maxTents: null, environment: null },
        { maxCampers: null, maxTents: null, environment: null },
      ],
    });

    const result = await checkDateAvailabilityInTx(tx, CAMP_ID, testDate, 1);

    expect(result.available).toBe(false);
    expect(result.reason).toBe('Exceeds maximum guests per day (0)');
  });

  it('[tents] PER-SPOT tents also derive from the spot sum (1+1+1=3), rejecting a request for 4 tents', async () => {
    const tx = makeTxMock({
      campSite: { useSpotView: true, maxGuestsPerDay: 999, maxTentsPerDay: 999 },
      bookings: [],
      spots: SPOTS_16, // maxTents sum = 3
    });

    // requestedGuests=8 -> estimatedTents=ceil(8/2)=4 > derived 3 tents.
    // requestedTents is only a truthy gate ("was a tent count requested at
    // all") — the actual estimate is computed from requestedGuests.
    const result = await checkDateAvailabilityInTx(tx, CAMP_ID, testDate, 8, 1);

    expect(result.available).toBe(false);
    expect(result.reason).toBe('Exceeds maximum tents per day (3)');
  });

  it('[ec-3] the stale stored column (0, null, or a high number) is NEVER read for a PER-SPOT camp\'s capacity check', async () => {
    // Stale column says 0 (would look "closed" if read) but 16 real spot capacity with only 1 booked -> must ACCEPT.
    const tx = makeTxMock({
      campSite: { useSpotView: true, maxGuestsPerDay: 0, maxTentsPerDay: null },
      bookings: [{ checkInDate: testDate, checkOutDate: d('2026-09-11'), guests: 1 }],
      spots: SPOTS_16,
    });

    const result = await checkDateAvailabilityInTx(tx, CAMP_ID, testDate, 10);

    // 1 booked + 10 requested = 11 <= 16 (derived) -> available; would have
    // wrongly rejected (or wrongly passed as "unbounded") had the column been consulted.
    expect(result.available).toBe(true);
  });

  it('[ec-1] a spot soft-deleted BEFORE a fresh transaction starts is excluded live — a stale client total (16) is rejected once the real total drops to 10', async () => {
    // First transaction: all 3 spots still live (total 16) — a request for 16 exactly is accepted.
    const txBefore = makeTxMock({
      campSite: { useSpotView: true, maxGuestsPerDay: null, maxTentsPerDay: null },
      bookings: [],
      spots: SPOTS_16,
    });
    const before = await checkDateAvailabilityInTx(txBefore, CAMP_ID, testDate, 16);
    expect(before.available).toBe(true);

    // Host soft-deletes the 6-person spot; a NEW transaction (fresh tx = fresh
    // cache, EC-1) now sees only 2 live spots (4+6=10). The SAME requested
    // amount (16) that was accepted a moment ago now correctly rejects.
    const txAfter = makeTxMock({
      campSite: { useSpotView: true, maxGuestsPerDay: null, maxTentsPerDay: null },
      bookings: [],
      spots: [SPOTS_16[0], SPOTS_16[1]], // the third (soft-deleted) spot never comes back from a real deletedAt:null query
    });
    const after = await checkDateAvailabilityInTx(txAfter, CAMP_ID, testDate, 16);

    expect(after.available).toBe(false);
    expect(after.reason).toBe('Exceeds maximum guests per day (10)');
  });

  it('[ec-2] two racing bookings for the last unit of per-spot capacity: the second sees the first\'s committed booking and is rejected', async () => {
    // Two SEPARATE tx objects (proper per-transaction isolation, unlike reusing
    // one mock tx for both "requests") — the second transaction's booking read
    // reflects what the first transaction already committed, exactly like two
    // real serializable transactions racing for the same capacity.
    const txFirst = makeTxMock({
      campSite: { useSpotView: true, maxGuestsPerDay: null, maxTentsPerDay: null },
      bookings: [],
      spots: SPOTS_16,
    });
    const first = await checkDateAvailabilityInTx(txFirst, CAMP_ID, testDate, 16);
    expect(first.available).toBe(true); // first request takes the whole camp (0 -> 16)

    const txSecond = makeTxMock({
      campSite: { useSpotView: true, maxGuestsPerDay: null, maxTentsPerDay: null },
      bookings: [{ checkInDate: testDate, checkOutDate: d('2026-09-11'), guests: 16 }], // the first booking, now committed
      spots: SPOTS_16,
    });
    const second = await checkDateAvailabilityInTx(txSecond, CAMP_ID, testDate, 1);

    expect(second.available).toBe(false);
  });

  it('[ec-5] a spot-sum read failure on the WRITE path propagates (fails CLOSED) — never silently treated as available', async () => {
    const tx = {
      campSite: { findUnique: vi.fn().mockResolvedValue({ useSpotView: true, maxGuestsPerDay: null, maxTentsPerDay: null }) },
      booking: { findMany: vi.fn().mockResolvedValue([]) },
      internalHold: { findMany: vi.fn().mockResolvedValue([]) },
      spot: { findMany: vi.fn().mockRejectedValue(new Error('DB connection lost')) },
    } as unknown as Prisma.TransactionClient;

    await expect(checkDateAvailabilityInTx(tx, CAMP_ID, testDate, 1)).rejects.toThrow('DB connection lost');
  });

  it('[br-8][regression] WHOLE-CAMP (useSpotView=false) is byte-for-byte unchanged — no spot query runs, null/falsy column still means unbounded', async () => {
    const tx = makeTxMock({
      campSite: { useSpotView: false, maxGuestsPerDay: null, maxTentsPerDay: null },
      bookings: [{ checkInDate: testDate, checkOutDate: d('2026-09-11'), guests: 99 }],
    });

    const result = await checkDateAvailabilityInTx(tx, CAMP_ID, testDate, 50);

    expect(result.available).toBe(true); // unchanged pre-existing "null = unbounded" quirk
    expect((tx as unknown as { spot: { findMany: ReturnType<typeof vi.fn> } }).spot.findMany).not.toHaveBeenCalled();
  });

  it('[br-4][perf guard] the PER-SPOT spot-sum is hoisted ONCE per transaction — 3 nights of the SAME tx+campsite call spot.findMany exactly once', async () => {
    const tx = makeTxMock({
      campSite: { useSpotView: true, maxGuestsPerDay: null, maxTentsPerDay: null },
      bookings: [],
      spots: SPOTS_16,
    });

    await checkDateAvailabilityInTx(tx, CAMP_ID, d('2026-09-10'), 2);
    await checkDateAvailabilityInTx(tx, CAMP_ID, d('2026-09-11'), 2);
    await checkDateAvailabilityInTx(tx, CAMP_ID, d('2026-09-12'), 2);

    expect((tx as unknown as { spot: { findMany: ReturnType<typeof vi.fn> } }).spot.findMany).toHaveBeenCalledOnce();
  });

  it('[br-4][perf guard] a DIFFERENT tx object (a new/retried transaction) re-queries fresh — the cache never leaks across transactions', async () => {
    const txA = makeTxMock({
      campSite: { useSpotView: true, maxGuestsPerDay: null, maxTentsPerDay: null },
      bookings: [],
      spots: SPOTS_16,
    });
    const txB = makeTxMock({
      campSite: { useSpotView: true, maxGuestsPerDay: null, maxTentsPerDay: null },
      bookings: [],
      spots: SPOTS_16,
    });

    await checkDateAvailabilityInTx(txA, CAMP_ID, testDate, 1);
    await checkDateAvailabilityInTx(txB, CAMP_ID, testDate, 1);

    expect((txA as unknown as { spot: { findMany: ReturnType<typeof vi.fn> } }).spot.findMany).toHaveBeenCalledOnce();
    expect((txB as unknown as { spot: { findMany: ReturnType<typeof vi.fn> } }).spot.findMany).toHaveBeenCalledOnce();
  });
});

// ===========================================================================
// Group D: getRemainingCapacity — the detail-page badge (AC-1/AC-2/AC-6/AC-7)
// ===========================================================================

describe('getRemainingCapacity — PER-SPOT derived remaining (AC-1/AC-2/AC-6/AC-7)', () => {
  it('[ac-1] derived total 16, 10 booked -> remaining 6 (not from the stored column)', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      useSpotView: true,
      maxGuestsPerDay: 999, // stale
      maxTentsPerDay: null,
    });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 10, status: 'CONFIRMED' },
    ]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(SPOTS_16);

    const result = await getRemainingCapacity(CAMP_ID, d('2026-09-10'), d('2026-09-11'));

    expect(result.capacity).toBe(16);
    expect(result.remaining).toBe(6);
  });

  it('[ac-2] the same camp fully booked (16) -> remaining 0 (เต็มแล้ว)', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      useSpotView: true, maxGuestsPerDay: 999, maxTentsPerDay: null,
    });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 16, status: 'CONFIRMED' },
    ]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(SPOTS_16);

    const result = await getRemainingCapacity(CAMP_ID, d('2026-09-10'), d('2026-09-11'));

    expect(result.capacity).toBe(16);
    expect(result.remaining).toBe(0);
  });

  it('[ac-7] zero-spot per-spot camp -> capacity 0, remaining 0 (never null/unbounded)', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      useSpotView: true, maxGuestsPerDay: 999, maxTentsPerDay: null,
    });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getRemainingCapacity(CAMP_ID, d('2026-09-10'), d('2026-09-11'));

    expect(result.capacity).toBe(0);
    expect(result.remaining).toBe(0);
  });

  it('[br-8][regression] WHOLE-CAMP (useSpotView=false) reads the column exactly as before — no spot query', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      useSpotView: false, maxGuestsPerDay: 5, maxTentsPerDay: null,
    });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 3, status: 'CONFIRMED' },
    ]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getRemainingCapacity(CAMP_ID, d('2026-09-10'), d('2026-09-11'));

    expect(result.capacity).toBe(5);
    expect(result.remaining).toBe(2);
    expect(prisma.spot.findMany).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Group E: getAvailabilityStatusForCamps — catalog badge (AC-5), batched (BR-5)
// ===========================================================================

describe('getAvailabilityStatusForCamps — PER-SPOT batched badge (AC-5/BR-4c/BR-5)', () => {
  it('[ac-5] a per-spot camp (derived total 16) with 16 booked on every night -> FULLY_UNAVAILABLE, ignoring a low stale column', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_ID, useSpotView: true, maxGuestsPerDay: 1 }, // stale-low column would wrongly read "full at 1"
    ]);
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { campSiteId: CAMP_ID, checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-13'), guests: 16 },
    ]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      SPOTS_16.map((s) => ({ campSiteId: CAMP_ID, maxCampers: s.maxCampers, maxTents: s.maxTents }))
    );

    const result = await getAvailabilityStatusForCamps([CAMP_ID], d('2026-09-10'), d('2026-09-13'), 1);

    expect(result[CAMP_ID]).toBe('FULLY_UNAVAILABLE');
  });

  it('[ac-5] the same camp with only 10 booked (well under the derived 16) -> no badge (fully available), even though the stale column says 1', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_ID, useSpotView: true, maxGuestsPerDay: 1 },
    ]);
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { campSiteId: CAMP_ID, checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-13'), guests: 10 },
    ]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      SPOTS_16.map((s) => ({ campSiteId: CAMP_ID, maxCampers: s.maxCampers, maxTents: s.maxTents }))
    );

    const result = await getAvailabilityStatusForCamps([CAMP_ID], d('2026-09-10'), d('2026-09-13'), 1);

    expect(result[CAMP_ID]).toBeUndefined();
  });

  it('[ac-7] a zero-spot per-spot camp -> FULLY_UNAVAILABLE for any requested guests (derived capacity 0)', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_ID, useSpotView: true, maxGuestsPerDay: 999 },
    ]);
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getAvailabilityStatusForCamps([CAMP_ID], d('2026-09-10'), d('2026-09-11'), 1);

    expect(result[CAMP_ID]).toBe('FULLY_UNAVAILABLE');
  });

  it('[br-8][regression] a whole-camp camp in the SAME page is unaffected by the batched spot rows of a per-spot sibling', async () => {
    const WHOLE_CAMP_ID = 'aaaaaaaa-0000-4000-8000-000000000358';
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_ID, useSpotView: true, maxGuestsPerDay: 999 },
      { id: WHOLE_CAMP_ID, useSpotView: false, maxGuestsPerDay: 5 },
    ]);
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { campSiteId: WHOLE_CAMP_ID, checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 5 },
    ]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      SPOTS_16.map((s) => ({ campSiteId: CAMP_ID, maxCampers: s.maxCampers, maxTents: s.maxTents }))
    );

    const result = await getAvailabilityStatusForCamps([CAMP_ID, WHOLE_CAMP_ID], d('2026-09-10'), d('2026-09-11'), 1);

    expect(result[CAMP_ID]).toBeUndefined(); // per-spot camp: 0 booked vs derived 16 -> available
    expect(result[WHOLE_CAMP_ID]).toBe('FULLY_UNAVAILABLE'); // whole-camp: 5 booked === column 5
  });
});

// ===========================================================================
// Group F: INTEGRATION — the real POST /api/bookings route (the mandatory
// KPI-seam oracle run end-to-end, not just the unit-level helper).
// ===========================================================================

describe('POST /api/bookings — PER-SPOT enforcement end-to-end (AC-3/AC-7/EC-4/EC-5, the mandatory oracle)', () => {
  beforeEach(() => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null, session: makeSession() });
  });

  /** Wires prisma.$transaction to invoke the callback with a custom tx mock. */
  function wireTransaction(tx: unknown) {
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)
    );
  }

  function makeFullTxMock(opts: {
    bookings?: { checkInDate: Date; checkOutDate: Date; guests: number }[];
    spots?: { maxCampers: number | null; maxTents: number | null }[];
  }) {
    return {
      booking: {
        findFirst: vi.fn().mockResolvedValue(null), // no spot overlap
        findMany: vi.fn().mockResolvedValue(opts.bookings ?? []),
        create: vi.fn().mockResolvedValue({ id: 'booking-355', status: 'PENDING' }),
      },
      campSite: {
        // First N calls: the capacity check (once per night, mode-aware).
        // Final call: the pricing fetch (unaffected by CAM-355).
        findUnique: vi.fn().mockResolvedValue({ useSpotView: true, maxGuestsPerDay: 999, maxTentsPerDay: null }),
      },
      blockedDate: { findFirst: vi.fn().mockResolvedValue(null) },
      internalHold: { findMany: vi.fn().mockResolvedValue([]) },
      spot: { findMany: vi.fn().mockResolvedValue(opts.spots ?? []) },
    };
  }

  it('[MANDATORY ORACLE][ac-3] a request for 7 more guests on a per-spot camp at derived-total 16 with 10 already booked -> 409 "Capacity exceeded", reading the DERIVED total (not the stale 999 column)', async () => {
    const tx = makeFullTxMock({
      bookings: [{ checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 10 }],
      spots: SPOTS_16,
    });
    wireTransaction(tx);

    const res = await bookingsPOST(makePostRequest({
      checkInDate: '2026-09-10', checkOutDate: '2026-09-11', guests: 7,
    }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('Capacity exceeded');
    expect(body.details).toMatch(/Exceeds maximum guests per day \(16\)/);
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it('[boundary][ec-4] the exact remaining amount (6) is ACCEPTED — 201, booking created', async () => {
    const tx = makeFullTxMock({
      bookings: [{ checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 10 }],
      spots: SPOTS_16,
    });
    // Full campSite record for the pricing step (after capacity/blocked checks pass).
    (tx.campSite.findUnique as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        id: CAMP_ID,
        useSpotView: true,
        nameTh: 'แคมป์ทดสอบ',
        nameEn: 'Test Camp',
        priceLow: 500,
        priceCurrency: 'THB',
        checkInTime: '14:00',
        checkOutTime: '12:00',
        maxGuestsPerDay: 999,
        maxTentsPerDay: null,
        spots: [],
        location: { countryRel: { vatRate: 0, timezone: 'Asia/Bangkok' } },
      })
    );
    wireTransaction(tx);

    const res = await bookingsPOST(makePostRequest({
      checkInDate: '2026-09-10', checkOutDate: '2026-09-11', guests: 6,
    }));

    expect(res.status).toBe(201);
    expect(tx.booking.create).toHaveBeenCalledOnce();
  });

  it('[ac-7] a zero-spot per-spot camp rejects a booking for even 1 guest with the existing "Capacity exceeded" contract (no new copy)', async () => {
    const tx = makeFullTxMock({ bookings: [], spots: [] });
    wireTransaction(tx);

    const res = await bookingsPOST(makePostRequest({
      checkInDate: '2026-09-10', checkOutDate: '2026-09-11', guests: 1,
    }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('Capacity exceeded');
    expect(body.details).toMatch(/Exceeds maximum guests per day \(0\)/);
  });

  it('[br-4][perf] a 3-night per-spot booking hoists the spot-sum to exactly ONE query (not one per night)', async () => {
    const tx = makeFullTxMock({ bookings: [], spots: SPOTS_16 });
    (tx.campSite.findUnique as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        id: CAMP_ID,
        useSpotView: true,
        nameTh: 'แคมป์ทดสอบ',
        nameEn: 'Test Camp',
        priceLow: 500,
        priceCurrency: 'THB',
        checkInTime: '14:00',
        checkOutTime: '12:00',
        maxGuestsPerDay: 999,
        maxTentsPerDay: null,
        spots: [],
        location: { countryRel: { vatRate: 0, timezone: 'Asia/Bangkok' } },
      })
    );
    wireTransaction(tx);

    const res = await bookingsPOST(makePostRequest({
      checkInDate: '2026-09-10', checkOutDate: '2026-09-13', guests: 6, // 3 nights
    }));

    expect(res.status).toBe(201);
    // Exactly one spot-sum query for the WHOLE booking, regardless of nights checked.
    expect(tx.spot.findMany).toHaveBeenCalledOnce();
  });

  it('[ec-5] a spot-sum read failure inside the tx fails CLOSED — 500, no booking row created', async () => {
    const tx = {
      booking: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
      campSite: {
        findUnique: vi.fn().mockResolvedValue({ useSpotView: true, maxGuestsPerDay: 999, maxTentsPerDay: null }),
      },
      blockedDate: { findFirst: vi.fn().mockResolvedValue(null) },
      internalHold: { findMany: vi.fn().mockResolvedValue([]) },
      spot: { findMany: vi.fn().mockRejectedValue(new Error('DB connection lost')) },
    };
    wireTransaction(tx);

    const res = await bookingsPOST(makePostRequest({
      checkInDate: '2026-09-10', checkOutDate: '2026-09-11', guests: 1,
    }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(tx.booking.create).not.toHaveBeenCalled();
    // No internals leaked to the client (api.md §5 — generic message only).
    expect(body).not.toHaveProperty('details');
  });

  it('[br-8][regression] a WHOLE-CAMP booking is unaffected — no spot query runs, existing column-based contract unchanged', async () => {
    const tx = {
      booking: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([
          { checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 8 },
        ]),
        create: vi.fn(),
      },
      campSite: {
        findUnique: vi.fn().mockResolvedValue({ useSpotView: false, maxGuestsPerDay: 10, maxTentsPerDay: null }),
      },
      blockedDate: { findFirst: vi.fn().mockResolvedValue(null) },
      internalHold: { findMany: vi.fn().mockResolvedValue([]) },
      spot: { findMany: vi.fn() },
    };
    wireTransaction(tx);

    const res = await bookingsPOST(makePostRequest({
      checkInDate: '2026-09-10', checkOutDate: '2026-09-11', guests: 3,
    }));
    const body = await res.json();

    // 8 booked + 3 requested = 11 > 10 -> 409, byte-identical pre-CAM-355 contract.
    expect(res.status).toBe(409);
    expect(body.error).toBe('Capacity exceeded');
    expect(body.details).toMatch(/Exceeds maximum guests per day \(10\)/);
    expect(tx.spot.findMany).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Group G: GET /api/campsites/[id]/availability — the 5th capacity reader
// (G3 Important-1). Feeds the camper date-picker (isDateDisabled) + the host
// availability calendar. DISPLAY reader — fails OPEN on a spot-sum read
// failure (mirrors the catalog-badge contract), unlike the booking write gate.
// ===========================================================================

describe('GET /api/campsites/[id]/availability — PER-SPOT effective capacity (G3 Important-1)', () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  // Same guest total as SPOTS_16 (4+6+6=16) but generous per-spot maxTents so
  // a 10-guest booking's estimated tent usage (ceil(10/2)=5) never trips the
  // TENTS side of the derived cap — these tests are guest-focused (AC-1/AC-6).
  const SPOTS_16_GUESTS_ONLY = SPOTS_16.map((s) => ({ ...s, maxTents: 10 }));

  function makeAvailabilityRequest(id: string, startDate = '2026-09-10', endDate = '2026-09-11') {
    return new NextRequest(
      `http://localhost/api/campsites/${id}/availability?startDate=${startDate}T00:00:00.000Z&endDate=${endDate}T00:00:00.000Z`
    );
  }

  function mockPublicCampSite(overrides: {
    useSpotView: boolean;
    maxGuestsPerDay: number | null;
    maxTentsPerDay: number | null;
  }) {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isActive: true,
      isPublished: true,
      deletedAt: null,
      operatorId: 'operator-355',
      ...overrides,
    });
  }

  beforeEach(() => {
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('[ac-1/ac-6] a per-spot camp with stale column 999 but derived total 16, 10 booked -> limits/remaining report 16-derived numbers, not 999', async () => {
    mockPublicCampSite({ useSpotView: true, maxGuestsPerDay: 999, maxTentsPerDay: null });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 10, status: 'CONFIRMED' },
    ]);
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(SPOTS_16_GUESTS_ONLY);

    const res = await availabilityGET(makeAvailabilityRequest(CAMP_ID), makeParams(CAMP_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.limits.maxGuestsPerDay).toBe(16);
    const day = body.availability.find((a: { date: string }) => a.date === '2026-09-10');
    expect(day.maxGuests).toBe(16);
    expect(day.remainingGuests).toBe(6); // 16 - 10, not 999 - 10
    expect(day.available).toBe(true);
  });

  it('[ac-7] a per-spot camp with zero non-deleted spots -> every day isCapacityFull (available:false), derived capacity 0', async () => {
    mockPublicCampSite({ useSpotView: true, maxGuestsPerDay: 999, maxTentsPerDay: null });
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await availabilityGET(makeAvailabilityRequest(CAMP_ID), makeParams(CAMP_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.limits.maxGuestsPerDay).toBe(0);
    const day = body.availability.find((a: { date: string }) => a.date === '2026-09-10');
    expect(day.maxGuests).toBe(0);
    expect(day.remainingGuests).toBe(0);
    expect(day.available).toBe(false); // NOT true — 0 is a real cap, never treated as "no cap"
  });

  it('[ec-3] the soft-delete filter is applied to the spot-sum this route reads', async () => {
    mockPublicCampSite({ useSpotView: true, maxGuestsPerDay: null, maxTentsPerDay: null });
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(SPOTS_16);

    await availabilityGET(makeAvailabilityRequest(CAMP_ID), makeParams(CAMP_ID));

    const call = (prisma.spot.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where).toEqual({ campSiteId: CAMP_ID, deletedAt: null });
  });

  it('[br-4][perf guard] the spot-sum is read exactly ONCE per request, not once per day in the range', async () => {
    mockPublicCampSite({ useSpotView: true, maxGuestsPerDay: null, maxTentsPerDay: null });
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(SPOTS_16);

    // 5-day range — the pre-CAM-355 route already loops per day for
    // isCapacityFull/remaining; the spot-sum read must NOT follow that loop.
    const res = await availabilityGET(
      makeAvailabilityRequest(CAMP_ID, '2026-09-10', '2026-09-15'),
      makeParams(CAMP_ID)
    );
    const body = await res.json();

    expect(body.availability.length).toBeGreaterThan(1);
    expect(prisma.spot.findMany).toHaveBeenCalledOnce();
  });

  it('[ec-5][fail-open] a spot-sum read failure serves the calendar from the raw column instead of 500ing (mirrors the badge contract)', async () => {
    mockPublicCampSite({ useSpotView: true, maxGuestsPerDay: 50, maxTentsPerDay: null });
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB connection lost'));

    const res = await availabilityGET(makeAvailabilityRequest(CAMP_ID), makeParams(CAMP_ID));
    const body = await res.json();

    // Fail-OPEN: 200, not 500 — falls back to the raw (stale) column value.
    expect(res.status).toBe(200);
    expect(body.limits.maxGuestsPerDay).toBe(50);
  });

  it('[br-8][regression] a WHOLE-CAMP camp (useSpotView=false) is byte-for-byte unchanged — no spot query at all', async () => {
    mockPublicCampSite({ useSpotView: false, maxGuestsPerDay: 5, maxTentsPerDay: null });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 3, status: 'CONFIRMED' },
    ]);

    const res = await availabilityGET(makeAvailabilityRequest(CAMP_ID), makeParams(CAMP_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.limits.maxGuestsPerDay).toBe(5);
    const day = body.availability.find((a: { date: string }) => a.date === '2026-09-10');
    expect(day.remainingGuests).toBe(2); // 5 - 3, unchanged formula
    expect(prisma.spot.findMany).not.toHaveBeenCalled();
  });
});
