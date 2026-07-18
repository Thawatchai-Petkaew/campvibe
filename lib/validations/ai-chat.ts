/**
 * CAM-271 BR-3 — zod boundary for the posted conversation array reaching
 * `POST /api/ai/chat`. Any breach (more than MAX_CHAT_MESSAGES messages, a
 * message longer than MAX_CHAT_MESSAGE_LENGTH characters, a role other than
 * user/assistant, no user message present, or a malformed body) is rejected
 * with 400 `invalid_request` BEFORE any model/tool call runs — this bounds
 * prompt size + spend and caps client-controlled input before the paid call
 * (security.md CAM-344: never trust a client-controlled iteration/size).
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
