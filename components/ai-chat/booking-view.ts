/**
 * components/ai-chat/booking-view.ts — CAM-640 (epic CAM-630, in-chat
 * guided booking, design brief CAM-637)
 *
 * Pure view-building helpers for the booking flow's presentation
 * (`AiChatBookingStep`, CAM-638). Zero React, zero network — every function
 * here takes already-fetched camp data + the already-resolved translation
 * object and returns a `BookingStepView` (or a raw chip-spec array). This is
 * the SAME "pure logic module, thin React glue" split `booking-flow.ts` and
 * `conversation.ts` already use — `components/ai-chat/booking-turn.ts` is the
 * orchestration layer that calls these.
 *
 * `BookingCampContext` is the ONE snapshot captured when "เริ่มจอง" is
 * tapped (`AiChatDetailCard`'s own already-resolved `getCampDetail` fetch) —
 * this module never fetches on its own behalf. `weekendAvailability` stays
 * static for the life of one flow (design brief §5 E1's LIVE re-check is
 * explicitly out of this story's scope — see `story.md`'s "Out of scope");
 * the "a typed full day is answered immediately" behaviour in §1 is a
 * SYNCHRONOUS lookup against this same snapshot, not a network call.
 *
 * Chip-content formatting (which key, which date format) is resolved here;
 * `AiChatBookingStep.resolveChip` turns a `BookingChipSpec` into the actual
 * chip UI (label/ariaLabel/content) — this module only ever produces the RAW
 * spec (date/remaining or guest count), never a formatted label, so the one
 * "never fabricate a number" rule stays enforced in one place.
 */
import {
  combineCapacityLimit,
  type BookingSlots,
  type BookingSpotCandidate,
} from '@/components/ai-chat/booking-flow';
import type {
  BookingDateChipSpec,
  BookingGuestsChipSpec,
  BookingNightsChipSpec,
  BookingQuestionView,
  BookingSpotChipSpec,
  BookingSummaryView,
} from '@/components/ai-chat/AiChatBookingStep';
import { buildBookingPriceArgs, computeBookingPrice, type PricingUnit } from '@/lib/booking-pricing';
import { buildBookingPrefillQuery, type BookingPrefill } from '@/lib/booking-prefill';
// CAM-699 — the SAME 30-night ceiling `booking-flow.ts`'s `nights` step
// already enforces server-shaped, reused for the `nights.tooLong` fallback
// default below (never a second independently-chosen 30).
import { MAX_BOOKING_NIGHTS } from '@/lib/validations/booking';
import type { WeekendAvailabilityEntry } from '@/lib/ai/tools/get-camp-detail';
import type { Language, TranslationType } from '@/locales/translations';

/** Layout constants (design brief §1/§2/§3) — how many pills fit one row of the ~380px column, never a capacity number. */
export const MAX_BOOKING_DATE_CHIPS = 4;
export const MAX_BOOKING_GUEST_CHIPS = 4;
/**
 * CAM-699 — design brief §3's full formula also truncates to the consecutive
 * OPEN-night "run" from the chosen check-in date
 * (`ceiling = min(run, MAX_BOOKING_NIGHTS)`); computing that run needs a scan
 * across `weekendAvailability` this story does not add (out of scope — see
 * `story.md`). Chips are therefore always `1..MAX_BOOKING_NIGHT_CHIPS`, the
 * same "no run/cap data -> render the full row" fallback
 * `buildGuestChipSpecs(null)` already uses below.
 */
export const MAX_BOOKING_NIGHT_CHIPS = 4;
/** CAM-700 — design brief §4: "the 4 cheapest of `offered`" — a layout constant, never a capacity number. */
export const MAX_BOOKING_SPOT_CHIPS = 4;

/** The one snapshot a flow runs against — captured once when "เริ่มจอง" is tapped (`AiChatDetailCard`'s already-resolved detail fetch). */
export interface BookingCampContext {
  campId: string;
  slug: string;
  name: string;
  weekendAvailability: readonly WeekendAvailabilityEntry[];
  maxGuestsPerDay: number | null;
  /** CAM-700 — whether this camp shows the `spot` step (per-pitch booking, ADR-018 D7). From `GetCampDetailResult.useSpotView` (CAM-700's own additive tool field), threaded through by `AiChatDetailCard`'s `handleStartBooking`. */
  useSpotView: boolean;
  /** Resolved via `resolveUnitPrice` by the caller (design brief §3: the SAME module the camp page uses). Ignored when `priceIsFree`. */
  unitPrice: number;
  /**
   * The unit `unitPrice` is charged per (CAM-652, ADR-014) — the SAME
   * `resolveUnitPrice().unit` result `unitPrice` came from, so a price is
   * never paired with a different row's unit. `get-camp-detail` (lib/ai/**)
   * does not select CampSite.priceUnit yet, so this is always `PER_SITE`
   * today (ADR-014 §2's "no unit recorded" default) — carried as a real
   * field (not hardcoded at the call site) so `buildSummaryView` routes
   * through `buildBookingPriceArgs` like every other pricing call site.
   */
  priceUnit: PricingUnit;
  priceIsFree: boolean;
}

const THB_FORMAT = new Intl.NumberFormat('th-TH');

/** `weekday, day month` — the SAME shape `AiChatDetailCard`/`AiChatBookingStep` already format dates with. */
export function formatBookingDate(iso: string, language: Language): string {
  const formatter = new Intl.DateTimeFormat(language === 'en' ? 'en' : 'th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return formatter.format(new Date(`${iso}T00:00:00Z`));
}

/** `checkIn` + 1 calendar day (UTC-safe) — round-1 books exactly one night (design brief §3 "one night, stated in the copy"). */
export function addOneDayIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
}

/** CAM-700 — `iso` + `days` calendar days (UTC-safe), the general form `addOneDayIso` specializes. Used to derive the LAST NIGHT (checkIn + nights - 1) for a spot-availability query, since that route's own convention is inclusive-of-endDate (unlike this flow's exclusive-checkout `checkOut`). */
export function addDaysToIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** `null` = no entry for this date at all (never fabricated); a real entry's own `remaining` (itself nullable = no cap set) otherwise. */
export function remainingForDate(weekendAvailability: readonly WeekendAvailabilityEntry[], date: string): number | null {
  return weekendAvailability.find((e) => e.date === date)?.remaining ?? null;
}

/** An UNKNOWN date (no entry in the snapshot at all) is never treated as full — BR: never fabricate a rejection from absent data. */
export function isDateFull(weekendAvailability: readonly WeekendAvailabilityEntry[], date: string): boolean {
  const entry = weekendAvailability.find((e) => e.date === date);
  if (!entry) return false;
  return entry.blockedByHost || entry.remaining === 0;
}

/** Open days only, soonest-first, capped at `MAX_BOOKING_DATE_CHIPS` (design brief §1). */
export function buildDateChipSpecs(weekendAvailability: readonly WeekendAvailabilityEntry[]): BookingDateChipSpec[] {
  return weekendAvailability
    .filter((e) => !e.blockedByHost && e.remaining !== 0)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, MAX_BOOKING_DATE_CHIPS)
    .map((e) => ({ kind: 'date' as const, date: e.date, remaining: e.remaining }));
}

/** `1..min(ceiling, MAX_BOOKING_GUEST_CHIPS)`; `ceiling === null` (both caps unknown) renders `1..MAX_BOOKING_GUEST_CHIPS` (design brief §2 formula). */
export function buildGuestChipSpecs(ceiling: number | null): BookingGuestsChipSpec[] {
  const max = ceiling === null ? MAX_BOOKING_GUEST_CHIPS : Math.min(ceiling, MAX_BOOKING_GUEST_CHIPS);
  if (max <= 0) return [];
  return Array.from({ length: max }, (_, i) => ({ kind: 'guests' as const, count: i + 1 }));
}

/** `1..MAX_BOOKING_NIGHT_CHIPS`, always (see that constant's own comment on the run-based truncation this story does not add). Never empty by construction (design brief §3/§9). */
export function buildNightChipSpecs(): BookingNightsChipSpec[] {
  return Array.from({ length: MAX_BOOKING_NIGHT_CHIPS }, (_, i) => ({ kind: 'nights' as const, count: i + 1 }));
}

/** CAM-700 — the `spot` step's chips: `candidates` is assumed ALREADY eligible (guest-capacity filtered, occupied excluded — the caller's job); this only sorts cheapest-first and caps at `MAX_BOOKING_SPOT_CHIPS` (design brief §4: "the 4 cheapest of offered"). Never empty by construction from a non-empty input; an empty input renders no chips (the `spot.empty` state, decided by the caller). */
export function buildSpotChipSpecs(candidates: readonly BookingSpotCandidate[]): BookingSpotChipSpec[] {
  return candidates
    .slice()
    .sort((a, b) => a.pricePerNight - b.pricePerNight)
    .slice(0, MAX_BOOKING_SPOT_CHIPS)
    .map((c) => ({ kind: 'spot' as const, id: c.id, name: c.name, pricePerNight: c.pricePerNight }));
}

/** Best-effort numeric echo of a REJECTED typed guest answer, for the over-capacity notice only — display, never policy (the state machine's own `accept()` already decided validity). */
export function extractDisplayNumber(text: string): string {
  return text.match(/-?\d+(?:\.\d+)?/)?.[0] ?? text.trim();
}

/** The user-bubble echo for a tapped date chip (design brief §2: "the camper's own answer" bubble). */
export function formatDateEcho(iso: string, camp: BookingCampContext, t: TranslationType, language: Language): string {
  const remaining = remainingForDate(camp.weekendAvailability, iso);
  const suffix =
    remaining === null ? t.aiChat.detail.openNoCap : t.aiChat.card.remaining.replace('{count}', String(remaining));
  return `${formatBookingDate(iso, language)} ${suffix}`;
}

/** The user-bubble echo for a tapped guests chip. */
export function formatGuestsEcho(count: number, t: TranslationType): string {
  return t.aiChat.booking.guests.chip.replace('{count}', String(count));
}

/** CAM-700 — the user-bubble echo for a picked pitch (chip tap or a resolved typed name). */
export function formatSpotEcho(name: string, pricePerNight: number, t: TranslationType): string {
  return t.aiChat.booking.spot.chip.replace('{name}', name).replace('{price}', `฿${THB_FORMAT.format(pricePerNight)}`);
}

/** The user-bubble echo for a tapped nights chip. */
export function formatNightsEcho(count: number, t: TranslationType): string {
  return t.aiChat.booking.nights.chip.replace('{count}', String(count));
}

export interface DateQuestionParams {
  camp: BookingCampContext;
  t: TranslationType;
  language: Language;
  reason: 'ask' | 'unreadable' | 'full';
  /** Only for `reason:'full'` — the specific checkIn date that turned out to be full. */
  fullDate?: string;
}

export function buildDateQuestionView({ camp, t, language, reason, fullDate }: DateQuestionParams): BookingQuestionView {
  const chips = buildDateChipSpecs(camp.weekendAvailability);
  const questionText =
    reason === 'unreadable'
      ? t.aiChat.booking.date.unreadable
      : reason === 'full' && fullDate
        ? t.aiChat.booking.date.full.replace('{date}', formatBookingDate(fullDate, language))
        : chips.length === 0
          ? t.aiChat.booking.date.empty
          : t.aiChat.booking.date.ask.replace('{name}', camp.name);

  return {
    kind: 'question',
    step: 'date',
    isCurrent: true,
    questionText,
    chips,
    controls: [{ kind: 'cancel' }],
    useSpotView: camp.useSpotView,
  };
}

export interface NightsQuestionParams {
  /** Only `slots.checkIn` is read (for the `{date}` in the `ask` sentence) — the step's own chips never depend on it (see `buildNightChipSpecs`). */
  slots: BookingSlots;
  t: TranslationType;
  language: Language;
  reason: 'ask' | 'unreadable' | 'tooLong';
  /** Only for `reason:'tooLong'` — the real `MAX_BOOKING_NIGHTS` ceiling the rejection carried (never fabricated); falls back to the shared constant if somehow absent. */
  max?: number;
  /** CAM-700 — for the caption's per-camp `{total}`; `nights` itself never gains a spot-specific branch. */
  useSpotView: boolean;
}

/** CAM-699 — the `nights` step's question view. The chip row is unconditional (never empty, design brief §3/§9), so there is no `empty` reason to branch on. */
export function buildNightsQuestionView({ slots, t, language, reason, max, useSpotView }: NightsQuestionParams): BookingQuestionView {
  const dateLabel = slots.checkIn ? formatBookingDate(slots.checkIn, language) : '';
  const questionText =
    reason === 'unreadable'
      ? t.aiChat.booking.nights.unreadable
      : reason === 'tooLong'
        ? t.aiChat.booking.nights.tooLong.replace('{max}', String(max ?? MAX_BOOKING_NIGHTS))
        : t.aiChat.booking.nights.ask.replace('{date}', dateLabel);

  return {
    kind: 'question',
    step: 'nights',
    isCurrent: true,
    questionText,
    chips: buildNightChipSpecs(),
    controls: [{ kind: 'back', toStep: 'date' }, { kind: 'cancel' }],
    useSpotView,
  };
}

export interface GuestsQuestionParams {
  slots: BookingSlots;
  camp: BookingCampContext;
  t: TranslationType;
  language: Language;
  reason: 'ask' | 'unreadable' | 'overCapacity';
  /** Only for `reason:'overCapacity'` — `remaining`/`limit` are real numbers (never fabricated), `requested` is a display-only echo of the rejected typed value. */
  overCapacityData?: { remaining: number; requested: string; limit: number };
}

export function buildGuestsQuestionView({
  slots,
  camp,
  t,
  language,
  reason,
  overCapacityData,
}: GuestsQuestionParams): BookingQuestionView {
  const checkIn = slots.checkIn;
  const remaining = checkIn ? remainingForDate(camp.weekendAvailability, checkIn) : null;
  const dateLabel = checkIn ? formatBookingDate(checkIn, language) : '';

  if (reason === 'overCapacity' && overCapacityData) {
    const questionText = [
      t.aiChat.booking.guests.overCapacity
        .replace('{date}', dateLabel)
        .replace('{remaining}', String(overCapacityData.remaining))
        .replace('{requested}', overCapacityData.requested),
      t.aiChat.booking.guests.overCapacityHint.replace('{remaining}', String(overCapacityData.limit)),
    ].join(' ');
    return {
      kind: 'question',
      step: 'guests',
      isCurrent: true,
      questionText,
      chips: [{ kind: 'guestsCap', count: overCapacityData.limit }],
      // CAM-699 — `nights` now sits directly before `guests` in the
      // registry; `back` returns to the IMMEDIATELY preceding step.
      controls: [{ kind: 'back', toStep: 'nights' }, { kind: 'cancel' }],
      useSpotView: camp.useSpotView,
    };
  }

  const ceiling = combineCapacityLimit(remaining, camp.maxGuestsPerDay);
  const chips = buildGuestChipSpecs(ceiling);
  const questionText =
    reason === 'unreadable'
      ? t.aiChat.booking.guests.unreadable
      : remaining !== null
        ? t.aiChat.booking.guests.ask.replace('{date}', dateLabel).replace('{count}', String(remaining))
        : t.aiChat.booking.guests.askNoCap.replace('{date}', dateLabel);

  return {
    kind: 'question',
    step: 'guests',
    isCurrent: true,
    questionText,
    chips,
    controls: [{ kind: 'back', toStep: 'nights' }, { kind: 'cancel' }],
    useSpotView: camp.useSpotView,
  };
}

export interface SpotQuestionParams {
  t: TranslationType;
  /** CAM-700 — always `true` in practice (this step only exists for a per-pitch camp); carried explicitly rather than assumed, matching every sibling builder's own `useSpotView` field. */
  useSpotView: boolean;
  reason: 'ask' | 'loading' | 'unreadable' | 'occupied' | 'empty';
  /** Already ELIGIBLE (guest-capacity filtered, occupied excluded) — ignored for `reason:'loading'`/`'empty'`. */
  candidates: readonly BookingSpotCandidate[];
  /** Only for `reason:'occupied'` — the pitch name that turned out to be taken (never fabricated). */
  occupiedName?: string;
}

/**
 * CAM-700 — the `spot` step's question view (design brief §4). `reason`
 * covers the step-entry fetch in flight (`'loading'`, chips disabled + a
 * text status line, `isChecking` — the SAME dormant round-1 pattern the
 * `guests` pre-check already established, never a spinner), the normal
 * offer, a typed miss, a fresh re-offer after a pitch turned out occupied,
 * and the real "nothing fits" empty state (unlike `guests`, this one is
 * reachable — design brief §4 "Empty is real here").
 */
export function buildSpotQuestionView({ t, useSpotView, reason, candidates, occupiedName }: SpotQuestionParams): BookingQuestionView {
  if (reason === 'empty') {
    return {
      kind: 'question',
      step: 'spot',
      isCurrent: true,
      questionText: t.aiChat.booking.spot.empty,
      chips: [],
      controls: [{ kind: 'editDate' }, { kind: 'editNights' }, { kind: 'editGuests' }, { kind: 'cancel' }],
      useSpotView,
    };
  }
  const chips = reason === 'loading' ? [] : buildSpotChipSpecs(candidates);
  const questionText =
    reason === 'unreadable'
      ? t.aiChat.booking.spot.unreadable
      : reason === 'occupied'
        ? t.aiChat.booking.spot.occupied.replace('{name}', occupiedName ?? '')
        : t.aiChat.booking.spot.ask;

  return {
    kind: 'question',
    step: 'spot',
    isCurrent: true,
    questionText,
    chips,
    isChecking: reason === 'loading' ? true : undefined,
    controls: [{ kind: 'back', toStep: 'guests' }, { kind: 'cancel' }],
    useSpotView,
  };
}

export interface SummaryParams {
  /** Requires `checkIn`/`checkOut`/`nights`/`guests` all set — only ever called once `currentStep` derives to `summary`. */
  slots: BookingSlots;
  camp: BookingCampContext;
  t: TranslationType;
  language: Language;
  /** `bangkokTodayISO(now)` — the SAME injected-`today` contract `buildBookingPrefillQuery` requires (BR-2 there); never a naive UTC read. */
  today: string;
}

export function buildSummaryView({ slots, camp, t, language, today }: SummaryParams): BookingSummaryView {
  const checkIn = slots.checkIn!;
  const checkOut = slots.checkOut!;
  const guests = slots.guests!;
  // CAM-699 (ADR-018 D8) — the REAL night count, never the round-1 hardcoded
  // `1`. Guaranteed set: `buildSummaryView` only ever runs once `currentStep`
  // derives to `summary`, which requires the `nights` step `isSatisfied`.
  const nights = slots.nights!;
  const dateLabel = formatBookingDate(checkIn, language);
  // CAM-652: routed through buildBookingPriceArgs (the ONE place every
  // pricing call site assembles a ComputeBookingPriceInput) instead of this
  // module building its own — `guests` is the party size the camper already
  // picked in this flow (`slots.guests`), so a PER_PERSON camp's total
  // multiplies here exactly as the server would, once `camp.priceUnit` ever
  // carries a real value (see BookingCampContext's doc comment).
  const priceArgs = buildBookingPriceArgs({
    campSite: { priceLow: camp.unitPrice, priceUnit: camp.priceUnit, extraFeeAmount: null },
    spot: null,
    party: { guests },
    nights,
    vatRate: 0,
  });
  // `ok:false` (TENT_COUNT_UNAVAILABLE) is unreachable — `camp.priceUnit` is
  // always PER_SITE today (see BookingCampContext's doc comment); the
  // fallback only satisfies the discriminated-union return type.
  const totalValue = camp.priceIsFree
    ? t.aiChat.card.free
    : `฿${THB_FORMAT.format(priceArgs.ok ? computeBookingPrice(priceArgs.input).totalAmount : 0)}`;
  const prefill: BookingPrefill = { checkIn, checkOut, guests, from: 'chat' };
  const query = buildBookingPrefillQuery(prefill, { today });
  // CAM-700 — present only for a per-pitch camp that actually picked a
  // pitch; a camp whose `spot` step was bypassed (no data, ADR-018 §4's
  // fail-toward-handoff) never sets `slots.spotId`, so this stays absent —
  // no row, never a `—` (design brief §5 "1").
  const spotValue = slots.spotId && slots.spotName ? slots.spotName : undefined;

  return {
    kind: 'summary',
    isCurrent: true,
    campValue: camp.name,
    datesValue: t.aiChat.booking.summary.datesValue.replace('{date}', dateLabel).replace('{nights}', String(nights)),
    guestsValue: t.aiChat.booking.summary.guestsValue.replace('{count}', String(guests)),
    spotValue,
    totalValue,
    handoffHref: `/campgrounds/${camp.slug}?${query}`,
    controls: spotValue
      ? [{ kind: 'editDate' }, { kind: 'editGuests' }, { kind: 'editSpot' }, { kind: 'cancel' }]
      : [{ kind: 'editDate' }, { kind: 'editGuests' }, { kind: 'cancel' }],
    useSpotView: camp.useSpotView,
  };
}
