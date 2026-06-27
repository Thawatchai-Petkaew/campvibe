/**
 * cam-237-coming-soon.test.ts — LAUNCH-1 / CAM-237 (redesign: ErrorState variant)
 *
 * Source-inspection layer (same harness as cam-218, cam-197, etc.).
 * Vitest env: node — no jsdom.
 *
 * AC covered (post-redesign):
 *   AC-1  ErrorState has a "coming-soon" variant with the correct mascot path,
 *         i18n key ("comingSoon"), no CTA rendered, role="status" treatment,
 *         and ImageWithFallback with unoptimized prop ($0 optimizer cost).
 *   AC-2  coming-soon page: no "use client", no auth(), no prisma, imports
 *         ErrorState (not SpriteWalker), renders <main> with bg-background,
 *         variant="coming-soon", force-dynamic exported, no Navbar.
 *   AC-3  translations.json: errors.comingSoon exists in both EN + TH with
 *         verbatim approved copy (title / message / mascotAlt).
 *         Top-level comingSoon key is removed (no duplicate).
 *   AC-4  (unchanged) sprite assets still exist in public/ — kept as regression guard.
 *
 * Prove-It notes:
 *   AC-1: coming-soon variant FAILS if "coming-soon" is removed from ErrorVariant.
 *   AC-1: mascot path FAILS if /mascot/walking.png is removed from VARIANT_MASCOT.
 *   AC-1: i18n key FAILS if "coming-soon": "comingSoon" mapping is removed.
 *   AC-1: no-CTA FAILS if variant !== "coming-soon" guard is removed.
 *   AC-1: unoptimized FAILS if the prop is removed from ImageWithFallback call.
 *   AC-2: force-dynamic FAILS if the export is removed.
 *   AC-2: ErrorState import FAILS if import is removed.
 *   AC-2: no-SpriteWalker FAILS if SpriteWalker is re-imported.
 *   AC-2: variant="coming-soon" FAILS if variant changes.
 *   AC-2: bg-background FAILS if token is removed.
 *   AC-3: EN title verbatim FAILS if even one character changes.
 *   AC-3: TH title verbatim FAILS if even one glyph changes.
 *   AC-3: top-level-removed FAILS if comingSoon is re-added at the top level.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import path from "path";

// isRouteAllowed is a pure function — imported for the flag-off regression guard
import { isRouteAllowed } from "../lib/auth.config";

const root = process.cwd();

function src(relPath: string): string {
  return readFileSync(path.join(root, relPath), "utf-8");
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const translations = require("../locales/translations.json") as {
  en: {
    errors: {
      comingSoon: { title: string; message: string; mascotAlt: string };
    };
    comingSoon?: unknown;
  };
  th: {
    errors: {
      comingSoon: { title: string; message: string; mascotAlt: string };
    };
    comingSoon?: unknown;
  };
};

const errorStateSrc = src("components/ErrorState.tsx");
const pageSrc = src("app/coming-soon/page.tsx");

// ===========================================================================
// AC-1 — ErrorState coming-soon variant
// ===========================================================================

describe("AC-1 — ErrorState: coming-soon variant (components/ErrorState.tsx)", () => {

  // Prove-It: FAILS if "coming-soon" is removed from ErrorVariant
  it('[variant] ErrorVariant includes "coming-soon"', () => {
    expect(errorStateSrc).toContain('"coming-soon"');
  });

  // Prove-It: FAILS if the mascot path mapping for coming-soon is removed
  it('[mascot-path] coming-soon variant maps to /mascot/walking.png', () => {
    expect(errorStateSrc).toContain('"coming-soon": "/mascot/walking.png"');
  });

  // Prove-It: FAILS if the i18n key mapping for coming-soon is removed
  it('[i18n-key] coming-soon variant uses i18n key "comingSoon"', () => {
    expect(errorStateSrc).toContain('"coming-soon": "comingSoon"');
  });

  // Prove-It: FAILS if the no-CTA guard is removed
  it('[no-cta] CTA group is skipped when variant is "coming-soon"', () => {
    expect(errorStateSrc).toContain('variant !== "coming-soon"');
  });

  // Prove-It: FAILS if unoptimized prop is removed from ImageWithFallback
  // (cost: ImageWithFallback uses next/image → Vercel optimizer would bill per
  //  transform; unoptimized bypasses the optimizer at $0 cost)
  it('[cost] ImageWithFallback is rendered with unoptimized prop ($0 image optimizer cost)', () => {
    expect(errorStateSrc).toContain('unoptimized');
  });

  // Prove-It: FAILS if the 4 existing variant mappings regress
  it('[regression] VARIANT_MASCOT still has all 4 original variants', () => {
    expect(errorStateSrc).toContain('"not-found": "/mascot/thinking.png"');
    expect(errorStateSrc).toContain('error: "/mascot/coding.png"');
    expect(errorStateSrc).toContain('forbidden: "/mascot/waving.png"');
    expect(errorStateSrc).toContain('generic: "/mascot/walking.png"');
  });

  // Prove-It: FAILS if VARIANT_KEY 4-original mappings regress
  it('[regression] VARIANT_KEY still has all 4 original mappings', () => {
    expect(errorStateSrc).toContain('"not-found": "notFound"');
    expect(errorStateSrc).toContain('error: "unexpected"');
    expect(errorStateSrc).toContain('forbidden: "forbidden"');
    expect(errorStateSrc).toContain('generic: "generic"');
  });

  // Prove-It: FAILS if the role ternary is changed (coming-soon gets "status")
  it('[role] wrapper role ternary is unchanged — variant === "error" gets "alert", others get "status"', () => {
    expect(errorStateSrc).toContain('role={variant === "error" ? "alert" : "status"}');
  });
});

// ===========================================================================
// AC-2 — coming-soon page
// ===========================================================================

describe("AC-2 — coming-soon page (app/coming-soon/page.tsx)", () => {

  // Prove-It: FAILS if "use client" is added to the page
  it('[server] page.tsx has NO "use client" directive (server component)', () => {
    const lines = pageSrc.split("\n");
    const directive = lines.find(
      (line) => line.trim() === '"use client"' || line.trim() === "'use client'"
    );
    expect(directive).toBeUndefined();
  });

  // Prove-It: FAILS if auth() is added to page.tsx
  it('[no-auth] page.tsx does NOT call auth() as a real function call', () => {
    expect(pageSrc).not.toMatch(/from ['"]@\/lib\/auth['"]/);
    expect(pageSrc).not.toMatch(/from ['"]next-auth['"]/);
    const nonCommentAuthCall = pageSrc.split("\n").some((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && /\bawait auth\(\)|\bconst\s+\w+\s*=\s*auth\(\)/.test(trimmed);
    });
    expect(nonCommentAuthCall).toBe(false);
  });

  // Prove-It: FAILS if prisma is imported
  it('[no-db] page.tsx does NOT import prisma', () => {
    expect(pageSrc).not.toContain("prisma");
    expect(pageSrc).not.toContain("@prisma/client");
  });

  // Prove-It: FAILS if SpriteWalker is re-imported (deleted component)
  it('[no-sprite] page.tsx does NOT import SpriteWalker (deleted component)', () => {
    expect(pageSrc).not.toContain("SpriteWalker");
    expect(pageSrc).not.toContain("components/SpriteWalker");
  });

  // Prove-It: FAILS if ErrorState import is removed
  it('[component] imports ErrorState from @/components/ErrorState', () => {
    expect(pageSrc).toContain("ErrorState");
    expect(pageSrc).toContain("components/ErrorState");
  });

  // Prove-It: FAILS if variant is changed from "coming-soon"
  it('[variant] renders ErrorState with variant="coming-soon"', () => {
    expect(pageSrc).toContain('variant="coming-soon"');
  });

  // Prove-It: FAILS if force-dynamic is removed (CSP nonce — CAM-218 lesson)
  it('[dynamic] exports dynamic = "force-dynamic" (CSP nonce stamped per request)', () => {
    expect(pageSrc).toContain('export const dynamic = "force-dynamic"');
  });

  // Prove-It: FAILS if bg-background token is removed
  it('[token] page background uses bg-background token (no hardcoded color)', () => {
    expect(pageSrc).toContain("bg-background");
    expect(pageSrc).not.toMatch(/bg-\[#/);
  });

  // Prove-It: FAILS if <main landmark is removed
  it('[a11y] wraps content in a <main> landmark', () => {
    expect(pageSrc).toContain("<main");
  });

  // Prove-It: FAILS if data-testid is removed from main
  it('[testid] page main has data-testid="page--coming-soon"', () => {
    expect(pageSrc).toContain('data-testid="page--coming-soon"');
  });

  // Prove-It: FAILS if Navbar is added (holding page must be clean — no nav)
  it('[no-navbar] page.tsx does NOT include Navbar (gated holding page)', () => {
    expect(pageSrc).not.toContain("<Navbar");
    expect(pageSrc).not.toContain("components/Navbar");
  });

  // Prove-It: FAILS if next/image is directly imported (optimizer cost — use ErrorState)
  it('[no-image-optimizer] page does NOT directly import next/image', () => {
    expect(pageSrc).not.toContain('from "next/image"');
    expect(pageSrc).not.toContain("from 'next/image'");
  });

  // Prove-It: FAILS if card/shadow/gradient anti-slop classes appear
  it('[anti-slop] page does NOT use card, shadow, or gradient classes', () => {
    expect(pageSrc).not.toMatch(/\bbg-card\b/);
    expect(pageSrc).not.toMatch(/\bshadow-/);
    expect(pageSrc).not.toMatch(/gradient/);
  });
});

// ===========================================================================
// AC-3 — i18n: errors.comingSoon in both locales; top-level comingSoon removed
// ===========================================================================

describe("AC-3 — i18n errors.comingSoon keys (locales/translations.json)", () => {

  // Prove-It: FAILS if errors.comingSoon block is missing from EN locale
  it('[en] errors.comingSoon exists in EN locale', () => {
    expect(translations.en.errors.comingSoon).toBeTruthy();
  });

  // Prove-It: FAILS if EN title is changed from Option A verbatim
  it('[en-verbatim] EN errors.comingSoon.title is "Setting up camp"', () => {
    expect(translations.en.errors.comingSoon.title).toBe("Setting up camp");
  });

  // Prove-It: FAILS if EN message is changed
  it('[en-verbatim] EN errors.comingSoon.message is "We\'ll be open soon"', () => {
    expect(translations.en.errors.comingSoon.message).toBe("We'll be open soon");
  });

  // Prove-It: FAILS if EN mascotAlt is changed
  it('[en-verbatim] EN errors.comingSoon.mascotAlt is "CampVibe mascot"', () => {
    expect(translations.en.errors.comingSoon.mascotAlt).toBe("CampVibe mascot");
  });

  // Prove-It: FAILS if errors.comingSoon block is missing from TH locale
  it('[th] errors.comingSoon exists in TH locale', () => {
    expect(translations.th.errors.comingSoon).toBeTruthy();
  });

  // Prove-It: FAILS if TH title is changed from Option A verbatim
  it('[th-verbatim] TH errors.comingSoon.title is "กำลังตั้งแคมป์อยู่นะ"', () => {
    expect(translations.th.errors.comingSoon.title).toBe("กำลังตั้งแคมป์อยู่นะ");
  });

  // Prove-It: FAILS if TH message is changed from Option A verbatim
  it('[th-verbatim] TH errors.comingSoon.message is "เว็บไซต์จะเปิดให้บริการเร็วๆ นี้"', () => {
    expect(translations.th.errors.comingSoon.message).toBe("เว็บไซต์จะเปิดให้บริการเร็วๆ นี้");
  });

  // Prove-It: FAILS if TH mascotAlt is changed
  it('[th-verbatim] TH errors.comingSoon.mascotAlt is "มาสคอต CampVibe"', () => {
    expect(translations.th.errors.comingSoon.mascotAlt).toBe("มาสคอต CampVibe");
  });

  // Prove-It: FAILS if top-level comingSoon is re-added (duplicate — must be gone)
  it('[no-duplicate] top-level en.comingSoon key is removed (copy lives in en.errors.comingSoon only)', () => {
    expect(translations.en.comingSoon).toBeUndefined();
  });

  // Prove-It: FAILS if top-level comingSoon is re-added for TH
  it('[no-duplicate] top-level th.comingSoon key is removed (copy lives in th.errors.comingSoon only)', () => {
    expect(translations.th.comingSoon).toBeUndefined();
  });
});

// ===========================================================================
// AC-4 — sprite assets: regression guard (assets kept, SpriteWalker deleted)
// ===========================================================================

describe("AC-4 — sprite assets still exist (public/status-map/sprites/)", () => {

  // Sprites are still referenced by the /status/map page; they must not be deleted.
  it("[asset] walk-front-right-0.webp exists in public/status-map/sprites/", () => {
    expect(
      existsSync(path.join(root, "public", "status-map", "sprites", "walk-front-right-0.webp"))
    ).toBe(true);
  });

  it("[asset] walk-front-right-1.webp exists in public/status-map/sprites/", () => {
    expect(
      existsSync(path.join(root, "public", "status-map", "sprites", "walk-front-right-1.webp"))
    ).toBe(true);
  });

  // Prove-It: FAILS if SpriteWalker.tsx is re-created (must stay deleted)
  it("[deleted] SpriteWalker.tsx does NOT exist (component deleted — dead code removed)", () => {
    expect(
      existsSync(path.join(root, "components", "SpriteWalker.tsx"))
    ).toBe(false);
  });
});

// ===========================================================================
// AC-5 — COMING_SOON gate in proxy.ts (source inspection — unchanged from original)
// ===========================================================================

const proxySrc = src("proxy.ts");

describe("AC-5 — proxy.ts COMING_SOON gate (source inspection)", () => {

  it("[gate-env] reads process.env.COMING_SOON", () => {
    expect(proxySrc).toContain("process.env.COMING_SOON");
  });

  it('[gate-value] flag sentinel is === "1"', () => {
    expect(proxySrc).toContain('=== "1"');
  });

  it("[gate-env] assigns COMING_SOON check to a local variable", () => {
    expect(proxySrc).toMatch(/const comingSoon\s*=/);
  });

  it("[gate-structure] gate appears before nonce generation (crypto.getRandomValues)", () => {
    const callbackStart = proxySrc.indexOf("auth(async (req) =>");
    expect(callbackStart).toBeGreaterThan(-1);
    const bodyAfterCallback = proxySrc.slice(callbackStart);
    const gateIndex = bodyAfterCallback.indexOf("process.env.COMING_SOON");
    const nonceIndex = bodyAfterCallback.indexOf("new Uint8Array(");
    expect(gateIndex).toBeGreaterThan(-1);
    expect(nonceIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeLessThan(nonceIndex);
  });

  it("[gate-api-on] flag ON: returns 404 for /api routes (case-insensitive via lowerPath)", () => {
    expect(proxySrc).toMatch(/lowerPath\.startsWith\(["']\/api["']\)/);
    expect(proxySrc).toContain("status: 404");
  });

  it("[gate-case] lowerPath is computed from pathname.toLowerCase() for case-insensitive /api guard", () => {
    expect(proxySrc).toMatch(/const lowerPath\s*=\s*pathname\.toLowerCase\(\)/);
  });

  it("[gate-rewrite-on] flag ON: rewrites non-holding-page routes to /coming-soon", () => {
    expect(proxySrc).toContain("NextResponse.rewrite");
    expect(proxySrc).toContain("/coming-soon");
  });

  it("[gate-passthrough-on] flag ON: /coming-soon is excluded from the rewrite", () => {
    expect(proxySrc).toMatch(/!pathname\.startsWith\(["']\/coming-soon["']\)/);
  });

  it("[gate-passthrough-on] flag ON: /status-map/sprites is excluded from the rewrite", () => {
    expect(proxySrc).toMatch(/!pathname\.startsWith\(["']\/status-map\/sprites["']\)/);
  });

  it("[gate-api-off] flag OFF: /api routes get NextResponse.next() passthrough", () => {
    const elseIndex = proxySrc.lastIndexOf("} else {");
    const nextIndex = proxySrc.indexOf("NextResponse.next()", elseIndex);
    expect(elseIndex).toBeGreaterThan(-1);
    expect(nextIndex).toBeGreaterThan(elseIndex);
  });

  it("[matcher] matcher does NOT exclude api routes (api| removed)", () => {
    const configBlock = proxySrc.slice(proxySrc.indexOf("export const config"));
    expect(configBlock).not.toMatch(/\(\?!api\|/);
    expect(configBlock).not.toMatch(/api\|_next/);
  });

  it("[matcher] matcher still excludes _next/static, _next/image, favicon, .png assets", () => {
    const configBlock = proxySrc.slice(proxySrc.indexOf("export const config"));
    expect(configBlock).toContain("_next/static");
    expect(configBlock).toContain("_next/image");
    expect(configBlock).toContain("favicon.ico");
    expect(configBlock).toContain(".png$");
  });

  it("[nonce-intact] nonce generation (crypto.getRandomValues) is still present after the gate", () => {
    expect(proxySrc).toContain("crypto.getRandomValues");
    expect(proxySrc).toContain("btoa(");
    expect(proxySrc).toContain("x-nonce");
  });

  it("[nonce-intact] isRouteAllowed() dashboard protection is still called after the gate", () => {
    const gateEnd = proxySrc.indexOf("// ── 1. Generate a per-request nonce");
    const routeAllowedIndex = proxySrc.indexOf("isRouteAllowed(", gateEnd);
    expect(gateEnd).toBeGreaterThan(-1);
    expect(routeAllowedIndex).toBeGreaterThan(gateEnd);
  });
});

describe("AC-5 — flag-OFF regression guard: isRouteAllowed() (CAM-203)", () => {

  it("[regression] /dashboard is blocked when NOT logged in (isLoggedIn=false)", () => {
    expect(isRouteAllowed("/dashboard", false)).toBe(false);
  });

  it("[regression] /dashboard/bookings is blocked when NOT logged in", () => {
    expect(isRouteAllowed("/dashboard/bookings", false)).toBe(false);
  });

  it("[regression] /dashboard/settings is blocked when NOT logged in", () => {
    expect(isRouteAllowed("/dashboard/settings", false)).toBe(false);
  });

  it("[regression] /dashboard is allowed when logged in (isLoggedIn=true)", () => {
    expect(isRouteAllowed("/dashboard", true)).toBe(true);
  });

  it("[regression] /api/auth/callback/credentials is NOT blocked by isRouteAllowed", () => {
    expect(isRouteAllowed("/api/auth/callback/credentials", false)).toBe(true);
  });

  it("[regression] /api/auth/session is NOT blocked by isRouteAllowed", () => {
    expect(isRouteAllowed("/api/auth/session", false)).toBe(true);
  });

  it("[regression] / (home) is public when NOT logged in", () => {
    expect(isRouteAllowed("/", false)).toBe(true);
  });

  it("[regression] /login is public when NOT logged in", () => {
    expect(isRouteAllowed("/login", false)).toBe(true);
  });

  it("[regression] /coming-soon is public when NOT logged in", () => {
    expect(isRouteAllowed("/coming-soon", false)).toBe(true);
  });
});

describe("AC-5 — flag-ON structural verification (proxy.ts source)", () => {

  it("[gate-structure] uses a single if (comingSoon) / else structure", () => {
    expect(proxySrc).toMatch(/if\s*\(comingSoon\)/);
    expect(proxySrc).toMatch(/}\s*else\s*\{/);
  });

  it("[flag-on] /api 404 and the rewrite are inside the if (comingSoon) block", () => {
    const comingSoonBranchStart = proxySrc.indexOf("if (comingSoon)");
    const elseBranchStart = proxySrc.indexOf("} else {");
    const between = proxySrc.slice(comingSoonBranchStart, elseBranchStart);
    expect(between).toContain("status: 404");
    expect(between).toContain("NextResponse.rewrite");
  });

  it("[flag-off] /api NextResponse.next() passthrough is in the else branch (flag OFF only)", () => {
    const elseBranchStart = proxySrc.indexOf("} else {");
    const nonceStart = proxySrc.indexOf("// ── 1. Generate a per-request nonce");
    const elseBranch = proxySrc.slice(elseBranchStart, nonceStart);
    expect(elseBranch).toContain("NextResponse.next()");
  });
});
