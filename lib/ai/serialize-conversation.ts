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
 *
 * Functional-security fix (post-merge finding): zod (BR-3) alone allows up
 * to 10 messages x 2000 chars = 20000 chars, but `sanitizeForPrompt`'s
 * default cap is only `MAX_USER_TEXT_LENGTH` (2000) — applied to the WHOLE
 * serialized transcript, that would silently truncate FROM THE END, cutting
 * off the newest turn (the camper's current question) on any long thread.
 * The fix has two halves: (1) here, a transcript-level cap (
 * `MAX_PROMPT_CHARS`, larger than a single message) that drops whole OLDEST
 * messages — never slices mid-message — until the transcript fits, so the
 * newest turn always survives intact; (2) the caller (the chat route) must
 * pass `MAX_PROMPT_CHARS` as `runAssistantTurn`'s `maxPromptChars` override
 * so `sanitizeForPrompt` does not re-cut this already-bounded string back
 * down to the single-message default.
 */
import type { ChatMessage } from '@/lib/validations/ai-chat';

/**
 * Transcript-level cap for the serialized conversation. Deliberately larger
 * than a single message (`MAX_CHAT_MESSAGE_LENGTH` = 2000, `lib/validations/
 * ai-chat.ts`) so a multi-turn thread keeps real context, not just the
 * latest question in isolation.
 */
export const MAX_PROMPT_CHARS = 12000;

/**
 * Serialize the validated conversation into the single string
 * `runAssistantTurn` accepts. When the joined transcript exceeds
 * `MAX_PROMPT_CHARS`, the OLDEST messages are dropped whole (never
 * mid-message) until it fits — the newest turn always survives intact.
 * Since every message is already capped at `MAX_CHAT_MESSAGE_LENGTH` (zod,
 * BR-3), a single remaining line can never itself exceed `MAX_PROMPT_CHARS`,
 * so this always terminates with at least one line kept.
 */
export function serializeConversation(messages: ChatMessage[]): string {
  const lines = messages.map((message) => `${message.role}: ${message.content}`);
  while (lines.length > 1 && lines.join('\n').length > MAX_PROMPT_CHARS) {
    lines.shift();
  }
  return lines.join('\n');
}
