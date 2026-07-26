import { prisma } from '@/lib/prisma';
import type { GeocodeReverseResult } from '@/lib/validations/location';
import { matchAdminArea, normalizeAdminName, type AdminAreaNode } from '@/lib/geo/admin-area-match';

/**
 * CAM-554 — shared server-side geocoding helpers, used by BOTH
 * `app/api/geocode/reverse/route.ts` (pin drop/drag -> province/district/
 * sub-district) and `app/api/geocode/forward/route.ts` (choosing a level ->
 * pin). Kept out of `lib/` on purpose (this story's allowed file surface is
 * `app/api/geocode/**`, `lib/validations/**`) but co-located so both routes
 * share ONE Google-fetch wrapper instead of two copies drifting apart.
 *
 * Owner architecture decision (2026-07-26): Leaflet stays on the browser;
 * Google is used ONLY here, server-side, for the Geocoding API (both its
 * "reverse" mode - latlng -> address - and its "forward" mode - address ->
 * latlng - are the SAME Google Geocoding API endpoint/key/billing model,
 * never the browser-loaded Google Maps JS the owner explicitly ruled out).
 * `GOOGLE_GEOCODING_API_KEY` is read here ONLY (server) and is never
 * returned, logged, or included in the URL that gets logged on failure.
 *
 * CAM-566 — the bilingual/hierarchical AdminArea matcher itself
 * (`normalizeAdminName`/`matchAdminArea`) now lives in
 * `lib/geo/admin-area-match.ts`, shared with CAM-563's backfill script and
 * write path (previously three near-identical ports - see that module's
 * header + this story's tech.md for the enumerated diff). `normalizeAdminName`
 * is re-exported here unchanged so `__tests__/cam-554-geocode-routes.test.ts`
 * (which imports it directly from this file) keeps passing unedited.
 */
export { normalizeAdminName };

const GOOGLE_GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

export interface GoogleAddressComponent {
    long_name: string;
    short_name: string;
    types: string[];
}

interface GoogleGeocodeResponse {
    status: string;
    results: Array<{
        address_components: GoogleAddressComponent[];
        geometry: { location: { lat: number; lng: number } };
    }>;
}

/**
 * Calls the Google Geocoding API. Returns `null` on ANY failure (missing key,
 * network error, non-OK HTTP, or a Google `status` other than OK/ZERO_RESULTS)
 * - callers map `null` to a generic 500, never surfacing Google's raw body.
 * The request URL (which carries the key) is NEVER logged; only a status
 * code / Google `status` string / caught error message is logged.
 */
export async function callGoogleGeocode(
    params: Record<string, string>
): Promise<GoogleGeocodeResponse | null> {
    const key = process.env.GOOGLE_GEOCODING_API_KEY;
    if (!key) {
        console.error('[geocode] GOOGLE_GEOCODING_API_KEY is not configured');
        return null;
    }

    const url = new URL(GOOGLE_GEOCODE_ENDPOINT);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('region', 'th');
    url.searchParams.set('key', key);

    try {
        const res = await fetch(url.toString());
        if (!res.ok) {
            console.error('[geocode] Google Geocoding API HTTP error', res.status);
            return null;
        }
        const data = (await res.json()) as GoogleGeocodeResponse;
        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
            console.error('[geocode] Google Geocoding API status', data.status);
            return null;
        }
        return data;
    } catch (err) {
        console.error('[geocode] Google Geocoding API request failed', err instanceof Error ? err.message : 'unknown error');
        return null;
    }
}

/** Returns the first address component's `long_name` matching any of `types`, in priority order. */
export function extractComponent(components: GoogleAddressComponent[], types: string[]): string | null {
    for (const type of types) {
        const found = components.find((c) => c.types.includes(type));
        if (found) return found.long_name;
    }
    return null;
}

/**
 * CAM-563 note (preserved): the id-first path is the AdminArea node, strings
 * are DERIVED from it below via a `ThailandLocation` join, never the other
 * way round.
 *
 * Resolves Google's address_components into the reverse-geocode result
 * shape. Walks PROVINCE -> DISTRICT -> SUBDISTRICT, each scoped to its
 * matched parent - a level with no raw name, or no match, stops the walk
 * (never guesses the next level from an unmatched parent).
 *
 * `province`/`district` are DERIVED ThailandLocation rows (byte-identical
 * shape to what LocationPicker.tsx's cascading selects already produce - see
 * BR-4/CAM-559) so `Location.province`/`district`'s stored value/derivation
 * never changes. If a resolved AdminArea province has no matching
 * ThailandLocation row (data drift - should not happen; both tables are
 * seeded from the same source per CAM-559 tech.md), that level is reported
 * as unmatched (`null`) rather than fabricating a `thaiLocationId` that
 * would violate `Location.thaiLocationId`'s real FK constraint.
 */
export async function resolveFromComponents(components: GoogleAddressComponent[]): Promise<GeocodeReverseResult> {
    const provinceRaw = extractComponent(components, ['administrative_area_level_1']);
    const districtRaw = extractComponent(components, ['administrative_area_level_2']);
    const subDistrictRaw = extractComponent(components, ['sublocality_level_1', 'administrative_area_level_3', 'locality']);

    let provinceNode: AdminAreaNode | null = null;
    let districtNode: AdminAreaNode | null = null;
    let subDistrictNode: AdminAreaNode | null = null;
    let provinceRow = null;
    let districtRow = null;

    if (provinceRaw) {
        provinceNode = await matchAdminArea(prisma, 'PROVINCE', provinceRaw);
    }

    if (provinceNode) {
        provinceRow = await prisma.thailandLocation.findFirst({
            where: { provinceCode: provinceNode.code, districtCode: '' },
            select: { id: true, provinceCode: true, provinceName: true, provinceNameEn: true, districtCode: true, districtName: true, districtNameEn: true },
        });

        if (provinceRow && districtRaw) {
            districtNode = await matchAdminArea(prisma, 'DISTRICT', districtRaw, provinceNode.id);
        }
    }

    if (districtNode) {
        districtRow = await prisma.thailandLocation.findFirst({
            where: { provinceCode: provinceNode!.code, districtCode: districtNode.code },
            select: { id: true, provinceCode: true, provinceName: true, provinceNameEn: true, districtCode: true, districtName: true, districtNameEn: true },
        });

        if (districtRow && subDistrictRaw) {
            subDistrictNode = await matchAdminArea(prisma, 'SUBDISTRICT', subDistrictRaw, districtNode.id);
        }
    }

    return {
        province: provinceRow,
        district: districtRow,
        subDistrict: subDistrictNode
            ? { id: subDistrictNode.id, code: subDistrictNode.code, nameTh: subDistrictNode.nameTh, nameEn: subDistrictNode.nameEn, parentId: subDistrictNode.parentId }
            : null,
        adminAreaId: subDistrictNode?.id ?? districtNode?.id ?? provinceNode?.id ?? null,
    };
}
