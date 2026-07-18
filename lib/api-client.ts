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

// AI Chat API (CAM-272 — facade for the CAM-271 single-turn chat endpoint).
// Security (BR-3 / .claude/rules/security.md §6): the client NEVER calls
// OpenRouter/the model directly — every question is POSTed through this
// server-side route only, so no model secret ever reaches the client bundle.
export interface AiChatRequestMessage {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * The wire shape of one campsite card inside a CAM-271 `200` response —
 * post-`serializeDecimals` + JSON (lib/serialize.ts): Decimal -> number,
 * Date -> ISO string. Deliberately NOT the server-side `CampCardPayload`
 * (Prisma.Decimal/Date) — those never reach a `fetch()` caller as-is.
 * `avgRating`/`reviewCount` (CAM-272 QA Important finding): surfaced so
 * `AiChatCampCard` can render the same rating badge `CampgroundCard` shows
 * everywhere else (design.md "keeps the same visual language"). `images`
 * intentionally declares only `{url}` — `sortOrder` is a server-internal
 * ordering key, never read client-side (QA Info finding; the route no
 * longer sends it either).
 */
export interface AiChatCardResponse {
    id: string;
    nameTh: string;
    nameEn: string | null;
    nameThSlug: string;
    nameEnSlug: string;
    priceLow: number | null;
    createdAt: string;
    avgRating: number | null;
    reviewCount: number;
    location: { province: string };
    images?: { url: string }[];
}

export type AiChatOutcome =
    | { kind: 'ok'; answer: string; cards: AiChatCardResponse[] }
    | { kind: 'rate-limited' }
    | { kind: 'disabled' }
    | { kind: 'error' };

/** Matches CAM-271's documented cap (story.md BR-2 sibling) — never send more. */
export const AI_CHAT_MAX_MESSAGES = 10;

/** Narrows an unknown value into an `AiChatCardResponse` (network I/O is an input boundary, code.md CAM-305). */
export function isAiChatCardResponse(value: unknown): value is AiChatCardResponse {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    const location = v.location as Record<string, unknown> | undefined;
    return (
        typeof v.id === 'string' &&
        typeof v.nameTh === 'string' &&
        typeof v.nameThSlug === 'string' &&
        typeof v.nameEnSlug === 'string' &&
        (v.priceLow === null || typeof v.priceLow === 'number') &&
        typeof v.createdAt === 'string' &&
        (v.avgRating === null || typeof v.avgRating === 'number') &&
        typeof v.reviewCount === 'number' &&
        !!location &&
        typeof location.province === 'string'
    );
}

/** Validates a `200` body into an outcome; malformed cards are dropped, never crash the turn (EC-6 sibling). */
export function parseAiChatSuccessBody(data: unknown): AiChatOutcome {
    if (!data || typeof data !== 'object') return { kind: 'error' };
    const { answer, cards } = data as Record<string, unknown>;
    if (typeof answer !== 'string') return { kind: 'error' };
    const safeCards = Array.isArray(cards) ? cards.filter(isAiChatCardResponse) : [];
    return { kind: 'ok', answer, cards: safeCards };
}

export const aiChatAPI = {
    /** POST /api/ai/chat — `messages` is truncated to the last AI_CHAT_MAX_MESSAGES before sending. */
    send: async (messages: AiChatRequestMessage[]): Promise<AiChatOutcome> => {
        try {
            const response = await fetch(`${API_BASE}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: messages.slice(-AI_CHAT_MAX_MESSAGES) }),
            });

            if (response.status === 429) return { kind: 'rate-limited' };
            if (response.status === 503) return { kind: 'disabled' };
            if (!response.ok) return { kind: 'error' };

            const data: unknown = await response.json();
            return parseAiChatSuccessBody(data);
        } catch {
            return { kind: 'error' };
        }
    },
};
