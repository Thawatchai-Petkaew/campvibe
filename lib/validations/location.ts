import { z } from 'zod';

/**
 * CAM-619 — the shared lat/lon bound, extracted so a coordinate field never
 * re-derives its own copy of -90..90 / -180..180. This exact drift is why
 * this story exists: `CampSite.latitude/longitude` (lib/validations/
 * campsite.ts) carried a bare `z.number()` with NO bound at all, while this
 * schema enforced one for the SAME host-dropped pin — and CAM-575's
 * `campsite_coords_sync` DB trigger derives `Location.lat/lon` FROM
 * `CampSite.latitude/longitude`, so the unguarded sibling silently overwrote
 * the guarded one moments later. `.finite()` is redundant against ±Infinity
 * (zod's `.min()/.max()` already fail an out-of-range comparison against
 * Infinity — verified: `z.number().min(-90).max(90).safeParse(Infinity)` is
 * already `false`) but is kept explicit, same defense-in-depth idiom as
 * `lib/validations/ai-chat.ts`'s `shownResultSchema.priceLow`.
 * `geocodeReverseQuerySchema` below needs `z.coerce.number()` (query-string
 * values arrive as strings) so it keeps its own chain, but MUST use the SAME
 * two numeric bounds — do not drift them apart.
 */
export const latitudeSchema = z
    .number()
    .finite('lat must be a finite number')
    .min(-90, 'lat must be >= -90')
    .max(90, 'lat must be <= 90');
export const longitudeSchema = z
    .number()
    .finite('lon must be a finite number')
    .min(-180, 'lon must be >= -180')
    .max(180, 'lon must be <= 180');

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
 *  - adminAreaId: optional string UUID (FK to AdminArea — CAM-574: replaces
 *    the retired `thaiLocationId` FK to `ThailandLocation`; the deepest
 *    AdminArea node the picker/pin resolved, province or deeper)
 *
 * All string fields are trimmed at parse time; no field exposes internal
 * column names or DB identifiers to the client error shape.
 */
export const createLocationSchema = z.object({
    lat: latitudeSchema,
    lon: longitudeSchema,
    country: z.string().trim().max(100).optional(),
    province: z.string().trim().max(100).optional(),
    district: z.string().trim().max(100).optional(),
    subDistrict: z.string().trim().max(100).optional(),
    region: z.string().trim().max(100).optional(),
    adminAreaId: z.string().uuid().optional(),
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

/**
 * CAM-554 — zod boundary for `GET /api/geocode/reverse?lat=&lon=`: the map
 * pin drop/drag. `z.coerce.number()` because query-string values arrive as
 * strings; bounds mirror `createLocationSchema`'s lat/lon rule (ux.md's
 * validation catalog: lat -90..90, lon -180..180).
 */
export const geocodeReverseQuerySchema = z.object({
    lat: z.coerce.number().min(-90, 'lat must be >= -90').max(90, 'lat must be <= 90'),
    lon: z.coerce.number().min(-180, 'lon must be >= -180').max(180, 'lon must be <= 180'),
});

export type GeocodeReverseQuery = z.infer<typeof geocodeReverseQuerySchema>;

/**
 * CAM-554 — zod boundary for `GET /api/geocode/forward` (choosing a
 * province/district/sub-district moves the pin). `province` is the only
 * required piece — a host may have picked just a province so far.
 */
export const geocodeForwardQuerySchema = z.object({
    province: z.string().trim().min(1).max(100),
    district: z.string().trim().max(100).optional(),
    subDistrict: z.string().trim().max(100).optional(),
});

export type GeocodeForwardQuery = z.infer<typeof geocodeForwardQuerySchema>;

/**
 * CAM-554 — the ThailandLocation-row shape LocationPicker.tsx already keys
 * its province/district comboboxes on (see `ThailandLocationRow` there).
 * Reused (not re-declared) as the reverse-geocode response shape for those
 * two levels so a resolved pin can flow straight into the SAME state the
 * cascading selects already use, with no second shape to reconcile.
 */
export const thailandLocationRowSchema = z.object({
    id: z.string(),
    provinceCode: z.string(),
    provinceName: z.string(),
    provinceNameEn: z.string(),
    districtCode: z.string().nullable(),
    districtName: z.string().nullable(),
    districtNameEn: z.string().nullable(),
});

/**
 * CAM-554 — the AdminArea sub-district row shape `/api/admin-areas/
 * subdistricts` already returns (see `SubDistrictRow` in LocationPicker.tsx).
 */
export const subDistrictRowSchema = z.object({
    id: z.string(),
    code: z.string(),
    nameTh: z.string(),
    nameEn: z.string(),
    parentId: z.string().nullable(),
});

/**
 * CAM-554 — reverse-geocode response. `adminAreaId` is the DEEPEST AdminArea
 * tree node actually matched (sub-district, else district, else province) -
 * the id-first result the CAM-563 province/district/sub-district-by-id
 * migration will consume later. `province`/`district`/`subDistrict` are
 * DERIVED from that same resolved node (never the other way round) so they
 * stay byte-identical in shape to what the cascading selects already
 * produce - this story does not change what `Location.province`/`district`/
 * `subDistrict` store (BR-4 of CAM-559, unchanged here). A `null` at any
 * level means the geocoder's returned name did not match the imported
 * master data at that level. This is a plain (non-strict) zod object, so
 * `.parse()` STRIPS any unrecognized key - a raw Google/Prisma field can
 * never accidentally ride along into the client response.
 */
export const geocodeReverseResultSchema = z.object({
    province: thailandLocationRowSchema.nullable(),
    district: thailandLocationRowSchema.nullable(),
    subDistrict: subDistrictRowSchema.nullable(),
    adminAreaId: z.string().nullable(),
});

export type GeocodeReverseResult = z.infer<typeof geocodeReverseResultSchema>;

/** CAM-554 — forward-geocode response: the coordinates Google resolved for the
 *  chosen province/district/sub-district text, or `null` when nothing matched. */
export const geocodeForwardResultSchema = z.object({
    lat: z.number().nullable(),
    lon: z.number().nullable(),
});

export type GeocodeForwardResult = z.infer<typeof geocodeForwardResultSchema>;
