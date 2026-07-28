import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { thailandLocationRowSchema } from '@/lib/validations/location';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * GET /api/locations/search?type=province|district&q=<search>&provinceCode=<code>
 *
 * CAM-573 moved the MATCH itself off `ThailandLocation` onto `AdminArea`,
 * bridging each candidate back to a real `ThailandLocation.id` because
 * `Location.thaiLocationId`'s FK still existed at the time. CAM-574 (this
 * story) retired that FK — the response `id` is now the `AdminArea.id`
 * directly, no bridge, no `ThailandLocation` read on this endpoint at all.
 * `components/LocationPicker.tsx` sends this `id` straight through to `POST
 * /api/location` as `adminAreaId`.
 *
 * The un-parameterized ("no type") combined branch that used to read
 * `ThailandLocation` directly is REMOVED — CAM-573's own tech.md confirmed
 * no live caller ever sends this shape (`LocationPicker.tsx` always sends
 * `type=province`/`type=district`); it only existed to give the RISK-9
 * generic-error-shape test (`__tests__/cam-209-rate1-abuse-hardening.test.ts`)
 * something to force an error against — that test now forces the error via
 * the `type=province` path instead (updated in the same story).
 *
 * Response shape unchanged (`ThailandLocationRow` in
 * `components/LocationPicker.tsx`, `thailandLocationRowSchema` in
 * `lib/validations/location.ts`, reused here as the type — never
 * re-declared, and still shared with the geocode-reverse response, which is
 * NOT part of this retirement — see tech.md): `{ id, provinceCode,
 * provinceName, provinceNameEn, districtCode, districtName, districtNameEn }`.
 */
type LocationSearchRow = z.infer<typeof thailandLocationRowSchema>;

const MAX_QUERY_LENGTH = 100;
const MAX_RESULTS = 20;

// CAM-619 — this route was public, unauthenticated, AND unthrottled, running
// an ILIKE `contains` scan over `AdminArea` (7,452 rows nationwide across
// province/district/sub-district) with no floor guard at all — the exact gap
// `app/api/ai/camp-detail/[id]/route.ts`'s own comment names: "a public
// read-only route still needs a floor guard against scraping/abuse" (that
// route + `POST /api/ai/chat` are this endpoint's two throttled siblings).
// General baseline per `.claude/rules/security.md` (~100/15min) —
// `components/LocationPicker.tsx` debounces at 300ms across at most 2
// cascading comboboxes on this endpoint (province, district; sub-district is
// the separate `/api/admin-areas/subdistricts` sibling below), so a real
// host session stays a small fraction of this floor.
const LOCATION_SEARCH_RATE_LIMIT = 100;
const LOCATION_SEARCH_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 min

/** CAM-574 — province candidates from `AdminArea`, `id` = the real `AdminArea.id` (no bridge). */
async function searchProvinces(query: string): Promise<LocationSearchRow[]> {
    const provinceAreas = await prisma.adminArea.findMany({
        where: {
            countryCode: 'TH',
            level: 'PROVINCE',
            OR: [
                { nameTh: { contains: query, mode: 'insensitive' } },
                { nameEn: { contains: query, mode: 'insensitive' } },
            ],
        },
        select: { id: true, code: true, nameTh: true, nameEn: true },
        orderBy: { nameEn: 'asc' },
        take: MAX_RESULTS,
    });

    return provinceAreas.map((area) => ({
        id: area.id,
        provinceCode: area.code,
        provinceName: area.nameTh,
        provinceNameEn: area.nameEn,
        districtCode: '',
        districtName: null,
        districtNameEn: null,
    }));
}

/** CAM-574 — district candidates from `AdminArea`, scoped to the given province, `id` = the real `AdminArea.id` (no bridge). */
async function searchDistricts(provinceCode: string | null, query: string): Promise<LocationSearchRow[]> {
    // Never an unscoped nationwide (930-row) query — a missing provinceCode
    // returns no candidates rather than falling through to "every district".
    if (!provinceCode) return [];

    // `countryCode_level_code` is the same compound unique index
    // `app/api/location/route.ts`'s write path already looks up a province
    // AdminArea node by — reused here, not a new access pattern.
    const provinceArea = await prisma.adminArea.findUnique({
        where: { countryCode_level_code: { countryCode: 'TH', level: 'PROVINCE', code: provinceCode } },
        select: { id: true, nameTh: true, nameEn: true },
    });
    if (!provinceArea) return [];

    const districtAreas = await prisma.adminArea.findMany({
        where: {
            level: 'DISTRICT',
            parentId: provinceArea.id,
            OR: [
                { nameTh: { contains: query, mode: 'insensitive' } },
                { nameEn: { contains: query, mode: 'insensitive' } },
            ],
        },
        select: { id: true, code: true, nameTh: true, nameEn: true },
        orderBy: { nameEn: 'asc' },
        take: MAX_RESULTS,
    });

    return districtAreas.map((area) => ({
        id: area.id,
        provinceCode,
        provinceName: provinceArea.nameTh,
        provinceNameEn: provinceArea.nameEn,
        districtCode: area.code,
        districtName: area.nameTh,
        districtNameEn: area.nameEn,
    }));
}

export async function GET(request: NextRequest) {
    // CAM-619: per-IP floor guard FIRST — before any param parsing or DB read
    // (mirrors app/api/ai/camp-detail/[id]/route.ts's ordering).
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rl = checkRateLimit(`locations:search:${ip}`, {
        limit: LOCATION_SEARCH_RATE_LIMIT,
        windowMs: LOCATION_SEARCH_RATE_WINDOW_MS,
    });
    if (!rl.allowed) {
        return NextResponse.json(
            { error: 'rate_limited' },
            { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
        );
    }

    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get('q') ?? '';
    const query = rawQuery.slice(0, MAX_QUERY_LENGTH);
    const type = searchParams.get('type'); // 'province' | 'district'
    const provinceCode = searchParams.get('provinceCode');

    try {
        if (type === 'province') {
            return NextResponse.json(await searchProvinces(query));
        }

        if (type === 'district') {
            return NextResponse.json(await searchDistricts(provinceCode, query));
        }

        // CAM-574: no live caller sends a request with no/unrecognized `type`
        // (see file header) — a safe empty result, never a 400 (this endpoint
        // has no other consumer to break) and never the removed ThailandLocation
        // combined-search branch.
        return NextResponse.json([]);
    } catch (error: unknown) {
        // RISK-9: log detail server-side only; never leak error.message to the client.
        console.error('[GET /api/locations/search]', error);
        return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }
}
