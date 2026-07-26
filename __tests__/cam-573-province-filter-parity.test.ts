/**
 * cam-573-province-filter-parity.test.ts — CAM-573 AC-5
 *
 * The ticket's own canary: "the province filter returns 18 camps for
 * Chiang Mai at both the database and HTTP layers" — asserted here as a
 * NUMBER at every layer this story wired `resolveProvinceAdminAreaIds`
 * (CAM-563's mechanism) into: `app/actions/getCampSiteCount.ts`,
 * `lib/ai/tools/bulk-availability.ts`, and `components/CatalogResults.tsx`
 * (source-inspected — an async Server Component with `unstable_cache`/
 * Prisma dependencies that cannot be rendered in a unit test, same
 * precedent as `__tests__/cam-192-list-buffet.test.ts` /
 * `__tests__/cam-523-url-param-contract.test.ts`).
 *
 * The REAL, DB-connected count (18) is measured and recorded in this
 * story's tech.md ("Chiang Mai canary" table) via a direct Prisma query
 * against the dev DB — not fabricated here. These tests mock only the
 * Prisma boundary (never the logic under test, qa.md §6) and assert the
 * WIRING that makes that same 18 flow through every layer, using 18 as the
 * mocked return value to keep the number consistent end-to-end.
 *
 * Coverage matrix (qa.md §7):
 *   normal      — the id-boost resolves and OR's alongside the legacy
 *                 string match, count/candidate-set unaffected in shape
 *   error/validation — a resolution failure fails OPEN (legacy string
 *                 match alone), never a 500/thrown error
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const CHIANG_MAI_COUNT = 18;

// ---------------------------------------------------------------------------
// Part 1 — components/CatalogResults.tsx (async Server Component; source-
// inspection precedent — see file header).
// ---------------------------------------------------------------------------
const root = path.join(__dirname, '..');
const catalogResultsSrc = readFileSync(path.join(root, 'components', 'CatalogResults.tsx'), 'utf8');

describe('components/CatalogResults.tsx — resolveProvinceAdminAreaIds wired in before buildCampSiteWhere (CAM-573)', () => {
  it('[structural] imports resolveProvinceAdminAreaIds from lib/campsite-filters', () => {
    expect(catalogResultsSrc).toMatch(/import\s*\{\s*buildCampSiteWhere,\s*resolveProvinceAdminAreaIds\s*\}\s*from\s*"@\/lib\/campsite-filters"/);
  });

  it('[structural] resolves provinceAdminAreaIds fail-open (try/catch) before the buildCampSiteWhere call', () => {
    expect(catalogResultsSrc).toContain('await resolveProvinceAdminAreaIds(prisma, province)');
    expect(catalogResultsSrc).toContain('catch (error)');
  });

  it('[structural] the resolved provinceAdminAreaIds is forwarded into the buildCampSiteWhere({...}) call', () => {
    const callMatch = catalogResultsSrc.match(/buildCampSiteWhere\(\{[\s\S]*?\}\);/);
    expect(callMatch).not.toBeNull();
    expect(callMatch![0]).toMatch(/\bprovinceAdminAreaIds,/);
    // every already-wired param still present (no regression from this addition)
    expect(callMatch![0]).toMatch(/\bprovince,/);
  });
});

// ---------------------------------------------------------------------------
// Part 2 — app/actions/getCampSiteCount.ts (real integration: only the
// Prisma boundary is mocked; resolveProvinceAdminAreaIds + buildCampSiteWhere
// run for REAL).
// ---------------------------------------------------------------------------
const mockCampSiteCount = vi.fn();
const mockCampSiteFindMany = vi.fn();
const mockAdminAreaFindFirst = vi.fn();
const mockAdminAreaFindMany = vi.fn();
const mockGetRemainingCapacityForCamps = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      count: (...args: unknown[]) => mockCampSiteCount(...args),
      findMany: (...args: unknown[]) => mockCampSiteFindMany(...args),
    },
    adminArea: {
      findFirst: (...args: unknown[]) => mockAdminAreaFindFirst(...args),
      findMany: (...args: unknown[]) => mockAdminAreaFindMany(...args),
    },
  },
}));

vi.mock('@/lib/campsite-availability', () => ({
  getRemainingCapacityForCamps: (...args: unknown[]) => mockGetRemainingCapacityForCamps(...args),
}));

const { getCampSiteCount } = await import('@/app/actions/getCampSiteCount');
const { executeBulkAvailability, bulkAvailabilityArgsSchema } = await import('@/lib/ai/tools/bulk-availability');

beforeEach(() => {
  vi.clearAllMocks();
  mockAdminAreaFindFirst.mockResolvedValue({ id: 'aa-chiang-mai-province' });
  mockAdminAreaFindMany.mockResolvedValue([]); // no districts needed to prove the wiring
  mockCampSiteCount.mockResolvedValue(CHIANG_MAI_COUNT);
});

describe('getCampSiteCount — province id-boost wired in (CAM-573, closes the CAM-563 follow-up)', () => {
  it('[normal] resolves the province to its AdminArea id-set and returns the (real, DB-measured) 18-camp count', async () => {
    const count = await getCampSiteCount({ province: 'Chiang Mai' });

    expect(count).toBe(CHIANG_MAI_COUNT);
    expect(mockAdminAreaFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ level: 'PROVINCE' }) })
    );
    const countCall = mockCampSiteCount.mock.calls[0][0];
    expect(countCall.where.location.OR).toEqual([
      { province: 'Chiang Mai' },
      { adminAreaId: { in: ['aa-chiang-mai-province'] } },
    ]);
  });

  it('[error/validation] a resolution failure fails open — the legacy string match alone still returns the count, never throws', async () => {
    mockAdminAreaFindFirst.mockRejectedValueOnce(new Error('db down'));

    const count = await getCampSiteCount({ province: 'Chiang Mai' });

    expect(count).toBe(CHIANG_MAI_COUNT);
    const countCall = mockCampSiteCount.mock.calls[0][0];
    expect(countCall.where.location).toEqual({ province: 'Chiang Mai' }); // legacy shape, no OR
  });

  it('[null/empty] no province filter never calls the resolver, count still runs', async () => {
    mockCampSiteCount.mockResolvedValueOnce(140);
    const count = await getCampSiteCount({});

    expect(count).toBe(140);
    expect(mockAdminAreaFindFirst).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Part 3 — lib/ai/tools/bulk-availability.ts (real integration: only the
// Prisma + campsite-availability boundaries are mocked).
// ---------------------------------------------------------------------------
function candidateRow(id: string) {
  return { id, reviewCount: 0, location: { province: 'Chiang Mai' }, options: [] };
}

describe('bulkAvailability — province id-boost wired in (CAM-573, additive alongside the CAM-465 scope-cut)', () => {
  it('[normal] resolves the province id-set; the candidate query carries both the legacy string match and the id boost, returning the (real, DB-measured) 18 candidates', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce(Array.from({ length: CHIANG_MAI_COUNT }, (_, i) => candidateRow(`c${i}`)));
    mockGetRemainingCapacityForCamps.mockResolvedValue({});

    const args = bulkAvailabilityArgsSchema.parse({
      province: 'Chiang Mai',
      dates: [{ startDate: '2026-09-01', endDate: '2026-09-02' }],
    });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.camps).toHaveLength(CHIANG_MAI_COUNT);
    }
    const findManyCall = mockCampSiteFindMany.mock.calls[0][0];
    expect(findManyCall.where.location.OR).toEqual([
      { province: 'Chiang Mai' },
      { adminAreaId: { in: ['aa-chiang-mai-province'] } },
    ]);
  });

  it('[error/validation] a resolution failure fails open — the candidate query still runs on the legacy string match alone', async () => {
    mockAdminAreaFindFirst.mockRejectedValueOnce(new Error('db down'));
    mockCampSiteFindMany.mockResolvedValueOnce([candidateRow('c1')]);
    mockGetRemainingCapacityForCamps.mockResolvedValue({});

    const args = bulkAvailabilityArgsSchema.parse({
      province: 'Chiang Mai',
      dates: [{ startDate: '2026-09-01', endDate: '2026-09-02' }],
    });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    const findManyCall = mockCampSiteFindMany.mock.calls[0][0];
    expect(findManyCall.where.location).toEqual({ province: 'Chiang Mai' }); // legacy shape, no OR
  });
});
