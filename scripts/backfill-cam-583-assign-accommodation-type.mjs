#!/usr/bin/env node
/**
 * scripts/backfill-cam-583-assign-accommodation-type.mjs — CAM-583
 *
 * The owner's first data-correction ask (2026-07-27): 12 camps on staging (10
 * on dev) have an empty `CampSite.accommodationTypes` — the ones whose only
 * value was the retired horse-camp code (`HCMP`, dropped whole-value by
 * CAM-538's `scripts/backfill-cam-538-drop-horse-camp.mjs`, which correctly
 * left the column `''` rather than guess a replacement).
 *
 * Assigns `DISP` ("กางเต็นท์อิสระ (ไม่แบ่งล็อค)" — dispersed camping on open
 * ground, no marked pitch; `lib/validations/campsite.ts`'s `AccommodationTypeEnum`)
 * — never `TSIT` (marked tent pitch), which would assert a claim ("มีล็อคกาง
 * เต็นท์ชัดเจน") nothing in the data supports.
 *
 * Why DISP specifically, and why it is VERIFIED, not assumed: every one of
 * these camps is named as an open field (`ทุ่งโล่ง`, `ทุ่งกว้าง`, `ทุ่งหญ้า`,
 * `เนินหญ้า`, `ทุ่งดอกไม้`) AND carries a Terrain MasterData tag from
 * {FARM, FILD, FORE, MTNS} (farm/field/forest/mountain — `prisma/seed.ts`).
 * `fitsOpenFieldPattern` requires BOTH the name signal AND the terrain signal
 * together (a co-occurrence check, never a bare Thai-substring match alone —
 * CAM-501/503's substring-collision lesson: "ทุ่ง"/"เนิน" are common enough
 * Thai words that a name-only match could mis-fire on an unrelated camp with
 * no open-ground terrain at all). A candidate matching the name pattern but
 * NOT carrying a supporting terrain tag (or vice versa) is left untouched and
 * reported as an exception — never forced.
 *
 * Real scan result (both DBs, 2026-07-27): 10 of 10 dev candidates and 12 of
 * 12 staging candidates fit the pattern — verified by direct query, every
 * name+terrain pair inspected. Zero exceptions on either database (see the
 * PR body for the full per-camp list).
 *
 * SAFETY GUARD — refuses unless ALL of:
 *   ALLOW_ASSIGN_ACCOMMODATION_TYPE_BACKFILL=1  (explicit opt-in)
 *   DATABASE_URL is set
 *   target does NOT look like production; logs only scheme+hostname via
 *   describeUrlShape, never path/query/credentials (CAM-359/CAM-369)
 *
 * Idempotent by construction: the candidate query is
 * `accommodationTypes: ''` — once a row is written to `'DISP'` it no longer
 * matches that query, so a second run finds 0 candidates and writes 0 rows.
 * No Google Geocoding calls — this backfill is DB-only.
 *
 * Usage:
 *   # 1. Dry run first — reports the projection, writes NOTHING:
 *   ALLOW_ASSIGN_ACCOMMODATION_TYPE_BACKFILL=1 DRY_RUN=1 \
 *     DATABASE_URL=<non-prod> node scripts/backfill-cam-583-assign-accommodation-type.mjs
 *
 *   # 2. Real run:
 *   ALLOW_ASSIGN_ACCOMMODATION_TYPE_BACKFILL=1 \
 *     DATABASE_URL=<non-prod> node scripts/backfill-cam-583-assign-accommodation-type.mjs
 *
 * NEVER run against production DB.
 */
import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';
import { describeUrlShape } from './db-reset.mjs';

/** `lib/validations/campsite.ts::AccommodationTypeEnum` — "Dispersed camping (no marked pitch)". */
export const ASSIGNED_CODE = 'DISP';

/** Name keywords that signal an open-field/meadow camp (Thai). Never matched alone — see `fitsOpenFieldPattern`. */
export const OPEN_FIELD_NAME_KEYWORDS = ['ทุ่ง', 'เนิน'];

/** Terrain MasterData codes (`prisma/seed.ts`, group 'Terrain') consistent with open, unmarked ground. */
export const OPEN_FIELD_TERRAIN_CODES = ['FARM', 'FILD', 'FORE', 'MTNS'];

/**
 * A candidate fits the open-field/DISP pattern only when BOTH signals agree:
 * the Thai name carries an open-field keyword AND the camp's own Terrain
 * MasterData tags include at least one open-ground-consistent code. Either
 * signal alone is refused — never a guess (CAM-501/503's Thai-substring
 * collision lesson: a name-only match on a common word like "ทุ่ง"/"เนิน"
 * could mis-fire on an unrelated camp).
 */
export function fitsOpenFieldPattern({ nameTh, terrainCodes }) {
  const nameMatches = OPEN_FIELD_NAME_KEYWORDS.some((kw) => (nameTh ?? '').includes(kw));
  const terrainMatches = (terrainCodes ?? []).some((code) => OPEN_FIELD_TERRAIN_CODES.includes(code));
  return nameMatches && terrainMatches;
}

/**
 * Runs the backfill against an injected Prisma-like client. `dryRun: true`
 * computes and reports every write but issues ZERO `campSite.update` calls.
 * A candidate that does NOT fit `fitsOpenFieldPattern` is left untouched and
 * recorded in `exceptions` — never force-assigned.
 */
export async function runBackfill(prisma, { dryRun = false, log = () => {} } = {}) {
  const candidates = await prisma.campSite.findMany({
    where: { accommodationTypes: '' },
    select: {
      id: true,
      nameTh: true,
      nameEn: true,
      accommodationTypes: true,
      options: { select: { code: true, group: true } },
    },
  });

  const summary = {
    candidates: candidates.length,
    assigned: [],
    exceptions: [],
  };

  for (const row of candidates) {
    const terrainCodes = row.options.filter((o) => o.group === 'Terrain').map((o) => o.code);
    if (!fitsOpenFieldPattern({ nameTh: row.nameTh, terrainCodes })) {
      summary.exceptions.push({ id: row.id, nameTh: row.nameTh, nameEn: row.nameEn, terrainCodes, reason: 'does_not_fit_open_field_pattern' });
      continue;
    }

    if (!dryRun) {
      await prisma.campSite.update({ where: { id: row.id }, data: { accommodationTypes: ASSIGNED_CODE } });
    }
    summary.assigned.push({ id: row.id, nameTh: row.nameTh, nameEn: row.nameEn, terrainCodes });
  }

  log(`candidates (accommodationTypes === ''): ${summary.candidates}`);
  log(`${dryRun ? 'would assign' : 'assigned'} ${ASSIGNED_CODE}: ${summary.assigned.length}`);
  log(`exceptions (left untouched, does not fit the open-field pattern): ${summary.exceptions.length}`);
  if (summary.exceptions.length > 0) {
    log(JSON.stringify(summary.exceptions, null, 2));
  }

  return summary;
}

export function checkGuard() {
  const allow = process.env.ALLOW_ASSIGN_ACCOMMODATION_TYPE_BACKFILL === '1';
  const url = process.env.DATABASE_URL || '';
  const looksProd = /prod/i.test(url) || process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (!allow) {
    return { ok: false, message: '✗ refusing: set ALLOW_ASSIGN_ACCOMMODATION_TYPE_BACKFILL=1 to confirm running this backfill' };
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

  const dryRun = process.env.DRY_RUN === '1';
  console.log(dryRun ? 'MODE: DRY RUN — reporting only, no writes' : 'MODE: REAL RUN — writing assigned types');

  const prisma = new PrismaClient();
  try {
    const before = await prisma.campSite.count({ where: { location: { province: 'Chiang Mai' } } });
    console.log(`Chiang Mai province-filter count BEFORE: ${before}`);

    const summary = await runBackfill(prisma, { dryRun, log: console.log });

    const after = await prisma.campSite.count({ where: { location: { province: 'Chiang Mai' } } });
    console.log(`Chiang Mai province-filter count AFTER: ${after}`);
    if (after !== before) {
      console.error(`✗ REGRESSION: Chiang Mai count changed from ${before} to ${after}`);
      process.exitCode = 1;
    }

    if (summary.exceptions.length > 0) {
      console.log(`✗ ${summary.exceptions.length} exception(s) left untouched — see above for reasons`);
    }
    console.log('✓ backfill complete');
  } catch (err) {
    console.error('✗ backfill failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

// Only auto-run when executed directly — not when imported for its exports
// (tests import runBackfill / fitsOpenFieldPattern / checkGuard directly).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await main();
}
