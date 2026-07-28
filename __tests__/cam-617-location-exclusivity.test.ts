/**
 * cam-617-location-exclusivity.test.ts — CAM-617 (mocked-Prisma unit suite)
 *
 * `POST /api/campsites` (create) used to accept ANY body-supplied
 * `locationId` with no exclusivity check, and `Location.campSites` is a
 * 1:many relation — so a new camp could silently attach to a Location row
 * that already belongs to another camp (found by CAM-613's sweep on the
 * sibling UPDATE-path defect; see that story's tech.md "Related-but-
 * separate finding").
 *
 * Established from the code before concluding this was real (see this
 * story's tech.md): the seed (idempotent per-camp, one Location per unique
 * lat/lon), the CAM-575 coordinate backfill (per-existing-camp
 * reconciliation, never creates a shared Location), and the host-onboarding
 * form (`components/CampgroundForm.tsx` always POSTs a BRAND NEW
 * `/api/location` row on create — `formData.locationId` is only ever
 * pre-populated on the EDIT path, from `initialData.locationId`) all agree:
 * nothing in this codebase ever intends two camps to share one Location row.
 * Unlike CAM-613's PUT-path fix (which could safely IGNORE a foreign body id
 * because `existing.locationId` was already a correct, authorised fallback
 * target), a CREATE has no prior authorised Location to fall back to — so
 * the chosen rule is REJECT (409), not ignore.
 *
 * Layer: integration — direct route invocation with mocked Prisma + mocked
 * auth, same precedent as __tests__/cam-619-campsites-create-price-order.test.ts.
 * The real-DB, end-to-end proof (including the campsite_coords_sync trigger)
 * lives in __tests__/cam-617-location-exclusivity-real-db.test.ts, which
 * NEVER mocks @/lib/prisma (mocking it here, in the SAME file, would also
 * blind that suite — vi.mock hoists per FILE, not per describe block).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
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
  nameTh: 'ทดสอบ CAM-617',
  campSiteType: 'CAGD',
  latitude: 13.75,
  longitude: 100.5,
  checkInTime: '12:00',
  checkOutTime: '12:00',
  bookingMethod: 'ONST',
};

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
  mockRequireAuth.mockResolvedValue({ error: null, session: { user: { id: 'user-cam617-1', role: 'HOST' } } });
  mockFindMany.mockResolvedValue([]);
  mockCreate.mockResolvedValue({ id: 'new-camp-id' });
});

describe('POST /api/campsites — Location exclusivity on create (CAM-617)', () => {
  it('[error/validation, teeth] a locationId already used by an existing CampSite is rejected (409), no create', async () => {
    mockFindFirst.mockResolvedValue({ id: 'someone-elses-camp' });

    const res = await campSitePOST(postRequest({ ...VALID_BASE, locationId: '550e8400-e29b-41d4-a716-446655440001' }));

    expect(res.status).toBe(409);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('[error/validation] the rejection applies even when the existing camp belongs to the SAME operator (exclusivity, not ownership — CAM-617 decision)', async () => {
    // The guard queries by locationId alone — nothing in the codebase ever
    // intends two camps (same host or not) to share one Location row, so the
    // check does not special-case "it's my own other camp".
    mockFindFirst.mockResolvedValue({ id: 'my-other-camp' });

    const res = await campSitePOST(postRequest({ ...VALID_BASE, locationId: '550e8400-e29b-41d4-a716-446655440002' }));

    expect(res.status).toBe(409);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('[normal] a locationId with no existing CampSite is accepted (create succeeds)', async () => {
    mockFindFirst.mockResolvedValue(null);

    const res = await campSitePOST(postRequest({ ...VALID_BASE, locationId: '550e8400-e29b-41d4-a716-446655440003' }));

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
