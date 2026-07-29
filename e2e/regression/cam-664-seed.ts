/**
 * e2e/regression/cam-664-seed.ts — CAM-664 verification-only seed.
 *
 * QA is not allowed to touch `components/**` or `lib/**` (this dispatch's
 * file surface), and `scripts/seed-demo-spots.mjs` REFUSES to run against a
 * localhost `DATABASE_URL` on purpose (it targets STAGING only —
 * `scripts/seed-demo-spots.mjs`'s own `checkGuard`, invoked solely from that
 * file's `main()`). This module does NOT modify that file; it REUSES its
 * exported, pure building blocks (`pickCamp` / `buildPlan` / `applyPlan` /
 * `summarizePlan`) directly against a throwaway LOCAL database, bypassing
 * only the staging-only CLI guard (that guard never runs on this import
 * path — `main()` is never called).
 *
 * CI/local wiring (fixed after a real CI failure — run 30464260329): a
 * per-spec side-channel script that nothing ever CALLS is decoration, not a
 * fixture. `seedCam664Camp` is the single exported entry point, called from
 * `e2e/regression/global.setup.ts` (the ONE setup step both a local
 * `PW_REGRESSION=1 npx playwright test --project=regression` run AND the CI
 * `e2e-regression` job already execute before every regression spec) — so
 * this camp exists wherever the specs run, with no second seeding mechanism
 * and no CI workflow edit. `main()` below stays for local ad-hoc runs
 * (`npx tsx e2e/regression/cam-664-seed.ts`) only — it is a thin CLI wrapper
 * around the same exported function, never invoked on import (guarded by
 * `require.main === module`).
 *
 * What `seedCam664Camp` creates, once, idempotently (safe to call twice):
 *   1. One CampSite (`cam-664-e2e-verify-th`) — published, useSpotView still
 *      false so `pickCamp`'s override path (and `applyPlan`'s own flip to
 *      true) behaves exactly as it does on a real staging camp.
 *   2. 3 Zones (`buildPlan`'s MIN_ZONES floor).
 *   3. 1 real "sibling" Spot with viewType/environment/nearFacilities set —
 *      `buildPlan` copies these onto the 9 demo spots so they "look native"
 *      (no null columns a real pitch would always have).
 *   4. The SAME 9-role demo-pitch set CAM-663 ships on staging (panorama x2,
 *      multi-photo x3, one-photo x2, no-image x2 — one of which is priced 0
 *      and host-blocked, one of which carries a live Booking, one of which
 *      has a deliberately long name), via the unmodified `buildPlan`/
 *      `applyPlan` exports — this reproduces the `koh-tao-under-stars-31-th`
 *      shape the dispatch names, without touching the real staging camp.
 *
 * Total on this camp after a run: 1 real sibling + 9 demo = 10 live spots,
 * exercising every image/price-unit/booking/blocked-date branch this
 * dispatch's items 1-6 verify.
 *
 * BR-1 (non-negotiable): refuses before touching anything unless
 * DATABASE_URL is localhost (`db-guard.ts`, the same guard the regression
 * suite itself is built on) — this can never point at staging/campvibe/prod.
 * The CI `e2e-regression` job's own Postgres service is `localhost:5432`
 * inside the runner, so this guard passes there too — it is not campvibe/prod.
 *
 * Usage (local ad-hoc, outside the Playwright run):
 *   DATABASE_URL=<local .env.e2e value> npx tsx e2e/regression/cam-664-seed.ts
 */
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabaseOrExit } from "./db-guard";

export const CAM664_SLUG_TH = "cam-664-e2e-verify-th";
export const CAM664_SLUG_EN = "cam-664-e2e-verify-en";
const REAL_SIBLING_NAME = "จุด A1 (จริงของแคมป์)";

export interface SeedCam664Result {
  campSlug: string;
  liveSpotCount: number;
}

/**
 * Idempotent — safe to call once per run from `global.setup.ts`, or
 * repeatedly from local ad-hoc invocations of this file's `main()`. Requires
 * the baseline `prisma/seed.ts` data (a "Thailand" Location, the seeded
 * `hoster@campvibe.com` operator, and at least one CAMPER user) to already
 * exist — true both locally (`npm run e2e:db:setup`) and in CI (the
 * `e2e-regression` job's own "Migrate + seed the CI Postgres service" step,
 * which runs before Playwright).
 */
export async function seedCam664Camp(prisma: PrismaClient): Promise<SeedCam664Result> {
  // Runtime import (never static) — scripts/seed-demo-spots.mjs is an ESM
  // file with a top-level `await main()` guard; a static import chain into
  // it fails to transpile under this package's CJS ts-node/tsx config
  // ("top-level await not supported in cjs"). A dynamic `await import()`
  // sidesteps that while still reusing the real, unmodified exports.
  const { pickCamp, buildPlan, applyPlan, summarizePlan } = await import("../../scripts/seed-demo-spots.mjs");

  const location = await prisma.location.findFirst({ where: { country: "Thailand" } });
  if (!location) {
    throw new Error("no seeded Location found — the baseline seed (prisma/seed.ts) must run before this");
  }
  const operator = await prisma.user.findFirst({ where: { email: "hoster@campvibe.com" } });
  if (!operator) {
    throw new Error("no seeded hoster user found — the baseline seed (prisma/seed.ts) must run before this");
  }
  const camper = await prisma.user.findFirst({ where: { role: "CAMPER", deletedAt: null } });
  if (!camper) {
    throw new Error("no seeded CAMPER user found — applyPlan needs one for the demo booking");
  }

  // priceLow/priceUnit set (non-free) so the mobile StickyActionBar renders
  // its real 2-line shape (headline price + unit caption) — a free camp
  // would collapse the bar to one line and understate the CAM-669 gap
  // this dispatch's item 6 asks to quantify.
  const campFields = {
    nameTh: "แคมป์ทดสอบ CAM-664",
    nameEn: "CAM-664 Verify Camp",
    nameThSlug: CAM664_SLUG_TH,
    nameEnSlug: CAM664_SLUG_EN,
    campSiteType: "CAGD",
    accommodationTypes: "RECR",
    latitude: 10.095,
    longitude: 99.84,
    checkInTime: "13:00",
    checkOutTime: "10:00",
    bookingMethod: "ONLI" as const,
    isPublished: true,
    isActive: true,
    maxGuestsPerDay: 50,
    maxTentsPerDay: 20,
    priceLow: 650,
    priceHigh: 2550,
    priceCurrency: "THB",
    priceUnit: "PER_SITE" as const,
    locationId: location.id,
    operatorId: operator.id,
  };
  const camp = await prisma.campSite.upsert({
    where: { nameThSlug: CAM664_SLUG_TH },
    update: campFields,
    create: campFields,
  });

  // A real per-spot-eligible camp on staging always has its OWN gallery
  // photos too (seed-demo-spots.mjs's own MIN_CAMP_IMAGES>=20 candidate
  // rule) — separate from the per-spot images this seed already creates
  // below. Without at least one, this camp's Home/catalog card falls into
  // ImageWithFallback's placeholder branch, which surfaced a real,
  // PRE-EXISTING hydration mismatch (SSR picks `/placeholder-camp.svg`,
  // client re-picks `/placeholder-camp-dark.svg` — a light/dark theme
  // SSR/CSR divergence in `components/ui/image-with-fallback.tsx`, out of
  // this dispatch's file surface to fix). That mismatch left a residual
  // Next.js dev-overlay `role="dialog"` node in the DOM, breaking ANY
  // OTHER regression spec asserting an exact dialog count on `/` (verified
  // live: this is what broke `cam-561-mobile-search-fullscreen.spec.ts`
  // after this seed started running via global.setup.ts). Giving the camp
  // a real gallery photo is the faithful fix — it also makes this fixture
  // MORE accurate, not less.
  const existingCampImage = await prisma.image.findFirst({ where: { campSiteId: camp.id } });
  if (!existingCampImage) {
    await prisma.image.create({
      data: {
        campSiteId: camp.id,
        url: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200",
        kind: "PHOTO",
        alt: "แคมป์ทดสอบ CAM-664",
      },
    });
  }

  const zoneNames = ["โซน A", "โซน B", "โซน C"];
  const zones = [];
  for (const name of zoneNames) {
    let zone = await prisma.zone.findFirst({ where: { campSiteId: camp.id, name, deletedAt: null } });
    if (!zone) {
      zone = await prisma.zone.create({ data: { campSiteId: camp.id, name } });
    }
    zones.push(zone);
  }

  let sibling = await prisma.spot.findFirst({ where: { campSiteId: camp.id, name: REAL_SIBLING_NAME, deletedAt: null } });
  if (!sibling) {
    sibling = await prisma.spot.create({
      data: {
        campSiteId: camp.id,
        zoneId: zones[0].id,
        name: REAL_SIBLING_NAME,
        viewType: "BEACH",
        maxCampers: 4,
        maxTents: 2,
        environment: "ริมชายหาด ลมทะเลพัดตลอดวัน",
        pricePerNight: 650,
        priceUnit: "PER_SITE",
        nearFacilities: "POTA,LIGT",
      },
    });
  }

  const pickedCamp = await pickCamp(prisma, { overrideSlug: CAM664_SLUG_TH });
  const plan = await buildPlan(prisma, pickedCamp);
  const created = await applyPlan(prisma, plan);

  const liveSpotCount = await prisma.spot.count({ where: { campSiteId: camp.id, deletedAt: null } });

  console.log(`✓ CAM-664 seed ready: camp="${camp.nameThSlug}" liveSpots=${liveSpotCount}`);
  console.log("  applyPlan created:", created);
  console.log("  branch summary:", summarizePlan(plan));

  return { campSlug: camp.nameThSlug, liveSpotCount };
}

async function main() {
  assertLocalDatabaseOrExit();
  const prisma = new PrismaClient();
  try {
    await seedCam664Camp(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

// Only run the CLI entry point when this file is executed directly
// (`npx tsx e2e/regression/cam-664-seed.ts`) — never on import, so
// `global.setup.ts` can import `seedCam664Camp` without a second,
// double-running seed pass.
if (require.main === module) {
  main().catch((err) => {
    console.error("✗ cam-664 seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
