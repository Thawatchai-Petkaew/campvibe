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
 */
import {
  advanceBookingFlow,
  createInitialBookingFlowState,
  currentStep,
  type BookingFlowInput,
  type BookingFlowState,
  type BookingStepId,
} from '@/components/ai-chat/booking-flow';
import { appendBookingEntry, appendBookingNotice, appendUserQuestion, type ChatEntry } from '@/components/ai-chat/conversation';
import {
  buildDateQuestionView,
  buildGuestsQuestionView,
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
  const withEcho = appendUserQuestion(entries, echoText);
  const wasDateStep = currentStep(state.slots).id === 'date';
  const outcome = advanceBookingFlow(state, input, {
    today: now,
    remaining: state.slots.checkIn ? remainingForDate(camp.weekendAvailability, state.slots.checkIn) : null,
    maxGuestsPerDay: camp.maxGuestsPerDay,
  });

  if (outcome.kind === 'advance') {
    const newStep = currentStep(outcome.state.slots);
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
    const view =
      newStep.id === 'guests'
        ? buildGuestsQuestionView({ slots: outcome.state.slots, camp, t, language, reason: 'ask' })
        : buildDateQuestionView({ camp, t, language, reason: 'ask' });
    return { entries: appendBookingEntry(withEcho, newStep.id, view), booking: { state: outcome.state, camp } };
  }

  if (outcome.kind === 'reprompt') {
    const step = currentStep(outcome.state.slots);
    if (step.id === 'date') {
      const view = buildDateQuestionView({ camp, t, language, reason: 'unreadable' });
      return { entries: appendBookingEntry(withEcho, 'date', view), booking: { state: outcome.state, camp } };
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
 * `ย้อนกลับ` (from `guests`, `toStep:'date'`) / `แก้วัน` (`toStep:'date'`) /
 * `แก้จำนวนคน` (`toStep:'guests'`) — clears ONLY the field(s) `toStep` owns
 * so `currentStep` derives back there; anything answered further along
 * (e.g. `guests`, when going back to `date`) is KEPT, matching the design
 * brief's E1 note on the derived-step design "paying for itself": picking a
 * still-valid day re-derives straight past `guests` to `summary` with no
 * re-ask. No control/echo bubble — this is a navigation action, not an
 * answer.
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
  if (toStep === 'date') {
    delete slots.checkIn;
    delete slots.checkOut;
  } else if (toStep === 'guests') {
    delete slots.guests;
  }
  const state: BookingFlowState = { slots, consecutiveMisses: 0 };
  const step = currentStep(slots);
  const view =
    step.id === 'guests'
      ? buildGuestsQuestionView({ slots, camp, t, language, reason: 'ask' })
      : buildDateQuestionView({ camp, t, language, reason: 'ask' });
  return { entries: appendBookingEntry(entries, step.id, view), booking: { state, camp } };
}

/** `ยกเลิกการจอง` — exits unconditionally from any step; no re-check needed. */
export function processBookingCancel(entries: ChatEntry[], t: TranslationType): BookingTurnResult {
  return { entries: appendBookingNotice(entries, t.aiChat.booking.cancelled), booking: null };
}
