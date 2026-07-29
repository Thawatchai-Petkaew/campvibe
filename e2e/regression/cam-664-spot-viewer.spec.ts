/**
 * CAM-664 verification — proves the PAINTED/behavioral result of the pitch
 * viewer, not just the source. `__tests__/cam-664-spot-viewer.test.ts`
 * (frontend) is source-inspection only (reads the `.tsx` files as text) —
 * it cannot catch a real wiring bug (an expand button that doesn't actually
 * open its viewer, an image that actually shifts layout, an arrow key that
 * actually fires a fetch). This spec drives a real Chromium instance against
 * the real running app + a real seeded camp reproducing the
 * `koh-tao-under-stars-31-th` shape the dispatch names (21-pitch camp, every
 * branch: photos/panorama/no-image, PER_SITE + PER_PERSON side by side, a
 * free + host-blocked pitch, a booked pitch, a deliberately long name) — see
 * `e2e/regression/cam-664-seed.ts`.
 *
 * Fixture: the camp is seeded automatically by `e2e/regression/global.setup.ts`
 * (the `regression-setup` project's own dependency step — runs before this
 * file both locally and in CI, see that file's header for why a per-spec
 * manual seed step was removed after a real CI failure, run 30464260329).
 * No manual seed command needed — just `npm run e2e:db:setup` once (local
 * throwaway DB migrated + baseline-seeded; never the shared `campvibe` dev
 * DB, BR-1) before running the suite.
 *
 * Run: PW_REGRESSION=1 npx playwright test e2e/regression/cam-664-spot-viewer.spec.ts --project=regression
 */
import { test, expect } from "@playwright/test";
import translations from "../../locales/translations.json";

const CAMP_SLUG = "cam-664-e2e-verify-th";
const CAMP_URL = `/campgrounds/${CAMP_SLUG}`;

// Deterministic role -> displayed name, from e2e/regression/cam-664-seed.ts +
// scripts/seed-demo-spots.mjs's ROLE_ORDER — verified live against a real
// seeded run of this exact file (the picked letter block is "Z" because the
// seed's own real sibling pitch uses "A1"). Matched via `hasText` (the real
// sibling's fuller Thai name never collides with a bare "Z<n>" match).
const PANORAMA_1 = "จุด Z1"; // priceUnit PER_SITE
const MULTI_PHOTO_1 = "จุด Z3"; // priceUnit PER_SITE, 3 photos
const MULTI_PHOTO_2 = "จุด Z4"; // priceUnit PER_PERSON, 3 photos
const ONE_PHOTO_2 = "จุด Z7"; // has a live Booking
const NO_IMAGE_BLOCKED_FREE = "จุด Z9"; // priced 0, host-blocked
const REAL_SIBLING_NO_IMAGE = "จุด A1"; // the seed's real sibling, also has 0 images

const th = translations.th;

function tabByName(page: import("@playwright/test").Page, name: string) {
  return page.locator('[data-testid^="tab--spot-strip-"]').filter({ hasText: name });
}

test.use({ viewport: { width: 360, height: 800 } });

test.beforeEach(async ({ page }) => {
  await page.goto(CAMP_URL, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForSelector('[data-testid="tablist--spot-strip"]', { timeout: 15_000 });
});

// ---------------------------------------------------------------------------
// Item 1 — the empty-image state is the dominant real case (3,004/3,006 real
// pitches on staging) and must render DESIGN.md's real empty slot: bg-muted,
// lucide ImageIcon (never the struck-through ImageOff "error" glyph),
// role="img" + a real Thai aria-label — and it must occupy the identical box
// a photo pitch occupies (no CLS from the empty case being special-cased).
// ---------------------------------------------------------------------------
test("[section--spot-viewer-empty-image-dominant] the no-image pitch shows the real empty slot (bg-muted, ImageIcon, Thai aria-label) in the same box a photo pitch uses", async ({ page }) => {
  const viewport = page.locator('[data-testid="section--spot-viewport"]');

  // Establish the photo-pitch box first (baseline "has content" box).
  await tabByName(page, MULTI_PHOTO_1).first().click();
  await expect(viewport.locator("img")).toBeVisible();
  const photoBox = await viewport.boundingBox();
  expect(photoBox).not.toBeNull();

  // Switch to the no-image pitch — the dominant real case.
  await tabByName(page, NO_IMAGE_BLOCKED_FREE).first().click();
  const emptyWrapper = viewport.locator("> div").first();
  await expect(emptyWrapper).toHaveAttribute("role", "img");
  // Thai copy, verbatim, character-for-character — no em-dash separator.
  await expect(emptyWrapper).toHaveAttribute("aria-label", th.campground.noImageAlt);
  expect(th.campground.noImageAlt).not.toContain("—");
  await expect(emptyWrapper).toHaveClass(/bg-muted/);
  // Whole ImageIcon (CAM-539) — never one of lucide's struck-through
  // "off"/error variants. Scoped to the viewport (one instance only), so the
  // generic (no-testId-prefix) fallback marker is unambiguous here.
  const fallbackIcon = viewport.locator('[data-testid$="--fallback-placeholder"]');
  await expect(fallbackIcon).toBeVisible();

  // The load-bearing claim: the empty box is the SAME size as the photo box
  // (a structural stand-in, not a shrunk/collapsed special case) -> CLS=0
  // when a user arrives on a no-image pitch first (the dominant real path).
  const emptyBox = await viewport.boundingBox();
  expect(emptyBox).not.toBeNull();
  expect(emptyBox!.width, "empty-state box width must equal the photo-pitch box width").toBe(photoBox!.width);
  expect(emptyBox!.height, "empty-state box height must equal the photo-pitch box height").toBe(photoBox!.height);

  // A second, independently-seeded no-image pitch (the real sibling spot,
  // not one of the synthetic 9) proves this isn't a coincidence of one row's
  // data shape.
  await tabByName(page, REAL_SIBLING_NO_IMAGE).first().click();
  await expect(viewport.locator("> div").first()).toHaveAttribute("aria-label", th.campground.noImageAlt);
});

// ---------------------------------------------------------------------------
// Item 3 (ADR-014) — a PER_PERSON pitch and a PER_SITE pitch render their OWN
// unit words AT THE SAME TIME in the strip (a shared/global unit variable
// bug would make one bleed into the other the moment either is selected).
// ---------------------------------------------------------------------------
test("[row--spot-strip-price-unit-independent] PER_SITE and PER_PERSON pitches keep their own unit word, unaffected by which pitch is selected", async ({ page }) => {
  // lib/price-unit-display.ts's priceUnitWord: PER_SITE reads the bare
  // common.night word ("คืน"), PER_PERSON reads the fuller shared
  // common.priceUnitLabel phrase ("ต่อคน/คืน") — never the same string.
  const perSiteCard = tabByName(page, MULTI_PHOTO_1); // PER_SITE -> "คืน"
  const perPersonCard = tabByName(page, MULTI_PHOTO_2); // PER_PERSON -> "ต่อคน/คืน"

  // "ต่อคน/คืน" (PER_PERSON) itself contains the bare "คืน" substring, so a
  // positive `toContainText(night)` on its own would not catch the PER_SITE
  // card wrongly bleeding the PER_PERSON phrase — the distinctive fragment
  // "ต่อคน" (never present in the bare PER_SITE word) closes that gap.
  const PER_PERSON_ONLY_FRAGMENT = "ต่อคน";

  // Both cards, both correct unit words, simultaneously in the DOM — before
  // either is the "selected" one.
  await expect(perSiteCard).toContainText(th.common.night);
  await expect(perSiteCard).not.toContainText(PER_PERSON_ONLY_FRAGMENT);
  await expect(perPersonCard).toContainText(th.common.priceUnitLabel.PER_PERSON);

  // Selecting the PER_PERSON pitch must not rewrite the PER_SITE card's own
  // unit word (the ADR-014 money-bug shape this item guards against).
  await perPersonCard.first().click();
  await expect(perSiteCard).toContainText(th.common.night);
  await expect(perSiteCard).not.toContainText(PER_PERSON_ONLY_FRAGMENT);
  await expect(perPersonCard).toContainText(th.common.priceUnitLabel.PER_PERSON);

  // And the reverse direction.
  await perSiteCard.first().click();
  await expect(perSiteCard).toContainText(th.common.night);
  await expect(perSiteCard).not.toContainText(PER_PERSON_ONLY_FRAGMENT);
  await expect(perPersonCard).toContainText(th.common.priceUnitLabel.PER_PERSON);
});

// ---------------------------------------------------------------------------
// Item 4 — 360px width: the strip scrolls, cards/controls never shrink below
// the 44px tap floor, and the page body never scrolls sideways.
//
// Runs as a GUEST (a fresh, unauthenticated context, not the project's
// shared host storageState) — deliberately. The shared `regression` project
// session is signed in as `hoster@campvibe.com`, who is ALSO this seeded
// camp's operator, so testing under that shared session would silently
// exercise the HOST view — which carries an UNRELATED, PRE-EXISTING defect
// (CAM-671, already filed: components/CampgroundDetailClient.tsx's
// owner-only header action row has no flex-wrap and overflows 360px by 48px
// whenever `isOwner` is true — nothing to do with the spot viewer). The
// camper-facing persona this AC actually describes never sees that row.
// ---------------------------------------------------------------------------
test("[tablist--spot-strip-360-tap-floor] at 360px the strip scrolls horizontally, controls clear the 44px tap floor, and the body never scrolls sideways (camper/guest view)", async ({ browser }) => {
  // `browser.newContext()` inherits this PROJECT's configured
  // `use.storageState` (the shared host session) by default unless
  // explicitly overridden — verified live: an unqualified
  // `browser.newContext({ viewport })` call still carried
  // `authjs.session-token` before any navigation. Passing an explicit empty
  // `storageState` is required to get a genuinely unauthenticated context.
  const guestContext = await browser.newContext({
    viewport: { width: 360, height: 800 },
    storageState: { cookies: [], origins: [] },
  });
  const page = await guestContext.newPage();
  await page.addInitScript(() => window.localStorage.setItem("campvibe_lang", "th"));
  await page.goto(CAMP_URL, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForSelector('[data-testid="tablist--spot-strip"]', { timeout: 15_000 });

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    metrics.scrollWidth,
    `body scrollWidth=${metrics.scrollWidth} vs clientWidth=${metrics.clientWidth} at 360px (guest view)`
  ).toBeLessThanOrEqual(metrics.clientWidth);

  const strip = page.locator('[data-testid="tablist--spot-strip"]');
  await expect(strip).toHaveClass(/overflow-x-auto/);

  // The strip's own scrollWidth must EXCEED the viewport (it genuinely needs
  // to scroll with 10 live pitches at ~176px each) — proves "the strip
  // scrolls" isn't vacuously true because everything already fits.
  const stripMetrics = await strip.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
  expect(stripMetrics.scrollWidth, "the strip must actually overflow to prove it needs to scroll").toBeGreaterThan(stripMetrics.clientWidth);

  // The viewport's own expand control (the smallest interactive affordance
  // in this feature) clears the 44x44 floor.
  await tabByName(page, MULTI_PHOTO_1).first().click();
  const expandBtn = page.getByTestId("btn--spot-viewport-expand");
  const expandBox = await expandBtn.boundingBox();
  expect(expandBox).not.toBeNull();
  expect(expandBox!.width, "expand button width >= 44px").toBeGreaterThanOrEqual(44);
  expect(expandBox!.height, "expand button height >= 44px").toBeGreaterThanOrEqual(44);

  // The mobile sticky booking bar's own primary action.
  const barAction = page.getByTestId("section--mobile-booking-bar--action");
  const barActionBox = await barAction.boundingBox();
  expect(barActionBox).not.toBeNull();
  expect(barActionBox!.height, "sticky bar action height >= 44px").toBeGreaterThanOrEqual(44);

  await guestContext.close();
});

// Prove-It guard for CAM-671 (a real, ALREADY-FILED defect — a sub-ticket in
// the ticket DB, `state=Backlog role=frontend-engineer`, not this story's
// scope; the spot viewer itself is innocent here — the offending row is
// CampgroundDetailClient's pre-existing owner-only header action row).
// `test.fail()` marks this EXPECTED-RED today: it reports as a passing
// expectation while red, and flags loudly ("unexpected pass") the day
// CAM-671 ships, as a reminder to delete this annotation.
test.fail("[section--cam671-host-header-row-overflow] CAM-671 — a host viewing their OWN camp must not get a sideways-scrolling page at 360px", async ({ page }) => {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    metrics.scrollWidth,
    `CAM-671: host view scrollWidth=${metrics.scrollWidth} vs clientWidth=${metrics.clientWidth} at 360px (pre-existing header-action-row overflow, unrelated to CAM-664's spot viewer)`
  ).toBeLessThanOrEqual(metrics.clientWidth);
});

// ---------------------------------------------------------------------------
// Item 5 — roving tabindex: arrow keys move focus only; Home/End jump;
// Enter/Space activates; arrowing across every pitch fires ZERO new image
// requests (only Enter/Space/click — a real activation — may load one).
// ---------------------------------------------------------------------------
test("[tablist--spot-strip-keyboard-roving] arrow keys move focus without activating, Home/End jump to the ends, Enter/Space activates, and arrowing fires no new image request", async ({ page }) => {
  const imageRequestUrls: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("images.unsplash.com") || req.url().includes("/_next/image")) {
      imageRequestUrls.push(req.url());
    }
  });

  const tabs = page.locator('[data-testid="tablist--spot-strip"] [role="tab"]');
  const tabCount = await tabs.count();
  expect(tabCount, "measured live pitch count on the seeded camp").toBeGreaterThan(0);

  // Select a known photo pitch first so the viewport has a real <img> to watch.
  await tabByName(page, MULTI_PHOTO_1).first().click();
  const viewportImg = page.locator('[data-testid="section--spot-viewport"] img').first();
  await expect(viewportImg).toBeVisible();
  const selectedSrcBefore = await viewportImg.getAttribute("src");
  const ariaSelectedBefore = await tabByName(page, MULTI_PHOTO_1).first().getAttribute("aria-selected");
  expect(ariaSelectedBefore).toBe("true");

  await tabs.first().focus();
  const requestCountBeforeArrow = imageRequestUrls.length;

  // Arrow through EVERY pitch (a full wrap) without ever pressing Enter/Space.
  for (let i = 0; i < tabCount; i++) {
    await page.keyboard.press("ArrowRight");
  }
  // Settle two frames so any (incorrect) fetch would have started.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  const requestCountAfterArrow = imageRequestUrls.length;
  expect(
    requestCountAfterArrow,
    `arrowing across ${tabCount} pitches fired ${requestCountAfterArrow - requestCountBeforeArrow} new image request(s) — must be 0 (manual activation, not selection-follows-focus)`
  ).toBe(requestCountBeforeArrow);

  // The originally SELECTED pitch (Multi-photo-1) must still be selected —
  // arrow-only navigation never re-activates.
  await expect(tabByName(page, MULTI_PHOTO_1).first()).toHaveAttribute("aria-selected", "true");
  const selectedSrcAfterArrow = await viewportImg.getAttribute("src");
  expect(selectedSrcAfterArrow, "viewport image src is untouched by arrow-only navigation").toBe(selectedSrcBefore);

  // Home jumps to the first tab; End jumps to the last — focus only.
  await page.keyboard.press("Home");
  await expect(tabs.first()).toHaveAttribute("tabindex", "0");
  await page.keyboard.press("End");
  await expect(tabs.last()).toHaveAttribute("tabindex", "0");
  // Still hasn't activated anything new.
  await expect(tabByName(page, MULTI_PHOTO_1).first()).toHaveAttribute("aria-selected", "true");

  // Now Enter on the focused (last) tab DOES activate it.
  const lastTabName = await tabs.last().innerText();
  await page.keyboard.press("Enter");
  await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
  expect(lastTabName.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Real wiring — the PANORAMA and PHOTO expand controls actually open their
// real viewers end-to-end (a source-inspection test cannot see this).
// ---------------------------------------------------------------------------
test("[btn--spot-viewport-expand-panorama] the panorama expand control actually opens the real pan-strip viewer", async ({ page }) => {
  await tabByName(page, PANORAMA_1).first().click();
  await expect(page.getByTestId("badge--spot-viewport-panorama")).toBeVisible();
  await page.getByTestId("btn--spot-viewport-expand").click();
  await expect(page.getByTestId("dialog--panorama-viewer")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("btn--panorama-close").click();
  await expect(page.getByTestId("dialog--panorama-viewer")).toBeHidden();
});

test("[btn--spot-viewport-expand-photo] the photo expand control actually opens the real photo gallery at the clicked pitch's own image", async ({ page }) => {
  await tabByName(page, MULTI_PHOTO_1).first().click();
  await page.getByTestId("btn--spot-viewport-expand").click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// Item 3b — the one-photo pitch with a live Booking still renders like any
// other pitch (a booked pitch must not silently disappear or error).
// ---------------------------------------------------------------------------
test("[tab--spot-strip-booked-pitch-still-renders] a pitch with a live Booking still renders normally in the strip", async ({ page }) => {
  await expect(tabByName(page, ONE_PHOTO_2)).toBeVisible();
  await tabByName(page, ONE_PHOTO_2).first().click();
  await expect(page.locator('[data-testid="section--spot-viewport"] img')).toBeVisible();
});
