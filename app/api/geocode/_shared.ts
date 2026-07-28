import { prisma } from '@/lib/prisma';
import type { GeocodeReverseResult } from '@/lib/validations/location';
import { matchAdminArea, normalizeAdminName, type AdminAreaNode } from '@/lib/geo/admin-area-match';
import { callGoogleGeocodeCore, extractComponent, type GoogleAddressComponent, type GoogleGeocodeResult } from '@/lib/geo/google-geocode';

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
 *
 * CAM-580 — this file's `resolveFromComponents` was the last direct
 * (non-relation) reader of the legacy `ThailandLocation` table; it now
 * derives `province`/`district` from the matched `AdminArea` node itself
 * (see that function's doc comment below). The table and model are dropped
 * entirely by this story - see its tech.md.
 *
 * CAM-572/CAM-585 — the low-level Google-fetch primitive (`extractComponent`
 * AND `callGoogleGeocode`) now lives entirely in `lib/geo/google-geocode.ts`,
 * this file's `callGoogleGeocode` is a thin, behaviour-preserving translation
 * on top of `callGoogleGeocodeCore` (same re-export pattern already used for
 * `normalizeAdminName` above). CAM-572 originally left this one duplicate
 * unmoved because `__tests__/cam-554-geocode-routes.test.ts` source-inspected
 * THIS file's own text for the key-safety invariant (a literal
 * `process.env.GOOGLE_GEOCODING_API_KEY` string + a `console.error` regex) —
 * moving the code would have turned those 2 assertions red with zero
 * behaviour change. CAM-585 rewrote those 2 assertions to pin the actual
 * invariant BEHAVIOURALLY (key never in a client component; key/URL never
 * logged on any failure branch, proven by actually exercising the routes)
 * instead of which file performs the read — see that story's tech.md for
 * the before/after and the red-then-green proof. The key itself is STILL
 * read only server-side (now inside `lib/geo/google-geocode.ts`), still
 * never returned/logged/`NEXT_PUBLIC_`-prefixed.
 */
export { normalizeAdminName };
export { extractComponent };

/**
 * Thin translation onto `callGoogleGeocodeCore` (`lib/geo/google-geocode.ts`).
 * Same contract as before the CAM-585 move: returns `{results}` on any
 * success (including ZERO_RESULTS, where `results` is simply empty) or
 * `null` on ANY failure (missing key, network error, non-OK HTTP, or a
 * Google `status` other than OK/ZERO_RESULTS) - callers map `null` to a
 * generic 500, never surfacing Google's raw body. Only the translated
 * `reason` string is ever logged - the outgoing URL (which carries the key)
 * is never constructed or read here, and `callGoogleGeocodeCore` itself
 * never logs it either (see that module's header).
 */
export async function callGoogleGeocode(
    params: Record<string, string>
): Promise<{ results: GoogleGeocodeResult[] } | null> {
    const result = await callGoogleGeocodeCore(params);
    if (!result.ok) {
        console.error('[geocode] Google Geocoding API call failed', result.reason);
        return null;
    }
    return { results: result.results };
}

/**
 * CAM-563 note (preserved): the id-first path is the AdminArea node, strings
 * are DERIVED from it — never the other way round.
 *
 * Resolves Google's address_components into the reverse-geocode result
 * shape. Walks PROVINCE -> DISTRICT -> SUBDISTRICT, each scoped to its
 * matched parent - a level with no raw name, or no match, stops the walk
 * (never guesses the next level from an unmatched parent).
 *
 * CAM-580: `province`/`district` are now built DIRECTLY from the matched
 * `AdminArea` node itself (`provinceNode`/`districtNode` — no second DB
 * query, no `ThailandLocation` table at all) into the byte-identical
 * `thailandLocationRowSchema` shape LocationPicker.tsx's cascading selects
 * already produce (BR-4/CAM-559) - same mapping `/api/locations/search`'s
 * `searchProvinces`/`searchDistricts` already use post-CAM-574. This also
 * closes a latent data-drift edge case the old `ThailandLocation` join
 * could hit (a matched AdminArea province with no corresponding
 * ThailandLocation row would silently stop the whole walk, never reaching
 * district/sub-district) - deriving the row from the node itself makes that
 * drift impossible by construction. `Location.province`/`district`'s stored
 * value/derivation is unchanged either way.
 */
export async function resolveFromComponents(components: GoogleAddressComponent[]): Promise<GeocodeReverseResult> {
    const provinceRaw = extractComponent(components, ['administrative_area_level_1']);
    const districtRaw = extractComponent(components, ['administrative_area_level_2']);
    const subDistrictRaw = extractComponent(components, ['sublocality_level_1', 'administrative_area_level_3', 'locality']);

    let provinceNode: AdminAreaNode | null = null;
    let districtNode: AdminAreaNode | null = null;
    let subDistrictNode: AdminAreaNode | null = null;

    if (provinceRaw) {
        provinceNode = await matchAdminArea(prisma, 'PROVINCE', provinceRaw);
    }

    if (provinceNode && districtRaw) {
        districtNode = await matchAdminArea(prisma, 'DISTRICT', districtRaw, provinceNode.id);
    }

    if (districtNode && subDistrictRaw) {
        subDistrictNode = await matchAdminArea(prisma, 'SUBDISTRICT', subDistrictRaw, districtNode.id);
    }

    return {
        province: provinceNode
            ? { id: provinceNode.id, provinceCode: provinceNode.code, provinceName: provinceNode.nameTh, provinceNameEn: provinceNode.nameEn, districtCode: '', districtName: null, districtNameEn: null }
            : null,
        district: districtNode
            ? { id: districtNode.id, provinceCode: provinceNode!.code, provinceName: provinceNode!.nameTh, provinceNameEn: provinceNode!.nameEn, districtCode: districtNode.code, districtName: districtNode.nameTh, districtNameEn: districtNode.nameEn }
            : null,
        subDistrict: subDistrictNode
            ? { id: subDistrictNode.id, code: subDistrictNode.code, nameTh: subDistrictNode.nameTh, nameEn: subDistrictNode.nameEn, parentId: subDistrictNode.parentId }
            : null,
        adminAreaId: subDistrictNode?.id ?? districtNode?.id ?? provinceNode?.id ?? null,
    };
}
