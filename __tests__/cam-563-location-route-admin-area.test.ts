/**
 * cam-563-location-route-admin-area.test.ts — CAM-563, rewritten by CAM-574
 * (platform-hardening/taxonomy-ui-foundation)
 *
 * `POST /api/location` walks `adminAreaId` DISTRICT then SUBDISTRICT deep
 * from whatever level the client's pick already resolved, bilingual +
 * exact-match + parent-scoped, and stops at the deepest level that actually
 * resolves — satisfying the ticket's AC that "a camp created through the
 * current form gets an adminAreaId".
 *
 * CAM-574 retired the `thaiLocationId` -> `ThailandLocation.provinceCode` ->
 * `AdminArea` lookup this suite originally pinned — the client now sends the
 * `adminAreaId` directly (LocationPicker.tsx / `/api/locations/search`, both
 * moved onto AdminArea). This suite is rewritten to describe that new
 * contract, not deleted or loosened (same AC/BR coverage, new input shape).
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
const mockAdminAreaFindUnique = vi.fn();
const mockAdminAreaFindFirst = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    location: { create: (...args: unknown[]) => mockLocationCreate(...args) },
    country: { findUnique: (...args: unknown[]) => mockCountryFindUnique(...args) },
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

// createLocationSchema.adminAreaId requires z.string().uuid() — these must be
// real UUID-shaped strings (an invalid shape 400s before any mock is consumed).
const PROVINCE_AREA_ID = '11111111-1111-4111-8111-111111111111';
const DISTRICT_AREA_ID = '22222222-2222-4222-8222-222222222222';
const SUBDISTRICT_AREA_ID = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(makeSession());
  mockCountryFindUnique.mockResolvedValue({ code: 'TH' });
  mockLocationCreate.mockResolvedValue({ id: 'loc-uuid-563' });
  mockAdminAreaFindUnique.mockResolvedValue({ id: PROVINCE_AREA_ID, level: 'PROVINCE' });
  mockAdminAreaFindFirst.mockImplementation(async ({ where }: { where: { level: string; parentId: string } }) => {
    if (where.level === 'DISTRICT' && where.parentId === PROVINCE_AREA_ID) return { id: DISTRICT_AREA_ID };
    if (where.level === 'SUBDISTRICT' && where.parentId === DISTRICT_AREA_ID) return { id: SUBDISTRICT_AREA_ID };
    return null;
  });
});

describe('CAM-563/CAM-574 (AC) — POST /api/location: a camp created through the current form gets an adminAreaId', () => {
  it('[AC, normal] a PROVINCE-level pick + district + subDistrict text all resolve -> adminAreaId is the DEEPEST (sub-district) id', async () => {
    const res = await locationPOST(makeRequest({
      lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai',
      district: 'Mueang Chiang Mai', subDistrict: 'Suthep', adminAreaId: PROVINCE_AREA_ID,
    }));

    expect(res.status).toBe(201);
    const areaLookup = mockAdminAreaFindUnique.mock.calls[0][0];
    expect(areaLookup.where).toEqual({ id: PROVINCE_AREA_ID });
    const call = mockLocationCreate.mock.calls[0][0];
    expect(call.data.adminAreaId).toBe(SUBDISTRICT_AREA_ID);
    // the free-text columns are STILL written (BR-3 — no big-bang swap)
    expect(call.data.province).toBe('Chiang Mai');
    expect(call.data.district).toBe('Mueang Chiang Mai');
    expect(call.data.subDistrict).toBe('Suthep');
  });

  it('[boundary] a PROVINCE-level pick + district only (no subDistrict) -> adminAreaId is the district id', async () => {
    const res = await locationPOST(makeRequest({
      lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai',
      district: 'Mueang Chiang Mai', adminAreaId: PROVINCE_AREA_ID,
    }));

    expect(res.status).toBe(201);
    const call = mockLocationCreate.mock.calls[0][0];
    expect(call.data.adminAreaId).toBe(DISTRICT_AREA_ID);
  });

  it('[normal] a DISTRICT-level pick (host picked a district in the cascading select) + subDistrict text -> deepens directly, never re-matches district', async () => {
    mockAdminAreaFindUnique.mockResolvedValueOnce({ id: DISTRICT_AREA_ID, level: 'DISTRICT' });
    const res = await locationPOST(makeRequest({
      lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai',
      district: 'Mueang Chiang Mai', subDistrict: 'Suthep', adminAreaId: DISTRICT_AREA_ID,
    }));

    expect(res.status).toBe(201);
    const call = mockLocationCreate.mock.calls[0][0];
    expect(call.data.adminAreaId).toBe(SUBDISTRICT_AREA_ID);
    // only ONE matchAdminArea call (SUBDISTRICT) — the DISTRICT level was
    // already given by the client, never re-derived from free text.
    expect(mockAdminAreaFindFirst).toHaveBeenCalledOnce();
    expect(mockAdminAreaFindFirst.mock.calls[0][0].where.level).toBe('SUBDISTRICT');
  });

  it('[regression] a PROVINCE-level pick with no district/subDistrict text -> adminAreaId is the province id, unchanged', async () => {
    const res = await locationPOST(makeRequest({
      lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai',
      adminAreaId: PROVINCE_AREA_ID,
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
      district: 'Nonexistent District', subDistrict: 'Suthep', adminAreaId: PROVINCE_AREA_ID,
    }));

    expect(res.status).toBe(201);
    const call = mockLocationCreate.mock.calls[0][0];
    expect(call.data.adminAreaId).toBe(PROVINCE_AREA_ID);
  });

  it('[error/validation] an adminAreaId that does not exist in AdminArea (stale/forged id) -> adminAreaId stays undefined (FK-safe, never trusts the client blindly)', async () => {
    mockAdminAreaFindUnique.mockResolvedValueOnce(null);
    const res = await locationPOST(makeRequest({
      lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai',
      adminAreaId: '00000000-0000-0000-0000-000000000000',
    }));

    expect(res.status).toBe(201);
    const call = mockLocationCreate.mock.calls[0][0];
    expect(call.data.adminAreaId).toBeUndefined();
    expect(mockAdminAreaFindFirst).not.toHaveBeenCalled();
  });

  it('[null/empty] no adminAreaId at all -> adminAreaId stays undefined (no regression to the pre-existing contract)', async () => {
    const res = await locationPOST(makeRequest({
      lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai', district: 'Mueang Chiang Mai',
    }));

    expect(res.status).toBe(201);
    const call = mockLocationCreate.mock.calls[0][0];
    expect(call.data.adminAreaId).toBeUndefined();
    expect(mockAdminAreaFindUnique).not.toHaveBeenCalled();
    expect(mockAdminAreaFindFirst).not.toHaveBeenCalled();
  });
});
