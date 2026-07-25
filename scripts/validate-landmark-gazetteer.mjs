/**
 * scripts/validate-landmark-gazetteer.mjs — CAM-503 (P3 landmark search) BR-1.
 *
 * A pure, zero-DB validation pass over the curated, hand-written
 * `prisma/data/landmark-gazetteer.json` (unlike `build-province-centroids.mjs`,
 * this file is NOT data-derived from real camp rows — it is a curated list of
 * popular Thai camping landmarks/areas, so its own invariants (unique ids,
 * coords inside Thailand's real bbox, a positive radius) are checked here
 * instead of re-derived at build time).
 *
 * Checks (BR-1):
 *   - at least 20 entries
 *   - every id is present, non-empty, and unique
 *   - every nameTh is present and non-empty
 *   - lat/lng fall inside Thailand's real bounding box (~5.6–20.5N, 97.3–105.7E)
 *   - radiusKm is a finite number > 0
 *   - aliases is an array (may be empty)
 *
 * Usage: node scripts/validate-landmark-gazetteer.mjs
 * Exits 0 on a clean gazetteer, 1 with every violation printed otherwise.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAZETTEER_PATH = path.join(__dirname, '..', 'prisma', 'data', 'landmark-gazetteer.json');

/** Thailand's real bounding box (generous — covers every province, no ocean territory). */
export const THAILAND_BBOX = { latMin: 5.6, latMax: 20.5, lngMin: 97.3, lngMax: 105.7 };

export const MIN_GAZETTEER_ENTRIES = 20;

/**
 * Pure function — validates a parsed gazetteer array, returns every
 * violation found (empty array = clean). Exported so
 * `__tests__/cam-503-landmark.test.ts` can assert the real shipped fixture
 * passes deterministically, with no file I/O inside the test itself.
 *
 * @param {unknown} entries
 * @returns {string[]}
 */
export function validateGazetteer(entries) {
  const errors = [];

  if (!Array.isArray(entries)) {
    return ['gazetteer must be a JSON array'];
  }

  if (entries.length < MIN_GAZETTEER_ENTRIES) {
    errors.push(`gazetteer has ${entries.length} entries, expected >= ${MIN_GAZETTEER_ENTRIES}`);
  }

  const seenIds = new Set();

  entries.forEach((entry, index) => {
    const label = `entry[${index}]${entry && entry.id ? ` (${entry.id})` : ''}`;

    if (!entry || typeof entry !== 'object') {
      errors.push(`${label}: not an object`);
      return;
    }

    if (typeof entry.id !== 'string' || entry.id.trim().length === 0) {
      errors.push(`${label}: missing/empty id`);
    } else if (seenIds.has(entry.id)) {
      errors.push(`${label}: duplicate id "${entry.id}"`);
    } else {
      seenIds.add(entry.id);
    }

    if (typeof entry.nameTh !== 'string' || entry.nameTh.trim().length === 0) {
      errors.push(`${label}: missing/empty nameTh`);
    }

    if (!Array.isArray(entry.aliases)) {
      errors.push(`${label}: aliases must be an array`);
    }

    if (typeof entry.lat !== 'number' || !Number.isFinite(entry.lat) || entry.lat < THAILAND_BBOX.latMin || entry.lat > THAILAND_BBOX.latMax) {
      errors.push(`${label}: lat ${entry.lat} outside Thailand bbox [${THAILAND_BBOX.latMin}, ${THAILAND_BBOX.latMax}]`);
    }

    if (typeof entry.lng !== 'number' || !Number.isFinite(entry.lng) || entry.lng < THAILAND_BBOX.lngMin || entry.lng > THAILAND_BBOX.lngMax) {
      errors.push(`${label}: lng ${entry.lng} outside Thailand bbox [${THAILAND_BBOX.lngMin}, ${THAILAND_BBOX.lngMax}]`);
    }

    if (typeof entry.radiusKm !== 'number' || !Number.isFinite(entry.radiusKm) || entry.radiusKm <= 0) {
      errors.push(`${label}: radiusKm must be a finite number > 0 (got ${entry.radiusKm})`);
    }

    const validKinds = new Set(['park', 'mountain', 'town', 'area']);
    if (typeof entry.kind !== 'string' || !validKinds.has(entry.kind)) {
      errors.push(`${label}: kind must be one of park|mountain|town|area (got ${entry.kind})`);
    }
  });

  return errors;
}

function main() {
  const raw = readFileSync(GAZETTEER_PATH, 'utf-8');
  const entries = JSON.parse(raw);
  const errors = validateGazetteer(entries);

  if (errors.length > 0) {
    console.error(`landmark-gazetteer.json — ${errors.length} violation(s):`);
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  console.log(`landmark-gazetteer.json OK — ${entries.length} entries, 0 violations.`);
}

// Only run as a CLI script, never on import (so the test file can import
// `validateGazetteer` without the side effect of exiting the process).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
