/**
 * cam-473-compare-camps.test.ts — CAM-473 `compareCamps` tool (tech.md
 * Decisions 1-6, story.md AC-1..AC-6/BR-1..BR-7/EC-1..EC-6).
 *
 * `@/lib/prisma` (campSite.findMany), `@/lib/campsite-availability`
 * (getEffectiveCapacity), and `@/lib/facet-scores` (computeFacetScores) are
 * FULLY mocked (mirrors `__tests__/cam-465-bulk-availability.test.ts`'s
 * pattern) so this file can assert call-count/call-shape precisely (cap
 * checked BEFORE any DB read, capacity computed only when requested) and
 * control per-camp facet/capacity results directly. `distanceFromBangkokKm`
 * (lib/geo/distance.ts) is left REAL — it is a pure haversine function with
 * its own coverage in cam-449's test file.
 *
 * Coverage matrix:
 *   - boundary: <2 unique ids -> too_few, ZERO Prisma calls
 *   - boundary: >MAX_COMPARE_CAMPS unique ids -> too_many, ZERO Prisma calls
 *   - boundary: exactly at the cap (4 unique) -> NOT refused
 *   - normal: de-dup runs BEFORE the count (same id twice -> counted once;
 *     a duplicate mixed with a 2nd id proceeds with only the deduped ids)
 *   - normal: default criteria set applied when `criteria` is omitted/empty
 *   - normal: price cells are atomic (never a merged string)
 *   - normal: capacity cell is the EFFECTIVE capacity (getEffectiveCapacity),
 *     not the raw column — a per-spot camp shows a REAL number, not no-data
 *   - normal: capacity is NOT computed when `capacity` is not requested
 *   - normal: family compare returns BOTH camps' facet score + non-empty evidence
 *   - null/empty: an absent facet / null cancellation policy -> explicit
 *     honest no-data cell (`null`), never fabricated
 *   - security: an unpublished/gated-out id is silently EXCLUDED from the
 *     matrix (no per-id "dropped" list, no existence oracle)
 *   - security: dropping below 2 visible -> insufficient_visible (aggregate,
 *     no per-id list)
 *   - security: the select carries zero operator/contact/payout/KYC field
 *   - security: the `where` carries the CAM-469 visibility gate verbatim
 *   - normal: `camps` is ordered by the INPUT ids, not the DB return order
 *   - normal: NO winner/rank/best field anywhere in the result shape (P13)
 *   - error: a thrown live read -> { ok:false, reason:'error' }, never a
 *     fabricated comparison
 *   - normal: tool registration shape (tier guest, name compareCamps) + the
 *     registered execute() wrapper actually dispatches
 *
 * Added by independent QA verify (gap-fill, all Prove-It'd):
 *   - error/validation: a malformed (non-uuid) campId is rejected by zod
 *     (BR-1 per-id uuid guard) — no test previously exercised this branch
 *   - concurrent/ordering: EC-5/AC-6 determinism — the SAME campIds+criteria
 *     against unchanged source rows returns byte-identical matrix data
 *     across two independent calls (no drift)
 *   - null/empty: `facilities` cell — the analyst value-mapping row (tech.md
 *     Decision 3 table) was untested: a populated amenity list is atomic,
 *     and an EMPTY options list is the honest no-data cell, never fabricated
 *   - null/empty: `capacity` cell when `getEffectiveCapacity` itself resolves
 *     null (host never set a value) -> honest null cell, not a crash/0
 *   - normal: `verified` cell surfaces `true` (only the `false` default was
 *     exercised elsewhere)
 *   - normal: `beginner`/`road_access` facet cells each map to their OWN facet
 *     (only `family` was exercised elsewhere — closes a branch-coverage gap)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CriterionId } from '@/lib/ai/tools/compare-camps';

const mockFindMany = vi.fn();
const mockGetEffectiveCapacity = vi.fn();
const mockComputeFacetScores = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('@/lib/campsite-availability', () => ({
  getEffectiveCapacity: (...args: unknown[]) => mockGetEffectiveCapacity(...args),
}));

vi.mock('@/lib/facet-scores', () => ({
  computeFacetScores: (...args: unknown[]) => mockComputeFacetScores(...args),
}));

const {
  executeCompareCamps,
  compareCampsArgsSchema,
  compareCampsTool,
  MAX_COMPARE_CAMPS,
  DEFAULT_COMPARE_CRITERIA,
} = await import('@/lib/ai/tools/compare-camps');

const CAMP_1 = '11111111-1111-4111-8111-111111111111';
const CAMP_2 = '22222222-2222-4222-8222-222222222222';
const CAMP_3 = '33333333-3333-4333-8333-333333333333';
const CAMP_4 = '44444444-4444-4444-8444-444444444444';
const CAMP_5 = '55555555-5555-4555-8555-555555555555';

function decimal(n: number) {
  return { toNumber: () => n };
}

function row(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    nameTh: `ลาน ${id.slice(0, 1)}`,
    nameEn: null,
    priceLow: decimal(800),
    priceHigh: decimal(1200),
    priceCurrency: 'THB',
    isFree: false,
    extraFeeAmount: null,
    extraFeeLabel: null,
    feeInfo: null,
    useSpotView: false,
    maxGuestsPerDay: 10,
    maxTentsPerDay: 5,
    avgRating: null,
    reviewCount: 0,
    isVerified: false,
    cancellationPolicy: null,
    latitude: null,
    longitude: null,
    minimumAge: null,
    options: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetEffectiveCapacity.mockResolvedValue({ maxGuestsPerDay: 10, maxTentsPerDay: 5 });
  mockComputeFacetScores.mockReturnValue([]);
});

describe('compareCamps — cap enforcement + de-dup (Decision 4, CAM-344)', () => {
  it('[boundary] fewer than 2 unique ids -> too_few, ZERO Prisma calls', async () => {
    const result = await executeCompareCamps({ campIds: [CAMP_1] });

    expect(result).toEqual({ ok: false, reason: 'too_few' });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('[normal] de-dup runs BEFORE the count: the same id repeated is 1 unique id -> too_few', async () => {
    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_1, CAMP_1] });

    expect(result).toEqual({ ok: false, reason: 'too_few' });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('[boundary] more than MAX_COMPARE_CAMPS unique ids -> too_many, ZERO Prisma calls', async () => {
    const ids = [CAMP_1, CAMP_2, CAMP_3, CAMP_4, CAMP_5];
    expect(ids.length).toBeGreaterThan(MAX_COMPARE_CAMPS);

    const result = await executeCompareCamps({ campIds: ids });

    expect(result).toEqual({ ok: false, reason: 'too_many' });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('[boundary] exactly AT the cap (4 unique ids) -> NOT refused, proceeds to the read', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1), row(CAMP_2), row(CAMP_3), row(CAMP_4)]);

    const result = await executeCompareCamps({
      campIds: [CAMP_1, CAMP_2, CAMP_3, CAMP_4],
      criteria: ['price'],
    });

    expect(result.ok).toBe(true);
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });

  it('[normal] a duplicate mixed with a distinct id de-dupes to the unique set BEFORE the query (never counted 3)', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1), row(CAMP_2)]);

    const result = await executeCompareCamps({
      campIds: [CAMP_1, CAMP_1, CAMP_2],
      criteria: ['price'],
    });

    expect(result.ok).toBe(true);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: [CAMP_1, CAMP_2] } }) })
    );
  });
});

describe('compareCamps — criteria (Decision 2, BR-4)', () => {
  it('[normal] omitted criteria -> the DEFAULT_COMPARE_CRITERIA set is used', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1), row(CAMP_2)]);

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.criteria).toEqual(DEFAULT_COMPARE_CRITERIA);
    expect(Object.keys(result.camps[0].cells).sort()).toEqual([...DEFAULT_COMPARE_CRITERIA].sort());
  });

  it('[normal] an empty criteria array is treated the same as omitted (default set)', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1), row(CAMP_2)]);

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: [] });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.criteria).toEqual(DEFAULT_COMPARE_CRITERIA);
  });

  it('[error/validation] an unknown criterion is rejected by zod (invalid_args, no read)', () => {
    const parsed = compareCampsArgsSchema.safeParse({ campIds: [CAMP_1, CAMP_2], criteria: ['not_a_real_criterion'] });
    expect(parsed.success).toBe(false);
  });
});

describe('compareCamps — price cells (atomic, api.md rule 4)', () => {
  it('[normal] price cell exposes atomic startingPrice/priceHigh/currency/fee fields — never a merged string', async () => {
    mockFindMany.mockResolvedValueOnce([
      row(CAMP_1, { priceLow: decimal(500), priceHigh: decimal(900), extraFeeAmount: decimal(50), extraFeeLabel: 'ค่าเข้าอุทยาน' }),
      row(CAMP_2),
    ]);

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['price'] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.camps[0].cells.price).toEqual({
      startingPrice: 500,
      priceHigh: 900,
      currency: 'THB',
      isFree: false,
      extraFeeAmount: 50,
      extraFeeLabel: 'ค่าเข้าอุทยาน',
      feeInfo: null,
    });
  });

  it('[null/empty] no price set -> startingPrice null (an honest no-data cell, not a fabricated value)', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1, { priceLow: null, priceHigh: null }), row(CAMP_2)]);

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['price'] });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.camps[0].cells.price?.startingPrice).toBeNull();
  });
});

describe('compareCamps — capacity cell (Decision 1 capacity sub-decision, CAM-355/CAM-400 fork)', () => {
  it('[normal] a PER-SPOT camp (useSpotView=true, raw column null) shows the EFFECTIVE (spot-summed) capacity — a real number, not no-data', async () => {
    mockFindMany.mockResolvedValueOnce([
      row(CAMP_1, { useSpotView: true, maxGuestsPerDay: null, maxTentsPerDay: null }),
      row(CAMP_2),
    ]);
    mockGetEffectiveCapacity.mockImplementation((_client: unknown, campSite: { id: string }) =>
      Promise.resolve(
        campSite.id === CAMP_1 ? { maxGuestsPerDay: 24, maxTentsPerDay: 12 } : { maxGuestsPerDay: 10, maxTentsPerDay: 5 }
      )
    );

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['capacity'] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The raw column was null; the EFFECTIVE read must still surface a real number.
    expect(result.camps[0].cells.capacity).toEqual({ maxGuestsPerDay: 24, maxTentsPerDay: 12 });
    expect(mockGetEffectiveCapacity).toHaveBeenCalledTimes(2);
  });

  it('[normal] getEffectiveCapacity is NOT called when `capacity` is not among the requested criteria', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1), row(CAMP_2)]);

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['price'] });

    expect(result.ok).toBe(true);
    expect(mockGetEffectiveCapacity).not.toHaveBeenCalled();
  });
});

describe('compareCamps — family/facet cells (CAM-464 reuse, AC-1)', () => {
  it('[normal] a family compare returns BOTH camps’ facet score + non-empty evidence', async () => {
    mockFindMany.mockResolvedValueOnce([
      row(CAMP_1, { options: [{ code: 'TOIL', group: 'Internal facility', nameTh: '', nameEn: '', icon: null }] }),
      row(CAMP_2, { options: [{ code: 'SHOW', group: 'Internal facility', nameTh: '', nameEn: '', icon: null }] }),
    ]);
    mockComputeFacetScores.mockReturnValue([
      {
        facet: 'family',
        score: 0.85,
        confidence: 0.8,
        answerable: true,
        evidence: [{ type: 'field', ref: 'TOIL', effect: 'supports' }],
        source: 'rules',
      },
    ]);

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['family'] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const camp of result.camps) {
      expect(camp.cells.family).not.toBeNull();
      expect(camp.cells.family?.evidence.length).toBeGreaterThanOrEqual(1);
    }
    expect(mockComputeFacetScores).toHaveBeenCalledTimes(2);
  });

  it('[null/empty] a facet computeFacetScores did not produce -> explicit honest null cell, never a fake 0-score', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1), row(CAMP_2)]);
    mockComputeFacetScores.mockReturnValue([]); // no evidence produced for 'family' at all

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['family'] });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.camps[0].cells.family).toBeNull();
  });

  it('[normal] computeFacetScores is NOT called when no facet criterion is requested', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1), row(CAMP_2)]);

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['price', 'verified'] });

    expect(result.ok).toBe(true);
    expect(mockComputeFacetScores).not.toHaveBeenCalled();
  });
});

describe('compareCamps — no-data cells (EC-4)', () => {
  it('[null/empty] no cancellation policy set -> honest null policy cell', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1, { cancellationPolicy: null }), row(CAMP_2)]);

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['cancellation_policy'] });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.camps[0].cells.cancellation_policy).toEqual({ policy: null });
  });

  it('[null/empty] no rating yet -> avgRating null, reviewCount 0 (never fabricated)', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1, { avgRating: null, reviewCount: 0 }), row(CAMP_2)]);

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['rating'] });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.camps[0].cells.rating).toEqual({ avgRating: null, reviewCount: 0 });
  });

  it('[null/empty] missing lat/lng -> distance cell is null, never treated as 0km', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1, { latitude: null, longitude: null }), row(CAMP_2)]);

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['distance'] });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.camps[0].cells.distance).toEqual({ distanceFromBangkokKm: null });
  });
});

describe('compareCamps — visibility gate inheritance (Decision 1, CAM-469, security)', () => {
  it('[security] an unpublished/gated-out id is silently EXCLUDED from the matrix — no per-id "dropped" list, no existence oracle', async () => {
    // 3 ids requested; the DB read simulates CAMP_3 failing the visibility gate.
    mockFindMany.mockResolvedValueOnce([row(CAMP_1), row(CAMP_2)]);

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2, CAMP_3], criteria: ['price'] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.camps).toHaveLength(2);
    expect(result.camps.map((c) => c.id)).toEqual([CAMP_1, CAMP_2]);
    const json = JSON.stringify(result);
    expect(json).not.toContain(CAMP_3);
  });

  it('[security] dropping below 2 visible -> insufficient_visible (aggregate refuse, no per-id list)', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1)]); // CAMP_2 gated out

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['price'] });

    expect(result).toEqual({ ok: false, reason: 'insufficient_visible' });
  });

  it('[security] the `where` carries the CAM-469 gate verbatim (isActive/isPublished/deletedAt)', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1), row(CAMP_2)]);

    await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['price'] });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [CAMP_1, CAMP_2] }, isActive: true, isPublished: true, deletedAt: null },
      })
    );
  });

  it('[security] the select carries zero operator/contact/payout/KYC field (guest-safe regression)', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1), row(CAMP_2)]);

    await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['price'] });

    const callArgs = mockFindMany.mock.calls[0][0] as { select: Record<string, unknown> };
    const selectKeys = Object.keys(callArgs.select);
    const forbidden = [
      'phone', 'lineId', 'facebookUrl', 'facebookMessageUrl', 'tiktokUrl',
      'address', 'directions', 'operator', 'operatorId', 'partner',
    ];
    for (const key of forbidden) {
      expect(selectKeys).not.toContain(key);
    }
  });
});

describe('compareCamps — ordering (camp ordinals must line up with the input, BR-6)', () => {
  it('[normal] `camps` is ordered by the INPUT ids, not the DB return order', async () => {
    // DB returns CAMP_1 before CAMP_2, but the camper's input order is reversed.
    mockFindMany.mockResolvedValueOnce([row(CAMP_1), row(CAMP_2)]);

    const result = await executeCompareCamps({ campIds: [CAMP_2, CAMP_1], criteria: ['price'] });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.camps.map((c) => c.id)).toEqual([CAMP_2, CAMP_1]);
  });
});

describe('compareCamps — no winner/rank/best field anywhere (Decision 3, P13 honesty, BR-5)', () => {
  it('[normal] the full result (every default criterion) never carries a winner/rank/best key', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1), row(CAMP_2)]);
    mockGetEffectiveCapacity.mockResolvedValue({ maxGuestsPerDay: 10, maxTentsPerDay: 5 });
    mockComputeFacetScores.mockReturnValue([
      { facet: 'family', score: 0.5, confidence: 0.4, answerable: true, evidence: [{ type: 'field', ref: 'TOIL', effect: 'supports' }], source: 'rules' },
    ]);

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2] }); // default criteria set

    expect(result.ok).toBe(true);
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/winner|"rank"|"best"/i);
  });
});

describe('compareCamps — error path (never fabricate a comparison, BR-6-style honesty)', () => {
  it('[error] a thrown live read -> { ok:false, reason:"error" }', async () => {
    mockFindMany.mockRejectedValueOnce(new Error('db unavailable'));

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['price'] });

    expect(result).toEqual({ ok: false, reason: 'error' });
  });
});

describe('compareCamps — tool registration (BR-1, Decision 5)', () => {
  it('[normal] guest-tier, read-only, name "compareCamps"', () => {
    expect(compareCampsTool.name).toBe('compareCamps');
    expect(compareCampsTool.tier).toBe('guest');
  });

  it('[normal] the registered execute() wrapper actually dispatches to executeCompareCamps (wiring)', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1), row(CAMP_2)]);

    const args = compareCampsArgsSchema.parse({ campIds: [CAMP_1, CAMP_2], criteria: ['price'] });
    const result = await compareCampsTool.execute(args, {});

    expect(result.ok).toBe(true);
  });
});

describe('compareCamps — QA gap-fill: input validation (BR-1 per-id uuid guard)', () => {
  it('[error/validation] a malformed (non-uuid) campId is rejected by zod, no read', () => {
    const parsed = compareCampsArgsSchema.safeParse({ campIds: ['not-a-uuid', CAMP_2] });
    expect(parsed.success).toBe(false);
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe('compareCamps — QA gap-fill: determinism (EC-5/AC-6)', () => {
  it('[concurrent/ordering] the SAME campIds + criteria over unchanged source rows returns identical matrix data across two calls', async () => {
    const rows = [row(CAMP_1, { avgRating: decimal(4.5) }), row(CAMP_2)];
    mockFindMany.mockResolvedValueOnce(rows).mockResolvedValueOnce(rows);
    mockComputeFacetScores.mockReturnValue([
      { facet: 'family', score: 0.7, confidence: 0.6, answerable: true, evidence: [{ type: 'field', ref: 'TOIL', effect: 'supports' }], source: 'rules' },
    ]);

    const args = { campIds: [CAMP_1, CAMP_2], criteria: ['price', 'family', 'rating'] as CriterionId[] };
    const first = await executeCompareCamps(args);
    const second = await executeCompareCamps(args);

    expect(first).toEqual(second);
  });
});

describe('compareCamps — QA gap-fill: facilities cell (untested analyst value-mapping row)', () => {
  it('[normal] a populated options list -> an atomic amenities list (code/group/nameTh/nameEn/icon), never a merged string', async () => {
    mockFindMany.mockResolvedValueOnce([
      row(CAMP_1, { options: [{ code: 'TOIL', group: 'Internal facility', nameTh: 'ห้องน้ำ', nameEn: 'Toilet', icon: 'toilet' }] }),
      row(CAMP_2),
    ]);

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['facilities'] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.camps[0].cells.facilities).toEqual({
      amenities: [{ code: 'TOIL', group: 'Internal facility', nameTh: 'ห้องน้ำ', nameEn: 'Toilet', icon: 'toilet' }],
    });
  });

  it('[null/empty] no amenities set -> an empty list, the honest no-data cell (never fabricated)', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1, { options: [] }), row(CAMP_2)]);

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['facilities'] });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.camps[0].cells.facilities).toEqual({ amenities: [] });
  });
});

describe('compareCamps — QA gap-fill: capacity no-data + verified true (untested branches)', () => {
  it('[null/empty] getEffectiveCapacity itself resolves null values (host never set a capacity) -> honest null cell, not a crash/0', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1), row(CAMP_2)]);
    mockGetEffectiveCapacity.mockResolvedValue({ maxGuestsPerDay: null, maxTentsPerDay: null });

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['capacity'] });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.camps[0].cells.capacity).toEqual({ maxGuestsPerDay: null, maxTentsPerDay: null });
  });

  it('[normal] verified cell surfaces true (only false was exercised elsewhere)', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1, { isVerified: true }), row(CAMP_2)]);

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['verified'] });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.camps[0].cells.verified).toEqual({ isVerified: true });
  });
});

describe('compareCamps — QA gap-fill: beginner/road_access facet cells (branch coverage, mirrors family)', () => {
  it('[normal] beginner and road_access each map to their OWN facet from computeFacetScores — never cross-wired', async () => {
    mockFindMany.mockResolvedValueOnce([row(CAMP_1), row(CAMP_2)]);
    mockComputeFacetScores.mockReturnValue([
      { facet: 'beginner', score: 0.6, confidence: 0.5, answerable: true, evidence: [{ type: 'field', ref: 'TOIL', effect: 'supports' }], source: 'rules' },
      { facet: 'road_access', score: 0.7, confidence: 0.5, answerable: true, evidence: [{ type: 'field', ref: 'PAVED', effect: 'supports' }], source: 'rules' },
    ]);

    const result = await executeCompareCamps({ campIds: [CAMP_1, CAMP_2], criteria: ['beginner', 'road_access'] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.camps[0].cells.beginner?.facet).toBe('beginner');
    expect(result.camps[0].cells.road_access?.facet).toBe('road_access');
  });
});
