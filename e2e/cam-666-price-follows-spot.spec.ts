/**
 * e2e/cam-666-price-follows-spot.spec.ts — CAM-666
 *
 * "ถ้าเป็นสปอตก็ต้องเลือกก่อนว่าจะพักที่สปอตไหน แล้วค่อยเห็นว่ามีราคา" — the
 * live-browser proof that picking a pitch reveals its price and books that
 * exact pitch, on a per-pitch camp shaped like `koh-tao-under-stars-31-th`
 * (mixed units, one free, one booked/unavailable).
 *
 * WHY this file is gated OFF by default (read before removing the gate):
 * this repo's `chromium` Playwright project (`playwright.config.ts`,
 * `testDir: 'e2e'`, only `**\/regression/**` is excluded) runs against
 * `webServer: { command: "npm run build && npm run start", url:
 * "http://localhost:3000", reuseExistingServer: !CI }` — i.e. by default it
 * either reuses whatever is ALREADY running on :3000 or starts a fresh
 * server bound to :3000. This story's dispatch carries two hard
 * prohibitions: never touch/restart port 3000 (the owner's live dev server)
 * and never touch the local dev database (`campvibe`, the owner's restored
 * 795-camp dataset) — and this file's allowed surface does not extend to
 * `playwright.config.ts` or `scripts/` to add a dedicated project/port/DB
 * setup script. So this spec seeds and asserts against a SEPARATE,
 * explicitly-opted-into base URL + database — it is inert (loudly skipped,
 * per the ops.md "a skip must be loud" lesson) unless BOTH env vars below
 * are set by whoever runs it (a follow-up with a dedicated harness, or the
 * owner locally against a throwaway server of their own choosing):
 *
 *   CAM666_E2E_BASE_URL       e.g. http://localhost:3100 (NEVER :3000)
 *   CAM666_E2E_DATABASE_URL   a throwaway LOCAL Postgres, e.g.
 *                             postgresql://user@localhost:5432/campvibe_e2e_cam666
 *
 * `assertLocalDatabase` (e2e/regression/db-guard.ts, read-only import — this
 * file's allowed surface does not include editing it) still refuses a
 * non-localhost DB even when the var IS set, so a copy-pasted staging/prod
 * URL aborts loudly before any seed/write.
 *
 * Vitest-level coverage (__tests__/cam-666-price-follows-spot.test.ts)
 * already proves the pricing math + the real POST /api/bookings route
 * (mocked Prisma transaction, no live DB needed) end to end — including the
 * exact "preview ฿400 == recorded totalPrice 400 == spotId persisted" and
 * "PER_PERSON ฿500 x 3 guests = 1500" claims this file also exercises live.
 * This spec adds the ONE thing that layer cannot: real browser interaction
 * (clicking a pitch, watching the price/reserve control reveal, submitting
 * the real form) against the real dev-server-rendered DOM.
 */
import { test, expect } from "@playwright/test";
import { assertLocalDatabase } from "./regression/db-guard";

const BASE_URL = process.env.CAM666_E2E_BASE_URL;
const DATABASE_URL = process.env.CAM666_E2E_DATABASE_URL;

const shouldRun = !!BASE_URL && !!DATABASE_URL;

test.skip(
  !shouldRun,
  "CAM666_E2E_BASE_URL and CAM666_E2E_DATABASE_URL are not both set — " +
    "this spec is inert by design (never runs against :3000 or the owner's " +
    "dev DB by accident). See this file's header comment to run it for real " +
    "against a dedicated throwaway server + database."
);

test.describe("CAM-666 — picking a pitch reveals its price and books that pitch", () => {
  // Only freeUnitSpotId/campSlug are actually asserted on below; the camp id
  // and the other two spot ids exist purely as seeded fixture rows (their
  // pitch NAMES, not their ids, are what the specs select in the UI).
  let freeUnitSpotId: string;
  let campSlug: string;

  test.beforeAll(async () => {
    if (!shouldRun) return;

    // Guard first — never seed/write against a non-local database, even one
    // supplied via this file's OWN dedicated env var.
    assertLocalDatabase(DATABASE_URL);

    // Dynamic import: @prisma/client is only ever touched when this spec is
    // actually enabled (shouldRun), so a normal `npx playwright test` run
    // (the file skipped) never pays for it.
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

    try {
      const suffix = Date.now().toString(36);
      campSlug = `cam-666-e2e-${suffix}`;

      // Minimal fixture shaped like koh-tao-under-stars-31-th (mixed units,
      // one host-blocked = an "unavailable pitch" for a chosen stay) — a
      // handful of pitches proves the AC without seeding all 21.
      const operator = await prisma.user.create({
        data: { email: `cam666-${suffix}@example.test`, name: "CAM-666 Host", role: "OPERATOR" },
      });
      const location = await prisma.location.create({
        data: { district: "Koh Tao", province: "Surat Thani" },
      });
      const camp = await prisma.campSite.create({
        data: {
          nameTh: "แคมป์ทดสอบ CAM-666",
          nameEn: "CAM-666 Test Camp",
          nameThSlug: campSlug,
          nameEnSlug: campSlug,
          campSiteType: "CAGD",
          accommodationTypes: "TENT",
          bookingMethod: "ONLI",
          latitude: 10.09,
          longitude: 99.84,
          operatorId: operator.id,
          locationId: location.id,
          isActive: true,
          isPublished: true,
          useSpotView: true,
          priceLow: 250,
          checkInTime: "14:00",
          checkOutTime: "12:00",
        },
      });

      const freeUnitSpot = await prisma.spot.create({
        data: { campSiteId: camp.id, name: "Pitch A1", pricePerNight: 400, priceUnit: "PER_SITE", maxCampers: 4 },
      });
      freeUnitSpotId = freeUnitSpot.id;

      await prisma.spot.create({
        data: { campSiteId: camp.id, name: "Pitch B2", pricePerNight: 500, priceUnit: "PER_PERSON", maxCampers: 6 },
      });

      const bookedSpot = await prisma.spot.create({
        data: { campSiteId: camp.id, name: "Pitch C3", pricePerNight: 300, priceUnit: "PER_SITE", maxCampers: 2 },
      });

      // A host block on Pitch C3 covering the exact stay this spec will try
      // to book against it — the "selecting an unavailable pitch" case.
      await prisma.blockedDate.create({
        data: {
          campSiteId: camp.id,
          spotId: bookedSpot.id,
          startDate: futureDate(60),
          endDate: futureDate(61),
        },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  test("[normal][ac] selecting a ฿400 PER_SITE pitch, 1 night -> preview shows ฿400 and the recorded Booking agrees (spotId + totalPrice)", async ({
    page,
  }) => {
    // CAM-635's own URL-prefill contract (lib/booking-prefill.ts) seeds a
    // real 1-night stay without touching the calendar widget itself
    // (already exercised elsewhere, e.g. cam-608) — `from=chat` is
    // deliberately omitted (attribution only, unrelated to this AC).
    await gotoCampPage(page, campSlug, oneNightStay(65));
    await selectPitch(page, "Pitch A1");

    await expect(page.getByTestId("row--booking-total")).toContainText("400");

    const createResponse = page.waitForResponse(
      (res) => res.url().includes("/api/bookings") && res.request().method() === "POST"
    );
    await page.getByRole("button", { name: /reserve|จอง/i }).first().click();
    const res = await createResponse;
    expect(res.status()).toBe(201);
    const booking = await res.json();
    expect(booking.totalPrice).toBe(400);
    expect(booking.spotId).toBe(freeUnitSpotId);
  });

  test("[normal][ac] a PER_PERSON pitch at ฿500 x 3 guests x 1 night -> 1,500, breakdown shows the quantity term", async ({
    page,
  }) => {
    await gotoCampPage(page, campSlug, { ...oneNightStay(70), guests: 3 });
    await selectPitch(page, "Pitch B2");

    await expect(page.getByTestId("row--booking-room-subtotal")).toContainText("x 3");
    await expect(page.getByTestId("row--booking-total")).toContainText("1,500");
  });

  test("[error/validation][ec] selecting a host-blocked pitch for the chosen dates blocks reserve with a real message", async ({
    page,
  }) => {
    await gotoCampPage(page, campSlug, oneNightStay(60));
    await selectPitch(page, "Pitch C3");

    await expect(page.getByTestId("alert--spot-dates-unavailable")).toBeVisible();
  });
});

interface StayQuery {
  checkIn: string;
  checkOut: string;
  guests?: number;
}

/** `checkOut` is EXCLUSIVE (lib/booking-prefill.ts BR-1) — `daysOut+1` is the one night actually booked. */
function oneNightStay(daysOut: number): StayQuery {
  return { checkIn: futureDateISO(daysOut), checkOut: futureDateISO(daysOut + 1) };
}

async function gotoCampPage(
  page: import("@playwright/test").Page,
  slug: string,
  stay: StayQuery
) {
  const params = new URLSearchParams({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    ...(stay.guests ? { guests: String(stay.guests) } : {}),
  });
  await page.goto(`${BASE_URL}/campgrounds/${slug}?${params.toString()}`);
  await expect(page.getByTestId("empty--booking-select-pitch")).toBeVisible();
}

async function selectPitch(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("tab", { name: new RegExp(name) }).click();
}

function futureDateISO(daysOut: number): string {
  return futureDate(daysOut).toISOString().slice(0, 10);
}

function futureDate(daysOut: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysOut);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
