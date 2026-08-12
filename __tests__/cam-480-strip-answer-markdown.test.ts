/**
 * CAM-480 (F2, production bug fix) — lib/ai/sanitize.ts `stripAnswerMarkdown`
 *
 * BUG: gpt-4o-mini sometimes emits raw markdown in the answer text despite
 * the CAM-405 prompt rule against it (image links, **bold**, numbered
 * enumerations of camps by name). The UI's `parseAnswer`
 * (components/ai-chat/answer-format.ts) is a plain-text parser — it does NOT
 * interpret markdown — so any markdown that slips through renders as ugly
 * literal text. `stripAnswerMarkdown` is the server-side backstop applied in
 * `finalizeAnswer` (lib/ai/openrouter-client.ts).
 *
 * Coverage matrix:
 *   - normal: a realistic polluted answer (image + bold + numbered list) is
 *     fully cleaned in one pass (Prove-It case)
 *   - null/empty: empty string stays empty, no throw
 *   - boundary/idempotent: running twice yields the same result as running once
 *   - error/validation: plain prose with no markdown passes through unchanged;
 *     a bare `(url)` with no preceding `[text]` is left alone (not a link)
 *   - each markdown kind in isolation: image, link, bold (`**`/`__`),
 *     italic (`*`/`_`), heading, list markers (`1.` `2)` `-` `*`)
 *
 * CAM-715 (2026-08-12, dated note): this file only pins the SERVER-side
 * strip (`finalizeAnswer`'s non-streaming path). The guest chat's STREAMING
 * path never called this function, so a model that emitted raw markdown mid
 * -stream reached the camper's screen unstripped (owner screenshot,
 * 2026-08-08). CAM-715 closes that gap with a CLIENT-side mirror in
 * components/ai-chat/answer-format.ts (`stripInlineEmphasis`, bold/italic
 * bounds copied from this file's regexes) so both paths are covered —
 * covered in __tests__/cam-715-inline-emphasis-strip.test.ts. Every pin
 * below is unaffected and stays green.
 */
import { describe, it, expect } from 'vitest';
import { stripAnswerMarkdown } from '@/lib/ai/sanitize';

describe('stripAnswerMarkdown — normal (Prove-It: realistic polluted answer)', () => {
  it('[unit] strips image markdown, bold, and a numbered list from one realistic answer', () => {
    const polluted = [
      'ลองดูแคมป์นี้ครับ ![c](https://images.unsplash.com/photo-123.jpg)',
      '**ลานริมม่อนแจ่ม** เหมาะกับครอบครัว',
      '1. ลานริมม่อนแจ่ม ราคา 250 บาท',
    ].join('\n');

    const cleaned = stripAnswerMarkdown(polluted);

    expect(cleaned).not.toContain('![');
    expect(cleaned).not.toContain('](');
    expect(cleaned).not.toContain('**');
    expect(cleaned).not.toMatch(/^1\.\s/m);
    expect(cleaned).not.toMatch(/^-\s/m);
    // the underlying words survive — this is a strip, not a redaction
    expect(cleaned).toContain('ลานริมม่อนแจ่ม');
    expect(cleaned).toContain('ราคา 250 บาท');
    expect(cleaned).toContain('เหมาะกับครอบครัว');
  });
});

describe('stripAnswerMarkdown — null/empty', () => {
  it('[unit] returns an empty string for empty input, no throw', () => {
    expect(stripAnswerMarkdown('')).toBe('');
  });

  it('[unit] returns whitespace-only input trimmed, no throw', () => {
    expect(stripAnswerMarkdown('   ')).toBe('');
  });
});

describe('stripAnswerMarkdown — error/validation (leaves legitimate prose alone)', () => {
  it('[unit] plain text with no markdown is returned unchanged', () => {
    const plain = 'มีแคมป์ริมน้ำแนะนำ 2 แห่งค่ะ ทั้งคู่เปิดให้จองได้ตลอดสัปดาห์นี้';
    expect(stripAnswerMarkdown(plain)).toBe(plain);
  });

  it('[unit] a bare (url) with no preceding [text] is left alone (not a link)', () => {
    const withParenUrl = 'ติดต่อเจ้าของแคมป์ได้ที่ (https://example.com/contact)';
    expect(stripAnswerMarkdown(withParenUrl)).toBe(withParenUrl);
  });

  it('[unit] a lone unmatched asterisk/underscore mid-sentence is left alone', () => {
    const lone = 'ราคาต่อคืน 500 บาท* (ไม่รวมค่าธรรมเนียม)';
    expect(stripAnswerMarkdown(lone)).toBe(lone);
  });
});

describe('stripAnswerMarkdown — boundary (idempotent)', () => {
  it('[unit] running twice on an already-cleaned answer yields the same result', () => {
    const polluted = '![c](https://x/y.jpg) **bold** text\n1. item one\n2) item two';
    const once = stripAnswerMarkdown(polluted);
    const twice = stripAnswerMarkdown(once);
    expect(twice).toBe(once);
  });

  it('[unit] never throws on adversarial/malformed markdown-like input', () => {
    const adversarial = '![[[(((***___###1.2)-*'.repeat(20);
    expect(() => stripAnswerMarkdown(adversarial)).not.toThrow();
  });
});

describe('stripAnswerMarkdown — each markdown kind in isolation', () => {
  it('[unit] image markdown is removed entirely (surrounding words survive)', () => {
    // Not an exact-string assertion: removing an inline token can leave a
    // doubled space behind (see sanitize.ts's "no internal whitespace
    // collapse" contract note) — this proves the image is gone and the
    // surrounding prose survives, without over-asserting exact spacing.
    const cleaned = stripAnswerMarkdown('ดูรูป ![แคมป์](https://images.example.com/a.jpg) ที่นี่');
    expect(cleaned).not.toContain('![');
    expect(cleaned).not.toContain('](');
    expect(cleaned).not.toContain('https://images.example.com');
    expect(cleaned).toContain('ดูรูป');
    expect(cleaned).toContain('ที่นี่');
  });

  it('[unit] link markdown keeps only the link text', () => {
    expect(stripAnswerMarkdown('อ่านเพิ่มเติมที่ [เว็บไซต์แคมป์](https://example.com)')).toBe(
      'อ่านเพิ่มเติมที่ เว็บไซต์แคมป์'
    );
  });

  it('[unit] bold with ** is unwrapped to its inner text', () => {
    expect(stripAnswerMarkdown('**ลานกางเต็นท์** แนะนำ')).toBe('ลานกางเต็นท์ แนะนำ');
  });

  it('[unit] bold with __ is unwrapped to its inner text', () => {
    expect(stripAnswerMarkdown('__ลานกางเต็นท์__ แนะนำ')).toBe('ลานกางเต็นท์ แนะนำ');
  });

  it('[unit] italic with single * is unwrapped to its inner text', () => {
    expect(stripAnswerMarkdown('*ลานกางเต็นท์* แนะนำ')).toBe('ลานกางเต็นท์ แนะนำ');
  });

  it('[unit] italic with single _ is unwrapped to its inner text', () => {
    expect(stripAnswerMarkdown('_ลานกางเต็นท์_ แนะนำ')).toBe('ลานกางเต็นท์ แนะนำ');
  });

  it('[unit] a leading heading hash is removed, text kept', () => {
    expect(stripAnswerMarkdown('### แคมป์แนะนำ')).toBe('แคมป์แนะนำ');
  });

  it('[unit] a leading "1. " numbered marker is removed, line kept', () => {
    expect(stripAnswerMarkdown('1. ลานริมน้ำ ราคา 300 บาท')).toBe('ลานริมน้ำ ราคา 300 บาท');
  });

  it('[unit] a leading "2) " numbered marker is removed, line kept', () => {
    expect(stripAnswerMarkdown('2) ลานริมเขา ราคา 400 บาท')).toBe('ลานริมเขา ราคา 400 บาท');
  });

  it('[unit] a leading "- " bullet marker is removed, line kept', () => {
    expect(stripAnswerMarkdown('- ลานกางเต็นท์แม่ริม')).toBe('ลานกางเต็นท์แม่ริม');
  });

  it('[unit] a leading "* " bullet marker is removed, line kept', () => {
    expect(stripAnswerMarkdown('* ลานกางเต็นท์แม่ริม')).toBe('ลานกางเต็นท์แม่ริม');
  });

  it('[unit] a decimal like "1.5" is not mistaken for a list marker', () => {
    expect(stripAnswerMarkdown('ระยะทางประมาณ 1.5 กิโลเมตร')).toBe('ระยะทางประมาณ 1.5 กิโลเมตร');
  });

  it('[unit] multiple bullet lines each lose only their own marker (no cross-line pairing)', () => {
    const input = '* ลานที่หนึ่ง ราคา 200 บาท\n* ลานที่สอง ราคา 300 บาท';
    const cleaned = stripAnswerMarkdown(input);
    expect(cleaned).toBe('ลานที่หนึ่ง ราคา 200 บาท\nลานที่สอง ราคา 300 บาท');
  });

  it('[unit] multiple images in one line are all removed, prose between them survives', () => {
    const cleaned = stripAnswerMarkdown('รูป1 ![a](https://x/1.jpg) รูป2 ![b](https://x/2.jpg) จบ');
    expect(cleaned).not.toContain('![');
    expect(cleaned).not.toContain('](');
    expect(cleaned).toContain('รูป1');
    expect(cleaned).toContain('รูป2');
    expect(cleaned).toContain('จบ');
  });

  it('[unit] an image nested inside a link `[![a](img)](url)` is fully cleaned, no markdown syntax survives', () => {
    const cleaned = stripAnswerMarkdown('ดู [![a](https://x/img.jpg)](https://x/page) นะ');
    expect(cleaned).not.toContain('![');
    expect(cleaned).not.toContain('](');
    expect(cleaned).not.toContain('[');
    expect(cleaned).not.toContain(']');
  });
});

/**
 * QA ADVERSARIAL DEFECTS (FIXED — CAM-480 re-verify). Root cause was the
 * regex-based `IMAGE_MARKDOWN_REGEX`/`LINK_MARKDOWN_REGEX` character classes
 * excluding `]`/`)` from the label/URL groups entirely, so either could
 * never appear NESTED one level inside without breaking the match. Fixed by
 * replacing both regexes with a hand-written bracket/paren-depth scanner
 * (`scanImagesAndLinks`/`scanBracketConstruct`, `lib/ai/sanitize.ts`) that
 * tracks real nesting depth instead of a character class. Flipped from
 * `it.fails()` to `it()` now that the fix lands (cam-410-adversarial-seam.test.ts
 * convention).
 */
describe('QA DEFECT (FIXED, was Important) — a nested "]" inside image alt-text or link-text now strips cleanly', () => {
  it('[security/correctness] image alt-text containing a nested "[...]" strips to plain prose (no raw tag leaks)', () => {
    const cleaned = stripAnswerMarkdown('รูปนี้ ![แคมป์ [ยอดนิยม]](https://x/i.jpg) สวยมาก');
    expect(cleaned).not.toContain('![');
    expect(cleaned).not.toContain('](');
  });

  it('[correctness] link-text containing a nested "[...]" strips to its inner text (no raw markdown leaks)', () => {
    const cleaned = stripAnswerMarkdown('อ่านที่ [หน้า [1]](https://x/page) นะ');
    expect(cleaned).not.toContain('](');
    expect(cleaned).not.toMatch(/\[หน้า/);
  });
});

describe('QA DEFECT (FIXED, was Critical) — a ")" inside the URL (image or link) no longer corrupts the surrounding sentence', () => {
  it('[correctness] an image URL containing "(...)" (e.g. Wikipedia-style path) is fully removed, no stray fragment left behind', () => {
    const cleaned = stripAnswerMarkdown('รูป ![แคมป์](https://en.wikipedia.org/wiki/Camp_(recreation).jpg) จบ');
    // Previously (buggy) output: "รูป .jpg) จบ" — a stray ".jpg)" fragment
    // leaked into otherwise-clean prose. Correct behavior: the whole image
    // markdown is gone, "รูป" and "จบ" survive with no orphaned punctuation.
    expect(cleaned).not.toContain(')');
    expect(cleaned).not.toContain('.jpg');
    expect(cleaned).toContain('รูป');
    expect(cleaned).toContain('จบ');
  });

  it('[correctness] a link URL containing "(...)" is unwrapped to its link text with no stray leftover punctuation', () => {
    const cleaned = stripAnswerMarkdown('อ่านที่ [หน้านี้](https://en.wikipedia.org/wiki/Camp_(recreation)) นะ');
    // Previously (buggy) output: "อ่านที่ หน้านี้) นะ" — a stray trailing
    // ")" leaked into the sentence.
    expect(cleaned).toBe('อ่านที่ หน้านี้ นะ');
  });
});
