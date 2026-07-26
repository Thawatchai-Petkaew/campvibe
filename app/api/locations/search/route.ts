import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { thailandLocationRowSchema } from '@/lib/validations/location';

/**
 * GET /api/locations/search?type=province|district&q=<search>&provinceCode=<code>
 *
 * CAM-573 — province + district now read from `AdminArea` (previously
 * `ThailandLocation`), completing the picker's move onto the ONE
 * conformant hierarchy — sub-district already read `AdminArea` via
 * `/api/admin-areas/subdistricts` (CAM-559); this closes the split named in
 * this story's ticket.
 *
 * `components/LocationPicker.tsx`'s `ThailandLocationRow` interface (out of
 * this story's file surface — its WRITE path is explicitly untouched) and
 * `Location.thaiLocationId`'s real FK (still written by `POST
 * /api/location`, also out of surface) both require the returned `id` to be
 * a REAL `ThailandLocation.id` — never an `AdminArea.id`. So the search
 * itself now runs against `AdminArea` (bilingual `nameTh`/`nameEn`, one
 * source with sub-district), and each matched node is bridged back to its
 * `ThailandLocation` counterpart via the shared `code` value
 * (`AdminArea.code` === `ThailandLocation.provinceCode`/`districtCode` —
 * verified 1:1 against the real dev DB, 77/77 provinces + 930/930
 * districts, zero mismatch either direction; see tech.md). This is the
 * SAME id-first-then-ThailandLocation-join pattern
 * `app/api/geocode/_shared.ts`'s `resolveFromComponents` already
 * established (CAM-554/566) for the identical problem shape — reused here,
 * not reinvented. A candidate with no ThailandLocation counterpart is
 * dropped (never fabricates an id that would violate `thaiLocationId`'s
 * real FK) — should not happen given the verified 1:1 parity, but handled
 * defensively for future drift (logged server-side, never surfaced as an
 * error to the caller — a shorter result list is not a failure).
 *
 * The un-parameterized ("no type") combined branch below is UNCHANGED — no
 * live caller sends this shape (`LocationPicker.tsx` always sends
 * `type=province`/`type=district`, confirmed by grep); it exists only for
 * the RISK-9 generic-error-shape test
 * (`__tests__/cam-209-rate1-abuse-hardening.test.ts`) and is left reading
 * `ThailandLocation` to avoid disturbing that pinned, unrelated test.
 *
 * Response shape unchanged (`ThailandLocationRow` in
 * `components/LocationPicker.tsx`, `thailandLocationRowSchema` in
 * `lib/validations/location.ts`, reused here as the type — never
 * re-declared): `{ id, provinceCode, provinceName, provinceNameEn,
 * districtCode, districtName, districtNameEn }`.
 */
type LocationSearchRow = z.infer<typeof thailandLocationRowSchema>;

const MAX_QUERY_LENGTH = 100;
const MAX_RESULTS = 20;

/** CAM-573 — province candidates from `AdminArea`, bridged back to a real `ThailandLocation.id`. */
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
        select: { code: true, nameTh: true, nameEn: true },
        orderBy: { nameEn: 'asc' },
        take: MAX_RESULTS,
    });
    if (provinceAreas.length === 0) return [];

    // Bridge: one batched lookup for every matched code (never per-row/N+1).
    const codes = provinceAreas.map((p) => p.code);
    const tlRows = await prisma.thailandLocation.findMany({
        where: { provinceCode: { in: codes }, districtCode: '' },
        select: { id: true, provinceCode: true },
    });
    const idByCode = new Map(tlRows.map((r) => [r.provinceCode, r.id]));

    const rows: LocationSearchRow[] = [];
    for (const area of provinceAreas) {
        const id = idByCode.get(area.code);
        if (!id) {
            // Data-drift edge case — verified 1:1 today; never fabricate an id.
            console.error('[locations/search] AdminArea province has no ThailandLocation counterpart', area.code);
            continue;
        }
        rows.push({
            id,
            provinceCode: area.code,
            provinceName: area.nameTh,
            provinceNameEn: area.nameEn,
            districtCode: '',
            districtName: null,
            districtNameEn: null,
        });
    }
    return rows;
}

/** CAM-573 — district candidates from `AdminArea`, scoped to the given province, bridged to a real `ThailandLocation.id`. */
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
        select: { code: true, nameTh: true, nameEn: true },
        orderBy: { nameEn: 'asc' },
        take: MAX_RESULTS,
    });
    if (districtAreas.length === 0) return [];

    const codes = districtAreas.map((d) => d.code);
    const tlRows = await prisma.thailandLocation.findMany({
        where: { provinceCode, districtCode: { in: codes } },
        select: { id: true, districtCode: true },
    });
    const idByCode = new Map(tlRows.map((r) => [r.districtCode, r.id]));

    const rows: LocationSearchRow[] = [];
    for (const area of districtAreas) {
        const id = idByCode.get(area.code);
        if (!id) {
            console.error('[locations/search] AdminArea district has no ThailandLocation counterpart', provinceCode, area.code);
            continue;
        }
        rows.push({
            id,
            provinceCode,
            provinceName: provinceArea.nameTh,
            provinceNameEn: provinceArea.nameEn,
            districtCode: area.code,
            districtName: area.nameTh,
            districtNameEn: area.nameEn,
        });
    }
    return rows;
}

export async function GET(request: NextRequest) {
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

        // Combined ("no type") fallback — UNCHANGED, ThailandLocation-based
        // (see file header: no live caller reaches this branch).
        const queryPattern = `%${query}%`;

        if ((prisma as any).thailandLocation) {
            const results = await prisma.thailandLocation.findMany({
                where: {
                    OR: [
                        { provinceName: { contains: query, mode: 'insensitive' } },
                        { provinceNameEn: { contains: query, mode: 'insensitive' } },
                        { districtName: { contains: query, mode: 'insensitive' } },
                        { districtNameEn: { contains: query, mode: 'insensitive' } },
                    ],
                },
                orderBy: [
                    { provinceNameEn: 'asc' },
                    { districtNameEn: 'asc' },
                ],
                take: MAX_RESULTS,
            });
            return NextResponse.json(results);
        } else {
            // Fallback for stale Prisma client
            console.log('⚠️ Model thailandLocation missing, using $queryRaw fallback');
            const results = await prisma.$queryRaw`
                SELECT * FROM "ThailandLocation"
                WHERE "provinceName" ILIKE ${queryPattern}
                OR "provinceNameEn" ILIKE ${queryPattern}
                OR "districtName" ILIKE ${queryPattern}
                OR "districtNameEn" ILIKE ${queryPattern}
                ORDER BY "provinceNameEn" ASC, "districtNameEn" ASC
                LIMIT 20
            `;
            return NextResponse.json(results);
        }
    } catch (error: unknown) {
        // RISK-9: log detail server-side only; never leak error.message to the client.
        console.error('[GET /api/locations/search]', error);
        return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }
}
