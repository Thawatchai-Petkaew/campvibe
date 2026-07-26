/**
 * cam-563-location-route-admin-area.test.ts — CAM-563
 * (platform-hardening/taxonomy-ui-foundation)
 *
 * `POST /api/location` already resolved `Location.adminAreaId` from
 * `thaiLocationId`, but ONLY to the PROVINCE level — even when the host also
 * typed a district/sub-district (CAM-553/CAM-559's free-text fields,
 * confirmed live in `components/CampgroundForm.tsx`'s POST body today).
 * This suite proves the CAM-563 extension: walk DISTRICT then SUBDISTRICT,
 * bilingual + exact-match + parent-scoped, and stop at the deepest level
 * that actually resolves — satisfying the ticket's AC that "a camp created
 * through the current form gets an adminAreaId".
 *
 * Mocking follows the SAME precedent as
 * `__tests__/cam-553-location-write-path.test.ts` /
 * `__tests__/cam-216-sec-b-location-validation.test.ts` (module mocks
 * declared before the route import, Vitest hoisting boundary).
 *
 * Coverage matrix (qa.md §7): normal · null/empty · boundary · error/
 * validation · concurrent/ordering (n/a — single-request handler, no shared
 * mutable state).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockAuth = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock('@/lib/auth-utils', () => ({
  requireAuth: vi.fn(async () => {
    const session = await mockAuth();
    if (!session) {
      const { NextResponse } = await import('next/server');
      return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }), session: null };
    }
    return { error: null, session };
  }),
}));

const mockLocationCreate = vi.fn();
const mockCountryFindUnique = vi.fn();
const mockThailandLocationFind = vi.fn();
const mockAdminAreaFindUnique = vi.fn();
const mockAdminAreaFindFirst = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    location: { create: (...args: unknown[]) => mockLocationCreate(...args) },
    country: { findUnique: (...args: unknown[]) => mockCountryFindUnique(...args) },
    thailandLocation: { findUnique: (...args: unknown[]) => mockThailandLocationFind(...args) },
    adminArea: {
      findUnique: (...args: unknown[]) => mockAdminAreaFindUnique(...args),
      findFirst: (...args: unknown[]) => mockAdminAreaFindFirst(...args),
    },
  },
}));

const { POST: locationPOST } = await import('@/app/api/location/route');

function makeSession() {
  return { user: { id: 'user-uuid-563', email: 'host@campvibe.th', name: 'Host', role: 'OPERATOR' } };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const PROVINCE_AREA_ID = 'area-province-cnx';
const DISTRICT_AREA_ID = 'area-district-mueang';
const SUBDISTRICT_AREA_ID = 'area-subdistrict-suthep';

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(makeSession());
  mockCountryFindUnique.mockResolvedValue({ code: 'TH' });
  mockLocationCreate.mockResolvedValue({ id: 'loc-uuid-563' });
  mockThailandLocationFind.mockResolvedValue({ provinceCode: '50' });
  mockAdminAreaFindUnique.mockResolvedValue({ id: PROVINCE_AREA_ID });
  mockAdminAreaFindFirst.mockImplementation(async ({ where }: { where: { level: string; parentId: string } }) => {
    if (where.level === 'DISTRICT' && where.parentId === PROVINCE_AREA_ID) return { id: DISTRICT_AREA_ID };
    if (where.level === 'SUBDISTRICT' && where.parentId === DISTRICT_AREA_ID) return { id: SUBDISTRICT_AREA_ID };
    return null;
  });
});

describe('CAM-563 (AC) — POST /api/location: a camp created through the current form gets an adminAreaId', () => {
  it('[AC, normal] province + district + subDistrict all resolve -> adminAreaId is the DEEPEST (sub-district) id', async () => {
    const res = await locationPOST(makeRequest({
      lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai',
      district: 'Mueang Chiang Mai', subDistrict: 'Suthep', thaiLocationId: '123e4567-e89b-12d3-a456-426614174000',
    }));

    expect(res.status).toBe(201);
    const call = mockLocationCreate.mock.calls[0][0];
    expect(call.data.adminAreaId).toBe(SUBDISTRICT_AREA_ID);
    // the free-text columns are STILL written (BR-3 — no big-bang swap)
    expect(call.data.province).toBe('Chiang Mai');
    expect(call.data.district).toBe('Mueang Chiang Mai');
    expect(call.data.subDistrict).toBe('Suthep');
  });

  it('[boundary] province + district only (no subDistrict) -> adminAreaId is the district id', async () => {
    const res = await locationPOST(makeRequest({
      lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai',
      district: 'Mueang Chiang Mai', thaiLocationId: '123e4567-e89b-12d3-a456-426614174000',
    }));

    expect(res.status).toBe(201);
    const call = mockLocationCreate.mock.calls[0][0];
    expect(call.data.adminAreaId).toBe(DISTRICT_AREA_ID);
  });

  it('[regression] province only (pre-CAM-563 behavior) -> adminAreaId is the province id, unchanged', async () => {
    const res = await locationPOST(makeRequest({
      lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai',
      thaiLocationId: '123e4567-e89b-12d3-a456-426614174000',
    }));

    expect(res.status).toBe(201);
    const call = mockLocationCreate.mock.calls[0][0];
    expect(call.data.adminAreaId).toBe(PROVINCE_AREA_ID);
    expect(mockAdminAreaFindFirst).not.toHaveBeenCalled();
  });

  it('[error/validation] a district that does not match any AdminArea node under the province stops at the province level (never guesses)', async () => {
    mockAdminAreaFindFirst.mockResolvedValue(null);
    const res = await locationPOST(makeRequest({
      lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai',
      district: 'Nonexistent District', subDistrict: 'Suthep', thaiLocationId: '123e4567-e89b-12d3-a456-426614174000',
    }));

    expect(res.status).toBe(201);
    const call = mockLocationCreate.mock.calls[0][0];
    expect(call.data.adminAreaId).toBe(PROVINCE_AREA_ID);
  });

  it('[null/empty] no thaiLocationId at all -> adminAreaId stays undefined (no regression to the pre-existing contract)', async () => {
    mockThailandLocationFind.mockResolvedValue(null);
    const res = await locationPOST(makeRequest({
      lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai', district: 'Mueang Chiang Mai',
    }));

    expect(res.status).toBe(201);
    const call = mockLocationCreate.mock.calls[0][0];
    expect(call.data.adminAreaId).toBeUndefined();
    expect(mockAdminAreaFindFirst).not.toHaveBeenCalled();
  });
});
