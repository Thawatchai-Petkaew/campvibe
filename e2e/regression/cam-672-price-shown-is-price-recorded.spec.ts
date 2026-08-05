/**
 * CAM-672 — proves the number a camper sees next to the Reserve button is
 * the exact number `Booking.totalPrice` records, by driving a REAL browser
 * through a REAL booking (no mocked Prisma, no mocked `/api/bookings`) and
 * then reading the created row straight out of the database.
 *
 * Why this exists (the gap CAM-58 exists to close): the shipped unit/
 * integration tests for CAM-651/652/666 call `POST /api/bookings` directly
 * against a MOCKED Prisma client — they prove the handler's arithmetic, not
 * that the client and server ever agreed on the SAME number. On
 * 2026-07-29 the owner reported a ฿250 camp, 3 guests, 1 night, showing a
 * total of ฿250 (no guest term at all) — exactly the class of bug a
 * mocked-DB test cannot catch, because it never asks "is the number the
 * browser rendered the same one the database kept?". Every assertion below
 * is `shown === recorded`, never `recorded === expected` alone (a test that
 * only checked the recorded value would have passed while that bug was
 * live) — `expected` (a literal, never re-derived via the production
 * formula) is asserted against BOTH sides independently, then the two
 * sides are asserted against each other.
 *
 * Language / currency note (contexts/LanguageContext.tsx:39): the app
 * converts THB -> USD only when its language is "en" (demo logic). This
 * spec relies on the shared regression `storageState`, which already
 * forces Thai (`e2e/regression/global.setup.ts` step 4) — so no conversion
 * ever applies — AND, belt-and-suspenders, never asserts the FORMATTED
 * currency string: `parseThbDigits` strips every non-digit character from
 * the rendered text and compares the resulting NUMBER, so a locale/grouping
 * change to `Intl.NumberFormat`'s output can never make this spec flake.
 *
 * Data precondition: `seedCam672Camps` (`./cam-672-seed.ts`) — a per-pitch
 * camp with two priced spots (PER_SITE ฿400, PER_PERSON ฿500) and two
 * ordinary camps (PER_PERSON ฿250, PER_SITE ฿250), all owned by the seeded
 * host so the shared `regression-setup` login (`hoster@campvibe.com`) can
 * book on them. Seeded from THIS file's own `test.beforeAll` — see that
 * module's header for why that is sufficient (and correct) for the fixture
 * to exist in the database the CI web server reads.
 */
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { seedCam672Camps, type SeedCam672Result } from "./cam-672-seed";

const GUESTS = 3;
const CHECK_IN_MIN_DAYS_OUT = 120; // far enough out that no other regression spec's own seeded/created bookings could plausibly collide

let prisma: PrismaClient;
let seed: SeedCam672Result;
let checkInIso: string;
let checkOutIso: string;

test.beforeAll(async () => {
  prisma = new PrismaClient();
  seed = await seedCam672Camps(prisma);

  checkInIso = futureDateIso(CHECK_IN_MIN_DAYS_OUT);
  checkOutIso = addOneDayIso(checkInIso);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

/** A calendar date (YYYY-MM-DD) `minDaysOut` days from today — deterministic, always in the future regardless of run date. */
function futureDateIso(minDaysOut: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + minDaysOut);
  return d.toISOString().slice(0, 10);
}

function addOneDayIso(iso: string): string {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, day! + 1)).toISOString().slice(0, 10);
}

/** Strips every non-digit character and parses the remainder — never asserts the formatted string (see file header). */
function parseThbDigits(text: string): number {
  return Number(text.replace(/[^0-9]/g, ""));
}

/** Navigates straight to the camp detail page with dates + guests pre-filled via the booking-prefill query contract (lib/booking-prefill.ts) — skips the calendar-popover UI entirely. */
async function gotoCampWithPrefill(page: Page, slug: string): Promise<void> {
  await page.goto(`/campgrounds/${slug}?checkIn=${checkInIso}&checkOut=${checkOutIso}&guests=${GUESTS}`);
}

/** The desktop widget's Reserve button — scoped to `:visible` because the mobile StickyActionBar mounts an identically-labelled ("จอง") button in the same DOM, just `md:hidden` at the desktop viewport this suite runs at (components/ui/sticky-action-bar.tsx). */
function reserveButton(page: Page) {
  return page.locator("button:visible", { hasText: /^จอง$/ });
}

async function readShownTotal(page: Page): Promise<number> {
  const totalRow = page.getByTestId("row--booking-total");
  await expect(totalRow).toBeVisible({ timeout: 15_000 });
  const totalValue = totalRow.locator("span").last();
  // CAM-672 DEF-1 (filed as a sub-ticket, not fixed here — out of this
  // dispatch's file surface): `LanguageContext`'s `language` state defaults
  // to "en" and only corrects to the persisted `campvibe_lang` value inside
  // a POST-MOUNT `useEffect` — so even with the shared regression
  // `storageState` already holding `campvibe_lang=th` in localStorage, the
  // very first client paint briefly renders the USD-converted amount (a
  // real, reproduced flash: "$21" for a ฿750 total) before the effect
  // fires and it settles to Thai. Poll for the settled "฿"-prefixed value
  // rather than reading the very first visible text — this is the correct
  // way to wait past a real, already-shipped client race, not a workaround
  // for a flaky assertion.
  await expect(totalValue).toContainText("฿", { timeout: 5_000 });
  const text = await totalValue.innerText();
  return parseThbDigits(text);
}

async function reserveAndGetBookingId(page: Page): Promise<string> {
  const button = reserveButton(page);
  await expect(button).toBeEnabled();
  await button.click();
  await page.waitForURL(/\/bookings\/[^/?]+\/confirmation/, { timeout: 15_000 });
  const match = new URL(page.url()).pathname.match(/\/bookings\/([^/]+)\/confirmation/);
  if (!match) throw new Error(`unexpected confirmation URL: ${page.url()}`);
  return match[1]!;
}

test.describe("CAM-672 — the price shown next to Reserve is the price Booking.totalPrice records", () => {
  // Serial: `fullyParallel: true` (playwright.config.ts) can shard this file's
  // tests across MULTIPLE workers, and `test.beforeAll` runs once PER WORKER
  // that picks up a test from this describe block — two workers running
  // `seedCam672Camps` concurrently raced its `campSite.upsert` (non-atomic
  // findFirst-then-create across two separate processes) into a real unique-
  // constraint failure on first local run. Serial mode guarantees exactly one
  // worker (one `beforeAll` call) for this whole block; it also removes any
  // doubt about the per-pitch cases' shared campSiteId+date daily-capacity
  // check (lib/campsite-availability.ts) ever racing each other.
  test.describe.configure({ mode: "serial" });

  test("per-pitch camp, PER_SITE pitch: shows and records a flat 400 regardless of guest count", async ({ page }) => {
    // Arrange
    await gotoCampWithPrefill(page, seed.perPitch.campSlug);
    await page.getByTestId(`tab--spot-strip-${seed.perPitch.siteSpotId}`).click();

    // Act
    const shown = await readShownTotal(page);
    const bookingId = await reserveAndGetBookingId(page);
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    // Assert — both sides of the AC, checked against each other AND the literal
    const EXPECTED = 400;
    expect(booking).not.toBeNull();
    expect(shown).toBe(EXPECTED);
    expect(Number(booking!.totalPrice)).toBe(EXPECTED);
    expect(Number(booking!.totalPrice)).toBe(shown);
    expect(booking!.spotId).toBe(seed.perPitch.siteSpotId);
    expect(booking!.guests).toBe(GUESTS);
  });

  test("per-pitch camp, PER_PERSON pitch: shows and records 500 x 3 guests x 1 night = 1500", async ({ page }) => {
    // Arrange
    await gotoCampWithPrefill(page, seed.perPitch.campSlug);
    await page.getByTestId(`tab--spot-strip-${seed.perPitch.personSpotId}`).click();

    // Act
    const shown = await readShownTotal(page);
    const bookingId = await reserveAndGetBookingId(page);
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    // Assert
    const EXPECTED = 1500;
    expect(booking).not.toBeNull();
    expect(shown).toBe(EXPECTED);
    expect(Number(booking!.totalPrice)).toBe(EXPECTED);
    expect(Number(booking!.totalPrice)).toBe(shown);
    expect(booking!.spotId).toBe(seed.perPitch.personSpotId);
    expect(booking!.guests).toBe(GUESTS);
  });

  test("ordinary camp, PER_PERSON: shows and records 250 x 3 guests x 1 night = 750 (the owner's original bug, reproduced as a passing test)", async ({ page }) => {
    // Arrange — no pitch to pick (useSpotView: false); the widget is ready immediately.
    await gotoCampWithPrefill(page, seed.perPerson.campSlug);

    // Act
    const shown = await readShownTotal(page);
    const bookingId = await reserveAndGetBookingId(page);
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    // Assert
    const EXPECTED = 750;
    expect(booking).not.toBeNull();
    expect(shown).toBe(EXPECTED);
    expect(Number(booking!.totalPrice)).toBe(EXPECTED);
    expect(Number(booking!.totalPrice)).toBe(shown);
    expect(booking!.spotId).toBeNull();
    expect(booking!.guests).toBe(GUESTS);
  });

  test("ordinary camp, PER_SITE: shows and records a flat 250 for 3 guests — the guest term must NOT apply", async ({ page }) => {
    // Arrange
    await gotoCampWithPrefill(page, seed.perSite.campSlug);

    // Act
    const shown = await readShownTotal(page);
    const bookingId = await reserveAndGetBookingId(page);
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    // Assert — hard-coded 250 (never `250 * GUESTS` / any recomputed expression):
    // a test that re-derives the same multiplication the production code
    // performs would still pass if the multiplication were wrongly
    // reintroduced for PER_SITE.
    const EXPECTED = 250;
    expect(booking).not.toBeNull();
    expect(shown).toBe(EXPECTED);
    expect(Number(booking!.totalPrice)).toBe(EXPECTED);
    expect(Number(booking!.totalPrice)).toBe(shown);
    expect(booking!.spotId).toBeNull();
    expect(booking!.guests).toBe(GUESTS);
  });
});
