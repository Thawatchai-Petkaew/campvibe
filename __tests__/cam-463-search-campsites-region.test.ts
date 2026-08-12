/**
 * CAM-463 Decision 2, AC-1/AC-2/AC-3/AC-4/AC-5/AC-6 — lib/ai/tools/search-campsites.ts
 * `region` arg wiring: server-side expansion via `resolveRegionForSearch`,
 * BR-3 province-wins-over-region precedence, and the honest-empty fallback.
 *
 * Coverage matrix:
 *   - normal: `region` only → `where.location.province = { in: [...] }` with
 *     the exact resolved province set (AC-1/AC-2)
 *   - normal: province-only (no region) → the CAM-404 single-province path
 *     runs unchanged (AC-3 regression)
 *   - concurrent/ordering: BOTH province and region present → province wins,
 *     region is dropped, never AND-ed/intersected (AC-4/BR-3)
 *   - null/empty: a recognized-but-empty-of-camps region and an unrecognized
 *     word both return `{ cards: [] }` — the honest fallback (AC-5/AC-6)
 *   - error: `resolveRegionForSearch` never throws even on a nonsense arg
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindMany = vi.fn();
const mockAdminAreaFindFirst = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    adminArea: {
      findFirst: (...args: unknown[]) => mockAdminAreaFindFirst(...args),
    },
  },
}));

const { executeSearchCampsites, searchCampsitesArgsSchema } = await import('@/lib/ai/tools/search-campsites');
const { REGION_TO_PROVINCES } = await import('@/lib/thai-regions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('searchCampsites — region arg expands to the province set (CAM-463 AC-1)', () => {
  it('[unit] region:"ภาคเหนือ" only → where.location.province = { in: [<9 NORTH names>] }', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ region: 'ภาคเหนือ' });
    await executeSearchCampsites(args);

    // resolveRegionForSearch is pure — no DB round-trip for the region step
    expect(mockAdminAreaFindFirst).not.toHaveBeenCalled();

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: unknown } } };
    expect(queryCall.where.location?.province).toEqual({ in: [...REGION_TO_PROVINCES.NORTH] });
  });
});

describe('searchCampsites — colloquial region alias (CAM-463 AC-2)', () => {
  it('[unit] region:"อีสาน" resolves to the same province set as region:"ภาคตะวันออกเฉียงเหนือ"', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const argsAlias = searchCampsitesArgsSchema.parse({ region: 'อีสาน' });
    await executeSearchCampsites(argsAlias);
    const aliasCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: unknown } } };

    mockFindMany.mockResolvedValueOnce([]);
    const argsFormal = searchCampsitesArgsSchema.parse({ region: 'ภาคตะวันออกเฉียงเหนือ' });
    await executeSearchCampsites(argsFormal);
    const formalCall = mockFindMany.mock.calls[1][0] as { where: { location?: { province?: unknown } } };

    expect(aliasCall.where.location?.province).toEqual(formalCall.where.location?.province);
    expect(aliasCall.where.location?.province).toEqual({ in: [...REGION_TO_PROVINCES.NORTHEAST] });
  });
});

describe('searchCampsites — province-only path unchanged, no region expansion (CAM-463 AC-3 regression)', () => {
  it('[unit] province:"เชียงใหม่" (no region) still produces the CAM-404 single-province equality where', async () => {
    mockAdminAreaFindFirst.mockResolvedValueOnce({ nameEn: 'Chiang Mai' });
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'เชียงใหม่' });
    await executeSearchCampsites(args);

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: unknown } } };
    expect(queryCall.where.location?.province).toBe('Chiang Mai'); // plain equality, not { in: [...] }
  });
});

describe('searchCampsites — province wins over region, never intersected (CAM-463 AC-4/BR-3)', () => {
  it('[unit] province + region BOTH present → the single province wins; region is dropped entirely', async () => {
    mockAdminAreaFindFirst.mockResolvedValueOnce({ nameEn: 'Chiang Mai' });
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'เชียงใหม่', region: 'ภาคเหนือ' });
    await executeSearchCampsites(args);

    // region resolution never runs when province is present (province consulted first)
    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: unknown } } };
    expect(queryCall.where.location?.province).toBe('Chiang Mai');
    expect(queryCall.where.location?.province).not.toEqual({ in: expect.any(Array) });
  });
});

describe('searchCampsites — honest empty (CAM-463 AC-5/AC-6)', () => {
  it('[unit][null/empty] a recognized region with zero matching camps returns { cards: [] }', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ region: 'ภาคใต้' });
    const result = await executeSearchCampsites(args);

    // CAM-709 — supersedes the pre-CAM-709 `{ cards: [] }` shape (additive
    // `appliedFilters` echo, api.md rule 12); the raw camper-supplied region
    // still echoes (BR-1 — it constrained the query, asserted below).
    expect(result).toEqual({ cards: [], appliedFilters: { region: 'ภาคใต้', taxonomy: [] } });
    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: unknown } } };
    expect(queryCall.where.location?.province).toEqual({ in: [...REGION_TO_PROVINCES.SOUTH] });
  });

  it('[unit][error] an unrecognized region word never throws and yields 0 rows via raw-passthrough equality', async () => {
    mockAdminAreaFindFirst.mockResolvedValueOnce(null); // not reached (region path is pure), guard anyway
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ region: 'ภาคสวรรค์' });
    // CAM-709 — supersedes the pre-CAM-709 `{ cards: [] }` shape (additive
    // `appliedFilters` echo, api.md rule 12); the raw camper-supplied region
    // still echoes even though it resolved to zero real provinces (BR-1 —
    // it still constrained the query, as the raw-passthrough assertion below
    // proves).
    await expect(executeSearchCampsites(args)).resolves.toEqual({
      cards: [],
      appliedFilters: { region: 'ภาคสวรรค์', taxonomy: [] },
    });

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: unknown } } };
    // raw value passed through as a single-province equality — matches no real camp
    expect(queryCall.where.location?.province).toBe('ภาคสวรรค์');
  });
});

describe('searchCampsites — jsonSchema advertises the region arg (CAM-463 Decision 2)', () => {
  it('[unit] jsonSchema.properties.region exists and additionalProperties stays false', async () => {
    const { searchCampsitesTool } = await import('@/lib/ai/tools/search-campsites');
    const schema = searchCampsitesTool.jsonSchema as { properties: Record<string, unknown>; additionalProperties: boolean };
    expect(schema.properties.region).toBeDefined();
    expect(schema.additionalProperties).toBe(false);
  });
});
