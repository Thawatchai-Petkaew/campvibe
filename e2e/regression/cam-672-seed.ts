/**
 * e2e/regression/cam-672-seed.ts — CAM-672 verification-only seed.
 *
 * CAM-58 exists to stop client and server from silently computing a booking
 * total down two different code paths. CAM-651/652/666 fixed the known
 * instance (a missing guest multiplier, then a per-pitch price source) with
 * tests that call the real `POST /api/bookings` handler against a MOCKED
 * Prisma — those prove the handler's arithmetic, never that the number
 * rendered next to the Reserve button is the number a real browser submits
 * and the database actually records. This seed exists to make that round
 * trip provable end-to-end (real browser, real DB, real POST).
 *
 * QA's file surface for this dispatch is `e2e/regression/cam-672-*` only —
 * `components/**`/`lib/**`/`app/**` are out of bounds, so this module never
 * touches production code. It follows the `cam-664-seed.ts` precedent
 * (idempotent upsert by a fixed slug, called from a spec's own
 * `test.beforeAll` — see that file's header for why a fixture that nothing
 * calls is decoration, not a fixture) but does NOT extend
 * `global.setup.ts`: that file is outside this dispatch's allowed surface,
 * and Next's dev server reads Postgres per-request (not at boot), so
 * seeding from THIS spec's own `beforeAll` — which Playwright always runs
 * before that same file's tests, in every local and CI invocation — is
 * sufficient for the fixture to exist in the database the CI web server
 * reads. No second seeding mechanism, nothing orphaned.
 *
 * Three camps, all owned by the same seeded host (`hoster@campvibe.com` —
 * required so `e2e/regression/helpers.ts`'s `findCampBySlug` /
 * `/api/operator/dashboard` can see them if a future spec needs that path)
 * and all `isPublished: false`. Booking creation (`POST /api/bookings`,
 * `app/api/bookings/route.ts`) never checks `isPublished`, so this has zero
 * effect on the price round trip under test — and it deliberately keeps
 * these camps OFF the Home catalog entirely, sidestepping the exact
 * SSR/CSR image-hydration-mismatch class `cam-664-seed.ts` documents
 * (a published camp with no gallery photo breaking an unrelated spec's
 * dialog-count assertion on `/`). The owning host can still always view
 * their own unpublished camp (`lib/campsite-visibility.ts`
 * `canViewCampSite`), which is all this suite needs.
 *
 *   1. `perPitch` (`useSpotView: true`) — two live spots on the SAME camp:
 *      - `siteSpot`   ฿400/night, `priceUnit: PER_SITE`
 *      - `personSpot` ฿500/night, `priceUnit: PER_PERSON`
 *      `maxCampers: 10` each (aggregate per-spot capacity = 20, comfortably
 *      above the 3-guest bookings both cases below make on the same date —
 *      `lib/spot-aggregation.ts` `sumSpotCapacity`).
 *   2. `perPerson` (ordinary camp, `useSpotView: false`) — ฿250/night,
 *      `priceUnit: PER_PERSON`. Reproduces the owner's original CAM-58 bug
 *      (250 shown/charged for 3 guests) as a passing regression.
 *   3. `perSite` (ordinary camp, `useSpotView: false`) — ฿250/night,
 *      `priceUnit: PER_SITE`. Proves the guest term does NOT apply here.
 *
 * BR-1 (non-negotiable, same guard the regression suite is built on):
 * `seedCam672Camps` never runs standalone — it is only ever imported and
 * called from a spec file whose OWN `test.beforeAll` already sits behind
 * `regression-setup`'s `assertLocalDatabaseOrExit()` (playwright.config.ts
 * `dependencies: ["regression-setup"]`), so this file does not re-guard.
 *
 * Idempotent — safe to call again against an already-seeded local DB
 * (upserted by fixed slugs). Also resets any Booking rows created against
 * these three camps by a PRIOR local run, so every run starts from a clean
 * slate regardless of which fixed date the specs reuse.
 */
import { PrismaClient } from "@prisma/client";

export const CAM672_PER_PITCH_SLUG_TH = "cam-672-per-pitch-th";
export const CAM672_PER_PITCH_SLUG_EN = "cam-672-per-pitch-en";
export const CAM672_PER_PERSON_SLUG_TH = "cam-672-per-person-th";
export const CAM672_PER_PERSON_SLUG_EN = "cam-672-per-person-en";
export const CAM672_PER_SITE_SLUG_TH = "cam-672-per-site-th";
export const CAM672_PER_SITE_SLUG_EN = "cam-672-per-site-en";

const SITE_SPOT_NAME = "จุดทดสอบ PER_SITE (CAM-672)";
const PERSON_SPOT_NAME = "จุดทดสอบ PER_PERSON (CAM-672)";

export interface SeedCam672Result {
  perPitch: { campSlug: string; campId: string; siteSpotId: string; personSpotId: string };
  perPerson: { campSlug: string; campId: string };
  perSite: { campSlug: string; campId: string };
}

export async function seedCam672Camps(prisma: PrismaClient): Promise<SeedCam672Result> {
  const location = await prisma.location.findFirst({ where: { country: "Thailand" } });
  if (!location) {
    throw new Error("no seeded Location found — the baseline seed (prisma/seed.ts) must run before this");
  }
  const operator = await prisma.user.findFirst({ where: { email: "hoster@campvibe.com" } });
  if (!operator) {
    throw new Error("no seeded hoster user found — the baseline seed (prisma/seed.ts) must run before this");
  }

  const shared = {
    campSiteType: "CAGD",
    accommodationTypes: "RECR",
    latitude: 13.75,
    longitude: 100.5,
    checkInTime: "13:00",
    checkOutTime: "10:00",
    bookingMethod: "ONLI" as const,
    isPublished: false, // kept off the Home catalog entirely — see header comment
    isActive: true,
    maxGuestsPerDay: 20,
    maxTentsPerDay: 20,
    priceCurrency: "THB",
    locationId: location.id,
    operatorId: operator.id,
  };

  // 1. Per-pitch camp — two spots, two different pricing units on the SAME camp.
  const perPitchFields = {
    ...shared,
    nameTh: "แคมป์ทดสอบ CAM-672 (รายจุด)",
    nameEn: "CAM-672 Verify Camp (per-pitch)",
    nameThSlug: CAM672_PER_PITCH_SLUG_TH,
    nameEnSlug: CAM672_PER_PITCH_SLUG_EN,
    priceLow: 400,
    priceHigh: 500,
    priceUnit: "PER_SITE" as const, // camp-level fallback only — every booking below picks a real spot
    useSpotView: true,
  };
  const perPitchCamp = await prisma.campSite.upsert({
    where: { nameThSlug: CAM672_PER_PITCH_SLUG_TH },
    update: perPitchFields,
    create: perPitchFields,
  });

  let siteSpot = await prisma.spot.findFirst({
    where: { campSiteId: perPitchCamp.id, name: SITE_SPOT_NAME, deletedAt: null },
  });
  if (!siteSpot) {
    siteSpot = await prisma.spot.create({
      data: {
        campSiteId: perPitchCamp.id,
        name: SITE_SPOT_NAME,
        pricePerNight: 400,
        priceUnit: "PER_SITE",
        maxCampers: 10,
      },
    });
  }

  let personSpot = await prisma.spot.findFirst({
    where: { campSiteId: perPitchCamp.id, name: PERSON_SPOT_NAME, deletedAt: null },
  });
  if (!personSpot) {
    personSpot = await prisma.spot.create({
      data: {
        campSiteId: perPitchCamp.id,
        name: PERSON_SPOT_NAME,
        pricePerNight: 500,
        priceUnit: "PER_PERSON",
        maxCampers: 10,
      },
    });
  }

  // 2. Ordinary camp, PER_PERSON — the owner's original bug, reproduced.
  const perPersonFields = {
    ...shared,
    nameTh: "แคมป์ทดสอบ CAM-672 (ต่อคน)",
    nameEn: "CAM-672 Verify Camp (per-person)",
    nameThSlug: CAM672_PER_PERSON_SLUG_TH,
    nameEnSlug: CAM672_PER_PERSON_SLUG_EN,
    priceLow: 250,
    priceHigh: 250,
    priceUnit: "PER_PERSON" as const,
    useSpotView: false,
  };
  const perPersonCamp = await prisma.campSite.upsert({
    where: { nameThSlug: CAM672_PER_PERSON_SLUG_TH },
    update: perPersonFields,
    create: perPersonFields,
  });

  // 3. Ordinary camp, PER_SITE — the guest term must NOT apply.
  const perSiteFields = {
    ...shared,
    nameTh: "แคมป์ทดสอบ CAM-672 (ต่อไซต์)",
    nameEn: "CAM-672 Verify Camp (per-site)",
    nameThSlug: CAM672_PER_SITE_SLUG_TH,
    nameEnSlug: CAM672_PER_SITE_SLUG_EN,
    priceLow: 250,
    priceHigh: 250,
    priceUnit: "PER_SITE" as const,
    useSpotView: false,
  };
  const perSiteCamp = await prisma.campSite.upsert({
    where: { nameThSlug: CAM672_PER_SITE_SLUG_TH },
    update: perSiteFields,
    create: perSiteFields,
  });

  // Reset any Booking rows a PRIOR local run left on these three (dedicated,
  // never-shared-with-another-spec) camps, so every run books against a
  // clean slate regardless of which fixed date the specs reuse.
  await prisma.booking.deleteMany({
    where: { campSiteId: { in: [perPitchCamp.id, perPersonCamp.id, perSiteCamp.id] } },
  });

  return {
    perPitch: {
      campSlug: perPitchCamp.nameThSlug,
      campId: perPitchCamp.id,
      siteSpotId: siteSpot.id,
      personSpotId: personSpot.id,
    },
    perPerson: { campSlug: perPersonCamp.nameThSlug, campId: perPersonCamp.id },
    perSite: { campSlug: perSiteCamp.nameThSlug, campId: perSiteCamp.id },
  };
}
