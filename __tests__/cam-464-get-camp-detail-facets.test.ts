/**
 * cam-464-get-camp-detail-facets.test.ts — CAM-464 (D4): the additive
 * `facets: FacetScore[]` field wired into `lib/ai/tools/get-camp-detail.ts`'s
 * `executeGetCampDetail`, computed from the ALREADY-SELECTED `options` +
 * `minimumAge` fields (zero new Prisma select, zero added DB cost).
 *
 * Coverage matrix:
 *   - normal: a fixture camp with known codes returns `facets` with the
 *     expected ids + non-empty evidence (AC-1/AC-2/AC-3 combined, matches the
 *     story's own AC-1 fixture: TOIL+SHOW+DRIV+no minimum-age)
 *   - normal: backward-compatible — every pre-existing `ok:true` field is
 *     STILL present and unchanged alongside the new `facets` field
 *   - null/empty: a camp with essentially empty option data returns
 *     `facets: []` (EC-4 at the tool boundary, never a fake/absent crash)
 *   - EC-6: an unpublished/inactive/deleted camp still returns
 *     `{ok:false, code:'not_found'}` with no `facets` field at all (no new
 *     visibility path — computeFacetScores runs only after the existing
 *     isPublished/isActive/deletedAt guard)
 *   - perf/N+1 guard: computeFacetScores is a synchronous, in-memory call on
 *     the already-fetched campSite — no extra DB round-trip is introduced
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindFirst = vi.fn();
const mockGetCampSiteDailyAvailability = vi.fn();
const mockGetEffectiveCapacity = vi.fn();
const mockGetRemainingCapacityForCamps = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

vi.mock('@/lib/campsite-availability', () => ({
  getCampSiteDailyAvailability: (...args: unknown[]) => mockGetCampSiteDailyAvailability(...args),
  getEffectiveCapacity: (...args: unknown[]) => mockGetEffectiveCapacity(...args),
  getRemainingCapacityForCamps: (...args: unknown[]) => mockGetRemainingCapacityForCamps(...args),
}));

const { executeGetCampDetail, getCampDetailTool } = await import('@/lib/ai/tools/get-camp-detail');

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

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
    minimumAge: null,
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

describe('getCampDetail — CAM-464 facets (normal)', () => {
  it('[normal] a camp with TOIL+SHOW+DRIV and no minimum-age restriction returns family/beginner/road_access with non-empty evidence (AC-1 fixture)', async () => {
    mockFindFirst.mockResolvedValueOnce(
      baseCampSite({
        minimumAge: null,
        options: [
          { code: 'TOIL', group: 'Internal facility', nameTh: 'ห้องน้ำ', nameEn: 'Toilet', icon: null },
          { code: 'SHOW', group: 'Internal facility', nameTh: 'ห้องอาบน้ำ', nameEn: 'Shower', icon: null },
          { code: 'DRIV', group: 'Access type', nameTh: 'ขับรถเข้าถึง', nameEn: 'Drive-up', icon: null },
        ],
      })
    );

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.isArray(result.facets)).toBe(true);
    const facetIds = result.facets.map((f) => f.facet).sort();
    expect(facetIds).toEqual(['beginner', 'family', 'road_access']);
    for (const facetScore of result.facets) {
      expect(facetScore.evidence.length).toBeGreaterThanOrEqual(1);
    }

    const family = result.facets.find((f) => f.facet === 'family');
    expect(family?.score).toBe(0.85);
    expect(family?.evidence).toEqual([
      { type: 'field', ref: 'TOIL', effect: 'supports' },
      { type: 'field', ref: 'SHOW', effect: 'supports' },
      { type: 'field', ref: 'DRIV', effect: 'supports' },
      { type: 'field', ref: 'minimumAge', effect: 'supports' },
    ]);

    const roadAccess = result.facets.find((f) => f.facet === 'road_access');
    expect(roadAccess?.score).toBe(0.7);
    expect(roadAccess?.confidence).toBe(0.5); // BR-4 confidence cap — the P13 sedan-honesty rule
    expect(roadAccess?.evidence).toEqual([
      { type: 'field', ref: 'DRIV', effect: 'supports', note: 'vehicle_class_unknown' },
    ]);
  });

  it('[normal] backward-compatible: every pre-existing ok:true field is still present and unchanged alongside the new facets field', async () => {
    mockFindFirst.mockResolvedValueOnce(baseCampSite());

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Pre-existing fields (CAM-427/CAM-449) all still present.
    expect(result).toHaveProperty('amenities');
    expect(result).toHaveProperty('reviews');
    expect(result).toHaveProperty('reviewSummary');
    expect(result).toHaveProperty('price');
    expect(result).toHaveProperty('capacity');
    expect(result).toHaveProperty('cancellationPolicy');
    expect(result).toHaveProperty('availableWeekendDates');
    expect(result).toHaveProperty('weekendAvailability');
    // The new additive field.
    expect(result).toHaveProperty('facets');
    expect(Array.isArray(result.facets)).toBe(true);
  });

  it('[null/empty] a camp with essentially empty option data returns facets: [] (EC-4 at the tool boundary)', async () => {
    mockFindFirst.mockResolvedValueOnce(baseCampSite({ options: [], minimumAge: 9 }));

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.facets).toEqual([]);
  });

  it('[perf] computeFacetScores adds zero extra DB round-trips (still exactly ONE getCampSiteDailyAvailability + ONE getEffectiveCapacity call)', async () => {
    mockFindFirst.mockResolvedValueOnce(baseCampSite());
    await executeGetCampDetail({ campSiteId: VALID_UUID });

    expect(mockGetCampSiteDailyAvailability).toHaveBeenCalledTimes(1);
    expect(mockGetEffectiveCapacity).toHaveBeenCalledTimes(1);
  });
});

describe('getCampDetail — CAM-464 EC-6 (no new visibility path)', () => {
  it('[null/empty] an unpublished/inactive/deleted camp still returns {ok:false} with no facets field at all', async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });

    expect(result).toEqual({ ok: false, code: 'not_found' });
    expect((result as { facets?: unknown }).facets).toBeUndefined();
  });
});

describe('getCampDetailTool — description names the facet honesty rule', () => {
  it('[normal] the tool description mentions the facets + the road_access sedan-honesty caveat', () => {
    expect(getCampDetailTool.description).toMatch(/facet/i);
    expect(getCampDetailTool.description.toLowerCase()).toContain('sedan');
  });
});
