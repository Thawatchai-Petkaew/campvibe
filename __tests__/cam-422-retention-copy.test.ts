/**
 * cam-422-retention-copy.test.ts — CAM-422 (ADR-013 S8, D2).
 *
 * D2: "Privacy copy tells the user history is kept ≤180 days and is
 * deletable on demand." Asserts the `aiChat.retentionNotice` key exists,
 * TH copy is verbatim (char-for-char, per qa.md), and both TH/EN state the
 * 180-day figure. The broader structural checks (EN/TH key parity, no
 * em-dash in TH, non-empty EN) already run in
 * `cam-272-ai-chat-i18n.test.ts` and cover this key automatically since
 * they iterate every `aiChat.*` entry.
 */
import { describe, expect, it } from 'vitest';
import translations from '../locales/translations.json';

// CAM-428 added a nested `card` object under aiChat — widen to `unknown`
// leaves so this file's own flat-key lookup (retentionNotice) still
// narrows fine at each call site.
const th = translations.th.aiChat as Record<string, unknown>;
const en = translations.en.aiChat as Record<string, unknown>;

describe('locales/translations.json — aiChat.retentionNotice (CAM-422, ADR-013 D2)', () => {
  it('TH copy verbatim', () =>
    expect(th.retentionNotice).toBe(
      'บทสนทนาของคุณจะถูกเก็บไว้ไม่เกิน 180 วัน แล้วจะถูกลบออกโดยอัตโนมัติ คุณสามารถลบบทสนทนาด้วยตัวเองได้ทุกเมื่อ'
    ));

  it('EN copy verbatim', () =>
    expect(en.retentionNotice).toBe(
      'Your conversations are kept for up to 180 days and are deleted automatically after that. You can delete any conversation yourself at any time.'
    ));

  it('[structural] both languages state the 180-day retention figure', () => {
    expect(th.retentionNotice).toContain('180');
    expect(en.retentionNotice).toContain('180');
  });
});
