/**
 * CAM-620 (AC-10/EC-9) — riding the two new drift checks (province-centroid,
 * AdminArea province/district) along `scripts/db-sync-from-staging.mjs`,
 * the same site + shape CAM-605 established for the sub-district shortlist:
 * the moment real, current data most recently lands in the local dev DB.
 *
 * `scripts/db-sync-from-staging.mjs` has NO `main()`/`isMain` guard — its
 * top-level module code runs a real, destructive sync unconditionally at
 * IMPORT time. This suite therefore NEVER imports it (that would attempt a
 * real sync against DATABASE_URL/STAGING_DATABASE_URL, which do not exist
 * in CI) — every assertion here is SOURCE INSPECTION only, proving each new
 * block:
 *   1. reuses the SAME exported pure diff functions the two new check
 *      scripts already ship (no re-derived diff logic, no edit to either
 *      check script's own exit codes);
 *   2. runs only on the sync's SUCCESS path (after the "synced" log line),
 *      after the pre-existing CAM-605 block;
 *   3. is wrapped in its OWN try/catch that never calls process.exit or
 *      sets process.exitCode — a drift finding, or even a failure to check
 *      at all, must never fail (or change the exit code of) the sync;
 *   4. the sync's own pre-existing failure path (process.exitCode = 1,
 *      exactly once, in the outer catch) is unchanged by these additions.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const src = readFileSync(path.join(root, 'scripts/db-sync-from-staging.mjs'), 'utf-8');

describe('CAM-620 — db-sync-from-staging.mjs rides both new drift checks along a real sync (non-blocking)', () => {
  it('reuses the SAME exported functions the two new check scripts already ship — no re-derived diff logic', () => {
    expect(src).toContain('import { computeCentroids } from "./build-province-centroids.mjs"');
    expect(src).toContain('import { computeCentroidDrift } from "./check-province-centroid-drift.mjs"');
    expect(src).toContain(
      'import { buildCommittedAdminAreaIndex, buildLiveAdminAreaIndex, computeAdminAreaDrift } from "./check-adminarea-drift.mjs"'
    );
  });

  it('both new blocks run only on the SUCCESS path, after the pre-existing CAM-605 block', () => {
    const syncedIdx = src.indexOf('synced ${total} rows into the local dev DB');
    const cam605Idx = src.indexOf('CAM-605 — non-blocking, report-mode only');
    const centroidBlockIdx = src.indexOf('CAM-620 — same non-blocking, report-mode shape as the CAM-605 block');
    const adminAreaBlockIdx = src.indexOf("CAM-620 — same non-blocking, report-mode shape, for\n  // thailand-locations.json");
    expect(syncedIdx).toBeGreaterThan(-1);
    expect(cam605Idx).toBeGreaterThan(syncedIdx);
    expect(centroidBlockIdx).toBeGreaterThan(cam605Idx);
    expect(adminAreaBlockIdx).toBeGreaterThan(centroidBlockIdx);
  });

  it('the province-centroid ride-along is wrapped in its OWN try/catch, isolated from the sync\'s outer catch', () => {
    const blockIdx = src.indexOf('CAM-620 — same non-blocking, report-mode shape as the CAM-605 block');
    const tryIdx = src.indexOf('try {', blockIdx);
    const catchIdx = src.indexOf('catch (driftErr)', tryIdx);
    const outerCatchIdx = src.indexOf('} catch (err) {', catchIdx);
    expect(tryIdx).toBeGreaterThan(-1);
    expect(catchIdx).toBeGreaterThan(tryIdx);
    expect(outerCatchIdx).toBeGreaterThan(catchIdx);
  });

  it('the AdminArea ride-along is wrapped in its OWN try/catch, isolated from the sync\'s outer catch', () => {
    const blockIdx = src.indexOf("CAM-620 — same non-blocking, report-mode shape, for\n  // thailand-locations.json");
    const tryIdx = src.indexOf('try {', blockIdx);
    const catchIdx = src.indexOf('catch (driftErr)', tryIdx);
    const outerCatchIdx = src.indexOf('} catch (err) {', catchIdx);
    expect(tryIdx).toBeGreaterThan(-1);
    expect(catchIdx).toBeGreaterThan(tryIdx);
    expect(outerCatchIdx).toBeGreaterThan(catchIdx);
  });

  it('neither new ride-along catch block calls process.exit or sets process.exitCode', () => {
    const outerCatchIdx = src.indexOf('} catch (err) {');
    // Slice out just the two new CAM-620 blocks (between the CAM-605 block and the outer catch).
    const cam620Start = src.indexOf('CAM-620 — same non-blocking, report-mode shape as the CAM-605 block');
    const cam620Region = src.slice(cam620Start, outerCatchIdx);
    expect(cam620Region).not.toMatch(/process\.exit\(/);
    // Assert no ASSIGNMENT to process.exitCode (the comment merely mentions
    // the word "process.exitCode" in prose to explain the isolation).
    expect(cam620Region).not.toMatch(/process\.exitCode\s*=/);
  });

  it("the sync's own pre-existing failure path is unchanged: exactly one process.exitCode = 1, in the outer catch only", () => {
    const exitCodeAssignments = (src.match(/process\.exitCode\s*=\s*1/g) || []).length;
    expect(exitCodeAssignments).toBe(1);
    const outerCatchIdx = src.indexOf('} catch (err) {');
    const assignmentIdx = src.indexOf('process.exitCode = 1');
    expect(outerCatchIdx).toBeGreaterThan(-1);
    expect(assignmentIdx).toBeGreaterThan(outerCatchIdx);
  });

  it('never introduces a second import of node:fs/node:url/node:path with a conflicting name (no __dirname redeclaration bug)', () => {
    const dirnameDeclCount = (src.match(/const __dirname = /g) || []).length;
    expect(dirnameDeclCount).toBe(1);
  });
});
