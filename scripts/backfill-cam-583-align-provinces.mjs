#!/usr/bin/env node
/**
 * scripts/backfill-cam-583-align-provinces.mjs — CAM-583
 *
 * The owner's second data-correction ask (2026-07-27): 103 camps on staging
 * (83 on dev) geocode to a province ADJACENT to the one stored against them.
 * Direction: move the COORDINATE to the stored province — never rewrite the
 * province. `Location.province` is the load-bearing value (`lib/campsite-
 * filters.ts`'s exact-equality filter, the province dropdown, CAM-545's Thai
 * card text) and 659 of 795 camps carry their claimed province inside their
 * own Thai name — rewriting the province to follow the coordinate would
 * leave the name and the location contradicting each other on screen for
 * most of them. This is also the SAME direction CAM-571 used for the 18
 * outside-Thailand camps, so both corrections stay consistent.
 *
 * These 83/103 rows are exactly CAM-562's own `provinceMismatch` classification
 * (`scripts/backfill-cam-562-subdistrict-geocode.mjs::runBackfill`) — a row
 * whose geocoded province disagrees with its stored province-level AdminArea
 * node, which CAM-562 already refuses to write (BR-2/BR-3 there) and CAM-571
 * only REPORTED (never wrote — that story's own BR-8: "the owner's
 * instruction covers coordinates outside Thailand, not an adjacent-province
 * disagreement"). This story is that follow-up: the SAME 83/103 rows, now
 * WRITTEN — moved to a real forward-geocoded point inside the row's claimed
 * province, verified by reverse-geocoding the new point back before writing
 * anything.
 *
 * Reuse, not a fork: `identifyProvinceMismatches` scans CAM-562's FROZEN
 * geocode cache ONLY and classifies each entry with CAM-562's own per-row
 * `resolveCandidate` (imported directly — zero new classification logic,
 * zero new Google calls, since `resolveCandidate` classifies purely from an
 * already-fetched geocode result). This is a PURE cache scan, never a live
 * candidate re-query — the same host-entered-data safety shape as CAM-571's
 * `identifyOutsideThailand` (see "Host-entered-data safety" below; an earlier
 * version of this function called CAM-562's own `runBackfill` live, whose
 * candidate query re-scans the CURRENT database on every call — that would
 * classify, and this script would then move, a real host's freshly created
 * camp if it happened to sit in an adjacent province at write time. Fixed
 * before ship). The move/verify/write orchestration below reuses CAM-571's
 * own exported primitives directly: `callGoogleGeocodeForward` +
 * `buildForwardAddress` (forward-geocode the claimed province into a point)
 * and `verifyAndResolvePlacement` + `getProvinceAncestor` (reverse-geocode
 * the new point back, refuse unless it lands in the SAME claimed-province
 * node, and re-derive district/subDistrict from that same call, all
 * unchanged). CAM-571's own `planMoves` is NOT imported/forked — its
 * candidate identification and its "already-fixed" skip condition are both
 * hardwired to the country check (`shortName !== 'TH'`), which is the wrong
 * test for a same-country, different-province candidate; only the
 * primitives that ARE identical across both scripts are reused, and CAM-571's
 * already-shipped, already-tested `planMoves` is left untouched (no
 * regression risk to its own 36 tests from bending it to a second shape).
 *
 * Identification cost: CAM-562's own frozen cache
 * (`os.tmpdir()/cam-562-geocode-cache.json`, dev's real artifact) is reused
 * as-is for a dev target — the ticket's own instruction ("do not spend fresh
 * API calls where a cached answer exists"), and identification itself now
 * costs ZERO Google calls on every target, always (a pure cache scan).
 * Staging has never been scanned by CAM-562 at all, so a ONE-TIME snapshot
 * must first be built for it — CAM-562's own `runBackfill` dry-run is run
 * ONCE, standalone (not by this script), against staging with a fresh cache
 * object, and that snapshot is saved to a SEPARATE file (never mutating
 * CAM-562's own dev artifact) via `CAM_562_CACHE_FILE` (env override,
 * defaults to CAM-562's canonical dev path). From that point on, staging's
 * snapshot is just as "frozen" as dev's, and this script's own identification
 * reads it exactly the same way — zero new Google calls, same host-safety
 * guarantee.
 *
 * Host-entered-data safety (owner's explicit ask — the SAME structural rule
 * CAM-571 uses, BR-2): the candidate set is restricted to `Location.id`s
 * already present as KEYS in the frozen cache — a row created or edited by a
 * real host AFTER that snapshot was taken has no entry in it at all, so it
 * can never become a candidate, regardless of its current coordinates or
 * district/subDistrict state. Before moving ANY candidate, this script
 * ALSO freshly (not cache-) re-checks its CURRENT coordinates and moves it
 * only if that fresh check still shows a province OTHER than the one
 * claimed — a row already corrected (by a host, by a prior run of this very
 * script, or by anything else) now reverse-geocodes to its claimed province
 * and is skipped (`already_matches_claimed_province`), which is also what
 * makes a second run idempotent (0 rows changed).
 *
 * SAFETY GUARD — refuses unless ALL of:
 *   ALLOW_ALIGN_PROVINCES_BACKFILL=1  (explicit opt-in — billed Google calls,
 *                                      even in DRY_RUN)
 *   DATABASE_URL is set
 *   GOOGLE_GEOCODING_API_KEY is set (server-only; never NEXT_PUBLIC_)
 *   target does NOT look like production; logs only scheme+hostname via
 *   describeUrlShape, never path/query/credentials (CAM-359/CAM-369)
 *
 * Usage (run once per target — dev, then staging with its own DATABASE_URL):
 *   # 1. Dry run first — reports the projection, writes NOTHING:
 *   ALLOW_ALIGN_PROVINCES_BACKFILL=1 DRY_RUN=1 \
 *     DATABASE_URL=<non-prod> GOOGLE_GEOCODING_API_KEY=<key> \
 *     node scripts/backfill-cam-583-align-provinces.mjs
 *
 *   # 2. Real run — writes the verified moves (reuses the dry run's cache):
 *   ALLOW_ALIGN_PROVINCES_BACKFILL=1 \
 *     DATABASE_URL=<non-prod> GOOGLE_GEOCODING_API_KEY=<key> \
 *     node scripts/backfill-cam-583-align-provinces.mjs
 *
 *   # Staging: this target has never been scanned by CAM-562, so a frozen
 *   # snapshot must exist FIRST (this script refuses rather than silently
 *   # falling back to a live re-scan — host-entered-data safety). Build it
 *   # ONCE via CAM-562's own dry-run against staging, saved to a SEPARATE
 *   # file (never mutating CAM-562's own dev artifact):
 *     ALLOW_SUBDISTRICT_GEOCODE_BACKFILL=1 DRY_RUN=1 DATABASE_URL=<staging> \
 *       GOOGLE_GEOCODING_API_KEY=<key> node -e "
 *         const { runBackfill } = await import('./scripts/backfill-cam-562-subdistrict-geocode.mjs');
 *         const { PrismaClient } = await import('@prisma/client');
 *         const cache = {}; const prisma = new PrismaClient();
 *         await runBackfill(prisma, { dryRun: true, cache });
 *         require('fs').writeFileSync('/tmp/cam-562-geocode-cache-staging.json', JSON.stringify(cache));
 *       "
 *   # Then run THIS script against staging, pointed at that snapshot:
 *   CAM_562_CACHE_FILE=/tmp/cam-562-geocode-cache-staging.json \
 *     ALLOW_ALIGN_PROVINCES_BACKFILL=1 DATABASE_URL=<staging> \
 *     GOOGLE_GEOCODING_API_KEY=<key> node scripts/backfill-cam-583-align-provinces.mjs
 *
 * NEVER run against production DB.
 */
import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describeUrlShape } from './db-reset.mjs';
import { matchAdminAreaByName } from './backfill-cam-563-location-admin-area.mjs';
import {
  callGoogleGeocode as callGoogleGeocodeReverse,
  extractComponent,
  resolveCandidate as resolveCam562Candidate,
} from './backfill-cam-562-subdistrict-geocode.mjs';
import {
  callGoogleGeocodeForward,
  buildForwardAddress,
  getProvinceAncestor,
  verifyAndResolvePlacement,
} from './backfill-cam-571-coordinates-inside-thailand.mjs';

const DEFAULT_CAM562_CACHE_FILE = path.join(os.tmpdir(), 'cam-562-geocode-cache.json');
const REVERSE_CHECK_CACHE_FILE = path.join(os.tmpdir(), 'cam-583-align-provinces-reverse-check-cache.json');
const FORWARD_CACHE_FILE = path.join(os.tmpdir(), 'cam-583-align-provinces-forward-cache.json');
const REVERSE_VERIFY_CACHE_FILE = path.join(os.tmpdir(), 'cam-583-align-provinces-reverse-verify-cache.json');

/**
 * Scans CAM-562's FROZEN geocode cache ONLY (never a live candidate query)
 * and returns every `Location.id` whose cached, successful reverse-geocode
 * result classifies as `province_mismatch` — reusing CAM-562's own per-row
 * `resolveCandidate` (dry-run-shaped: it makes zero Google calls itself, it
 * only classifies an already-fetched geocode result) for the classification
 * logic, zero duplication.
 *
 * Host-entered-data safety (BR-2, the SAME structural rule CAM-571 uses):
 * the candidate set is restricted to `Location.id`s already present as KEYS
 * in `cam562Cache` — a row created or edited by a real host AFTER that
 * snapshot was taken has no entry in it at all, so it can never become a
 * candidate here, regardless of its current district/subDistrict state.
 * (An earlier version of this function called CAM-562's own `runBackfill`
 * live, whose candidate query re-scans the CURRENT database — that would
 * classify, and this script would then move, a real host's freshly created
 * camp if it happened to sit in an adjacent province. Fixed before ship.)
 *
 * Zero new Google calls: `resolveCandidate` classifies purely from the
 * ALREADY-CACHED geocode result; only a local Prisma read (never billed) is
 * needed per candidate id to fetch its current province-level anchor.
 */
export async function identifyProvinceMismatches(prisma, cam562Cache) {
  const candidates = [];
  const ids = Object.keys(cam562Cache ?? {});
  for (const id of ids) {
    const row = await prisma.location.findUnique({
      where: { id },
      select: {
        id: true,
        province: true,
        district: true,
        subDistrict: true,
        adminAreaId: true,
        adminArea: { select: { id: true, level: true, code: true, nameTh: true, nameEn: true, parentId: true } },
      },
    });
    if (!row) continue; // deleted since the snapshot — never a candidate
    const result = await resolveCam562Candidate(prisma, row, cam562Cache[id]);
    if (result.outcome === 'province_mismatch') candidates.push(result);
  }
  return { candidates, identificationCallsMade: 0, identificationCallsCached: ids.length };
}

/**
 * Runs the full move plan against an injected Prisma-like client. Mirrors
 * CAM-571's `planMoves` shape (fresh re-check -> forward-geocode -> reverse-
 * verify -> write Location+CampSite together) but candidates come from
 * CAM-562's province-mismatch classification, and the "already fixed" skip
 * condition is a province match, not a country check. `dryRun: true`
 * computes and reports every write but issues ZERO `$transaction`/`update`
 * calls.
 */
export async function planProvinceAlignmentMoves(
  prisma,
  {
    cam562Cache = {},
    dryRun = false,
    log = () => {},
    reverseCheckCache = {},
    forwardCache = {},
    reverseVerifyCache = {},
    onReverseCheckCacheUpdate = () => {},
    onForwardCacheUpdate = () => {},
    onReverseVerifyCacheUpdate = () => {},
  } = {}
) {
  const identification = await identifyProvinceMismatches(prisma, cam562Cache);
  const candidates = identification.candidates;

  const summary = {
    candidatesFromClassification: candidates.length,
    identificationCallsMade: identification.identificationCallsMade,
    identificationCallsCached: identification.identificationCallsCached,
    candidates,
    alreadyMatchesClaimedProvince: [],
    moved: [],
    forwardGeocodeFailed: [],
    placementUnverified: [],
    rowNotFound: [],
    reverseCheckCallsMade: 0,
    reverseCheckCallsCached: 0,
    forwardCallsMade: 0,
    forwardCallsCached: 0,
    reverseVerifyCallsMade: 0,
    reverseVerifyCallsCached: 0,
  };

  for (const candidate of candidates) {
    const row = await prisma.location.findUnique({
      where: { id: candidate.id },
      select: {
        id: true,
        province: true,
        district: true,
        subDistrict: true,
        lat: true,
        lon: true,
        adminAreaId: true,
        adminArea: { select: { id: true, level: true, code: true, nameTh: true, nameEn: true, parentId: true } },
        campSites: { select: { id: true } },
      },
    });
    if (!row) {
      summary.rowNotFound.push(candidate.id);
      continue;
    }

    const provinceAnchor = row.adminArea?.level === 'PROVINCE' ? row.adminArea : await getProvinceAncestor(prisma, row.adminArea);
    if (!provinceAnchor) {
      summary.placementUnverified.push({ id: row.id, province: row.province, reason: 'no_province_anchor_on_row' });
      continue;
    }

    // Fresh, live re-check of the row's CURRENT coordinates (never the
    // classification cache) — idempotency guard + host-edit safety net,
    // same discipline as CAM-571's own fresh re-check. Keyed by
    // id+coordinate: once a row is moved its lat/lon change, so a stale
    // cache entry keyed by id alone would keep reporting the OLD (mismatched)
    // province forever.
    const reverseCheckKey = `${row.id}:${row.lat},${row.lon}`;
    let reverseCheck = reverseCheckCache[reverseCheckKey];
    if (reverseCheck) {
      summary.reverseCheckCallsCached += 1;
    } else {
      reverseCheck = await callGoogleGeocodeReverse(row.lat, row.lon);
      reverseCheckCache[reverseCheckKey] = reverseCheck;
      summary.reverseCheckCallsMade += 1;
      onReverseCheckCacheUpdate?.();
    }

    if (reverseCheck.ok && !reverseCheck.zeroResults) {
      const provinceRaw = extractComponent(reverseCheck.components, ['administrative_area_level_1']);
      const currentProvinceMatch = provinceRaw ? await matchAdminAreaByName(prisma, 'PROVINCE', provinceRaw) : null;
      if (currentProvinceMatch && currentProvinceMatch.id === provinceAnchor.id) {
        summary.alreadyMatchesClaimedProvince.push({ id: row.id, oldLat: row.lat, oldLon: row.lon });
        continue;
      }
    }

    const address = buildForwardAddress(row);
    let forward = forwardCache[address];
    if (forward) {
      summary.forwardCallsCached += 1;
    } else {
      forward = await callGoogleGeocodeForward(address);
      forwardCache[address] = forward;
      summary.forwardCallsMade += 1;
      onForwardCacheUpdate?.();
    }
    if (!forward.ok || forward.zeroResults) {
      summary.forwardGeocodeFailed.push({ id: row.id, province: row.province, reason: forward.reason ?? 'zero_results' });
      continue;
    }

    const verifyKey = `${forward.lat},${forward.lon}`;
    let reverseVerify = reverseVerifyCache[verifyKey];
    if (reverseVerify) {
      summary.reverseVerifyCallsCached += 1;
    } else {
      reverseVerify = await callGoogleGeocodeReverse(forward.lat, forward.lon);
      reverseVerifyCache[verifyKey] = reverseVerify;
      summary.reverseVerifyCallsMade += 1;
      onReverseVerifyCacheUpdate?.();
    }
    if (!reverseVerify.ok || reverseVerify.zeroResults) {
      summary.placementUnverified.push({ id: row.id, province: row.province, reason: 'reverse_verify_failed' });
      continue;
    }

    const resolved = await verifyAndResolvePlacement(prisma, row, reverseVerify.components);
    if (resolved.outcome !== 'verified') {
      summary.placementUnverified.push({ id: row.id, province: row.province, reason: resolved.reason });
      continue;
    }

    const moveRecord = {
      id: row.id,
      province: row.province,
      oldGeocodedProvince: candidate.geocodedProvinceNode?.nameEn ?? null,
      oldLat: row.lat,
      oldLon: row.lon,
      newLat: forward.lat,
      newLon: forward.lon,
      district: resolved.write.district,
      subDistrict: resolved.write.subDistrict,
      campSiteIds: row.campSites.map((c) => c.id),
    };

    if (!dryRun) {
      // CampSite.latitude/longitude is the canonical column (CAM-575) — write
      // it first; the location.update carries district/subDistrict/adminAreaId
      // (Location-only fields) in the SAME transaction, same order CAM-571
      // established for its own moves.
      await prisma.$transaction([
        ...row.campSites.map((c) =>
          prisma.campSite.update({ where: { id: c.id }, data: { latitude: forward.lat, longitude: forward.lon } })
        ),
        prisma.location.update({
          where: { id: row.id },
          data: { lat: forward.lat, lon: forward.lon, ...resolved.write },
        }),
      ]);
    }
    summary.moved.push(moveRecord);
  }

  log(`candidates from CAM-562 province-mismatch classification: ${summary.candidatesFromClassification}`);
  log(`identification calls — made: ${summary.identificationCallsMade}, cached: ${summary.identificationCallsCached}`);
  log(`already matches claimed province on fresh re-check (skipped, idempotent/host-safe): ${summary.alreadyMatchesClaimedProvince.length}`);
  log(`${dryRun ? 'would move' : 'moved'}: ${summary.moved.length}`);
  log(`forward-geocode failed: ${summary.forwardGeocodeFailed.length}, placement unverified: ${summary.placementUnverified.length}`);
  log(
    `Google calls — reverse-check: ${summary.reverseCheckCallsMade} made/${summary.reverseCheckCallsCached} cached, ` +
      `forward: ${summary.forwardCallsMade} made/${summary.forwardCallsCached} cached, ` +
      `reverse-verify: ${summary.reverseVerifyCallsMade} made/${summary.reverseVerifyCallsCached} cached`
  );

  return summary;
}

export function checkGuard() {
  const allow = process.env.ALLOW_ALIGN_PROVINCES_BACKFILL === '1';
  const url = process.env.DATABASE_URL || '';
  const looksProd = /prod/i.test(url) || process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  const hasKey = !!process.env.GOOGLE_GEOCODING_API_KEY;
  if (!allow) {
    return { ok: false, message: '✗ refusing: set ALLOW_ALIGN_PROVINCES_BACKFILL=1 to confirm running this backfill (billed Google Geocoding calls, even in DRY_RUN)' };
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

function loadCache(cachePath) {
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return null;
  }
}

function saveCache(cachePath, cache) {
  fs.writeFileSync(cachePath, JSON.stringify(cache), 'utf8');
}

export async function main() {
  const guard = checkGuard();
  if (!guard.ok) {
    console.error(guard.message);
    process.exit(1);
  }
  console.log(`target: ${describeUrlShape(guard.url)}`);

  const dryRun = process.env.DRY_RUN === '1';
  console.log(dryRun ? 'MODE: DRY RUN — reporting only, no writes' : 'MODE: REAL RUN — writing verified moves');

  const cam562CacheFile = process.env.CAM_562_CACHE_FILE || DEFAULT_CAM562_CACHE_FILE;
  const cam562Cache = loadCache(cam562CacheFile);
  if (!cam562Cache) {
    console.error(
      `✗ refusing: no frozen identification cache found at ${cam562CacheFile} — this target has never been scanned by CAM-562. ` +
        `Build the snapshot first (CAM-562's own dry-run against this DATABASE_URL, saved to this path via CAM_562_CACHE_FILE), ` +
        `then re-run this script. This script must not fall back to a live re-scan (host-entered-data safety).`
    );
    process.exit(1);
  }
  const reverseCheckCache = loadCache(REVERSE_CHECK_CACHE_FILE) ?? {};
  const forwardCache = loadCache(FORWARD_CACHE_FILE) ?? {};
  const reverseVerifyCache = loadCache(REVERSE_VERIFY_CACHE_FILE) ?? {};

  const prisma = new PrismaClient();
  try {
    const before = await prisma.campSite.count({ where: { location: { province: 'Chiang Mai' } } });
    console.log(`Chiang Mai province-filter count BEFORE: ${before}`);

    const moves = await planProvinceAlignmentMoves(prisma, {
      cam562Cache,
      dryRun,
      log: console.log,
      reverseCheckCache,
      forwardCache,
      reverseVerifyCache,
      onReverseCheckCacheUpdate: () => saveCache(REVERSE_CHECK_CACHE_FILE, reverseCheckCache),
      onForwardCacheUpdate: () => saveCache(FORWARD_CACHE_FILE, forwardCache),
      onReverseVerifyCacheUpdate: () => saveCache(REVERSE_VERIFY_CACHE_FILE, reverseVerifyCache),
    });
    saveCache(cam562CacheFile, cam562Cache);
    saveCache(REVERSE_CHECK_CACHE_FILE, reverseCheckCache);
    saveCache(FORWARD_CACHE_FILE, forwardCache);
    saveCache(REVERSE_VERIFY_CACHE_FILE, reverseVerifyCache);

    console.log(`moved (${moves.moved.length}): ${JSON.stringify(moves.moved, null, 2)}`);
    if (moves.forwardGeocodeFailed.length > 0) console.log(`forward-geocode failed: ${JSON.stringify(moves.forwardGeocodeFailed)}`);
    if (moves.placementUnverified.length > 0) console.log(`placement unverified: ${JSON.stringify(moves.placementUnverified)}`);

    const after = await prisma.campSite.count({ where: { location: { province: 'Chiang Mai' } } });
    console.log(`Chiang Mai province-filter count AFTER: ${after}`);
    if (after !== before) {
      console.error(`✗ REGRESSION: Chiang Mai count changed from ${before} to ${after}`);
      process.exitCode = 1;
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
// (tests import the named functions directly).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await main();
}
