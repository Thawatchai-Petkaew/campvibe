/**
 * cam-619-campsites-create-price-order.test.ts — CAM-619 AC-2 (create path)
 *
 * `POST /api/campsites` (create) now rejects an inverted priceLow/priceHigh
 * BEFORE any Prisma write — the create-side half of the same
 * `isPriceOrderValid` check the PUT route already exercises in
 * cam-619-campsites-rate-limit.test.ts. Layer: integration — direct route
 * invocation with mocked Prisma + mocked auth, same precedent as
 * __tests__/cam-534-catalog-rate-limit.test.ts / cam-520.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    // CAM-617: findFirst added — POST /api/campsites now checks Location
    // exclusivity before create (same fixture-note pattern CAM-613
    // documented for its own sibling route).
    campSite: { create: vi.fn(), findFirst: vi.fn() },
    masterData: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireAuth: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { POST as campSitePOST } from '@/app/api/campsites/route';
import { _store } from '@/lib/rate-limit';

const mockCreate = prisma.campSite.create as unknown as ReturnType<typeof vi.fn>;
const mockFindFirst = prisma.campSite.findFirst as unknown as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.masterData.findMany as unknown as ReturnType<typeof vi.fn>;
const mockRequireAuth = requireAuth as unknown as ReturnType<typeof vi.fn>;

function postRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/campsites', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const VALID_BASE = {
  nameTh: 'ทดสอบ',
  campSiteType: 'CAGD',
  latitude: 13.75,
  longitude: 100.5,
  checkInTime: '12:00',
  checkOutTime: '12:00',
  bookingMethod: 'ONST',
  locationId: '550e8400-e29b-41d4-a716-446655440001',
};

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
  mockRequireAuth.mockResolvedValue({ error: null, session: { user: { id: 'user-create-1', role: 'HOST' } } });
  mockFindMany.mockResolvedValue([]);
  mockFindFirst.mockResolvedValue(null);
  mockCreate.mockResolvedValue({ id: 'new-camp-id' });
});

describe('POST /api/campsites — priceLow<=priceHigh order (CAM-619 AC-2, create path)', () => {
  it('[error/validation, teeth] priceLow=5000 > priceHigh=1000 is 400, no Prisma write', async () => {
    const res = await campSitePOST(postRequest({ ...VALID_BASE, priceLow: 5000, priceHigh: 1000 }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('[normal] priceLow=500 <= priceHigh=1200 is accepted', async () => {
    const res = await campSitePOST(postRequest({ ...VALID_BASE, priceLow: 500, priceHigh: 1200 }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('[normal] omitting both price fields is accepted (nothing to compare)', async () => {
    const res = await campSitePOST(postRequest({ ...VALID_BASE }));
    expect(res.status).toBe(201);
  });
});
