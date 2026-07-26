import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { requireAuth } from '@/lib/auth-utils';
import { geocodeReverseQuerySchema, geocodeReverseResultSchema } from '@/lib/validations/location';
import { callGoogleGeocode, resolveFromComponents } from '../_shared';

/**
 * GET /api/geocode/reverse?lat=&lon=
 *
 * CAM-554 AC-2: dropping/moving the map pin fills province/district/sub-
 * district via a SERVER-SIDE reverse geocode (Google Geocoding API, key read
 * from `GOOGLE_GEOCODING_API_KEY` - server env only, never sent to or logged
 * for the client). The client never calls Google directly (no browser key,
 * matches the owner's architecture decision).
 *
 * Auth: requires a logged-in session (`requireAuth`) - unlike the free
 * `/api/locations/search` DB read, this call is BILLED per request by
 * Google, so it is gated the same way the location-write endpoint already is
 * rather than left open to anonymous traffic.
 *
 * Cost: the client debounces pin drags/clicks (300ms) and never calls this
 * on mount - see LocationPicker.tsx / tech.md's "expected call pattern".
 *
 * Error codes: `400` invalid/missing lat/lon · `401` not logged in ·
 * `500` geocoding failed (generic message; detail logged server-side only,
 * the Google request URL - which carries the key - is never logged).
 */
export async function GET(request: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const parsed = geocodeReverseQuerySchema.safeParse({
        lat: searchParams.get('lat'),
        lon: searchParams.get('lon'),
    });
    if (!parsed.success) {
        return apiError('invalid_input', 400, parsed.error.format());
    }
    const { lat, lon } = parsed.data;

    const data = await callGoogleGeocode({ latlng: `${lat},${lon}`, language: 'th' });
    if (!data) {
        return apiError('geocode_failed', 500);
    }

    const components = data.results?.[0]?.address_components ?? [];
    const result = await resolveFromComponents(components);

    // Belt-and-suspenders: `.parse()` strips any key not in the schema, so a
    // stray internal field can never accidentally ride along to the client.
    return apiSuccess(geocodeReverseResultSchema.parse(result));
}
