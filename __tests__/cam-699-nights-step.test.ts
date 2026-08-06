/**
 * cam-699-nights-step.test.ts — CAM-699 (epic CAM-695, ADR-018 D8)
 * "Multi-night is a correctness prerequisite, not a feature nicety"
 *
 * Closes the defect verified in ADR-018/the ticket: the chat booked exactly
 * 1 night no matter what the camper actually said — the date CHIP path
 * hardcoded `checkOut = checkIn + 1`, and `buildSummaryView` hardcoded
 * `nights: 1` even when a typed range phrase (e.g. "สุดสัปดาห์นี้") already
 * resolved a real multi-night span.
 *
 * Pure-logic coverage across the three files this story touches:
 *   - booking-flow.ts  — the `nights` step itself (parse/accept), the
 *     `date` step's pre-fill of `nights` from a genuine multi-night typed
 *     range, and the MAX_BOOKING_NIGHTS ceiling.
 *   - booking-view.ts  — `buildNightsQuestionView`, `buildNightChipSpecs`,
 *     `formatNightsEcho`, and the FIXED `buildSummaryView` (real nights,
 *     real total).
 *   - booking-turn.ts  — the end-to-end chip path and the RED-first typed
 *     regression, both driving `processBookingTurn` exactly as
 *     `use-ai-chat.ts` does.
 *
 * No React, no network — same discipline as cam-633/634/640.
 */
import { describe, expect, it } from 'vitest';
import { getTranslations } from '@/locales/translations';
import {
  advanceBookingFlow,
  createInitialBookingFlowState,
  currentStep,
  MAX_CONSECUTIVE_MISSES,
  type BookingParseContext,
  type BookingSlots,
} from '@/components/ai-chat/booking-flow';
import { MAX_BOOKING_NIGHTS } from '@/lib/validations/booking';
import {
  buildNightChipSpecs,
  buildNightsQuestionView,
  buildSummaryView,
  formatBookingDate,
  formatNightsEcho,
  MAX_BOOKING_NIGHT_CHIPS,
  type BookingCampContext,
} from '@/components/ai-chat/booking-view';
import { processBookingTurn, startBookingTurn, type BookingSession } from '@/components/ai-chat/booking-turn';
import type { ChatEntry } from '@/components/ai-chat/conversation';

const t = getTranslations('th');
const TODAY = new Date('2026-07-22T10:00:00Z'); // Bangkok Wednesday — same fixture cam-633/640 already use

function ctx(overrides: Partial<BookingParseContext> = {}): BookingParseContext {
  return { today: TODAY, holidays: [], remaining: null, maxGuestsPerDay: null, checkIn: null, ...overrides };
}

const CAMP: BookingCampContext = {
  campId: 'cs-699',
  slug: 'phu-chi-fa-camp',
  name: 'ภูชี้ฟ้า',
  weekendAvailability: [
    { date: '2026-08-01', remaining: 6, blockedByHost: false },
    { date: '2026-07-25', remaining: 6, blockedByHost: false }, // "สุดสัปดาห์นี้" resolves here (TODAY is Wed 2026-07-22)
  ],
  maxGuestsPerDay: 10,
  unitPrice: 500,
  priceUnit: 'PER_SITE',
  priceIsFree: false,
};

function bookingEntries(entries: ChatEntry[]) {
  return entries.filter((e) => e.role === 'assistant' && e.kind === 'booking');
}

// ---------------------------------------------------------------------------
// booking-flow.ts — the `nights` step + the `date` step's pre-fill
// ---------------------------------------------------------------------------

describe('nights step — parse/accept (booking-flow.ts)', () => {
  const dateFilled: BookingSlots = { checkIn: '2026-08-01', checkOut: '2026-08-02' };

  it('[normal] typed "3" advances with nights:3, checkOut RE-DERIVED as checkIn + 3', () => {
    const outcome = advanceBookingFlow(
      { slots: dateFilled, consecutiveMisses: 0 },
      { kind: 'text', text: '3' },
      ctx({ checkIn: dateFilled.checkIn! })
    );
    expect(outcome).toEqual({
      kind: 'advance',
      state: { slots: { checkIn: '2026-08-01', checkOut: '2026-08-04', nights: 3 }, consecutiveMisses: 0 },
    });
  });

  it('[normal] "3 คืน" and "สามคืน" (REUSES the guests Thai-number parser) both resolve to the IDENTICAL nights:3', () => {
    const digitOutcome = advanceBookingFlow(
      { slots: dateFilled, consecutiveMisses: 0 },
      { kind: 'text', text: '3 คืน' },
      ctx({ checkIn: dateFilled.checkIn! })
    );
    const wordOutcome = advanceBookingFlow(
      { slots: dateFilled, consecutiveMisses: 0 },
      { kind: 'text', text: 'สามคืน' },
      ctx({ checkIn: dateFilled.checkIn! })
    );
    expect(digitOutcome).toEqual(wordOutcome);
    expect(digitOutcome.kind).toBe('advance');
    if (digitOutcome.kind === 'advance') expect(digitOutcome.state.slots.nights).toBe(3);
  });

  it('[normal] a "2 คืน" CHIP advances identically to the typed equivalent (same parity contract every other step proves)', () => {
    const chipOutcome = advanceBookingFlow(
      { slots: dateFilled, consecutiveMisses: 0 },
      { kind: 'chip', slots: { nights: 2 } },
      ctx({ checkIn: dateFilled.checkIn! })
    );
    const typedOutcome = advanceBookingFlow(
      { slots: dateFilled, consecutiveMisses: 0 },
      { kind: 'text', text: '2' },
      ctx({ checkIn: dateFilled.checkIn! })
    );
    expect(chipOutcome).toEqual(typedOutcome);
  });

  it('[null/empty][boundary] typed "0" is REJECTED (not a miss) — a stay of 0 nights is not a booking', () => {
    const outcome = advanceBookingFlow(
      { slots: dateFilled, consecutiveMisses: 0 },
      { kind: 'text', text: '0' },
      ctx({ checkIn: dateFilled.checkIn! })
    );
    expect(outcome).toEqual({
      kind: 'reprompt',
      state: { slots: dateFilled, consecutiveMisses: 0 }, // rejected, NOT unparsed — no strike burned
      reason: 'rejected',
      reasonKey: 'invalid_nights',
    });
  });

  it('[boundary] typed "31" exceeds MAX_BOOKING_NIGHTS(30) — REJECTED with the real ceiling, never a silently truncated value', () => {
    expect(MAX_BOOKING_NIGHTS).toBe(30);
    const outcome = advanceBookingFlow(
      { slots: dateFilled, consecutiveMisses: 0 },
      { kind: 'text', text: '31' },
      ctx({ checkIn: dateFilled.checkIn! })
    );
    expect(outcome).toEqual({
      kind: 'reprompt',
      state: { slots: dateFilled, consecutiveMisses: 0 },
      reason: 'rejected',
      reasonKey: 'too_long',
      data: { max: 30 },
    });
  });

  it('[boundary] exactly 30 nights is ACCEPTED (the ceiling itself is inclusive)', () => {
    const outcome = advanceBookingFlow(
      { slots: dateFilled, consecutiveMisses: 0 },
      { kind: 'text', text: '30' },
      ctx({ checkIn: dateFilled.checkIn! })
    );
    expect(outcome.kind).toBe('advance');
    if (outcome.kind === 'advance') expect(outcome.state.slots.nights).toBe(30);
  });

  it('[error/validation] garbage text is a genuine MISS (unparsed) — re-asks, burns a strike', () => {
    const outcome = advanceBookingFlow(
      { slots: dateFilled, consecutiveMisses: 0 },
      { kind: 'text', text: 'แล้วมีเปลให้เช่าไหม' },
      ctx({ checkIn: dateFilled.checkIn! })
    );
    expect(outcome).toEqual({
      kind: 'reprompt',
      state: { slots: dateFilled, consecutiveMisses: 1 },
      reason: 'unparsed',
    });
  });

  it('[error/validation] TWO CONSECUTIVE garbage inputs at `nights` exit via the SAME 2-strike escape hatch every other step uses', () => {
    expect(MAX_CONSECUTIVE_MISSES).toBe(2);
    const first = advanceBookingFlow(
      { slots: dateFilled, consecutiveMisses: 0 },
      { kind: 'text', text: 'จะกินอะไรดี' },
      ctx({ checkIn: dateFilled.checkIn! })
    );
    expect(first.kind).toBe('reprompt');
    if (first.kind !== 'reprompt') throw new Error('expected reprompt');

    const second = advanceBookingFlow(first.state, { kind: 'text', text: 'อากาศเป็นไงบ้าง' }, ctx({ checkIn: dateFilled.checkIn! }));
    expect(second).toEqual({ kind: 'exit', reason: 'handoff', prefill: dateFilled });
  });

  it('[error/validation] a REJECTED answer ("0"/"31") does NOT burn a strike — two in a row still reprompts, never ejects', () => {
    const first = advanceBookingFlow(
      { slots: dateFilled, consecutiveMisses: 0 },
      { kind: 'text', text: '0' },
      ctx({ checkIn: dateFilled.checkIn! })
    );
    expect(first.kind).toBe('reprompt');
    if (first.kind !== 'reprompt') throw new Error('expected reprompt');
    expect(first.state.consecutiveMisses).toBe(0);

    const second = advanceBookingFlow(first.state, { kind: 'text', text: '31' }, ctx({ checkIn: dateFilled.checkIn! }));
    expect(second.kind).toBe('reprompt'); // NOT an exit
    if (second.kind !== 'reprompt') throw new Error('expected reprompt, not an exit');
  });

  it('[error/validation] a chip carrying a foreign key (e.g. `guests`) is rejected, never silently merged', () => {
    const outcome = advanceBookingFlow(
      { slots: dateFilled, consecutiveMisses: 0 },
      { kind: 'chip', slots: { guests: 2 } },
      ctx({ checkIn: dateFilled.checkIn! })
    );
    expect(outcome).toEqual({
      kind: 'reprompt',
      state: { slots: dateFilled, consecutiveMisses: 0 },
      reason: 'rejected',
      reasonKey: 'foreign_key',
      data: { keys: ['guests'] },
    });
  });
});

describe('date step pre-fills `nights` for a REAL multi-night typed range, never for a 1-night one (booking-flow.ts)', () => {
  it('[normal][CAM-699][RED-FIRST] typed "สุดสัปดาห์นี้" (weekend rule = 2 real nights) pre-fills nights:2 and skips straight past the `nights` step', () => {
    const outcome = advanceBookingFlow(createInitialBookingFlowState(), { kind: 'text', text: 'สุดสัปดาห์นี้' }, ctx());
    expect(outcome.kind).toBe('advance');
    if (outcome.kind !== 'advance') throw new Error('expected advance');
    expect(outcome.state.slots).toEqual({ checkIn: '2026-07-25', checkOut: '2026-07-27', nights: 2 });
    // The defect this story closes: BEFORE the fix, `nights` was never a
    // slot at all and `buildSummaryView` hardcoded `nights: 1` regardless —
    // a 2-night typed answer would have silently priced/shown 1 night.
    expect(currentStep(outcome.state.slots).id).toBe('guests'); // `nights` auto-satisfied, never asked
  });

  it('[normal] typed "เสาร์หน้า" (a SINGLE day, 1 night) does NOT pre-fill — `nights` is still asked', () => {
    const outcome = advanceBookingFlow(createInitialBookingFlowState(), { kind: 'text', text: 'เสาร์หน้า' }, ctx());
    expect(outcome.kind).toBe('advance');
    if (outcome.kind !== 'advance') throw new Error('expected advance');
    expect(outcome.state.slots).toEqual({ checkIn: '2026-08-01', checkOut: '2026-08-02' });
    expect(currentStep(outcome.state.slots).id).toBe('nights');
  });

  it('[normal] a date CHIP (always exactly 1 night by construction) never pre-fills `nights` either', () => {
    const outcome = advanceBookingFlow(
      createInitialBookingFlowState(),
      { kind: 'chip', slots: { checkIn: '2026-08-01', checkOut: '2026-08-02' } },
      ctx()
    );
    expect(outcome.kind).toBe('advance');
    if (outcome.kind !== 'advance') throw new Error('expected advance');
    expect(outcome.state.slots.nights).toBeUndefined();
    expect(currentStep(outcome.state.slots).id).toBe('nights');
  });
});

// ---------------------------------------------------------------------------
// booking-view.ts — buildNightsQuestionView / buildNightChipSpecs / formatNightsEcho
// ---------------------------------------------------------------------------

describe('buildNightChipSpecs — always 1..MAX_BOOKING_NIGHT_CHIPS, never empty', () => {
  it('[normal] renders exactly 1..MAX_BOOKING_NIGHT_CHIPS', () => {
    expect(MAX_BOOKING_NIGHT_CHIPS).toBe(4);
    expect(buildNightChipSpecs().map((c) => c.count)).toEqual([1, 2, 3, 4]);
  });
});

describe('formatNightsEcho — the tapped nights-chip user-bubble text', () => {
  it('[normal] "{count} คืน"', () => {
    expect(formatNightsEcho(2, t)).toBe(t.aiChat.booking.nights.chip.replace('{count}', '2'));
  });
});

describe('buildNightsQuestionView', () => {
  const slots: BookingSlots = { checkIn: '2026-08-01', checkOut: '2026-08-02' };

  it('[normal] reason:"ask" names the already-picked date', () => {
    const view = buildNightsQuestionView({ slots, t, language: 'th', reason: 'ask' });
    expect(view.step).toBe('nights');
    expect(view.questionText).toBe(t.aiChat.booking.nights.ask.replace('{date}', formatBookingDate('2026-08-01', 'th')));
    expect(view.chips.map((c) => (c.kind === 'nights' ? c.count : null))).toEqual([1, 2, 3, 4]);
    expect(view.controls).toEqual([{ kind: 'back', toStep: 'date' }, { kind: 'cancel' }]);
  });

  it('[error/validation] reason:"unreadable"', () => {
    const view = buildNightsQuestionView({ slots, t, language: 'th', reason: 'unreadable' });
    expect(view.questionText).toBe(t.aiChat.booking.nights.unreadable);
  });

  it('[boundary] reason:"tooLong" names the REAL ceiling, chips unchanged (design brief §3: "the chip row is re-rendered unchanged")', () => {
    const view = buildNightsQuestionView({ slots, t, language: 'th', reason: 'tooLong', max: 30 });
    expect(view.questionText).toBe(t.aiChat.booking.nights.tooLong.replace('{max}', '30'));
    expect(view.chips.map((c) => (c.kind === 'nights' ? c.count : null))).toEqual([1, 2, 3, 4]);
  });

  it('[null/empty] the chip row is never empty by construction', () => {
    const view = buildNightsQuestionView({ slots, t, language: 'th', reason: 'ask' });
    expect(view.chips.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// booking-turn.ts — end-to-end: the CHIP path AC + the RED-first typed AC
// ---------------------------------------------------------------------------

describe('CAM-699 done_when — the chip path: date chip -> nights chip "2" -> guests chip "2"', () => {
  it('[normal] a PER_SITE ฿500 camp shows "พัก 2 คืน" and ฿1,000 — the handoff prefill URL carries the REAL checkOut', () => {
    const start = startBookingTurn([], CAMP, t, 'th');
    const dateStep = processBookingTurn(
      start.entries,
      start.booking!,
      { kind: 'chip', slots: { checkIn: '2026-08-01', checkOut: '2026-08-02' } },
      'echo',
      t,
      'th',
      TODAY
    );
    expect(bookingEntries(dateStep.entries).at(-1)).toMatchObject({ step: 'nights' });

    const nightsStep = processBookingTurn(dateStep.entries, dateStep.booking!, { kind: 'chip', slots: { nights: 2 } }, '2 คืน', t, 'th', TODAY);
    expect(bookingEntries(nightsStep.entries).at(-1)).toMatchObject({ step: 'guests' });
    expect(nightsStep.booking?.state.slots).toEqual({ checkIn: '2026-08-01', checkOut: '2026-08-03', nights: 2 });

    const result = processBookingTurn(nightsStep.entries, nightsStep.booking!, { kind: 'chip', slots: { guests: 2 } }, '2 คน', t, 'th', TODAY);
    const summaryEntry = bookingEntries(result.entries).at(-1);
    expect(summaryEntry).toMatchObject({ step: 'summary' });
    if (!summaryEntry || !('view' in summaryEntry) || summaryEntry.view.kind !== 'summary') {
      throw new Error('expected a summary view');
    }
    const { view } = summaryEntry;
    expect(view.datesValue).toBe(
      t.aiChat.booking.summary.datesValue.replace('{date}', formatBookingDate('2026-08-01', 'th')).replace('{nights}', '2')
    );
    expect(view.datesValue).toContain('พัก 2 คืน');
    expect(view.totalValue).toBe('฿1,000');
    expect(view.handoffHref).toBe(`/campgrounds/${CAMP.slug}?checkIn=2026-08-01&checkOut=2026-08-03&guests=2&from=chat`);
  });
});

describe('CAM-699 done_when — RED-FIRST: a typed multi-night range must price for the REAL span, not the old hardcoded 1', () => {
  it('[normal][regression] typed "สุดสัปดาห์นี้" -> nights pre-filled -> guests chip "2" -> summary shows "พัก 2 คืน" and the REAL 2-night total (was a hardcoded 1-night ฿500 total before CAM-699)', () => {
    const start = startBookingTurn([], CAMP, t, 'th');
    const dateStep = processBookingTurn(start.entries, start.booking!, { kind: 'text', text: 'สุดสัปดาห์นี้' }, 'สุดสัปดาห์นี้', t, 'th', TODAY);
    // Pre-filled — the flow goes STRAIGHT to `guests`, never asking `nights` again.
    expect(bookingEntries(dateStep.entries).at(-1)).toMatchObject({ step: 'guests' });
    expect(dateStep.booking?.state.slots).toEqual({ checkIn: '2026-07-25', checkOut: '2026-07-27', nights: 2 });

    const result = processBookingTurn(dateStep.entries, dateStep.booking!, { kind: 'chip', slots: { guests: 2 } }, '2 คน', t, 'th', TODAY);
    const summaryEntry = bookingEntries(result.entries).at(-1);
    expect(summaryEntry).toMatchObject({ step: 'summary' });
    if (!summaryEntry || !('view' in summaryEntry) || summaryEntry.view.kind !== 'summary') {
      throw new Error('expected a summary view');
    }
    const { view } = summaryEntry;
    expect(view.datesValue).toContain('พัก 2 คืน');
    expect(view.datesValue).not.toContain('พัก 1 คืน'); // the exact old hardcoded bug this story closes
    expect(view.totalValue).toBe('฿1,000'); // 500/night * 2 nights, PER_SITE — NOT the old hardcoded ฿500
  });
});

describe('CAM-699 done_when — typed "3" at the nights step works end to end', () => {
  it('[normal] date chip -> typed "3" -> guests chip "1" prices 3 nights', () => {
    const start = startBookingTurn([], CAMP, t, 'th');
    const dateStep = processBookingTurn(
      start.entries,
      start.booking!,
      { kind: 'chip', slots: { checkIn: '2026-08-01', checkOut: '2026-08-02' } },
      'echo',
      t,
      'th',
      TODAY
    );
    const nightsStep = processBookingTurn(dateStep.entries, dateStep.booking!, { kind: 'text', text: '3' }, '3', t, 'th', TODAY);
    expect(nightsStep.booking?.state.slots).toEqual({ checkIn: '2026-08-01', checkOut: '2026-08-04', nights: 3 });

    const result = processBookingTurn(nightsStep.entries, nightsStep.booking!, { kind: 'chip', slots: { guests: 1 } }, '1 คน', t, 'th', TODAY);
    const summaryEntry = bookingEntries(result.entries).at(-1) as (ChatEntry & { view: { kind: string } }) | undefined;
    expect(summaryEntry).toMatchObject({ step: 'summary' });
    if (!summaryEntry || summaryEntry.view.kind !== 'summary') throw new Error('expected a summary view');
    expect((summaryEntry.view as { totalValue: string }).totalValue).toBe('฿1,500'); // 500 * 3 nights
  });
});

describe('CAM-699 done_when — "0", "31", and garbage all re-ask through the existing miss machinery (2-strike escape intact)', () => {
  function atNightsStep(): { entries: ChatEntry[]; session: BookingSession } {
    const start = startBookingTurn([], CAMP, t, 'th');
    const dateStep = processBookingTurn(
      start.entries,
      start.booking!,
      { kind: 'chip', slots: { checkIn: '2026-08-01', checkOut: '2026-08-02' } },
      'echo',
      t,
      'th',
      TODAY
    );
    return { entries: dateStep.entries, session: dateStep.booking! };
  }

  it('[boundary] "0" re-asks `nights`, booking session stays alive (not a miss)', () => {
    const { entries, session } = atNightsStep();
    const result = processBookingTurn(entries, session, { kind: 'text', text: '0' }, '0', t, 'th', TODAY);
    expect(bookingEntries(result.entries).at(-1)).toMatchObject({ step: 'nights' });
    expect(result.booking).not.toBeNull();
    expect(result.booking?.state.consecutiveMisses).toBe(0);
  });

  it('[boundary] "31" re-asks `nights` with the real ceiling copy, booking session stays alive', () => {
    const { entries, session } = atNightsStep();
    const result = processBookingTurn(entries, session, { kind: 'text', text: '31' }, '31', t, 'th', TODAY);
    const newest = bookingEntries(result.entries).at(-1);
    expect(newest).toMatchObject({ step: 'nights' });
    if (newest && 'view' in newest && newest.view.kind === 'question') {
      expect(newest.view.questionText).toBe(t.aiChat.booking.nights.tooLong.replace('{max}', '30'));
    } else {
      throw new Error('expected a question view');
    }
    expect(result.booking?.state.consecutiveMisses).toBe(0);
  });

  it('[error/validation] garbage is a real miss; a SECOND consecutive garbage answer exits to the model (2-strike escape hatch intact)', () => {
    const { entries, session } = atNightsStep();
    const first = processBookingTurn(entries, session, { kind: 'text', text: 'จะกินอะไรดี' }, 'จะกินอะไรดี', t, 'th', TODAY);
    expect(first.booking).not.toBeNull();

    const second = processBookingTurn(first.entries, first.booking!, { kind: 'text', text: 'อากาศเป็นไงบ้าง' }, 'อากาศเป็นไงบ้าง', t, 'th', TODAY);
    expect(second.booking).toBeNull();
    expect(second.entries.at(-1)).toMatchObject({ role: 'assistant', kind: 'answer', text: t.aiChat.booking.handedToAssistant });
  });
});
