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
 * @param maxLength — CAM-271 additive override (default `MAX_USER_TEXT_LENGTH`,
 * unchanged for every existing/default caller). The multi-turn transcript
 * path (`lib/ai/serialize-conversation.ts`, via `runAssistantTurn`'s
 * `maxPromptChars` option) already bounds its OWN string at a larger cap
 * (`MAX_PROMPT_CHARS`) by dropping whole oldest messages — that string must
 * pass through here unchanged, not get re-cut to the single-message limit
 * (which would silently drop the newest turn, breaking multi-turn context).
 */
export function sanitizeForPrompt(rawText: string, maxLength: number = MAX_USER_TEXT_LENGTH): string {
  let withoutControlChars = '';
  for (const ch of rawText) {
    const code = ch.codePointAt(0) ?? 0;
    if (!isStrippableControlChar(code)) withoutControlChars += ch;
  }
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
