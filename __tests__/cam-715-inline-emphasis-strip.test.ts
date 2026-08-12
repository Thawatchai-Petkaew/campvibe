/**
 * cam-715-inline-emphasis-strip.test.ts — CAM-715 (defect fix)
 *
 * DEFECT (owner screenshot, 2026-08-08): the guest chat STREAMS answers, and
 * on that path literal `**bold**` asterisks reach the camper's screen — the
 * server-side `stripAnswerMarkdown` (lib/ai/sanitize.ts) only runs in
 * `finalizeAnswer`, the non-streaming path (lib/ai/openrouter-client.ts).
 *
 * FIX: components/ai-chat/answer-format.ts's `parseAnswer` now strips inline
 * markdown emphasis (`**bold**` / `__bold__` / `*italic*` / `_italic_` /
 * `` `code` ``) at RENDER time, mirroring `stripAnswerMarkdown`'s bold/italic
 * regex bounds — this covers BOTH the streaming and non-streaming paths
 * uniformly, since both AiChatMessageList entry kinds ("streaming" and
 * "answer") call `parseAnswer(entry.text)`.
 *
 * Coverage matrix:
 *   - normal: the owner's exact repro string renders bold-free/asterisk-free
 *   - normal: each emphasis kind in isolation (bold **, bold __, italic *,
 *     italic _, inline code)
 *   - boundary: a numbered-list item carrying bold text strips correctly
 *     with no double-numbering (the marker is consumed once, structurally,
 *     by parseAnswer's own ORDERED_RE — never re-emitted as list-item text)
 *   - error/validation: a legitimate lone/mid-sentence asterisk or
 *     underscore survives (bounded strip, not over-strip — mirrors
 *     sanitize.ts's own "lone unmatched marker" invariant)
 *   - concurrent/ordering: bold-then-italic on the same line strips both,
 *     in the order sanitize.ts proved matters (bold before italic)
 *   - security: BR-4 contract unaffected — parseAnswer still returns
 *     strings only, an injection literal survives inert
 */
import { describe, expect, it } from "vitest";
import { parseAnswer, type AnswerBlock } from "@/components/ai-chat/answer-format";

describe("parseAnswer — inline emphasis strip (normal, CAM-715 Prove-It repro)", () => {
  it("[normal] the owner's exact streamed-shape repro string renders bold-free and asterisk-free", () => {
    // Exact string from the owner's 2026-08-08 screenshot.
    const streamedShape = "แนะนำ **ริมคลองร่มรื่นสระบุรี** ครับ เหมาะกับครอบครัว";
    const result = parseAnswer(streamedShape);
    expect(result).toEqual<AnswerBlock[]>([
      { type: "paragraph", text: "แนะนำ ริมคลองร่มรื่นสระบุรี ครับ เหมาะกับครอบครัว" },
    ]);
    expect(result[0].type).toBe("paragraph");
    expect((result[0] as { text: string }).text).not.toContain("*");
  });

  it("[normal] bold with ** unwraps to its inner text", () => {
    expect(parseAnswer("**ลานกางเต็นท์** แนะนำ")).toEqual<AnswerBlock[]>([
      { type: "paragraph", text: "ลานกางเต็นท์ แนะนำ" },
    ]);
  });

  it("[normal] bold with __ unwraps to its inner text", () => {
    expect(parseAnswer("__ลานกางเต็นท์__ แนะนำ")).toEqual<AnswerBlock[]>([
      { type: "paragraph", text: "ลานกางเต็นท์ แนะนำ" },
    ]);
  });

  it("[normal] italic with single * unwraps to its inner text", () => {
    expect(parseAnswer("*ลานกางเต็นท์* แนะนำ")).toEqual<AnswerBlock[]>([
      { type: "paragraph", text: "ลานกางเต็นท์ แนะนำ" },
    ]);
  });

  it("[normal] italic with single _ unwraps to its inner text", () => {
    expect(parseAnswer("_ลานกางเต็นท์_ แนะนำ")).toEqual<AnswerBlock[]>([
      { type: "paragraph", text: "ลานกางเต็นท์ แนะนำ" },
    ]);
  });

  it("[normal] inline `code` unwraps to its inner text", () => {
    expect(parseAnswer("รหัสจอง `ABC123` ของคุณ")).toEqual<AnswerBlock[]>([
      { type: "paragraph", text: "รหัสจอง ABC123 ของคุณ" },
    ]);
  });
});

describe("parseAnswer — inline emphasis strip inside list items (boundary, no double-numbering)", () => {
  it("[boundary] a numbered list item with a bold camp name strips correctly with no double-numbering", () => {
    const result = parseAnswer(
      "1. **ริมคลองร่มรื่นสระบุรี** ราคา 300 บาท\n2. **ลานกางเต็นท์แม่ริม** ราคา 250 บาท"
    );
    expect(result).toEqual<AnswerBlock[]>([
      {
        type: "ordered-list",
        items: ["ริมคลองร่มรื่นสระบุรี ราคา 300 บาท", "ลานกางเต็นท์แม่ริม ราคา 250 บาท"],
      },
    ]);
    // the rendered <ol> supplies the number visually — the item text itself
    // must never carry a second, literal "1."/"2." marker.
    const items = (result[0] as { items: string[] }).items;
    for (const item of items) {
      expect(item).not.toMatch(/^\d+[.)]\s/);
    }
  });

  it("[boundary] a bulleted list item with bold text strips correctly, marker consumed once", () => {
    const result = parseAnswer("- **ห้องน้ำสะอาด** ใกล้ลาน");
    expect(result).toEqual<AnswerBlock[]>([
      { type: "unordered-list", items: ["ห้องน้ำสะอาด ใกล้ลาน"] },
    ]);
  });
});

describe("parseAnswer — bounded strip, legitimate marks survive (error/validation)", () => {
  it("[error/validation] a lone unmatched asterisk mid-sentence is left alone (not treated as a pair)", () => {
    const lone = "ราคาต่อคืน 500 บาท* (ไม่รวมค่าธรรมเนียม)";
    expect(parseAnswer(lone)).toEqual<AnswerBlock[]>([{ type: "paragraph", text: lone }]);
  });

  it("[error/validation] a lone unmatched underscore mid-sentence is left alone", () => {
    const lone = "user_name ต้องไม่ว่าง";
    expect(parseAnswer(lone)).toEqual<AnswerBlock[]>([{ type: "paragraph", text: lone }]);
  });

  it("[error/validation] plain prose with no emphasis markers passes through unchanged", () => {
    const plain = "มีแคมป์ริมน้ำแนะนำ 2 แห่งค่ะ ทั้งคู่เปิดให้จองได้ตลอดสัปดาห์นี้";
    expect(parseAnswer(plain)).toEqual<AnswerBlock[]>([{ type: "paragraph", text: plain }]);
  });
});

describe("parseAnswer — bold before italic ordering (concurrent/ordering)", () => {
  it("[concurrent/ordering] bold and italic on the same line both strip, with no stray single markers left behind", () => {
    const result = parseAnswer("**ราคาพิเศษ** และ *เปิดจองแล้ว*");
    expect(result).toEqual<AnswerBlock[]>([
      { type: "paragraph", text: "ราคาพิเศษ และ เปิดจองแล้ว" },
    ]);
  });
});

describe("parseAnswer — BR-4 security contract unaffected by the emphasis strip", () => {
  it("[security] a <script> tag inside a bold span stays literal, inert text (never markup)", () => {
    const result = parseAnswer("**<script>alert(1)</script>**");
    expect(result).toEqual<AnswerBlock[]>([{ type: "paragraph", text: "<script>alert(1)</script>" }]);
    expect(typeof (result[0] as { text: string }).text).toBe("string");
  });
});
