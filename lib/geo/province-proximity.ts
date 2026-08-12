import { type Prisma, type PrismaClient } from '@prisma/client';
import { resolveProvinceAliasToCanonicalTh } from '@/lib/ai/place-aliases';
import { haversineDistanceKm } from '@/lib/geo/distance';
import provinceCentroidsData from '@/prisma/data/province-centroids.json';
import landmarkGazetteerData from '@/prisma/data/landmark-gazetteer.json';

/**
 * lib/geo/province-proximity.ts — CAM-716.
 *
 * Extracted from `lib/ai/tools/search-campsites.ts` (CAM-502's province-
 * centroid proximity search + CAM-503's landmark gazetteer) so
 * `lib/ai/tools/bulk-availability.ts` can reuse the IDENTICAL centroid
 * table, radius cap, landmark-first resolution, and bbox+haversine ranking
 * for its own `near` argument (CAM-716 BR-1) — the CAM-566 shared-matcher
 * precedent (one algorithm, one home, every caller imports it) instead of a
 * second hand-copied port. `searchCampsites` now calls through this module
 * too; behavior is byte-identical for it (proven by its own pre-existing
 * `__tests__/cam-502-geo-proximity.test.ts`/`cam-503-*` pins, which keep
 * passing unmodified against `search-campsites.ts`'s re-exports) — only the
 * code's home moved.
 *
 * Prisma is dependency-injected on every function (never a module-level
 * `@/lib/prisma` import) — the same convention `lib/campsite-filters.ts`'s
 * `resolveProvinceAdminAreaIds` and `lib/geo/admin-area-match.ts` already
 * use, so each caller's own mocked `@/lib/prisma` singleton still exercises
 * this module unchanged.
 */

export interface ProvinceCentroidEntry {
  lat: number;
  lng: number;
  campCount: number;
}

/**
 * CAM-502 (P2 geo proximity) BR-1 — the committed, build-step-derived
 * province centroid table (`scripts/build-province-centroids.mjs`), keyed
 * by the SAME `Location.province` English canonical value
 * `resolveProvinceForSearch` below resolves to. A province backed by too
 * few real camps at build time is OMITTED from this table entirely (sparse
 * guard) — treated below as "no centroid available", never a crash.
 */
export const PROVINCE_CENTROIDS: Readonly<Record<string, ProvinceCentroidEntry>> = provinceCentroidsData;

/**
 * CAM-502 BR-2 — "ใกล้X" caps at this radius so a proximity search never
 * silently drifts into "basically the whole country" territory. Tunable
 * const (not a magic number inline) — ~250km covers a realistic weekend-trip
 * radius from a major province without dragging in unrelated regions.
 */
export const MAX_NEAR_KM = 250;

/**
 * CAM-502 BR-2/EC-4 (CAM-344 lesson) — the candidate set pulled by the bbox
 * pre-filter is capped BEFORE the haversine sort/distance-filter ever runs,
 * independent of how many camps a real province's bbox happens to contain.
 * A defensive ceiling, not a tuned-to-today's-count value.
 */
export const NEAR_CANDIDATE_CAP = 500;

/**
 * CAM-503 (P3 landmark search) BR-1/BR-3 — the curated, committed landmark
 * gazetteer (`prisma/data/landmark-gazetteer.json`; hand-authored, NOT
 * data-derived the way `province-centroids.json` is). Looked up FIRST in
 * `resolveNearOrigin` below — a landmark like เขาใหญ่ spans multiple
 * provinces and therefore has no `PROVINCE_CENTROIDS` entry of its own.
 */
export interface LandmarkGazetteerEntry {
  id: string;
  nameTh: string;
  aliases: string[];
  lat: number;
  lng: number;
  radiusKm: number;
  kind: string;
}

const LANDMARK_GAZETTEER: readonly LandmarkGazetteerEntry[] = landmarkGazetteerData as LandmarkGazetteerEntry[];

/**
 * Keyed by every `nameTh` + alias (+ a lowercased variant for an ASCII
 * alias) so an exact-string `near` value resolves to the same gazetteer
 * entry. Built once at module load (pure, no DB).
 */
const LANDMARK_BY_NAME: ReadonlyMap<string, LandmarkGazetteerEntry> = (() => {
  const map = new Map<string, LandmarkGazetteerEntry>();
  for (const entry of LANDMARK_GAZETTEER) {
    for (const key of [entry.nameTh, ...entry.aliases]) {
      map.set(key, entry);
      const lower = key.toLowerCase();
      if (lower !== key) map.set(lower, entry);
    }
  }
  return map;
})();

/** CAM-503 BR-3 — exact-string gazetteer lookup (falls back to a lowercase match for an ASCII alias); undefined = not a known landmark. */
export function findLandmark(near: string): LandmarkGazetteerEntry | undefined {
  return LANDMARK_BY_NAME.get(near) ?? LANDMARK_BY_NAME.get(near.toLowerCase());
}

const KM_PER_DEG_LAT = 111.32;

/**
 * A rectangular lat/lng bbox that FULLY CONTAINS the circle of radius
 * `radiusKm` around `center` — a cheap Prisma-level pre-filter (candidates),
 * never the final circular cut (that's `rankCampsiteIdsByProximity`'s own
 * haversine distance-filter, below).
 */
export function bboxForRadius(
  center: { lat: number; lng: number },
  radiusKm: number
): { latMin: number; latMax: number; lngMin: number; lngMax: number } {
  const latDelta = radiusKm / KM_PER_DEG_LAT;
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  // Guard a near-zero cosine (would only occur at the poles — never a real
  // Thai province) so this never divides by ~0.
  const lngDelta = radiusKm / (KM_PER_DEG_LAT * (Math.abs(cosLat) > 1e-6 ? cosLat : 1e-6));
  return {
    latMin: center.lat - latDelta,
    latMax: center.lat + latDelta,
    lngMin: center.lng - lngDelta,
    lngMax: center.lng + lngDelta,
  };
}

/** CAM-404 — a province arg containing any Thai character triggers the AdminArea resolve below. */
const THAI_CHAR_PATTERN = /[ก-๙]/;

/**
 * CAM-458 BR-3/D1 — canonical Bangkok-variant alias map (exact-key), applied
 * BEFORE the `AdminArea` lookup below. Covers the high-frequency,
 * non-substring ways campers refer to Bangkok; substring forms (e.g.
 * `กรุงเทพ`) already resolve via the existing `contains` query.
 */
const BANGKOK_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'กทม': 'กรุงเทพมหานคร',
  'กทม.': 'กรุงเทพมหานคร',
  'กรุงเทพฯ': 'กรุงเทพมหานคร',
  'บางกอก': 'กรุงเทพมหานคร',
});

/** The one Prisma delegate every function in this module needs — real `PrismaClient` or a test double satisfy this structurally. */
export type ProvinceLookupPrisma = Pick<PrismaClient, 'adminArea'>;

/**
 * CAM-404 — `Location.province` is stored in English, but a caller
 * frequently emits the Thai province name a camper used. CAM-574: resolve
 * via `AdminArea` (`nameTh` ↔ `nameEn`, PROVINCE level); English input is
 * returned unchanged (no DB round-trip). CAM-458 seeds all 77 provinces and
 * adds the Bangkok-alias normalization above — an unmapped Thai word, or any
 * lookup error, falls back to the raw value unchanged (never throws).
 *
 * CAM-587 — `resolveProvinceAliasToCanonicalTh` (the 52-province owner-
 * authored alias dataset) is consulted FIRST, ahead of the pre-existing
 * `BANGKOK_ALIASES` map: it is a strict superset for Bangkok, but
 * `BANGKOK_ALIASES` is kept as-is so a value neither table recognizes still
 * falls through unchanged.
 */
export async function resolveProvinceForSearch(prisma: ProvinceLookupPrisma, province: string): Promise<string> {
  if (!THAI_CHAR_PATTERN.test(province)) return province;

  const normalized = resolveProvinceAliasToCanonicalTh(province) ?? BANGKOK_ALIASES[province] ?? province;

  try {
    const match = await prisma.adminArea.findFirst({
      where: { countryCode: 'TH', level: 'PROVINCE', nameTh: { contains: normalized } },
      select: { nameEn: true },
    });
    return match?.nameEn ?? province;
  } catch {
    return province;
  }
}

/**
 * CAM-502/CAM-503/CAM-716 — the ONE resolved origin a `near` value maps to:
 * either a geo point+radius (a curated landmark, or a province with a
 * committed centroid), or an honest exact-province fallback (EC-2 — no
 * centroid available, never a crash, never a fabricated point).
 */
export type NearOrigin =
  | { kind: 'geo'; centroid: { lat: number; lng: number }; radiusKm: number }
  | { kind: 'province'; province: string };

/**
 * CAM-502 BR-3/CAM-503 BR-3 — resolves a `near` argument (Thai or English, a
 * province OR a curated landmark name) to its search origin, in the SAME
 * order `searchCampsites`'s near-path has always used: the landmark
 * gazetteer FIRST (a landmark has no province-centroid entry of its own),
 * then the province-centroid table; EC-2 falls back to an exact-province
 * filter on the resolved value when neither matches.
 */
export async function resolveNearOrigin(prisma: ProvinceLookupPrisma, near: string): Promise<NearOrigin> {
  const landmark = findLandmark(near);
  if (landmark) {
    return { kind: 'geo', centroid: { lat: landmark.lat, lng: landmark.lng }, radiusKm: landmark.radiusKm };
  }

  const resolvedNear = await resolveProvinceForSearch(prisma, near);
  const centroid = PROVINCE_CENTROIDS[resolvedNear];
  if (centroid) {
    return { kind: 'geo', centroid: { lat: centroid.lat, lng: centroid.lng }, radiusKm: MAX_NEAR_KM };
  }
  return { kind: 'province', province: resolvedNear };
}

/** The one Prisma delegate `rankCampsiteIdsByProximity` needs. */
export type ProximityQueryPrisma = Pick<PrismaClient, 'campSite'>;

/**
 * CAM-502 BR-2/EC-4 (CAM-344 lesson) — the shared geo query core: pushes a
 * bbox pre-filter AND-clause onto `where` (mutated in place, mirroring how
 * every other AND-extension in this codebase composes `buildCampSiteWhere`'s
 * own output), runs ONE capped candidate query, then does the exact
 * circular cut + ascending haversine sort + page-size cap. Returns ranked
 * candidate ids ONLY (never card rows) — each caller fetches its own card
 * shape by id; both `searchCampsites` and `bulkAvailability` happen to use
 * the identical `aiCampCardSelect`/`toAiCampCard`, but that is an AI-tool-
 * layer concern, not a geo one, so it stays out of this module.
 */
export async function rankCampsiteIdsByProximity(
  prisma: ProximityQueryPrisma,
  where: Prisma.CampSiteWhereInput,
  centroid: { lat: number; lng: number },
  radiusKm: number,
  take: number
): Promise<string[]> {
  const bbox = bboxForRadius(centroid, radiusKm);
  const andArray = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
  andArray.push({
    latitude: { gte: bbox.latMin, lte: bbox.latMax },
    longitude: { gte: bbox.lngMin, lte: bbox.lngMax },
  });
  where.AND = andArray;

  // CAM-344 lesson (EC-4) — cap the candidate set BEFORE the haversine
  // sort/filter runs, independent of how many camps the bbox matches.
  const candidates = await prisma.campSite.findMany({
    where,
    select: { id: true, latitude: true, longitude: true },
    take: NEAR_CANDIDATE_CAP,
  });

  // Exact circular cut (the bbox above is only a rectangular superset) +
  // ascending haversine sort + page-size cap, in that order.
  return candidates
    .map((c) => ({ id: c.id, distanceKm: haversineDistanceKm(centroid, { lat: c.latitude, lng: c.longitude }) }))
    .filter((c) => c.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, take)
    .map((c) => c.id);
}
