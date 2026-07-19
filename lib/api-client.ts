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
import { MAX_SUGGESTION_LENGTH } from '@/lib/ai/sanitize';
import { z } from 'zod';

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

/** CAM-427 — one "first tag" entry (the camp's primary Terrain-group descriptor, e.g. ริมน้ำ/ป่า/ภูเขา/ชายหาด). */
export interface AiChatCardTag {
    nameTh: string;
    nameEn: string;
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
 *
 * CAM-427 additive fields (api.md rule 12 — backward-compatible by
 * addition; `location.province` intentionally STAYS a required `string`,
 * never widened to `string | null`, to avoid a breaking change for the
 * existing `AiChatCampCard`/`CampgroundCardData` consumers — the server-side
 * mapper (`lib/read-models/ai-camp-card.ts` `toAiCampCard`) coerces a null
 * `Location.province` to `''` before it ever reaches this wire shape, the
 * SAME convention `app/wishlist/page.tsx` already uses for the identical
 * nullable-province case):
 *   - `options` — the card's "first tag" (≤1 entry), G3/first-tag real field.
 *   - `hasReviews` — G7: true only when `reviewCount > 0`; lets the card
 *     renderer show "ยังไม่มีรีวิว" instead of a misleading 0.0-star row.
 *   - `remaining` — G3: LIVE batched remaining-capacity count for the stay
 *     dates the assistant search was given; `null`/absent = no date range
 *     was requested (unknown), never fabricated.
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
    options?: AiChatCardTag[];
    hasReviews?: boolean;
    remaining?: number | null;
}

/**
 * CAM-420 (ADR-013 D6) — forward-compat rendered-content envelope. Purely
 * ADDITIVE and NOT populated by any route yet ("do NOT migrate cards/
 * suggestions into blocks now" — the story deliberately ships the SHAPE
 * only): a future block type is additive to the wire contract, never a
 * breaking change. `data` is intentionally `unknown` — each future block
 * type will own its own schema for `data` when it ships.
 */
export interface AiChatBlock {
    type: string;
    v: number;
    data: unknown;
}

const aiChatBlockSchema = z.object({
    type: z.string(),
    v: z.number(),
    data: z.unknown(),
});

export type AiChatOutcome =
    | {
          kind: 'ok';
          answer: string;
          cards: AiChatCardResponse[];
          suggestions?: string[];
          /** CAM-420 — present only when the wire body carried at least one well-formed block. */
          blocks?: AiChatBlock[];
          /** CAM-420 — present only on the v2 (session-bound, persisted) request path. */
          conversationId?: string;
          /**
           * CAM-430 — present (true) only when the turn actually ran
           * `searchCampsites` (regardless of how many cards it returned);
           * ABSENT for a greeting/FAQ/general-chat turn that ran no search,
           * or an older/unaware wire body (BR-1-style "absent means no
           * signal", same convention `suggestions`/`blocks` already use) —
           * a consumer must treat "absent" the same as `false`, never `true`.
           */
          searchAttempted?: true;
      }
    | { kind: 'rate-limited' }
    | { kind: 'disabled' }
    | { kind: 'error' };

/** Matches CAM-271's documented cap (story.md BR-2 sibling) — never send more. */
export const AI_CHAT_MAX_MESSAGES = 10;

/** CAM-410 BR-2 — mirrors the server's cap; the client re-enforces it independently (defense-in-depth, code.md CAM-305: network I/O is an input boundary) rather than trusting the wire body blindly. */
export const AI_CHAT_MAX_SUGGESTIONS = 3;

/**
 * CAM-410 seam invariant (Seams & refs): "for every response the client can
 * receive ... the client resolves to a sanitized `string[]` of length 0-3" —
 * true regardless of what the wire actually carried (absent, [], valid,
 * over-count, over-length, blank, duplicate). Never truncates an
 * over-length item mid-word; drops it instead (mirrors the server's BR-2).
 */
function normalizeSuggestions(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of value) {
        if (out.length >= AI_CHAT_MAX_SUGGESTIONS) break;
        if (typeof item !== 'string') continue;
        const trimmed = item.trim();
        if (trimmed.length === 0 || trimmed.length > MAX_SUGGESTION_LENGTH) continue;
        if (seen.has(trimmed)) continue;
        seen.add(trimmed);
        out.push(trimmed);
    }
    return out;
}

/**
 * CAM-420 forward-compat contract (pinned by test): keeps every
 * STRUCTURALLY well-formed envelope regardless of its `type` value — an
 * unrecognized type is NOT a parse failure. A client on an older build must
 * not lose or reject a future block it simply doesn't know how to render
 * yet; that is the whole point of a versioned, additive envelope. Only a
 * MALFORMED entry (missing/wrong-typed `type`/`v`) is dropped — the same
 * "drop the bad one, keep the rest" policy `isAiChatCardResponse` already
 * applies to `cards`. No known block type is rendered anywhere yet —
 * skip-rendering an unknown type is the render layer's job (out of scope:
 * no block-consuming UI exists yet).
 */
export function normalizeBlocks(value: unknown): AiChatBlock[] {
    if (!Array.isArray(value)) return [];
    const out: AiChatBlock[] = [];
    for (const item of value) {
        const parsed = aiChatBlockSchema.safeParse(item);
        if (parsed.success) out.push(parsed.data);
    }
    return out;
}

/** CAM-427 — one `options` entry is well-formed only when both display names are strings. */
function isCardTag(value: unknown): value is AiChatCardTag {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return typeof v.nameTh === 'string' && typeof v.nameEn === 'string';
}

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
        typeof location.province === 'string' &&
        // CAM-427 additive fields — each is either absent or well-formed
        // (api.md rule 12: an older/unaware body simply lacks the key).
        (v.options === undefined || (Array.isArray(v.options) && v.options.every(isCardTag))) &&
        (v.hasReviews === undefined || typeof v.hasReviews === 'boolean') &&
        (v.remaining === undefined || v.remaining === null || typeof v.remaining === 'number')
    );
}

/**
 * Validates a `200` body into an outcome; malformed cards are dropped, never
 * crash the turn (EC-6 sibling). CAM-410 (Seams & refs, CAM-342 lesson):
 * `suggestions` is enumerated here explicitly — an older/unaware body simply
 * has no such key, so `suggestions` stays absent on the outcome (BR-1
 * "absent means no chips"; EC-6 sibling).
 */
export function parseAiChatSuccessBody(data: unknown): AiChatOutcome {
    if (!data || typeof data !== 'object') return { kind: 'error' };
    const { answer, cards, suggestions, blocks, conversationId, searchAttempted } = data as Record<string, unknown>;
    if (typeof answer !== 'string') return { kind: 'error' };
    const safeCards = Array.isArray(cards) ? cards.filter(isAiChatCardResponse) : [];
    const safeSuggestions = normalizeSuggestions(suggestions);
    const safeBlocks = normalizeBlocks(blocks);
    const outcome: AiChatOutcome = { kind: 'ok', answer, cards: safeCards };
    if (safeSuggestions.length > 0) outcome.suggestions = safeSuggestions;
    if (safeBlocks.length > 0) outcome.blocks = safeBlocks;
    if (typeof conversationId === 'string' && conversationId.length > 0) outcome.conversationId = conversationId;
    // CAM-430: an older/unaware body simply lacks the key -> stays absent
    // (never fabricate a "search happened" signal that wasn't sent; a
    // consumer treats absent the same as false, same convention as `suggestions`).
    if (searchAttempted === true) outcome.searchAttempted = true;
    return outcome;
}

/**
 * CAM-423 (ADR-013 S9) — wire shape of one persisted message returned by
 * `GET /api/ai/conversations/[id]`, mirroring `ConversationMessageView`
 * (lib/ai/conversation-store.ts) post-JSON (`Date` -> ISO string).
 */
export interface AiConversationMessageView {
    id: string;
    role: 'USER' | 'ASSISTANT';
    seq: number;
    contentText: string;
    blocks: unknown;
    createdAt: string;
}

/** CAM-423 — the full body of `GET /api/ai/conversations/[id]` (CAM-421 AC-2). */
export interface AiConversationDetail {
    id: string;
    updatedAt: string;
    messages: AiConversationMessageView[];
}

/** CAM-423 — one row of `GET /api/ai/conversations`'s `conversations[]` (CAM-421 AC-1). */
export interface AiConversationSummary {
    id: string;
    title: string | null;
    messageCount: number;
    updatedAt: string;
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

    /**
     * POST /api/ai/chat — CAM-420 v2 (session-bound) shape. Never called for
     * a guest (D1); the route 401s an unauthenticated caller. Omitting
     * `conversationId` creates a new conversation server-side; the returned
     * `conversationId` threads the next turn (CAM-423 AC).
     */
    sendTurn: async (payload: { conversationId?: string; message: string }): Promise<AiChatOutcome> => {
        try {
            const response = await fetch(`${API_BASE}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
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

    /** GET /api/ai/conversations (CAM-421) — the session camper's own conversations, newest-updated-first. */
    listConversations: async (): Promise<ApiResponse<{ conversations: AiConversationSummary[] }>> => {
        return fetchAPI<{ conversations: AiConversationSummary[] }>('/ai/conversations');
    },

    /** GET /api/ai/conversations/[id] (CAM-421) — full ordered history for one conversation the session camper owns. */
    getConversation: async (id: string): Promise<ApiResponse<AiConversationDetail>> => {
        return fetchAPI<AiConversationDetail>(`/ai/conversations/${id}`);
    },
};
