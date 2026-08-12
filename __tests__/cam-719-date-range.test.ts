/**
 * CAM-719 — the date-RANGE rule added to `resolveDatesCore`
 * (`lib/ai/date-phrases.ts`, epic CAM-695, in-chat-booking-completion).
 *
 * THE GAP (RED, verified behaviourally before this change): the owner typed
 * "ต้องการจอง 19-21 ที่จะถึง" and got the unreadable reprompt — no range rule
 * existed at all. Worse, a SILENT MISREAD hid behind the gap:
 * `ABSOLUTE_THAI_MONTH_RE` (rule 8, now rule 9) is unanchored, so
 * "19-21 ส.ค." scanned straight past "19-" and resolved 21 Aug, ONE night,
 * silently discarding the camper's real span. Confirmed by calling the
 * pre-CAM-719 `resolveDatesCore` directly (git stash of this story's diff):
 *
 *   resolveDatesCore('19-21 ส.ค.', new Date('2026-08-13T10:00:00Z'), [])
 *   -> { ok: true, dates: [{ startDate: '2026-08-21', endDate: '2026-08-22' }], ... }
 *                    (RED — 21 Aug, ONE night, "19-" silently discarded)
 *
 * every case below asserts the NEW resolved behavior (GREEN, post-change) —
 * this file is the deterministic matrix; no model call is needed for
 * correctness (the parser is pure).
 *
 * Coverage matrix:
 *   - normal: dash form, ถึง form, with/without month, with/without year
 *     (พ.ศ./ค.ศ.), monthless = next occurrence
 *   - anti-silent-misread (the ticket's own acceptance bar): "19-21 ส.ค." and
 *     "19 ส.ค. - 21 ส.ค." both resolve to the FULL 2-night span, never
 *     collapsed to a single day
 *   - boundary: EC-1 (start day already passed this month -> next month),
 *     EC-2 (explicit-month range crossing a month boundary)
 *   - error/validation: EC-3 (an unrelated trailing number is never
 *     swallowed into the range), BR-3 (a genuinely inverted range is
 *     rejected, never silently swapped)
 *   - null/empty: no day-separator-day shape at all -> the dispatcher falls
 *     through untouched
 *   - regression: the cam-645 ISO-date collision pin ("2026-08-01" must stay
 *     unsupported) re-verified directly against MY new rule (the mechanism
 *     that could have broken it), plus a same-file anti-shadow check that a
 *     single absolute date ("15 ส.ค.") is never intercepted by the range rule
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    thaiHoliday: {
      findMany: vi.fn(),
    },
  },
}));

const { resolveDatesCore } = await import('@/lib/ai/tools/resolve-dates');

// Bangkok 2026-08-13 (Thursday) — matches the real "today" this story's
// owner-sentence scenario was reported against.
const NOW = new Date('2026-08-13T10:00:00Z');

describe('resolveDatesCore — date RANGE (CAM-719), the owner\'s exact scenario + AC-1/AC-2', () => {
  it('[normal][red-first] the owner\'s EXACT sentence "ต้องการจอง 19-21 ที่จะถึง" resolves to check-in 19 Aug, checkout 21 Aug (2 nights) — was the unreadable reprompt before this story', () => {
    const result = resolveDatesCore('ต้องการจอง 19-21 ที่จะถึง', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-19', endDate: '2026-08-21' }],
      interpretation: expect.any(String),
    });
  });

  it('[normal][anti-silent-misread] "19-21 ส.ค." resolves to the SAME 19->21 Aug span — NEVER 1 night on the 21st (the exact silent-misread rule 9 used to produce)', () => {
    const result = resolveDatesCore('19-21 ส.ค.', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-19', endDate: '2026-08-21' }],
      interpretation: expect.any(String),
    });
  });

  it('[normal][anti-silent-misread] "19 ส.ค. - 21 ส.ค." (month repeated on both sides) resolves identically — never collapsed to just its start', () => {
    const result = resolveDatesCore('19 ส.ค. - 21 ส.ค.', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-19', endDate: '2026-08-21' }],
      interpretation: expect.any(String),
    });
  });
});

describe('resolveDatesCore — date RANGE, AC-3 form variants (dash + ถึง, with/without month)', () => {
  it('[normal] "19 ถึง 21 สิงหา" (ถึง separator, informal month on the trailing side only) resolves identically', () => {
    const result = resolveDatesCore('19 ถึง 21 สิงหา', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-19', endDate: '2026-08-21' }],
      interpretation: expect.any(String),
    });
  });

  it('[normal] "วันที่ 19 ถึง 21" (วันที่ prefix, ถึง separator, no month at all) resolves identically', () => {
    const result = resolveDatesCore('วันที่ 19 ถึง 21', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-19', endDate: '2026-08-21' }],
      interpretation: expect.any(String),
    });
  });
});

describe('resolveDatesCore — date RANGE, EC-3 (an unrelated trailing number is never swallowed)', () => {
  it('[error/validation] "ต้องการจอง 19-21 สำหรับ 4 คน" anchors on the range only — "4" is never read as part of it', () => {
    const result = resolveDatesCore('ต้องการจอง 19-21 สำหรับ 4 คน', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-19', endDate: '2026-08-21' }],
      interpretation: expect.any(String),
    });
  });
});

describe('resolveDatesCore — date RANGE, EC-1 (monthless, start day already passed this month -> next month)', () => {
  it('[boundary] "5-7" typed on the 13th (both numbers already past THIS month) rolls to NEXT month\'s 5-7', () => {
    const now13th = new Date('2026-08-13T10:00:00Z'); // Bangkok 2026-08-13
    const result = resolveDatesCore('5-7', now13th, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-09-05', endDate: '2026-09-07' }],
      interpretation: expect.any(String),
    });
  });

  it('[normal] a monthless range NOT yet past this month resolves within the SAME month ("19-21" on the 13th)', () => {
    const result = resolveDatesCore('19-21', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-19', endDate: '2026-08-21' }],
      interpretation: expect.any(String),
    });
  });
});

describe('resolveDatesCore — date RANGE, EC-2 (explicit-month range crosses a month boundary)', () => {
  it('[boundary] "30 ส.ค. - 2 ก.ย." (explicit months on both sides, different months) resolves correctly across the boundary', () => {
    const result = resolveDatesCore('30 ส.ค. - 2 ก.ย.', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-30', endDate: '2026-09-02' }],
      interpretation: expect.any(String),
    });
  });
});

describe('resolveDatesCore — date RANGE, BR-2 year handling (พ.ศ. and ค.ศ. both normalize)', () => {
  it('[normal] an explicit Buddhist-era year trailing the range ("19-21 ส.ค. 2569") normalizes to the identical Gregorian span', () => {
    const buddhist = resolveDatesCore('19-21 ส.ค. 2569', NOW, []);
    expect(buddhist).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-19', endDate: '2026-08-21' }],
      interpretation: expect.any(String),
    });
  });

  it('[normal] an explicit Gregorian year on BOTH sides ("19 ส.ค. 2026 - 21 ส.ค. 2026") resolves to the identical span', () => {
    const gregorian = resolveDatesCore('19 ส.ค. 2026 - 21 ส.ค. 2026', NOW, []);
    expect(gregorian).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-19', endDate: '2026-08-21' }],
      interpretation: expect.any(String),
    });
  });
});

describe('resolveDatesCore — date RANGE, BR-3 (a genuinely inverted range is rejected, never silently swapped)', () => {
  it('[error/validation] "21-19" (monthless, neither number past today) resolves per-number then finds itself STILL inverted -> unsupported, never auto-swapped to 19-21', () => {
    const result = resolveDatesCore('21-19', NOW, []);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('[error/validation] an impossible calendar date inside a range ("31 เม.ย. - 2 พ.ค.", April has 30 days) is unsupported, never fabricated', () => {
    const result = resolveDatesCore('31 เม.ย. - 2 พ.ค.', NOW, []);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });
});

describe('resolveDatesCore — date RANGE, null/empty (no day-separator-day shape at all)', () => {
  it('[null/empty] a single number with no second day ("8 คน") never matches the range rule — falls through untouched', () => {
    const result = resolveDatesCore('8 คน', NOW, []);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });
});

describe('resolveDatesCore — date RANGE, regression: never shadows rule 9 (absolute single date) or the cam-645 ISO-date pin', () => {
  it('[regression] a single absolute date ("15 ส.ค.") is NEVER intercepted by the range rule — no separator, no second day, falls through to rule 9 exactly as before', () => {
    const result = resolveDatesCore('15 ส.ค.', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-15', endDate: '2026-08-16' }],
      interpretation: expect.any(String),
    });
  });

  it('[regression] a bare ISO date submitted as text ("2026-08-01") still does NOT parse as a range — the cam-645 pin this ticket\'s regex boundary guard exists to protect', () => {
    const result = resolveDatesCore('2026-08-01', NOW, []);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('[regression] "15/8" (bare numeric D/M, rule 9\'s own "/" form) is unaffected by the "-"-based range rule', () => {
    const result = resolveDatesCore('15/8', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-15', endDate: '2026-08-16' }],
      interpretation: expect.any(String),
    });
  });
});
