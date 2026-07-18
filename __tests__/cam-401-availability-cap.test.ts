/**
 * cam-401-availability-cap.test.ts — CAM-401
 *
 * "Cap the per-night loop on the availability endpoint (client-controlled
 * range can spin uncapped)" — security finding from the CAM-400 review:
 * getCampSiteDailyAvailability's `while (currentDate <= endDate)` iterates
 * over a CLIENT-supplied range, reachable unauthenticated. Full story:
 * docs/specs/booking-reliability/booking-reliability-every-camper-can-complete-a-bo/
 * CAM-401-cap-the-per-night-loop-on-the-availability-endpoin/story.md
 *
 * AC → test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-1/EC-1  a normal range (≤366 nights) computes exactly as before; the
 *            =366 boundary is explicitly allowed (inclusive per this
 *            function's own long-standing endDate-inclusive convention).
 * AC-2       a range >366 nights (and the exact 2026-01-01..9999-12-31 attack
 *            shape) is rejected — throws BEFORE any Prisma call at the lib
 *            layer, and the availability ROUTE maps it to 400 with no
 *            stack/detail leak.
 * EC-2       inverted (startDate>endDate) / non-finite (Invalid Date) ranges
 *            are UNCHANGED — no new rejection introduced (they already fall
 *            through to 0 loop iterations today).
 * BR-1       the cap reuses MAX_STATUS_RANGE_NIGHTS — ONE constant, not a
 *            twin — checked BEFORE any Prisma call or loop.
 * BR-2       §15b sweep: every per-night/per-day loop over client-derived
 *            ranges in lib/campsite-availability.ts + app/api/campsites/**
 *            is inventoried; the two findings beyond the primary loop
 *            (InternalHold has no max-span cap at write time, unlike
 *            Booking/BlockedDate) are closed here too — see Group B/C below.
 *            NO-CHANGE items (Booking 30-night cap, BlockedDate 90-day cap,
 *            checkDateAvailabilityInTx's single-date probe) are pinned in
 *            Group E so a future removal of those caps fails this suite.
 * BR-3       the widget's own calls stay within the cap (existing test
 *            fixtures across the suite are all small ranges — see Group F).
 *
 * Layers:
 *   - getCampSiteDailyAvailability / getAvailabilityStatusForCamps → unit,
 *     mocked @/lib/prisma (no DB) — mirrors cam-344/cam-400's convention.
 *   - GET /api/campsites/[id]/availability → integration, direct route
 *     invocation with mocked prisma.
 *   - POST /api/campsites/[id]/holds → integration, direct route invocation
 *     (mirrors cam-302's established convention for this same route).
 *
 * Coverage matrix per .claude/rules/qa.md: normal · null/empty · boundary ·
 * error/validation · concurrent/ordering (N/A — no shared mutable state).
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports (mirrors cam-344/cam-302/cam-400's
// established convention for this same seam).
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    campSite: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    blockedDate: {
      findMany: vi.fn(),
    },
    internalHold: {
      findMany: vi.fn(),
    },
    spot: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/auth-utils', () => ({
  requireAuth: vi.fn(),
  requireCampSitePermission: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireCampSitePermission } from '@/lib/auth-utils';
import {
  getCampSiteDailyAvailability,
  getAvailabilityStatusForCamps,
  AvailabilityRangeTooWideError,
  MAX_STATUS_RANGE_NIGHTS,
} from '@/lib/campsite-availability';

const { GET: availabilityGET } = await import('@/app/api/campsites/[id]/availability/route');
const { POST: holdsPOST } = await import('@/app/api/campsites/[id]/holds/route');

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function src(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

const CAMP_ID = 'aaaaaaaa-0000-4000-8000-000000000401';
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

// ===========================================================================
// Group A: getCampSiteDailyAvailability — DoS guard (BR-1, AC-1/AC-2, EC-1/EC-2)
// ===========================================================================

describe('getCampSiteDailyAvailability — DoS guard (MAX_STATUS_RANGE_NIGHTS reused)', () => {
  it('[normal][ac-1] a normal 5-day range computes exactly as before, no throw', async () => {
    const result = await getCampSiteDailyAvailability(CAMP_ID, d('2026-09-10'), d('2026-09-14'));

    expect(Object.keys(result)).toHaveLength(5);
    expect(prisma.booking.findMany).toHaveBeenCalledOnce();
  });

  it('[boundary][ec-1] exactly 366 days (inclusive) is ALLOWED — runs the real queries', async () => {
    const start = d('2026-01-01');
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + (MAX_STATUS_RANGE_NIGHTS - 1)); // inclusive span = 366 days

    await expect(getCampSiteDailyAvailability(CAMP_ID, start, end)).resolves.toBeDefined();
    expect(prisma.booking.findMany).toHaveBeenCalledOnce();
  });

  it('[boundary][ac-2] 367 days (MAX+1) is REJECTED — throws BEFORE any Prisma call', async () => {
    const start = d('2026-01-01');
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + MAX_STATUS_RANGE_NIGHTS); // inclusive span = 367 days

    await expect(getCampSiteDailyAvailability(CAMP_ID, start, end)).rejects.toThrow(
      AvailabilityRangeTooWideError
    );
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(prisma.blockedDate.findMany).not.toHaveBeenCalled();
    expect(prisma.internalHold.findMany).not.toHaveBeenCalled();
  });

  it('[dos][ac-2] the exact attack shape (2026-01-01 -> 9999-12-31) throws with NO DB calls', async () => {
    await expect(
      getCampSiteDailyAvailability(CAMP_ID, d('2026-01-01'), new Date('9999-12-31T00:00:00.000Z'))
    ).rejects.toThrow(AvailabilityRangeTooWideError);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('[error/validation][ec-2] inverted range (startDate > endDate) is UNCHANGED — no throw, empty result', async () => {
    const result = await getCampSiteDailyAvailability(CAMP_ID, d('2026-09-14'), d('2026-09-10'));

    expect(result).toEqual({});
    expect(prisma.booking.findMany).toHaveBeenCalledOnce(); // unchanged existing behavior
  });

  it('[null/empty][ec-2] a non-finite (Invalid Date) endDate is UNCHANGED — no throw, empty result', async () => {
    const result = await getCampSiteDailyAvailability(CAMP_ID, d('2026-09-10'), new Date('garbage'));

    expect(result).toEqual({});
  });

  it('[br-1] the guard reuses the SAME MAX_STATUS_RANGE_NIGHTS export — no new twin constant', () => {
    const source = src('lib/campsite-availability.ts');
    const defs = source.match(/MAX_STATUS_RANGE_NIGHTS\s*=\s*366/g) ?? [];

    expect(defs).toHaveLength(1); // one definition, reused by every guard in this file
    expect(source).toContain('if (dayCount > MAX_STATUS_RANGE_NIGHTS)');
  });
});

// ===========================================================================
// Group B: getCampSiteDailyAvailability — hold-loop clamp (BR-2 sweep finding)
// ===========================================================================

describe('getCampSiteDailyAvailability — hold-loop clamp (BR-2 sweep finding)', () => {
  it('[hold-clamp] a hold spanning far wider than the requested window is traversed ONLY within the window', async () => {
    // InternalHold has NO max-span cap at write time (unlike Booking/
    // BlockedDate) — this ~30-year hold merely OVERLAPS the 3-day request.
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2000-01-01'), endDate: d('2030-01-01'), guests: 2 },
    ]);

    const setDateSpy = vi.spyOn(Date.prototype, 'setDate');
    const result = await getCampSiteDailyAvailability(CAMP_ID, d('2026-09-10'), d('2026-09-12'));
    const iterations = setDateSpy.mock.calls.length;
    setDateSpy.mockRestore();

    // Without the clamp, the hold loop alone would run ~10,957 times
    // (2000-01-01 -> 2030-01-01). Bounded here to the 3-day request window
    // regardless of the hold's own ~30-year span — proves the fix has teeth.
    expect(iterations).toBeLessThan(20);
    expect(result['2026-09-10'].heldGuests).toBe(2);
    expect(result['2026-09-11'].heldGuests).toBe(2);
    expect(result['2026-09-12'].heldGuests).toBe(2);
  });

  it('[boundary] at the exact 366-night window (the cap boundary, comparison parity with EC-1), the clamp reaches the FULL last night — not cut short', async () => {
    // Same ~30-year hold as above, but the requested window is now exactly
    // MAX_STATUS_RANGE_NIGHTS wide (the same boundary Group A's EC-1 proves
    // for the primary loop) — the clamp must traverse every night up to and
    // including the LAST one, not stop early.
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2000-01-01'), endDate: d('2030-01-01'), guests: 3 },
    ]);
    const start = d('2026-01-01');
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + (MAX_STATUS_RANGE_NIGHTS - 1)); // inclusive span = 366 days

    const setDateSpy = vi.spyOn(Date.prototype, 'setDate');
    const result = await getCampSiteDailyAvailability(CAMP_ID, start, end);
    const iterations = setDateSpy.mock.calls.length;
    setDateSpy.mockRestore();

    const lastKey = end.toISOString().split('T')[0];
    expect(Object.keys(result)).toHaveLength(366);
    expect(result[lastKey].heldGuests).toBe(3); // reaches the 366th (last) night, not truncated
    // init loop (366) + hold loop clamped to <=366 = well under the ~10,957
    // the hold's own unclamped span would otherwise cost.
    expect(iterations).toBeLessThan(800);
  });

  it('[normal] a hold entirely WITHIN the requested window (no clamping needed) still counts exactly as before — no regression on the un-clamped branch', async () => {
    // Exercises the ternary's OTHER branch (hold.startDate >= startDate) —
    // the ordinary case this fix must never disturb.
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-09-11'), endDate: d('2026-09-13'), guests: 4 }, // endDate exclusive checkout
    ]);

    const result = await getCampSiteDailyAvailability(CAMP_ID, d('2026-09-10'), d('2026-09-12'));

    expect(result['2026-09-10'].heldGuests).toBe(0); // before the hold starts
    expect(result['2026-09-11'].heldGuests).toBe(4);
    expect(result['2026-09-12'].heldGuests).toBe(4);
  });
});

// ===========================================================================
// Group C: getAvailabilityStatusForCamps — sibling hold-loop clamp (BR-2 sweep)
// ===========================================================================

describe('getAvailabilityStatusForCamps — sibling hold-loop clamp (BR-2 sweep finding)', () => {
  it('[hold-clamp] a hold spanning far wider than the requested window is traversed ONLY within the window', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_ID, useSpotView: false, maxGuestsPerDay: 5 },
    ]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { campSiteId: CAMP_ID, startDate: d('2000-01-01'), endDate: d('2030-01-01'), guests: 2 },
    ]);

    const setDateSpy = vi.spyOn(Date.prototype, 'setDate');
    const result = await getAvailabilityStatusForCamps([CAMP_ID], d('2026-09-10'), d('2026-09-13'), 1);
    const iterations = setDateSpy.mock.calls.length;
    setDateSpy.mockRestore();

    expect(iterations).toBeLessThan(20);
    // 2 heldGuests < capacity 5 on every night — not unavailable on its own;
    // this test's point is the bounded iteration count, not the classification.
    expect(result[CAMP_ID]).toBeUndefined();
  });

  it('[boundary] at the exact 366-night window (comparison parity with the primary loop), the clamp reaches the FULL last night — not cut short', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_ID, useSpotView: false, maxGuestsPerDay: 5 },
    ]);
    // heldGuests=5 + requestedGuests=1 > capacity 5 -> numerically full on
    // EVERY night ONLY IF the clamp actually reaches that night. If the clamp
    // were off-by-one short, the last night would read heldGuests=0 (not
    // full) and the result would be PARTIALLY_UNAVAILABLE instead — this
    // assertion has teeth at the boundary, not just an iteration count.
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { campSiteId: CAMP_ID, startDate: d('2000-01-01'), endDate: d('2030-01-01'), guests: 5 },
    ]);

    const start = d('2026-01-01');
    const lastNight = new Date(start);
    lastNight.setUTCDate(lastNight.getUTCDate() + (MAX_STATUS_RANGE_NIGHTS - 1)); // 366 nights inclusive
    const end = new Date(lastNight);
    end.setUTCDate(end.getUTCDate() + 1); // endDate is the EXCLUSIVE checkout day for this function

    const setDateSpy = vi.spyOn(Date.prototype, 'setDate');
    const result = await getAvailabilityStatusForCamps([CAMP_ID], start, end, 1);
    const iterations = setDateSpy.mock.calls.length;
    setDateSpy.mockRestore();

    expect(result[CAMP_ID]).toBe('FULLY_UNAVAILABLE'); // proves the 366th (last) night is populated
    expect(iterations).toBeLessThan(800);
  });

  it('[normal] a hold entirely WITHIN the requested window (no clamping needed) still counts exactly as before — no regression on the un-clamped branch', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_ID, useSpotView: false, maxGuestsPerDay: 5 },
    ]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { campSiteId: CAMP_ID, startDate: d('2026-09-11'), endDate: d('2026-09-13'), guests: 6 },
    ]);

    const result = await getAvailabilityStatusForCamps([CAMP_ID], d('2026-09-10'), d('2026-09-13'), 1);

    // 6 heldGuests + 1 requested > capacity 5 on nights 09-11/09-12 only
    // (09-10 has no hold yet) -> some-but-not-all unavailable nights.
    expect(result[CAMP_ID]).toBe('PARTIALLY_UNAVAILABLE');
  });
});

// ===========================================================================
// Group D: POST /api/campsites/[id]/holds — write-path span cap (BR-2 sweep,
// most severe finding: an unbounded per-night DB query inside a serializable
// transaction, driven directly by the request body).
// ===========================================================================

describe('POST /api/campsites/[id]/holds — write-path span cap (BR-2 sweep finding)', () => {
  const hostSession = { user: { id: 'host-1', email: 'host@campvibe.com', role: 'OPERATOR' } };
  const allowedResult = { error: null, campSite: { id: CAMP_ID } as never, session: hostSession as never };

  function postReq(body: unknown) {
    return new NextRequest(`http://localhost/api/campsites/${CAMP_ID}/holds`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
  }

  function futureRange(nights: number) {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 1);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + nights); // endDate is EXCLUSIVE checkout (createHoldSchema)
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }

  beforeEach(() => {
    (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue(allowedResult);
  });

  it('[normal] a short 2-night hold clears the span-cap check and reaches $transaction', async () => {
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue({
      type: 'ok',
      hold: { id: 'hold-1' },
    });

    const res = await holdsPOST(postReq({ ...futureRange(2), guests: 1 }), makeParams(CAMP_ID));

    expect(res.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('[boundary] exactly 366 nights is ALLOWED at the span-cap check (reaches $transaction)', async () => {
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue({
      type: 'ok',
      hold: { id: 'hold-1' },
    });

    const res = await holdsPOST(
      postReq({ ...futureRange(MAX_STATUS_RANGE_NIGHTS), guests: 1 }),
      makeParams(CAMP_ID)
    );

    expect(res.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('[boundary][security] a 367-night hold span is REJECTED 400 BEFORE the transaction opens (reuses MAX_STATUS_RANGE_NIGHTS, no new value)', async () => {
    const res = await holdsPOST(
      postReq({ ...futureRange(MAX_STATUS_RANGE_NIGHTS + 1), guests: 1 }),
      makeParams(CAMP_ID)
    );

    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('[dos] a 10-year hold span is REJECTED 400 with no transaction attempt', async () => {
    const res = await holdsPOST(postReq({ ...futureRange(3650), guests: 1 }), makeParams(CAMP_ID));

    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('[dos][abuse-shape] an ~8000-year span (mirrors the primary-loop attack shape, 2026-01-01 -> 9999-12-31) is REJECTED 400 with ZERO prisma calls of any kind', async () => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 1);
    const res = await holdsPOST(
      postReq({
        startDate: start.toISOString().split('T')[0],
        endDate: '9999-12-31',
        guests: 1,
      }),
      makeParams(CAMP_ID)
    );

    expect(res.status).toBe(400);
    // Query-count zero: the span check runs BEFORE the spot lookup AND before
    // the transaction — no Prisma call of any kind is reached for this shape.
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.spot.findFirst).not.toHaveBeenCalled();
    expect(prisma.internalHold.findMany).not.toHaveBeenCalled();
  });

  it('[security] the 400 span-cap rejection leaks no internal detail (generic message, no stack/details)', async () => {
    const res = await holdsPOST(
      postReq({ ...futureRange(MAX_STATUS_RANGE_NIGHTS + 1), guests: 1 }),
      makeParams(CAMP_ID)
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe(`Hold cannot exceed ${MAX_STATUS_RANGE_NIGHTS} nights`);
    expect(body.details).toBeUndefined();
    expect(body.stack).toBeUndefined();
    // no stray Prisma/path/stack fragment anywhere in the response body
    expect(JSON.stringify(body)).not.toMatch(/(prisma|\.ts:\d|node_modules|at\s+\w+\s+\()/i);
  });

  it('[br-1] the route reuses the SAME MAX_STATUS_RANGE_NIGHTS import — no new business-rule constant', () => {
    const routeSrc = src('app/api/campsites/[id]/holds/route.ts');
    expect(routeSrc).toContain(
      "import { checkDateAvailabilityInTx, MAX_STATUS_RANGE_NIGHTS } from '@/lib/campsite-availability'"
    );
    expect(routeSrc).toContain('holdNights > MAX_STATUS_RANGE_NIGHTS');
  });
});

// ===========================================================================
// Group E: GET /api/campsites/[id]/availability — route maps the guard to 400
// ===========================================================================

describe('GET /api/campsites/[id]/availability — AC-2 range-too-wide maps to 400, no leak', () => {
  beforeEach(() => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isActive: true,
      isPublished: true,
      deletedAt: null,
      operatorId: 'op-1',
      useSpotView: false,
      maxGuestsPerDay: 5,
      maxTentsPerDay: null,
    });
  });

  it('[ac-2] an absurd startDate/endDate span returns 400 with a safe generic message (no stack)', async () => {
    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMP_ID}/availability?startDate=2026-01-01&endDate=9999-12-31`
    );
    const res = await availabilityGET(req, makeParams(CAMP_ID));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Date range too wide');
    expect(body.stack).toBeUndefined();
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('[normal] a normal small range still returns 200 with computed availability (no regression)', async () => {
    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMP_ID}/availability?startDate=2026-09-10&endDate=2026-09-12`
    );
    const res = await availabilityGET(req, makeParams(CAMP_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.availability).toHaveLength(3);
  });

  it('[error/validation] an unrelated Prisma failure still maps to the pre-existing generic 500 (not swallowed by the new 400 branch)', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMP_ID}/availability?startDate=2026-09-10&endDate=2026-09-12`
    );
    const res = await availabilityGET(req, makeParams(CAMP_ID));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to fetch availability');
  });
});

// ===========================================================================
// Group F: BR-2 sweep — NO-CHANGE items (already safely bounded elsewhere)
// ===========================================================================

describe('BR-2 sweep — NO-CHANGE items already safely bounded by an existing write-time cap', () => {
  it('Booking is capped at 30 nights at create (lib/validations/booking.ts) — bounds the booking per-night loop', () => {
    const source = src('lib/validations/booking.ts');
    expect(source).toContain('nights <= 30');
  });

  it('BlockedDate is capped at 90 days at create (lib/validations/blocked-dates.ts) — bounds the blockedDate per-night loop', () => {
    const source = src('lib/validations/blocked-dates.ts');
    expect(source).toContain('BLOCKED_DATE_MAX_RANGE_DAYS = 90');
  });

  it('checkDateAvailabilityInTx probes a SINGLE date per call (the per-night loop lives in its callers) — its internal booking scan is bounded by the SAME 30-night Booking cap', () => {
    const source = src('lib/campsite-availability.ts');
    expect(source).toContain('export async function checkDateAvailabilityInTx(');
    // Confirms this function takes one `date: Date`, not a range — the
    // caller (app/api/bookings/route.ts / holds/route.ts) owns the per-night
    // loop, and the booking-write loop is already capped at 30 nights.
    const fnMatch = source.match(/export async function checkDateAvailabilityInTx\(([\s\S]*?)\)/);
    expect(fnMatch).not.toBeNull();
    expect(fnMatch![1]).toContain('date: Date');
  });
});
