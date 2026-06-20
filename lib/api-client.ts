// Type-safe API client for frontend
import type {
    CampgroundDTO,
    CampSiteDTO,
    BookingDTO,
    ReviewDTO,
    ApiResponse,
    PaginatedResponse,
    WishlistWithCampSiteDTO,
    WishlistIdsResponse,
} from '@/types/api';

const API_BASE = '/api';

async function fetchAPI<T>(
    endpoint: string,
    options?: RequestInit
): Promise<ApiResponse<T>> {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
            ...options,
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                error: data.error || 'Request failed',
                details: data.details,
            };
        }

        return { data };
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// Camp Site API (new)
export const campSiteAPI = {
    list: async (params?: {
        type?: string;
        accessTypes?: string;
        facilities?: string;
    }): Promise<ApiResponse<CampSiteDTO[]>> => {
        const queryParams = new URLSearchParams(params as any);
        return fetchAPI<CampSiteDTO[]>(`/campsites?${queryParams}`);
    },

    getBySlug: async (slug: string): Promise<ApiResponse<CampSiteDTO>> => {
        return fetchAPI<CampSiteDTO>(`/campsites/${slug}`);
    },

    create: async (data: Partial<CampSiteDTO>): Promise<ApiResponse<CampSiteDTO>> => {
        return fetchAPI<CampSiteDTO>('/campsites', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
};

// Legacy Campground API (for backward compatibility)
export const campgroundAPI = {
    list: async (params?: {
        type?: string;
        accessTypes?: string;
        facilities?: string;
    }): Promise<ApiResponse<CampgroundDTO[]>> => {
        const queryParams = new URLSearchParams(params as any);
        return fetchAPI<CampgroundDTO[]>(`/campsites?${queryParams}`);
    },

    getBySlug: async (slug: string): Promise<ApiResponse<CampgroundDTO>> => {
        return fetchAPI<CampgroundDTO>(`/campsites/${slug}`);
    },

    create: async (data: Partial<CampgroundDTO>): Promise<ApiResponse<CampgroundDTO>> => {
        return fetchAPI<CampgroundDTO>('/campsites', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
};

// Booking API
export const bookingAPI = {
    create: async (data: BookingDTO): Promise<ApiResponse<BookingDTO>> => {
        return fetchAPI<BookingDTO>('/bookings', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    list: async (): Promise<ApiResponse<BookingDTO[]>> => {
        return fetchAPI<BookingDTO[]>('/bookings');
    },
};

// Review API
export const reviewAPI = {
    create: async (data: ReviewDTO): Promise<ApiResponse<ReviewDTO>> => {
        return fetchAPI<ReviewDTO>('/reviews', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    listByCampSite: async (campSiteId: string): Promise<ApiResponse<ReviewDTO[]>> => {
        return fetchAPI<ReviewDTO[]>(`/reviews?campSiteId=${campSiteId}`);
    },
    listByCampground: async (campgroundId: string): Promise<ApiResponse<ReviewDTO[]>> => {
        return fetchAPI<ReviewDTO[]>(`/reviews?campSiteId=${campgroundId}`);
    },
};

// Wishlist API (CAM-18)
export const wishlistAPI = {
    /** GET /api/wishlist — returns newest-first list with camp site details */
    list: async (): Promise<ApiResponse<WishlistWithCampSiteDTO[]>> => {
        return fetchAPI<WishlistWithCampSiteDTO[]>('/wishlist');
    },

    /** GET /api/wishlist/ids — returns { campSiteIds: string[] } (no N+1) */
    getIds: async (): Promise<ApiResponse<WishlistIdsResponse>> => {
        return fetchAPI<WishlistIdsResponse>('/wishlist/ids');
    },

    /** POST /api/wishlist body { campSiteId } → 201 */
    save: async (campSiteId: string): Promise<ApiResponse<{ campSiteId: string }>> => {
        return fetchAPI<{ campSiteId: string }>('/wishlist', {
            method: 'POST',
            body: JSON.stringify({ campSiteId }),
        });
    },

    /** DELETE /api/wishlist/[campSiteId] → 200 { success: true } */
    remove: async (campSiteId: string): Promise<ApiResponse<{ success: boolean }>> => {
        return fetchAPI<{ success: boolean }>(`/wishlist/${campSiteId}`, {
            method: 'DELETE',
        });
    },
};

// Operator Dashboard API
export const operatorAPI = {
    getDashboard: async (operatorId?: string): Promise<ApiResponse<any>> => {
        const params = operatorId ? `?operatorId=${operatorId}` : '';
        return fetchAPI<any>(`/operator/dashboard${params}`);
    },
};
