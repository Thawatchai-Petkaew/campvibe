/**
 * cam-700-spot-turn.test.ts — CAM-700 (epic CAM-695, ADR-018 D7)
 * "A per-pitch camp gets an in-chat `spot` step"
 *
 * Pure-logic coverage for the `spot` step's ASYNC orchestration in
 * `components/ai-chat/booking-turn.ts`: `resolveSpotStep` (the /spots fetch
 * once the flow enters `spot`) and `resolveSpotSelection` (a chip/typed
 * pick, gated on an occupancy check before it is ever committed). Both take
 * their network call as an INJECTED function parameter (dependency
 * injection) — no jsdom, no real fetch, no `lib/api-client.ts` import.
 *
 * Two load-bearing safety properties pinned here (the story's own
 * `done_when`):
 *   1. `/spots` failing OR returning zero live pitches fails TOWARD the
 *      handoff summary — never a pitch-less confirm, never a stall.
 *   2. Picking a pitch that turns out occupied re-offers with the brief's
 *      copy, excludes that pitch, and NEVER commits `spotId` to state.
 */
import { describe, expect, it, vi } from 'vitest';
import { getTranslations } from '@/locales/translations';
import type { BookingSlots, BookingSpotCandidate } from '@/components/ai-chat/booking-flow';
import {
  processBookingTurn,
  resolveSpotSelection,
  resolveSpotStep,
  type BookingSession,
  type SpotFetchOutcome,
} from '@/components/ai-chat/booking-turn';
import type { BookingCampContext } from '@/components/ai-chat/booking-view';
import type { ChatEntry } from '@/components/ai-chat/conversation';

const t = getTranslations('th');
const NOW = new Date('2026-07-22T10:00:00Z');

const CANDIDATES: BookingSpotCandidate[] = [
  { id: 'spot-b', name: 'เนินสน B', pricePerNight: 700 },
  { id: 'spot-a', name: 'ริมน้ำ A', pricePerNight: 500 },
];

const CAMP: BookingCampContext = {
  campId: 'cs-700',
  slug: 'phu-chi-fa-spot-camp',
  name: 'ภูชี้ฟ้า',
  weekendAvailability: [{ date: '2026-08-01', remaining: 6, blockedByHost: false }],
  maxGuestsPerDay: 10,
  useSpotView: true,
  unitPrice: 500,
  priceUnit: 'PER_SITE',
  priceIsFree: false,
};

const GUESTS_FILLED_SLOTS: BookingSlots = { checkIn: '2026-08-01', checkOut: '2026-08-03', nights: 2, guests: 2 };

function sessionAtSpot(overrides: Partial<BookingSession> = {}): BookingSession {
  return {
    state: { slots: GUESTS_FILLED_SLOTS, consecutiveMisses: 0 },
    camp: CAMP,
    spotCandidates: null,
    ...overrides,
  };
}

function bookingEntries(entries: ChatEntry[]) {
  return entries.filter((e) => e.role === 'assistant' && e.kind === 'booking');
}

describe('resolveSpotStep — the entering-`spot` fetch (design brief §4)', () => {
  it('[normal] a successful fetch with eligible candidates renders the `ask` chip row and caches them', async () => {
    const fetchSpots = vi.fn(async (): Promise<SpotFetchOutcome> => ({ ok: true, candidates: CANDIDATES }));
    const session = sessionAtSpot();
    const result = await resolveSpotStep([], session, fetchSpots, t, language(), NOW);

    expect(fetchSpots).toHaveBeenCalledWith('cs-700', 2);
    const newest = bookingEntries(result.entries).at(-1);
    expect(newest).toMatchObject({ step: 'spot' });
    expect(newest && 'view' in newest && newest.view.kind === 'question' ? newest.view.chips.length : 0).toBe(2);
    expect(result.booking?.spotCandidates).toEqual(CANDIDATES);
    expect(result.booking?.camp.useSpotView).toBe(true); // unchanged — real data, no downgrade
  });

  it('[boundary] a successful fetch with ZERO eligible candidates (party too big for every live pitch) renders the REAL empty state, stays on `spot`', async () => {
    const fetchSpots = vi.fn(async (): Promise<SpotFetchOutcome> => ({ ok: true, candidates: [] }));
    const result = await resolveSpotStep([], sessionAtSpot(), fetchSpots, t, language(), NOW);

    const newest = bookingEntries(result.entries).at(-1);
    expect(newest).toMatchObject({ step: 'spot' });
    expect(newest && 'view' in newest && newest.view.kind === 'question' ? newest.view.questionText : null).toBe(
      t.aiChat.booking.spot.empty
    );
    expect(result.booking?.camp.useSpotView).toBe(true); // real pitches exist elsewhere; this is a fit problem, not a data problem
  });

  it('[error/validation][LOAD-BEARING] /spots FAILING fails TOWARD the handoff — renders `summary` (with the handoff CTA), never a pitch-less confirm', async () => {
    const fetchSpots = vi.fn(async (): Promise<SpotFetchOutcome> => ({ ok: false }));
    const result = await resolveSpotStep([], sessionAtSpot(), fetchSpots, t, language(), NOW);

    const newest = bookingEntries(result.entries).at(-1);
    expect(newest).toMatchObject({ step: 'summary' });
    // CAM-701 — `handoffHref` renamed to the `cta` discriminator.
    const summaryCta = newest && 'view' in newest && newest.view.kind === 'summary' ? newest.view.cta : null;
    expect(summaryCta?.kind === 'handoff' ? summaryCta.href : null).toContain('/campgrounds/phu-chi-fa-spot-camp');
    // The downgrade is session-scoped only — `spot` is skipped for the REST
    // of this flow, never re-attempted, and no spotId is ever set.
    expect(result.booking?.camp.useSpotView).toBe(false);
    expect(result.booking?.state.slots.spotId).toBeUndefined();
  });

  it('[error/validation][LOAD-BEARING] the camp reporting ZERO live pitches at all (an empty raw list) ALSO fails TOWARD the handoff', async () => {
    // Distinguishes "the camp truly has no pitches" (SpotFetchOutcome ok:false,
    // decided by the injected fetcher) from "pitches exist but none fit"
    // (ok:true, candidates:[] — the boundary case above).
    const fetchSpots = vi.fn(async (): Promise<SpotFetchOutcome> => ({ ok: false }));
    const result = await resolveSpotStep([], sessionAtSpot(), fetchSpots, t, language(), NOW);
    expect(bookingEntries(result.entries).at(-1)).toMatchObject({ step: 'summary' });
  });

  it('[normal] the summary rendered after a failed fetch reuses the EXACT same buildSummaryView the whole-camp flow uses (byte-identical shape, no special-cased "spot failed" branch)', async () => {
    const fetchSpots = vi.fn(async (): Promise<SpotFetchOutcome> => ({ ok: false }));
    const result = await resolveSpotStep([], sessionAtSpot(), fetchSpots, t, language(), NOW);
    const newest = bookingEntries(result.entries).at(-1);
    expect(newest && 'view' in newest && newest.view.kind === 'summary' ? newest.view.spotValue : 'present').toBeUndefined();
  });
});

describe('resolveSpotSelection — occupancy is checked BEFORE a pitch is ever committed', () => {
  function sessionWithCandidates(): BookingSession {
    return sessionAtSpot({ spotCandidates: CANDIDATES });
  }

  it('[normal] a chip pick that IS free commits: spotId/spotName land in state, the newest block is `summary` with the spotValue row', async () => {
    const checkAvailability = vi.fn(async () => true);
    const session = sessionWithCandidates();
    const outcome = await resolveSpotSelection(
      [],
      session,
      { kind: 'chip', slots: { spotId: 'spot-a', spotName: 'ริมน้ำ A' } },
      'ริมน้ำ A คืนละ ฿500',
      checkAvailability,
      t,
      language(),
      NOW
    );

    expect(outcome.retry).toBeUndefined();
    expect(checkAvailability).toHaveBeenCalledWith('cs-700', 'spot-a', '2026-08-01', '2026-08-02'); // last NIGHT, not checkout
    expect(outcome.booking?.state.slots.spotId).toBe('spot-a');
    expect(outcome.booking?.state.slots.spotName).toBe('ริมน้ำ A');
    const newest = bookingEntries(outcome.entries).at(-1);
    expect(newest).toMatchObject({ step: 'summary' });
    expect(newest && 'view' in newest && newest.view.kind === 'summary' ? newest.view.spotValue : null).toBe('ริมน้ำ A');
  });

  it('[error/validation][LOAD-BEARING] a chip pick that turns out OCCUPIED re-offers with the brief\'s copy, excludes the pitch, and NEVER commits spotId', async () => {
    const checkAvailability = vi.fn(async () => false); // occupied
    const session = sessionWithCandidates();
    const outcome = await resolveSpotSelection(
      [],
      session,
      { kind: 'chip', slots: { spotId: 'spot-a', spotName: 'ริมน้ำ A' } },
      'ริมน้ำ A คืนละ ฿500',
      checkAvailability,
      t,
      language(),
      NOW
    );

    expect(outcome.retry).toBeUndefined();
    // The state that was BEFORE the attempt is what survives — no spotId.
    expect(outcome.booking?.state.slots.spotId).toBeUndefined();
    expect(outcome.booking?.spotCandidates?.map((c) => c.id)).not.toContain('spot-a');
    const newest = bookingEntries(outcome.entries).at(-1);
    expect(newest).toMatchObject({ step: 'spot' });
    expect(newest && 'view' in newest && newest.view.kind === 'question' ? newest.view.questionText : null).toBe(
      t.aiChat.booking.spot.occupied.replace('{name}', 'ริมน้ำ A')
    );
  });

  it('[normal] a TYPED name (prefix match) resolving to a free pitch also commits, identical shape to the chip path', async () => {
    const checkAvailability = vi.fn(async () => true);
    const outcome = await resolveSpotSelection(
      [],
      sessionWithCandidates(),
      { kind: 'text', text: 'เนินสน' },
      'เนินสน',
      checkAvailability,
      t,
      language(),
      NOW
    );
    expect(outcome.booking?.state.slots.spotId).toBe('spot-b');
  });

  it('[error/validation] a typed name matching NOTHING is a plain miss — no network call at all (misses go through the existing 2-strike machinery)', async () => {
    const checkAvailability = vi.fn(async () => true);
    const outcome = await resolveSpotSelection(
      [],
      sessionWithCandidates(),
      { kind: 'text', text: 'จุดที่ไม่มีจริง' },
      'จุดที่ไม่มีจริง',
      checkAvailability,
      t,
      language(),
      NOW
    );
    expect(checkAvailability).not.toHaveBeenCalled();
    expect(outcome.booking?.state.consecutiveMisses).toBe(1);
    expect(bookingEntries(outcome.entries).at(-1)).toMatchObject({ step: 'spot' });
  });

  it('[error/validation] a chip carrying an unknown id is REJECTED before any network call (accept fails statically first)', async () => {
    const checkAvailability = vi.fn(async () => true);
    const outcome = await resolveSpotSelection(
      [],
      sessionWithCandidates(),
      { kind: 'chip', slots: { spotId: 'spot-ghost', spotName: 'ผี' } },
      'ผี',
      checkAvailability,
      t,
      language(),
      NOW
    );
    expect(checkAvailability).not.toHaveBeenCalled();
    expect(outcome.booking?.state.slots.spotId).toBeUndefined();
  });

  it('[error/validation] the availability check itself failing (network/off-contract) never silently assumes free — returns a `retry` descriptor, no state committed', async () => {
    const checkAvailability = vi.fn(async () => null); // could not determine
    const session = sessionWithCandidates();
    const outcome = await resolveSpotSelection(
      [],
      session,
      { kind: 'chip', slots: { spotId: 'spot-a', spotName: 'ริมน้ำ A' } },
      'ริมน้ำ A คืนละ ฿500',
      checkAvailability,
      t,
      language(),
      NOW
    );

    expect(outcome.retry).toEqual({
      input: { kind: 'chip', slots: { spotId: 'spot-a', spotName: 'ริมน้ำ A' } },
      echoText: 'ริมน้ำ A คืนละ ฿500',
    });
    expect(outcome.booking?.state.slots.spotId).toBeUndefined(); // never committed on an uncertain check
    // The echo is present but no NEW booking block yet — the caller (use-ai-chat.ts)
    // appends the real checkFailed block with a working retry closure.
    const userEcho = outcome.entries.at(-1);
    expect(userEcho).toMatchObject({ role: 'user', text: 'ริมน้ำ A คืนละ ฿500' });
  });

  it('[normal] two consecutive typed misses at `spot` hand off to the model exactly like every other step', async () => {
    const checkAvailability = vi.fn(async () => true);
    const session = sessionWithCandidates();
    const first = await resolveSpotSelection([], session, { kind: 'text', text: 'ไม่รู้จะเลือกอะไร' }, 'ไม่รู้จะเลือกอะไร', checkAvailability, t, language(), NOW);
    expect(first.booking).not.toBeNull();

    const second = await resolveSpotSelection(
      first.entries,
      first.booking!,
      { kind: 'text', text: 'มีจุดวิวสวยไหม' },
      'มีจุดวิวสวยไหม',
      checkAvailability,
      t,
      language(),
      NOW
    );
    expect(second.booking).toBeNull();
    expect(second.entries.at(-1)).toMatchObject({ role: 'assistant', kind: 'answer', text: t.aiChat.booking.handedToAssistant });
  });
});

describe('end-to-end — a whole-camp flow never lands on `spot` (mirrors the story\'s own done_when)', () => {
  it('[normal] date+nights filled, answering `guests` on a useSpotView:false camp advances straight to `summary`, `spot` never appears', () => {
    const wholeCamp: BookingCampContext = { ...CAMP, useSpotView: false };
    const filled: BookingSession = {
      state: { slots: { checkIn: '2026-08-01', checkOut: '2026-08-03', nights: 2 }, consecutiveMisses: 0 },
      camp: wholeCamp,
    };
    const result = processBookingTurn([], filled, { kind: 'chip', slots: { guests: 2 } }, '2 คน', t, language(), NOW);
    expect(bookingEntries(result.entries).at(-1)).toMatchObject({ step: 'summary' });
  });
});

function language(): 'th' {
  return 'th';
}
