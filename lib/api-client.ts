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
import type {
    GetCampDetailResult,
    CampAmenity,
    CampDetailPrice,
    CampDetailCapacity,
    CampDetailLocation,
    WeekendAvailabilityEntry,
} from '@/lib/ai/tools/get-camp-detail';
import type { ReviewListItem, ReviewSummary } from '@/lib/review-summary';
import { isCancellationPolicyValue } from '@/lib/cancellation-policy';
import type { PricingUnit } from '@/lib/booking-pricing';
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
 *
 * CAM-564 additive field (api.md rule 12):
 *   - `matchedTag` — the ONE taxonomy tag that explains why THIS card is in
 *     these results, derived server-side (`lib/ai/tools/search-campsites.ts`
 *     `deriveMatchedTags`) from the camper's own supplied search filters and
 *     verified against this camp's real MasterData rows — deliberately
 *     DIFFERENT from `options` (the camp's own fixed default tag, unchanged):
 *     `null`/absent = no supplied filter matched this card (a free-text or
 *     location-only search) -> the card renders no badge at all, it never
 *     falls back to `options[0]` (that fixed fallback is exactly the
 *     "describes the camp, not the search" behavior CAM-547 found dishonest).
 *
 * CAM-597 additive fields on `location` (api.md rule 12) — see
 * `AiChatCardLocation` below.
 */
export interface AiChatCardResponse {
    id: string;
    nameTh: string;
    nameEn: string | null;
    nameThSlug: string;
    nameEnSlug: string;
    priceLow: number | null;
    /**
     * CAM-653 (ADR-014): what `priceLow` is charged per. Additive + optional
     * (api.md rule 12) — `searchCampsites` populates this on every card
     * (`aiCampCardSelect` inherits `CampSite.priceUnit` from
     * `campCardSelect`, CAM-653), so a real unit rides the wire today.
     * Stays optional so an older/unaware body still satisfies this type;
     * every consumer defaults the missing value to `PER_SITE`
     * (`priceUnitSuffix`, lib/price-unit-display.ts), matching the column
     * default.
     */
    priceUnit?: PricingUnit;
    createdAt: string;
    avgRating: number | null;
    reviewCount: number;
    location: AiChatCardLocation;
    images?: { url: string }[];
    options?: AiChatCardTag[];
    hasReviews?: boolean;
    remaining?: number | null;
    matchedTag?: AiChatCardTag | null;
}

/**
 * CAM-597 — the SAME bilingual district/province shape
 * `CampgroundCardData['location']` (components/CampgroundCard.tsx) already
 * carries, so both AI-chat cards (`AiChatCampCard`, `AiChatDetailCard`) can
 * render "sub-district, district, province" in the camper's ACTIVE language
 * via the shared `buildLocationText` — never a pre-rendered server string:
 * a pre-rendered string goes stale the instant the camper switches language
 * mid-session (this story's `docs/specs/.../tech.md`, "Payload shape
 * decision"), while this structured shape cannot, since the client re-runs
 * `buildLocationText` on every render with whatever language is active.
 *
 * `province` stays the raw, REQUIRED, English DB value — unchanged contract,
 * still the SAME `Location.province` `lib/campsite-filters.ts`'s exact-match
 * filter depends on (untouched by this story). Every other field is
 * optional and additive (api.md rule 12): an older/unaware wire body (before
 * this story) still satisfies this type.
 */
export interface AiChatCardLocation {
    province: string;
    provinceTh?: string;
    provinceEn?: string;
    district?: string | null;
    districtTh?: string;
    districtEn?: string;
    subDistrictTh?: string;
    subDistrictEn?: string;
}

/**
 * CAM-420 (ADR-013 D6) — forward-compat rendered-content envelope. A future
 * block type is additive to the wire contract, never a breaking change.
 * `data` is intentionally `unknown` at this generic level — each block type
 * owns its own schema for `data` (e.g. `AI_CHAT_CARDS_BLOCK_TYPE` below,
 * validated via `extractCardsBlock`).
 *
 * CAM-445 (R3 owner feedback) — the 'cards' type IS now populated, by
 * `POST /api/ai/chat`'s v2 (session-bound) path only: it persists the SAME
 * rendered cards the camper saw as `{type:'cards', v:1, data:AiChatCardResponse[]}`
 * so a resumed conversation can restore them (see `extractCardsBlock`).
 */
export interface AiChatBlock {
    type: string;
    v: number;
    data: unknown;
}

/** CAM-445 — the well-known block `type` string for a turn's rendered campsite cards; shared by the write side (route.ts) and the read side (`extractCardsBlock`) so neither can drift from the other. */
export const AI_CHAT_CARDS_BLOCK_TYPE = 'cards';

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
    | { kind: 'error' }
    /**
     * CAM-412 — client-internal only (never a wire status): the caller's OWN
     * `AbortSignal` fired (panel closed / reader cancelled) while a stream
     * was in flight. Distinguished from `'error'` so the UI can discard the
     * partial silently (AC-7/EC-6) instead of showing the error notice.
     */
    | { kind: 'aborted' };

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

/**
 * CAM-445 (R3 owner feedback) — extracts + validates the `cards[]` payload
 * from an ALREADY-`normalizeBlocks`'d array (structurally well-formed
 * envelopes only). Stored/wire JSON is an input boundary (code.md CAM-305):
 * every entry is re-validated through `isAiChatCardResponse` before it is
 * trusted as a real `AiChatCardResponse` — a malformed entry is dropped, the
 * rest of the array survives (the same "drop the bad one, keep the rest"
 * policy `parseAiChatSuccessBody`'s own `cards` handling already uses).
 * Returns `[]` when no well-formed 'cards' block is present (absent means no
 * cards, not a parse failure) — never throws.
 */
export function extractCardsBlock(blocks: AiChatBlock[]): AiChatCardResponse[] {
    const cardsBlock = blocks.find((b) => b.type === AI_CHAT_CARDS_BLOCK_TYPE);
    if (!cardsBlock || !Array.isArray(cardsBlock.data)) return [];
    return cardsBlock.data.filter(isAiChatCardResponse);
}

/** CAM-653 (ADR-014) — the wire value is well-formed only when it's a real `PricingUnit` member. */
function isPricingUnit(value: unknown): value is PricingUnit {
    return value === 'PER_PERSON' || value === 'PER_TENT' || value === 'PER_SITE';
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
        // CAM-653 additive field — same "absent or well-formed" contract.
        (v.priceUnit === undefined || isPricingUnit(v.priceUnit)) &&
        typeof v.createdAt === 'string' &&
        (v.avgRating === null || typeof v.avgRating === 'number') &&
        typeof v.reviewCount === 'number' &&
        !!location &&
        typeof location.province === 'string' &&
        // CAM-597 additive location fields — each is either absent or
        // well-formed (api.md rule 12), same "absent or well-formed"
        // contract as the card-level additive fields below.
        (location.provinceTh === undefined || typeof location.provinceTh === 'string') &&
        (location.provinceEn === undefined || typeof location.provinceEn === 'string') &&
        (location.district === undefined || location.district === null || typeof location.district === 'string') &&
        (location.districtTh === undefined || typeof location.districtTh === 'string') &&
        (location.districtEn === undefined || typeof location.districtEn === 'string') &&
        (location.subDistrictTh === undefined || typeof location.subDistrictTh === 'string') &&
        (location.subDistrictEn === undefined || typeof location.subDistrictEn === 'string') &&
        // CAM-427 additive fields — each is either absent or well-formed
        // (api.md rule 12: an older/unaware body simply lacks the key).
        (v.options === undefined || (Array.isArray(v.options) && v.options.every(isCardTag))) &&
        (v.hasReviews === undefined || typeof v.hasReviews === 'boolean') &&
        (v.remaining === undefined || v.remaining === null || typeof v.remaining === 'number') &&
        // CAM-564 additive field — same "absent or well-formed" contract.
        (v.matchedTag === undefined || v.matchedTag === null || isCardTag(v.matchedTag))
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
 * CAM-412 (ADR-015) — consumes the `text/event-stream` body of `POST /api/ai/chat`
 * (legacy/guest shape only). Reuses `isAiChatCardResponse` + `normalizeSuggestions`
 * for the `meta` event (Seams & refs: no parallel validation). `onDelta` fires
 * for each cleaned text chunk (progressive rendering); the returned outcome's
 * `answer` is the FULL accumulated text, so the caller can treat the result
 * exactly like the non-streaming path once the stream settles.
 *
 * EC-5 — an undecodable/malformed frame after the stream has started
 * resolves to `{kind:'error'}` (never surfaces raw frame text). A stream that
 * ends with no `meta`/`error` event at all (truncated) is the same EC-5
 * sibling — also `{kind:'error'}`.
 */
async function consumeAiChatStream(
  body: ReadableStream<Uint8Array>,
  onDelta?: (text: string) => void
): Promise<AiChatOutcome> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = 'message';
  let accumulated = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        const trimmed = line.trim();
        if (trimmed.length === 0) {
          currentEvent = 'message';
          continue;
        }
        if (trimmed.startsWith('event:')) {
          currentEvent = trimmed.slice(6).trim();
          continue;
        }
        if (!trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.slice(5).trim();

        let parsed: unknown;
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          return { kind: 'error' }; // EC-5 — undecodable frame
        }

        if (currentEvent === 'delta') {
          const text = (parsed as { text?: unknown }).text;
          if (typeof text === 'string' && text.length > 0) {
            accumulated += text;
            onDelta?.(text);
          }
        } else if (currentEvent === 'meta') {
          const raw = parsed as Record<string, unknown>;
          const safeCards = Array.isArray(raw.cards) ? raw.cards.filter(isAiChatCardResponse) : [];
          const safeSuggestions = normalizeSuggestions(raw.suggestions);
          const outcome: AiChatOutcome = { kind: 'ok', answer: accumulated, cards: safeCards };
          if (safeSuggestions.length > 0) outcome.suggestions = safeSuggestions;
          if (raw.searchAttempted === true) outcome.searchAttempted = true;
          return outcome;
        } else if (currentEvent === 'error') {
          return { kind: 'error' };
        }
      }
    }
    return { kind: 'error' }; // stream ended with no meta/error (truncated) — EC-5 sibling
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // already released/cancelled (BR-6 double-abort idempotence)
    }
  }
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

/**
 * CAM-412 — opt-in streaming for `aiChatAPI.send` (legacy/guest shape only;
 * `sendTurn`'s v2 session-bound path does not stream — ADR-015 scope note).
 * Passing this makes the request carry `Accept: text/event-stream`; a
 * non-streaming-capable response (the server's own JSON fallback, BR-2/AC-3)
 * is detected via `Content-Type` and parsed through the existing
 * `parseAiChatSuccessBody` path unchanged.
 */
export interface AiChatStreamOptions {
    /** Fires once per cleaned text chunk as it arrives (progressive render). */
    onDelta?: (text: string) => void;
    /** BR-6/AC-7/EC-6 — abort tears the upstream fetch (and OpenRouter call) down. */
    signal?: AbortSignal;
}

/** CAM-446 — narrows one `GetCampDetailResult.amenities[]` entry (network I/O is an input boundary, code.md CAM-305). */
function isCampAmenity(value: unknown): value is CampAmenity {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.code === 'string' &&
        typeof v.group === 'string' &&
        typeof v.nameTh === 'string' &&
        typeof v.nameEn === 'string' &&
        (v.icon === null || typeof v.icon === 'string')
    );
}

/** CAM-446 — narrows one `GetCampDetailResult.reviews[]` entry. `authorId` is never expected here (PDPA — the server select never carries it). */
function isReviewListItem(value: unknown): value is ReviewListItem {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.name === 'string' &&
        typeof v.rating === 'number' &&
        (v.content === null || typeof v.content === 'string') &&
        (typeof v.createdAt === 'string' || v.createdAt instanceof Date)
    );
}

/** CAM-446 — narrows `GetCampDetailResult.reviewSummary`. */
function isReviewSummary(value: unknown): value is ReviewSummary {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.hasReviews === 'boolean' &&
        (v.avgRating === null || typeof v.avgRating === 'number') &&
        typeof v.count === 'number'
    );
}

/** CAM-449 — narrows `GetCampDetailResult.price` (atomic fields, api.md rule 4). */
function isCampDetailPrice(value: unknown): value is CampDetailPrice {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        (v.low === null || typeof v.low === 'number') &&
        (v.high === null || typeof v.high === 'number') &&
        typeof v.currency === 'string' &&
        (v.extraFeeAmount === null || typeof v.extraFeeAmount === 'number') &&
        (v.extraFeeLabel === null || typeof v.extraFeeLabel === 'string') &&
        (v.feeInfo === null || typeof v.feeInfo === 'string') &&
        typeof v.isFree === 'boolean'
    );
}

/** CAM-449 — narrows `GetCampDetailResult.capacity`. */
function isCampDetailCapacity(value: unknown): value is CampDetailCapacity {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        (v.maxGuestsPerDay === null || typeof v.maxGuestsPerDay === 'number') &&
        (v.maxTentsPerDay === null || typeof v.maxTentsPerDay === 'number')
    );
}

/** CAM-449 — narrows `GetCampDetailResult.location`. PDPA: province/region only, never an address/contact field. */
function isCampDetailLocation(value: unknown): value is CampDetailLocation {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        (v.province === null || typeof v.province === 'string') &&
        (v.region === null || typeof v.region === 'string')
    );
}

/** CAM-449 — narrows one `GetCampDetailResult.weekendAvailability[]` entry. */
function isWeekendAvailabilityEntry(value: unknown): value is WeekendAvailabilityEntry {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.date === 'string' &&
        (v.remaining === null || typeof v.remaining === 'number') &&
        typeof v.blockedByHost === 'boolean'
    );
}

/**
 * CAM-446/CAM-449 — narrows a wire body into the `ok:true` variant of
 * `GetCampDetailResult`. Every field of the tool's own guest-safe shape is
 * checked explicitly; no operator/host/contact field is ever expected (PDPA)
 * so none is checked FOR here — their absence is what the server-side tool
 * (get-camp-detail.ts) + its own test already guarantee.
 */
function isGetCampDetailOk(value: unknown): value is Extract<GetCampDetailResult, { ok: true }> {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        v.ok === true &&
        typeof v.id === 'string' &&
        typeof v.nameTh === 'string' &&
        (v.nameEn === null || typeof v.nameEn === 'string') &&
        (v.description === null || typeof v.description === 'string') &&
        Array.isArray(v.amenities) &&
        v.amenities.every(isCampAmenity) &&
        Array.isArray(v.reviews) &&
        v.reviews.every(isReviewListItem) &&
        isReviewSummary(v.reviewSummary) &&
        isCampDetailPrice(v.price) &&
        isCampDetailCapacity(v.capacity) &&
        (v.cancellationPolicy === null || isCancellationPolicyValue(v.cancellationPolicy)) &&
        typeof v.isVerified === 'boolean' &&
        typeof v.checkInTime === 'string' &&
        typeof v.checkOutTime === 'string' &&
        (v.minimumAge === null || typeof v.minimumAge === 'number') &&
        isCampDetailLocation(v.location) &&
        (v.directions === null || typeof v.directions === 'string') &&
        (v.distanceFromBangkokKm === null || typeof v.distanceFromBangkokKm === 'number') &&
        Array.isArray(v.availableWeekendDates) &&
        v.availableWeekendDates.every((d) => typeof d === 'string') &&
        Array.isArray(v.weekendAvailability) &&
        v.weekendAvailability.every(isWeekendAvailabilityEntry)
    );
}

export const aiChatAPI = {
    /** POST /api/ai/chat — `messages` is truncated to the last AI_CHAT_MAX_MESSAGES before sending. */
    send: async (messages: AiChatRequestMessage[], streamOptions?: AiChatStreamOptions): Promise<AiChatOutcome> => {
        try {
            const response = await fetch(`${API_BASE}/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(streamOptions ? { Accept: 'text/event-stream' } : {}),
                },
                body: JSON.stringify({ messages: messages.slice(-AI_CHAT_MAX_MESSAGES) }),
                signal: streamOptions?.signal,
            });

            if (response.status === 429) return { kind: 'rate-limited' };
            if (response.status === 503) return { kind: 'disabled' };
            if (!response.ok) return { kind: 'error' };

            // AC-3/BR-1 — content negotiation: only consume as a stream when
            // BOTH we asked for one AND the server actually committed to one
            // (BR-2: a failure before the first delta returns ordinary JSON).
            // `.headers` is read lazily, only when we asked to stream, so a
            // plain non-streaming caller's response mock never needs one.
            if (streamOptions) {
                const contentType = response.headers.get('content-type') ?? '';
                if (contentType.includes('text/event-stream') && response.body) {
                    return await consumeAiChatStream(response.body, streamOptions.onDelta);
                }
            }

            const data: unknown = await response.json();
            return parseAiChatSuccessBody(data);
        } catch {
            if (streamOptions?.signal?.aborted) return { kind: 'aborted' };
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

    /**
     * GET /api/ai/camp-detail/[id] (CAM-446) — the floating detail card's data
     * source: amenities + verified reviews + upcoming weekend availability for
     * ONE published campsite. Guest-safe (no sign-in required, mirrors
     * `send` above). Network I/O is an input boundary (code.md CAM-305): the
     * wire body is runtime-narrowed field-by-field before it is ever trusted
     * as a `GetCampDetailResult` — never a blind `as` cast. Any non-2xx
     * response OR a body that fails narrowing resolves to the SAME
     * `{ok:false, code:'not_found'}` the tool itself returns for an unknown
     * camp — this function's return type has no other failure variant to
     * report through (400/429/500 all collapse to "can't show detail now").
     */
    getCampDetail: async (id: string): Promise<GetCampDetailResult> => {
        try {
            const response = await fetch(`${API_BASE}/ai/camp-detail/${id}`);
            if (!response.ok) return { ok: false, code: 'not_found' };
            const data: unknown = await response.json();
            return isGetCampDetailOk(data) ? data : { ok: false, code: 'not_found' };
        } catch {
            return { ok: false, code: 'not_found' };
        }
    },
};
