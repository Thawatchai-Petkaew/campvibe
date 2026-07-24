/**
 * cam-460-g3-security-nits.test.ts — CAM-460 owner APPROVED-WITH-NITS at G3
 * (2026-07-24). Two fixes, no second owner tap:
 *
 * NIT 1 (Important, defect #4, same family as #1/#3) — `isStrippableControlChar`
 * / `stripControlChars` (`lib/ai/sanitize.ts`) only stripped C0 + DEL; ALL 32
 * C1 codepoints (U+0080-U+009F) survived, notably U+0085 NEL — a Unicode
 * MANDATORY line break `\s` does NOT match and zod `.trim()` does not remove.
 * A guest name could forge a pseudo-line inside the `<shown_results>` prompt
 * fence. Fixed by extending the ONE shared `isStrippableControlChar` helper
 * (every sanitizer in the module reuses it) — proven here against BOTH
 * `sanitizeShownResultName` and `sanitizeForPrompt`. Does NOT resolve CAM-471
 * (zero-width/Cf codepoints, e.g. U+200B, defeating the delimiter regex) —
 * different bug class, tracked separately.
 *
 * Char-code walk deletes a strippable char outright (does not replace it with
 * a space — see `stripControlChars`'s implementation), so two runs either
 * side of a stripped C1 char re-join with NO separator, matching the
 * pre-existing C0/DEL behavior asserted in cam-460-conversation-state.test.ts
 * ("a fragment split by a CONTROL CHARACTER is healed by the control-char
 * strip"). Assertions below match that real, verified behavior. Uses `\uXXXX`
 * escapes (never a raw invisible byte in source) for reviewability.
 *
 * NIT 2 (Suggestion, numeric bounds) — `shownResultSchema.priceLow` was a bare
 * `z.number()`, accepting `Infinity` (JSON `1e999` overflows to Infinity on
 * parse), negatives, and unsafe integers, which interpolate raw into the
 * prompt as `฿Infinity`/`฿-500` via `formatStartingPriceSuffix`. Tightened to
 * `.finite().nonnegative().safe()`, `.nullable().optional()` unchanged.
 */
import { describe, it, expect } from 'vitest';

const { sanitizeShownResultName, sanitizeForPrompt } = await import('@/lib/ai/sanitize');
const { shownResultSchema } = await import('@/lib/validations/ai-chat');

const CAMP_A = '11111111-1111-4111-8111-111111111111';
/** U+0085 NEL — a Unicode-mandatory line break `\s` does NOT match (defect #4). */
const NEL = String.fromCodePoint(0x85);

describe('CAM-460 NIT 1 — C1 control-char strip (U+0080-U+009F), shared helper', () => {
  it('[security] sanitizeShownResultName strips U+0085 NEL — a real Unicode line break \\s does not match', () => {
    const withNel = `ลานเขาใหญ่${NEL}เอกสารลับ`;
    const result = sanitizeShownResultName(withNel, 200);
    expect(result).not.toContain(NEL);
    expect(result).toBe('ลานเขาใหญ่เอกสารลับ'); // NEL deleted (not space-replaced), runs re-join
  });

  it('[security] sanitizeForPrompt strips U+0085 NEL the same way (shared helper, same guarantee)', () => {
    const withNel = `hello${NEL}world`;
    const result = sanitizeForPrompt(withNel);
    expect(result).not.toContain(NEL);
    expect(result).toBe('helloworld');
  });

  it('[security] a sample of other C1 codepoints (U+0080, U+008D, U+0090, U+009F) is stripped by both sanitizers', () => {
    const c1Sample = [0x80, 0x8d, 0x90, 0x9f];
    for (const cp of c1Sample) {
      const ch = String.fromCodePoint(cp);
      const shownResult = sanitizeShownResultName(`ลาน${ch}เขาใหญ่`, 200);
      const promptResult = sanitizeForPrompt(`a${ch}b`);
      expect(shownResult, `sanitizeShownResultName should strip U+${cp.toString(16)}`).not.toContain(ch);
      expect(promptResult, `sanitizeForPrompt should strip U+${cp.toString(16)}`).not.toContain(ch);
      expect(shownResult).toBe('ลานเขาใหญ่');
      expect(promptResult).toBe('ab');
    }
  });

  it('[boundary] normal Thai/ASCII text is completely unaffected by the C1 extension (no over-strip)', () => {
    const thaiAscii = 'ลานเขาใหญ่ Camp 123 เชียงใหม่ (Chiang Mai)';
    expect(sanitizeShownResultName(thaiAscii, 200)).toBe(thaiAscii);
    expect(sanitizeForPrompt(thaiAscii)).toBe(thaiAscii);
  });

  it('[normal] existing C0/DEL control-char behavior is unchanged (regression guard)', () => {
    expect(sanitizeShownResultName('ลานเขาใหญ่\x00\x1f\x7f', 200)).toBe('ลานเขาใหญ่');
    expect(sanitizeForPrompt('hello\x00world')).toBe('helloworld');
  });
});

describe('CAM-460 NIT 2 — shownResultSchema.priceLow numeric bounds', () => {
  const base = { ordinal: 1, campSiteId: CAMP_A, name: 'ลานเขาใหญ่' };

  it('[error/validation] rejects Infinity (JSON 1e999 overflow)', () => {
    const parsed = shownResultSchema.safeParse({ ...base, priceLow: 1e999 });
    expect(parsed.success).toBe(false);
  });

  it('[error/validation] rejects -Infinity', () => {
    const parsed = shownResultSchema.safeParse({ ...base, priceLow: -Infinity });
    expect(parsed.success).toBe(false);
  });

  it('[error/validation] rejects a negative price', () => {
    const parsed = shownResultSchema.safeParse({ ...base, priceLow: -500 });
    expect(parsed.success).toBe(false);
  });

  it('[error/validation] rejects an unsafe integer beyond Number.MAX_SAFE_INTEGER', () => {
    const parsed = shownResultSchema.safeParse({ ...base, priceLow: Number.MAX_SAFE_INTEGER + 1000 });
    expect(parsed.success).toBe(false);
  });

  it('[normal] accepts a normal price', () => {
    const parsed = shownResultSchema.safeParse({ ...base, priceLow: 700 });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.priceLow).toBe(700);
  });

  it('[boundary] accepts null (free convention) and 0 (free spot)', () => {
    expect(shownResultSchema.safeParse({ ...base, priceLow: null }).success).toBe(true);
    expect(shownResultSchema.safeParse({ ...base, priceLow: 0 }).success).toBe(true);
  });

  it('[null/empty] accepts priceLow absent (backward-compatible by addition)', () => {
    const parsed = shownResultSchema.safeParse({ ...base });
    expect(parsed.success).toBe(true);
  });
});
