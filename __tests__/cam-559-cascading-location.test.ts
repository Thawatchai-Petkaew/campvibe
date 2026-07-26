/**
 * cam-559-cascading-location.test.ts — CAM-559
 *
 * Story: replace the flat province/district LocationPicker with a real
 * cascading province -> district -> sub-district picker (each searchable,
 * each narrowing the next, Thai as the primary search path), persist all
 * three levels on BOTH create and edit, and fold in CAM-556 (the camp EDIT
 * path silently drops `district` — the same "form collects, API ignores"
 * defect class CAM-553 already fixed once on the CREATE path).
 *
 * CAM-556 Prove-It (RED-first, same shape as CAM-553's
 * __tests__/cam-553-location-write-path.test.ts): `app/api/campsites/[id]/
 * route.ts` PUT only ever read `(body as any).province` and wrote ONLY
 * `province` to `prisma.location.update` — `district`/`subDistrict` never
 * reached the database on an edit, and the read was never zod-validated
 * (silently bypassed `campSiteSchema` entirely). Verified RED against the
 * pre-fix code (reverting the location-update block back to the
 * `province`-only truthy-gated version makes every "PUT ... district/
 * subDistrict" test below fail — confirmed by hand before writing the fix).
 *
 * Layer: unit (zod boundary) + integration (route handlers, mocked Prisma +
 * auth-utils, same precedent as __tests__/cam-360-logo-clear-persists.test.ts)
 * + source-inspection (FE payload wiring, same precedent as CAM-553/CAM-360)
 * + component behavior (jsdom + mocked fetch, cascading narrow + Thai search).
 *
 * Coverage matrix (qa.md §7):
 *   normal      — a submitted district/subDistrict reaches prisma writes on
 *                 both POST /api/location (create) and PUT /api/campsites/
 *                 [id] (edit)
 *   null/empty  — omitting a field is a no-op skip; an explicit "" clears
 *                 the column to null (matches the CAM-341/CAM-360 pattern)
 *   boundary    — 100-char max passes, 101 chars is rejected
 *   error       — a non-string field / a bad admin-areas query is rejected
 *   concurrent/ordering — n/a (no shared mutable state across requests here)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';
import {
    createLocationSchema,
    updateCampSiteLocationSchema,
    adminAreaSubDistrictQuerySchema,
} from '@/lib/validations/location';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

// ---------------------------------------------------------------------------
// Module mocks — declared before route imports (Vitest hoisting boundary),
// same pattern as cam-553/cam-360.
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
    prisma: {
        campSite: { update: vi.fn() },
        location: { update: vi.fn(), create: vi.fn() },
        country: { findUnique: vi.fn() },
        thailandLocation: { findUnique: vi.fn(), findMany: vi.fn() },
        adminArea: { findUnique: vi.fn(), findMany: vi.fn() },
    },
}));

vi.mock('@/lib/auth-utils', () => ({
    requireCampSitePermission: vi.fn(),
    requireAuth: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireCampSitePermission, requireAuth } from '@/lib/auth-utils';
import { PUT as campSitePUT } from '@/app/api/campsites/[id]/route';
import { POST as locationPOST } from '@/app/api/location/route';
import { GET as adminAreaSubDistrictsGET } from '@/app/api/admin-areas/subdistricts/route';
import { GET as locationsSearchGET } from '@/app/api/locations/search/route';

const CAMP_ID = '550e8400-e29b-41d4-a716-446655440559';
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function mockAllowed() {
    (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: null,
        campSite: { id: CAMP_ID, operatorId: 'op-1', isPublished: false } as never,
        session: { user: { id: 'op-1' } } as never,
    });
}

function putRequest(body: Record<string, unknown>) {
    return new NextRequest(`http://localhost/api/campsites/${CAMP_ID}`, {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
    });
}

function makeSession() {
    return { user: { id: 'user-uuid-559', email: 'host@campvibe.th', name: 'Host', role: 'OPERATOR' } };
}

function locationPostRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function adminAreaRequest(query: string): NextRequest {
    return new NextRequest(`http://localhost/api/admin-areas/subdistricts${query}`);
}

const LOCATION_ID = 'c2fef996-3f4c-4ff0-99ab-4425438f2fce';

// ---------------------------------------------------------------------------
// CAM-556 Prove-It — PUT /api/campsites/[id] persists district + subDistrict
// ---------------------------------------------------------------------------
describe('PUT /api/campsites/[id] — district + subDistrict reach the database (CAM-556 Prove-It)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAllowed();
        (prisma.campSite.update as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: CAMP_ID,
            nameThSlug: 'slug-th',
            nameEnSlug: 'slug-en',
        });
        (prisma.location.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: LOCATION_ID });
    });

    it('[normal] a submitted district AND subDistrict reach prisma.location.update', async () => {
        const res = await campSitePUT(
            putRequest({ locationId: LOCATION_ID, province: 'Chiang Mai', district: 'Mueang Chiang Mai', subDistrict: 'Suthep' }),
            makeParams(CAMP_ID)
        );

        expect(res.status).toBe(200);
        expect(prisma.location.update).toHaveBeenCalledOnce();
        const call = (prisma.location.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call.where).toEqual({ id: LOCATION_ID });
        expect(call.data.district).toBe('Mueang Chiang Mai');
        expect(call.data.subDistrict).toBe('Suthep');
    });

    it('[regression] province still reaches the database alongside district/subDistrict', async () => {
        await campSitePUT(
            putRequest({ locationId: LOCATION_ID, province: 'Chiang Mai', district: 'Mae Rim', subDistrict: 'Rim Tai' }),
            makeParams(CAMP_ID)
        );

        const call = (prisma.location.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call.data.province).toBe('Chiang Mai');
        expect(call.data.district).toBe('Mae Rim');
        expect(call.data.subDistrict).toBe('Rim Tai');
    });

    it('[null/empty] an explicit "" clears district/subDistrict to null (CAM-341/CAM-360 pattern)', async () => {
        await campSitePUT(
            putRequest({ locationId: LOCATION_ID, district: '', subDistrict: '' }),
            makeParams(CAMP_ID)
        );

        const call = (prisma.location.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call.data.district).toBeNull();
        expect(call.data.subDistrict).toBeNull();
    });

    it('[null/empty] EC — omitting district/subDistrict entirely never touches those columns (partial price-only edit)', async () => {
        await campSitePUT(putRequest({ priceLow: 700 }), makeParams(CAMP_ID));

        // No location field present at all -> no location.update call at all.
        expect(prisma.location.update).not.toHaveBeenCalled();
    });

    it('[null/empty] EC — a partial edit that sends ONLY province never touches district/subDistrict', async () => {
        await campSitePUT(putRequest({ locationId: LOCATION_ID, province: 'Phuket' }), makeParams(CAMP_ID));

        const call = (prisma.location.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call.data.province).toBe('Phuket');
        expect('district' in call.data).toBe(false);
        expect('subDistrict' in call.data).toBe(false);
    });

    it('[error/validation] a district over 100 chars is rejected with 400, no write', async () => {
        const res = await campSitePUT(
            putRequest({ locationId: LOCATION_ID, district: 'D'.repeat(101) }),
            makeParams(CAMP_ID)
        );

        expect(res.status).toBe(400);
        expect(prisma.location.update).not.toHaveBeenCalled();
    });

    it('[boundary] a district at exactly 100 chars is accepted', async () => {
        const res = await campSitePUT(
            putRequest({ locationId: LOCATION_ID, district: 'D'.repeat(100) }),
            makeParams(CAMP_ID)
        );

        expect(res.status).toBe(200);
        const call = (prisma.location.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call.data.district).toBe('D'.repeat(100));
    });
});

// ---------------------------------------------------------------------------
// Zod boundary — updateCampSiteLocationSchema (the PUT location sub-payload)
// ---------------------------------------------------------------------------
describe('updateCampSiteLocationSchema (CAM-559)', () => {
    it('[normal] accepts province/district/subDistrict together', () => {
        const result = updateCampSiteLocationSchema.safeParse({
            province: 'Chiang Mai', district: 'Mueang', subDistrict: 'Suthep',
        });
        expect(result.success).toBe(true);
    });

    it('[null/empty] all three are optional; empty object is valid', () => {
        const result = updateCampSiteLocationSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('[boundary] subDistrict at 101 chars is rejected', () => {
        const result = updateCampSiteLocationSchema.safeParse({ subDistrict: 'S'.repeat(101) });
        expect(result.success).toBe(false);
    });

    it('[error/validation] a non-string subDistrict is rejected', () => {
        const result = updateCampSiteLocationSchema.safeParse({ subDistrict: 42 });
        expect(result.success).toBe(false);
    });

    it('trims whitespace', () => {
        const result = updateCampSiteLocationSchema.safeParse({ subDistrict: '  Suthep  ' });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.subDistrict).toBe('Suthep');
    });
});

// ---------------------------------------------------------------------------
// Zod boundary — createLocationSchema.subDistrict (CAM-553's district
// pattern, mirrored for the third level)
// ---------------------------------------------------------------------------
describe('createLocationSchema.subDistrict (CAM-559)', () => {
    it('[normal] accepts a subDistrict string alongside province/district', () => {
        const result = createLocationSchema.safeParse({
            lat: 18.9167, lon: 98.9667, province: 'Chiang Mai', district: 'Mueang Chiang Mai', subDistrict: 'Suthep',
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.subDistrict).toBe('Suthep');
    });

    it('[null/empty] omitting subDistrict is still valid (no regression to the optional contract)', () => {
        const result = createLocationSchema.safeParse({ lat: 13.0, lon: 100.0 });
        expect(result.success).toBe(true);
    });

    it('[boundary] subDistrict at exactly 100 chars passes', () => {
        const result = createLocationSchema.safeParse({ lat: 13.0, lon: 100.0, subDistrict: 'S'.repeat(100) });
        expect(result.success).toBe(true);
    });

    it('[boundary] subDistrict at 101 chars is rejected', () => {
        const result = createLocationSchema.safeParse({ lat: 13.0, lon: 100.0, subDistrict: 'S'.repeat(101) });
        expect(result.success).toBe(false);
    });

    it('[error/validation] a non-string subDistrict is rejected', () => {
        const result = createLocationSchema.safeParse({ lat: 13.0, lon: 100.0, subDistrict: 42 });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Integration — POST /api/location persists subDistrict (mirrors CAM-553's
// district Prove-It on the CREATE path — already-fixed seam, regression
// guard here).
// ---------------------------------------------------------------------------
describe('POST /api/location — subDistrict reaches the database (CAM-559)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null, session: makeSession() });
        (prisma.country.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ code: 'TH' });
        (prisma.thailandLocation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (prisma.location.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: LOCATION_ID });
    });

    it('[normal] a submitted subDistrict is passed to prisma.location.create', async () => {
        const res = await locationPOST(locationPostRequest({
            lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai', district: 'Mueang Chiang Mai', subDistrict: 'Suthep',
        }));

        expect(res.status).toBe(201);
        const call = (prisma.location.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call.data.subDistrict).toBe('Suthep');
        expect(call.data.district).toBe('Mueang Chiang Mai');
    });

    it('[null/empty] omitting subDistrict still creates the location (no regression)', async () => {
        const res = await locationPOST(locationPostRequest({
            lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai',
        }));

        expect(res.status).toBe(201);
        const call = (prisma.location.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call.data.subDistrict).toBeUndefined();
    });

    it('sends subDistrict: formData.subDistrict in the /api/location POST body (source-inspection)', () => {
        const formSrc = src('components/CampgroundForm.tsx');
        expect(formSrc).toContain('subDistrict: formData.subDistrict');
    });
});

// ---------------------------------------------------------------------------
// Integration — GET /api/admin-areas/subdistricts scopes by districtCode
// (the "cascade genuinely narrows" proof — never returns the whole
// 7,452-row table; every call is bound to the district the host already
// picked).
// ---------------------------------------------------------------------------
describe('GET /api/admin-areas/subdistricts — scoped, on-demand (CAM-559)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.adminArea.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
            { id: 'sd-1', code: '100101', nameTh: 'พระบรมมหาราชวัง', nameEn: 'Phra Borom Maha Ratchawang', parentId: 'd-1' },
        ]);
    });

    it('[normal] queries AdminArea scoped to the given districtCode, never an unscoped table scan', async () => {
        const res = await adminAreaSubDistrictsGET(adminAreaRequest('?districtCode=1001'));

        expect(res.status).toBe(200);
        const call = (prisma.adminArea.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call.where.level).toBe('SUBDISTRICT');
        expect(call.where.parent).toMatchObject({ code: '1001', level: 'DISTRICT' });
        // Bounded — never an unbounded fetch of the whole 7,452-row level.
        expect(typeof call.take).toBe('number');
        expect(call.take).toBeLessThanOrEqual(100);
    });

    it('[normal] a Thai search term (q) narrows the scoped list by name', async () => {
        await adminAreaSubDistrictsGET(adminAreaRequest('?districtCode=1001&q=' + encodeURIComponent('พระบรม')));

        const call = (prisma.adminArea.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
        const orClause = JSON.stringify(call.where.OR);
        expect(orClause).toContain('พระบรม');
    });

    it('[error/validation] a missing districtCode is rejected with 400 (never an unscoped nationwide query)', async () => {
        const res = await adminAreaSubDistrictsGET(adminAreaRequest(''));

        expect(res.status).toBe(400);
        expect(prisma.adminArea.findMany).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Integration — /api/locations/search?type=district. CAM-559 built the
// district level against `ThailandLocation`; CAM-573 moved the match itself
// onto `AdminArea` (closing the split this story's own ticket named), then
// bridges the matched node back to a real `ThailandLocation.id` so
// `LocationPicker.tsx`'s `thaiLocationId` (still a live FK, written by
// `POST /api/location`, both out of CAM-573's file surface) never regresses
// — see CAM-573 tech.md. Proves the same two literal requirements CAM-559
// established, now against the real network contract post-migration:
//   - "the cascade genuinely narrows" (province selection must not still
//     offer every one of the 930 districts)
//   - "a Thai search term finds a Thai-named district"
// ---------------------------------------------------------------------------
describe('GET /api/locations/search?type=district — province narrows + Thai search (CAM-559 built it; CAM-573 moved the match onto AdminArea)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.adminArea.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: 'aa-province-50', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai',
        });
        (prisma.adminArea.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
            { code: '5001', nameTh: 'เมืองเชียงใหม่', nameEn: 'Mueang Chiang Mai' },
        ]);
        (prisma.thailandLocation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
            { id: 'd-1', districtCode: '5001' },
        ]);
    });

    function searchRequest(query: string) {
        return new NextRequest(`http://localhost/api/locations/search${query}`);
    }

    it('[normal] scopes the district query to the given provinceCode\'s AdminArea id (never every one of the 930 districts)', async () => {
        const res = await locationsSearchGET(searchRequest('?type=district&provinceCode=50'));

        expect(res.status).toBe(200);
        const provinceCall = (prisma.adminArea.findUnique as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(provinceCall.where.countryCode_level_code).toEqual({ countryCode: 'TH', level: 'PROVINCE', code: '50' });
        const districtCall = (prisma.adminArea.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(districtCall.where.level).toBe('DISTRICT');
        expect(districtCall.where.parentId).toBe('aa-province-50'); // scoped, never every district nationwide
    });

    it('[normal] a Thai search term (q) reaches the district name match, scoped to the chosen province', async () => {
        await locationsSearchGET(searchRequest('?type=district&provinceCode=50&q=' + encodeURIComponent('เมืองเชียงใหม่')));

        const districtCall = (prisma.adminArea.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(districtCall.where.parentId).toBe('aa-province-50');
        const orClause = JSON.stringify(districtCall.where.OR);
        expect(orClause).toContain('เมืองเชียงใหม่');
    });

    it('[normal] the matched AdminArea district is bridged back to a real ThailandLocation id (thaiLocationId FK compatibility, CAM-573)', async () => {
        const res = await locationsSearchGET(searchRequest('?type=district&provinceCode=50'));
        const body = await res.json();
        expect(body).toEqual([
            { id: 'd-1', provinceCode: '50', provinceName: 'เชียงใหม่', provinceNameEn: 'Chiang Mai', districtCode: '5001', districtName: 'เมืองเชียงใหม่', districtNameEn: 'Mueang Chiang Mai' },
        ]);
    });

    it('[error/validation] a missing provinceCode never runs an unscoped nationwide AdminArea query (CAM-573 tightening)', async () => {
        const res = await locationsSearchGET(searchRequest('?type=district'));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([]);
        expect(prisma.adminArea.findMany).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Zod boundary — adminAreaSubDistrictQuerySchema
// ---------------------------------------------------------------------------
describe('adminAreaSubDistrictQuerySchema (CAM-559)', () => {
    it('[normal] accepts districtCode alone', () => {
        expect(adminAreaSubDistrictQuerySchema.safeParse({ districtCode: '1001' }).success).toBe(true);
    });

    it('[normal] accepts districtCode + q', () => {
        expect(adminAreaSubDistrictQuerySchema.safeParse({ districtCode: '1001', q: 'พระบรม' }).success).toBe(true);
    });

    it('[error/validation] an empty districtCode is rejected', () => {
        expect(adminAreaSubDistrictQuerySchema.safeParse({ districtCode: '' }).success).toBe(false);
    });

    it('[error/validation] a missing districtCode is rejected', () => {
        expect(adminAreaSubDistrictQuerySchema.safeParse({}).success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Component wiring — source-inspection (the behavioral proof for "the
// cascade genuinely narrows" and "Thai search reaches the right level" lives
// in the two integration describes above, against the REAL network contract
// the component calls; these assert the component's own guard/reset wiring
// so the two can never silently drift apart).
// ---------------------------------------------------------------------------
describe('LocationPicker — cascading wiring (source-inspection)', () => {
    it('renders three cascading levels sourced correctly (province+district via ThailandLocation search, sub-district via the new AdminArea endpoint)', () => {
        const pickerSrc = src('components/LocationPicker.tsx');
        expect(pickerSrc).toContain('/api/locations/search');
        expect(pickerSrc).toContain('type=district');
        expect(pickerSrc).toContain('/api/admin-areas/subdistricts');
    });

    it('source-inspection: the district step is disabled until a province is selected (never offers all 930 districts up front)', () => {
        const pickerSrc = src('components/LocationPicker.tsx');
        // A disabled/guarded trigger keyed on the selected province existing.
        expect(pickerSrc).toMatch(/disabled=\{!selectedProvince\}/);
    });

    it('source-inspection: the sub-district step is disabled until a district is selected', () => {
        const pickerSrc = src('components/LocationPicker.tsx');
        expect(pickerSrc).toMatch(/disabled=\{!selectedDistrict\}/);
    });

    it('source-inspection: picking a new province resets the district + sub-district selection (no dangling child from the old province)', () => {
        const pickerSrc = src('components/LocationPicker.tsx');
        expect(pickerSrc).toMatch(/setSelectedDistrict\(null\)/);
        expect(pickerSrc).toMatch(/setSelectedSubDistrict\(null\)/);
    });
});
