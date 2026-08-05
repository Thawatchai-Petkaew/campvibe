/**
 * CAM-674 — the camp detail page's hero gallery nested a "Show all photos"
 * `<Button>` INSIDE the image cell's own `<button>` (`components/
 * CampgroundDetailClient.tsx`, ~line 1115-1140, since bb6d5d4/CAM-194). HTML
 * forbids `<button>` inside `<button>`; the browser's parser silently
 * re-parents the inner button as a sibling of the outer one while parsing
 * the server-rendered HTML, so React's hydration check finds a tree that no
 * longer matches what it expects and discards the whole server-rendered
 * subtree — thrown away on EVERY camp detail page view. This is only
 * observable in a real browser (a source-inspection test cannot see it —
 * `__tests__/cam-674-nested-button-hydration.test.ts` proves the MECHANISM
 * in an isolated jsdom mirror; this spec is the real-browser proof against
 * the real page).
 *
 * Fix (this story): the outer clickable region is now a `<div role="button"
 * tabIndex={0}>` with Enter/Space keyboard activation instead of a
 * `<button>`; "Show all photos" is a SIBLING control, not a descendant.
 * Both click paths and keyboard activation are unchanged in effect.
 *
 * Fixture: the >=5-image desktop grid layout (the one that renders the
 * "Show all photos" overlay) only appears when a camp has 6+ images
 * (`components/CampgroundDetailClient.tsx`: `images.length >= 5` for the
 * grid, `images.length > 5` for the overlay button) — the seeded mock camps
 * ship with fewer, so this spec gives its OWN seeded camp
 * (`phu-thap-boek-campground-1`, owned by the regression harness's seeded
 * host) exactly 6 images via the real `PUT /api/campsites/:id` endpoint
 * (same technique as e2e/regression/cam-558-touch-targets.spec.ts's
 * `giveCampTwoImages`), scoped to this camp only — no other regression spec
 * asserts on this camp's image count.
 */
import { test, expect, type Page } from "@playwright/test";
import { findCampBySlug, withKeepAliveRaceRetry } from "./helpers";
import translations from "../../locales/translations.json";

const CAMP_SLUG = "phu-thap-boek-campground-1";
const DESKTOP = { width: 1280, height: 900 };
const HYDRATION_ERROR_PATTERN = /hydration|cannot be a descendant of|didn't match the client/i;

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function eitherLanguage(en: string, th: string): RegExp {
  return new RegExp(`^(${escapeForRegExp(en)}|${escapeForRegExp(th)})$`);
}
// The regression project's shared storageState forces Thai (global.setup.ts)
// — match either language so this spec never depends on that convention.
const VIEW_PHOTO_5_LABEL = eitherLanguage(
  translations.en.gallery.viewImage.replace("{n}", "5"),
  translations.th.gallery.viewImage.replace("{n}", "5")
);
const SHOW_ALL_PHOTOS_LABEL = eitherLanguage(
  translations.en.newCampground.showAllPhotos,
  translations.th.newCampground.showAllPhotos
);
const VIEWER_DIALOG_LABEL = eitherLanguage(translations.en.gallery.viewerTitle, translations.th.gallery.viewerTitle);
function imageOfLabel(n: number, total: number): RegExp {
  return eitherLanguage(
    translations.en.gallery.imageOf.replace("{n}", String(n)).replace("{total}", String(total)),
    translations.th.gallery.imageOf.replace("{n}", String(n)).replace("{total}", String(total))
  );
}

async function giveCampSixImages(request: import("@playwright/test").APIRequestContext) {
  const camp = await findCampBySlug(request, CAMP_SLUG);
  const putRes = await withKeepAliveRaceRetry(`PUT /api/campsites/${camp.id}`, () =>
    request.put(`/api/campsites/${camp.id}`, {
      // Idempotent, deterministic body — 6 images triggers both the >=5
      // grid layout AND the >5 "Show all photos" overlay.
      data: { images: Array(6).fill("/placeholder-camp.svg") },
    })
  );
  expect(putRes.ok(), `PUT /api/campsites/${camp.id} failed: ${putRes.status()}`).toBeTruthy();
  return camp;
}

function trackConsoleAndPageErrors(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return { errors };
}

test.describe("CAM-674 — camp detail hero gallery hydrates clean, zero nested buttons, both entry points still work", () => {
  // Serial: every test in this file mutates the SAME seeded camp's image
  // set via the real PUT endpoint (a full replace, not additive). Running
  // them in parallel (this repo's default `fullyParallel: true`) raced
  // concurrent replace-writes against each other — reproduced locally, the
  // camp ended up with 18 images instead of 6 and every gallery-index
  // assertion failed. Serial + a ONE-TIME beforeAll fixture avoids the race.
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: DESKTOP });

  test.beforeAll(async ({ request }) => {
    await giveCampSixImages(request);
  });

  test("zero hydration/console errors and zero <button><button> on a cold navigation", async ({ page, request }) => {
    const { errors } = trackConsoleAndPageErrors(page);

    const camp = await findCampBySlug(request, CAMP_SLUG);
    await page.goto(`/campgrounds/${camp.nameThSlug}`, { waitUntil: "networkidle" });

    // Precondition: the >=5-image desktop grid (with the overlay button)
    // actually rendered — otherwise the assertions below would pass
    // vacuously on a page that never exercised the fixed structure.
    await expect(page.getByRole("button", { name: SHOW_ALL_PHOTOS_LABEL })).toBeVisible();

    const nestedButtonCount = await page.evaluate(
      () => document.querySelectorAll("button button").length
    );
    expect(nestedButtonCount, "found <button> nested inside <button> in the live DOM").toBe(0);

    const hydrationErrors = errors.filter((line) => HYDRATION_ERROR_PATTERN.test(line));
    expect(hydrationErrors, `unexpected hydration error(s): ${hydrationErrors.join("\n")}`).toEqual([]);
  });

  test("clicking the image area opens the gallery at that image (index 5)", async ({ page, request }) => {
    const camp = await findCampBySlug(request, CAMP_SLUG);
    await page.goto(`/campgrounds/${camp.nameThSlug}`, { waitUntil: "networkidle" });

    const imageCell = page.getByRole("button", { name: VIEW_PHOTO_5_LABEL });
    await expect(imageCell).toBeVisible();
    await imageCell.click();

    const dialog = page.getByRole("dialog", { name: VIEWER_DIALOG_LABEL });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(imageOfLabel(5, 6))).toBeVisible();
  });

  test("the image area is keyboard-reachable and activatable with Enter", async ({ page, request }) => {
    const camp = await findCampBySlug(request, CAMP_SLUG);
    await page.goto(`/campgrounds/${camp.nameThSlug}`, { waitUntil: "networkidle" });

    const imageCell = page.getByRole("button", { name: VIEW_PHOTO_5_LABEL });
    await expect(imageCell).toBeVisible();
    await imageCell.focus();
    await expect(imageCell).toBeFocused();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: VIEWER_DIALOG_LABEL });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(imageOfLabel(5, 6))).toBeVisible();
  });

  test("clicking \"Show all photos\" opens the gallery at the start (index 1), independent of the image area", async ({
    page,
    request,
  }) => {
    const camp = await findCampBySlug(request, CAMP_SLUG);
    await page.goto(`/campgrounds/${camp.nameThSlug}`, { waitUntil: "networkidle" });

    await page.getByRole("button", { name: SHOW_ALL_PHOTOS_LABEL }).click();

    const dialog = page.getByRole("dialog", { name: VIEWER_DIALOG_LABEL });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(imageOfLabel(1, 6))).toBeVisible();
  });
});
