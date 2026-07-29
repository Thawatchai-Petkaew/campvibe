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
 * this script creates is identified by an exact-match `Spot.createdAt`
 * timestamp (`DEMO_SPOT_CREATED_AT` below) — the same kind of durable,
 * exact-match identity this script already uses for its images (fixed URL
 * pool) and its booking/blockedDate (fixed date range). `createdAt` is
 * genuinely invisible on every camper-facing screen (grep-verified — no
 * component renders a per-pitch "created" date; the only reader is an
 * `orderBy` in `app/api/campsites/[id]/spots/route.ts`, a display-order
 * effect only) — unlike `Spot.name`/`zone`/`environment`/`nearFacilities`/
 * `viewType`, which all render, and `pricePerSite`, a deprecated financial
 * column ADR-014 §5 forbids new readers/writers of. `--undo` finds every
 * row with that exact timestamp and deletes it, in explicit FK order (see
 * undoPlan) — nothing about a real host's pitch is ever read, written, or
 * removed.
 *
 * DEMO PITCH NAMES read like the camp's own inventory, never internal jargon
 * (`.claude/rules/code.md` §4 / `DESIGN.md` ban technical jargon and IDs in
 * user-facing copy — these pitches are shown on a camper-facing screen so
 * the owner can judge how the new pitch UI actually looks). `buildPlan`
 * detects the camp's own `<letter><number>` pitch-naming convention (if any)
 * from its real siblings and picks a letter block NONE of them already use
 * (`pickUnusedLetterBlock`), naming the 9 demo pitches `จุด <letter>1` ..
 * `จุด <letter>9` — collision-free by construction — except exactly ONE
 * (`no-image-1`) which keeps a deliberately long, realistic-sounding name to
 * exercise truncation.
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
 * `useSpotView` currently false (a selection PREFERENCE, not a correctness
 * requirement — see below) · >= MIN_LIVE_PITCHES live spots (a signal of a
 * substantial, real camp to attach demo pitches to) · >= MIN_CAMP_IMAGES
 * camp-gallery images · >= MIN_ZONES live zones · highest completeness score
 * (see COMPLETENESS_FIELDS), tie-broken by id ascending for determinism.
 * `--camp` overrides the rule entirely, including the useSpotView
 * preference — it may deliberately target a camp already in per-spot mode.
 *
 * `useSpotView` AND THE CAPACITY IT DRIVES ARE FULLY REVERSIBLE, REGARDLESS
 * OF THE CHOSEN CAMP'S STARTING STATE. With `useSpotView = true` a camp's
 * effective capacity becomes the SUM of its live spots' capacities
 * (lib/campsite-availability.ts:44, getEffectiveCapacity ->
 * calculateSpotCapacity), so creating 9 demo pitches raises a REAL capacity
 * number the moment `useSpotView` is (or already is) true. `--undo` must
 * restore the flag to whatever it was BEFORE this script ever touched this
 * camp — not unconditionally `false` — because `--undo` always runs as a
 * SEPARATE process from `--apply` (per the usage above), so by the time
 * `--undo` reads the camp, the live `useSpotView` column may already equal
 * either "started false, apply flipped it true" or "started true, apply
 * left it alone" — both look identical (true) at that point, with no way to
 * tell them apart from the CampSite row alone. The original value is
 * recorded once, durably, in the demo BlockedDate's `reason` text at the
 * moment it is first created (`DEMO_BLOCKED_REASON_ORIGIN_*` below) — the
 * same "fixed value = identity marker" idiom already used for the demo
 * image URLs / booking date range — and `undoPlan` reads it back before
 * deleting that row. Rule-based selection preferring `useSpotView=false` is
 * still a reasonable default (a "blank slate" camp for the auto-pick), but
 * it is no longer required for correctness — `--camp` may target either
 * kind of camp and the round-trip is exact either way.
 *
 * IDEMPOTENT BY CONSTRUCTION: buildPlan looks up any already-created demo
 * pitches by their exact `Spot.createdAt` marker before deciding what to
 * create, so re-running (dry-run or apply) always resolves the SAME 9 roles
 * to the SAME rows once they exist (the chosen letter block is itself
 * stable across calls — it is derived only from the REAL siblings, which
 * this script never touches). Every write beyond the initial create is a
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
 * Durable identity marker — every Spot this script creates has EXACTLY this
 * `createdAt` timestamp, and no real pitch (created at its own real time)
 * ever will. `createdAt` is invisible on every camper-facing screen (see the
 * module docstring) — unlike `Spot.name`, which must read like the camp's
 * own inventory (see nameForRole below). `--undo`'s `spot.deleteMany` keys
 * on this exact value; it is the create-side equivalent of the fixed image
 * URLs / fixed booking-date range this script already used for its children.
 */
export const DEMO_SPOT_CREATED_AT = new Date('2027-01-15T00:00:00.000Z');

/** Exactly one deliberately long, realistic-sounding name — exercises truncation. */
export const LONG_NAME =
  'ลานกางเต็นท์ริมธารน้ำใสมองเห็นวิวภูเขาใหญ่และทุ่งดอกไม้ป่ากว้างสุดสายตา ' +
  'ท่ามกลางบรรยากาศธรรมชาติร่มรื่นเงียบสงบ เหมาะสำหรับครอบครัวและกลุ่มเพื่อนสนิท';

// Tried in order until one is NOT already used as a <letter><number> prefix
// by any of the camp's real pitch names — Z first (least likely to collide
// with a real camp's own A/B/C-style zoning), walking down the alphabet.
export const LETTER_POOL = [
  'Z', 'Y', 'X', 'W', 'V', 'U', 'T', 'S', 'R', 'Q', 'P', 'O', 'N',
  'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A',
];

// Matches "A1", "จุด A1", "Zone B12", etc. — any single Latin letter
// immediately followed by digits, anywhere in the name.
const LETTER_BLOCK_PATTERN = /\b([A-Za-z])\d+\b/;

export function extractUsedLetterBlocks(spotNames) {
  const used = new Set();
  for (const name of spotNames) {
    const match = LETTER_BLOCK_PATTERN.exec(name ?? '');
    if (match) used.add(match[1].toUpperCase());
  }
  return used;
}

/**
 * Picks a letter block none of the camp's REAL sibling pitch names already
 * use, so `จุด <letter>1..9` can never collide with a real pitch's name.
 * Falls back through the whole alphabet before giving up (never happens in
 * practice — no camp has all 26 letters as active zoning prefixes).
 */
export function pickUnusedLetterBlock(spotNames) {
  const used = extractUsedLetterBlocks(spotNames);
  for (const letter of LETTER_POOL) {
    if (!used.has(letter)) return letter;
  }
  throw new Error("every letter block A-Z is already used by this camp's real pitch names — cannot pick a collision-free demo block");
}

/** `จุด <letter><1..9>` per role, in the camp's own naming style — except the one deliberately long name. */
export function nameForRole(role, letter) {
  if (role === 'no-image-1') return LONG_NAME;
  const roleIndex = ROLE_ORDER.indexOf(role) + 1; // 1..9
  return `จุด ${letter}${roleIndex}`;
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

// Two fixed reason strings — not just flavour text. Whichever one apply
// writes durably records the camp's useSpotView value at the moment this
// BlockedDate is FIRST created (buildPlan only creates it once — a later
// apply always finds `alreadyHasBlockedDate` true and never rewrites it), so
// undoPlan (a separate process, run after useSpotView may have already been
// flipped) can read it back and know what to restore — see the module
// docstring's useSpotView section for the full reasoning.
export const DEMO_BLOCKED_REASON_ORIGIN_WHOLE_CAMP =
  'CAM-663 demo seed — host-blocked for maintenance (camp started in whole-camp capacity mode)';
export const DEMO_BLOCKED_REASON_ORIGIN_PER_SPOT =
  'CAM-663 demo seed — host-blocked for maintenance (camp started in per-spot capacity mode)';

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
 * columns every real pitch already has populated), the camp's own
 * `<letter><number>` naming convention (to pick a collision-free block), and
 * any demo pitches this script already created (by `DEMO_SPOT_CREATED_AT`),
 * then builds the full write plan. Read-only — never mutates, and never
 * reads/touches a real pitch beyond copying 3 display fields + its name
 * pattern. Safe to call twice in a row (dry-run) and get an identical plan
 * back.
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
  // source for viewType/environment/nearFacilities realism AND the letter-
  // block collision check, never for price/capacity/zone, and never mutated.
  const siblings = await prisma.spot.findMany({
    where: { campSiteId: camp.id, deletedAt: null, createdAt: { not: DEMO_SPOT_CREATED_AT } },
    orderBy: { id: 'asc' },
    select: { name: true, viewType: true, environment: true, nearFacilities: true },
  });
  if (siblings.length === 0) {
    throw new Error(`camp ${camp.nameThSlug} has no real sibling pitch to copy viewType/environment/nearFacilities from`);
  }
  const letter = pickUnusedLetterBlock(siblings.map((s) => s.name));

  // Already-created demo pitches from a prior apply, matched back to their
  // role by exact name (nameForRole is a pure function of role + the SAME
  // letter recomputed above — stable across calls because it only depends
  // on the real siblings, which this script never touches).
  const existingDemoSpots = await prisma.spot.findMany({
    where: { campSiteId: camp.id, deletedAt: null, createdAt: DEMO_SPOT_CREATED_AT },
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
    const name = nameForRole(role, letter);
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
      // Only meaningful when needsBlockedDate is true (i.e. the very first
      // apply for this camp) — camp.useSpotView here is the CURRENT value at
      // this exact moment, which is the true original precisely because
      // nothing has mutated it yet this invocation.
      blockedDateReason: camp.useSpotView ? DEMO_BLOCKED_REASON_ORIGIN_PER_SPOT : DEMO_BLOCKED_REASON_ORIGIN_WHOLE_CAMP,
      alreadyHasBlockedDate,
      needsBooking: isBookingRole && !alreadyHasNonCancelledBooking,
      alreadyHasNonCancelledBooking,
      currentImageCounts: { photo: existingPhotoCount, panorama: existingPanoramaCount },
    };
  });

  return { camp, zones, rows, letter };
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
    'very long name': rows.filter((r) => r.name === LONG_NAME).length,
    'new pitches to create': rows.filter((r) => r.isNewSpot).length,
  };
}

export function printPlan(plan, log = console.log) {
  log(
    `chosen camp: ${plan.camp.nameTh} (${plan.camp.nameThSlug})` +
      `${plan.camp.overridden ? ' [--camp override]' : ` completeness score=${plan.camp.score}`}` +
      `${plan.camp.useSpotView ? ' [useSpotView currently true]' : ' [useSpotView currently false]'}` +
      ` [letter block: ${plan.letter}]`
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
          createdAt: DEMO_SPOT_CREATED_AT, // the durable, camper-invisible identity marker
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
          reason: row.blockedDateReason,
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
 * Removes exactly the pitches this script created (by the exact
 * `DEMO_SPOT_CREATED_AT` marker) and everything attached to them — never a
 * real host's pitch/booking/blocked date. HARD delete, deliberately, not
 * soft (`deletedAt`): these rows have no real booking/host history worth
 * preserving (this script is their entire lifecycle, create to delete),
 * and a soft-deleted phantom row left
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
    where: { campSiteId: plan.camp.id, deletedAt: null, createdAt: DEMO_SPOT_CREATED_AT },
    select: { id: true },
  });
  const demoSpotIds = demoSpots.map((s) => s.id);

  let removedImages = 0;
  let removedBookings = 0;
  let removedBlocked = 0;
  let removedSpots = 0;

  if (demoSpotIds.length === 0) {
    // Nothing this script ever created exists — never touch useSpotView (a
    // no-op undo must leave a real host's flag exactly as it found it).
    return { spots: 0, images: 0, bookings: 0, blockedDates: 0 };
  }

  // Recover the camp's useSpotView value from BEFORE this script ever
  // touched it, by reading the durable marker recorded in the demo
  // BlockedDate's `reason` at apply time (see the module docstring's
  // useSpotView section + the DEMO_BLOCKED_REASON_ORIGIN_* constants) —
  // BEFORE deleting that row. Falls back to `false` only if no such row
  // exists (e.g. apply crashed before creating it) — the same safe default
  // rule-based selection already guarantees for its own picks.
  const marker = await prisma.blockedDate.findFirst({
    where: { spotId: { in: demoSpotIds }, startDate: DEMO_BLOCKED_START, endDate: DEMO_BLOCKED_END },
    select: { reason: true },
  });
  const restoreUseSpotView = marker ? marker.reason === DEMO_BLOCKED_REASON_ORIGIN_PER_SPOT : false;

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

  await prisma.campSite.update({ where: { id: plan.camp.id }, data: { useSpotView: restoreUseSpotView } });

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
        `✓ undo complete: removed ${removed.spots} pitch(es), ${removed.images} image(s), ${removed.bookings} booking(s), ${removed.blockedDates} blocked date(s); useSpotView restored to its original value`
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
