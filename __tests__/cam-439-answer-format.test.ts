/**
 * cam-439-answer-format.test.ts — CAM-439
 *
 * Real unit tests (pure function, no source-grep needed) for
 * components/ai-chat/answer-format.ts — the parser that turns an assistant
 * answer's raw text into typed display blocks so AiChatMessageList can
 * render real <ol>/<ul>/<p> instead of one run-on paragraph.
 *
 * BR-4 (Critical, security): parseAnswer returns STRINGS ONLY, never markup.
 * The injection-literal tests below prove a `<script>`/`<img onerror>`
 * string in model text survives as plain, inert text in the parsed output —
 * the renderer maps it to a React child, which auto-escapes on render.
 *
 * CAM-715 (2026-08-12, dated note — SUPERSEDES the original CAM-439
 * "inline emphasis is out of scope" decision recorded in answer-format.ts's
 * own docblock): parseAnswer now also strips `**bold**`/`*italic*`/`` `code` ``
 * markers at render time (streamed answers reach the client with no
 * server-side markdown strip applied). None of the fixtures below exercise
 * bold/italic/code, so every pin in this file is unaffected and stays
 * green; the new inline-emphasis coverage lives in
 * __tests__/cam-715-inline-emphasis-strip.test.ts.
 */
import { describe, expect, it } from "vitest";
import { parseAnswer, type AnswerBlock } from "@/components/ai-chat/answer-format";

describe("normal — ordered / unordered / mixed / header-then-list", () => {
  it("[unit] a numbered list (1. / 2.) parses into ONE ordered-list block with both items", () => {
    const result = parseAnswer("1. First step\n2. Second step");
    expect(result).toEqual<AnswerBlock[]>([
      { type: "ordered-list", items: ["First step", "Second step"] },
    ]);
  });

  it("[unit] a numbered list using the ')' delimiter (1) / 2)) also parses as ordered", () => {
    const result = parseAnswer("1) First\n2) Second");
    expect(result).toEqual<AnswerBlock[]>([{ type: "ordered-list", items: ["First", "Second"] }]);
  });

  it("[unit] a bulleted list (-, *, •) parses into ONE unordered-list block", () => {
    const dash = parseAnswer("- Bullet A\n- Bullet B");
    expect(dash).toEqual<AnswerBlock[]>([{ type: "unordered-list", items: ["Bullet A", "Bullet B"] }]);

    const star = parseAnswer("* Bullet A\n* Bullet B");
    expect(star).toEqual<AnswerBlock[]>([{ type: "unordered-list", items: ["Bullet A", "Bullet B"] }]);

    const dot = parseAnswer("• Bullet A\n• Bullet B");
    expect(dot).toEqual<AnswerBlock[]>([{ type: "unordered-list", items: ["Bullet A", "Bullet B"] }]);
  });

  it("[unit] mixed ordered-then-unordered produces two separate list blocks, in order", () => {
    const result = parseAnswer("1. First\n2. Second\n- Bullet A\n- Bullet B");
    expect(result).toEqual<AnswerBlock[]>([
      { type: "ordered-list", items: ["First", "Second"] },
      { type: "unordered-list", items: ["Bullet A", "Bullet B"] },
    ]);
  });

  it("[unit] header-then-list: a leading plain-text line becomes a paragraph block before the list block", () => {
    const result = parseAnswer("Here are some options:\n1. Option A\n2. Option B");
    expect(result).toEqual<AnswerBlock[]>([
      { type: "paragraph", text: "Here are some options:" },
      { type: "ordered-list", items: ["Option A", "Option B"] },
    ]);
  });
});

describe("normal — plain paragraph", () => {
  it("[unit] a single-line answer with no list markers returns one paragraph block", () => {
    expect(parseAnswer("สวัสดีครับ มีอะไรให้ช่วยไหม")).toEqual<AnswerBlock[]>([
      { type: "paragraph", text: "สวัสดีครับ มีอะไรให้ช่วยไหม" },
    ]);
  });

  it("[unit] consecutive plain lines join into ONE paragraph block with \\n preserved (whitespace-pre-wrap)", () => {
    const result = parseAnswer("Line one\nLine two\nLine three");
    expect(result).toEqual<AnswerBlock[]>([{ type: "paragraph", text: "Line one\nLine two\nLine three" }]);
  });
});

describe("null/empty", () => {
  it("[null/empty] an empty string returns no blocks", () => {
    expect(parseAnswer("")).toEqual([]);
  });

  it("[null/empty] a whitespace-only / blank-lines-only string returns no blocks", () => {
    expect(parseAnswer("   \n\n  \n")).toEqual([]);
  });
});

describe("boundary — blank lines end a block", () => {
  it("[boundary] a blank line between two lists of the SAME type keeps them as TWO separate blocks (not merged)", () => {
    const result = parseAnswer("1. First\n\n1. Restart");
    expect(result).toEqual<AnswerBlock[]>([
      { type: "ordered-list", items: ["First"] },
      { type: "ordered-list", items: ["Restart"] },
    ]);
  });

  it("[boundary] a blank line between two paragraphs keeps them as TWO separate paragraph blocks", () => {
    const result = parseAnswer("Para one\n\nPara two");
    expect(result).toEqual<AnswerBlock[]>([
      { type: "paragraph", text: "Para one" },
      { type: "paragraph", text: "Para two" },
    ]);
  });

  it("[boundary] a single list item (no continuation) still produces a list block, not a paragraph", () => {
    expect(parseAnswer("- Only one bullet")).toEqual<AnswerBlock[]>([
      { type: "unordered-list", items: ["Only one bullet"] },
    ]);
  });
});

describe("error/validation — BR-4 injection strings stay literal, never markup", () => {
  it("[security] a <script> tag inside a plain answer stays a literal string in the paragraph block", () => {
    const result = parseAnswer("<script>alert(1)</script>");
    expect(result).toEqual<AnswerBlock[]>([{ type: "paragraph", text: "<script>alert(1)</script>" }]);
    // no markup was built — the output is a plain data string, not a React element
    expect(typeof (result[0] as { text: string }).text).toBe("string");
  });

  it("[security] an <img onerror=...> string inside a list item stays a literal string in the list's items array", () => {
    const result = parseAnswer('- <img src=x onerror="alert(1)">');
    expect(result).toEqual<AnswerBlock[]>([
      { type: "unordered-list", items: ['<img src=x onerror="alert(1)">'] },
    ]);
  });
});

describe("concurrent/ordering — block order is preserved for a longer mixed answer", () => {
  it("[unit] paragraph -> ordered-list -> paragraph -> unordered-list resolves in source order", () => {
    const result = parseAnswer(
      "แนะนำ 2 ที่นี้ครับ\n1. แคมป์ A\n2. แคมป์ B\nลองดูเพิ่มเติม\n- ใกล้น้ำตก\n- มีที่จอดรถ"
    );
    expect(result).toEqual<AnswerBlock[]>([
      { type: "paragraph", text: "แนะนำ 2 ที่นี้ครับ" },
      { type: "ordered-list", items: ["แคมป์ A", "แคมป์ B"] },
      { type: "paragraph", text: "ลองดูเพิ่มเติม" },
      { type: "unordered-list", items: ["ใกล้น้ำตก", "มีที่จอดรถ"] },
    ]);
  });
});
