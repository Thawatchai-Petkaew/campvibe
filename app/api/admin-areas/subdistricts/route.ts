import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { adminAreaSubDistrictQuerySchema } from '@/lib/validations/location';

/**
 * GET /api/admin-areas/subdistricts?districtCode=<code>&q=<search>
 *
 * CAM-559: the third (sub-district) level of the cascading location picker.
 * `ThailandLocation` cannot hold a sub-district at all (no column — see
 * CAM-553 tech.md's "Model decision"), so this is the ONE level this story
 * reads from `AdminArea` — province and district keep reading the existing,
 * already-working `/api/locations/search` (ThailandLocation), untouched, so
 * `Location.province`'s stored value/derivation never changes (BR-4,
 * lib/campsite-filters.ts's exact-equality match + CAM-545's Thai-name
 * lookup both depend on it).
 *
 * Scale (7,452 sub-districts nationwide — never sent as one payload):
 * every call is bound to a `districtCode` (required) — a single Thai
 * district holds a few dozen sub-districts at most (Bangkok's largest
 * district is still well under 50), so the response is always a small,
 * on-demand slice, never the whole table. `districtCode` is the AdminArea
 * DISTRICT node's national code — identical to `ThailandLocation
 * .districtCode` (both imported from the same source dataset, verified in
 * tech.md), so the client scopes this call using the district it already
 * picked from the existing ThailandLocation-backed step, with no second ID
 * namespace to stitch together.
 *
 * Auth: none (matches the sibling `/api/locations/search` — public Thai
 * administrative reference data, not user data; no PII, no authz dimension).
 *
 * Error codes: `400` invalid/missing `districtCode` · `500` internal
 * (generic message; detail logged server-side only, never in the response).
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const rawQuery: Record<string, string> = {};
    searchParams.forEach((value, key) => { rawQuery[key] = value; });

    const parsed = adminAreaSubDistrictQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
        return apiError('invalid_input', 400, parsed.error.format());
    }
    const { districtCode, q } = parsed.data;

    try {
        const results = await prisma.adminArea.findMany({
            where: {
                level: 'SUBDISTRICT',
                parent: {
                    level: 'DISTRICT',
                    code: districtCode,
                },
                ...(q
                    ? {
                        OR: [
                            { nameTh: { contains: q, mode: 'insensitive' } },
                            { nameEn: { contains: q, mode: 'insensitive' } },
                        ],
                    }
                    : {}),
            },
            select: { id: true, code: true, nameTh: true, nameEn: true, parentId: true },
            orderBy: { nameEn: 'asc' },
            take: 100,
        });

        return apiSuccess(results);
    } catch (error) {
        // RISK-9 precedent (/api/locations/search): log detail server-side
        // only; never leak error.message to the client.
        return apiError('Failed to fetch sub-districts', 500, error);
    }
}
