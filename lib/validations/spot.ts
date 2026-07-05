import { z } from 'zod';
import { imageInputSchema } from './image';

export const ViewTypeEnum = z.enum([
  "GENERAL", // ทั่วไป
  "RIVER",   // แม่น้ำ
  "MOUNTAIN", // ภูเขา
  "LAKE",    // ทะเลสาบ
  "FOREST",  // ป่า
  "BEACH",   // หาด
]);

export const spotSchema = z.object({
  zone: z.string().optional(), // DEPRECATED (CAM-362) — kept for backward compatibility
  zoneId: z.string().uuid().optional(), // CAM-362 — the entity link; takes precedence when present (tech.md §4.2)
  name: z.string().min(1, "Spot name is required"),
  // CAM-352: union input — accepts a legacy bare url string OR {url, kind};
  // both normalize to {url, kind} (see lib/validations/image.ts).
  images: z.array(imageInputSchema).optional(),
  viewType: ViewTypeEnum.optional(),
  maxCampers: z.number().int().min(1).optional(),
  maxTents: z.number().int().min(1).optional(),
  environment: z.string().optional(),
  pricePerNight: z.number().min(0),
  pricePerSite: z.number().min(0).optional(),
  nearFacilities: z.array(z.string()).optional(), // Internal Facility codes
  campSiteId: z.string().uuid(),
});

export type SpotInput = z.infer<typeof spotSchema>;
