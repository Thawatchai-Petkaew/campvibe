/**
 * CAM-462 (tech.md D1/D3) — the `resolveDates` read-only AI tool. Turns an
 * everyday Thai relative/holiday date phrase (`พรุ่งนี้`, `เสาร์อาทิตย์นี้`,
 * `วันหยุดยาวหน้า`, ...) into an exact ISO date-set, replacing the CAM-408
 * prompt instruction that had the MODEL compute date arithmetic itself
 * (error-prone: off-by-one, wrong weekday, month/year boundaries, and unable
 * to express a multi-range set at all).
 *
 * Two layers (D1):
 *  - `resolveDatesCore(text, now, holidays)` — PURE, deterministic: no LLM,
 *    no clock read, no DB, no network. Given the same 3 inputs it always
 *    returns the same result (BR-1). This is what the unit tests call with
 *    an INJECTED `now` + a fixed ThaiHoliday fixture array.
 *  - `resolveDatesTool.execute(args)` — the model-facing wrapper. Reads the
 *    real wall clock (pinned Asia/Bangkok, same technique as
 *    `formatTodayContextLine` in openrouter-client.ts — NOT re-implemented,
 *    the identical `Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Bangkok'})`
 *    idiom, kept local here because that function returns a full sentence,
 *    not a bare ISO date), does the ONE read-only `ThaiHoliday` fetch ONLY
 *    when the phrase looks holiday-type (skips the DB round-trip for every
 *    other phrase), and hands both to the core.
 *
 * Anti-spoof (D1): the model-facing `jsonSchema`/zod `parameters` expose
 * ONLY `{ text }`. `today`/`tz` are internal params of the pure core — never
 * in the model's contract — so the model can never supply or spoof "today".
 *
 * BR-3 — `endDate` is the EXCLUSIVE checkout day, byte-identical to
 * `Booking.checkOutDate` / `check-availability.ts` semantics (never
 * inclusive) — `เสาร์อาทิตย์` (Sat+Sun nights) = check-in Sat, checkout Mon.
 *
 * BR-5 — no silent guess: an ambiguous/unsupported/unmatched/over-cap phrase
 * returns `{ ok:false, reason }`, never a fabricated date.
 *
 * BR-8/CAM-344 — `MAX_DATE_SET_RANGES` is checked via O(1) arithmetic BEFORE
 * a date-SET phrase's range array is ever built (never build-then-truncate).
 */
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { ToolDefinition } from '@/lib/ai/tool-registry';

/** BR-8/D3 — the CAM-344 pre-loop cap for a date-SET phrase's range count. */
export const MAX_DATE_SET_RANGES = 12;

/** BR-3 — startDate inclusive (check-in), endDate EXCLUSIVE (checkout). Both `YYYY-MM-DD`. */
export interface DateRange {
  startDate: string;
  endDate: string;
}

/** The shape of one `ThaiHoliday` row as the pure core sees it (D1) — no Prisma types leak into the core. */
export interface ThaiHolidayInput {
  date: string; // YYYY-MM-DD
  nameTh: string;
  isLongWeekend: boolean;
}

export type ResolveDatesResult =
  | { ok: true; dates: DateRange[]; interpretation: string }
  | { ok: false; reason: 'ambiguous' | 'unsupported' | 'no_match' | 'too_many' };

/** D1 — the ONLY field the model ever sees; `today`/`tz` never appear here (anti-spoof). */
export const resolveDatesArgsSchema = z.object({
  text: z.string().min(1),
});
export type ResolveDatesArgs = z.infer<typeof resolveDatesArgsSchema>;

const jsonSchema = {
  type: 'object',
  properties: {
    text: {
      type: 'string',
      description:
        'The camper\'s Thai relative or holiday date phrase, verbatim (for example "พรุ่งนี้", "เสาร์อาทิตย์นี้", "วันหยุดยาวหน้า").',
    },
  },
  required: ['text'],
  additionalProperties: false,
} as const;

// ---------------------------------------------------------------------------
// Date-string helpers (D3) — anchor an ISO civil date at UTC-noon and do all
// day arithmetic in UTC; Thailand has no DST so a UTC-anchored weekday is
// stable regardless of the server's own timezone (AC-6/EC-2).
// ---------------------------------------------------------------------------

function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0=Sun..6=Sat. */
function weekdayOfISO(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

function isWeekendISO(iso: string): boolean {
  const wd = weekdayOfISO(iso);
  return wd === 0 || wd === 6;
}

function daysBetweenISO(a: string, b: string): number {
  const da = new Date(`${a}T12:00:00Z`).getTime();
  const db = new Date(`${b}T12:00:00Z`).getTime();
  return Math.round((db - da) / 86_400_000);
}

/**
 * D3 — the SAME `Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Bangkok'})`
 * idiom `formatTodayContextLine` (openrouter-client.ts) uses to get "today"
 * as a Bangkok civil date, kept local here because that function returns a
 * full sentence, not a bare ISO date. EC-5 — an invalid/NaN `now` falls back
 * to the real current time, never throws.
 */
function bangkokTodayISO(now: Date): string {
  const safe = Number.isNaN(now.getTime()) ? new Date() : now;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(safe);
}

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function shortThaiDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${THAI_MONTHS_SHORT[m - 1]}`;
}

/** Plain-language gloss the model can echo back to the camper (D1 `interpretation`). */
function formatRangeGloss(label: string, range: DateRange): string {
  return `${label} ${shortThaiDate(range.startDate)}-${shortThaiDate(range.endDate)}`;
}

// ---------------------------------------------------------------------------
// Weekend math (AC-2/AC-3/EC-2)
// ---------------------------------------------------------------------------

/** The Saturday of "this coming weekend" relative to `todayISO` (today counts as Saturday if it IS one). */
function thisWeekSaturday(todayISO: string): string {
  const wd = weekdayOfISO(todayISO);
  const daysUntilSaturday = (6 - wd + 7) % 7;
  return addDaysISO(todayISO, daysUntilSaturday);
}

function weekendRange(saturdayISO: string): DateRange {
  return { startDate: saturdayISO, endDate: addDaysISO(saturdayISO, 2) };
}

// ---------------------------------------------------------------------------
// Holiday-span math (AC-3/EC-3/EC-6, BR-4) — D2: the resolver reads ONLY the
// `isLongWeekend:true` rows (the "one indexed filter" D2 describes); it
// groups those into runs of literally-consecutive TABLE dates (e.g. the 3
// Songkran rows), then extends each run's boundary through any immediately
// adjacent Saturday/Sunday via pure weekday math (no extra DB row needed for
// the weekend itself — a weekend is never a "holiday" row).
// ---------------------------------------------------------------------------

function groupContiguousRuns(sortedDates: string[]): DateRange[] {
  if (sortedDates.length === 0) return [];
  const runs: DateRange[] = [];
  let start = sortedDates[0]!;
  let prev = sortedDates[0]!;
  for (let i = 1; i < sortedDates.length; i++) {
    const d = sortedDates[i]!;
    if (addDaysISO(prev, 1) === d) {
      prev = d;
      continue;
    }
    runs.push({ startDate: start, endDate: prev });
    start = d;
    prev = d;
  }
  runs.push({ startDate: start, endDate: prev });
  return runs;
}

/** Extends a holiday run's [start,end] boundary through adjacent weekend days, never crossing back to `todayISO` or earlier. */
function expandToWeekendBoundary(run: DateRange, todayISO: string): DateRange {
  let start = run.startDate;
  for (;;) {
    const prevDay = addDaysISO(start, -1);
    if (prevDay <= todayISO || !isWeekendISO(prevDay)) break;
    start = prevDay;
  }
  let end = run.endDate;
  for (;;) {
    const nextDay = addDaysISO(end, 1);
    if (!isWeekendISO(nextDay)) break;
    end = nextDay;
  }
  return { startDate: start, endDate: end };
}

/** AC-3/EC-3 — the NEXT long-weekend span strictly after `todayISO`, or `null` if none exists in `holidays` (EC-6: empty/unseeded table -> null, never throws). */
function nextLongWeekendSpan(todayISO: string, holidays: ThaiHolidayInput[]): { span: DateRange; nameTh: string } | null {
  const flaggedFutureDates = holidays
    .filter((h) => h.isLongWeekend && h.date > todayISO)
    .map((h) => h.date)
    .sort();
  if (flaggedFutureDates.length === 0) return null;

  const runs = groupContiguousRuns(flaggedFutureDates);
  const firstRun = runs[0]!;
  const expanded = expandToWeekendBoundary(firstRun, todayISO);
  const anchorHoliday = holidays.find((h) => h.date === firstRun.startDate);
  return { span: expanded, nameTh: anchorHoliday?.nameTh ?? 'วันหยุดยาว' };
}

// ---------------------------------------------------------------------------
// Date-SET (multi-weekend) math (AC-4/EC-4, BR-8) — count is pure arithmetic
// so the MAX cap is checked BEFORE any range array is ever allocated.
// ---------------------------------------------------------------------------

function endOfMonthISO(todayISO: string): string {
  const [y, m] = todayISO.split('-').map(Number) as [number, number];
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
}

function endOfYearISO(todayISO: string): string {
  const [y] = todayISO.split('-').map(Number) as [number];
  return `${y}-12-31`;
}

function firstSaturdayOnOrAfter(iso: string): string {
  let cur = iso;
  // Bounded to at most 6 iterations (a week) — not a CAM-344 concern (fixed small constant, never client-controlled magnitude).
  while (weekdayOfISO(cur) !== 6) cur = addDaysISO(cur, 1);
  return cur;
}

/** O(1) arithmetic — no loop over the actual range, so the MAX cap check never allocates. */
function countWeekendsInRange(startISO: string, endISO: string): number {
  const firstSat = firstSaturdayOnOrAfter(startISO);
  if (firstSat > endISO) return 0;
  return Math.floor(daysBetweenISO(firstSat, endISO) / 7) + 1;
}

function buildWeekendSet(startISO: string, endISO: string, count: number): DateRange[] {
  const ranges: DateRange[] = [];
  let sat = firstSaturdayOnOrAfter(startISO);
  for (let i = 0; i < count; i++) {
    ranges.push(weekendRange(sat));
    sat = addDaysISO(sat, 7);
  }
  return ranges;
}

// ---------------------------------------------------------------------------
// Phrase dispatch (D3 — deterministic ordered rule list, NO LLM)
// ---------------------------------------------------------------------------

function detectMultiWeekendScope(text: string): 'month' | 'year' | null {
  const isMultiWeekendPhrase = /เสาร์อาทิตย์ทุกสัปดาห์|ทุกวันเสาร์|ทุกสุดสัปดาห์/.test(text);
  if (!isMultiWeekendPhrase) return null;
  if (/ปีนี้|ทั้งปี/.test(text)) return 'year';
  if (/เดือนนี้/.test(text)) return 'month';
  return null;
}

// ---------------------------------------------------------------------------
// Single-weekday math (F1/CAM-479 fix) — the resolver previously had NO rule
// for a lone Thai weekday name ("เสาร์หน้า"/"เสาร์นี้"/"ศุกร์ที่จะถึง"), so it
// fell through all the way to `unsupported` and the assistant looped asking
// the camper for an explicit date. Deterministic weekday math anchored at
// `todayISO`, the same UTC-noon idiom (`weekdayOfISO`/`addDaysISO`) as the
// weekend rules above.
// ---------------------------------------------------------------------------

/** 0=Sun..6=Sat — matches `weekdayOfISO`'s convention. Longer alternative
 * (`พฤหัสบดี`) listed BEFORE its short form (`พฤหัส`) in `SINGLE_WEEKDAY_RE` so
 * the alternation never stops short and leaves the modifier unmatched. */
const THAI_WEEKDAY_INDEX: Record<string, number> = {
  อาทิตย์: 0,
  จันทร์: 1,
  อังคาร: 2,
  พุธ: 3,
  พฤหัสบดี: 4,
  พฤหัส: 4,
  ศุกร์: 5,
  เสาร์: 6,
};

const THAI_WEEKDAY_LABEL: Record<string, string> = {
  อาทิตย์: 'วันอาทิตย์',
  จันทร์: 'วันจันทร์',
  อังคาร: 'วันอังคาร',
  พุธ: 'วันพุธ',
  พฤหัสบดี: 'วันพฤหัสบดี',
  พฤหัส: 'วันพฤหัสบดี',
  ศุกร์: 'วันศุกร์',
  เสาร์: 'วันเสาร์',
};

const SINGLE_WEEKDAY_RE =
  /(?:วัน)?(พฤหัสบดี|พฤหัส|จันทร์|อังคาร|พุธ|ศุกร์|เสาร์|อาทิตย์)(นี้|หน้า|ที่จะถึง)?/;

/** The next occurrence of `targetWd` on/after `todayISO` (today counts if it IS that weekday). */
function nextWeekdayOnOrAfter(todayISO: string, targetWd: number): string {
  const wd = weekdayOfISO(todayISO);
  const diff = (targetWd - wd + 7) % 7;
  return addDaysISO(todayISO, diff);
}

/**
 * Parses a single Thai weekday phrase; `null` if no weekday name is present.
 * "[day]นี้" / "[day]ที่จะถึง" / no modifier = the NEXT occurrence on/after
 * today (today counts for "นี้"). "[day]หน้า" = next WEEK's occurrence (the
 * "นี้" result + 7 days).
 */
function resolveSingleWeekday(text: string, todayISO: string): { range: DateRange; label: string } | null {
  // Never intercept the compound weekend TERM "เสาร์อาทิตย์" — whether or not
  // the dedicated weekend rules above fully matched it (e.g. missing a
  // recognized modifier, or a multi-weekend phrase missing its เดือนนี้/ปีนี้
  // scope), the presence of both adjacent day-names signals a weekend
  // reference, never a single "เสาร์"/"อาทิตย์" day (BR-4 dispatch ordering).
  if (/เสาร์อาทิตย์/.test(text)) return null;
  const match = SINGLE_WEEKDAY_RE.exec(text);
  if (!match) return null;
  const dayKey = match[1]!;
  const modifier = match[2]; // 'นี้' | 'หน้า' | 'ที่จะถึง' | undefined
  const targetWd = THAI_WEEKDAY_INDEX[dayKey]!;
  const thisOccurrence = nextWeekdayOnOrAfter(todayISO, targetWd);
  const isNextWeek = modifier === 'หน้า';
  const start = isNextWeek ? addDaysISO(thisOccurrence, 7) : thisOccurrence;
  const range: DateRange = { startDate: start, endDate: addDaysISO(start, 1) };
  const label = `${THAI_WEEKDAY_LABEL[dayKey]}${isNextWeek ? 'หน้า' : 'นี้'}`;
  return { range, label };
}

/**
 * PURE core (D1) — no clock, no DB, no network. `holidays` defaults to `[]`
 * (EC-6 — an unseeded/empty table still resolves every non-holiday phrase).
 */
export function resolveDatesCore(
  text: string,
  now: Date = new Date(),
  holidays: ThaiHolidayInput[] = []
): ResolveDatesResult {
  const todayISO = bangkokTodayISO(now);

  // 1) Date-SET phrases (AC-4/EC-4) — most specific, checked first.
  const scope = detectMultiWeekendScope(text);
  if (scope) {
    const scopeEnd = scope === 'month' ? endOfMonthISO(todayISO) : endOfYearISO(todayISO);
    const count = countWeekendsInRange(todayISO, scopeEnd);
    if (count > MAX_DATE_SET_RANGES) {
      return { ok: false, reason: 'too_many' };
    }
    if (count === 0) {
      return { ok: false, reason: 'no_match' };
    }
    const dates = buildWeekendSet(todayISO, scopeEnd, count);
    const scopeLabel = scope === 'month' ? 'เดือนนี้' : 'ปีนี้';
    return { ok: true, dates, interpretation: `${count} สุดสัปดาห์ใน${scopeLabel}` };
  }

  // 2) Holiday long-weekend phrase (AC-3/EC-3/EC-6).
  if (/วันหยุดยาว/.test(text)) {
    const found = nextLongWeekendSpan(todayISO, holidays);
    if (!found) {
      return { ok: false, reason: 'no_match' };
    }
    const range: DateRange = { startDate: found.span.startDate, endDate: addDaysISO(found.span.endDate, 1) };
    return { ok: true, dates: [range], interpretation: formatRangeGloss(`วันหยุดยาว (${found.nameTh})`, range) };
  }

  // 3) Next weekend (EC-2 — crosses month/year boundary via add-days, no clamping).
  if (/เสาร์อาทิตย์หน้า|สุดสัปดาห์หน้า/.test(text)) {
    const sat = addDaysISO(thisWeekSaturday(todayISO), 7);
    const range = weekendRange(sat);
    return { ok: true, dates: [range], interpretation: formatRangeGloss('สุดสัปดาห์หน้า', range) };
  }

  // 4) This weekend (AC-2).
  if (/เสาร์อาทิตย์นี้|สุดสัปดาห์นี้/.test(text)) {
    const sat = thisWeekSaturday(todayISO);
    const range = weekendRange(sat);
    return { ok: true, dates: [range], interpretation: formatRangeGloss('สุดสัปดาห์นี้', range) };
  }

  // 5) Day after tomorrow.
  if (/มะรืน/.test(text)) {
    const start = addDaysISO(todayISO, 2);
    const range: DateRange = { startDate: start, endDate: addDaysISO(start, 1) };
    return { ok: true, dates: [range], interpretation: formatRangeGloss('มะรืนนี้', range) };
  }

  // 6) Tomorrow (AC-1).
  if (/พรุ่งนี้/.test(text)) {
    const start = addDaysISO(todayISO, 1);
    const range: DateRange = { startDate: start, endDate: addDaysISO(start, 1) };
    return { ok: true, dates: [range], interpretation: formatRangeGloss('พรุ่งนี้', range) };
  }

  // 7) A single weekday phrase (F1/CAM-479) — "เสาร์หน้า"/"เสาร์นี้"/
  // "ศุกร์ที่จะถึง"/bare "เสาร์" all resolve to ONE deterministic date via
  // weekday math. Runs AFTER the compound weekend rules above (so
  // "เสาร์อาทิตย์นี้" still matches the weekend rule first, never this one)
  // and BEFORE the final unsupported fallback below.
  const singleWeekday = resolveSingleWeekday(text, todayISO);
  if (singleWeekday) {
    return {
      ok: true,
      dates: [singleWeekday.range],
      interpretation: formatRangeGloss(singleWeekday.label, singleWeekday.range),
    };
  }

  // 8) A past-resolving phrase (EC-1) — a past stay is meaningless, never resolved.
  if (/เมื่อวาน/.test(text)) {
    return { ok: false, reason: 'unsupported' };
  }

  // 9) A vague phrase with no resolvable time reference (AC-5).
  if (/ช่วงนี้/.test(text)) {
    return { ok: false, reason: 'ambiguous' };
  }

  // 10) No rule matched at all (BR-5 — never guess).
  return { ok: false, reason: 'unsupported' };
}

/** True for a phrase the wrapper must fetch `ThaiHoliday` for — every other phrase never touches the DB. */
function isHolidayPhrase(text: string): boolean {
  return /วันหยุดยาว/.test(text);
}

async function executeResolveDates(args: ResolveDatesArgs): Promise<ResolveDatesResult> {
  const now = new Date();
  let holidays: ThaiHolidayInput[] = [];

  if (isHolidayPhrase(args.text)) {
    const rows = await prisma.thaiHoliday.findMany({
      where: { isLongWeekend: true },
      orderBy: { date: 'asc' },
      select: { date: true, nameTh: true, isLongWeekend: true },
    });
    holidays = rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      nameTh: row.nameTh,
      isLongWeekend: row.isLongWeekend,
    }));
  }

  return resolveDatesCore(args.text, now, holidays);
}

export const resolveDatesTool: ToolDefinition<ResolveDatesArgs, ResolveDatesResult> = {
  name: 'resolveDates',
  description:
    'Deterministically resolve a Thai relative or holiday date phrase (e.g. "พรุ่งนี้", "เสาร์อาทิตย์นี้", "วันหยุดยาวหน้า") into exact ISO date range(s). Call this instead of computing dates yourself; on ok:false, ask the camper to specify the dates instead of guessing.',
  tier: 'guest',
  parameters: resolveDatesArgsSchema,
  jsonSchema,
  // Server-bound `today` computed internally — `_ctx` is unused (guest tier, no identity needed).
  execute: (args, _ctx) => executeResolveDates(args),
};
