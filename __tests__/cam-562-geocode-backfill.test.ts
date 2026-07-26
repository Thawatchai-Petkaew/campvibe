/**
 * cam-562-geocode-backfill.test.ts — CAM-562
 * (platform-hardening/taxonomy-ui-foundation)
 *
 * `scripts/backfill-cam-562-subdistrict-geocode.mjs` reverse-geocodes each
 * real camp's already-trustworthy coordinates (CAM-563 measured 650/652 as
 * real, non-default lat/lon) and advances `Location.adminAreaId` deeper
 * (district, then sub-district) — reusing CAM-563's own bilingual/
 * hierarchical AdminArea matcher (`matchAdminAreaByName`, imported directly,
 * not a third implementation).
 *
 * The two owner-flagged silent-failure modes this suite proves closed:
 *  1. Bilingual mix (CAM-559) — a Thai-stored row AND an English-stored row
 *     both resolve correctly, and the derived `district`/`subDistrict` text
 *     is written in the SAME language the row's own `province` is already
 *     in (BR-4) — never introduces a new mixed-language row.
 *  2. Never silently overwrite `Location.province` — a geocoded province
 *     that disagrees with the row's current AdminArea province node is
 *     reported (`provinceMismatch`) and NONE of that row's fields are
 *     written (BR-2/BR-3).
 *
 * Layers:
 *  (a) extractComponent — pure address-component extraction (ported)
 *  (b) callGoogleGeocode — key safety (the URL, which carries the key, is
 *      NEVER present in any returned `reason` or any captured log line) +
 *      OK/ZERO_RESULTS/non-OK-status/HTTP-error/network-error/missing-key
 *  (c) resolveCandidate — bilingual match, province mismatch, partial
 *      resolution (district-only), unresolved components, defensive guards
 *  (d) runBackfill — dry-run writes ZERO rows but still reports the full
 *      projection + real Google-call count; real run writes; a second run
 *      is idempotent (0 rows updated) AND makes 0 *additional* Google calls
 *      because the cache from the first run is reused (BR-6); a null-
 *      coordinate row and an already-fully-resolved row are never
 *      candidates at all
 *  (e) checkGuard — refuses without opt-in / DATABASE_URL / the API key, or
 *      against a production-looking target (mirrors cam-563's own coverage)
 *
 * Coverage matrix (qa.md §7): normal · null/empty · boundary · error/
 * validation · concurrent/ordering (idempotent re-run + cache reuse).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractComponent,
  callGoogleGeocode,
  resolveCandidate,
  runBackfill,
  checkGuard,
} from '../scripts/backfill-cam-562-subdistrict-geocode.mjs';

// ===========================================================================
// Fake AdminArea tree — Chiang Mai (full 3-level, bilingual), Krabi
// (province-only — the mismatch target).
// ===========================================================================
const ADMIN_AREAS = [
  { id: 'prov-cnx', level: 'PROVINCE', code: '50', nameEn: 'Chiang Mai', nameTh: 'เชียงใหม่', parentId: null },
  { id: 'dist-mueang-cnx', level: 'DISTRICT', code: '5001', nameEn: 'Mueang Chiang Mai', nameTh: 'เมืองเชียงใหม่', parentId: 'prov-cnx' },
  { id: 'sub-siphum', level: 'SUBDISTRICT', code: '500101', nameEn: 'Si Phum', nameTh: 'ศรีภูมิ', parentId: 'dist-mueang-cnx' },
  { id: 'prov-krabi', level: 'PROVINCE', code: '81', nameEn: 'Krabi', nameTh: 'กระบี่', parentId: null },
];

function adminAreaById(id: string) {
  return ADMIN_AREAS.find((a) => a.id === id) ?? null;
}

function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  for (const [key, clause] of Object.entries(where)) {
    if (key === 'OR') {
      const clauses = clause as Array<Record<string, unknown>>;
      if (!clauses.some((c) => matchesWhere(row, c))) return false;
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
  return {
    data,
    location: {
      count: async ({ where }: { where?: Record<string, unknown> } = {}) => {
        if (!where) return data.length;
        return data.filter((row) => matchesWhere(row, where)).length;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        return data
          .filter((row) => matchesWhere(row, where))
          .map((row) => ({
            id: row.id,
            province: row.province,
            district: row.district ?? null,
            subDistrict: row.subDistrict ?? null,
            lat: row.lat ?? null,
            lon: row.lon ?? null,
            adminAreaId: row.adminAreaId ?? null,
            adminArea: row.adminAreaId ? adminAreaById(row.adminAreaId as string) : null,
            campSites: row.hasLiveCamp ? [{ id: `camp-for-${row.id as string}` }] : [],
          }));
      },
      update: async ({ where, data: patch }: { where: { id: string }; data: Record<string, unknown> }) => {
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
      findUnique: async ({ where: { id } }: { where: { id: string } }) => {
        const found = adminAreaById(id);
        return found ? { id: found.id, code: found.code, nameTh: found.nameTh, nameEn: found.nameEn, level: found.level } : null;
      },
    },
  };
}

// ===========================================================================
// Google address_components fixtures (realistic — same style as
// __tests__/cam-554-geocode-routes.test.ts)
// ===========================================================================
const CNX_FULL_EN = [
  { long_name: 'Chiang Mai Province', short_name: 'Chiang Mai', types: ['administrative_area_level_1', 'political'] },
  { long_name: 'Amphoe Mueang Chiang Mai', short_name: 'Mueang Chiang Mai', types: ['administrative_area_level_2', 'political'] },
  { long_name: 'Tambon Si Phum', short_name: 'Si Phum', types: ['sublocality_level_1', 'sublocality', 'political'] },
  { long_name: 'Thailand', short_name: 'TH', types: ['country', 'political'] },
];
const CNX_FULL_TH = [
  { long_name: 'จังหวัดเชียงใหม่', short_name: 'เชียงใหม่', types: ['administrative_area_level_1', 'political'] },
  { long_name: 'อำเภอเมืองเชียงใหม่', short_name: 'เมืองเชียงใหม่', types: ['administrative_area_level_2', 'political'] },
  { long_name: 'ตำบลศรีภูมิ', short_name: 'ศรีภูมิ', types: ['sublocality_level_1', 'sublocality', 'political'] },
  { long_name: 'ประเทศไทย', short_name: 'TH', types: ['country', 'political'] },
];
const KRABI_PROVINCE_ONLY = [
  { long_name: 'Krabi Province', short_name: 'Krabi', types: ['administrative_area_level_1', 'political'] },
  { long_name: 'Thailand', short_name: 'TH', types: ['country', 'political'] },
];
const CNX_DISTRICT_ONLY = [
  { long_name: 'Chiang Mai Province', short_name: 'Chiang Mai', types: ['administrative_area_level_1', 'political'] },
  { long_name: 'Amphoe Mueang Chiang Mai', short_name: 'Mueang Chiang Mai', types: ['administrative_area_level_2', 'political'] },
  { long_name: 'Tambon Nonexistent', short_name: 'Nonexistent', types: ['sublocality_level_1', 'sublocality', 'political'] },
];
const CNX_PROVINCE_ONLY_NO_DISTRICT = [
  { long_name: 'Chiang Mai Province', short_name: 'Chiang Mai', types: ['administrative_area_level_1', 'political'] },
  { long_name: 'Thailand', short_name: 'TH', types: ['country', 'political'] },
];
const CNX_DISTRICT_UNMATCHED = [
  { long_name: 'Chiang Mai Province', short_name: 'Chiang Mai', types: ['administrative_area_level_1', 'political'] },
  { long_name: 'Amphoe Nonexistent District', short_name: 'Nonexistent District', types: ['administrative_area_level_2', 'political'] },
];

const googleOk = (components: unknown[]) => ({
  ok: true,
  json: async () => ({ status: 'OK', results: [{ address_components: components, geometry: { location: { lat: 0, lng: 0 } } }] }),
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
      const latlng = u.searchParams.get('latlng')!;
      const factory = GOOGLE_FIXTURES.get(latlng);
      if (!factory) throw new Error(`test bug: no fixture registered for latlng=${latlng}`);
      return factory();
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_GEOCODING_API_KEY;
});

// ===========================================================================
// (a) extractComponent — pure extraction, priority order
// ===========================================================================
describe('CAM-562 (a) — extractComponent: priority-ordered address-component extraction', () => {
  it('[normal] returns the long_name for the first matching type', () => {
    expect(extractComponent(CNX_FULL_EN, ['administrative_area_level_1'])).toBe('Chiang Mai Province');
  });

  it('[normal] tries types in priority order (sublocality_level_1 before locality)', () => {
    expect(extractComponent(CNX_FULL_EN, ['sublocality_level_1', 'administrative_area_level_3', 'locality'])).toBe('Tambon Si Phum');
  });

  it('[null/empty] no matching type returns null', () => {
    expect(extractComponent(CNX_PROVINCE_ONLY_NO_DISTRICT, ['administrative_area_level_2'])).toBeNull();
  });
});

// ===========================================================================
// (b) callGoogleGeocode — key safety + status handling
// ===========================================================================
describe('CAM-562 (b) — callGoogleGeocode: status handling + key safety', () => {
  it('[normal] OK status returns the first result\'s address_components', async () => {
    GOOGLE_FIXTURES.set('18,99', () => googleOk(CNX_FULL_EN));
    const result = await callGoogleGeocode(18, 99);
    expect(result).toEqual({ ok: true, zeroResults: false, components: CNX_FULL_EN });
  });

  it('[null/empty] ZERO_RESULTS returns zeroResults:true, never guesses', async () => {
    GOOGLE_FIXTURES.set('22,99', () => googleZeroResults());
    const result = await callGoogleGeocode(22, 99);
    expect(result).toEqual({ ok: true, zeroResults: true, components: [] });
  });

  it('[error/validation] a non-OK Google status is reported, never thrown', async () => {
    GOOGLE_FIXTURES.set('30,99', () => ({ ok: true, json: async () => ({ status: 'REQUEST_DENIED', results: [] }) }));
    const result = await callGoogleGeocode(30, 99);
    expect(result).toEqual({ ok: false, reason: 'google_REQUEST_DENIED' });
  });

  it('[error/validation] a non-OK HTTP response is reported by status code', async () => {
    GOOGLE_FIXTURES.set('31,99', () => ({ ok: false, status: 500 }));
    const result = await callGoogleGeocode(31, 99);
    expect(result).toEqual({ ok: false, reason: 'http_500' });
  });

  it('[error/validation] a network failure is reported by message, never thrown', async () => {
    GOOGLE_FIXTURES.set('32,99', () => {
      throw new Error('simulated network failure');
    });
    const result = await callGoogleGeocode(32, 99);
    expect(result).toEqual({ ok: false, reason: 'simulated network failure' });
  });

  it('[boundary] a missing API key refuses without ever calling fetch', async () => {
    delete process.env.GOOGLE_GEOCODING_API_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const result = await callGoogleGeocode(1, 1);
    expect(result).toEqual({ ok: false, reason: 'missing_key' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('[Critical: key safety] the key-bearing URL never appears in any returned `reason`', async () => {
    GOOGLE_FIXTURES.set('33,99', () => ({ ok: false, status: 500 }));
    const result = await callGoogleGeocode(33, 99);
    expect(JSON.stringify(result)).not.toContain(TEST_KEY);
    expect(JSON.stringify(result)).not.toContain('maps.googleapis.com');
  });
});

// ===========================================================================
// (c) resolveCandidate — bilingual match, mismatch, partial resolution
// ===========================================================================
describe('CAM-562 (c) — resolveCandidate: bilingual + hierarchical + never overwrites province', () => {
  const fake = makeFakePrisma([]);

  it('[normal] an English-stored row resolves to sub-district and derives ENGLISH district/subDistrict text (BR-4)', async () => {
    const row = {
      id: 'loc-en', province: 'Chiang Mai', district: null, subDistrict: null,
      adminAreaId: 'prov-cnx', adminArea: adminAreaById('prov-cnx'),
    };
    const result = await resolveCandidate(fake, row, { ok: true, zeroResults: false, components: CNX_FULL_EN });
    expect(result.outcome).toBe('resolved_subdistrict');
    expect(result.write).toEqual({ adminAreaId: 'sub-siphum', district: 'Mueang Chiang Mai', subDistrict: 'Si Phum' });
  });

  it('[normal] a Thai-stored row resolves the SAME node and derives THAI district/subDistrict text (BR-4, the CAM-559 mixed-language case)', async () => {
    const row = {
      id: 'loc-th', province: 'เชียงใหม่', district: null, subDistrict: null,
      adminAreaId: 'prov-cnx', adminArea: adminAreaById('prov-cnx'),
    };
    const result = await resolveCandidate(fake, row, { ok: true, zeroResults: false, components: CNX_FULL_TH });
    expect(result.outcome).toBe('resolved_subdistrict');
    expect(result.write).toEqual({ adminAreaId: 'sub-siphum', district: 'เมืองเชียงใหม่', subDistrict: 'ศรีภูมิ' });
  });

  it('[error/validation, teeth] a disagreeing geocoded province is REPORTED, not written — Location.province is never touched (BR-2/BR-3)', async () => {
    const row = {
      id: 'loc-mismatch', province: 'Chiang Mai', district: null, subDistrict: null,
      adminAreaId: 'prov-cnx', adminArea: adminAreaById('prov-cnx'),
    };
    const result = await resolveCandidate(fake, row, { ok: true, zeroResults: false, components: KRABI_PROVINCE_ONLY });
    expect(result.outcome).toBe('province_mismatch');
    expect(result.write).toBeUndefined();
    expect(result).toMatchObject({
      storedProvince: 'Chiang Mai',
      storedProvinceNode: { nameEn: 'Chiang Mai' },
      geocodedProvinceNode: { nameEn: 'Krabi' },
    });
  });

  it('[boundary] province + district resolve but sub-district does not match -> resolved_district_only, adminAreaId advances only to DISTRICT', async () => {
    const row = {
      id: 'loc-district-only', province: 'Chiang Mai', district: null, subDistrict: null,
      adminAreaId: 'prov-cnx', adminArea: adminAreaById('prov-cnx'),
    };
    const result = await resolveCandidate(fake, row, { ok: true, zeroResults: false, components: CNX_DISTRICT_ONLY });
    expect(result.outcome).toBe('resolved_district_only');
    expect(result.write).toEqual({ adminAreaId: 'dist-mueang-cnx', district: 'Mueang Chiang Mai', subDistrict: null });
  });

  it('[null/empty] no district component at all (province-only Google answer) -> unresolved, never guessed', async () => {
    const row = {
      id: 'loc-no-district', province: 'Chiang Mai', district: null, subDistrict: null,
      adminAreaId: 'prov-cnx', adminArea: adminAreaById('prov-cnx'),
    };
    const result = await resolveCandidate(fake, row, { ok: true, zeroResults: false, components: CNX_PROVINCE_ONLY_NO_DISTRICT });
    expect(result.outcome).toBe('no_district_component');
    expect(result.write).toBeUndefined();
  });

  it('[error/validation] a district raw value that matches no AdminArea node stops at province, never guesses (EC pattern)', async () => {
    const row = {
      id: 'loc-district-unmatched', province: 'Chiang Mai', district: null, subDistrict: null,
      adminAreaId: 'prov-cnx', adminArea: adminAreaById('prov-cnx'),
    };
    const result = await resolveCandidate(fake, row, { ok: true, zeroResults: false, components: CNX_DISTRICT_UNMATCHED });
    expect(result.outcome).toBe('district_unmatched');
    expect(result.write).toBeUndefined();
  });

  it('[null/empty] ZERO_RESULTS passes through as unresolved, never a crash', async () => {
    const row = { id: 'loc-zero', province: 'Chiang Mai', adminAreaId: 'prov-cnx', adminArea: adminAreaById('prov-cnx') };
    const result = await resolveCandidate(fake, row, { ok: true, zeroResults: true, components: [] });
    expect(result.outcome).toBe('zero_results');
  });

  it('[error/validation] a failed geocode call passes through its reason, never a crash', async () => {
    const row = { id: 'loc-failed', province: 'Chiang Mai', adminAreaId: 'prov-cnx', adminArea: adminAreaById('prov-cnx') };
    const result = await resolveCandidate(fake, row, { ok: false, reason: 'http_500' });
    expect(result).toEqual({ id: 'loc-failed', outcome: 'geocode_failed', reason: 'http_500' });
  });

  it('[boundary, defensive] a row with no current adminArea (should not occur today) is reported, never guessed', async () => {
    const row = { id: 'loc-defensive-1', province: 'x', adminAreaId: null, adminArea: null };
    const result = await resolveCandidate(fake, row, { ok: true, zeroResults: false, components: CNX_FULL_EN });
    expect(result.outcome).toBe('skipped_no_current_admin_area');
  });

  it('[boundary, defensive] a row whose current adminArea is unexpectedly not PROVINCE-level is reported, never guessed', async () => {
    const row = { id: 'loc-defensive-2', province: 'Chiang Mai', adminAreaId: 'dist-mueang-cnx', adminArea: adminAreaById('dist-mueang-cnx') };
    const result = await resolveCandidate(fake, row, { ok: true, zeroResults: false, components: CNX_FULL_EN });
    expect(result.outcome).toBe('skipped_unexpected_admin_level');
  });
});

// ===========================================================================
// (d) runBackfill — dry-run vs real, idempotency, cache reuse, exclusions
// ===========================================================================
describe('CAM-562 (d) — runBackfill: dry-run writes nothing, real run writes, second run is idempotent + reuses the cache', () => {
  const seedRows = () => [
    { id: 'loc-en', province: 'Chiang Mai', district: null, subDistrict: null, lat: 18, lon: 99, adminAreaId: 'prov-cnx', hasLiveCamp: true },
    { id: 'loc-th', province: 'เชียงใหม่', district: null, subDistrict: null, lat: 19, lon: 99, adminAreaId: 'prov-cnx', hasLiveCamp: true },
    { id: 'loc-mismatch', province: 'Chiang Mai', district: null, subDistrict: null, lat: 20, lon: 99, adminAreaId: 'prov-cnx', hasLiveCamp: true },
    { id: 'loc-zero', province: 'Chiang Mai', district: null, subDistrict: null, lat: 22, lon: 99, adminAreaId: 'prov-cnx', hasLiveCamp: true },
    { id: 'loc-null-coords', province: 'x', district: null, subDistrict: null, lat: null, lon: null, adminAreaId: null, hasLiveCamp: false },
    { id: 'loc-already-resolved', province: 'Krabi', district: 'Some District', subDistrict: 'Some Subdistrict', lat: 26, lon: 99, adminAreaId: 'prov-krabi', hasLiveCamp: true },
  ];

  function registerFixtures() {
    GOOGLE_FIXTURES.set('18,99', () => googleOk(CNX_FULL_EN));
    GOOGLE_FIXTURES.set('19,99', () => googleOk(CNX_FULL_TH));
    GOOGLE_FIXTURES.set('20,99', () => googleOk(KRABI_PROVINCE_ONLY));
    GOOGLE_FIXTURES.set('22,99', () => googleZeroResults());
  }

  it('[AC-1, teeth] DRY_RUN makes the real Google calls and reports the projection but performs ZERO prisma.location.update calls', async () => {
    registerFixtures();
    const fake = makeFakePrisma(seedRows());
    const cache: Record<string, unknown> = {};
    const report = await runBackfill(fake, { log: () => {}, dryRun: true, cache });

    // loc-null-coords and loc-already-resolved are never candidates.
    expect(report.candidates).toBe(4);
    expect(report.resolvedSubDistrict).toBe(2); // loc-en, loc-th
    expect(report.updated).toBe(2); // "would update" count in dry-run
    expect(report.provinceMismatch).toHaveLength(1);
    expect(report.unresolved).toHaveLength(1); // loc-zero
    expect(report.apiCallsMade).toBe(4);

    // Nothing was actually written.
    expect(fake.data.find((r) => r.id === 'loc-en')!.district).toBeNull();
    expect(fake.data.find((r) => r.id === 'loc-en')!.adminAreaId).toBe('prov-cnx');
  });

  it('[AC-2/AC-3, teeth] the real run WRITES resolved rows, never writes a mismatched row, and never touches `province`', async () => {
    registerFixtures();
    const fake = makeFakePrisma(seedRows());
    const cache: Record<string, unknown> = {};
    await runBackfill(fake, { log: () => {}, dryRun: false, cache });

    const en = fake.data.find((r) => r.id === 'loc-en')!;
    expect(en.adminAreaId).toBe('sub-siphum');
    expect(en.district).toBe('Mueang Chiang Mai');
    expect(en.subDistrict).toBe('Si Phum');
    expect(en.province).toBe('Chiang Mai'); // untouched

    const th = fake.data.find((r) => r.id === 'loc-th')!;
    expect(th.district).toBe('เมืองเชียงใหม่');
    expect(th.subDistrict).toBe('ศรีภูมิ');

    const mismatch = fake.data.find((r) => r.id === 'loc-mismatch')!;
    expect(mismatch.district).toBeNull();
    expect(mismatch.subDistrict).toBeNull();
    expect(mismatch.adminAreaId).toBe('prov-cnx'); // unchanged — never re-homed
    expect(mismatch.province).toBe('Chiang Mai'); // untouched
  });

  it('[EC-3, boundary] a null-coordinate row is never a candidate — left blank, never guessed', async () => {
    registerFixtures();
    const fake = makeFakePrisma(seedRows());
    await runBackfill(fake, { log: () => {}, dryRun: false, cache: {} });
    const orphan = fake.data.find((r) => r.id === 'loc-null-coords')!;
    expect(orphan.district).toBeNull();
    expect(orphan.subDistrict).toBeNull();
    expect(orphan.adminAreaId).toBeNull();
  });

  it('[EC-4, concurrent/ordering, teeth] a second run changes ZERO rows and makes ZERO additional Google calls (cache reused, BR-6)', async () => {
    registerFixtures();
    const fake = makeFakePrisma(seedRows());
    const cache: Record<string, unknown> = {};

    const first = await runBackfill(fake, { log: () => {}, dryRun: false, cache });
    expect(first.updated).toBe(2);
    expect(first.apiCallsMade).toBe(4);

    const snapshotAfterFirst = fake.data.map((r) => ({ ...r }));
    const second = await runBackfill(fake, { log: () => {}, dryRun: false, cache });

    expect(second.updated).toBe(0);
    expect(second.apiCallsMade).toBe(0); // fully served from cache
    expect(second.apiCallsCached).toBe(second.candidates);
    expect(fake.data).toEqual(snapshotAfterFirst); // byte-identical — nothing changed
  });

  it('[normal] onCacheUpdate fires once per NEW Google call, never on a cache hit', async () => {
    registerFixtures();
    const fake = makeFakePrisma(seedRows());
    const cache: Record<string, unknown> = {};
    const onCacheUpdate = vi.fn();

    await runBackfill(fake, { log: () => {}, dryRun: false, cache, onCacheUpdate });
    expect(onCacheUpdate).toHaveBeenCalledTimes(4);

    onCacheUpdate.mockClear();
    await runBackfill(fake, { log: () => {}, dryRun: false, cache, onCacheUpdate });
    expect(onCacheUpdate).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// (e) checkGuard — refuses before touching any row or spending any call
// ===========================================================================
describe('CAM-562 (e) — checkGuard: refuses missing opt-in / DATABASE_URL / API key, or a production-looking target', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('[error/validation] refuses when ALLOW_SUBDISTRICT_GEOCODE_BACKFILL is unset', () => {
    vi.stubEnv('ALLOW_SUBDISTRICT_GEOCODE_BACKFILL', '');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/campvibe_dev');
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', 'k');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('ALLOW_SUBDISTRICT_GEOCODE_BACKFILL=1');
  });

  it('[error/validation] refuses when DATABASE_URL is unset', () => {
    vi.stubEnv('ALLOW_SUBDISTRICT_GEOCODE_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', 'k');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('DATABASE_URL is not set');
  });

  it('[error/validation] refuses when GOOGLE_GEOCODING_API_KEY is unset', () => {
    vi.stubEnv('ALLOW_SUBDISTRICT_GEOCODE_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/campvibe_dev');
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', '');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('GOOGLE_GEOCODING_API_KEY is not set');
  });

  it('[error/validation] refuses when the target URL looks like production', () => {
    vi.stubEnv('ALLOW_SUBDISTRICT_GEOCODE_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pw@prod-db.example.com:5432/campvibe');
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', 'k');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL_ENV', '');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('PRODUCTION');
  });

  it('[normal] allows when opt-in + DATABASE_URL + the API key are set and the target does not look like production', () => {
    vi.stubEnv('ALLOW_SUBDISTRICT_GEOCODE_BACKFILL', '1');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/campvibe_dev');
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', 'k');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL_ENV', '');
    const result = checkGuard();
    expect(result.ok).toBe(true);
  });
});
