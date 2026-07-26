/**
 * CAM-549 — AC-1 + AC-2: the Home page never scrolls sideways on a phone,
 * and the language switcher (the owner-named first casualty) is dropped
 * from the mobile navbar row while every other icon stays.
 *
 * Runs under the `regression` project, so it is already authenticated as
 * the seeded host (storageState from `global.setup.ts`) — the WORST case
 * for the navbar's right-side icon row (language switcher + wishlist +
 * notification bell + profile menu all render at once). A logged-out
 * camper renders fewer icons, so if the worst case never overflows,
 * neither does the logged-out case (EC-2 in story.md).
 *
 * The direct, unfakeable statement of "no horizontal scroll" per the
 * ticket: document.documentElement.scrollWidth <= clientWidth. Measured
 * before this fix at 390px width: scrollWidth 422 vs clientWidth 390 (32px
 * overflow, caused by the profile-menu button running past the right
 * edge) — see story.md "Seams & refs" for the full measured root cause.
 */
import { test, expect } from "@playwright/test";
// CAM-570: the language switcher's accessible name now lives in
// locales/translations.json (was a hardcoded English literal). This spec
// runs under the `regression` project, whose storageState was captured by
// `global.setup.ts` with `campvibe_lang` FORCED to "th" (that file's own
// comment: "Force Thai copy for every regression spec") — so the session
// here always renders Thai, never the `en` default. Verified directly
// (not assumed): a Playwright session reusing this storageState resolves
// the switcher's accessible name to the TH string, not EN.
// Matching only `th` would just move the same fragility to the other
// language if that convention ever changes, so the matcher accepts EITHER
// translation of the same key — it still proves "findable + correctly
// labelled" without re-pinning a literal or assuming which language is live.
import translations from "../../locales/translations.json";
function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function eitherLanguage(en: string, th: string): RegExp {
  return new RegExp(`^(${escapeForRegExp(en)}|${escapeForRegExp(th)})$`);
}
const SWITCH_LANGUAGE_LABEL = eitherLanguage(
  translations.en.nav.switchLanguageAriaLabel,
  translations.th.nav.switchLanguageAriaLabel
);

// Realistic modern phone widths (iPhone SE/12/13/14, Pixel, common Android
// mid/large phones). 320px (iPhone SE 1st-gen class) is a known, narrow
// residual documented in story.md EC-1 — not asserted here on purpose.
const PHONE_WIDTHS = [360, 375, 390, 412, 428];

for (const width of PHONE_WIDTHS) {
  test(`no horizontal scroll on Home at ${width}px (logged in, worst-case icon row)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
    // Prove the worst case actually rendered (logged-in icon row), not a
    // silent auth failure that would make this assertion meaningless.
    await expect(page.getByTestId("btn--wishlist-nav")).toBeVisible();

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(
      metrics.scrollWidth,
      `measured scrollWidth=${metrics.scrollWidth} vs clientWidth=${metrics.clientWidth} at ${width}px`
    ).toBeLessThanOrEqual(metrics.clientWidth);
  });
}

test("language switcher is dropped from the mobile navbar row but stays at desktop width (AC-2)", async ({ page }) => {
  // Mobile: hidden.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
  await expect(page.getByTestId("btn--wishlist-nav")).toBeVisible();
  await expect(page.getByRole("button", { name: SWITCH_LANGUAGE_LABEL })).toBeHidden();

  // Desktop (md = 768px and above): still present and functional.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(200);
  await expect(page.getByRole("button", { name: SWITCH_LANGUAGE_LABEL })).toBeVisible();
});
