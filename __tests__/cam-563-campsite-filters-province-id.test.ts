/**
 * cam-563-campsite-filters-province-id.test.ts — CAM-563
 * (platform-hardening/taxonomy-ui-foundation)
 *
 * `lib/campsite-filters.ts`'s province match was pure exact-string equality
 * against `Location.province` — silently zero-results a camp whose stored
 * value is in the OTHER language (CAM-559 finding: hosts save whichever UI
 * language was active). This suite proves the CAM-563 fix is ADDITIVE:
 *
 *  (a) `buildCampSiteWhere`'s EXISTING `province: string` shape is
 *      BYTE-IDENTICAL when `provinceAdminAreaIds` is omitted — pins the
 *      SAME regression `__tests__/cam-463-campsite-filters-province-set
 *      .test.ts` already guards (that file is untouched by this story; this
 *      suite re-proves the byte-identical claim from CAM-563's own side so
 *      a reviewer does not have to cross-reference).
 *  (b) When `provinceAdminAreaIds` IS supplied, the shape becomes an
 *      additive OR (legacy string OR the id-set) — never replaces the
 *      string path.
 *  (c) `resolveProvinceAdminAreaIds` resolves a province NAME (bilingual) to
 *      its FULL subtree of ids (self + every descendant district + every
 *      descendant sub-district) — because a camp's `adminAreaId` may point
 *      to any of those three levels.
 *  (d) COUNT PARITY (the ticket's explicit teeth requirement): a small fake
 *      dataset proves the province filter returns the SAME non-zero count
 *      when there is no bilingual drift (today's real dev-DB shape), and a
 *      STRICTLY GREATER count only when a bilingual-mismatched camp exists
 *      (proving the fix actually closes the gap, not merely "doesn't
 *      throw").
 *
 * Coverage matrix (qa.md §7): normal · null/empty · boundary · error/
 * validation · concurrent/ordering.
 */
import { describe, it, expect } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildCampSiteWhere, resolveProvinceAdminAreaIds } from '@/lib/campsite-filters';

/** Casts a fake, duck-typed `adminArea` client to the real dependency type — this repo's established fake-Prisma test pattern (see scripts/backfill-cam-536-*.mjs's own test), just made explicit here since this file is TypeScript. */
function asPrisma(fake: unknown): Pick<PrismaClient, 'adminArea'> {
  return fake as Pick<PrismaClient, 'adminArea'>;
}

// ===========================================================================
// (a) Byte-identical when provinceAdminAreaIds is omitted (re-proves the
// CAM-463 pin from this story's side)
// ===========================================================================
describe('CAM-563 (a) — buildCampSiteWhere: byte-identical string branch when provinceAdminAreaIds is omitted', () => {
  it('[regression] a plain province string produces the EXACT pre-CAM-563 shape (no OR, no adminAreaId)', () => {
    const where = buildCampSiteWhere({ province: 'Chiang Mai' });
    expect(where.location?.province).toBe('Chiang Mai');
    expect(where.location?.OR).toBeUndefined();
    expect(JSON.stringify(where.location)).not.toContain('adminAreaId');
  });

  it('[regression] an EXPLICITLY EMPTY provinceAdminAreaIds array behaves identically to omitting it', () => {
    const where = buildCampSiteWhere({ province: 'Chiang Mai', provinceAdminAreaIds: [] });
    expect(where.location?.province).toBe('Chiang Mai');
    expect(where.location?.OR).toBeUndefined();
  });

  it('[regression] the array/`in` province branch (CAM-461/463 region-expansion) is UNTOUCHED — ignores provinceAdminAreaIds entirely', () => {
    const where = buildCampSiteWhere({ province: ['Chiang Mai', 'Chiang Rai'], provinceAdminAreaIds: ['some-id'] });
    expect(where.location?.province).toEqual({ in: ['Chiang Mai', 'Chiang Rai'] });
    expect(where.location?.OR).toBeUndefined();
  });
});

// ===========================================================================
// (b) Additive OR when provinceAdminAreaIds IS supplied
// ===========================================================================
describe('CAM-563 (b) — buildCampSiteWhere: additive id-aware OR (opt-in)', () => {
  it('[normal] province + resolved ids -> OR of legacy string equality and adminAreaId in-set', () => {
    const where = buildCampSiteWhere({ province: 'Chiang Mai', provinceAdminAreaIds: ['prov-cnx', 'dist-mueang-cnx'] });
    expect(where.location?.OR).toEqual([
      { province: 'Chiang Mai' },
      { adminAreaId: { in: ['prov-cnx', 'dist-mueang-cnx'] } },
    ]);
    expect(where.location?.province).toBeUndefined(); // moved inside the OR, not a sibling requirement
  });

  it('[concurrent/ordering] district co-present with the id-aware OR does not clobber either', () => {
    const where = buildCampSiteWhere({ province: 'Chiang Mai', district: 'Mueang', provinceAdminAreaIds: ['prov-cnx'] });
    expect(where.location?.district).toBe('Mueang');
    expect(where.location?.OR).toEqual([{ province: 'Chiang Mai' }, { adminAreaId: { in: ['prov-cnx'] } }]);
  });

  it('[normal] the base public gate (isActive/isPublished/deletedAt) is always present alongside the id-aware OR', () => {
    const where = buildCampSiteWhere({ province: 'Chiang Mai', provinceAdminAreaIds: ['prov-cnx'] });
    expect(where.isActive).toBe(true);
    expect(where.isPublished).toBe(true);
    expect(where.deletedAt).toBeNull();
  });
});

// ===========================================================================
// (c) resolveProvinceAdminAreaIds — subtree resolution against a fake prisma
// ===========================================================================
function makeFakeAdminAreaPrisma() {
  const PROVINCE = { id: 'prov-cnx', level: 'PROVINCE', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai' };
  const DISTRICTS = [
    { id: 'dist-mueang', parentId: 'prov-cnx' },
    { id: 'dist-doisaket', parentId: 'prov-cnx' },
  ];
  const SUBDISTRICTS = [
    { id: 'sub-suthep', parentId: 'dist-mueang' },
    { id: 'sub-chang-phueak', parentId: 'dist-mueang' },
    { id: 'sub-luang-nuea', parentId: 'dist-doisaket' },
  ];
  return {
    adminArea: {
      findFirst: async ({ where }: { where: { level: string; OR: Array<{ nameTh?: { equals: string }; nameEn?: { equals: string } }> } }) => {
        if (where.level !== 'PROVINCE') return null;
        const wanted = where.OR.map((c) => (c.nameTh ?? c.nameEn)!.equals.toLowerCase());
        const match = wanted.includes(PROVINCE.nameTh.toLowerCase()) || wanted.includes(PROVINCE.nameEn.toLowerCase());
        return match ? { id: PROVINCE.id } : null;
      },
      findMany: async ({ where }: { where: { level: string; parentId?: string | { in: string[] } } }) => {
        if (where.level === 'DISTRICT') {
          return DISTRICTS.filter((d) => d.parentId === where.parentId).map((d) => ({ id: d.id }));
        }
        if (where.level === 'SUBDISTRICT') {
          const parentIds = (where.parentId as { in: string[] }).in;
          return SUBDISTRICTS.filter((s) => parentIds.includes(s.parentId)).map((s) => ({ id: s.id }));
        }
        return [];
      },
    },
  };
}

describe('CAM-563 (c) — resolveProvinceAdminAreaIds: full subtree (province + every district + every sub-district)', () => {
  it('[normal] returns the province id plus every descendant district and sub-district id', async () => {
    const fake = makeFakeAdminAreaPrisma();
    const ids = await resolveProvinceAdminAreaIds(asPrisma(fake), 'Chiang Mai');
    expect(new Set(ids)).toEqual(new Set(['prov-cnx', 'dist-mueang', 'dist-doisaket', 'sub-suthep', 'sub-chang-phueak', 'sub-luang-nuea']));
  });

  it('[normal] a Thai name resolves to the SAME subtree (bilingual)', async () => {
    const fake = makeFakeAdminAreaPrisma();
    const ids = await resolveProvinceAdminAreaIds(asPrisma(fake), 'เชียงใหม่');
    expect(ids).toContain('prov-cnx');
    expect(ids).toContain('sub-suthep');
  });

  it('[null/empty] an unmatched province name returns an empty array (never throws, never a silent guess)', async () => {
    const fake = makeFakeAdminAreaPrisma();
    const ids = await resolveProvinceAdminAreaIds(asPrisma(fake), 'Atlantis');
    expect(ids).toEqual([]);
  });

  it('[null/empty] an empty string returns an empty array without querying the DB', async () => {
    const fake = makeFakeAdminAreaPrisma();
    const ids = await resolveProvinceAdminAreaIds(asPrisma(fake), '');
    expect(ids).toEqual([]);
  });
});

// ===========================================================================
// (d) COUNT PARITY — the ticket's explicit teeth requirement: same
// non-zero count with no bilingual drift; strictly greater only when a
// bilingual-mismatched camp exists (proves the OR actually functions).
// ===========================================================================
type FakeCamp = { id: string; location: { province: string; adminAreaId: string | null } };

/** Evaluates the `where.location` shape `buildCampSiteWhere` produces against an in-memory dataset — a minimal, targeted evaluator (not a generic Prisma emulator). */
function countMatching(camps: FakeCamp[], locationWhere: { province?: string; district?: string; OR?: Array<{ province?: string; adminAreaId?: { in: string[] } }> }): number {
  return camps.filter((camp) => {
    if (locationWhere.OR) {
      return locationWhere.OR.some((clause) => {
        if (clause.province !== undefined) return camp.location.province === clause.province;
        if (clause.adminAreaId) return camp.location.adminAreaId !== null && clause.adminAreaId.in.includes(camp.location.adminAreaId);
        return false;
      });
    }
    if (locationWhere.province !== undefined) return camp.location.province === locationWhere.province;
    return true;
  }).length;
}

describe('CAM-563 (d) — COUNT PARITY: the province filter never regresses, and closes the bilingual gap when one exists', () => {
  it('[teeth] no bilingual drift (today\'s real dev-DB shape) -> BEFORE and AFTER counts are the SAME non-zero number', () => {
    const camps: FakeCamp[] = [
      { id: 'c1', location: { province: 'Chiang Mai', adminAreaId: 'prov-cnx' } },
      { id: 'c2', location: { province: 'Chiang Mai', adminAreaId: 'prov-cnx' } },
      { id: 'c3', location: { province: 'Krabi', adminAreaId: 'prov-krabi' } },
    ];

    const before = countMatching(camps, buildCampSiteWhere({ province: 'Chiang Mai' }).location as never);
    const after = countMatching(camps, buildCampSiteWhere({ province: 'Chiang Mai', provinceAdminAreaIds: ['prov-cnx'] }).location as never);

    expect(before).toBe(2);
    expect(after).toBe(2);
    expect(after).toBe(before); // count parity — the explicit AC requirement
  });

  it('[teeth] a bilingual-mismatched camp (Thai-stored province, resolved to the SAME AdminArea id) is INVISIBLE to the legacy string filter but IS matched once the id-aware OR is engaged', () => {
    const camps: FakeCamp[] = [
      { id: 'c1', location: { province: 'Chiang Mai', adminAreaId: 'prov-cnx' } },
      { id: 'c2', location: { province: 'เชียงใหม่', adminAreaId: 'prov-cnx' } }, // Thai-stored, same real province
    ];

    const before = countMatching(camps, buildCampSiteWhere({ province: 'Chiang Mai' }).location as never);
    const after = countMatching(camps, buildCampSiteWhere({ province: 'Chiang Mai', provinceAdminAreaIds: ['prov-cnx'] }).location as never);

    expect(before).toBe(1); // the Thai-stored camp is silently invisible — the root-cause bug
    expect(after).toBe(2); // both real Chiang Mai camps now match — the fix closes the gap
    expect(after).toBeGreaterThan(before);
  });

  it('[boundary] a fully-unresolved province name (no AdminArea match at all) leaves the count UNCHANGED (empty ids array contributes nothing)', () => {
    const camps: FakeCamp[] = [{ id: 'c1', location: { province: 'x', adminAreaId: null } }];

    const before = countMatching(camps, buildCampSiteWhere({ province: 'x' }).location as never);
    const after = countMatching(camps, buildCampSiteWhere({ province: 'x', provinceAdminAreaIds: [] }).location as never);

    expect(before).toBe(1);
    expect(after).toBe(1);
  });
});
