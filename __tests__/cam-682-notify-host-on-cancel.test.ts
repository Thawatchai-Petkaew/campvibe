/**
 * cam-682-notify-host-on-cancel.test.ts — CAM-682
 *
 * Extends lib/notifications/booking-events.ts (CAM-681's first writer of the
 * `Notification` table) with a second event: a host/team recipient is told
 * when a CAMPER cancels their own booking — but never when a host cancels a
 * booking (including their own self-booked one).
 *
 * The load-bearing rule (app/api/bookings/[id]/route.ts PATCH):
 *
 *   status === 'CANCELLED' && isCamper && !canHostUpdate
 *
 * NOT `isCamper` alone. A host who booked their own camp is BOTH camper and
 * host on that row (`isCamper` and `canHostUpdate` are both true) — an
 * implementation keyed on `isCamper` alone fires a notification about the
 * host's own action. `isCamper` alone only diverges from the correct
 * condition when `canHostUpdate` is ALSO true for the same actor — every
 * other scenario in this file (host cancels someone else's booking, a team
 * member with BOOKING_UPDATE cancels someone else's, an admin cancels
 * someone else's) already has `isCamper === false`, so a naive `isCamper`
 * check would pass those trivially. Only the self-booking case exposes the
 * bug — see the [load-bearing] test below.
 *
 * AC → test matrix
 * ─────────────────────────────────────────────────────────────────────────
 * [normal]       a camper cancelling a normal (non-self) booking -> one row
 *                per BOOKING_VIEW recipient, type BOOKING, link highlights
 *                this booking.
 * [normal]       a host who booked their OWN camp cancels -> zero rows
 *                (isCamper && canHostUpdate both true -> host action).
 * [normal]       a team member with BOOKING_UPDATE cancels someone else's
 *                booking -> zero rows (isCamper false).
 * [normal]       a platform admin cancels someone else's booking -> zero
 *                rows (isCamper false).
 * [boundary]     a CONFIRMED or COMPLETED transition -> zero rows (the
 *                notify condition is scoped to CANCELLED only).
 * [error]        the recipient lookup REJECTS -> the response is still 200
 *                with the updated booking body; zero rows written.
 * [load-bearing] identical PATCH body ({status:"CANCELLED"}) sent twice —
 *                once as the actual camper on a normal booking (rows),
 *                once as a host cancelling their OWN self-booked booking
 *                (zero rows) — only session.user.id (and the fixture it
 *                resolves to) differs; proves the gate is
 *                `isCamper && !canHostUpdate`, not `isCamper` alone.
 * [security]     the row carries no guest identity (name/phone/email).
 *
 * Mirrors __tests__/cam-681-notify-host-on-booking.test.ts's convention:
 * `prisma` is mocked down to exactly what the route + the (real, unmocked)
 * booking-events/copy modules touch, so a stray read anywhere else in the
 * module graph throws instead of silently passing.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    campSiteTeamMember: { findFirst: vi.fn() },
    notification: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  },
}));
vi.mock('@/lib/auth-utils', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/camp-access', () => ({ listBookingViewRecipients: vi.fn() }));

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { listBookingViewRecipients } from '@/lib/camp-access';
import { NOTIFICATION_EVENTS, buildBookingCancelledCopy } from '@/lib/notifications/copy';

const { PATCH } = await import('@/app/api/bookings/[id]/route');

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------
const BOOKING_ID = 'booking-682-1';
const CAMP_ID = 'a2a22222-0000-4000-8000-000000000682';
const CAMPER_ID = 'a2a22222-1111-4000-8000-000000000682'; // an ordinary camper
const HOST_ID = 'a2a22222-2222-4000-8000-000000000682'; // operates CAMP_ID
const TEAM_UPDATE_ID = 'a2a22222-3333-4000-8000-000000000682'; // BOOKING_UPDATE at CAMP_ID
const TEAM_VIEW_ID = 'a2a22222-4444-4000-8000-000000000682'; // BOOKING_VIEW recipient
const ADMIN_ID = 'a2a22222-5555-4000-8000-000000000682'; // platform admin, unrelated to CAMP_ID
const SELF_HOST_ID = 'a2a22222-6666-4000-8000-000000000682'; // books + operates their own camp
const CAMP_NAME_TH = 'แคมป์ทดสอบ CAM-682';

const CHECK_IN = '2027-04-01';
const CHECK_OUT = '2027-04-02';

type Mock = ReturnType<typeof vi.fn>;

function makeSession(userId: string, role?: string) {
  return { user: { id: userId, email: `${userId}@campvibe.com`, name: 'Tester', role } };
}

function makePatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost/api/bookings/${BOOKING_ID}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeContext(bookingId = BOOKING_ID) {
  return { params: Promise.resolve({ id: bookingId }) };
}

/** What prisma.booking.findUnique({ include: { campSite: { include: { operator: true } } } }) returns. */
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

/** What prisma.booking.update({ where:{id}, data:{status} }) returns — flat, no include. */
function updateFixture(opts: { userId: string; status: string }) {
  return {
    id: BOOKING_ID,
    userId: opts.userId,
    campSiteId: CAMP_ID,
    checkInDate: new Date(CHECK_IN),
    checkOutDate: new Date(CHECK_OUT),
    guests: 2,
    snapshotCampName: CAMP_NAME_TH,
    status: opts.status,
  };
}

type Recipient = { userId: string; email: string; isOwner: boolean };

function mockRecipients(recipients: Recipient[]) {
  (listBookingViewRecipients as Mock).mockResolvedValueOnce(recipients);
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.notification.createMany as Mock).mockResolvedValue({ count: 0 });
  NOTIFICATION_EVENTS.bookingCreated = true;
  NOTIFICATION_EVENTS.bookingCancelled = true;
});

afterEach(() => {
  NOTIFICATION_EVENTS.bookingCreated = true;
  NOTIFICATION_EVENTS.bookingCancelled = true; // never leak a flipped switch into another test file
});

// ===========================================================================
// PATCH /api/bookings/[id] — notify on camper-initiated cancel only (CAM-682)
// ===========================================================================

describe('PATCH /api/bookings/[id] — notifies host/team on CAMPER cancel, never a host action (CAM-682)', () => {
  it('[integration][normal] a camper cancelling a normal booking writes one row per recipient', async () => {
    (requireAuth as Mock).mockResolvedValue({ error: null, session: makeSession(CAMPER_ID) });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: CAMPER_ID, operatorId: HOST_ID })
    );
    (prisma.campSiteTeamMember.findFirst as Mock).mockResolvedValueOnce(null); // camper holds no team row
    (prisma.booking.update as Mock).mockResolvedValueOnce(
      updateFixture({ userId: CAMPER_ID, status: 'CANCELLED' })
    );
    mockRecipients([
      { userId: HOST_ID, email: `${HOST_ID}@campvibe.com`, isOwner: true },
      { userId: TEAM_VIEW_ID, email: `${TEAM_VIEW_ID}@campvibe.com`, isOwner: false },
    ]);

    const res = await PATCH(makePatchRequest({ status: 'CANCELLED' }), makeContext());
    expect(res.status).toBe(200);

    expect(prisma.notification.createMany).toHaveBeenCalledOnce();
    const written = (prisma.notification.createMany as Mock).mock.calls[0][0].data as Array<
      Record<string, unknown>
    >;
    expect(written.map((r) => r.userId).sort()).toEqual([HOST_ID, TEAM_VIEW_ID].sort());
    written.forEach((row) => {
      expect(row.type).toBe('BOOKING');
      expect(row.isRead).toBe(false);
      expect(row.link).toBe(`/dashboard/bookings?highlight=${BOOKING_ID}`);
      expect(row.body).toContain(CAMP_NAME_TH);
      expect(row.body as string).not.toContain('—'); // no em-dash separator
    });
  });

  it('[integration][normal] a host who booked their OWN camp cancels -> zero rows (self-booking)', async () => {
    (requireAuth as Mock).mockResolvedValue({ error: null, session: makeSession(SELF_HOST_ID) });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: SELF_HOST_ID, operatorId: SELF_HOST_ID })
    );
    (prisma.booking.update as Mock).mockResolvedValueOnce(
      updateFixture({ userId: SELF_HOST_ID, status: 'CANCELLED' })
    );

    const res = await PATCH(makePatchRequest({ status: 'CANCELLED' }), makeContext());

    expect(res.status).toBe(200);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(listBookingViewRecipients).not.toHaveBeenCalled();
    // Not a team member either way (isOperator short-circuits the lookup).
    expect(prisma.campSiteTeamMember.findFirst).not.toHaveBeenCalled();
  });

  it('[integration][normal] a team member with BOOKING_UPDATE cancels someone else\'s booking -> zero rows', async () => {
    (requireAuth as Mock).mockResolvedValue({ error: null, session: makeSession(TEAM_UPDATE_ID) });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: CAMPER_ID, operatorId: HOST_ID })
    );
    (prisma.campSiteTeamMember.findFirst as Mock).mockResolvedValueOnce({
      role: 'STAFF', // default STAFF permissions include BOOKING_UPDATE
      permissions: [],
    });
    (prisma.booking.update as Mock).mockResolvedValueOnce(
      updateFixture({ userId: CAMPER_ID, status: 'CANCELLED' })
    );

    const res = await PATCH(makePatchRequest({ status: 'CANCELLED' }), makeContext());

    expect(res.status).toBe(200);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('[integration][normal] a platform admin cancels someone else\'s booking -> zero rows', async () => {
    (requireAuth as Mock).mockResolvedValue({ error: null, session: makeSession(ADMIN_ID, 'ADMIN') });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: CAMPER_ID, operatorId: HOST_ID })
    );
    (prisma.campSiteTeamMember.findFirst as Mock).mockResolvedValueOnce(null); // admin holds no team row here
    (prisma.booking.update as Mock).mockResolvedValueOnce(
      updateFixture({ userId: CAMPER_ID, status: 'CANCELLED' })
    );

    const res = await PATCH(makePatchRequest({ status: 'CANCELLED' }), makeContext());

    expect(res.status).toBe(200);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it.each(['CONFIRMED', 'COMPLETED'])(
    '[integration][boundary] a %s transition notifies nobody this round',
    async (status) => {
      (requireAuth as Mock).mockResolvedValue({ error: null, session: makeSession(HOST_ID) });
      (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
        findUniqueFixture({ userId: CAMPER_ID, operatorId: HOST_ID })
      );
      (prisma.booking.update as Mock).mockResolvedValueOnce(updateFixture({ userId: CAMPER_ID, status }));

      const res = await PATCH(makePatchRequest({ status }), makeContext());

      expect(res.status).toBe(200);
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
      expect(listBookingViewRecipients).not.toHaveBeenCalled();
    }
  );

  it('[integration][error][load-bearing] the recipient lookup REJECTS — still 200 with the updated booking, not a 500', async () => {
    (requireAuth as Mock).mockResolvedValue({ error: null, session: makeSession(CAMPER_ID) });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: CAMPER_ID, operatorId: HOST_ID })
    );
    (prisma.campSiteTeamMember.findFirst as Mock).mockResolvedValueOnce(null);
    (prisma.booking.update as Mock).mockResolvedValueOnce(
      updateFixture({ userId: CAMPER_ID, status: 'CANCELLED' })
    );
    (listBookingViewRecipients as Mock).mockRejectedValueOnce(new Error('camp-access down'));

    const res = await PATCH(makePatchRequest({ status: 'CANCELLED' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(BOOKING_ID);
    expect(body.status).toBe('CANCELLED');
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('[integration][load-bearing] identical PATCH body — camper on a normal booking writes rows, a host on their OWN self-booked booking writes zero (only session.user.id differs)', async () => {
    const body = { status: 'CANCELLED' };

    // Call 1 — the actual camper cancels a normal booking at HOST_ID's camp.
    (requireAuth as Mock).mockResolvedValueOnce({ error: null, session: makeSession(CAMPER_ID) });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: CAMPER_ID, operatorId: HOST_ID })
    );
    (prisma.campSiteTeamMember.findFirst as Mock).mockResolvedValueOnce(null);
    (prisma.booking.update as Mock).mockResolvedValueOnce(
      updateFixture({ userId: CAMPER_ID, status: 'CANCELLED' })
    );
    mockRecipients([{ userId: HOST_ID, email: `${HOST_ID}@campvibe.com`, isOwner: true }]);

    const res1 = await PATCH(makePatchRequest(body), makeContext());
    expect(res1.status).toBe(200);
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1); // rows written

    // Call 2 — the SAME PATCH body, but session.user.id now belongs to a host
    // who booked (and operates) their OWN camp: isCamper === true AND
    // canHostUpdate === true simultaneously. An implementation keyed on
    // `isCamper` alone would fire here too; the correct gate must not.
    (requireAuth as Mock).mockResolvedValueOnce({ error: null, session: makeSession(SELF_HOST_ID) });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: SELF_HOST_ID, operatorId: SELF_HOST_ID })
    );
    (prisma.booking.update as Mock).mockResolvedValueOnce(
      updateFixture({ userId: SELF_HOST_ID, status: 'CANCELLED' })
    );

    const res2 = await PATCH(makePatchRequest(body), makeContext());
    expect(res2.status).toBe(200);
    // Still exactly 1 total call — call 2 wrote zero NEW rows.
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
  });

  it('[integration][security] the row carries no guest identity (name/phone/email)', async () => {
    (requireAuth as Mock).mockResolvedValue({ error: null, session: makeSession(CAMPER_ID) });
    (prisma.booking.findUnique as Mock).mockResolvedValueOnce(
      findUniqueFixture({ userId: CAMPER_ID, operatorId: HOST_ID })
    );
    (prisma.campSiteTeamMember.findFirst as Mock).mockResolvedValueOnce(null);
    (prisma.booking.update as Mock).mockResolvedValueOnce(
      updateFixture({ userId: CAMPER_ID, status: 'CANCELLED' })
    );
    mockRecipients([{ userId: HOST_ID, email: `${HOST_ID}@campvibe.com`, isOwner: true }]);

    await PATCH(makePatchRequest({ status: 'CANCELLED' }), makeContext());

    const written = (prisma.notification.createMany as Mock).mock.calls[0][0].data as Array<
      Record<string, unknown>
    >;
    written.forEach((row) => {
      expect(row.title as string).not.toMatch(/@/);
      expect(row.body as string).not.toMatch(/@/);
      expect(row.body as string).not.toContain(CAMPER_ID);
    });
  });
});

// ===========================================================================
// source-inspection — the notify condition uses canHostUpdate, not isCamper alone
// ===========================================================================

describe('[source] the notify condition gates on canHostUpdate (CAM-682)', () => {
  const routeSrc = fs.readFileSync(
    path.join(process.cwd(), 'app/api/bookings/[id]/route.ts'),
    'utf-8'
  );

  it('notifyBookingCancelled is called behind a canHostUpdate check, not isCamper alone', () => {
    expect(routeSrc).toContain('notifyBookingCancelled');
    const guardMatch = routeSrc.match(/if\s*\(status === 'CANCELLED' && isCamper && !canHostUpdate\)/);
    expect(guardMatch).not.toBeNull();
  });
});

// ===========================================================================
// lib/notifications/copy.ts — direct unit coverage (mirrors CAM-681's pattern)
// ===========================================================================

describe('buildBookingCancelledCopy (CAM-682)', () => {
  it('[unit][boundary] the kill switch off returns null', () => {
    NOTIFICATION_EVENTS.bookingCancelled = false;
    const copy = buildBookingCancelledCopy({
      campName: CAMP_NAME_TH,
      checkInDate: new Date(CHECK_IN),
      checkOutDate: new Date(CHECK_OUT),
      guests: 2,
    });
    expect(copy).toBeNull();
  });

  it('[unit][null] a null campName falls back to a generic Thai name, never crashes, no em-dash', () => {
    const copy = buildBookingCancelledCopy({
      campName: null,
      checkInDate: new Date(CHECK_IN),
      checkOutDate: new Date(CHECK_OUT),
      guests: 4,
    });
    expect(copy).not.toBeNull();
    expect(copy!.body).not.toContain('—');
    expect(copy!.body).not.toContain('null');
  });
});

// ===========================================================================
// i18n verbatim — locales/translations.json notifications.booking.cancelled
// ===========================================================================

describe('i18n verbatim — locales/translations.json notifications.booking.cancelled (CAM-682)', () => {
  const translationsPath = path.join(process.cwd(), 'locales/translations.json');
  const translations = JSON.parse(fs.readFileSync(translationsPath, 'utf-8')) as {
    th: { notifications: { booking: { cancelled: { title: string; body: string } } } };
    en: { notifications: { booking: { cancelled: { title: string; body: string } } } };
  };

  it('[copy] th.notifications.booking.cancelled.title === "มีการยกเลิกการจอง" (Thai copy verbatim)', () => {
    expect(translations.th.notifications.booking.cancelled.title).toBe('มีการยกเลิกการจอง');
  });

  it('[copy] th.notifications.booking.cancelled.body has no em-dash separator', () => {
    expect(translations.th.notifications.booking.cancelled.body).not.toContain('—');
  });

  it('[copy] en.notifications.booking.cancelled.title present', () => {
    expect(translations.en.notifications.booking.cancelled.title).toBe('Booking cancelled');
  });
});
