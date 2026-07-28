/**
 * components/ai-chat/booking-flow.ts — CAM-633 (epic CAM-630, in-chat guided
 * booking, design brief CAM-637)
 *
 * Pure, framework-free state machine for the 3-step in-chat booking flow
 * (date -> guests -> summary). Kept separate from any "use client" glue for
 * the same reason `conversation.ts` states in its own header: the real
 * transition logic is unit-testable directly, with no jsdom (vitest here
 * runs `environment: 'node'`). NOTHING imports this module yet — wiring it
 * into `AiChatPanel`/`AiChatMessageList` is CAM-639/CAM-640.
 *
 * Zero server dependency, by construction: no React import, no Prisma client
 * import, no network call, no reading the system clock directly for "today"
 * (the caller injects `today` via `BookingParseContext`, the same idiom
 * `resolveDatesCore` already uses). Grep-verifiable — see the story's
 * `done_when` for the exact command; this header deliberately does not spell
 * out the literal patterns, or it would trip its own guard.
 *
 * ---------------------------------------------------------------------------
 * TWO structural rules this file exists to enforce (read `lib/taxonomy-
 * registry.ts:3-19` for the exact scar this pattern avoids — a hand-copied
 * map re-implemented ~20 times because there was no single registry):
 *
 * 1. Steps are a REGISTRY (`BOOKING_STEPS`); the current step is DERIVED via
 *    `currentStep(slots)` (first unsatisfied, else the last step) and is
 *    NEVER stored anywhere. Adding a step later (`spot`, `gear`, per the
 *    design brief's own "reopen this decision at 5 steps" note) touches only:
 *      1. this file          — one new `BookingStepDef` + one new
 *                               `BOOKING_STEPS` array entry (inserted BEFORE
 *                               `summaryStep`, which stays last/terminal)
 *      2. locales/translations.json — the step's `aiChat.booking.<id>.*` keys
 *         + `aiChat.booking.stepName.<id>`
 *    Nothing else — no UI component hand-copies a step-id list (guarded by a
 *    source-inspection test, see `__tests__/cam-633-booking-flow.test.ts`).
 *
 * 2. Slots are FLAT OPTIONALS, plain serialisable data — `BookingSlots`
 *    is `{checkIn?, checkOut?, guests?}`, ISO `YYYY-MM-DD` strings and a
 *    number. No `Date` objects, no functions, no money. A later round can
 *    survive a login round-trip by serialising this object as-is (JSON).
 * ---------------------------------------------------------------------------
 *
 * Money note: this module does NO money math of its own. A future summary
 * UI (CAM-640) that needs a total goes through `computeBookingPrice`
 * (`lib/booking-pricing.ts`) — the SAME function the camp page and
 * `POST /api/bookings` use — never a second, hand-rolled multiplication here.
 * Per that module: price is PER NIGHT; guests do NOT multiply it.
 *
 * Handoff payload note: `lib/booking-prefill.ts` (the module that will
 * consume the `exit`/`handoff` payload below) is landing in a sibling ticket
 * (CAM-634, not yet merged) — this file deliberately does NOT import it. The
 * exit payload is defined here as the plain `BookingSlots` shape and CAM-640
 * connects the two.
 */
import {
  resolveDatesCore,
  type ThaiHolidayInput,
} from '@/lib/ai/date-phrases';

// ---------------------------------------------------------------------------
// Slots (flat optionals, serialisable — structural rule #2 above)
// ---------------------------------------------------------------------------

/** BR-2 — ISO `YYYY-MM-DD`. `checkIn` inclusive, `checkOut` EXCLUSIVE (byte-identical convention to `resolveDatesCore`/`Booking.checkOutDate`). */
export interface BookingSlots {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}

export type BookingStepId = 'date' | 'guests' | 'summary';

/**
 * Everything a step's `parse` may need, injected by the caller (never read
 * ambiently). `today`/`holidays` feed the `date` step's `resolveDatesCore`
 * call; `remaining`/`maxGuestsPerDay` feed the `guests` step's capacity
 * check. A step that doesn't need a field simply never reads it — one shared
 * context shape, not a per-step bespoke parameter list.
 *
 * BR-3 (the "capacity trap", CAM-633 ticket) — `remaining`/`maxGuestsPerDay`
 * are `number | null`. `null` means that particular cap is NOT SET
 * (unbounded), NOT full/zero. Every read of these two fields below branches
 * on `null` explicitly — never a falsy (`!remaining`) check, which would
 * collapse a real `0` (full) and an absent cap (`null`) into the same
 * rejection.
 */
export interface BookingParseContext {
  /** Injected "now" — this module never reads the system clock directly. */
  today: Date;
  /** Passed straight through to `resolveDatesCore`; defaults to `[]` there when omitted. */
  holidays?: ThaiHolidayInput[];
  /** LIVE remaining capacity for the camp over the slots' CURRENTLY-selected date range (computed by the caller — this module never fetches). `null` = no per-day cap set. */
  remaining: number | null;
  /** `CampSite.maxGuestsPerDay` (`Int?`). Same null-is-unbounded rule as `remaining`. */
  maxGuestsPerDay: number | null;
}

export interface BookingStepDef {
  readonly id: BookingStepId;
  /** Terminal step returns `false` forever — `currentStep` then always derives back to it once every earlier step is filled. */
  readonly isSatisfied: (slots: BookingSlots) => boolean;
  /** `null` = the text could not be read as this step's answer (triggers the reprompt/escape-hatch path in `advanceBookingFlow`, never a thrown error). */
  readonly parse: (text: string, ctx: BookingParseContext) => Partial<BookingSlots> | null;
  /** i18n KEY SUFFIXES only (e.g. `"chip"`, `"chipNoCap"`) — never literal copy. The consuming UI resolves `aiChat.booking.<id>.<suffix>`. */
  readonly chipKeys: readonly string[];
}

// ---------------------------------------------------------------------------
// `date` step — typed input goes through the SAME pure resolver a chip tap's
// value would (BR-4: typed input === chip input, by construction — a chip is
// nothing but a shortcut that submits its own ISO date text).
// ---------------------------------------------------------------------------

function parseDateAnswer(text: string, ctx: BookingParseContext): Partial<BookingSlots> | null {
  const result = resolveDatesCore(text, ctx.today, ctx.holidays ?? []);
  if (!result.ok || result.dates.length === 0) return null;
  // Round-1 books exactly ONE stay (design brief CAM-637 §3: "one night,
  // stated in the copy"). A "date SET" phrase (e.g. "ทุกวันเสาร์เดือนนี้")
  // resolves to SEVERAL candidate ranges; this flow has no picker over a set,
  // so it deliberately takes the FIRST candidate only — a documented round-1
  // simplification, not a silent bug (see the coverage test for this case).
  const [firstRange] = result.dates;
  return { checkIn: firstRange!.startDate, checkOut: firstRange!.endDate };
}

const dateStep: BookingStepDef = {
  id: 'date',
  isSatisfied: (slots) => slots.checkIn !== undefined && slots.checkOut !== undefined,
  parse: parseDateAnswer,
  chipKeys: ['chip', 'chipNoCap'],
};

// ---------------------------------------------------------------------------
// `guests` step — Thai number words + Arabic digits. The capacity check
// itself (BR-3) lives in `advanceBookingFlow`, NOT here: `parse` only answers
// "what number did the camper name", never "is that number allowed" — the
// design brief's E2 (over-capacity) is a DIFFERENT outcome than "unreadable"
// (a valid, understood number that is merely rejected must not burn one of
// the two escape-hatch strikes).
// ---------------------------------------------------------------------------

const THAI_ONES_WORDS: ReadonlyArray<readonly [string, number]> = [
  ['ศูนย์', 0],
  ['หนึ่ง', 1],
  ['สอง', 2],
  ['สาม', 3],
  ['สี่', 4],
  ['ห้า', 5],
  ['หก', 6],
  ['เจ็ด', 7],
  ['แปด', 8],
  ['เก้า', 9],
];

/** "ยี่สิบ" (20) is the one irregular tens prefix; every other tens prefix reuses its ones-word ("สามสิบ"=30). "สิบ" alone (10) has no prefix at all. */
const THAI_TENS_PREFIX_WORDS: ReadonlyArray<readonly [string, number]> = [
  ['ยี่', 2],
  ['สาม', 3],
  ['สี่', 4],
  ['ห้า', 5],
  ['หก', 6],
  ['เจ็ด', 7],
  ['แปด', 8],
  ['เก้า', 9],
];

/** Builds the full 0-99 Thai number-word lookup once at module load (0-9, 10, 11-19, 20-99) — table-driven rather than a hand-spelled list. */
function buildThaiNumberWordTable(): ReadonlyMap<string, number> {
  const table = new Map<string, number>();
  for (const [word, value] of THAI_ONES_WORDS) table.set(word, value);
  table.set('สิบ', 10);
  for (const [tensWord, tensValue] of THAI_TENS_PREFIX_WORDS) {
    table.set(`${tensWord}สิบ`, tensValue * 10);
    for (const [onesWord, onesValue] of THAI_ONES_WORDS) {
      if (onesValue === 0) continue;
      const unitsWord = onesValue === 1 ? 'เอ็ด' : onesWord; // compound units use "เอ็ด" for 1, never "หนึ่ง"
      table.set(`${tensWord}สิบ${unitsWord}`, tensValue * 10 + onesValue);
    }
  }
  for (const [onesWord, onesValue] of THAI_ONES_WORDS) {
    if (onesValue === 0) continue;
    const unitsWord = onesValue === 1 ? 'เอ็ด' : onesWord;
    table.set(`สิบ${unitsWord}`, 10 + onesValue);
  }
  return table;
}

const THAI_NUMBER_WORDS = buildThaiNumberWordTable();

/** `"8 คน"` / `"แปดคน"` / `"8"` all resolve to `8`. `null` on anything unreadable or <= 0 (a party of 0 is not a booking). */
function parseGuestCount(text: string): number | null {
  const digitMatch = text.match(/\d+/);
  if (digitMatch) {
    const value = Number(digitMatch[0]);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  const normalized = text.replace(/\s+/g, '').replace(/คน/g, '');
  if (normalized.length === 0) return null;
  const value = THAI_NUMBER_WORDS.get(normalized);
  return value !== undefined && value > 0 ? value : null;
}

const guestsStep: BookingStepDef = {
  id: 'guests',
  isSatisfied: (slots) => slots.guests !== undefined,
  parse: (text) => {
    const guests = parseGuestCount(text);
    return guests === null ? null : { guests };
  },
  chipKeys: ['chip', 'capChip'],
};

// ---------------------------------------------------------------------------
// `summary` step — terminal (never satisfied, no field left to fill).
// ---------------------------------------------------------------------------

const summaryStep: BookingStepDef = {
  id: 'summary',
  isSatisfied: () => false,
  // Nothing left to parse at this step; any typed input here falls into the
  // generic unparsed/escape-hatch path in `advanceBookingFlow` below.
  parse: () => null,
  chipKeys: [],
};

/** The registry — order matters (it is the step SEQUENCE). A new step is inserted BEFORE `summaryStep`, which must stay last/terminal. */
export const BOOKING_STEPS: readonly BookingStepDef[] = [dateStep, guestsStep, summaryStep];

/** First unsatisfied step, else the last step in the registry (structural rule #1 — never stored, always derived). */
export function currentStep(slots: BookingSlots): BookingStepDef {
  const firstUnsatisfied = BOOKING_STEPS.find((step) => !step.isSatisfied(slots));
  return firstUnsatisfied ?? BOOKING_STEPS[BOOKING_STEPS.length - 1]!;
}

export interface BookingStepProgressEntry {
  id: BookingStepId;
  status: 'done' | 'active' | 'todo';
}

/** Every step before the current one is `done` (it must be satisfied, by `currentStep`'s own definition), the current one is `active`, everything after is `todo`. */
export function stepProgress(slots: BookingSlots): BookingStepProgressEntry[] {
  const current = currentStep(slots);
  const currentIndex = BOOKING_STEPS.findIndex((step) => step.id === current.id);
  return BOOKING_STEPS.map((step, index) => ({
    id: step.id,
    status: index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'todo',
  }));
}

// ---------------------------------------------------------------------------
// The flow itself — state, input, outcome, and `advanceBookingFlow`.
// ---------------------------------------------------------------------------

/** Two consecutive unparsed turns hand the flow back to the model (the escape hatch) — never a third try, never an infinite reprompt loop. */
export const MAX_CONSECUTIVE_MISSES = 2;

export interface BookingFlowState {
  slots: BookingSlots;
  /**
   * Consecutive count of turns this flow could NOT parse at the current
   * step. Reset to 0 on every turn that IS understood — whether accepted
   * (`advance`) or capacity-rejected (`over_capacity`): an over-capacity
   * reply is a real, comprehended answer, not a miss.
   */
  consecutiveMisses: number;
}

export function createInitialBookingFlowState(): BookingFlowState {
  return { slots: {}, consecutiveMisses: 0 };
}

/**
 * A chip tap is modeled as `{kind:'text', text: <the chip's own value>}` —
 * there is no separate "chip" input variant. This is what makes "typed input
 * equals chip input" true BY CONSTRUCTION rather than by two parallel code
 * paths that could drift apart.
 */
export type BookingFlowInput = { kind: 'text'; text: string } | { kind: 'cancel' };

export type BookingFlowOutcome =
  | { kind: 'advance'; state: BookingFlowState }
  | { kind: 'reprompt'; state: BookingFlowState; reason: 'unparsed' }
  /** `limit` = the real ceiling right now (`combineCapacityLimit` below) — so the UI never has to re-derive it to word the message / offer the "N คนก็ได้" chip. */
  | { kind: 'reprompt'; state: BookingFlowState; reason: 'over_capacity'; limit: number }
  | { kind: 'exit'; reason: 'cancelled' }
  /** `prefill` is exactly `BookingSlots` — whatever was collected so far, however incomplete. CAM-640 connects this to `lib/booking-prefill.ts`. */
  | { kind: 'exit'; reason: 'handoff'; prefill: BookingSlots };

/**
 * BR-3 (the capacity trap) — the camper's real ceiling is the TIGHTER of the
 * two caps that are actually set. `null` on one side means that cap does not
 * exist (defer entirely to the other); `null` on BOTH sides means no ceiling
 * at all (`null` out, never fabricate a number). Exported so a later chip-
 * generation UI (CAM-639/640, design brief §2 `ceiling = min(remaining,
 * maxGuestsPerDay)`) reuses this exact combine logic instead of a second,
 * possibly-drifting reimplementation.
 */
export function combineCapacityLimit(remaining: number | null, maxGuestsPerDay: number | null): number | null {
  if (remaining === null) return maxGuestsPerDay;
  if (maxGuestsPerDay === null) return remaining;
  return Math.min(remaining, maxGuestsPerDay);
}

/**
 * Advances (or exits) the flow for ONE turn. Pure: never mutates `state` or
 * `ctx` — every branch returns fresh objects.
 *
 * - `cancel` exits immediately from ANY step, no prefill (BR: the camper
 *   explicitly walked away — there is nothing to hand off).
 * - Otherwise the CURRENT step (derived, never stored) parses the text.
 *   - Unparsed: bump the miss streak; the 2nd consecutive miss exits to the
 *     model (`handoff`, carrying whatever slots were collected); the 1st
 *     reprompts.
 *   - Parsed at the `guests` step: checked against `combineCapacityLimit`
 *     BEFORE merging into slots — over the limit reprompts with `limit` and
 *     resets the miss streak (a real answer, not a miss); the slot is left
 *     unfilled either way.
 *   - Otherwise: merge the patch into slots, reset the miss streak, advance.
 */
export function advanceBookingFlow(
  state: BookingFlowState,
  input: BookingFlowInput,
  ctx: BookingParseContext
): BookingFlowOutcome {
  if (input.kind === 'cancel') {
    return { kind: 'exit', reason: 'cancelled' };
  }

  const step = currentStep(state.slots);
  const patch = step.parse(input.text, ctx);

  if (patch === null) {
    const misses = state.consecutiveMisses + 1;
    if (misses >= MAX_CONSECUTIVE_MISSES) {
      return { kind: 'exit', reason: 'handoff', prefill: { ...state.slots } };
    }
    return {
      kind: 'reprompt',
      state: { slots: state.slots, consecutiveMisses: misses },
      reason: 'unparsed',
    };
  }

  if (step.id === 'guests' && patch.guests !== undefined) {
    const limit = combineCapacityLimit(ctx.remaining, ctx.maxGuestsPerDay);
    if (limit !== null && patch.guests > limit) {
      return {
        kind: 'reprompt',
        state: { slots: state.slots, consecutiveMisses: 0 },
        reason: 'over_capacity',
        limit,
      };
    }
  }

  return {
    kind: 'advance',
    state: { slots: { ...state.slots, ...patch }, consecutiveMisses: 0 },
  };
}
