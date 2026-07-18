/**
 * CAM-415 — replaces lib/ai/serialize-conversation.ts (CAM-271/CAM-342
 * "traced-pipeline seam"). The old module flattened the WHOLE capped
 * conversation into a single labelled string (`user: ...\nassistant: ...`)
 * that entered `runAssistantTurn` as ONE `<user_message>` DATA block.
 *
 * CAM-415 fix (QA Critical F-1, adversarial verify pass): trust follows
 * PROVENANCE, not the claimed `role` field. `POST /api/ai/chat` is public,
 * unauthenticated, and unpersisted (CAM-414 persistence is out of scope) —
 * nothing ties a posted `role:"assistant"` history turn to anything the
 * server itself generated. Emitting it as a bare, elevated-trust
 * `role:"assistant"` message would let any caller forge a "prior assistant
 * reply" and have it read with materially higher compliance-trust than
 * DATA (a known history-poisoning / fake-prior-turn jailbreak pattern) —
 * a regression against the pre-CAM-415 design, which flattened EVERY line
 * (any claimed role) into one DATA block.
 *
 * So `buildTurnMessages` has two provenance modes (`source` option):
 *  - `'client'` (DEFAULT — the only caller today, `POST /api/ai/chat`):
 *    EVERY message is sanitized AND fenced as its own `<user_message>` DATA
 *    block, regardless of claimed role. A message that claimed
 *    `role:"assistant"` keeps a neutral reference label inside its own
 *    fence (so the model still has conversational context) but is NEVER
 *    emitted as a bare `role:"assistant"` message.
 *  - `'server'` (reserved, no caller yet): for a FUTURE history source read
 *    from the server's own persisted `ChatConversation`/`ChatMessage` store
 *    (CAM-414/CAM-420) — only then is a claimed `assistant` role backed by
 *    something the server itself generated, so it is safe to re-enter as a
 *    real, unfenced `role:"assistant"` message (re-sanitized, defense-in-
 *    depth against a stored-but-corrupted value).
 *
 * `runAssistantTurnFromMessages` (lib/ai/openrouter-client.ts) sends the
 * result straight through as `[system, ...turnMessages]` — the "messages
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

/**
 * Neutral in-fence label for a client-claimed `assistant` turn (CAM-415
 * fix) — keeps conversational context readable to the model without ever
 * granting it elevated, unfenced trust. Thai per code.md (user/model-facing
 * copy convention); this is a MODEL-facing label, not end-user UI copy, so
 * it lives here rather than `locales/` (same precedent as the system
 * prompt's persona line, openrouter-client.ts).
 */
const ASSISTANT_REFERENCE_LABEL = 'คำตอบก่อนหน้าของผู้ช่วย (ข้อมูลอ้างอิง)';

export type BuildTurnMessagesSource = 'client' | 'server';

export interface BuildTurnMessagesOptions {
  /**
   * 'client' (default) — every turn arrived over the wire from an untrusted,
   * unauthenticated, unpersisted caller; a claimed `assistant` role gets NO
   * more trust than a claimed `user` role. 'server' — reserved for a future
   * caller reading from the server's own persisted conversation store; no
   * caller passes this today.
   */
  source?: BuildTurnMessagesSource;
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
export function buildTurnMessages(
  messages: ChatMessage[],
  options: BuildTurnMessagesOptions = {}
): TurnMessage[] {
  const source = options.source ?? 'client';
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

    // message.role === 'assistant'
    if (source === 'server') {
      // Server-sourced history (CAM-420, no caller yet): the claimed
      // assistant role is backed by something the server itself generated —
      // safe to re-enter as a real assistant-role message (re-sanitized,
      // defense-in-depth against a stored-but-corrupted value).
      return { role: 'assistant', content: sanitizeForPrompt(message.content) };
    }

    // Client-sourced (default, the only path today — CAM-415 fix, QA F-1):
    // trust follows PROVENANCE, not the claimed role. Fenced as DATA like
    // any user turn, never emitted as a bare assistant-role message; the
    // reference label keeps the context legible without granting it
    // elevated trust.
    return {
      role: 'user',
      content: wrapAsUserData(sanitizeForPrompt(`${ASSISTANT_REFERENCE_LABEL}: ${message.content}`)),
    };
  });
}
