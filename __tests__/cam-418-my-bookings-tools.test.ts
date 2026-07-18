/**
 * CAM-418 (ADR-013 §D5, S5a) — lib/ai/tools/my-bookings.ts
 * getMyBookings / getMyBookingDetail — the first two `authed`-tier personal tools.
 *
 * Coverage matrix:
 *   - normal: getMyBookings returns the caller's own bookings, scoped query
 *     shape (where:{userId}, orderBy createdAt desc, take ≤ 10), Decimal
 *     totalPrice mapped to a plain-number totalAmount (BR-5)
 *   - normal: getMyBookingDetail owned id → full detail via getOwnedBooking,
 *     Decimal serialized
 *   - null/empty: zero bookings → { bookings: [] }, not an error (EC-1)
 *   - boundary/security: a two-user fixture proves the query is scoped to
 *     ctx.userId — never another user's rows (AC-1)
 *   - error/validation: getMyBookingDetail with a non-uuid bookingId is
 *     rejected at the zod boundary before execute() runs (EC-2)
 *   - error/validation: getMyBookingDetail for a non-owned / nonexistent id
 *     returns the SAME { ok:false, code:'not_found' } — no existence leak (EC-3)
 *   - error/validation: ctx.userId absent → both tools return an empty/
 *     not_found result rather than an unscoped query (BR-4/EC-4 defense-in-depth)
 *   - security invariant: neither tool's jsonSchema nor zod parameters shape
 *     exposes a `userId` (or any caller-identity) field (AC-4/BR-3)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodObject } from 'zod';
import { Prisma } from '@prisma/client';

const mockFindMany = vi.fn();
const mockGetOwnedBooking = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('@/lib/bookings', () => ({
  getOwnedBooking: (...args: unknown[]) => mockGetOwnedBooking(...args),
}));

const {
  executeGetMyBookings,
  executeGetMyBookingDetail,
  getMyBookingsTool,
  getMyBookingDetailTool,
  getMyBookingDetailArgsSchema,
  MY_BOOKINGS_MAX_RESULTS,
} = await import('@/lib/ai/tools/my-bookings');

const USER_ID = 'user-aaaa-0001-0000-000000000001';
const OTHER_USER_ID = 'user-bbbb-0002-0000-000000000002';
const BOOKING_ID = '123e4567-e89b-12d3-a456-426614174000';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getMyBookings
// ---------------------------------------------------------------------------

describe('getMyBookings — normal (scoped, capped, Decimal serialized)', () => {
  it('[unit] queries where:{userId}, orderBy createdAt desc, take ≤ 10, maps totalPrice → totalAmount', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'b1',
        status: 'CONFIRMED',
        checkInDate: new Date('2026-08-01'),
        checkOutDate: new Date('2026-08-03'),
        snapshotCampName: 'สวนสน แคมป์ปิ้ง',
        totalPrice: new Prisma.Decimal('1250'),
      },
    ]);

    const result = await executeGetMyBookings({ userId: USER_ID });

    expect(result.bookings).toHaveLength(1);
    expect(result.bookings[0]).toEqual({
      id: 'b1',
      status: 'CONFIRMED',
      checkInDate: new Date('2026-08-01'),
      checkOutDate: new Date('2026-08-03'),
      snapshotCampName: 'สวนสน แคมป์ปิ้ง',
      totalAmount: 1250,
    });

    expect(mockFindMany).toHaveBeenCalledOnce();
    const call = mockFindMany.mock.calls[0][0] as {
      where: { userId: string };
      orderBy: { createdAt: string };
      take: number;
    };
    expect(call.where).toEqual({ userId: USER_ID });
    expect(call.orderBy).toEqual({ createdAt: 'desc' });
    expect(call.take).toBeLessThanOrEqual(MY_BOOKINGS_MAX_RESULTS);
  });
});

describe('getMyBookings — null/empty (EC-1)', () => {
  it('[null/empty] zero bookings returns { bookings: [] }, not an error', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const result = await executeGetMyBookings({ userId: USER_ID });

    expect(result).toEqual({ bookings: [] });
  });
});

describe('getMyBookings — two-user fixture (AC-1, zero cross-read)', () => {
  it('[unit] a request scoped to USER_ID never queries OTHER_USER_ID', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    await executeGetMyBookings({ userId: USER_ID });

    const call = mockFindMany.mock.calls[0][0] as { where: { userId: string } };
    expect(call.where.userId).toBe(USER_ID);
    expect(call.where.userId).not.toBe(OTHER_USER_ID);
  });
});

describe('getMyBookings — ctx.userId absent (BR-4/EC-4 defense-in-depth)', () => {
  it('[error/validation] returns { bookings: [] } WITHOUT querying Prisma at all', async () => {
    const result = await executeGetMyBookings({});

    expect(result).toEqual({ bookings: [] });
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getMyBookingDetail
// ---------------------------------------------------------------------------

describe('getMyBookingDetail — normal (owned → full detail, Decimal serialized)', () => {
  it('[unit] returns { ok:true, booking } via getOwnedBooking(id, ctx.userId)', async () => {
    mockGetOwnedBooking.mockResolvedValueOnce({
      id: BOOKING_ID,
      checkInDate: new Date('2026-08-01'),
      checkOutDate: new Date('2026-08-03'),
      guests: 2,
      totalPrice: new Prisma.Decimal('1250'),
      currency: 'THB',
      status: 'CONFIRMED',
      createdAt: new Date('2026-07-01'),
      campSite: { nameTh: 'สวนสน', nameEn: 'Pine Camp' },
      spot: null,
    });

    const args = getMyBookingDetailArgsSchema.parse({ bookingId: BOOKING_ID });
    const result = await executeGetMyBookingDetail(args, { userId: USER_ID });

    expect(mockGetOwnedBooking).toHaveBeenCalledWith(BOOKING_ID, USER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.booking.id).toBe(BOOKING_ID);
      expect(result.booking.totalPrice).toBe(1250); // Decimal → number (BR-5)
    }
  });
});

describe('getMyBookingDetail — non-owned / nonexistent id (AC-3, EC-3, no existence leak)', () => {
  it('[error/validation] getOwnedBooking returning null maps to the SAME not_found for both cases', async () => {
    mockGetOwnedBooking.mockResolvedValueOnce(null);

    const args = getMyBookingDetailArgsSchema.parse({ bookingId: BOOKING_ID });
    const result = await executeGetMyBookingDetail(args, { userId: OTHER_USER_ID });

    expect(result).toEqual({ ok: false, code: 'not_found' });
  });
});

describe('getMyBookingDetail — invalid bookingId format (EC-2, zod boundary)', () => {
  it('[error/validation] rejects a non-uuid bookingId before execute() would ever run', () => {
    const parsed = getMyBookingDetailArgsSchema.safeParse({ bookingId: 'not-a-uuid' });

    expect(parsed.success).toBe(false);
  });
});

describe('getMyBookingDetail — ctx.userId absent (BR-4/EC-4 defense-in-depth)', () => {
  it('[error/validation] returns not_found WITHOUT calling getOwnedBooking at all', async () => {
    const args = getMyBookingDetailArgsSchema.parse({ bookingId: BOOKING_ID });
    const result = await executeGetMyBookingDetail(args, {});

    expect(result).toEqual({ ok: false, code: 'not_found' });
    expect(mockGetOwnedBooking).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Security invariant (AC-4/BR-3) — no userId in either tool's schema surface
// ---------------------------------------------------------------------------

describe('CAM-418 invariant — neither tool exposes userId to the model', () => {
  it('[security] tier is "authed" for both tools', () => {
    expect(getMyBookingsTool.tier).toBe('authed');
    expect(getMyBookingDetailTool.tier).toBe('authed');
  });

  it('[security] jsonSchema and zod parameters shape never mention userId', () => {
    for (const tool of [getMyBookingsTool, getMyBookingDetailTool]) {
      const jsonSchemaText = JSON.stringify(tool.jsonSchema);
      expect(jsonSchemaText, `${tool.name}.jsonSchema must not mention userId`).not.toContain('"userId"');

      if (tool.parameters instanceof ZodObject) {
        const keys = Object.keys(tool.parameters.shape as Record<string, unknown>);
        expect(keys, `${tool.name}.parameters must not accept a userId field`).not.toContain('userId');
      }
    }
  });
});
