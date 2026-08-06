/**
 * cam-700-spot-view.test.ts — CAM-700 (epic CAM-695, ADR-018 D7)
 *
 * Pure-logic coverage for the `spot` step's view-building helpers in
 * `components/ai-chat/booking-view.ts`: `buildSpotChipSpecs`,
 * `formatSpotEcho`, `buildSpotQuestionView`, and `buildSummaryView`'s new
 * `spotValue`/`editSpot` behaviour. No React, no network.
 */
import { describe, expect, it } from 'vitest';
import { getTranslations } from '@/locales/translations';
import {
  MAX_BOOKING_SPOT_CHIPS,
  addDaysToIso,
  buildSpotChipSpecs,
  buildSpotQuestionView,
  buildSummaryView,
  formatSpotEcho,
  type BookingCampContext,
} from '@/components/ai-chat/booking-view';
import type { BookingSpotCandidate } from '@/components/ai-chat/booking-flow';

const t = getTranslations('th');

const CANDIDATES: BookingSpotCandidate[] = [
  { id: 'spot-b', name: 'เนินสน B', pricePerNight: 700 },
  { id: 'spot-a', name: 'ริมน้ำ A', pricePerNight: 500 },
  { id: 'spot-c', name: 'จุดกลางแจ้ง C', pricePerNight: 900 },
];

const CAMP: BookingCampContext = {
  campId: 'cs-700',
  slug: 'phu-chi-fa-spot-camp',
  name: 'ภูชี้ฟ้า',
  weekendAvailability: [],
  maxGuestsPerDay: 10,
  useSpotView: true,
  unitPrice: 500,
  priceUnit: 'PER_SITE',
  priceIsFree: false,
};

describe('addDaysToIso — general day-math helper (CAM-700)', () => {
  it('[normal] adds N days', () => expect(addDaysToIso('2026-08-01', 2)).toBe('2026-08-03'));
  it('[boundary] N=0 is a no-op', () => expect(addDaysToIso('2026-08-01', 0)).toBe('2026-08-01'));
  it('[boundary] crosses a month end', () => expect(addDaysToIso('2026-08-30', 2)).toBe('2026-09-01'));
});

describe('buildSpotChipSpecs — cheapest-first, capped', () => {
  it('[normal] sorts by price ascending regardless of input order', () => {
    const chips = buildSpotChipSpecs(CANDIDATES);
    expect(chips.map((c) => c.id)).toEqual(['spot-a', 'spot-b', 'spot-c']);
  });

  it('[boundary] caps at MAX_BOOKING_SPOT_CHIPS even with more eligible pitches', () => {
    const many: BookingSpotCandidate[] = Array.from({ length: MAX_BOOKING_SPOT_CHIPS + 3 }, (_, i) => ({
      id: `spot-${i}`,
      name: `จุดที่ ${i}`,
      pricePerNight: 100 * (i + 1),
    }));
    expect(buildSpotChipSpecs(many)).toHaveLength(MAX_BOOKING_SPOT_CHIPS);
  });

  it('[null/empty] no eligible candidates -> no chips', () => {
    expect(buildSpotChipSpecs([])).toEqual([]);
  });
});

describe('formatSpotEcho — the tapped/typed-pitch user-bubble text', () => {
  it('[normal] formats name + price verbatim from the spot.chip template', () => {
    expect(formatSpotEcho('ริมน้ำ A', 500, t)).toBe(
      t.aiChat.booking.spot.chip.replace('{name}', 'ริมน้ำ A').replace('{price}', '฿500')
    );
  });
});

describe('buildSpotQuestionView', () => {
  it('[normal] reason:"ask" -> the ask copy + cheapest-first chips, back-to-guests control', () => {
    const view = buildSpotQuestionView({ t, useSpotView: true, reason: 'ask', candidates: CANDIDATES });
    expect(view.step).toBe('spot');
    expect(view.questionText).toBe(t.aiChat.booking.spot.ask);
    expect(view.chips.map((c) => (c.kind === 'spot' ? c.id : null))).toEqual(['spot-a', 'spot-b', 'spot-c']);
    expect(view.controls).toEqual([{ kind: 'back', toStep: 'guests' }, { kind: 'cancel' }]);
    expect(view.useSpotView).toBe(true);
    expect(view.isChecking).toBeUndefined();
  });

  it('[normal] reason:"loading" -> no chips yet, isChecking true (the /spots fetch is in flight)', () => {
    const view = buildSpotQuestionView({ t, useSpotView: true, reason: 'loading', candidates: [] });
    expect(view.chips).toEqual([]);
    expect(view.isChecking).toBe(true);
    expect(view.questionText).toBe(t.aiChat.booking.spot.ask);
  });

  it('[error/validation] reason:"unreadable"', () => {
    const view = buildSpotQuestionView({ t, useSpotView: true, reason: 'unreadable', candidates: CANDIDATES });
    expect(view.questionText).toBe(t.aiChat.booking.spot.unreadable);
  });

  it('[error/validation] reason:"occupied" names the specific pitch that turned out to be taken, excludes it from the fresh chip row', () => {
    const remaining = CANDIDATES.filter((c) => c.id !== 'spot-a');
    const view = buildSpotQuestionView({ t, useSpotView: true, reason: 'occupied', candidates: remaining, occupiedName: 'ริมน้ำ A' });
    expect(view.questionText).toBe(t.aiChat.booking.spot.occupied.replace('{name}', 'ริมน้ำ A'));
    expect(view.chips.map((c) => (c.kind === 'spot' ? c.id : null))).not.toContain('spot-a');
  });

  it('[null/empty] reason:"empty" -> the real empty state (design brief §4): no chips, the edit trio + cancel', () => {
    const view = buildSpotQuestionView({ t, useSpotView: true, reason: 'empty', candidates: [] });
    expect(view.questionText).toBe(t.aiChat.booking.spot.empty);
    expect(view.chips).toEqual([]);
    expect(view.controls).toEqual([{ kind: 'editDate' }, { kind: 'editNights' }, { kind: 'editGuests' }, { kind: 'cancel' }]);
  });
});

describe('buildSummaryView — CAM-700 spotValue + editSpot control', () => {
  const spotSlots = { checkIn: '2026-08-01', checkOut: '2026-08-03', nights: 2, guests: 2, spotId: 'spot-a', spotName: 'ริมน้ำ A' };

  it('[normal] a per-pitch camp that picked a spot gets the spotValue row + a 4th editSpot control', () => {
    const view = buildSummaryView({ slots: spotSlots, camp: CAMP, t, language: 'th', today: '2026-07-22' });
    expect(view.spotValue).toBe('ริมน้ำ A');
    expect(view.controls).toEqual([{ kind: 'editDate' }, { kind: 'editGuests' }, { kind: 'editSpot' }, { kind: 'cancel' }]);
    expect(view.useSpotView).toBe(true);
  });

  it('[null/empty] a whole-camp flow (no spotId in slots) never renders spotValue — absent, never a "—"', () => {
    const wholeCampSlots = { checkIn: '2026-08-01', checkOut: '2026-08-03', nights: 2, guests: 2 };
    const wholeCamp: BookingCampContext = { ...CAMP, useSpotView: false };
    const view = buildSummaryView({ slots: wholeCampSlots, camp: wholeCamp, t, language: 'th', today: '2026-07-22' });
    expect(view.spotValue).toBeUndefined();
    expect(view.controls).toEqual([{ kind: 'editDate' }, { kind: 'editGuests' }, { kind: 'cancel' }]);
  });

  it('[boundary] a per-pitch camp whose spot step was bypassed (fail-toward-handoff, no spotId) ALSO renders no spotValue', () => {
    // CAM-700 — this is the exact shape resolveSpotStep's fail-open downgrade
    // produces: useSpotView flips false, slots never gained a spotId.
    const noSpotSlots = { checkIn: '2026-08-01', checkOut: '2026-08-03', nights: 2, guests: 2 };
    const downgradedCamp: BookingCampContext = { ...CAMP, useSpotView: false };
    const view = buildSummaryView({ slots: noSpotSlots, camp: downgradedCamp, t, language: 'th', today: '2026-07-22' });
    expect(view.spotValue).toBeUndefined();
    expect(view.controls).toEqual([{ kind: 'editDate' }, { kind: 'editGuests' }, { kind: 'cancel' }]);
    // CAM-701 — `handoffHref` renamed to the `cta` discriminator.
    expect(view.cta.kind === 'handoff' ? view.cta.href : null).toContain('/campgrounds/phu-chi-fa-spot-camp');
  });
});
