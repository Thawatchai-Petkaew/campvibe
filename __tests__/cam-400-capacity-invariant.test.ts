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
 *
 * Two QA-added extensions beyond the 8-cell matrix (real gaps found while
 * proving every AC, not scope creep):
 *
 *  1. EC-1 INTEGRATION (mandatory oracle) — WC-2 above proves the write-GATE
 *     FUNCTION rejects capacity=0 in isolation; it does not prove the real
 *     POST /api/bookings ROUTE wires that verdict into a 409 + never reaches
 *     booking.create. Added as a second describe block mirroring cam-355's
 *     established "Group F" convention for this exact route.
 *
 *  2. AC-3/EC-3/BR-4 component defense-in-depth (button + handleReserve) —
 *     components/CampgroundDetailClient.tsx had ZERO test coverage for the
 *     `isFullyBooked` button-disable + handleReserve early-return this story
 *     added (confirmed by a real coverage run: 0% on that file). This project
 *     has no jsdom/RTL harness for this component (vitest environment:'node'
 *     — see __tests__/cam-396-booking-login-gate.test.ts's own header note),
 *     so coverage follows that file's established source-inspection Prove-It
 *     convention rather than a render-based test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports (mirrors cam-355-per-spot-capacity-
// enforcement.test.ts's established convention for this same seam).
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    campSite: { findUnique: vi.fn(), findMany: vi.fn() },
    booking: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    blockedDate: { findMany: vi.fn(), findFirst: vi.fn() },
    internalHold: { findMany: vi.fn() },
    spot: { findMany: vi.fn() },
  },
}));

// GET /api/campsites/[id]/availability imports '@/lib/auth' for its lazy
// non-public-camp gate — every fixture here is a public camp (isActive:true,
// isPublished:true, deletedAt:null) so auth() is never actually invoked;
// mocked purely to avoid pulling in next-auth's runtime resolution.
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));

// POST /api/bookings (the EC-1 mandatory-oracle group below) — mocked exactly
// as cam-355-per-spot-capacity-enforcement.test.ts's established Group F
// convention for this same route.
vi.mock('@/lib/auth-utils', () => ({ requireAuth: vi.fn() }));
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
vi.mock('@/lib/serialize', () => ({ serializeDecimals: vi.fn((x) => x) }));

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { getRemainingCapacity, checkDateAvailabilityInTx } from '@/lib/campsite-availability';

const { GET: availabilityGET } = await import('@/app/api/campsites/[id]/availability/route');
const { POST: bookingsPOST } = await import('@/app/api/bookings/route');

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

// ===========================================================================
// EC-1 — INTEGRATION: the real POST /api/bookings route (the mandatory
// oracle, cam-355 Group F convention). WC-2 above proves the write-GATE
// FUNCTION rejects capacity=0 in isolation; that is not the same claim as
// "a direct POST bypassing the reserve button is rejected" — the route must
// actually WIRE checkDateAvailabilityInTx's verdict into a 409 response and
// never reach booking.create. This is AC-1's full contract (Thai copy is a
// client-side toast per CAM-396 BR-2 — any non-ok response renders
// `จองไม่สำเร็จ`, asserted at the component layer, not re-derived from the
// server's raw message here; the two System-effect facts — 409 + no Booking
// row — are exactly what this oracle proves).
// ===========================================================================

describe('CAM-400 EC-1 — POST /api/bookings rejects a direct dispatch against a 0-capacity whole-camp, independent of any button state (the mandatory oracle)', () => {
  const BOOKING_USER_ID = 'aaaaaaaa-0000-4000-8000-0000004000ff';

  beforeEach(() => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: null,
      session: { user: { id: BOOKING_USER_ID, email: 'camper@campvibe.com', name: 'Camper' } },
    });
  });

  function wireBookingTransaction(tx: unknown) {
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)
    );
  }

  function makeBookingPostRequest(guests: number): NextRequest {
    return new NextRequest('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        campSiteId: CAMP_ID,
        checkInDate: NIGHT_ISO,
        checkOutDate: CHECKOUT_ISO,
        guests,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('[MANDATORY ORACLE][ec-1][ac-1] a whole-camp camp with maxGuestsPerDay=0 and ZERO existing bookings -> 409 "Capacity exceeded", no Booking row created (the exact CAM-400 bug, proven at the route, not just the unit)', async () => {
    const create = vi.fn();
    const tx = {
      booking: {
        findFirst: vi.fn().mockResolvedValue(null), // no spotId supplied -> never consulted
        findMany: vi.fn().mockResolvedValue([]), // zero pre-existing bookings — the bug needs none
        create,
      },
      campSite: {
        findUnique: vi.fn().mockResolvedValue({ useSpotView: false, maxGuestsPerDay: 0, maxTentsPerDay: null }),
      },
      blockedDate: { findFirst: vi.fn().mockResolvedValue(null) },
      internalHold: { findMany: vi.fn().mockResolvedValue([]) },
      spot: { findMany: vi.fn() },
    };
    wireBookingTransaction(tx);

    const res = await bookingsPOST(makeBookingPostRequest(1));
    const body = await res.json();

    expect(res.status, 'AC-1 system effect: server rejects').toBe(409);
    expect(body.error).toBe('Capacity exceeded');
    expect(body.details).toMatch(/Exceeds maximum guests per day \(0\)/);
    expect(create, 'AC-1 system effect: no Booking row created').not.toHaveBeenCalled();
  });

  it('[regression][ec-4] the same route accepts a whole-camp camp with maxGuestsPerDay=null (unlimited) — 201, Booking row created', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'booking-400-null', status: 'PENDING' });
    const tx = {
      booking: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create,
      },
      campSite: {
        findUnique: vi.fn().mockResolvedValue({
          id: CAMP_ID,
          useSpotView: false,
          nameTh: 'แคมป์ทดสอบ',
          nameEn: 'Test Camp',
          priceLow: 500,
          priceCurrency: 'THB',
          checkInTime: '14:00',
          checkOutTime: '12:00',
          maxGuestsPerDay: null,
          maxTentsPerDay: null,
          extraFeeAmount: null,
          spots: [],
          location: { countryRel: { vatRate: 0, timezone: 'Asia/Bangkok' } },
        }),
      },
      blockedDate: { findFirst: vi.fn().mockResolvedValue(null) },
      internalHold: { findMany: vi.fn().mockResolvedValue([]) },
      spot: { findMany: vi.fn() },
    };
    wireBookingTransaction(tx);

    const res = await bookingsPOST(makeBookingPostRequest(6));

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledOnce();
  });
});

// ===========================================================================
// AC-3/EC-3/BR-4 — client defense-in-depth (button disabled + handleReserve
// early-return). Source-inspection Prove-It (no jsdom harness for this
// component — mirrors __tests__/cam-396-booking-login-gate.test.ts exactly).
// ===========================================================================

const clientSrc = readFileSync(
  resolve(__dirname, '..', 'components/CampgroundDetailClient.tsx'),
  'utf-8'
);

function extractHandleReserveBody(src: string): string {
  const start = src.indexOf('const handleReserve = async () => {');
  expect(start, 'handleReserve must exist').toBeGreaterThan(-1);
  const end = src.indexOf('};', start);
  expect(end, 'handleReserve must close with `};`').toBeGreaterThan(start);
  return src.slice(start, end);
}

describe('CAM-400 AC-3/EC-3/BR-4 — reserve button disables + handleReserve early-returns when isFullyBooked (double defense)', () => {
  const handleReserveBody = extractHandleReserveBody(clientSrc);

  it('[unit][ac-3] the reserve <Button> disabled expression includes isFullyBooked (fades/disables when the banner says เต็มแล้ว)', () => {
    // Prove-It: FAILS on the pre-CAM-400 source (`disabled={isReserving}` only)
    // — a camp the banner calls full would still render a clickable button.
    expect(clientSrc).toMatch(/disabled=\{isReserving\s*\|\|\s*isFullyBooked\}/);
  });

  it('[unit][ec-3] handleReserve early-returns on isFullyBooked BEFORE the /api/bookings fetch (independent of the button)', () => {
    // Independent of any button/disabled prop — proves a direct dispatch
    // (e.g. a stale disabled attribute, a re-enabled button, a scripted
    // click) still cannot reach the network call.
    const gateIdx = handleReserveBody.indexOf('if (isFullyBooked)');
    const fetchIdx = handleReserveBody.indexOf('fetch("/api/bookings"');
    expect(gateIdx, 'the isFullyBooked gate must exist').toBeGreaterThan(-1);
    expect(fetchIdx, 'the /api/bookings fetch must exist').toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(fetchIdx);
  });

  it('[unit][ec-3] the isFullyBooked gate is a bare early return (no side effect before it)', () => {
    const gateBlock = handleReserveBody.slice(
      handleReserveBody.indexOf('if (isFullyBooked)'),
      handleReserveBody.indexOf('if (isFullyBooked)') + 60
    );
    expect(gateBlock).toContain('return;');
  });

  it('[unit][ac-3] the isFullyBooked gate is checked AFTER the login gate but BEFORE the date-selection guard (double defense sits after auth, ahead of every other check)', () => {
    const loginGateIdx = handleReserveBody.indexOf('if (!isLoggedInLive)');
    const fullGateIdx = handleReserveBody.indexOf('if (isFullyBooked)');
    const dateGuardIdx = handleReserveBody.indexOf('if (!checkIn || !checkOut)');
    expect(loginGateIdx).toBeGreaterThan(-1);
    expect(fullGateIdx).toBeGreaterThan(-1);
    expect(dateGuardIdx).toBeGreaterThan(-1);
    expect(loginGateIdx).toBeLessThan(fullGateIdx);
    expect(fullGateIdx).toBeLessThan(dateGuardIdx);
  });

  it('[unit][br-1] isFullyBooked itself is derived server-authoritatively (remaining===0 or blockedByHost), never a client-only guess', () => {
    // Guards the derivation this whole story depends on client-side — a
    // regression here would silently disagree with the server invariant
    // this suite's Layer-2/Layer-3 assertions (WC-2 etc.) already pin.
    expect(clientSrc).toMatch(
      /isFullyBooked\s*=\s*!!remainingCapacity\s*&&\s*\(remainingCapacity\.blockedByHost\s*\|\|\s*remainingCapacity\.remaining\s*===\s*0\)/
    );
  });
});
