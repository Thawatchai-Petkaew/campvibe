/**
 * CAM-359 — regression-suite setup project.
 *
 * Runs (via Playwright's `dependencies` project-dependency mechanism — see
 * playwright.config.ts for why this is a setup PROJECT and not a shared
 * top-level `globalSetup`) exactly once before the 6 regression specs:
 *
 *  1. BR-1 (NON-NEGOTIABLE safety guard) — abort before touching anything
 *     else unless DATABASE_URL is a local Postgres (AC-7 / EC-1).
 *  2. BR-4 — sign in ONCE as the seeded host (hoster@campvibe.com) by
 *     driving the REAL `/login` form (never hand-crafting NextAuth's CSRF
 *     token), then persist `storageState` for the 6 specs to reuse. One
 *     login per run stays comfortably under the 10-attempts/15-min rate
 *     limit on `authorize()` (lib/auth.ts).
 *  3. Force Thai copy for every regression spec — LanguageContext
 *     (contexts/LanguageContext.tsx) defaults to "en" unless localStorage
 *     carries `campvibe_lang`; setting it here means it is captured into
 *     storageState below, so every spec that reuses this state loads
 *     already in Thai (AC copy is asserted verbatim in Thai).
 *  4. Prove the storageState will actually authenticate: navigate straight
 *     into a `/dashboard`-only route and confirm the middleware does NOT
 *     bounce back to `/login` (lib/auth.config.ts `isRouteAllowed`).
 */
import fs from "node:fs";
import path from "node:path";
import { test as setup, expect } from "@playwright/test";
import { assertLocalDatabaseOrExit } from "./db-guard";

const STORAGE_STATE_PATH = path.join(process.cwd(), "e2e/regression/.auth/state.json");

const SEEDED_HOST_EMAIL = "hoster@campvibe.com";
const SEEDED_HOST_PASSWORD = "password123";

setup("authenticate as the seeded host (BR-1 guard + real /login form + storageState)", async ({ page }) => {
  // 1. BR-1 — must run BEFORE any seed/login/test (AC-7 / EC-1).
  assertLocalDatabaseOrExit();

  // 2. BR-4 — drive the real /login form; let the NextAuth client `signIn`
  // helper own CSRF entirely (never hand-craft the token ourselves).
  await page.goto("/login");
  await page.getByTestId("input--login-email").fill(SEEDED_HOST_EMAIL);
  await page.getByTestId("input--login-password").fill(SEEDED_HOST_PASSWORD);
  await page.getByTestId("btn--login-submit").click();

  // Wait for the real post-login navigation away from /login (the page
  // pushes the sanitized callbackUrl on success, default "/").
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });

  // 3. Force Thai copy for every regression spec.
  await page.evaluate(() => localStorage.setItem("campvibe_lang", "th"));

  // 4. Prove storageState will actually authenticate before persisting it —
  // an authenticated-only route must render, not bounce to /login.
  await page.goto("/dashboard");
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 15_000 });
  await expect(page.getByRole("link", { name: "แคมป์ไซต์ของฉัน" })).toBeVisible();

  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE_PATH });
});
