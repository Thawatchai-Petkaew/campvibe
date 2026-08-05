// Auto-generated from schema/api-schema.json
// This file provides type safety between frontend and backend

export type CampgroundType = 'CAGD' | 'CACP' | 'GLAMP';
export type AccessType = 'BAOT' | 'DRIV' | 'HIKE' | 'BIKE';
export type AccommodationType = 'TENT' | 'CABI' | 'TRAI' | 'GLAM';
export type FacilityCode = 'TOIL' | 'SHOW' | 'WIFI' | 'KITC' | 'PARK' | 'FIRE' | 'WATR' | 'SECU';
export type BookingMethod = 'ONLI' | 'ONCA' | 'ONST';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';
// CAM-642: attribution label only (which route created the booking) — never
// an authz/pricing/capacity input.
export type BookingSource = 'WEB' | 'CHAT';
export type UserRole = 'ADMIN' | 'OPERATOR' | 'CAMPER';
// PREP-2 (CAM-268): closed set, see lib/cancellation-policy.ts for the Thai/EN copy.
export type CancellationPolicy = 'FLEXIBLE' | 'MODERATE' | 'STRICT' | 'NON_REFUNDABLE';
// CAM-352 groundwork: mirrors the Prisma `ImageKind` enum. PANORAMA = wide-strip
// pano (iPhone Pano), NOT an equirectangular sphere.
export type ImageKind = 'PHOTO' | 'PANORAMA';
// CAM-650/CAM-653 (ADR-014): mirrors the Prisma `PricingUnit` enum — what a
// price is charged per. Kept as a local mirror (same convention as the other
// enums on this page) rather than importing `@prisma/client`, since this
// file is consumed by client code too.
export type PricingUnit = 'PER_PERSON' | 'PER_TENT' | 'PER_SITE';

// API Request/Response Types
// Legacy CampgroundDTO (for backward compatibility)
export interface CampgroundDTO {
    id: string;
    nameTh: string;
    nameEn?: string;
    nameThSlug: string;
    nameEnSlug: string;
    description?: string;
    campgroundType: CampgroundType;
    accommodationTypes: string; // CSV (kept column)
    options?: { code: string; group: string; nameTh: string; nameEn: string; icon?: string }[]; // S4a taxonomy
    latitude: number;
    longitude: number;
    checkInTime: string;
    checkOutTime: string;
    bookingMethod: BookingMethod;
    priceLow?: number;
    priceHigh?: number;
    isVerified: boolean;
    isActive: boolean;
    isPublished: boolean;
    createdAt?: string;
    updatedAt?: string;
}

// Camp Site DTO (new)
export interface CampSiteDTO {
    id: string;
    nameTh: string;
    nameEn?: string;
    nameThSlug: string;
    nameEnSlug: string;
    description?: string;
    campSiteType: CampgroundType;
    accommodationTypes: string; // CSV (kept column)
    options?: { code: string; group: string; nameTh: string; nameEn: string; icon?: string }[]; // S4a taxonomy
    latitude: number;
    longitude: number;
    checkInTime: string;
    checkOutTime: string;
    bookingMethod: BookingMethod;
    priceLow?: number;
    priceHigh?: number;
    // CAM-653 (ADR-014): additive — what priceLow is charged per.
    priceUnit?: PricingUnit;
    // PREP-2 (CAM-268): additive — atomic one-time fee + closed cancellation policy.
    extraFeeAmount?: number | null;
    extraFeeLabel?: string | null;
    cancellationPolicy?: CancellationPolicy | null;
    isVerified: boolean;
    isActive: boolean;
    isPublished: boolean;
    createdAt?: string;
    updatedAt?: string;
}

// Spot DTO (new)
export interface SpotDTO {
    id: string;
    zone?: string; // DEPRECATED (CAM-362) — legacy free-text label, kept as a display mirror (T1)
    zoneId?: string; // CAM-362 — the entity link; source of truth for zone membership
    name: string;
    images?: { url: string; kind?: ImageKind }[]; // S4b: Image relation; kind additive (CAM-352)
    viewType?: string;
    maxCampers?: number;
    maxTents?: number;
    pricePerNight: number;
    // CAM-653 (ADR-014): additive — what pricePerNight is charged per;
    // overrides the camp's own priceUnit when this spot is booked.
    priceUnit?: PricingUnit;
    pricePerSite?: number;
    nearFacilities?: string; // CSV
    campSiteId: string;
    createdAt?: string;
    updatedAt?: string;
}

// CAM-362 — Zone DTO: per-camp reusable zone (tech.md §1.3). `deletedAt`/`version`
// are internal — NOT in the DTO (Buffet boundary: the client binds to the view).
export interface ZoneDTO {
    id: string;
    campSiteId: string;
    name: string;
    sortOrder: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface BookingDTO {
    id?: string;
    campSiteId: string;
    campgroundId?: string; // Legacy support
    userId: string;
    spotId?: string;
    siteId?: string; // Legacy support
    checkInDate: string; // ISO date string
    checkOutDate: string; // ISO date string
    guests: number;
    totalPrice?: number;
    status?: BookingStatus;
    // CAM-642 — additive; defaults to WEB when the caller omits it.
    source?: BookingSource;
    createdAt?: string;
    updatedAt?: string;
}

export interface ReviewDTO {
    id?: string;
    campSiteId: string;
    campgroundId?: string; // Legacy support
    authorId: string;
    rating: number; // 1-5
    title?: string;
    content: string;
    visitDate?: string; // ISO date string
    createdAt?: string;
    // CAM-269 (PREP-3) — verified-stay gate. Additive fields only (api.md #12);
    // both optional so existing callers of this shared DTO are unaffected.
    bookingId?: string;
    verified?: boolean;
}

export interface UserDTO {
    id: string;
    email: string;
    name?: string;
    role: UserRole;
    createdAt?: string;
    updatedAt?: string;
}

// Wishlist types (CAM-7 / CAM-18)

/**
 * Minimal CampSite projection returned inside wishlist entries.
 * Fields are exactly what the card UI needs — no over-fetching.
 */
export interface CampSiteSummary {
    id: string;
    nameTh: string;
    nameEn?: string | null;
    nameThSlug: string;
    nameEnSlug: string;
    images?: { url: string }[];  // S4b: Image relation (was CSV)
    priceLow?: number | null;
    priceHigh?: number | null;
    isVerified: boolean;
    isPublished: boolean;
    latitude: number;
    longitude: number;
}

/** A wishlist record without the nested camp site. */
export interface WishlistDTO {
    id: string;
    userId: string;
    campSiteId: string;
    createdAt: string; // ISO datetime
}

/** A wishlist record with the nested camp site summary (used in GET /api/wishlist). */
export interface WishlistWithCampSiteDTO {
    id: string;
    campSiteId: string;
    createdAt: string; // ISO datetime
    campSite: CampSiteSummary;
}

/** Response shape for GET /api/wishlist/ids */
export interface WishlistIdsResponse {
    campSiteIds: string[];
}

// Notification types (CAM-683)

// CAM-683: mirrors the Prisma `NotificationType` enum (prisma/schema.prisma:753).
// Kept as a local mirror rather than importing `@prisma/client` — same
// convention as the other enums on this page — since this file is consumed
// by client code too. Do not add a value here without a matching migration
// (`ALTER TYPE ... ADD VALUE` is irreversible in Postgres — .claude/rules/api.md #6).
export type NotificationType = 'BOOKING' | 'PAYMENT' | 'REVIEW' | 'SYSTEM' | 'KYC';

/**
 * A single notification row, scoped to its owner (never returned across users).
 * Superseded CAM-73's `href` field name — the shipped column is `link`.
 */
export interface NotificationDTO {
    id: string;
    type: NotificationType;
    title: string;
    body?: string | null;
    link?: string | null;
    isRead: boolean;
    createdAt: string; // ISO datetime
}

/** Response shape for PATCH /api/notifications/[id] (mark one notification read). */
export interface NotificationMarkReadResponse {
    id: string;
    isRead: true;
    readAt: string; // ISO datetime
}

/** Response shape for PATCH /api/notifications (mark all of the caller's unread rows read). */
export interface NotificationMarkAllReadResponse {
    count: number;
}

// API Response Wrappers
export interface ApiResponse<T> {
    data?: T;
    error?: string;
    details?: any;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
}

// Enum Display Mappings
export const CAMPGROUND_TYPE_LABELS: Record<CampgroundType, string> = {
    CAGD: 'Campground',
    CACP: 'Car Camping',
    GLAMP: 'Glamping',
};

export const ACCESS_TYPE_LABELS: Record<AccessType, string> = {
    BAOT: 'Boat Access',
    DRIV: 'Drive-in',
    HIKE: 'Hike-in',
    BIKE: 'Bike-in',
};

export const ACCOMMODATION_TYPE_LABELS: Record<AccommodationType, string> = {
    TENT: 'Tent',
    CABI: 'Cabin',
    TRAI: 'Trailer',
    GLAM: 'Glamping',
};

export const FACILITY_LABELS: Record<FacilityCode, string> = {
    TOIL: 'Toilet',
    SHOW: 'Shower',
    WIFI: 'Wifi',
    KITC: 'Kitchen',
    PARK: 'Parking',
    FIRE: 'Fire Pit',
    WATR: 'Drinking Water',
    SECU: 'Security',
};

export const BOOKING_METHOD_LABELS: Record<BookingMethod, string> = {
    ONLI: 'Online',
    ONCA: 'On Call',
    ONST: 'On Site',
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
    PENDING: 'Pending',
    CONFIRMED: 'Confirmed',
    CANCELLED: 'Cancelled',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
    ADMIN: 'Administrator',
    OPERATOR: 'Campground Operator',
    CAMPER: 'Camper/Guest',
};

// S4a: parseFacilities/parseAccessTypes/parseAccommodationTypes removed — taxonomy now
// comes from the `options` MasterData relation, not CSV strings (dead code, zero callers).
