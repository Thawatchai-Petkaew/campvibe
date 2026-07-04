/**
 * CAM-230 B4 — Visual regression snapshot for /preview (design kitchen-sink).
 *
 * Purpose: catch visual/spacing drift that grep guards and prose review miss.
 * This is an ADVISORY check — the CI job runs with `continue-on-error: true`
 * and never blocks a merge gate.
 *
 * CAM-261 — baseline-missing handling: `toHaveScreenshot()` running under
 * `CI=true` (set in .github/workflows/ci.yml) hard-fails when no baseline
 * exists for the current OS/project, rather than auto-creating one (that
 * auto-create behavior only applies outside CI, to stop a dev accidentally
 * shipping an unverified baseline). Since baselines committed here were
 * generated on macOS (`-darwin`) and CI runs Linux (`-linux`), the Linux
 * baseline is genuinely absent today — there is no way to generate a
 * pixel-correct Linux baseline from a macOS machine (sub-pixel AA/font
 * hinting differ), so every CI run failed on "screenshot doesn't exist"
 * (the noisiest finding in the job, per CAM-261).
 *
 * Fix: check for the platform-correct baseline file before asserting. If it
 * exists (e.g. once a maintainer follows the "generate in CI, download the
 * artifact, commit it" bootstrap in e2e/README.md §Baseline workflow), do the
 * real pixel comparison — genuine regressions still fail this check. If it
 * is absent (today's state), skip the strict assertion but still take + keep
 * the screenshot as a report-only artifact, so the job stays green without
 * ever silently skipping a11y checks (those live in preview.a11y.spec.ts and
 * are unaffected by this file).
 */

import { existsSync } from "node:fs";
import { test, expect } from "@playwright/test";

/**
 * Assert a full/viewport screenshot against its committed baseline when one
 * exists for the current OS/project; otherwise just capture the screenshot
 * as an artifact (report-only) so a missing cross-OS baseline never fails
 * the advisory job.
 */
async function assertOrCaptureScreenshot(
  page: import("@playwright/test").Page,
  name: string,
  options: { fullPage: boolean },
): Promise<void> {
  const baselinePath = test.info().snapshotPath(name, { kind: "screenshot" });

  if (existsSync(baselinePath)) {
    await expect(page).toHaveScreenshot(name, options);
    return;
  }

  console.warn(
    `[visual-a11y advisory] No baseline at ${baselinePath} for this OS/project — ` +
      `capturing a report-only screenshot instead of comparing. See ` +
      `e2e/README.md §Baseline workflow to bootstrap a real Linux baseline.`,
  );
  await page.screenshot({ fullPage: options.fullPage });
}

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

    await assertOrCaptureScreenshot(page, "preview-full.png", {
      fullPage: true,
    });
  });

  test("above-the-fold snapshot (viewport)", async ({ page }) => {
    await page.goto("/preview");
    await page.waitForLoadState("networkidle");

    // Viewport-only shot: catches hero / nav / first-card drift.
    await assertOrCaptureScreenshot(page, "preview-viewport.png", {
      fullPage: false,
    });
  });
});
