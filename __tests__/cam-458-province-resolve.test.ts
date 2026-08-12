/**
 * CAM-458 — Bangkok-variant alias normalization (BR-3/D1) inside
 * `resolveProvinceForSearch`, mirroring the CAM-404 test idiom (mocked
 * prisma, zero DB).
 *
 * CAM-574: the resolver moved off `ThailandLocation` onto `AdminArea`
 * (`nameTh`/`nameEn`, PROVINCE level) when the retired FK was removed — the
 * alias-normalization behaviour this file proves is unchanged, only the
 * backing table/field names differ.
 *
 * Coverage matrix:
 *   - normal: every mapped Bangkok alias (กทม / กทม. / กรุงเทพฯ / บางกอก)
 *     normalizes to กรุงเทพมหานคร BEFORE the AdminArea lookup, and the
 *     resolved English value reaches the where-clause (AC-2).
 *   - normal: a substring Bangkok variant NOT in the alias map (กรุงเทพ) still
 *     resolves via the existing `contains` lookup — the map is additive (EC-2).
 *   - null/empty: a non-province Thai word (not an alias, no AdminArea
 *     match) falls back to the RAW original value unchanged, never the
 *     normalized alias (EC-4/BR-4 regression guard).
 *   - error: a lookup error after alias normalization still falls back to the
 *     raw original value and never throws (BR-4).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import thailandLocations from '@/prisma/data/thailand-locations.json';

interface ProvinceEntry {
  code: string;
  nameTh: string;
  nameEn: string;
}
const ALL_PROVINCES = thailandLocations as ProvinceEntry[];

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
 * CAM-563's pre-existing `resolveProvinceAdminAreaIds` safety net ALSO now
 * queries `prisma.adminArea.findFirst` for any resolved province string
 * (English or Thai) — it shares the same underlying Prisma method as
 * `resolveProvinceForSearch` post-CAM-574. It always runs AFTER
 * `resolveProvinceForSearch` completes (sequential awaits, no
 * `Promise.all`), so `mock.calls[0]` is always this resolver's own call —
 * but the TOTAL call count is no longer 1 whenever the safety net also
 * fires. `toHaveBeenCalledOnce()` below is replaced with a length check on
 * calls carrying `resolveProvinceForSearch`'s own `nameTh.contains` shape
 * (the safety net's shape is `OR:[{equals}]`).
 */
function containsLookupCallCount() {
  return mockAdminAreaFindFirst.mock.calls.filter(
    (call: unknown[]) => (call[0] as { where?: { nameTh?: { contains?: unknown } } })?.where?.nameTh?.contains !== undefined
  ).length;
}

describe('searchCampsites — Bangkok alias normalization (CAM-458 AC-2 normal)', () => {
  const aliases = ['กทม', 'กทม.', 'กรุงเทพฯ', 'บางกอก'];

  it.each(aliases)('[unit] alias "%s" normalizes to กรุงเทพมหานคร before lookup and resolves to Bangkok', async (alias) => {
    mockAdminAreaFindFirst.mockResolvedValueOnce({ nameEn: 'Bangkok' });
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: alias });
    await executeSearchCampsites(args);

    expect(containsLookupCallCount()).toBe(1);
    const lookupCall = mockAdminAreaFindFirst.mock.calls[0][0] as {
      where: { nameTh: { contains: string } };
    };
    // the alias itself is normalized to the canonical name BEFORE the DB query fires
    expect(lookupCall.where.nameTh.contains).toBe('กรุงเทพมหานคร');

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(queryCall.where.location?.province).toBe('Bangkok');
  });
});

describe('searchCampsites — substring Bangkok variant, no map entry needed (CAM-458 EC-2)', () => {
  it('[unit] a substring variant (กรุงเทพ) not in the alias map still resolves via the existing contains lookup', async () => {
    mockAdminAreaFindFirst.mockResolvedValueOnce({ nameEn: 'Bangkok' });
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'กรุงเทพ' });
    await executeSearchCampsites(args);

    const lookupCall = mockAdminAreaFindFirst.mock.calls[0][0] as {
      where: { nameTh: { contains: string } };
    };
    // unmapped in BANGKOK_ALIASES — passed through as-is to the contains query
    expect(lookupCall.where.nameTh.contains).toBe('กรุงเทพ');

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(queryCall.where.location?.province).toBe('Bangkok');
  });
});

describe('searchCampsites — non-province word, alias map does not interfere (CAM-458 EC-4 regression)', () => {
  it('[unit] a non-province Thai word with no AdminArea match falls back to the RAW original value unchanged', async () => {
    mockAdminAreaFindFirst.mockResolvedValueOnce(null);
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'จังหวัดในฝัน' });
    await executeSearchCampsites(args);

    const lookupCall = mockAdminAreaFindFirst.mock.calls[0][0] as {
      where: { nameTh: { contains: string } };
    };
    expect(lookupCall.where.nameTh.contains).toBe('จังหวัดในฝัน');

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(queryCall.where.location?.province).toBe('จังหวัดในฝัน');
  });
});

describe('searchCampsites — lookup error after alias normalization (CAM-458 BR-4 regression)', () => {
  it('[unit] an AdminArea lookup error after normalizing a Bangkok alias falls back to the raw alias and never throws', async () => {
    mockAdminAreaFindFirst.mockRejectedValueOnce(new Error('connection reset'));
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'กทม' });
    // CAM-709 — supersedes the pre-CAM-709 `{ cards: [] }` shape (additive
    // `appliedFilters` echo, api.md rule 12); the raw camper-supplied alias
    // still echoes (BR-1 — it still constrained the query, asserted below).
    await expect(executeSearchCampsites(args)).resolves.toEqual({
      cards: [],
      appliedFilters: { province: 'กทม', taxonomy: [] },
    });

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    // raw ORIGINAL value (the alias itself), not the normalized canonical name
    expect(queryCall.where.location?.province).toBe('กทม');
  });
});

/**
 * QA gap-fill (independent verify) — AC-1 self-verify explicitly calls for a
 * table-driven test across ALL 77 real provinces ("mirrors
 * __tests__/cam-404-search-campsites-province-resolve.test.ts"); the pinned
 * suite only exercised Bangkok aliases + one generic non-Bangkok Thai word,
 * never swept the real `thailand-locations.json` file. Table-driven from the
 * REAL data (not hardcoded) so a future data edit cannot silently drift from
 * this test. This also proves `THAI_CHAR_PATTERN` (the "is this Thai" gate)
 * matches every real Thai province name — if it didn't, the function would
 * short-circuit and never call `adminArea.findFirst` at all.
 */
describe('searchCampsites — table-driven resolve across ALL 77 real provinces (CAM-458 AC-1 normal)', () => {
  it.each(ALL_PROVINCES)('[unit] "$nameTh" (code $code) resolves to the stored English value "$nameEn"', async ({ nameTh, nameEn }) => {
    mockAdminAreaFindFirst.mockResolvedValueOnce({ nameEn });
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: nameTh });
    await executeSearchCampsites(args);

    // the THAI_CHAR_PATTERN gate fired (a miss would skip the lookup entirely)
    expect(containsLookupCallCount()).toBe(1);
    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(queryCall.where.location?.province).toBe(nameEn);
  });
});

/**
 * QA gap-fill — AC-3 direct proof at the tool layer: a resolved (new, CAM-458)
 * province with genuinely zero matching camps returns `{ cards: [] }` — the
 * honest-empty system effect the banner (owned by CAM-437/frontend,
 * unchanged) renders from. Story self-verify names this an
 * integration+owner-verify item; this unit-level slice proves the tool's own
 * contribution to that AC without a DB.
 */
describe('searchCampsites — resolved province with zero camps returns honest empty (CAM-458 AC-3)', () => {
  it('[unit] a resolvable new province (Bueng Kan) with no matching camps returns { cards: [] }', async () => {
    mockAdminAreaFindFirst.mockResolvedValueOnce({ nameEn: 'Bueng Kan' });
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'บึงกาฬ' });
    const result = await executeSearchCampsites(args);

    // CAM-709 — supersedes the pre-CAM-709 `{ cards: [] }` shape (additive
    // `appliedFilters` echo, api.md rule 12); the raw camper-supplied Thai
    // province name still echoes (BR-1 — it constrained the query).
    expect(result).toEqual({ cards: [], appliedFilters: { province: 'บึงกาฬ', taxonomy: [] } });
    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(queryCall.where.location?.province).toBe('Bueng Kan');
  });
});

/**
 * QA gap-fill — adversarial negative: a near-miss word that CONTAINS "บางกอก"
 * as a substring (บางกอกน้อย, a real Thonburi-side district name) must NOT
 * resolve to Bangkok via the exact-key alias map — `BANGKOK_ALIASES` is a
 * plain object keyed by exact string, so JS property lookup on a longer
 * string that merely contains a key can never accidentally hit (proven here,
 * not just asserted by construction). It still falls through to the
 * unchanged CAM-404 `contains` lookup like any other unmapped word (EC-2).
 */
describe('searchCampsites — near-miss Bangkok substring does not exact-key-match the alias map (QA gap-fill, adversarial)', () => {
  it('[unit] "บางกอกน้อย" is NOT normalized by BANGKOK_ALIASES (passed through as-is to the contains lookup)', async () => {
    mockAdminAreaFindFirst.mockResolvedValueOnce(null);
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: 'บางกอกน้อย' });
    await executeSearchCampsites(args);

    const lookupCall = mockAdminAreaFindFirst.mock.calls[0][0] as {
      where: { nameTh: { contains: string } };
    };
    // NOT normalized to กรุงเทพมหานคร — the exact-key map missed, as it must
    expect(lookupCall.where.nameTh.contains).toBe('บางกอกน้อย');

    const queryCall = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string } } };
    expect(queryCall.where.location?.province).toBe('บางกอกน้อย');
  });
});

/**
 * QA gap-fill — whitespace variant. `searchCampsitesArgsSchema` already
 * applies `z.string().trim()` to `province` at the zod boundary (BEFORE
 * `resolveProvinceForSearch` ever runs), so a Bangkok alias typed with
 * incidental surrounding whitespace still exact-key-matches. Confirms the
 * trim+alias combination end-to-end rather than assuming it from reading
 * two separate pieces of code.
 */
describe('searchCampsites — Bangkok alias with surrounding whitespace still resolves (QA gap-fill, boundary)', () => {
  it('[unit] "  กทม  " (padded) trims at the zod boundary then exact-key-matches the alias map', async () => {
    mockAdminAreaFindFirst.mockResolvedValueOnce({ nameEn: 'Bangkok' });
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ province: '  กทม  ' });
    expect(args.province).toBe('กทม'); // zod .trim() already fired

    await executeSearchCampsites(args);

    const lookupCall = mockAdminAreaFindFirst.mock.calls[0][0] as {
      where: { nameTh: { contains: string } };
    };
    expect(lookupCall.where.nameTh.contains).toBe('กรุงเทพมหานคร');
  });
});
