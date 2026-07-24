/**
 * CAM-461 Decision 2/3/4, BR-1/BR-2/BR-4 — lib/ai/tools/search-campsites.ts
 * excludeIds + sort + backward-compatible zod widening.
 *
 * Coverage matrix:
 *   - normal: absent `sort` → findMany orderBy defaults to orderByFor('related')
 *     (BR-2 default, makes the previously order-unspecified query deterministic)
 *   - normal: sort:'price_asc'/'price_desc'/'rating' → orderBy maps to the
 *     SAME orderByFor(sort) the catalog uses (ADR-009, no forked sort)
 *   - error/validation: an unrecognized sort value fails zod before any query
 *     (EC-2) — findMany never runs
 *   - normal/BR-1: excludeIds passed through to buildCampSiteWhere as
 *     where.id.notIn (proved via the real buildCampSiteWhere, not mocked)
 *   - boundary/EC-1: excludeIds over MAX_EXCLUDE_IDS (50) is sliced to the
 *     first 50 BEFORE the query — never fails the search
 *   - null/empty: a non-matching/garbage id in excludeIds is accepted by zod
 *     (no .uuid()) — graceful, never invalid_args
 *   - normal/BR-4: a today-shaped call (single-string facets, no sort/excludeIds)
 *     still validates byte-identically (backward-compat by addition)
 *   - normal: a facet group as an array validates; an unknown code in the
 *     array still fails zod (EC-3)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const {
  executeSearchCampsites,
  searchCampsitesArgsSchema,
  MAX_EXCLUDE_IDS,
} = await import('@/lib/ai/tools/search-campsites');
const { orderByFor } = await import('@/lib/catalog-cursor');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('searchCampsites — sort (CAM-461 BR-2, Decision 3)', () => {
  it('[unit] no sort supplied → findMany called with orderBy: orderByFor(\'related\') (deterministic default)', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({});
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { orderBy: unknown };
    expect(call.orderBy).toEqual(orderByFor('related'));
  });

  it('[unit] sort:"price_asc" → orderBy: orderByFor(\'price_asc\') (cheapest first, ถูกไปแพง)', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ sort: 'price_asc' });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { orderBy: unknown };
    expect(call.orderBy).toEqual(orderByFor('price_asc'));
  });

  it('[unit] sort:"price_desc" → orderBy: orderByFor(\'price_desc\')', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ sort: 'price_desc' });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { orderBy: unknown };
    expect(call.orderBy).toEqual(orderByFor('price_desc'));
  });

  it('[unit] sort:"rating" → orderBy: orderByFor(\'rating\') (best-reviewed first, รีวิวดีสุด)', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ sort: 'rating' });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { orderBy: unknown };
    expect(call.orderBy).toEqual(orderByFor('rating'));
  });

  it('[error/validation][EC-2] an unrecognized sort value fails zod — findMany never runs', () => {
    const parsed = searchCampsitesArgsSchema.safeParse({ sort: 'cheapest' });
    expect(parsed.success).toBe(false);
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe('searchCampsites — excludeIds (CAM-461 BR-1, Decision 2)', () => {
  it('[unit] excludeIds reaches buildCampSiteWhere as where.id.notIn (real where-builder, not mocked)', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ excludeIds: ['c1', 'c2'] });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { id?: { notIn: string[] } } };
    expect(call.where.id).toEqual({ notIn: ['c1', 'c2'] });
  });

  it('[boundary][EC-1] excludeIds over MAX_EXCLUDE_IDS (50) is sliced to the first 50 BEFORE the query, never fails', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const manyIds = Array.from({ length: 75 }, (_, i) => `c${i}`);
    const args = searchCampsitesArgsSchema.parse({ excludeIds: manyIds });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { id?: { notIn: string[] } } };
    expect(call.where.id?.notIn).toHaveLength(MAX_EXCLUDE_IDS);
    expect(call.where.id?.notIn).toEqual(manyIds.slice(0, MAX_EXCLUDE_IDS));
  });

  it('[null/empty] excludeIds absent leaves where.id untouched (no exclusion, unchanged behavior)', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({});
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { id?: unknown } };
    expect(call.where.id).toBeUndefined();
  });

  it('[unit] a non-UUID/garbage id in excludeIds is still accepted by zod (no .uuid()) — graceful under-exclude, never invalid_args', () => {
    const parsed = searchCampsitesArgsSchema.safeParse({ excludeIds: ['not-a-real-uuid', 'also garbage!!'] });
    expect(parsed.success).toBe(true);
  });

  it('[unit] excludeIds:[] (empty) parses and leaves where.id untouched', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ excludeIds: [] });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { id?: unknown } };
    expect(call.where.id).toBeUndefined();
  });
});

describe('searchCampsites — zod backward-compatible by addition (CAM-461 BR-4, Decision 4)', () => {
  it('[unit] a today-shaped call (single-string facets, no sort/excludeIds) still validates byte-identically', () => {
    const parsed = searchCampsitesArgsSchema.safeParse({
      province: 'ระยอง',
      terrain: 'RIVE',
      access: 'DRIV',
      activities: 'SWIM',
      facilities: 'WIFI',
      priceMax: 1500,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.terrain).toBe('RIVE');
    expect(parsed.data.sort).toBeUndefined();
    expect(parsed.data.excludeIds).toBeUndefined();
  });

  it('[unit] a facet group passed as an array validates (OR-within-group intent)', () => {
    const parsed = searchCampsitesArgsSchema.safeParse({ terrain: ['RIVE', 'BEAC'] });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.terrain).toEqual(['RIVE', 'BEAC']);
  });

  it('[error/validation][EC-3] an unknown code inside a facet ARRAY still fails zod — invalid_args, no query', () => {
    const parsed = searchCampsitesArgsSchema.safeParse({ terrain: ['RIVE', 'NOPE'] });
    expect(parsed.success).toBe(false);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('[unit] excludeIds + sort + a facet array combine on ONE call (BR-4 — independent and additive)', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({
      terrain: ['RIVE', 'BEAC'],
      sort: 'price_asc',
      excludeIds: ['shown-1', 'shown-2'],
    });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as {
      where: { AND?: unknown[]; id?: { notIn: string[] } };
      orderBy: unknown;
    };
    expect(call.where.AND).toContainEqual({ options: { some: { code: { in: ['RIVE', 'BEAC'] } } } });
    expect(call.where.id).toEqual({ notIn: ['shown-1', 'shown-2'] });
    expect(call.orderBy).toEqual(orderByFor('price_asc'));
  });
});
