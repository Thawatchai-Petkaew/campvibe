/**
 * CAM-605 (owner follow-up, same story) — riding the subdistrict-shortlist
 * drift check along `scripts/db-sync-from-staging.mjs`, the moment real
 * staging camp data most recently lands in the local dev DB, instead of
 * waiting for a human to remember `check:subdistrict-drift`.
 *
 * `scripts/db-sync-from-staging.mjs` has NO `main()`/`isMain` guard — its
 * top-level module code runs a real, destructive sync (and calls
 * `process.exit(1)` on missing/invalid env) unconditionally at IMPORT time.
 * This suite therefore NEVER imports it (that would attempt a real sync
 * against `DATABASE_URL`/`STAGING_DATABASE_URL`, which do not exist in CI) —
 * every assertion here is SOURCE INSPECTION only, proving the added block:
 *   1. reuses the SAME `computeLiveShortlistEntries`/`computeDrift`
 *      functions the check script already exports (no re-derived logic,
 *      no edit to check-subdistrict-shortlist-drift.mjs itself);
 *   2. runs only on the sync's SUCCESS path (after the "✓ synced" log line);
 *   3. is wrapped in its OWN try/catch that never calls `process.exit` or
 *      sets `process.exitCode` — a drift finding, or even a failure to
 *      check at all, must never fail (or change the exit code of) the sync;
 *   4. the sync's own pre-existing failure path (`process.exitCode = 1`,
 *      exactly once) is unchanged by this addition.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const src = readFileSync(path.join(root, 'scripts/db-sync-from-staging.mjs'), 'utf-8');

describe('CAM-605 — db-sync-from-staging.mjs rides the drift check along a real sync (non-blocking)', () => {
  it('reuses the SAME exported functions the generator/check scripts already ship — no re-derived query, no check-file edit', () => {
    expect(src).toContain("import { computeLiveShortlistEntries } from \"./generate-subdistrict-shortlist.mjs\"");
    expect(src).toContain("import { computeDrift } from \"./check-subdistrict-shortlist-drift.mjs\"");
    expect(src).not.toMatch(/prisma\.adminArea\.findMany/); // no second, hand-copied query in THIS file
  });

  it('the drift-check block runs only on the SUCCESS path (after the "synced" log line)', () => {
    const syncedIdx = src.indexOf('synced ${total} rows into the local dev DB');
    const driftBlockIdx = src.indexOf('CAM-605 — non-blocking, report-mode only');
    expect(syncedIdx).toBeGreaterThan(-1);
    expect(driftBlockIdx).toBeGreaterThan(syncedIdx);
  });

  it('the drift-check block is wrapped in its OWN try/catch, isolated from the sync\'s outer catch', () => {
    const driftTryIdx = src.indexOf('try {', src.indexOf('CAM-605 — non-blocking, report-mode only'));
    const driftCatchIdx = src.indexOf('catch (driftErr)', driftTryIdx);
    const outerCatchIdx = src.indexOf('} catch (err) {', driftCatchIdx);
    expect(driftTryIdx).toBeGreaterThan(-1);
    expect(driftCatchIdx).toBeGreaterThan(driftTryIdx);
    expect(outerCatchIdx).toBeGreaterThan(driftCatchIdx); // the drift try/catch closes BEFORE the sync's own catch begins
  });

  it('the drift catch block never calls process.exit or sets process.exitCode — a finding (or a failed check) never fails the sync', () => {
    const driftCatchIdx = src.indexOf('catch (driftErr)');
    const driftCatchEnd = src.indexOf('} catch (err) {', driftCatchIdx);
    expect(driftCatchIdx).toBeGreaterThan(-1);
    expect(driftCatchEnd).toBeGreaterThan(driftCatchIdx);
    const driftBlock = src.slice(driftCatchIdx, driftCatchEnd);
    expect(driftBlock).not.toMatch(/process\.exit\(/);
    expect(driftBlock).not.toMatch(/process\.exitCode/);
  });

  it('the sync\'s own pre-existing failure path is unchanged: exactly one process.exitCode = 1, in the outer catch only', () => {
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
