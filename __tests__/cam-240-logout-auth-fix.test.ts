/**
 * cam-240-logout-auth-fix.test.ts — CAM-240 MEDIA-2 / B1
 *
 * Regression: CAM-237 removed the `api|` exclusion from the matcher so that
 * the COMING_SOON gate could 404 data API routes. Side effect: the matcher
 * now matched /api/auth/* — NextAuth's own routes (signin/signout/session/csrf/
 * callback). Wrapping NextAuth routes with auth() middleware is a known
 * anti-pattern: SessionProvider polling /api/auth/session becomes slow,
 * signout does not end the session cleanly, and re-login is broken.
 *
 * Fix (B1): add `api/auth` to the negative-lookahead in the matcher so
 * /api/auth/* is never wrapped. Data API routes (/api/campsites etc.) remain
 * matched so the COMING_SOON gate still 404s them.
 *
 * CAM-203 lesson: after any auth/middleware change, re-verify route protection
 * with tests.
 *
 * AC covered:
 *   B1-1  matcher EXCLUDES /api/auth/* — NextAuth routes are never wrapped.
 *   B1-2  matcher INCLUDES data /api/* — COMING_SOON gate is still intact.
 *   B1-3  matcher INCLUDES page routes — nonce/CSP/dashboard-protection intact.
 *   B1-4  Route protection: /dashboard unauthenticated → still blocked (CAM-203).
 *   B1-5  Route protection: /api/auth/* — NOT blocked by isRouteAllowed (always allowed).
 *
 * Prove-It notes:
 *   B1-1: FAILS if `api/auth` is removed from the matcher negative-lookahead.
 *   B1-2: FAILS if `api|` is re-added as a broad exclusion (reverts CAM-237).
 *   B1-3: FAILS if page routes are inadvertently excluded from the matcher.
 *   B1-4: FAILS if isRouteAllowed is changed to allow /dashboard unauthenticated.
 *   B1-5: FAILS if isRouteAllowed is changed to block /api/auth routes.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { isRouteAllowed } from "../lib/auth.config";

const root = process.cwd();

function src(relPath: string): string {
  return readFileSync(join(root, relPath), "utf-8");
}

const proxySrc = src("proxy.ts");

// Extract the matcher regex from the config block for runtime testing.
// Next.js wraps matcher patterns with ^ and $ anchors internally; we replicate
// that here so the runtime test matches the real middleware behaviour.
function getMatcherRegex(): RegExp {
  const configBlock = proxySrc.slice(proxySrc.indexOf("export const config"));
  const patternMatch = configBlock.match(/matcher:\s*\[\s*'([^']+)'/);
  if (!patternMatch) throw new Error("Could not extract matcher pattern from proxy.ts");
  // Anchor the pattern exactly as Next.js does: ^pattern$
  return new RegExp("^" + patternMatch[1] + "$");
}

// ===========================================================================
// B1-1 — matcher EXCLUDES /api/auth/* (source + runtime)
// ===========================================================================

describe("B1-1 — proxy.ts matcher EXCLUDES /api/auth/* (CAM-240 B1 fix)", () => {

  // Prove-It: FAILS if `api/auth` is removed from the negative-lookahead.
  it("[source] matcher negative-lookahead contains api/auth", () => {
    const configBlock = proxySrc.slice(proxySrc.indexOf("export const config"));
    expect(configBlock).toContain("api/auth");
  });

  // Prove-It: FAILS if /api/auth/session is matched by the middleware regex.
  it("[runtime] /api/auth/session does NOT match the matcher (NextAuth session polling un-wrapped)", () => {
    expect(getMatcherRegex().test("/api/auth/session")).toBe(false);
  });

  // Prove-It: FAILS if /api/auth/signout is matched (logout must work cleanly).
  it("[runtime] /api/auth/signout does NOT match the matcher (logout un-wrapped)", () => {
    expect(getMatcherRegex().test("/api/auth/signout")).toBe(false);
  });

  // Prove-It: FAILS if /api/auth/callback/credentials is matched.
  it("[runtime] /api/auth/callback/credentials does NOT match the matcher (signin flow un-wrapped)", () => {
    expect(getMatcherRegex().test("/api/auth/callback/credentials")).toBe(false);
  });

  // Prove-It: FAILS if /api/auth/csrf is matched.
  it("[runtime] /api/auth/csrf does NOT match the matcher (CSRF token un-wrapped)", () => {
    expect(getMatcherRegex().test("/api/auth/csrf")).toBe(false);
  });

  // Prove-It: FAILS if /api/auth/callback/google is matched.
  it("[runtime] /api/auth/callback/google does NOT match the matcher (OAuth callback un-wrapped)", () => {
    expect(getMatcherRegex().test("/api/auth/callback/google")).toBe(false);
  });
});

// ===========================================================================
// B1-2 — matcher INCLUDES data /api/* (COMING_SOON gate still intact)
// ===========================================================================

describe("B1-2 — proxy.ts matcher INCLUDES data /api/* (COMING_SOON gate intact)", () => {

  // Prove-It: FAILS if `api|` is re-added as broad exclusion (reverts CAM-237).
  it("[source] matcher does NOT re-add broad api| exclusion (CAM-237 regression guard)", () => {
    const configBlock = proxySrc.slice(proxySrc.indexOf("export const config"));
    expect(configBlock).not.toMatch(/\(\?!api\|/);
    expect(configBlock).not.toMatch(/api\|_next/);
  });

  // Prove-It: FAILS if /api/campsites is excluded from the matcher.
  it("[runtime] /api/campsites matches the matcher (COMING_SOON can 404 it)", () => {
    expect(getMatcherRegex().test("/api/campsites")).toBe(true);
  });

  // Prove-It: FAILS if /api/bookings is excluded.
  it("[runtime] /api/bookings matches the matcher", () => {
    expect(getMatcherRegex().test("/api/bookings")).toBe(true);
  });

  // Prove-It: FAILS if /api/wishlist is excluded.
  it("[runtime] /api/wishlist matches the matcher", () => {
    expect(getMatcherRegex().test("/api/wishlist")).toBe(true);
  });

  // Prove-It: FAILS if /api/camps is excluded.
  it("[runtime] /api/camps matches the matcher", () => {
    expect(getMatcherRegex().test("/api/camps")).toBe(true);
  });
});

// ===========================================================================
// B1-3 — matcher INCLUDES page routes (nonce/CSP/protection intact)
// ===========================================================================

describe("B1-3 — proxy.ts matcher INCLUDES page routes (nonce/CSP still applied)", () => {

  it("[runtime] / (home) matches the matcher", () => {
    expect(getMatcherRegex().test("/")).toBe(true);
  });

  it("[runtime] /dashboard matches the matcher", () => {
    expect(getMatcherRegex().test("/dashboard")).toBe(true);
  });

  it("[runtime] /coming-soon matches the matcher (nonce stamped on holding page)", () => {
    expect(getMatcherRegex().test("/coming-soon")).toBe(true);
  });

  it("[runtime] /campgrounds/any-slug matches the matcher", () => {
    expect(getMatcherRegex().test("/campgrounds/pine-valley-camp")).toBe(true);
  });

  it("[runtime] /login matches the matcher", () => {
    expect(getMatcherRegex().test("/login")).toBe(true);
  });

  // Static assets exclusions are verified via source-inspection in cam-237 AC-5.
  // Here we verify _next paths that are un-ambiguously excluded via anchored regex.
  it("[runtime] /_next/static/chunks/app.js does NOT match (static assets excluded)", () => {
    expect(getMatcherRegex().test("/_next/static/chunks/app.js")).toBe(false);
  });

  it("[runtime] /_next/image does NOT match (image optimizer excluded)", () => {
    expect(getMatcherRegex().test("/_next/image")).toBe(false);
  });

  it("[runtime] /favicon.ico does NOT match (favicon excluded)", () => {
    expect(getMatcherRegex().test("/favicon.ico")).toBe(false);
  });

  // Note: the .*\.png$ exclusion uses a double-escaped backslash in the JS source
  // string which means runtime extraction via .match() on raw source chars would
  // re-interpret the escaping differently than Next.js does. The .png exclusion
  // is verified via source-inspection in cam-237 AC-5 [matcher] test instead.
});

// ===========================================================================
// B1-4 — Route protection: /dashboard still blocked unauthenticated (CAM-203)
// ===========================================================================

describe("B1-4 — isRouteAllowed(): /dashboard protection intact after B1 fix (CAM-203)", () => {

  // Prove-It: FAILS if /dashboard is no longer blocked for unauthenticated users.
  it("[protection] /dashboard blocked when NOT logged in", () => {
    expect(isRouteAllowed("/dashboard", false)).toBe(false);
  });

  it("[protection] /dashboard/bookings blocked when NOT logged in", () => {
    expect(isRouteAllowed("/dashboard/bookings", false)).toBe(false);
  });

  it("[protection] /dashboard/settings blocked when NOT logged in", () => {
    expect(isRouteAllowed("/dashboard/settings", false)).toBe(false);
  });

  it("[protection] /dashboard allowed when logged in", () => {
    expect(isRouteAllowed("/dashboard", true)).toBe(true);
  });

  it("[protection] /dashboard/bookings allowed when logged in", () => {
    expect(isRouteAllowed("/dashboard/bookings", true)).toBe(true);
  });
});

// ===========================================================================
// B1-5 — isRouteAllowed(): /api/auth/* always allowed (never blocked by authz)
// ===========================================================================

describe("B1-5 — isRouteAllowed(): /api/auth/* is always allowed (public — never blocked)", () => {

  // Prove-It: FAILS if isRouteAllowed is changed to block /api/auth routes.
  it("[auth-public] /api/auth/session is allowed when NOT logged in", () => {
    expect(isRouteAllowed("/api/auth/session", false)).toBe(true);
  });

  it("[auth-public] /api/auth/signout is allowed when NOT logged in", () => {
    expect(isRouteAllowed("/api/auth/signout", false)).toBe(true);
  });

  it("[auth-public] /api/auth/callback/credentials is allowed when NOT logged in", () => {
    expect(isRouteAllowed("/api/auth/callback/credentials", false)).toBe(true);
  });

  it("[auth-public] /api/auth/csrf is allowed when NOT logged in", () => {
    expect(isRouteAllowed("/api/auth/csrf", false)).toBe(true);
  });

  it("[auth-public] /api/auth/signin is allowed when NOT logged in", () => {
    expect(isRouteAllowed("/api/auth/signin", false)).toBe(true);
  });

  // Public page routes remain public (regression guard from sec3-csp-nonce).
  it("[public] / is allowed when NOT logged in", () => {
    expect(isRouteAllowed("/", false)).toBe(true);
  });

  it("[public] /login is allowed when NOT logged in", () => {
    expect(isRouteAllowed("/login", false)).toBe(true);
  });

  it("[public] /coming-soon is allowed when NOT logged in", () => {
    expect(isRouteAllowed("/coming-soon", false)).toBe(true);
  });
});
