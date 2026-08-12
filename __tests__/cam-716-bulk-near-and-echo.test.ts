/**
 * cam-716-bulk-near-and-echo.test.ts — CAM-716
 *
 * "A date-led search respects the place the camper named." Full spec:
 * docs/specs/ai-assistant/in-chat-booking-completion/CAM-716-date-search-respects-place/story.md
 *
 * Root cause (owner-reproduced 2026-08-08): "แนะนำลานกางเต้นท์ติดริมแม่น้ำ
 * แถวๆสระบุรี เข้าพักเสาร์หน้า" returned Yala camps under a sentence claiming
 * แถวสระบุรี — `bulkAvailability`'s schema had no `near`, and it echoed no
 * `appliedFilters`, so any date-led proximity ask silently dropped the
 * place. This file pins the fix: `near` on `bulkAvailability` (BR-1, shared
 * `lib/geo/province-proximity.ts` machinery), an `appliedFilters` echo
 * (BR-3, shared `lib/ai/tools/taxonomy-tags.ts` machinery), and per-card
 * `matchedTag` parity (BR-4).
 *
 * Coverage matrix (qa.md §7):
 *   - normal: near="Bangkok" -> bbox candidate query, no AdminArea lookup
 *     for the English-direct case (mirrors cam-502's own near-path pin)
 *   - normal: a candidate beyond MAX_NEAR_KM is dropped even though the bbox
 *     (a rectangle) admitted it — the radius cap holds on bulk too
 *   - normal: near WINS over province when both are given (BR-1 precedence
 *     parity with searchCampsites)
 *   - boundary/EC-3: near names a province with no committed centroid ->
 *     falls back to an exact-province filter, never crashes, appliedFilters
 *     echoes the raw near value on the resulting no_match (own `near` set)
 *   - boundary/EC-2: zero candidates WITHIN a real geo radius -> no_match,
 *     appliedFilters still carries `near` so the honest-zero sentence can
 *     name the place truthfully
 *   - null/empty (regression guard): a province/region-only no_match call
 *     (no `near` set) carries NO `appliedFilters` — byte-identical to the
 *     pre-CAM-716 contract cam-465's own tests pin
 *   - normal: appliedFilters applied-only matrix on an ok:true result
 *     (province/near/region/type/keyword/price/petFriendly/taxonomy) +
 *     sort dropped when near is set (mirrors CAM-709's own EC-2)
 *   - normal/BR-4: matchedTag parity — a taxonomy filter that matches a
 *     bulk card's own MasterData row shows that tag on the top-level
 *     tappable `cards[]`, and stays null when no taxonomy filter was
 *     supplied at all (the skip case, cam-564 semantics preserved)
 *   - normal (CAM-716 BR-2): the openrouter near-hint pin blocks (landmark +
 *     province-proximity) now instruct the model to set `near` on
 *     bulkAvailability too, not just searchCampsites
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import realProvinceCentroids from '@/prisma/data/province-centroids.json';

vi.mock('server-only', () => ({}));

const mockCampSiteFindMany = vi.fn();
const mockMasterDataFindMany = vi.fn();
const mockAdminAreaFindFirst = vi.fn();
const mockGetRemainingCapacityForCamps = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findMany: (...args: unknown[]) => mockCampSiteFindMany(...args),
    },
    masterData: {
      findMany: (...args: unknown[]) => mockMasterDataFindMany(...args),
    },
    adminArea: {
      findFirst: (...args: unknown[]) => mockAdminAreaFindFirst(...args),
    },
  },
}));

vi.mock('@/lib/campsite-availability', async () => {
  const actual = await vi.importActual<typeof import('@/lib/campsite-availability')>('@/lib/campsite-availability');
  return { ...actual, getRemainingCapacityForCamps: (...args: unknown[]) => mockGetRemainingCapacityForCamps(...args) };
});

const { executeBulkAvailability, bulkAvailabilityArgsSchema } = await import('@/lib/ai/tools/bulk-availability');

function candidateRow(id: string) {
  return { id, reviewCount: 0, location: { province: 'Chiang Mai' }, options: [] };
}

function geoRow(id: string, lat: number, lng: number) {
  return { id, latitude: lat, longitude: lng };
}

function dateRange() {
  return { startDate: '2026-09-05', endDate: '2026-09-06' };
}

const BANGKOK_CENTROID = (realProvinceCentroids as Record<string, { lat: number; lng: number }>)['Bangkok'];
const DEG_PER_KM_LAT = 1 / 111.32;

/** A synthetic point exactly `km` due north of the Bangkok centroid (mirrors cam-502-geo-proximity.test.ts's own helper). */
function pointAtKm(km: number) {
  return { lat: BANGKOK_CENTROID.lat + km * DEG_PER_KM_LAT, lng: BANGKOK_CENTROID.lng };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRemainingCapacityForCamps.mockResolvedValue({});
});

describe('bulkAvailability — near (BR-1, shared geo machinery)', () => {
  it('[normal] near="Bangkok" (English, direct) -> bbox candidate query, no AdminArea lookup', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]); // candidate query — zero candidates within radius

    const args = bulkAvailabilityArgsSchema.parse({ near: 'Bangkok', dates: [dateRange()] });
    const result = await executeBulkAvailability(args);

    expect(mockAdminAreaFindFirst).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, reason: 'no_match', appliedFilters: { near: 'Bangkok', taxonomy: [] } });

    const candidateCall = mockCampSiteFindMany.mock.calls[0][0] as { select: unknown; take: number };
    expect(candidateCall.select).toEqual({ id: true, latitude: true, longitude: true });
  });

  it('[normal] a candidate beyond MAX_NEAR_KM (250) is dropped even though the bbox admits it', async () => {
    const inRange = geoRow('c-in', pointAtKm(200).lat, pointAtKm(200).lng);
    const outOfRange = geoRow('c-out', pointAtKm(300).lat, pointAtKm(300).lng);
    mockCampSiteFindMany
      .mockResolvedValueOnce([inRange, outOfRange]) // candidate query
      .mockResolvedValueOnce([candidateRow('c-in')]); // card fetch

    const args = bulkAvailabilityArgsSchema.parse({ near: 'Bangkok', dates: [dateRange()] });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.camps.map((c) => c.id)).toEqual(['c-in']);
    const cardFetchCall = mockCampSiteFindMany.mock.calls[1][0] as { where: { id: { in: string[] } } };
    expect(cardFetchCall.where.id.in).not.toContain('c-out');
  });

  it('[normal/BR-1] near WINS over province when both are given (precedence parity with searchCampsites)', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);

    const args = bulkAvailabilityArgsSchema.parse({ near: 'Bangkok', province: 'Chiang Mai', dates: [dateRange()] });
    await executeBulkAvailability(args);

    const call = mockCampSiteFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(call.where.location?.province).toBeUndefined();
  });

  it('[boundary/EC-3] near names a province with no committed centroid -> exact-province fallback, never crashes, echoes near even on the resulting no_match', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);

    const args = bulkAvailabilityArgsSchema.parse({ near: 'Neverland Province', dates: [dateRange()] });
    const result = await executeBulkAvailability(args);

    expect(result).toEqual({
      ok: false,
      reason: 'no_match',
      appliedFilters: { near: 'Neverland Province', taxonomy: [] },
    });
    const call = mockCampSiteFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(call.where.location?.province).toBe('Neverland Province');
  });

  it('[boundary/EC-2] zero candidates WITHIN a real geo radius -> no_match, appliedFilters still carries near', async () => {
    const farAway = geoRow('c-far', pointAtKm(400).lat, pointAtKm(400).lng);
    mockCampSiteFindMany.mockResolvedValueOnce([farAway]);

    const args = bulkAvailabilityArgsSchema.parse({ near: 'Bangkok', dates: [dateRange()] });
    const result = await executeBulkAvailability(args);

    expect(result).toEqual({ ok: false, reason: 'no_match', appliedFilters: { near: 'Bangkok', taxonomy: [] } });
    expect(mockCampSiteFindMany).toHaveBeenCalledOnce(); // only the candidate query ran, no card fetch
  });

  it('[null/empty regression guard] a province-only no_match (no `near` set) carries NO appliedFilters — byte-identical to the pre-CAM-716 contract', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);

    const args = bulkAvailabilityArgsSchema.parse({ province: 'Nowhere', dates: [dateRange()] });
    const result = await executeBulkAvailability(args);

    expect(result).toEqual({ ok: false, reason: 'no_match' });
  });
});

describe('bulkAvailability — appliedFilters echo (BR-3, applied-only honesty)', () => {
  it('[normal] province/type/keyword/price/petFriendly/taxonomy all echo when set; taxonomy Thai-labeled from MasterData', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([candidateRow('c1')]);
    mockMasterDataFindMany.mockResolvedValueOnce([{ code: 'RIVE', nameTh: 'แม่น้ำ ลำธาร คลองเล็ก' }]);

    const args = bulkAvailabilityArgsSchema.parse({
      province: 'Chiang Mai',
      type: 'GLAMP',
      keyword: 'สวนสน',
      priceMin: 100,
      priceMax: 900,
      petFriendly: true,
      terrain: 'RIVE',
      dates: [dateRange()],
    });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.appliedFilters).toEqual({
        province: 'Chiang Mai',
        type: 'GLAMP',
        keyword: 'สวนสน',
        priceMin: 100,
        priceMax: 900,
        petFriendly: true,
        taxonomy: [{ group: 'terrain', code: 'RIVE', labelTh: 'แม่น้ำ ลำธาร คลองเล็ก' }],
      });
    }
  });

  it('[null/empty] a broad search with no criteria echoes nothing but the always-present taxonomy: []', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([candidateRow('c1')]);

    const args = bulkAvailabilityArgsSchema.parse({ dates: [dateRange()] });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.appliedFilters).toEqual({ taxonomy: [] });
  });

  it('[dropped-arg] sort is dropped from the echo when near is set (a proximity search always orders by distance)', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);

    const args = bulkAvailabilityArgsSchema.parse({ near: 'Bangkok', sort: 'price_asc', dates: [dateRange()] });
    const result = await executeBulkAvailability(args);

    expect(result).toEqual({ ok: false, reason: 'no_match', appliedFilters: { near: 'Bangkok', taxonomy: [] } });
  });

  it('[dropped-arg] province is dropped from the echo when near is also set (near wins outright)', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);

    const args = bulkAvailabilityArgsSchema.parse({ near: 'Bangkok', province: 'Chiang Mai', dates: [dateRange()] });
    const result = await executeBulkAvailability(args);

    expect(result).toEqual({ ok: false, reason: 'no_match', appliedFilters: { near: 'Bangkok', taxonomy: [] } });
  });
});

describe('bulkAvailability — matchedTag parity (BR-4, CAM-564 semantics preserved)', () => {
  it('[normal] a taxonomy filter that matches a card shows that tag on the top-level tappable cards[]', async () => {
    mockCampSiteFindMany
      .mockResolvedValueOnce([candidateRow('c1')]) // candidate query
      .mockResolvedValueOnce([{ id: 'c1', options: [{ code: 'RIVE', nameTh: 'แม่น้ำ ลำธาร คลองเล็ก', nameEn: 'River' }] }]); // matched-tag enrichment query
    mockGetRemainingCapacityForCamps.mockResolvedValueOnce({
      c1: { capacity: 10, bookedGuests: 0, heldGuests: 0, remaining: 10, blockedByHost: false },
    });

    const args = bulkAvailabilityArgsSchema.parse({ terrain: 'RIVE', dates: [dateRange()] });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].matchedTag).toEqual({ nameTh: 'แม่น้ำ ลำธาร คลองเล็ก', nameEn: 'River' });
    }
  });

  it('[null/empty skip case] no taxonomy filter supplied at all -> matchedTag null, the enrichment query never fires', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([candidateRow('c1')]);
    mockGetRemainingCapacityForCamps.mockResolvedValueOnce({
      c1: { capacity: 10, bookedGuests: 0, heldGuests: 0, remaining: 10, blockedByHost: false },
    });

    const args = bulkAvailabilityArgsSchema.parse({ dates: [dateRange()] });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cards[0].matchedTag).toBeNull();
      // Only ONE campSite.findMany call total (the candidate query) — the
      // matched-tag enrichment query is skipped entirely (no-N+1 guard).
      expect(mockCampSiteFindMany).toHaveBeenCalledOnce();
    }
  });
});

describe('openrouter-client — CAM-716 BR-2: the near-hint pin blocks now name bulkAvailability too', () => {
  const FAKE_KEY = 'sk-or-test-cam-716';

  function res(body: unknown): Response {
    return { ok: true, status: 200, json: async () => body } as Response;
  }

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = FAKE_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENROUTER_API_KEY;
  });

  async function getSystemPrompt(message: string): Promise<string> {
    const { runAssistantTurn } = await import('@/lib/ai/openrouter-client');
    const mockFetch = vi.fn().mockResolvedValue(res({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }));
    vi.stubGlobal('fetch', mockFetch);

    await runAssistantTurn(message);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    return body.messages[0].content as string;
  }

  it('[normal] a province-proximity hint (แถวๆสระบุรี) instructs near on searchCampsites OR bulkAvailability', async () => {
    const prompt = await getSystemPrompt('ลานริมน้ำ แถวๆสระบุรี');
    expect(prompt).toContain('When you call searchCampsites or bulkAvailability');
    expect(prompt).toContain('this turn, you MUST set near="Saraburi"');
  });

  it('[normal] a landmark hint (เขาใหญ่) instructs near on searchCampsites OR bulkAvailability', async () => {
    const prompt = await getSystemPrompt('ลานกางเต็นท์เขาใหญ่');
    expect(prompt).toContain('When you call searchCampsites or bulkAvailability this turn, you MUST set');
    expect(prompt).toContain('near="เขาใหญ่"');
  });
});
