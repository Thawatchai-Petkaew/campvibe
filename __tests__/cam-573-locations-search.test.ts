/**
 * cam-573-locations-search.test.ts — CAM-573 AC-1/AC-2, updated by CAM-574
 *
 * `GET /api/locations/search?type=province|district` moved its match off
 * `ThailandLocation` onto `AdminArea` (CAM-573). CAM-574 (this update) retired
 * the `ThailandLocation` id-bridge CAM-573 built on top of that — the
 * response `id` is now the real `AdminArea.id` directly, no bridge, no
 * `ThailandLocation` read on this endpoint at all. `LocationPicker.tsx` sends
 * this `id` straight through to `POST /api/location` as `adminAreaId`.
 *
 * Coverage matrix (qa.md §7):
 *   normal      — province/district search matches AdminArea, response
 *                 carries the AdminArea id directly (no bridge)
 *   null/empty  — no query text still returns candidates (browse-all);
 *                 missing provinceCode on a district request
 *   error/validation — a district request with no provinceCode never runs
 *                 an unscoped nationwide AdminArea query (BR-3); a DB error
 *                 returns a safe 500 with no leak
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockAdminAreaFindMany = vi.fn();
const mockAdminAreaFindUnique = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminArea: {
      findMany: (...args: unknown[]) => mockAdminAreaFindMany(...args),
      findUnique: (...args: unknown[]) => mockAdminAreaFindUnique(...args),
    },
  },
}));

const { GET: locationsSearchGET } = await import('@/app/api/locations/search/route');

function searchRequest(query: string) {
  return new NextRequest(`http://localhost/api/locations/search${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/locations/search?type=province — AdminArea-sourced, id = the real AdminArea.id (CAM-574)', () => {
  it('[normal] matches AdminArea PROVINCE nodes bilingually and returns the AdminArea id directly', async () => {
    mockAdminAreaFindMany.mockResolvedValueOnce([
      { id: 'aa-province-50', code: '50', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai' },
    ]);

    const res = await locationsSearchGET(searchRequest('?type=province&q=' + encodeURIComponent('เชียงใหม่')));

    expect(res.status).toBe(200);
    const call = mockAdminAreaFindMany.mock.calls[0][0];
    expect(call.where.level).toBe('PROVINCE');
    expect(call.where.countryCode).toBe('TH');
    const orClause = JSON.stringify(call.where.OR);
    expect(orClause).toContain('เชียงใหม่');

    const body = await res.json();
    expect(body).toEqual([
      { id: 'aa-province-50', provinceCode: '50', provinceName: 'เชียงใหม่', provinceNameEn: 'Chiang Mai', districtCode: '', districtName: null, districtNameEn: null },
    ]);
  });

  it('[null/empty] an empty search term still returns candidates (browse-all on popover open)', async () => {
    mockAdminAreaFindMany.mockResolvedValueOnce([
      { id: 'aa-bkk', code: '10', nameTh: 'กรุงเทพมหานคร', nameEn: 'Bangkok' },
    ]);

    const res = await locationsSearchGET(searchRequest('?type=province&q='));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('aa-bkk');
  });

  it('[null/empty] no matches returns an empty array (never fabricates a row)', async () => {
    mockAdminAreaFindMany.mockResolvedValueOnce([]);

    const res = await locationsSearchGET(searchRequest('?type=province&q=xyz'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it('[error/validation] a DB error returns 500 with no detail leak (RISK-9 precedent preserved)', async () => {
    mockAdminAreaFindMany.mockRejectedValueOnce(new Error('INTERNAL DB ERROR secret'));

    const res = await locationsSearchGET(searchRequest('?type=province&q=a'));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to fetch locations' });
    expect(body).not.toHaveProperty('detail');
  });
});

describe('GET /api/locations/search?type=district — scoped to province, id = the real AdminArea.id (CAM-574)', () => {
  it('[normal] scopes to the resolved province AdminArea id and returns the district AdminArea id directly', async () => {
    mockAdminAreaFindUnique.mockResolvedValueOnce({ id: 'aa-province-50', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai' });
    mockAdminAreaFindMany.mockResolvedValueOnce([
      { id: 'aa-district-5001', code: '5001', nameTh: 'เมืองเชียงใหม่', nameEn: 'Mueang Chiang Mai' },
    ]);

    const res = await locationsSearchGET(searchRequest('?type=district&provinceCode=50'));

    expect(res.status).toBe(200);
    const provinceCall = mockAdminAreaFindUnique.mock.calls[0][0];
    expect(provinceCall.where.countryCode_level_code).toEqual({ countryCode: 'TH', level: 'PROVINCE', code: '50' });
    const districtCall = mockAdminAreaFindMany.mock.calls[0][0];
    expect(districtCall.where.parentId).toBe('aa-province-50');
    expect(districtCall.where.level).toBe('DISTRICT');

    const body = await res.json();
    expect(body).toEqual([
      { id: 'aa-district-5001', provinceCode: '50', provinceName: 'เชียงใหม่', provinceNameEn: 'Chiang Mai', districtCode: '5001', districtName: 'เมืองเชียงใหม่', districtNameEn: 'Mueang Chiang Mai' },
    ]);
  });

  it('[null/empty] a missing provinceCode returns [] immediately (BR-3, never every district nationwide)', async () => {
    const res = await locationsSearchGET(searchRequest('?type=district'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(mockAdminAreaFindUnique).not.toHaveBeenCalled();
    expect(mockAdminAreaFindMany).not.toHaveBeenCalled();
  });

  it('[error/validation] an unresolvable provinceCode returns [] without querying districts (never a crash)', async () => {
    mockAdminAreaFindUnique.mockResolvedValueOnce(null);

    const res = await locationsSearchGET(searchRequest('?type=district&provinceCode=999'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(mockAdminAreaFindMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/locations/search — no/unrecognized `type` (CAM-574: the removed ThailandLocation combined branch)', () => {
  it('[null/empty] no `type` param returns an empty array — never the removed ThailandLocation combined search', async () => {
    const res = await locationsSearchGET(searchRequest('?q=เชียง'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(mockAdminAreaFindMany).not.toHaveBeenCalled();
    expect(mockAdminAreaFindUnique).not.toHaveBeenCalled();
  });
});
