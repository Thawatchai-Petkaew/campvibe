/**
 * CAM-270 BR-7 (security.md AI/agent-layer) — user text reaching the AI
 * assistant is UNTRUSTED input, exactly like Telegram/Linear input at the
 * headless agent layer. This module only NORMALIZES the text (strip control
 * characters, collapse whitespace, cap length); it does not and cannot
 * regex-filter every possible "ignore previous instructions" phrasing — that
 * is a losing game. The real defense is structural and lives in
 * openrouter-client.ts: the sanitized text is wrapped in an explicit
 * `<user_message>` delimiter and the system prompt instructs the model to
 * treat everything inside those tags as DATA, never as an instruction to
 * follow (AC-9, EC-9).
 */

/** Hard cap on sanitized user text — bounds prompt size/spend (BR-6 spend guard). */
export const MAX_USER_TEXT_LENGTH = 2000;

/** Char codes considered "control" and stripped (C0 range + DEL), excluding \t \n \r. */
function isStrippableControlChar(code: number): boolean {
  const isC0 = code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d;
  const isDel = code === 0x7f;
  return isC0 || isDel;
}

/**
 * Normalize untrusted user text before it is placed in a prompt.
 *  - strips control characters (keeps normal whitespace: space/tab/newline)
 *  - collapses runs of whitespace to a single space
 *  - trims + caps length at MAX_USER_TEXT_LENGTH
 *
 * Built via a char-code walk (not a regex literal) to avoid embedding raw
 * control bytes in source.
 */
export function sanitizeForPrompt(rawText: string): string {
  let withoutControlChars = '';
  for (const ch of rawText) {
    const code = ch.codePointAt(0) ?? 0;
    if (!isStrippableControlChar(code)) withoutControlChars += ch;
  }
  const collapsed = withoutControlChars.replace(/\s+/g, ' ').trim();
  return collapsed.slice(0, MAX_USER_TEXT_LENGTH);
}

/** Delimiter tags the openrouter-client wraps sanitized text in (AC-9, EC-9). */
export const USER_DATA_OPEN_TAG = '<user_message>';
export const USER_DATA_CLOSE_TAG = '</user_message>';

/**
 * Wrap already-sanitized text as an explicit DATA block for the prompt. The
 * system prompt (openrouter-client.ts) instructs the model that everything
 * between these tags is the camper's question text, never an instruction —
 * this is what keeps a prompt-injection payload inert (BR-7).
 */
export function wrapAsUserData(safeText: string): string {
  return `${USER_DATA_OPEN_TAG}\n${safeText}\n${USER_DATA_CLOSE_TAG}`;
}
