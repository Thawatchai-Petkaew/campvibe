/**
 * CAM-462 (tech.md D1/D3) — the `resolveDates` read-only AI tool. Turns an
 * everyday Thai relative/holiday date phrase (`พรุ่งนี้`, `เสาร์อาทิตย์นี้`,
 * `วันหยุดยาวหน้า`, ...) into an exact ISO date-set, replacing the CAM-408
 * prompt instruction that had the MODEL compute date arithmetic itself
 * (error-prone: off-by-one, wrong weekday, month/year boundaries, and unable
 * to express a multi-range set at all).
 *
 * CAM-632 (epic CAM-630) — the pure half (`resolveDatesCore` + every helper
 * it needs, with zero `@/lib/prisma`/`fetch`/React) now lives at
 * `@/lib/ai/date-phrases`, so it can be imported from a client component for
 * the upcoming in-chat booking flow. This file re-exports that pure half
 * unchanged (every existing import of `@/lib/ai/tools/resolve-dates` keeps
 * working) and keeps the ONE thing that must stay server-only: the model-
 * facing wrapper below.
 *
 * Two layers (D1):
 *  - `resolveDatesCore(text, now, holidays)` — PURE, deterministic (see
 *    `@/lib/ai/date-phrases` for the full doc). This is what the unit tests
 *    call with an INJECTED `now` + a fixed ThaiHoliday fixture array.
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
 */
import { prisma } from '@/lib/prisma';
import type { ToolDefinition } from '@/lib/ai/tool-registry';
import {
  resolveDatesCore,
  resolveDatesArgsSchema,
  MAX_DATE_SET_RANGES,
  type DateRange,
  type ThaiHolidayInput,
  type ResolveDatesResult,
  type ResolveDatesArgs,
} from '@/lib/ai/date-phrases';

// Re-exported unchanged (CAM-632) — every existing import path in the repo
// (`resolveDatesCore`, `resolveDatesArgsSchema`, `MAX_DATE_SET_RANGES`, and
// the `DateRange`/`ThaiHolidayInput`/`ResolveDatesResult`/`ResolveDatesArgs`
// types) keeps resolving through `@/lib/ai/tools/resolve-dates`.
export { resolveDatesCore, resolveDatesArgsSchema, MAX_DATE_SET_RANGES };
export type { DateRange, ThaiHolidayInput, ResolveDatesResult, ResolveDatesArgs };

const jsonSchema = {
  type: 'object',
  properties: {
    text: {
      type: 'string',
      description:
        'The camper\'s Thai date phrase, verbatim — relative (for example "พรุ่งนี้", "เสาร์อาทิตย์นี้"), holiday ("วันหยุดยาวหน้า"), or an explicit absolute date ("15 ส.ค.", "วันที่ 15 สิงหาคม 2569", "15/8").',
    },
  },
  required: ['text'],
  additionalProperties: false,
} as const;

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
    'Deterministically resolve a Thai relative, holiday, or absolute date phrase (e.g. "พรุ่งนี้", "เสาร์อาทิตย์นี้", "วันหยุดยาวหน้า", "15 ส.ค.") into exact ISO date range(s). Call this instead of computing dates yourself; on ok:false, ask the camper to specify the dates instead of guessing.',
  tier: 'guest',
  parameters: resolveDatesArgsSchema,
  jsonSchema,
  // Server-bound `today` computed internally — `_ctx` is unused (guest tier, no identity needed).
  execute: (args, _ctx) => executeResolveDates(args),
};
