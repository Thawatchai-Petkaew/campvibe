import { z } from 'zod';
import { imageInputSchema, imageUrlValue } from './image';

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

// PREP-2 (CAM-268): closed cancellation-policy set (ADR-003) — see
// lib/cancellation-policy.ts for the Thai/EN copy per value.
export const CancellationPolicyEnum = z.enum([
  "FLEXIBLE",
  "MODERATE",
  "STRICT",
  "NON_REFUNDABLE",
]);

export const campSiteSchema = z.object({
  nameTh: z.string().min(1, "Name (TH) is required"),
  nameEn: z.string().optional(),
  nameThSlug: z.string().min(1, "Slug (TH) is required").optional(),
  nameEnSlug: z.string().min(1, "Slug (EN) is required").optional(),
  description: z.string().optional(),

  // CAM-520: scalar column, single choice. Required on create; the PUT
  // `.partial()` wrap makes it optional on update (see the two route
  // handlers). No `.default()` — an omitted create must fail loud (EC-1
  // is enforced by the form's create-default, not a silent server default).
  campSiteType: CampSiteTypeEnum,

  // Accepting arrays from frontend, will be joined to CSV for DB
  accessTypes: z.array(AccessTypeEnum).default([]),
  accommodationTypes: z.array(AccommodationTypeEnum).default([]),
  facilities: z.array(z.string()).default([]), // Internal
  externalFacilities: z.array(z.string()).optional(),
  equipment: z.array(z.string()).optional(),
  activities: z.array(z.string()).optional(),
  terrain: z.array(z.string()).optional(),
  // CAM-515 (S3) — Annotated features, the FIRST new MasterData group
  // (ALCO/FIRE/FIWD/ADAA/RESV): rules/rights the camp carries, not a
  // physical facility. Same CSV-on-write shape as the taxonomy arrays above.
  annotatedFeatures: z.array(z.string()).optional(),
  // CAM-516 (S4) — Camper style, the SECOND new MasterData group
  // (CHIC/GENR/DIFT/IDMT): host-declared vibe/style, not a rule/right. Same
  // CSV-on-write shape as the taxonomy arrays above.
  camperStyle: z.array(z.string()).optional(),

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

  // PREP-2 (CAM-268): atomic one-time additive fee + closed cancellation policy.
  // Bound mirrors the existing pricePerNight catalog row (.claude/rules/ux.md §2).
  // CAM-341 clearing fix: all three accept an explicit `null` (in addition to
  // being omittable via .optional()) so a host can clear a previously-set value.
  // undefined = key omitted, skip (partial update untouched) · null = clear the
  // column · a value = set it. Do not conflate undefined and null (PUT relies on
  // this distinction — see app/api/campsites/[id]/route.ts).
  extraFeeAmount: z
    .number()
    .min(0, "ค่าธรรมเนียมต้องอยู่ระหว่าง 0–100,000 บาท")
    .max(100000, "ค่าธรรมเนียมต้องอยู่ระหว่าง 0–100,000 บาท")
    .nullable()
    .optional(),
  extraFeeLabel: z.string().max(100, "ชื่อค่าธรรมเนียมต้องไม่เกิน 100 ตัวอักษร").nullable().optional(),
  cancellationPolicy: CancellationPolicyEnum.nullable().optional(),

  partner: z.string().optional(),
  nationalPark: z.string().optional(),
  // CAM-358: root-relative paths (the /api/upload dev-fallback shape + legacy
  // rows already in the DB) are valid alongside an absolute URL — see
  // lib/validations/image.ts `imageUrlValue`. Empty stays valid (no logo set).
  // CAM-360 clearing fix (same class as CAM-341): also accepts an explicit
  // `null` so a host clearing the logo can round-trip to the PUT route and
  // actually clear the column. undefined = key omitted, skip (partial update
  // untouched) · null = clear the column · '' = no logo set · a valid URL =
  // set it. See app/api/campsites/[id]/route.ts.
  logo: imageUrlValue.optional().or(z.literal('')).nullable(),
  // CAM-352: union input — accepts a legacy bare url string OR {url, kind};
  // both normalize to {url, kind} (see lib/validations/image.ts). The shared
  // <ImageUpload> component also feeds the camp gallery, so it must accept
  // the same shape the widened imageCreateNested/imageReplaceNested persist.
  images: z.array(imageInputSchema).optional(),
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
