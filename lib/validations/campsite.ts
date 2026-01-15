import { z } from 'zod';

// Extended camp site types to match actual usage
export const CampSiteTypeEnum = z.enum([
  "CAGD", // Campgrounds
  "CACP", // Car Camping
  "GLAMP", // Glamping
  "LAKE", // Lakefront
  "FOREST", // Forest
  "VIEW", // Views
  "BAOT", // Boat Access
]);

export const AccessTypeEnum = z.enum([
  "BAOT", // Boat Access
  "DRIV", // Drive-in
  "HIKE", // Hike-in
  "WALK", // Walk-in
]);

export const AccommodationTypeEnum = z.enum([
  "CABI", // Cabin
  "DISP", // Dispersed
  "GROU", // Group
  "HORS", // Horse
  "RECR", // Recreation
  "TENT", // Tent
]);

export const BookingMethodEnum = z.enum([
  "ONLI", // Online
  "ONCA", // On Call
  "ONST", // On Site
]);

export const OwnershipTypeEnum = z.enum([
  "PRIVATE", // เอกชน
  "NATIONAL_PARK", // อุทยานแห่งชาติ
]);

export const campSiteSchema = z.object({
  nameTh: z.string().min(1, "Name (TH) is required"),
  nameEn: z.string().optional(),
  nameThSlug: z.string().min(1, "Slug (TH) is required").optional(),
  nameEnSlug: z.string().min(1, "Slug (EN) is required").optional(),
  description: z.string().optional(),

  campSiteType: z.array(CampSiteTypeEnum).default([]), // Multi-select

  // Accepting arrays from frontend, will be joined to CSV for DB
  accessTypes: z.array(AccessTypeEnum).default([]),
  accommodationTypes: z.array(AccommodationTypeEnum).default([]),
  facilities: z.array(z.string()).default([]), // Internal
  externalFacilities: z.array(z.string()).optional(),
  equipment: z.array(z.string()).optional(),
  activities: z.array(z.string()).optional(),
  terrain: z.array(z.string()).optional(),

  latitude: z.number(),
  longitude: z.number(),

  checkInTime: z.string().min(1),
  checkOutTime: z.string().min(1),
  bookingMethod: BookingMethodEnum,

  priceLow: z.number().optional(),
  priceHigh: z.number().optional(),

  locationId: z.string().uuid(),
  operatorId: z.string().uuid().optional(),

  address: z.string().optional(),
  directions: z.string().optional(),
  videoUrl: z.string().url().optional().or(z.literal('')),
  
  // Contact Information
  phone: z.string().optional(),
  lineId: z.string().optional(),
  facebookUrl: z.string().url().optional().or(z.literal('')),
  facebookMessageUrl: z.string().url().optional().or(z.literal('')),
  tiktokUrl: z.string().url().optional().or(z.literal('')),
  
  feeInfo: z.string().optional(),
  toiletInfo: z.string().optional(),
  minimumAge: z.number().int().min(0).optional(),

  partner: z.string().optional(),
  nationalPark: z.string().optional(),
  logo: z.string().url().optional().or(z.literal('')),
  images: z.array(z.string().url()).optional(),
  tags: z.array(z.string()).optional(),
  
  // Status fields
  isVerified: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  
  // Capacity & Ground Type
  maxGuestsPerDay: z.number().int().min(1).optional(),
  maxTentsPerDay: z.number().int().min(1).optional(),
  groundType: z.record(z.string(), z.number().int().min(0)).optional(), // {"STONE": 5, "GRASS": 10, ...}
  
  // Ownership & Pricing
  ownershipType: OwnershipTypeEnum.optional(),
  isFree: z.boolean().optional(),
  
  // Pet & Display Settings
  petFriendly: z.boolean().optional(),
  useSpotView: z.boolean().optional(),
});

export type CampSiteInput = z.infer<typeof campSiteSchema>;
