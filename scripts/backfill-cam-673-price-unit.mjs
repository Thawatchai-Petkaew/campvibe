#!/usr/bin/env node
/**
 * scripts/backfill-cam-673-price-unit.mjs — CAM-673
 *
 * The owner's instruction, 2026-07-30: most Thai camps charge PER PERSON per
 * night, not a flat per-site rate. `CampSite.priceUnit` / `Spot.priceUnit`
 * (ADR-014, CAM-650) both default every existing row to `PER_SITE` — the
 * CAM-650 migration deliberately chose that default so the migration itself
 * moved no money (today's booking math IS per-site, ADR-014 §2). This script
 * is the follow-up that finally MOVES the population, on purpose: roughly
 * 95% of camps become `PER_PERSON`, roughly 5% stay `PER_SITE` (a flat
 * nightly price regardless of party size) — applied to a camp whether or
 * not it is divided into pitches.
 *
 * Existing bookings are unaffected: a booking snapshots
 * `Booking.snapshotPricingUnit`/`snapshotQuantity` at creation time (ADR-005
 * crystallization) and this script never writes to `Booking` — a host
 * changing `priceUnit` after the fact never touches a historical booking's
 * total, exactly as ADR-014 §4 requires.
 *
 * WHICH ROWS ARE CANDIDATES — deliberately conservative, narrower than "every
 * row": a `CampSite` (or `Spot`) is only a candidate for this backfill if its
 * CURRENT value is still exactly `PER_SITE` (the untouched CAM-650 migration
 * default). `components/CampgroundForm.tsx` and `components/spot-form-
 * dialog.tsx` already ship a live host-facing `priceUnit` picker (new camps
 * default to `PER_PERSON` there), so by the time this runs some rows may no
 * longer be at the untouched default — a real host may have already told the
 * platform what they meant. Overwriting an already-diverged row on the
 * strength of a hash would silently reverse a host's own deliberate choice,
 * which is exactly the harm ADR-014's Alternative (b) refused for
 * `Spot.pricePerSite` ("change totals for camps whose hosts never said
 * anything at all") — the same reasoning applies here, the other direction.
 * A row that is NOT `PER_SITE` today is left exactly as it is and reported
 * separately (never counted as "skipped-because-demo").
 *
 * A PITCH FOLLOWS ITS OWN CAMP'S EFFECTIVE UNIT (not an independent hash of
 * the spot's own id) — a camp quoting per person whose pitches quote per
 * site would read as a bug to a camper. "Effective" camp unit = the target
 * this script assigns if the camp itself is a candidate, otherwise the
 * camp's own current (already-diverged) value. A pitch is only rewritten
 * when BOTH (a) the pitch's own current value is still the untouched
 * `PER_SITE` default AND (b) that default disagrees with the camp's
 * effective unit — so a host's deliberate PER-SPOT override (`Spot.priceUnit`
 * "overrides CampSite.priceUnit when this spot is booked", schema comment)
 * is never clobbered either.
 *
 * DETERMINISTIC SELECTION (never randomness): `selectPriceUnitForId` hashes
 * the row's own id with sha256, reads the first 4 bytes as an unsigned
 * 32-bit big-endian integer, and normalizes to [0, 1). Below
 * PER_SITE_FRACTION (0.05) => PER_SITE, otherwise PER_PERSON. sha256 output
 * is uniformly distributed over its input space, so the same id always
 * produces the same verdict (stable across a dry-run, the later apply, and
 * any re-run — no reshuffle), and the fraction that lands on PER_SITE
 * approaches 5% as the population grows (proven directly against a
 * synthetic population in the test suite — no DB round trip needed, this is
 * a pure function of the id string).
 *
 * THE CAM-663 DEMO CAMP IS NEVER TOUCHED. `koh-tao-under-stars-31-th`
 * (scripts/seed-demo-spots.mjs, docs/RUNBOOK-demo-spot-seed.md) carries a
 * deliberately MIXED PER_SITE/PER_PERSON set on its demo pitches so the
 * pitch-detail UI (CAM-664) has every branch to render. Reassigning its
 * pitches via the hash would destroy that fixture. This script excludes the
 * camp by `nameThSlug` before computing anything else and reports the skip.
 *
 * SAFETY GUARD — refuses unless DATABASE_URL is set and does not look like
 * production (mirrors scripts/db-reset.mjs / scripts/backfill-cam-575-
 * reconcile-coordinates.mjs / scripts/backfill-cam-536-accommodation-codes.mjs
 * — the same "looksProd" heuristic used across this repo's non-destructive-
 * env backfills). Unlike scripts/db-sync-from-staging.mjs's guard (which
 * compares two DIFFERENT urls, one required local + one required remote),
 * this script has a single DATABASE_URL that must be allowed to be EITHER
 * local dev OR staging — only production is refused. Logs only
 * scheme+hostname via describeUrlShape (scripts/db-reset.mjs), never the
 * full connection string / any query-string secret (CAM-359/CAM-369).
 *
 * SAFETY — default mode is DRY RUN (prints the plan, writes nothing).
 * Writing requires the explicit `--apply` flag; `--undo` restores every row
 * THIS SCRIPT changed back to `PER_SITE`, and, like `--apply`, is an
 * explicit flag, never inferred.
 *
 * HOW UNDO KNOWS WHICH ROWS IT CHANGED (no schema column allowed here — this
 * is a data backfill, not a migration): a live host-facing `priceUnit`
 * picker already exists (see above), so "current value is not PER_SITE"
 * does NOT mean "this script changed it" — it may mean a host chose that
 * value before this script ever ran. `undoPlan` cannot safely infer intent
 * from the live DB state alone — that was the exact bug a Prove-It test
 * caught while building this script: an early draft reverted an already-
 * diverged, host-set row back to PER_SITE, which must never happen. Instead,
 * `--apply` records the EXACT campId/spotId set it wrote to a small manifest
 * file (`os.tmpdir()`, same idiom as scripts/backfill-cam-562-subdistrict-
 * geocode.mjs's frozen geocode cache), and `--undo` reverts ONLY the ids
 * listed there — an exact-match restore, never a re-scan-and-guess.
 * Re-running `--apply` merges newly touched ids into the existing manifest
 * (union, not overwrite) so a later `--undo` still knows about everything
 * ever touched across multiple apply runs; a successful `--undo` clears the
 * manifest (nothing left outstanding to revert).
 *
 * IDEMPOTENT BY CONSTRUCTION: `buildPlan` is read-only and its target unit
 * is a pure function of ids already in the database, so calling it twice
 * with no write in between always returns an identical plan. `applyPlan`
 * only writes a row whose transformed value actually differs from what is
 * stored, so a second `--apply` updates zero additional rows.
 *
 * Usage:
 *   DATABASE_URL=<local-dev-or-staging> node scripts/backfill-cam-673-price-unit.mjs                 # dry run (default)
 *   DATABASE_URL=<local-dev-or-staging> node scripts/backfill-cam-673-price-unit.mjs --dry-run        # same, explicit
 *   DATABASE_URL=<local-dev-or-staging> node scripts/backfill-cam-673-price-unit.mjs --apply          # write for real
 *   DATABASE_URL=<local-dev-or-staging> node scripts/backfill-cam-673-price-unit.mjs --undo            # revert every row this script changed back to PER_SITE
 *
 * NEVER run against production DB.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';
import { describeUrlShape } from './db-reset.mjs';

// ---------------------------------------------------------------------------
// Guard — refuses production; local dev and staging are both allowed here.
// ---------------------------------------------------------------------------

export function checkGuard() {
  const url = process.env.DATABASE_URL || '';
  if (!url) {
    return { ok: false, message: '✗ refusing: DATABASE_URL is not set' };
  }
  const looksProd =
    /prod/i.test(url) ||
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production';
  if (looksProd) {
    return {
      ok: false,
      message: '✗ refusing: target looks like PRODUCTION — this backfill is local-dev/staging only',
    };
  }
  return { ok: true, url };
}

// ---------------------------------------------------------------------------
// Deterministic selection — ~5% PER_SITE / ~95% PER_PERSON, by a stable hash
// of the row's own id. Pure function: no DB, no randomness, same input
// always produces the same output.
// ---------------------------------------------------------------------------

export const PER_SITE_FRACTION = 0.05;

/** sha256(id) -> first 4 bytes read as an unsigned 32-bit big-endian int -> [0, 1). */
export function hashIdToUnitInterval(id) {
  const digest = createHash('sha256').update(String(id)).digest();
  const n = digest.readUInt32BE(0); // 0 .. 0xffffffff
  return n / 0x100000000; // normalize to [0, 1)
}

/** Below `fraction` => PER_SITE, otherwise PER_PERSON. Deterministic, stable across calls. */
export function selectPriceUnitForId(id, fraction = PER_SITE_FRACTION) {
  return hashIdToUnitInterval(id) < fraction ? 'PER_SITE' : 'PER_PERSON';
}

// ---------------------------------------------------------------------------
// CAM-663 demo-camp fixture — never touched (see module docstring).
// ---------------------------------------------------------------------------

export const DEMO_CAMP_SLUG_TH = 'koh-tao-under-stars-31-th';

// ---------------------------------------------------------------------------
// Undo manifest — records exactly which ids --apply wrote to, so --undo can
// revert an EXACT set instead of re-scanning the live DB and guessing intent
// (see module docstring "HOW UNDO KNOWS WHICH ROWS IT CHANGED"). Same
// os.tmpdir() + env-override idiom as scripts/backfill-cam-562-subdistrict-
// geocode.mjs's frozen geocode cache.
// ---------------------------------------------------------------------------

export const MANIFEST_FILE =
  process.env.CAM_673_MANIFEST_FILE || join(tmpdir(), 'cam-673-price-unit-backfill-manifest.json');

export function loadManifest(file = MANIFEST_FILE) {
  if (!existsSync(file)) return { campIds: [], spotIds: [] };
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    return {
      campIds: Array.isArray(raw.campIds) ? raw.campIds : [],
      spotIds: Array.isArray(raw.spotIds) ? raw.spotIds : [],
    };
  } catch {
    // A corrupt/unreadable manifest is treated as "nothing recorded yet" —
    // never guessed from the live DB (see docstring).
    return { campIds: [], spotIds: [] };
  }
}

export function saveManifest(manifest, file = MANIFEST_FILE) {
  writeFileSync(file, JSON.stringify(manifest), 'utf8');
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

/**
 * Reads every live (non-deleted) CampSite and its live Spots, excludes the
 * CAM-663 demo camp entirely, and computes a target for every remaining row.
 * Read-only — never mutates. Safe to call twice in a row and get an
 * identical plan back (both the hash target and the "is this row still at
 * the untouched default" check are pure functions of already-stored data).
 */
export async function buildPlan(prisma) {
  const camps = await prisma.campSite.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      nameThSlug: true,
      priceUnit: true,
      spots: { where: { deletedAt: null }, select: { id: true, priceUnit: true } },
    },
    orderBy: { id: 'asc' },
  });

  const rows = [];
  let skippedDemoCamp = null;

  for (const camp of camps) {
    if (camp.nameThSlug === DEMO_CAMP_SLUG_TH) {
      skippedDemoCamp = {
        campId: camp.id,
        nameThSlug: camp.nameThSlug,
        spotCount: camp.spots.length,
      };
      continue;
    }

    const campEligible = camp.priceUnit === 'PER_SITE';
    const campTargetUnit = selectPriceUnitForId(camp.id);
    // The unit the camp will actually carry once this backfill runs — its
    // hash target if it's still at the untouched default, otherwise
    // whatever it already is (a real host/form choice, left alone).
    const effectiveCampUnit = campEligible ? campTargetUnit : camp.priceUnit;
    const campNeedsUpdate = campEligible && campTargetUnit !== camp.priceUnit;

    const spots = camp.spots.map((spot) => {
      const spotEligible = spot.priceUnit === 'PER_SITE';
      const spotNeedsUpdate = spotEligible && spot.priceUnit !== effectiveCampUnit;
      return {
        id: spot.id,
        currentUnit: spot.priceUnit,
        eligible: spotEligible,
        targetUnit: effectiveCampUnit,
        needsUpdate: spotNeedsUpdate,
      };
    });

    rows.push({
      campId: camp.id,
      nameThSlug: camp.nameThSlug,
      currentUnit: camp.priceUnit,
      eligible: campEligible,
      targetUnit: effectiveCampUnit,
      needsUpdate: campNeedsUpdate,
      spots,
    });
  }

  return { rows, skippedDemoCamp };
}

/** The per-branch count table the report + done_when check reads. */
export function summarizePlan(plan) {
  const { rows, skippedDemoCamp } = plan;

  const totalCamps = rows.length;
  const campsUpdated = rows.filter((r) => r.needsUpdate).length;
  const campsAlreadyNonDefault = rows.filter((r) => !r.eligible).length;
  const resultPerPersonCamps = rows.filter((r) => r.targetUnit === 'PER_PERSON').length;
  const resultPerSiteCamps = rows.filter((r) => r.targetUnit === 'PER_SITE').length;

  const allSpots = rows.flatMap((r) => r.spots);
  const totalSpots = allSpots.length;
  const spotsUpdated = allSpots.filter((s) => s.needsUpdate).length;
  const spotsAlreadyNonDefault = allSpots.filter((s) => !s.eligible).length;
  const resultPerPersonSpots = allSpots.filter((s) => s.targetUnit === 'PER_PERSON').length;
  const resultPerSiteSpots = allSpots.filter((s) => s.targetUnit === 'PER_SITE').length;

  const pct = (n, total) => (total === 0 ? '0.0' : ((n / total) * 100).toFixed(1));

  return {
    totalCamps,
    campsUpdated,
    campsAlreadyNonDefault,
    resultPerPersonCamps,
    resultPerSiteCamps,
    resultPerPersonCampsPct: pct(resultPerPersonCamps, totalCamps),
    resultPerSiteCampsPct: pct(resultPerSiteCamps, totalCamps),
    totalSpots,
    spotsUpdated,
    spotsAlreadyNonDefault,
    resultPerPersonSpots,
    resultPerSiteSpots,
    resultPerPersonSpotsPct: pct(resultPerPersonSpots, totalSpots),
    resultPerSiteSpotsPct: pct(resultPerSiteSpots, totalSpots),
    skippedDemoCamp,
  };
}

export function printPlan(plan, log = console.log) {
  const s = summarizePlan(plan);

  log(`camps considered: ${s.totalCamps} (excludes the CAM-663 demo-camp fixture, see below)`);
  log(`  camps to update now: ${s.campsUpdated}`);
  log(`  camps left alone (already NOT PER_SITE — an existing host/form choice, not the untouched default): ${s.campsAlreadyNonDefault}`);
  log(`  resulting split: PER_PERSON=${s.resultPerPersonCamps} (${s.resultPerPersonCampsPct}%)  PER_SITE=${s.resultPerSiteCamps} (${s.resultPerSiteCampsPct}%)`);

  log(`pitches considered: ${s.totalSpots}`);
  log(`  pitches to update now: ${s.spotsUpdated}`);
  log(`  pitches left alone (already NOT PER_SITE — an existing host/per-spot override, not the untouched default): ${s.spotsAlreadyNonDefault}`);
  log(`  resulting split: PER_PERSON=${s.resultPerPersonSpots} (${s.resultPerPersonSpotsPct}%)  PER_SITE=${s.resultPerSiteSpots} (${s.resultPerSiteSpotsPct}%)`);

  if (s.skippedDemoCamp) {
    log(
      `skipped 1 camp + ${s.skippedDemoCamp.spotCount} pitch(es): CAM-663 demo camp "${s.skippedDemoCamp.nameThSlug}" — carries a deliberately mixed PER_SITE/PER_PERSON set so the pitch UI has every branch to render; left completely untouched`
    );
  } else {
    log(`skipped (CAM-663 demo camp): 0 — "${DEMO_CAMP_SLUG_TH}" is not present on this target`);
  }
}

// ---------------------------------------------------------------------------
// Apply / undo
// ---------------------------------------------------------------------------

/**
 * Writes the plan's needs-update rows, then merges exactly the ids it wrote
 * into the undo manifest (union with whatever was already recorded there —
 * a re-run never loses an earlier apply's record).
 */
export async function applyPlan(prisma, plan, { manifestFile = MANIFEST_FILE } = {}) {
  let campsUpdated = 0;
  let spotsUpdated = 0;
  const touchedCampIds = [];
  const touchedSpotIds = [];

  for (const row of plan.rows) {
    if (row.needsUpdate) {
      await prisma.campSite.update({ where: { id: row.campId }, data: { priceUnit: row.targetUnit } });
      campsUpdated += 1;
      touchedCampIds.push(row.campId);
    }
    for (const spot of row.spots) {
      if (spot.needsUpdate) {
        await prisma.spot.update({ where: { id: spot.id }, data: { priceUnit: spot.targetUnit } });
        spotsUpdated += 1;
        touchedSpotIds.push(spot.id);
      }
    }
  }

  if (touchedCampIds.length > 0 || touchedSpotIds.length > 0) {
    const existing = loadManifest(manifestFile);
    saveManifest(
      {
        campIds: Array.from(new Set([...existing.campIds, ...touchedCampIds])),
        spotIds: Array.from(new Set([...existing.spotIds, ...touchedSpotIds])),
      },
      manifestFile
    );
  }

  return { campsUpdated, spotsUpdated };
}

/**
 * Restores every row THIS SCRIPT changed back to `PER_SITE` — reading the
 * exact campId/spotId set from the manifest `applyPlan` wrote, never
 * re-scanning the live DB for "anything not PER_SITE" (see module docstring
 * "HOW UNDO KNOWS WHICH ROWS IT CHANGED" — that re-scan is precisely what
 * would clobber a host's already-diverged, deliberate choice). Ids no longer
 * present in the DB are skipped gracefully. Idempotent: a row already back
 * at PER_SITE is not re-written and not counted; a successful run clears the
 * manifest, so a second `--undo` reverts zero rows.
 */
export async function undoPlan(prisma, { manifestFile = MANIFEST_FILE } = {}) {
  const manifest = loadManifest(manifestFile);
  let campsReverted = 0;
  let spotsReverted = 0;

  for (const campId of manifest.campIds) {
    const camp = await prisma.campSite.findUnique({ where: { id: campId }, select: { priceUnit: true } });
    if (camp && camp.priceUnit !== 'PER_SITE') {
      await prisma.campSite.update({ where: { id: campId }, data: { priceUnit: 'PER_SITE' } });
      campsReverted += 1;
    }
  }
  for (const spotId of manifest.spotIds) {
    const spot = await prisma.spot.findUnique({ where: { id: spotId }, select: { priceUnit: true } });
    if (spot && spot.priceUnit !== 'PER_SITE') {
      await prisma.spot.update({ where: { id: spotId }, data: { priceUnit: 'PER_SITE' } });
      spotsReverted += 1;
    }
  }

  saveManifest({ campIds: [], spotIds: [] }, manifestFile);
  return { campsReverted, spotsReverted };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const undo = argv.includes('--undo');
  return { apply, undo, dryRun: !apply && !undo };
}

export async function main() {
  const { apply, undo } = parseArgs(process.argv.slice(2));

  const guard = checkGuard();
  if (!guard.ok) {
    console.error(guard.message);
    process.exit(1);
  }
  console.log(`target: ${describeUrlShape(guard.url)}`);
  console.log(
    apply
      ? 'MODE: APPLY — writing the plan below'
      : undo
        ? 'MODE: UNDO — restoring every changed row to PER_SITE'
        : 'MODE: DRY RUN — plan computed below, writing NOTHING. Re-run with --apply to write.'
  );

  const prisma = new PrismaClient();
  try {
    if (undo) {
      // Undo acts on the manifest --apply wrote, not a fresh scan of the
      // live DB (see undoPlan's docstring) — the plan table above is not
      // relevant to what gets reverted.
      const removed = await undoPlan(prisma);
      console.log(`✓ undo complete: reverted ${removed.campsReverted} camp(s) and ${removed.spotsReverted} pitch(es) to PER_SITE`);
      return;
    }

    const plan = await buildPlan(prisma);
    printPlan(plan, console.log);

    if (apply) {
      const created = await applyPlan(prisma, plan);
      console.log(`✓ apply complete: updated ${created.campsUpdated} camp(s) and ${created.spotsUpdated} pitch(es)`);
      return;
    }
  } catch (err) {
    console.error('✗ backfill failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

// Only auto-run when executed directly — not when imported for its exports
// (tests import checkGuard / selectPriceUnitForId / buildPlan / summarizePlan
// / applyPlan / undoPlan / parseArgs directly).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await main();
}
