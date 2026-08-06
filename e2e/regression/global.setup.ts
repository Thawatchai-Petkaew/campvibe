/**
 * CAM-359 — regression-suite setup project.
 *
 * Runs (via Playwright's `dependencies` project-dependency mechanism — see
 * playwright.config.ts for why this is a setup PROJECT and not a shared
 * top-level `globalSetup`) exactly once before the regression specs:
 *
 *  1. BR-1 (NON-NEGOTIABLE safety guard) — abort before touching anything
 *     else unless DATABASE_URL is a local Postgres (AC-7 / EC-1).
 *  2. CAM-664 fixture — seed the per-pitch verification camp this setup
 *     project's DATABASE_URL points at (see below).
 *  3. BR-4 — sign in ONCE as the seeded host (hoster@campvibe.com) by
 *     driving the REAL `/login` form (never hand-crafting NextAuth's CSRF
 *     token), then persist `storageState` for the specs to reuse. One
 *     login per run stays comfortably under the 10-attempts/15-min rate
 *     limit on `authorize()` (lib/auth.ts).
 *  4. Force Thai copy for every regression spec — LanguageContext
 *     (contexts/LanguageContext.tsx) defaults to "en" unless the
 *     `campvibe_lang` cookie (read server-side, CAM-688) or localStorage
 *     carries it. Setting BOTH here means they are captured into
 *     storageState below, so every spec that reuses this state loads
 *     already in Thai from the very first (server-rendered) paint, not
 *     just after client hydration (AC copy is asserted verbatim in Thai).
 *  5. Prove the storageState will actually authenticate: navigate straight
 *     into a `/dashboard`-only route and confirm the middleware does NOT
 *     bounce back to `/login` (lib/auth.config.ts `isRouteAllowed`).
 *
 * CAM-664 fixture wiring (fixed after a real CI failure — run 30464260329):
 * `e2e/regression/cam-664-spot-viewer.spec.ts` / `cam-664-cls-and-overlap.spec.ts`
 * need a per-pitch camp (`showSpotSection` in `CampgroundDetailClient.tsx`
 * only renders the strip for a camp with `useSpotView` + >=1 live spot), and
 * NOTHING in the repo's existing seed path (`scripts/setup-e2e-db.ts` locally,
 * the CI job's own "Migrate + seed" step) creates one — a standalone
 * `cam-664-seed.ts` CLI script existed but nothing ever CALLED it in CI, so
 * the fixture was silently absent there (9 of 12 specs timed out waiting for
 * `[data-testid="tablist--spot-strip"]`, ~16.7s each). `seedCam664Camp` is
 * called here — the ONE setup step both a local regression run AND the CI
 * `e2e-regression` job already execute — additively: it only CREATES a new,
 * independently-scoped CampSite + its own Zones/Spots (idempotent, upserted
 * by a fixed slug), never touching any row another regression spec's fixture
 * depends on. See `e2e/regression/cam-664-seed.ts` for the full seed.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { test as setup, expect } from "@playwright/test";
import { assertLocalDatabaseOrExit } from "./db-guard";
import { seedCam664Camp } from "./cam-664-seed";

const STORAGE_STATE_PATH = path.join(process.cwd(), "e2e/regression/.auth/state.json");

const SEEDED_HOST_EMAIL = "hoster@campvibe.com";
const SEEDED_HOST_PASSWORD = "password123";

setup("authenticate as the seeded host (BR-1 guard + real /login form + storageState)", async ({ page }) => {
  // 1. BR-1 — must run BEFORE any seed/login/test (AC-7 / EC-1).
  assertLocalDatabaseOrExit();

  // 2. CAM-664 fixture — additive only (new CampSite + its own Zones/Spots,
  // upserted by a fixed slug); never mutates any row another spec reads.
  const prisma = new PrismaClient();
  try {
    await seedCam664Camp(prisma);
  } finally {
    await prisma.$disconnect();
  }

  // 3. BR-4 — drive the real /login form; let the NextAuth client `signIn`
  // helper own CSRF entirely (never hand-craft the token ourselves).
  await page.goto("/login");
  await page.getByTestId("input--login-email").fill(SEEDED_HOST_EMAIL);
  await page.getByTestId("input--login-password").fill(SEEDED_HOST_PASSWORD);
  await page.getByTestId("btn--login-submit").click();

  // Wait for the real post-login navigation away from /login (the page
  // pushes the sanitized callbackUrl on success, default "/").
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });

  // 4. Force Thai copy for every regression spec. CAM-688: the cookie is
  // what the SERVER reads (app/layout.tsx) to render Thai from the first
  // byte — localStorage alone only flips it after client hydration (the
  // one-time migration effect), which the old `addInitScript`-only pattern
  // silently relied on. Set both so storageState below captures a state
  // that matches a real returning-Thai camper.
  await page.context().addCookies([
    { name: "campvibe_lang", value: "th", domain: "localhost", path: "/" },
  ]);
  await page.evaluate(() => localStorage.setItem("campvibe_lang", "th"));

  // 5. Prove storageState will actually authenticate before persisting it —
  // an authenticated-only route must render, not bounce to /login.
  await page.goto("/dashboard");
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 15_000 });
  await expect(page.getByRole("link", { name: "แคมป์ไซต์ของฉัน" })).toBeVisible();

  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE_PATH });
});
