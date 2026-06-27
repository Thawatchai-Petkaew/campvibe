/**
 * CAM-230 B4 — Visual regression snapshot for /preview (design kitchen-sink).
 *
 * Purpose: catch visual/spacing drift that grep guards and prose review miss.
 * This is an ADVISORY check — the CI job runs with `continue-on-error: true`
 * and never blocks a merge gate.
 *
 * Cross-OS note: baselines checked in alongside this file were generated on
 * macOS. If CI (Linux) reports pixel diffs, run `--update-snapshots` in the
 * Linux environment (see e2e/README.md) to commit Linux-native baselines.
 */

import { test, expect } from "@playwright/test";

test.describe("/preview visual regression", () => {
  test.beforeEach(async ({ page }) => {
    // Disable CSS transitions/animations so snapshots are stable.
    await page.addStyleTag({
      content: `*, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }`,
    });
  });

  test("full page snapshot", async ({ page }) => {
    await page.goto("/preview");

    // Wait for the page to be visually settled:
    // 1. Network idle — all deferred requests complete.
    // 2. No loading spinners visible.
    await page.waitForLoadState("networkidle");

    // Scroll to bottom and back to force lazy images to load.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot("preview-full.png", {
      fullPage: true,
    });
  });

  test("above-the-fold snapshot (viewport)", async ({ page }) => {
    await page.goto("/preview");
    await page.waitForLoadState("networkidle");

    // Viewport-only shot: catches hero / nav / first-card drift.
    await expect(page).toHaveScreenshot("preview-viewport.png", {
      fullPage: false,
    });
  });
});
