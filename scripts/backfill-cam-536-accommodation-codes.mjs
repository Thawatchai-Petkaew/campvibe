#!/usr/bin/env node
/**
 * scripts/backfill-cam-536-accommodation-codes.mjs — CAM-536
 *
 * `AccommodationTypeEnum` (lib/validations/campsite.ts) renamed its two
 * colliding members: the "Horse camp" meaning HORS -> HCMP, the "Tent site"
 * meaning TENT -> TSIT (see prisma/seed.ts for why — `MasterData.code` is a
 * global @id and the old codes were already owned by OTHER live groups:
 * Activity:HORS / Equipment for rent:TENT, which stay unchanged).
 *
 * This script rewrites every `CampSite.accommodationTypes` CSV value that
 * still carries the OLD codes to the NEW codes — WHOLE VALUE ONLY. It never
 * does a substring/global string replace: a CSV value that merely CONTAINS
 * "TENT"/"HORS" as part of a longer token (there is no such real code today,
 * but the transform must be safe regardless) is left untouched. See
 * `renameAccommodationCsv` below + __tests__/cam-536-*.test.ts for the
 * red-first proof.
 *
 * SAFETY GUARD — refuses unless ALL of:
 *   ALLOW_ACCOMMODATION_BACKFILL=1        (explicit destructive-write opt-in)
 *   DATABASE_URL is set
 *   target does NOT look like production (url contains "prod",
 *   NODE_ENV/VERCEL_ENV=production) — mirrors scripts/db-reset.mjs /
 *   scripts/seed-demand.mjs; logs only scheme+hostname via describeUrlShape,
 *   never path/query/credentials (CAM-359/CAM-369).
 *
 * Idempotent by construction: a row is only written when the transformed
 * CSV actually differs from the stored value, so a second run touches 0
 * rows (proven in __tests__/cam-536-*.test.ts and against the real dev DB —
 * see the PR description for the before/after + double-run counts).
 *
 * Usage:
 *   ALLOW_ACCOMMODATION_BACKFILL=1 DATABASE_URL=<non-prod> \
 *     node scripts/backfill-cam-536-accommodation-codes.mjs
 *
 * NEVER run against production DB.
 */
import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';
import { describeUrlShape } from './db-reset.mjs';

/** Old code -> new code. Whole-value only (see renameAccommodationCsv). */
export const CODE_RENAME_MAP = Object.freeze({
  TENT: 'TSIT',
  HORS: 'HCMP',
});

/**
 * Rewrites a CSV string's values using `map`, WHOLE VALUE ONLY — split on
 * comma, trim, look each value up as-is, join back. Never a substring or
 * global string replace: a value that merely contains an old code as part
 * of a longer token (e.g. a hypothetical "STENT") is NOT in the map by exact
 * match and passes through unchanged. Order and untouched values (CABI/
 * DISP/GROU/RECR, or any future code) are preserved exactly.
 */
export function renameAccommodationCsv(csv, map = CODE_RENAME_MAP) {
  if (typeof csv !== 'string' || csv.length === 0) return csv;
  return csv
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((value) => map[value] ?? value)
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
  const beforeTent = await countWholeValue(prisma, 'TENT');
  const beforeHors = await countWholeValue(prisma, 'HORS');
  log(`before: accommodationTypes carrying whole-value TENT=${beforeTent} HORS=${beforeHors}`);

  const candidates = await prisma.campSite.findMany({
    where: {
      OR: [
        { accommodationTypes: { contains: 'TENT' } },
        { accommodationTypes: { contains: 'HORS' } },
      ],
    },
    select: { id: true, accommodationTypes: true },
  });

  let updated = 0;
  for (const row of candidates) {
    const next = renameAccommodationCsv(row.accommodationTypes);
    if (next !== row.accommodationTypes) {
      await prisma.campSite.update({ where: { id: row.id }, data: { accommodationTypes: next } });
      updated += 1;
    }
  }

  const afterTent = await countWholeValue(prisma, 'TENT');
  const afterHors = await countWholeValue(prisma, 'HORS');
  const afterTsit = await countWholeValue(prisma, 'TSIT');
  const afterHcmp = await countWholeValue(prisma, 'HCMP');
  log(`candidates scanned: ${candidates.length}, rows updated: ${updated}`);
  log(`after: TENT=${afterTent} HORS=${afterHors} TSIT=${afterTsit} HCMP=${afterHcmp}`);

  return {
    beforeTent,
    beforeHors,
    candidates: candidates.length,
    updated,
    afterTent,
    afterHors,
    afterTsit,
    afterHcmp,
  };
}

export function checkGuard() {
  const allow = process.env.ALLOW_ACCOMMODATION_BACKFILL === '1';
  const url = process.env.DATABASE_URL || '';
  const looksProd =
    /prod/i.test(url) ||
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production';
  if (!allow) {
    return { ok: false, message: '✗ refusing: set ALLOW_ACCOMMODATION_BACKFILL=1 to confirm running this backfill' };
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
// (tests import renameAccommodationCsv / runBackfill / checkGuard directly).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await main();
}
