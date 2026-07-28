/**
 * cam-574-retire-thailand-location.test.ts — CAM-574 (phase B of the
 * ThailandLocation retirement the owner approved)
 *
 * Proves the end-to-end contract after retiring `Location.thaiLocationId`:
 *   - a camp created through the current form still gets a resolved
 *     `adminAreaId` (deepest level reached), sent as `adminAreaId` (not the
 *     retired `thaiLocationId`)
 *   - the CAM-556 edit-path regression (district silently dropped on edit)
 *     stays fixed, independent of `ThailandLocation`
 *   - `/api/locations/search` still returns real candidates for a Thai
 *     search term, with `id` = the real `AdminArea.id` (no bridge)
 *
 * The Chiang Mai canary (18 camps) is verified against the REAL local dev
 * DB (not mocked here — see the PR body for the exact command + output at
 * every layer this story touches: DB `campSite.count`, the migrated
 * `AdminArea`-based Thai-name resolve, and `/api/locations/search`'s own
 * query). The catalog-filter path (`buildCampSiteWhere`/
 * `resolveProvinceAdminAreaIds`) is untouched by this story and stays
 * covered by CAM-573's own `__tests__/cam-573-province-filter-parity.test.ts`
 * (unedited, still green).
 *
 * Regression guard: NONE of the mocked `prisma` objects below declare a
 * `thailandLocation` key — if any code path under test still called
 * `prisma.thailandLocation.*`, the call would throw ("Cannot read properties
 * of undefined"), failing the test loudly rather than silently.
 *
 * Coverage matrix (qa.md §7):
 *   normal      — create resolves adminAreaId to the deepest level; edit
 *                 persists a changed district
 *   null/empty  — a district search with no query text still returns
 *                 candidates (browse-all)
 *   error/validation — an invalid adminAreaId (not a real AdminArea row)
 *                 never reaches prisma.location.create as a fabricated id
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockLocationCreate = vi.fn();
const mockCountryFindUnique = vi.fn();
const mockAdminAreaFindUnique = vi.fn();
const mockAdminAreaFindFirst = vi.fn();
const mockAdminAreaFindMany = vi.fn();
const mockCampSiteUpdate = vi.fn();
const mockLocationUpdate = vi.fn();

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/auth-utils', () => ({
  requireAuth: vi.fn(async () => ({
    error: null,
    session: { user: { id: 'host-uuid-574', email: 'host@campvibe.th', name: 'Host', role: 'OPERATOR' } },
  })),
  requireCampSitePermission: vi.fn(async () => ({
    error: null,
    // CAM-613: `locationId` is now REQUIRED on this mock — the route's
    // location-update write targets `existing.locationId` (this record),
    // never a body-supplied id. Set to LOCATION_ID so the existing
    // [normal] edit test below (which also submits `locationId: LOCATION_ID`
    // in the request body — the legitimate/normal case) keeps asserting the
    // exact same write target as before the fix.
    campSite: { id: CAMP_ID, operatorId: 'host-uuid-574', isPublished: false, locationId: LOCATION_ID },
    session: { user: { id: 'host-uuid-574' } },
  })),
}));

// CAM-574 regression guard: deliberately NO `thailandLocation` key — a
// resurrected call would throw, not silently no-op.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    location: { create: (...args: unknown[]) => mockLocationCreate(...args), update: (...args: unknown[]) => mockLocationUpdate(...args) },
    country: { findUnique: (...args: unknown[]) => mockCountryFindUnique(...args) },
    adminArea: {
      findUnique: (...args: unknown[]) => mockAdminAreaFindUnique(...args),
      findFirst: (...args: unknown[]) => mockAdminAreaFindFirst(...args),
      findMany: (...args: unknown[]) => mockAdminAreaFindMany(...args),
    },
    campSite: { update: (...args: unknown[]) => mockCampSiteUpdate(...args) },
  },
}));

const { POST: locationPOST } = await import('@/app/api/location/route');
const { PUT: campSitePUT } = await import('@/app/api/campsites/[id]/route');
const { GET: locationsSearchGET } = await import('@/app/api/locations/search/route');

const CAMP_ID = '550e8400-e29b-41d4-a716-446655440574';
const LOCATION_ID = 'c2fef996-3f4c-4ff0-99ab-4425438f2574';
// createLocationSchema.adminAreaId requires z.string().uuid() — these must be
// real UUID-shaped strings (an invalid shape 400s before any mock is consumed).
const PROVINCE_AREA_ID = '11111111-1111-4111-8111-111111111111';
const DISTRICT_AREA_ID = '22222222-2222-4222-8222-222222222222';
const SUBDISTRICT_AREA_ID = '33333333-3333-4333-8333-333333333333';

function locationRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function putRequest(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/campsites/${CAMP_ID}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockCountryFindUnique.mockResolvedValue({ code: 'TH' });
});

describe('CAM-574 — a camp created through the current form persists all 3 location levels + a resolved adminAreaId', () => {
  it('[normal] province + district + subDistrict all resolve -> adminAreaId is the DEEPEST (sub-district) id, never thaiLocationId', async () => {
    mockAdminAreaFindUnique.mockResolvedValueOnce({ id: PROVINCE_AREA_ID, level: 'PROVINCE' });
    mockAdminAreaFindFirst.mockImplementation(async ({ where }: { where: { level: string; parentId: string } }) => {
      if (where.level === 'DISTRICT' && where.parentId === PROVINCE_AREA_ID) return { id: DISTRICT_AREA_ID };
      if (where.level === 'SUBDISTRICT' && where.parentId === DISTRICT_AREA_ID) return { id: SUBDISTRICT_AREA_ID };
      return null;
    });
    mockLocationCreate.mockResolvedValueOnce({ id: LOCATION_ID });

    const res = await locationPOST(locationRequest({
      lat: 18.9167, lon: 98.9667, country: 'Thailand',
      province: 'Chiang Mai', district: 'Mueang Chiang Mai', subDistrict: 'Suthep',
      adminAreaId: PROVINCE_AREA_ID,
    }));

    expect(res.status).toBe(201);
    const call = mockLocationCreate.mock.calls[0][0];
    expect(call.data.adminAreaId).toBe(SUBDISTRICT_AREA_ID);
    expect(call.data.province).toBe('Chiang Mai');
    expect(call.data.district).toBe('Mueang Chiang Mai');
    expect(call.data.subDistrict).toBe('Suthep');
    // never a thaiLocationId key at all — the FK column is retired
    expect('thaiLocationId' in call.data).toBe(false);
  });

  it('[error/validation] an adminAreaId that is not a real AdminArea row never fabricates one — adminAreaId stays undefined', async () => {
    mockAdminAreaFindUnique.mockResolvedValueOnce(null);
    mockLocationCreate.mockResolvedValueOnce({ id: LOCATION_ID });

    const res = await locationPOST(locationRequest({
      lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai',
      adminAreaId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    }));

    expect(res.status).toBe(201);
    const call = mockLocationCreate.mock.calls[0][0];
    expect(call.data.adminAreaId).toBeUndefined();
    expect(mockAdminAreaFindFirst).not.toHaveBeenCalled();
  });
});

describe('CAM-574/CAM-556 — the edit path still persists district (never silently dropped, independent of ThailandLocation)', () => {
  beforeEach(() => {
    mockCampSiteUpdate.mockResolvedValue({ id: CAMP_ID, nameThSlug: 'slug-th', nameEnSlug: 'slug-en' });
    mockLocationUpdate.mockResolvedValue({ id: LOCATION_ID });
  });

  it('[normal] editing an existing camp with a NEW district persists it (CAM-556 regression stays fixed)', async () => {
    const res = await campSitePUT(
      putRequest({ locationId: LOCATION_ID, province: 'Chiang Mai', district: 'Mae Rim', subDistrict: 'Rim Tai' }),
      makeParams(CAMP_ID)
    );

    expect(res.status).toBe(200);
    const call = mockLocationUpdate.mock.calls[0][0];
    expect(call.where).toEqual({ id: LOCATION_ID });
    expect(call.data.district).toBe('Mae Rim');
    expect(call.data.subDistrict).toBe('Rim Tai');
  });
});

describe('CAM-574 — /api/locations/search still returns real candidates for a Thai search term (no ThailandLocation bridge)', () => {
  it('[null/empty] an empty query still returns candidates on popover-open (browse-all)', async () => {
    mockAdminAreaFindMany.mockResolvedValueOnce([
      { id: PROVINCE_AREA_ID, code: '50', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai' },
    ]);

    const res = await locationsSearchGET(new NextRequest('http://localhost/api/locations/search?type=province&q='));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([
      { id: PROVINCE_AREA_ID, provinceCode: '50', provinceName: 'เชียงใหม่', provinceNameEn: 'Chiang Mai', districtCode: '', districtName: null, districtNameEn: null },
    ]);
  });

  it('[normal] a Thai search term ("เชียงใหม่") returns a real candidate row carrying a real AdminArea.id', async () => {
    mockAdminAreaFindMany.mockResolvedValueOnce([
      { id: PROVINCE_AREA_ID, code: '50', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai' },
    ]);

    const res = await locationsSearchGET(
      new NextRequest('http://localhost/api/locations/search?type=province&q=' + encodeURIComponent('เชียงใหม่'))
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body[0].id).toBe(PROVINCE_AREA_ID);
    expect(body[0].provinceNameEn).toBe('Chiang Mai');
  });
});
