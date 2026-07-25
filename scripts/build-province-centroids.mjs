/**
 * scripts/build-province-centroids.mjs — CAM-502 (P2 geo proximity) BR-1.
 *
 * Build-step script: computes each Thai province's centroid as the MEAN
 * lat/lng of every real, findable CampSite located in that province
 * (`CampSite.latitude/longitude`, gated the same isActive/isPublished/
 * deletedAt:null way `buildCampSiteWhere` gates every other search — a
 * camp that never shows up in results should never skew a centroid). This
 * is data-derived, NEVER a hand-picked/hardcoded per-province point — a new
 * province added later needs zero code change, only a re-run of this
 * script.
 *
 * Deterministic (BR-1 "regeneratable"): `computeCentroids` is a pure
 * function of its input rows — the province keys are sorted before being
 * written, so the JS `Map` insertion order (which follows DB row order,
 * itself not contractually stable) never leaks into the output; the same
 * DB snapshot always produces byte-identical JSON.
 *
 * Sparse guard (BR-1/EC-2): a province backed by fewer than
 * `MIN_CAMPS_FOR_CENTROID` (2) real camps has an unreliable centroid — one
 * lone camp is not a meaningful "center" to sort distance from. That
 * province is OMITTED from the output entirely (mark/skip, per BR-1);
 * `lib/ai/tools/search-campsites.ts` treats a missing key as "no centroid
 * available" and falls back to an exact-province filter, never a crash and
 * never a fabricated point.
 *
 * Usage:
 *   DATABASE_URL=<target> node scripts/build-province-centroids.mjs
 *
 * Commit the regenerated `prisma/data/province-centroids.json` after any
 * camp-data change that could shift a province's centroid (a camp added,
 * removed, or re-provinced). This file is a derived, COMMITTED artifact —
 * computed at build time, never re-aggregated per request (performance.md).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'prisma', 'data', 'province-centroids.json');

/** BR-1 sparse guard — a province with fewer real camps than this has no reliable centroid. */
export const MIN_CAMPS_FOR_CENTROID = 2;

/**
 * Pure function (no DB/IO) — computes the mean lat/lng per province from a
 * flat list of camp rows. Exported so `__tests__/cam-502-geo-proximity.test.ts`
 * can prove the math + the sparse guard deterministically with fixture data,
 * with no DB dependency.
 *
 * A row with a missing province, or a non-finite/missing lat/lng, is
 * silently excluded from every province's average (never treated as 0,0 —
 * the same "never coerce a missing geo value" discipline
 * `lib/geo/distance.ts`'s `distanceFromBangkokKm` already uses).
 *
 * @param {Array<{ province: string | null | undefined; latitude: number | null | undefined; longitude: number | null | undefined }>} rows
 * @returns {Record<string, { lat: number; lng: number; campCount: number }>}
 */
export function computeCentroids(rows) {
  /** @type {Map<string, Array<{ latitude: number; longitude: number }>>} */
  const byProvince = new Map();

  for (const row of rows) {
    if (!row.province) continue;
    if (typeof row.latitude !== 'number' || typeof row.longitude !== 'number') continue;
    if (!Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) continue;

    const bucket = byProvince.get(row.province) ?? [];
    bucket.push({ latitude: row.latitude, longitude: row.longitude });
    byProvince.set(row.province, bucket);
  }

  /** @type {Record<string, { lat: number; lng: number; campCount: number }>} */
  const centroids = {};

  // Sorted province-key order -> deterministic output regardless of DB row
  // order (BR-1 "deterministic, regeneratable").
  const provinces = [...byProvince.keys()].sort();
  for (const province of provinces) {
    const camps = byProvince.get(province);
    if (camps.length < MIN_CAMPS_FOR_CENTROID) continue; // sparse guard — omit (BR-1/EC-2)

    const sumLat = camps.reduce((acc, c) => acc + c.latitude, 0);
    const sumLng = camps.reduce((acc, c) => acc + c.longitude, 0);
    centroids[province] = {
      // Rounded to 6dp (~0.11m precision) — plenty for a province-level
      // centroid, keeps the committed JSON free of float noise.
      lat: Math.round((sumLat / camps.length) * 1e6) / 1e6,
      lng: Math.round((sumLng / camps.length) * 1e6) / 1e6,
      campCount: camps.length,
    };
  }

  return centroids;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.campSite.findMany({
      // Same base gate `buildCampSiteWhere` (lib/campsite-filters.ts) applies
      // to every search — a camp that would never surface in results must
      // never pull a province's centroid toward it.
      where: { isActive: true, isPublished: true, deletedAt: null },
      select: {
        latitude: true,
        longitude: true,
        location: { select: { province: true } },
      },
    });

    const flat = rows.map((r) => ({
      province: r.location?.province ?? null,
      latitude: r.latitude,
      longitude: r.longitude,
    }));

    const centroids = computeCentroids(flat);
    const json = JSON.stringify(centroids, null, 2) + '\n';
    writeFileSync(OUTPUT_PATH, json, 'utf8');

    console.log(
      JSON.stringify({
        level: 'info',
        event: 'build_province_centroids_done',
        provincesWithCentroid: Object.keys(centroids).length,
        totalCampRowsConsidered: flat.length,
        minCampsForCentroid: MIN_CAMPS_FOR_CENTROID,
        outputPath: OUTPUT_PATH,
      })
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Only run when this file is executed directly (`node
// scripts/build-province-centroids.mjs`) — importing `computeCentroids` for
// a unit test must NEVER open a DB connection.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(
      JSON.stringify({ level: 'error', event: 'build_province_centroids_failed', message: err.message })
    );
    process.exit(1);
  });
}
