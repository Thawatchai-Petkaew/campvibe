/**
 * CAM-404 — Thai province name resolves to the stored English `Location.province`
 * value before `searchCampsites` builds its Prisma where-clause.
 *
 * Real-smoke defect: a Thai query ("เชียงใหม่") reached `searchCampsites` as the
 * raw Thai string, but `Location.province` is stored in English ("Chiang Mai"),
 * so the exact-match filter returned 0 rows forever even though 18 matching
 * camps exist. CAM-574: the resolver moved off `ThailandLocation` onto
 * `AdminArea` (`nameTh` ↔ `nameEn`, PROVINCE level) when the retired FK was
 * removed — an unmapped/unknown Thai province, and any lookup error, must
 * still fall back to the raw value unchanged (never throw); English input
 * passes through untouched, no DB round-trip.
 *
 * Coverage matrix:
 *   - normal: Thai province resolves via AdminArea → English value reaches the where-clause
 *   - normal: English province input is unchanged, no AdminArea lookup fired
 *   - null/empty: unmapped/unknown Thai province → falls back to the raw Thai value unchanged
 *   - error: AdminArea lookup throws → graceful raw-value fallback, never throws
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

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * CAM-563's pre-existing `resolveProvinceAdminAreaIds` safety net (an
 * ADDITIVE, unrelated call — see search-campsites.ts) ALSO now queries
 * `prisma.adminArea.findFirst` for any resolved province string, English or
 * Thai — it shares the exact same underlying Prisma method as
 * `resolveProvinceForSearch` post-CAM-574 (previously a different table,
 * `ThailandLocation`, so the two were trivially distinguishable by mock).
 * Filter to the calls that carry `resolveProvinceForSearch`'s own
 * `nameTh.contains` shape (the safety net's shape is `OR:[{equals}]`) so
 * these assertions test ONLY this function's own lookup, not the unrelated
 * safety net's.
 */
function containsLookupCalls() {
  return mockAdminAreaFindFirst.mock.calls.filter(
    (call: unknown[]) => (call[0] as { where?: { nameTh?: { contains?: unknown } } })?.where?.nameTh?.contains !== undefined
  );
}

describe('searchCampsites — Thai province resolve (CAM-404 normal)', () => {
  it('[unit] a Thai province name resolves via AdminArea to the stored English value', async () => {
    mockAdminAreaFindFirst.mockResolvedValueOnce({ nameEn: 'Chiang Mai' });
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'เชียงใหม่' });
    await executeSearchCampsites(args);

    const calls = containsLookupCalls();
    expect(calls).toHaveLength(1);
    const lookupCall = calls[0][0] as {
      where: { countryCode: string; level: string; nameTh: { contains: string } };
      select: { nameEn: boolean };
    };
    expect(lookupCall.where.countryCode).toBe('TH');
    expect(lookupCall.where.level).toBe('PROVINCE');
    expect(lookupCall.where.nameTh.contains).toBe('เชียงใหม่');
    expect(lookupCall.select).toEqual({ nameEn: true });

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(queryCall.where.location?.province).toBe('Chiang Mai');
  });
});

describe('searchCampsites — English province passthrough (CAM-404 normal)', () => {
  it('[unit] an English province input is unchanged and never triggers an AdminArea lookup', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'Chiang Mai' });
    await executeSearchCampsites(args);

    expect(containsLookupCalls()).toHaveLength(0);
    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(queryCall.where.location?.province).toBe('Chiang Mai');
  });
});

describe('searchCampsites — unmapped Thai province (CAM-404 null/empty fallback)', () => {
  it('[unit] a Thai province with no AdminArea match falls back to the raw value unchanged', async () => {
    mockAdminAreaFindFirst.mockResolvedValueOnce(null);
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'ไม่มีจริง' });
    await executeSearchCampsites(args);

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(queryCall.where.location?.province).toBe('ไม่มีจริง');
  });
});

describe('searchCampsites — lookup error (CAM-404 error/validation)', () => {
  it('[unit] an AdminArea lookup error falls back to the raw value and never throws', async () => {
    mockAdminAreaFindFirst.mockRejectedValueOnce(new Error('connection reset'));
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'เชียงใหม่' });
    await expect(executeSearchCampsites(args)).resolves.toEqual({ cards: [] });

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(queryCall.where.location?.province).toBe('เชียงใหม่');
  });
});
