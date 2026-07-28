/**
 * CAM-633 — the in-chat booking flow's pure state machine
 * (`components/ai-chat/booking-flow.ts`, epic CAM-630).
 *
 * Nothing imports the module under test yet (wiring is CAM-639/640), so
 * every case here drives `advanceBookingFlow` directly with an injected
 * `today` (never the real clock) — the same discipline
 * `cam-462-resolve-dates.test.ts` / `cam-479-resolve-dates-weekday.test.ts`
 * already use for `resolveDatesCore`.
 *
 * KNOWN LIMITATION pinned deliberately below (not a bug in this module): the
 * CAM-633 ticket and the CAM-637 design brief both give "15 ส.ค." as a typed
 * date-step example, but `resolveDatesCore` (CAM-632, reused here AS-IS, not
 * extended by this story) has no rule for an absolute day+Thai-month phrase
 * — verified against the real function, not assumed. This module correctly
 * delegates and returns `unsupported` for it; a follow-up story would add
 * the absolute-date rule to `lib/ai/date-phrases.ts` if the product wants
 * it. Reported to the ticket owner rather than silently fixed here (out of
 * this story's file surface) or silently dropped from the test (would hide
 * a real spec/repo mismatch).
 *
 * G3 REVIEW FIXES covered below, TWO ROUNDS:
 *
 * Round 1 — a rejecting answer (over-capacity today; a future out-of-stock
 * `gear` step) is reported by the step's OWN `accept` return value
 * (`BookingStepParseResult`), never by a `step.id === 'guests'` special case
 * inside `advanceBookingFlow` — proven generically via `applyStepParseResult`
 * against a throwaway rejecting result, with no real step wired into the
 * registry. Also: `parseGuestCount`'s Arabic-digit match is anchored to a
 * plain unsigned integer so a negative/fractional number reprompts instead
 * of silently advancing with a value the camper never said.
 *
 * Round 2 — round 1's chip fix ("bypass `parse` entirely") was ITSELF unsafe:
 * it also bypassed the capacity check, the key-ownership check, and the
 * date sanity check, because `parse` had conflated "read text into a value"
 * with "decide whether the value is acceptable". The fix splits a step's job
 * into `parse` (TEXT ONLY, no policy) and `accept` (POLICY, shared by BOTH
 * the typed path — after `parse` succeeds — and the `chip` path, which skips
 * `parse` ONLY, never `accept`). The "chip input" describe block below
 * proves: an over-capacity chip is rejected exactly like its typed
 * equivalent, a chip carrying a foreign step's slot key is rejected, a chip
 * with a malformed/inverted/past date is rejected, an empty chip is rejected
 * (not a silent no-op advance), and — the coordinator's exact repro —
 * `{kind:'chip', slots:{guests:9999}}` against `remaining:3` now rejects
 * instead of silently advancing with `guests:9999`.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  BOOKING_STEPS,
  currentStep,
  stepProgress,
  createInitialBookingFlowState,
  advanceBookingFlow,
  applyStepParseResult,
  combineCapacityLimit,
  MAX_CONSECUTIVE_MISSES,
  type BookingFlowState,
  type BookingParseContext,
  type BookingSlots,
  type BookingStepParseResult,
} from '@/components/ai-chat/booking-flow';

const TODAY = new Date('2026-07-22T10:00:00Z'); // Bangkok Wednesday 2026-07-22 (same fixture as cam-479)

function ctx(overrides: Partial<BookingParseContext> = {}): BookingParseContext {
  return { today: TODAY, holidays: [], remaining: null, maxGuestsPerDay: null, ...overrides };
}

function stateWith(slots: BookingSlots, consecutiveMisses = 0): BookingFlowState {
  return { slots, consecutiveMisses };
}

describe('BOOKING_STEPS registry + derived current step', () => {
  it('[normal] the registry is date -> guests -> summary, in order', () => {
    expect(BOOKING_STEPS.map((s) => s.id)).toEqual(['date', 'guests', 'summary']);
  });

  it('[normal] empty slots derive to the FIRST step (date)', () => {
    expect(currentStep({}).id).toBe('date');
  });

  it('[normal] only `guests` filled still derives to `date` (registry order wins, not "most fields filled")', () => {
    expect(currentStep({ guests: 2 }).id).toBe('date');
  });

  it('[normal] date filled, guests empty derives to `guests`', () => {
    expect(currentStep({ checkIn: '2026-08-01', checkOut: '2026-08-02' }).id).toBe('guests');
  });

  it('[normal] date + guests both filled derives to `summary` (terminal, never satisfied)', () => {
    expect(currentStep({ checkIn: '2026-08-01', checkOut: '2026-08-02', guests: 2 }).id).toBe('summary');
  });

  it('[boundary] `summary` stays current no matter how many times it is re-derived (terminal step returns false forever)', () => {
    const slots: BookingSlots = { checkIn: '2026-08-01', checkOut: '2026-08-02', guests: 2 };
    expect(currentStep(slots).id).toBe('summary');
    expect(currentStep(slots).id).toBe('summary');
    expect(currentStep(currentStep(slots).isSatisfied(slots) ? slots : slots).id).toBe('summary');
  });

  it('[normal] stepProgress marks earlier steps done, the derived step active, later steps todo', () => {
    const slots: BookingSlots = { checkIn: '2026-08-01', checkOut: '2026-08-02' }; // date done, guests active, summary todo
    expect(stepProgress(slots)).toEqual([
      { id: 'date', status: 'done' },
      { id: 'guests', status: 'active' },
      { id: 'summary', status: 'todo' },
    ]);
  });

  it('[boundary] stepProgress on empty slots has `date` active and nothing done yet', () => {
    expect(stepProgress({})).toEqual([
      { id: 'date', status: 'active' },
      { id: 'guests', status: 'todo' },
      { id: 'summary', status: 'todo' },
    ]);
  });
});

describe('combineCapacityLimit — the capacity trap (BR-3: null is unbounded, never falsy-collapsed)', () => {
  it('[normal] both set -> the tighter (min) of the two', () => {
    expect(combineCapacityLimit(5, 3)).toBe(3);
    expect(combineCapacityLimit(3, 5)).toBe(3);
  });

  it('[boundary] `remaining` null, `maxGuestsPerDay` set -> defers entirely to maxGuestsPerDay', () => {
    expect(combineCapacityLimit(null, 4)).toBe(4);
  });

  it('[boundary] `maxGuestsPerDay` null, `remaining` set -> defers entirely to remaining', () => {
    expect(combineCapacityLimit(7, null)).toBe(7);
  });

  it('[null/empty] both null -> no ceiling at all (never fabricate one)', () => {
    expect(combineCapacityLimit(null, null)).toBeNull();
  });

  it('[boundary] remaining=0 is a REAL zero ceiling, not treated as "unbounded"', () => {
    expect(combineCapacityLimit(0, null)).toBe(0);
  });
});

describe('date step — parse (typed input) via resolveDatesCore, unchanged, no absolute-date extension', () => {
  it('[normal] "เสาร์หน้า" advances with the real resolved Saturday (same date a chip for that Saturday would carry)', () => {
    const outcome = advanceBookingFlow(stateWith({}), { kind: 'text', text: 'เสาร์หน้า' }, ctx());
    expect(outcome).toEqual({
      kind: 'advance',
      state: { slots: { checkIn: '2026-08-01', checkOut: '2026-08-02' }, consecutiveMisses: 0 },
    });
  });

  it('[normal] "พรุ่งนี้" advances with tomorrow\'s date, a DIFFERENT real resolved day', () => {
    const outcome = advanceBookingFlow(stateWith({}), { kind: 'text', text: 'พรุ่งนี้' }, ctx());
    expect(outcome).toEqual({
      kind: 'advance',
      state: { slots: { checkIn: '2026-07-23', checkOut: '2026-07-24' }, consecutiveMisses: 0 },
    });
  });

  it('[documented-limitation] "15 ส.ค." does NOT resolve today — resolveDatesCore has no absolute day+Thai-month rule (verified against the real function; flagged to the ticket owner, not silently added here)', () => {
    const outcome = advanceBookingFlow(stateWith({}), { kind: 'text', text: '15 ส.ค.' }, ctx());
    expect(outcome).toEqual({
      kind: 'reprompt',
      state: { slots: {}, consecutiveMisses: 1 },
      reason: 'unparsed',
    });
  });

  it('[error/validation] unparseable text reprompts once, keeping the slots untouched', () => {
    const outcome = advanceBookingFlow(stateWith({}), { kind: 'text', text: 'อยากกินไก่ทอด' }, ctx());
    expect(outcome).toEqual({
      kind: 'reprompt',
      state: { slots: {}, consecutiveMisses: 1 },
      reason: 'unparsed',
    });
  });

  it('[normal] cancel exits immediately from the date step, no prefill', () => {
    const outcome = advanceBookingFlow(stateWith({}), { kind: 'cancel' }, ctx());
    expect(outcome).toEqual({ kind: 'exit', reason: 'cancelled' });
  });

  it('[edge] a multi-date "date SET" phrase (e.g. every Saturday this month) collapses to its FIRST candidate only (documented round-1 scope, not a picker)', () => {
    const now = new Date('2026-07-01T10:00:00Z'); // Wednesday, several Saturdays remain this month
    const outcome = advanceBookingFlow(stateWith({}), { kind: 'text', text: 'ทุกวันเสาร์เดือนนี้' }, ctx({ today: now }));
    expect(outcome.kind).toBe('advance');
    if (outcome.kind === 'advance') {
      // resolveDatesCore returns 4 weekend ranges for July 2026; only the
      // FIRST (the Sat 2026-07-04 -> Mon 2026-07-06 weekend) is kept.
      expect(outcome.state.slots).toEqual({ checkIn: '2026-07-04', checkOut: '2026-07-06' });
    }
  });
});

describe('guests step — parse (typed input equals chip input: "8 คน" / "แปดคน" / "8")', () => {
  const dateFilled: BookingSlots = { checkIn: '2026-08-01', checkOut: '2026-08-02' };

  it('[normal] "8 คน" (Arabic digit + classifier) advances with guests:8', () => {
    const outcome = advanceBookingFlow(stateWith(dateFilled), { kind: 'text', text: '8 คน' }, ctx());
    expect(outcome).toEqual({
      kind: 'advance',
      state: { slots: { ...dateFilled, guests: 8 }, consecutiveMisses: 0 },
    });
  });

  it('[normal] "แปดคน" (Thai number word + classifier) advances with the IDENTICAL guests:8', () => {
    const outcome = advanceBookingFlow(stateWith(dateFilled), { kind: 'text', text: 'แปดคน' }, ctx());
    expect(outcome).toEqual({
      kind: 'advance',
      state: { slots: { ...dateFilled, guests: 8 }, consecutiveMisses: 0 },
    });
  });

  it('[normal] a bare "8" (no classifier) advances with the IDENTICAL guests:8', () => {
    const outcome = advanceBookingFlow(stateWith(dateFilled), { kind: 'text', text: '8' }, ctx());
    expect(outcome).toEqual({
      kind: 'advance',
      state: { slots: { ...dateFilled, guests: 8 }, consecutiveMisses: 0 },
    });
  });

  it('[boundary] a two-digit Thai compound word ("สิบห้าคน" = 15) resolves correctly, proving the table is not just single digits', () => {
    const outcome = advanceBookingFlow(stateWith(dateFilled), { kind: 'text', text: 'สิบห้าคน' }, ctx());
    expect(outcome).toEqual({
      kind: 'advance',
      state: { slots: { ...dateFilled, guests: 15 }, consecutiveMisses: 0 },
    });
  });

  it('[null/empty] "0 คน" is understood as the number zero by `parse`, then REJECTED (not a miss) by `accept` — a party of 0 is not a booking', () => {
    const outcome = advanceBookingFlow(stateWith(dateFilled), { kind: 'text', text: '0 คน' }, ctx());
    expect(outcome).toEqual({
      kind: 'reprompt',
      state: { slots: dateFilled, consecutiveMisses: 0 }, // rejected, not unparsed — does not burn a strike
      reason: 'rejected',
      reasonKey: 'invalid_guests',
    });
  });

  it('[error/validation][nit-fix] "-5 คน" reprompts rather than silently dropping the sign and advancing with guests:5', () => {
    const outcome = advanceBookingFlow(stateWith(dateFilled), { kind: 'text', text: '-5 คน' }, ctx());
    expect(outcome).toEqual({
      kind: 'reprompt',
      state: { slots: dateFilled, consecutiveMisses: 1 },
      reason: 'unparsed',
    });
  });

  it('[error/validation][nit-fix] "3.5 คน" reprompts rather than silently truncating to guests:3', () => {
    const outcome = advanceBookingFlow(stateWith(dateFilled), { kind: 'text', text: '3.5 คน' }, ctx());
    expect(outcome).toEqual({
      kind: 'reprompt',
      state: { slots: dateFilled, consecutiveMisses: 1 },
      reason: 'unparsed',
    });
  });

  it('[error/validation] unparseable text reprompts once', () => {
    const outcome = advanceBookingFlow(stateWith(dateFilled), { kind: 'text', text: 'ไม่รู้สิ' }, ctx());
    expect(outcome).toEqual({
      kind: 'reprompt',
      state: { slots: dateFilled, consecutiveMisses: 1 },
      reason: 'unparsed',
    });
  });

  it('[normal] cancel exits immediately from the guests step, no prefill', () => {
    const outcome = advanceBookingFlow(stateWith(dateFilled), { kind: 'cancel' }, ctx());
    expect(outcome).toEqual({ kind: 'exit', reason: 'cancelled' });
  });

  describe('the capacity trap (BR-3) — remaining/maxGuestsPerDay null vs a real number', () => {
    it('[normal] remaining:null, maxGuestsPerDay:null accepts a LARGE party (never fabricate a ceiling)', () => {
      const outcome = advanceBookingFlow(
        stateWith(dateFilled),
        { kind: 'text', text: '50' },
        ctx({ remaining: null, maxGuestsPerDay: null })
      );
      expect(outcome).toEqual({
        kind: 'advance',
        state: { slots: { ...dateFilled, guests: 50 }, consecutiveMisses: 0 },
      });
    });

    it('[error/validation] remaining:3 rejects a party of 5, reporting the REAL number available (data.limit:3), not silently truncating', () => {
      const outcome = advanceBookingFlow(
        stateWith(dateFilled),
        { kind: 'text', text: '5' },
        ctx({ remaining: 3, maxGuestsPerDay: null })
      );
      expect(outcome).toEqual({
        kind: 'reprompt',
        state: { slots: dateFilled, consecutiveMisses: 0 }, // NOT incremented — a valid, understood answer
        reason: 'rejected',
        reasonKey: 'over_capacity',
        data: { limit: 3 },
      });
    });

    it('[boundary] a party exactly AT the limit is accepted (not rejected)', () => {
      const outcome = advanceBookingFlow(
        stateWith(dateFilled),
        { kind: 'text', text: '3' },
        ctx({ remaining: 3, maxGuestsPerDay: null })
      );
      expect(outcome.kind).toBe('advance');
    });

    it('[error/validation] maxGuestsPerDay:4 alone (remaining unbounded) rejects a party of 5 with data.limit:4', () => {
      const outcome = advanceBookingFlow(
        stateWith(dateFilled),
        { kind: 'text', text: '5' },
        ctx({ remaining: null, maxGuestsPerDay: 4 })
      );
      expect(outcome).toEqual({
        kind: 'reprompt',
        state: { slots: dateFilled, consecutiveMisses: 0 },
        reason: 'rejected',
        reasonKey: 'over_capacity',
        data: { limit: 4 },
      });
    });

    it('[error/validation] both set -> the TIGHTER cap wins (remaining:5, maxGuestsPerDay:3 rejects a party of 4 with data.limit:3)', () => {
      const outcome = advanceBookingFlow(
        stateWith(dateFilled),
        { kind: 'text', text: '4' },
        ctx({ remaining: 5, maxGuestsPerDay: 3 })
      );
      expect(outcome).toEqual({
        kind: 'reprompt',
        state: { slots: dateFilled, consecutiveMisses: 0 },
        reason: 'rejected',
        reasonKey: 'over_capacity',
        data: { limit: 3 },
      });
    });

    it('[error/validation] an over-capacity reply does NOT count as a "miss" (resets consecutiveMisses to 0, never trips the escape hatch)', () => {
      const misdirected = stateWith(dateFilled, 1); // one prior unrelated unparsed miss
      const outcome = advanceBookingFlow(
        misdirected,
        { kind: 'text', text: '9' },
        ctx({ remaining: 3, maxGuestsPerDay: null })
      );
      expect(outcome.kind).toBe('reprompt');
      if (outcome.kind === 'reprompt') {
        expect(outcome.state.consecutiveMisses).toBe(0);
      }
    });
  });
});

describe('summary step — terminal, nothing left to parse', () => {
  const filled: BookingSlots = { checkIn: '2026-08-01', checkOut: '2026-08-02', guests: 2 };

  it('[normal] any typed text at summary reprompts once (unparsed) — nothing to fill, generic escape-hatch path applies', () => {
    const outcome = advanceBookingFlow(stateWith(filled), { kind: 'text', text: 'แล้วมีเปลให้เช่าไหม' }, ctx());
    expect(outcome).toEqual({
      kind: 'reprompt',
      state: { slots: filled, consecutiveMisses: 1 },
      reason: 'unparsed',
    });
  });

  it('[normal] cancel exits immediately from summary too, no prefill', () => {
    const outcome = advanceBookingFlow(stateWith(filled), { kind: 'cancel' }, ctx());
    expect(outcome).toEqual({ kind: 'exit', reason: 'cancelled' });
  });
});

describe('chip input skips `parse` ONLY — it still goes through `accept`, the SAME policy gate typed input uses (G3 review, round 2)', () => {
  const dateFilled: BookingSlots = { checkIn: '2026-08-01', checkOut: '2026-08-02' };

  it('[normal] a well-formed date chip advances directly, with NO round-trip through resolveDatesCore', () => {
    const outcome = advanceBookingFlow(
      stateWith({}),
      { kind: 'chip', slots: { checkIn: '2026-08-01', checkOut: '2026-08-02' } },
      ctx()
    );
    expect(outcome).toEqual({
      kind: 'advance',
      state: { slots: { checkIn: '2026-08-01', checkOut: '2026-08-02' }, consecutiveMisses: 0 },
    });
  });

  it('[normal] a well-formed guests chip advances directly', () => {
    const outcome = advanceBookingFlow(stateWith(dateFilled), { kind: 'chip', slots: { guests: 4 } }, ctx());
    expect(outcome).toEqual({
      kind: 'advance',
      state: { slots: { ...dateFilled, guests: 4 }, consecutiveMisses: 0 },
    });
  });

  it('[regression] a bare ISO date submitted as TEXT (not a chip) does NOT parse — a chip must use the `chip` input kind, never masquerade as typed text', () => {
    const outcome = advanceBookingFlow(stateWith({}), { kind: 'text', text: '2026-08-01' }, ctx());
    expect(outcome.kind).toBe('reprompt');
  });

  it('[normal] a chip resets the miss streak like any other understood answer', () => {
    const missed = advanceBookingFlow(stateWith({}), { kind: 'text', text: 'ไม่รู้สิ' }, ctx());
    expect(missed.kind).toBe('reprompt');
    if (missed.kind !== 'reprompt') throw new Error('expected reprompt');

    const outcome = advanceBookingFlow(
      missed.state,
      { kind: 'chip', slots: { checkIn: '2026-08-01', checkOut: '2026-08-02' } },
      ctx()
    );
    expect(outcome.kind).toBe('advance');
    if (outcome.kind === 'advance') expect(outcome.state.consecutiveMisses).toBe(0);
  });

  it('[normal] cancel still wins over a chip if both were somehow requested in sequence (chip does not disable cancel)', () => {
    const outcome = advanceBookingFlow(stateWith({}), { kind: 'cancel' }, ctx());
    expect(outcome).toEqual({ kind: 'exit', reason: 'cancelled' });
  });

  describe('THE G3 REPRO — the capacity trap must not be bypassable through a chip', () => {
    it('[error/validation] the coordinator\'s EXACT repro: a chip carrying guests:9999 against remaining:3 is REJECTED, not silently advanced', () => {
      const outcome = advanceBookingFlow(
        stateWith(dateFilled),
        { kind: 'chip', slots: { guests: 9999 } },
        ctx({ remaining: 3, maxGuestsPerDay: null })
      );
      expect(outcome).toEqual({
        kind: 'reprompt',
        state: { slots: dateFilled, consecutiveMisses: 0 },
        reason: 'rejected',
        reasonKey: 'over_capacity',
        data: { limit: 3 },
      });
    });

    it('[error/validation] an over-capacity GUESTS CHIP is rejected exactly as the typed equivalent is (identical outcome, same reasonKey/data)', () => {
      const chipOutcome = advanceBookingFlow(
        stateWith(dateFilled),
        { kind: 'chip', slots: { guests: 9999 } },
        ctx({ remaining: 3, maxGuestsPerDay: null })
      );
      const typedOutcome = advanceBookingFlow(
        stateWith(dateFilled),
        { kind: 'text', text: '9999' },
        ctx({ remaining: 3, maxGuestsPerDay: null })
      );
      expect(chipOutcome).toEqual(typedOutcome);
    });
  });

  describe('a chip carrying a foreign slot key is rejected, never silently merged (would otherwise clobber an already-confirmed value)', () => {
    it('[error/validation] a chip at the GUESTS step carrying `checkIn` is rejected — it must not silently clobber the already-confirmed date', () => {
      const outcome = advanceBookingFlow(
        stateWith(dateFilled),
        { kind: 'chip', slots: { checkIn: '2099-01-01' } },
        ctx()
      );
      expect(outcome).toEqual({
        kind: 'reprompt',
        state: { slots: dateFilled, consecutiveMisses: 0 },
        reason: 'rejected',
        reasonKey: 'foreign_key',
        data: { keys: ['checkIn'] },
      });
    });

    it('[error/validation] a chip at the GUESTS step carrying BOTH a foreign `checkIn` and a valid `guests` is still wholly rejected — never a partial merge', () => {
      const outcome = advanceBookingFlow(
        stateWith(dateFilled),
        { kind: 'chip', slots: { checkIn: '2099-01-01', guests: 3 } },
        ctx()
      );
      expect(outcome.kind).toBe('reprompt');
      if (outcome.kind === 'reprompt') {
        expect(outcome.reason).toBe('rejected');
        expect(dateFilled.checkIn).toBe('2026-08-01'); // untouched — no partial clobber
      }
    });

    it('[error/validation] a chip at the DATE step carrying `guests` (foreign to `date`) is rejected', () => {
      const outcome = advanceBookingFlow(stateWith({}), { kind: 'chip', slots: { guests: 2 } }, ctx());
      expect(outcome).toEqual({
        kind: 'reprompt',
        state: { slots: {}, consecutiveMisses: 0 },
        reason: 'rejected',
        reasonKey: 'foreign_key',
        data: { keys: ['guests'] },
      });
    });
  });

  describe('a chip with a malformed, inverted, or past date is rejected — never merged unchecked', () => {
    it('[error/validation] a non-ISO/garbage date chip is rejected', () => {
      const outcome = advanceBookingFlow(
        stateWith({}),
        { kind: 'chip', slots: { checkIn: 'not-a-date', checkOut: 'also-not' } },
        ctx()
      );
      expect(outcome.kind).toBe('reprompt');
      if (outcome.kind === 'reprompt') {
        expect(outcome.reason).toBe('rejected');
        expect((outcome as { reasonKey?: string }).reasonKey).toBe('invalid_date');
      }
    });

    it('[error/validation] a calendar-invalid date ("2026-02-31") is rejected (round-trip check, not just a regex shape match)', () => {
      const outcome = advanceBookingFlow(
        stateWith({}),
        { kind: 'chip', slots: { checkIn: '2026-02-31', checkOut: '2026-03-02' } },
        ctx()
      );
      expect(outcome.kind).toBe('reprompt');
      if (outcome.kind === 'reprompt') expect((outcome as { reasonKey?: string }).reasonKey).toBe('invalid_date');
    });

    it('[error/validation] an INVERTED range (checkOut before checkIn) is rejected', () => {
      const outcome = advanceBookingFlow(
        stateWith({}),
        { kind: 'chip', slots: { checkIn: '2026-08-05', checkOut: '2026-08-01' } },
        ctx()
      );
      expect(outcome).toEqual({
        kind: 'reprompt',
        state: { slots: {}, consecutiveMisses: 0 },
        reason: 'rejected',
        reasonKey: 'invalid_range',
      });
    });

    it('[error/validation] a date chip already in the past is rejected', () => {
      const outcome = advanceBookingFlow(
        stateWith({}),
        { kind: 'chip', slots: { checkIn: '2020-01-01', checkOut: '2020-01-02' } },
        ctx() // TODAY = 2026-07-22
      );
      expect(outcome).toEqual({
        kind: 'reprompt',
        state: { slots: {}, consecutiveMisses: 0 },
        reason: 'rejected',
        reasonKey: 'in_the_past',
      });
    });
  });

  describe('an empty chip is rejected — never a silent no-op advance', () => {
    it('[null/empty] `{kind:"chip", slots:{}}` at the date step is rejected, not silently advanced', () => {
      const outcome = advanceBookingFlow(stateWith({}), { kind: 'chip', slots: {} }, ctx());
      expect(outcome.kind).toBe('reprompt');
      if (outcome.kind === 'reprompt') expect(outcome.reason).toBe('rejected');
    });

    it('[null/empty] `{kind:"chip", slots:{}}` at the guests step is rejected, not silently advanced', () => {
      const outcome = advanceBookingFlow(stateWith(dateFilled), { kind: 'chip', slots: {} }, ctx());
      expect(outcome.kind).toBe('reprompt');
      if (outcome.kind === 'reprompt') expect(outcome.reason).toBe('rejected');
    });
  });

  describe('the invariant: chip and typed produce IDENTICAL outcomes for the SAME underlying value (the guarantee that keeps this hole closed)', () => {
    it('[normal] guests: chip{guests:8} and text "8 คน" produce byte-identical outcomes', () => {
      const chipOutcome = advanceBookingFlow(stateWith(dateFilled), { kind: 'chip', slots: { guests: 8 } }, ctx());
      const typedOutcome = advanceBookingFlow(stateWith(dateFilled), { kind: 'text', text: '8 คน' }, ctx());
      expect(chipOutcome).toEqual(typedOutcome);
      expect(chipOutcome).toEqual({
        kind: 'advance',
        state: { slots: { ...dateFilled, guests: 8 }, consecutiveMisses: 0 },
      });
    });

    it('[normal] date: chip carrying the exact date resolveDatesCore resolves "เสาร์หน้า" to produces the SAME outcome as the typed phrase', () => {
      const typedOutcome = advanceBookingFlow(stateWith({}), { kind: 'text', text: 'เสาร์หน้า' }, ctx());
      const chipOutcome = advanceBookingFlow(
        stateWith({}),
        { kind: 'chip', slots: { checkIn: '2026-08-01', checkOut: '2026-08-02' } },
        ctx()
      );
      expect(chipOutcome).toEqual(typedOutcome);
    });
  });
});

describe('the rejection channel is step-agnostic — no step.id branching anywhere in advanceBookingFlow (G3 review fix — BR-1)', () => {
  it('[normal] applyStepParseResult treats a THROWAWAY rejecting result (simulating a future out-of-stock `gear` step) exactly like the guests over-capacity case: reprompt, never a miss', () => {
    const throwawayRejected: BookingStepParseResult = {
      ok: false,
      kind: 'rejected',
      reasonKey: 'out_of_stock',
      data: { sku: 'TENT-4P' },
    };
    const outcome = applyStepParseResult(stateWith({}), throwawayRejected);
    expect(outcome).toEqual({
      kind: 'reprompt',
      state: { slots: {}, consecutiveMisses: 0 },
      reason: 'rejected',
      reasonKey: 'out_of_stock',
      data: { sku: 'TENT-4P' },
    });
  });

  it('[error/validation] the G3 repro: TWO CONSECUTIVE valid-but-rejected answers reprompt BOTH times — never eject the camper mid-flow for answering correctly twice', () => {
    const throwawayRejected: BookingStepParseResult = { ok: false, kind: 'rejected', reasonKey: 'out_of_stock' };

    const first = applyStepParseResult(stateWith({}), throwawayRejected);
    expect(first.kind).toBe('reprompt'); // NOT 'exit' — this is the exact bug the reviewer's gearStep reproduced
    if (first.kind !== 'reprompt') throw new Error('expected reprompt');
    expect(first.state.consecutiveMisses).toBe(0);

    const second = applyStepParseResult(first.state, throwawayRejected);
    expect(second.kind).toBe('reprompt'); // still reprompt, not exit — two rejections is not two misses
    if (second.kind !== 'reprompt') throw new Error('expected reprompt again, not an exit');
    expect(second.state.consecutiveMisses).toBe(0);
  });

  it('[static] advanceBookingFlow itself never reads step.id (or any step-id literal) anywhere in its own body', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../components/ai-chat/booking-flow.ts'), 'utf-8');
    const fnMatch = source.match(/export function advanceBookingFlow\([\s\S]*?\n\}\n/);
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch![0];
    expect(fnBody).not.toMatch(/step\.id/);
    expect(fnBody).not.toMatch(/['"](date|guests|summary)['"]/);
  });
});

describe('the escape hatch — a SECOND consecutive unparsed input exits to the model (never a third try)', () => {
  it(`[boundary] MAX_CONSECUTIVE_MISSES is ${MAX_CONSECUTIVE_MISSES} (two strikes)`, () => {
    expect(MAX_CONSECUTIVE_MISSES).toBe(2);
  });

  it('[error/validation] first miss reprompts, second consecutive miss exits with a handoff prefill of whatever was collected', () => {
    const first = advanceBookingFlow(stateWith({}), { kind: 'text', text: 'จะกินอะไรดี' }, ctx());
    expect(first.kind).toBe('reprompt');
    if (first.kind !== 'reprompt') throw new Error('expected reprompt');

    const second = advanceBookingFlow(first.state, { kind: 'text', text: 'อากาศเป็นไงบ้าง' }, ctx());
    expect(second).toEqual({ kind: 'exit', reason: 'handoff', prefill: {} });
  });

  it('[error/validation] the handoff prefill carries whatever partial slots were already collected (e.g. a date already picked, still mid-guests-step)', () => {
    const dateFilled: BookingSlots = { checkIn: '2026-08-01', checkOut: '2026-08-02' };
    const first = advanceBookingFlow(stateWith(dateFilled), { kind: 'text', text: 'วันนี้อากาศดีนะ' }, ctx());
    expect(first.kind).toBe('reprompt');
    if (first.kind !== 'reprompt') throw new Error('expected reprompt');

    const second = advanceBookingFlow(first.state, { kind: 'text', text: 'มีเพลงแนะนำไหม' }, ctx());
    expect(second).toEqual({ kind: 'exit', reason: 'handoff', prefill: dateFilled });
  });

  it('[normal] a successful parse BETWEEN two unparsed turns resets the streak (no accumulation across an answered turn)', () => {
    const first = advanceBookingFlow(stateWith({}), { kind: 'text', text: 'จะกินอะไรดี' }, ctx());
    expect(first.kind).toBe('reprompt');
    if (first.kind !== 'reprompt') throw new Error('expected reprompt');

    const answered = advanceBookingFlow(first.state, { kind: 'text', text: 'พรุ่งนี้' }, ctx());
    expect(answered.kind).toBe('advance');
    if (answered.kind !== 'advance') throw new Error('expected advance');
    expect(answered.state.consecutiveMisses).toBe(0);

    // A single further unparsed turn now reprompts (1st again), it does not exit.
    const third = advanceBookingFlow(answered.state, { kind: 'text', text: 'จะกินอะไรดี' }, ctx());
    expect(third.kind).toBe('reprompt');
  });
});

describe('advanceBookingFlow never mutates its input (state/ctx are read-only from its perspective)', () => {
  it('[normal] the `state` object passed in is deep-equal before and after an `advance` call', () => {
    const original = stateWith({});
    const clone = structuredClone(original);
    advanceBookingFlow(original, { kind: 'text', text: 'เสาร์หน้า' }, ctx());
    expect(original).toEqual(clone);
  });

  it('[normal] the `state` object passed in is deep-equal before and after a `reprompt` call', () => {
    const original = stateWith({ checkIn: '2026-08-01', checkOut: '2026-08-02' });
    const clone = structuredClone(original);
    advanceBookingFlow(original, { kind: 'text', text: 'ไม่รู้สิ' }, ctx());
    expect(original).toEqual(clone);
  });

  it('[normal] the `state` object passed in is deep-equal before and after an `exit` (cancel) call', () => {
    const original = stateWith({ checkIn: '2026-08-01', checkOut: '2026-08-02', guests: 2 });
    const clone = structuredClone(original);
    advanceBookingFlow(original, { kind: 'cancel' }, ctx());
    expect(original).toEqual(clone);
  });

  it('[normal] the `ctx` object passed in is deep-equal before and after a call (holidays array untouched)', () => {
    const originalCtx = ctx({ holidays: [{ date: '2026-08-08', nameTh: 'วันแม่', isLongWeekend: true }] });
    const cloneCtx = structuredClone(originalCtx);
    advanceBookingFlow(stateWith({}), { kind: 'text', text: 'เสาร์หน้า' }, originalCtx);
    expect(originalCtx).toEqual(cloneCtx);
  });
});

describe('static guards (source-inspection, mirrors what a CI grep would run)', () => {
  const SOURCE = fs.readFileSync(
    path.resolve(__dirname, '../components/ai-chat/booking-flow.ts'),
    'utf-8'
  );

  it('[normal] imports zero server/browser-hostile dependencies (react, prisma, fetch, the real clock)', () => {
    expect(SOURCE).not.toMatch(/from ['"]react/);
    expect(SOURCE).not.toMatch(/@\/lib\/prisma/);
    expect(SOURCE).not.toMatch(/fetch\(/);
    expect(SOURCE).not.toMatch(/new Date\(\)/);
    expect(SOURCE).not.toMatch(/Date\.now\(/);
  });

  it('[normal] no second literal step-id list exists anywhere else in components/ai-chat/ (the registry is the ONLY place step ids are enumerated together)', () => {
    const dir = path.resolve(__dirname, '../components/ai-chat');
    const files = fs.readdirSync(dir).filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && f !== 'booking-flow.ts');
    const stepIdCoOccurrence = /['"]date['"]\s*,\s*['"]guests['"]\s*,\s*['"]summary['"]/;
    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      expect(content, `${file} must not hand-copy the booking step-id list`).not.toMatch(stepIdCoOccurrence);
    }
  });
});

describe('createInitialBookingFlowState', () => {
  it('[normal] starts with empty slots and zero misses', () => {
    expect(createInitialBookingFlowState()).toEqual({ slots: {}, consecutiveMisses: 0 });
  });
});
