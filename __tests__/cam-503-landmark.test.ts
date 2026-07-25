/**
 * CAM-503 (P3 landmark search, closes epic CAM-498) — "ลานกางเต็นท์เขาใหญ่" /
 * "แคมป์ปาย" returns camps AROUND a curated landmark/area (a national park,
 * mountain, or well-known camping region — e.g. เขาใหญ่, which spans 4
 * provinces), via a curated gazetteer + the SAME bbox+haversine near-path
 * P2 (CAM-502) already built. No PostGIS/external geocoding (BR-5).
 *
 * Coverage matrix (story.md AC-1..4, BR-1..5, EC-1..4):
 *   - BR-1  landmark-gazetteer.json: >= 20 entries, unique ids, Thailand-bbox
 *           coords, radiusKm > 0 (validateGazetteer, pure)
 *   - BR-2  resolvePlace: bare landmark name -> near + nearIsLandmark=true
 *           (no proximity marker required), aliases resolve to the SAME
 *           canonical nameTh, curated ambiguous-name guard (EC-2, mirrors
 *           CAM-501-DEF-1) skips a risky bare short name, unknown landmark
 *           name -> {} (no false match, AC-3/BR-4 keyword-fallback territory)
 *   - EC-4  landmark match takes precedence over an incidental province
 *           mention in the same sentence
 *   - BR-3  executeSearchCampsites near-path: landmark gazetteer tried
 *           FIRST (own radiusKm, not MAX_NEAR_KM), falls back to the
 *           existing P2 province-centroid path when `near` is not a known
 *           landmark, reuses the SAME bbox+haversine+cap logic (no fork)
 *   - EC-1  a landmark spanning multiple provinces is found via geo radius,
 *           not a province filter (proven by the fallback test using a real
 *           province name, which takes the OTHER branch)
 *   - EC-3  landmark + terrain -> AND, not OR
 *   - AC-4  zero camps within a landmark's radius -> honest empty, never a
 *           second (card-fetch) query
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolvePlace } from '@/lib/ai/place-resolver';
import { validateGazetteer, MIN_GAZETTEER_ENTRIES, THAILAND_BBOX } from '../scripts/validate-landmark-gazetteer.mjs';
import realLandmarkGazetteer from '@/prisma/data/landmark-gazetteer.json';

// ---------------------------------------------------------------------------
// BR-1 — the curated gazetteer fixture itself
// ---------------------------------------------------------------------------

describe('CAM-503 landmark-gazetteer.json — BR-1 (validateGazetteer, pure)', () => {
  it('[real data] the committed fixture has >= 20 entries and zero validation errors', () => {
    expect(MIN_GAZETTEER_ENTRIES).toBe(20);
    const errors = validateGazetteer(realLandmarkGazetteer);
    expect(errors).toEqual([]);
    expect((realLandmarkGazetteer as unknown[]).length).toBeGreaterThanOrEqual(MIN_GAZETTEER_ENTRIES);
  });

  it('[real data] เขาใหญ่ and ปาย are both present with sane coords + radius', () => {
    const entries = realLandmarkGazetteer as Array<{ nameTh: string; lat: number; lng: number; radiusKm: number }>;
    const khaoYai = entries.find((e) => e.nameTh === 'เขาใหญ่');
    const pai = entries.find((e) => e.nameTh === 'ปาย');
    expect(khaoYai).toBeDefined();
    expect(pai).toBeDefined();
    expect(khaoYai!.radiusKm).toBeGreaterThan(0);
    expect(pai!.radiusKm).toBeGreaterThan(0);
  });

  it('[unit] validateGazetteer catches duplicate ids, out-of-bbox coords, and a non-positive radius', () => {
    const bad = [
      { id: 'a', nameTh: 'X', aliases: [], lat: 14, lng: 100, radiusKm: 10, kind: 'area' },
      { id: 'a', nameTh: 'Y', aliases: [], lat: 90, lng: 100, radiusKm: 0, kind: 'area' }, // dup id, bad lat, bad radius
    ];
    const errors = validateGazetteer(bad);
    expect(errors.some((e: string) => e.includes('duplicate id'))).toBe(true);
    expect(errors.some((e: string) => e.includes('lat'))).toBe(true);
    expect(errors.some((e: string) => e.includes('radiusKm'))).toBe(true);
  });

  it('[unit] non-array input -> a single clean error, never throws', () => {
    expect(validateGazetteer({})).toEqual(['gazetteer must be a JSON array']);
  });

  it('[boundary] THAILAND_BBOX covers the real fixture (sanity check on the bbox itself)', () => {
    for (const entry of realLandmarkGazetteer as Array<{ lat: number; lng: number }>) {
      expect(entry.lat).toBeGreaterThanOrEqual(THAILAND_BBOX.latMin);
      expect(entry.lat).toBeLessThanOrEqual(THAILAND_BBOX.latMax);
      expect(entry.lng).toBeGreaterThanOrEqual(THAILAND_BBOX.lngMin);
      expect(entry.lng).toBeLessThanOrEqual(THAILAND_BBOX.lngMax);
    }
  });
});

// ---------------------------------------------------------------------------
// BR-2 — resolvePlace landmark detection
// ---------------------------------------------------------------------------

describe('CAM-503 resolvePlace — BR-2 landmark detection (bare name = area-intent)', () => {
  it('[AC-1] "ลานกางเต็นท์เขาใหญ่" -> near="เขาใหญ่", nearIsLandmark=true, NO proximity marker needed', () => {
    expect(resolvePlace('ลานกางเต็นท์เขาใหญ่')).toEqual({ near: 'เขาใหญ่', nearIsLandmark: true });
  });

  it('[AC-2] "ริมน้ำเขาใหญ่" (terrain word + landmark) -> the landmark still resolves; terrain is not a place', () => {
    expect(resolvePlace('ริมน้ำเขาใหญ่')).toEqual({ near: 'เขาใหญ่', nearIsLandmark: true });
  });

  it('[normal] a proximity marker together with a landmark still resolves the SAME way (marker is optional, not required)', () => {
    expect(resolvePlace('ลานกางเต็นท์ใกล้เขาใหญ่')).toEqual({ near: 'เขาใหญ่', nearIsLandmark: true });
  });

  it('[normal] an alias resolves to the landmark\'s canonical nameTh, not the alias text itself', () => {
    expect(resolvePlace('แคมป์อำเภอปาย')).toEqual({ near: 'ปาย', nearIsLandmark: true });
    expect(resolvePlace('พักที่เมืองปาย')).toEqual({ near: 'ปาย', nearIsLandmark: true });
  });

  it('[EC-2 guard, mirrors CAM-501-DEF-1] a bare short/ambiguous landmark name ("ปาย" alone, no distinctive alias) does NOT false-match', () => {
    // "ปาย" is curated as ambiguous (short, collision risk) — this pre-pass
    // deliberately does not fire on the bare name; the model's own BR-4
    // keyword-fallback guidance (system prompt) covers this case instead.
    expect(resolvePlace('แคมป์ปาย')).toEqual({});
  });

  it('[AC-3/BR-4 territory] a landmark name NOT in the gazetteer -> {} (no false match, never guessed)', () => {
    expect(resolvePlace('แคมป์ดอยม่อนล้าน')).toEqual({});
  });

  it('[EC-4] landmark match takes precedence over an incidental real-province mention in the same sentence', () => {
    // "เขาใหญ่" (landmark, spans multiple provinces) + "นครราชสีมา" (a real
    // province it partly sits in) -> the landmark wins; a province filter
    // would wrongly exclude the Saraburi/Prachin Buri/Nakhon Nayok camps.
    expect(resolvePlace('เที่ยวเขาใหญ่นครราชสีมา')).toEqual({ near: 'เขาใหญ่', nearIsLandmark: true });
  });

  it('[regression] a real province with no landmark mention still resolves as before (province, unaffected)', () => {
    expect(resolvePlace('แคมป์ริมน้ำเชียงใหม่')).toEqual({ province: 'Chiang Mai' });
  });

  it('[null/empty] empty string -> {}, never throws', () => {
    expect(resolvePlace('')).toEqual({});
  });
});

/**
 * QA CAM-503 — DEFECT regression (opened as a sub-ticket, see the QA
 * return). "เขาใหญ่" is not just the flagship gazetteer entry — it is ALSO
 * the ordinary pronoun "เขา" (he/she/they, one of the most common Thai
 * pronouns) immediately followed by the ordinary adjective "ใหญ่" (big),
 * an extremely common natural collocation ("เขาใหญ่กว่าฉัน" = "he/she is
 * bigger than me", "พี่เขาใหญ่โตในวงการนี้" = "that person is prominent in
 * this industry"). Unlike "ปาย" (CAM-503-EC-2, guarded above), "เขาใหญ่"
 * was NOT added to `AMBIGUOUS_LANDMARK_NAMES_TH` — this is exactly the
 * CAM-501-DEF-1 false-match class reintroduced on this story's own AC-1
 * headline example, at a materially higher real-world collision rate than
 * any of the already-guarded province names (a pronoun+adjective sentence
 * about a PERSON, not a place, is common conversational Thai). Proven RED
 * against the current implementation via a throwaway probe before being
 * written here; must go GREEN once the backend adds a guard (e.g. a
 * boundary/context check, or folding "เขาใหญ่"'s bare form into the
 * ambiguous set the way "ปาย" already is, while still keeping AC-1's own
 * camping-context example — "ลานกางเต็นท์เขาใหญ่" — working).
 */
describe('CAM-503 resolvePlace — DEFECT: "เขาใหญ่" false-matches the ordinary pronoun+adjective collocation (เขา=he/she + ใหญ่=big)', () => {
  it('[edge] "แฟนเขาใหญ่กว่าฉันเยอะ" (their partner is much bigger than me) must NOT resolve the เขาใหญ่ landmark', () => {
    expect(resolvePlace('แฟนเขาใหญ่กว่าฉันเยอะ')).toEqual({});
  });

  it('[edge] "พี่เขาใหญ่โตในวงการนี้จริงๆ" (that person is prominent in this industry) must NOT resolve the เขาใหญ่ landmark', () => {
    expect(resolvePlace('พี่เขาใหญ่โตในวงการนี้จริงๆ')).toEqual({});
  });

  it('[edge] "น้องบอกว่าเขาใหญ่ไปหน่อยสำหรับงานนี้" (a sibling said he/she is a bit too senior for this job) must NOT resolve the เขาใหญ่ landmark', () => {
    expect(resolvePlace('น้องบอกว่าเขาใหญ่ไปหน่อยสำหรับงานนี้')).toEqual({});
  });

  it('[edge, substring-hides-in-another-word] "เขาหลักฐานชัดเจนมาก" (เขา + หลักฐาน="evidence") must NOT resolve the เขาหลัก (Khao Lak) landmark', () => {
    expect(resolvePlace('เขาหลักฐานชัดเจนมาก')).toEqual({});
  });

  it('[regression, must stay green] the camping-context AC-1 example is unaffected by any future fix direction', () => {
    expect(resolvePlace('ลานกางเต็นท์เขาใหญ่')).toEqual({ near: 'เขาใหญ่', nearIsLandmark: true });
  });
});

// ---------------------------------------------------------------------------
// BR-3 — executeSearchCampsites near-path (landmark-first, then province)
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

const { executeSearchCampsites, searchCampsitesArgsSchema, bboxForRadius } = await import(
  '@/lib/ai/tools/search-campsites'
);

function cardRow(id: string) {
  return { id, reviewCount: 0, location: { province: 'Nakhon Ratchasima' }, options: [] };
}

const KHAO_YAI = (realLandmarkGazetteer as Array<{ nameTh: string; lat: number; lng: number; radiusKm: number }>).find(
  (e) => e.nameTh === 'เขาใหญ่'
)!;
const DEG_PER_KM_LAT = 1 / 111.32;

/** A synthetic point exactly `km` due north of เขาใหญ่'s gazetteer coords. */
function pointAtKmFromKhaoYai(km: number) {
  return { lat: KHAO_YAI.lat + km * DEG_PER_KM_LAT, lng: KHAO_YAI.lng };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('executeSearchCampsites — near=landmark (CAM-503 BR-3)', () => {
  it('[BR-3] near="เขาใหญ่" resolves via the gazetteer directly — NO ThailandLocation DB round-trip at all', async () => {
    mockFindMany.mockResolvedValueOnce([]); // candidate query — zero candidates

    const args = searchCampsitesArgsSchema.parse({ near: 'เขาใหญ่' });
    const result = await executeSearchCampsites(args);

    expect(mockThailandLocationFindFirst).not.toHaveBeenCalled();
    expect(result).toEqual({ cards: [] });

    const candidateCall = mockFindMany.mock.calls[0][0] as {
      where: { AND?: Array<{ latitude?: { gte: number; lte: number }; longitude?: { gte: number; lte: number } }> };
    };
    const bboxClause = (candidateCall.where.AND ?? []).find((c) => c.latitude !== undefined);
    // the landmark's OWN radiusKm (40), not MAX_NEAR_KM (250) — proves the
    // radius came from the gazetteer entry, not the province-proximity default.
    const expectedBbox = bboxForRadius({ lat: KHAO_YAI.lat, lng: KHAO_YAI.lng }, KHAO_YAI.radiusKm);
    expect(bboxClause?.latitude).toEqual({ gte: expectedBbox.latMin, lte: expectedBbox.latMax });
    expect(bboxClause?.longitude).toEqual({ gte: expectedBbox.lngMin, lte: expectedBbox.lngMax });
  });

  it('[EC-1] a candidate inside the landmark radius but far outside any single-province bbox is still found (the whole point of geo-radius over province-filter)', async () => {
    const near10 = { id: 'c-10km', latitude: pointAtKmFromKhaoYai(10).lat, longitude: pointAtKmFromKhaoYai(10).lng };
    mockFindMany.mockResolvedValueOnce([near10]);
    mockFindMany.mockResolvedValueOnce([cardRow('c-10km')]);

    const args = searchCampsitesArgsSchema.parse({ near: 'เขาใหญ่' });
    const result = await executeSearchCampsites(args);

    expect(result.cards.map((c) => c.id)).toEqual(['c-10km']);
  });

  it('[BR-3 sort] candidates within the landmark radius are haversine-sorted ascending, regardless of DB row order', async () => {
    const at30 = { id: 'c-30km', latitude: pointAtKmFromKhaoYai(30).lat, longitude: pointAtKmFromKhaoYai(30).lng };
    const at5 = { id: 'c-5km', latitude: pointAtKmFromKhaoYai(5).lat, longitude: pointAtKmFromKhaoYai(5).lng };
    const at15 = { id: 'c-15km', latitude: pointAtKmFromKhaoYai(15).lat, longitude: pointAtKmFromKhaoYai(15).lng };
    mockFindMany.mockResolvedValueOnce([at30, at5, at15]);
    mockFindMany.mockResolvedValueOnce([cardRow('c-15km'), cardRow('c-5km'), cardRow('c-30km')]);

    const args = searchCampsitesArgsSchema.parse({ near: 'เขาใหญ่' });
    const result = await executeSearchCampsites(args);

    expect(result.cards.map((c) => c.id)).toEqual(['c-5km', 'c-15km', 'c-30km']);
  });

  it('[BR-3 radius cap] a candidate beyond the landmark\'s own radiusKm (40) is dropped even though within MAX_NEAR_KM (250)', async () => {
    expect(KHAO_YAI.radiusKm).toBeLessThan(250);
    const inRange = { id: 'c-in', latitude: pointAtKmFromKhaoYai(35).lat, longitude: pointAtKmFromKhaoYai(35).lng };
    const outOfRange = { id: 'c-out', latitude: pointAtKmFromKhaoYai(60).lat, longitude: pointAtKmFromKhaoYai(60).lng };
    mockFindMany.mockResolvedValueOnce([inRange, outOfRange]);
    mockFindMany.mockResolvedValueOnce([cardRow('c-in')]);

    const args = searchCampsitesArgsSchema.parse({ near: 'เขาใหญ่' });
    const result = await executeSearchCampsites(args);

    expect(result.cards.map((c) => c.id)).toEqual(['c-in']);
    const cardFetchCall = mockFindMany.mock.calls[1][0] as { where: { id: { in: string[] } } };
    expect(cardFetchCall.where.id.in).not.toContain('c-out');
  });

  it('[AC-4] zero candidates within the landmark radius -> honest empty cards, no second query', async () => {
    const farAway = { id: 'c-far', latitude: pointAtKmFromKhaoYai(100).lat, longitude: pointAtKmFromKhaoYai(100).lng };
    mockFindMany.mockResolvedValueOnce([farAway]);

    const args = searchCampsitesArgsSchema.parse({ near: 'เขาใหญ่' });
    const result = await executeSearchCampsites(args);

    expect(result).toEqual({ cards: [] });
    expect(mockFindMany).toHaveBeenCalledOnce();
  });

  it('[EC-3] near=landmark + terrain both apply — AND, not OR', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ near: 'เขาใหญ่', terrain: 'RIVE' });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { AND?: unknown[] } };
    const andArray = call.where.AND ?? [];
    const hasTerrainClause = andArray.some((c) => typeof c === 'object' && c !== null && 'options' in (c as Record<string, unknown>));
    const hasBboxClause = andArray.some((c) => typeof c === 'object' && c !== null && 'latitude' in (c as Record<string, unknown>));
    expect(hasTerrainClause).toBe(true);
    expect(hasBboxClause).toBe(true);
  });

  it('[normal] an alias value the model might emit directly ("อำเภอปาย") also resolves via the gazetteer (not just the canonical nameTh)', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ near: 'อำเภอปาย' });
    await executeSearchCampsites(args);

    expect(mockThailandLocationFindFirst).not.toHaveBeenCalled();
    const candidateCall = mockFindMany.mock.calls[0][0] as { where: { AND?: Array<{ latitude?: unknown }> } };
    expect((candidateCall.where.AND ?? []).some((c) => c.latitude !== undefined)).toBe(true);
  });

  it('[BR-3 fallback] near names a real province (not a gazetteer landmark) -> falls through to the EXISTING P2 province-centroid path, unaffected', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ near: 'Bangkok' });
    await executeSearchCampsites(args);

    expect(mockThailandLocationFindFirst).not.toHaveBeenCalled(); // English input skips the Thai lookup, same as before this story
    const candidateCall = mockFindMany.mock.calls[0][0] as { where: { AND?: Array<{ latitude?: unknown }> } };
    expect((candidateCall.where.AND ?? []).some((c) => c.latitude !== undefined)).toBe(true);
  });

  it('[EC-2, mirrors CAM-502 EC-2] near names neither a landmark nor a province with a committed centroid -> exact-string filter fallback, never crashes', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ near: 'Neverland Province' });
    const result = await executeSearchCampsites(args);

    expect(result).toEqual({ cards: [] });
    const call = mockFindMany.mock.calls[0][0] as { where: { location?: { province?: string }; AND?: unknown[] } };
    expect(call.where.location?.province).toBe('Neverland Province');
    const bboxClause = (call.where.AND ?? []).find((c) => typeof c === 'object' && c !== null && 'latitude' in c);
    expect(bboxClause).toBeUndefined();
  });
});
