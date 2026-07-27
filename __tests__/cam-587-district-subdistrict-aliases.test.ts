/**
 * cam-587-district-subdistrict-aliases.test.ts — CAM-587
 * (platform-hardening/taxonomy-ui-foundation)
 *
 * Pins `lib/ai/tools/search-campsites.ts`'s new `district`/`subDistrict` args
 * and `lib/ai/place-aliases.ts`'s consumption of `prisma/data/place-
 * aliases.json` (province/region/zone aliases, PR #673) — see story.md AC-1
 * through AC-6 and the precedence ladder in BR-1.
 *
 * Fixture design (owner clarification 2026-07-28: district is a FIRST-CLASS
 * search level, not merely a sub-district disambiguator — a district search
 * must return a strict, VISIBLE subset of its province's result, never prove
 * that only by coincidence of a low-camp province):
 *
 *   Chiang Mai (province)
 *     +-- Mueang Chiang Mai (district)
 *     |     +-- Suthep (sub-district)
 *     |     +-- Chang Phueak (sub-district)
 *     +-- Mae Rim (district)          <- proves province ⊋ one district
 *
 * A province-only search's resolved id-set is [province, BOTH districts,
 * BOTH sub-districts] (5 ids). A district-only search on Mueang Chiang Mai
 * resolves to [that district, ITS OWN 2 sub-districts] (3 ids) — missing Mae
 * Rim entirely, a REAL structural narrowing, not a coincidence. A
 * sub-district-only search on Suthep resolves to [Suthep] alone (1 id) —
 * missing Chang Phueak, again a real narrowing. Every test below asserts on
 * these exact id arrays, never a vague "returned something".
 *
 * A DECOY same-named district ("หัวหิน" under an unrelated fake province) is
 * included specifically to prove the zone-alias -> district resolution's own
 * province-scoping is REAL and not accidental (mirrors CAM-566's own
 * same-named-district-under-the-wrong-parent test).
 *
 * Coverage matrix (qa.md §7): normal · null/empty · boundary · error/
 * validation · concurrent/ordering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCampSiteFindMany = vi.fn();
const mockAdminAreaFindFirst = vi.fn();
const mockAdminAreaFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findMany: (...args: unknown[]) => mockCampSiteFindMany(...args),
    },
    adminArea: {
      findFirst: (...args: unknown[]) => mockAdminAreaFindFirst(...args),
      findMany: (...args: unknown[]) => mockAdminAreaFindMany(...args),
    },
  },
}));

const { executeSearchCampsites, searchCampsitesArgsSchema } = await import('@/lib/ai/tools/search-campsites');
const { REGION_TO_PROVINCES } = await import('@/lib/thai-regions');

// ===========================================================================
// Fake AdminArea tree (see file docblock for the shape + why it proves real
// narrowing, not coincidence). Includes a bare Nakhon Ratchasima province (for
// the "โคราช" alias) and a Hua Hin district under its real province PLUS a
// same-named DECOY district under an unrelated fake province (proves the
// zone-alias's own province-scoping actually matters, DEF-1/DEF-2 style).
// ===========================================================================
const ADMIN_AREAS = [
  { id: 'dist-huahin-decoy', code: '9901', level: 'DISTRICT', nameEn: 'Hua Hin', nameTh: 'หัวหิน', parentId: 'prov-decoy' },
  { id: 'prov-cnx', code: '50', level: 'PROVINCE', nameEn: 'Chiang Mai', nameTh: 'เชียงใหม่', parentId: null },
  { id: 'dist-mueang', code: '5001', level: 'DISTRICT', nameEn: 'Mueang Chiang Mai', nameTh: 'เมืองเชียงใหม่', parentId: 'prov-cnx' },
  { id: 'dist-maerim', code: '5002', level: 'DISTRICT', nameEn: 'Mae Rim', nameTh: 'แม่ริม', parentId: 'prov-cnx' },
  { id: 'sub-suthep', code: '500101', level: 'SUBDISTRICT', nameEn: 'Suthep', nameTh: 'สุเทพ', parentId: 'dist-mueang' },
  { id: 'sub-changphueak', code: '500102', level: 'SUBDISTRICT', nameEn: 'Chang Phueak', nameTh: 'ช้างเผือก', parentId: 'dist-mueang' },
  { id: 'prov-korat', code: '30', level: 'PROVINCE', nameEn: 'Nakhon Ratchasima', nameTh: 'นครราชสีมา', parentId: null },
  { id: 'prov-hh', code: '77', level: 'PROVINCE', nameEn: 'Prachuap Khiri Khan', nameTh: 'ประจวบคีรีขันธ์', parentId: null },
  { id: 'dist-huahin', code: '7701', level: 'DISTRICT', nameEn: 'Hua Hin', nameTh: 'หัวหิน', parentId: 'prov-hh' },
] as const;

interface FakeArea { id: string; code: string; level: string; nameEn: string; nameTh: string; parentId: string | null }

function findFirstImpl({ where }: { where: Record<string, unknown> }): FakeArea | null {
  const level = where.level as string;
  // resolveProvinceForSearch's own shape: { countryCode, level, nameTh: { contains } }
  const nameThFilter = where.nameTh as { contains?: string } | undefined;
  if (nameThFilter?.contains !== undefined) {
    const needle = nameThFilter.contains;
    return ADMIN_AREAS.find((a) => a.level === level && a.nameTh.includes(needle)) ?? null;
  }
  // matchAdminArea / resolveProvinceAdminAreaIds's shape: { OR: [{nameTh:{equals,mode}}, {nameEn:{equals,mode}}] }
  const or = where.OR as Array<{ nameTh?: { equals: string }; nameEn?: { equals: string } }> | undefined;
  const wantedNames = (or ?? []).map((c) => (c.nameTh ?? c.nameEn)!.equals.toLowerCase());
  const parentId = where.parentId as string | undefined;
  return (
    ADMIN_AREAS.find((a) => {
      if (a.level !== level) return false;
      if (parentId !== undefined && a.parentId !== parentId) return false;
      return wantedNames.includes(a.nameTh.toLowerCase()) || wantedNames.includes(a.nameEn.toLowerCase());
    }) ?? null
  );
}

function findManyImpl({ where }: { where: Record<string, unknown> }): FakeArea[] {
  const level = where.level as string;
  const parentIdRaw = where.parentId as string | { in: string[] } | undefined;
  return ADMIN_AREAS.filter((a) => {
    if (a.level !== level) return false;
    if (parentIdRaw === undefined) return true;
    if (typeof parentIdRaw === 'object') return parentIdRaw.in.includes(a.parentId ?? '');
    return a.parentId === parentIdRaw;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAdminAreaFindFirst.mockImplementation(async (args) => findFirstImpl(args));
  mockAdminAreaFindMany.mockImplementation(async (args) => findManyImpl(args));
  mockCampSiteFindMany.mockResolvedValue([]);
});

/** Extracts the `location.adminAreaId.in` array CAM-587's district/sub-district AND clause pushes (order-independent via a Set for comparison). */
function extractAdminAreaIdIn(where: { AND?: unknown }): string[] | undefined {
  const andArray = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
  for (const clause of andArray as Array<{ location?: { adminAreaId?: { in?: string[] } } }>) {
    if (clause.location?.adminAreaId?.in) return clause.location.adminAreaId.in;
  }
  return undefined;
}

// ===========================================================================
// AC-1/AC-2 — the three levels narrow strictly: province ⊋ district ⊋ sub-district
// ===========================================================================
describe('CAM-587 AC-1/AC-2 — province/district/sub-district each narrow strictly (owner: district is first-class)', () => {
  it('[normal] province-only ("เชียงใหม่") resolves to the WHOLE subtree: province + both districts + both sub-districts', async () => {
    const args = searchCampsitesArgsSchema.parse({ province: 'เชียงใหม่' });
    await executeSearchCampsites(args);
    const where = mockCampSiteFindMany.mock.calls[0][0].where as { location: { OR: Array<{ adminAreaId?: { in: string[] } }> } };
    const idSet = where.location.OR.find((c) => c.adminAreaId)?.adminAreaId?.in;
    expect(new Set(idSet)).toEqual(new Set(['prov-cnx', 'dist-mueang', 'dist-maerim', 'sub-suthep', 'sub-changphueak']));
  });

  it('[normal] district-only ("เมืองเชียงใหม่") resolves to ONLY that district + its own 2 sub-districts — Mae Rim is NOT included (strict subset of the province result)', async () => {
    const args = searchCampsitesArgsSchema.parse({ district: 'เมืองเชียงใหม่' });
    await executeSearchCampsites(args);
    const where = mockCampSiteFindMany.mock.calls[0][0].where;
    const ids = extractAdminAreaIdIn(where);
    expect(new Set(ids)).toEqual(new Set(['dist-mueang', 'sub-suthep', 'sub-changphueak']));
    expect(ids).not.toContain('dist-maerim');
    expect(ids).not.toContain('prov-cnx');
  });

  it('[normal] sub-district-only ("สุเทพ") resolves to ONLY that sub-district — Chang Phueak is NOT included (strict subset of the district result)', async () => {
    const args = searchCampsitesArgsSchema.parse({ subDistrict: 'สุเทพ' });
    await executeSearchCampsites(args);
    const where = mockCampSiteFindMany.mock.calls[0][0].where;
    const ids = extractAdminAreaIdIn(where);
    expect(ids).toEqual(['sub-suthep']);
  });

  it('[boundary] district scoped by its OWN real province ("เชียงใหม่") still resolves the same 3-id set (province used for scoping only, never adds to the filter)', async () => {
    const args = searchCampsitesArgsSchema.parse({ district: 'เมืองเชียงใหม่', province: 'เชียงใหม่' });
    await executeSearchCampsites(args);
    const ids = extractAdminAreaIdIn(mockCampSiteFindMany.mock.calls[0][0].where);
    expect(new Set(ids)).toEqual(new Set(['dist-mueang', 'sub-suthep', 'sub-changphueak']));
  });

  it('[error/validation] district scoped by the WRONG province (Hua Hin\'s, not Chiang Mai\'s) fails to resolve — the scoping is real, not silently dropped (DEF-1/DEF-2 lesson)', async () => {
    const args = searchCampsitesArgsSchema.parse({ district: 'เมืองเชียงใหม่', province: 'ประจวบคีรีขันธ์' });
    const result = await executeSearchCampsites(args);
    expect(result).toEqual({ cards: [] });
    expect(mockCampSiteFindMany).not.toHaveBeenCalled();
  });

  it('[concurrent/ordering] sub-district WINS over district when both given — district narrows only the scoping, the result stays the single sub-district id, never the wider 3-id district set', async () => {
    const args = searchCampsitesArgsSchema.parse({ subDistrict: 'สุเทพ', district: 'เมืองเชียงใหม่' });
    await executeSearchCampsites(args);
    const ids = extractAdminAreaIdIn(mockCampSiteFindMany.mock.calls[0][0].where);
    expect(ids).toEqual(['sub-suthep']);
  });
});

// ===========================================================================
// AC-3/AC-4/AC-5 — aliases resolve to their canonical place
// ===========================================================================
describe('CAM-587 AC-3 — province alias resolves to its canonical province', () => {
  it('[normal] "โคราช" resolves to Nakhon Ratchasima, exactly as the formal name would', async () => {
    const args = searchCampsitesArgsSchema.parse({ province: 'โคราช' });
    await executeSearchCampsites(args);
    const where = mockCampSiteFindMany.mock.calls[0][0].where as { location: { province?: string; OR?: Array<{ province?: string }> } };
    const resolvedProvince = where.location.province ?? where.location.OR?.find((c) => c.province)?.province;
    expect(resolvedProvince).toBe('Nakhon Ratchasima');
  });
});

describe('CAM-587 AC-4 — region alias resolves to its canonical region\'s province set', () => {
  it('[normal] "ล้านนา" resolves to the SAME province set as "ภาคเหนือ"', async () => {
    const args = searchCampsitesArgsSchema.parse({ region: 'ล้านนา' });
    await executeSearchCampsites(args);
    const where = mockCampSiteFindMany.mock.calls[0][0].where as { location: { province?: { in: string[] } } };
    expect(where.location.province).toEqual({ in: [...REGION_TO_PROVINCES.NORTH] });
  });
});

describe('CAM-587 AC-5 — zone alias ("หัวหิน") resolves through the SAME district match as a plain-named district', () => {
  it('[normal] "หัวหิน" as `district` resolves to the REAL Hua Hin district (scoped by its own province alias data), never the same-named decoy under an unrelated province', async () => {
    const args = searchCampsitesArgsSchema.parse({ district: 'หัวหิน' });
    await executeSearchCampsites(args);
    const ids = extractAdminAreaIdIn(mockCampSiteFindMany.mock.calls[0][0].where);
    expect(ids).toContain('dist-huahin');
    expect(ids).not.toContain('dist-huahin-decoy');
  });
});

// ===========================================================================
// AC-6 — honest failure: an unresolved district/sub-district returns zero
// rows WITHOUT running the candidate query at all.
// ===========================================================================
describe('CAM-587 AC-6/BR-2 — an unresolvable district/sub-district fails honestly, never a fallback', () => {
  it('[null/empty] an unknown district name returns { cards: [] } and never calls campSite.findMany', async () => {
    const args = searchCampsitesArgsSchema.parse({ district: 'ไม่มีอำเภอนี้จริง' });
    const result = await executeSearchCampsites(args);
    expect(result).toEqual({ cards: [] });
    expect(mockCampSiteFindMany).not.toHaveBeenCalled();
  });

  it('[null/empty] an unknown sub-district name returns { cards: [] } and never calls campSite.findMany', async () => {
    const args = searchCampsitesArgsSchema.parse({ subDistrict: 'ไม่มีตำบลนี้จริง' });
    const result = await executeSearchCampsites(args);
    expect(result).toEqual({ cards: [] });
    expect(mockCampSiteFindMany).not.toHaveBeenCalled();
  });

  it('[error/validation] a scoping `province` that itself cannot be resolved fails the whole district lookup honestly, rather than searching unscoped', async () => {
    const args = searchCampsitesArgsSchema.parse({ district: 'เมืองเชียงใหม่', province: 'ดินแดนมหัศจรรย์' });
    const result = await executeSearchCampsites(args);
    expect(result).toEqual({ cards: [] });
    expect(mockCampSiteFindMany).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// BR-1 — the precedence ladder is pinned: near > subDistrict > district > province > region
// ===========================================================================
describe('CAM-587 BR-1 — precedence: `near` wins outright over `district`/`subDistrict`', () => {
  it('[concurrent/ordering] `near` + `district` both set — district is never consulted at all (no AdminArea lookup scoped to the district id)', async () => {
    const args = searchCampsitesArgsSchema.parse({ near: 'เชียงใหม่', district: 'เมืองเชียงใหม่' });
    await executeSearchCampsites(args);
    const consultedDistrictSubtree = mockAdminAreaFindMany.mock.calls.some(
      ([call]) => (call as { where: { parentId?: string } }).where.parentId === 'dist-mueang'
    );
    expect(consultedDistrictSubtree).toBe(false);
  });
});

describe('CAM-587 BR-1 — precedence: `district` wins over a bare `region` (region never expanded)', () => {
  it('[concurrent/ordering] `district` + `region` both set — the result is the district\'s own 3-id set, never the region\'s province-list shape', async () => {
    const args = searchCampsitesArgsSchema.parse({ district: 'เมืองเชียงใหม่', region: 'ภาคเหนือ' });
    await executeSearchCampsites(args);
    const where = mockCampSiteFindMany.mock.calls[0][0].where as { location?: { province?: unknown } };
    const ids = extractAdminAreaIdIn(where as { AND?: unknown });
    expect(new Set(ids)).toEqual(new Set(['dist-mueang', 'sub-suthep', 'sub-changphueak']));
    // region never expanded onto `where.location.province` — that branch is skipped entirely.
    expect(where.location?.province).toBeUndefined();
  });
});

describe('CAM-587 — jsonSchema advertises district/subDistrict (additive, additionalProperties stays false)', () => {
  it('[unit] jsonSchema.properties.district and .subDistrict exist', async () => {
    const { searchCampsitesTool } = await import('@/lib/ai/tools/search-campsites');
    const schema = searchCampsitesTool.jsonSchema as { properties: Record<string, unknown>; additionalProperties: boolean };
    expect(schema.properties.district).toBeDefined();
    expect(schema.properties.subDistrict).toBeDefined();
    expect(schema.additionalProperties).toBe(false);
  });
});
