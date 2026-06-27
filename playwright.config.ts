import { defineConfig, devices } from "@playwright/test";

/**
 * CAM-230 B4 — Playwright config for visual-regression + axe a11y tests.
 *
 * Advisory (non-blocking) CI job only. Runs against the production build
 * (`npm run build && npm run start`) on a fixed port so the environment
 * exactly matches what Vercel ships.
 *
 * Cross-OS baseline note: screenshots generated on macOS differ from CI Linux
 * (sub-pixel rendering, font hinting). The CI job runs with
 * `continue-on-error: true` so a pixel-diff never blocks a merge. Baselines
 * should be generated/updated in the Linux CI environment; see e2e/README.md.
 */
export default defineConfig({
  testDir: "e2e",

  /* Run each test file in parallel; tests within a file run in order. */
  fullyParallel: true,
  /* Fail fast only in CI. */
  forbidOnly: !!process.env.CI,
  /* No retries — flaky pixel diffs should surface, not be hidden by retries. */
  retries: 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    /* Collect traces on failure for debugging in CI artifacts. */
    trace: "on-first-retry",
    /* Wait for fonts + network to settle before snapshotting. */
    actionTimeout: 15_000,
  },

  /* Screenshot comparison — tolerant thresholds to reduce cross-OS noise.
   * maxDiffPixelRatio: up to 2% of pixels may differ (e.g. sub-pixel AA).
   * threshold: per-pixel colour distance tolerance (0–1; 0.2 is permissive). */
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
      animations: "disabled",
    },
  },

  /* Single Chromium project — keeps the advisory job lean and the baselines
   * consistent (cross-browser diffing is out of scope for this advisory pass). */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Production build + start — mirrors Vercel exactly.
   * `reuseExistingServer` lets local developers skip the build if a dev
   * server is already running on port 3000. In CI, SKIP_BUILD=1 can be set
   * if the build step runs separately (the CI job does it explicitly). */
  webServer: process.env.SKIP_BUILD
    ? {
        command: "npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 60_000,
      }
    : {
        command: "npm run build && npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
