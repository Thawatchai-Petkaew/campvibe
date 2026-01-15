import { z } from 'zod';

export const ViewTypeEnum = z.enum([
  "GENERAL", // ทั่วไป
  "RIVER",   // แม่น้ำ
  "MOUNTAIN", // ภูเขา
  "LAKE",    // ทะเลสาบ
  "FOREST",  // ป่า
  "BEACH",   // หาด
]);

export const spotSchema = z.object({
  zone: z.string().optional(),
  name: z.string().min(1, "Spot name is required"),
  images: z.array(z.string().url()).optional(),
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
