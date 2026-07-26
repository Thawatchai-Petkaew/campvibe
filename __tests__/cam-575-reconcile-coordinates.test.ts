import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  findDivergentPairs,
  resolveClaimedProvince,
  pointVerifiesProvince,
  reconcileCandidate,
  planReconciliation,
  checkGuard,
} from '../scripts/backfill-cam-575-reconcile-coordinates.mjs';

// ===========================================================================
// AdminArea fixtures — the EXACT nodes from the real dev DB (queried live,
// 2026-07-26) for the 3 provinces + 2 sub-province nodes the 4 real
// divergent camps actually resolve against. Reusing real ids/names (not
// invented ones) keeps this fixture faithful to production data shape.
// ===========================================================================
const ADMIN_AREAS = [
  { id: 'prov-bangkok', level: 'PROVINCE', code: '10', nameTh: 'กรุงเทพมหานคร', nameEn: 'Bangkok', parentId: null },
  { id: 'prov-samutprakan', level: 'PROVINCE', code: '11', nameTh: 'สมุทรปราการ', nameEn: 'Samut Prakan', parentId: null },
  { id: 'prov-ayutthaya', level: 'PROVINCE', code: '14', nameTh: 'พระนครศรีอยุธยา', nameEn: 'Phra Nakhon Si Ayutthaya', parentId: null },
  { id: 'dist-ayutthaya-mueang', level: 'DISTRICT', code: '1401', nameTh: 'พระนครศรีอยุธยา', nameEn: 'Phra Nakhon Si Ayutthaya', parentId: 'prov-ayutthaya' },
  { id: 'dist-bangpain', level: 'DISTRICT', code: '1406', nameTh: 'บางปะอิน', nameEn: 'Bang Pa-in', parentId: 'prov-ayutthaya' },
  { id: 'subdist-bangpradaeng', level: 'SUBDISTRICT', code: '140609', nameTh: 'บางประแดง', nameEn: 'Bang Pradaeng', parentId: 'dist-bangpain' },
];

function adminAreaById(id: string) {
  return ADMIN_AREAS.find((a) => a.id === id) ?? null;
}

function makeFakePrisma(camps: Array<Record<string, unknown>>) {
  const data = camps.map((c) => ({ ...c }));
  return {
    data,
    campSite: {
      findMany: async () =>
        data.map((c) => ({
          id: c.campId,
          latitude: c.campSiteLat,
          longitude: c.campSiteLon,
          location: {
            id: c.locationId,
            lat: c.locationLat,
            lon: c.locationLon,
            province: c.province ?? null,
            adminAreaId: (c.adminAreaId as string) ?? null,
            adminArea: c.adminAreaId ? adminAreaById(c.adminAreaId as string) : null,
          },
        })),
      update: async ({ where, data: patch }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = data.find((r) => r.campId === where.id);
        if (!row) throw new Error(`no row for campId ${where.id}`);
        if (patch.latitude !== undefined) row.campSiteLat = patch.latitude;
        if (patch.longitude !== undefined) row.campSiteLon = patch.longitude;
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
      findUnique: async ({ where: { id } }: { where: { id: string } }) => {
        const found = adminAreaById(id);
        return found
          ? { id: found.id, code: found.code, nameTh: found.nameTh, nameEn: found.nameEn, level: found.level, parentId: found.parentId }
          : null;
      },
    },
  };
}

// ===========================================================================
// Google reverse-geocode fixtures — real raw Thai address_components captured
// live (2026-07-26, language=th) from the actual coordinates of the 4
// divergent camps.
// ===========================================================================
const AYUTTHAYA_PROVINCE_ONLY = [{ long_name: 'จังหวัดพระนครศรีอยุธยา', short_name: 'พระนครศรีอยุธยา', types: ['administrative_area_level_1', 'political'] }];
const BANGKOK_PROVINCE_ONLY = [{ long_name: 'กรุงเทพมหานคร', short_name: 'กรุงเทพมหานคร', types: ['administrative_area_level_1', 'political'] }];
const SAMUT_PRAKAN_PROVINCE_ONLY = [{ long_name: 'สมุทรปราการ', short_name: 'สมุทรปราการ', types: ['administrative_area_level_1', 'political'] }];

const googleReverseOk = (components: unknown[]) => ({
  ok: true,
  json: async () => ({ status: 'OK', results: [{ address_components: components }] }),
});
const googleZeroResults = () => ({ ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) });

const GOOGLE_FIXTURES = new Map<string, () => unknown>();

beforeEach(() => {
  GOOGLE_FIXTURES.clear();
  process.env.GOOGLE_GEOCODING_API_KEY = 'test-fake-key-never-leaked';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = new URL(url);
      const latlng = u.searchParams.get('latlng');
      const factory = GOOGLE_FIXTURES.get(`reverse:${latlng}`);
      if (!factory) throw new Error(`test bug: no fixture registered for reverse:${latlng}`);
      return factory();
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_GEOCODING_API_KEY;
});

describe('CAM-575 (a) — findDivergentPairs: detects CampSite/Location coordinate disagreement', () => {
  it('[normal] flags a camp whose CampSite and Location coordinates differ', async () => {
    const fake = makeFakePrisma([
      { campId: 'camp-1', locationId: 'loc-1', campSiteLat: 13.6035, campSiteLon: 100.5979, locationLat: 13.6695, locationLon: 100.6142, province: 'Bangkok', adminAreaId: 'prov-bangkok' },
    ]);
    const result = await findDivergentPairs(fake);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ campId: 'camp-1', locationId: 'loc-1' });
  });

  it('[null/empty] a camp whose two columns already agree is never flagged', async () => {
    const fake = makeFakePrisma([
      { campId: 'camp-ok', locationId: 'loc-ok', campSiteLat: 13.75, campSiteLon: 100.5, locationLat: 13.75, locationLon: 100.5, province: 'Bangkok', adminAreaId: 'prov-bangkok' },
    ]);
    expect(await findDivergentPairs(fake)).toHaveLength(0);
  });

  it('[boundary] an empty camp set returns an empty list', async () => {
    expect(await findDivergentPairs(makeFakePrisma([]))).toEqual([]);
  });
});

describe('CAM-575 (b) — resolveClaimedProvince: walks below-PROVINCE adminArea up to its province ancestor', () => {
  it('[normal] a PROVINCE-level adminArea resolves to itself', async () => {
    const fake = makeFakePrisma([]);
    const node = await resolveClaimedProvince(fake, { adminArea: adminAreaById('prov-bangkok'), province: 'Bangkok' });
    expect(node?.id).toBe('prov-bangkok');
  });

  it('[boundary] a DISTRICT-level adminArea walks up to its PROVINCE ancestor', async () => {
    const fake = makeFakePrisma([]);
    const node = await resolveClaimedProvince(fake, { adminArea: adminAreaById('dist-ayutthaya-mueang'), province: 'Phra Nakhon Si Ayutthaya' });
    expect(node?.id).toBe('prov-ayutthaya');
  });

  it('[boundary] a SUBDISTRICT-level adminArea walks up two levels to its PROVINCE ancestor', async () => {
    const fake = makeFakePrisma([]);
    const node = await resolveClaimedProvince(fake, { adminArea: adminAreaById('subdist-bangpradaeng'), province: 'Phra Nakhon Si Ayutthaya' });
    expect(node?.id).toBe('prov-ayutthaya');
  });

  it('[null/empty] no adminArea falls back to matching the free-text province string', async () => {
    const fake = makeFakePrisma([]);
    const node = await resolveClaimedProvince(fake, { adminArea: null, province: 'Bangkok' });
    expect(node?.id).toBe('prov-bangkok');
  });

  it('[null/empty] neither adminArea nor province string returns null', async () => {
    const fake = makeFakePrisma([]);
    expect(await resolveClaimedProvince(fake, { adminArea: null, province: null })).toBeNull();
  });
});

describe('CAM-575 (c) — pointVerifiesProvince: bilingual/hierarchical match, never a raw string compare', () => {
  it('[normal] a point that reverse-geocodes into the claimed province verifies', async () => {
    GOOGLE_FIXTURES.set('reverse:13.7549,100.5966', () => googleReverseOk(BANGKOK_PROVINCE_ONLY));
    const fake = makeFakePrisma([]);
    const ok = await pointVerifiesProvince(fake, { lat: 13.7549, lon: 100.5966 }, adminAreaById('prov-bangkok'));
    expect(ok).toBe(true);
  });

  it('[error/validation] a point that reverse-geocodes into a DIFFERENT province does not verify', async () => {
    GOOGLE_FIXTURES.set('reverse:13.6035,100.5979', () => googleReverseOk(SAMUT_PRAKAN_PROVINCE_ONLY));
    const fake = makeFakePrisma([]);
    const ok = await pointVerifiesProvince(fake, { lat: 13.6035, lon: 100.5979 }, adminAreaById('prov-bangkok'));
    expect(ok).toBe(false);
  });

  it('[error/validation] a ZERO_RESULTS geocode never verifies (and never throws)', async () => {
    GOOGLE_FIXTURES.set('reverse:0,0', () => googleZeroResults());
    const fake = makeFakePrisma([]);
    expect(await pointVerifiesProvince(fake, { lat: 0, lon: 0 }, adminAreaById('prov-bangkok'))).toBe(false);
  });

  it('[null/empty] a null claimed node never verifies, without ever calling Google', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const fake = makeFakePrisma([]);
    expect(await pointVerifiesProvince(fake, { lat: 1, lon: 1 }, null)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('CAM-575 (d) — reconcileCandidate: decide per camp, never blanket-prefer a column (owner\'s explicit ask)', () => {
  it('[normal, teeth] CampSite verifies -> KEEP CampSite\'s value (real case: Ayutthaya Riverside Camp 1, both verify, canonical wins)', async () => {
    GOOGLE_FIXTURES.set('reverse:14.2863,100.7184', () => googleReverseOk(AYUTTHAYA_PROVINCE_ONLY));
    const fake = makeFakePrisma([]);
    const result = await reconcileCandidate(fake, {
      campId: 'camp-1', locationId: 'loc-1',
      campSite: { lat: 14.2863, lon: 100.7184 }, location: { lat: 14.4046, lon: 100.5713 },
      province: 'Phra Nakhon Si Ayutthaya', adminArea: adminAreaById('dist-ayutthaya-mueang'),
    });
    expect(result).toEqual({ outcome: 'kept_campsite', write: { latitude: 14.2863, longitude: 100.7184 } });
  });

  it('[Critical, teeth] CampSite does NOT verify but Location DOES -> CORRECT from Location (real case: Bangkok Forest Camp 2, diverged the OTHER direction)', async () => {
    GOOGLE_FIXTURES.set('reverse:13.6035,100.5979', () => googleReverseOk(SAMUT_PRAKAN_PROVINCE_ONLY));
    GOOGLE_FIXTURES.set('reverse:13.6695,100.6142', () => googleReverseOk(BANGKOK_PROVINCE_ONLY));
    const fake = makeFakePrisma([]);
    const result = await reconcileCandidate(fake, {
      campId: 'camp-2', locationId: 'loc-2',
      campSite: { lat: 13.6035, lon: 100.5979 }, location: { lat: 13.6695, lon: 100.6142 },
      province: 'Bangkok', adminArea: adminAreaById('prov-bangkok'),
    });
    expect(result).toEqual({ outcome: 'corrected_from_location', write: { latitude: 13.6695, longitude: 100.6142 } });
  });

  it('[error/validation, boundary] neither point verifies the claimed province -> unresolved, never guessed', async () => {
    GOOGLE_FIXTURES.set('reverse:1,1', () => googleReverseOk(SAMUT_PRAKAN_PROVINCE_ONLY));
    GOOGLE_FIXTURES.set('reverse:2,2', () => googleZeroResults());
    const fake = makeFakePrisma([]);
    const result = await reconcileCandidate(fake, {
      campId: 'camp-3', locationId: 'loc-3',
      campSite: { lat: 1, lon: 1 }, location: { lat: 2, lon: 2 },
      province: 'Bangkok', adminArea: adminAreaById('prov-bangkok'),
    });
    expect(result).toEqual({ outcome: 'unresolved', write: null });
  });
});

describe('CAM-575 (e) — planReconciliation: writes ONLY through CampSite; Location is never written directly', () => {
  it('[AC, teeth] a real run writes via campSite.update only — the fake has no location.update at all, so any attempt to call it throws', async () => {
    GOOGLE_FIXTURES.set('reverse:13.6035,100.5979', () => googleReverseOk(SAMUT_PRAKAN_PROVINCE_ONLY));
    GOOGLE_FIXTURES.set('reverse:13.6695,100.6142', () => googleReverseOk(BANGKOK_PROVINCE_ONLY));
    const fake = makeFakePrisma([
      { campId: 'camp-2', locationId: 'loc-2', campSiteLat: 13.6035, campSiteLon: 100.5979, locationLat: 13.6695, locationLon: 100.6142, province: 'Bangkok', adminAreaId: 'prov-bangkok' },
    ]);

    const summary = await planReconciliation(fake, { dryRun: false });

    expect(summary.correctedFromLocation).toHaveLength(1);
    expect(fake.data[0].campSiteLat).toBe(13.6695);
    expect(fake.data[0].campSiteLon).toBe(100.6142);
  });

  it('[normal] DRY_RUN computes the decision but writes zero rows', async () => {
    GOOGLE_FIXTURES.set('reverse:14.2863,100.7184', () => googleReverseOk(AYUTTHAYA_PROVINCE_ONLY));
    const fake = makeFakePrisma([
      { campId: 'camp-1', locationId: 'loc-1', campSiteLat: 14.2863, campSiteLon: 100.7184, locationLat: 14.4046, locationLon: 100.5713, province: 'Phra Nakhon Si Ayutthaya', adminAreaId: 'dist-ayutthaya-mueang' },
    ]);

    const summary = await planReconciliation(fake, { dryRun: true });

    expect(summary.keptCampSite).toHaveLength(1);
    expect(fake.data[0].campSiteLat).toBe(14.2863); // unchanged — dry run
  });

  it('[boundary] no divergent pairs at all -> 0 candidates, 0 writes (the post-reconciliation / idempotent state)', async () => {
    const fake = makeFakePrisma([
      { campId: 'camp-ok', locationId: 'loc-ok', campSiteLat: 13.75, campSiteLon: 100.5, locationLat: 13.75, locationLon: 100.5, province: 'Bangkok', adminAreaId: 'prov-bangkok' },
    ]);
    const summary = await planReconciliation(fake, { dryRun: false });
    expect(summary).toMatchObject({ candidatesFound: 0, keptCampSite: [], correctedFromLocation: [], unresolved: [] });
  });

  it('[concurrent/ordering] the real 4-camp shape reconciles in one pass: 3 kept + 1 corrected, matching the live dev-DB run', async () => {
    GOOGLE_FIXTURES.set('reverse:14.2863,100.7184', () => googleReverseOk(AYUTTHAYA_PROVINCE_ONLY));
    GOOGLE_FIXTURES.set('reverse:13.7549,100.5966', () => googleReverseOk(BANGKOK_PROVINCE_ONLY));
    GOOGLE_FIXTURES.set('reverse:14.3449,100.4467', () => googleReverseOk(AYUTTHAYA_PROVINCE_ONLY));
    GOOGLE_FIXTURES.set('reverse:13.6035,100.5979', () => googleReverseOk(SAMUT_PRAKAN_PROVINCE_ONLY));
    GOOGLE_FIXTURES.set('reverse:13.6695,100.6142', () => googleReverseOk(BANGKOK_PROVINCE_ONLY));

    const fake = makeFakePrisma([
      { campId: 'ca952d76', locationId: '6b8b6846', campSiteLat: 14.2863, campSiteLon: 100.7184, locationLat: 14.4046, locationLon: 100.5713, province: 'Phra Nakhon Si Ayutthaya', adminAreaId: 'dist-ayutthaya-mueang' },
      { campId: '8edf774a', locationId: 'ae01ffa1', campSiteLat: 13.7549, campSiteLon: 100.5966, locationLat: 13.8276, locationLon: 100.5833, province: 'Bangkok', adminAreaId: 'prov-bangkok' },
      { campId: '0e2deba6', locationId: '3b76f7e7', campSiteLat: 14.3449, campSiteLon: 100.4467, locationLat: 14.2777, locationLon: 100.5368, province: 'Phra Nakhon Si Ayutthaya', adminAreaId: 'subdist-bangpradaeng' },
      { campId: 'bbf0255b', locationId: '8450acd2', campSiteLat: 13.6035, campSiteLon: 100.5979, locationLat: 13.6695, locationLon: 100.6142, province: 'Bangkok', adminAreaId: 'prov-bangkok' },
    ]);

    const summary = await planReconciliation(fake, { dryRun: false });

    expect(summary.candidatesFound).toBe(4);
    expect(summary.keptCampSite).toHaveLength(3);
    expect(summary.correctedFromLocation).toHaveLength(1);
    expect(summary.correctedFromLocation[0]).toMatchObject({ campId: 'bbf0255b' });
    expect(summary.unresolved).toHaveLength(0);
  });
});

describe('CAM-575 (f) — checkGuard: refuses missing opt-in / DATABASE_URL / API key, or a production-looking target', () => {
  afterEach(() => {
    delete process.env.ALLOW_CAMPSITE_LOCATION_COORD_RECONCILE;
    delete process.env.DATABASE_URL;
    delete process.env.GOOGLE_GEOCODING_API_KEY;
  });

  it('[error/validation] refuses when ALLOW_CAMPSITE_LOCATION_COORD_RECONCILE is unset', () => {
    delete process.env.ALLOW_CAMPSITE_LOCATION_COORD_RECONCILE;
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('ALLOW_CAMPSITE_LOCATION_COORD_RECONCILE');
  });

  it('[error/validation] refuses when the target URL looks like production', () => {
    process.env.ALLOW_CAMPSITE_LOCATION_COORD_RECONCILE = '1';
    process.env.DATABASE_URL = 'postgresql://user:pw@prod-db.example.com:5432/campvibe';
    process.env.GOOGLE_GEOCODING_API_KEY = 'k';
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('PRODUCTION');
  });

  it('[normal] allows when opt-in + DATABASE_URL + API key are set and the target is not production-looking', () => {
    process.env.ALLOW_CAMPSITE_LOCATION_COORD_RECONCILE = '1';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/campvibe_dev';
    process.env.GOOGLE_GEOCODING_API_KEY = 'k';
    expect(checkGuard().ok).toBe(true);
  });
});
