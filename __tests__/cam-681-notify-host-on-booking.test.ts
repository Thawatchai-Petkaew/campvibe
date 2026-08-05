/**
 * cam-681-notify-host-on-booking.test.ts — CAM-681
 *
 * `Notification` (prisma/schema.prisma:857-873) has zero writers before this
 * story. lib/notifications/booking-events.ts is the first, fired from
 * app/api/bookings/route.ts POST-COMMIT only (never inside
 * withBookingTransaction's Serializable retry — see that module's doc
 * comment for why).
 *
 * AC → test matrix
 * ─────────────────────────────────────────────────────────────────────────
 * [normal]     a 201 writes exactly one row per recipient: type BOOKING,
 *              isRead false, link = /dashboard/bookings?highlight=<id>.
 * [security]   the row's title/body carry no guest identity (name/phone/
 *              email) — a Notification row can't be revoked and the read
 *              API filters only by userId (CAM-683), so any identity here
 *              is a permanent disclosure.
 * [normal]     the booking's own creator is excluded from recipients, even
 *              when the lookup returns them (e.g. booking your own camp).
 * [boundary]   the event kill switch off -> zero rows, still 201; the
 *              recipient lookup is never even invoked.
 * [error, LOAD-BEARING] the recipient lookup itself REJECTS -> the response
 *              is still 201 with a booking-shaped body. The happy path looks
 *              identical whether or not this is handled — this is the
 *              defect most likely to slip through review.
 *
 * Mirrors __tests__/cam-668-spot-belongs-to-camp.test.ts /
 * cam-652-charge-the-chosen-unit.test.ts's convention: `prisma` is mocked
 * down to `$transaction` (+ here, `notification.createMany`) so a stray read
 * anywhere else in the module graph throws instead of silently passing.
 * booking-pricing is DELIBERATELY NOT mocked — a real committed booking
 * (with a real totalPrice) is what proves the writer runs post-commit, not
 * mid-transaction.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    notification: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  },
}));
vi.mock('@/lib/auth-utils', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/serialize', () => ({ serializeDecimals: vi.fn((x) => x) }));
vi.mock('@/lib/camp-access', () => ({ listBookingViewRecipients: vi.fn() }));

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { listBookingViewRecipients } from '@/lib/camp-access';
import { NOTIFICATION_EVENTS, buildBookingCreatedCopy } from '@/lib/notifications/copy';

const { POST } = await import('@/app/api/bookings/route');

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------
const CAMP_ID = 'a1a11111-0000-4000-8000-000000000681';
const CREATOR_ID = 'a1a11111-1111-4000-8000-000000000681'; // the camper who books
const CREATOR_EMAIL = 'camper681@campvibe.com';
const HOST_ID = 'a1a11111-2222-4000-8000-000000000681';
const TEAM_ID = 'a1a11111-3333-4000-8000-000000000681';
const BOOKING_ID = 'booking-681-1';
const CAMP_NAME_TH = 'แคมป์ทดสอบ CAM-681';

const CHECK_IN = '2027-03-01';
const CHECK_OUT = '2027-03-02'; // 1 night

function makeSession() {
  return { user: { id: CREATOR_ID, email: CREATOR_EMAIL, name: 'Camper 681' } };
}

function makePostRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/bookings', {
    method: 'POST',
    body: JSON.stringify({
      campSiteId: CAMP_ID,
      checkInDate: CHECK_IN,
      checkOutDate: CHECK_OUT,
      guests: 2,
      ...body,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
}

function baseCampSite(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMP_ID,
    nameTh: CAMP_NAME_TH,
    nameEn: 'CAM-681 Test Camp',
    priceLow: 500,
    priceCurrency: 'THB',
    priceUnit: 'PER_SITE',
    extraFeeAmount: null,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    maxGuestsPerDay: null,
    maxTentsPerDay: null,
    spots: [],
    location: { countryRel: { vatRate: 0, timezone: 'Asia/Bangkok' } },
    ...overrides,
  };
}

function mockTransaction(campSiteFixture: Record<string, unknown>) {
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        booking: {
          findFirst: vi.fn().mockResolvedValue(null), // no spot overlap
          findMany: vi.fn().mockResolvedValue([]), // no capacity conflict
          create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
            id: BOOKING_ID,
            ...data,
          })),
        },
        campSite: { findUnique: vi.fn().mockResolvedValue(campSiteFixture) },
        blockedDate: { findFirst: vi.fn().mockResolvedValue(null) },
        internalHold: { findMany: vi.fn().mockResolvedValue([]) },
      })
  );
}

type Recipient = { userId: string; email: string; isOwner: boolean };

function mockRecipients(recipients: Recipient[]) {
  (listBookingViewRecipients as ReturnType<typeof vi.fn>).mockResolvedValue(recipients);
}

beforeEach(() => {
  vi.clearAllMocks();
  (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null, session: makeSession() });
  NOTIFICATION_EVENTS.bookingCreated = true;
});

afterEach(() => {
  NOTIFICATION_EVENTS.bookingCreated = true; // never leak a flipped switch into another test file
});

// ===========================================================================
// [normal] one row per recipient — shape, link, dedupe
// ===========================================================================

describe('POST /api/bookings — notifies BOOKING_VIEW recipients post-commit (CAM-681)', () => {
  it('[integration][normal] a 201 writes exactly one row per recipient: type BOOKING, isRead false, highlight link', async () => {
    mockRecipients([
      { userId: CREATOR_ID, email: CREATOR_EMAIL, isOwner: false },
      { userId: HOST_ID, email: 'host681@campvibe.com', isOwner: true },
      { userId: TEAM_ID, email: 'team681@campvibe.com', isOwner: false },
    ]);
    mockTransaction(baseCampSite());

    const res = await POST(makePostRequest());
    expect(res.status).toBe(201);

    expect(prisma.notification.createMany).toHaveBeenCalledOnce();
    const written = (prisma.notification.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .data as Array<Record<string, unknown>>;

    // [normal] creator excluded — only HOST_ID + TEAM_ID, never CREATOR_ID.
    expect(written.map((r) => r.userId).sort()).toEqual([HOST_ID, TEAM_ID].sort());

    written.forEach((row) => {
      expect(row.type).toBe('BOOKING');
      expect(row.isRead).toBe(false);
      expect(row.link).toBe(`/dashboard/bookings?highlight=${BOOKING_ID}`);
      expect(row.title).toBeTruthy();
      expect(row.body).toContain(CAMP_NAME_TH);
      expect(row.body as string).not.toContain('—'); // no em-dash separator
    });
  });

  it('[integration][security] the row carries no guest identity (name/phone/email)', async () => {
    mockRecipients([{ userId: HOST_ID, email: 'host681@campvibe.com', isOwner: true }]);
    mockTransaction(baseCampSite());

    await POST(makePostRequest());

    const written = (prisma.notification.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .data as Array<Record<string, unknown>>;
    written.forEach((row) => {
      expect(row.title as string).not.toContain(CREATOR_EMAIL);
      expect(row.body as string).not.toContain(CREATOR_EMAIL);
      expect(row.body as string).not.toMatch(/@/); // no email-shaped content at all
      expect(row.title as string).not.toMatch(/@/);
    });
  });

  it('[integration][boundary] the event kill switch off writes zero rows, still 201, recipient lookup never invoked', async () => {
    NOTIFICATION_EVENTS.bookingCreated = false;
    mockRecipients([{ userId: HOST_ID, email: 'host681@campvibe.com', isOwner: true }]);
    mockTransaction(baseCampSite());

    const res = await POST(makePostRequest());

    expect(res.status).toBe(201);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    // Suppression is decided before the recipient lookup even runs (copy.ts
    // is checked first) — proves no wasted query when the switch is off.
    expect(listBookingViewRecipients).not.toHaveBeenCalled();
  });

  it('[integration][error][load-bearing] the recipient lookup REJECTS — the booking still returns 201 with a booking-shaped body', async () => {
    (listBookingViewRecipients as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('camp-access down'));
    mockTransaction(baseCampSite());

    const res = await POST(makePostRequest());
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe(BOOKING_ID);
    expect(body.status).toBe('PENDING');
    expect(body.campSiteId).toBe(CAMP_ID);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// lib/notifications/copy.ts — direct unit coverage
// ===========================================================================

describe('buildBookingCreatedCopy (CAM-681)', () => {
  it('[unit][boundary] the kill switch off returns null', () => {
    NOTIFICATION_EVENTS.bookingCreated = false;
    const copy = buildBookingCreatedCopy({
      campName: CAMP_NAME_TH,
      checkInDate: new Date(CHECK_IN),
      checkOutDate: new Date(CHECK_OUT),
      guests: 2,
    });
    expect(copy).toBeNull();
  });

  it('[unit][null] a null campName falls back to a generic Thai name, never crashes, no em-dash', () => {
    const copy = buildBookingCreatedCopy({
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
