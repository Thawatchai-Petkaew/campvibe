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
 */
import { z } from 'zod';

/** BR-3 cap — at most this many messages in one posted conversation. */
export const MAX_CHAT_MESSAGES = 10;
/** BR-3 cap — at most this many characters per message. */
export const MAX_CHAT_MESSAGE_LENGTH = 2000;

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(MAX_CHAT_MESSAGE_LENGTH),
});

/**
 * BR-3: at most MAX_CHAT_MESSAGES messages, each role user|assistant, each
 * content at most MAX_CHAT_MESSAGE_LENGTH chars, and at least one `user`
 * message present (a conversation with only assistant turns is malformed —
 * there is nothing for the assistant to answer).
 */
export const chatRequestSchema = z
  .object({
    messages: z.array(chatMessageSchema).min(1).max(MAX_CHAT_MESSAGES),
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
