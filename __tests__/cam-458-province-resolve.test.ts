/**
 * CAM-458 — Bangkok-variant alias normalization (BR-3/D1) inside
 * `resolveProvinceForSearch`, mirroring the CAM-404 test idiom (mocked
 * prisma, zero DB).
 *
 * Coverage matrix:
 *   - normal: every mapped Bangkok alias (กทม / กทม. / กรุงเทพฯ / บางกอก)
 *     normalizes to กรุงเทพมหานคร BEFORE the ThailandLocation lookup, and the
 *     resolved English value reaches the where-clause (AC-2).
 *   - normal: a substring Bangkok variant NOT in the alias map (กรุงเทพ) still
 *     resolves via the existing `contains` lookup — the map is additive (EC-2).
 *   - null/empty: a non-province Thai word (not an alias, no ThailandLocation
 *     match) falls back to the RAW original value unchanged, never the
 *     normalized alias (EC-4/BR-4 regression guard).
 *   - error: a lookup error after alias normalization still falls back to the
 *     raw original value and never throws (BR-4).
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

describe('searchCampsites — Bangkok alias normalization (CAM-458 AC-2 normal)', () => {
  const aliases = ['กทม', 'กทม.', 'กรุงเทพฯ', 'บางกอก'];

  it.each(aliases)('[unit] alias "%s" normalizes to กรุงเทพมหานคร before lookup and resolves to Bangkok', async (alias) => {
    mockThailandLocationFindFirst.mockResolvedValueOnce({ provinceNameEn: 'Bangkok' });
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: alias });
    await executeSearchCampsites(args);

    expect(mockThailandLocationFindFirst).toHaveBeenCalledOnce();
    const lookupCall = mockThailandLocationFindFirst.mock.calls[0][0] as {
      where: { provinceName: { contains: string } };
    };
    // the alias itself is normalized to the canonical name BEFORE the DB query fires
    expect(lookupCall.where.provinceName.contains).toBe('กรุงเทพมหานคร');

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(queryCall.where.location?.province).toBe('Bangkok');
  });
});

describe('searchCampsites — substring Bangkok variant, no map entry needed (CAM-458 EC-2)', () => {
  it('[unit] a substring variant (กรุงเทพ) not in the alias map still resolves via the existing contains lookup', async () => {
    mockThailandLocationFindFirst.mockResolvedValueOnce({ provinceNameEn: 'Bangkok' });
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'กรุงเทพ' });
    await executeSearchCampsites(args);

    const lookupCall = mockThailandLocationFindFirst.mock.calls[0][0] as {
      where: { provinceName: { contains: string } };
    };
    // unmapped in BANGKOK_ALIASES — passed through as-is to the contains query
    expect(lookupCall.where.provinceName.contains).toBe('กรุงเทพ');

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(queryCall.where.location?.province).toBe('Bangkok');
  });
});

describe('searchCampsites — non-province word, alias map does not interfere (CAM-458 EC-4 regression)', () => {
  it('[unit] a non-province Thai word with no ThailandLocation match falls back to the RAW original value unchanged', async () => {
    mockThailandLocationFindFirst.mockResolvedValueOnce(null);
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'จังหวัดในฝัน' });
    await executeSearchCampsites(args);

    const lookupCall = mockThailandLocationFindFirst.mock.calls[0][0] as {
      where: { provinceName: { contains: string } };
    };
    expect(lookupCall.where.provinceName.contains).toBe('จังหวัดในฝัน');

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(queryCall.where.location?.province).toBe('จังหวัดในฝัน');
  });
});

describe('searchCampsites — lookup error after alias normalization (CAM-458 BR-4 regression)', () => {
  it('[unit] a ThailandLocation lookup error after normalizing a Bangkok alias falls back to the raw alias and never throws', async () => {
    mockThailandLocationFindFirst.mockRejectedValueOnce(new Error('connection reset'));
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'กทม' });
    await expect(executeSearchCampsites(args)).resolves.toEqual({ cards: [] });

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    // raw ORIGINAL value (the alias itself), not the normalized canonical name
    expect(queryCall.where.location?.province).toBe('กทม');
  });
});
