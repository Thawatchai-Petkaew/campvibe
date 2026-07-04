/**
 * cam-56-blocked-dates-rbac.test.ts — CAM-56 BlockedDate write-API RBAC + contract tests
 *
 * Mirrors __tests__/spot-rbac.test.ts's mocking strategy: vi.mock('@/lib/auth-utils')
 * controls the entire RBAC decision surface so these tests assert handler wiring
 * (does the route call requireCampSitePermission with the right permission code,
 * does it map the result to the right HTTP status), not the RBAC engine internals
 * (those are covered by lib/team-permissions + auth-utils unit tests).
 *
 * Error-code set per handler:
 *   GET    /blocked-dates            : 401 · 403 · 200 · 500
 *   POST   /blocked-dates            : 401 · 403 · 400 · 404 · 201 · 500
 *   DELETE /blocked-dates/[blockId]  : 401 · 403 · 404 · 200 · 500
 *
 * AC coverage:
 *   AC-2  201 create → BlockedDate row persisted (campSiteId/spotId/startDate/endDate/reason)
 *   AC-5  200 delete → soft-delete (deletedAt set, not a hard prisma.delete)
 *   AC-6  409 HARD REJECT (owner decision, 2026-07-04, the pull request GATE-REWORK): a block
 *         overlapping an active (CONFIRMED/PENDING) booking in scope FAILS with 409 +
 *         the ticket's exact Thai copy + the conflicting bookings — no BlockedDate row
 *         is created. Supersedes the earlier warn-but-allow revision (see route header).
 *   AC-7  403 for a caller without BOOKING_UPDATE / not the owner
 *   AC-8  400 for a past startDate (covered at the zod layer — see the validation test file;
 *         this file proves the route returns 400 + never calls prisma.blockedDate.create)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    blockedDate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    spot: {
      findFirst: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireCampSitePermission: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireCampSitePermission } from '@/lib/auth-utils';

import { GET as blockedDatesGET, POST as blockedDatesPOST } from '@/app/api/campsites/[id]/blocked-dates/route';
import { DELETE as blockedDateDELETE } from '@/app/api/campsites/[id]/blocked-dates/[blockId]/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CAMPSITE_ID = '550e8400-e29b-41d4-a716-446655440000';
const SPOT_ID = '550e8400-e29b-41d4-a716-446655440001';
const BLOCK_ID = '550e8400-e29b-41d4-a716-446655440002';

const makeCollectionParams = (id: string) => ({ params: Promise.resolve({ id }) });
const makeItemParams = (id: string, blockId: string) => ({ params: Promise.resolve({ id, blockId }) });

const allowedResult = { error: null, campSite: { id: CAMPSITE_ID } as never, session: {} as never };
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

// ---------------------------------------------------------------------------
// GET /api/campsites/[id]/blocked-dates
// ---------------------------------------------------------------------------

describe('GET /api/campsites/[id]/blocked-dates — RBAC + contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 — unauthenticated caller is rejected before any DB access', async () => {
    mockUnauthorized();

    const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/blocked-dates`);
    const res = await blockedDatesGET(req, makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(401);
    expect(prisma.blockedDate.findMany).not.toHaveBeenCalled();
  });

  it('403 — caller without BOOKING_UPDATE (and not the owner) is rejected', async () => {
    mockForbidden();

    const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/blocked-dates`);
    const res = await blockedDatesGET(req, makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(403);
    expect(prisma.blockedDate.findMany).not.toHaveBeenCalled();
  });

  it('uses requireCampSitePermission with BOOKING_UPDATE (owner-or-team-permission model)', async () => {
    mockForbidden();

    const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/blocked-dates`);
    await blockedDatesGET(req, makeCollectionParams(CAMPSITE_ID));

    expect(requireCampSitePermission).toHaveBeenCalledWith(CAMPSITE_ID, 'BOOKING_UPDATE');
  });

  it('200 — returns the active (non-deleted) blocked dates for the camp, newest-start first', async () => {
    mockAllowed();
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: BLOCK_ID, campSiteId: CAMPSITE_ID, spotId: null, startDate: '2026-08-01', endDate: '2026-08-03' },
    ]);

    const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/blocked-dates`);
    const res = await blockedDatesGET(req, makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    // Soft-delete guard present in the query.
    const callArgs = (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.where.deletedAt).toBeNull();
    expect(callArgs.where.campSiteId).toBe(CAMPSITE_ID);
  });

  it('500 — prisma.blockedDate.findMany throws returns 500 without leaking details', async () => {
    mockAllowed();
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));

    const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/blocked-dates`);
    const res = await blockedDatesGET(req, makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect('details' in body).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/campsites/[id]/blocked-dates
// ---------------------------------------------------------------------------

describe('POST /api/campsites/[id]/blocked-dates — RBAC + contract', () => {
  beforeEach(() => vi.clearAllMocks());

  function postReq(body: unknown) {
    return new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/blocked-dates`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
  }

  it('401 — unauthenticated caller is rejected before any DB access', async () => {
    mockUnauthorized();

    const res = await blockedDatesPOST(postReq(validRange()), makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(401);
    expect(prisma.blockedDate.create).not.toHaveBeenCalled();
  });

  it('403 — caller without BOOKING_UPDATE (and not the owner) is rejected', async () => {
    mockForbidden();

    const res = await blockedDatesPOST(postReq(validRange()), makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(403);
    expect(prisma.blockedDate.create).not.toHaveBeenCalled();
  });

  it('uses requireCampSitePermission with BOOKING_UPDATE', async () => {
    mockForbidden();

    await blockedDatesPOST(postReq(validRange()), makeCollectionParams(CAMPSITE_ID));

    expect(requireCampSitePermission).toHaveBeenCalledWith(CAMPSITE_ID, 'BOOKING_UPDATE');
  });

  it('400 — a past startDate is rejected before any DB write (AC-8)', async () => {
    mockAllowed();
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const res = await blockedDatesPOST(
      postReq({ startDate: yesterday.toISOString().split('T')[0], endDate: yesterday.toISOString().split('T')[0] }),
      makeCollectionParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(400);
    expect(prisma.blockedDate.create).not.toHaveBeenCalled();
  });

  it('400 — missing required fields returns validation error', async () => {
    mockAllowed();

    const res = await blockedDatesPOST(postReq({}), makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(400);
    expect(prisma.blockedDate.create).not.toHaveBeenCalled();
  });

  it('404 — spotId does not belong to this campsite (cross-campsite IDOR guard)', async () => {
    mockAllowed();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await blockedDatesPOST(
      postReq({ ...validRange(), spotId: SPOT_ID }),
      makeCollectionParams(CAMPSITE_ID)
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(prisma.blockedDate.create).not.toHaveBeenCalled();
    expect(prisma.spot.findFirst).toHaveBeenCalledWith({
      where: { id: SPOT_ID, campSiteId: CAMPSITE_ID, deletedAt: null },
      select: { id: true },
    });
    expect('details' in body).toBe(false);
  });

  // CAM-352 G3 fix (Info item 6): a soft-deleted spot can no longer have a
  // NEW block attached — the IDOR guard's deletedAt: null scoping means a
  // real Postgres query would never return the deleted row, so findFirst
  // resolves null exactly as the cross-campsite case does.
  it('404 — spotId belongs to this campsite but is soft-deleted (BR-1/CAM-352)', async () => {
    mockAllowed();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await blockedDatesPOST(
      postReq({ ...validRange(), spotId: SPOT_ID }),
      makeCollectionParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(404);
    expect(prisma.blockedDate.create).not.toHaveBeenCalled();
    const call = (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where).toEqual({ id: SPOT_ID, campSiteId: CAMPSITE_ID, deletedAt: null });
  });

  it('201 — creates a whole-camp block (spotId omitted) with no overlapping bookings', async () => {
    mockAllowed();
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.blockedDate.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: BLOCK_ID,
      campSiteId: CAMPSITE_ID,
      spotId: null,
      ...validRange(),
      reason: null,
    });

    const res = await blockedDatesPOST(postReq(validRange()), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(prisma.blockedDate.create).toHaveBeenCalledOnce();
    const createArgs = (prisma.blockedDate.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createArgs.data.campSiteId).toBe(CAMPSITE_ID);
    expect(createArgs.data.spotId).toBeNull();
    expect(body.blockedDate).toBeDefined();
    expect(body.warning).toBeUndefined();
  });

  it('201 — creates a spot-level block after verifying spot ownership', async () => {
    mockAllowed();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.blockedDate.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: BLOCK_ID,
      campSiteId: CAMPSITE_ID,
      spotId: SPOT_ID,
      ...validRange(),
      reason: 'ปิดซ่อมแซม',
    });

    const res = await blockedDatesPOST(
      postReq({ ...validRange(), spotId: SPOT_ID, reason: 'ปิดซ่อมแซม' }),
      makeCollectionParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(201);
    const createArgs = (prisma.blockedDate.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createArgs.data.spotId).toBe(SPOT_ID);
    expect(createArgs.data.reason).toBe('ปิดซ่อมแซม');
  });

  it('409 — overlapping CONFIRMED booking HARD REJECTS creation (AC-6, owner decision)', async () => {
    mockAllowed();
    const range = validRange();
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'booking-1',
        checkInDate: range.startDate,
        checkOutDate: range.endDate,
        guests: 2,
        spotId: null,
      },
    ]);

    const res = await blockedDatesPOST(postReq(range), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    // AC-6 hard reject: 409, no BlockedDate row created, conflicting bookings listed.
    expect(res.status).toBe(409);
    expect(prisma.blockedDate.create).not.toHaveBeenCalled();
    expect(body.error).toBe('blocked_date_overlaps_booking');
    // Ticket AC-6 exact Thai copy — asserted verbatim (qa.md #2).
    expect(body.message).toBe('ไม่สามารถบล็อกวันนี้ได้ เนื่องจากมีการจองอยู่แล้ว');
    expect(body.conflicts).toHaveLength(1);
    expect(body.conflicts[0].id).toBe('booking-1');
  });

  it('409 — overlapping PENDING booking on a spot-level block also HARD REJECTS (AC-6 scope)', async () => {
    mockAllowed();
    const range = validRange();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'booking-2',
        checkInDate: range.startDate,
        checkOutDate: range.endDate,
        guests: 4,
        spotId: SPOT_ID,
      },
    ]);

    const res = await blockedDatesPOST(
      postReq({ ...range, spotId: SPOT_ID }),
      makeCollectionParams(CAMPSITE_ID)
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(prisma.blockedDate.create).not.toHaveBeenCalled();
    expect(body.conflicts[0].id).toBe('booking-2');
  });

  it('booking overlap query is scoped to the campsite AND to CONFIRMED/PENDING statuses only', async () => {
    mockAllowed();
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.blockedDate.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: BLOCK_ID });

    await blockedDatesPOST(postReq(validRange()), makeCollectionParams(CAMPSITE_ID));

    const callArgs = (prisma.booking.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.where.campSiteId).toBe(CAMPSITE_ID);
    expect(callArgs.where.status).toEqual({ in: ['CONFIRMED', 'PENDING'] });
  });

  it('spot-level block overlap query is scoped to that exact spotId', async () => {
    mockAllowed();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.blockedDate.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: BLOCK_ID });

    await blockedDatesPOST(postReq({ ...validRange(), spotId: SPOT_ID }), makeCollectionParams(CAMPSITE_ID));

    const callArgs = (prisma.booking.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.where.spotId).toBe(SPOT_ID);
  });

  it('500 — prisma.blockedDate.create throws returns 500 without leaking details', async () => {
    mockAllowed();
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.blockedDate.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));

    const res = await blockedDatesPOST(postReq(validRange()), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect('details' in body).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/campsites/[id]/blocked-dates/[blockId]
// ---------------------------------------------------------------------------

describe('DELETE /api/campsites/[id]/blocked-dates/[blockId] — RBAC + contract', () => {
  beforeEach(() => vi.clearAllMocks());

  function deleteReq() {
    return new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/blocked-dates/${BLOCK_ID}`, {
      method: 'DELETE',
    });
  }

  it('401 — unauthenticated caller is rejected before any DB access', async () => {
    mockUnauthorized();

    const res = await blockedDateDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, BLOCK_ID));

    expect(res.status).toBe(401);
    expect(prisma.blockedDate.update).not.toHaveBeenCalled();
  });

  it('403 — caller without BOOKING_UPDATE (and not the owner) is rejected', async () => {
    mockForbidden();

    const res = await blockedDateDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, BLOCK_ID));

    expect(res.status).toBe(403);
    expect(prisma.blockedDate.update).not.toHaveBeenCalled();
  });

  it('uses requireCampSitePermission with BOOKING_UPDATE', async () => {
    mockForbidden();

    await blockedDateDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, BLOCK_ID));

    expect(requireCampSitePermission).toHaveBeenCalledWith(CAMPSITE_ID, 'BOOKING_UPDATE');
  });

  it('404 — block does not belong to this campsite (or is already cancelled)', async () => {
    mockAllowed();
    (prisma.blockedDate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await blockedDateDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, BLOCK_ID));

    expect(res.status).toBe(404);
    expect(prisma.blockedDate.update).not.toHaveBeenCalled();
  });

  it('200 — soft-deletes the block (sets deletedAt, does not hard-delete the row)', async () => {
    mockAllowed();
    (prisma.blockedDate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: BLOCK_ID });
    (prisma.blockedDate.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: BLOCK_ID, deletedAt: new Date() });

    const res = await blockedDateDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, BLOCK_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.blockedDate.update).toHaveBeenCalledOnce();
    const updateArgs = (prisma.blockedDate.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateArgs.where.id).toBe(BLOCK_ID);
    expect(updateArgs.data.deletedAt).toBeInstanceOf(Date);
  });

  it('500 — prisma.blockedDate.update throws returns 500 without leaking details', async () => {
    mockAllowed();
    (prisma.blockedDate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: BLOCK_ID });
    (prisma.blockedDate.update as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));

    const res = await blockedDateDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, BLOCK_ID));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect('details' in body).toBe(false);
  });
});
