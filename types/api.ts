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
    accessTypes: string; // CSV
    accommodationTypes: string; // CSV
    facilities: string; // CSV
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
    accessTypes: string; // CSV
    accommodationTypes: string; // CSV
    facilities: string; // CSV
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
    images?: string; // CSV
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

// Helper Functions
export function parseFacilities(facilitiesStr: string): FacilityCode[] {
    return facilitiesStr.split(',').filter(Boolean) as FacilityCode[];
}

export function parseAccessTypes(accessTypesStr: string): AccessType[] {
    return accessTypesStr.split(',').filter(Boolean) as AccessType[];
}

export function parseAccommodationTypes(accommodationTypesStr: string): AccommodationType[] {
    return accommodationTypesStr.split(',').filter(Boolean) as AccommodationType[];
}
