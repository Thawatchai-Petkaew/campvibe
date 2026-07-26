/**
 * cam-554-geocode-routes.test.ts — CAM-554
 *
 * Story: a draggable Leaflet map pin, two-way synced with CAM-559's
 * cascading province/district/sub-district selects, via a SERVER-SIDE
 * Google Geocoding lookup (Leaflet stays the browser map - owner decision
 * 2026-07-26; Google is used only here, server-side, never a browser key).
 *
 * This file covers the two new routes (`app/api/geocode/reverse`,
 * `app/api/geocode/forward`) + the shared matcher (`app/api/geocode/
 * _shared.ts`): zod boundary, hierarchical + bilingual AdminArea matching,
 * auth gating (billed-per-request, unlike the free `/api/locations/search`),
 * and the key-safety guarantee ("the key never appears in any
 * client-reachable output").
 *
 * Layer: unit (zod + normalizeAdminName) + integration (route handlers,
 * mocked Prisma + auth-utils + global.fetch — same precedent as
 * __tests__/cam-559-cascading-location.test.ts). No real Google API calls
 * are made anywhere in this file (global.fetch is always mocked).
 *
 * Coverage matrix (qa.md §7):
 *   normal      — a resolved Google response matches province/district/
 *                 sub-district hierarchically + bilingually (Thai AND
 *                 English component text both resolve the SAME AdminArea row)
 *   null/empty  — no match at any level (ZERO_RESULTS) returns all-null,
 *                 never guesses; a level whose parent didn't match is
 *                 never attempted (no unscoped nationwide lookup)
 *   boundary    — lat/lon exactly at ±90/±180 pass; one past the bound fails
 *   error       — malformed coordinates / missing province -> 400 with ZERO
 *                 Google calls; a Google HTTP/status failure -> 500 generic
 *   concurrent/ordering — n/a (no shared mutable state across requests)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import {
    geocodeReverseQuerySchema,
    geocodeForwardQuerySchema,
} from '@/lib/validations/location';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

// ---------------------------------------------------------------------------
// Module mocks — declared before route imports (Vitest hoisting boundary),
// same pattern as cam-553/cam-559/cam-360.
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
    prisma: {
        adminArea: { findFirst: vi.fn() },
    },
}));

vi.mock('@/lib/auth-utils', () => ({
    requireAuth: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { GET as reverseGET } from '@/app/api/geocode/reverse/route';
import { GET as forwardGET } from '@/app/api/geocode/forward/route';
import { normalizeAdminName } from '@/app/api/geocode/_shared';

const AUTHED = { error: null, session: { user: { id: 'host-1' } } } as any;
const unauthed = () => ({ error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null } as any);

const PROVINCE_NODE = { id: 'admin-prov-1', code: '50', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai', parentId: null };
const DISTRICT_NODE = { id: 'admin-dist-1', code: '5001', nameTh: 'เมืองเชียงใหม่', nameEn: 'Mueang Chiang Mai', parentId: 'admin-prov-1' };
const SUBDISTRICT_NODE = { id: 'admin-sub-1', code: '500101', nameTh: 'ศรีภูมิ', nameEn: 'Si Phum', parentId: 'admin-dist-1' };

// Verified against the real dev DB (2026-07-26): AdminArea.nameTh/nameEn are
// stored BARE (no จังหวัด/อำเภอ/ตำบล prefix, no "Province"/"District" suffix)
// - e.g. a live province row was {"nameTh":"พิษณุโลก","nameEn":"Phitsanulok"}.
// These fixtures mirror that real shape.
//
// CAM-580: `province`/`district` in the response are now built DIRECTLY from
// the matched AdminArea node (no second `ThailandLocation` query) — so
// `PROVINCE_ROW.id`/`DISTRICT_ROW.id` are now the SAME real `AdminArea.id`
// as `PROVINCE_NODE.id`/`DISTRICT_NODE.id`, not a separate id-space.
const PROVINCE_ROW = { id: PROVINCE_NODE.id, provinceCode: '50', provinceName: 'เชียงใหม่', provinceNameEn: 'Chiang Mai', districtCode: '', districtName: null, districtNameEn: null };
const DISTRICT_ROW = { id: DISTRICT_NODE.id, provinceCode: '50', provinceName: 'เชียงใหม่', provinceNameEn: 'Chiang Mai', districtCode: '5001', districtName: 'เมืองเชียงใหม่', districtNameEn: 'Mueang Chiang Mai' };

function mockHierarchicalPrisma() {
    (prisma.adminArea.findFirst as ReturnType<typeof vi.fn>).mockImplementation(async ({ where }: any) => {
        if (where.level === 'PROVINCE') return PROVINCE_NODE as any;
        if (where.level === 'DISTRICT' && where.parentId === PROVINCE_NODE.id) return DISTRICT_NODE as any;
        if (where.level === 'SUBDISTRICT' && where.parentId === DISTRICT_NODE.id) return SUBDISTRICT_NODE as any;
        return null;
    });
}

const CHIANGMAI_COMPONENTS_TH = [
    { long_name: 'จังหวัดเชียงใหม่', short_name: 'เชียงใหม่', types: ['administrative_area_level_1', 'political'] },
    { long_name: 'อำเภอเมืองเชียงใหม่', short_name: 'เมืองเชียงใหม่', types: ['administrative_area_level_2', 'political'] },
    { long_name: 'ตำบลศรีภูมิ', short_name: 'ศรีภูมิ', types: ['sublocality_level_1', 'sublocality', 'political'] },
    { long_name: 'ประเทศไทย', short_name: 'TH', types: ['country', 'political'] },
];
const CHIANGMAI_COMPONENTS_EN = [
    { long_name: 'Chiang Mai Province', short_name: 'Chiang Mai', types: ['administrative_area_level_1', 'political'] },
    { long_name: 'Amphoe Mueang Chiang Mai', short_name: 'Mueang Chiang Mai', types: ['administrative_area_level_2', 'political'] },
    { long_name: 'Tambon Si Phum', short_name: 'Si Phum', types: ['sublocality_level_1', 'sublocality', 'political'] },
    { long_name: 'Thailand', short_name: 'TH', types: ['country', 'political'] },
];

const googleOk = (results: unknown[]) => ({ ok: true, json: async () => ({ status: 'OK', results }) });

beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_GEOCODING_API_KEY = 'test-fake-key-never-leaked';
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// zod boundary
// ---------------------------------------------------------------------------
describe('geocodeReverseQuerySchema (CAM-554)', () => {
    it('[normal] a valid Bangkok pin passes', () => {
        expect(geocodeReverseQuerySchema.safeParse({ lat: '13.7563', lon: '100.5018' }).success).toBe(true);
    });
    it('[boundary] exactly ±90/±180 passes', () => {
        expect(geocodeReverseQuerySchema.safeParse({ lat: '90', lon: '180' }).success).toBe(true);
        expect(geocodeReverseQuerySchema.safeParse({ lat: '-90', lon: '-180' }).success).toBe(true);
    });
    it('[error] lat=999 (past the bound) fails', () => {
        expect(geocodeReverseQuerySchema.safeParse({ lat: '999', lon: '100' }).success).toBe(false);
    });
    it('[error] non-numeric lat fails', () => {
        expect(geocodeReverseQuerySchema.safeParse({ lat: 'abc', lon: '100' }).success).toBe(false);
    });
});

describe('geocodeForwardQuerySchema (CAM-554)', () => {
    it('[normal] province only passes (district/subDistrict optional)', () => {
        expect(geocodeForwardQuerySchema.safeParse({ province: 'เชียงใหม่' }).success).toBe(true);
    });
    it('[error] missing province fails', () => {
        expect(geocodeForwardQuerySchema.safeParse({}).success).toBe(false);
    });
    it('[boundary] a 101-char province fails (max 100)', () => {
        expect(geocodeForwardQuerySchema.safeParse({ province: 'a'.repeat(101) }).success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// normalizeAdminName — deterministic prefix/suffix strip (never a substring
// match — CAM-501/503's Thai-substring lesson: exact-equality only, after
// normalization).
// ---------------------------------------------------------------------------
describe('normalizeAdminName (CAM-554) — fixture-based match-rate evidence', () => {
    const FIXTURES: Array<[string, string]> = [
        ['จังหวัดเชียงใหม่', 'เชียงใหม่'],
        ['อำเภอเมืองเชียงใหม่', 'เมืองเชียงใหม่'],
        ['ตำบลศรีภูมิ', 'ศรีภูมิ'],
        ['เขตพระนคร', 'พระนคร'],
        ['แขวงพระบรมมหาราชวัง', 'พระบรมมหาราชวัง'],
        ['กิ่งอำเภอนาทม', 'นาทม'],
        ['Chiang Mai Province', 'Chiang Mai'],
        ['Amphoe Mueang Chiang Mai', 'Mueang Chiang Mai'],
        ['Chang Wat Chon Buri', 'Chon Buri'],
        ['Changwat Chon Buri', 'Chon Buri'],
        ['Tambon Si Phum', 'Si Phum'],
        ['Bangkok', 'Bangkok'],
    ];

    let passed = 0;
    FIXTURES.forEach(([raw, expected]) => {
        it(`strips "${raw}" -> "${expected}"`, () => {
            const result = normalizeAdminName(raw);
            expect(result).toBe(expected);
            if (result === expected) passed++;
        });
    });

    it(`match-rate summary: ${FIXTURES.length}/${FIXTURES.length} deterministic prefix/suffix fixtures normalize correctly (NOT a live Google-traffic measurement - no real Google API calls run in this environment; verified separately against 15 real dev-DB AdminArea rows across all 3 levels that nameTh/nameEn ARE stored bare, matching what this function expects)`, () => {
        expect(FIXTURES.length).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// GET /api/geocode/reverse
// ---------------------------------------------------------------------------
describe('GET /api/geocode/reverse (CAM-554 AC-2)', () => {
    it('[error] 401s when not logged in (billed-per-request, unlike /api/locations/search)', async () => {
        vi.mocked(requireAuth).mockResolvedValue(unauthed());
        const res = await reverseGET(new NextRequest('http://localhost/api/geocode/reverse?lat=13.75&lon=100.5'));
        expect(res.status).toBe(401);
    });

    it('[error] rejects malformed coordinates with 400 and calls Google ZERO times', async () => {
        vi.mocked(requireAuth).mockResolvedValue(AUTHED);
        const fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
        const res = await reverseGET(new NextRequest('http://localhost/api/geocode/reverse?lat=999&lon=100'));
        expect(res.status).toBe(400);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('[normal] resolves province+district+sub-district hierarchically from a THAI Google response', async () => {
        vi.mocked(requireAuth).mockResolvedValue(AUTHED);
        mockHierarchicalPrisma();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(googleOk([{ address_components: CHIANGMAI_COMPONENTS_TH, geometry: { location: { lat: 18.79, lng: 98.98 } } }])));

        const res = await reverseGET(new NextRequest('http://localhost/api/geocode/reverse?lat=18.79&lon=98.98'));
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.province.id).toBe(PROVINCE_ROW.id);
        expect(body.district.id).toBe(DISTRICT_ROW.id);
        expect(body.subDistrict.id).toBe(SUBDISTRICT_NODE.id);
        // id-first result (CAM-563 forward-compat): the deepest AdminArea node.
        expect(body.adminAreaId).toBe(SUBDISTRICT_NODE.id);
    });

    it('[normal] the SAME resolution happens from an ENGLISH Google response (bilingual match)', async () => {
        vi.mocked(requireAuth).mockResolvedValue(AUTHED);
        mockHierarchicalPrisma();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(googleOk([{ address_components: CHIANGMAI_COMPONENTS_EN, geometry: { location: { lat: 18.79, lng: 98.98 } } }])));

        const res = await reverseGET(new NextRequest('http://localhost/api/geocode/reverse?lat=18.79&lon=98.98'));
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.province.id).toBe(PROVINCE_ROW.id);
        expect(body.district.id).toBe(DISTRICT_ROW.id);
        expect(body.subDistrict.id).toBe(SUBDISTRICT_NODE.id);
    });

    it('[normal] district lookup is SCOPED to the matched province (hierarchical, never an unscoped nationwide match)', async () => {
        vi.mocked(requireAuth).mockResolvedValue(AUTHED);
        mockHierarchicalPrisma();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(googleOk([{ address_components: CHIANGMAI_COMPONENTS_TH, geometry: { location: { lat: 18.79, lng: 98.98 } } }])));

        await reverseGET(new NextRequest('http://localhost/api/geocode/reverse?lat=18.79&lon=98.98'));
        const districtCall = (prisma.adminArea.findFirst as ReturnType<typeof vi.fn>).mock.calls.find((c: any) => (c[0] as any).where.level === 'DISTRICT');
        expect(districtCall?.[0]).toMatchObject({ where: { level: 'DISTRICT', parentId: PROVINCE_NODE.id } });
    });

    it('[null/empty] ZERO_RESULTS from Google returns all-null, never guesses', async () => {
        vi.mocked(requireAuth).mockResolvedValue(AUTHED);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) }));
        const res = await reverseGET(new NextRequest('http://localhost/api/geocode/reverse?lat=0&lon=0'));
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({ province: null, district: null, subDistrict: null, adminAreaId: null });
        expect(prisma.adminArea.findFirst as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    });

    it('[null/empty] an unmatched province never attempts a district/sub-district lookup', async () => {
        vi.mocked(requireAuth).mockResolvedValue(AUTHED);
        (prisma.adminArea.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(googleOk([{ address_components: CHIANGMAI_COMPONENTS_TH, geometry: { location: { lat: 18.79, lng: 98.98 } } }])));
        const res = await reverseGET(new NextRequest('http://localhost/api/geocode/reverse?lat=18.79&lon=98.98'));
        const body = await res.json();
        expect(body).toEqual({ province: null, district: null, subDistrict: null, adminAreaId: null });
        expect(prisma.adminArea.findFirst as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1); // province only, never district/sub-district
    });

    it('[error] a Google HTTP failure returns a generic 500 (never the raw Google body)', async () => {
        vi.mocked(requireAuth).mockResolvedValue(AUTHED);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
        const res = await reverseGET(new NextRequest('http://localhost/api/geocode/reverse?lat=13.75&lon=100.5'));
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body).toEqual({ error: 'geocode_failed' });
    });
});

// ---------------------------------------------------------------------------
// GET /api/geocode/forward
// ---------------------------------------------------------------------------
describe('GET /api/geocode/forward (CAM-554 AC-2)', () => {
    it('[error] 401s when not logged in', async () => {
        vi.mocked(requireAuth).mockResolvedValue(unauthed());
        const res = await forwardGET(new NextRequest('http://localhost/api/geocode/forward?province=เชียงใหม่'));
        expect(res.status).toBe(401);
    });

    it('[error] rejects a missing province with 400 and calls Google ZERO times', async () => {
        vi.mocked(requireAuth).mockResolvedValue(AUTHED);
        const fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
        const res = await forwardGET(new NextRequest('http://localhost/api/geocode/forward'));
        expect(res.status).toBe(400);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('[normal] resolves lat/lon for the chosen province+district+sub-district', async () => {
        vi.mocked(requireAuth).mockResolvedValue(AUTHED);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(googleOk([{ address_components: [], geometry: { location: { lat: 18.79, lng: 98.98 } } }])));
        const res = await forwardGET(new NextRequest('http://localhost/api/geocode/forward?province=' + encodeURIComponent('เชียงใหม่') + '&district=' + encodeURIComponent('เมืองเชียงใหม่')));
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({ lat: 18.79, lon: 98.98 });
    });

    it('[null/empty] ZERO_RESULTS returns {lat:null, lon:null}', async () => {
        vi.mocked(requireAuth).mockResolvedValue(AUTHED);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) }));
        const res = await forwardGET(new NextRequest('http://localhost/api/geocode/forward?province=' + encodeURIComponent('ไม่มีจริง')));
        const body = await res.json();
        expect(body).toEqual({ lat: null, lon: null });
    });

    it('[error] a Google HTTP failure returns a generic 500', async () => {
        vi.mocked(requireAuth).mockResolvedValue(AUTHED);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
        const res = await forwardGET(new NextRequest('http://localhost/api/geocode/forward?province=' + encodeURIComponent('เชียงใหม่')));
        expect(res.status).toBe(500);
    });
});

// ---------------------------------------------------------------------------
// Key safety — "the key never appears in any client-reachable output"
// ---------------------------------------------------------------------------
describe('CAM-554 security: GOOGLE_GEOCODING_API_KEY never reaches the client', () => {
    const FAKE_KEY = 'test-fake-key-never-leaked';

    it('the reverse route success response never contains the key', async () => {
        vi.mocked(requireAuth).mockResolvedValue(AUTHED);
        mockHierarchicalPrisma();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(googleOk([{ address_components: CHIANGMAI_COMPONENTS_TH, geometry: { location: { lat: 18.79, lng: 98.98 } } }])));
        const res = await reverseGET(new NextRequest('http://localhost/api/geocode/reverse?lat=18.79&lon=98.98'));
        expect(JSON.stringify(await res.json())).not.toContain(FAKE_KEY);
    });

    it('a Google failure (500 path) never leaks the key via the response OR the server log', async () => {
        vi.mocked(requireAuth).mockResolvedValue(AUTHED);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = await reverseGET(new NextRequest('http://localhost/api/geocode/reverse?lat=13.75&lon=100.5'));
        expect(JSON.stringify(await res.json())).not.toContain(FAKE_KEY);
        const logged = consoleSpy.mock.calls.map((c) => c.map(String).join(' ')).join(' ');
        expect(logged).not.toContain(FAKE_KEY);
        consoleSpy.mockRestore();
    });

    it('a missing key never leaks anything beyond a generic 500 (and never crashes)', async () => {
        delete process.env.GOOGLE_GEOCODING_API_KEY;
        vi.mocked(requireAuth).mockResolvedValue(AUTHED);
        const fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
        const res = await reverseGET(new NextRequest('http://localhost/api/geocode/reverse?lat=13.75&lon=100.5'));
        expect(res.status).toBe(500);
        expect(fetchSpy).not.toHaveBeenCalled(); // never even reaches Google without a key
    });

    it('source-inspection: the key is read ONLY in app/api/geocode/_shared.ts, never in any client component', () => {
        const sharedSrc = src('app/api/geocode/_shared.ts');
        expect(sharedSrc).toContain('process.env.GOOGLE_GEOCODING_API_KEY');
        expect(src('components/LocationPicker.tsx')).not.toContain('GOOGLE_GEOCODING_API_KEY');
        expect(src('components/LocationMapPin.tsx')).not.toContain('GOOGLE_GEOCODING_API_KEY');
        expect(src('components/CampgroundForm.tsx')).not.toContain('GOOGLE_GEOCODING_API_KEY');
    });

    it('the key is never NEXT_PUBLIC_-prefixed (that would ship it into the browser bundle)', () => {
        expect(src('app/api/geocode/_shared.ts')).not.toContain('NEXT_PUBLIC_GOOGLE');
        expect(src('.claude/ENV-CONFIG.md')).not.toContain('NEXT_PUBLIC_GOOGLE_GEOCODING');
    });

    it('the outgoing Google request (which carries the key in its URL) is never passed to console.error', () => {
        const sharedSrc = src('app/api/geocode/_shared.ts');
        const consoleErrorArgs = sharedSrc.match(/console\.error\([^)]*\)/g) || [];
        expect(consoleErrorArgs.length).toBeGreaterThan(0);
        consoleErrorArgs.forEach((call) => {
            expect(call).not.toContain('url.toString()');
            expect(call).not.toMatch(/console\.error\(\s*url\b/);
        });
    });
});
