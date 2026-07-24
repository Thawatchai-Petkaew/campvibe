/**
 * CAM-462 — lib/ai/tools/resolve-dates.ts (`resolveDatesCore` + `resolveDatesTool`).
 *
 * Coverage matrix:
 *   - normal: พรุ่งนี้ / เสาร์อาทิตย์นี้ / สุดสัปดาห์หน้า / วันหยุดยาวหน้า resolve to
 *     the exact expected ranges (AC-1..AC-3), exclusive-checkout (BR-3)
 *   - normal: a date-SET phrase (เสาร์อาทิตย์ทุกสัปดาห์ของเดือนนี้) resolves to
 *     N ranges, one per remaining weekend this month (AC-4)
 *   - boundary: a full-year date-set phrase is capped BEFORE allocation,
 *     never builds >12 ranges (EC-4/BR-8/CAM-344)
 *   - boundary: Asia/Bangkok tz correctness on a late-night UTC moment that is
 *     already next-day in Bangkok (AC-6); a weekend phrase that crosses a
 *     month/year boundary via plain add-days, never clamped (EC-2)
 *   - error/validation: an unparseable / vague / past-resolving phrase never
 *     fabricates a date (AC-5/EC-1, BR-5)
 *   - null/empty: an unseeded/empty ThaiHoliday table still resolves every
 *     non-holiday phrase; a holiday phrase gracefully no_matches (EC-6)
 *   - error/validation: an invalid/missing `now` falls back to the real
 *     clock and never throws (EC-5)
 *   - security invariant (D1 anti-spoof): jsonSchema/zod parameters expose
 *     ONLY `text` — the model can never supply or spoof `today`/`tz`
 *   - integration: the tool wrapper does the ONE read-only ThaiHoliday fetch
 *     ONLY for a holiday-type phrase (mocked prisma, mirrors
 *     cam-270-check-availability.test.ts's mocking convention)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodObject } from 'zod';

const mockFindMany = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: {
    thaiHoliday: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { resolveDatesCore, resolveDatesArgsSchema, resolveDatesTool, MAX_DATE_SET_RANGES } = await import(
  '@/lib/ai/tools/resolve-dates'
);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveDatesCore — relative phrases (AC-1/AC-2, BR-3 exclusive checkout)', () => {
  it('[unit] "พรุ่งนี้" resolves to tomorrow, one night, exclusive checkout (AC-1)', () => {
    const now = new Date('2026-07-22T10:00:00Z'); // Bangkok civil date 2026-07-22 (Wed)
    const result = resolveDatesCore('พรุ่งนี้', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-23', endDate: '2026-07-24' }],
      interpretation: expect.any(String),
    });
  });

  it('[unit] "มะรืนนี้" resolves to the day after tomorrow', () => {
    const now = new Date('2026-07-22T10:00:00Z');
    const result = resolveDatesCore('มะรืนนี้', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-24', endDate: '2026-07-25' }],
      interpretation: expect.any(String),
    });
  });

  it('[unit] "เสาร์อาทิตย์นี้" from a Wednesday resolves to this Sat->Mon, 2 nights (AC-2)', () => {
    const now = new Date('2026-07-22T10:00:00Z'); // Wednesday
    const result = resolveDatesCore('เสาร์อาทิตย์นี้', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-25', endDate: '2026-07-27' }],
      interpretation: expect.any(String),
    });
  });

  it('[unit] "สุดสัปดาห์หน้า" resolves to next weekend, 7 days after this weekend', () => {
    const now = new Date('2026-07-22T10:00:00Z');
    const result = resolveDatesCore('สุดสัปดาห์หน้า', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-01', endDate: '2026-08-03' }],
      interpretation: expect.any(String),
    });
  });
});

describe('resolveDatesCore — holiday long-weekend phrase (AC-3, BR-4)', () => {
  it('[unit] "วันหยุดยาวหน้า" reads the seeded fixture and expands a single flagged Monday into its adjacent weekend', () => {
    const now = new Date('2026-03-01T10:00:00Z');
    const holidays = [{ date: '2026-04-06', nameTh: 'วันจักรี', isLongWeekend: true }];
    const result = resolveDatesCore('วันหยุดยาวหน้า', now, holidays);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-04-04', endDate: '2026-04-07' }],
      interpretation: expect.any(String),
    });
  });

  it('[unit] groups a multi-day contiguous holiday run (Songkran-style) into ONE range', () => {
    const now = new Date('2026-03-01T10:00:00Z');
    const holidays = [
      { date: '2026-04-13', nameTh: 'วันสงกรานต์', isLongWeekend: true },
      { date: '2026-04-14', nameTh: 'วันสงกรานต์', isLongWeekend: true },
      { date: '2026-04-15', nameTh: 'วันสงกรานต์', isLongWeekend: true },
    ];
    const result = resolveDatesCore('วันหยุดยาวหน้า', now, holidays);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dates).toEqual([{ startDate: '2026-04-11', endDate: '2026-04-16' }]);
    }
  });

  it('[unit] a non-flagged holiday row is never treated as a long weekend', () => {
    const now = new Date('2026-08-01T10:00:00Z');
    const holidays = [{ date: '2026-08-12', nameTh: 'วันแม่แห่งชาติ', isLongWeekend: false }];
    const result = resolveDatesCore('วันหยุดยาวหน้า', now, holidays);
    expect(result).toEqual({ ok: false, reason: 'no_match' });
  });
});

describe('resolveDatesCore — date-SET (AC-4) + MAX cap (EC-4/BR-8/CAM-344)', () => {
  it('[unit] "เสาร์อาทิตย์ทุกสัปดาห์ของเดือนนี้" returns one range per remaining weekend this month', () => {
    const now = new Date('2026-07-01T10:00:00Z'); // Wednesday, July 2026 has 4 Saturdays
    const result = resolveDatesCore('เสาร์อาทิตย์ทุกสัปดาห์ของเดือนนี้', now, []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dates).toEqual([
        { startDate: '2026-07-04', endDate: '2026-07-06' },
        { startDate: '2026-07-11', endDate: '2026-07-13' },
        { startDate: '2026-07-18', endDate: '2026-07-20' },
        { startDate: '2026-07-25', endDate: '2026-07-27' },
      ]);
    }
  });

  it('[unit] MAX_DATE_SET_RANGES is 12 (the CAM-344 pre-loop cap)', () => {
    expect(MAX_DATE_SET_RANGES).toBe(12);
  });

  it('[unit] a full-year date-set phrase ("ทุกวันเสาร์ปีนี้") is capped BEFORE allocation — too_many, never builds >12 ranges', () => {
    const now = new Date('2026-01-01T10:00:00Z');
    const result = resolveDatesCore('ทุกวันเสาร์ปีนี้', now, []);
    expect(result).toEqual({ ok: false, reason: 'too_many' });
  });
});

describe('resolveDatesCore — Asia/Bangkok tz correctness (AC-6) + month/year boundary (EC-2)', () => {
  it('[unit] a late-night UTC moment already next-day in Bangkok resolves against the Bangkok date, not the UTC date', () => {
    // 2026-07-24T20:00:00Z + 7h = 2026-07-25T03:00 Bangkok (Saturday) — a naive
    // UTC-calendar read would say "today" is 2026-07-24 (Friday) and compute
    // tomorrow = 07-25; the correct Bangkok-anchored answer is 07-26.
    const now = new Date('2026-07-24T20:00:00Z');
    const result = resolveDatesCore('พรุ่งนี้', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-26', endDate: '2026-07-27' }],
      interpretation: expect.any(String),
    });
  });

  it('[unit] "เสาร์อาทิตย์นี้" crosses a month boundary without clamping to the last day of the month (EC-2)', () => {
    const now = new Date('2026-07-30T10:00:00Z'); // Thursday
    const result = resolveDatesCore('เสาร์อาทิตย์นี้', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-01', endDate: '2026-08-03' }],
      interpretation: expect.any(String),
    });
  });

  it('[unit] "เสาร์อาทิตย์นี้" crosses a year boundary without clamping to Dec 31 (EC-2)', () => {
    const now = new Date('2026-12-30T10:00:00Z'); // Wednesday
    const result = resolveDatesCore('เสาร์อาทิตย์นี้', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2027-01-02', endDate: '2027-01-04' }],
      interpretation: expect.any(String),
    });
  });
});

describe('resolveDatesCore — never fabricates a date (BR-5, AC-5/EC-1)', () => {
  it('[unit] a past-resolving phrase ("เมื่อวาน") is unsupported, never resolved (EC-1)', () => {
    const result = resolveDatesCore('เมื่อวาน', new Date('2026-07-22T10:00:00Z'), []);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('[unit] a vague phrase ("ช่วงนี้") is ambiguous, never resolved (AC-5)', () => {
    const result = resolveDatesCore('ช่วงนี้', new Date('2026-07-22T10:00:00Z'), []);
    expect(result).toEqual({ ok: false, reason: 'ambiguous' });
  });

  it('[unit] a completely unparseable phrase is unsupported (no rule matched, BR-5)', () => {
    const result = resolveDatesCore('อยากไปเที่ยวทะเลบ้าง', new Date('2026-07-22T10:00:00Z'), []);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });
});

describe('resolveDatesCore — null/empty ThaiHoliday (EC-6)', () => {
  it('[unit] an empty/unseeded holiday table still resolves a relative-day phrase', () => {
    const result = resolveDatesCore('พรุ่งนี้', new Date('2026-07-22T10:00:00Z'), []);
    expect(result.ok).toBe(true);
  });

  it('[unit] a holiday phrase against an empty table gracefully no_matches, never throws', () => {
    const result = resolveDatesCore('วันหยุดยาวหน้า', new Date('2026-07-22T10:00:00Z'), []);
    expect(result).toEqual({ ok: false, reason: 'no_match' });
  });
});

describe('resolveDatesCore — invalid/missing `now` never throws (EC-5)', () => {
  it('[unit] an invalid (NaN) injected `now` falls back to the real clock and still resolves', () => {
    expect(() => resolveDatesCore('พรุ่งนี้', new Date('not-a-date'), [])).not.toThrow();
    const result = resolveDatesCore('พรุ่งนี้', new Date('not-a-date'), []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dates[0]!.startDate).toMatch(ISO_DATE_RE);
      expect(result.dates[0]!.endDate).toMatch(ISO_DATE_RE);
    }
  });

  it('[unit] a missing `now` argument (default) resolves against the real current clock, never throws', () => {
    expect(() => resolveDatesCore('พรุ่งนี้')).not.toThrow();
    expect(resolveDatesCore('พรุ่งนี้').ok).toBe(true);
  });
});

describe('resolveDatesTool — anti-spoof: model-facing contract exposes ONLY `text` (D1)', () => {
  it('[security] jsonSchema.properties has ONLY `text` — no `today`/`tz`', () => {
    const properties = resolveDatesTool.jsonSchema.properties as Record<string, unknown>;
    expect(Object.keys(properties)).toEqual(['text']);
  });

  it('[security] the zod parameters shape has ONLY `text`', () => {
    expect(resolveDatesArgsSchema).toBeInstanceOf(ZodObject);
    expect(Object.keys(resolveDatesArgsSchema.shape)).toEqual(['text']);
  });

  it('[unit] tier is "guest" (no identity required, same as checkAvailability)', () => {
    expect(resolveDatesTool.tier).toBe('guest');
  });

  it('[error/validation] rejects an empty text string at the schema boundary', () => {
    expect(resolveDatesArgsSchema.safeParse({ text: '' }).success).toBe(false);
  });
});

describe('resolveDatesTool.execute — the ONE read-only ThaiHoliday fetch, only for a holiday phrase', () => {
  it('[integration] does NOT query ThaiHoliday for a non-holiday phrase', async () => {
    const result = await resolveDatesTool.execute({ text: 'พรุ่งนี้' }, {});
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it('[integration] queries ThaiHoliday (isLongWeekend:true only) for a holiday phrase and resolves from the DB row', async () => {
    // A far-future date so this assertion never goes stale/flaky against the
    // real wall clock (the wrapper always resolves "today" from the real
    // clock — see EC-5/D1 — so the fixture must stay ahead of "today" for
    // the life of this test).
    mockFindMany.mockResolvedValueOnce([
      { date: new Date('2099-04-06T00:00:00.000Z'), nameTh: 'ทดสอบวันหยุดยาว', isLongWeekend: true },
    ]);

    const result = await resolveDatesTool.execute({ text: 'วันหยุดยาวหน้า' }, {});

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { isLongWeekend: true },
      orderBy: { date: 'asc' },
      select: { date: true, nameTh: true, isLongWeekend: true },
    });
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2099-04-04', endDate: '2099-04-07' }],
      interpretation: expect.any(String),
    });
  });

  it('[integration] an empty ThaiHoliday query result no_matches gracefully (EC-6)', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const result = await resolveDatesTool.execute({ text: 'วันหยุดยาวหน้า' }, {});
    expect(result).toEqual({ ok: false, reason: 'no_match' });
  });
});

describe('resolveDates — registered as a guest-tier tool (D1 Confirmation)', () => {
  it('[integration] resolveDates is present in getRegisteredTools("guest") after the real side-effect import', async () => {
    const { getRegisteredTools } = await import('@/lib/ai/tool-registry');
    await import('@/lib/ai/tools/index');
    const guestTools = getRegisteredTools('guest');
    expect(guestTools.some((tool) => tool.name === 'resolveDates')).toBe(true);
  });
});
