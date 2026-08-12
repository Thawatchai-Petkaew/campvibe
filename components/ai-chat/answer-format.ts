/**
 * components/ai-chat/answer-format.ts — CAM-439
 *
 * Pure parser that turns an assistant answer's raw text into typed display
 * blocks (paragraph / ordered-list / unordered-list) so AiChatMessageList can
 * render real semantic <p>/<ol>/<ul> instead of one run-on <p> per answer.
 *
 * CRITICAL (BR-4, security — the message-list header contract stays intact):
 * this function returns STRINGS ONLY, never markup. The renderer maps each
 * string to a React child, which React auto-escapes on render — a
 * `<script>`/`<img onerror>` string embedded in model text renders as
 * literal, inert text. Do NOT introduce dangerouslySetInnerHTML or a
 * markdown-to-HTML library here or at any call site.
 *
 * CAM-715 (2026-08-12, defect fix) — SUPERSEDES the original CAM-439
 * decision above ("inline emphasis is OUT OF SCOPE, left literal/inert"):
 * the guest chat's STREAMING answer path (runAssistantTurnFromMessagesStreaming,
 * lib/ai/openrouter-client.ts) emits raw model tokens live and is NOT covered
 * by the server-side `stripAnswerMarkdown` backstop (lib/ai/sanitize.ts) —
 * that only runs in `finalizeAnswer`, the non-streaming path — so when the
 * model still emits `**bold**`/`*italic*`/`` `code` `` despite the CAM-405
 * prompt rule, the literal markers reached the camper's screen (owner
 * screenshot, 2026-08-08). `stripInlineEmphasis` below closes that gap at
 * RENDER time so it covers BOTH the streaming and non-streaming paths
 * uniformly, mirroring `stripAnswerMarkdown`'s bold/italic regex BOUNDS
 * exactly (see that function's docblock in sanitize.ts): each character
 * class excludes `\n` so a span can never cross a line/list-item boundary,
 * and bold is unwrapped before italic so `**x**` is never first mis-split by
 * the single-marker italic pattern. List STRUCTURE (numbered/bulleted lines
 * -> real `<ol>`/`<ul>`) was already handled below since CAM-439 and is
 * unchanged by this fix. Still returns STRINGS ONLY — the BR-4 contract
 * above is unchanged; this is a plain string transform, never markup.
 */

export type AnswerBlock =
  | { type: "paragraph"; text: string }
  | { type: "ordered-list"; items: string[] }
  | { type: "unordered-list"; items: string[] };

const ORDERED_RE = /^\s*\d+[.)]\s+(.+)$/;
const UNORDERED_RE = /^\s*[-*•]\s+(.+)$/;

// Mirrors lib/ai/sanitize.ts's BOLD_DOUBLE_STAR_REGEX / BOLD_DOUBLE_UNDERSCORE_REGEX
// / ITALIC_STAR_REGEX / ITALIC_UNDERSCORE_REGEX bound-for-bound: each character
// class excludes '\n' so a match can never span two lines/list items, which is
// what keeps a lone list-marker '*' (already consumed by UNORDERED_RE before
// this ever runs) or a legitimate mid-sentence asterisk/underscore from being
// mistaken for a pair. Order matters — bold (double-marker) MUST run before
// italic (single-marker), or "**x**" is mis-split by the italic pattern first,
// leaving stray single markers behind (proven in sanitize.ts; same regex family).
const BOLD_DOUBLE_STAR_RE = /\*\*([^*\n]+)\*\*/g;
const BOLD_DOUBLE_UNDERSCORE_RE = /__([^_\n]+)__/g;
const ITALIC_STAR_RE = /\*([^*\n]+)\*/g;
const ITALIC_UNDERSCORE_RE = /_([^_\n]+)_/g;
// Inline code — named "out of scope" by the superseded CAM-439 note above,
// now in-scope per the CAM-715 fix; the server has no code-marker strip to
// mirror, so this pattern is authored fresh, bounded the SAME way ('\n'
// excluded from the content class, single-backtick pair only).
const INLINE_CODE_RE = /`([^`\n]+)`/g;

/**
 * Unwraps `**bold**` / `__bold__` / `*italic*` / `_italic_` / `` `code` ``
 * to their inner text. Pure string-in/string-out (BR-4). Safe to run on a
 * multi-line paragraph string as one call — every pattern above already
 * excludes '\n' from its content class, so no match can cross a line.
 */
function stripInlineEmphasis(text: string): string {
  return text
    .replace(BOLD_DOUBLE_STAR_RE, "$1")
    .replace(BOLD_DOUBLE_UNDERSCORE_RE, "$1")
    .replace(ITALIC_STAR_RE, "$1")
    .replace(ITALIC_UNDERSCORE_RE, "$1")
    .replace(INLINE_CODE_RE, "$1");
}

export function parseAnswer(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  // The block currently accepting more lines/items — cleared on a blank
  // line so a blank line always ends whatever block is open, and a new
  // block of the same type after a blank line starts fresh (not merged).
  let current: AnswerBlock | null = null;

  for (const line of text.split("\n")) {
    if (line.trim() === "") {
      current = null;
      continue;
    }

    const ordered = line.match(ORDERED_RE);
    if (ordered) {
      const item = stripInlineEmphasis(ordered[1]);
      if (current?.type === "ordered-list") {
        current.items.push(item);
      } else {
        current = { type: "ordered-list", items: [item] };
        blocks.push(current);
      }
      continue;
    }

    const unordered = line.match(UNORDERED_RE);
    if (unordered) {
      const item = stripInlineEmphasis(unordered[1]);
      if (current?.type === "unordered-list") {
        current.items.push(item);
      } else {
        current = { type: "unordered-list", items: [item] };
        blocks.push(current);
      }
      continue;
    }

    const strippedLine = stripInlineEmphasis(line);
    if (current?.type === "paragraph") {
      current.text += "\n" + strippedLine;
    } else {
      current = { type: "paragraph", text: strippedLine };
      blocks.push(current);
    }
  }

  return blocks;
}
