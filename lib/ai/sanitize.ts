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
 * CAM-471 BR-2 (primary mechanism) — the interstitial-junk zone between "<"
 * (optionally "/") and the literal tag name. This used to be `\s*` (stray
 * WHITESPACE only), which a near-miss forged tag defeats with ANY other
 * junk character sitting right after "<": an ASCII digit
 * (`<9user_message>`) or a combining mark (`<́user_message>`) is not
 * `\s`, so the character class failed to match at all and the tag-name
 * match never even started — the entire forged fragment survived untouched
 * (same defect shape as CAM-460 Defect #3, a different regex/field).
 *
 * Fix: widen the junk zone to "any run of characters that are NEITHER a
 * Unicode letter (`\p{L}`) NOR the tag's own closing character (`>`)" —
 * deliberately un-enumerated (no per-codepoint whack-a-mole). It covers
 * whitespace, ASCII/Unicode digits, zero-width/format codepoints,
 * combining marks, underscores, slashes, punctuation — anything that
 * isn't literally spelling out a DIFFERENT word right where the tag name
 * must start. A bare "<"/">" still never matches: the literal tag name
 * (`user_message`) is still required immediately after the junk run, so
 * free camper text with an unrelated "<"/">" (e.g. "<2000 บาท", "<b>")
 * never trips this — the run stops the instant it hits a REAL letter that
 * isn't part of the tag name itself (AC-4/EC-5).
 */
const DELIMITER_JUNK = '[^>\\p{L}]*';

/**
 * Security review nit (defense-in-depth): matches a literal occurrence of the
 * open OR close delimiter tag anywhere in untrusted user text — case-
 * insensitive, tolerant of stray junk inside the tag (whitespace, digits,
 * zero-width/format codepoints, combining marks — e.g. `</ USER_MESSAGE >`,
 * `</9user_message>`, `<​user_message>`) — so a payload cannot forge a
 * fake closing tag and "escape" the `<user_message>` DATA boundary before
 * the real wrapper is applied in openrouter-client.ts.
 */
const DELIMITER_TAG_REGEX = new RegExp(`<${DELIMITER_JUNK}${USER_DATA_TAG_NAME}${DELIMITER_JUNK}>`, 'giu');

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
 * tag NAME immediately preceded by `<` (mod the BR-2 junk zone — whitespace,
 * slash, digit, zero-width/format codepoint, combining mark, ...) is removed
 * outright, so it can never be re-paired with a stray leftover `>` into a
 * reconstructed tag downstream. Deliberately does NOT touch a bare
 * unrelated `<`/`>` (e.g. `<b>bold</b>`) since it requires the literal tag
 * name to match.
 */
const DELIMITER_TAG_PREFIX_REGEX = new RegExp(`<${DELIMITER_JUNK}${USER_DATA_TAG_NAME}`, 'giu');

/**
 * CAM-471 BR-3 (complementary hardening) — matches any codepoint in Unicode
 * category C (`Cc` control, `Cf` format/zero-width, `Co` private-use, `Cs`
 * surrogate, `Cn` unassigned), EXCEPT `\t` `\n` `\r` (excluded via the
 * leading negative lookahead — those three ARE technically `Cc` but are
 * legitimate whitespace this module always keeps).
 *
 * `Cc` alone is exactly the original C0 range + DEL + the full C1 range
 * (U+0080-U+009F) — the CAM-460 defect #4 fix (NEL, other C1 codepoints)
 * is preserved unchanged by folding into this single category test.
 *
 * `Cf` is the NEW coverage this rule adds: zero-width/format codepoints
 * (U+200B ZERO WIDTH SPACE, U+200C ZWNJ, U+200D ZWJ, U+FEFF BOM, bidi
 * control marks, ...) that `\s` does NOT match and that used to defeat the
 * DELIMITER_TAG_REGEX/DELIMITER_TAG_PREFIX_REGEX character-class match by
 * surviving all the way to the tag-match step. Stripping them HERE, at the
 * very front of the shared char walk, closes the vector at the source for
 * every caller (`sanitizeForPrompt`, `sanitizeAnswerForStore`, and
 * defense-in-depth for `sanitizeSuggestion`/`sanitizeShownResultName`).
 *
 * Deliberately does NOT touch a lone combining mark (`\p{M}`, e.g. U+0301):
 * a combining mark is not `\p{C}` (EC-3) — that vector is closed by BR-2's
 * tolerant delimiter match instead, not here. This is intentional: a
 * combining mark can legitimately decorate real text (accented Latin, Thai
 * tone marks), so this pass must not strip it as if it were invisible junk.
 *
 * NFKC-normalize is deliberately NOT run ahead of this strip — see
 * `stripControlChars`'s docblock below for the proven Thai-text regression
 * (SARA AM decomposition) that ruled it out.
 */
const INVISIBLE_OR_CONTROL_REGEX = /(?![\t\n\r])[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Cn}]/gu;

/**
 * Char-code walk shared by every sanitizer in this module (CAM-410 Seams &
 * refs: "extend/reuse the sanitize idiom, do not hand-roll a second
 * sanitizer") — strips control/invisible characters, keeping normal
 * whitespace intact.
 *
 * CAM-471 BR-3 deviation (documented, flagged to the owner — see the PR/
 * handoff `needs_decision`): the story's BR-3 text specifies an NFKC-
 * normalize pre-pass. A REAL end-to-end probe against this exact codebase
 * proved `'น้ำ'.normalize('NFKC')` silently rewrites U+0E33 THAI CHARACTER
 * SARA AM into the decomposed U+0E4D U+0E32 pair — a DIFFERENT byte
 * sequence than the camper typed, and NOT reversible by a follow-up NFC
 * pass (SARA AM's decomposition is `<compat>`, not canonical, so
 * composition never folds it back). This silently corrupts an enormous
 * fraction of ordinary Thai text (น้ำ, ทำ, จำ, สำหรับ, กำลัง, ประจำ, ...) —
 * exactly the "no over-strip regression" invariant AC-4/EC-5 protect, and
 * the existing CAM-460 regression suite caught it immediately (a plain Thai
 * camp-name fixture failed byte-for-byte). NFKC in this story exists ONLY
 * as a partial mitigation for an explicitly OUT-OF-SCOPE concern (homoglyph
 * substitution of the tag letters themselves — see story.md "Out of
 * scope"); it is not required by ANY in-scope AC/EC (BR-2's tolerant
 * delimiter match + the Cf/invisible strip below fully close AC-1..AC-5/
 * EC-1..EC-6 without it — verified in `__tests__/cam-471-*`). Given a
 * proven, severe product regression vs. an already-deferred, partial,
 * out-of-scope benefit, this implementation OMITS the NFKC pre-pass and
 * keeps only the invisible/control strip. Flagged for owner ratification;
 * revert this note + add NFKC back if the owner overrides.
 */
function stripControlChars(rawText: string): string {
  return rawText.replace(INVISIBLE_OR_CONTROL_REGEX, '');
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
 *
 * CAM-460 Defect #3 (QA independent re-verify of the Defect #1 rework,
 * Important) — `UNCLOSED_TAG_PREFIX_REGEX` still requires a literal
 * `[a-zA-Z]` immediately after `<` (mod its own `\s*`/`/`/`\s*` prefix zone);
 * a character that is NOT an ASCII letter there — a plain digit
 * (`</9shown_results`) or an invisible zero-width codepoint (U+200B, which
 * `\s` does NOT match) — makes the WHOLE match attempt fail, so the entire
 * fragment (including the literal `<`) survives untouched. This is the same
 * exploit shape as Defect #1: another regex requiring a specific character
 * class right after `<`. Patching the character class again (allow digits,
 * allow U+200B/U+200C/U+200D/U+FEFF, ...) is regex whack-a-mole — the next
 * unlisted invisible/combining codepoint reopens the same gap.
 *
 * DURABLE FIX (owner-aligned, ends the whack-a-mole for this field): after
 * every pass above, strip every literal `<` and `>` CHARACTER outright, then
 * re-collapse whitespace. A campsite NAME has no legitimate reason to carry
 * an angle bracket at all — removing the delimiter characters themselves
 * makes ANY tag-shaped forgery structurally impossible, because there is no
 * longer a `<`/`>` in the string for a regex to match (or fail to match) in
 * the first place. This also structurally closes the "truncation resurrects
 * a fragment near maxLength" risk: since no bracket survives pre-slice,
 * `.slice(maxLength)` can never expose or reconstruct one. The passes above
 * are kept (defense-in-depth, and they still normalize real closed/unclosed
 * tags and the whitespace they leave behind) — this bracket-strip is the
 * final backstop. CAM-471 tracks the analogous gap in `sanitizeForPrompt`,
 * which CANNOT use this fix (free user text legitimately contains `<`/`>`).
 */
export function sanitizeShownResultName(rawText: string, maxLength: number): string {
  const withoutControlChars = stripControlChars(rawText);
  const withoutTags = withoutControlChars.replace(HTML_TAG_REGEX, ' ');
  const collapsedFirst = withoutTags.replace(/\s+/g, ' ').trim();
  // Hard-strip backstop (defense-in-depth): remove any remaining unclosed
  // opening-half tag fragment outright, regardless of tag name.
  const hardStripped = collapsedFirst.replace(UNCLOSED_TAG_PREFIX_REGEX, ' ');
  // Final backstop (Defect #3 durable fix): strip every literal `<`/`>`
  // character outright — no tag-name/character-class regex to bypass.
  const bracketsStripped = hardStripped.replace(/[<>]/g, ' ');
  const collapsed = bracketsStripped.replace(/\s+/g, ' ').trim();
  return collapsed.slice(0, maxLength);
}
