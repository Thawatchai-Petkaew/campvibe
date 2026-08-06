/**
 * CAM-645 — the absolute-Thai-date rule added to `resolveDatesCore`
 * (`lib/ai/date-phrases.ts`, epic CAM-630/CAM-695 S9 slice).
 *
 * THE GAP (RED, verified behaviourally before this change, not assumed):
 * before this story, `resolveDatesCore` had 9 rules and NONE handled an
 * absolute day+Thai-month phrase, even though the shipped copy
 * (`aiChat.booking.date.typeHint` / `date.unreadable`,
 * `locales/translations.json`) promises "15 ส.ค." works. Confirmed by
 * temporarily reverting this story's code change and calling the REAL
 * (pre-change) `resolveDatesCore` directly:
 *
 *   resolveDatesCore('15 ส.ค.', new Date('2026-07-22T10:00:00Z'), [])
 *   -> { ok: false, reason: 'unsupported' }          (RED, pre-change)
 *
 * every case below asserts the NEW resolved behavior (GREEN, post-change);
 * the pinned KNOWN LIMITATION this closes lived at
 * `__tests__/cam-633-booking-flow.test.ts` (superseded there with a dated
 * note, not deleted).
 *
 * Coverage matrix:
 *   - normal: abbreviated month with/without trailing dot ("15 ส.ค." /
 *     "15 ส.ค"), full month name ("15 สิงหาคม"), informal truncated month
 *     with the optional "วันที่" prefix ("วันที่ 15 สิงหา"), bare numeric d/m
 *     ("15/8") — all four resolve to the SAME 2026-08-15 from the same `now`
 *   - normal: an explicit Gregorian year ("15 สิงหาคม 2026") and an explicit
 *     Buddhist-era year ("15 สิงหาคม 2569") both resolve to the identical
 *     Gregorian ISO date (BE - 543 = CE)
 *   - normal: no year given rolls to the NEXT occurrence — this year when
 *     the day+month has not yet passed, next year when it has
 *   - boundary: a day+month exactly equal to today resolves to TODAY, not
 *     pushed to next year
 *   - error/validation: an explicit PAST year rejects through rule 8/9's
 *     (formerly rule 8's) existing `unsupported` shape — no new rejection
 *     reason invented (BR-5)
 *   - error/validation: an impossible calendar date (30 ก.พ., Feb 30) is
 *     never fabricated — unsupported, not silently clamped
 *   - null/empty: a bare day+month never itself resolves to the past
 *     (mathematically excluded by the next-occurrence rule)
 *   - regression: every existing relative/holiday/weekday phrase from
 *     cam-462/cam-479 is untouched by the new rule (no shadowing)
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

const NOW = new Date('2026-07-22T10:00:00Z'); // Bangkok Wednesday 2026-07-22 (same fixture as cam-479/cam-633)

describe('resolveDatesCore — absolute Thai date (CAM-645), day+month form variants', () => {
  it('[normal][red-first] "15 ส.ค." (abbreviated month, trailing dot) resolves to 2026-08-15, one night — was {ok:false, reason:"unsupported"} before this story', () => {
    const result = resolveDatesCore('15 ส.ค.', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-15', endDate: '2026-08-16' }],
      interpretation: expect.any(String),
    });
  });

  it('[normal] "15 ส.ค" (abbreviated month, NO trailing dot) resolves to the IDENTICAL date', () => {
    const withDot = resolveDatesCore('15 ส.ค.', NOW, []);
    const noDot = resolveDatesCore('15 ส.ค', NOW, []);
    expect(noDot).toEqual(withDot);
  });

  it('[normal] "วันที่ 15 สิงหา" (optional วันที่ prefix + informal truncated month) resolves to the IDENTICAL date', () => {
    const result = resolveDatesCore('วันที่ 15 สิงหา', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-15', endDate: '2026-08-16' }],
      interpretation: expect.any(String),
    });
  });

  it('[normal] "15 สิงหาคม" (full month name, no วันที่ prefix) resolves to the IDENTICAL date', () => {
    const result = resolveDatesCore('15 สิงหาคม', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-15', endDate: '2026-08-16' }],
      interpretation: expect.any(String),
    });
  });

  it('[normal] "15/8" (bare numeric D/M) resolves to the IDENTICAL date', () => {
    const result = resolveDatesCore('15/8', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-15', endDate: '2026-08-16' }],
      interpretation: expect.any(String),
    });
  });

  it('[edge] the full name is tried before its informal truncation — "15 สิงหาคม 2569" still reads the trailing year correctly (regression guard for alternation-order truncation, mirrors cam-479\'s พฤหัสบดี/พฤหัส guard)', () => {
    const result = resolveDatesCore('15 สิงหาคม 2569', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-15', endDate: '2026-08-16' }],
      interpretation: expect.any(String),
    });
  });
});

describe('resolveDatesCore — absolute Thai date, year handling (CAM-645 ticket spec)', () => {
  it('[normal] an explicit Gregorian 4-digit year ("15 สิงหาคม 2026") resolves to that exact year, unchanged', () => {
    const result = resolveDatesCore('15 สิงหาคม 2026', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-15', endDate: '2026-08-16' }],
      interpretation: expect.any(String),
    });
  });

  it('[normal] an explicit Buddhist-era 4-digit year ("15 สิงหาคม 2569") converts to the IDENTICAL Gregorian date as the 2026 case (2569 - 543 = 2026)', () => {
    const gregorian = resolveDatesCore('15 สิงหาคม 2026', NOW, []);
    const buddhist = resolveDatesCore('15 สิงหาคม 2569', NOW, []);
    expect(buddhist).toEqual(gregorian);
  });

  it('[normal] no year given AND the day+month has not yet passed this year -> resolves to THIS year (15 ส.ค. from a July 22 `now`)', () => {
    const result = resolveDatesCore('15 ส.ค.', NOW, []);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.dates[0]!.startDate).toBe('2026-08-15');
  });

  it('[normal] no year given AND the day+month has ALREADY passed this year -> rolls to NEXT year ("1 ม.ค." from a July 22 `now`, Jan 1 already gone)', () => {
    const result = resolveDatesCore('1 ม.ค.', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2027-01-01', endDate: '2027-01-02' }],
      interpretation: expect.any(String),
    });
  });

  it('[boundary] a day+month exactly equal to TODAY resolves to today, not pushed to next year', () => {
    const result = resolveDatesCore('22 ก.ค.', NOW, []); // NOW is Bangkok 2026-07-22
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-22', endDate: '2026-07-23' }],
      interpretation: expect.any(String),
    });
  });

  it('[null/empty] a bare day+month (no year) can never itself resolve to a PAST date — the next-occurrence rule mathematically excludes it (every date returned is >= todayISO)', () => {
    // Sweep every month; each result must be today-or-future, never past.
    const todayISO = '2026-07-22';
    for (const phrase of ['1 ม.ค.', '1 ก.พ.', '1 มี.ค.', '1 ธ.ค.', '22 ก.ค.']) {
      const result = resolveDatesCore(phrase, NOW, []);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.dates[0]!.startDate >= todayISO).toBe(true);
    }
  });
});

describe('resolveDatesCore — absolute Thai date, past-date rejection reuses rule 9\'s existing shape (CAM-645: "reject through the EXISTING rule 8 path, not a new one")', () => {
  it('[error/validation] an EXPLICIT past year ("1 ม.ค. 2568" = 2025 CE, before the 2026-07-22 `now`) rejects via {ok:false, reason:"unsupported"} — the SAME shape rule 9 (formerly rule 8, "เมื่อวาน") already returns, no new rejection reason invented', () => {
    const explicitPast = resolveDatesCore('1 ม.ค. 2568', NOW, []);
    const existingPastPhrase = resolveDatesCore('เมื่อวาน', NOW, []);
    expect(explicitPast).toEqual({ ok: false, reason: 'unsupported' });
    expect(explicitPast).toEqual(existingPastPhrase);
  });

  it('[error/validation] an explicit past Gregorian year ("15 ส.ค. 2020") also rejects the same way', () => {
    const result = resolveDatesCore('15 ส.ค. 2020', NOW, []);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('[boundary] an explicit year landing exactly ON today is accepted (not rejected as past)', () => {
    const result = resolveDatesCore('22 ก.ค. 2026', NOW, []);
    expect(result.ok).toBe(true);
  });
});

describe('resolveDatesCore — absolute Thai date, never fabricates an impossible calendar date (BR-5)', () => {
  it('[error/validation] "30 ก.พ." (February has no 30th day, in any year) is unsupported, never silently clamped to Mar 1 or Feb 28', () => {
    const result = resolveDatesCore('30 ก.พ.', NOW, []);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('[error/validation] an explicit-year impossible date ("31 เม.ย. 2569", April has 30 days) is unsupported', () => {
    const result = resolveDatesCore('31 เม.ย. 2569', NOW, []);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });
});

describe('resolveDatesCore — absolute-date rule never shadows the existing 9 rules (regression, CAM-462/CAM-479 untouched)', () => {
  it('[regression] "พรุ่งนี้" (tomorrow) still resolves exactly as before', () => {
    const result = resolveDatesCore('พรุ่งนี้', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-23', endDate: '2026-07-24' }],
      interpretation: expect.any(String),
    });
  });

  it('[regression] "เสาร์หน้า" (single weekday) still resolves exactly as before', () => {
    const result = resolveDatesCore('เสาร์หน้า', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-01', endDate: '2026-08-02' }],
      interpretation: expect.any(String),
    });
  });

  it('[regression] "เสาร์อาทิตย์นี้" (compound weekend) still resolves to the 2-night weekend, never intercepted by the numeric/month rule', () => {
    const result = resolveDatesCore('เสาร์อาทิตย์นี้', NOW, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-25', endDate: '2026-07-27' }],
      interpretation: expect.any(String),
    });
  });

  it('[regression] a bare ISO date submitted as text ("2026-08-01") still does NOT parse — dashes are not the numeric-D/M rule\'s "/" separator, and there is no Thai month alias present', () => {
    const result = resolveDatesCore('2026-08-01', NOW, []);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('[regression] a guests-step-shaped text ("8 คน") passed through this resolver never matches the numeric D/M rule (no "/" present)', () => {
    const result = resolveDatesCore('8 คน', NOW, []);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('[regression] "เมื่อวาน" (yesterday) remains unsupported, untouched by the new rule', () => {
    const result = resolveDatesCore('เมื่อวาน', NOW, []);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('[regression] "ช่วงนี้" (vague) remains ambiguous, untouched by the new rule', () => {
    const result = resolveDatesCore('ช่วงนี้', NOW, []);
    expect(result).toEqual({ ok: false, reason: 'ambiguous' });
  });
});
