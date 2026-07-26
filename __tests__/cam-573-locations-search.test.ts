/**
 * cam-573-locations-search.test.ts — CAM-573 AC-1/AC-2
 *
 * `GET /api/locations/search?type=province|district` moves its match off
 * `ThailandLocation` onto `AdminArea` (the picker's data source), bridging
 * every matched candidate back to a real `ThailandLocation.id` so
 * `LocationPicker.tsx`'s `thaiLocationId` (a live FK, write path untouched
 * by this story) never regresses — see tech.md "The id-bridge".
 *
 * Coverage matrix (qa.md §7):
 *   normal      — province/district search matches AdminArea, response
 *                 carries the bridged ThailandLocation id
 *   null/empty  — no query text still returns candidates (browse-all);
 *                 missing provinceCode on a district request
 *   boundary    — a candidate with no ThailandLocation counterpart is
 *                 dropped, never fabricated (EC-1)
 *   error/validation — a district request with no provinceCode never runs
 *                 an unscoped nationwide AdminArea query (BR-3)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockAdminAreaFindMany = vi.fn();
const mockAdminAreaFindUnique = vi.fn();
const mockThailandLocationFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminArea: {
      findMany: (...args: unknown[]) => mockAdminAreaFindMany(...args),
      findUnique: (...args: unknown[]) => mockAdminAreaFindUnique(...args),
    },
    thailandLocation: {
      findMany: (...args: unknown[]) => mockThailandLocationFindMany(...args),
    },
    $queryRaw: vi.fn(),
  },
}));

const { GET: locationsSearchGET } = await import('@/app/api/locations/search/route');

function searchRequest(query: string) {
  return new NextRequest(`http://localhost/api/locations/search${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/locations/search?type=province — AdminArea-sourced, bridged to a real ThailandLocation.id (CAM-573 AC-1)', () => {
  it('[normal] matches AdminArea PROVINCE nodes bilingually and returns the bridged ThailandLocation row', async () => {
    mockAdminAreaFindMany.mockResolvedValueOnce([
      { code: '50', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai' },
    ]);
    mockThailandLocationFindMany.mockResolvedValueOnce([
      { id: 'tl-province-50', provinceCode: '50' },
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
      { id: 'tl-province-50', provinceCode: '50', provinceName: 'เชียงใหม่', provinceNameEn: 'Chiang Mai', districtCode: '', districtName: null, districtNameEn: null },
    ]);
  });

  it('[null/empty] an empty search term still returns candidates (browse-all on popover open)', async () => {
    mockAdminAreaFindMany.mockResolvedValueOnce([
      { code: '10', nameTh: 'กรุงเทพมหานคร', nameEn: 'Bangkok' },
    ]);
    mockThailandLocationFindMany.mockResolvedValueOnce([{ id: 'tl-bkk', provinceCode: '10' }]);

    const res = await locationsSearchGET(searchRequest('?type=province&q='));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  it('[boundary] EC-1: a matched AdminArea province with NO ThailandLocation counterpart is dropped, never fabricated', async () => {
    mockAdminAreaFindMany.mockResolvedValueOnce([
      { code: '50', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai' },
      { code: '99', nameTh: 'ไม่มีคู่', nameEn: 'NoCounterpart' },
    ]);
    // Only code '50' has a ThailandLocation row — '99' is a simulated data-drift case.
    mockThailandLocationFindMany.mockResolvedValueOnce([
      { id: 'tl-province-50', provinceCode: '50' },
    ]);

    const res = await locationsSearchGET(searchRequest('?type=province&q=a'));
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('tl-province-50');
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

describe('GET /api/locations/search?type=district — scoped to province, bridged to a real ThailandLocation.id (CAM-573 AC-2)', () => {
  it('[normal] scopes to the resolved province AdminArea id and bridges the match back to ThailandLocation', async () => {
    mockAdminAreaFindUnique.mockResolvedValueOnce({ id: 'aa-province-50', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai' });
    mockAdminAreaFindMany.mockResolvedValueOnce([
      { code: '5001', nameTh: 'เมืองเชียงใหม่', nameEn: 'Mueang Chiang Mai' },
    ]);
    mockThailandLocationFindMany.mockResolvedValueOnce([{ id: 'tl-district-5001', districtCode: '5001' }]);

    const res = await locationsSearchGET(searchRequest('?type=district&provinceCode=50'));

    expect(res.status).toBe(200);
    const provinceCall = mockAdminAreaFindUnique.mock.calls[0][0];
    expect(provinceCall.where.countryCode_level_code).toEqual({ countryCode: 'TH', level: 'PROVINCE', code: '50' });
    const districtCall = mockAdminAreaFindMany.mock.calls[0][0];
    expect(districtCall.where.parentId).toBe('aa-province-50');
    expect(districtCall.where.level).toBe('DISTRICT');

    const body = await res.json();
    expect(body).toEqual([
      { id: 'tl-district-5001', provinceCode: '50', provinceName: 'เชียงใหม่', provinceNameEn: 'Chiang Mai', districtCode: '5001', districtName: 'เมืองเชียงใหม่', districtNameEn: 'Mueang Chiang Mai' },
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

  it('[boundary] a matched AdminArea district with no ThailandLocation counterpart is dropped, never fabricated', async () => {
    mockAdminAreaFindUnique.mockResolvedValueOnce({ id: 'aa-province-50', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai' });
    mockAdminAreaFindMany.mockResolvedValueOnce([
      { code: '5001', nameTh: 'เมืองเชียงใหม่', nameEn: 'Mueang Chiang Mai' },
      { code: '5099', nameTh: 'ไม่มีคู่', nameEn: 'NoCounterpart' },
    ]);
    mockThailandLocationFindMany.mockResolvedValueOnce([{ id: 'tl-district-5001', districtCode: '5001' }]);

    const res = await locationsSearchGET(searchRequest('?type=district&provinceCode=50'));
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('tl-district-5001');
  });
});
