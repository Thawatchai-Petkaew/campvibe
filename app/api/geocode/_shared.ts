import { prisma } from '@/lib/prisma';
import type { GeocodeReverseResult } from '@/lib/validations/location';

/**
 * CAM-554 — shared server-side geocoding helpers, used by BOTH
 * `app/api/geocode/reverse/route.ts` (pin drop/drag -> province/district/
 * sub-district) and `app/api/geocode/forward/route.ts` (choosing a level ->
 * pin). Kept out of `lib/` on purpose (this story's allowed file surface is
 * `app/api/geocode/**`, `lib/validations/**`) but co-located so both routes
 * share ONE matcher instead of two copies drifting apart.
 *
 * Owner architecture decision (2026-07-26): Leaflet stays on the browser;
 * Google is used ONLY here, server-side, for the Geocoding API (both its
 * "reverse" mode - latlng -> address - and its "forward" mode - address ->
 * latlng - are the SAME Google Geocoding API endpoint/key/billing model,
 * never the browser-loaded Google Maps JS the owner explicitly ruled out).
 * `GOOGLE_GEOCODING_API_KEY` is read here ONLY (server) and is never
 * returned, logged, or included in the URL that gets logged on failure.
 */

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

// Known Thai/English administrative prefixes-suffixes Google's Geocoding API
// prepends to a component's long_name (e.g. "จังหวัดเชียงใหม่", "Amphoe Mueang
// Chiang Mai") - stripped before matching against AdminArea's bare `nameTh`/
// `nameEn` columns. Longest/most-specific entries first so a shared substring
// (e.g. "อำเภอ" inside "กิ่งอำเภอ") never partially matches.
const THAI_PREFIXES = ['กิ่งอำเภอ', 'จังหวัด', 'อำเภอ', 'เขต', 'ตำบล', 'แขวง'];
const EN_PREFIXES = ['Changwat ', 'Chang Wat ', 'Amphoe ', 'Amphur ', 'Khet ', 'Tambon ', 'Khwaeng ', 'District ', 'Province of '];
const EN_SUFFIXES = [' Province', ' District'];

/** Exported for the unit test (CAM-554) - deterministic prefix/suffix strip, never a substring match. */
export function normalizeAdminName(raw: string): string {
    let name = raw.trim();
    for (const prefix of THAI_PREFIXES) {
        if (name.startsWith(prefix)) { name = name.slice(prefix.length); break; }
    }
    for (const prefix of EN_PREFIXES) {
        if (name.startsWith(prefix)) { name = name.slice(prefix.length); break; }
    }
    for (const suffix of EN_SUFFIXES) {
        if (name.endsWith(suffix)) { name = name.slice(0, -suffix.length); break; }
    }
    return name.trim();
}

type AdminAreaLevel = 'PROVINCE' | 'DISTRICT' | 'SUBDISTRICT';

interface AdminAreaNode {
    id: string;
    code: string;
    nameTh: string;
    nameEn: string;
    parentId: string | null;
}

/**
 * Bilingual, hierarchical match against the AdminArea tree (never
 * ThailandLocation directly - see the coordinator's CAM-563 note: the id-first
 * path is the AdminArea node, strings are DERIVED from it, not the other way
 * round). Scoped by `parentId` when given, so a same-named district in a
 * different province can never match (exact equality only, never `contains`
 * - CAM-501/503's Thai-substring lesson).
 */
async function matchAdminArea(level: AdminAreaLevel, name: string, parentId?: string): Promise<AdminAreaNode | null> {
    return prisma.adminArea.findFirst({
        where: {
            countryCode: 'TH',
            level,
            ...(parentId ? { parentId } : {}),
            OR: [
                { nameTh: { equals: name, mode: 'insensitive' } },
                { nameEn: { equals: name, mode: 'insensitive' } },
            ],
        },
        select: { id: true, code: true, nameTh: true, nameEn: true, parentId: true },
    });
}

/**
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
        provinceNode = await matchAdminArea('PROVINCE', normalizeAdminName(provinceRaw));
    }

    if (provinceNode) {
        provinceRow = await prisma.thailandLocation.findFirst({
            where: { provinceCode: provinceNode.code, districtCode: '' },
            select: { id: true, provinceCode: true, provinceName: true, provinceNameEn: true, districtCode: true, districtName: true, districtNameEn: true },
        });

        if (provinceRow && districtRaw) {
            districtNode = await matchAdminArea('DISTRICT', normalizeAdminName(districtRaw), provinceNode.id);
        }
    }

    if (districtNode) {
        districtRow = await prisma.thailandLocation.findFirst({
            where: { provinceCode: provinceNode!.code, districtCode: districtNode.code },
            select: { id: true, provinceCode: true, provinceName: true, provinceNameEn: true, districtCode: true, districtName: true, districtNameEn: true },
        });

        if (districtRow && subDistrictRaw) {
            subDistrictNode = await matchAdminArea('SUBDISTRICT', normalizeAdminName(subDistrictRaw), districtNode.id);
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
