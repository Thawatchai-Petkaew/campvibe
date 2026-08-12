/**
 * cam-719-accept-ceiling.test.ts — CAM-719 (epic CAM-695,
 * in-chat-booking-completion): closes the typed-range MAX_BOOKING_NIGHTS
 * bypass in `acceptDateCandidate` (`components/ai-chat/booking-flow.ts`,
 * AC-4/BR-5/EC-4), the EC-5 1-night-range judgment call, and drives the
 * OWNER'S EXACT SENTENCE through the REAL flow end-to-end — `advanceBookingFlow`
 * (booking-flow.ts) into the REAL `buildSummaryView` (booking-view.ts,
 * unmocked) — proving the rendered summary text says "พัก 2 คืน" verbatim.
 *
 * Live dev-server verification note (self-verify): this worktree ships with
 * NO `.env` (no `DATABASE_URL`/`OPENROUTER_API_KEY` provisioned — every real
 * secret is intentionally excluded from an agent worktree, confirmed absent:
 * only `.env.example`/`.env.e2e.example` exist on disk), so a live
 * browser-driven pass against a real OpenRouter model call is not reachable
 * from here. This file is the strongest reachable substitute: it exercises
 * the REAL, UNMOCKED production functions end-to-end (raw Thai text in,
 * rendered Thai summary sentence out) — see test.md for the full record and
 * the explicit owner/dev-server-verify flag this leaves open.
 *
 * Coverage matrix:
 *   - normal: AC-1 end-to-end (owner sentence -> advance -> skips `nights`
 *     -> lands on `guests` directly) + the real rendered summary text
 *   - boundary: EC-4 exactly-30-nights range passes; EC-5 a 1-night range
 *     ("19-20") advances WITHOUT pre-filling `nights` (decision disclosed
 *     below)
 *   - error/validation: AC-4/BR-5 a >30-night typed range is REJECTED
 *     through the EXACT SAME shape (`reasonKey:'too_long', data:{max}`)
 *     `acceptNightsCandidate` already returns — no new rejection kind
 *
 * EC-5 decision (disclosed, per the ticket's own instruction): a 1-night
 * range ("19-20") is an explicit statement of intent, so pre-filling
 * `nights:1` is arguably MORE truthful. This story DEFAULTS to preserving
 * the pre-CAM-719 cam-699 pin instead (nights stays unset, `nights` step
 * still asks) — chosen because a 1-night SPAN is not itself distinguishable
 * evidence: a typed single date ("15 ส.ค.") and a date CHIP's own
 * `checkIn+1` placeholder produce the EXACT SAME 1-night span, so treating
 * "19-20" specially would require the accept function to special-case the
 * INPUT SHAPE (a range) rather than the OUTPUT (the span), which
 * `acceptDateCandidate` cannot see (by the time `accept` runs, a range and a
 * single date are indistinguishable `{checkIn,checkOut}` candidates — the
 * SAME reason CAM-699's own pin exists). Not superseded.
 */
import { describe, expect, it } from 'vitest';
import { getTranslations } from '@/locales/translations';
import {
  advanceBookingFlow,
  createInitialBookingFlowState,
  currentStep,
  type BookingParseContext,
} from '@/components/ai-chat/booking-flow';
import { MAX_BOOKING_NIGHTS } from '@/lib/validations/booking';
import { buildSummaryView, formatBookingDate, type BookingCampContext } from '@/components/ai-chat/booking-view';

const t = getTranslations('th');
// Bangkok Thursday 2026-08-13 — the REAL "today" this story's owner-sentence
// scenario was reported against (matches the pure-matrix fixture in
// cam-719-date-range.test.ts).
const TODAY = new Date('2026-08-13T10:00:00Z');

function ctx(overrides: Partial<BookingParseContext> = {}): BookingParseContext {
  return { today: TODAY, holidays: [], remaining: null, maxGuestsPerDay: null, checkIn: null, ...overrides };
}

const CAMP: BookingCampContext = {
  campId: 'cs-719',
  slug: 'phu-chi-fa-camp',
  name: 'ภูชี้ฟ้า',
  weekendAvailability: [],
  maxGuestsPerDay: 10,
  useSpotView: false,
  unitPrice: 500,
  priceUnit: 'PER_SITE',
  priceIsFree: false,
};

describe('AC-1 end-to-end — the owner\'s EXACT sentence, driven through the REAL advanceBookingFlow (no mocking of the logic under test)', () => {
  it('[normal] "ต้องการจอง 19-21 ที่จะถึง" typed at the `date` step advances DIRECTLY, pre-filling nights:2 (span > 1) — the `nights` step is skipped, never re-asked', () => {
    const outcome = advanceBookingFlow(createInitialBookingFlowState(), { kind: 'text', text: 'ต้องการจอง 19-21 ที่จะถึง' }, ctx());
    expect(outcome.kind).toBe('advance');
    if (outcome.kind !== 'advance') throw new Error('expected advance');
    expect(outcome.state.slots).toEqual({ checkIn: '2026-08-19', checkOut: '2026-08-21', nights: 2 });
    // AC-1's own "Then": ข้ามไปถามจำนวนคนทันที ไม่ถามจำนวนคืนซ้ำ — the DERIVED
    // current step lands on `guests` directly, `nights` is already satisfied.
    const next = currentStep(outcome.state.slots);
    expect(next.id).toBe('guests');
  });

  it('[normal] the REAL rendered summary (buildSummaryView, unmocked) says "พัก 2 คืน" verbatim once `guests` is answered too', () => {
    const dateOutcome = advanceBookingFlow(createInitialBookingFlowState(), { kind: 'text', text: 'ต้องการจอง 19-21 ที่จะถึง' }, ctx());
    expect(dateOutcome.kind).toBe('advance');
    if (dateOutcome.kind !== 'advance') throw new Error('expected advance');

    const guestsOutcome = advanceBookingFlow(
      dateOutcome.state,
      { kind: 'text', text: '2' },
      ctx({ checkIn: dateOutcome.state.slots.checkIn! })
    );
    expect(guestsOutcome.kind).toBe('advance');
    if (guestsOutcome.kind !== 'advance') throw new Error('expected advance');
    expect(currentStep(guestsOutcome.state.slots).id).toBe('summary');

    const view = buildSummaryView({ slots: guestsOutcome.state.slots, camp: CAMP, t, language: 'th', today: '2026-08-13' });
    const expectedDateLabel = formatBookingDate('2026-08-19', 'th');
    expect(view.datesValue).toBe(`${expectedDateLabel} พัก 2 คืน`);
    expect(view.datesValue).toContain('พัก 2 คืน');
  });
});

describe('AC-4/BR-5 — the typed-range MAX_BOOKING_NIGHTS bypass is closed (reuses the SAME rejection shape as the nights step)', () => {
  it('[error/validation] a >30-night typed range ("1 ต.ค. - 1 พ.ย.", 31 nights) is REJECTED through the exact `too_long` shape — never silently pre-filled above the ceiling', () => {
    expect(MAX_BOOKING_NIGHTS).toBe(30);
    const outcome = advanceBookingFlow(createInitialBookingFlowState(), { kind: 'text', text: '1 ต.ค. - 1 พ.ย.' }, ctx());
    expect(outcome).toEqual({
      kind: 'reprompt',
      state: { slots: {}, consecutiveMisses: 0 }, // rejected, NOT unparsed — no strike burned
      reason: 'rejected',
      reasonKey: 'too_long',
      data: { max: 30 },
    });
  });

  it('[boundary][EC-4] a range of EXACTLY 30 nights ("1 ต.ค. - 31 ต.ค.") is ACCEPTED — the ceiling is inclusive, matching the nights step\'s own bound', () => {
    const outcome = advanceBookingFlow(createInitialBookingFlowState(), { kind: 'text', text: '1 ต.ค. - 31 ต.ค.' }, ctx());
    expect(outcome.kind).toBe('advance');
    if (outcome.kind !== 'advance') throw new Error('expected advance');
    expect(outcome.state.slots).toEqual({ checkIn: '2026-10-01', checkOut: '2026-10-31', nights: 30 });
  });
});

describe('EC-5 — a 1-night typed range ("19-20") advances but does NOT pre-fill nights (decision disclosed above; preserves the cam-699 pin)', () => {
  it('[boundary] "19-20" sets checkIn/checkOut but leaves `nights` UNSET — the `nights` step still asks, same as any other 1-night resolution', () => {
    const outcome = advanceBookingFlow(createInitialBookingFlowState(), { kind: 'text', text: '19-20' }, ctx());
    expect(outcome.kind).toBe('advance');
    if (outcome.kind !== 'advance') throw new Error('expected advance');
    expect(outcome.state.slots).toEqual({ checkIn: '2026-08-19', checkOut: '2026-08-20' });
    expect(outcome.state.slots.nights).toBeUndefined();
    expect(currentStep(outcome.state.slots).id).toBe('nights');
  });
});
