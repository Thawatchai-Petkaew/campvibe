/**
 * cam-563-location-admin-area-backfill.test.ts — CAM-563
 * (platform-hardening/taxonomy-ui-foundation)
 *
 * `Location.adminAreaId` (prisma/schema.prisma:236) was designed as the FK
 * replacement for the free-text `province`/`district`/`subDistrict` columns
 * (comment at :239: "pending migration to adminArea") but was populated for
 * only 12 of 652 rows in the dev DB (measured). This suite proves
 * `scripts/backfill-cam-563-location-admin-area.mjs`'s matcher + backfill
 * runner: bilingual (Thai OR English) exact match, hierarchical (district
 * scoped to its resolved province, sub-district scoped to its resolved
 * district — never a same-named node in the wrong parent), idempotent
 * (second run touches 0 rows), and — the ticket's explicit ask — an
 * unresolvable value is REPORTED, never silently left null.
 *
 * Layers:
 *  (a) normalizeAdminAreaName — pure string transform (Prove-It: prefix/
 *      suffix stripping, never a substring match elsewhere)
 *  (b) matchAdminAreaByName / resolveLocationAdminAreaId — against a fake
 *      AdminArea tree (bilingual + hierarchical + parent-scoped)
 *  (c) runBackfill — against a fake Prisma client (idempotence + the
 *      unresolved report + never touches an already-resolved row)
 *  (d) checkGuard — safety guard (same pattern as cam-536/cam-538's own
 *      backfill-script coverage)
 *
 * Coverage matrix (qa.md §7): normal · null/empty · boundary · error/
 * validation · concurrent/ordering (idempotent re-run).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  normalizeAdminAreaName,
  matchAdminAreaByName,
  resolveLocationAdminAreaId,
  runBackfill,
  checkGuard,
} from '../scripts/backfill-cam-563-location-admin-area.mjs';

// ===========================================================================
// Fake AdminArea tree — one resolvable province (Chiang Mai, bilingual, full
// 3-level hierarchy), one province-only match (Krabi), and NO entry at all
// for "Atlantis" (the deliberately-unresolvable case).
// ===========================================================================
const ADMIN_AREAS = [
  { id: 'prov-cnx', level: 'PROVINCE', nameEn: 'Chiang Mai', nameTh: 'เชียงใหม่', parentId: null },
  { id: 'dist-mueang-cnx', level: 'DISTRICT', nameEn: 'Mueang Chiang Mai', nameTh: 'เมืองเชียงใหม่', parentId: 'prov-cnx' },
  { id: 'sub-suthep', level: 'SUBDISTRICT', nameEn: 'Suthep', nameTh: 'สุเทพ', parentId: 'dist-mueang-cnx' },
  { id: 'prov-krabi', level: 'PROVINCE', nameEn: 'Krabi', nameTh: 'กระบี่', parentId: null },
];

function makeFakePrisma(locations: Array<Record<string, unknown>>) {
  const data = locations.map((l) => ({ ...l }));
  return {
    data,
    location: {
      count: async ({ where }: { where?: Record<string, unknown> } = {}) => {
        if (!where) return data.length;
        return data.filter((row) => {
          if ('adminAreaId' in where) {
            const clause = where.adminAreaId as { not?: null } | null;
            if (clause === null) return row.adminAreaId === null;
            if (clause?.not === null) return row.adminAreaId !== null && row.adminAreaId !== undefined;
          }
          return true;
        }).length;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        return data
          .filter((row) => {
            if (where.adminAreaId === null && row.adminAreaId !== null && row.adminAreaId !== undefined) return false;
            const provinceClause = where.province as { not: null } | undefined;
            if (provinceClause && (row.province === null || row.province === undefined)) return false;
            return true;
          })
          .map((row) => ({
            id: row.id,
            province: row.province,
            district: row.district ?? null,
            subDistrict: row.subDistrict ?? null,
            campSites: row.hasLiveCamp ? [{ id: `camp-for-${row.id}` }] : [],
          }));
      },
      update: async ({ where, data: patch }: { where: { id: string }; data: { adminAreaId: string } }) => {
        const row = data.find((r) => r.id === where.id);
        if (!row) throw new Error(`no row for id ${where.id}`);
        Object.assign(row, patch);
        return { ...row };
      },
    },
    adminArea: {
      findFirst: async ({ where }: { where: { level: string; parentId?: string; OR: Array<{ nameTh?: { equals: string }; nameEn?: { equals: string } }> } }) => {
        const wantedNames = where.OR.map((c) => (c.nameTh ?? c.nameEn)!.equals.toLowerCase());
        const found = ADMIN_AREAS.find((a) => {
          if (a.level !== where.level) return false;
          if (where.parentId !== undefined && a.parentId !== where.parentId) return false;
          return wantedNames.includes(a.nameTh.toLowerCase()) || wantedNames.includes(a.nameEn.toLowerCase());
        });
        return found ? { id: found.id } : null;
      },
    },
  };
}

// ===========================================================================
// (a) normalizeAdminAreaName — pure prefix/suffix strip
// ===========================================================================
describe('CAM-563 (a) — normalizeAdminAreaName: deterministic prefix/suffix strip', () => {
  it('[normal] strips a Thai "จังหวัด" prefix', () => {
    expect(normalizeAdminAreaName('จังหวัดเชียงใหม่')).toBe('เชียงใหม่');
  });

  it('[normal] strips an English "Changwat " prefix', () => {
    expect(normalizeAdminAreaName('Changwat Chiang Mai')).toBe('Chiang Mai');
  });

  it('[normal] strips an English " Province" suffix', () => {
    expect(normalizeAdminAreaName('Chiang Mai Province')).toBe('Chiang Mai');
  });

  it('[null/empty] an empty/whitespace-only string passes through unchanged', () => {
    expect(normalizeAdminAreaName('')).toBe('');
    expect(normalizeAdminAreaName('   ')).toBe('');
  });

  it('[normal] a bare name with no prefix/suffix is returned unchanged (trimmed)', () => {
    expect(normalizeAdminAreaName('  Chiang Mai  ')).toBe('Chiang Mai');
  });
});

// ===========================================================================
// (b) matchAdminAreaByName / resolveLocationAdminAreaId — bilingual +
// hierarchical, parent-scoped
// ===========================================================================
describe('CAM-563 (b) — matchAdminAreaByName: bilingual + parent-scoped exact match', () => {
  const fake = makeFakePrisma([]);

  it('[normal] matches the English name', async () => {
    const result = await matchAdminAreaByName(fake, 'PROVINCE', 'Chiang Mai');
    expect(result).toEqual({ id: 'prov-cnx' });
  });

  it('[normal] matches the Thai name (bilingual)', async () => {
    const result = await matchAdminAreaByName(fake, 'PROVINCE', 'เชียงใหม่');
    expect(result).toEqual({ id: 'prov-cnx' });
  });

  it('[normal] a district match is scoped to its parent province id', async () => {
    const result = await matchAdminAreaByName(fake, 'DISTRICT', 'Mueang Chiang Mai', 'prov-cnx');
    expect(result).toEqual({ id: 'dist-mueang-cnx' });
  });

  it('[error/validation] the SAME district name scoped to the WRONG province parent does not match', async () => {
    const result = await matchAdminAreaByName(fake, 'DISTRICT', 'Mueang Chiang Mai', 'prov-krabi');
    expect(result).toBeNull();
  });

  it('[null/empty] an unknown name matches nothing', async () => {
    const result = await matchAdminAreaByName(fake, 'PROVINCE', 'Atlantis');
    expect(result).toBeNull();
  });
});

describe('CAM-563 (b) — resolveLocationAdminAreaId: deepest-level resolution + hierarchy stop', () => {
  const fake = makeFakePrisma([]);

  it('[normal] province + district + subDistrict all resolve -> SUBDISTRICT id (deepest)', async () => {
    const id = await resolveLocationAdminAreaId(fake, {
      province: 'Chiang Mai', district: 'Mueang Chiang Mai', subDistrict: 'Suthep',
    });
    expect(id).toBe('sub-suthep');
  });

  it('[normal] Thai-language input resolves to the SAME id as English (bilingual, id-based)', async () => {
    const id = await resolveLocationAdminAreaId(fake, {
      province: 'เชียงใหม่', district: 'เมืองเชียงใหม่', subDistrict: 'สุเทพ',
    });
    expect(id).toBe('sub-suthep');
  });

  it('[boundary] province only -> PROVINCE id', async () => {
    const id = await resolveLocationAdminAreaId(fake, { province: 'Krabi', district: null, subDistrict: null });
    expect(id).toBe('prov-krabi');
  });

  it('[boundary] province + district (no subDistrict) -> DISTRICT id', async () => {
    const id = await resolveLocationAdminAreaId(fake, { province: 'Chiang Mai', district: 'Mueang Chiang Mai', subDistrict: null });
    expect(id).toBe('dist-mueang-cnx');
  });

  it('[error/validation] district given but unmatched -> stops at PROVINCE (never guesses the next level)', async () => {
    const id = await resolveLocationAdminAreaId(fake, { province: 'Chiang Mai', district: 'Nonexistent District', subDistrict: 'Suthep' });
    expect(id).toBe('prov-cnx');
  });

  it('[null/empty] province itself unmatched -> null (unresolvable, reported by runBackfill below)', async () => {
    const id = await resolveLocationAdminAreaId(fake, { province: 'Atlantis', district: null, subDistrict: null });
    expect(id).toBeNull();
  });

  it('[null/empty] no province at all -> null', async () => {
    const id = await resolveLocationAdminAreaId(fake, { province: null, district: null, subDistrict: null });
    expect(id).toBeNull();
  });
});

// ===========================================================================
// (c) runBackfill — idempotent, never overwrites, reports the unresolved
// ===========================================================================
describe('CAM-563 (c) — runBackfill: resolves candidates, reports the unresolved, never overwrites', () => {
  const seedRows = [
    { id: 'loc-1', province: 'Chiang Mai', district: null, subDistrict: null, adminAreaId: null, hasLiveCamp: true },
    { id: 'loc-2', province: 'เชียงใหม่', district: null, subDistrict: null, adminAreaId: null, hasLiveCamp: true }, // Thai-stored — the root-cause case
    { id: 'loc-3', province: 'Krabi', district: null, subDistrict: null, adminAreaId: 'prov-krabi', hasLiveCamp: true }, // ALREADY resolved — must not be re-touched
    { id: 'loc-4', province: 'x', district: null, subDistrict: null, adminAreaId: null, hasLiveCamp: false }, // orphaned placeholder — unresolvable
  ];

  it('[AC, teeth] resolves every candidate whose province matches (English AND Thai), skips the already-resolved row, and reports the unresolvable one', async () => {
    const fake = makeFakePrisma(seedRows);
    const report = await runBackfill(fake, { log: () => {} });

    expect(report.total).toBe(4);
    expect(report.beforeResolved).toBe(1); // only loc-3
    expect(report.candidates).toBe(3); // loc-1, loc-2, loc-4 (loc-3 already resolved, excluded)
    expect(report.updated).toBe(2); // loc-1, loc-2 resolve; loc-4 does not
    expect(report.afterResolved).toBe(3); // loc-1, loc-2, loc-3

    expect(fake.data.find((r) => r.id === 'loc-1')!.adminAreaId).toBe('prov-cnx');
    expect(fake.data.find((r) => r.id === 'loc-2')!.adminAreaId).toBe('prov-cnx'); // Thai input -> SAME id as English
    expect(fake.data.find((r) => r.id === 'loc-3')!.adminAreaId).toBe('prov-krabi'); // untouched
  });

  it('[teeth] the unresolved value is REPORTED with its id + value + live-camp flag — never a silent null', async () => {
    const fake = makeFakePrisma(seedRows);
    const report = await runBackfill(fake, { log: () => {} });

    expect(report.unresolved).toHaveLength(1);
    expect(report.unresolved[0]).toMatchObject({ id: 'loc-4', province: 'x', hasLiveCamp: false });
  });

  it('[EC, idempotent] a second run touches 0 rows (already-resolved rows are excluded from the candidate query, never re-written)', async () => {
    const fake = makeFakePrisma(seedRows);
    await runBackfill(fake, { log: () => {} });
    const afterFirstRun = fake.data.map((r) => ({ ...r }));

    const second = await runBackfill(fake, { log: () => {} });

    expect(second.updated).toBe(0);
    expect(second.candidates).toBe(1); // only loc-4 remains a candidate (still unresolved)
    expect(fake.data).toEqual(afterFirstRun);
  });

  it('[null/empty] a Location with no province at all is never a candidate (nothing to resolve)', async () => {
    const fake = makeFakePrisma([{ id: 'loc-5', province: null, district: null, subDistrict: null, adminAreaId: null, hasLiveCamp: false }]);
    const report = await runBackfill(fake, { log: () => {} });
    expect(report.candidates).toBe(0);
    expect(report.updated).toBe(0);
    expect(report.unresolved).toHaveLength(0);
  });
});

// ===========================================================================
// (d) checkGuard — refuses before touching any row (mirrors cam-536/538's
// own backfill-script coverage; db-reset.mjs's describeUrlShape is reused)
// ===========================================================================
describe('CAM-563 (d) — checkGuard: refuses a run missing opt-in / DATABASE_URL / a production-looking target', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('[error/validation] refuses when ALLOW_LOCATION_ADMIN_AREA_BACKFILL is unset', () => {
    vi.stubEnv('ALLOW_LOCATION_ADMIN_AREA_BACKFILL', '');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/campvibe_dev');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('ALLOW_LOCATION_ADMIN_AREA_BACKFILL=1');
  });

  it('[error/validation] refuses when DATABASE_URL is unset', () => {
    vi.stubEnv('ALLOW_LOCATION_ADMIN_AREA_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', '');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('DATABASE_URL is not set');
  });

  it('[error/validation] refuses when the target URL looks like production', () => {
    vi.stubEnv('ALLOW_LOCATION_ADMIN_AREA_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pw@prod-db.example.com:5432/campvibe');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL_ENV', '');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('PRODUCTION');
  });

  it('[normal] allows when opt-in + DATABASE_URL are set and the target does not look like production', () => {
    vi.stubEnv('ALLOW_LOCATION_ADMIN_AREA_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/campvibe_dev');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL_ENV', '');
    const result = checkGuard();
    expect(result.ok).toBe(true);
  });
});
