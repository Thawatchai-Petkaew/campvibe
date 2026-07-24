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

/**
 * Security fix (live repro, Important): a SINGLE `.replace()` pass of
 * `DELIMITER_TAG_REGEX` can leave NESTED/OVERLAPPING fragments behind that
 * only became a "complete tag" because an earlier match in the SAME pass
 * consumed an interleaving piece — e.g. `</user_message</user_message>>`:
 * the regex (leftmost-match, one pass) pairs the SECOND `<`/`/` with the
 * FIRST subsequent `>`, stripping `</user_message>` and leaving
 * `</user_message >` behind — itself a valid (whitespace-tolerant) close
 * tag the single pass never re-checks. Loop the same replace to a FIXPOINT
 * (until the string stops changing) so every layer gets a fresh scan;
 * bounded so a pathological, deeply-nested input can never spin
 * unboundedly.
 */
const MAX_DELIMITER_STRIP_ITERATIONS = 10;

function stripDelimiterTagsToFixpoint(text: string): string {
  let current = text;
  for (let i = 0; i < MAX_DELIMITER_STRIP_ITERATIONS; i++) {
    const next = current.replace(DELIMITER_TAG_REGEX, ' ');
    if (next === current) return next;
    current = next;
  }
  return current;
}

/**
 * Final hard-strip backstop (defense-in-depth beyond the fixpoint loop
 * above): matches the delimiter's OPENING half alone — `<` + optional `/` +
 * the tag name — with NO requirement for a closing `>`. This is what
 * guarantees the security invariant (no `<user_message`/`</user_message`
 * prefix survives in ANY form) even in the theoretical case the bounded
 * loop above is exhausted before reaching a true fixpoint (e.g. an
 * artificially deep nesting attack): every real occurrence of the literal
 * tag NAME immediately preceded by `<` (mod whitespace/slash) is removed
 * outright, so it can never be re-paired with a stray leftover `>` into a
 * reconstructed tag downstream. Deliberately does NOT touch a bare
 * unrelated `<`/`>` (e.g. `<b>bold</b>`) since it requires the literal tag
 * name to match.
 */
const DELIMITER_TAG_PREFIX_REGEX = new RegExp(`<\\s*/?\\s*${USER_DATA_TAG_NAME}`, 'gi');

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
 *  - strips any literal delimiter-tag occurrence to a FIXPOINT (open or
 *    close, case-insensitive, bounded loop) — defense-in-depth against a
 *    forged closing tag AND against nested/overlapping fragments that only
 *    become a complete tag once an earlier match is removed
 *  - collapses runs of whitespace to a single space (BEFORE the final
 *    hard-strip pass, so a whitespace-variant reconstruction is normalized
 *    and caught)
 *  - a final hard-strip pass removes any still-remaining opening-half
 *    fragment (`<user_message`/`</user_message`, no closing `>` required)
 *  - collapses whitespace once more + trims + caps length at `maxLength`
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
  // step normalizes any doubled spaces this introduces. Looped to a
  // FIXPOINT (bounded) — see stripDelimiterTagsToFixpoint's docblock for the
  // nested/overlapping-fragment bug a single pass left behind.
  const withoutDelimiterTags = stripDelimiterTagsToFixpoint(withoutControlChars);
  const collapsedFirst = withoutDelimiterTags.replace(/\s+/g, ' ').trim();
  // Final hard-strip backstop (defense-in-depth): remove any remaining
  // opening-half fragment outright, regardless of a closing bracket.
  const hardStripped = collapsedFirst.replace(DELIMITER_TAG_PREFIX_REGEX, ' ');
  const collapsed = hardStripped.replace(/\s+/g, ' ').trim();
  return collapsed.slice(0, maxLength);
}

/**
 * The newline-preserving sibling of `sanitizeForPrompt`'s
 * `.replace(/\s+/g, ' ').trim()` step: collapses runs of HORIZONTAL
 * whitespace (space/tab/CR/...) to a single space and trims each line, but
 * never touches `\n` itself — a prompt string has no rendering concept so
 * `sanitizeForPrompt` flattens everything to one line; `sanitizeAnswerForStore`
 * below needs the opposite for a value that gets re-rendered as multi-line
 * structure.
 */
function collapseHorizontalWhitespace(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .trim();
}

/**
 * CAM-445 (R3 owner feedback) — same untrusted-input guarantees as
 * `sanitizeForPrompt` (control-char strip, `<user_message>` delimiter
 * fixpoint strip + hard-strip backstop, length cap) but PRESERVES `\n` as a
 * structural line break instead of collapsing it into a single space.
 *
 * `sanitizeForPrompt` deliberately flattens the whole string to one line —
 * correct for a prompt (no rendering concept exists there) — but the
 * assistant's ANSWER is stored verbatim and later re-rendered through
 * `parseAnswer` (components/ai-chat/answer-format.ts), which splits the
 * stored text on `\n` to rebuild ordered/unordered lists and paragraph
 * breaks when a persisted conversation is reopened. Storing the flattened,
 * single-line answer silently destroyed that structure on resume (R3 owner
 * feedback, CAM-445): headers/lists rendered as one run-on paragraph and the
 * assistant's structured formatting was gone.
 *
 * SECURITY (unchanged invariant, security.md AI/agent-layer): the stored
 * answer is re-fed to the model as history on the NEXT turn
 * (`conversation-store.loadWindow` -> route.ts's `toChatMessages` ->
 * `buildTurnMessages`), so it must stay exactly as injection-safe as
 * `sanitizeForPrompt` — only the newline-collapse step is relaxed to a
 * per-line collapse (`collapseHorizontalWhitespace`); every other guard
 * (control-char strip, delimiter fixpoint + hard-strip backstop, length cap)
 * runs unchanged, in the same order.
 */
export function sanitizeAnswerForStore(rawText: string, maxLength: number = MAX_USER_TEXT_LENGTH): string {
  const withoutControlChars = stripControlChars(rawText);
  const withoutDelimiterTags = stripDelimiterTagsToFixpoint(withoutControlChars);
  const collapsedFirst = collapseHorizontalWhitespace(withoutDelimiterTags);
  // Final hard-strip backstop (defense-in-depth): remove any remaining
  // opening-half fragment outright, regardless of a closing bracket.
  const hardStripped = collapsedFirst.replace(DELIMITER_TAG_PREFIX_REGEX, ' ');
  const collapsed = collapseHorizontalWhitespace(hardStripped);
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

/**
 * CAM-460 rework (BE fix, Defect #1 — QA independent-verify, Important,
 * cam-460-conversation-state.test.ts "[DEFECT]" case): `HTML_TAG_REGEX`
 * requires a literal closing `>` to match at all, so an UNCLOSED forged
 * fragment (no `>` anywhere in the string, e.g. `</shown_results` or
 * `<user_message`) survives it untouched. That gap is exploitable here
 * specifically because `sanitizeShownResultName`'s output is embedded inside
 * the `<shown_results>...</shown_results>` fence (`lib/ai/openrouter-client.ts`
 * `buildShownResultsBlock`) immediately BEFORE the block's own real closing
 * tag — an unclosed `</shown_results` fragment can "borrow" the `>` off that
 * real tag and read, to the model, as an early/ambiguous close.
 *
 * Mirrors `DELIMITER_TAG_PREFIX_REGEX`'s proven pattern above (open/close,
 * optional whitespace, NO closing `>` required) but is deliberately
 * GENERALIZED from one fixed tag-name literal to any tag-name-shaped token —
 * unlike `sanitizeForPrompt` (which only ever needs to guard the ONE
 * `user_message` delimiter; other angle-bracket text in free user text is
 * legitimate), this function's own contract above is broader: "a shown-result
 * name has no legitimate reason to carry ANY tag-like markup at all". The
 * value is also embedded in a DIFFERENT fence (`shown_results`, not
 * `user_message`) than `DELIMITER_TAG_PREFIX_REGEX` targets, so reusing that
 * constant verbatim would close only the `<user_message` half of the gap and
 * leave an unclosed `</shown_results` fragment live. `HTML_TAG_REGEX` above
 * already strips ANY closed tag regardless of name; this is its unclosed-tag
 * sibling, kept equally name-agnostic for the same reason.
 */
const UNCLOSED_TAG_PREFIX_REGEX = /<\s*\/?\s*[a-zA-Z][\w-]*/g;

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

/**
 * CAM-460 (D2 security review point 2) — sanitizes a campsite NAME reaching
 * the system prompt inside the `<shown_results>` DATA fence
 * (`lib/ai/openrouter-client.ts`), from EITHER path: the authed derive's own
 * DB `nameTh` (defense-in-depth) or a guest's client-resent
 * `lastResults[].name` (genuinely untrusted — the client controls this
 * string). `sanitizeForPrompt` deliberately only strips the ONE
 * `<user_message>` delimiter (a camper's free-text question may legitimately
 * contain other angle-bracket text) — that is NOT enough here: a shown-result
 * name has no legitimate reason to carry ANY tag-like markup, and without
 * stripping every tag, a forged `</shown_results>` inside `name` could escape
 * the fence. Reuses the SAME "strip any `<...>` tag" idiom `sanitizeSuggestion`
 * already applies to model output (`HTML_TAG_REGEX`) — never a parallel
 * sanitizer. Unlike `sanitizeSuggestion`, never returns null/drops the value
 * (this is defense-in-depth; the real bound is zod at the wire boundary,
 * `lib/validations/ai-chat.ts`) — truncates at `maxLength`, the same
 * never-reject convention `sanitizeForPrompt` uses.
 *
 * CAM-460 rework (BE fix, Defect #1) — after the closed-tag pass + whitespace
 * collapse, a final hard-strip pass (`UNCLOSED_TAG_PREFIX_REGEX`) removes any
 * still-remaining UNCLOSED opening-half tag fragment (no closing `>` required)
 * of ANY tag name, mirroring `sanitizeForPrompt`'s `DELIMITER_TAG_PREFIX_REGEX`
 * backstop but generalized (see that constant's docblock above for why one
 * fixed tag-name literal is not enough here).
 */
export function sanitizeShownResultName(rawText: string, maxLength: number): string {
  const withoutControlChars = stripControlChars(rawText);
  const withoutTags = withoutControlChars.replace(HTML_TAG_REGEX, ' ');
  const collapsedFirst = withoutTags.replace(/\s+/g, ' ').trim();
  // Final hard-strip backstop (defense-in-depth): remove any remaining
  // unclosed opening-half tag fragment outright, regardless of tag name.
  const hardStripped = collapsedFirst.replace(UNCLOSED_TAG_PREFIX_REGEX, ' ');
  const collapsed = hardStripped.replace(/\s+/g, ' ').trim();
  return collapsed.slice(0, maxLength);
}
