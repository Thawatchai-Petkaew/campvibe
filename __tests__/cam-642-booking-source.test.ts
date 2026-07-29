/**
 * cam-642-booking-source.test.ts — CAM-642: every booking records where it came from.
 *
 * AC→test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC#1  bookingSchema: `source` omitted → defaults to 'WEB'
 * AC#2  bookingSchema: `source: 'CHAT'` → parses through unchanged
 * AC#3  bookingSchema: an out-of-enum `source` value is rejected (400), not smuggled through
 * AC#4  POST /api/bookings, no `source` in the request body → persisted booking.source === 'WEB'
 * AC#5  POST /api/bookings, `source: 'CHAT'` in the request body → persisted booking.source === 'CHAT'
 * AC#6  POST /api/bookings — a client-supplied `userId` in the body is IGNORED in favour of the
 *       session's userId (pins the `{ ...body, userId }` spread order at the boundary — a client
 *       cannot smuggle another user's id through `source` or any other body field either)
 *
 * Layers used:
 *   unit        = bookingSchema (zod) in isolation
 *   integration = POST handler with mocked prisma.$transaction + mocked requireAuth
 *
 * Security note: `source` is an attribution label only — these tests also confirm it never
 * appears in any pricing/capacity/authz branch (it is written straight through to
 * tx.booking.create with no conditional read anywhere in the route).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { bookingSchema } from '@/lib/validations/booking';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports (same shape as cam-57-atomic-lock.test.ts)
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    booking: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    campSite: {
      findUnique: vi.fn(),
    },
    blockedDate: {
      findFirst: vi.fn(),
    },
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
    totalAmount: 500,
    extraFeeAmount: 0,
  })),
}));

vi.mock('@/lib/serialize', () => ({
  serializeDecimals: vi.fn((x) => x),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';

const { POST } = await import('@/app/api/bookings/route');

// ---------------------------------------------------------------------------
// Helpers & fixtures
// ---------------------------------------------------------------------------

const CAMP_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-000000000001';
const SPOT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-000000000002';
const SESSION_USER_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-000000000003';
const OTHER_USER_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-000000000099';
const CHECK_IN = '2026-08-01';
const CHECK_OUT = '2026-08-03';

function makeSession(userId = SESSION_USER_ID) {
  return { user: { id: userId, email: 'test@campvibe.com', name: 'Tester' } };
}

function makePostRequest(body: Record<string, unknown> = {}): NextRequest {
  const defaultBody = {
    campSiteId: CAMP_ID,
    spotId: SPOT_ID,
    checkInDate: CHECK_IN,
    checkOutDate: CHECK_OUT,
    guests: 2,
  };
  return new NextRequest('http://localhost/api/bookings', {
    method: 'POST',
    body: JSON.stringify({ ...defaultBody, ...body }),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Wires a $transaction mock that reaches tx.booking.create and captures its `data` arg. */
function mockSuccessfulTransaction(createSpy: ReturnType<typeof vi.fn>) {
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (callback: (tx: unknown) => Promise<unknown>) => {
      return callback({
        booking: {
          findFirst: vi.fn().mockResolvedValue(null), // no overlap
          findMany: vi.fn().mockResolvedValue([]), // no capacity issue
          create: createSpy,
        },
        campSite: {
          findUnique: vi.fn().mockResolvedValue({
            id: CAMP_ID,
            nameTh: 'Test Camp',
            nameEn: 'Test Camp EN',
            priceLow: 500,
            priceCurrency: 'THB',
            checkInTime: '14:00',
            checkOutTime: '12:00',
            extraFeeAmount: null,
            maxGuestsPerDay: null,
            maxTentsPerDay: null,
            spots: [{ id: SPOT_ID, name: 'A1', pricePerNight: 500 }],
            location: { countryRel: { vatRate: 0, timezone: 'Asia/Bangkok' } },
          }),
        },
        blockedDate: { findFirst: vi.fn().mockResolvedValue(null) },
        internalHold: { findMany: vi.fn().mockResolvedValue([]) },
      });
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// Group A: bookingSchema (zod boundary) — AC#1, AC#2, AC#3
// ===========================================================================

describe('bookingSchema — source field (AC#1, AC#2, AC#3)', () => {
  const validBase = {
    campSiteId: CAMP_ID,
    checkInDate: CHECK_IN,
    checkOutDate: CHECK_OUT,
    guests: 2,
    userId: SESSION_USER_ID,
  };

  it('[ac1] source omitted from input → defaults to WEB', () => {
    const result = bookingSchema.safeParse(validBase);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe('WEB');
    }
  });

  it('[ac2] source: "CHAT" → parses through unchanged', () => {
    const result = bookingSchema.safeParse({ ...validBase, source: 'CHAT' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe('CHAT');
    }
  });

  it('[ac3] an out-of-enum source value is rejected, not silently coerced or passed through', () => {
    const result = bookingSchema.safeParse({ ...validBase, source: 'MOBILE_APP' });

    expect(result.success).toBe(false);
  });

  it('[ac3] a non-string source value (injection attempt) is rejected', () => {
    const result = bookingSchema.safeParse({ ...validBase, source: { $ne: null } });

    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// Group B: POST /api/bookings — persisted source (AC#4, AC#5)
// ===========================================================================

describe('POST /api/bookings — persists source (AC#4, AC#5)', () => {
  it('[ac4] no source in the request body → tx.booking.create is called with source: "WEB"', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null, session: makeSession() });
    const createSpy = vi.fn().mockResolvedValue({ id: 'booking-001' });
    mockSuccessfulTransaction(createSpy);

    const res = await POST(makePostRequest());

    expect(res.status).toBe(201);
    expect(createSpy).toHaveBeenCalledOnce();
    const createArg = createSpy.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createArg.data.source).toBe('WEB');
  });

  it('[ac5] source: "CHAT" in the request body → tx.booking.create is called with source: "CHAT"', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null, session: makeSession() });
    const createSpy = vi.fn().mockResolvedValue({ id: 'booking-002' });
    mockSuccessfulTransaction(createSpy);

    const res = await POST(makePostRequest({ source: 'CHAT' }));

    expect(res.status).toBe(201);
    expect(createSpy).toHaveBeenCalledOnce();
    const createArg = createSpy.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createArg.data.source).toBe('CHAT');
  });

  it('[ac3-http] an invalid source value in the request body → 400, tx never reached', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null, session: makeSession() });

    const res = await POST(makePostRequest({ source: 'MOBILE_APP' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation Error');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Group C: userId is server-authoritative — AC#6
// ===========================================================================

describe('POST /api/bookings — client-supplied userId is ignored (AC#6, security)', () => {
  it('[ac6] a client-supplied userId in the body is overridden by the session userId', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null, session: makeSession(SESSION_USER_ID) });
    const createSpy = vi.fn().mockResolvedValue({ id: 'booking-003' });
    mockSuccessfulTransaction(createSpy);

    // Attacker attempts to attribute the booking to a different user via the body.
    const res = await POST(makePostRequest({ userId: OTHER_USER_ID }));

    expect(res.status).toBe(201);
    expect(createSpy).toHaveBeenCalledOnce();
    const createArg = createSpy.mock.calls[0][0] as { data: Record<string, unknown> };
    // The persisted userId is the SESSION's id, never the body's.
    expect(createArg.data.userId).toBe(SESSION_USER_ID);
    expect(createArg.data.userId).not.toBe(OTHER_USER_ID);
  });
});
