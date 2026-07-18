/**
 * cam-400-capacity-invariant.test.ts — CAM-400
 *
 * Cross-layer capacity INVARIANT (BR-1/BR-5): `null` = unlimited, `0` =
 * closed/full, agreed on by EVERY reader of the capacity seam — the
 * availability-calendar route, getRemainingCapacity (the detail-page badge),
 * and checkDateAvailabilityInTx (the booking write gate). Full story:
 * docs/specs/booking-reliability/booking-reliability-every-camper-can-complete-a-bo/
 * CAM-400-capacity-seam-agrees-everywhere-a-camp-shown-as-fu/story.md
 *
 * WHY a dedicated cross-layer suite (BR-5): each of the three readers already
 * has its own per-layer test (cam-355, cam-344, cam-267-prep1). A per-layer
 * test can only see that ITS layer is internally consistent — it cannot see
 * that WHOLE-CAMP's write gate disagreed with WHOLE-CAMP's calendar/badge on
 * the exact same (campId, date, capacity=0) input. This suite runs all three
 * readers against the SAME fixture per cell and asserts they agree.
 *
 * The matrix — {null, 0, positive-with-room, positive-full} x {whole-camp,
 * per-spot} — 8 cells, each checked across all 3 layers (24 agreement
 * assertions total):
 *
 *   WC-1  whole-camp, maxGuestsPerDay=null            -> unlimited, bookable
 *   WC-2  whole-camp, maxGuestsPerDay=0                -> closed, THE BUG (AC-1)
 *   WC-3  whole-camp, capacity=10, booked=3, req=2      -> room left, bookable
 *   WC-4  whole-camp, capacity=10, booked=10, req=1     -> full, rejected
 *   PS-1  per-spot, stored column=null but 0 derived spots -> closed (BR-6);
 *         proves a null STORED column never leaks through as "unlimited" for
 *         PER-SPOT the way it legitimately does for WHOLE-CAMP (WC-1) — the
 *         same raw value means different things by MODE, which is the
 *         derivation contract (getEffectiveCapacity), not a seam divergence.
 *   PS-2  per-spot, derived capacity=0 (zero live spots) -> closed
 *   PS-3  per-spot, derived capacity=8, booked=3, req=2   -> room left, bookable
 *   PS-4  per-spot, derived capacity=8, booked=8, req=1   -> full, rejected
 *
 * Prove-It (manual, per the ticket's self-verify): reverting BR-2's fix in
 * lib/campsite-availability.ts (the whole-camp `!==null` back to `&&`) makes
 * the WC-2 write-gate assertion in this file go red — confirmed by hand
 * during self-verify, not re-encoded as a live revert inside this suite.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports (mirrors cam-355-per-spot-capacity-
// enforcement.test.ts's established convention for this same seam).
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: { findUnique: vi.fn(), findMany: vi.fn() },
    booking: { findMany: vi.fn() },
    blockedDate: { findMany: vi.fn() },
    internalHold: { findMany: vi.fn() },
    spot: { findMany: vi.fn() },
  },
}));

// GET /api/campsites/[id]/availability imports '@/lib/auth' for its lazy
// non-public-camp gate — every fixture here is a public camp (isActive:true,
// isPublished:true, deletedAt:null) so auth() is never actually invoked;
// mocked purely to avoid pulling in next-auth's runtime resolution.
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));

import { prisma } from '@/lib/prisma';
import { getRemainingCapacity, checkDateAvailabilityInTx } from '@/lib/campsite-availability';

const { GET: availabilityGET } = await import('@/app/api/campsites/[id]/availability/route');

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const CAMP_ID = 'aaaaaaaa-0000-4000-8000-000000000400';
const NIGHT_ISO = '2026-10-10';
const CHECKOUT_ISO = '2026-10-11';

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

const NIGHT = d(NIGHT_ISO);
const CHECKOUT = d(CHECKOUT_ISO);

type SpotFixture = { maxCampers: number | null; maxTents: number | null; environment?: null };

interface Cell {
  label: string;
  useSpotView: boolean;
  /** The stored CampSite column (bypassed entirely for per-spot — BR-6). */
  maxGuestsPerDay: number | null;
  maxTentsPerDay: number | null;
  spots?: SpotFixture[];
  /** Existing (already-committed) guests booked on NIGHT. */
  bookedGuests: number;
  /** The new request being checked for bookability. */
  requestedGuests: number;
  /** Expected agreement across all 3 layers. */
  expectAvailable: boolean;
}

/** Minimal Prisma.TransactionClient mock for checkDateAvailabilityInTx (mirrors cam-355's makeTxMock). */
function makeTxMock(cell: Cell): Prisma.TransactionClient {
  const bookings = cell.bookedGuests > 0
    ? [{ checkInDate: NIGHT, checkOutDate: CHECKOUT, guests: cell.bookedGuests }]
    : [];
  return {
    campSite: {
      findUnique: vi.fn().mockResolvedValue({
        useSpotView: cell.useSpotView,
        maxGuestsPerDay: cell.maxGuestsPerDay,
        maxTentsPerDay: cell.maxTentsPerDay,
      }),
    },
    booking: { findMany: vi.fn().mockResolvedValue(bookings) },
    internalHold: { findMany: vi.fn().mockResolvedValue([]) },
    spot: { findMany: vi.fn().mockResolvedValue(cell.spots ?? []) },
  } as unknown as Prisma.TransactionClient;
}

function makeAvailabilityRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/campsites/${CAMP_ID}/availability?startDate=${NIGHT_ISO}T00:00:00.000Z&endDate=${CHECKOUT_ISO}T00:00:00.000Z`
  );
}

/**
 * Wires the shared `prisma` singleton mock (used by the GET route AND
 * getRemainingCapacity) to the SAME fixture data as `makeTxMock` uses for
 * the write gate — the whole point is one fixture, three readers.
 */
function wireSharedPrismaMocks(cell: Cell) {
  const bookings = cell.bookedGuests > 0
    ? [{ checkInDate: NIGHT, checkOutDate: CHECKOUT, guests: cell.bookedGuests, status: 'CONFIRMED' }]
    : [];

  (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    isActive: true,
    isPublished: true,
    deletedAt: null,
    operatorId: 'operator-400',
    useSpotView: cell.useSpotView,
    maxGuestsPerDay: cell.maxGuestsPerDay,
    maxTentsPerDay: cell.maxTentsPerDay,
  });
  (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(bookings);
  (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(cell.spots ?? []);
}

/** Runs all 3 readers against ONE cell and asserts they all agree with `expectAvailable`. */
async function assertAllLayersAgree(cell: Cell) {
  // --- Layer 1: availability-calendar route -------------------------------
  vi.clearAllMocks();
  wireSharedPrismaMocks(cell);
  const res = await availabilityGET(makeAvailabilityRequest(), { params: Promise.resolve({ id: CAMP_ID }) });
  const body = await res.json();
  const day = body.availability.find((a: { date: string }) => a.date === NIGHT_ISO);
  expect(day, `${cell.label}: availability route must report the requested night`).toBeDefined();
  expect(day.available, `${cell.label}: availability-calendar route`).toBe(cell.expectAvailable);

  // --- Layer 2: getRemainingCapacity (the detail-page badge) --------------
  vi.clearAllMocks();
  wireSharedPrismaMocks(cell);
  const remaining = await getRemainingCapacity(CAMP_ID, NIGHT, CHECKOUT);
  const remainingBookable = remaining.remaining === null || remaining.remaining >= cell.requestedGuests;
  expect(remainingBookable, `${cell.label}: remaining-capacity read (remaining=${remaining.remaining})`).toBe(cell.expectAvailable);

  // --- Layer 3: checkDateAvailabilityInTx (the booking write gate) -------
  const tx = makeTxMock(cell);
  const write = await checkDateAvailabilityInTx(tx, CAMP_ID, NIGHT, cell.requestedGuests);
  expect(write.available, `${cell.label}: write gate (reason=${write.reason ?? 'n/a'})`).toBe(cell.expectAvailable);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// The matrix — 8 cells, each run across all 3 layers.
// ===========================================================================

describe('CAM-400 BR-1/BR-5 — capacity invariant agrees across availability route + remaining-capacity + write gate', () => {
  it('[WC-1][normal] whole-camp, capacity=null -> unlimited: bookable for a huge request even with existing bookings', async () => {
    await assertAllLayersAgree({
      label: 'WC-1 whole-camp null',
      useSpotView: false,
      maxGuestsPerDay: null,
      maxTentsPerDay: null,
      bookedGuests: 5,
      requestedGuests: 100,
      expectAvailable: true,
    });
  });

  it('[WC-2][MANDATORY][boundary][ac-1] whole-camp, capacity=0 -> closed: the exact CAM-400 bug — a camp with ZERO existing bookings must still reject even a single guest', async () => {
    await assertAllLayersAgree({
      label: 'WC-2 whole-camp zero (THE BUG)',
      useSpotView: false,
      maxGuestsPerDay: 0,
      maxTentsPerDay: null,
      bookedGuests: 0,
      requestedGuests: 1,
      expectAvailable: false,
    });
  });

  it('[WC-3][normal] whole-camp, capacity=10, booked=3 -> room for 2 more: bookable', async () => {
    await assertAllLayersAgree({
      label: 'WC-3 whole-camp positive-with-room',
      useSpotView: false,
      maxGuestsPerDay: 10,
      maxTentsPerDay: null,
      bookedGuests: 3,
      requestedGuests: 2,
      expectAvailable: true,
    });
  });

  it('[WC-4][boundary] whole-camp, capacity=10, booked=10 -> already full: even 1 more guest rejected', async () => {
    await assertAllLayersAgree({
      label: 'WC-4 whole-camp positive-full',
      useSpotView: false,
      maxGuestsPerDay: 10,
      maxTentsPerDay: null,
      bookedGuests: 10,
      requestedGuests: 1,
      expectAvailable: false,
    });
  });

  it('[PS-1][ac-7][ec-5] per-spot, stored column=null but ZERO live spots -> closed (a null stored column never means "unlimited" for per-spot, unlike WC-1)', async () => {
    await assertAllLayersAgree({
      label: 'PS-1 per-spot null-column, zero live spots',
      useSpotView: true,
      maxGuestsPerDay: null,
      maxTentsPerDay: null,
      spots: [],
      bookedGuests: 0,
      requestedGuests: 1,
      expectAvailable: false,
    });
  });

  it('[PS-2][ac-7] per-spot, derived capacity=0 (zero live spots, stale column would say 999) -> closed', async () => {
    await assertAllLayersAgree({
      label: 'PS-2 per-spot zero-derived',
      useSpotView: true,
      maxGuestsPerDay: 999, // stale — must be ignored entirely (BR-6)
      maxTentsPerDay: 999,
      spots: [],
      bookedGuests: 0,
      requestedGuests: 1,
      expectAvailable: false,
    });
  });

  it('[PS-3][normal] per-spot, derived capacity=8 (3+5 spots), booked=3 -> room for 2 more: bookable', async () => {
    // maxTents generous (10 each) so this cell stays guest-focused only — the
    // tent side of the derived cap must never become the accidental bottleneck.
    await assertAllLayersAgree({
      label: 'PS-3 per-spot positive-with-room',
      useSpotView: true,
      maxGuestsPerDay: null,
      maxTentsPerDay: null,
      spots: [
        { maxCampers: 3, maxTents: 10, environment: null },
        { maxCampers: 5, maxTents: 10, environment: null },
      ],
      bookedGuests: 3,
      requestedGuests: 2,
      expectAvailable: true,
    });
  });

  it('[PS-4][boundary] per-spot, derived capacity=8, booked=8 -> already full: even 1 more guest rejected', async () => {
    await assertAllLayersAgree({
      label: 'PS-4 per-spot positive-full',
      useSpotView: true,
      maxGuestsPerDay: null,
      maxTentsPerDay: null,
      spots: [
        { maxCampers: 3, maxTents: 10, environment: null },
        { maxCampers: 5, maxTents: 10, environment: null },
      ],
      bookedGuests: 8,
      requestedGuests: 1,
      expectAvailable: false,
    });
  });
});

// ===========================================================================
// EC-4: null capacity (unlimited) stays unaffected — no regression for
// unlimited whole-camp camps, the normal (non-full) majority case.
// ===========================================================================

describe('CAM-400 EC-4 — null capacity (unlimited) is unaffected by the fix, exactly as before', () => {
  it('[normal] a whole-camp camp with no capacity set books normally regardless of existing volume', async () => {
    await assertAllLayersAgree({
      label: 'EC-4 unlimited regression guard',
      useSpotView: false,
      maxGuestsPerDay: null,
      maxTentsPerDay: null,
      bookedGuests: 0,
      requestedGuests: 6,
      expectAvailable: true,
    });
  });
});
