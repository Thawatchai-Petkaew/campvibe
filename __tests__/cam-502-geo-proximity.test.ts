/**
 * CAM-502 (P2 geo proximity) — "ใกล้/แถว X" returns camps NEAR a province,
 * sorted nearest-first, via a data-derived province-centroid table (no
 * per-province hardcoding, BR-1/BR-5).
 *
 * Coverage matrix (story.md AC-1..4, BR-1..5, EC-1..5):
 *   - BR-1  computeCentroids: deterministic mean lat/lng per province,
 *           sorted key order, sparse guard (<2 camps omitted), invalid/
 *           missing geo rows excluded
 *   - BR-3  resolvePlace: proximity marker + province -> `near` (not
 *           `province`); bare Bangkok under proximity; exact-province path
 *           (CAM-501) unchanged with no marker, EXCEPT bare/exact Bangkok
 *           which now resolves to province="Bangkok" too (CAM-504 GEO-2 fix
 *           — see the [CAM-504] cases below; previously unresolved `{}`)
 *   - BR-2/EC-1 executeSearchCampsites near-path: centroid lookup, bbox
 *           pre-filter shape, haversine ascending sort, MAX_NEAR_KM radius
 *           cap, candidate-count cap (CAM-344/EC-4), AND with terrain
 *   - EC-2  sparse/unknown centroid -> exact-province fallback, never crash
 *   - EC-3  near + province both set -> near wins (province ignored)
 *   - AC-4  zero camps within radius -> honest empty cards, no second query
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeCentroids, MIN_CAMPS_FOR_CENTROID } from '../scripts/build-province-centroids.mjs';
import { resolvePlace } from '@/lib/ai/place-resolver';
import { haversineDistanceKm } from '@/lib/geo/distance';
import realProvinceCentroids from '@/prisma/data/province-centroids.json';

// ---------------------------------------------------------------------------
// BR-1 — computeCentroids (pure, no DB)
// ---------------------------------------------------------------------------

describe('CAM-502 computeCentroids — BR-1 mean lat/lng + determinism', () => {
  it('[normal] two camps in one province -> centroid is the exact mean', () => {
    const rows = [
      { province: 'Nakhon Nayok', latitude: 14.0, longitude: 101.0 },
      { province: 'Nakhon Nayok', latitude: 14.2, longitude: 101.2 },
    ];
    const result = computeCentroids(rows);
    expect(result['Nakhon Nayok']).toEqual({ lat: 14.1, lng: 101.1, campCount: 2 });
  });

  it('[normal] deterministic — same input (any row order) -> byte-identical output', () => {
    const rowsA = [
      { province: 'Chon Buri', latitude: 13.0, longitude: 101.0 },
      { province: 'Bangkok', latitude: 13.7, longitude: 100.5 },
      { province: 'Chon Buri', latitude: 13.2, longitude: 101.2 },
    ];
    const rowsB = [rowsA[1], rowsA[2], rowsA[0]]; // shuffled
    expect(JSON.stringify(computeCentroids(rowsA))).toBe(JSON.stringify(computeCentroids(rowsB)));
  });

  it('[normal] output keys are sorted (deterministic key order independent of input order)', () => {
    const rows = [
      { province: 'Yala', latitude: 6.5, longitude: 101.3 },
      { province: 'Yala', latitude: 6.6, longitude: 101.4 },
      { province: 'Bangkok', latitude: 13.7, longitude: 100.5 },
      { province: 'Bangkok', latitude: 13.8, longitude: 100.6 },
    ];
    expect(Object.keys(computeCentroids(rows))).toEqual(['Bangkok', 'Yala']);
  });

  it('[edge/EC-2] a province with fewer than MIN_CAMPS_FOR_CENTROID camps is OMITTED (sparse guard)', () => {
    expect(MIN_CAMPS_FOR_CENTROID).toBe(2);
    const rows = [{ province: 'Trat', latitude: 12.2, longitude: 102.5 }]; // only 1 camp
    const result = computeCentroids(rows);
    expect(result['Trat']).toBeUndefined();
  });

  it('[edge] a province with exactly MIN_CAMPS_FOR_CENTROID camps IS included (boundary)', () => {
    const rows = [
      { province: 'Trat', latitude: 12.2, longitude: 102.5 },
      { province: 'Trat', latitude: 12.3, longitude: 102.6 },
    ];
    expect(computeCentroids(rows)['Trat']).toBeDefined();
  });

  it('[null/empty] a row with a missing province is excluded, never crashes', () => {
    const rows = [
      { province: null, latitude: 13.0, longitude: 101.0 },
      { province: undefined, latitude: 13.0, longitude: 101.0 },
      { province: 'Phuket', latitude: 7.9, longitude: 98.4 },
      { province: 'Phuket', latitude: 8.0, longitude: 98.5 },
    ];
    const result = computeCentroids(rows);
    expect(Object.keys(result)).toEqual(['Phuket']);
  });

  it('[null/empty] a row with a non-finite/missing lat or lng is excluded (never coerced to 0,0)', () => {
    const rows = [
      { province: 'Krabi', latitude: NaN, longitude: 98.9 },
      { province: 'Krabi', latitude: null, longitude: 98.9 },
      { province: 'Krabi', latitude: 8.0, longitude: 98.9 },
      { province: 'Krabi', latitude: 8.1, longitude: 99.0 },
    ];
    const result = computeCentroids(rows);
    // only the 2 valid rows count toward the mean
    expect(result['Krabi']).toEqual({ lat: 8.05, lng: 98.95, campCount: 2 });
  });

  it('[edge] an empty input list -> empty centroid table, never throws', () => {
    expect(computeCentroids([])).toEqual({});
  });

  it('[real data] the committed prisma/data/province-centroids.json has no sparse (<2-camp) province', () => {
    for (const [province, entry] of Object.entries(realProvinceCentroids as Record<string, { campCount: number }>)) {
      expect(entry.campCount, `province ${province}`).toBeGreaterThanOrEqual(MIN_CAMPS_FOR_CENTROID);
    }
    // sanity: Bangkok + a real "around Bangkok" province are both present.
    expect(realProvinceCentroids).toHaveProperty('Bangkok');
    expect(realProvinceCentroids).toHaveProperty('Nakhon Nayok');
  });
});

// ---------------------------------------------------------------------------
// BR-3 — resolvePlace proximity detection
// ---------------------------------------------------------------------------

describe('CAM-502 resolvePlace — BR-3 proximity ("ใกล้/แถว X") vs exact ("ใน X")', () => {
  it('[AC-1] "ลานกางเต็นท์ใกล้กรุงเทพ" -> near "กรุงเทพ" (proximity, bare Bangkok form)', () => {
    expect(resolvePlace('ลานกางเต็นท์ใกล้กรุงเทพ')).toEqual({ near: 'กรุงเทพ' });
  });

  // CAM-504 (GEO-2 fix) — SUPERSEDES this test's original P2-era pinned
  // behavior. Leaving "ในกรุงเทพ" fully unresolved (`{}`, no hint at all)
  // let the model reach for `near` once P2 taught it that capability — the
  // real GEO-2 regression. A bare/exact Bangkok mention with NO proximity
  // marker must resolve to an EXACT `province` hint, same as every other
  // province already does.
  it('[AC-3/CAM-504] "ในกรุงเทพ" -> province="Bangkok" (exact, no proximity marker)', () => {
    expect(resolvePlace('ในกรุงเทพ')).toEqual({ province: 'Bangkok' });
  });

  it('[CAM-504] bare "กรุงเทพ" with no "ใน" and no proximity marker -> province="Bangkok" (same exact path)', () => {
    expect(resolvePlace('กรุงเทพมีลานกางเต็นท์ไหม')).toEqual({ province: 'Bangkok' });
  });

  it('[normal] proximity marker + a full formal province name -> near (English canonical)', () => {
    expect(resolvePlace('ริมน้ำใกล้เชียงใหม่')).toEqual({ near: 'Chiang Mai' });
  });

  it('[normal] "แถว" + a province -> near (a different proximity marker than ใกล้)', () => {
    expect(resolvePlace('แคมป์แถวภูเก็ต')).toEqual({ near: 'Phuket' });
  });

  it('[regression/CAM-501 pinned] no proximity marker -> exact province, unchanged behavior', () => {
    expect(resolvePlace('แคมป์ริมน้ำเชียงใหม่')).toEqual({ province: 'Chiang Mai' });
  });

  it('[regression/CAM-501 pinned] "อยากไปแคมป์แถวอีสาน" (แถว + a REGION, not a province) -> region, unaffected by proximity', () => {
    expect(resolvePlace('อยากไปแคมป์แถวอีสาน')).toEqual({ region: 'ภาคอีสาน' });
  });

  it('[regression/CAM-501 pinned] "แคมป์ภาคตะวันออกใกล้ทะเล" (ใกล้ + a region + a terrain word, no province) -> region, unaffected', () => {
    expect(resolvePlace('แคมป์ภาคตะวันออกใกล้ทะเล')).toEqual({ region: 'ภาคตะวันออก' });
  });

  it('[edge] a proximity marker with no place at all -> {}', () => {
    expect(resolvePlace('มีที่ใกล้ๆ ไหม')).toEqual({});
  });

  it('[null/empty] empty string -> {}, never throws', () => {
    expect(resolvePlace('')).toEqual({});
  });

  // CAM-501-DEF-1 regression, now under PROXIMITY mode — QA verify (CAM-502):
  // the ambiguous-province skip-set (เลย/ตาก/ตราด/น่าน/แพร่/ตรัง/ยะลา) must
  // still be honored when a proximity marker is ALSO present in the same
  // sentence; `detectProvince` runs unconditionally on the proximity path
  // too (no separate/looser matcher), so these must stay {} exactly as they
  // do without a proximity marker.
  it('[regression/DEF-1 x proximity] "ไปตากผ้าใกล้ๆ บ้าน" (ตาก=sun-dry verb + ใกล้ๆ) -> {} not near="Tak"', () => {
    expect(resolvePlace('ไปตากผ้าใกล้ๆ บ้าน')).toEqual({});
  });

  it('[regression/DEF-1 x proximity] "เยอะเลยแถวนี้" (เลย=emphasis particle + แถว) -> {} not near="Loei"', () => {
    expect(resolvePlace('เยอะเลยแถวนี้')).toEqual({});
  });

  it('[regression/DEF-1 x proximity] "แถวน่านน้ำ" (น่าน is a substring of the unrelated word น่านน้ำ="territorial waters", + แถว) -> {} not near="Nan"', () => {
    expect(resolvePlace('แถวน่านน้ำ')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// BR-2/EC-1..EC-4 — executeSearchCampsites near-path
// ---------------------------------------------------------------------------

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

const {
  executeSearchCampsites,
  searchCampsitesArgsSchema,
  MAX_NEAR_KM,
  NEAR_CANDIDATE_CAP,
  bboxForRadius,
} = await import('@/lib/ai/tools/search-campsites');

function cardRow(id: string) {
  return { id, reviewCount: 0, location: { province: 'Bangkok' }, options: [] };
}

const BANGKOK_CENTROID = (realProvinceCentroids as Record<string, { lat: number; lng: number }>)['Bangkok'];
const DEG_PER_KM_LAT = 1 / 111.32;

/** A synthetic point exactly `km` due north of the Bangkok centroid. */
function pointAtKm(km: number) {
  return { lat: BANGKOK_CENTROID.lat + km * DEG_PER_KM_LAT, lng: BANGKOK_CENTROID.lng };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('executeSearchCampsites — near-path (CAM-502 BR-2)', () => {
  it('[unit] near="Bangkok" (English, direct) -> bbox pre-filter on the candidate query, no ThailandLocation lookup', async () => {
    mockFindMany.mockResolvedValueOnce([]); // candidate query — zero candidates

    const args = searchCampsitesArgsSchema.parse({ near: 'Bangkok' });
    const result = await executeSearchCampsites(args);

    expect(mockThailandLocationFindFirst).not.toHaveBeenCalled();
    expect(result).toEqual({ cards: [] });

    const candidateCall = mockFindMany.mock.calls[0][0] as {
      where: { AND?: Array<{ latitude?: { gte: number; lte: number }; longitude?: { gte: number; lte: number } }> };
      select: unknown;
      take: number;
    };
    expect(candidateCall.select).toEqual({ id: true, latitude: true, longitude: true });
    expect(candidateCall.take).toBe(NEAR_CANDIDATE_CAP);

    const bboxClause = (candidateCall.where.AND ?? []).find((c) => c.latitude !== undefined);
    const expectedBbox = bboxForRadius(BANGKOK_CENTROID, MAX_NEAR_KM);
    expect(bboxClause?.latitude).toEqual({ gte: expectedBbox.latMin, lte: expectedBbox.latMax });
    expect(bboxClause?.longitude).toEqual({ gte: expectedBbox.lngMin, lte: expectedBbox.lngMax });
  });

  it('[unit] near="กรุงเทพ" (Thai, via ThailandLocation) resolves to the same "Bangkok" centroid key', async () => {
    mockThailandLocationFindFirst.mockResolvedValueOnce({ provinceNameEn: 'Bangkok' });
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ near: 'กรุงเทพ' });
    await executeSearchCampsites(args);

    expect(mockThailandLocationFindFirst).toHaveBeenCalledOnce();
    const candidateCall = mockFindMany.mock.calls[0][0] as { where: { AND?: unknown[] } };
    expect(candidateCall.where.AND).toBeDefined();
  });

  it('[BR-2] candidates are sorted ascending by haversine distance from the centroid, then take page-size', async () => {
    const near0 = { id: 'c-0km', latitude: pointAtKm(0).lat, longitude: pointAtKm(0).lng };
    const near120 = { id: 'c-120km', latitude: pointAtKm(120).lat, longitude: pointAtKm(120).lng };
    const near60 = { id: 'c-60km', latitude: pointAtKm(60).lat, longitude: pointAtKm(60).lng };
    // candidate query returns them OUT of distance order
    mockFindMany.mockResolvedValueOnce([near120, near0, near60]);
    // card-fetch query returns them in yet another order — proves the
    // caller re-sorts by distance, not by findMany's own row order.
    mockFindMany.mockResolvedValueOnce([cardRow('c-60km'), cardRow('c-0km'), cardRow('c-120km')]);

    const args = searchCampsitesArgsSchema.parse({ near: 'Bangkok' });
    const result = await executeSearchCampsites(args);

    expect(result.cards.map((c) => c.id)).toEqual(['c-0km', 'c-60km', 'c-120km']);

    const cardFetchCall = mockFindMany.mock.calls[1][0] as { where: { id: { in: string[] } }; select: unknown };
    expect(new Set(cardFetchCall.where.id.in)).toEqual(new Set(['c-0km', 'c-60km', 'c-120km']));
  });

  it('[BR-2/radius cap] a candidate beyond MAX_NEAR_KM is dropped even though the bbox (a rectangle) admitted it', async () => {
    expect(MAX_NEAR_KM).toBe(250);
    const inRange = { id: 'c-in', latitude: pointAtKm(200).lat, longitude: pointAtKm(200).lng };
    const outOfRange = { id: 'c-out', latitude: pointAtKm(300).lat, longitude: pointAtKm(300).lng };
    mockFindMany.mockResolvedValueOnce([inRange, outOfRange]);
    mockFindMany.mockResolvedValueOnce([cardRow('c-in')]);

    const args = searchCampsitesArgsSchema.parse({ near: 'Bangkok' });
    const result = await executeSearchCampsites(args);

    expect(result.cards.map((c) => c.id)).toEqual(['c-in']);
    // the out-of-range id must never even be requested in the card fetch
    const cardFetchCall = mockFindMany.mock.calls[1][0] as { where: { id: { in: string[] } } };
    expect(cardFetchCall.where.id.in).not.toContain('c-out');
  });

  it('[AC-4] zero candidates within radius -> honest empty cards, no second (card-fetch) query at all', async () => {
    const farAway = { id: 'c-far', latitude: pointAtKm(400).lat, longitude: pointAtKm(400).lng };
    mockFindMany.mockResolvedValueOnce([farAway]);

    const args = searchCampsitesArgsSchema.parse({ near: 'Bangkok' });
    const result = await executeSearchCampsites(args);

    expect(result).toEqual({ cards: [] });
    expect(mockFindMany).toHaveBeenCalledOnce(); // only the candidate query ran
  });

  it('[EC-2] near names a province with no committed centroid (sparse/unknown) -> falls back to an exact-province filter, never crashes', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ near: 'Neverland Province' });
    const result = await executeSearchCampsites(args);

    expect(result).toEqual({ cards: [] });
    const call = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string }; AND?: unknown[] } };
    expect(call.where.location?.province).toBe('Neverland Province');
    // no bbox AND-clause should have been added on the fallback path
    const bboxClause = (call.where.AND ?? []).find(
      (c) => typeof c === 'object' && c !== null && 'latitude' in c
    );
    expect(bboxClause).toBeUndefined();
  });

  it('[EC-3] both near and province supplied -> near wins, province is ignored for the location filter', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ near: 'Bangkok', province: 'Chiang Mai' });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string }; AND?: unknown[] } };
    expect(call.where.location?.province).toBeUndefined();
    const bboxClause = (call.where.AND ?? []).find(
      (c) => typeof c === 'object' && c !== null && 'latitude' in c
    );
    expect(bboxClause).toBeDefined();
  });

  it('[BR-2 AND terrain] near + terrain both apply — AND, not OR (bbox candidate query ANDs the terrain option filter too)', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ near: 'Bangkok', terrain: 'RIVE' });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { AND?: unknown[] } };
    const andArray = call.where.AND ?? [];
    const hasTerrainClause = andArray.some(
      (c) => typeof c === 'object' && c !== null && 'options' in (c as Record<string, unknown>)
    );
    const hasBboxClause = andArray.some(
      (c) => typeof c === 'object' && c !== null && 'latitude' in (c as Record<string, unknown>)
    );
    expect(hasTerrainClause).toBe(true);
    expect(hasBboxClause).toBe(true);
  });

  it('[normal] no `near` supplied -> byte-identical single-query path (regression, unaffected by this story)', async () => {
    mockFindMany.mockResolvedValueOnce([cardRow('c1')]);
    const args = searchCampsitesArgsSchema.parse({ province: 'Bangkok' });
    const result = await executeSearchCampsites(args);

    expect(mockFindMany).toHaveBeenCalledOnce();
    expect(result.cards.map((c) => c.id)).toEqual(['c1']);
  });
});

describe('bboxForRadius — pure math (CAM-502)', () => {
  it('[normal] the bbox is centered on the given point and grows with radius', () => {
    const center = { lat: 13.7563, lng: 100.5018 };
    const small = bboxForRadius(center, 50);
    const large = bboxForRadius(center, 250);
    expect(small.latMin).toBeGreaterThan(large.latMin);
    expect(small.latMax).toBeLessThan(large.latMax);
    expect((small.latMin + small.latMax) / 2).toBeCloseTo(center.lat, 6);
  });

  it('[real math] every point within MAX_NEAR_KM of the centroid is inside its own bbox (bbox is a true superset of the circle)', () => {
    const center = BANGKOK_CENTROID;
    const bbox = bboxForRadius(center, MAX_NEAR_KM);
    for (const km of [0, 50, 150, 249]) {
      const p = pointAtKm(km);
      expect(haversineDistanceKm(center, p)).toBeLessThanOrEqual(MAX_NEAR_KM + 0.01);
      expect(p.lat).toBeGreaterThanOrEqual(bbox.latMin);
      expect(p.lat).toBeLessThanOrEqual(bbox.latMax);
    }
  });
});
