#!/usr/bin/env node
/**
 * scripts/backfill-cam-563-location-admin-area.mjs — CAM-563
 *
 * `Location.adminAreaId` (prisma/schema.prisma:236) is the FK into the
 * AdminArea tree — designed as the eventual replacement for the free-text
 * `province`/`district`/`subDistrict` columns (the comment at :239 reads
 * "pending migration to adminArea") — but was set for only 12 of 652
 * `Location` rows in the dev DB (measured on the ticket). This script
 * resolves the remaining rows' EXISTING free-text values against the
 * AdminArea tree and writes the id, WITHOUT touching or clearing the
 * free-text columns (BR-3 of the ticket: write both during the transition,
 * no big-bang swap).
 *
 * Matching is bilingual (a stored value may be Thai OR English — CAM-559
 * found hosts save whichever language the UI was in) and hierarchical:
 * PROVINCE first, then DISTRICT scoped to the matched province (never a
 * same-named district in the wrong province), then SUBDISTRICT scoped to
 * the matched district. The final `adminAreaId` is the DEEPEST level
 * actually resolved (subDistrict ?? district ?? province ?? null) — the
 * SAME convention CAM-554's reverse-geocode resolver uses
 * (`app/api/geocode/_shared.ts::resolveFromComponents`, not yet merged as
 * of this story — see tech.md's Seams section for why this script's
 * matcher is a standalone, faithfully-ported twin rather than a shared
 * import, and the planned consolidation once both land).
 *
 * Every match is EXACT (case-insensitive equals on nameTh/nameEn), never a
 * substring/`contains` — the DEF-1/DEF-2 Thai-substring collision lesson in
 * .claude/rules/code.md applies here too (a `contains` match against a
 * closed ~77-province + district + sub-district set risks a short name
 * being a substring of an unrelated longer one).
 *
 * A row whose `province` does not match ANY AdminArea node is left with
 * `adminAreaId: null` and is REPORTED in the `unresolved` list — never a
 * silent null (the ticket's explicit ask). In the dev DB this is exactly 2
 * rows, both orphaned placeholders (`province: 'x'`, no attached camp —
 * see the report for the live proof).
 *
 * Idempotent by construction: only rows where `adminAreaId IS NULL` are
 * candidates (a row already resolved — e.g. one of the 12 set by
 * `POST /api/location`'s existing thaiLocationId-based resolution — is
 * never re-touched/overwritten), so a second run updates 0 rows.
 *
 * SAFETY GUARD — refuses unless ALL of:
 *   ALLOW_LOCATION_ADMIN_AREA_BACKFILL=1  (explicit destructive-write opt-in)
 *   DATABASE_URL is set
 *   target does NOT look like production (mirrors scripts/db-reset.mjs /
 *   scripts/backfill-cam-536-accommodation-codes.mjs); logs only
 *   scheme+hostname via describeUrlShape, never path/query/credentials
 *   (CAM-359/CAM-369).
 *
 * Usage:
 *   ALLOW_LOCATION_ADMIN_AREA_BACKFILL=1 DATABASE_URL=<non-prod> \
 *     node scripts/backfill-cam-563-location-admin-area.mjs
 *
 * NEVER run against production DB.
 */
import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';
import { describeUrlShape } from './db-reset.mjs';

/**
 * Known Thai/English administrative prefixes/suffixes that CAN appear on a
 * free-text value typed by a host (mirrors CAM-554's `normalizeAdminName` —
 * same list, ported since that file is not yet merged). Longest/most
 * specific entries first so a shared substring (e.g. "อำเภอ" inside
 * "กิ่งอำเภอ") never partially matches.
 */
const THAI_PREFIXES = ['กิ่งอำเภอ', 'จังหวัด', 'อำเภอ', 'เขต', 'ตำบล', 'แขวง'];
const EN_PREFIXES = ['Changwat ', 'Chang Wat ', 'Amphoe ', 'Amphur ', 'Khet ', 'Tambon ', 'Khwaeng ', 'District ', 'Province of '];
const EN_SUFFIXES = [' Province', ' District'];

/** Deterministic prefix/suffix strip, never a substring match — exported for the unit test. */
export function normalizeAdminAreaName(raw) {
  let name = (raw ?? '').trim();
  if (!name) return name;
  for (const prefix of THAI_PREFIXES) {
    if (name.startsWith(prefix)) { name = name.slice(prefix.length); break; }
  }
  for (const prefix of EN_PREFIXES) {
    if (name.startsWith(prefix)) { name = name.slice(prefix.length); break; }
  }
  for (const suffix of EN_SUFFIXES) {
    if (name.endsWith(suffix)) { name = name.slice(0, -suffix.length); break; }
  }
  return name.trim();
}

/**
 * Bilingual, hierarchical match against the AdminArea tree. `parentId`
 * scopes the search to a specific parent (never a same-named district in a
 * different province) — exact equality only (`equals`, case-insensitive),
 * never `contains`.
 */
export async function matchAdminAreaByName(prisma, level, rawName, parentId) {
  const name = normalizeAdminAreaName(rawName);
  if (!name) return null;
  return prisma.adminArea.findFirst({
    where: {
      countryCode: 'TH',
      level,
      ...(parentId ? { parentId } : {}),
      OR: [
        { nameTh: { equals: name, mode: 'insensitive' } },
        { nameEn: { equals: name, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
}

/**
 * Resolves one Location row's free-text province/district/subDistrict into
 * the DEEPEST matching AdminArea id (subDistrict ?? district ?? province ??
 * null) — walks PROVINCE -> DISTRICT -> SUBDISTRICT, each scoped to its
 * matched parent; a level with no raw value, or no match, stops the walk
 * (never guesses the next level from an unmatched parent).
 */
export async function resolveLocationAdminAreaId(prisma, { province, district, subDistrict }) {
  if (!province) return null;

  const provinceMatch = await matchAdminAreaByName(prisma, 'PROVINCE', province);
  if (!provinceMatch) return null;

  if (!district) return provinceMatch.id;
  const districtMatch = await matchAdminAreaByName(prisma, 'DISTRICT', district, provinceMatch.id);
  if (!districtMatch) return provinceMatch.id;

  if (!subDistrict) return districtMatch.id;
  const subDistrictMatch = await matchAdminAreaByName(prisma, 'SUBDISTRICT', subDistrict, districtMatch.id);
  if (!subDistrictMatch) return districtMatch.id;

  return subDistrictMatch.id;
}

/**
 * Runs the backfill against an injected Prisma-like client (real
 * PrismaClient in production use; a fake in tests) and returns the
 * before/after report. Only rows with `adminAreaId: null` are candidates
 * (idempotent — never overwrites an already-resolved row); a row whose
 * `province` does not resolve is left null and pushed onto `unresolved`
 * (never silent).
 */
export async function runBackfill(prisma, { log = console.log } = {}) {
  const beforeResolved = await prisma.location.count({ where: { adminAreaId: { not: null } } });
  const total = await prisma.location.count();
  log(`before: adminAreaId set on ${beforeResolved} of ${total} Location rows`);

  const candidates = await prisma.location.findMany({
    where: { adminAreaId: null, province: { not: null } },
    select: { id: true, province: true, district: true, subDistrict: true, campSites: { select: { id: true }, take: 1 } },
  });

  let updated = 0;
  const unresolved = [];
  for (const row of candidates) {
    const adminAreaId = await resolveLocationAdminAreaId(prisma, {
      province: row.province,
      district: row.district,
      subDistrict: row.subDistrict,
    });
    if (adminAreaId) {
      await prisma.location.update({ where: { id: row.id }, data: { adminAreaId } });
      updated += 1;
    } else {
      unresolved.push({
        id: row.id,
        province: row.province,
        district: row.district,
        subDistrict: row.subDistrict,
        hasLiveCamp: (row.campSites?.length ?? 0) > 0,
      });
    }
  }

  const afterResolved = await prisma.location.count({ where: { adminAreaId: { not: null } } });
  log(`candidates scanned: ${candidates.length}, rows updated: ${updated}`);
  log(`after: adminAreaId set on ${afterResolved} of ${total} Location rows`);
  if (unresolved.length > 0) {
    log(`unresolved (${unresolved.length}): ${JSON.stringify(unresolved)}`);
  }

  return { beforeResolved, total, candidates: candidates.length, updated, afterResolved, unresolved };
}

export function checkGuard() {
  const allow = process.env.ALLOW_LOCATION_ADMIN_AREA_BACKFILL === '1';
  const url = process.env.DATABASE_URL || '';
  const looksProd =
    /prod/i.test(url) ||
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production';
  if (!allow) {
    return { ok: false, message: '✗ refusing: set ALLOW_LOCATION_ADMIN_AREA_BACKFILL=1 to confirm running this backfill' };
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
// (tests import resolveLocationAdminAreaId / runBackfill / checkGuard directly).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await main();
}
