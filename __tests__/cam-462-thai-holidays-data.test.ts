/**
 * CAM-462 — `prisma/data/thai-holidays.json` completeness + BR-4 derivation
 * guard (D2 Confirmation). Pure JSON assertions, no DB — this proves the
 * seed DATA itself is well-shaped and that `isLongWeekend` is not a second,
 * unverifiable source of truth: it is RE-DERIVED here from the row set +
 * weekday math (independent of how `prisma/seed.ts`/the row set was built)
 * and must match every stored flag exactly.
 *
 * Coverage matrix:
 *   - normal: every row has a valid `YYYY-MM-DD` date, non-empty nameTh, a
 *     boolean isLongWeekend
 *   - boundary: unique dates; covers both the current (2026) and next (2027)
 *     calendar year with a reasonable row count (~20-40/yr per BR-4)
 *   - seam invariant (D2 Confirmation): every `isLongWeekend:true` row
 *     actually sits in a real >=3-day contiguous non-working span (weekend +
 *     holiday adjacency); every `isLongWeekend:false` row does NOT
 */
import { describe, it, expect } from 'vitest';
import thaiHolidays from '@/prisma/data/thai-holidays.json';

interface HolidayRow {
  date: string;
  nameTh: string;
  isLongWeekend: boolean;
}

const rows = thaiHolidays as HolidayRow[];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function weekdayOfISO(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
}

function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Independent re-derivation of BR-4's "contiguous >=3-day non-working span"
 * rule: the non-working calendar is every Saturday/Sunday across the row
 * set's date window, PLUS every holiday date itself. Group into contiguous
 * spans; a date is "in a long weekend" iff its span length >= 3.
 */
function computeLongWeekendDates(allRows: HolidayRow[]): Set<string> {
  const holidayDates = allRows.map((r) => r.date).sort();
  const minDate = holidayDates[0]!;
  const maxDate = holidayDates[holidayDates.length - 1]!;

  const nonWorking = new Set<string>();
  let cur = minDate;
  while (cur <= maxDate) {
    const wd = weekdayOfISO(cur);
    if (wd === 0 || wd === 6) nonWorking.add(cur);
    cur = addDaysISO(cur, 1);
  }
  for (const d of holidayDates) nonWorking.add(d);

  const sorted = Array.from(nonWorking).sort();
  const spans: Array<{ start: string; end: string }> = [];
  let spanStart: string | null = null;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev === null) {
      spanStart = d;
    } else if (addDaysISO(prev, 1) !== d) {
      spans.push({ start: spanStart!, end: prev });
      spanStart = d;
    }
    prev = d;
  }
  if (spanStart !== null) spans.push({ start: spanStart, end: prev! });

  const longDates = new Set<string>();
  for (const span of spans) {
    const lengthDays = Math.round(
      (new Date(`${span.end}T12:00:00Z`).getTime() - new Date(`${span.start}T12:00:00Z`).getTime()) / 86_400_000
    ) + 1;
    if (lengthDays < 3) continue;
    let d = span.start;
    while (d <= span.end) {
      longDates.add(d);
      d = addDaysISO(d, 1);
    }
  }
  return longDates;
}

describe('thai-holidays.json — shape + completeness (CAM-462 BR-4 normal)', () => {
  it('[unit] every row has a valid YYYY-MM-DD date, non-empty nameTh, and a boolean isLongWeekend', () => {
    for (const row of rows) {
      expect(row.date).toMatch(ISO_DATE_RE);
      expect(Number.isNaN(new Date(`${row.date}T00:00:00Z`).getTime())).toBe(false);
      expect(row.nameTh.length).toBeGreaterThan(0);
      expect(typeof row.isLongWeekend).toBe('boolean');
    }
  });

  it('[unit] covers the current year (2026) and the next year (2027)', () => {
    const years = new Set(rows.map((r) => r.date.slice(0, 4)));
    expect(years.has('2026')).toBe(true);
    expect(years.has('2027')).toBe(true);
  });

  it('[unit] each seeded year has a reasonable row count (~20-40/yr, BR-4)', () => {
    const y2026 = rows.filter((r) => r.date.startsWith('2026')).length;
    const y2027 = rows.filter((r) => r.date.startsWith('2027')).length;
    expect(y2026).toBeGreaterThanOrEqual(15);
    expect(y2026).toBeLessThanOrEqual(40);
    expect(y2027).toBeGreaterThanOrEqual(15);
    expect(y2027).toBeLessThanOrEqual(40);
  });
});

describe('thai-holidays.json — uniqueness (CAM-462 BR-4 boundary)', () => {
  it('[unit] every date is unique (the ThaiHoliday PK)', () => {
    const dates = rows.map((r) => r.date);
    expect(new Set(dates).size).toBe(rows.length);
  });
});

describe('thai-holidays.json — isLongWeekend re-derivation guard (CAM-462 D2 Confirmation, seam invariant)', () => {
  const derivedLongDates = computeLongWeekendDates(rows);

  it('[unit] every isLongWeekend:true row actually sits in a real >=3-day contiguous non-working span', () => {
    const trueRows = rows.filter((r) => r.isLongWeekend);
    expect(trueRows.length).toBeGreaterThan(0); // guard: the invariant is meaningless with zero flagged rows
    for (const row of trueRows) {
      expect(derivedLongDates.has(row.date), `${row.date} (${row.nameTh}) is flagged true but is not in a >=3-day span`).toBe(
        true
      );
    }
  });

  it('[unit] every isLongWeekend:false row does NOT sit in a >=3-day contiguous non-working span', () => {
    const falseRows = rows.filter((r) => !r.isLongWeekend);
    expect(falseRows.length).toBeGreaterThan(0);
    for (const row of falseRows) {
      expect(derivedLongDates.has(row.date), `${row.date} (${row.nameTh}) is flagged false but IS in a >=3-day span`).toBe(
        false
      );
    }
  });
});

describe('thai-holidays.json — spot checks (CAM-462 normal)', () => {
  it('[unit] New Year\'s Day (2026-01-01) is present', () => {
    const row = rows.find((r) => r.date === '2026-01-01');
    expect(row?.nameTh).toBe('วันขึ้นปีใหม่');
  });

  it('[unit] Songkran 2026 (Apr 13-15) is present and flagged as a long weekend', () => {
    for (const date of ['2026-04-13', '2026-04-14', '2026-04-15']) {
      const row = rows.find((r) => r.date === date);
      expect(row).toBeDefined();
      expect(row?.isLongWeekend).toBe(true);
    }
  });
});

/**
 * DATA ACCURACY (do NOT block): the lunar holiday dates (Makha Bucha, Visakha
 * Bucha, Asalha Bucha, Khao Phansa) are best-effort and tracked in CAM-474 —
 * these tests assert STRUCTURE only (relative ordering / adjacency rules
 * that hold regardless of which exact lunar date the Buddhist calendar
 * lands on), never a specific lunar date as ground truth.
 */
describe('thai-holidays.json — lunar-holiday STRUCTURE only, not ground-truth dates (CAM-462 item 7, CAM-474 tracks accuracy)', () => {
  it('[unit] Asalha Bucha (วันอาสาฬหบูชา) immediately precedes Khao Phansa (วันเข้าพรรษา) in every seeded year', () => {
    for (const year of ['2026', '2027']) {
      const asalha = rows.find((r) => r.nameTh === 'วันอาสาฬหบูชา' && r.date.startsWith(year));
      const khaoPhansa = rows.find((r) => r.nameTh === 'วันเข้าพรรษา' && r.date.startsWith(year));
      expect(asalha, `no วันอาสาฬหบูชา row for ${year}`).toBeDefined();
      expect(khaoPhansa, `no วันเข้าพรรษา row for ${year}`).toBeDefined();
      expect(addDaysISO(asalha!.date, 1)).toBe(khaoPhansa!.date);
    }
  });

  it('[unit] every substitution ("ชดเชย") day falls strictly after the holiday it substitutes for', () => {
    const subRows = rows.filter((r) => r.nameTh.includes('ชดเชย'));
    expect(subRows.length).toBeGreaterThan(0); // guard: invariant meaningless with zero substitution rows
    for (const sub of subRows) {
      const baseName = sub.nameTh.replace('วันหยุดชดเชย', '');
      const earlierMatch = rows.find((r) => r.nameTh === baseName && r.date < sub.date);
      expect(earlierMatch, `no earlier "${baseName}" row found before substitution ${sub.date}`).toBeDefined();
    }
  });
});
