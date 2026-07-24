/**
 * CAM-271 BR-3 — zod boundary for the posted conversation array reaching
 * `POST /api/ai/chat`. Any breach (more than MAX_CHAT_MESSAGES messages, a
 * message longer than MAX_CHAT_MESSAGE_LENGTH characters, a role other than
 * user/assistant, no user message present, or a malformed body) is rejected
 * with 400 `invalid_request` BEFORE any model/tool call runs — this bounds
 * prompt size + spend and caps client-controlled input before the paid call
 * (security.md CAM-344: never trust a client-controlled iteration/size).
 *
 * CAM-420 (ADR-013 D6) — the route's input contract becomes a UNION of two
 * request shapes, tried legacy-FIRST so an existing `{messages}` body (the
 * ONLY shape today, guest/stateless) keeps matching byte-identically:
 *  - `chatRequestSchema` (unchanged, above) — legacy, stateless, no session.
 *  - `chatRequestV2Schema` (new, below) — session-bound single-question
 *    shape; the route reads the caller's session to decide 401/persist, this
 *    schema only bounds shape/size (`message` at most MAX_CHAT_MESSAGE_LENGTH
 *    chars, matching the legacy per-message cap; `conversationId`, when
 *    present, must be the real `ChatConversation.id` UUID shape).
 *
 * CAM-460 (D2, tech.md — conversation state for follow-up references) adds
 * ONE additive, optional field to `chatRequestSchema` (legacy/guest only —
 * the authed v2 path derives its state server-side, `lib/ai/conversation-
 * store.ts` `deriveShownState`, never over the wire): `lastResults`, the
 * client-resent "shown results" state. A guest has NO server-side memory
 * (the `{messages}` path persists nothing), so this is the guest's ONLY path
 * to a back-reference resolving correctly (story.md BR-4/AC-4). This is
 * UNTRUSTED input — bounded/shape-checked here (zod); SANITIZED + wrapped in
 * a DATA fence at the prompt-injection boundary
 * (`lib/ai/openrouter-client.ts`'s `buildSystemPrompt` shownResults param,
 * the SAME seam that fences the camper's own message text) before it ever
 * reaches the model. Absent (the byte-identical default for every existing
 * body) → the turn has no prior-shown memory → falls to the clarify path
 * (EC-4) — never fabricates a prior result.
 */
import { z } from 'zod';

/** BR-3 cap — at most this many messages in one posted conversation. */
export const MAX_CHAT_MESSAGES = 10;
/** BR-3 cap — at most this many characters per message. */
export const MAX_CHAT_MESSAGE_LENGTH = 2000;
/**
 * CAM-460 (D2/D3) — a shown-result entry's `name` is capped at this many
 * characters: enforced here (the guest wire zod boundary) AND again, as
 * defense-in-depth, at the prompt-injection truncation
 * (`lib/ai/openrouter-client.ts` imports this SAME constant — one cap, not
 * two independently-chosen numbers).
 */
export const SHOWN_RESULT_NAME_MAX = 80;
/**
 * CAM-460 (D2/D3) — mirrors `SEARCH_CAMPSITES_MAX_RESULTS`
 * (`lib/ai/tools/search-campsites.ts`, currently 10): the guest can never
 * legitimately have been shown more campsites than that tool ever returns in
 * one search, so `lastResults`/each `ordinal` is bounded to the same number.
 * DELIBERATELY a local, independently-declared constant rather than an
 * import of the tool's own export: this file is a lean, dependency-free
 * (beyond zod) validation boundary that several tests statically import
 * BEFORE their own `vi.mock('@/lib/prisma', ...)` variable declarations —
 * pulling in the tool (which transitively imports `@/lib/prisma`) here would
 * invoke that hoisted mock factory too early (a real regression this exact
 * change caused and was reverted from, cam-420-adversarial-verify.test.ts).
 * If the tool's cap ever changes, update this value too (co-location note,
 * not a live cross-reference).
 */
export const MAX_SHOWN_RESULTS = 10;

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(MAX_CHAT_MESSAGE_LENGTH),
});

/**
 * CAM-460 (D2) — one entry of the guest-resent "shown results" state.
 * `ordinal` mirrors the card's 1-based display position (bounded to
 * `MAX_SHOWN_RESULTS` — no card list this client could have shown
 * is ever longer); `campSiteId` matches `getCampDetail`/`checkAvailability`'s
 * own arg name + `card.id` (a real campsite id shape, uuid); `name` is
 * capped at `SHOWN_RESULT_NAME_MAX` (also the truncation length applied
 * again at the prompt-injection boundary, defense-in-depth). An
 * out-of-range/malformed entry fails HERE (400 `invalid_request`, before any
 * paid model call) — it never reaches the prompt (D2 security review point
 * 3).
 *
 * CAM-460 rework (Defect #2, owner domain correction 2026-07-24) — `priceLow`
 * is ADDITIVE and OPTIONAL (api.md rule 12: backward-compatible by addition):
 * an existing/older guest body that hasn't resent it still parses byte-
 * identically (no client sends `lastResults` at all yet — this wire is not
 * yet consumed by any shipped client). `null` = free (same "no price = free"
 * convention `AiChatCardResponse.priceLow` already uses); a number = the
 * STARTING/from price the guest's card displayed (never coerced from/to a
 * range or a per-spot price); absent = no price data for this entry, never
 * treated as 0/free.
 *
 * Security review nit (Suggestion, numeric bounds): a bare `z.number()`
 * accepts `Infinity`/`-Infinity` (JSON `1e999` overflows to `Infinity` on
 * parse), negative values, and `Number.MAX_VALUE`-class unsafe integers —
 * all of which interpolate raw into the prompt as e.g. `฿Infinity`/`฿-500`
 * via `formatStartingPriceSuffix` (`lib/ai/openrouter-client.ts`). Tightened
 * to `.finite().nonnegative().safe()`: rejects Infinity/NaN, rejects
 * negative, and rejects any integer beyond `Number.MAX_SAFE_INTEGER` — a
 * malformed entry fails HERE (400 `invalid_request`) instead of reaching the
 * prompt. `.nullable().optional()` unchanged — `null`/absent still mean
 * exactly what they meant before this tightening.
 */
export const shownResultSchema = z.object({
  ordinal: z.number().int().positive().max(MAX_SHOWN_RESULTS),
  campSiteId: z.string().uuid(),
  name: z.string().trim().min(1).max(SHOWN_RESULT_NAME_MAX),
  priceLow: z.number().finite().nonnegative().safe().nullable().optional(),
});

export type ShownResultWire = z.infer<typeof shownResultSchema>;

/**
 * BR-3: at most MAX_CHAT_MESSAGES messages, each role user|assistant, each
 * content at most MAX_CHAT_MESSAGE_LENGTH chars, and at least one `user`
 * message present (a conversation with only assistant turns is malformed —
 * there is nothing for the assistant to answer).
 *
 * CAM-460 (D2) — `lastResults` is ADDITIVE and OPTIONAL (api.md §12 —
 * backward-compatible by addition): every existing `{messages}` body matches
 * byte-identically with the field absent. Capped at
 * `MAX_SHOWN_RESULTS` entries (the same "single most-recent
 * search" bound the authed derive path is naturally bounded to already,
 * story.md BR-5).
 */
export const chatRequestSchema = z
  .object({
    messages: z.array(chatMessageSchema).min(1).max(MAX_CHAT_MESSAGES),
    lastResults: z.array(shownResultSchema).max(MAX_SHOWN_RESULTS).optional(),
  })
  .refine((body) => body.messages.some((message) => message.role === 'user'), {
    message: 'at least one user message is required',
  });

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/**
 * CAM-420 (ADR-013 D6) — the new persisted-conversation request shape.
 * Session-bound: the route requires an authenticated session for this
 * branch (401 without one) — this schema only bounds shape/size, never
 * identity. `conversationId` omitted -> the route creates a new
 * conversation; present -> the route resolves + ownership-checks it
 * (`lib/ai/conversation-store.loadWindow`), 404 if absent/not owned.
 */
export const chatRequestV2Schema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().max(MAX_CHAT_MESSAGE_LENGTH),
});

export type ChatRequestV2 = z.infer<typeof chatRequestV2Schema>;

/**
 * CAM-420 — the route's ONE input contract: a union tried legacy-FIRST so
 * `{messages}` (guest, stateless — CAM-271/415/416/417) keeps matching
 * byte-identically; `{conversationId?, message}` only ever matches a body
 * that has no `messages` key. The route narrows the parsed result with
 * `'messages' in parsed.data` (TypeScript narrows correctly on this key,
 * since the two shapes share no field name).
 */
export const chatRequestUnionSchema = z.union([chatRequestSchema, chatRequestV2Schema]);

export type ChatRequestUnion = z.infer<typeof chatRequestUnionSchema>;
