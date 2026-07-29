import { z } from 'zod';
import { imageInputSchema } from './image';
// CAM-654 (epic CAM-648, ADR-014): the shared PER_PERSON/PER_SITE boundary
// enum — defined once in campsite.ts so the camp form and this spot form can
// never expose a different set of choices from one another.
import { PriceUnitEnum } from './campsite';

export const ViewTypeEnum = z.enum([
  "GENERAL", // ทั่วไป
  "RIVER",   // แม่น้ำ
  "MOUNTAIN", // ภูเขา
  "LAKE",    // ทะเลสาบ
  "FOREST",  // ป่า
  "BEACH",   // หาด
]);

// CAM-615 (root fix, same pattern as lib/validations/campsite.ts): a nullable,
// user-editable Prisma column gets `.nullable()` here so a host can send an
// explicit `null` to clear a previously-set value — `.optional()` alone only
// lets the key be OMITTED (undefined = "skip"), it can never carry a clear.
// zone/zoneId/nearFacilities are deliberately NOT widened — see
// scripts/check-clearable-fields.mjs's ALLOWLIST for the stated reason each
// (zone/zoneId = an explicit round-1 scope boundary, resolveSpotZoneWrite in
// lib/api-utils.ts; nearFacilities = array->CSV, same rule as CampSite.tags).
export const spotSchema = z.object({
  zone: z.string().optional(), // DEPRECATED (CAM-362) — kept for backward compatibility
  zoneId: z.string().uuid().optional(), // CAM-362 — the entity link; takes precedence when present (tech.md §4.2)
  name: z.string().min(1, "Spot name is required"),
  // CAM-352: union input — accepts a legacy bare url string OR {url, kind};
  // both normalize to {url, kind} (see lib/validations/image.ts).
  images: z.array(imageInputSchema).optional(),
  viewType: ViewTypeEnum.optional().nullable(),
  maxCampers: z.number().int().min(1).optional().nullable(),
  maxTents: z.number().int().min(1).optional().nullable(),
  environment: z.string().optional().nullable(),
  pricePerNight: z.number().min(0),
  pricePerSite: z.number().min(0).optional().nullable(),
  // CAM-654: the Prisma column is NOT NULL with @default(PER_SITE) (CAM-650) —
  // same "no clear path, `.optional()` only" reasoning as
  // campSiteSchema.priceUnit (lib/validations/campsite.ts). Inert until spot
  // selection ships (ADR-014 §1 — no client sends `spotId` to
  // POST /api/bookings today), wired here now so it never needs its own
  // separate migration later.
  priceUnit: PriceUnitEnum.optional(),
  nearFacilities: z.array(z.string()).optional(), // Internal Facility codes (CSV — see file header)
  campSiteId: z.string().uuid(),
});

export type SpotInput = z.infer<typeof spotSchema>;
