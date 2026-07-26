import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { requireAuth } from '@/lib/auth-utils';
import { geocodeForwardQuerySchema, geocodeForwardResultSchema } from '@/lib/validations/location';
import { callGoogleGeocode } from '../_shared';

/**
 * GET /api/geocode/forward?province=&district=&subDistrict=
 *
 * CAM-554 AC-2: choosing a level in the cascading selects moves the map pin.
 * There is no centroid column on `ThailandLocation`/`AdminArea` to read a
 * lat/lon from directly (schema is out of this story's file surface), so the
 * SAME Google Geocoding API used for the reverse lookup is used here in its
 * forward mode (address text -> coordinates) - one endpoint/key/billing
 * model, never the browser-loaded Google Maps JS the owner ruled out.
 *
 * Auth + cost: same as `../reverse/route.ts` - `requireAuth()` gated (billed
 * per request), and the client only calls this once per SETTLED cascading-
 * select combination (debounced 300ms, skipped if unchanged since the last
 * call - see LocationPicker.tsx / tech.md).
 *
 * Error codes: `400` invalid input (missing province) · `401` not logged in ·
 * `500` geocoding failed.
 */
export async function GET(request: NextRequest) {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const parsed = geocodeForwardQuerySchema.safeParse({
        province: searchParams.get('province') ?? '',
        district: searchParams.get('district') ?? undefined,
        subDistrict: searchParams.get('subDistrict') ?? undefined,
    });
    if (!parsed.success) {
        return apiError('invalid_input', 400, parsed.error.format());
    }

    const address = [parsed.data.subDistrict, parsed.data.district, parsed.data.province, 'Thailand']
        .filter(Boolean)
        .join(', ');

    const data = await callGoogleGeocode({ address, language: 'th' });
    if (!data) {
        return apiError('geocode_failed', 500);
    }

    const location = data.results?.[0]?.geometry?.location;
    const result = { lat: location?.lat ?? null, lon: location?.lng ?? null };

    return apiSuccess(geocodeForwardResultSchema.parse(result));
}
