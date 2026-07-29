#!/usr/bin/env node
/**
 * scripts/seed-demo-spots.mjs — CAM-663
 *
 * Staging has 3,006 pitches across 783 camps, but only 2 images attached to
 * pitches in the whole database and only 2 camps have per-pitch mode
 * (`useSpotView`) on. CAM-664's UI work has almost nothing real to render.
 * This script picks ONE real, published camp on STAGING and curates 9 of its
 * existing live pitches so every UI branch a spot-detail screen must handle
 * has a real example: a wide panorama, several photos, exactly one photo, no
 * image at all (the dominant real state), PER_SITE vs PER_PERSON pricing, a
 * free pitch, mixed capacities, multiple zones, a host-blocked date, an
 * existing booking, and a very long name.
 *
 * SAFETY
 *   - Default mode is DRY RUN (prints the plan, writes nothing). Writing
 *     requires the explicit --apply flag.
 *   - Refuses when DATABASE_URL resolves to a LOCAL host — this script
 *     targets STAGING only. This is the mirror image of the guard in
 *     scripts/db-sync-from-staging.mjs (which refuses when the target is
 *     NOT localhost); this one refuses when it IS localhost.
 *   - Never prints a connection string, token, or `.env` value — only
 *     scheme+hostname via describeUrlShape (scripts/db-reset.mjs), same
 *     contract as every other backfill script (CAM-359/CAM-369).
 *   - Never writes a local-filesystem image path (that gitignored public
 *     directory 404s on staging) — every image URL is a real, working
 *     Unsplash URL.
 *
 * Usage:
 *   node scripts/seed-demo-spots.mjs                 # dry run (default)
 *   node scripts/seed-demo-spots.mjs --dry-run        # same, explicit
 *   node scripts/seed-demo-spots.mjs --apply          # write for real
 *   node scripts/seed-demo-spots.mjs --camp <nameThSlug>          # override camp selection
 *   node scripts/seed-demo-spots.mjs --undo --camp <nameThSlug>   # remove what this script created
 *
 * CAMP SELECTION (rule-based, not hard-coded): published · deletedAt null ·
 * >= MIN_LIVE_PITCHES live spots · >= MIN_CAMP_IMAGES camp-gallery images ·
 * >= MIN_ZONES live zones · highest completeness score (see
 * COMPLETENESS_FIELDS), tie-broken by id ascending for determinism. `--camp`
 * overrides the rule entirely.
 *
 * IDEMPOTENT BY CONSTRUCTION: the 9 demo pitches are always the first
 * DEMO_SPOT_COUNT live spots of the chosen camp ordered by `id asc` — that
 * ordering never changes because of this script's own writes, so re-running
 * (dry-run or apply) always resolves the SAME 9 pitches to the SAME roles.
 * Every write is a "top up to target state" check (does this pitch already
 * have a panorama / >=3 photos / >=1 photo / a live BlockedDate / a live
 * non-cancelled Booking?) — so a second --apply run creates zero additional
 * rows.
 *
 * UNDO SCOPE: --undo removes exactly the rows this script would create —
 * identified by exact (spotId + url) match for images (every URL this script
 * writes is one of PANORAMA_URLS/PHOTO_URL_POOL, effectively impossible to
 * collide with a real host's own upload) and by exact (spotId + fixed demo
 * date range) match for the BlockedDate/Booking — plus resets
 * `useSpotView` back to false on the chosen camp. It does NOT revert the
 * priceUnit/maxCampers/zoneId/name/pricePerNight overwrites made on the 9
 * demo Spot rows (those are edits to pre-existing rows, not created rows, and
 * this script does not persist their prior values anywhere — see the PR
 * description for this documented, deliberate scope limit). `--undo` always
 * requires an explicit `--camp` — it never auto-selects a camp for a
 * destructive operation.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';
import { describeUrlShape } from './db-reset.mjs';

// ---------------------------------------------------------------------------
// Guard — this script targets STAGING only, never localhost.
// ---------------------------------------------------------------------------

export const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function hostOf(url) {
  try {
    const hostname = new URL(url).hostname;
    // IPv6 literals keep their brackets in URL#hostname (e.g. "[::1]") — strip
    // them so LOCAL_HOSTS matches, same convention as db-reset.mjs's describeUrlShape.
    return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  } catch {
    return null;
  }
}

export function checkGuard() {
  const url = process.env.DATABASE_URL || '';
  if (!url) {
    return { ok: false, message: '✗ refusing: DATABASE_URL is not set' };
  }
  const host = hostOf(url);
  if (host === null) {
    return { ok: false, message: '✗ refusing: DATABASE_URL is not a parseable URL' };
  }
  if (LOCAL_HOSTS.has(host)) {
    return {
      ok: false,
      message: `✗ refusing: this script targets STAGING only, got local host "${host}" — never seed demo data into the local dev DB`,
    };
  }
  return { ok: true, url };
}

// ---------------------------------------------------------------------------
// Camp selection
// ---------------------------------------------------------------------------

export const MIN_LIVE_PITCHES = 10;
export const MIN_CAMP_IMAGES = 20;
export const MIN_ZONES = 3;

/** Truthy/non-null presence of these fields feeds the completeness score. */
export const COMPLETENESS_FIELDS = [
  'description', 'logo', 'videoUrl', 'phone', 'lineId', 'facebookUrl',
  'address', 'directions', 'feeInfo', 'toiletInfo', 'groundType',
  'cancellationPolicy', 'tags', 'partner', 'nationalPark', 'ownershipType',
];

export const CAMP_SELECT = {
  id: true, nameTh: true, nameThSlug: true, useSpotView: true,
  description: true, logo: true, videoUrl: true, phone: true, lineId: true,
  facebookUrl: true, address: true, directions: true, feeInfo: true,
  toiletInfo: true, groundType: true, cancellationPolicy: true, tags: true,
  partner: true, nationalPark: true, ownershipType: true, minimumAge: true,
  maxGuestsPerDay: true, maxTentsPerDay: true, priceLow: true, priceHigh: true,
  avgRating: true, reviewCount: true,
};

export function computeCompletenessScore(camp) {
  let score = 0;
  for (const field of COMPLETENESS_FIELDS) {
    const v = camp[field];
    if (v !== null && v !== undefined && v !== '') score += 1;
  }
  for (const field of ['minimumAge', 'maxGuestsPerDay', 'maxTentsPerDay', 'priceLow', 'priceHigh', 'avgRating']) {
    if (camp[field] !== null && camp[field] !== undefined) score += 1;
  }
  if ((camp.reviewCount ?? 0) > 0) score += 1;
  return score;
}

/**
 * Rule-based camp selection: published + deletedAt null + meets the 3 hard
 * minimums, then the highest completeness score, tied-broken by id ascending
 * (deterministic — never changes run to run for the same DB state).
 * `overrideSlug` (nameThSlug) bypasses the rule entirely.
 */
export async function pickCamp(prisma, { overrideSlug } = {}) {
  if (overrideSlug) {
    const camp = await prisma.campSite.findFirst({
      where: { nameThSlug: overrideSlug, deletedAt: null },
      select: CAMP_SELECT,
    });
    if (!camp) {
      throw new Error(`--camp override "${overrideSlug}" not found (nameThSlug, live camp)`);
    }
    return { ...camp, score: computeCompletenessScore(camp), overridden: true };
  }

  const candidates = await prisma.campSite.findMany({
    where: { isPublished: true, deletedAt: null },
    select: {
      ...CAMP_SELECT,
      _count: {
        select: {
          spots: { where: { deletedAt: null } },
          images: true,
          zones: { where: { deletedAt: null } },
        },
      },
    },
  });

  const eligible = candidates.filter(
    (c) =>
      c._count.spots >= MIN_LIVE_PITCHES &&
      c._count.images >= MIN_CAMP_IMAGES &&
      c._count.zones >= MIN_ZONES
  );

  if (eligible.length === 0) {
    throw new Error(
      `no camp on this target matches the selection rule (published, >=${MIN_LIVE_PITCHES} live pitches, >=${MIN_CAMP_IMAGES} camp images, >=${MIN_ZONES} zones)`
    );
  }

  eligible.sort((a, b) => {
    const scoreDiff = computeCompletenessScore(b) - computeCompletenessScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const chosen = eligible[0];
  return { ...chosen, score: computeCompletenessScore(chosen), overridden: false };
}

// ---------------------------------------------------------------------------
// The 9-pitch demo set — deterministic role assignment
// ---------------------------------------------------------------------------

export const ROLE_ORDER = [
  'panorama-1', 'panorama-2',
  'multi-photo-1', 'multi-photo-2', 'multi-photo-3',
  'one-photo-1', 'one-photo-2',
  'no-image-1', 'no-image-2',
];
export const DEMO_SPOT_COUNT = ROLE_ORDER.length; // 9

export const CAPACITIES = [2, 4, 8];

export function priceUnitForIndex(idx) {
  return idx % 2 === 0 ? 'PER_SITE' : 'PER_PERSON';
}

export function capacityForIndex(idx) {
  return CAPACITIES[idx % CAPACITIES.length];
}

/** Ordered (id asc) live spots -> [{ role, spot }] for the first DEMO_SPOT_COUNT. */
export function assignSpotsToRoles(liveSpots) {
  if (liveSpots.length < DEMO_SPOT_COUNT) {
    throw new Error(
      `camp has only ${liveSpots.length} live pitches — need at least ${DEMO_SPOT_COUNT} (selection rule requires >=${MIN_LIVE_PITCHES})`
    );
  }
  return ROLE_ORDER.map((role, idx) => ({ role, spot: liveSpots[idx] }));
}

// ---------------------------------------------------------------------------
// Fixed, deterministic demo content (also the undo identity keys)
// ---------------------------------------------------------------------------

// Real, working Unsplash URLs (same pool CampVibe already seeds camp galleries
// with — scripts/load-mock-staging.mjs). PANORAMA crop ~4.6:1 (2400x520),
// matching a real iPhone wide-strip sweep (CAM-352) — NEVER an equirectangular
// sphere crop, and NEVER a local-filesystem image path (that gitignored
// public directory 404s on staging, .gitignore:72).
export const PANORAMA_URLS = [
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=2400&h=520&fit=crop',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=2400&h=520&fit=crop',
];

export const PHOTO_URL_POOL = [
  'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200',
  'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=1200',
  'https://images.unsplash.com/photo-1487730116645-74489c95b41b?w=1200',
  'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=1200',
  'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=1200',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200',
  'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200',
  'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=1200',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200',
  'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=1200',
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200',
];

export const LONG_NAME =
  'ลานกางเต็นท์ริมธารน้ำใสมองเห็นวิวภูเขาใหญ่และทุ่งดอกไม้ป่ากว้างสุดสายตา ' +
  'ท่ามกลางบรรยากาศธรรมชาติร่มรื่นเงียบสงบ เหมาะสำหรับครอบครัวและกลุ่มเพื่อนสนิท';

export const DEMO_BOOKING_CHECK_IN = new Date('2027-03-10T00:00:00.000Z');
export const DEMO_BOOKING_CHECK_OUT = new Date('2027-03-12T00:00:00.000Z');
export const DEMO_BOOKING_NIGHTS = 2;
export const DEMO_BOOKING_GUESTS = 2;

export const DEMO_BLOCKED_START = new Date('2027-04-01T00:00:00.000Z');
export const DEMO_BLOCKED_END = new Date('2027-04-03T00:00:00.000Z');
export const DEMO_BLOCKED_REASON = 'CAM-663 demo seed — host-blocked for maintenance';

export function neededPhotoCount(role, existingPhotoCount) {
  const target = role.startsWith('multi-photo') ? 3 : role.startsWith('one-photo') ? 1 : 0;
  return Math.max(0, target - existingPhotoCount);
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

/**
 * Reads the chosen camp's zones + live spots and builds the full write plan.
 * Read-only — never mutates. Safe to call twice in a row (dry-run) and get
 * an identical plan back, because it depends only on `id asc` ordering and
 * current DB state, neither of which a dry-run touches.
 */
export async function buildPlan(prisma, camp) {
  const zones = await prisma.zone.findMany({
    where: { campSiteId: camp.id, deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true },
  });
  if (zones.length < MIN_ZONES) {
    throw new Error(`camp ${camp.nameThSlug} has only ${zones.length} live zones — need at least ${MIN_ZONES}`);
  }

  const liveSpots = await prisma.spot.findMany({
    where: { campSiteId: camp.id, deletedAt: null },
    orderBy: { id: 'asc' },
    select: {
      id: true, name: true, priceUnit: true, maxCampers: true, pricePerNight: true, zoneId: true,
      images: { select: { id: true, kind: true, url: true } },
      bookings: { where: { deletedAt: null, status: { not: 'CANCELLED' } }, select: { id: true } },
      blockedDates: { where: { deletedAt: null }, select: { id: true } },
    },
  });

  const assignments = assignSpotsToRoles(liveSpots);

  let photoCursor = 0;
  let panoramaCursor = 0;

  const rows = assignments.map(({ role, spot }, idx) => {
    const existingPhotoCount = spot.images.filter((i) => i.kind === 'PHOTO').length;
    const existingPanoramaCount = spot.images.filter((i) => i.kind === 'PANORAMA').length;

    const imagesToCreate = [];
    if (role.startsWith('panorama') && existingPanoramaCount === 0) {
      imagesToCreate.push({ kind: 'PANORAMA', url: PANORAMA_URLS[panoramaCursor % PANORAMA_URLS.length] });
      panoramaCursor += 1;
    }
    const photosNeeded = neededPhotoCount(role, existingPhotoCount);
    for (let i = 0; i < photosNeeded; i += 1) {
      imagesToCreate.push({ kind: 'PHOTO', url: PHOTO_URL_POOL[photoCursor % PHOTO_URL_POOL.length] });
      photoCursor += 1;
    }

    const isFreeRole = role === 'no-image-2';
    const isLongNameRole = role === 'no-image-1';
    const isBlockedDateRole = role === 'no-image-2';
    const isBookingRole = role === 'one-photo-2';

    return {
      spotId: spot.id,
      role,
      priceUnit: priceUnitForIndex(idx),
      maxCampers: capacityForIndex(idx),
      zoneId: zones[idx % zones.length].id,
      pricePerNight: spot.pricePerNight,
      imagesToCreate,
      setFreePrice: isFreeRole,
      setLongName: isLongNameRole,
      needsBlockedDate: isBlockedDateRole && spot.blockedDates.length === 0,
      alreadyHasBlockedDate: spot.blockedDates.length > 0,
      needsBooking: isBookingRole && spot.bookings.length === 0,
      alreadyHasNonCancelledBooking: spot.bookings.length > 0,
      currentImageCounts: { photo: existingPhotoCount, panorama: existingPanoramaCount },
    };
  });

  return { camp, zones, rows };
}

/** The per-branch count table the done_when checks for. */
export function summarizePlan(plan) {
  const { rows } = plan;
  const bucket = (prefix) => rows.filter((r) => r.role.startsWith(prefix));
  const noImageRows = bucket('no-image');

  return {
    'panorama (2)': bucket('panorama').length,
    'several photos, 3+ each (3)': bucket('multi-photo').length,
    'exactly one photo (2)': bucket('one-photo').length,
    'no image at all (2)': noImageRows.filter((r) => r.currentImageCounts.photo === 0 && r.currentImageCounts.panorama === 0).length,
    'priceUnit = PER_SITE': rows.filter((r) => r.priceUnit === 'PER_SITE').length,
    'priceUnit = PER_PERSON': rows.filter((r) => r.priceUnit === 'PER_PERSON').length,
    'priced 0 (free)': rows.filter((r) => r.setFreePrice).length,
    'distinct capacities (want 2/4/8 = 3)': new Set(rows.map((r) => r.maxCampers)).size,
    'distinct zones (want >=3)': new Set(rows.map((r) => r.zoneId)).size,
    'host BlockedDate on spotId': rows.filter((r) => r.needsBlockedDate || r.alreadyHasBlockedDate).length,
    'existing non-cancelled Booking on spotId': rows.filter((r) => r.needsBooking || r.alreadyHasNonCancelledBooking).length,
    'very long name': rows.filter((r) => r.setLongName).length,
  };
}

export function printPlan(plan, log = console.log) {
  log(
    `chosen camp: ${plan.camp.nameTh} (${plan.camp.nameThSlug})` +
      `${plan.camp.overridden ? ' [--camp override]' : ` completeness score=${plan.camp.score}`}`
  );
  const summary = summarizePlan(plan);
  for (const [label, count] of Object.entries(summary)) {
    log(`  ${label}: ${count}`);
  }
}

// ---------------------------------------------------------------------------
// Apply / undo
// ---------------------------------------------------------------------------

export async function applyPlan(prisma, plan) {
  const created = { images: 0, blockedDates: 0, bookings: 0 };

  for (const row of plan.rows) {
    await prisma.spot.update({
      where: { id: row.spotId },
      data: {
        priceUnit: row.priceUnit,
        maxCampers: row.maxCampers,
        zoneId: row.zoneId,
        ...(row.setFreePrice ? { pricePerNight: 0 } : {}),
        ...(row.setLongName ? { name: LONG_NAME } : {}),
      },
    });

    for (const img of row.imagesToCreate) {
      await prisma.image.create({ data: { spotId: row.spotId, url: img.url, kind: img.kind, alt: null } });
      created.images += 1;
    }

    if (row.needsBlockedDate) {
      await prisma.blockedDate.create({
        data: {
          campSiteId: plan.camp.id,
          spotId: row.spotId,
          startDate: DEMO_BLOCKED_START,
          endDate: DEMO_BLOCKED_END,
          reason: DEMO_BLOCKED_REASON,
        },
      });
      created.blockedDates += 1;
    }

    if (row.needsBooking) {
      const camper = await prisma.user.findFirst({
        where: { role: 'CAMPER', deletedAt: null },
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      if (!camper) {
        throw new Error('no CAMPER user exists on this target — cannot create the demo booking');
      }
      const totalPrice = Number(row.pricePerNight) * DEMO_BOOKING_NIGHTS;
      await prisma.booking.create({
        data: {
          userId: camper.id,
          campSiteId: plan.camp.id,
          spotId: row.spotId,
          checkInDate: DEMO_BOOKING_CHECK_IN,
          checkOutDate: DEMO_BOOKING_CHECK_OUT,
          guests: DEMO_BOOKING_GUESTS,
          totalPrice,
          currency: 'THB',
          status: 'CONFIRMED',
        },
      });
      created.bookings += 1;
    }
  }

  if (!plan.camp.useSpotView) {
    await prisma.campSite.update({ where: { id: plan.camp.id }, data: { useSpotView: true } });
  }

  return created;
}

/** Removes exactly the rows this script's plan would create, by exact identity match. */
export async function undoPlan(prisma, plan) {
  const roleSpotIds = plan.rows.map((r) => r.spotId);
  const demoUrls = [...PANORAMA_URLS, ...PHOTO_URL_POOL];

  const deletedImages = await prisma.image.deleteMany({
    where: { spotId: { in: roleSpotIds }, url: { in: demoUrls } },
  });
  const deletedBookings = await prisma.booking.deleteMany({
    where: { spotId: { in: roleSpotIds }, checkInDate: DEMO_BOOKING_CHECK_IN, checkOutDate: DEMO_BOOKING_CHECK_OUT },
  });
  const deletedBlocked = await prisma.blockedDate.deleteMany({
    where: { spotId: { in: roleSpotIds }, startDate: DEMO_BLOCKED_START, endDate: DEMO_BLOCKED_END },
  });
  await prisma.campSite.update({ where: { id: plan.camp.id }, data: { useSpotView: false } });

  return { images: deletedImages.count, bookings: deletedBookings.count, blockedDates: deletedBlocked.count };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const undo = argv.includes('--undo');
  const campIdx = argv.indexOf('--camp');
  const campSlug = campIdx !== -1 ? argv[campIdx + 1] : undefined;
  return { apply, undo, dryRun: !apply && !undo, campSlug };
}

export async function main() {
  const { apply, undo, campSlug } = parseArgs(process.argv.slice(2));

  const guard = checkGuard();
  if (!guard.ok) {
    console.error(guard.message);
    process.exit(1);
  }
  console.log(`target: ${describeUrlShape(guard.url)}`);

  if (undo && !campSlug) {
    console.error('✗ refusing: --undo requires --camp <nameThSlug> — never auto-select the camp for a destructive undo');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const camp = await pickCamp(prisma, { overrideSlug: campSlug });
    const plan = await buildPlan(prisma, camp);
    printPlan(plan, console.log);

    if (undo) {
      const removed = await undoPlan(prisma, plan);
      console.log(
        `✓ undo complete: removed ${removed.images} image(s), ${removed.bookings} booking(s), ${removed.blockedDates} blocked date(s); useSpotView reset to false`
      );
      return;
    }

    if (apply) {
      const created = await applyPlan(prisma, plan);
      console.log(
        `✓ apply complete: created ${created.images} image(s), ${created.blockedDates} blocked date(s), ${created.bookings} booking(s)`
      );
      return;
    }

    console.log('MODE: DRY RUN — plan computed above, writing NOTHING. Re-run with --apply to write.');
  } catch (err) {
    console.error('✗ failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

// Only auto-run when executed directly — not when imported for its exports
// (tests import pickCamp / buildPlan / summarizePlan / applyPlan / undoPlan / checkGuard directly).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await main();
}
