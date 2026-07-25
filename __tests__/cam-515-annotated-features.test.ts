/**
 * cam-515-annotated-features.test.ts — CAM-515 (S3)
 *
 * New MasterData group `Annotated features` (ALCO/FIRE/FIWD/ADAA/RESV —
 * rules/rights a camp carries: alcohol allowed, fires allowed, firewood,
 * wheelchair-accessible, reservable), the FIRST new-group slice added
 * post-launch (template for S4). No schema/migration change (group is a
 * String column, the `options` m2m relation already exists) — this file
 * covers the load-bearing behavioral AC only.
 *
 * Layer: unit (zod schemas + jsonSchema + buildCampSiteWhere, no DB) +
 * integration (executeSearchCampsites with a mocked Prisma findMany — same
 * precedent as __tests__/cam-408-search-campsites-taxonomy-dates.test.ts).
 *
 * Coverage matrix:
 *   - normal: ANNOTATED_CODES (the 5 real seeded codes) is identical between
 *     search-campsites.ts and bulk-availability.ts — each file keeps its own
 *     module-private const (not re-exported, same discipline as every other
 *     taxonomy const in both files), so this is proven INDIRECTLY via each
 *     tool's own jsonSchema.enum + zod safeParse acceptance/rejection,
 *     mirroring cam-408's jsonSchema-advertises-real-codes check.
 *   - normal (AC-1/AC-4): searchCampsitesTool.jsonSchema advertises an
 *     `annotatedFeatures` property whose enum is EXACTLY the 5 codes, with a
 *     Thai-trigger description the model can match against
 *     ("จิบเบียร์"->ALCO, "ก่อไฟ"->FIRE, "ผู้พิการ"->ADAA, ...).
 *   - normal (AC-1): `executeSearchCampsites({ annotatedFeatures: ... })`
 *     reaches `buildCampSiteWhere` unchanged (integration, mocked Prisma) —
 *     both the single-code string shape and the OR-within-group array shape.
 *   - normal: `buildCampSiteWhere({ annotatedFeatures })` unit-level where-
 *     clause shape: string (AND-per-code, unchanged catalog/host-form/
 *     FilterModal shape) vs array (OR-within-group, CAM-461 Decision 1, the
 *     AI-tool-only shape) vs absent (no filter, no regression).
 *   - error/validation: an unrecognized code fails zod on BOTH tools' arg
 *     schemas before Prisma ever runs (EC-3 class, mirrors CAM-408 BR-3).
 *
 * NOTE — EC-2 (a partial PUT that omits annotatedFeatures must not wipe the
 * relation) is NOT duplicated here: __tests__/cam-365-publish-gate.test.ts
 * already exercises the PUT route's `replacesOptions` guard generically
 * (the `facilities:['WIFI']` / `facilities:[]` cases) via a mocked-Prisma
 * route integration test — this story adds an `annotatedFeatures`-keyed case
 * to THAT file instead of building a second route-mock harness here.
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

/** The 5 real seeded `Annotated features` MasterData codes (prisma/seed.ts). */
const ANNOTATED_CODES = ['ALCO', 'FIRE', 'FIWD', 'ADAA', 'RESV'] as const;

beforeEach(() => {
  vi.clearAllMocks();
});

/* -------------------------------------------------------------------------- */
/* ANNOTATED_CODES identical across both AI tools (indirect — module-private) */
/* -------------------------------------------------------------------------- */

describe('CAM-515 — ANNOTATED_CODES identical across search-campsites.ts and bulk-availability.ts', () => {
  it('[unit] searchCampsitesTool.jsonSchema.annotatedFeatures.enum is exactly the 5 real codes', () => {
    const schema = searchCampsitesTool.jsonSchema as {
      properties: { annotatedFeatures: { enum: readonly string[] } };
    };
    expect([...schema.properties.annotatedFeatures.enum].sort()).toEqual([...ANNOTATED_CODES].sort());
  });

  it('[unit] bulkAvailabilityTool.jsonSchema.annotatedFeatures.enum is exactly the SAME 5 codes (kept in sync, no drift between the two tool files)', () => {
    const schema = bulkAvailabilityTool.jsonSchema as {
      properties: { annotatedFeatures: { enum: readonly string[] } };
    };
    expect([...schema.properties.annotatedFeatures.enum].sort()).toEqual([...ANNOTATED_CODES].sort());
  });

  it.each(ANNOTATED_CODES)('[unit] searchCampsitesArgsSchema accepts annotatedFeatures:"%s"', (code) => {
    expect(searchCampsitesArgsSchema.safeParse({ annotatedFeatures: code }).success).toBe(true);
  });

  it.each(ANNOTATED_CODES)('[unit] bulkAvailabilityArgsSchema accepts annotatedFeatures:"%s"', (code) => {
    expect(
      bulkAvailabilityArgsSchema.safeParse({
        annotatedFeatures: code,
        dates: [{ startDate: '2026-08-01', endDate: '2026-08-02' }],
      }).success
    ).toBe(true);
  });

  it('[unit][error/validation] an unrecognized code fails zod on BOTH tools before Prisma ever runs (EC-3 class, mirrors CAM-408 BR-3)', () => {
    expect(searchCampsitesArgsSchema.safeParse({ annotatedFeatures: 'NOPE' }).success).toBe(false);
    expect(
      bulkAvailabilityArgsSchema.safeParse({
        annotatedFeatures: 'NOPE',
        dates: [{ startDate: '2026-08-01', endDate: '2026-08-02' }],
      }).success
    ).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* jsonSchema — Thai-trigger description advertised to the model (AC-1/AC-4)  */
/* -------------------------------------------------------------------------- */

describe('searchCampsitesTool — jsonSchema advertises annotatedFeatures with a Thai-trigger description (AC-1/AC-4)', () => {
  it('[unit] description teaches the model the Thai trigger words for each code ("ลานจิบเบียร์ได้"/"ลานก่อไฟได้")', () => {
    const schema = searchCampsitesTool.jsonSchema as {
      properties: { annotatedFeatures: { description: string } };
    };
    expect(schema.properties.annotatedFeatures.description).toContain('จิบเบียร์');
    expect(schema.properties.annotatedFeatures.description).toContain('ก่อไฟได้ไหม');
    expect(schema.properties.annotatedFeatures.description).toContain('ฟืน');
    expect(schema.properties.annotatedFeatures.description).toContain('ผู้พิการ');
    expect(schema.properties.annotatedFeatures.description).toContain('จองล่วงหน้าได้ไหม');
  });
});

/* -------------------------------------------------------------------------- */
/* buildCampSiteWhere — where-clause shape (AC-1)                             */
/* -------------------------------------------------------------------------- */

describe('buildCampSiteWhere({ annotatedFeatures }) — where-clause shape (AC-1)', () => {
  it('[unit] string form: annotatedFeatures:"ALCO" emits { options: { some: { code: "ALCO" } } } (AND-per-code, unchanged catalog/host-form/FilterModal shape)', () => {
    const where = buildCampSiteWhere({ annotatedFeatures: 'ALCO' });
    expect(where.AND).toContainEqual({ options: { some: { code: 'ALCO' } } });
  });

  it('[unit] string CSV form: annotatedFeatures:"ALCO,FIRE" emits TWO separate AND-per-code elements', () => {
    const where = buildCampSiteWhere({ annotatedFeatures: 'ALCO,FIRE' });
    expect(where.AND).toContainEqual({ options: { some: { code: 'ALCO' } } });
    expect(where.AND).toContainEqual({ options: { some: { code: 'FIRE' } } });
  });

  it('[unit] array form (AI-tool path): annotatedFeatures:["ALCO","FIRE"] emits ONE code.in element (OR-within-group, CAM-461 Decision 1), never the AND-per-code shape', () => {
    const where = buildCampSiteWhere({ annotatedFeatures: ['ALCO', 'FIRE'] });
    expect(where.AND).toContainEqual({ options: { some: { code: { in: ['ALCO', 'FIRE'] } } } });
    expect(where.AND).not.toContainEqual({ options: { some: { code: 'ALCO' } } });
  });

  it('[unit][EC] absent annotatedFeatures applies no filter (no regression for every other caller of buildCampSiteWhere)', () => {
    const where = buildCampSiteWhere({ province: 'ระยอง' });
    const and = (where.AND as unknown[]) ?? [];
    expect(and.some((e) => JSON.stringify(e).includes('ALCO'))).toBe(false);
  });

  it('[unit][EC-3] an empty array means "not specified" — no filter, never a zero-match query', () => {
    const where = buildCampSiteWhere({ annotatedFeatures: [] });
    const and = (where.AND as unknown[]) ?? [];
    expect(and.some((e) => JSON.stringify(e).includes('options'))).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* executeSearchCampsites — integration: the arg really reaches Prisma's     */
/* where clause via buildCampSiteWhere (mocked findMany, AC-1)                */
/* -------------------------------------------------------------------------- */

describe('executeSearchCampsites — annotatedFeatures reaches buildCampSiteWhere unchanged (AC-1, integration)', () => {
  it('[integration] annotatedFeatures:"ALCO" (single code, e.g. "ลานจิบเบียร์ได้") reaches buildCampSiteWhere as an AND option filter', async () => {
    mockFindMany.mockResolvedValueOnce([{ id: 'c1' }]);

    const args = searchCampsitesArgsSchema.parse({ annotatedFeatures: 'ALCO' });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { AND?: unknown[] } };
    expect(call.where.AND).toContainEqual({ options: { some: { code: 'ALCO' } } });
  });

  it('[integration] annotatedFeatures:"FIRE" (e.g. "ลานก่อไฟได้") + petFriendly coexist as separate AND filters', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ annotatedFeatures: 'FIRE', petFriendly: true });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { AND?: unknown[] } };
    expect(call.where.AND).toContainEqual({ options: { some: { code: 'FIRE' } } });
    expect(call.where.AND).toContainEqual({ petFriendly: true });
  });

  it('[integration] annotatedFeatures:["ALCO","RESV"] (two-or-more named in one ask) reaches buildCampSiteWhere as the OR-within-group array shape', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ annotatedFeatures: ['ALCO', 'RESV'] });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { AND?: unknown[] } };
    expect(call.where.AND).toContainEqual({ options: { some: { code: { in: ['ALCO', 'RESV'] } } } });
  });

  it('[integration][error/validation] an unrecognized annotatedFeatures code fails zod — safeParse rejects, executeSearchCampsites never runs, findMany never called', () => {
    const parsed = searchCampsitesArgsSchema.safeParse({ annotatedFeatures: 'NOPE' });
    expect(parsed.success).toBe(false);
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});
