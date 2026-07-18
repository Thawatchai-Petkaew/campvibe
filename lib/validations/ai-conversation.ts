/**
 * lib/validations/ai-conversation.ts — CAM-421 (ADR-013 S7).
 *
 * zod boundary for the `[id]` path param reaching
 * `GET /api/ai/conversations/[id]` and `DELETE /api/ai/conversations/[id]`.
 * `ChatConversation.id` is a Prisma `@id @default(uuid())` — a non-UUID
 * segment fails here with 400 BEFORE any Prisma query runs (api.md #1:
 * validate at the boundary; never let a malformed id reach the DB layer).
 */
import { z } from 'zod';

export const conversationIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type ConversationIdParam = z.infer<typeof conversationIdParamSchema>;
