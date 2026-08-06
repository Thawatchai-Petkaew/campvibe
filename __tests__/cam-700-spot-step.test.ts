/**
 * cam-700-spot-step.test.ts — CAM-700 (epic CAM-695, ADR-018 D7)
 * "A per-pitch camp gets an in-chat `spot` step"
 *
 * Pure-logic coverage for the `spot` step in `components/ai-chat/booking-flow.ts`:
 *   - the registry is now PER-CAMP (`resolveBookingSteps`) — a whole-camp flow
 *     never derives to `spot`, a per-pitch flow inserts it directly before
 *     `summary`
 *   - `parse` matches a typed pitch name by PREFIX against the live candidate
 *     list injected via `ctx.spotCandidates`
 *   - `accept` confines to `spotId`/`spotName`, and only accepts a candidate
 *     that is a REAL, currently-offered pitch (never trusts a well-formed-
 *     looking value alone) — occupancy is deliberately NOT checked here
 *     (async, one level up in `booking-turn.ts`)
 *
 * No React, no network — same discipline as cam-633/cam-699.
 */
import { describe, expect, it } from 'vitest';
import {
  advanceBookingFlow,
  currentStep,
  resolveBookingSteps,
  stepProgress,
  type BookingParseContext,
  type BookingSlots,
  type BookingSpotCandidate,
} from '@/components/ai-chat/booking-flow';

const TODAY = new Date('2026-07-22T10:00:00Z'); // same fixture as cam-633/cam-699

const CANDIDATES: BookingSpotCandidate[] = [
  { id: 'spot-a', name: 'ริมน้ำ A', pricePerNight: 500 },
  { id: 'spot-b', name: 'เนินสน B', pricePerNight: 700 },
];

function ctx(overrides: Partial<BookingParseContext> = {}): BookingParseContext {
  return {
    today: TODAY,
    holidays: [],
    remaining: null,
    maxGuestsPerDay: null,
    checkIn: null,
    spotCandidates: CANDIDATES,
    ...overrides,
  };
}

const GUESTS_FILLED: BookingSlots = { checkIn: '2026-08-01', checkOut: '2026-08-03', nights: 2, guests: 2 };

describe('resolveBookingSteps — per-camp registry (CAM-700)', () => {
  it('[normal] whole-camp (useSpotView:false) is the unchanged 4-step list, never carrying `spot`', () => {
    expect(resolveBookingSteps(false).map((s) => s.id)).toEqual(['date', 'nights', 'guests', 'summary']);
  });

  it('[normal] per-pitch (useSpotView:true) inserts `spot` directly before `summary`', () => {
    expect(resolveBookingSteps(true).map((s) => s.id)).toEqual(['date', 'nights', 'guests', 'spot', 'summary']);
  });
});

describe('currentStep / stepProgress — per-camp derivation', () => {
  it('[normal] a whole-camp flow with everything filled derives straight to `summary`, `spot` never appears', () => {
    expect(currentStep(GUESTS_FILLED, false).id).toBe('summary');
    expect(stepProgress(GUESTS_FILLED, false).map((s) => s.id)).not.toContain('spot');
  });

  it('[normal] a per-pitch flow with date/nights/guests filled (no spotId yet) derives to `spot`', () => {
    expect(currentStep(GUESTS_FILLED, true).id).toBe('spot');
  });

  it('[normal] a per-pitch flow with spotId also filled derives to `summary`', () => {
    const slots: BookingSlots = { ...GUESTS_FILLED, spotId: 'spot-a', spotName: 'ริมน้ำ A' };
    expect(currentStep(slots, true).id).toBe('summary');
  });

  it('[normal] stepProgress on a per-pitch flow at `spot` marks date/nights/guests done, spot active, summary todo', () => {
    expect(stepProgress(GUESTS_FILLED, true)).toEqual([
      { id: 'date', status: 'done' },
      { id: 'nights', status: 'done' },
      { id: 'guests', status: 'done' },
      { id: 'spot', status: 'active' },
      { id: 'summary', status: 'todo' },
    ]);
  });

  it('[boundary] currentStep with useSpotView defaulted (omitted) behaves exactly like `false` (back-compat)', () => {
    expect(currentStep(GUESTS_FILLED).id).toBe('summary');
  });
});

describe('spot step — parse (typed pitch name, prefix match, case-insensitive)', () => {
  it('[normal] an exact name match resolves to that candidate', () => {
    const outcome = advanceBookingFlow(
      { slots: GUESTS_FILLED, consecutiveMisses: 0 },
      { kind: 'text', text: 'ริมน้ำ A' },
      ctx(),
      true
    );
    expect(outcome).toEqual({
      kind: 'advance',
      state: { slots: { ...GUESTS_FILLED, spotId: 'spot-a', spotName: 'ริมน้ำ A' }, consecutiveMisses: 0 },
    });
  });

  it('[normal] a PREFIX of the name matches (design brief §4)', () => {
    const outcome = advanceBookingFlow(
      { slots: GUESTS_FILLED, consecutiveMisses: 0 },
      { kind: 'text', text: 'ริมน้ำ' },
      ctx(),
      true
    );
    expect(outcome.kind).toBe('advance');
    if (outcome.kind === 'advance') expect(outcome.state.slots.spotId).toBe('spot-a');
  });

  it('[normal] matching is case-insensitive (English pitch names)', () => {
    const englishCandidates: BookingSpotCandidate[] = [{ id: 'spot-c', name: 'Riverside C', pricePerNight: 400 }];
    const outcome = advanceBookingFlow(
      { slots: GUESTS_FILLED, consecutiveMisses: 0 },
      { kind: 'text', text: 'riverside' },
      ctx({ spotCandidates: englishCandidates }),
      true
    );
    expect(outcome.kind).toBe('advance');
    if (outcome.kind === 'advance') expect(outcome.state.slots.spotId).toBe('spot-c');
  });

  it('[error/validation] a typed name matching nothing is an unparsed miss', () => {
    const outcome = advanceBookingFlow(
      { slots: GUESTS_FILLED, consecutiveMisses: 0 },
      { kind: 'text', text: 'จุดที่ไม่มีอยู่จริง' },
      ctx(),
      true
    );
    expect(outcome).toEqual({
      kind: 'reprompt',
      state: { slots: GUESTS_FILLED, consecutiveMisses: 1 },
      reason: 'unparsed',
    });
  });

  it('[null/empty] no candidates injected at all (spotCandidates absent) never matches — always a miss', () => {
    const outcome = advanceBookingFlow(
      { slots: GUESTS_FILLED, consecutiveMisses: 0 },
      { kind: 'text', text: 'ริมน้ำ A' },
      ctx({ spotCandidates: null }),
      true
    );
    expect(outcome.kind).toBe('reprompt');
    if (outcome.kind === 'reprompt') expect(outcome.reason).toBe('unparsed');
  });

  it('[null/empty] blank typed text is a miss, never a false match', () => {
    const outcome = advanceBookingFlow(
      { slots: GUESTS_FILLED, consecutiveMisses: 0 },
      { kind: 'text', text: '   ' },
      ctx(),
      true
    );
    expect(outcome.kind).toBe('reprompt');
  });
});

describe('spot step — accept (POLICY: confine to spotId/spotName, must be a REAL offered candidate)', () => {
  it('[normal] a well-formed chip carrying a real candidate id+name advances', () => {
    const outcome = advanceBookingFlow(
      { slots: GUESTS_FILLED, consecutiveMisses: 0 },
      { kind: 'chip', slots: { spotId: 'spot-b', spotName: 'เนินสน B' } },
      ctx(),
      true
    );
    expect(outcome).toEqual({
      kind: 'advance',
      state: { slots: { ...GUESTS_FILLED, spotId: 'spot-b', spotName: 'เนินสน B' }, consecutiveMisses: 0 },
    });
  });

  it('[error/validation] a chip carrying an id NOT in the live candidate list is rejected (invalid_spot) — never trusts a well-formed-looking value alone', () => {
    const outcome = advanceBookingFlow(
      { slots: GUESTS_FILLED, consecutiveMisses: 0 },
      { kind: 'chip', slots: { spotId: 'spot-ghost', spotName: 'จุดผี' } },
      ctx(),
      true
    );
    expect(outcome).toEqual({
      kind: 'reprompt',
      state: { slots: GUESTS_FILLED, consecutiveMisses: 0 }, // rejected, not a miss
      reason: 'rejected',
      reasonKey: 'invalid_spot',
    });
  });

  it('[error/validation] a real id paired with the WRONG name is rejected — id and name must both match the same real row', () => {
    const outcome = advanceBookingFlow(
      { slots: GUESTS_FILLED, consecutiveMisses: 0 },
      { kind: 'chip', slots: { spotId: 'spot-a', spotName: 'เนินสน B' } },
      ctx(),
      true
    );
    expect(outcome.kind).toBe('reprompt');
    if (outcome.kind === 'reprompt') expect((outcome as { reasonKey?: string }).reasonKey).toBe('invalid_spot');
  });

  it('[error/validation] a chip at `spot` carrying a foreign key (e.g. guests) is rejected, never silently merged', () => {
    const outcome = advanceBookingFlow(
      { slots: GUESTS_FILLED, consecutiveMisses: 0 },
      { kind: 'chip', slots: { guests: 4 } },
      ctx(),
      true
    );
    expect(outcome).toEqual({
      kind: 'reprompt',
      state: { slots: GUESTS_FILLED, consecutiveMisses: 0 },
      reason: 'rejected',
      reasonKey: 'foreign_key',
      data: { keys: ['guests'] },
    });
  });

  it('[null/empty] an empty chip is rejected, never a silent no-op advance', () => {
    const outcome = advanceBookingFlow(
      { slots: GUESTS_FILLED, consecutiveMisses: 0 },
      { kind: 'chip', slots: {} },
      ctx(),
      true
    );
    expect(outcome.kind).toBe('reprompt');
    if (outcome.kind === 'reprompt') expect(outcome.reason).toBe('rejected');
  });

  it('[normal] cancel exits immediately from `spot`, no prefill', () => {
    const outcome = advanceBookingFlow({ slots: GUESTS_FILLED, consecutiveMisses: 0 }, { kind: 'cancel' }, ctx(), true);
    expect(outcome).toEqual({ kind: 'exit', reason: 'cancelled' });
  });
});

describe('the escape hatch still applies at `spot` (2-strike, unchanged mechanism)', () => {
  it('[error/validation] two consecutive unreadable pitch names hand off to the model, prefill excludes spotId', () => {
    const first = advanceBookingFlow(
      { slots: GUESTS_FILLED, consecutiveMisses: 0 },
      { kind: 'text', text: 'ไม่รู้จะเลือกจุดไหนดี' },
      ctx(),
      true
    );
    expect(first.kind).toBe('reprompt');
    if (first.kind !== 'reprompt') throw new Error('expected reprompt');

    const second = advanceBookingFlow(first.state, { kind: 'text', text: 'มีจุดวิวสวยไหม' }, ctx(), true);
    expect(second).toEqual({ kind: 'exit', reason: 'handoff', prefill: GUESTS_FILLED });
  });
});
