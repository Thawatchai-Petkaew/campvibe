/**
 * e2e/regression/cam-664-seed.ts — CAM-664 verification-only seed.
 *
 * QA is not allowed to touch `components/**` or `lib/**` (this dispatch's
 * file surface), and `scripts/seed-demo-spots.mjs` REFUSES to run against a
 * localhost `DATABASE_URL` on purpose (it targets STAGING only —
 * `scripts/seed-demo-spots.mjs`'s own `checkGuard`, invoked solely from that
 * file's `main()`). This script does NOT modify that file; it REUSES its
 * exported, pure building blocks (`pickCamp` / `buildPlan` / `applyPlan` /
 * `summarizePlan`) directly against a throwaway LOCAL database, bypassing
 * only the staging-only CLI guard (that guard never runs on this import
 * path — `main()` is never called).
 *
 * What this creates, once, idempotently (safe to re-run):
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
 *
 * Usage: DATABASE_URL=<local .env.e2e value> npx tsx e2e/regression/cam-664-seed.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabaseOrExit } from "./db-guard";

assertLocalDatabaseOrExit();

export const CAM664_SLUG_TH = "cam-664-e2e-verify-th";
export const CAM664_SLUG_EN = "cam-664-e2e-verify-en";
const REAL_SIBLING_NAME = "จุด A1 (จริงของแคมป์)";

async function main() {
  // Runtime import (never static) — scripts/seed-demo-spots.mjs is an ESM
  // file with a top-level `await main()` guard; a static import chain into
  // it fails to transpile under this package's CJS ts-node/tsx config
  // ("top-level await not supported in cjs"). A dynamic `await import()`
  // sidesteps that while still reusing the real, unmodified exports.
  const { pickCamp, buildPlan, applyPlan, summarizePlan } = await import("../../scripts/seed-demo-spots.mjs");

  const prisma = new PrismaClient();
  try {
    const location = await prisma.location.findFirst({ where: { country: "Thailand" } });
    if (!location) {
      throw new Error("no seeded Location found — run `npm run e2e:db:setup` first (.env.e2e must point at the throwaway DB)");
    }
    const operator = await prisma.user.findFirst({ where: { email: "hoster@campvibe.com" } });
    if (!operator) {
      throw new Error("no seeded hoster user found — run `npm run e2e:db:setup` first");
    }
    const camper = await prisma.user.findFirst({ where: { role: "CAMPER", deletedAt: null } });
    if (!camper) {
      throw new Error("no seeded CAMPER user found — run `npm run e2e:db:setup` first (applyPlan needs one for the demo booking)");
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
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("✗ cam-664 seed failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
