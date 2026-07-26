#!/usr/bin/env node
/**
 * scripts/backfill-cam-575-reconcile-coordinates.mjs — CAM-575
 *
 * `CampSite.latitude/longitude` and `Location.lat/lon` stored the same fact
 * twice with nothing keeping them equal (architecture.md §15b reader/writer
 * sweep — see this story's tech.md for the full inventory). A live query of
 * all 650 camps with coordinates on the dev DB found exactly 4 where the two
 * columns disagree (matches the ticket's own measurement).
 *
 * OWNER DECISION (2026-07-26): `CampSite.latitude/longitude` is the SOURCE OF
 * TRUTH going forward — enforced from now on by the `campsite_coords_sync`
 * database trigger (prisma/migrations/
 * 20260726165149_cam575_campsite_location_coord_sync_trigger). That trigger
 * only PREVENTS future divergence; it does nothing about the 4 rows that
 * already disagree today (a trigger fires on a write, and nothing writes to
 * these 4 rows on its own). This script is the one-time remediation for
 * those rows — and a reusable instrument if new divergence is ever
 * discovered (e.g. from data synced in from another environment).
 *
 * Reconciliation rule (owner's explicit ask — do not blanket-prefer one
 * column): for each divergent pair, reverse-geocode BOTH candidate points
 * (language=th, same `callGoogleGeocode` CAM-562 already uses) and match
 * the geocoded province against the row's OWN claimed province (via
 * `Location.adminAreaId`, walked up to its PROVINCE ancestor with CAM-571's
 * `getProvinceAncestor` when it sits at DISTRICT/SUBDISTRICT level; falling
 * back to the free-text `province` string only when no `adminAreaId` is
 * set) using the SAME bilingual, hierarchical `matchAdminAreaByName`
 * instrument this codebase already trusts for exactly this kind of
 * decision — never a naive raw-string compare (an early naive check
 * wrongly flagged one of the 4 as ambiguous because Google inconsistently
 * returns "Bangkok" vs "Krung Thep Maha Nakhon" in English; the Thai-
 * language call + the real AdminArea matcher resolves that correctly since
 * the AdminArea tree only stores the Thai name plus the single English
 * alias "Bangkok").
 *
 *   - CampSite's point verifies (lands in the claimed province)  -> KEEP
 *     CampSite's value (canonical wins; no numeric change — this is a
 *     "touch" write so the sync trigger forces Location back into
 *     agreement).
 *   - CampSite's point does NOT verify, but Location's DOES        -> the
 *     camp diverged in the OTHER direction; CORRECT CampSite to
 *     Location's verified value (the trigger then keeps Location itself
 *     unchanged, since it already held the correct value).
 *   - NEITHER point verifies                                       -> report
 *     as `unresolved`; never guess, never write.
 *
 * Every write in this script goes through `CampSite` ONLY — Location.lat/lon
 * is never written directly here; the sync trigger derives it. This is the
 * concrete demonstration of CAM-575 item 2 ("every writer writes CampSite;
 * Location is derived").
 *
 * Idempotent by construction: after a real run, every previously-divergent
 * pair now agrees (either because the touch-write forced the trigger to
 * re-sync Location, or because CampSite was corrected and the trigger
 * confirms Location already matched) — `findDivergentPairs` finds 0 rows on
 * a second run, so `planReconciliation` performs 0 writes.
 *
 * SAFETY GUARD — refuses unless ALL of:
 *   ALLOW_CAMPSITE_LOCATION_COORD_RECONCILE=1  (explicit opt-in — billed
 *                                                Google Geocoding calls)
 *   DATABASE_URL is set
 *   GOOGLE_GEOCODING_API_KEY is set (server-only; never NEXT_PUBLIC_)
 *   target does NOT look like production; logs only scheme+hostname via
 *   describeUrlShape, never path/query/credentials (CAM-359/CAM-369)
 *
 * Usage:
 *   ALLOW_CAMPSITE_LOCATION_COORD_RECONCILE=1 DRY_RUN=1 \
 *     DATABASE_URL=<non-prod> GOOGLE_GEOCODING_API_KEY=<key> \
 *     node scripts/backfill-cam-575-reconcile-coordinates.mjs
 *
 *   ALLOW_CAMPSITE_LOCATION_COORD_RECONCILE=1 \
 *     DATABASE_URL=<non-prod> GOOGLE_GEOCODING_API_KEY=<key> \
 *     node scripts/backfill-cam-575-reconcile-coordinates.mjs
 *
 * NEVER run against production DB.
 */
import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';
import { describeUrlShape } from './db-reset.mjs';
import { callGoogleGeocode, extractComponent } from './backfill-cam-562-subdistrict-geocode.mjs';
import { matchAdminAreaByName } from './backfill-cam-563-location-admin-area.mjs';
import { getProvinceAncestor } from './backfill-cam-571-coordinates-inside-thailand.mjs';

/**
 * Finds every CampSite/Location pair where the two coordinate columns
 * disagree. Only pairs with BOTH points present are considered (a null
 * Location.lat/lon can never "agree" or "disagree" meaningfully).
 */
export async function findDivergentPairs(prisma) {
  const camps = await prisma.campSite.findMany({
    where: { location: { lat: { not: null }, lon: { not: null } } },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      location: {
        select: {
          id: true,
          lat: true,
          lon: true,
          province: true,
          adminAreaId: true,
          adminArea: { select: { id: true, level: true, code: true, nameTh: true, nameEn: true, parentId: true } },
        },
      },
    },
  });

  return camps
    .filter((c) => c.latitude !== c.location.lat || c.longitude !== c.location.lon)
    .map((c) => ({
      campId: c.id,
      locationId: c.location.id,
      campSite: { lat: c.latitude, lon: c.longitude },
      location: { lat: c.location.lat, lon: c.location.lon },
      province: c.location.province,
      adminArea: c.location.adminArea,
    }));
}

/** Resolves a candidate's claimed PROVINCE AdminArea node — from `adminAreaId` (walked up if it sits below PROVINCE) when set, else the free-text `province` string. */
export async function resolveClaimedProvince(prisma, candidate) {
  if (candidate.adminArea) {
    return candidate.adminArea.level === 'PROVINCE' ? candidate.adminArea : await getProvinceAncestor(prisma, candidate.adminArea);
  }
  if (candidate.province) return matchAdminAreaByName(prisma, 'PROVINCE', candidate.province);
  return null;
}

/** Reverse-geocodes one point (Thai, CAM-562's own instrument) and checks whether its province matches the claimed AdminArea node — bilingual/hierarchical match, never a raw string compare. */
export async function pointVerifiesProvince(prisma, point, claimedNode) {
  if (!claimedNode) return false;
  const geo = await callGoogleGeocode(point.lat, point.lon);
  if (!geo.ok || geo.zeroResults) return false;
  const provinceRaw = extractComponent(geo.components, ['administrative_area_level_1']);
  const matched = await matchAdminAreaByName(prisma, 'PROVINCE', provinceRaw);
  return !!matched && matched.id === claimedNode.id;
}

/**
 * Decides ONE candidate's correct value. Never blanket-prefers a column —
 * CampSite wins only when it verifies; a camp that diverged the OTHER way
 * (its CampSite point actually landed outside the claimed province while
 * Location's point still verifies) is corrected FROM Location.
 */
export async function reconcileCandidate(prisma, candidate) {
  const claimedNode = await resolveClaimedProvince(prisma, candidate);

  const campSiteVerifies = await pointVerifiesProvince(prisma, candidate.campSite, claimedNode);
  if (campSiteVerifies) {
    return { outcome: 'kept_campsite', write: { latitude: candidate.campSite.lat, longitude: candidate.campSite.lon } };
  }

  const locationVerifies = await pointVerifiesProvince(prisma, candidate.location, claimedNode);
  if (locationVerifies) {
    return { outcome: 'corrected_from_location', write: { latitude: candidate.location.lat, longitude: candidate.location.lon } };
  }

  return { outcome: 'unresolved', write: null };
}

/**
 * Runs the full reconciliation against an injected Prisma-like client.
 * `dryRun: true` computes and reports every decision but writes nothing.
 * Every write goes through `prisma.campSite.update` ONLY — Location.lat/lon
 * is never written directly; the `campsite_coords_sync` DB trigger derives
 * it inside the same transaction as the CampSite write.
 */
export async function planReconciliation(prisma, { dryRun = false, log = () => {} } = {}) {
  const candidates = await findDivergentPairs(prisma);
  const summary = {
    candidatesFound: candidates.length,
    keptCampSite: [],
    correctedFromLocation: [],
    unresolved: [],
  };

  for (const candidate of candidates) {
    const result = await reconcileCandidate(prisma, candidate);

    if (result.outcome === 'unresolved') {
      summary.unresolved.push({ campId: candidate.campId, locationId: candidate.locationId, province: candidate.province });
      continue;
    }

    if (!dryRun) {
      await prisma.campSite.update({ where: { id: candidate.campId }, data: result.write });
    }

    const record = {
      campId: candidate.campId,
      locationId: candidate.locationId,
      province: candidate.province,
      latitude: result.write.latitude,
      longitude: result.write.longitude,
    };
    if (result.outcome === 'kept_campsite') summary.keptCampSite.push(record);
    else summary.correctedFromLocation.push(record);
  }

  log(`divergent pairs found: ${summary.candidatesFound}`);
  log(`kept CampSite's value (verified against claimed province, canonical wins): ${summary.keptCampSite.length}`);
  log(`corrected FROM Location's value (CampSite's point failed to verify; Location's did): ${summary.correctedFromLocation.length}`);
  log(`unresolved (neither point verifies the claimed province — reported, never guessed): ${summary.unresolved.length}`);

  return summary;
}

export function checkGuard() {
  const allow = process.env.ALLOW_CAMPSITE_LOCATION_COORD_RECONCILE === '1';
  const url = process.env.DATABASE_URL || '';
  const looksProd =
    /prod/i.test(url) ||
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production';
  const hasKey = !!process.env.GOOGLE_GEOCODING_API_KEY;
  if (!allow) {
    return { ok: false, message: '✗ refusing: set ALLOW_CAMPSITE_LOCATION_COORD_RECONCILE=1 to confirm running this backfill (billed Google Geocoding calls)' };
  }
  if (!url) {
    return { ok: false, message: '✗ refusing: DATABASE_URL is not set' };
  }
  if (looksProd) {
    return { ok: false, message: '✗ refusing: target looks like PRODUCTION — backfill blocked for safety' };
  }
  if (!hasKey) {
    return { ok: false, message: '✗ refusing: GOOGLE_GEOCODING_API_KEY is not set (server-only; the geocoding calls need it)' };
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
  console.log(dryRun ? 'MODE: DRY RUN — reporting only, no writes' : 'MODE: REAL RUN — writing verified reconciliation');

  const prisma = new PrismaClient();
  try {
    const before = await prisma.campSite.count({ where: { location: { province: 'Chiang Mai' } } });
    console.log(`Chiang Mai province-filter count BEFORE: ${before}`);

    const summary = await planReconciliation(prisma, { dryRun, log: console.log });
    console.log(`kept (CampSite verified): ${JSON.stringify(summary.keptCampSite, null, 2)}`);
    console.log(`corrected (from Location): ${JSON.stringify(summary.correctedFromLocation, null, 2)}`);
    if (summary.unresolved.length > 0) {
      console.log(`✗ UNRESOLVED (needs human review, never guessed): ${JSON.stringify(summary.unresolved, null, 2)}`);
    }

    const after = await prisma.campSite.count({ where: { location: { province: 'Chiang Mai' } } });
    console.log(`Chiang Mai province-filter count AFTER: ${after}`);
    if (after !== before) {
      console.error(`✗ REGRESSION: Chiang Mai count changed from ${before} to ${after}`);
      process.exitCode = 1;
    }

    console.log('✓ reconciliation complete');
  } catch (err) {
    console.error('✗ reconciliation failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

// Only auto-run when executed directly — not when imported for its exports
// (tests import the named functions directly).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await main();
}
