// Auto-generated from schema/api-schema.json
// This file provides type safety between frontend and backend

export type CampgroundType = 'CAGD' | 'CACP' | 'GLAMP';
export type AccessType = 'BAOT' | 'DRIV' | 'HIKE' | 'BIKE';
export type AccommodationType = 'TENT' | 'CABI' | 'TRAI' | 'GLAM';
export type FacilityCode = 'TOIL' | 'SHOW' | 'WIFI' | 'KITC' | 'PARK' | 'FIRE' | 'WATR' | 'SECU';
export type BookingMethod = 'ONLI' | 'ONCA' | 'ONST';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';
export type UserRole = 'ADMIN' | 'OPERATOR' | 'CAMPER';

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
    isVerified: boolean;
    isActive: boolean;
    isPublished: boolean;
    createdAt?: string;
    updatedAt?: string;
}

// Spot DTO (new)
export interface SpotDTO {
    id: string;
    zone?: string;
    name: string;
    images?: { url: string }[]; // S4b: Image relation
    viewType?: string;
    maxCampers?: number;
    maxTents?: number;
    pricePerNight: number;
    pricePerSite?: number;
    nearFacilities?: string; // CSV
    campSiteId: string;
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
