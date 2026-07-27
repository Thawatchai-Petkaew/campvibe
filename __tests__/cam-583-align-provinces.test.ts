/**
 * cam-583-align-provinces.test.ts — CAM-583
 * (platform-hardening/taxonomy-ui-foundation)
 *
 * `scripts/backfill-cam-583-align-provinces.mjs` reuses CAM-562's own
 * `provinceMismatch` classification (a row whose geocoded province disagrees
 * with its stored, adjacent, Thai province) and, for each, forward-geocodes
 * the CLAIMED province into a point, verifies the new point by reverse-
 * geocoding it back (reusing CAM-571's `verifyAndResolvePlacement` verbatim),
 * and writes `Location`+`CampSite` together in one transaction. `Location.province`
 * is never rewritten — only the coordinate moves.
 *
 * The two owner-flagged safety properties this suite proves closed:
 *  1. Idempotent + host-edit-safe re-check — a row whose CURRENT coordinates
 *     already reverse-geocode to its CLAIMED province is left untouched.
 *  2. A placement that does not verify back into the claimed province is
 *     refused, never written as a guess.
 *
 * Coverage matrix (qa.md §7): normal · null/empty · boundary · error/
 * validation · concurrent/ordering (idempotent re-run + cache reuse).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  identifyProvinceMismatches,
  planProvinceAlignmentMoves,
  checkGuard,
} from '../scripts/backfill-cam-583-align-provinces.mjs';

// ===========================================================================
// Fake AdminArea tree — Lamphun/Chiang Mai (the classic adjacent-province
// pair CAM-562's own tech.md cites) + Krabi (a second, unrelated province,
// for the placement-mismatch case).
// ===========================================================================
const ADMIN_AREAS = [
  { id: 'prov-lamphun', level: 'PROVINCE', code: '51', nameEn: 'Lamphun', nameTh: 'ลำพูน', parentId: null },
  { id: 'prov-cnx', level: 'PROVINCE', code: '50', nameEn: 'Chiang Mai', nameTh: 'เชียงใหม่', parentId: null },
  { id: 'dist-mueang-cnx', level: 'DISTRICT', code: '5001', nameEn: 'Mueang Chiang Mai', nameTh: 'เมืองเชียงใหม่', parentId: 'prov-cnx' },
  { id: 'sub-siphum', level: 'SUBDISTRICT', code: '500101', nameEn: 'Si Phum', nameTh: 'ศรีภูมิ', parentId: 'dist-mueang-cnx' },
  { id: 'prov-krabi', level: 'PROVINCE', code: '81', nameEn: 'Krabi', nameTh: 'กระบี่', parentId: null },
];

function adminAreaById(id: string) {
  return ADMIN_AREAS.find((a) => a.id === id) ?? null;
}

/** Generic `where` matcher — mirrors CAM-571/CAM-562's own test fixtures (this fake also serves `runCam562Backfill`'s candidate-scan shape). */
function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  for (const [key, clause] of Object.entries(where)) {
    if (key === 'OR') {
      const clauses = clause as Array<Record<string, unknown>>;
      if (!clauses.some((c) => matchesWhere(row, c))) return false;
      continue;
    }
    if (key === 'id' && clause !== null && typeof clause === 'object' && 'in' in (clause as Record<string, unknown>)) {
      const ids = (clause as { in: string[] }).in;
      if (!ids.includes(row.id as string)) return false;
      continue;
    }
    if (clause !== null && typeof clause === 'object' && 'not' in (clause as Record<string, unknown>)) {
      const notClause = (clause as { not: unknown }).not;
      if (notClause === null && (row[key] === null || row[key] === undefined)) return false;
      continue;
    }
    if (clause === null && !(row[key] === null || row[key] === undefined)) return false;
  }
  return true;
}

function makeFakePrisma(locations: Array<Record<string, unknown>>) {
  const data = locations.map((l) => ({ ...l }));
  const campSites: Array<{ id: string; latitude: number; longitude: number }> = [];
  for (const loc of data) {
    if (loc.campSiteIds) {
      for (const id of loc.campSiteIds as string[]) {
        campSites.push({ id, latitude: loc.lat as number, longitude: loc.lon as number });
      }
    }
  }
  return {
    data,
    campSites,
    location: {
      findUnique: async ({ where: { id } }: { where: { id: string } }) => {
        const row = data.find((r) => r.id === id);
        if (!row) return null;
        return {
          id: row.id,
          province: row.province,
          district: row.district ?? null,
          subDistrict: row.subDistrict ?? null,
          lat: row.lat,
          lon: row.lon,
          adminAreaId: row.adminAreaId ?? null,
          adminArea: row.adminAreaId ? adminAreaById(row.adminAreaId as string) : null,
          campSites: ((row.campSiteIds as string[]) ?? []).map((id2) => ({ id: id2 })),
        };
      },
      update: async ({ where, data: patch }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = data.find((r) => r.id === where.id);
        if (!row) throw new Error(`no row for id ${where.id}`);
        Object.assign(row, patch);
        return { ...row };
      },
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) => {
        return data
          .filter((r) => (where ? matchesWhere(r, where) : true))
          .map((r) => ({
            id: r.id,
            province: r.province,
            district: r.district ?? null,
            subDistrict: r.subDistrict ?? null,
            lat: r.lat,
            lon: r.lon,
            adminAreaId: r.adminAreaId ?? null,
            adminArea: r.adminAreaId ? adminAreaById(r.adminAreaId as string) : null,
            campSites: ((r.campSiteIds as string[]) ?? []).map((id2) => ({ id: id2 })),
          }));
      },
      count: async ({ where }: { where?: Record<string, unknown> } = {}) => {
        if (!where) return data.length;
        return data.filter((r) => matchesWhere(r, where)).length;
      },
    },
    campSite: {
      update: async ({ where, data: patch }: { where: { id: string }; data: Record<string, unknown> }) => {
        const cs = campSites.find((c) => c.id === where.id);
        if (!cs) throw new Error(`no campSite for id ${where.id}`);
        Object.assign(cs, patch);
        return { ...cs };
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
      findUnique: async ({ where: { id } }: { where: { id: string } }) => {
        const found = adminAreaById(id);
        return found
          ? { id: found.id, code: found.code, nameTh: found.nameTh, nameEn: found.nameEn, level: found.level, parentId: found.parentId }
          : null;
      },
    },
    $transaction: async (ops: Array<Promise<unknown>>) => Promise.all(ops),
  };
}

// ===========================================================================
// Google address_components fixtures
// ===========================================================================
const CNX_PROVINCE_ONLY = [
  { long_name: 'Chiang Mai Province', short_name: 'Chiang Mai', types: ['administrative_area_level_1', 'political'] },
  { long_name: 'Thailand', short_name: 'TH', types: ['country', 'political'] },
];
const LAMPHUN_PROVINCE_ONLY = [
  { long_name: 'Lamphun Province', short_name: 'Lamphun', types: ['administrative_area_level_1', 'political'] },
  { long_name: 'Thailand', short_name: 'TH', types: ['country', 'political'] },
];
const KRABI_PROVINCE_ONLY = [
  { long_name: 'Krabi Province', short_name: 'Krabi', types: ['administrative_area_level_1', 'political'] },
  { long_name: 'Thailand', short_name: 'TH', types: ['country', 'political'] },
];

const googleReverseOk = (components: unknown[]) => ({
  ok: true,
  json: async () => ({ status: 'OK', results: [{ address_components: components, geometry: { location: { lat: 0, lng: 0 } } }] }),
});
const googleForwardOk = (lat: number, lng: number) => ({
  ok: true,
  json: async () => ({ status: 'OK', results: [{ address_components: [], geometry: { location: { lat, lng } } }] }),
});
const googleZeroResults = () => ({ ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) });

const TEST_KEY = 'test-fake-key-never-leaked';
const GOOGLE_FIXTURES = new Map<string, () => unknown>();

beforeEach(() => {
  GOOGLE_FIXTURES.clear();
  process.env.GOOGLE_GEOCODING_API_KEY = TEST_KEY;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = new URL(url);
      const latlng = u.searchParams.get('latlng');
      const address = u.searchParams.get('address');
      const key = latlng ? `reverse:${latlng}` : `forward:${address}`;
      const factory = GOOGLE_FIXTURES.get(key);
      if (!factory) throw new Error(`test bug: no fixture registered for ${key}`);
      return factory();
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_GEOCODING_API_KEY;
});

// ===========================================================================
// (a) identifyProvinceMismatches — reuses CAM-562's own classification
// ===========================================================================
describe('CAM-583 (a) — identifyProvinceMismatches: reuses CAM-562\'s own provinceMismatch classification, zero new logic', () => {
  it('[normal, teeth] a cached mismatch (claimed Lamphun, geocoded Chiang Mai) is returned as a candidate, 0 new calls', async () => {
    const cam562Cache = { 'loc-1': { ok: true, zeroResults: false, components: CNX_PROVINCE_ONLY } };
    const fake = makeFakePrisma([{ id: 'loc-1', province: 'Lamphun', lat: 18.5, lon: 99.0, adminAreaId: 'prov-lamphun' }]);

    const result = await identifyProvinceMismatches(fake, cam562Cache);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ id: 'loc-1', storedProvince: 'Lamphun' });
    expect(result.identificationCallsMade).toBe(0);
    expect(result.identificationCallsCached).toBe(1);
  });

  it('[null/empty] a row whose geocoded province MATCHES its claimed province is never a candidate', async () => {
    const cam562Cache = { 'loc-ok': { ok: true, zeroResults: false, components: LAMPHUN_PROVINCE_ONLY } };
    const fake = makeFakePrisma([{ id: 'loc-ok', province: 'Lamphun', lat: 18.5, lon: 99.0, adminAreaId: 'prov-lamphun' }]);

    const result = await identifyProvinceMismatches(fake, cam562Cache);
    expect(result.candidates).toHaveLength(0);
  });

  it('[Critical, teeth] a row ABSENT from the frozen cache is NEVER a candidate, even though it currently mismatches its claimed province (host-entered-data safety, CAM-571\'s BR-2 mirrored)', async () => {
    // Only 'loc-in-cache' is a key in cam562Cache — the structural stand-in
    // for "scanned by CAM-562's snapshot". 'loc-host-entered' is a row a real
    // host created/edited AFTER that snapshot: it currently mismatches its
    // claimed province too, but must never surface as a candidate here.
    const cam562Cache = { 'loc-in-cache': { ok: true, zeroResults: false, components: CNX_PROVINCE_ONLY } };
    const fake = makeFakePrisma([
      { id: 'loc-in-cache', province: 'Lamphun', lat: 18.5, lon: 99.0, adminAreaId: 'prov-lamphun' },
      { id: 'loc-host-entered', province: 'Lamphun', lat: 18.6, lon: 99.1, adminAreaId: 'prov-lamphun' },
    ]);

    const result = await identifyProvinceMismatches(fake, cam562Cache);

    expect(result.candidates.map((c: { id: string }) => c.id)).toEqual(['loc-in-cache']);
  });

  it('[boundary] a candidate id present in the cache but deleted from the DB since the snapshot is skipped, never crashes', async () => {
    const cam562Cache = { 'loc-gone': { ok: true, zeroResults: false, components: CNX_PROVINCE_ONLY } };
    const fake = makeFakePrisma([]); // no rows at all — deleted since the snapshot
    const result = await identifyProvinceMismatches(fake, cam562Cache);
    expect(result.candidates).toHaveLength(0);
  });
});

// ===========================================================================
// (b) planProvinceAlignmentMoves — full orchestration
// ===========================================================================
describe('CAM-583 (b) — planProvinceAlignmentMoves: identify -> fresh re-check -> forward -> verify -> write (Location + CampSite in sync)', () => {
  function registerLamphunFixtures() {
    GOOGLE_FIXTURES.set('reverse:18.5,99', () => googleReverseOk(CNX_PROVINCE_ONLY)); // current (mismatched) coords -> Chiang Mai
    GOOGLE_FIXTURES.set('forward:Lamphun, Thailand', () => googleForwardOk(18.57, 99.01));
    GOOGLE_FIXTURES.set('reverse:18.57,99.01', () => googleReverseOk(LAMPHUN_PROVINCE_ONLY)); // verify new point -> Lamphun
  }

  it('[normal, teeth] a province-mismatch candidate is moved to a point inside its CLAIMED province, never rewriting province', async () => {
    registerLamphunFixtures();
    const cam562Cache = { 'loc-1': { ok: true, zeroResults: false, components: CNX_PROVINCE_ONLY } };
    const fake = makeFakePrisma([{ id: 'loc-1', province: 'Lamphun', lat: 18.5, lon: 99.0, adminAreaId: 'prov-lamphun', campSiteIds: ['camp-1'] }]);

    const summary = await planProvinceAlignmentMoves(fake, { cam562Cache, dryRun: false });

    expect(summary.moved).toHaveLength(1);
    expect(fake.data[0].lat).toBe(18.57);
    expect(fake.data[0].lon).toBe(99.01);
    expect(fake.data[0].province).toBe('Lamphun'); // never touched
    expect(fake.campSites[0].latitude).toBe(18.57);
    expect(fake.campSites[0].longitude).toBe(99.01);
  });

  it('[AC, teeth] DRY_RUN computes the projected move but writes ZERO rows', async () => {
    registerLamphunFixtures();
    const cam562Cache = { 'loc-1': { ok: true, zeroResults: false, components: CNX_PROVINCE_ONLY } };
    const fake = makeFakePrisma([{ id: 'loc-1', province: 'Lamphun', lat: 18.5, lon: 99.0, adminAreaId: 'prov-lamphun', campSiteIds: ['camp-1'] }]);

    const summary = await planProvinceAlignmentMoves(fake, { cam562Cache, dryRun: true });

    expect(summary.moved).toHaveLength(1);
    expect(fake.data[0].lat).toBe(18.5); // unchanged — dry run
    expect(fake.campSites[0].latitude).toBe(18.5);
  });

  it('[error/validation, Critical, teeth] a forward-geocoded point that does NOT verify back into the claimed province is refused — never written', async () => {
    GOOGLE_FIXTURES.set('reverse:18.5,99', () => googleReverseOk(CNX_PROVINCE_ONLY));
    GOOGLE_FIXTURES.set('forward:Lamphun, Thailand', () => googleForwardOk(8.0, 98.9)); // wrong result
    GOOGLE_FIXTURES.set('reverse:8,98.9', () => googleReverseOk(KRABI_PROVINCE_ONLY)); // verify shows Krabi, not Lamphun
    const cam562Cache = { 'loc-1': { ok: true, zeroResults: false, components: CNX_PROVINCE_ONLY } };
    const fake = makeFakePrisma([{ id: 'loc-1', province: 'Lamphun', lat: 18.5, lon: 99.0, adminAreaId: 'prov-lamphun', campSiteIds: ['camp-1'] }]);

    const summary = await planProvinceAlignmentMoves(fake, { cam562Cache, dryRun: false });

    expect(summary.moved).toHaveLength(0);
    expect(summary.placementUnverified).toHaveLength(1);
    expect(fake.data[0].lat).toBe(18.5); // untouched
  });

  it('[error/validation] a forward-geocode failure (ZERO_RESULTS) is reported, never written', async () => {
    GOOGLE_FIXTURES.set('reverse:18.5,99', () => googleReverseOk(CNX_PROVINCE_ONLY));
    GOOGLE_FIXTURES.set('forward:Lamphun, Thailand', () => googleZeroResults());
    const cam562Cache = { 'loc-1': { ok: true, zeroResults: false, components: CNX_PROVINCE_ONLY } };
    const fake = makeFakePrisma([{ id: 'loc-1', province: 'Lamphun', lat: 18.5, lon: 99.0, adminAreaId: 'prov-lamphun', campSiteIds: ['camp-1'] }]);

    const summary = await planProvinceAlignmentMoves(fake, { cam562Cache, dryRun: false });

    expect(summary.moved).toHaveLength(0);
    expect(summary.forwardGeocodeFailed).toHaveLength(1);
    expect(fake.data[0].lat).toBe(18.5);
  });

  it('[concurrent/ordering, Critical, teeth] a SECOND run after a successful move is idempotent — 0 rows written (fresh re-check now sees the claimed province)', async () => {
    registerLamphunFixtures();
    const cam562Cache = { 'loc-1': { ok: true, zeroResults: false, components: CNX_PROVINCE_ONLY } };
    const fake = makeFakePrisma([{ id: 'loc-1', province: 'Lamphun', lat: 18.5, lon: 99.0, adminAreaId: 'prov-lamphun', campSiteIds: ['camp-1'] }]);

    const first = await planProvinceAlignmentMoves(fake, { cam562Cache, dryRun: false });
    expect(first.moved).toHaveLength(1);

    const snapshotAfterFirst = fake.data.map((r) => ({ ...r }));
    const second = await planProvinceAlignmentMoves(fake, { cam562Cache, dryRun: false });

    expect(second.moved).toHaveLength(0);
    expect(second.alreadyMatchesClaimedProvince).toHaveLength(1);
    expect(fake.data).toEqual(snapshotAfterFirst); // byte-identical — nothing changed
  });

  it('[null/empty, host-safety] a row whose CURRENT coordinates already match its claimed province (host-corrected since classification) is skipped, never re-moved', async () => {
    // The classification cache says "mismatch" (stale), but a fresh live
    // re-check of the CURRENT coordinates now shows Lamphun — a host (or
    // anything else) already fixed it since CAM-562's snapshot was taken.
    GOOGLE_FIXTURES.set('reverse:18.57,99.01', () => googleReverseOk(LAMPHUN_PROVINCE_ONLY));
    const cam562Cache = { 'loc-1': { ok: true, zeroResults: false, components: CNX_PROVINCE_ONLY } };
    const fake = makeFakePrisma([{ id: 'loc-1', province: 'Lamphun', lat: 18.57, lon: 99.01, adminAreaId: 'prov-lamphun', campSiteIds: ['camp-1'] }]);

    const summary = await planProvinceAlignmentMoves(fake, { cam562Cache, dryRun: false });

    expect(summary.moved).toHaveLength(0);
    expect(summary.alreadyMatchesClaimedProvince).toHaveLength(1);
    expect(fake.data[0].lat).toBe(18.57); // untouched
  });

  it('[normal] onReverseCheckCacheUpdate/onForwardCacheUpdate/onReverseVerifyCacheUpdate fire once per NEW call, never on a cache hit', async () => {
    registerLamphunFixtures();
    const cam562Cache = { 'loc-1': { ok: true, zeroResults: false, components: CNX_PROVINCE_ONLY } };
    const fake = makeFakePrisma([{ id: 'loc-1', province: 'Lamphun', lat: 18.5, lon: 99.0, adminAreaId: 'prov-lamphun', campSiteIds: ['camp-1'] }]);
    const onReverseCheckCacheUpdate = vi.fn();
    const onForwardCacheUpdate = vi.fn();
    const onReverseVerifyCacheUpdate = vi.fn();
    const reverseCheckCache: Record<string, unknown> = {};
    const forwardCache: Record<string, unknown> = {};
    const reverseVerifyCache: Record<string, unknown> = {};

    await planProvinceAlignmentMoves(fake, {
      cam562Cache,
      dryRun: true,
      reverseCheckCache,
      forwardCache,
      reverseVerifyCache,
      onReverseCheckCacheUpdate,
      onForwardCacheUpdate,
      onReverseVerifyCacheUpdate,
    });
    expect(onReverseCheckCacheUpdate).toHaveBeenCalledTimes(1);
    expect(onForwardCacheUpdate).toHaveBeenCalledTimes(1);
    expect(onReverseVerifyCacheUpdate).toHaveBeenCalledTimes(1);

    onReverseCheckCacheUpdate.mockClear();
    onForwardCacheUpdate.mockClear();
    onReverseVerifyCacheUpdate.mockClear();
    await planProvinceAlignmentMoves(fake, {
      cam562Cache,
      dryRun: false,
      reverseCheckCache,
      forwardCache,
      reverseVerifyCache,
      onReverseCheckCacheUpdate,
      onForwardCacheUpdate,
      onReverseVerifyCacheUpdate,
    });
    expect(onReverseCheckCacheUpdate).not.toHaveBeenCalled();
    expect(onForwardCacheUpdate).not.toHaveBeenCalled();
    expect(onReverseVerifyCacheUpdate).not.toHaveBeenCalled();
  });

  it('[boundary] a candidate row deleted between classification and fetch is recorded, never crashes', async () => {
    // Simulates a race: the row exists for the classification scan's OWN
    // findUnique call but is gone by the time planProvinceAlignmentMoves
    // fetches it a second time — the row is recorded, not thrown.
    const cam562Cache = { 'loc-1': { ok: true, zeroResults: false, components: CNX_PROVINCE_ONLY } };
    const fake = makeFakePrisma([{ id: 'loc-1', province: 'Lamphun', lat: 18.5, lon: 99.0, adminAreaId: 'prov-lamphun' }]);
    const originalFindUnique = fake.location.findUnique;
    let calls = 0;
    fake.location.findUnique = (async (args: Parameters<typeof originalFindUnique>[0]) => {
      calls += 1;
      const row = await originalFindUnique(args);
      if (calls === 1) fake.data.length = 0; // vanishes right after classification's own lookup
      return row;
    }) as typeof originalFindUnique;

    const summary = await planProvinceAlignmentMoves(fake, { cam562Cache, dryRun: false });
    expect(summary.rowNotFound).toEqual(['loc-1']);
    expect(summary.moved).toHaveLength(0);
  });
});

// ===========================================================================
// (c) checkGuard
// ===========================================================================
describe('CAM-583 (c) — checkGuard: refuses missing opt-in / DATABASE_URL / API key, or a production-looking target', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('[error/validation] refuses when ALLOW_ALIGN_PROVINCES_BACKFILL is unset', () => {
    vi.stubEnv('ALLOW_ALIGN_PROVINCES_BACKFILL', '');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/campvibe_dev');
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', 'k');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('ALLOW_ALIGN_PROVINCES_BACKFILL=1');
  });

  it('[error/validation] refuses when DATABASE_URL is unset', () => {
    vi.stubEnv('ALLOW_ALIGN_PROVINCES_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', 'k');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('DATABASE_URL is not set');
  });

  it('[error/validation] refuses when GOOGLE_GEOCODING_API_KEY is unset', () => {
    vi.stubEnv('ALLOW_ALIGN_PROVINCES_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/campvibe_dev');
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', '');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('GOOGLE_GEOCODING_API_KEY is not set');
  });

  it('[error/validation] refuses when the target URL looks like production', () => {
    vi.stubEnv('ALLOW_ALIGN_PROVINCES_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pw@prod-db.example.com:5432/campvibe');
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', 'k');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL_ENV', '');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('PRODUCTION');
  });

  it('[normal] allows when opt-in + DATABASE_URL + the API key are set and the target does not look like production', () => {
    vi.stubEnv('ALLOW_ALIGN_PROVINCES_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/campvibe_dev');
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', 'k');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL_ENV', '');
    const result = checkGuard();
    expect(result.ok).toBe(true);
  });
});
