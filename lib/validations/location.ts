import { z } from 'zod';

/**
 * SEC-B (CAM-216): zod boundary schema for POST /api/location.
 *
 * Rules:
 *  - lat: number, -90..90 (required — stored on Location)
 *  - lon: number, -180..180 (required)
 *  - country: optional string, trimmed, max 100 chars
 *  - province: optional string, trimmed, max 100 chars
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
    region: z.string().trim().max(100).optional(),
    thaiLocationId: z.string().uuid().optional(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
