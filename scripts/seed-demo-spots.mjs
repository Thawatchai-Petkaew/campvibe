#!/usr/bin/env node
/**
 * scripts/seed-demo-spots.mjs — CAM-663
 *
 * Staging has 3,006 pitches across 783 camps, but only 2 images attached to
 * pitches in the whole database and only 2 camps have per-pitch mode
 * (`useSpotView`) on. CAM-664's UI work has almost nothing real to render.
 * This script picks ONE real, published camp on STAGING and CREATES 9 brand
 * new demo pitches on it — it never mutates an existing pitch — so every UI
 * branch a spot-detail screen must handle has a real example: a wide
 * panorama, several photos, exactly one photo, no image at all (the
 * dominant real state), PER_SITE vs PER_PERSON pricing, a free pitch, mixed
 * capacities, multiple zones, a host-blocked date, an existing booking, and
 * a very long name.
 *
 * REVERSIBLE BY CONSTRUCTION (design change from an earlier draft of this
 * script that mutated 9 real pitches in place — the coordinator caught this
 * before it ran: mutating real host data with no recorded "before" value is
 * not reversible, no matter how the undo path is written). Every demo pitch
 * this script creates carries the DEMO_NAME_PREFIX marker in `Spot.name` —
 * the same kind of durable, exact-match identity this script already uses
 * for its images (fixed URL pool) and its booking/blockedDate (fixed date
 * range). `--undo` finds every row with that marker and deletes it, in
 * explicit FK order (see undoPlan) — nothing about a real host's pitch is
 * ever read, written, or removed.
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
 * `useSpotView` currently false (see below) · >= MIN_LIVE_PITCHES live
 * spots (a signal of a substantial, real camp to attach demo pitches to) ·
 * >= MIN_CAMP_IMAGES camp-gallery images · >= MIN_ZONES live zones ·
 * highest completeness score (see COMPLETENESS_FIELDS), tie-broken by id
 * ascending for determinism. `--camp` overrides the rule entirely (and may
 * target a camp already in per-spot mode — see the useSpotView note below).
 *
 * WHY `useSpotView` must be false for rule-based selection: with
 * `useSpotView = true` a camp's effective capacity becomes the SUM of its
 * live spots' capacities (lib/campsite-availability.ts:44,
 * getEffectiveCapacity -> calculateSpotCapacity). Adding 9 demo pitches
 * therefore raises a REAL capacity number the moment this script flips the
 * flag on; undoing it (deleting the 9 pitches + resetting the flag) lowers
 * it back to exactly what it was. That symmetry only holds cleanly when
 * this script is the one who turned the flag on in the first place — hence
 * the rule excludes camps already running per-spot mode, so apply/undo is
 * always an unambiguous round-trip. `--camp` can still target one of those
 * 2 camps deliberately; in that case `--undo` will turn `useSpotView` off
 * even though this script did not turn it on — a printed warning covers
 * that case (see main()).
 *
 * IDEMPOTENT BY CONSTRUCTION: buildPlan looks up any already-created demo
 * pitches by their exact `DEMO_NAME_PREFIX + role label` name (computed by
 * nameForRole, a pure function of the role) before deciding what to create,
 * so re-running (dry-run or apply) always resolves the SAME 9 roles to the
 * SAME rows once they exist. Every write beyond the initial create is a
 * "top up to target state" check (does this pitch already have a panorama /
 * >=3 photos / >=1 photo / a live BlockedDate / a live non-cancelled
 * Booking?) — so a second --apply run creates zero additional rows.
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
 * Rule-based camp selection: published + deletedAt null + useSpotView
 * currently false (see the module docstring's capacity-symmetry note) +
 * meets the 3 hard minimums, then the highest completeness score,
 * tie-broken by id ascending (deterministic — never changes run to run for
 * the same DB state). `overrideSlug` (nameThSlug) bypasses the rule
 * entirely, including the useSpotView check.
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
    where: { isPublished: true, deletedAt: null, useSpotView: false },
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
      `no camp on this target matches the selection rule (published, useSpotView=false, >=${MIN_LIVE_PITCHES} live pitches, >=${MIN_CAMP_IMAGES} camp images, >=${MIN_ZONES} zones)`
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
// The 9-pitch demo set — deterministic roles, created (never mutated) rows
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

/**
 * Durable identity marker — every Spot this script creates has a `name`
 * starting with this prefix, and ONLY rows this script creates ever will
 * (no real host names a pitch this way). `--undo`'s `spot.deleteMany` keys
 * on this prefix; it is the create-side equivalent of the fixed image
 * URLs / fixed booking-date range this script already used for its
 * children before this design change.
 */
export const DEMO_NAME_PREFIX = 'CAM-663 Demo — ';

export const LONG_NAME =
  'ลานกางเต็นท์ริมธารน้ำใสมองเห็นวิวภูเขาใหญ่และทุ่งดอกไม้ป่ากว้างสุดสายตา ' +
  'ท่ามกลางบรรยากาศธรรมชาติร่มรื่นเงียบสงบ เหมาะสำหรับครอบครัวและกลุ่มเพื่อนสนิท';

/** Short, realistic Thai label per role — prefixed with DEMO_NAME_PREFIX to form the full Spot.name. */
export const ROLE_LABELS = {
  'panorama-1': 'จุดวิวพาโนราม่า 1',
  'panorama-2': 'จุดวิวพาโนราม่า 2',
  'multi-photo-1': 'จุดกางเต็นท์ (หลายรูป) 1',
  'multi-photo-2': 'จุดกางเต็นท์ (หลายรูป) 2',
  'multi-photo-3': 'จุดกางเต็นท์ (หลายรูป) 3',
  'one-photo-1': 'จุดกางเต็นท์ (รูปเดียว) 1',
  'one-photo-2': 'จุดกางเต็นท์ (มีการจองอยู่แล้ว)',
  'no-image-1': LONG_NAME,
  'no-image-2': 'จุดกางเต็นท์ (โฮสต์ปิด, ฟรี)',
};

export function nameForRole(role) {
  return `${DEMO_NAME_PREFIX}${ROLE_LABELS[role]}`;
}

export const DEMO_PRICE_PER_NIGHT = 500;

export function priceForRole(role) {
  return role === 'no-image-2' ? 0 : DEMO_PRICE_PER_NIGHT;
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
 * Reads the chosen camp's zones, a real sibling pitch's viewType/environment/
 * nearFacilities (so created rows "look native" instead of carrying nulls in
 * columns every real pitch already has populated), and any demo pitches this
 * script already created (by DEMO_NAME_PREFIX), then builds the full write
 * plan. Read-only — never mutates, and never reads/touches a real pitch
 * beyond copying those 3 display fields from one. Safe to call twice in a
 * row (dry-run) and get an identical plan back.
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

  // Real siblings only (excludes any pitch this script already created) — the
  // source for viewType/environment/nearFacilities realism, never for
  // price/capacity/zone/name, and never mutated.
  const siblings = await prisma.spot.findMany({
    where: { campSiteId: camp.id, deletedAt: null, name: { not: { startsWith: DEMO_NAME_PREFIX } } },
    orderBy: { id: 'asc' },
    select: { viewType: true, environment: true, nearFacilities: true },
  });
  if (siblings.length === 0) {
    throw new Error(`camp ${camp.nameThSlug} has no real sibling pitch to copy viewType/environment/nearFacilities from`);
  }

  // Already-created demo pitches from a prior apply, matched back to their
  // role by exact name (nameForRole is a pure function of the role).
  const existingDemoSpots = await prisma.spot.findMany({
    where: { campSiteId: camp.id, deletedAt: null, name: { startsWith: DEMO_NAME_PREFIX } },
    select: {
      id: true, name: true,
      images: { select: { id: true, kind: true, url: true } },
      bookings: { where: { deletedAt: null, status: { not: 'CANCELLED' } }, select: { id: true } },
      blockedDates: { where: { deletedAt: null }, select: { id: true } },
    },
  });
  const existingByName = new Map(existingDemoSpots.map((s) => [s.name, s]));

  let photoCursor = 0;
  let panoramaCursor = 0;

  const rows = ROLE_ORDER.map((role, idx) => {
    const name = nameForRole(role);
    const existing = existingByName.get(name) ?? null;
    const sibling = siblings[idx % siblings.length];

    const existingPhotoCount = existing ? existing.images.filter((i) => i.kind === 'PHOTO').length : 0;
    const existingPanoramaCount = existing ? existing.images.filter((i) => i.kind === 'PANORAMA').length : 0;

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

    const isBlockedDateRole = role === 'no-image-2';
    const isBookingRole = role === 'one-photo-2';
    const alreadyHasBlockedDate = existing ? existing.blockedDates.length > 0 : false;
    const alreadyHasNonCancelledBooking = existing ? existing.bookings.length > 0 : false;

    return {
      role,
      name,
      spotId: existing ? existing.id : null, // null = needs prisma.spot.create
      isNewSpot: !existing,
      priceUnit: priceUnitForIndex(idx),
      maxCampers: capacityForIndex(idx),
      pricePerNight: priceForRole(role),
      zoneId: zones[idx % zones.length].id,
      viewType: sibling.viewType,
      environment: sibling.environment,
      nearFacilities: sibling.nearFacilities,
      imagesToCreate,
      needsBlockedDate: isBlockedDateRole && !alreadyHasBlockedDate,
      alreadyHasBlockedDate,
      needsBooking: isBookingRole && !alreadyHasNonCancelledBooking,
      alreadyHasNonCancelledBooking,
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
    'priced 0 (free)': rows.filter((r) => r.pricePerNight === 0).length,
    'distinct capacities (want 2/4/8 = 3)': new Set(rows.map((r) => r.maxCampers)).size,
    'distinct zones (want >=3)': new Set(rows.map((r) => r.zoneId)).size,
    'host BlockedDate on spotId': rows.filter((r) => r.needsBlockedDate || r.alreadyHasBlockedDate).length,
    'existing non-cancelled Booking on spotId': rows.filter((r) => r.needsBooking || r.alreadyHasNonCancelledBooking).length,
    'very long name': rows.filter((r) => r.name === nameForRole('no-image-1')).length,
    'new pitches to create': rows.filter((r) => r.isNewSpot).length,
  };
}

export function printPlan(plan, log = console.log) {
  log(
    `chosen camp: ${plan.camp.nameTh} (${plan.camp.nameThSlug})` +
      `${plan.camp.overridden ? ' [--camp override]' : ` completeness score=${plan.camp.score}`}` +
      `${plan.camp.useSpotView ? ' [useSpotView already true — undo will still turn it off]' : ''}`
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
  const created = { spots: 0, images: 0, blockedDates: 0, bookings: 0 };

  for (const row of plan.rows) {
    let spotId = row.spotId;
    if (!spotId) {
      const spot = await prisma.spot.create({
        data: {
          campSiteId: plan.camp.id,
          name: row.name,
          priceUnit: row.priceUnit,
          maxCampers: row.maxCampers,
          pricePerNight: row.pricePerNight,
          zoneId: row.zoneId,
          viewType: row.viewType,
          environment: row.environment,
          nearFacilities: row.nearFacilities,
        },
      });
      spotId = spot.id;
      created.spots += 1;
    }

    for (const img of row.imagesToCreate) {
      await prisma.image.create({ data: { spotId, url: img.url, kind: img.kind, alt: null } });
      created.images += 1;
    }

    if (row.needsBlockedDate) {
      await prisma.blockedDate.create({
        data: {
          campSiteId: plan.camp.id,
          spotId,
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
          spotId,
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

/**
 * Removes exactly the pitches this script created (by DEMO_NAME_PREFIX) and
 * everything attached to them — never a real host's pitch/booking/blocked
 * date. HARD delete, deliberately, not soft (`deletedAt`): these rows have
 * no real booking/host history worth preserving (this script is their
 * entire lifecycle, create to delete), and a soft-deleted phantom row left
 * behind forever would be residue undo is supposed to remove. Either choice
 * leaves `getEffectiveCapacity`/`calculateSpotCapacity` computing the same
 * number (both filter `deletedAt: null` — lib/spot-aggregation.ts:46) — hard
 * delete additionally leaves the `Spot` table itself clean.
 *
 * Explicit FK-order delete, not cascade, because the two FKs behave
 * DIFFERENTLY (verified in prisma/migrations, not assumed):
 *   - Image.spotId    -> ON DELETE CASCADE   (20260621121000_s4b_image_table)
 *   - Booking.spotId  -> ON DELETE SET NULL  (20260620112306_init)
 *   - BlockedDate.spotId -> ON DELETE SET NULL (20260621113624_s7_roadmap_entities)
 * Only Image would actually cascade; Booking/BlockedDate would survive as
 * orphaned NULL-spotId rows if we just deleted the Spot. So every child is
 * deleted explicitly, in FK order, before the Spot row itself.
 */
export async function undoPlan(prisma, plan) {
  const demoSpots = await prisma.spot.findMany({
    where: { campSiteId: plan.camp.id, deletedAt: null, name: { startsWith: DEMO_NAME_PREFIX } },
    select: { id: true },
  });
  const demoSpotIds = demoSpots.map((s) => s.id);

  let removedImages = 0;
  let removedBookings = 0;
  let removedBlocked = 0;
  let removedSpots = 0;

  if (demoSpotIds.length > 0) {
    removedBookings = (
      await prisma.booking.deleteMany({
        where: { spotId: { in: demoSpotIds }, checkInDate: DEMO_BOOKING_CHECK_IN, checkOutDate: DEMO_BOOKING_CHECK_OUT },
      })
    ).count;
    removedBlocked = (
      await prisma.blockedDate.deleteMany({
        where: { spotId: { in: demoSpotIds }, startDate: DEMO_BLOCKED_START, endDate: DEMO_BLOCKED_END },
      })
    ).count;
    removedImages = (
      await prisma.image.deleteMany({ where: { spotId: { in: demoSpotIds } } })
    ).count;
    removedSpots = (await prisma.spot.deleteMany({ where: { id: { in: demoSpotIds } } })).count;
  }

  await prisma.campSite.update({ where: { id: plan.camp.id }, data: { useSpotView: false } });

  return { spots: removedSpots, images: removedImages, bookings: removedBookings, blockedDates: removedBlocked };
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
        `✓ undo complete: removed ${removed.spots} pitch(es), ${removed.images} image(s), ${removed.bookings} booking(s), ${removed.blockedDates} blocked date(s); useSpotView reset to false`
      );
      return;
    }

    if (apply) {
      const created = await applyPlan(prisma, plan);
      console.log(
        `✓ apply complete: created ${created.spots} pitch(es), ${created.images} image(s), ${created.blockedDates} blocked date(s), ${created.bookings} booking(s)`
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
