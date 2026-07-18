/**
 * CAM-270 BR-7 (security.md AI/agent-layer) — user text reaching the AI
 * assistant is UNTRUSTED input, exactly like Telegram/Linear input at the
 * headless agent layer. This module only NORMALIZES the text (strip control
 * characters, strip forged delimiter tags, collapse whitespace, cap length);
 * it does not and cannot regex-filter every possible "ignore previous
 * instructions" phrasing — that is a losing game. The real defense is
 * structural and lives in openrouter-client.ts: the sanitized text is wrapped
 * in an explicit `<user_message>` delimiter and the system prompt instructs
 * the model to treat everything inside those tags as DATA, never as an
 * instruction to follow (AC-9, EC-9).
 */

/** Hard cap on sanitized user text — bounds prompt size/spend (BR-6 spend guard). */
export const MAX_USER_TEXT_LENGTH = 2000;

/** Tag name used for the DATA delimiter (openrouter-client.ts wraps sanitized text in `<TAG>...</TAG>`). */
const USER_DATA_TAG_NAME = 'user_message';

/** Delimiter tags the openrouter-client wraps sanitized text in (AC-9, EC-9). */
export const USER_DATA_OPEN_TAG = `<${USER_DATA_TAG_NAME}>`;
export const USER_DATA_CLOSE_TAG = `</${USER_DATA_TAG_NAME}>`;

/**
 * Security review nit (defense-in-depth): matches a literal occurrence of the
 * open OR close delimiter tag anywhere in untrusted user text — case-
 * insensitive, tolerant of stray whitespace inside the tag (e.g.
 * `</ USER_MESSAGE >`) — so a payload cannot forge a fake closing tag and
 * "escape" the `<user_message>` DATA boundary before the real wrapper is
 * applied in openrouter-client.ts.
 */
const DELIMITER_TAG_REGEX = new RegExp(`<\\s*/?\\s*${USER_DATA_TAG_NAME}\\s*>`, 'gi');

/** Char codes considered "control" and stripped (C0 range + DEL), excluding \t \n \r. */
function isStrippableControlChar(code: number): boolean {
  const isC0 = code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d;
  const isDel = code === 0x7f;
  return isC0 || isDel;
}

/**
 * Char-code walk shared by every sanitizer in this module (CAM-410 Seams &
 * refs: "extend/reuse the sanitize idiom, do not hand-roll a second
 * sanitizer") — strips control characters, keeping normal whitespace intact.
 */
function stripControlChars(rawText: string): string {
  let out = '';
  for (const ch of rawText) {
    const code = ch.codePointAt(0) ?? 0;
    if (!isStrippableControlChar(code)) out += ch;
  }
  return out;
}

/**
 * Normalize untrusted user text before it is placed in a prompt.
 *  - strips control characters (keeps normal whitespace: space/tab/newline)
 *  - strips any literal delimiter-tag occurrence (open or close, case-
 *    insensitive) — defense-in-depth against a forged closing tag
 *  - collapses runs of whitespace to a single space
 *  - trims + caps length at `maxLength`
 *
 * Built via a char-code walk (not a regex literal) to avoid embedding raw
 * control bytes in source.
 *
 * @param maxLength — optional per-call override (default `MAX_USER_TEXT_LENGTH`).
 * CAM-415 update: the multi-turn path (`lib/ai/build-turn-messages.ts`)
 * no longer needs this override — it sanitizes each message INDIVIDUALLY,
 * and every message is already capped at `MAX_CHAT_MESSAGE_LENGTH` (zod,
 * `lib/validations/ai-chat.ts`), which equals `MAX_USER_TEXT_LENGTH` (both
 * 2000) — so the default cap never re-truncates a real message. (Superseded
 * the CAM-271 transcript-level `maxPromptChars` override, which existed only
 * because that era flattened the whole conversation into one string first.)
 */
export function sanitizeForPrompt(rawText: string, maxLength: number = MAX_USER_TEXT_LENGTH): string {
  const withoutControlChars = stripControlChars(rawText);
  // Replace (not delete) so "hello</user_message>world" stays two words,
  // not one glued-together "helloworld" — the subsequent whitespace-collapse
  // step normalizes any doubled spaces this introduces.
  const withoutDelimiterTags = withoutControlChars.replace(DELIMITER_TAG_REGEX, ' ');
  const collapsed = withoutDelimiterTags.replace(/\s+/g, ' ').trim();
  return collapsed.slice(0, maxLength);
}

/**
 * Wrap already-sanitized text as an explicit DATA block for the prompt. The
 * system prompt (openrouter-client.ts) instructs the model that everything
 * between these tags is the camper's question text, never an instruction —
 * this is what keeps a prompt-injection payload inert (BR-7). Safe to call
 * with the output of sanitizeForPrompt: any literal tag occurrence has
 * already been stripped, so the wrapper's own tags are always the ONLY
 * `<user_message>`/`</user_message>` markers present in the final string.
 */
export function wrapAsUserData(safeText: string): string {
  return `${USER_DATA_OPEN_TAG}\n${safeText}\n${USER_DATA_CLOSE_TAG}`;
}

/**
 * CAM-410 BR-2/BR-3 — a follow-up-question suggestion is MODEL output and
 * therefore UNTRUSTED (security.md §6 AI/LLM), exactly like the camper's own
 * text. Unlike `sanitizeForPrompt` (which deliberately leaves unrelated
 * HTML-like text alone — it only strips the `<user_message>` delimiter), a
 * suggestion becomes a rendered UI chip, so it must be inert PLAIN TEXT: this
 * strips ALL angle-bracket tags (covers a forged `<user_message>`/
 * `<suggestions>` delimiter too) plus common markdown syntax markers, reusing
 * the shared control-char walk (no parallel sanitizer).
 *
 * Returns `null` when the sanitized result is blank or exceeds
 * `MAX_SUGGESTION_LENGTH` — BR-2 drops it rather than truncating mid-word.
 */
export const MAX_SUGGESTION_LENGTH = 60;

/** Matches any `<...>` tag (HTML or a forged delimiter) — replaced with a space, never deleted, so words don't glue together. */
const HTML_TAG_REGEX = /<[^>]*>/g;

/** Common markdown syntax markers (bold/italic/inline-code/heading/bullet/numbered-list) — stripped, the underlying words are kept. */
const MARKDOWN_SYNTAX_REGEX = /(\*\*|__|\*|_|`+|^#{1,6}\s*|^[-*+]\s+|^\d+\.\s+)/gm;

export function sanitizeSuggestion(rawText: string): string | null {
  const withoutControlChars = stripControlChars(rawText);
  const withoutTags = withoutControlChars.replace(HTML_TAG_REGEX, ' ');
  const withoutMarkdown = withoutTags.replace(MARKDOWN_SYNTAX_REGEX, '');
  const collapsed = withoutMarkdown.replace(/\s+/g, ' ').trim();
  if (collapsed.length === 0 || collapsed.length > MAX_SUGGESTION_LENGTH) return null;
  return collapsed;
}
