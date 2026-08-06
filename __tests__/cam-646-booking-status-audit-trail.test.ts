/**
 * cam-646-booking-status-audit-trail.test.ts — CAM-646
 *
 * PATCH /api/bookings/[id] now writes an AuditLog row INSIDE the same
 * transaction as a compare-and-swap status update (tech.md: the naive
 * prisma.booking.update this replaces could record a FALSE `from` status
 * under a race). Covers:
 *
 *  AC-1  a camper cancels their own PENDING booking -> exactly one AuditLog
 *        row, correct from/to/actorRole/campSiteId, no PII (BR-5/BR-6).
 *  AC-2  the SAME PATCH body sent twice, only session.user.id differs ->
 *        actorRole is 'camper' for the real camper, 'host' for a host who
 *        booked their own camp (BR-4 precedence, the case CAM-682 already
 *        proved matters).
 *  EC-2  a platform admin who is also the booking's camper -> actorRole
 *        'admin' (admin outranks both host and camper).
 *  AC-3  a stranger (neither camper nor host) -> 403, nothing written.
 *  AC-4  a compare-and-swap conflict (another request already moved the
 *        status) -> 409, exactly one AuditLog row exists across both calls.
 *  AC-5  a no-op transition (same status sent twice) -> 409, nothing
 *        written, $transaction never opened.
 *  EC-1  the audit write rejects -> the WHOLE change fails (500), the
 *        deliberate inverse of the notify contract (which never fails the
 *        request) — named explicitly so a reader sees the difference is
 *        intended.
 *  EC-4  an unrecognized status value -> 400 before any DB read.
 *  —     a camper requesting a non-CANCELLED status -> 400, nothing written.
 *  BR-7  rate limit -> 429 when the window is already full, no DB touched.
 *
 * Notification (CAM-682) is mocked out entirely here — this file asserts
 * the audit trail, not the notify feature; CAM-682's own suite covers that.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => {
  const bookingMock = {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  };
  const auditLogMock = { create: vi.fn() };
  const campSiteTeamMemberMock = { findFirst: vi.fn() };
  const tx = { booking: bookingMock, auditLog: auditLogMock };
  return {
    prisma: {
      booking: bookingMock,
      campSiteTeamMember: campSiteTeamMemberMock,
      auditLog: auditLogMock,
      $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    },
  };
});
vi.mock('@/lib/auth-utils', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/notifications/booking-events', () => ({ notifyBookingCancelled: vi.fn() }));

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { _store } from '@/lib/rate-limit';

const { PATCH } = await import('@/app/api/bookings/[id]/route');

type Mock = ReturnType<typeof vi.fn>;

const BOOKING_ID = 'booking-646-1';
const CAMP_ID = 'a6a46666-0000-4000-8000-000000000646';
const CAMPER_ID = 'a6a46666-1111-4000-8000-000000000646';
const HOST_ID = 'a6a46666-2222-4000-8000-000000000646';
const SELF_HOST_ID = 'a6a46666-3333-4000-8000-000000000646';
const ADMIN_ID = 'a6a46666-4444-4000-8000-000000000646';
const STRANGER_ID = 'a6a46666-5555-4000-8000-000000000646';
const RATE_LIMIT_ID = 'a6a46666-6666-4000-8000-000000000646';

function makeSession(userId: string, role?: string) {
  return { user: { id: userId, email: `${userId}@campvibe.com`, name: 'Tester', role } };
}

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost/api/bookings/${BOOKING_ID}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeContext(id = BOOKING_ID) {
  return { params: Promise.resolve({ id }) };
}

function findUniqueFixture(opts: { userId: string; operatorId: string; status?: string }) {
  return {
    id: BOOKING_ID,
    userId: opts.userId,
    campSiteId: CAMP_ID,
    status: opts.status ?? 'PENDING',
    campSite: {
      id: CAMP_ID,
      operatorId: opts.operatorId,
      operator: { id: opts.operatorId, email: `${opts.operatorId}@campvibe.com` },
    },
  };
}

function finalBookingFixture(opts: { userId: string; status: string }) {
  return {
    id: BOOKING_ID,
    userId: opts.userId,
    campSiteId: CAMP_ID,
    checkInDate: new Date('2027-05-01'),
    checkOutDate: new Date('2027-05-02'),
    guests: 2,
    snapshotCampName: 'แคมป์ทดสอบ CAM-646',
    status: opts.status,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
  (prisma.auditLog.create as Mock).mockResolvedValue({ id: 'audit-1' });
});

describe('PATCH /api/bookings/[id] — compare-and-swap audit trail (CAM-646)', () => {
  it('[AC-1][BR-5][BR-6] a camper cancelling their own PENDING booking writes exactly one AuditLog row, no PII', async () => {
    (requireAuth as Mock).mockResolvedValue({ error: null, session: makeSession(CAMPER_ID) });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: CAMPER_ID, operatorId: HOST_ID })
    );
    (prisma.campSiteTeamMember.findFirst as Mock).mockResolvedValueOnce(null);
    (prisma.booking.updateMany as Mock).mockResolvedValueOnce({ count: 1 });
    (prisma.booking.findUniqueOrThrow as Mock).mockResolvedValueOnce(
      finalBookingFixture({ userId: CAMPER_ID, status: 'CANCELLED' })
    );

    const res = await PATCH(makeRequest({ status: 'CANCELLED' }), makeContext());
    expect(res.status).toBe(200);

    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: BOOKING_ID, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    const call = (prisma.auditLog.create as Mock).mock.calls[0][0];
    expect(Object.keys(call.data).sort()).toEqual(
      ['actorId', 'action', 'entityType', 'entityId', 'metadata'].sort()
    );
    expect(call.data).toMatchObject({
      actorId: CAMPER_ID,
      action: 'booking.status.update',
      entityType: 'Booking',
      entityId: BOOKING_ID,
    });
    expect(Object.keys(call.data.metadata).sort()).toEqual(
      ['from', 'to', 'campSiteId', 'actorRole'].sort()
    );
    expect(call.data.metadata).toEqual({
      from: 'PENDING',
      to: 'CANCELLED',
      campSiteId: CAMP_ID,
      actorRole: 'camper',
    });
  });

  it('[AC-2][load-bearing] identical PATCH body -- real camper records actorRole camper, a host on their OWN self-booked booking records host', async () => {
    const body = { status: 'CANCELLED' };

    (requireAuth as Mock).mockResolvedValueOnce({ error: null, session: makeSession(CAMPER_ID) });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: CAMPER_ID, operatorId: HOST_ID })
    );
    (prisma.campSiteTeamMember.findFirst as Mock).mockResolvedValueOnce(null);
    (prisma.booking.updateMany as Mock).mockResolvedValueOnce({ count: 1 });
    (prisma.booking.findUniqueOrThrow as Mock).mockResolvedValueOnce(
      finalBookingFixture({ userId: CAMPER_ID, status: 'CANCELLED' })
    );

    const res1 = await PATCH(makeRequest(body), makeContext());
    expect(res1.status).toBe(200);
    let call = (prisma.auditLog.create as Mock).mock.calls[0][0];
    expect(call.data.metadata.actorRole).toBe('camper');

    (requireAuth as Mock).mockResolvedValueOnce({ error: null, session: makeSession(SELF_HOST_ID) });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: SELF_HOST_ID, operatorId: SELF_HOST_ID })
    );
    (prisma.booking.updateMany as Mock).mockResolvedValueOnce({ count: 1 });
    (prisma.booking.findUniqueOrThrow as Mock).mockResolvedValueOnce(
      finalBookingFixture({ userId: SELF_HOST_ID, status: 'CANCELLED' })
    );

    const res2 = await PATCH(makeRequest(body), makeContext());
    expect(res2.status).toBe(200);
    call = (prisma.auditLog.create as Mock).mock.calls[1][0];
    expect(call.data.metadata.actorRole).toBe('host');
  });

  it('[EC-2] a platform admin who is also the booking camper records actorRole admin', async () => {
    (requireAuth as Mock).mockResolvedValue({ error: null, session: makeSession(ADMIN_ID, 'ADMIN') });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: ADMIN_ID, operatorId: HOST_ID })
    );
    (prisma.campSiteTeamMember.findFirst as Mock).mockResolvedValueOnce(null);
    (prisma.booking.updateMany as Mock).mockResolvedValueOnce({ count: 1 });
    (prisma.booking.findUniqueOrThrow as Mock).mockResolvedValueOnce(
      finalBookingFixture({ userId: ADMIN_ID, status: 'CANCELLED' })
    );

    const res = await PATCH(makeRequest({ status: 'CANCELLED' }), makeContext());
    expect(res.status).toBe(200);
    const call = (prisma.auditLog.create as Mock).mock.calls[0][0];
    expect(call.data.metadata.actorRole).toBe('admin');
  });

  it('[AC-3] a stranger (neither camper nor host) is refused with 403 and writes nothing', async () => {
    (requireAuth as Mock).mockResolvedValue({ error: null, session: makeSession(STRANGER_ID) });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: CAMPER_ID, operatorId: HOST_ID })
    );
    (prisma.campSiteTeamMember.findFirst as Mock).mockResolvedValueOnce(null);

    const res = await PATCH(makeRequest({ status: 'CANCELLED' }), makeContext());
    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('[400] a camper requesting a non-CANCELLED status is refused with 400 and writes nothing', async () => {
    (requireAuth as Mock).mockResolvedValue({ error: null, session: makeSession(CAMPER_ID) });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: CAMPER_ID, operatorId: HOST_ID })
    );
    (prisma.campSiteTeamMember.findFirst as Mock).mockResolvedValueOnce(null);

    const res = await PATCH(makeRequest({ status: 'CONFIRMED' }), makeContext());
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('[EC-4] an unrecognized status value is refused before any DB read', async () => {
    (requireAuth as Mock).mockResolvedValue({ error: null, session: makeSession(CAMPER_ID) });

    const res = await PATCH(makeRequest({ status: 'NOT_A_REAL_STATUS' }), makeContext());
    expect(res.status).toBe(400);
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('[AC-4][EC-3] a compare-and-swap conflict is refused with 409, exactly one AuditLog row exists across both calls', async () => {
    (requireAuth as Mock).mockResolvedValueOnce({ error: null, session: makeSession(HOST_ID) });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: CAMPER_ID, operatorId: HOST_ID, status: 'PENDING' })
    );
    (prisma.booking.updateMany as Mock).mockResolvedValueOnce({ count: 1 });
    (prisma.booking.findUniqueOrThrow as Mock).mockResolvedValueOnce(
      finalBookingFixture({ userId: CAMPER_ID, status: 'CONFIRMED' })
    );

    const res1 = await PATCH(makeRequest({ status: 'CONFIRMED' }), makeContext());
    expect(res1.status).toBe(200);

    (requireAuth as Mock).mockResolvedValueOnce({ error: null, session: makeSession(HOST_ID) });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: CAMPER_ID, operatorId: HOST_ID, status: 'PENDING' })
    );
    (prisma.booking.updateMany as Mock).mockResolvedValueOnce({ count: 0 });

    const res2 = await PATCH(makeRequest({ status: 'CANCELLED' }), makeContext());
    expect(res2.status).toBe(409);

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('[AC-5] a no-op transition (same status sent again) is refused with 409 and opens no transaction', async () => {
    (requireAuth as Mock).mockResolvedValue({ error: null, session: makeSession(CAMPER_ID) });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: CAMPER_ID, operatorId: HOST_ID, status: 'CANCELLED' })
    );
    (prisma.campSiteTeamMember.findFirst as Mock).mockResolvedValueOnce(null);

    const res = await PATCH(makeRequest({ status: 'CANCELLED' }), makeContext());
    expect(res.status).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('[EC-1] the audit write rejecting fails the WHOLE change (500), deliberate inverse of the notify contract', async () => {
    (requireAuth as Mock).mockResolvedValue({ error: null, session: makeSession(CAMPER_ID) });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: CAMPER_ID, operatorId: HOST_ID })
    );
    (prisma.campSiteTeamMember.findFirst as Mock).mockResolvedValueOnce(null);
    (prisma.booking.updateMany as Mock).mockResolvedValueOnce({ count: 1 });
    (prisma.auditLog.create as Mock).mockRejectedValueOnce(new Error('db down'));

    const res = await PATCH(makeRequest({ status: 'CANCELLED' }), makeContext());
    expect(res.status).toBe(500);
    expect(prisma.booking.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('[BR-7] returns 429 with no DB read once the rate-limit window is already full', async () => {
    (requireAuth as Mock).mockResolvedValue({ error: null, session: makeSession(RATE_LIMIT_ID) });
    _store.set(`booking:patch:${RATE_LIMIT_ID}`, Array.from({ length: 20 }, () => Date.now()));

    const res = await PATCH(makeRequest({ status: 'CANCELLED' }), makeContext());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
  });
});
