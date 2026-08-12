/**
 * cam-709-search-campsites-applied-filters.test.ts — CAM-709
 *
 * "The assistant says why these camps were chosen, from the filters it
 * really applied." Full spec:
 * docs/specs/ai-assistant/in-chat-booking-completion/CAM-709-why-these-camps/story.md
 *
 * Pins `executeSearchCampsites`'s new `appliedFilters` echo on
 * `SearchCampsitesResult` (BR-1/BR-2/BR-3): lists ONLY arguments that
 * actually constrained the query, additive on the result shape, with
 * taxonomy entries Thai-labeled from MasterData.
 *
 * Coverage matrix (qa.md §7):
 *   - normal: price + taxonomy both echo (AC-1), taxonomy labeled in Thai
 *     from MasterData (AC-4), petFriendly echoes only when true (AC-2)
 *   - null/empty: a broad search with no criteria echoes nothing but the
 *     always-present `taxonomy: []` (AC-3)
 *   - boundary: a resolved district+sub-district echoes both; an OR-array
 *     taxonomy code with no MasterData row is omitted, its sibling survives
 *   - dropped-arg (BR-1): `sort` dropped when `near` overrides it; `type`
 *     `'ALL'` never echoes; `province` dropped entirely when `near` also
 *     supplied; an unresolved district/sub-district drops silently
 *   - error/validation (EC-3): a MasterData lookup failure fails open —
 *     taxonomy entries omitted, the search itself still succeeds
 *   - perf: the MasterData label query never fires when no taxonomy arg is
 *     supplied (mirrors deriveMatchedTags' own no-N+1 guard)
 *   - additive: `cards` rides alongside `appliedFilters` unaffected (api.md
 *     rule 12)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCampSiteFindMany = vi.fn();
const mockMasterDataFindMany = vi.fn();
const mockAdminAreaFindFirst = vi.fn();
const mockAdminAreaFindMany = vi.fn();

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
      findMany: (...args: unknown[]) => mockAdminAreaFindMany(...args),
    },
  },
}));

const { executeSearchCampsites, searchCampsitesArgsSchema } = await import('@/lib/ai/tools/search-campsites');

/** The main search query's row shape — minimal, mirrors cam-564's own `mainRow` helper. */
function mainRow(id: string) {
  return { id, reviewCount: 0, location: { province: 'Chiang Mai' }, options: [] };
}

const RIVE = { code: 'RIVE', nameTh: 'แม่น้ำ ลำธาร คลองเล็ก', nameEn: 'River, stream, or creek' };

beforeEach(() => {
  vi.clearAllMocks();
});

/* -------------------------------------------------------------------------- */
/* normal — AC-1/AC-2/AC-4                                                     */
/* -------------------------------------------------------------------------- */

describe('appliedFilters — normal (AC-1/AC-4): taxonomy + price both echo, taxonomy labeled in Thai', () => {
  it('[normal] terrain + priceMax both echo; taxonomy carries {group,code,labelTh} resolved from MasterData', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([mainRow('c1')]); // main search
    mockCampSiteFindMany.mockResolvedValueOnce([{ id: 'c1', options: [RIVE] }]); // deriveMatchedTags
    mockMasterDataFindMany.mockResolvedValueOnce([{ code: RIVE.code, nameTh: RIVE.nameTh }]);

    const args = searchCampsitesArgsSchema.parse({ terrain: 'RIVE', priceMax: 500 });
    const result = await executeSearchCampsites(args);

    expect(result.appliedFilters).toEqual({
      priceMax: 500,
      taxonomy: [{ group: 'terrain', code: 'RIVE', labelTh: RIVE.nameTh }],
    });
    const labelQuery = mockMasterDataFindMany.mock.calls[0][0] as { where: { code: { in: string[] } } };
    expect(labelQuery.where.code.in).toEqual(['RIVE']);
  });
});

describe('appliedFilters — normal (AC-2): petFriendly echoes only when true', () => {
  it('[normal] petFriendly:true echoes as `true`', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ petFriendly: true });
    const result = await executeSearchCampsites(args);
    expect(result.appliedFilters).toEqual({ petFriendly: true, taxonomy: [] });
  });

  it('[boundary][dropped-arg] petFriendly:false never echoes (BR-1 — never constrained the query)', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ petFriendly: false });
    const result = await executeSearchCampsites(args);
    expect(result.appliedFilters).toEqual({ taxonomy: [] });
  });
});

/* -------------------------------------------------------------------------- */
/* null/empty — AC-3 broad search                                              */
/* -------------------------------------------------------------------------- */

describe('appliedFilters — null/empty (AC-3): a broad search echoes nothing', () => {
  it('[null/empty] no criteria supplied at all -> appliedFilters is just { taxonomy: [] }, the empty-search signal', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({});
    const result = await executeSearchCampsites(args);
    expect(result.appliedFilters).toEqual({ taxonomy: [] });
  });
});

/* -------------------------------------------------------------------------- */
/* dropped-arg — BR-1                                                          */
/* -------------------------------------------------------------------------- */

describe('appliedFilters — dropped-arg cases (BR-1: an ignored/overridden arg must not echo)', () => {
  it('[dropped-arg] sort is dropped from the echo when `near` overrides it (the geo path never consults args.sort)', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]); // near candidate query — zero candidates
    const args = searchCampsitesArgsSchema.parse({ near: 'Bangkok', sort: 'price_asc' });
    const result = await executeSearchCampsites(args);
    expect(result.appliedFilters).toEqual({ near: 'Bangkok', taxonomy: [] });
  });

  it('[dropped-arg] sort echoes on the plain (non-near) path when the caller genuinely set it', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ sort: 'price_asc' });
    const result = await executeSearchCampsites(args);
    expect(result.appliedFilters).toEqual({ sort: 'price_asc', taxonomy: [] });
  });

  it('[dropped-arg] sort is absent when the caller never set it — never implies the default "related"', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ keyword: 'ลานทดสอบ' });
    const result = await executeSearchCampsites(args);
    expect(result.appliedFilters.sort).toBeUndefined();
  });

  it('[dropped-arg] type "ALL" never echoes (buildCampSiteWhere treats it as no filter)', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ type: 'ALL' });
    const result = await executeSearchCampsites(args);
    expect(result.appliedFilters).toEqual({ taxonomy: [] });
  });

  it('[dropped-arg] a real type code DOES echo', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ type: 'GLAMP' });
    const result = await executeSearchCampsites(args);
    expect(result.appliedFilters).toEqual({ type: 'GLAMP', taxonomy: [] });
  });

  it('[dropped-arg] province is dropped entirely when `near` also supplied — near wins outright, never both', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ near: 'Bangkok', province: 'Chiang Mai' });
    const result = await executeSearchCampsites(args);
    expect(result.appliedFilters).toEqual({ near: 'Bangkok', taxonomy: [] });
  });

  it('[dropped-arg] an unresolvable district silently drops (never resolved to a real query filter)', async () => {
    mockAdminAreaFindFirst.mockResolvedValueOnce(null);
    mockAdminAreaFindMany.mockResolvedValue([]);
    const args = searchCampsitesArgsSchema.parse({ district: 'ไม่มีอำเภอนี้จริง' });
    const result = await executeSearchCampsites(args);
    expect(result.appliedFilters).toEqual({ taxonomy: [] });
    expect(mockCampSiteFindMany).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* boundary — district + sub-district resolved together                       */
/* -------------------------------------------------------------------------- */

describe('appliedFilters — boundary: a resolved sub-district echoes alongside its scoping district', () => {
  const ADMIN_AREAS = [
    { id: 'dist-1', level: 'DISTRICT', nameEn: 'Mueang Chiang Mai', nameTh: 'เมืองเชียงใหม่', parentId: null as string | null },
    { id: 'sub-1', level: 'SUBDISTRICT', nameEn: 'Suthep', nameTh: 'สุเทพ', parentId: 'dist-1' as string | null },
  ];

  function findFirstImpl({ where }: { where: Record<string, unknown> }) {
    const level = where.level as string;
    const or = where.OR as Array<{ nameTh?: { equals: string }; nameEn?: { equals: string } }> | undefined;
    if (!or) return null;
    const wantedNames = or.map((c) => (c.nameTh ?? c.nameEn)!.equals.toLowerCase());
    const parentId = where.parentId as string | undefined;
    return (
      ADMIN_AREAS.find((a) => {
        if (a.level !== level) return false;
        if (parentId !== undefined && a.parentId !== parentId) return false;
        return wantedNames.includes(a.nameTh.toLowerCase()) || wantedNames.includes(a.nameEn.toLowerCase());
      }) ?? null
    );
  }
  function findManyImpl({ where }: { where: Record<string, unknown> }) {
    const level = where.level as string;
    const parentIdRaw = where.parentId as string | { in: string[] } | undefined;
    return ADMIN_AREAS.filter((a) => {
      if (a.level !== level) return false;
      if (parentIdRaw === undefined) return true;
      if (typeof parentIdRaw === 'object') return parentIdRaw.in.includes(a.parentId ?? '');
      return a.parentId === parentIdRaw;
    });
  }

  it('[boundary] district + subDistrict both resolved -> both echo', async () => {
    mockAdminAreaFindFirst.mockImplementation(async (args) => findFirstImpl(args));
    mockAdminAreaFindMany.mockImplementation(async (args) => findManyImpl(args));
    mockCampSiteFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ district: 'เมืองเชียงใหม่', subDistrict: 'สุเทพ' });
    const result = await executeSearchCampsites(args);

    expect(result.appliedFilters).toEqual({ district: 'เมืองเชียงใหม่', subDistrict: 'สุเทพ', taxonomy: [] });
  });
});

/* -------------------------------------------------------------------------- */
/* error/validation — EC-3 fail-open label lookup                              */
/* -------------------------------------------------------------------------- */

describe('appliedFilters — error/validation (EC-3): a MasterData label failure fails open', () => {
  it('[error/validation] the label lookup throws -> taxonomy entries omitted, the search itself still succeeds', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([mainRow('c1')]);
    mockCampSiteFindMany.mockResolvedValueOnce([{ id: 'c1', options: [] }]); // deriveMatchedTags unaffected
    mockMasterDataFindMany.mockRejectedValueOnce(new Error('connection reset'));

    const args = searchCampsitesArgsSchema.parse({ terrain: 'RIVE' });
    const result = await executeSearchCampsites(args);

    expect(result.appliedFilters).toEqual({ taxonomy: [] });
    expect(result.cards).toHaveLength(1); // the search itself is unaffected
  });

  it('[boundary] an OR-array code with no MasterData row is omitted; its sibling code still echoes', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([mainRow('c1')]);
    mockCampSiteFindMany.mockResolvedValueOnce([{ id: 'c1', options: [RIVE] }]);
    mockMasterDataFindMany.mockResolvedValueOnce([{ code: RIVE.code, nameTh: RIVE.nameTh }]); // BEAC missing

    const args = searchCampsitesArgsSchema.parse({ terrain: ['RIVE', 'BEAC'] });
    const result = await executeSearchCampsites(args);

    expect(result.appliedFilters.taxonomy).toEqual([{ group: 'terrain', code: 'RIVE', labelTh: RIVE.nameTh }]);
  });
});

/* -------------------------------------------------------------------------- */
/* perf — no-N+1 guard                                                         */
/* -------------------------------------------------------------------------- */

describe('appliedFilters — perf: the MasterData label query is skipped when no taxonomy arg is supplied', () => {
  it('[perf] a price-only search never fires the MasterData query at all', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ priceMax: 300 });
    await executeSearchCampsites(args);
    expect(mockMasterDataFindMany).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* additive — api.md rule 12                                                   */
/* -------------------------------------------------------------------------- */

describe('appliedFilters — additive: rides alongside `cards`, never changes its shape (api.md rule 12)', () => {
  it('[normal] cards stay exactly as before; appliedFilters is a new sibling key', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([mainRow('c1')]);
    const args = searchCampsitesArgsSchema.parse({ keyword: 'ลานทดสอบ' });
    const result = await executeSearchCampsites(args);

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].id).toBe('c1');
    expect(result.appliedFilters).toEqual({ keyword: 'ลานทดสอบ', taxonomy: [] });
  });
});
