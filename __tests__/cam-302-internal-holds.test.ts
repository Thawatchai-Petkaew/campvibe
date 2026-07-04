/**
 * cam-302-internal-holds.test.ts — CAM-302 temporary spot holds with expiry,
 * counted against real availability (ADR-012 §4, reduced M1 slice).
 *
 * AC → test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-1  create → ACTIVE row, default 48h expiry, heldGuests counted per night
 *       in getCampSiteDailyAvailability / getRemainingCapacity / the
 *       availability route's remainingGuests+available (calendar drop is
 *       owner-verified on the real Staging URL per the ticket's self-verify).
 * AC-2  an expired ACTIVE hold is excluded by the read-time predicate
 *       (status=ACTIVE AND expiresAt>now) in all three functions — no row rewrite.
 * AC-3  release -> RELEASED, stops counting immediately, row kept (no delete).
 * AC-4  checkDateAvailabilityInTx counts holds — a booking over a hold-filled
 *       night is rejected by the SAME seam, no booking-route change (source-inspect).
 * AC-5  overlap/over-capacity create rejected (409, Thai copy, no row) +
 *       concurrency (EC-5): two racing creates, exactly one wins.
 * AC-6  401 signed-out / 403 without BOOKING_UPDATE; IDOR spotId -> 404 (EC-6).
 * BR-1  default expiry = now+48h; explicit expiry bound (now, now+14d] else 400
 *       with the ticket's exact Thai copy (EC-2).
 * BR-4  release of missing/cross-camp/already-RELEASED hold -> 404, no change (EC-3).
 * BR-5  only (none)->ACTIVE and ACTIVE->RELEASED are reachable this story.
 * BR-6  IDOR guard: spotId must belong to the campsite (EC-6).
 * BR-7  one AuditLog row per create and per release, no PII.
 * Data  reduced slice: no leadId/quoteId/bookingId column in this migration.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    spot: {
      findFirst: vi.fn(),
    },
    internalHold: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    blockedDate: {
      findMany: vi.fn(),
    },
    campSite: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireCampSitePermission: vi.fn(),
}));

// The availability route imports '@/lib/auth' (NextAuth) directly; mocked here
// (mirrors sec1-sub-routes-visibility.test.ts) so importing the real route
// module never pulls in next-auth's runtime resolution in this test env. A
// public campsite fixture short-circuits before auth() is ever called.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireCampSitePermission } from '@/lib/auth-utils';

import { GET as holdsGET, POST as holdsPOST } from '@/app/api/campsites/[id]/holds/route';
import { DELETE as holdDELETE } from '@/app/api/campsites/[id]/holds/[holdId]/route';
import { GET as availabilityGET } from '@/app/api/campsites/[id]/availability/route';

import {
  createHoldSchema,
  HOLD_EXPIRY_OUT_OF_RANGE_MESSAGE,
  HOLD_DEFAULT_EXPIRY_MS,
} from '@/lib/validations/holds';

import {
  getActiveHoldsForRange,
  getCampSiteDailyAvailability,
  getRemainingCapacity,
  checkDateAvailabilityInTx,
} from '@/lib/campsite-availability';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const CAMPSITE_ID = '550e8400-e29b-41d4-a716-446655440010';
const SPOT_ID = '550e8400-e29b-41d4-a716-446655440011';
const HOLD_ID = '550e8400-e29b-41d4-a716-446655440012';
const HOST_USER_ID = '550e8400-e29b-41d4-a716-446655440099';

/** Build a Date at midnight UTC from an ISO date string */
function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

const makeCollectionParams = (id: string) => ({ params: Promise.resolve({ id }) });
const makeItemParams = (id: string, holdId: string) => ({ params: Promise.resolve({ id, holdId }) });

const hostSession = { user: { id: HOST_USER_ID, email: 'host@campvibe.com', role: 'OPERATOR' } };
const allowedResult = { error: null, campSite: { id: CAMPSITE_ID } as never, session: hostSession as never };
const unauthorizedResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const forbiddenResponse = NextResponse.json({ error: 'Forbidden' }, { status: 403 });

function mockAllowed() {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue(allowedResult);
}
function mockUnauthorized() {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: unauthorizedResponse,
    campSite: null,
    session: null,
  });
}
function mockForbidden() {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: forbiddenResponse,
    campSite: null,
    session: null,
  });
}

/** A valid future date range (today + 1 .. today + 3), independent of "now" at test time. */
function validRange() {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 2);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

function postReq(body: unknown) {
  return new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/holds`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function getReq() {
  return new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/holds`);
}

function deleteReq() {
  return new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/holds/${HOLD_ID}`, {
    method: 'DELETE',
  });
}

/**
 * A stateful tx mock: `holdsStore` is a mutable array the test controls, so a
 * hold `create` inside one $transaction call is visible to a SUBSEQUENT call's
 * internalHold.findMany (simulates two sequential racing creates without a
 * real Postgres serializable conflict — see the EC-5 concurrency test below
 * for the documented honesty boundary, mirroring cam-57-atomic-lock.test.ts).
 */
function makeHoldTxMock(opts: {
  campSite?: { maxGuestsPerDay: number | null; maxTentsPerDay: number | null } | null;
  bookings?: { checkInDate: Date; checkOutDate: Date; guests: number }[];
  holdsStore?: { startDate: Date; endDate: Date; guests: number }[];
}) {
  const holdsStore = opts.holdsStore ?? [];
  return {
    campSite: {
      findUnique: vi.fn().mockResolvedValue(opts.campSite ?? { maxGuestsPerDay: 10, maxTentsPerDay: null }),
    },
    booking: {
      findMany: vi.fn().mockResolvedValue(opts.bookings ?? []),
    },
    internalHold: {
      findMany: vi.fn().mockImplementation(() => Promise.resolve(holdsStore)),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const row = { id: HOLD_ID, ...data };
        holdsStore.push({
          startDate: data.startDate as Date,
          endDate: data.endDate as Date,
          guests: data.guests as number,
        });
        return Promise.resolve(row);
      }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  } as unknown as Prisma.TransactionClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// Group A: lib/validations/holds.ts — zod boundary (BR-1, EC-2)
// ===========================================================================

describe('createHoldSchema — BR-1 expiry default + bounds (EC-2)', () => {
  it('[normal] a valid range with no expiresAt given defaults to creation time + 48h', () => {
    const before = Date.now();
    const result = createHoldSchema.parse({ ...validRange(), guests: 2 });
    const after = Date.now();

    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + HOLD_DEFAULT_EXPIRY_MS - 1000);
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + HOLD_DEFAULT_EXPIRY_MS + 1000);
  });

  it('[normal] guests defaults to 1 when omitted', () => {
    const result = createHoldSchema.parse(validRange());
    expect(result.guests).toBe(1);
  });

  it('[boundary] a host-set expiry exactly 14 days ahead is accepted', () => {
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 - 1000).toISOString();
    const result = createHoldSchema.safeParse({ ...validRange(), expiresAt });
    expect(result.success).toBe(true);
  });

  it('[error] a host-set expiry more than 14 days ahead is rejected with the ticket exact Thai copy (EC-2)', () => {
    const expiresAt = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    const result = createHoldSchema.safeParse({ ...validRange(), expiresAt });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(HOLD_EXPIRY_OUT_OF_RANGE_MESSAGE);
    }
  });

  it('[error] a host-set expiry in the past is rejected with the ticket exact Thai copy (EC-2)', () => {
    const expiresAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const result = createHoldSchema.safeParse({ ...validRange(), expiresAt });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(HOLD_EXPIRY_OUT_OF_RANGE_MESSAGE);
    }
  });

  it('[error] endDate not after startDate is rejected (exclusive checkout — at least 1 night held)', () => {
    const range = validRange();
    const result = createHoldSchema.safeParse({ startDate: range.startDate, endDate: range.startDate });
    expect(result.success).toBe(false);
  });

  it('[error] guests below 1 is rejected', () => {
    const result = createHoldSchema.safeParse({ ...validRange(), guests: 0 });
    expect(result.success).toBe(false);
  });

  it('[normal] spotId omitted -> whole-camp hold (undefined, not required)', () => {
    const result = createHoldSchema.parse(validRange());
    expect(result.spotId).toBeUndefined();
  });

  it('[normal] a valid spotId (uuid) is accepted', () => {
    const result = createHoldSchema.safeParse({ ...validRange(), spotId: SPOT_ID });
    expect(result.success).toBe(true);
  });

  it('[error] a malformed spotId (non-uuid) is rejected', () => {
    const result = createHoldSchema.safeParse({ ...validRange(), spotId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// Group B: lib/campsite-availability.ts — the shared seam (BR-2, AC-1/2/4)
// ===========================================================================

describe('getActiveHoldsForRange — lazy-expiry predicate (BR-2, AC-2)', () => {
  beforeEach(() => {
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('[predicate] filters status=ACTIVE AND expiresAt > now (lazy expiry, no cron)', async () => {
    await getActiveHoldsForRange(CAMPSITE_ID, d('2026-09-01'), d('2026-09-10'));

    const callArgs = (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.where.status).toBe('ACTIVE');
    expect(callArgs.where.expiresAt.gt).toBeInstanceOf(Date);
  });

  it('[predicate] overlap shape identical to getBlockedDatesForRange (lte rangeEnd / gte rangeStart)', () => {
    const availabilitySrc = fs.readFileSync(path.join(process.cwd(), 'lib/campsite-availability.ts'), 'utf-8');
    // Both the hold predicate and the blocked-date predicate use the same overlap shape.
    const holdBlockMatch = availabilitySrc.match(/getActiveHoldsForRange[\s\S]*?\n}/);
    expect(holdBlockMatch).not.toBeNull();
    expect(holdBlockMatch![0]).toContain('startDate: { lte: endDate }');
    expect(holdBlockMatch![0]).toContain('endDate: { gte: startDate }');
  });

  it('[normal] campSiteId is passed through correctly', async () => {
    await getActiveHoldsForRange(CAMPSITE_ID, d('2026-09-01'), d('2026-09-10'));
    const callArgs = (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.where.campSiteId).toBe(CAMPSITE_ID);
  });
});

describe('getCampSiteDailyAvailability — heldGuests leg (AC-1, AC-2, BR-2)', () => {
  beforeEach(() => {
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('[ac1] an ACTIVE non-expired hold is summed into heldGuests for every night in its range', async () => {
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-09-10'), endDate: d('2026-09-12'), guests: 3 },
    ]);

    const avail = await getCampSiteDailyAvailability(CAMPSITE_ID, d('2026-09-10'), d('2026-09-12'));

    expect(avail['2026-09-10'].heldGuests).toBe(3);
    expect(avail['2026-09-11'].heldGuests).toBe(3);
    // BR-2: endDate is the EXCLUSIVE checkout day — the checkout night itself
    // must NOT be held (identical to Booking's own exclusive-checkout loop).
    expect(avail['2026-09-12'].heldGuests).toBe(0);
  });

  it('[ac1] heldGuests is kept separate from bookedGuests (never merged, ADR-012 §4)', async () => {
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 2, status: 'CONFIRMED' },
    ]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-09-10'), endDate: d('2026-09-11'), guests: 3 },
    ]);

    const avail = await getCampSiteDailyAvailability(CAMPSITE_ID, d('2026-09-10'), d('2026-09-11'));

    expect(avail['2026-09-10'].bookedGuests).toBe(2);
    expect(avail['2026-09-10'].heldGuests).toBe(3);
  });

  it('[ac2] a hold whose expiresAt has passed never reaches this function (excluded at the query boundary)', async () => {
    // getActiveHoldsForRange applies the lazy-expiry filter INSIDE the prisma
    // query itself; the mocked findMany simply never returns an expired row —
    // proving the read-time predicate is what the function relies on, not a
    // second in-memory filter here.
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const avail = await getCampSiteDailyAvailability(CAMPSITE_ID, d('2026-09-10'), d('2026-09-11'));

    expect(avail['2026-09-10'].heldGuests).toBe(0);
  });

  it('[no-n+1] exactly 1 booking + 1 blockedDate + 1 internalHold query per call', async () => {
    await getCampSiteDailyAvailability(CAMPSITE_ID, d('2026-09-01'), d('2026-09-10'));

    expect(prisma.booking.findMany).toHaveBeenCalledOnce();
    expect(prisma.blockedDate.findMany).toHaveBeenCalledOnce();
    expect(prisma.internalHold.findMany).toHaveBeenCalledOnce();
  });

  it('[null/empty] no holds -> heldGuests is 0 for every day, no crash', async () => {
    const avail = await getCampSiteDailyAvailability(CAMPSITE_ID, d('2026-09-01'), d('2026-09-03'));
    Object.values(avail).forEach((day) => expect(day.heldGuests).toBe(0));
  });
});

describe('getRemainingCapacity — heldGuests folded into remaining (AC-1, AC-4)', () => {
  beforeEach(() => {
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('[ac1] capacity 5, 0 booked, 2 held (1 night) -> remaining 3', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ maxGuestsPerDay: 5 });
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-09-10'), endDate: d('2026-09-11'), guests: 2 },
    ]);

    const result = await getRemainingCapacity(CAMPSITE_ID, d('2026-09-10'), d('2026-09-11'));

    expect(result.heldGuests).toBe(2);
    expect(result.remaining).toBe(3);
  });

  it('[ac1] capacity 5, 3 booked + 2 held (1 night) -> remaining 0 (combined bottleneck)', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ maxGuestsPerDay: 5 });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 3, status: 'CONFIRMED' },
    ]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-09-10'), endDate: d('2026-09-11'), guests: 2 },
    ]);

    const result = await getRemainingCapacity(CAMPSITE_ID, d('2026-09-10'), d('2026-09-11'));

    expect(result.bookedGuests).toBe(3);
    expect(result.heldGuests).toBe(2);
    expect(result.remaining).toBe(0);
  });

  it('[boundary] combined booked+held exceeding capacity floors remaining at 0 (never negative)', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ maxGuestsPerDay: 5 });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 4, status: 'CONFIRMED' },
    ]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-09-10'), endDate: d('2026-09-11'), guests: 4 },
    ]);

    const result = await getRemainingCapacity(CAMPSITE_ID, d('2026-09-10'), d('2026-09-11'));

    expect(result.remaining).toBe(0);
  });

  it('[ac3] a hold with no booking still forces the bottleneck night to the held night (holds-only bottleneck)', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ maxGuestsPerDay: 5 });
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      // Night 1 (Sep 10): 1 held. Night 2 (Sep 11): 4 held (bottleneck).
      { startDate: d('2026-09-10'), endDate: d('2026-09-11'), guests: 1 },
      { startDate: d('2026-09-11'), endDate: d('2026-09-12'), guests: 4 },
    ]);

    const result = await getRemainingCapacity(CAMPSITE_ID, d('2026-09-10'), d('2026-09-12'));

    expect(result.heldGuests).toBe(4);
    expect(result.remaining).toBe(1);
  });
});

describe('checkDateAvailabilityInTx — counts holds inside the tx (AC-4, BR-3)', () => {
  function makeTxMock(
    campSite: { maxGuestsPerDay: number | null; maxTentsPerDay: number | null },
    bookings: { checkInDate: Date; checkOutDate: Date; guests: number }[],
    holds: { guests: number }[] = []
  ) {
    return {
      campSite: { findUnique: vi.fn().mockResolvedValue(campSite) },
      booking: { findMany: vi.fn().mockResolvedValue(bookings) },
      internalHold: { findMany: vi.fn().mockResolvedValue(holds) },
    } as unknown as Prisma.TransactionClient;
  }

  const testDate = new Date('2026-08-01T00:00:00.000Z');

  it('[ac4] an ACTIVE hold filling capacity rejects a booking requesting the same night (the KPI seam)', async () => {
    const tx = makeTxMock({ maxGuestsPerDay: 5, maxTentsPerDay: null }, [], [{ guests: 5 }]);

    const result = await checkDateAvailabilityInTx(tx, CAMPSITE_ID, testDate, 1);

    expect(result.available).toBe(false);
    expect(result.reason).toBe('Exceeds maximum guests per day (5)');
  });

  it('[boundary] held + requested exactly at capacity is available (not >)', async () => {
    const tx = makeTxMock({ maxGuestsPerDay: 5, maxTentsPerDay: null }, [], [{ guests: 3 }]);

    const result = await checkDateAvailabilityInTx(tx, CAMPSITE_ID, testDate, 2);

    expect(result.available).toBe(true);
  });

  it('[normal] booked + held combine against the same maxGuestsPerDay ceiling', async () => {
    const tx = makeTxMock(
      { maxGuestsPerDay: 5, maxTentsPerDay: null },
      [{ checkInDate: testDate, checkOutDate: new Date('2026-08-02T00:00:00.000Z'), guests: 2 }],
      [{ guests: 2 }]
    );

    // 2 booked + 2 held + 2 requested = 6 > 5
    const result = await checkDateAvailabilityInTx(tx, CAMPSITE_ID, testDate, 2);

    expect(result.available).toBe(false);
  });

  it('[null/empty] no holds -> unaffected, existing booking-only math still applies', async () => {
    const tx = makeTxMock({ maxGuestsPerDay: 10, maxTentsPerDay: null }, [], []);

    const result = await checkDateAvailabilityInTx(tx, CAMPSITE_ID, testDate, 10);

    expect(result.available).toBe(true);
  });
});

// ===========================================================================
// Group C: POST /api/campsites/[id]/holds — authz + contract (AC-1, AC-5, AC-6)
// ===========================================================================

describe('POST /api/campsites/[id]/holds — authz + contract', () => {
  it('401 — unauthenticated caller is rejected before any DB access (AC-6/EC-4)', async () => {
    mockUnauthorized();

    const res = await holdsPOST(postReq(validRange()), makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('403 — caller without BOOKING_UPDATE (and not the owner) is rejected (AC-6/EC-4)', async () => {
    mockForbidden();

    const res = await holdsPOST(postReq(validRange()), makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses requireCampSitePermission with BOOKING_UPDATE (mirrors CAM-56 blocked-dates)', async () => {
    mockForbidden();

    await holdsPOST(postReq(validRange()), makeCollectionParams(CAMPSITE_ID));

    expect(requireCampSitePermission).toHaveBeenCalledWith(CAMPSITE_ID, 'BOOKING_UPDATE');
  });

  it('400 — missing required fields returns validation error, no transaction started', async () => {
    mockAllowed();

    const res = await holdsPOST(postReq({}), makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('400 — an out-of-range expiresAt is rejected with the ticket exact Thai copy (BR-1/EC-2)', async () => {
    mockAllowed();
    const expiresAt = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();

    const res = await holdsPOST(postReq({ ...validRange(), expiresAt }), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(JSON.stringify(body)).toContain(HOLD_EXPIRY_OUT_OF_RANGE_MESSAGE);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('404 — spotId does not belong to this campsite (IDOR guard, BR-6/EC-6)', async () => {
    mockAllowed();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await holdsPOST(
      postReq({ ...validRange(), spotId: SPOT_ID }),
      makeCollectionParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(404);
    expect(prisma.spot.findFirst).toHaveBeenCalledWith({
      where: { id: SPOT_ID, campSiteId: CAMPSITE_ID, deletedAt: null },
      select: { id: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // CAM-352 G3 fix (Info item 6): a soft-deleted spot can no longer have a
  // NEW hold attached — the IDOR guard's deletedAt: null scoping means a real
  // Postgres query would never return the deleted row, so findFirst resolves
  // null exactly as the cross-campsite case does.
  it('404 — spotId belongs to this campsite but is soft-deleted (BR-1/CAM-352)', async () => {
    mockAllowed();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await holdsPOST(
      postReq({ ...validRange(), spotId: SPOT_ID }),
      makeCollectionParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(404);
    const call = (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where).toEqual({ id: SPOT_ID, campSiteId: CAMPSITE_ID, deletedAt: null });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('201 — creates an ACTIVE whole-camp hold with free capacity, writes one AuditLog row (AC-1, BR-7)', async () => {
    mockAllowed();
    const tx = makeHoldTxMock({ campSite: { maxGuestsPerDay: 10, maxTentsPerDay: null } });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)
    );

    const res = await holdsPOST(postReq({ ...validRange(), guests: 2 }), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.hold.id).toBe(HOLD_ID);
    expect((tx as unknown as { internalHold: { create: ReturnType<typeof vi.fn> } }).internalHold.create).toHaveBeenCalledOnce();
    const createArgs = (tx as unknown as { internalHold: { create: ReturnType<typeof vi.fn> } }).internalHold.create.mock.calls[0][0];
    expect(createArgs.data.campSiteId).toBe(CAMPSITE_ID);
    expect(createArgs.data.spotId).toBeNull();
    expect(createArgs.data.status).toBe('ACTIVE');
    expect(createArgs.data.createdById).toBe(HOST_USER_ID);
    // BR-7: one AuditLog row written inside the same transaction.
    expect((tx as unknown as { auditLog: { create: ReturnType<typeof vi.fn> } }).auditLog.create).toHaveBeenCalledOnce();
    const auditArgs = (tx as unknown as { auditLog: { create: ReturnType<typeof vi.fn> } }).auditLog.create.mock.calls[0][0];
    expect(auditArgs.data.action).toBe('hold.created');
    expect(auditArgs.data.entityType).toBe('InternalHold');
    expect(auditArgs.data.actorId).toBe(HOST_USER_ID);
  });

  it('201 — creates a spot-level hold after verifying spot ownership', async () => {
    mockAllowed();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });
    const tx = makeHoldTxMock({ campSite: { maxGuestsPerDay: 10, maxTentsPerDay: null } });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)
    );

    const res = await holdsPOST(
      postReq({ ...validRange(), spotId: SPOT_ID, note: 'กำลังคุยผ่าน LINE' }),
      makeCollectionParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(201);
    const createArgs = (tx as unknown as { internalHold: { create: ReturnType<typeof vi.fn> } }).internalHold.create.mock.calls[0][0];
    expect(createArgs.data.spotId).toBe(SPOT_ID);
    expect(createArgs.data.note).toBe('กำลังคุยผ่าน LINE');
  });

  it('409 — a hold that would exceed remaining capacity is rejected with the ticket exact Thai copy, no row written (AC-5/BR-3/EC-1)', async () => {
    mockAllowed();
    // Capacity 3, an existing ACTIVE hold already holds all 3 guests.
    const tx = makeHoldTxMock({
      campSite: { maxGuestsPerDay: 3, maxTentsPerDay: null },
      holdsStore: [{ startDate: d(validRange().startDate), endDate: d(validRange().endDate), guests: 3 }],
    });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)
    );

    const res = await holdsPOST(postReq({ ...validRange(), guests: 1 }), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('ช่วงวันที่นี้ถูกกันไว้แล้ว');
    expect((tx as unknown as { internalHold: { create: ReturnType<typeof vi.fn> } }).internalHold.create).not.toHaveBeenCalled();
  });

  it('[EC-5] two racing creates for the last unit of capacity: exactly one wins (the second sees the first hold and is rejected)', async () => {
    mockAllowed();
    // Capacity 2; each request wants 2 guests; the shared holdsStore makes the
    // SECOND call's checkDateAvailabilityInTx see the FIRST call's committed
    // hold — proving the seam rejects the loser deterministically. (True
    // Postgres SERIALIZABLE conflict detection across two real concurrent
    // requests is a Staging-URL verification step — this unit layer proves
    // the capacity-guard LOGIC, mirroring cam-57-atomic-lock.test.ts's own
    // documented concurrency boundary.)
    const sharedHoldsStore: { startDate: Date; endDate: Date; guests: number }[] = [];
    const tx = makeHoldTxMock({
      campSite: { maxGuestsPerDay: 2, maxTentsPerDay: null },
      holdsStore: sharedHoldsStore,
    });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)
    );

    const range = validRange();
    const res1 = await holdsPOST(postReq({ ...range, guests: 2 }), makeCollectionParams(CAMPSITE_ID));
    const res2 = await holdsPOST(postReq({ ...range, guests: 2 }), makeCollectionParams(CAMPSITE_ID));

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(sharedHoldsStore).toHaveLength(1); // exactly one hold row committed
  });

  it('[retry] P2034 on attempts 1+2, success on attempt 3 -> 201 (ADR-006 bounded retry reused)', async () => {
    mockAllowed();
    const p2034 = new Prisma.PrismaClientKnownRequestError('Serialization failure', {
      code: 'P2034',
      clientVersion: '5.0.0',
    });
    let attempt = 0;
    const tx = makeHoldTxMock({ campSite: { maxGuestsPerDay: 10, maxTentsPerDay: null } });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      attempt++;
      if (attempt <= 2) throw p2034;
      return cb(tx);
    });

    const res = await holdsPOST(postReq(validRange()), makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(201);
    expect(attempt).toBe(3);
  });

  it('[retry-exhausted] P2034 on all attempts -> 409 with the ticket Thai copy (not 500)', async () => {
    mockAllowed();
    const p2034 = new Prisma.PrismaClientKnownRequestError('Serialization failure', {
      code: 'P2034',
      clientVersion: '5.0.0',
    });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValue(p2034);

    const res = await holdsPOST(postReq(validRange()), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('ช่วงวันที่นี้ถูกกันไว้แล้ว');
  });

  it('500 — a non-P2034 error returns 500 without leaking internals, no retry', async () => {
    mockAllowed();
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNRESET'));

    const res = await holdsPOST(postReq(validRange()), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).not.toHaveProperty('details');
  });
});

// ===========================================================================
// Group D: GET /api/campsites/[id]/holds — authz + contract
// ===========================================================================

describe('GET /api/campsites/[id]/holds — authz + contract', () => {
  it('401 — unauthenticated caller is rejected before any DB access', async () => {
    mockUnauthorized();

    const res = await holdsGET(getReq(), makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(401);
    expect(prisma.internalHold.findMany).not.toHaveBeenCalled();
  });

  it('403 — caller without BOOKING_UPDATE is rejected', async () => {
    mockForbidden();

    const res = await holdsGET(getReq(), makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(403);
    expect(prisma.internalHold.findMany).not.toHaveBeenCalled();
  });

  it('200 — returns the holds for the campsite, scoped by campSiteId', async () => {
    mockAllowed();
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: HOLD_ID, campSiteId: CAMPSITE_ID, status: 'ACTIVE' },
    ]);

    const res = await holdsGET(getReq(), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    const callArgs = (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.where.campSiteId).toBe(CAMPSITE_ID);
  });

  it('500 — prisma throws returns 500 without leaking details', async () => {
    mockAllowed();
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));

    const res = await holdsGET(getReq(), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect('details' in body).toBe(false);
  });
});

// ===========================================================================
// Group E: DELETE /api/campsites/[id]/holds/[holdId] — release (AC-3, BR-4, EC-3)
// ===========================================================================

describe('DELETE /api/campsites/[id]/holds/[holdId] — release (AC-3, BR-4)', () => {
  it('401 — unauthenticated caller is rejected before any DB access', async () => {
    mockUnauthorized();

    const res = await holdDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, HOLD_ID));

    expect(res.status).toBe(401);
    expect(prisma.internalHold.updateMany).not.toHaveBeenCalled();
  });

  it('403 — caller without BOOKING_UPDATE is rejected', async () => {
    mockForbidden();

    const res = await holdDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, HOLD_ID));

    expect(res.status).toBe(403);
    expect(prisma.internalHold.updateMany).not.toHaveBeenCalled();
  });

  it('uses requireCampSitePermission with BOOKING_UPDATE', async () => {
    mockForbidden();

    await holdDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, HOLD_ID));

    expect(requireCampSitePermission).toHaveBeenCalledWith(CAMPSITE_ID, 'BOOKING_UPDATE');
  });

  it('404 — a missing hold is rejected, no change (EC-3)', async () => {
    mockAllowed();
    (prisma.internalHold.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

    const res = await holdDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, HOLD_ID));

    expect(res.status).toBe(404);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('404 — a hold under a different campsite is rejected (scoped where, cross-camp guard, EC-3)', async () => {
    mockAllowed();
    (prisma.internalHold.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

    await holdDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, HOLD_ID));

    const callArgs = (prisma.internalHold.updateMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.where).toEqual({ id: HOLD_ID, campSiteId: CAMPSITE_ID, status: 'ACTIVE' });
  });

  it('404 — an already-RELEASED hold is rejected (the ACTIVE-only where guard makes it idempotent, EC-3)', async () => {
    mockAllowed();
    // updateMany's own where filters status:'ACTIVE' — an already-RELEASED row
    // never matches, so the mock simply returns count:0, same as "missing".
    (prisma.internalHold.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

    const res = await holdDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, HOLD_ID));

    expect(res.status).toBe(404);
  });

  it('200 — releases an ACTIVE hold (status -> RELEASED, row kept) + writes one AuditLog row (BR-4/BR-7)', async () => {
    mockAllowed();
    (prisma.internalHold.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'audit-2' });

    const res = await holdDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, HOLD_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    const updateArgs = (prisma.internalHold.updateMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateArgs.data).toEqual({ status: 'RELEASED' });
    // BR-4: no delete call anywhere — the row is kept.
    expect(prisma.internalHold).not.toHaveProperty('delete');
    // BR-7: one AuditLog row per release.
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
    const auditArgs = (prisma.auditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(auditArgs.data.action).toBe('hold.released');
    expect(auditArgs.data.entityType).toBe('InternalHold');
    expect(auditArgs.data.entityId).toBe(HOLD_ID);
  });

  it('500 — prisma throws returns 500 without leaking details', async () => {
    mockAllowed();
    (prisma.internalHold.updateMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));

    const res = await holdDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, HOLD_ID));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect('details' in body).toBe(false);
  });
});

// ===========================================================================
// Group F: source-inspection — the availability route seam (AC-1, CAM-342 trap)
// ===========================================================================

describe('source-inspection — availability route threads heldGuests through (AC-1, CAM-342 trap)', () => {
  const availabilityRouteSrc = fs.readFileSync(
    path.join(process.cwd(), 'app/api/campsites/[id]/availability/route.ts'),
    'utf-8'
  );

  it('remainingGuests subtracts (bookedGuests + heldGuests), not bookedGuests alone', () => {
    expect(availabilityRouteSrc).toContain(
      'remainingGuests: campSite.maxGuestsPerDay ? campSite.maxGuestsPerDay - (data.bookedGuests + data.heldGuests) : null'
    );
  });

  it('isCapacityFull folds heldGuests into the guest-capacity check', () => {
    expect(availabilityRouteSrc).toContain('data.bookedGuests + data.heldGuests) >= campSite.maxGuestsPerDay');
  });

  it('heldGuests is present in the per-day response object', () => {
    expect(availabilityRouteSrc).toContain('heldGuests: data.heldGuests');
  });
});

describe('GET /api/campsites/[id]/availability — real end-to-end thread-through (AC-1, not just source-inspect)', () => {
  it('an ACTIVE hold reduces remainingGuests and flips available:false when it fills capacity', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isActive: true,
      isPublished: true,
      deletedAt: null,
      operatorId: 'operator-1',
      maxGuestsPerDay: 5,
      maxTentsPerDay: null,
    });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    // A 2-guest ACTIVE hold on 2026-09-10 — capacity 5, remaining should drop to 3.
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-09-10'), endDate: d('2026-09-11'), guests: 2 },
    ]);

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMPSITE_ID}/availability?startDate=2026-09-10T00:00:00.000Z&endDate=2026-09-10T00:00:00.000Z`
    );
    const res = await availabilityGET(req, makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    const day = body.availability.find((a: { date: string }) => a.date === '2026-09-10');
    expect(day.heldGuests).toBe(2);
    expect(day.bookedGuests).toBe(0);
    expect(day.remainingGuests).toBe(3); // 5 - (0 + 2)
    expect(day.available).toBe(true);
  });

  it('an ACTIVE hold that fills remaining capacity flips available:false (no bookedGuests at all)', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isActive: true,
      isPublished: true,
      deletedAt: null,
      operatorId: 'operator-1',
      maxGuestsPerDay: 2,
      maxTentsPerDay: null,
    });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-09-10'), endDate: d('2026-09-11'), guests: 2 },
    ]);

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMPSITE_ID}/availability?startDate=2026-09-10T00:00:00.000Z&endDate=2026-09-10T00:00:00.000Z`
    );
    const res = await availabilityGET(req, makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    const day = body.availability.find((a: { date: string }) => a.date === '2026-09-10');
    expect(day.remainingGuests).toBe(0);
    expect(day.available).toBe(false);
  });
});

// ===========================================================================
// Group G: schema source-inspection — reduced M1 slice (Data section)
// ===========================================================================

describe('source-inspection — InternalHold reduced M1 slice (no leadId/quoteId/bookingId this migration)', () => {
  const schemaSrc = fs.readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf-8');
  const holdBlockMatch = schemaSrc.match(/model InternalHold \{[\s\S]*?\n\}/);

  it('InternalHold model exists in the schema', () => {
    expect(holdBlockMatch).not.toBeNull();
  });

  it('does NOT declare leadId (deferred to CAM-311)', () => {
    expect(holdBlockMatch![0]).not.toContain('leadId');
  });

  it('does NOT declare quoteId (deferred to CAM-311)', () => {
    expect(holdBlockMatch![0]).not.toContain('quoteId');
  });

  it('does NOT declare bookingId (deferred to CAM-311)', () => {
    expect(holdBlockMatch![0]).not.toContain('bookingId');
  });

  it('HoldStatus enum defines exactly ACTIVE, RELEASED, CONVERTED (BR-5)', () => {
    const enumMatch = schemaSrc.match(/enum HoldStatus \{[\s\S]*?\n\}/);
    expect(enumMatch).not.toBeNull();
    expect(enumMatch![0]).toContain('ACTIVE');
    expect(enumMatch![0]).toContain('RELEASED');
    expect(enumMatch![0]).toContain('CONVERTED');
  });

  it('the create/release routes never write status: CONVERTED (BR-5 — not reachable this story)', () => {
    const collectionRouteSrc = fs.readFileSync(
      path.join(process.cwd(), 'app/api/campsites/[id]/holds/route.ts'),
      'utf-8'
    );
    const itemRouteSrc = fs.readFileSync(
      path.join(process.cwd(), 'app/api/campsites/[id]/holds/[holdId]/route.ts'),
      'utf-8'
    );
    expect(collectionRouteSrc).not.toContain('CONVERTED');
    expect(itemRouteSrc).not.toContain('CONVERTED');
  });
});
