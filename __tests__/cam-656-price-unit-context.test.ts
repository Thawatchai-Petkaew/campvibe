/**
 * cam-656-price-unit-context.test.ts — CAM-656 (epic CAM-648, ADR-014): "The
 * assistant states the price unit it is quoting."
 *
 * CAM-653 already made the camper-facing CARDS unit-aware; what this story
 * closes is what the MODEL is told (and therefore what it says in prose) —
 * `lib/ai/tools/get-camp-detail.ts` and `lib/ai/tools/compare-camps.ts` did
 * not select `CampSite.priceUnit` at all, and the "previously shown
 * campsites" text block the model reads from
 * (`lib/ai/openrouter-client.ts`'s `formatStartingPriceSuffix`) stated a bare
 * `฿NNN` with no unit. `lib/ai/tools/search-campsites.ts` /
 * `lib/ai/tools/bulk-availability.ts` are NOT touched here: both already
 * select `priceUnit` via the shared `campCardSelect`/`aiCampCardSelect`
 * (CAM-653), so the model already receives it on those tool results
 * mechanically — verified by inspection, no gap to close there.
 *
 * Coverage matrix:
 *   - normal: getCampDetail's `price.unit` carries the real column value
 *     (PER_PERSON / PER_TENT / PER_SITE) for a live read
 *   - normal: compareCamps' `price.unit` cell carries the real column value
 *   - normal: `deriveShownState` projects a card's `priceUnit` (card-parity
 *     with CAM-460's existing `priceLow` projection)
 *   - normal: the guest-wire `shownResultSchema` accepts all 3 PricingUnit
 *     members for `priceUnit`
 *   - error/validation: `shownResultSchema` rejects an invalid `priceUnit`
 *     string
 *   - [THE CORE ASK] normal: the shown-results prompt block states the unit
 *     tag for PER_PERSON and PER_TENT
 *   - [THE CORE ASK] null/empty: the shown-results prompt block does NOT
 *     assert either unit when `priceUnit` is absent (unit unrecorded) — the
 *     bare figure only, never a guessed per-person/per-site claim
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// A. getCampDetail — price.unit passes through the real column value
// ---------------------------------------------------------------------------

const mockFindFirst = vi.fn();
const mockGetCampSiteDailyAvailability = vi.fn();
const mockGetEffectiveCapacity = vi.fn();
const mockGetRemainingCapacityForCamps = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('@/lib/campsite-availability', () => ({
  getCampSiteDailyAvailability: (...args: unknown[]) => mockGetCampSiteDailyAvailability(...args),
  getEffectiveCapacity: (...args: unknown[]) => mockGetEffectiveCapacity(...args),
  getRemainingCapacityForCamps: (...args: unknown[]) => mockGetRemainingCapacityForCamps(...args),
}));

// B. compareCamps — a dedicated `findMany`, same mocked '@/lib/prisma' module.
const mockFindMany = vi.fn();

const { executeGetCampDetail } = await import('@/lib/ai/tools/get-camp-detail');
const { executeCompareCamps } = await import('@/lib/ai/tools/compare-camps');
const { deriveShownState } = await import('@/lib/ai/conversation-store');
const { shownResultSchema } = await import('@/lib/validations/ai-chat');

import type { ConversationMessageView } from '@/lib/ai/conversation-store';
import type { AiChatCardResponse } from '@/lib/api-client';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const CAMP_A = '11111111-1111-4111-8111-111111111111';
const CAMP_B = '22222222-2222-4222-8222-222222222222';

function decimal(n: number) {
  return { toNumber: () => n };
}

function baseCampSite(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    nameTh: 'ลานกางเต็นท์ริมน้ำ',
    nameEn: 'Riverside Camp',
    useSpotView: false,
    maxGuestsPerDay: 20,
    maxTentsPerDay: 10,
    avgRating: null,
    reviewCount: 0,
    priceLow: decimal(250),
    priceHigh: null,
    priceCurrency: 'THB',
    priceUnit: 'PER_SITE',
    extraFeeAmount: null,
    extraFeeLabel: null,
    feeInfo: null,
    isFree: false,
    cancellationPolicy: null,
    isVerified: true,
    checkInTime: '13:00',
    checkOutTime: '11:00',
    minimumAge: null,
    directions: null,
    latitude: null,
    longitude: null,
    campSiteType: 'CAGD',
    location: { province: 'Chiang Mai', region: 'North' },
    options: [],
    reviews: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCampSiteDailyAvailability.mockResolvedValue({});
  mockGetEffectiveCapacity.mockResolvedValue({ maxGuestsPerDay: 20, maxTentsPerDay: 10 });
  mockGetRemainingCapacityForCamps.mockResolvedValue({
    [VALID_UUID]: { capacity: 20, bookedGuests: 0, heldGuests: 0, remaining: 20, blockedByHost: false },
  });
});

describe('getCampDetail — CAM-656: price.unit carries the real column value', () => {
  it.each(['PER_PERSON', 'PER_TENT', 'PER_SITE'] as const)('[normal] priceUnit=%s -> price.unit=%s', async (unit) => {
    mockFindFirst.mockResolvedValueOnce(baseCampSite({ priceUnit: unit }));

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.price.unit).toBe(unit);
  });
});

describe('compareCamps — CAM-656: the price cell carries the real column value', () => {
  it.each(['PER_PERSON', 'PER_TENT', 'PER_SITE'] as const)('[normal] priceUnit=%s -> cells.price.unit=%s', async (unit) => {
    mockFindMany.mockResolvedValueOnce([
      baseCampSite({ id: CAMP_A, priceUnit: unit }),
      baseCampSite({ id: CAMP_B, priceUnit: 'PER_SITE' }),
    ]);

    const result = await executeCompareCamps({ campIds: [CAMP_A, CAMP_B], criteria: ['price'] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const campA = result.camps.find((c) => c.id === CAMP_A);
    expect(campA?.cells.price?.unit).toBe(unit);
  });
});

// ---------------------------------------------------------------------------
// C. conversation-store — deriveShownState projects card.priceUnit
// ---------------------------------------------------------------------------

function makeCard(id: string, priceUnit?: AiChatCardResponse['priceUnit']): AiChatCardResponse {
  return {
    id,
    nameTh: 'ลานเขาใหญ่',
    nameEn: null,
    nameThSlug: 'lan-khao-yai',
    nameEnSlug: 'khao-yai',
    priceLow: 250,
    priceUnit,
    createdAt: new Date().toISOString(),
    avgRating: null,
    reviewCount: 0,
    location: { province: 'Nakhon Ratchasima' },
  };
}

function assistantCardsMessage(cards: AiChatCardResponse[]): ConversationMessageView {
  return {
    role: 'ASSISTANT',
    contentText: 'ok',
    blocks: [{ type: 'cards', v: 1, data: cards }],
  } as ConversationMessageView;
}

describe('deriveShownState — CAM-656: card-parity projection of priceUnit', () => {
  it('[normal] projects a card\'s real priceUnit (PER_PERSON) unchanged', () => {
    const history = [assistantCardsMessage([makeCard(CAMP_A, 'PER_PERSON')])];
    const state = deriveShownState(history);
    expect(state.lastResults).toEqual([
      expect.objectContaining({ ordinal: 1, campId: CAMP_A, priceUnit: 'PER_PERSON' }),
    ]);
  });

  it('[null/empty] a card persisted before CAM-653 (priceUnit undefined) projects priceUnit: undefined, never defaulted', () => {
    const history = [assistantCardsMessage([makeCard(CAMP_A, undefined)])];
    const state = deriveShownState(history);
    expect(state.lastResults[0].priceUnit).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// D. lib/validations/ai-chat — shownResultSchema.priceUnit boundary
// ---------------------------------------------------------------------------

describe('shownResultSchema — CAM-656: priceUnit boundary', () => {
  it.each(['PER_PERSON', 'PER_TENT', 'PER_SITE'] as const)('[normal] accepts priceUnit=%s', (unit) => {
    const parsed = shownResultSchema.safeParse({
      ordinal: 1,
      campSiteId: CAMP_A,
      name: 'ลานเขาใหญ่',
      priceUnit: unit,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.priceUnit).toBe(unit);
  });

  it('[null/empty] priceUnit absent still parses (additive/optional, api.md rule 12)', () => {
    const parsed = shownResultSchema.safeParse({ ordinal: 1, campSiteId: CAMP_A, name: 'ลานเขาใหญ่' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.priceUnit).toBeUndefined();
  });

  it('[error/validation] rejects an invalid priceUnit string (not a real PricingUnit member)', () => {
    const parsed = shownResultSchema.safeParse({
      ordinal: 1,
      campSiteId: CAMP_A,
      name: 'ลานเขาใหญ่',
      priceUnit: 'PER_HOUR',
    });
    expect(parsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// E. openrouter-client — THE CORE ASK: the shown-results price-context
//    formatter states the unit for PER_PERSON/PER_TENT and NEVER asserts one
//    when it is absent.
// ---------------------------------------------------------------------------

vi.mock('server-only', () => ({}));

const { runAssistantTurnFromMessages } = await import('@/lib/ai/openrouter-client');

const FAKE_KEY = 'sk-or-test-cam-656';

function res(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}
function assistantMessage(content: string | null) {
  return { choices: [{ message: { role: 'assistant', content } }] };
}
function stubFetch() {
  const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ok')));
  vi.stubGlobal('fetch', mockFetch);
  return mockFetch;
}

async function getSystemPromptFor(shownResults: unknown): Promise<string> {
  const mockFetch = stubFetch();
  const turnMessages = [{ role: 'user' as const, content: '<user_message>\nสวัสดี\n</user_message>' }];
  await runAssistantTurnFromMessages(
    turnMessages,
    {},
    shownResults as Parameters<typeof runAssistantTurnFromMessages>[2]
  );
  const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(init.body as string);
  return body.messages.find((m: { role: string }) => m.role === 'system').content as string;
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = FAKE_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
});

describe('formatStartingPriceSuffix (via the shown-results prompt block) — CAM-656', () => {
  it('[normal] priceUnit=PER_PERSON states the per-guest charge-per tag', async () => {
    const prompt = await getSystemPromptFor([
      { ordinal: 1, campId: CAMP_A, name: 'ลานเขาใหญ่', priceLow: 250, priceUnit: 'PER_PERSON' },
    ]);
    expect(prompt).toContain(`1. ${CAMP_A} ลานเขาใหญ่ — starting price ฿250 (per guest, per night)`);
  });

  it('[normal] priceUnit=PER_TENT states the per-tent charge-per tag', async () => {
    const prompt = await getSystemPromptFor([
      { ordinal: 1, campId: CAMP_A, name: 'ลานเขาใหญ่', priceLow: 500, priceUnit: 'PER_TENT' },
    ]);
    expect(prompt).toContain(`1. ${CAMP_A} ลานเขาใหญ่ — starting price ฿500 (per tent, per night)`);
  });

  it('[normal] priceUnit=PER_SITE states the whole-site charge-per tag', async () => {
    const prompt = await getSystemPromptFor([
      { ordinal: 1, campId: CAMP_A, name: 'ลานเขาใหญ่', priceLow: 900, priceUnit: 'PER_SITE' },
    ]);
    expect(prompt).toContain(`1. ${CAMP_A} ลานเขาใหญ่ — starting price ฿900 (per night, whole site)`);
  });

  it('[null/empty] priceUnit absent (unrecorded) states the bare figure and asserts NO unit at all', async () => {
    const prompt = await getSystemPromptFor([
      { ordinal: 1, campId: CAMP_A, name: 'ลานเขาใหญ่', priceLow: 250 },
    ]);
    // the exact pre-CAM-656 line, with nothing appended after the figure —
    // asserted as the shown_results ENTRY line specifically (the general
    // Zone-B price-unit instruction elsewhere in the prompt legitimately
    // mentions "per guest" as vocabulary, so a global `.not.toContain` would
    // false-positive on that unrelated sentence).
    expect(prompt).toContain(`1. ${CAMP_A} ลานเขาใหญ่ — starting price ฿250\n`);
    expect(prompt).not.toContain(`ลานเขาใหญ่ — starting price ฿250 (`);
  });

  it('[null/empty] a free entry (priceLow null) carries no unit tag either — nothing to charge per', async () => {
    const prompt = await getSystemPromptFor([
      { ordinal: 1, campId: CAMP_A, name: 'ลานฟรี', priceLow: null, priceUnit: 'PER_PERSON' },
    ]);
    expect(prompt).toContain(`1. ${CAMP_A} ลานฟรี — starting price free`);
    expect(prompt).not.toContain('starting price free (');
  });

  it('[normal] the guidance paragraph instructs the model to state the tag when present and never invent one when absent', async () => {
    const prompt = await getSystemPromptFor([
      { ordinal: 1, campId: CAMP_A, name: 'ลานเขาใหญ่', priceLow: 250, priceUnit: 'PER_PERSON' },
    ]);
    expect(prompt).toContain('never claim or imply either per-person or per-site pricing for it');
  });
});
