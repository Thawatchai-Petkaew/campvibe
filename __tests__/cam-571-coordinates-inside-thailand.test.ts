/**
 * cam-571-coordinates-inside-thailand.test.ts — CAM-571
 * (platform-hardening/taxonomy-ui-foundation)
 *
 * `scripts/backfill-cam-571-coordinates-inside-thailand.mjs` re-reads CAM-562's
 * FROZEN geocode cache to identify `Location` rows whose coordinates geocode
 * OUTSIDE Thailand (by country, never a bounding box), moves each to a real
 * forward-geocoded point inside its CLAIMED province, verifies the new point
 * by reverse-geocoding it back, and re-derives district/subDistrict from that
 * same verification call. It also keeps `CampSite.latitude/longitude` in sync
 * (a separate column this story's own reader/writer sweep found duplicates
 * `Location.lat/lon` everywhere it is ever written) and reports (never
 * rewrites) CAM-562's 83 adjacent-province mismatches with a distance metric.
 *
 * The two owner-flagged safety properties this suite proves closed:
 *  1. Host-entered-data safety — a row absent from CAM-562's frozen cache
 *     (the structural stand-in for "created/edited after the snapshot") is
 *     NEVER a candidate, regardless of its current coordinates.
 *  2. Idempotent + host-edit-safe re-check — a row whose CURRENT coordinates
 *     already reverse-geocode to Thailand (whether because this script
 *     already moved it, or anything else corrected it) is left untouched.
 *
 * Layers:
 *  (a) identifyOutsideThailand / extractCountry — pure cache scan
 *  (b) buildForwardAddress — pure address-string construction
 *  (c) callGoogleGeocodeForward — key safety + status handling
 *  (d) verifyAndResolvePlacement — province verification + district/subDistrict re-derivation
 *  (e) planMoves — the full orchestration: dry-run/real-run, CampSite sync,
 *      host-entered safety, idempotency, forward-geocode/placement failures
 *  (f) haversineDistanceKm / reportProvinceMismatchDistances — 83-case report
 *  (g) checkGuard — refuses missing opt-in/DATABASE_URL/API key/prod target
 *
 * Coverage matrix (qa.md §7): normal · null/empty · boundary · error/
 * validation · concurrent/ordering (idempotent re-run + cache reuse).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  identifyOutsideThailand,
  extractCountry,
  buildForwardAddress,
  callGoogleGeocodeForward,
  verifyAndResolvePlacement,
  planMoves,
  haversineDistanceKm,
  reportProvinceMismatchDistances,
  checkGuard,
} from '../scripts/backfill-cam-571-coordinates-inside-thailand.mjs';

// ===========================================================================
// Fake AdminArea tree — Bueng Kan (province-only, the typical shape of this
// story's 18 candidates) + Chiang Mai (full 3-level, for the district/
// subDistrict re-derivation case) + Krabi (a second unrelated province, for
// the placement-mismatch case).
// ===========================================================================
const ADMIN_AREAS = [
  { id: 'prov-buengkan', level: 'PROVINCE', code: '38', nameEn: 'Bueng Kan', nameTh: 'บึงกาฬ', parentId: null },
  { id: 'prov-cnx', level: 'PROVINCE', code: '50', nameEn: 'Chiang Mai', nameTh: 'เชียงใหม่', parentId: null },
  { id: 'dist-mueang-cnx', level: 'DISTRICT', code: '5001', nameEn: 'Mueang Chiang Mai', nameTh: 'เมืองเชียงใหม่', parentId: 'prov-cnx' },
  { id: 'sub-siphum', level: 'SUBDISTRICT', code: '500101', nameEn: 'Si Phum', nameTh: 'ศรีภูมิ', parentId: 'dist-mueang-cnx' },
  { id: 'prov-krabi', level: 'PROVINCE', code: '81', nameEn: 'Krabi', nameTh: 'กระบี่', parentId: null },
];

function adminAreaById(id: string) {
  return ADMIN_AREAS.find((a) => a.id === id) ?? null;
}

/** Generic `where` matcher — mirrors CAM-562's own test fixture (matchesWhere), needed because this fake's `findMany` also serves `runCam562Backfill`'s candidate-scan shape (`{lat:{not:null}, OR:[...]}`), not just this story's own `{id:{in:[...]}}` lookup. */
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
const LAOS_COMPONENTS = [
  { long_name: 'Bolikhamsai Province', short_name: 'Bolikhamsai', types: ['administrative_area_level_1', 'political'] },
  { long_name: 'ลาว', short_name: 'LA', types: ['country', 'political'] },
];
const BUENG_KAN_PROVINCE_ONLY = [
  { long_name: 'Bueng Kan Province', short_name: 'Bueng Kan', types: ['administrative_area_level_1', 'political'] },
  { long_name: 'Thailand', short_name: 'TH', types: ['country', 'political'] },
];
const CNX_FULL_EN = [
  { long_name: 'Chiang Mai Province', short_name: 'Chiang Mai', types: ['administrative_area_level_1', 'political'] },
  { long_name: 'Amphoe Mueang Chiang Mai', short_name: 'Mueang Chiang Mai', types: ['administrative_area_level_2', 'political'] },
  { long_name: 'Tambon Si Phum', short_name: 'Si Phum', types: ['sublocality_level_1', 'sublocality', 'political'] },
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
// Keyed by 'reverse:<lat>,<lon>' or 'forward:<address>'
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
// (a) identifyOutsideThailand / extractCountry — pure cache scan
// ===========================================================================
describe('CAM-571 (a) — identifyOutsideThailand: identifies by geocoded COUNTRY, never a bounding box', () => {
  it('[normal] flags an entry whose country component is not TH', () => {
    const cache = { 'loc-1': { ok: true, zeroResults: false, components: LAOS_COMPONENTS } };
    const result = identifyOutsideThailand(cache);
    expect(result).toEqual([{ id: 'loc-1', countryCode: 'LA', countryName: 'ลาว' }]);
  });

  it('[normal] does NOT flag an entry whose country component IS TH', () => {
    const cache = { 'loc-2': { ok: true, zeroResults: false, components: BUENG_KAN_PROVINCE_ONLY } };
    expect(identifyOutsideThailand(cache)).toEqual([]);
  });

  it('[null/empty] an empty cache returns an empty list', () => {
    expect(identifyOutsideThailand({})).toEqual([]);
    expect(identifyOutsideThailand(undefined as unknown as Record<string, unknown>)).toEqual([]);
  });

  it('[boundary] a zeroResults or not-ok cache entry is never flagged (a different, out-of-scope failure mode)', () => {
    const cache = {
      'loc-zero': { ok: true, zeroResults: true, components: [] },
      'loc-failed': { ok: false, reason: 'http_500' },
      'loc-no-country': { ok: true, zeroResults: false, components: [{ long_name: 'x', short_name: 'x', types: ['route'] }] },
    };
    expect(identifyOutsideThailand(cache)).toEqual([]);
  });

  it('[Critical, teeth] the real CAM-562-shaped 18-vs-83 distinction — a province MISMATCH (still Thailand) is never flagged here', () => {
    // KRABI is a real Thai province — this is the "adjacent province" shape
    // (83 cases), categorically different from a foreign-country result.
    const cache = { 'loc-mismatch': { ok: true, zeroResults: false, components: KRABI_PROVINCE_ONLY } };
    expect(identifyOutsideThailand(cache)).toEqual([]);
  });
});

describe('CAM-571 (a2) — extractCountry', () => {
  it('[normal] returns shortName + longName from the country-typed component', () => {
    expect(extractCountry(LAOS_COMPONENTS)).toEqual({ shortName: 'LA', longName: 'ลาว' });
  });
  it('[null/empty] returns null when no country component is present', () => {
    expect(extractCountry([{ long_name: 'x', short_name: 'x', types: ['route'] }])).toBeNull();
    expect(extractCountry([])).toBeNull();
  });
});

// ===========================================================================
// (b) buildForwardAddress
// ===========================================================================
describe('CAM-571 (b) — buildForwardAddress: mirrors app/api/geocode/forward/route.ts, never invents a value', () => {
  it('[normal] province only (this story\'s actual 18 candidates — district/subDistrict are null)', () => {
    expect(buildForwardAddress({ province: 'Bueng Kan', district: null, subDistrict: null })).toBe('Bueng Kan, Thailand');
  });
  it('[normal] includes district/subDistrict when known, in the right order', () => {
    expect(buildForwardAddress({ province: 'Chiang Mai', district: 'Mueang', subDistrict: 'Si Phum' })).toBe('Si Phum, Mueang, Chiang Mai, Thailand');
  });
});

// ===========================================================================
// (c) callGoogleGeocodeForward — key safety + status handling
// ===========================================================================
describe('CAM-571 (c) — callGoogleGeocodeForward: status handling + key safety', () => {
  it('[normal] OK status returns the first result\'s lat/lon', async () => {
    GOOGLE_FIXTURES.set('forward:Bueng Kan, Thailand', () => googleForwardOk(18.35, 103.6));
    const result = await callGoogleGeocodeForward('Bueng Kan, Thailand');
    expect(result).toEqual({ ok: true, zeroResults: false, lat: 18.35, lon: 103.6 });
  });

  it('[null/empty] ZERO_RESULTS is reported, never guessed', async () => {
    GOOGLE_FIXTURES.set('forward:Nowhere, Thailand', () => googleZeroResults());
    const result = await callGoogleGeocodeForward('Nowhere, Thailand');
    expect(result).toEqual({ ok: true, zeroResults: true });
  });

  it('[error/validation] a non-OK Google status is reported, never thrown', async () => {
    GOOGLE_FIXTURES.set('forward:Bad, Thailand', () => ({ ok: true, json: async () => ({ status: 'REQUEST_DENIED', results: [] }) }));
    const result = await callGoogleGeocodeForward('Bad, Thailand');
    expect(result).toEqual({ ok: false, reason: 'google_REQUEST_DENIED' });
  });

  it('[error/validation] a non-OK HTTP response is reported by status code', async () => {
    GOOGLE_FIXTURES.set('forward:Fail, Thailand', () => ({ ok: false, status: 500 }));
    const result = await callGoogleGeocodeForward('Fail, Thailand');
    expect(result).toEqual({ ok: false, reason: 'http_500' });
  });

  it('[boundary] a missing API key refuses without ever calling fetch', async () => {
    delete process.env.GOOGLE_GEOCODING_API_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const result = await callGoogleGeocodeForward('x, Thailand');
    expect(result).toEqual({ ok: false, reason: 'missing_key' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('[Critical: key safety] the key-bearing URL never appears in any returned `reason`', async () => {
    GOOGLE_FIXTURES.set('forward:Leak, Thailand', () => ({ ok: false, status: 500 }));
    const result = await callGoogleGeocodeForward('Leak, Thailand');
    expect(JSON.stringify(result)).not.toContain(TEST_KEY);
    expect(JSON.stringify(result)).not.toContain('maps.googleapis.com');
  });
});

// ===========================================================================
// (d) verifyAndResolvePlacement
// ===========================================================================
describe('CAM-571 (d) — verifyAndResolvePlacement: BR-3 refuse-if-unverified + district/subDistrict re-derivation', () => {
  const fake = makeFakePrisma([]);

  it('[normal, teeth] a verified province match with full district/subDistrict re-derives BOTH (re-runs CAM-562\'s own backfill for free)', async () => {
    const row = { province: 'Chiang Mai', adminAreaId: 'prov-cnx', adminArea: adminAreaById('prov-cnx') };
    const result = await verifyAndResolvePlacement(fake, row, CNX_FULL_EN);
    expect(result.outcome).toBe('verified');
    expect(result.write).toEqual({ adminAreaId: 'sub-siphum', district: 'Mueang Chiang Mai', subDistrict: 'Si Phum' });
  });

  it('[normal] a verified province-only match (no district component) still verifies, with null district/subDistrict', async () => {
    const row = { province: 'Bueng Kan', adminAreaId: 'prov-buengkan', adminArea: adminAreaById('prov-buengkan') };
    const result = await verifyAndResolvePlacement(fake, row, BUENG_KAN_PROVINCE_ONLY);
    expect(result.outcome).toBe('verified');
    expect(result.write).toEqual({ adminAreaId: 'prov-buengkan', district: null, subDistrict: null });
  });

  it('[error/validation, Critical, teeth] a placement that reverse-geocodes to a DIFFERENT province than claimed is REFUSED, never written as a guess (BR-3)', async () => {
    const row = { province: 'Bueng Kan', adminAreaId: 'prov-buengkan', adminArea: adminAreaById('prov-buengkan') };
    const result = await verifyAndResolvePlacement(fake, row, KRABI_PROVINCE_ONLY);
    expect(result.outcome).toBe('placement_unverified');
    expect(result.write).toBeUndefined();
  });

  it('[null/empty] no province component at all in the verification result is refused, never guessed', async () => {
    const row = { province: 'Bueng Kan', adminAreaId: 'prov-buengkan', adminArea: adminAreaById('prov-buengkan') };
    const result = await verifyAndResolvePlacement(fake, row, []);
    expect(result.outcome).toBe('placement_unverified');
  });

  it('[normal, BR-4] a Thai-stored province derives THAI district/subDistrict text (CAM-562\'s own language rule)', async () => {
    const CNX_FULL_TH = [
      { long_name: 'จังหวัดเชียงใหม่', short_name: 'เชียงใหม่', types: ['administrative_area_level_1', 'political'] },
      { long_name: 'อำเภอเมืองเชียงใหม่', short_name: 'เมืองเชียงใหม่', types: ['administrative_area_level_2', 'political'] },
      { long_name: 'ตำบลศรีภูมิ', short_name: 'ศรีภูมิ', types: ['sublocality_level_1', 'sublocality', 'political'] },
    ];
    const row = { province: 'เชียงใหม่', adminAreaId: 'prov-cnx', adminArea: adminAreaById('prov-cnx') };
    const result = await verifyAndResolvePlacement(fake, row, CNX_FULL_TH);
    expect(result.write).toEqual({ adminAreaId: 'sub-siphum', district: 'เมืองเชียงใหม่', subDistrict: 'ศรีภูมิ' });
  });
});

// ===========================================================================
// (e) planMoves — full orchestration
// ===========================================================================
describe('CAM-571 (e) — planMoves: identify -> fresh re-check -> forward -> verify -> write (Location + CampSite in sync)', () => {
  function registerBuengKanFixtures() {
    GOOGLE_FIXTURES.set('reverse:18.4805,103.6727', () => googleReverseOk(LAOS_COMPONENTS)); // current (bad) coords
    GOOGLE_FIXTURES.set('forward:Bueng Kan, Thailand', () => googleForwardOk(18.35, 103.6));
    GOOGLE_FIXTURES.set('reverse:18.35,103.6', () => googleReverseOk(BUENG_KAN_PROVINCE_ONLY)); // verify new point
  }

  it('[AC-1/teeth] a candidate present in the cache with a Thai host-entered id ABSENT from the cache is NEVER touched, regardless of its current coordinates', async () => {
    registerBuengKanFixtures();
    const cam562Cache = { 'loc-bk-1': { ok: true, zeroResults: false, components: LAOS_COMPONENTS } };
    const fake = makeFakePrisma([
      { id: 'loc-bk-1', province: 'Bueng Kan', lat: 18.4805, lon: 103.6727, adminAreaId: 'prov-buengkan', campSiteIds: ['camp-1'] },
      // Absent from cam562Cache entirely — the structural stand-in for
      // "created/edited after CAM-562's snapshot" (a real host entry).
      { id: 'loc-host-entered', province: 'Bueng Kan', lat: 18.99, lon: 103.99, adminAreaId: 'prov-buengkan', campSiteIds: ['camp-host'] },
    ]);

    const summary = await planMoves(fake, { cam562Cache, dryRun: false });

    expect(summary.moved.map((m) => m.id)).toEqual(['loc-bk-1']);
    const untouched = fake.data.find((r) => r.id === 'loc-host-entered')!;
    expect(untouched.lat).toBe(18.99);
    expect(untouched.lon).toBe(103.99);
  });

  it('[AC-2, teeth] DRY_RUN computes the projected move but writes ZERO rows', async () => {
    registerBuengKanFixtures();
    const cam562Cache = { 'loc-bk-1': { ok: true, zeroResults: false, components: LAOS_COMPONENTS } };
    const fake = makeFakePrisma([{ id: 'loc-bk-1', province: 'Bueng Kan', lat: 18.4805, lon: 103.6727, adminAreaId: 'prov-buengkan', campSiteIds: ['camp-1'] }]);

    const summary = await planMoves(fake, { cam562Cache, dryRun: true });

    expect(summary.moved).toHaveLength(1);
    expect(summary.moved[0]).toMatchObject({ id: 'loc-bk-1', oldLat: 18.4805, newLat: 18.35, newLon: 103.6 });
    expect(fake.data[0].lat).toBe(18.4805); // unchanged — dry run
    expect(fake.campSites[0].latitude).toBe(18.4805); // unchanged — dry run
  });

  it('[AC-3, Critical, teeth] the real run writes the NEW point to BOTH Location AND the linked CampSite (the sync fix)', async () => {
    registerBuengKanFixtures();
    const cam562Cache = { 'loc-bk-1': { ok: true, zeroResults: false, components: LAOS_COMPONENTS } };
    const fake = makeFakePrisma([{ id: 'loc-bk-1', province: 'Bueng Kan', lat: 18.4805, lon: 103.6727, adminAreaId: 'prov-buengkan', campSiteIds: ['camp-1'] }]);

    await planMoves(fake, { cam562Cache, dryRun: false });

    expect(fake.data[0].lat).toBe(18.35);
    expect(fake.data[0].lon).toBe(103.6);
    expect(fake.data[0].province).toBe('Bueng Kan'); // never touched
    expect(fake.campSites[0].latitude).toBe(18.35);
    expect(fake.campSites[0].longitude).toBe(103.6);
  });

  it('[AC-4, error/validation, teeth] a forward-geocoded point that does NOT verify back into the claimed province is refused — never written', async () => {
    GOOGLE_FIXTURES.set('reverse:18.4805,103.6727', () => googleReverseOk(LAOS_COMPONENTS));
    GOOGLE_FIXTURES.set('forward:Bueng Kan, Thailand', () => googleForwardOk(8.0, 98.9)); // wrong result
    GOOGLE_FIXTURES.set('reverse:8,98.9', () => googleReverseOk(KRABI_PROVINCE_ONLY)); // verify shows Krabi, not Bueng Kan
    const cam562Cache = { 'loc-bk-1': { ok: true, zeroResults: false, components: LAOS_COMPONENTS } };
    const fake = makeFakePrisma([{ id: 'loc-bk-1', province: 'Bueng Kan', lat: 18.4805, lon: 103.6727, adminAreaId: 'prov-buengkan', campSiteIds: ['camp-1'] }]);

    const summary = await planMoves(fake, { cam562Cache, dryRun: false });

    expect(summary.moved).toHaveLength(0);
    expect(summary.placementUnverified).toHaveLength(1);
    expect(summary.placementUnverified[0].id).toBe('loc-bk-1');
    expect(fake.data[0].lat).toBe(18.4805); // untouched
  });

  it('[error/validation] a forward-geocode failure (ZERO_RESULTS) is reported, never written', async () => {
    GOOGLE_FIXTURES.set('reverse:18.4805,103.6727', () => googleReverseOk(LAOS_COMPONENTS));
    GOOGLE_FIXTURES.set('forward:Bueng Kan, Thailand', () => googleZeroResults());
    const cam562Cache = { 'loc-bk-1': { ok: true, zeroResults: false, components: LAOS_COMPONENTS } };
    const fake = makeFakePrisma([{ id: 'loc-bk-1', province: 'Bueng Kan', lat: 18.4805, lon: 103.6727, adminAreaId: 'prov-buengkan', campSiteIds: ['camp-1'] }]);

    const summary = await planMoves(fake, { cam562Cache, dryRun: false });

    expect(summary.moved).toHaveLength(0);
    expect(summary.forwardGeocodeFailed).toHaveLength(1);
    expect(fake.data[0].lat).toBe(18.4805);
  });

  it('[AC-5, concurrent/ordering, teeth] a SECOND run after a successful move is idempotent — 0 rows written (the row now reverse-geocodes to Thailand)', async () => {
    registerBuengKanFixtures();
    // The second run's fresh re-check hits the NEW coordinates — register
    // that fixture too (this is real: the moved point already verified as
    // Bueng Kan in run 1's own reverse-verify call).
    GOOGLE_FIXTURES.set('reverse:18.35,103.6', () => googleReverseOk(BUENG_KAN_PROVINCE_ONLY));
    const cam562Cache = { 'loc-bk-1': { ok: true, zeroResults: false, components: LAOS_COMPONENTS } };
    const fake = makeFakePrisma([{ id: 'loc-bk-1', province: 'Bueng Kan', lat: 18.4805, lon: 103.6727, adminAreaId: 'prov-buengkan', campSiteIds: ['camp-1'] }]);

    const first = await planMoves(fake, { cam562Cache, dryRun: false });
    expect(first.moved).toHaveLength(1);

    const snapshotAfterFirst = fake.data.map((r) => ({ ...r }));
    const second = await planMoves(fake, { cam562Cache, dryRun: false });

    expect(second.moved).toHaveLength(0);
    expect(second.alreadyInsideThailand).toHaveLength(1);
    expect(fake.data).toEqual(snapshotAfterFirst); // byte-identical — nothing changed
  });

  it('[normal] onReverseCheckCacheUpdate/onForwardCacheUpdate/onReverseVerifyCacheUpdate fire once per NEW call, never on a cache hit', async () => {
    registerBuengKanFixtures();
    const cam562Cache = { 'loc-bk-1': { ok: true, zeroResults: false, components: LAOS_COMPONENTS } };
    const fake = makeFakePrisma([{ id: 'loc-bk-1', province: 'Bueng Kan', lat: 18.4805, lon: 103.6727, adminAreaId: 'prov-buengkan', campSiteIds: ['camp-1'] }]);
    const onReverseCheckCacheUpdate = vi.fn();
    const onForwardCacheUpdate = vi.fn();
    const onReverseVerifyCacheUpdate = vi.fn();

    const reverseCheckCache: Record<string, unknown> = {};
    const forwardCache: Record<string, unknown> = {};
    const reverseVerifyCache: Record<string, unknown> = {};

    await planMoves(fake, {
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
    // Immediately-following real run reuses the SAME (unchanged coords) cache — 0 new calls.
    await planMoves(fake, {
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
});

// ===========================================================================
// (f) haversineDistanceKm / reportProvinceMismatchDistances
// ===========================================================================
describe('CAM-571 (f) — haversineDistanceKm + reportProvinceMismatchDistances: report-only, never a write', () => {
  it('[normal] haversineDistanceKm returns 0 for the same point and a positive value otherwise', () => {
    expect(haversineDistanceKm({ lat: 13.75, lon: 100.5 }, { lat: 13.75, lon: 100.5 })).toBe(0);
    expect(haversineDistanceKm({ lat: 13.75, lon: 100.5 }, { lat: 18.79, lon: 98.98 })).toBeGreaterThan(400);
  });

  it('[normal, teeth] reports CAM-562\'s province-mismatch rows with a centroid distance, and NEVER writes any of them', async () => {
    // Reuses runCam562Backfill under the hood — a cache entry for a Thai
    // province different from the row's stored province is a "mismatch",
    // never a foreign country (identifyOutsideThailand would not flag it).
    const cam562Cache = { 'loc-mismatch': { ok: true, zeroResults: false, components: KRABI_PROVINCE_ONLY } };
    const fake = makeFakePrisma([{ id: 'loc-mismatch', province: 'Bueng Kan', lat: 18.4, lon: 103.6, adminAreaId: 'prov-buengkan' }]);
    const centroids = { 'Bueng Kan': { lat: 18.35, lng: 103.63 } };

    const report = await reportProvinceMismatchDistances(fake, cam562Cache, centroids);

    expect(report.count).toBe(1);
    expect(report.cases[0]).toMatchObject({ id: 'loc-mismatch', storedProvince: 'Bueng Kan', geocodedProvince: 'Krabi' });
    expect(report.cases[0].distanceKm).toBeGreaterThan(0);
    expect(fake.data[0].lat).toBe(18.4); // never written
    expect(fake.data[0].province).toBe('Bueng Kan'); // never written
  });

  it('[boundary] a far outlier (>100km from centroid) is flagged in farOutliers with a non-empty recommendation naming it', async () => {
    const cam562Cache = { 'loc-far': { ok: true, zeroResults: false, components: KRABI_PROVINCE_ONLY } };
    const fake = makeFakePrisma([{ id: 'loc-far', province: 'Bueng Kan', lat: 10.0, lon: 100.0, adminAreaId: 'prov-buengkan' }]);
    const centroids = { 'Bueng Kan': { lat: 18.35, lng: 103.63 } }; // ~1000km away

    const report = await reportProvinceMismatchDistances(fake, cam562Cache, centroids);
    expect(report.farOutliers).toHaveLength(1);
    expect(report.recommendation).toContain('same defect');
  });

  it('[null/empty] no mismatches at all returns an empty report with a "do not bulk-rewrite" recommendation', async () => {
    const cam562Cache = { 'loc-ok': { ok: true, zeroResults: false, components: BUENG_KAN_PROVINCE_ONLY } };
    const fake = makeFakePrisma([{ id: 'loc-ok', province: 'Bueng Kan', lat: 18.4, lon: 103.6, adminAreaId: 'prov-buengkan' }]);
    const report = await reportProvinceMismatchDistances(fake, cam562Cache, {});
    expect(report.count).toBe(0);
    expect(report.farOutliers).toEqual([]);
    expect(report.recommendation).toContain('do not bulk-rewrite');
  });
});

// ===========================================================================
// (g) checkGuard
// ===========================================================================
describe('CAM-571 (g) — checkGuard: refuses missing opt-in / DATABASE_URL / API key, or a production-looking target', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('[error/validation] refuses when ALLOW_COORDINATES_INSIDE_THAILAND_BACKFILL is unset', () => {
    vi.stubEnv('ALLOW_COORDINATES_INSIDE_THAILAND_BACKFILL', '');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/campvibe_dev');
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', 'k');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('ALLOW_COORDINATES_INSIDE_THAILAND_BACKFILL=1');
  });

  it('[error/validation] refuses when DATABASE_URL is unset', () => {
    vi.stubEnv('ALLOW_COORDINATES_INSIDE_THAILAND_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', 'k');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('DATABASE_URL is not set');
  });

  it('[error/validation] refuses when GOOGLE_GEOCODING_API_KEY is unset', () => {
    vi.stubEnv('ALLOW_COORDINATES_INSIDE_THAILAND_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/campvibe_dev');
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', '');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('GOOGLE_GEOCODING_API_KEY is not set');
  });

  it('[error/validation] refuses when the target URL looks like production', () => {
    vi.stubEnv('ALLOW_COORDINATES_INSIDE_THAILAND_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pw@prod-db.example.com:5432/campvibe');
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', 'k');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL_ENV', '');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('PRODUCTION');
  });

  it('[normal] allows when opt-in + DATABASE_URL + the API key are set and the target does not look like production', () => {
    vi.stubEnv('ALLOW_COORDINATES_INSIDE_THAILAND_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/campvibe_dev');
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', 'k');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL_ENV', '');
    const result = checkGuard();
    expect(result.ok).toBe(true);
  });
});
