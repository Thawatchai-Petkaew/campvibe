import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

// CAM-578 — auto-load the regression harness's local-only env so a
// developer doesn't have to manually `source .env.e2e` before every run.
// A no-op when the file is absent (most invocations — e.g. the `chromium`
// visual-a11y project never has one) and dotenv never overrides a var
// already set in the parent shell/CI job, so this cannot fight the
// `e2e-regression` CI job's own hardcoded env (.github/workflows/ci.yml).
loadDotenv({ path: ".env.e2e" });

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
 *
 * CAM-359 — added the `regression` (+ `regression-setup`) projects: a second,
 * independent Playwright suite that drives REAL host create/update/delete
 * flows against a LOCAL-ONLY Postgres + the Next.js DEV server (so the
 * `/api/upload` dev-fallback path works with zero secrets — BR-2). It only
 * activates when `PW_REGRESSION=1` is set (by `npm run test:e2e:regression`
 * and the CI `e2e-regression` job) — see e2e/README.md for the exact local
 * run command.
 *
 * Why a setup PROJECT (not a shared top-level `globalSetup`), and why the
 * webServer choice is gated on an env var instead of a second array entry:
 * `globalSetup` and every `webServer` array entry are WHOLE-RUN options —
 * verified empirically that Playwright invokes/starts them regardless of
 * which `--project` is selected. A shared `globalSetup` (BR-1's localhost-DB
 * guard + the one real `/login` sign-in) or an unconditional second
 * `webServer` (the dev server) would therefore have been forced onto the
 * existing advisory `chromium` visual-a11y project too — which has no local
 * DB/dev-server and must stay completely unaffected. Instead:
 *  - The guard + login live in `regression-setup`, a Playwright "setup
 *    project" (the official project-dependency auth pattern) that only
 *    `regression` depends on — a dependency only runs when the project
 *    depending on it is actually selected, so `chromium` never triggers it.
 *  - `webServer` stays a SINGLE object, chosen once by `PW_REGRESSION` so at
 *    most one server (prod build+start, or dev) is ever started per run.
 */
const REGRESSION_PORT = process.env.E2E_PORT || "3100";
const REGRESSION_BASE_URL = `http://localhost:${REGRESSION_PORT}`;
const REGRESSION_STORAGE_STATE = path.join(process.cwd(), "e2e/regression/.auth/state.json");
const isRegressionRun = process.env.PW_REGRESSION === "1";

export default defineConfig({
  testDir: "e2e",

  /* Run each test file in parallel; tests within a file run in order. */
  fullyParallel: true,
  /* Fail fast only in CI. */
  forbidOnly: !!process.env.CI,
  /* No retries — flaky pixel diffs / regressions should surface, not be
   * hidden by retries. */
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

  projects: [
    {
      name: "chromium",
      testDir: "e2e",
      // The regression suite lives under e2e/regression — keep this advisory
      // visual/a11y project scoped away from it (BR-2: stays unchanged).
      testIgnore: ["**/regression/**"],
      use: { ...devices["Desktop Chrome"] },
    },

    // CAM-359 — the one real `/login` sign-in + the BR-1 localhost-DB guard,
    // persisted as storageState for the 6 regression specs to reuse (BR-4).
    // Only runs when `regression` is selected (see the file-level comment).
    {
      name: "regression-setup",
      testDir: "e2e/regression",
      testMatch: /global\.setup\.ts/,
      use: { baseURL: REGRESSION_BASE_URL },
    },
    {
      name: "regression",
      testDir: "e2e/regression",
      testIgnore: ["**/global.setup.ts"],
      dependencies: ["regression-setup"],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: REGRESSION_BASE_URL,
        storageState: REGRESSION_STORAGE_STATE,
      },
    },
  ],

  /* chromium project: production build + start — mirrors Vercel exactly.
   * `reuseExistingServer` lets local developers skip the build if a dev
   * server is already running on port 3000. In CI, SKIP_BUILD=1 can be set
   * if the build step runs separately (the CI job does it explicitly).
   *
   * regression project (PW_REGRESSION=1): the Next.js DEV server instead
   * (BR-2 — so the /api/upload dev-fallback path works with zero secrets),
   * on its own port (default 3100, override via E2E_PORT) so it never
   * collides with a developer's own `npm run dev` on 3000. Exactly one
   * webServer is ever configured per run — never both. */
  webServer: isRegressionRun
    ? {
        command: `npm run dev -- -p ${REGRESSION_PORT}`,
        url: REGRESSION_BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : process.env.SKIP_BUILD
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
