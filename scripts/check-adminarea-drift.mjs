#!/usr/bin/env node
/**
 * scripts/check-adminarea-drift.mjs — CAM-620
 *
 * `prisma/data/thailand-locations.json` is the seed source for the
 * `AdminArea` table (`prisma/seed.ts`'s `prisma.adminArea.upsert({ ...,
 * update: { nameTh, nameEn, parentId } })` per province/district/
 * sub-district). That upsert WOULD bring a live row's name back in line
 * with the file — but only the moment the seed actually re-runs. In
 * practice a DB is seeded once and afterward only touched by migrations,
 * targeted backfills (none of which write `AdminArea.nameTh`/`nameEn` —
 * they write `Location.adminAreaId`/coordinates instead), or a full
 * `db:sync-from-staging` (which copies the live table row-for-row,
 * carrying forward whatever names were seeded at THAT database's last
 * reseed — never today's committed file). CAM-553's own tech.md records
 * the concrete precedent this guards against: 2 province English spellings
 * were deliberately overridden to the RTGS form when the file was
 * rebuilt — a DB seeded before that edit and never reseeded since would
 * keep the old spelling indefinitely, with nothing noticing. This script
 * makes that divergence DETECTABLE on demand, for the PROVINCE and
 * DISTRICT levels (CAM-605 already owns SUBDISTRICT).
 *
 * WHAT IT DOES: reads the committed `thailand-locations.json`'s PROVINCE +
 * DISTRICT entries (by `code`, the stable per-level key —
 * `@@unique([countryCode, level, code])`), queries the live `AdminArea`
 * table at those two levels in ONE query, and diffs by code:
 *   - missingLive       a committed code the live table has never seeded
 *   - missingCommitted  a live code the current file no longer lists
 *   - renamed           a code present on both sides with a different
 *                       nameTh/nameEn (the RTGS-override-class drift)
 *
 * WHAT IT NEVER DOES: write to `thailand-locations.json` or to the live
 * `AdminArea` table — a read-only comparison (regenerating/reseeding is a
 * separate decision, see this story's story.md "Out of scope").
 *
 * WHERE IT RUNS: a manual, on-demand `check:*` script
 * (`npm run check:adminarea-drift`). Deliberately NOT wired into
 * `.github/workflows/ci.yml`'s `quality-gate` job — no Postgres service /
 * DATABASE_URL there (same fact CAM-605's tech.md already confirmed).
 *
 * NO DATABASE REACHABLE (both cases SKIPPED, never a false pass/crash):
 *   1. DATABASE_URL unset       -> no PrismaClient is even constructed.
 *   2. DATABASE_URL set but the connection/query throws -> caught, same
 *      SKIPPED treatment, no partial output printed.
 * Exit 0 covers BOTH "skipped, unknowable here" and "checked, clean". Exit
 * 1 is reserved for the one actionable case: a real code-level difference.
 *
 * Usage: node scripts/check-adminarea-drift.mjs
 * (source the target env's `.env` first for DATABASE_URL — dev DB today).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { describeUrlShape } from './db-reset.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCATIONS_PATH = join(__dirname, '..', 'prisma', 'data', 'thailand-locations.json');

/**
 * Builds { provinces: Map<code,{nameTh,nameEn}>, districts: Map<code,{nameTh,nameEn,provinceCode}> }
 * from the committed thailand-locations.json shape (province[].districts[]).
 * SUBDISTRICT entries exist on the same file but are never read here —
 * CAM-605 already owns that level (BR-5).
 *
 * @param {Array<{code:string,nameTh:string,nameEn:string,districts?:Array<{code:string,nameTh:string,nameEn:string}>}>} locationsJson
 */
export function buildCommittedAdminAreaIndex(locationsJson) {
  const provinces = new Map();
  const districts = new Map();
  for (const p of locationsJson) {
    provinces.set(p.code, { nameTh: p.nameTh, nameEn: p.nameEn });
    for (const d of p.districts || []) {
      districts.set(d.code, { nameTh: d.nameTh, nameEn: d.nameEn, provinceCode: p.code });
    }
  }
  return { provinces, districts };
}

/**
 * Builds the same shape from a flat `prisma.adminArea.findMany` result at
 * PROVINCE+DISTRICT level — a district's `provinceCode` is resolved by
 * matching its `parentId` against the PROVINCE rows' `id` in the SAME
 * result set (no second query needed).
 *
 * @param {Array<{id:string,level:'PROVINCE'|'DISTRICT',code:string,nameTh:string,nameEn:string,parentId:string|null}>} adminAreaRows
 */
export function buildLiveAdminAreaIndex(adminAreaRows) {
  const provinceCodeById = new Map();
  const provinces = new Map();
  for (const r of adminAreaRows) {
    if (r.level === 'PROVINCE') {
      provinces.set(r.code, { nameTh: r.nameTh, nameEn: r.nameEn });
      provinceCodeById.set(r.id, r.code);
    }
  }
  const districts = new Map();
  for (const r of adminAreaRows) {
    if (r.level === 'DISTRICT') {
      const provinceCode = r.parentId ? provinceCodeById.get(r.parentId) : undefined;
      districts.set(r.code, { nameTh: r.nameTh, nameEn: r.nameEn, provinceCode });
    }
  }
  return { provinces, districts };
}

/**
 * Pure — diffs a committed index against a live index (same shape both
 * sides, from the two builders above), level by level.
 *
 * @param {{provinces: Map<string,{nameTh:string,nameEn:string}>, districts: Map<string,{nameTh:string,nameEn:string,provinceCode?:string}>}} committed
 * @param {{provinces: Map<string,{nameTh:string,nameEn:string}>, districts: Map<string,{nameTh:string,nameEn:string,provinceCode?:string}>}} live
 * @returns {{ missingLive: Array<{level:string,code:string,nameTh:string}>, missingCommitted: Array<{level:string,code:string,nameTh:string}>, renamed: Array<{level:string,code:string,committed:{nameTh:string,nameEn:string},live:{nameTh:string,nameEn:string}}> }}
 */
export function computeAdminAreaDrift(committed, live) {
  const missingLive = [];
  const missingCommitted = [];
  const renamed = [];

  const levels = [
    ['PROVINCE', committed.provinces, live.provinces],
    ['DISTRICT', committed.districts, live.districts],
  ];

  for (const [level, committedMap, liveMap] of levels) {
    for (const [code, c] of committedMap) {
      const l = liveMap.get(code);
      if (!l) {
        missingLive.push({ level, code, nameTh: c.nameTh });
        continue;
      }
      if (l.nameTh !== c.nameTh || l.nameEn !== c.nameEn) {
        renamed.push({
          level,
          code,
          committed: { nameTh: c.nameTh, nameEn: c.nameEn },
          live: { nameTh: l.nameTh, nameEn: l.nameEn },
        });
      }
    }
    for (const [code, l] of liveMap) {
      if (!committedMap.has(code)) {
        missingCommitted.push({ level, code, nameTh: l.nameTh });
      }
    }
  }

  const byLevelThenCode = (a, b) => a.level.localeCompare(b.level) || a.code.localeCompare(b.code);
  missingLive.sort(byLevelThenCode);
  missingCommitted.sort(byLevelThenCode);
  renamed.sort(byLevelThenCode);

  return { missingLive, missingCommitted, renamed };
}

export async function main() {
  const locationsJson = JSON.parse(readFileSync(LOCATIONS_PATH, 'utf-8'));
  const committed = buildCommittedAdminAreaIndex(locationsJson);

  const url = process.env.DATABASE_URL || '';
  if (!url) {
    console.warn(
      '[check-adminarea-drift] SKIPPED (not a pass) — no DATABASE_URL in this environment. ' +
        "CI's quality-gate job has none by design (see this file's own docblock); source a real env's .env " +
        '(e.g. dev) and re-run to actually check for drift.'
    );
    process.exit(0);
    return;
  }

  const prisma = new PrismaClient();
  let live;
  try {
    console.log(`[check-adminarea-drift] comparing the committed thailand-locations.json against ${describeUrlShape(url)}`);
    const rows = await prisma.adminArea.findMany({
      where: { countryCode: 'TH', level: { in: ['PROVINCE', 'DISTRICT'] } },
      select: { id: true, level: true, code: true, nameTh: true, nameEn: true, parentId: true },
    });
    live = buildLiveAdminAreaIndex(rows);
  } catch (error) {
    console.warn(
      `[check-adminarea-drift] SKIPPED (not a pass) — DATABASE_URL was set but unreachable: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
    return;
  }
  await prisma.$disconnect();

  const { missingLive, missingCommitted, renamed } = computeAdminAreaDrift(committed, live);

  if (missingLive.length === 0 && missingCommitted.length === 0 && renamed.length === 0) {
    console.log(
      `[check-adminarea-drift] OK — 0 drift. ${committed.provinces.size} provinces + ${committed.districts.size} ` +
        'districts in thailand-locations.json still match the live AdminArea table exactly.'
    );
    process.exit(0);
    return;
  }

  if (missingLive.length > 0) {
    console.error(
      `[check-adminarea-drift] MISSING LIVE — ${missingLive.length} committed code(s) have never been seeded into AdminArea: ` +
        missingLive.map((e) => `${e.level}:${e.code} (${e.nameTh})`).join(', ')
    );
  }
  if (missingCommitted.length > 0) {
    console.error(
      `[check-adminarea-drift] MISSING COMMITTED — ${missingCommitted.length} live code(s) are no longer in thailand-locations.json: ` +
        missingCommitted.map((e) => `${e.level}:${e.code} (${e.nameTh})`).join(', ')
    );
  }
  if (renamed.length > 0) {
    console.error(
      `[check-adminarea-drift] RENAMED — ${renamed.length} code(s) differ between the committed file and the live table:`
    );
    for (const r of renamed) {
      console.error(
        `    ${r.level}:${r.code}: committed="${r.committed.nameTh}"/"${r.committed.nameEn}" vs live="${r.live.nameTh}"/"${r.live.nameEn}"`
      );
    }
  }
  console.error(
    '[check-adminarea-drift] This story detects only — reseeding AdminArea from thailand-locations.json is a separate, out-of-scope decision.'
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
