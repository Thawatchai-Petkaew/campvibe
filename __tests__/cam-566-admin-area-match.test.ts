/**
 * cam-566-admin-area-match.test.ts — CAM-566
 * (platform-hardening/taxonomy-ui-foundation)
 *
 * Pins `lib/geo/admin-area-match.ts` — the ONE shared bilingual, hierarchical
 * AdminArea matcher consolidated from THREE independently-drifting ports
 * (`app/api/geocode/_shared.ts` CAM-554, `app/api/location/route.ts` and
 * `scripts/backfill-cam-563-location-admin-area.mjs` both CAM-563). Every
 * row of this suite exercises one line of the enumerated-diff table in
 * `tech.md` directly against the shared module, so the union of behaviours
 * the three prior copies relied on is provably kept, not just asserted.
 *
 * `__tests__/cam-554-geocode-routes.test.ts` and
 * `__tests__/cam-563-location-admin-area-backfill.test.ts` /
 * `__tests__/cam-563-location-route-admin-area.test.ts` remain the
 * integration-level proof (run UNEDITED, still green) that each caller's
 * own contract survived the move; this file is the unit-level proof of the
 * shared primitive itself.
 *
 * Coverage matrix (qa.md §7): normal · null/empty · boundary · error/
 * validation · concurrent/ordering.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  normalizeAdminName,
  matchAdminArea,
  type AdminAreaMatchPrisma,
} from '@/lib/geo/admin-area-match';

// ===========================================================================
// Fake AdminArea tree — one resolvable province (Chiang Mai, bilingual, full
// 3-level hierarchy), one province-only match (Krabi) with a SAME-NAMED
// district as another province's district (to prove parent-scoping), and no
// entry at all for "Atlantis" (deliberately unresolvable).
// ===========================================================================
const ADMIN_AREAS = [
  { id: 'prov-cnx', code: '50', level: 'PROVINCE', nameEn: 'Chiang Mai', nameTh: 'เชียงใหม่', parentId: null },
  { id: 'dist-mueang-cnx', code: '5001', level: 'DISTRICT', nameEn: 'Mueang Chiang Mai', nameTh: 'เมืองเชียงใหม่', parentId: 'prov-cnx' },
  { id: 'sub-suthep', code: '500101', level: 'SUBDISTRICT', nameEn: 'Suthep', nameTh: 'สุเทพ', parentId: 'dist-mueang-cnx' },
  { id: 'prov-krabi', code: '81', level: 'PROVINCE', nameEn: 'Krabi', nameTh: 'กระบี่', parentId: null },
  // Same district NAME as Chiang Mai's, but under Krabi — proves parent-scoping never cross-matches.
  { id: 'dist-mueang-krabi', code: '8101', level: 'DISTRICT', nameEn: 'Mueang Chiang Mai', nameTh: 'เมืองเชียงใหม่', parentId: 'prov-krabi' },
];

function makeFakePrisma(): { prisma: AdminAreaMatchPrisma; findFirstSpy: ReturnType<typeof vi.fn> } {
  const findFirstSpy = vi.fn(async ({ where }: { where: { level: string; parentId?: string; OR: Array<{ nameTh?: { equals: string }; nameEn?: { equals: string } }> } }) => {
    const wantedNames = where.OR.map((c) => (c.nameTh ?? c.nameEn)!.equals.toLowerCase());
    const found = ADMIN_AREAS.find((a) => {
      if (a.level !== where.level) return false;
      if (where.parentId !== undefined && a.parentId !== where.parentId) return false;
      return wantedNames.includes(a.nameTh.toLowerCase()) || wantedNames.includes(a.nameEn.toLowerCase());
    });
    return found ?? null;
  });
  const prisma = { adminArea: { findFirst: findFirstSpy } } as unknown as AdminAreaMatchPrisma;
  return { prisma, findFirstSpy };
}

// ===========================================================================
// (a) normalizeAdminName — prefix/suffix strip, null/undefined-safe
// ===========================================================================
describe('CAM-566 (a) — normalizeAdminName: deterministic strip, null/undefined-safe', () => {
  it('[normal] strips a Thai "จังหวัด" prefix', () => {
    expect(normalizeAdminName('จังหวัดเชียงใหม่')).toBe('เชียงใหม่');
  });

  it('[normal] strips an English "Changwat " prefix', () => {
    expect(normalizeAdminName('Changwat Chiang Mai')).toBe('Chiang Mai');
  });

  it('[normal] strips an English " Province" suffix', () => {
    expect(normalizeAdminName('Chiang Mai Province')).toBe('Chiang Mai');
  });

  it('[normal] a bare name with no prefix/suffix is returned unchanged (trimmed)', () => {
    expect(normalizeAdminName('  Chiang Mai  ')).toBe('Chiang Mai');
  });

  it('[null/empty] null input returns "" (CAM-563 backfill\'s stricter guard, preserved)', () => {
    expect(normalizeAdminName(null)).toBe('');
  });

  it('[null/empty] undefined input returns ""', () => {
    expect(normalizeAdminName(undefined)).toBe('');
  });

  it('[null/empty] an empty/whitespace-only string passes through unchanged', () => {
    expect(normalizeAdminName('')).toBe('');
    expect(normalizeAdminName('   ')).toBe('');
  });

  it('[boundary] a name that IS only the prefix normalizes to "" (nothing left after stripping)', () => {
    expect(normalizeAdminName('จังหวัด')).toBe('');
  });
});

// ===========================================================================
// (b) matchAdminArea — bilingual + hierarchical + exact-match + full node
// ===========================================================================
describe('CAM-566 (b) — matchAdminArea: bilingual match resolves the SAME node', () => {
  it('[normal] matches the English name', async () => {
    const { prisma } = makeFakePrisma();
    const result = await matchAdminArea(prisma, 'PROVINCE', 'Chiang Mai');
    expect(result?.id).toBe('prov-cnx');
  });

  it('[normal] matches the Thai name — resolves to the SAME id as English (bilingual)', async () => {
    const { prisma } = makeFakePrisma();
    const result = await matchAdminArea(prisma, 'PROVINCE', 'เชียงใหม่');
    expect(result?.id).toBe('prov-cnx');
  });

  it('[normal] a raw name carrying a known prefix (Thai OR English) still resolves — normalization happens internally now', async () => {
    const { prisma } = makeFakePrisma();
    const th = await matchAdminArea(prisma, 'PROVINCE', 'จังหวัดเชียงใหม่');
    const en = await matchAdminArea(prisma, 'PROVINCE', 'Changwat Chiang Mai');
    expect(th?.id).toBe('prov-cnx');
    expect(en?.id).toBe('prov-cnx');
  });
});

describe('CAM-566 (b) — matchAdminArea: returns the FULL node (superset of the id-only ports)', () => {
  it('[normal] the resolved node carries id, code, nameTh, nameEn, parentId — not just id', async () => {
    const { prisma } = makeFakePrisma();
    const result = await matchAdminArea(prisma, 'PROVINCE', 'Chiang Mai');
    expect(result).toEqual({ id: 'prov-cnx', code: '50', level: 'PROVINCE', nameEn: 'Chiang Mai', nameTh: 'เชียงใหม่', parentId: null });
  });
});

describe('CAM-566 (b) — matchAdminArea: hierarchical, parent-scoped (never a same-named cross-province match)', () => {
  it('[normal] a district match is scoped to its parent province id', async () => {
    const { prisma } = makeFakePrisma();
    const result = await matchAdminArea(prisma, 'DISTRICT', 'Mueang Chiang Mai', 'prov-cnx');
    expect(result?.id).toBe('dist-mueang-cnx');
  });

  it('[error/validation] the SAME district name under the WRONG province parent does not match (DEF-1/DEF-2 lesson)', async () => {
    const { prisma } = makeFakePrisma();
    // "Mueang Chiang Mai" exists under BOTH prov-cnx and prov-krabi (fixture)
    // — scoping to a THIRD, unrelated parent must resolve nothing.
    const result = await matchAdminArea(prisma, 'DISTRICT', 'Mueang Chiang Mai', 'prov-does-not-exist');
    expect(result).toBeNull();
  });

  it('[normal] a district match scoped to a DIFFERENT valid parent resolves the OTHER same-named node, never the wrong one', async () => {
    const { prisma } = makeFakePrisma();
    const result = await matchAdminArea(prisma, 'DISTRICT', 'Mueang Chiang Mai', 'prov-krabi');
    expect(result?.id).toBe('dist-mueang-krabi');
  });

  it('[boundary] no parentId given -> unscoped top-level lookup still works (PROVINCE has no parent to scope by)', async () => {
    const { prisma } = makeFakePrisma();
    const result = await matchAdminArea(prisma, 'PROVINCE', 'Krabi');
    expect(result?.id).toBe('prov-krabi');
  });
});

describe('CAM-566 (b) — matchAdminArea: null/empty + the empty-name short-circuit (no wasted DB call)', () => {
  it('[null/empty] an unknown name matches nothing', async () => {
    const { prisma } = makeFakePrisma();
    const result = await matchAdminArea(prisma, 'PROVINCE', 'Atlantis');
    expect(result).toBeNull();
  });

  it('[null/empty] null rawName -> null, WITHOUT ever calling the DB (normalizes to "", short-circuits)', async () => {
    const { prisma, findFirstSpy } = makeFakePrisma();
    const result = await matchAdminArea(prisma, 'PROVINCE', null);
    expect(result).toBeNull();
    expect(findFirstSpy).not.toHaveBeenCalled();
  });

  it('[boundary, EC-3] a rawName that IS only a stripped prefix ("จังหวัด" alone) normalizes to "" -> null, zero DB round-trips', async () => {
    const { prisma, findFirstSpy } = makeFakePrisma();
    const result = await matchAdminArea(prisma, 'PROVINCE', 'จังหวัด');
    expect(result).toBeNull();
    expect(findFirstSpy).not.toHaveBeenCalled();
  });

  it('[normal] a real, non-empty name DOES hit the DB exactly once', async () => {
    const { prisma, findFirstSpy } = makeFakePrisma();
    await matchAdminArea(prisma, 'PROVINCE', 'Chiang Mai');
    expect(findFirstSpy).toHaveBeenCalledTimes(1);
  });
});

describe('CAM-566 (b) — matchAdminArea: exact-equality only, never a substring match', () => {
  it('[error/validation] a substring of a real name does not match (DEF-1/DEF-2 Thai-substring collision lesson)', async () => {
    const { prisma } = makeFakePrisma();
    // "Chiang Mai" is a substring of nothing here, but "Mai" alone (a
    // substring of "Chiang Mai") must NOT match — exact-equals only.
    const result = await matchAdminArea(prisma, 'PROVINCE', 'Mai');
    expect(result).toBeNull();
  });
});

describe('CAM-566 (c) — concurrent/ordering: independent calls never share/leak state', () => {
  it('[concurrent] two concurrent lookups for different provinces resolve independently and correctly', async () => {
    const { prisma } = makeFakePrisma();
    const [cnx, krabi] = await Promise.all([
      matchAdminArea(prisma, 'PROVINCE', 'Chiang Mai'),
      matchAdminArea(prisma, 'PROVINCE', 'Krabi'),
    ]);
    expect(cnx?.id).toBe('prov-cnx');
    expect(krabi?.id).toBe('prov-krabi');
  });
});

// ===========================================================================
// (d) Real-world validation — CAM-562's actual backfill-run shapes
// (519 sub-district / 17 district-only / 83 province-mismatch-not-applied /
// 31 unresolved incl. 16 outside Thailand) all reduce to: "stop at the
// deepest matched level, or null if even PROVINCE misses — never throw,
// never guess deeper." This suite proves that contract directly.
// ===========================================================================
describe('CAM-566 (d) — real-world shape: an unmatched level stops the walk, never throws/guesses', () => {
  it('[EC-5] a province name entirely outside the AdminArea tree (e.g. a neighboring-country region) resolves to null, not a crash', async () => {
    const { prisma } = makeFakePrisma();
    const result = await matchAdminArea(prisma, 'PROVINCE', 'Bolikhamsai Province');
    expect(result).toBeNull();
  });

  it('[EC-5] a matched province with an unmatched district still returns the province-level caller a clean null for that district call (caller decides to stop at province, proven at the route/backfill integration level)', async () => {
    const { prisma } = makeFakePrisma();
    const province = await matchAdminArea(prisma, 'PROVINCE', 'Chiang Mai');
    expect(province?.id).toBe('prov-cnx');
    const district = await matchAdminArea(prisma, 'DISTRICT', 'Nonexistent District', province!.id);
    expect(district).toBeNull();
  });
});
