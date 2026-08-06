/**
 * components/ai-chat/booking-flow.ts — CAM-633 (epic CAM-630, in-chat guided
 * booking, design brief CAM-637); `nights` step added by CAM-699 (epic
 * CAM-695, ADR-018 D8) — see that story's own header block further down.
 *
 * Pure, framework-free state machine for the 4-step in-chat booking flow
 * (date -> nights -> guests -> summary). Kept separate from any "use client"
 * glue for the same reason `conversation.ts` states in its own header: the
 * real transition logic is unit-testable directly, with no jsdom (vitest
 * here runs `environment: 'node'`). Wiring into `AiChatPanel`/
 * `AiChatMessageList` lives in `booking-turn.ts`/`use-ai-chat.ts`.
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
 *    `advanceBookingFlow` itself never branches on a step's id either — see
 *    `BookingStepParseResult` below: a step that must REJECT a value
 *    (an out-of-stock `gear` step is the literal next candidate) reports that
 *    through its OWN `accept` return value, never through a special case
 *    keyed on `step.id` in the machine.
 *
 * 2. Slots are FLAT OPTIONALS, plain serialisable data — `BookingSlots`
 *    is `{checkIn?, checkOut?, guests?}`, ISO `YYYY-MM-DD` strings and a
 *    number. No `Date` objects, no functions, no money. A later round can
 *    survive a login round-trip by serialising this object as-is (JSON).
 * ---------------------------------------------------------------------------
 *
 * `parse` vs `accept` (G3 review, round 2 — the reader must not conflate
 * these): a step's job splits into TWO separate concerns, because a chip
 * needs only the second one.
 *   - `parse` — TEXT ONLY. Read the camper's free-form words into a
 *     candidate slot patch. No policy of any kind lives here (no capacity
 *     check, no range/format sanity check). `null` = the text could not be
 *     read as anything at all (a miss, the escape hatch's concern).
 *   - `accept` — POLICY. Given a candidate patch (from a successful `parse`,
 *     OR straight from a `chip` input that never called `parse`), decide
 *     whether it is acceptable HERE, in this `ctx`. This is where the
 *     `guests` capacity check lives, where a date's format/ordering/not-in-
 *     the-past sanity is checked, and where a candidate is confined to ONLY
 *     the slot keys this step owns (a chip carrying a foreign key, e.g.
 *     `checkIn` arriving at the `guests` step, is rejected here rather than
 *     silently merged — round 1 of this fix let a chip bypass `accept`
 *     entirely, which also bypassed BR-3 the capacity trap; that is fixed by
 *     giving BOTH the text path (after `parse` succeeds) and the chip path
 *     no way to reach `advanceBookingFlow`'s merge without going through this
 *     SAME function first).
 *
 * Money note: this module does NO money math of its own. A future summary
 * UI (CAM-640) that needs a total goes through `computeBookingPrice`
 * (`lib/booking-pricing.ts`) — the SAME function the camp page and
 * `POST /api/bookings` use — never a second, hand-rolled multiplication here.
 * Per that module: price is PER NIGHT; guests do NOT multiply it.
 *
 * Handoff payload note: `lib/booking-prefill.ts` (CAM-634, merged separately)
 * is the module that will consume the `exit`/`handoff` payload below —
 * this file still deliberately does NOT import it (wiring is CAM-640's job,
 * out of this story's surface). The exit payload is defined here as the
 * plain `BookingSlots` shape, which already matches that module's
 * `checkIn`/`checkOut`/`guests` contract field-for-field.
 */
import {
  resolveDatesCore,
  bangkokTodayISO,
  type ThaiHolidayInput,
} from '@/lib/ai/date-phrases';
// CAM-699 — the SAME 30-night ceiling `lib/validations/booking.ts:6` and
// `lib/booking-prefill.ts` already share, reused here rather than a THIRD
// independently-chosen 30 (the exact drift `lib/booking-prefill.ts`'s own
// header calls out as a repo scar).
import { MAX_BOOKING_NIGHTS } from '@/lib/validations/booking';

// ---------------------------------------------------------------------------
// Slots (flat optionals, serialisable — structural rule #2 above)
// ---------------------------------------------------------------------------

/**
 * BR-2 — ISO `YYYY-MM-DD`. `checkIn` inclusive, `checkOut` EXCLUSIVE
 * (byte-identical convention to `resolveDatesCore`/`Booking.checkOutDate`).
 *
 * CAM-699 — `nights` was deliberately added as its OWN flat field rather than
 * only ever being derived from `checkOut - checkIn` (the story's "recommend
 * keeping the slot shape unchanged" note, deviated from WITH reasoning): a
 * derived-only signal cannot tell "the nights step has not been asked yet"
 * apart from "the camper explicitly chose 1 night" — both produce the exact
 * same 1-day `checkOut - checkIn` span, and the `nights` step's own
 * `isSatisfied` needs to tell them apart (a diff-only check would loop
 * forever the moment a camper picked exactly 1 night: `accept` recomputes
 * `checkOut = checkIn + 1`, the span is still 1, "unsatisfied" fires again).
 * `nights` stays a flat, optional, serialisable number — the flatness rule
 * itself is unbroken, only the field COUNT grew by one.
 */
export interface BookingSlots {
  checkIn?: string;
  checkOut?: string;
  /** CAM-699 — set either by the `nights` step's own answer, or PRE-FILLED by the `date` step itself when a typed phrase already resolved a real multi-night span (e.g. "สุดสัปดาห์นี้" = 2 nights) — see `acceptDateCandidate`. */
  nights?: number;
  guests?: number;
}

export type BookingStepId = 'date' | 'nights' | 'guests' | 'summary';

/**
 * Everything a step's `parse`/`accept` may need, injected by the caller
 * (never read ambiently). `today`/`holidays` feed the `date` step's
 * `resolveDatesCore` call and its not-in-the-past sanity check;
 * `remaining`/`maxGuestsPerDay` feed the `guests` step's capacity check. A
 * step that doesn't need a field simply never reads it — one shared context
 * shape, not a per-step bespoke parameter list.
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
  /** CAM-699 — `state.slots.checkIn` at the moment of this turn (caller-computed, same idiom as `remaining`), the ONLY thing `nights`'s `accept` needs to derive `checkOut = checkIn + nights`. `null` only when `date` has not been answered yet — structurally unreachable for the `nights` step itself (it is never current before `date` is satisfied). */
  checkIn: string | null;
}

/**
 * The result of `accept`-ing ONE candidate slot patch. Generalised (G3
 * review) so a step that must REJECT an understood-but-invalid value (the
 * `guests` over-capacity case; an out-of-stock `gear` step is the next
 * candidate) reports that through its OWN return value — `advanceBookingFlow`
 * never special-cases a step by id to know "this kind of rejection is not a
 * miss". `reasonKey`/`data` are i18n-key-shaped and step-owned, never literal
 * copy (the same contract `chipKeys` already follows).
 */
export type BookingStepParseResult =
  | { ok: true; slots: Partial<BookingSlots> }
  /** No candidate could be produced at all (a `parse` miss) — counts as a miss (the 2-strike escape hatch). */
  | { ok: false; kind: 'unparsed' }
  /** A candidate WAS produced but this step's policy rejects it — reprompts, but is NEVER a miss. */
  | { ok: false; kind: 'rejected'; reasonKey: string; data?: unknown };

export interface BookingStepDef {
  readonly id: BookingStepId;
  /** Terminal step returns `false` forever — `currentStep` then always derives back to it once every earlier step is filled. */
  readonly isSatisfied: (slots: BookingSlots) => boolean;
  /** TEXT ONLY: read free-form words into a candidate slot patch. No policy. `null` = could not be read as anything (a miss). */
  readonly parse: (text: string, ctx: BookingParseContext) => Partial<BookingSlots> | null;
  /** POLICY: is this candidate acceptable at this step, in this context? Shared by BOTH the typed path (after `parse` succeeds) and the `chip` path (which skips `parse` only). Confines the candidate to this step's own slot keys. */
  readonly accept: (candidate: Partial<BookingSlots>, ctx: BookingParseContext) => BookingStepParseResult;
  /** i18n KEY SUFFIXES only (e.g. `"chip"`, `"chipNoCap"`) — never literal copy. The consuming UI resolves `aiChat.booking.<id>.<suffix>`. */
  readonly chipKeys: readonly string[];
}

// ---------------------------------------------------------------------------
// Shared `accept` helpers — used by every step so the "confine to my own
// keys" rule and the ISO-date sanity checks can never drift between steps.
// ---------------------------------------------------------------------------

/** `true` only when every key `candidate` carries is one this step owns — an empty candidate trivially passes this (and is then caught by the per-field presence check below), a foreign key never does. */
function candidateStaysWithinKeys(
  candidate: Partial<BookingSlots>,
  allowedKeys: readonly (keyof BookingSlots)[]
): boolean {
  return (Object.keys(candidate) as (keyof BookingSlots)[]).every((key) => allowedKeys.includes(key));
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Format AND calendar validity — `2026-02-31` round-trips through `Date` to `2026-03-03` and is caught here, not just a regex shape check. */
function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** CAM-699 — whole nights between two already-validated `YYYY-MM-DD` strings (`checkOut` EXCLUSIVE, same convention as `lib/booking-prefill.ts`'s private `nightsBetween`, re-derived here rather than imported since that helper is not exported and this module stays a self-contained pure module). UTC-anchored, no DST concerns (Thailand has none). */
function nightsBetweenIso(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T00:00:00Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000);
}

/** CAM-699 — `checkIn` + `nights` calendar days (UTC-safe), the ONLY place `checkOut` is derived from a night count. */
function addDaysToIso(iso: string, nights: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + nights)).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// `date` step
//
// The not-in-the-past sanity check below reuses `bangkokTodayISO`, imported
// straight from `@/lib/ai/date-phrases` (now exported there for this exact
// reason) rather than duplicated here — a second Bangkok-today helper is
// exactly the kind of drift this epic keeps paying for elsewhere. Used ONLY
// as a backstop on a candidate that may have bypassed `resolveDatesCore`
// entirely (a `chip`) — typed input never needs this check to reject a date,
// because every `resolveDatesCore` rule already resolves on-or-after today
// by construction.
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

const DATE_STEP_KEYS: readonly (keyof BookingSlots)[] = ['checkIn', 'checkOut'];

/**
 * POLICY for `date`: confine to `checkIn`/`checkOut` only, both must be
 * well-formed ISO calendar dates, `checkOut` must be strictly after
 * `checkIn`, and `checkIn` must not be before today (Bangkok). Runs for
 * BOTH a successful `parse` (trivially passes — `resolveDatesCore` already
 * guarantees all of this) and a `chip` candidate (the actual reason this
 * function exists: a chip never went through `resolveDatesCore` at all).
 *
 * CAM-699 — the ONE place `nights` is ever PRE-FILLED. A candidate whose own
 * span already covers MORE than one night (a typed range phrase — the
 * weekend rule resolves 2 nights, a long-weekend span can resolve more; see
 * `resolveDatesCore`) is real evidence the camper already said how many
 * nights they want, so the `nights` step auto-satisfies and is never asked
 * again (`nightsStep.isSatisfied` below). A 1-night span proves nothing
 * either way — EVERY single-day resolution (a typed single date, a date
 * CHIP's own `checkIn+1` placeholder from `use-ai-chat.ts`) also produces
 * exactly that same span — so `nights` is deliberately left UNSET and the
 * `nights` step still asks.
 */
function acceptDateCandidate(candidate: Partial<BookingSlots>, ctx: BookingParseContext): BookingStepParseResult {
  if (!candidateStaysWithinKeys(candidate, DATE_STEP_KEYS)) {
    return { ok: false, kind: 'rejected', reasonKey: 'foreign_key', data: { keys: Object.keys(candidate) } };
  }
  const { checkIn, checkOut } = candidate;
  if (!isValidIsoDate(checkIn) || !isValidIsoDate(checkOut)) {
    return { ok: false, kind: 'rejected', reasonKey: 'invalid_date' };
  }
  if (checkOut <= checkIn) {
    return { ok: false, kind: 'rejected', reasonKey: 'invalid_range' };
  }
  if (checkIn < bangkokTodayISO(ctx.today)) {
    return { ok: false, kind: 'rejected', reasonKey: 'in_the_past' };
  }
  const span = nightsBetweenIso(checkIn, checkOut);
  return span > 1 ? { ok: true, slots: { checkIn, checkOut, nights: span } } : { ok: true, slots: { checkIn, checkOut } };
}

const dateStep: BookingStepDef = {
  id: 'date',
  isSatisfied: (slots) => slots.checkIn !== undefined && slots.checkOut !== undefined,
  parse: parseDateAnswer,
  accept: acceptDateCandidate,
  chipKeys: ['chip', 'chipNoCap'],
};

// ---------------------------------------------------------------------------
// `nights` step (CAM-699) — closes the "the chat books 1 night no matter
// what" defect (ADR-018 D8): `nights` is asked explicitly (chips 1..4, or a
// typed number) UNLESS `acceptDateCandidate` already pre-filled it from a
// genuine multi-night typed range (see that function's own comment).
//
// `parseNightsAnswer` reads through `parseNightsCount`, which shares its
// digit-token regex AND its 0-99 `THAI_NUMBER_WORDS` table with the `guests`
// step's own `parseGuestCount` (both are thin wrappers over the same
// `parseCountToken` — see that function's doc) — the reuse this ticket asks
// for. Only the trailing classifier word differs ("คืน" vs "คน"), because a
// bare Thai number WORD needs its OWN classifier stripped before the table
// lookup; a digit token (`"3 คืน"`) never needs that step at all.
// ---------------------------------------------------------------------------

function parseNightsAnswer(text: string): Partial<BookingSlots> | null {
  const nights = parseNightsCount(text);
  return nights === null ? null : { nights };
}

const NIGHTS_STEP_KEYS: readonly (keyof BookingSlots)[] = ['nights'];

/**
 * POLICY for `nights`: confine to `nights` only, must be a positive integer,
 * and must not exceed `MAX_BOOKING_NIGHTS` (BR — the real server bound,
 * `lib/validations/booking.ts:54`; catching it here is what keeps that
 * route's English zod message off the camper's screen). `ctx.checkIn` is
 * ALWAYS set by the time this runs (the `nights` step is never current
 * before `date` isSatisfied) — the `null` branch is a defensive guard, not a
 * reachable path in the live flow.
 */
function acceptNightsCandidate(candidate: Partial<BookingSlots>, ctx: BookingParseContext): BookingStepParseResult {
  if (!candidateStaysWithinKeys(candidate, NIGHTS_STEP_KEYS)) {
    return { ok: false, kind: 'rejected', reasonKey: 'foreign_key', data: { keys: Object.keys(candidate) } };
  }
  const { nights } = candidate;
  if (typeof nights !== 'number' || !Number.isSafeInteger(nights) || nights <= 0) {
    return { ok: false, kind: 'rejected', reasonKey: 'invalid_nights' };
  }
  if (nights > MAX_BOOKING_NIGHTS) {
    return { ok: false, kind: 'rejected', reasonKey: 'too_long', data: { max: MAX_BOOKING_NIGHTS } };
  }
  if (!ctx.checkIn) {
    return { ok: false, kind: 'rejected', reasonKey: 'invalid_nights' };
  }
  return { ok: true, slots: { nights, checkOut: addDaysToIso(ctx.checkIn, nights) } };
}

const nightsStep: BookingStepDef = {
  id: 'nights',
  isSatisfied: (slots) => slots.nights !== undefined,
  parse: parseNightsAnswer,
  accept: acceptNightsCandidate,
  chipKeys: ['chip'],
};

// ---------------------------------------------------------------------------
// `guests` step — Thai number words + Arabic digits.
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

/**
 * Shared classifier-stripping core (CAM-699) — `parseGuestCount` (`classifier
 * "คน"`) and `parseNightsCount` (`classifier "คืน"`) are both thin wrappers
 * over this ONE function, so the 0-99 `THAI_NUMBER_WORDS` table (and the
 * digit-token regex) exist exactly once, never a second hand-built table for
 * `nights` — the reuse the CAM-699 ticket asks for. A leading ARABIC-DIGIT
 * token (`"3 คืน"`, `"8 คน"`, a bare `"3"`) is read FIRST and never touches
 * `classifier` at all — the digit is unambiguous regardless of the trailing
 * word. Only a WORD-only answer (`"สามคืน"`, `"แปดคน"`) needs its own
 * classifier stripped before the Thai-number-word lookup — "คน" is never a
 * substring of "คืน" (the vowel mark ื sits between ค and น in "คืน"), so
 * stripping the wrong classifier is a no-op, never a false strip.
 *
 * G3 review, round 3 (policy leaking into `parse`) — a negative or
 * fractional token (`"-5 คน"`, `"3.5 คน"`) IS read, as `-5`/`3.5`, and handed
 * straight through UNCHANGED. Whether that value is an acceptable count is
 * `accept`'s policy question, not this function's: a policy check hidden
 * inside `parse` gave a typed `"-5 คน"` a DIFFERENT consequence (a miss) than
 * the equivalent chip `{guests:-5}` (a rejection) — breaking the exact
 * typed-equals-chip equivalence this whole `parse`/`accept` split exists to
 * guarantee. `accept`'s own `Number.isSafeInteger`/`<= 0` checks now classify
 * `-5` and `3.5` identically for BOTH paths.
 *
 * The regex is still ANCHORED to capture the FULL numeric token including an
 * optional sign/decimal (`-?\d+(?:\.\d+)?`) — this is what stops `"3.5"`
 * being silently misread as bare `3`; the value reaches `accept` as `3.5`,
 * neither truncated nor dropped.
 */
function parseCountToken(text: string, classifier: string): number | null {
  const numericToken = text.match(/-?\d+(?:\.\d+)?/);
  if (numericToken) {
    return Number(numericToken[0]);
  }
  const normalized = text.replace(/\s+/g, '').replace(new RegExp(classifier, 'g'), '');
  if (normalized.length === 0) return null;
  const value = THAI_NUMBER_WORDS.get(normalized);
  return value ?? null;
}

/** `"8 คน"` / `"แปดคน"` / `"8"` all resolve to `8`. `null` ONLY when no number-shaped token exists at all (`"สวัสดี"`, `"คน"` alone) — a genuine "could not read this as a number" case (a miss). */
function parseGuestCount(text: string): number | null {
  return parseCountToken(text, 'คน');
}

/** CAM-699 — `"3 คืน"` / `"สามคืน"` / `"3"` all resolve to `3`. Same contract as `parseGuestCount` (see `parseCountToken`'s own doc), classifier `"คืน"` instead of `"คน"`. */
function parseNightsCount(text: string): number | null {
  return parseCountToken(text, 'คืน');
}

function parseGuestsAnswer(text: string): Partial<BookingSlots> | null {
  const guests = parseGuestCount(text);
  return guests === null ? null : { guests };
}

const GUESTS_STEP_KEYS: readonly (keyof BookingSlots)[] = ['guests'];

/**
 * POLICY for `guests`: confine to `guests` only, must be a positive integer
 * (a party of 0, or a value `parse` never rejects but a chip might smuggle
 * in, like `9999`), and must not exceed `combineCapacityLimit` (BR-3, THE
 * capacity trap this ticket exists to close — checked here, identically,
 * for a typed answer AND a chip, so neither path can drift from the other).
 */
function acceptGuestsCandidate(candidate: Partial<BookingSlots>, ctx: BookingParseContext): BookingStepParseResult {
  if (!candidateStaysWithinKeys(candidate, GUESTS_STEP_KEYS)) {
    return { ok: false, kind: 'rejected', reasonKey: 'foreign_key', data: { keys: Object.keys(candidate) } };
  }
  const { guests } = candidate;
  if (typeof guests !== 'number' || !Number.isSafeInteger(guests) || guests <= 0) {
    return { ok: false, kind: 'rejected', reasonKey: 'invalid_guests' };
  }
  const limit = combineCapacityLimit(ctx.remaining, ctx.maxGuestsPerDay);
  if (limit !== null && guests > limit) {
    return { ok: false, kind: 'rejected', reasonKey: 'over_capacity', data: { limit } };
  }
  return { ok: true, slots: { guests } };
}

const guestsStep: BookingStepDef = {
  id: 'guests',
  isSatisfied: (slots) => slots.guests !== undefined,
  parse: parseGuestsAnswer,
  accept: acceptGuestsCandidate,
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
  // A chip should never reach `summary` (`chipKeys: []`); if one does anyway
  // (a caller bug), there is nothing here to accept — reject, never a
  // silent no-op advance.
  accept: () => ({ ok: false, kind: 'rejected', reasonKey: 'nothing_to_accept' }),
  chipKeys: [],
};

/**
 * The registry — order matters (it is the step SEQUENCE). A new step is
 * inserted BEFORE `summaryStep`, which must stay last/terminal.
 *
 * CAM-699 — `nights` inserted between `date` and `guests` (ADR-018 D7/D8:
 * the pitch/guest ceiling and the total are computed FOR the span, so the
 * night count must be known before either). `BOOKING_STEPS.length` (read by
 * `AiChatBookingStep.tsx`'s `StepCaption` for the `{total}` in "ขั้นที่ N จาก
 * {total}") is now 4 for every camp — CAM-700 will make it per-camp once the
 * conditional `spot` step lands for per-pitch camps (design brief §2), which
 * is deliberately NOT this story's surface.
 */
export const BOOKING_STEPS: readonly BookingStepDef[] = [dateStep, nightsStep, guestsStep, summaryStep];

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
   * step (`kind:'unparsed'`). Reset to 0 on every turn that IS understood —
   * whether accepted (`advance`) or understood-but-rejected (`rejected`, e.g.
   * over-capacity): a rejected reply is a real, comprehended answer, not a
   * miss.
   */
  consecutiveMisses: number;
}

export function createInitialBookingFlowState(): BookingFlowState {
  return { slots: {}, consecutiveMisses: 0 };
}

/**
 * `text` is free-form camper input: the current step's `parse` reads it into
 * a candidate, which then goes through that SAME step's `accept` (the
 * policy check) before it can ever reach `state.slots`. `chip` is a UI
 * affordance that already knows its own candidate slot value — it skips
 * `parse` ONLY; it still goes through `accept`, exactly like typed input
 * (G3 review, round 2: round 1 let a chip skip `accept` too, which bypassed
 * the capacity trap entirely — fixed by giving `parse` and `chip` exactly
 * ONE shared gate, `accept`, that neither path can route around).
 */
export type BookingFlowInput =
  | { kind: 'text'; text: string }
  | { kind: 'chip'; slots: Partial<BookingSlots> }
  | { kind: 'cancel' };

export type BookingFlowOutcome =
  | { kind: 'advance'; state: BookingFlowState }
  | { kind: 'reprompt'; state: BookingFlowState; reason: 'unparsed' }
  /** `reasonKey`/`data` mirror the step's own `rejected` result verbatim — `advanceBookingFlow` never inspects which step produced them. */
  | { kind: 'reprompt'; state: BookingFlowState; reason: 'rejected'; reasonKey: string; data?: unknown }
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
 * Turns ONE step's `accept` result into this turn's flow outcome. Reads only
 * `result`/`state` — NEVER a step id — so a step that rejects a candidate
 * (the `guests` over-capacity case today; a future out-of-stock `gear` step
 * tomorrow) is treated identically without this function knowing which step
 * produced the result. Exported so a test can prove the mechanism generically
 * against a throwaway rejecting result, without wiring a real step into the
 * registry (the G3 review's repro).
 */
export function applyStepParseResult(state: BookingFlowState, result: BookingStepParseResult): BookingFlowOutcome {
  if (result.ok) {
    return {
      kind: 'advance',
      state: { slots: { ...state.slots, ...result.slots }, consecutiveMisses: 0 },
    };
  }

  if (result.kind === 'rejected') {
    return {
      kind: 'reprompt',
      state: { slots: state.slots, consecutiveMisses: 0 },
      reason: 'rejected',
      reasonKey: result.reasonKey,
      data: result.data,
    };
  }

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

/**
 * Advances (or exits) the flow for ONE turn. Pure: never mutates `state` or
 * `ctx` — every branch returns fresh objects. Never branches on a step's id.
 *
 * - `cancel` exits immediately from ANY step, no prefill (BR: the camper
 *   explicitly walked away — there is nothing to hand off).
 * - `chip` skips `parse` (its value is already known) but is fed straight
 *   into the CURRENT step's `accept` — the SAME policy gate typed input goes
 *   through, so an over-capacity/foreign-key/malformed chip is rejected
 *   exactly like its typed equivalent, never merged unchecked.
 * - `text` asks the CURRENT step (derived, never stored) to `parse` it; a
 *   `null` candidate is an immediate miss (`applyStepParseResult` handles the
 *   escape hatch); a real candidate goes through that SAME step's `accept`.
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

  if (input.kind === 'chip') {
    return applyStepParseResult(state, step.accept(input.slots, ctx));
  }

  const candidate = step.parse(input.text, ctx);
  if (candidate === null) {
    return applyStepParseResult(state, { ok: false, kind: 'unparsed' });
  }
  return applyStepParseResult(state, step.accept(candidate, ctx));
}
