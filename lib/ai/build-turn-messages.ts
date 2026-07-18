/**
 * CAM-415 — replaces lib/ai/serialize-conversation.ts (CAM-271/CAM-342
 * "traced-pipeline seam"). The old module flattened the WHOLE capped
 * conversation into a single labelled string (`user: ...\nassistant: ...`)
 * that entered `runAssistantTurn` as ONE `<user_message>` DATA block — the
 * assistant's own prior replies rode along as untrusted text inside that one
 * block, and a single sanitize/wrap pass covered the whole transcript.
 *
 * This module instead builds a REAL multi-turn messages array: every turn
 * keeps its own role, and every USER message (history + current) is
 * individually `sanitizeForPrompt`-ed and wrapped in its own `<user_message>`
 * DATA tags (lib/ai/sanitize.ts) — per-message injection fencing, not one
 * fence around the whole thread. Assistant history re-enters as plain
 * assistant-role content, re-sanitized on load (defense-in-depth: a forged
 * delimiter tag smuggled into an earlier assistant turn — e.g. if a future
 * tool ever wrote attacker-influenced text — is stripped the same way user
 * text is, even though assistant content is never wrapped as DATA itself).
 *
 * `runAssistantTurnFromMessages` (lib/ai/openrouter-client.ts) sends this
 * array straight through as `[system, ...turnMessages]` — the "messages
 * array in" half of the seam CAM-415 leaves for CAM-415b's agent loop, which
 * will append assistant(tool_calls)/tool messages onto the SAME array shape
 * ("messages array out").
 */
import { sanitizeForPrompt, wrapAsUserData } from '@/lib/ai/sanitize';
import type { ChatMessage } from '@/lib/validations/ai-chat';

/**
 * Transcript-level budget across the WHOLE turn (history + current),
 * unchanged value from CAM-271. Deliberately larger than one message
 * (`MAX_CHAT_MESSAGE_LENGTH` = 2000, `lib/validations/ai-chat.ts`) so a
 * multi-turn thread keeps real context, not just the latest question in
 * isolation.
 */
export const MAX_PROMPT_CHARS = 12000;

export interface TurnMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Sum of raw (pre-sanitize) message content lengths — the budget CAM-415 measures the cap against, one per-message content at a time rather than one joined string. */
function totalContentLength(messages: ChatMessage[]): number {
  return messages.reduce((sum, message) => sum + message.content.length, 0);
}

/**
 * Build the real multi-turn messages array `runAssistantTurnFromMessages`
 * sends to the model (system prompt prepended separately). When the total
 * content length exceeds `MAX_PROMPT_CHARS`, the OLDEST messages are dropped
 * WHOLE (never mid-message) until it fits — the newest turn always survives
 * intact. Since every message is already capped at `MAX_CHAT_MESSAGE_LENGTH`
 * (zod, BR-3 of CAM-271) — which equals `sanitizeForPrompt`'s own default
 * per-message cap (`MAX_USER_TEXT_LENGTH`, both 2000) — a single remaining
 * message can never itself exceed `MAX_PROMPT_CHARS` nor get re-truncated by
 * `sanitizeForPrompt`'s default cap: this is what makes CAM-271's
 * flattened-transcript truncation bug ("the newest turn silently lost")
 * structurally impossible here, not just guarded by an override the caller
 * has to remember to pass.
 */
export function buildTurnMessages(messages: ChatMessage[]): TurnMessage[] {
  const kept = messages.slice();
  while (kept.length > 1 && totalContentLength(kept) > MAX_PROMPT_CHARS) {
    kept.shift();
  }

  return kept.map((message): TurnMessage => {
    if (message.role === 'user') {
      // Per-message injection fencing (AC-9/EC-9 lineage): sanitize, then
      // wrap as an explicit DATA block, exactly like the single-turn path.
      return { role: 'user', content: wrapAsUserData(sanitizeForPrompt(message.content)) };
    }
    // Assistant history re-enters as plain assistant-role content —
    // re-sanitized (control chars + any forged delimiter tag stripped) but
    // never wrapped in <user_message> tags, since it was never camper data.
    return { role: 'assistant', content: sanitizeForPrompt(message.content) };
  });
}
