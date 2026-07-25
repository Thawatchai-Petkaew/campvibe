/**
 * cam-516-camper-style.test.ts — CAM-516 (S4)
 *
 * New MasterData group `Camper style` (CHIC/GENR/DIFT/IDMT — a host-declared
 * vibe/style: chic (สายคุณหนู), general, difficult, indomitable/rugged), the
 * SECOND new-group slice added post-launch, mirroring CAM-515 (S3)'s wiring
 * exactly. No schema/migration change (group is a String column, the
 * `options` m2m relation already exists) — this file covers the load-bearing
 * behavioral AC only.
 *
 * Layer: unit (zod schemas + jsonSchema + buildCampSiteWhere, no DB) +
 * integration (executeSearchCampsites with a mocked Prisma findMany — same
 * precedent as __tests__/cam-408-search-campsites-taxonomy-dates.test.ts and
 * __tests__/cam-515-annotated-features.test.ts).
 *
 * Coverage matrix:
 *   - normal: CAMPER_STYLE_CODES (the 4 real seeded codes) is identical
 *     between search-campsites.ts and bulk-availability.ts — each file keeps
 *     its own module-private const (not re-exported, same discipline as
 *     every other taxonomy const in both files), so this is proven
 *     INDIRECTLY via each tool's own jsonSchema.enum + zod safeParse
 *     acceptance/rejection, mirroring cam-408/cam-515's jsonSchema-advertises-
 *     real-codes check.
 *   - normal (AC-1/AC-4): searchCampsitesTool.jsonSchema advertises a
 *     `camperStyle` property whose enum is EXACTLY the 4 codes, with a
 *     Thai-trigger description the model can match against ("สบาย"/"สาย
 *     คุณหนู"->CHIC, "ทั่วไป"->GENR, "ลำบาก"->DIFT, "ทรหด"/"สายลุย"->IDMT).
 *   - normal (AC-1): `executeSearchCampsites({ camperStyle: ... })` reaches
 *     `buildCampSiteWhere` unchanged (integration, mocked Prisma) — both the
 *     single-code string shape and the OR-within-group array shape.
 *   - normal: `buildCampSiteWhere({ camperStyle })` unit-level where-clause
 *     shape: string (AND-per-code, unchanged catalog/host-form/FilterModal
 *     shape) vs array (OR-within-group, CAM-461 Decision 1, the AI-tool-only
 *     shape) vs absent (no filter, no regression).
 *   - error/validation: an unrecognized code fails zod on BOTH tools' arg
 *     schemas before Prisma ever runs (EC-3 class, mirrors CAM-408/CAM-515 BR-3).
 *
 * NOTE — EC-2 (a partial PUT that omits camperStyle must not wipe the
 * relation) is NOT duplicated here: __tests__/cam-365-publish-gate.test.ts
 * already exercises the PUT route's `replacesOptions` guard (a dedicated
 * `camperStyle`-keyed describe block, mirroring the annotatedFeatures one) —
 * this story adds its case to THAT file instead of building a second
 * route-mock harness here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const mockFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { executeSearchCampsites, searchCampsitesArgsSchema, searchCampsitesTool } = await import(
  '@/lib/ai/tools/search-campsites'
);
const { bulkAvailabilityArgsSchema, bulkAvailabilityTool } = await import(
  '@/lib/ai/tools/bulk-availability'
);
const { buildCampSiteWhere } = await import('@/lib/campsite-filters');

/** The 4 real seeded `Camper style` MasterData codes (prisma/seed.ts). */
const CAMPER_STYLE_CODES = ['CHIC', 'GENR', 'DIFT', 'IDMT'] as const;

beforeEach(() => {
  vi.clearAllMocks();
});

/* -------------------------------------------------------------------------- */
/* CAMPER_STYLE_CODES identical across search-campsites.ts and bulk-availability.ts */
/* -------------------------------------------------------------------------- */

describe('CAM-516 — CAMPER_STYLE_CODES identical across search-campsites.ts and bulk-availability.ts', () => {
  it('[unit] searchCampsitesTool.jsonSchema.camperStyle.enum is exactly the 4 real codes', () => {
    const schema = searchCampsitesTool.jsonSchema as {
      properties: { camperStyle: { enum: readonly string[] } };
    };
    expect([...schema.properties.camperStyle.enum].sort()).toEqual([...CAMPER_STYLE_CODES].sort());
  });

  it('[unit] bulkAvailabilityTool.jsonSchema.camperStyle.enum is exactly the SAME 4 codes (kept in sync, no drift between the two tool files)', () => {
    const schema = bulkAvailabilityTool.jsonSchema as {
      properties: { camperStyle: { enum: readonly string[] } };
    };
    expect([...schema.properties.camperStyle.enum].sort()).toEqual([...CAMPER_STYLE_CODES].sort());
  });

  it.each(CAMPER_STYLE_CODES)('[unit] searchCampsitesArgsSchema accepts camperStyle:"%s"', (code) => {
    expect(searchCampsitesArgsSchema.safeParse({ camperStyle: code }).success).toBe(true);
  });

  it.each(CAMPER_STYLE_CODES)('[unit] bulkAvailabilityArgsSchema accepts camperStyle:"%s"', (code) => {
    expect(
      bulkAvailabilityArgsSchema.safeParse({
        camperStyle: code,
        dates: [{ startDate: '2026-08-01', endDate: '2026-08-02' }],
      }).success
    ).toBe(true);
  });

  it('[unit][error/validation] an unrecognized code fails zod on BOTH tools before Prisma ever runs (EC-3 class, mirrors CAM-408/CAM-515 BR-3)', () => {
    expect(searchCampsitesArgsSchema.safeParse({ camperStyle: 'NOPE' }).success).toBe(false);
    expect(
      bulkAvailabilityArgsSchema.safeParse({
        camperStyle: 'NOPE',
        dates: [{ startDate: '2026-08-01', endDate: '2026-08-02' }],
      }).success
    ).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* jsonSchema — Thai-trigger description advertised to the model (AC-1/AC-4)  */
/* -------------------------------------------------------------------------- */

describe('searchCampsitesTool — jsonSchema advertises camperStyle with a Thai-trigger description (AC-1/AC-4)', () => {
  it('[unit] description teaches the model the Thai trigger words for each code ("สบาย"/"สายคุณหนู"/"ทั่วไป"/"ลำบาก"/"ทรหด")', () => {
    const schema = searchCampsitesTool.jsonSchema as {
      properties: { camperStyle: { description: string } };
    };
    expect(schema.properties.camperStyle.description).toContain('สบาย');
    expect(schema.properties.camperStyle.description).toContain('สายคุณหนู');
    expect(schema.properties.camperStyle.description).toContain('ทั่วไป');
    expect(schema.properties.camperStyle.description).toContain('ลำบาก');
    expect(schema.properties.camperStyle.description).toContain('ทรหด');
  });
});

/* -------------------------------------------------------------------------- */
/* buildCampSiteWhere — where-clause shape (AC-1)                             */
/* -------------------------------------------------------------------------- */

describe('buildCampSiteWhere({ camperStyle }) — where-clause shape (AC-1)', () => {
  it('[unit] string form: camperStyle:"CHIC" emits { options: { some: { code: "CHIC" } } } (AND-per-code, unchanged catalog/host-form/FilterModal shape)', () => {
    const where = buildCampSiteWhere({ camperStyle: 'CHIC' });
    expect(where.AND).toContainEqual({ options: { some: { code: 'CHIC' } } });
  });

  it('[unit] string CSV form: camperStyle:"CHIC,GENR" emits TWO separate AND-per-code elements', () => {
    const where = buildCampSiteWhere({ camperStyle: 'CHIC,GENR' });
    expect(where.AND).toContainEqual({ options: { some: { code: 'CHIC' } } });
    expect(where.AND).toContainEqual({ options: { some: { code: 'GENR' } } });
  });

  it('[unit] array form (AI-tool path): camperStyle:["CHIC","GENR"] emits ONE code.in element (OR-within-group, CAM-461 Decision 1), never the AND-per-code shape', () => {
    const where = buildCampSiteWhere({ camperStyle: ['CHIC', 'GENR'] });
    expect(where.AND).toContainEqual({ options: { some: { code: { in: ['CHIC', 'GENR'] } } } });
    expect(where.AND).not.toContainEqual({ options: { some: { code: 'CHIC' } } });
  });

  it('[unit][EC] absent camperStyle applies no filter (no regression for every other caller of buildCampSiteWhere)', () => {
    const where = buildCampSiteWhere({ province: 'ระยอง' });
    const and = (where.AND as unknown[]) ?? [];
    expect(and.some((e) => JSON.stringify(e).includes('CHIC'))).toBe(false);
  });

  it('[unit][EC-3] an empty array means "not specified" — no filter, never a zero-match query', () => {
    const where = buildCampSiteWhere({ camperStyle: [] });
    const and = (where.AND as unknown[]) ?? [];
    expect(and.some((e) => JSON.stringify(e).includes('options'))).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* executeSearchCampsites — integration: the arg really reaches Prisma's     */
/* where clause via buildCampSiteWhere (mocked findMany, AC-1)                */
/* -------------------------------------------------------------------------- */

describe('executeSearchCampsites — camperStyle reaches buildCampSiteWhere unchanged (AC-1, integration)', () => {
  it('[integration] camperStyle:"CHIC" (single code, e.g. "ลานสบายสายคุณหนู") reaches buildCampSiteWhere as an AND option filter', async () => {
    mockFindMany.mockResolvedValueOnce([{ id: 'c1' }]);

    const args = searchCampsitesArgsSchema.parse({ camperStyle: 'CHIC' });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { AND?: unknown[] } };
    expect(call.where.AND).toContainEqual({ options: { some: { code: 'CHIC' } } });
  });

  it('[integration] camperStyle:"IDMT" (e.g. "ลานสายลุยทรหด") + petFriendly coexist as separate AND filters', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ camperStyle: 'IDMT', petFriendly: true });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { AND?: unknown[] } };
    expect(call.where.AND).toContainEqual({ options: { some: { code: 'IDMT' } } });
    expect(call.where.AND).toContainEqual({ petFriendly: true });
  });

  it('[integration] camperStyle:["CHIC","GENR"] (two-or-more named in one ask) reaches buildCampSiteWhere as the OR-within-group array shape', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ camperStyle: ['CHIC', 'GENR'] });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { AND?: unknown[] } };
    expect(call.where.AND).toContainEqual({ options: { some: { code: { in: ['CHIC', 'GENR'] } } } });
  });

  it('[integration][error/validation] an unrecognized camperStyle code fails zod — safeParse rejects, executeSearchCampsites never runs, findMany never called', () => {
    const parsed = searchCampsitesArgsSchema.safeParse({ camperStyle: 'NOPE' });
    expect(parsed.success).toBe(false);
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});
