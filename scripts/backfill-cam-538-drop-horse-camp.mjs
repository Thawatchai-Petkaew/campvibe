#!/usr/bin/env node
/**
 * scripts/backfill-cam-538-drop-horse-camp.mjs — CAM-538
 *
 * `AccommodationTypeEnum` (lib/validations/campsite.ts) drops the `HCMP`
 * ("Horse camp") member entirely — a US-origin member inherited from the
 * original v1 `AccommodationTypeEnum` with no Thai camp relevance (owner
 * decision, 2026-07-26). `HCMP` itself was CAM-536's rename of the original
 * colliding `HORS` code (see scripts/backfill-cam-536-accommodation-codes.mjs
 * for that migration's history — unrelated to this one).
 *
 * This script rewrites every `CampSite.accommodationTypes` CSV value that
 * still carries `HCMP`, removing it WHOLE-VALUE ONLY (never a substring/
 * global string replace — the same trap class CAM-536 guarded against): a
 * CSV value that merely contains "HCMP" as part of a longer token is left
 * untouched. Any OTHER value in the same CSV (e.g. `TSIT`, `GROU`) passes
 * through byte-identical and value order is preserved. If `HCMP` was the
 * ONLY value, the column becomes `''` (empty) — matching how the host
 * form's "everything deselected" state already writes/reads that column
 * (CAM-526 BR-3).
 *
 * SAFETY GUARD — refuses unless ALL of:
 *   ALLOW_HORSE_CAMP_BACKFILL=1   (explicit destructive-write opt-in)
 *   DATABASE_URL is set
 *   target does NOT look like production (url contains "prod",
 *   NODE_ENV/VERCEL_ENV=production) — mirrors scripts/db-reset.mjs /
 *   scripts/backfill-cam-536-accommodation-codes.mjs; logs only
 *   scheme+hostname via describeUrlShape, never path/query/credentials
 *   (CAM-359/CAM-369).
 *
 * Idempotent by construction: a row is only written when the transformed
 * CSV actually differs from the stored value, so a second run touches 0
 * rows (proven in __tests__/cam-538-*.test.ts and against the real dev DB —
 * see the PR description for the before/after + double-run counts).
 *
 * Usage:
 *   ALLOW_HORSE_CAMP_BACKFILL=1 DATABASE_URL=<non-prod> \
 *     node scripts/backfill-cam-538-drop-horse-camp.mjs
 *
 * NEVER run against production DB.
 */
import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';
import { describeUrlShape } from './db-reset.mjs';

/** The dropped code. Whole-value only (see removeAccommodationCode). */
export const DROPPED_CODE = 'HCMP';

/**
 * Removes `code` from a CSV string, WHOLE VALUE ONLY — split on comma, trim,
 * drop an exact match, rejoin. Never a substring or global string replace: a
 * value that merely contains the dropped code as part of a longer token
 * (e.g. a hypothetical "HCMPX") is NOT an exact match and passes through
 * unchanged. Order and every other value (TSIT/DISP/GROU/RECR/CABI, or any
 * future code) are preserved exactly. An all-dropped CSV becomes `''`.
 */
export function removeAccommodationCode(csv, code = DROPPED_CODE) {
  if (typeof csv !== 'string' || csv.length === 0) return csv;
  return csv
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .filter((value) => value !== code)
    .join(',');
}

/** Real, non-substring count: re-splits every candidate row's CSV in JS. */
async function countWholeValue(prisma, code) {
  const candidates = await prisma.campSite.findMany({
    where: { accommodationTypes: { contains: code } },
    select: { accommodationTypes: true },
  });
  return candidates.filter((row) =>
    row.accommodationTypes
      .split(',')
      .map((v) => v.trim())
      .includes(code)
  ).length;
}

/**
 * Runs the backfill against an injected Prisma-like client (real PrismaClient
 * in production use; a lightweight fake in tests) and returns the before/
 * after counts for the report. Never calls deleteMany; only updates rows
 * whose transformed CSV actually differs from the stored value.
 */
export async function runBackfill(prisma, { log = console.log } = {}) {
  const before = await countWholeValue(prisma, DROPPED_CODE);
  log(`before: accommodationTypes carrying whole-value ${DROPPED_CODE}=${before}`);

  const candidates = await prisma.campSite.findMany({
    where: { accommodationTypes: { contains: DROPPED_CODE } },
    select: { id: true, accommodationTypes: true },
  });

  let updated = 0;
  for (const row of candidates) {
    const next = removeAccommodationCode(row.accommodationTypes);
    if (next !== row.accommodationTypes) {
      await prisma.campSite.update({ where: { id: row.id }, data: { accommodationTypes: next } });
      updated += 1;
    }
  }

  const after = await countWholeValue(prisma, DROPPED_CODE);
  log(`candidates scanned: ${candidates.length}, rows updated: ${updated}`);
  log(`after: ${DROPPED_CODE}=${after}`);

  return { before, candidates: candidates.length, updated, after };
}

export function checkGuard() {
  const allow = process.env.ALLOW_HORSE_CAMP_BACKFILL === '1';
  const url = process.env.DATABASE_URL || '';
  const looksProd =
    /prod/i.test(url) ||
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production';
  if (!allow) {
    return { ok: false, message: '✗ refusing: set ALLOW_HORSE_CAMP_BACKFILL=1 to confirm running this backfill' };
  }
  if (!url) {
    return { ok: false, message: '✗ refusing: DATABASE_URL is not set' };
  }
  if (looksProd) {
    return { ok: false, message: '✗ refusing: target looks like PRODUCTION — backfill blocked for safety' };
  }
  return { ok: true, url };
}

export async function main() {
  const guard = checkGuard();
  if (!guard.ok) {
    console.error(guard.message);
    process.exit(1);
  }
  console.log(`target: ${describeUrlShape(guard.url)}`);

  const prisma = new PrismaClient();
  try {
    await runBackfill(prisma);
    console.log('✓ backfill complete');
  } catch (err) {
    console.error('✗ backfill failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

// Only auto-run when executed directly — not when imported for its exports
// (tests import removeAccommodationCode / runBackfill / checkGuard directly).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await main();
}
