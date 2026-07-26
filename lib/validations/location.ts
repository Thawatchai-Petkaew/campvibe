import { z } from 'zod';

/**
 * SEC-B (CAM-216): zod boundary schema for POST /api/location.
 * CAM-553: added `district` — the host-typed district was collected by
 * CampgroundForm but never sent past the client (write-path defect); the
 * field is atomic free text (mirrors `province`), not a new dimension.
 * CAM-559: added `subDistrict` through the SAME seam (atomic free text,
 * mirrors district) — the cascading picker's third level.
 *
 * Rules:
 *  - lat: number, -90..90 (required — stored on Location)
 *  - lon: number, -180..180 (required)
 *  - country: optional string, trimmed, max 100 chars
 *  - province: optional string, trimmed, max 100 chars
 *  - district: optional string, trimmed, max 100 chars (CAM-553)
 *  - subDistrict: optional string, trimmed, max 100 chars (CAM-559)
 *  - region: optional string, trimmed, max 100 chars
 *  - thaiLocationId: optional string UUID (FK to ThailandLocation)
 *
 * All string fields are trimmed at parse time; no field exposes internal
 * column names or DB identifiers to the client error shape.
 */
export const createLocationSchema = z.object({
    lat: z.number().min(-90, 'lat must be >= -90').max(90, 'lat must be <= 90'),
    lon: z.number().min(-180, 'lon must be >= -180').max(180, 'lon must be <= 180'),
    country: z.string().trim().max(100).optional(),
    province: z.string().trim().max(100).optional(),
    district: z.string().trim().max(100).optional(),
    subDistrict: z.string().trim().max(100).optional(),
    region: z.string().trim().max(100).optional(),
    thaiLocationId: z.string().uuid().optional(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;

/**
 * CAM-559: zod boundary for the location fields carried inside a partial
 * PUT /api/campsites/[id] body (`province`/`district`/`subDistrict` are NOT
 * part of `campSiteSchema` — they live on the related `Location` row, so
 * they were previously read off the raw, unvalidated body). Every field is
 * optional (a partial update may touch none, one, or all three) and an
 * empty string is a valid, explicit "clear" signal — mapped to `null` at
 * the write site, mirroring the CAM-341/CAM-360 clearing pattern.
 */
export const updateCampSiteLocationSchema = z.object({
    province: z.string().trim().max(100).optional(),
    district: z.string().trim().max(100).optional(),
    subDistrict: z.string().trim().max(100).optional(),
});

export type UpdateCampSiteLocationInput = z.infer<typeof updateCampSiteLocationSchema>;

/**
 * CAM-559: zod boundary for GET /api/admin-areas/subdistricts — the ONLY
 * AdminArea level this story reads server-side (province/district keep
 * reading `ThailandLocation` via the existing `/api/locations/search`,
 * untouched, so `Location.province`'s stored value/derivation never
 * changes — see tech.md). `districtCode` is the AdminArea DISTRICT node's
 * national code (identical value to `ThailandLocation.districtCode`, same
 * source import — verified in tech.md), so the client can scope a
 * sub-district lookup using the district it already picked from
 * `ThailandLocation`, with no new ID namespace to stitch together.
 */
export const adminAreaSubDistrictQuerySchema = z.object({
    districtCode: z.string().trim().min(1).max(20),
    q: z.string().trim().max(100).optional(),
});

export type AdminAreaSubDistrictQuery = z.infer<typeof adminAreaSubDistrictQuerySchema>;
