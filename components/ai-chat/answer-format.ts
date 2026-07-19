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
 * Inline emphasis (**bold**, *italic*, `code`) is OUT OF SCOPE — left
 * literal/inert. This story ships list STRUCTURE only (a follow-up ticket
 * covers inline emphasis if ever wanted).
 */

export type AnswerBlock =
  | { type: "paragraph"; text: string }
  | { type: "ordered-list"; items: string[] }
  | { type: "unordered-list"; items: string[] };

const ORDERED_RE = /^\s*\d+[.)]\s+(.+)$/;
const UNORDERED_RE = /^\s*[-*•]\s+(.+)$/;

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
      if (current?.type === "ordered-list") {
        current.items.push(ordered[1]);
      } else {
        current = { type: "ordered-list", items: [ordered[1]] };
        blocks.push(current);
      }
      continue;
    }

    const unordered = line.match(UNORDERED_RE);
    if (unordered) {
      if (current?.type === "unordered-list") {
        current.items.push(unordered[1]);
      } else {
        current = { type: "unordered-list", items: [unordered[1]] };
        blocks.push(current);
      }
      continue;
    }

    if (current?.type === "paragraph") {
      current.text += "\n" + line;
    } else {
      current = { type: "paragraph", text: line };
      blocks.push(current);
    }
  }

  return blocks;
}
