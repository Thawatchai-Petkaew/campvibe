/**
 * CAM-404 — Thai province name resolves to the stored English `Location.province`
 * value before `searchCampsites` builds its Prisma where-clause.
 *
 * Real-smoke defect: a Thai query ("เชียงใหม่") reached `searchCampsites` as the
 * raw Thai string, but `Location.province` is stored in English ("Chiang Mai"),
 * so the exact-match filter returned 0 rows forever even though 18 matching
 * camps exist. `ThailandLocation` maps provinceName (Thai) ↔ provinceNameEn
 * (English); coverage is partial (~12 provinces) so an unmapped/unknown Thai
 * province, and any lookup error, must fall back to the raw value unchanged
 * (never throw) — English input passes through untouched, no DB round-trip.
 *
 * Coverage matrix:
 *   - normal: Thai province resolves via ThailandLocation → English value reaches the where-clause
 *   - normal: English province input is unchanged, no thailandLocation lookup fired
 *   - null/empty: unmapped/unknown Thai province → falls back to the raw Thai value unchanged
 *   - error: thailandLocation lookup throws → graceful raw-value fallback, never throws
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindMany = vi.fn();
const mockThailandLocationFindFirst = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    thailandLocation: {
      findFirst: (...args: unknown[]) => mockThailandLocationFindFirst(...args),
    },
  },
}));

const { executeSearchCampsites, searchCampsitesArgsSchema } = await import('@/lib/ai/tools/search-campsites');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('searchCampsites — Thai province resolve (CAM-404 normal)', () => {
  it('[unit] a Thai province name resolves via ThailandLocation to the stored English value', async () => {
    mockThailandLocationFindFirst.mockResolvedValueOnce({ provinceNameEn: 'Chiang Mai' });
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'เชียงใหม่' });
    await executeSearchCampsites(args);

    expect(mockThailandLocationFindFirst).toHaveBeenCalledOnce();
    const lookupCall = mockThailandLocationFindFirst.mock.calls[0][0] as {
      where: { provinceName: { contains: string } };
      select: { provinceNameEn: boolean };
    };
    expect(lookupCall.where.provinceName.contains).toBe('เชียงใหม่');
    expect(lookupCall.select).toEqual({ provinceNameEn: true });

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(queryCall.where.location?.province).toBe('Chiang Mai');
  });
});

describe('searchCampsites — English province passthrough (CAM-404 normal)', () => {
  it('[unit] an English province input is unchanged and never triggers a ThailandLocation lookup', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'Chiang Mai' });
    await executeSearchCampsites(args);

    expect(mockThailandLocationFindFirst).not.toHaveBeenCalled();
    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(queryCall.where.location?.province).toBe('Chiang Mai');
  });
});

describe('searchCampsites — unmapped Thai province (CAM-404 null/empty fallback)', () => {
  it('[unit] a Thai province with no ThailandLocation match falls back to the raw value unchanged', async () => {
    mockThailandLocationFindFirst.mockResolvedValueOnce(null);
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'ไม่มีจริง' });
    await executeSearchCampsites(args);

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(queryCall.where.location?.province).toBe('ไม่มีจริง');
  });
});

describe('searchCampsites — lookup error (CAM-404 error/validation)', () => {
  it('[unit] a ThailandLocation lookup error falls back to the raw value and never throws', async () => {
    mockThailandLocationFindFirst.mockRejectedValueOnce(new Error('connection reset'));
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'เชียงใหม่' });
    await expect(executeSearchCampsites(args)).resolves.toEqual({ cards: [] });

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(queryCall.where.location?.province).toBe('เชียงใหม่');
  });
});
