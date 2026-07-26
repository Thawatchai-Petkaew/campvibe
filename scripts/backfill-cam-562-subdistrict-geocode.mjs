#!/usr/bin/env node
/**
 * scripts/backfill-cam-562-subdistrict-geocode.mjs — CAM-562
 *
 * Every real camp (650 of 652 `Location` rows — 2 are orphaned placeholders
 * with no coordinates and no live camp, left alone per BR-7) already carries
 * trustworthy lat/lon (CAM-563 measured: all 650 fall inside Thailand's
 * bounding box, consistent with the province each camp claims). CAM-563
 * already resolved `Location.adminAreaId` to the PROVINCE level for all 650.
 * This script goes deeper: reverse-geocodes each row's coordinates
 * (server-side Google Geocoding API, `GOOGLE_GEOCODING_API_KEY`), matches
 * the result bilingually against the AdminArea tree, and advances
 * `adminAreaId` to DISTRICT then SUBDISTRICT where the geocoder agrees with
 * the province already on file — never the reverse direction (a tambon
 * cannot be turned into a pin; the imported dataset has no coordinates).
 *
 * Reuse, not a third implementation: the bilingual, hierarchical, exact-
 * match (never `contains`) AdminArea matcher is CAM-563's own
 * `matchAdminAreaByName`/`normalizeAdminAreaName`
 * (`scripts/backfill-cam-563-location-admin-area.mjs`), imported directly —
 * both are same-runtime plain `.mjs` modules, so no cross-language port is
 * needed this time (unlike CAM-563's own port of CAM-554's TS algorithm).
 * CAM-554's `app/api/geocode/_shared.ts::callGoogleGeocode` has no existing
 * plain-JS twin (it lives inside `app/api/**`, TS, out of this story's file
 * surface) — this script's `callGoogleGeocode` below is a small, documented,
 * necessary duplicate of that same fetch wrapper (same endpoint, same
 * never-log-the-key-bearing-URL discipline), not a redesign.
 *
 * CRITICAL — do NOT silently overwrite `Location.province` (owner's
 * explicit instruction, twice-warned in the ticket): it drives
 * `lib/campsite-filters.ts`'s exact-equality province filter, the province
 * dropdown, and CAM-545's Thai card names. If the geocoded province
 * disagrees with the row's currently-stored province-level AdminArea node,
 * the row is recorded in `provinceMismatch` and NONE of its fields
 * (`adminAreaId`/`district`/`subDistrict`) are written — never a partial or
 * silent re-home.
 *
 * CRITICAL — the stored `province`/`district`/`subDistrict` columns are a
 * Thai/English MIX (CAM-559 finding: whichever UI language was active when
 * the host saved). This script's own writes stay consistent with whichever
 * language the row's OWN `province` value is already in (BR-4) — matching
 * bilingually, and never introducing a NEW English/Thai mix within a single
 * row (see `components/CampgroundCard.tsx`'s `buildLocationText`, which
 * renders `district` as-is in both languages since it has no separate Thai
 * form; BR-4 narrows, but does not fully close, that known display gap).
 *
 * Cost — billed by Google, treated as real: ~650 calls, one-off. A dry run
 * (`DRY_RUN=1`) still makes the real Google calls (it needs real data to
 * report a true projection) but performs zero `prisma.location.update`
 * calls. To avoid DOUBLING that cost across the dry-run + real-run pairing,
 * every geocode response is cached to disk (`os.tmpdir()`, keyed by
 * `Location.id`) — the real run immediately following a dry run reuses the
 * dry run's ~650 calls instead of re-billing them. A genuinely fresh
 * cache (a new day, a different machine) is the only way the calls repeat.
 * Idempotent by construction: a row with BOTH `district` AND `subDistrict`
 * already set is excluded from the candidate query entirely, so a re-run
 * against an already-completed backfill makes zero further calls even
 * without the cache.
 *
 * SAFETY GUARD — refuses unless ALL of:
 *   ALLOW_SUBDISTRICT_GEOCODE_BACKFILL=1  (explicit opt-in — billed calls,
 *                                          even in DRY_RUN)
 *   DATABASE_URL is set
 *   GOOGLE_GEOCODING_API_KEY is set (server-only; never NEXT_PUBLIC_)
 *   target does NOT look like production (mirrors scripts/db-reset.mjs /
 *   scripts/backfill-cam-563-location-admin-area.mjs); logs only
 *   scheme+hostname via describeUrlShape, never path/query/credentials
 *   (CAM-359/CAM-369)
 *
 * Usage:
 *   # 1. Dry run first — makes the real Google calls, reports the
 *   #    projection + API-call count, writes NOTHING:
 *   ALLOW_SUBDISTRICT_GEOCODE_BACKFILL=1 DRY_RUN=1 \
 *     DATABASE_URL=<non-prod> GOOGLE_GEOCODING_API_KEY=<key> \
 *     node scripts/backfill-cam-562-subdistrict-geocode.mjs
 *
 *   # 2. Real run — writes district/subDistrict/adminAreaId for the
 *   #    resolvable camps (reuses the dry run's cached Google responses):
 *   ALLOW_SUBDISTRICT_GEOCODE_BACKFILL=1 \
 *     DATABASE_URL=<non-prod> GOOGLE_GEOCODING_API_KEY=<key> \
 *     node scripts/backfill-cam-562-subdistrict-geocode.mjs
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

const GOOGLE_GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';
const CACHE_FILE = path.join(os.tmpdir(), 'cam-562-geocode-cache.json');

/**
 * Calls the Google Geocoding API in REVERSE mode (latlng -> address). Never
 * logs the outgoing URL (it carries the key as a query param) — only a
 * status code / Google `status` string / caught error message. Mirrors
 * `app/api/geocode/_shared.ts::callGoogleGeocode`'s discipline; a small,
 * necessary duplicate (see the file header for why it isn't imported).
 */
export async function callGoogleGeocode(lat, lon) {
  const key = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!key) return { ok: false, reason: 'missing_key' };

  const url = new URL(GOOGLE_GEOCODE_ENDPOINT);
  url.searchParams.set('latlng', `${lat},${lon}`);
  url.searchParams.set('language', 'th');
  url.searchParams.set('region', 'th');
  url.searchParams.set('key', key);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const data = await res.json();
    if (data.status === 'ZERO_RESULTS') return { ok: true, zeroResults: true, components: [] };
    if (data.status !== 'OK') return { ok: false, reason: `google_${data.status}` };
    return { ok: true, zeroResults: false, components: data.results?.[0]?.address_components ?? [] };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'unknown_error' };
  }
}

/** Returns the first address component's `long_name` matching any of `types`, in priority order. Ported from `app/api/geocode/_shared.ts` (see file header). */
export function extractComponent(components, types) {
  for (const type of types) {
    const found = components.find((c) => c.types.includes(type));
    if (found) return found.long_name;
  }
  return null;
}

/** Fetches the full AdminArea node (nameTh/nameEn/code/parentId) for an id already matched by `matchAdminAreaByName` (which only returns `{id}`). */
async function getAdminAreaNode(prisma, id) {
  return prisma.adminArea.findUnique({
    where: { id },
    select: { id: true, code: true, nameTh: true, nameEn: true, level: true, parentId: true },
  });
}

/**
 * Walks `parentId` up from ANY AdminArea node to its PROVINCE-level
 * ancestor. Needed because this script's OWN partial writes (district
 * resolved, sub-district not) advance a row's `adminAreaId` to DISTRICT
 * level — so a row re-scanned on a later run (still a candidate because
 * `subDistrict` is still null) legitimately arrives here already sitting
 * BELOW province level. Comparing/deriving against the wrong level (e.g. a
 * DISTRICT node's `nameTh` where a PROVINCE name is expected) would corrupt
 * the mismatch-check and the language-consistency check (BR-4) — so this
 * walk is required, not just a defensive nicety.
 */
async function getProvinceAncestor(prisma, adminArea) {
  let current = adminArea;
  while (current && current.level !== 'PROVINCE') {
    if (!current.parentId) return null;
    current = await getAdminAreaNode(prisma, current.parentId);
  }
  return current;
}

/**
 * Resolves ONE candidate `Location` row from its already-fetched geocode
 * result. Never guesses: a level with no raw component, no AdminArea match,
 * or a disagreeing province stops the walk and is reported, never silently
 * skipped or silently written (BR-2/BR-3/BR-5).
 *
 * Language consistency (BR-4): `district`/`subDistrict` are written in
 * WHICHEVER language the row's own `province` value is already stored in
 * (compared against the current AdminArea province node's `nameTh`/`nameEn`)
 * — never a language mismatched against the row's existing `province`.
 */
export async function resolveCandidate(prisma, row, geocodeResult) {
  if (!row.adminArea) {
    return { id: row.id, outcome: 'skipped_no_current_admin_area' };
  }
  // A candidate may already sit at DISTRICT level (this script's OWN prior
  // partial write — district resolved, sub-district not, so the row is
  // still a candidate) — walk up to the PROVINCE ancestor rather than
  // assume `row.adminArea` already IS the province node (CAM-562 second-run
  // finding: 17 district-only rows were mis-reported as unresolved before
  // this walk existed, because a DISTRICT node's own id/nameTh was wrongly
  // compared/read as if it were the province's).
  const provinceNode = row.adminArea.level === 'PROVINCE' ? row.adminArea : await getProvinceAncestor(prisma, row.adminArea);
  if (!provinceNode) {
    return { id: row.id, outcome: 'skipped_no_province_ancestor' };
  }

  if (!geocodeResult.ok) {
    return { id: row.id, outcome: 'geocode_failed', reason: geocodeResult.reason };
  }
  if (geocodeResult.zeroResults) {
    return { id: row.id, outcome: 'zero_results' };
  }

  const components = geocodeResult.components;
  const provinceRaw = extractComponent(components, ['administrative_area_level_1']);
  const districtRaw = extractComponent(components, ['administrative_area_level_2']);
  const subDistrictRaw = extractComponent(components, ['sublocality_level_1', 'administrative_area_level_3', 'locality']);

  if (!provinceRaw) {
    return { id: row.id, outcome: 'no_province_component' };
  }

  const provinceMatch = await matchAdminAreaByName(prisma, 'PROVINCE', provinceRaw);
  if (!provinceMatch) {
    return { id: row.id, outcome: 'province_unmatched', provinceRaw };
  }

  if (provinceMatch.id !== provinceNode.id) {
    const geocodedProvinceNode = await getAdminAreaNode(prisma, provinceMatch.id);
    return {
      id: row.id,
      outcome: 'province_mismatch',
      storedProvince: row.province,
      storedProvinceNode: { nameTh: provinceNode.nameTh, nameEn: provinceNode.nameEn },
      geocodedProvinceNode: geocodedProvinceNode ? { nameTh: geocodedProvinceNode.nameTh, nameEn: geocodedProvinceNode.nameEn } : null,
    };
  }

  const isThaiStored =
    typeof row.province === 'string' && row.province.trim().toLowerCase() === provinceNode.nameTh.trim().toLowerCase();

  if (!districtRaw) {
    return { id: row.id, outcome: 'no_district_component' };
  }

  const districtMatch = await matchAdminAreaByName(prisma, 'DISTRICT', districtRaw, provinceMatch.id);
  if (!districtMatch) {
    return { id: row.id, outcome: 'district_unmatched', districtRaw };
  }
  const districtNode = await getAdminAreaNode(prisma, districtMatch.id);

  let subDistrictNode = null;
  if (subDistrictRaw) {
    const subDistrictMatch = await matchAdminAreaByName(prisma, 'SUBDISTRICT', subDistrictRaw, districtMatch.id);
    if (subDistrictMatch) {
      subDistrictNode = await getAdminAreaNode(prisma, subDistrictMatch.id);
    }
  }

  const districtText = isThaiStored ? districtNode.nameTh : districtNode.nameEn;
  const subDistrictText = subDistrictNode ? (isThaiStored ? subDistrictNode.nameTh : subDistrictNode.nameEn) : null;

  return {
    id: row.id,
    outcome: subDistrictNode ? 'resolved_subdistrict' : 'resolved_district_only',
    // `language` records WHICH language this write is in (BR-4) — surfaced
    // so `runBackfill`'s report can state the language distribution of what
    // it actually wrote, not just that it wrote something (the owner's
    // explicit ask: the columns already hold a CAM-559 Thai/English mix, so
    // this backfill's own contribution to that mix must be visible, not
    // left for the next person to discover).
    language: isThaiStored ? 'th' : 'en',
    write: {
      adminAreaId: subDistrictNode ? subDistrictNode.id : districtNode.id,
      district: districtText,
      subDistrict: subDistrictText,
    },
  };
}

/**
 * Runs the backfill against an injected Prisma-like client (real
 * PrismaClient in production use; a fake in tests). `dryRun: true` performs
 * every geocode call and computes every write, but issues ZERO
 * `prisma.location.update` calls (EC-1). `cache` is a plain object keyed by
 * `Location.id` — reused across the dry-run/real-run pairing so the real
 * run's calls are served from cache, not re-billed (BR-6); `onCacheUpdate`
 * is invoked after every NEW Google call so the caller can flush the cache
 * to disk incrementally (crash-safety over a ~650-call run).
 *
 * @param {unknown} prisma
 * @param {{ log?: (...args: unknown[]) => void, dryRun?: boolean, cache?: Record<string, unknown>, onCacheUpdate?: () => void }} [options]
 */
export async function runBackfill(prisma, { log = console.log, dryRun = false, cache = {}, onCacheUpdate } = {}) {
  const total = await prisma.location.count();
  const beforeDistrict = await prisma.location.count({ where: { district: { not: null } } });
  const beforeSubDistrict = await prisma.location.count({ where: { subDistrict: { not: null } } });
  log(`before: district set on ${beforeDistrict}, subDistrict set on ${beforeSubDistrict} of ${total} Location rows`);

  // Idempotent candidate set: a null lat/lon row is never a candidate
  // (BR-7); a row already fully resolved (both district AND subDistrict
  // set) is excluded — never re-touched, never re-billed on a re-run.
  const candidates = await prisma.location.findMany({
    where: {
      lat: { not: null },
      lon: { not: null },
      OR: [{ district: null }, { subDistrict: null }],
    },
    select: {
      id: true,
      province: true,
      district: true,
      subDistrict: true,
      lat: true,
      lon: true,
      adminAreaId: true,
      adminArea: { select: { id: true, level: true, code: true, nameTh: true, nameEn: true, parentId: true } },
      campSites: { select: { id: true }, take: 1 },
    },
  });

  const summary = {
    candidates: candidates.length,
    updated: 0,
    resolvedSubDistrict: 0,
    resolvedDistrictOnly: 0,
    provinceMismatch: [],
    unresolved: [],
    apiCallsMade: 0,
    apiCallsCached: 0,
    // Language distribution of what THIS run actually wrote (BR-4) — the
    // owner's explicit ask: state this run's contribution to the existing
    // CAM-559 Thai/English mix, not leave it for the next reader to find.
    writtenThai: 0,
    writtenEnglish: 0,
  };

  for (const row of candidates) {
    let geocodeResult = cache[row.id];
    if (geocodeResult) {
      summary.apiCallsCached += 1;
    } else {
      geocodeResult = await callGoogleGeocode(row.lat, row.lon);
      cache[row.id] = geocodeResult;
      summary.apiCallsMade += 1;
      if (onCacheUpdate) onCacheUpdate();
    }

    const result = await resolveCandidate(prisma, row, geocodeResult);

    if (result.outcome === 'province_mismatch') {
      summary.provinceMismatch.push(result);
      continue;
    }

    if (result.outcome === 'resolved_subdistrict' || result.outcome === 'resolved_district_only') {
      const needsWrite =
        row.adminAreaId !== result.write.adminAreaId ||
        row.district !== result.write.district ||
        row.subDistrict !== result.write.subDistrict;
      if (needsWrite) {
        if (!dryRun) {
          await prisma.location.update({ where: { id: row.id }, data: result.write });
        }
        summary.updated += 1;
        if (result.language === 'th') summary.writtenThai += 1;
        else summary.writtenEnglish += 1;
      }
      if (result.outcome === 'resolved_subdistrict') summary.resolvedSubDistrict += 1;
      else summary.resolvedDistrictOnly += 1;
      continue;
    }

    // geocode_failed / zero_results / no_province_component /
    // province_unmatched / no_district_component / district_unmatched /
    // skipped_no_province_ancestor / skipped_no_current_admin_area
    summary.unresolved.push(result);
  }

  const afterDistrict = dryRun ? beforeDistrict : await prisma.location.count({ where: { district: { not: null } } });
  const afterSubDistrict = dryRun ? beforeSubDistrict : await prisma.location.count({ where: { subDistrict: { not: null } } });

  log(`candidates scanned: ${summary.candidates}, rows ${dryRun ? 'that WOULD update' : 'updated'}: ${summary.updated}`);
  log(`resolved to sub-district: ${summary.resolvedSubDistrict}, resolved to district only: ${summary.resolvedDistrictOnly}`);
  log(`province mismatches: ${summary.provinceMismatch.length}, unresolved: ${summary.unresolved.length}`);
  log(`Google Geocoding calls made: ${summary.apiCallsMade}, served from cache: ${summary.apiCallsCached}`);
  log(`language of what ${dryRun ? 'WOULD be' : 'was'} written: Thai ${summary.writtenThai}, English ${summary.writtenEnglish}`);
  if (!dryRun) {
    log(`after: district set on ${afterDistrict}, subDistrict set on ${afterSubDistrict} of ${total} Location rows`);
  }

  return { ...summary, total, beforeDistrict, beforeSubDistrict, afterDistrict, afterSubDistrict };
}

export function checkGuard() {
  const allow = process.env.ALLOW_SUBDISTRICT_GEOCODE_BACKFILL === '1';
  const url = process.env.DATABASE_URL || '';
  const looksProd =
    /prod/i.test(url) ||
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production';
  const hasKey = !!process.env.GOOGLE_GEOCODING_API_KEY;
  if (!allow) {
    return { ok: false, message: '✗ refusing: set ALLOW_SUBDISTRICT_GEOCODE_BACKFILL=1 to confirm running this backfill (billed Google Geocoding calls, even in DRY_RUN)' };
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
    return {};
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
  console.log(dryRun ? 'MODE: DRY RUN — reporting only, no writes' : 'MODE: REAL RUN — writing resolved rows');

  const cache = loadCache(CACHE_FILE);
  const prisma = new PrismaClient();
  try {
    const report = await runBackfill(prisma, {
      dryRun,
      cache,
      onCacheUpdate: () => saveCache(CACHE_FILE, cache),
    });
    saveCache(CACHE_FILE, cache);

    if (report.provinceMismatch.length > 0) {
      console.log(`province mismatches (${report.provinceMismatch.length}): ${JSON.stringify(report.provinceMismatch)}`);
    }
    if (report.unresolved.length > 0) {
      console.log(`unresolved (${report.unresolved.length}): ${JSON.stringify(report.unresolved)}`);
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
// (tests import resolveCandidate / runBackfill / checkGuard / callGoogleGeocode directly).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await main();
}
