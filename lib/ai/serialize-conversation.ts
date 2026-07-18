/**
 * CAM-271 — traced-pipeline seam (Seams & refs, CAM-342 lesson): CAM-270's
 * `runAssistantTurn` accepts a SINGLE `userText` string, not a message array,
 * so the route reconciles the validated conversation array into one string
 * here before calling it.
 *
 * PO-ratified (AUTO mode, 2026-07-18): serialize the FULL capped conversation
 * in order, each turn labelled by role, so a follow-up question keeps the
 * earlier context (AC-2) — WITHOUT changing runAssistantTurn's signature and
 * WITHOUT a multi-turn agent loop (still exactly one tool-call round). The
 * whole transcript enters runAssistantTurn's single `<user_message>` DATA
 * block (lib/ai/sanitize.ts), so the assistant's own prior replies are also
 * treated as untrusted DATA there — safe, and consistent with BR-7.
 */
import type { ChatMessage } from '@/lib/validations/ai-chat';

/** Serialize the validated conversation into the single string `runAssistantTurn` accepts. */
export function serializeConversation(messages: ChatMessage[]): string {
  return messages.map((message) => `${message.role}: ${message.content}`).join('\n');
}
