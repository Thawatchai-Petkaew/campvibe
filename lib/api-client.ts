// Type-safe API client for frontend
import type {
    CampgroundDTO,
    BookingDTO,
    ReviewDTO,
    ApiResponse,
    PaginatedResponse
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

// Campground API
export const campgroundAPI = {
    list: async (params?: {
        type?: string;
        accessTypes?: string;
        facilities?: string;
    }): Promise<ApiResponse<CampgroundDTO[]>> => {
        const queryParams = new URLSearchParams(params as any);
        return fetchAPI<CampgroundDTO[]>(`/campgrounds?${queryParams}`);
    },

    getBySlug: async (slug: string): Promise<ApiResponse<CampgroundDTO>> => {
        return fetchAPI<CampgroundDTO>(`/campgrounds/${slug}`);
    },

    create: async (data: Partial<CampgroundDTO>): Promise<ApiResponse<CampgroundDTO>> => {
        return fetchAPI<CampgroundDTO>('/campgrounds', {
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

    listByCampground: async (campgroundId: string): Promise<ApiResponse<ReviewDTO[]>> => {
        return fetchAPI<ReviewDTO[]>(`/reviews?campgroundId=${campgroundId}`);
    },
};

// Operator Dashboard API
export const operatorAPI = {
    getDashboard: async (operatorId?: string): Promise<ApiResponse<any>> => {
        const params = operatorId ? `?operatorId=${operatorId}` : '';
        return fetchAPI<any>(`/operator/dashboard${params}`);
    },
};
