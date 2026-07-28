#!/usr/bin/env node
/**
 * scripts/check-province-centroid-drift.mjs — CAM-620
 *
 * `prisma/data/province-centroids.json` is the MEAN coordinate of every
 * real, findable camp per province, generated once by
 * `scripts/build-province-centroids.mjs` and committed. It backs "ใกล้ X"
 * proximity sorting (`lib/ai/tools/search-campsites.ts`) — but nothing has
 * ever compared it against the data it claims to summarise; the only test
 * that exists checks the file against ITSELF (every entry has
 * campCount>=2). `scripts/backfill-cam-571-coordinates-inside-thailand.mjs`
 * states in its OWN comment that this file "is itself derived from the
 * CURRENT, partly-wrong seed coordinates" — and several real coordinate
 * corrections (CAM-571, CAM-575, CAM-583) have moved real camp coordinates
 * since. This script makes that divergence DETECTABLE on demand.
 *
 * WHAT IT DOES: recomputes each province's live mean coordinate into
 * memory (reusing `computeCentroids`/`MIN_CAMPS_FOR_CENTROID`, the SAME
 * pure, already-exported functions `build-province-centroids.mjs` uses to
 * WRITE the file — imported read-only, that file is never modified by this
 * story) and diffs it against the committed JSON. Because a centroid is a
 * continuous mean (not a boolean "holds a camp" fact like CAM-605's
 * sub-district shortlist), the diff is THREE-way, not two:
 *   - added   a province that now qualifies for a centroid live but has NO
 *             committed key (the exact "silently falls back to an exact-
 *             province filter, no proximity, no error" case named in the
 *             ticket)
 *   - removed a committed province whose live camp count has dropped below
 *             MIN_CAMPS_FOR_CENTROID (no longer a reliable center)
 *   - shifted a province present on both sides whose centroid has moved
 *             more than CENTROID_DRIFT_THRESHOLD_KM since the file was
 *             generated
 *
 * WHAT IT NEVER DOES: write to `prisma/data/province-centroids.json` (a
 * read-only comparison — regenerating/correcting the file is a separate
 * decision with its own verification, see this story's story.md "Out of
 * scope"), or edit `scripts/build-province-centroids.mjs` (its pure
 * `computeCentroids`/`MIN_CAMPS_FOR_CENTROID` exports are imported
 * read-only; that file is out of this story's file surface, so the trivial
 * Prisma query that produces raw camp rows — inline in that file's own
 * main(), not itself exported — is mirrored here instead, with a named,
 * bounded duplication risk, see this story's tech.md).
 *
 * WHERE IT RUNS: a manual, on-demand `check:*` script
 * (`npm run check:province-centroid-drift`), the SAME cadence as the
 * generator it checks. Deliberately NOT wired into
 * `.github/workflows/ci.yml`'s `quality-gate` job — that job has no
 * Postgres service / DATABASE_URL at all, and the OTHER job with a DB
 * (`e2e-regression`) holds seeded fixture data, not the real camp
 * distribution this check compares against (see tech.md).
 *
 * NO DATABASE REACHABLE (two cases, both handled the same way — SKIPPED,
 * never a false pass, never a crash):
 *   1. DATABASE_URL unset       -> no PrismaClient is even constructed.
 *   2. DATABASE_URL set but the connection/query throws -> caught, same
 *      SKIPPED treatment, no partial output printed.
 * Exit 0 covers BOTH "skipped, unknowable here" and "checked, clean" — the
 * two are told apart by the printed message, never the exit code (same
 * shape `scripts/check-subdistrict-shortlist-drift.mjs`, CAM-605, already
 * uses). Exit 1 is reserved for the one actionable case: a real,
 * tolerance-exceeding difference.
 *
 * Usage: node scripts/check-province-centroid-drift.mjs
 * (source the target env's `.env` first for DATABASE_URL — dev DB today).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { describeUrlShape } from './db-reset.mjs';
import { computeCentroids, MIN_CAMPS_FOR_CENTROID } from './build-province-centroids.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CENTROIDS_PATH = join(__dirname, '..', 'prisma', 'data', 'province-centroids.json');

/**
 * A first-cut, explicitly tunable report-mode threshold (tech.md "Three-way
 * diff, not two-way"): a province gaining/losing a handful of ordinary
 * camps near its existing cluster should not fire (that would make "0
 * drift" nearly impossible to ever see, training an operator to ignore the
 * check), while a real coordinate-correction batch (CAM-571/575/583-scale)
 * should. Never used to block anything; tuning it later costs nothing.
 */
export const CENTROID_DRIFT_THRESHOLD_KM = 5;

const EARTH_RADIUS_KM = 6371;

/**
 * Minimal, private haversine (mirrors `lib/geo/distance.ts`'s
 * `haversineDistanceKm` — that file is TypeScript and every sibling
 * `check-*.mjs`/`build-*.mjs` script in this family runs via plain `node`,
 * with no ts-node/tsx loader, so it cannot import a `.ts` file; duplicated
 * here rather than imported, same class of accepted risk as the query
 * mirror above — this is arithmetic only, no place-name resolution).
 */
function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Pure — diffs the committed centroid map (as read from
 * `province-centroids.json`) against a freshly computed one (the same
 * shape `computeCentroids` returns), three ways.
 *
 * @param {Record<string, {lat:number,lng:number,campCount:number}>} committed
 * @param {Record<string, {lat:number,lng:number,campCount:number}>} live
 * @param {number} toleranceKm
 * @returns {{ added: string[]; removed: string[]; shifted: Array<{province:string; distanceKm:number; committedCampCount:number; liveCampCount:number}> }}
 */
export function computeCentroidDrift(committed, live, toleranceKm = CENTROID_DRIFT_THRESHOLD_KM) {
  const committedProvinces = Object.keys(committed).sort((a, b) => a.localeCompare(b));
  const liveProvinces = Object.keys(live).sort((a, b) => a.localeCompare(b));
  const committedSet = new Set(committedProvinces);
  const liveSet = new Set(liveProvinces);

  const added = liveProvinces.filter((p) => !committedSet.has(p));
  const removed = committedProvinces.filter((p) => !liveSet.has(p));

  const shifted = [];
  for (const province of committedProvinces) {
    if (!liveSet.has(province)) continue;
    const c = committed[province];
    const l = live[province];
    const distanceKm = Math.round(haversineKm(c, l) * 10) / 10;
    if (distanceKm > toleranceKm) {
      shifted.push({ province, distanceKm, committedCampCount: c.campCount, liveCampCount: l.campCount });
    }
  }
  shifted.sort((a, b) => b.distanceKm - a.distanceKm);

  return { added, removed, shifted };
}

export async function main() {
  const committed = JSON.parse(readFileSync(CENTROIDS_PATH, 'utf-8'));

  const url = process.env.DATABASE_URL || '';
  if (!url) {
    console.warn(
      '[check-province-centroid-drift] SKIPPED (not a pass) — no DATABASE_URL in this environment. ' +
        "CI's quality-gate job has none by design (see this file's own docblock); source a real env's .env " +
        '(e.g. dev) and re-run to actually check for drift.'
    );
    process.exit(0);
    return;
  }

  const prisma = new PrismaClient();
  let live;
  try {
    console.log(`[check-province-centroid-drift] comparing the committed centroids against ${describeUrlShape(url)}`);
    // Mirrors build-province-centroids.mjs's own main() query verbatim — that
    // file is out of this story's editable surface, so the query is
    // duplicated here (see this story's tech.md "Reuse vs duplication").
    const rows = await prisma.campSite.findMany({
      where: { isActive: true, isPublished: true, deletedAt: null },
      select: { latitude: true, longitude: true, location: { select: { province: true } } },
    });
    const flat = rows.map((r) => ({
      province: r.location?.province ?? null,
      latitude: r.latitude,
      longitude: r.longitude,
    }));
    live = computeCentroids(flat);
  } catch (error) {
    console.warn(
      `[check-province-centroid-drift] SKIPPED (not a pass) — DATABASE_URL was set but unreachable: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
    return;
  }
  await prisma.$disconnect();

  const { added, removed, shifted } = computeCentroidDrift(committed, live);

  if (added.length === 0 && removed.length === 0 && shifted.length === 0) {
    console.log(
      `[check-province-centroid-drift] OK — 0 drift. The committed centroids (${Object.keys(committed).length} provinces, ` +
        `MIN_CAMPS_FOR_CENTROID=${MIN_CAMPS_FOR_CENTROID}) still match the live fact within ${CENTROID_DRIFT_THRESHOLD_KM}km.`
    );
    process.exit(0);
    return;
  }

  if (added.length > 0) {
    console.error(
      `[check-province-centroid-drift] ADDED — ${added.length} province(s) now qualify for a centroid live but have ` +
        `NO committed key (proximity search for these falls back to an exact-province filter, silently): ${added.join(', ')}`
    );
  }
  if (removed.length > 0) {
    console.error(
      `[check-province-centroid-drift] REMOVED — ${removed.length} committed province(s) have dropped below the ` +
        `sparse floor (campCount < ${MIN_CAMPS_FOR_CENTROID}) live: ${removed.join(', ')}`
    );
  }
  if (shifted.length > 0) {
    console.error(
      `[check-province-centroid-drift] SHIFTED — ${shifted.length} province(s) moved more than ${CENTROID_DRIFT_THRESHOLD_KM}km ` +
        'since the committed file was generated:'
    );
    for (const s of shifted) {
      console.error(`    ${s.province}: ${s.distanceKm}km (committed campCount=${s.committedCampCount}, live campCount=${s.liveCampCount})`);
    }
  }
  console.error(
    '[check-province-centroid-drift] Regenerate: node scripts/build-province-centroids.mjs, review the diff, commit.'
  );
  process.exit(1);
}

// Only auto-run when executed directly — not when imported for its pure
// exports (tests, and the db-sync-from-staging.mjs ride-along). Same
// pattern as scripts/check-subdistrict-shortlist-drift.mjs (CAM-605).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main();
}
