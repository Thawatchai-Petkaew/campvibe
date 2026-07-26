/**
 * CAM-558 — every tappable control CAM-552 measured under the 44px touch
 * floor (DESIGN.md §2.0) now clears it, proven by real bounding-box
 * geometry (not className inspection). Also closes the 320px logged-in
 * horizontal-overflow residual CAM-549 traced to the profile-menu button.
 *
 * Runs under the `regression` project (authenticated as the seeded host,
 * storageState from `global.setup.ts`) — needed both because the profile
 * menu / logo / language switcher render their worst case logged in, and
 * because AC-5's 320px overflow check is specifically the LOGGED-IN case
 * CAM-549 could not close.
 *
 * AC coverage:
 *   AC-1 camp-card carousel prev/next arrows >=44x44px (was 28x28, ~48/page)
 *   AC-2 profile menu button >=44px tall (was 42px)
 *   AC-3 navbar logo link >=44x44px tappable box (was 32px/40px), image
 *        itself unchanged
 *   AC-4 language switcher >=44px tall on desktop (was 36px; CAM-549 hides
 *        it below md, so mobile is out of scope here)
 *   AC-5 320px logged-in horizontal overflow closes (CAM-549 measured ~15px)
 *
 * 150% text-scale pass (EC-5): CAM-560 shipped a defect invisible at
 * default zoom, so the floor + overflow assertions are re-run at 150% CSS
 * zoom (Chromium `page.setViewportSize` combined with a CSS zoom override
 * — the same "real geometry, not classNames" instrument as the rest of
 * this file).
 */
import { test, expect } from "@playwright/test";
import { findCampBySlug } from "./helpers";
// CAM-570: the 4 accessible names this spec locates by now live in
// locales/translations.json (were hardcoded English literals). Read them
// from the same source the app renders from — this spec's job is proving
// each control is FINDABLE and >=44px, not pinning any particular wording,
// so a future reword of the copy never needs to touch this file.
import translations from "../../locales/translations.json";

const CAMP_SLUG = "phu-kradueng-camp-7"; // unused by ac1-ac6, avoids cross-spec data races
const CAMP_KEYWORD = "ภูกระดึง"; // a Thai substring of this camp's nameTh only
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const NARROW_320 = { width: 320, height: 640 };
const TOUCH_FLOOR = 44;
const PREVIOUS_IMAGE_LABEL = translations.en.gallery.previousImage;
const NEXT_IMAGE_LABEL = translations.en.gallery.nextImage;
const ACCOUNT_MENU_LABEL = translations.en.nav.accountMenuAriaLabel;
const SWITCH_LANGUAGE_LABEL = translations.en.nav.switchLanguageAriaLabel;

async function giveCampTwoImages(request: import("@playwright/test").APIRequestContext) {
  const camp = await findCampBySlug(request, CAMP_SLUG);
  const putRes = await request.put(`/api/campsites/${camp.id}`, {
    data: { images: ["/placeholder-camp.svg", "/placeholder-camp-dark.svg"] },
  });
  expect(putRes.ok(), `PUT /api/campsites/${camp.id} failed: ${putRes.status()}`).toBeTruthy();
}

/**
 * CI failure (PR #645) root-caused: `page.goto("/")` with no filter hits
 * `CatalogResults`' `useCache` branch (`!isSearchActive && isDefaultSort`),
 * which serves `getDefaultCatalog()` — an `unstable_cache` read tagged
 * `CATALOG_TAG`. Isolated, this story's own PUT-then-navigate is the first
 * request of a fresh dev server, so the cache is empty and the PUT's
 * `revalidateTag(CATALOG_TAG)` is moot. Once OTHER regression specs (which
 * all share one dev server + one seeded DB in CI, `workers: 1`) navigate to
 * `/` FIRST, they warm that cache with the camp's ORIGINAL single image —
 * confirmed by reproducing locally (`npx playwright test --project=regression`,
 * the full suite, CI=true): the same "Received: 0" failure reproduces, and
 * the captured page snapshot shows the camp card still rendering exactly 1
 * `<img>` (no arrows) even after a successful PUT. A keyword search
 * (`?keyword=`) sets `isSearchActive=true`, which routes to the LIVE Prisma
 * query (never cached) — deterministic regardless of what earlier specs
 * warmed, and regardless of CI test-file execution order.
 */
async function gotoCampSearch(page: import("@playwright/test").Page) {
  await page.goto(`/?keyword=${encodeURIComponent(CAMP_KEYWORD)}`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
}

function assertAtLeastFloor(box: { width: number; height: number } | null, label: string) {
  expect(box, `${label}: boundingBox() was null (element not found/rendered)`).not.toBeNull();
  expect(box!.width, `${label} measured width=${box!.width}px`).toBeGreaterThanOrEqual(TOUCH_FLOOR);
  expect(box!.height, `${label} measured height=${box!.height}px`).toBeGreaterThanOrEqual(TOUCH_FLOOR);
}

test.describe("AC-1 — camp-card carousel arrows reach the 44px floor", () => {
  test.use({ viewport: PHONE });

  test("prev/next arrow buttons measure >=44x44px (was 28x28, ~48 instances/page)", async ({ page, request }) => {
    await giveCampTwoImages(request);

    // Live (uncached) search path — see gotoCampSearch's doc comment. A plain
    // page.goto("/") can serve a stale cached snapshot warmed by an earlier
    // spec, which silently drops the carousel precondition (0 arrows, not a
    // floor failure) — the exact CI failure this guards against.
    await gotoCampSearch(page);
    // Prefix match (not an exact href) — LanguageContext resolves TH/EN
    // client-side after mount, so the slug suffix (`-7` vs `-en-7`) can
    // still be settling right after navigation; both share this prefix.
    const card = page.locator(`a[href^="/campgrounds/phu-kradueng-camp"]`).first();
    await expect(
      card,
      `precondition: the camp card for "${CAMP_SLUG}" must be on the page (keyword search "${CAMP_KEYWORD}") before its arrows can be measured`
    ).toHaveCount(1);
    await card.scrollIntoViewIfNeeded();

    const prev = card.getByRole("button", { name: PREVIOUS_IMAGE_LABEL });
    const next = card.getByRole("button", { name: NEXT_IMAGE_LABEL });
    await expect(
      prev,
      "precondition: the carousel only renders when the card has >1 image — giveCampTwoImages() must have taken effect (live query, not the cached default catalog)"
    ).toHaveCount(1);
    await expect(next).toHaveCount(1);

    assertAtLeastFloor(await prev.boundingBox(), "prev arrow");
    assertAtLeastFloor(await next.boundingBox(), "next arrow");
  });
});

test.describe("AC-2 — profile menu button reaches the 44px floor", () => {
  test.use({ viewport: PHONE });

  test("profile menu button measures >=44x44px (was 42px tall)", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
    const profileBtn = page.getByRole("button", { name: ACCOUNT_MENU_LABEL });
    assertAtLeastFloor(await profileBtn.boundingBox(), "profile menu button");
  });
});

test.describe("AC-3 — navbar logo link reaches the 44px floor without growing the image", () => {
  test.use({ viewport: PHONE });

  test("logo link measures >=44x44px (was 32px mobile)", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
    const logo = page.getByRole("link", { name: "CampVibe Logo" });
    assertAtLeastFloor(await logo.boundingBox(), "logo link (mobile)");
  });

  test("logo link measures >=44x44px at desktop too (was 40px)", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
    const logo = page.getByRole("link", { name: "CampVibe Logo" });
    assertAtLeastFloor(await logo.boundingBox(), "logo link (desktop)");
  });
});

test.describe("AC-4 — language switcher reaches the 44px floor on desktop (CAM-549 hides it on mobile)", () => {
  test("switcher button measures >=44x44px at desktop (was 36px); still hidden on mobile", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
    const switcher = page.getByRole("button", { name: SWITCH_LANGUAGE_LABEL });
    assertAtLeastFloor(await switcher.boundingBox(), "language switcher (desktop)");

    // Regression guard (CAM-549 AC-2 must still hold): not rendered on mobile.
    await page.setViewportSize(PHONE);
    await page.waitForTimeout(200);
    await expect(page.getByRole("button", { name: SWITCH_LANGUAGE_LABEL })).toBeHidden();
  });
});

test.describe("AC-5 — the 320px logged-in horizontal overflow closes", () => {
  test.use({ viewport: NARROW_320 });

  test("scrollWidth <= clientWidth at 320px, logged in (CAM-549 measured ~15px overflow here)", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
    await expect(page.getByRole("button", { name: ACCOUNT_MENU_LABEL })).toBeVisible();

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(
      metrics.scrollWidth,
      `measured scrollWidth=${metrics.scrollWidth} vs clientWidth=${metrics.clientWidth} at 320px (CAM-549 baseline: ~15px overflow before this fix)`
    ).toBeLessThanOrEqual(metrics.clientWidth);
  });
});

test.describe("EC-5 — the touch floor still holds at a realistic 150% text scale (CAM-560 lesson: a defect can be invisible at default zoom)", () => {
  test.use({ viewport: PHONE });

  test("profile menu button and camp-card arrows stay >=44x44px at 150% root font-size", async ({ page, request }) => {
    await giveCampTwoImages(request);
    // Live (uncached) search path — see gotoCampSearch's doc comment.
    await gotoCampSearch(page);
    // Same technique CAM-560 used to reproduce ITS text-scale-only defect
    // (e2e/regression/cam-560-category-label-overlap.spec.ts): a ~150% root
    // font-size mirrors a common phone "Larger text" setting. Tailwind's
    // rem-based `h-11`/`w-11` scale WITH the root font-size, so this can
    // only grow these tap targets further past the 44px floor — the
    // meaningful regression this guards is one of them silently NOT
    // scaling (a stray px literal) and staying at/under the floor.
    await page.addStyleTag({ content: "html { font-size: 24px !important; }" });
    await page.waitForTimeout(200);

    const profileBtn = page.getByRole("button", { name: ACCOUNT_MENU_LABEL });
    assertAtLeastFloor(await profileBtn.boundingBox(), "profile menu button @150% text scale");

    const card = page.locator(`a[href^="/campgrounds/phu-kradueng-camp"]`).first();
    await expect(
      card,
      `precondition: the camp card for "${CAMP_SLUG}" must be on the page before its arrow can be measured`
    ).toHaveCount(1);
    await card.scrollIntoViewIfNeeded();
    const prevArrow = card.getByRole("button", { name: PREVIOUS_IMAGE_LABEL });
    await expect(
      prevArrow,
      "precondition: the carousel only renders when the card has >1 image"
    ).toHaveCount(1);
    assertAtLeastFloor(await prevArrow.boundingBox(), "prev arrow @150% text scale");
  });
});
