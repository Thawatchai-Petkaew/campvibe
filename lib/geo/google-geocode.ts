/**
 * lib/geo/google-geocode.ts — CAM-572
 *
 * The one low-level Google Geocoding API fetch primitive, shared by the two
 * backfill scripts that each used to hand-roll their own copy:
 * `scripts/backfill-cam-562-subdistrict-geocode.mjs`'s reverse-mode
 * `callGoogleGeocode(lat, lon)` and
 * `scripts/backfill-cam-571-coordinates-inside-thailand.mjs`'s forward-mode
 * `callGoogleGeocodeForward(address)`. Both now delegate to
 * `callGoogleGeocodeCore` here, translating its discriminated result into
 * their own pre-existing return shape (unchanged, pinned by their own
 * existing test suites) — see this story's tech.md for the full inventory
 * and the enumerated diff of what each prior copy learned that the other
 * didn't.
 *
 * `extractComponent` (pure address-component extraction) is ALSO
 * consolidated here — it was duplicated between `app/api/geocode/_shared.ts`
 * (CAM-554, the original) and `scripts/backfill-cam-562-subdistrict-
 * geocode.mjs` (a byte-identical port). `_shared.ts` now re-exports it from
 * here (mirroring CAM-566's `normalizeAdminName` re-export), and 562's
 * script imports it directly instead of keeping its own copy.
 *
 * `app/api/geocode/_shared.ts::callGoogleGeocode` (CAM-554, the TS-route
 * caller) is DELIBERATELY NOT consolidated onto this module — see tech.md
 * "Why `_shared.ts::callGoogleGeocode` stays a separate, documented
 * exception" for the two independent reasons (a runtime-import boundary,
 * and `__tests__/cam-554-geocode-routes.test.ts` source-inspecting that
 * exact file for the key-safety invariant, which this dispatch was told to
 * leave unedited). This module's OWN key-safety discipline is identical:
 * the key is read from `process.env.GOOGLE_GEOCODING_API_KEY` only, is
 * never returned, and the outgoing URL (which carries the key) is never
 * logged — only a status code / Google `status` string / caught error
 * message.
 *
 * No `@/`-aliased import (mirrors `lib/geo/admin-area-match.ts`, CAM-566) so
 * a plain `.mjs` script can import this file directly via Node's native
 * TypeScript type-stripping, with zero bundler.
 */

const GOOGLE_GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

export interface GoogleAddressComponent {
    long_name: string;
    short_name: string;
    types: string[];
}

export interface GoogleGeocodeResult {
    address_components: GoogleAddressComponent[];
    geometry: { location: { lat: number; lng: number } };
}

/**
 * Discriminated union covering every outcome the two script callers need to
 * tell apart: a successful match (`zeroResults: false`, the raw `results`
 * array to extract from), a successful-but-empty match (`zeroResults:
 * true`), or a failure with a `reason` string (`missing_key` /
 * `http_<status>` / `google_<STATUS>` / a caught error's `message`) — never
 * a thrown exception, and the `reason` never contains the key-bearing URL.
 */
export type GoogleGeocodeCallResult =
    | { ok: true; zeroResults: false; results: GoogleGeocodeResult[] }
    | { ok: true; zeroResults: true; results: [] }
    | { ok: false; reason: string };

/**
 * Calls the Google Geocoding API with arbitrary query params (`latlng` for
 * reverse mode, `address` for forward mode — the two modes CAM-562's and
 * CAM-571's scripts each need). `region` defaults to `'th'` when the caller
 * doesn't set it (every current caller wants Thailand-biased results; the
 * default is overridable via `params.region`, a strict superset of the two
 * prior copies' unconditional `region=th`, safe because neither ever passed
 * a different value). The key is injected last, read from
 * `GOOGLE_GEOCODING_API_KEY` only, and NEVER appears in the returned
 * `reason` or in any logged value — this function itself never logs
 * (callers log, if they choose to, from the translated result only).
 */
export async function callGoogleGeocodeCore(params: Record<string, string>): Promise<GoogleGeocodeCallResult> {
    const key = process.env.GOOGLE_GEOCODING_API_KEY;
    if (!key) return { ok: false, reason: 'missing_key' };

    const url = new URL(GOOGLE_GEOCODE_ENDPOINT);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (!url.searchParams.has('region')) url.searchParams.set('region', 'th');
    url.searchParams.set('key', key);

    try {
        const res = await fetch(url.toString());
        if (!res.ok) return { ok: false, reason: `http_${res.status}` };
        const data = (await res.json()) as { status: string; results?: GoogleGeocodeResult[] };
        if (data.status === 'ZERO_RESULTS') return { ok: true, zeroResults: true, results: [] };
        if (data.status !== 'OK') return { ok: false, reason: `google_${data.status}` };
        return { ok: true, zeroResults: false, results: data.results ?? [] };
    } catch (err) {
        return { ok: false, reason: err instanceof Error ? err.message : 'unknown_error' };
    }
}

/** Returns the first address component's `long_name` matching any of `types`, in priority order. Ported originally from `app/api/geocode/_shared.ts` into `scripts/backfill-cam-562-subdistrict-geocode.mjs` (CAM-562); now the one copy both import. */
export function extractComponent(components: GoogleAddressComponent[], types: string[]): string | null {
    for (const type of types) {
        const found = components.find((c) => c.types.includes(type));
        if (found) return found.long_name;
    }
    return null;
}
