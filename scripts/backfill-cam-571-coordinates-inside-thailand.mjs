#!/usr/bin/env node
/**
 * scripts/backfill-cam-571-coordinates-inside-thailand.mjs — CAM-571
 *
 * CAM-562's reverse-geocode run measured every `Location.id -> geocode
 * result` pair (Google's raw `address_components`) to a disk cache
 * (`os.tmpdir()/cam-562-geocode-cache.json`) — including a `country`
 * component on every OK response. This story re-reads that FROZEN cache
 * (zero new Google calls to re-identify) and extracts the geocoded
 * COUNTRY, not a bounding box (owner's own correction, recorded in the
 * ticket: a rectangle around Thailand also covers slivers of Laos, Myanmar,
 * Malaysia and Cambodia — a point can pass the box check and still not be
 * in Thailand). That scan finds **18** `Location` rows whose coordinates
 * geocode outside Thailand (Laos x13, Myanmar x3, Malaysia x2) — not the
 * ~16 the ticket's own comment estimated; this script counts them, it does
 * not assume the number (`identifyOutsideThailand`).
 *
 * For each of the 18, the STORED `province` is treated as the trustworthy
 * intent (it is what the host/seed claimed, and CAM-563 already resolved it
 * against the real `AdminArea` tree) — the coordinate is what turned out
 * wrong. CAM-554's forward-geocode algorithm (`address -> lat/lon`, the
 * SAME Google Geocoding API/key/billing model as its reverse mode) turns
 * `"<district>, <province>, Thailand"` into a real point — never an
 * invented number, never a locally-precomputed centroid file (this repo
 * has one, `prisma/data/province-centroids.json`, but it is itself derived
 * from the CURRENT, partly-wrong seed coordinates — CAM-502's own doc
 * comment says so — so it is not an authoritative source for THIS fix; it
 * is reused here only as a cheap, no-extra-call reference for the
 * report-only 83-case distance estimate below, never for a write).
 *
 * Every new point is immediately reverse-geocoded again to CONFIRM it
 * lands back in the row's claimed province before anything is written — a
 * placement this script cannot verify is refused, never written as a
 * guess (`verifyAndResolvePlacement`). The SAME reverse-geocode-of-the-new-
 * point result also re-derives `district`/`subDistrict` (CAM-562's own
 * language rule, BR-4: write in whichever language the row's `province` is
 * already in) — so moving a camp also re-runs its own share of CAM-562's
 * sub-district backfill, for free, from the same call.
 *
 * CampSite/Location coordinate duplication (found during this story's own
 * reader/writer sweep, architecture.md §15b): `CampSite.latitude/longitude`
 * is a SEPARATE column from `Location.lat/lon`. At the time this story ran,
 * both were byte-identical for all 650 real camps only because every writer
 * that ever set one also set the other by convention — nothing enforced it.
 * CAM-575 later measured that convention had already silently broken for 4
 * camps and made `CampSite.latitude/longitude` the SOURCE OF TRUTH by a
 * database trigger (`campsite_coords_sync`, prisma/migrations/
 * 20260726165149_cam575_...): any write to CampSite's coordinates derives
 * Location.lat/lon automatically, inside the same transaction. This
 * script's own write order below is CampSite-first, Location-second,
 * matching that rule (CAM-575 item 4) — moving ONLY `Location.lat/lon`
 * would still leave the camper-visible pin exactly where it was
 * (`components/CampgroundDetailClient.tsx`'s "Get directions" link + map
 * pin, `lib/ai/tools/get-camp-detail.ts` / `lib/ai/tools/compare-camps.ts`'s
 * `distanceFromBangkokKm`, `app/wishlist/page.tsx`), which is exactly the
 * near-miss this story's own header once warned about.
 *
 * Host-entered-data safety (owner's explicit ask — a rule safe for seed
 * data is not automatically safe for entered data): there is no schema
 * column marking a row "seed" vs "host-entered" (a schema change is out of
 * this story's file surface), so the mechanism is structural, not a flag
 * lookup:
 *   1. The candidate set is ONLY the `Location.id`s already present as keys
 *      in CAM-562's FROZEN cache file. That cache is a closed, point-in-
 *      time snapshot — a camp a real host creates (or edits the pin on)
 *      AFTER that snapshot was written has no entry in it at all, so it can
 *      never become a candidate here, structurally, regardless of what its
 *      coordinates currently are.
 *   2. Before touching ANY candidate, this script re-reverse-geocodes its
 *      CURRENT (not cached) lat/lon with a fresh, live Google call (only
 *      ~18 calls, not a fresh 650) and moves it ONLY if that fresh check
 *      still shows a non-Thailand country right now. If a row was already
 *      corrected (by a host, by a prior run of this very script, by
 *      anything) since CAM-562's snapshot, the fresh check sees Thailand
 *      and the row is left untouched (`already_inside_thailand`) — this is
 *      also what makes a second run idempotent (0 rows changed).
 *   3. The guard below refuses outside a non-production target, same as
 *      CAM-562/563 — this is a manually-invoked, explicitly opted-in
 *      script, never something a live host action can trigger.
 *
 * The 83 "adjacent province" mismatches CAM-562 already found (its own
 * `provinceMismatch` report, reused here via `runBackfill` import) are
 * INSIDE Thailand, so the owner's instruction does not cover them — this
 * script only REPORTS them (with a haversine distance from each row's
 * current point to its claimed province's centroid, via the existing
 * `prisma/data/province-centroids.json`) and recommends whether any need
 * the same treatment; it never rewrites them (`reportProvinceMismatchDistances`).
 *
 * Cost — billed by Google, treated as real: at most ~18 fresh reverse-check
 * calls + ~18 forward calls + ~18 reverse-verify calls per invocation
 * (≤ 54), each cached to disk (`os.tmpdir()`, keyed by `Location.id` or by
 * query, same crash-safety pattern as CAM-562) so the real run immediately
 * following a dry run reuses the dry run's calls instead of re-billing
 * them. Identification itself (CAM-562's cache re-read) costs 0 new calls.
 *
 * SAFETY GUARD — refuses unless ALL of:
 *   ALLOW_COORDINATES_INSIDE_THAILAND_BACKFILL=1  (explicit opt-in — billed
 *                                                  calls, even in DRY_RUN)
 *   DATABASE_URL is set
 *   GOOGLE_GEOCODING_API_KEY is set (server-only; never NEXT_PUBLIC_)
 *   target does NOT look like production; logs only scheme+hostname via
 *   describeUrlShape, never path/query/credentials (CAM-359/CAM-369)
 *
 * Usage:
 *   # 1. Dry run first — real Google calls for the ~18 affected rows only,
 *   #    reports the projection, writes NOTHING:
 *   ALLOW_COORDINATES_INSIDE_THAILAND_BACKFILL=1 DRY_RUN=1 \
 *     DATABASE_URL=<non-prod> GOOGLE_GEOCODING_API_KEY=<key> \
 *     node scripts/backfill-cam-571-coordinates-inside-thailand.mjs
 *
 *   # 2. Real run — writes the verified moves (reuses the dry run's cache):
 *   ALLOW_COORDINATES_INSIDE_THAILAND_BACKFILL=1 \
 *     DATABASE_URL=<non-prod> GOOGLE_GEOCODING_API_KEY=<key> \
 *     node scripts/backfill-cam-571-coordinates-inside-thailand.mjs
 *
 * NEVER run against production DB. Requires CAM-562's cache file to exist
 * (`os.tmpdir()/cam-562-geocode-cache.json`) — refuses rather than silently
 * falling back to a fresh 650-call reverse-geocode run.
 */
import { PrismaClient } from '@prisma/client';
import { pathToFileURL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describeUrlShape } from './db-reset.mjs';
import { matchAdminAreaByName } from './backfill-cam-563-location-admin-area.mjs';
import {
  callGoogleGeocode as callGoogleGeocodeReverse,
  extractComponent,
  runBackfill as runCam562Backfill,
} from './backfill-cam-562-subdistrict-geocode.mjs';
import { callGoogleGeocodeCore } from '../lib/geo/google-geocode.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CAM_562_CACHE_FILE = path.join(os.tmpdir(), 'cam-562-geocode-cache.json');
const FORWARD_CACHE_FILE = path.join(os.tmpdir(), 'cam-571-forward-geocode-cache.json');
const REVERSE_CHECK_CACHE_FILE = path.join(os.tmpdir(), 'cam-571-reverse-check-cache.json');
const REVERSE_VERIFY_CACHE_FILE = path.join(os.tmpdir(), 'cam-571-reverse-verify-cache.json');

const PROVINCE_CENTROIDS_PATH = path.join(__dirname, '..', 'prisma', 'data', 'province-centroids.json');

// A far-outlier distance from the claimed province's (camp-derived, non-
// authoritative) centroid — well beyond a Thai province's typical extent
// (most are well under 100km across). Only a REPORT-time flag, never a
// write threshold (BR-9).
const FAR_FROM_PROVINCE_KM = 100;

/**
 * Calls the Google Geocoding API in FORWARD mode (address -> latlng) via the
 * shared `callGoogleGeocodeCore` (CAM-572, `lib/geo/google-geocode.ts`).
 * Used to be a small, documented, necessary duplicate of the same fetch
 * wrapper (CAM-554's forward route lives in
 * `app/api/geocode/forward/route.ts`, TS, `app/api/**`, which pulls
 * `@/lib/prisma` and so has never been importable from a plain `.mjs`
 * script) — now translates the shared core's discriminated result into
 * this script's own pre-existing `{ok, reason, zeroResults, lat, lon}`
 * shape (unchanged — pinned by
 * `__tests__/cam-571-coordinates-inside-thailand.test.ts`, run unedited).
 * Never logs the outgoing URL (it carries the key as a query param) — only
 * the core's own `reason` field (this function itself never logs).
 */
export async function callGoogleGeocodeForward(address) {
  const core = await callGoogleGeocodeCore({ address, language: 'th' });
  if (!core.ok) return { ok: false, reason: core.reason };
  if (core.zeroResults) return { ok: true, zeroResults: true };
  const location = core.results[0]?.geometry?.location;
  if (typeof location?.lat !== 'number' || typeof location?.lng !== 'number') {
    return { ok: false, reason: 'no_geometry' };
  }
  return { ok: true, zeroResults: false, lat: location.lat, lon: location.lng };
}

/** Mirrors `app/api/geocode/forward/route.ts`'s address-string construction — never invents a value not already on the row. */
export function buildForwardAddress({ subDistrict, district, province }) {
  return [subDistrict, district, province, 'Thailand'].filter(Boolean).join(', ');
}

/**
 * Returns the geocoded country's `{shortName, longName}` from a cached (or
 * live) reverse-geocode result's `address_components`, or `null` when no
 * `country` component is present at all (a different, out-of-scope
 * failure mode CAM-562 already reports separately — this story only acts
 * when a country IS present and is explicitly not Thailand).
 */
export function extractCountry(components) {
  const found = (components ?? []).find((c) => c.types.includes('country'));
  return found ? { shortName: found.short_name, longName: found.long_name } : null;
}

/**
 * Scans CAM-562's FROZEN geocode cache (never re-fetched here) and returns
 * every `Location.id` whose cached, successful (non-zero-results) reverse-
 * geocode result names a country OTHER than Thailand (`short_name !==
 * 'TH'`) — identification by geocoded COUNTRY, never a bounding box (the
 * owner's own correction). Pure function of its input; 0 Google calls.
 */
export function identifyOutsideThailand(cam562Cache) {
  const out = [];
  for (const [id, entry] of Object.entries(cam562Cache ?? {})) {
    if (!entry?.ok || entry.zeroResults) continue;
    const country = extractCountry(entry.components);
    if (country?.shortName && country.shortName !== 'TH') {
      out.push({ id, countryCode: country.shortName, countryName: country.longName });
    }
  }
  return out;
}

/**
 * Fetches one AdminArea node's nameTh/nameEn/level/parentId — needed for the
 * province-ancestor walk below. Exported (CAM-575) so the coordinate
 * reconciliation script can resolve a Location's claimed province from an
 * `adminAreaId` that sits below PROVINCE level, without a third copy of this
 * lookup.
 */
export async function getAdminAreaNode(prisma, id) {
  return prisma.adminArea.findUnique({
    where: { id },
    select: { id: true, code: true, nameTh: true, nameEn: true, level: true, parentId: true },
  });
}

/**
 * Walks `parentId` up from any AdminArea node to its PROVINCE ancestor —
 * same defensive need CAM-562's own second-run bug proved necessary (a row
 * already partially resolved to DISTRICT level must never have its
 * DISTRICT node compared/read as if it were the PROVINCE node). None of
 * this story's 18 candidates are below PROVINCE level today (verified:
 * `district`/`subDistrict` are null on all 18), but a rerun after some
 * other backfill deepened them must not silently misclassify.
 *
 * Exported (CAM-575) — the coordinate reconciliation script reuses this
 * walk verbatim (2 of the 4 real divergent camps sit at DISTRICT/
 * SUBDISTRICT level, not PROVINCE, exactly the case this function guards).
 */
export async function getProvinceAncestor(prisma, adminArea) {
  let current = adminArea;
  while (current && current.level !== 'PROVINCE') {
    if (!current.parentId) return null;
    current = await getAdminAreaNode(prisma, current.parentId);
  }
  return current;
}

/**
 * Confirms a forward-geocoded point actually lands back in the row's
 * CLAIMED province (BR-3: a placement this script cannot verify is
 * refused, never written as a guess), then re-derives district/subDistrict
 * from the SAME reverse-geocode result (no extra call) using CAM-562's own
 * bilingual/hierarchical matcher + language rule (BR-4: write in whichever
 * language the row's OWN `province` is already stored in).
 */
export async function verifyAndResolvePlacement(prisma, row, reverseOfNewPointComponents) {
  const provinceAnchor = row.adminArea?.level === 'PROVINCE' ? row.adminArea : await getProvinceAncestor(prisma, row.adminArea);
  if (!provinceAnchor) {
    return { outcome: 'placement_unverified', reason: 'no_province_anchor_on_row' };
  }

  const provinceRaw = extractComponent(reverseOfNewPointComponents, ['administrative_area_level_1']);
  if (!provinceRaw) {
    return { outcome: 'placement_unverified', reason: 'no_province_component' };
  }

  const provinceMatch = await matchAdminAreaByName(prisma, 'PROVINCE', provinceRaw);
  if (!provinceMatch || provinceMatch.id !== provinceAnchor.id) {
    return {
      outcome: 'placement_unverified',
      reason: 'province_mismatch',
      claimedProvince: { nameTh: provinceAnchor.nameTh, nameEn: provinceAnchor.nameEn },
      geocodedProvinceRaw: provinceRaw,
    };
  }

  const isThaiStored =
    typeof row.province === 'string' && row.province.trim().toLowerCase() === provinceAnchor.nameTh.trim().toLowerCase();

  const districtRaw = extractComponent(reverseOfNewPointComponents, ['administrative_area_level_2']);
  const subDistrictRaw = extractComponent(reverseOfNewPointComponents, ['sublocality_level_1', 'administrative_area_level_3', 'locality']);

  let districtNode = null;
  let subDistrictNode = null;
  if (districtRaw) {
    const districtMatch = await matchAdminAreaByName(prisma, 'DISTRICT', districtRaw, provinceMatch.id);
    if (districtMatch) {
      districtNode = await getAdminAreaNode(prisma, districtMatch.id);
      if (subDistrictRaw) {
        const subDistrictMatch = await matchAdminAreaByName(prisma, 'SUBDISTRICT', subDistrictRaw, districtMatch.id);
        if (subDistrictMatch) subDistrictNode = await getAdminAreaNode(prisma, subDistrictMatch.id);
      }
    }
  }

  const districtText = districtNode ? (isThaiStored ? districtNode.nameTh : districtNode.nameEn) : null;
  const subDistrictText = subDistrictNode ? (isThaiStored ? subDistrictNode.nameTh : subDistrictNode.nameEn) : null;

  return {
    outcome: 'verified',
    write: {
      adminAreaId: subDistrictNode?.id ?? districtNode?.id ?? provinceAnchor.id,
      district: districtText,
      subDistrict: subDistrictText,
    },
  };
}

/**
 * Runs the full move plan against an injected Prisma-like client. Each of
 * the three Google-call kinds (fresh reverse-check of the CURRENT point,
 * forward geocode of the claimed province, reverse-verify of the NEW
 * point) is served from its own cache object first — the caller wires disk
 * persistence via `on*CacheUpdate` (mirrors CAM-562's crash-safety
 * pattern). `dryRun: true` computes and reports every write but issues
 * ZERO `$transaction`/`update` calls.
 */
export async function planMoves(
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
  const candidates = identifyOutsideThailand(cam562Cache);
  /** @type {{ candidatesFromCache: number, candidates: any[], alreadyInsideThailand: any[], moved: any[], forwardGeocodeFailed: any[], placementUnverified: any[], rowNotFound: any[], reverseCheckCallsMade: number, reverseCheckCallsCached: number, forwardCallsMade: number, forwardCallsCached: number, reverseVerifyCallsMade: number, reverseVerifyCallsCached: number }} */
  const summary = {
    candidatesFromCache: candidates.length,
    candidates,
    alreadyInsideThailand: [],
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

    // Fresh, live re-check of the row's CURRENT coordinates (not the
    // frozen cache) — this is both the idempotency guard (a row this
    // script already moved now reads Thailand and is skipped) and the
    // host-edit safety net (a row corrected by anything else since
    // CAM-562's snapshot also now reads Thailand and is skipped). Keyed by
    // id+coordinate (not id alone): once a row is moved its lat/lon change,
    // so a STALE cache entry keyed by id alone would keep reporting the
    // OLD (foreign) classification forever and this check would never see
    // the move — the coordinate must be part of the key for the check to
    // mean anything on a later run.
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
    const currentCountry = reverseCheck.ok && !reverseCheck.zeroResults ? extractCountry(reverseCheck.components) : null;
    if (!currentCountry || currentCountry.shortName === 'TH') {
      summary.alreadyInsideThailand.push({ id: row.id, oldLat: row.lat, oldLon: row.lon });
      continue;
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
      oldCountry: candidate.countryName,
      oldLat: row.lat,
      oldLon: row.lon,
      newLat: forward.lat,
      newLon: forward.lon,
      district: resolved.write.district,
      subDistrict: resolved.write.subDistrict,
      campSiteIds: row.campSites.map((c) => c.id),
    };

    if (!dryRun) {
      // CAM-575: CampSite.latitude/longitude is now the canonical column —
      // write it FIRST (inverted from this script's original Location-first
      // order). A `campSite.update` touching latitude/longitude fires the
      // `campsite_coords_sync` DB trigger (prisma/migrations/
      // 20260726165149_cam575_...), which derives Location.lat/lon
      // automatically inside the SAME transaction — the explicit
      // `location.update` lat/lon write below is therefore redundant with
      // the trigger, not the source of truth; it is kept (writing the exact
      // same value the trigger already derived) only so this call still
      // carries district/subDistrict/adminAreaId (`resolved.write`, which
      // are Location-only fields with no CampSite analogue and are NOT
      // trigger-derived) in the same atomic transaction as the coordinate
      // move.
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

  log(`candidates from CAM-562 cache (geocoded country != TH): ${summary.candidatesFromCache}`);
  log(`already inside Thailand on fresh re-check (skipped, idempotent/host-safe): ${summary.alreadyInsideThailand.length}`);
  log(`${dryRun ? 'would move' : 'moved'}: ${summary.moved.length}`);
  log(`forward-geocode failed: ${summary.forwardGeocodeFailed.length}, placement unverified: ${summary.placementUnverified.length}`);
  log(
    `Google calls — reverse-check: ${summary.reverseCheckCallsMade} made/${summary.reverseCheckCallsCached} cached, ` +
      `forward: ${summary.forwardCallsMade} made/${summary.forwardCallsCached} cached, ` +
      `reverse-verify: ${summary.reverseVerifyCallsMade} made/${summary.reverseVerifyCallsCached} cached`
  );

  return summary;
}

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Pure haversine great-circle distance (km). A tiny, documented, necessary
 * duplicate of `lib/geo/distance.ts`'s `haversineDistanceKm` — that file is
 * TS and this script is a plain `.mjs` (same cross-language-import
 * constraint CAM-562/563 already recorded for their own duplicates); it is
 * also under active restructuring by a different story (CAM-566) at the
 * time of writing, so this story does not touch it at all.
 */
export function haversineDistanceKm(a, b) {
  const R = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Reports (never writes) CAM-562's own 83 "adjacent province" mismatches,
 * ranked by distance from each row's CURRENT point to its claimed
 * province's (camp-derived, non-authoritative) centroid — a cheap, 0-extra-
 * Google-call heuristic, not a boundary check (no province polygon data
 * exists in this repo). Reuses CAM-562's `runBackfill` dry-run purely for
 * its already-computed `provinceMismatch` list (no new classification
 * logic, no new Google calls beyond what the injected cache already has).
 */
export async function reportProvinceMismatchDistances(prisma, cam562Cache, provinceCentroids) {
  const report = await runCam562Backfill(prisma, { log: () => {}, dryRun: true, cache: cam562Cache });
  const ids = report.provinceMismatch.map((m) => m.id);
  const rows = ids.length ? await prisma.location.findMany({ where: { id: { in: ids } }, select: { id: true, lat: true, lon: true } }) : [];
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

  const withDistance = report.provinceMismatch.map((m) => {
    const row = byId[m.id];
    const centroid = provinceCentroids[m.storedProvinceNode.nameEn];
    const distanceKm =
      row?.lat != null && row?.lon != null && centroid
        ? Math.round(haversineDistanceKm({ lat: row.lat, lon: row.lon }, { lat: centroid.lat, lon: centroid.lng }) * 10) / 10
        : null;
    return {
      id: m.id,
      storedProvince: m.storedProvinceNode.nameEn,
      geocodedProvince: m.geocodedProvinceNode?.nameEn ?? null,
      distanceKm,
    };
  });
  withDistance.sort((a, b) => (b.distanceKm ?? -1) - (a.distanceKm ?? -1));

  const farOutliers = withDistance.filter((m) => (m.distanceKm ?? 0) > FAR_FROM_PROVINCE_KM);
  const maxDistanceKm = withDistance.length ? withDistance[0].distanceKm : null;

  return {
    count: withDistance.length,
    cases: withDistance,
    maxDistanceKm,
    farOutliers,
    recommendation:
      farOutliers.length === 0
        ? `All ${withDistance.length} cases are within ${FAR_FROM_PROVINCE_KM}km of their claimed province's centroid (max observed: ${maxDistanceKm}km) — consistent with a seed coordinate sitting near a provincial border, not the same defect as the 18 foreign-country cases. Recommendation: report only, do not bulk-rewrite.`
        : `${farOutliers.length} of ${withDistance.length} cases sit more than ${FAR_FROM_PROVINCE_KM}km from their claimed province's centroid — recommend treating those specific ids as the same defect as the 18 foreign-country cases (see farOutliers).`,
  };
}

export function checkGuard() {
  const allow = process.env.ALLOW_COORDINATES_INSIDE_THAILAND_BACKFILL === '1';
  const url = process.env.DATABASE_URL || '';
  const looksProd =
    /prod/i.test(url) ||
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production';
  const hasKey = !!process.env.GOOGLE_GEOCODING_API_KEY;
  if (!allow) {
    return { ok: false, message: '✗ refusing: set ALLOW_COORDINATES_INSIDE_THAILAND_BACKFILL=1 to confirm running this backfill (billed Google Geocoding calls, even in DRY_RUN)' };
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

  const cam562Cache = loadCache(CAM_562_CACHE_FILE);
  if (!cam562Cache) {
    console.error(`✗ refusing: CAM-562's geocode cache was not found at ${CAM_562_CACHE_FILE} — re-run CAM-562's backfill first (this story must not spend a fresh 650-call reverse-geocode run to re-identify)`);
    process.exit(1);
  }

  const reverseCheckCache = loadCache(REVERSE_CHECK_CACHE_FILE) ?? {};
  const forwardCache = loadCache(FORWARD_CACHE_FILE) ?? {};
  const reverseVerifyCache = loadCache(REVERSE_VERIFY_CACHE_FILE) ?? {};
  const provinceCentroids = JSON.parse(fs.readFileSync(PROVINCE_CENTROIDS_PATH, 'utf8'));

  const prisma = new PrismaClient();
  try {
    const before = await prisma.campSite.count({ where: { location: { province: 'Chiang Mai' } } });
    console.log(`Chiang Mai province-filter count BEFORE: ${before}`);

    const moves = await planMoves(prisma, {
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
    saveCache(REVERSE_CHECK_CACHE_FILE, reverseCheckCache);
    saveCache(FORWARD_CACHE_FILE, forwardCache);
    saveCache(REVERSE_VERIFY_CACHE_FILE, reverseVerifyCache);

    console.log(`moved (${moves.moved.length}): ${JSON.stringify(moves.moved, null, 2)}`);
    if (moves.forwardGeocodeFailed.length > 0) console.log(`forward-geocode failed: ${JSON.stringify(moves.forwardGeocodeFailed)}`);
    if (moves.placementUnverified.length > 0) console.log(`placement unverified: ${JSON.stringify(moves.placementUnverified)}`);

    const mismatchReport = await reportProvinceMismatchDistances(prisma, cam562Cache, provinceCentroids);
    console.log(`\n83-case adjacent-province report (report-only, never written): ${mismatchReport.count} cases`);
    console.log(`max distance from claimed province centroid: ${mismatchReport.maxDistanceKm}km`);
    console.log(mismatchReport.recommendation);
    console.log(JSON.stringify(mismatchReport.cases, null, 2));

    const after = await prisma.campSite.count({ where: { location: { province: 'Chiang Mai' } } });
    console.log(`\nChiang Mai province-filter count AFTER: ${after}`);
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
