/**
 * components/ai-chat/booking-turn.ts — CAM-640 (epic CAM-630, in-chat guided
 * booking, design brief CAM-637)
 *
 * The orchestration layer that turns ONE camper action (start / a typed or
 * chip answer / back-or-edit / cancel) into the next `ChatEntry[]` + the
 * next `BookingSession | null`. Pure — no React import, no `setSending`, no
 * network call. `use-ai-chat.ts` is the ONLY caller: it holds a ref to the
 * current `BookingSession`, calls one function here per camper action, then
 * applies the returned `{entries, booking}` via `setEntries`/`ref.current =`.
 *
 * This split is what makes "the composer is never disabled during a booking
 * turn" a STRUCTURAL guarantee rather than a rule someone has to remember
 * correctly on every future edit — this file has no `sending` state to
 * touch at all, so a booking turn resolving here can never disable the
 * composer as a side effect (see `story.md` AC-2/BR-2).
 *
 * Out of this story's scope (see `story.md` "Out of scope"): the design
 * brief's §5 E1/E3 LIVE pre-summary availability re-check (a network call
 * right as `guests` completes). The `weekendAvailability` snapshot captured
 * at flow start is treated as authoritative for the life of one flow; the
 * §1 "a typed full day is answered immediately" behaviour below is a
 * SYNCHRONOUS lookup against that same snapshot, not a network re-fetch.
 *
 * CAM-700 — `resolveSpotStep`/`resolveSpotSelection` at the bottom of this
 * file ARE async and DO reach for the network, but never directly: the
 * caller (`use-ai-chat.ts`) injects the fetch as a plain function parameter
 * (dependency injection), so this module still imports zero of
 * `lib/api-client.ts`'s runtime code (type-only where needed) and both
 * functions stay fully unit-testable with a fake fetcher — no jsdom/RTL
 * harness, matching every other test in this file's family.
 */
import {
  advanceBookingFlow,
  createInitialBookingFlowState,
  currentStep,
  type BookingFlowInput,
  type BookingFlowState,
  type BookingSpotCandidate,
  type BookingStepId,
} from '@/components/ai-chat/booking-flow';
import { appendBookingEntry, appendBookingNotice, appendUserQuestion, type ChatEntry } from '@/components/ai-chat/conversation';
import {
  addDaysToIso,
  buildDateQuestionView,
  buildGuestsQuestionView,
  buildNightsQuestionView,
  buildSpotQuestionView,
  buildSummaryView,
  extractDisplayNumber,
  isDateFull,
  remainingForDate,
  type BookingCampContext,
} from '@/components/ai-chat/booking-view';
import { bangkokTodayISO } from '@/lib/ai/date-phrases';
import type { Language, TranslationType } from '@/locales/translations';

/** The live flow state + the camp snapshot it runs against — held by `use-ai-chat.ts` in a ref, never in React state (a booking turn is never itself "in flight"). */
export interface BookingSession {
  state: BookingFlowState;
  camp: BookingCampContext;
  /**
   * CAM-700 — the `spot` step's live, already-eligible candidate list
   * (fetched once per attempt — see `resolveSpotStep`). Optional so every
   * `BookingSession` literal written before this story keeps compiling
   * unchanged; every read goes through `session.spotCandidates ?? null`.
   */
  spotCandidates?: readonly BookingSpotCandidate[] | null;
}

export interface BookingTurnResult {
  entries: ChatEntry[];
  /** `null` means the flow just exited (cancelled, or handed to the assistant) — the caller's ref goes back to `null` too. */
  booking: BookingSession | null;
}

/** "เริ่มจอง" tapped (`AiChatDetailCard`) — appends the first (date) question, from a fresh flow state. */
export function startBookingTurn(
  entries: ChatEntry[],
  camp: BookingCampContext,
  t: TranslationType,
  language: Language
): BookingTurnResult {
  const view = buildDateQuestionView({ camp, t, language, reason: 'ask' });
  return { entries: appendBookingEntry(entries, 'date', view), booking: { state: createInitialBookingFlowState(), camp } };
}

/**
 * A typed or chip answer for the CURRENT step. Echoes the answer as a user
 * bubble FIRST (both a chip tap and typed text are "the camper's own
 * words" — design brief §2's step-2 wireframe shows this for a chip; a
 * typed answer already shows as a user bubble everywhere else in this
 * chat), then advances the flow.
 */
export function processBookingTurn(
  entries: ChatEntry[],
  session: BookingSession,
  input: BookingFlowInput,
  echoText: string,
  t: TranslationType,
  language: Language,
  now: Date
): BookingTurnResult {
  const { state, camp } = session;
  const spotCandidates = session.spotCandidates ?? null;
  const withEcho = appendUserQuestion(entries, echoText);
  const wasDateStep = currentStep(state.slots, camp.useSpotView).id === 'date';
  const outcome = advanceBookingFlow(
    state,
    input,
    {
      today: now,
      remaining: state.slots.checkIn ? remainingForDate(camp.weekendAvailability, state.slots.checkIn) : null,
      maxGuestsPerDay: camp.maxGuestsPerDay,
      // CAM-699 — the `nights` step's own `accept` needs `checkIn` (already
      // answered by the time `nights` is current) to derive `checkOut`.
      checkIn: state.slots.checkIn ?? null,
      // CAM-700 — needed only while `spot` is current (the reject/miss path
      // below); the successful-advance path never reaches here for `spot`
      // (see `resolveSpotSelection`, which peeks BEFORE ever calling this
      // function, so a real candidate never commits without the async
      // occupancy check).
      spotCandidates,
    },
    camp.useSpotView
  );

  if (outcome.kind === 'advance') {
    const newStep = currentStep(outcome.state.slots, camp.useSpotView);
    // §1 "a typed full day is answered immediately" — a SYNCHRONOUS lookup
    // against the static snapshot (never a network re-check, see the file
    // header). Only reachable leaving `date` via TYPED input — a chip's
    // candidate date always came from this same snapshot's own open days.
    if (
      wasDateStep &&
      newStep.id !== 'date' &&
      outcome.state.slots.checkIn &&
      isDateFull(camp.weekendAvailability, outcome.state.slots.checkIn)
    ) {
      const view = buildDateQuestionView({ camp, t, language, reason: 'full', fullDate: outcome.state.slots.checkIn });
      return { entries: appendBookingEntry(withEcho, 'date', view), booking: { state, camp } };
    }
    if (newStep.id === 'summary') {
      const view = buildSummaryView({ slots: outcome.state.slots, camp, t, language, today: bangkokTodayISO(now) });
      return { entries: appendBookingEntry(withEcho, 'summary', view), booking: { state: outcome.state, camp } };
    }
    if (newStep.id === 'nights') {
      // CAM-699 — reached whenever `date` advances but the span was NOT a
      // genuine multi-night typed range (see `acceptDateCandidate`'s own
      // comment) — this is the camper who tapped a date CHIP, or typed a
      // single day.
      const view = buildNightsQuestionView({ slots: outcome.state.slots, t, language, reason: 'ask', useSpotView: camp.useSpotView });
      return { entries: appendBookingEntry(withEcho, 'nights', view), booking: { state: outcome.state, camp } };
    }
    if (newStep.id === 'spot') {
      // CAM-700 — freshly reached from `guests`: candidates are never known
      // yet at THIS synchronous point (the fetch is `use-ai-chat.ts`'s job,
      // via `resolveSpotStep`, right after this result is applied) — render
      // the immediate "checking" feedback (loading.md §1) and let the caller
      // replace it once the fetch resolves.
      const view = buildSpotQuestionView({ t, useSpotView: camp.useSpotView, reason: 'loading', candidates: [] });
      return { entries: appendBookingEntry(withEcho, 'spot', view), booking: { state: outcome.state, camp, spotCandidates: null } };
    }
    const view =
      newStep.id === 'guests'
        ? buildGuestsQuestionView({ slots: outcome.state.slots, camp, t, language, reason: 'ask' })
        : buildDateQuestionView({ camp, t, language, reason: 'ask' });
    return { entries: appendBookingEntry(withEcho, newStep.id, view), booking: { state: outcome.state, camp } };
  }

  if (outcome.kind === 'reprompt') {
    const step = currentStep(outcome.state.slots, camp.useSpotView);
    if (step.id === 'date') {
      const view = buildDateQuestionView({ camp, t, language, reason: 'unreadable' });
      return { entries: appendBookingEntry(withEcho, 'date', view), booking: { state: outcome.state, camp } };
    }
    if (step.id === 'nights') {
      // Only `too_long` (>MAX_BOOKING_NIGHTS) gets its own copy; every other
      // rejection (e.g. `invalid_nights`, a party of 0/negative) reuses the
      // `unreadable` sentence — the SAME precedent `guests` already sets for
      // its own non-`over_capacity` rejections just below.
      if (outcome.reason === 'rejected' && outcome.reasonKey === 'too_long') {
        const max = (outcome.data as { max: number } | undefined)?.max;
        const view = buildNightsQuestionView({ slots: outcome.state.slots, t, language, reason: 'tooLong', max, useSpotView: camp.useSpotView });
        return { entries: appendBookingEntry(withEcho, 'nights', view), booking: { state: outcome.state, camp } };
      }
      const view = buildNightsQuestionView({ slots: outcome.state.slots, t, language, reason: 'unreadable', useSpotView: camp.useSpotView });
      return { entries: appendBookingEntry(withEcho, 'nights', view), booking: { state: outcome.state, camp } };
    }
    if (step.id === 'spot') {
      // CAM-700 — a typed miss / a rejected (foreign-key, invalid_spot)
      // candidate at `spot`; every non-specific rejection reuses `unreadable`
      // (the same precedent `nights`/`guests` set above for THEIR own
      // non-primary rejections).
      const view = buildSpotQuestionView({ t, useSpotView: camp.useSpotView, reason: 'unreadable', candidates: spotCandidates ?? [] });
      return { entries: appendBookingEntry(withEcho, 'spot', view), booking: { state: outcome.state, camp, spotCandidates } };
    }
    // step.id === 'guests'
    if (outcome.reason === 'rejected' && outcome.reasonKey === 'over_capacity') {
      const limit = (outcome.data as { limit: number } | undefined)?.limit ?? 0;
      const remaining = outcome.state.slots.checkIn
        ? remainingForDate(camp.weekendAvailability, outcome.state.slots.checkIn)
        : null;
      const view = buildGuestsQuestionView({
        slots: outcome.state.slots,
        camp,
        t,
        language,
        reason: 'overCapacity',
        overCapacityData: {
          remaining: remaining ?? limit,
          requested: extractDisplayNumber(input.kind === 'text' ? input.text : ''),
          limit,
        },
      });
      return { entries: appendBookingEntry(withEcho, 'guests', view), booking: { state: outcome.state, camp } };
    }
    const view = buildGuestsQuestionView({ slots: outcome.state.slots, camp, t, language, reason: 'unreadable' });
    return { entries: appendBookingEntry(withEcho, 'guests', view), booking: { state: outcome.state, camp } };
  }

  // outcome.kind === 'exit' — cancelled, or the 2-strike escape hatch handed
  // to the assistant. Either way `booking` returns to null: the NEXT
  // `sendMessage` call (a plain new send) reaches the network normally.
  const noticeText = outcome.reason === 'cancelled' ? t.aiChat.booking.cancelled : t.aiChat.booking.handedToAssistant;
  return { entries: appendBookingNotice(withEcho, noticeText), booking: null };
}

/**
 * `ย้อนกลับ` (from `nights`, `toStep:'date'`; from `guests`, `toStep:'nights'`)
 * / `แก้วัน` (`toStep:'date'`) / `แก้จำนวนคน` (`toStep:'guests'`) — clears
 * ONLY the field(s) `toStep` owns so `currentStep` derives back there;
 * anything answered further along (e.g. `guests`, when going back to
 * `nights`) is KEPT, matching the design brief's E1 note on the
 * derived-step design "paying for itself": picking a still-valid answer
 * re-derives straight past the intervening steps with no re-ask. No
 * control/echo bubble — this is a navigation action, not an answer.
 *
 * CAM-699 — `toStep:'date'` also clears `nights` (never just `checkIn`/
 * `checkOut`). A deliberate, conservative simplification over the design
 * brief's later (round-2, out of this story's scope) 409-rewind table, which
 * keeps `nights` across a date-only edit: doing that safely needs the `date`
 * step itself to know about and re-derive `checkOut` against a KEPT `nights`
 * value when the camper picks a new day, which this story does not build.
 * Keeping `nights` here without that would risk `checkOut` silently
 * disagreeing with `nights` the moment `date` is re-answered with a
 * 1-night-shaped candidate — this flow's `nights` step would then wrongly
 * read as already-satisfied (see `acceptDateCandidate`'s own comment) and
 * skip asking again with the STALE night count. Clearing both together
 * cannot drift; the cost is one extra re-ask of `nights` after `แก้วัน`.
 *
 * `toStep:'nights'` clears ONLY `nights` — `checkOut` is left as-is (stale
 * until `nights` is re-answered) so `dateStep.isSatisfied` (which still
 * requires both `checkIn` AND `checkOut`) keeps regarding `date` as
 * satisfied and `currentStep` lands on `nights`, not back on `date`.
 *
 * CAM-700 — `spotId`/`spotName` are cleared by EVERY `toStep` except `spot`
 * itself: editing an earlier field (date/nights/guests) can change which
 * pitches are even offerable (span or party size moved), so a previously
 * chosen pitch is never carried forward silently. `spotCandidates` is reset
 * to `null` alongside it for the SAME reason — the eligible list itself may
 * have changed — forcing a fresh `resolveSpotStep` fetch the next time
 * `spot` is reached. `toStep:'spot'` (the summary's `แก้จุดกางเต็นท์`) is the
 * one exception: dates/guests are unchanged, so the cached candidates are
 * still valid and this can rebuild the block SYNCHRONOUSLY, no fetch.
 */
export function processBookingControl(
  entries: ChatEntry[],
  session: BookingSession,
  toStep: BookingStepId,
  t: TranslationType,
  language: Language
): BookingTurnResult {
  const { camp } = session;
  const slots = { ...session.state.slots };
  let spotCandidates = session.spotCandidates ?? null;
  if (toStep === 'date') {
    delete slots.checkIn;
    delete slots.checkOut;
    delete slots.nights;
    delete slots.spotId;
    delete slots.spotName;
    spotCandidates = null;
  } else if (toStep === 'nights') {
    delete slots.nights;
    delete slots.spotId;
    delete slots.spotName;
    spotCandidates = null;
  } else if (toStep === 'guests') {
    delete slots.guests;
    delete slots.spotId;
    delete slots.spotName;
    spotCandidates = null;
  } else if (toStep === 'spot') {
    delete slots.spotId;
    delete slots.spotName;
    // `spotCandidates` intentionally KEPT — see doc comment above.
  }
  const state: BookingFlowState = { slots, consecutiveMisses: 0 };
  const step = currentStep(slots, camp.useSpotView);
  const view =
    step.id === 'spot'
      ? buildSpotQuestionView({
          t,
          useSpotView: camp.useSpotView,
          reason: spotCandidates && spotCandidates.length > 0 ? 'ask' : 'loading',
          candidates: spotCandidates ?? [],
        })
      : step.id === 'guests'
        ? buildGuestsQuestionView({ slots, camp, t, language, reason: 'ask' })
        : step.id === 'nights'
          ? buildNightsQuestionView({ slots, t, language, reason: 'ask', useSpotView: camp.useSpotView })
          : buildDateQuestionView({ camp, t, language, reason: 'ask' });
  return { entries: appendBookingEntry(entries, step.id, view), booking: { state, camp, spotCandidates } };
}

/** `ยกเลิกการจอง` — exits unconditionally from any step; no re-check needed. */
export function processBookingCancel(entries: ChatEntry[], t: TranslationType): BookingTurnResult {
  return { entries: appendBookingNotice(entries, t.aiChat.booking.cancelled), booking: null };
}

// ---------------------------------------------------------------------------
// CAM-700 — the `spot` step's async orchestration. Both functions below
// accept the fetch as an injected PARAMETER (dependency injection) rather
// than importing `lib/api-client.ts` themselves, so they stay unit-testable
// with a fake fetcher (see the file header's own note).
// ---------------------------------------------------------------------------

/**
 * The RAW result of fetching + guest-filtering a camp's pitches, decided
 * entirely by the injected `fetchSpots` callback:
 *   - `ok:false` — the fetch itself failed, OR the camp has literally zero
 *     live pitches at all. `resolveSpotStep` fails TOWARD the handoff for
 *     this case (ADR-018 §4 — never a pitch-less confirm, never a stall).
 *   - `ok:true, candidates:[]` — the fetch succeeded but NONE of the camp's
 *     real pitches fit this party size. This is design brief §4's real
 *     "Empty is real here" state (stays on `spot`, offers the edit trio).
 */
export type SpotFetchOutcome =
  | { ok: true; candidates: readonly BookingSpotCandidate[] }
  | { ok: false };

/**
 * Runs the moment the flow reaches `spot` with no candidates cached yet
 * (`use-ai-chat.ts`'s `settleBookingTurn`, right after applying a turn that
 * just landed on the `loading` block built above). Never called for a
 * whole-camp flow (that never resolves to `spot` at all).
 */
export async function resolveSpotStep(
  entries: ChatEntry[],
  session: BookingSession,
  fetchSpots: (campId: string, guests: number) => Promise<SpotFetchOutcome>,
  t: TranslationType,
  language: Language,
  now: Date
): Promise<BookingTurnResult> {
  const { camp, state } = session;
  const outcome = await fetchSpots(camp.campId, state.slots.guests!);

  if (!outcome.ok) {
    // CAM-700 — fail TOWARD the handoff: this session's camp copy is
    // downgraded to whole-camp for the REST of this flow (no spot data
    // exists to offer), so `currentStep` skips `spot` from here on and the
    // EXISTING whole-camp summary (with its handoff CTA) renders unchanged —
    // never a pitch-less confirm. The camp page itself still requires a
    // pitch on a `useSpotView` camp (ADR-018 D7); this flow simply hands off
    // to it rather than blocking on data it does not have.
    const downgradedCamp: BookingCampContext = { ...camp, useSpotView: false };
    const view = buildSummaryView({ slots: state.slots, camp: downgradedCamp, t, language, today: bangkokTodayISO(now) });
    return { entries: appendBookingEntry(entries, 'summary', view), booking: { state, camp: downgradedCamp, spotCandidates: null } };
  }

  const view = buildSpotQuestionView({
    t,
    useSpotView: true,
    reason: outcome.candidates.length > 0 ? 'ask' : 'empty',
    candidates: outcome.candidates,
  });
  return { entries: appendBookingEntry(entries, 'spot', view), booking: { state, camp, spotCandidates: outcome.candidates } };
}

/**
 * The result of a spot-step SELECTION attempt (chip tap or typed name).
 * `retry` is present ONLY when the availability check itself failed
 * (network/off-contract) — `entries`/`booking` in that case already carry
 * the camper's echo but NOT a `checkFailed` block yet: this module owns no
 * React callback, so the caller builds the real `onRetry` closure and
 * appends the block itself (design brief §5 E3's shape, reused).
 */
export interface SpotSelectionOutcome {
  entries: ChatEntry[];
  booking: BookingSession | null;
  retry?: { input: BookingFlowInput; echoText: string };
}

/**
 * Resolves ONE typed-or-chip answer at the `spot` step. Reuses
 * `advanceBookingFlow` directly (not `processBookingTurn`) to PEEK at the
 * outcome before committing anything: `spotStep.accept` only proves the
 * candidate is a real, currently-offered pitch (static), never that it is
 * still free (that needs the network). A non-`advance` outcome (miss /
 * rejected / 2-strike exit) is delegated straight to `processBookingTurn` —
 * the SAME generic handling every other step already gets, no network call
 * for a miss (design brief §4, "misses go through the existing machinery").
 */
export async function resolveSpotSelection(
  entries: ChatEntry[],
  session: BookingSession,
  input: BookingFlowInput,
  echoText: string,
  checkAvailability: (campId: string, spotId: string, startDate: string, lastNightDate: string) => Promise<boolean | null>,
  t: TranslationType,
  language: Language,
  now: Date
): Promise<SpotSelectionOutcome> {
  const { camp, state } = session;
  const spotCandidates = session.spotCandidates ?? null;
  const peek = advanceBookingFlow(
    state,
    input,
    {
      today: now,
      remaining: state.slots.checkIn ? remainingForDate(camp.weekendAvailability, state.slots.checkIn) : null,
      maxGuestsPerDay: camp.maxGuestsPerDay,
      checkIn: state.slots.checkIn ?? null,
      spotCandidates,
    },
    camp.useSpotView
  );

  if (peek.kind !== 'advance') {
    const result = processBookingTurn(entries, session, input, echoText, t, language, now);
    return { entries: result.entries, booking: result.booking };
  }

  const spotId = peek.state.slots.spotId!;
  const spotName = peek.state.slots.spotName!;
  const withEcho = appendUserQuestion(entries, echoText);
  const checkIn = state.slots.checkIn!;
  const nights = state.slots.nights!;
  const lastNightDate = addDaysToIso(checkIn, nights - 1);

  const availability = await checkAvailability(camp.campId, spotId, checkIn, lastNightDate);

  if (availability === null) {
    // The check itself failed — never silently assume free. The caller adds
    // the real `checkFailed` block (with a working `onRetry`) on top of
    // these `entries`.
    return { entries: withEcho, booking: { state, camp, spotCandidates }, retry: { input, echoText } };
  }

  if (!availability) {
    // Occupied — fresh chip row, this pitch excluded, `spot` stays current
    // (design brief §4 "Occupied → re-offer, one shape for three routes").
    const remaining = (spotCandidates ?? []).filter((c) => c.id !== spotId);
    const view = buildSpotQuestionView({ t, useSpotView: camp.useSpotView, reason: 'occupied', candidates: remaining, occupiedName: spotName });
    return { entries: appendBookingEntry(withEcho, 'spot', view), booking: { state, camp, spotCandidates: remaining } };
  }

  // Free — commit for real.
  const summaryView = buildSummaryView({ slots: peek.state.slots, camp, t, language, today: bangkokTodayISO(now) });
  return { entries: appendBookingEntry(withEcho, 'summary', summaryView), booking: { state: peek.state, camp, spotCandidates } };
}
