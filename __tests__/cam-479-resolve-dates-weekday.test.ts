/**
 * CAM-479 (F1 production bug fix) — `resolveDatesCore` had a compound
 * weekend rule ("เสาร์อาทิตย์นี้/หน้า", "สุดสัปดาห์นี้/หน้า") but NO rule for a
 * SINGLE Thai weekday ("เสาร์หน้า"/"เสาร์นี้"/"ศุกร์หน้า"/"เสาร์ที่จะถึง"), so
 * those phrases fell through to `{ ok:false, reason:'unsupported' }` and the
 * assistant looped asking the camper for an explicit date.
 *
 * Prove-It coverage:
 *  - the exact failing phrases from the ticket now resolve (เสาร์หน้า/เสาร์นี้/
 *    ศุกร์หน้า/เสาร์ที่จะถึง), pinned against a fixed `now` (Wednesday)
 *  - หน้า-vs-นี้ pair: "เสาร์หน้า" == "เสาร์นี้" result + 7 days, from the SAME `now`
 *  - "นี้" on the exact matching weekday counts TODAY (not skipped to next week)
 *  - bare weekday (no modifier) behaves like "นี้"
 *  - optional "วัน" prefix ("วันเสาร์หน้า") resolves identically to "เสาร์หน้า"
 *  - long/short Thursday spelling (พฤหัสบดี/พฤหัส) both resolve to Thursday,
 *    and the modifier ("หน้า") is still captured correctly for the long form
 *    (regression guard for alternation-order truncation)
 *  - regression: the compound weekend phrase "เสาร์อาทิตย์นี้" still resolves
 *    to the 2-night WEEKEND range, never a single Saturday
 *  - a past-day phrase ("เมื่อวาน") remains unsupported (untouched by this fix)
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

describe('resolveDatesCore — single weekday (F1/CAM-479)', () => {
  it('[normal] "เสาร์หน้า" from a Wednesday resolves to next week\'s Saturday, one night', () => {
    const now = new Date('2026-07-22T10:00:00Z'); // Bangkok Wednesday 2026-07-22
    const result = resolveDatesCore('เสาร์หน้า ภูทับเบิกว่างไหม', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-01', endDate: '2026-08-02' }],
      interpretation: expect.any(String),
    });
  });

  it('[normal] "เสาร์นี้" from a Wednesday resolves to THIS week\'s Saturday, one night', () => {
    const now = new Date('2026-07-22T10:00:00Z');
    const result = resolveDatesCore('เสาร์นี้ ลานสนธรรมชาติว่างไหม', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-25', endDate: '2026-07-26' }],
      interpretation: expect.any(String),
    });
  });

  it('[normal] "ศุกร์หน้า" from a Wednesday resolves to next week\'s Friday, one night', () => {
    const now = new Date('2026-07-22T10:00:00Z');
    const result = resolveDatesCore('ศุกร์หน้าไปได้ไหม', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-31', endDate: '2026-08-01' }],
      interpretation: expect.any(String),
    });
  });

  it('[normal] "เสาร์ที่จะถึง" behaves like "เสาร์นี้" (next occurrence on/after today, no +7)', () => {
    const now = new Date('2026-07-22T10:00:00Z');
    const result = resolveDatesCore('เสาร์ที่จะถึงว่างไหม', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-25', endDate: '2026-07-26' }],
      interpretation: expect.any(String),
    });
  });

  it('[normal] a bare weekday with NO modifier ("เสาร์") behaves like "นี้"', () => {
    const now = new Date('2026-07-22T10:00:00Z');
    const result = resolveDatesCore('เสาร์ว่างไหม', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-25', endDate: '2026-07-26' }],
      interpretation: expect.any(String),
    });
  });

  it('[normal] the optional "วัน" prefix ("วันเสาร์หน้า") resolves identically to "เสาร์หน้า"', () => {
    const now = new Date('2026-07-22T10:00:00Z');
    const withPrefix = resolveDatesCore('วันเสาร์หน้า', now, []);
    const withoutPrefix = resolveDatesCore('เสาร์หน้า', now, []);
    expect(withPrefix).toEqual(withoutPrefix);
    expect(withPrefix).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-01', endDate: '2026-08-02' }],
      interpretation: expect.any(String),
    });
  });

  it('[boundary] "นี้" on the exact matching weekday counts TODAY, never skips to next week', () => {
    const now = new Date('2026-07-25T10:00:00Z'); // Bangkok Saturday 2026-07-25
    const result = resolveDatesCore('เสาร์นี้ว่างไหม', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-25', endDate: '2026-07-26' }],
      interpretation: expect.any(String),
    });
  });

  it('[pair] หน้า-vs-นี้: "เสาร์หน้า" == "เสาร์นี้" result + 7 days, from the SAME `now`', () => {
    const now = new Date('2026-07-22T10:00:00Z');
    const thisSat = resolveDatesCore('เสาร์นี้', now, []);
    const nextSat = resolveDatesCore('เสาร์หน้า', now, []);
    expect(thisSat.ok).toBe(true);
    expect(nextSat.ok).toBe(true);
    if (thisSat.ok && nextSat.ok) {
      expect(nextSat.dates[0]!.startDate).toBe('2026-08-01');
      expect(thisSat.dates[0]!.startDate).toBe('2026-07-25');
      // exactly 7 days apart
      const diffMs =
        new Date(`${nextSat.dates[0]!.startDate}T00:00:00Z`).getTime() -
        new Date(`${thisSat.dates[0]!.startDate}T00:00:00Z`).getTime();
      expect(diffMs / 86_400_000).toBe(7);
    }
  });

  it('[edge] long-form "พฤหัสบดีหน้า" resolves to next week\'s Thursday (alternation-order regression guard)', () => {
    const now = new Date('2026-07-22T10:00:00Z'); // Wednesday
    const result = resolveDatesCore('พฤหัสบดีหน้าไปได้ไหม', now, []);
    // Thursday this week = 2026-07-23; "หน้า" = +7 = 2026-07-30.
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-30', endDate: '2026-07-31' }],
      interpretation: expect.any(String),
    });
  });

  it('[edge] short-form "พฤหัสหน้า" resolves to the SAME date as the long form', () => {
    const now = new Date('2026-07-22T10:00:00Z');
    const long = resolveDatesCore('พฤหัสบดีหน้า', now, []);
    const short = resolveDatesCore('พฤหัสหน้า', now, []);
    expect(short).toEqual(long);
  });

  it('[regression] the compound weekend phrase "เสาร์อาทิตย์นี้" still resolves to the 2-night WEEKEND range, never a single Saturday', () => {
    const now = new Date('2026-07-22T10:00:00Z');
    const result = resolveDatesCore('เสาร์อาทิตย์นี้', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-25', endDate: '2026-07-27' }],
      interpretation: expect.any(String),
    });
  });

  it('[regression] "เสาร์อาทิตย์หน้า" still resolves to the 2-night WEEKEND range', () => {
    const now = new Date('2026-07-22T10:00:00Z');
    const result = resolveDatesCore('เสาร์อาทิตย์หน้า', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-01', endDate: '2026-08-03' }],
      interpretation: expect.any(String),
    });
  });

  it('[unchanged] a past-day phrase ("เมื่อวาน") remains unsupported', () => {
    const result = resolveDatesCore('เมื่อวาน', new Date('2026-07-22T10:00:00Z'), []);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('[unchanged] a garbage/vague phrase with no weekday or known rule remains unsupported', () => {
    const result = resolveDatesCore('จะไปไหนดีคะ', new Date('2026-07-22T10:00:00Z'), []);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });

  // --- AC-4 coverage gap-fill (QA verify): the story/AC claims "all 7 Thai
  // weekday names" but the original test file only exercised เสาร์/ศุกร์/
  // พฤหัส(บดี). Closing the remaining 4 individually so AC-4's claim is
  // actually proven, not just implied by the THAI_WEEKDAY_INDEX map. ---
  it('[edge][AC-4] "จันทร์นี้" resolves to this week\'s Monday', () => {
    const now = new Date('2026-07-22T10:00:00Z'); // Wednesday
    const result = resolveDatesCore('จันทร์นี้ว่างไหม', now, []);
    // Monday this week (2026-07-20) already passed relative to Wed 22nd, so
    // "on or after today" rolls to NEXT Monday, 2026-07-27.
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-27', endDate: '2026-07-28' }],
      interpretation: expect.any(String),
    });
  });

  it('[edge][AC-4] "อังคารหน้า" resolves to next week\'s Tuesday', () => {
    const now = new Date('2026-07-22T10:00:00Z'); // Wednesday
    const result = resolveDatesCore('อังคารหน้าไปได้ไหม', now, []);
    // Tuesday this week already passed (2026-07-21); "นี้" occurrence rolls
    // to 2026-07-28; "หน้า" = +7 = 2026-08-04.
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-04', endDate: '2026-08-05' }],
      interpretation: expect.any(String),
    });
  });

  it('[edge][AC-4] "พุธนี้" on the exact matching weekday counts TODAY', () => {
    const now = new Date('2026-07-22T10:00:00Z'); // Wednesday
    const result = resolveDatesCore('พุธนี้ว่างไหม', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-22', endDate: '2026-07-23' }],
      interpretation: expect.any(String),
    });
  });

  it('[edge][AC-4] "อาทิตย์นี้" (bare) resolves to the day Sunday, not a past Sunday', () => {
    const now = new Date('2026-07-22T10:00:00Z'); // Wednesday
    const result = resolveDatesCore('อาทิตย์นี้ว่างไหม', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-26', endDate: '2026-07-27' }],
      interpretation: expect.any(String),
    });
  });

  it('[boundary] week-boundary math also holds when `now` IS a Saturday (not just Wednesday): "เสาร์หน้า" = today + 7', () => {
    const now = new Date('2026-07-25T10:00:00Z'); // Bangkok Saturday 2026-07-25
    const result = resolveDatesCore('เสาร์หน้าว่างไหม', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-01', endDate: '2026-08-02' }],
      interpretation: expect.any(String),
    });
  });

  it('[boundary] from a Saturday `now`, a different weekday\'s "นี้" crosses into the following week correctly (e.g. "จันทร์นี้" = the upcoming Monday, 2 days later)', () => {
    const now = new Date('2026-07-25T10:00:00Z'); // Saturday
    const result = resolveDatesCore('จันทร์นี้ว่างไหม', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-27', endDate: '2026-07-28' }],
      interpretation: expect.any(String),
    });
  });

  // --- KNOWN LIMITATION (QA finding, reported not fixed here — see the QA
  // verify report): bare "อาทิตย์" is genuinely ambiguous in colloquial Thai
  // between "Sunday" (a day) and "week" (a duration unit, e.g. "อาทิตย์หน้า"
  // very commonly means "next week", not "next Sunday"). BR-1 explicitly
  // requires อาทิตย์ to be matched as one of the 7 weekday names, so this is
  // spec-conformant, not a code defect — but it is a real production risk
  // this pins deliberately so a future change is a conscious decision, not
  // an accidental behavior change. ---
  it('[documented-limitation] "อาทิตย์หน้า" resolves as "next Sunday" (day), NOT "next week" (duration) — matches BR-1 as written; flagged as a QA finding for follow-up', () => {
    const now = new Date('2026-07-22T10:00:00Z'); // Wednesday
    const result = resolveDatesCore('อาทิตย์หน้าไปเที่ยวกัน', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-08-02', endDate: '2026-08-03' }],
      interpretation: expect.any(String),
    });
  });

  // --- KNOWN LIMITATION (QA finding): a two-weekday RANGE phrase ("Monday
  // to next Friday") is not recognized as a range at all — the unanchored
  // regex matches only the FIRST weekday name it finds and silently drops
  // the rest of the phrase, producing a single-night date instead of
  // signaling unsupported/ambiguous. Pinned so a future change here is
  // deliberate, not accidental. ---
  it('[documented-limitation] a two-weekday RANGE phrase ("จันทร์ถึงศุกร์หน้า") silently collapses to just the FIRST weekday as a single night, dropping the range', () => {
    const now = new Date('2026-07-22T10:00:00Z'); // Wednesday
    const result = resolveDatesCore('จันทร์ถึงศุกร์หน้า', now, []);
    expect(result).toEqual({
      ok: true,
      dates: [{ startDate: '2026-07-27', endDate: '2026-07-28' }],
      interpretation: expect.any(String),
    });
  });
});
