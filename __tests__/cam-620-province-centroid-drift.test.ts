/**
 * CAM-620 (item 2) — `prisma/data/province-centroids.json` has NO drift
 * check today; the only existing test (`cam-502-geo-proximity.test.ts`)
 * checks the file against ITSELF (every entry has campCount>=2), never
 * against the live data it claims to summarise.
 * `scripts/backfill-cam-571-coordinates-inside-thailand.mjs`'s own comment
 * states the file "is itself derived from the CURRENT, partly-wrong seed
 * coordinates" — this file proves `scripts/check-province-centroid-drift.mjs`'s
 * pure `computeCentroidDrift` actually detects that class of drift (added /
 * removed / shifted), using ONLY constructed, in-memory fixtures — no
 * DATABASE_URL, no Prisma connection, no file write. Mirrors the exact
 * convention `__tests__/cam-605-shortlist-drift.test.ts` established for
 * this class of tool (CAM-568's "a check nobody has seen fail has not been
 * proven to work").
 *
 * Coverage matrix (story.md AC-3..7, BR-2..6, EC-2..6):
 *   - AC-3/EC-2  a province that newly qualifies live (campCount crosses
 *                MIN_CAMPS_FOR_CENTROID) but has no committed key -> added
 *   - AC-4/EC-3  a committed province whose live campCount has dropped
 *                below MIN_CAMPS_FOR_CENTROID -> removed
 *   - AC-5/EC-4  a province present on both sides that moved more than
 *                CENTROID_DRIFT_THRESHOLD_KM -> shifted, with the distance;
 *                a move AT OR BELOW the threshold is NEVER reported
 *   - AC-6/EC-5  identical (within tolerance) sets -> both empty, 0 drift
 *   - AC-7/EC-6  no-DB / unreachable-DB SKIP path (source inspection, same
 *                convention as cam-605 and cam-369-db-reset-redaction)
 *   - BR-2       imports computeCentroids/MIN_CAMPS_FOR_CENTROID from
 *                build-province-centroids.mjs read-only (never re-derives
 *                the mean math); never edits that file
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import realProvinceCentroids from '@/prisma/data/province-centroids.json';

const root = path.resolve(__dirname, '..');
function readSrc(rel: string) {
  return readFileSync(path.join(root, rel), 'utf-8');
}

describe('CAM-620 check-province-centroid-drift.mjs — source inspection', () => {
  const src = readSrc('scripts/check-province-centroid-drift.mjs');

  it('must never write to the committed centroids file (read-only comparison)', () => {
    expect(src).not.toMatch(/writeFileSync/);
  });

  it('never constructs a PrismaClient when DATABASE_URL is unset (BR-6)', () => {
    const noUrlIdx = src.indexOf('if (!url)');
    const newClientIdx = src.indexOf('new PrismaClient()');
    expect(noUrlIdx).toBeGreaterThan(-1);
    expect(newClientIdx).toBeGreaterThan(-1);
    expect(noUrlIdx).toBeLessThan(newClientIdx);
  });

  it('the unreachable-DB path is caught and exits 0, never crashes the process (BR-6)', () => {
    expect(src).toMatch(/catch \(error\)/);
    const catchStart = src.indexOf('catch (error)');
    const catchEnd = src.indexOf('await prisma.$disconnect();\n\n  const { added', catchStart);
    expect(catchStart).toBeGreaterThan(-1);
    expect(catchEnd).toBeGreaterThan(catchStart);
    const catchBlock = src.slice(catchStart, catchEnd);
    expect(catchBlock).toContain('process.exit(0)');
  });

  it('a real difference is the ONLY path that exits 1 (BR-6)', () => {
    const exit1Count = (src.match(/process\.exit\(1\)/g) || []).length;
    expect(exit1Count).toBe(1);
  });

  it('imports computeCentroids/MIN_CAMPS_FOR_CENTROID read-only from build-province-centroids.mjs — never a re-derived mean (BR-2)', () => {
    expect(src).toContain("import { computeCentroids, MIN_CAMPS_FOR_CENTROID } from './build-province-centroids.mjs'");
  });

  it('is guarded behind isMain so importing it for tests never runs main() (matches db-reset.mjs / cam-605 convention)', () => {
    expect(src).toContain('const isMain =');
    expect(src).toContain('if (isMain) {\n  main();\n}');
  });
});

describe('CAM-620 computeCentroidDrift — the check proven to fail on demand, and to stay quiet', () => {
  it('[AC-3/EC-2] names a province that newly qualifies live but has no committed key (added)', async () => {
    const mod = await import('../scripts/check-province-centroid-drift.mjs');
    const committed = { เชียงใหม่: { lat: 18.79, lng: 98.98, campCount: 5 } };
    const live = {
      เชียงใหม่: { lat: 18.79, lng: 98.98, campCount: 5 },
      กระบี่: { lat: 8.05, lng: 98.9, campCount: 2 }, // just crossed MIN_CAMPS_FOR_CENTROID, no committed key
    };
    const { added, removed, shifted } = mod.computeCentroidDrift(committed, live);
    expect(added).toEqual(['กระบี่']);
    expect(removed).toEqual([]);
    expect(shifted).toEqual([]);
  });

  it('[AC-4/EC-3] names a committed province whose live campCount has dropped below the sparse floor (removed)', async () => {
    const mod = await import('../scripts/check-province-centroid-drift.mjs');
    const committed = {
      เชียงใหม่: { lat: 18.79, lng: 98.98, campCount: 5 },
      ตราด: { lat: 12.24, lng: 102.52, campCount: 3 },
    };
    const live = { เชียงใหม่: { lat: 18.79, lng: 98.98, campCount: 5 } }; // ตราด dropped out entirely
    const { added, removed, shifted } = mod.computeCentroidDrift(committed, live);
    expect(added).toEqual([]);
    expect(removed).toEqual(['ตราด']);
    expect(shifted).toEqual([]);
  });

  it('[AC-5/EC-4] names a province whose centroid moved more than the threshold, with the distance (shifted)', async () => {
    const mod = await import('../scripts/check-province-centroid-drift.mjs');
    expect(mod.CENTROID_DRIFT_THRESHOLD_KM).toBe(5);
    const committed = { ระยอง: { lat: 12.68, lng: 101.28, campCount: 4 } };
    // ~1.1 degrees latitude ~= 122km away — well over the 5km threshold.
    const live = { ระยอง: { lat: 13.68, lng: 101.28, campCount: 4 } };
    const { added, removed, shifted } = mod.computeCentroidDrift(committed, live);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
    expect(shifted).toHaveLength(1);
    expect(shifted[0].province).toBe('ระยอง');
    expect(shifted[0].distanceKm).toBeGreaterThan(5);
  });

  it('[EC-4] a move AT OR BELOW the threshold is NEVER reported (a small, organic shift is not actionable drift)', async () => {
    const mod = await import('../scripts/check-province-centroid-drift.mjs');
    const committed = { ตราด: { lat: 12.24, lng: 102.52, campCount: 3 } };
    // ~0.001 degree ~= 111m away — far below the 5km threshold.
    const live = { ตราด: { lat: 12.241, lng: 102.52, campCount: 4 } };
    const { added, removed, shifted } = mod.computeCentroidDrift(committed, live);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
    expect(shifted).toEqual([]);
  });

  it('[AC-6/EC-5] identical committed/live centroid sets report 0 drift on all three categories', async () => {
    const mod = await import('../scripts/check-province-centroid-drift.mjs');
    const entries = {
      เชียงใหม่: { lat: 18.79, lng: 98.98, campCount: 5 },
      ภูเก็ต: { lat: 7.98, lng: 98.34, campCount: 8 },
    };
    const { added, removed, shifted } = mod.computeCentroidDrift(entries, entries);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
    expect(shifted).toEqual([]);
  });

  it('[real data] the real committed centroids diffed against themselves are quiet (proves the shape works, no DB needed)', async () => {
    const mod = await import('../scripts/check-province-centroid-drift.mjs');
    const real = realProvinceCentroids as Record<string, { lat: number; lng: number; campCount: number }>;
    const { added, removed, shifted } = mod.computeCentroidDrift(real, real);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
    expect(shifted).toEqual([]);
  });
});
