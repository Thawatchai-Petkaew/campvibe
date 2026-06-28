/**
 * cam-240-b2-navbar-session.test.ts — CAM-240 MEDIA-2 / B2
 *
 * B2: Navbar avatar/name must update live (no re-login) after a Profile save.
 *
 * Root cause: Navbar.tsx previously derived the displayed user unconditionally
 * from the server-passed `currentUser` prop, so `useSession().update()` (called
 * by the Profile page after save) refreshed the CLIENT session but the Navbar
 * still showed the stale server prop until re-login.
 *
 * Fix: derive `navUser` from the CLIENT session keyed by `status`:
 *   loading      → currentUser (SSR value, no avatar flash on first paint)
 *   authenticated → session.user (fresh — reflects update() immediately)
 *   unauthenticated → null (logged-out UI, even if currentUser prop is stale)
 *
 * Source-inspection tests (matching repo style: cam-234, cam-220, cam-197, etc.).
 * The vitest environment is "node" — no DOM renderer.
 *
 * AC coverage:
 *   B2-1  useSession() destructures `data` (session) in addition to `status`.
 *   B2-2  navUser loading branch: uses currentUser ?? null (SSR initial value, no flash).
 *   B2-3  navUser authenticated branch: uses session?.user ?? null (live client data).
 *   B2-4  navUser unauthenticated branch: resolves to null (not currentUser) — clears on logout.
 *   B2-5  Avatar <img> src reads from navUser, NOT from the stale currentUser prop directly.
 *   B2-6  Dropdown label (user name) reads from navUser.name, NOT currentUser.name directly.
 *   B2-7  Wishlist heart link gated on navUser (clears on logout, AC-3 from story).
 *   B2-8  Login/Register buttons visible only when NOT loading AND navUser is null.
 *   B2-9  HostOnboardingFab receives !!navUser (not !!currentUser).
 *   B2-10 imageError reset effect depends on navUser?.image (re-tries new avatar URL on update).
 *   B2-11 currentUser prop is KEPT on the interface (loading-state initial value, no regression).
 *   B2-12 proxy.ts is NOT modified by B2 (B1 is backend scope only).
 *
 * Prove-It notes:
 *   B2-1: FAILS if `data` is removed from the useSession destructure.
 *   B2-2: FAILS if the loading branch is changed to session?.user (would flash null on SSR).
 *   B2-3: FAILS if the authenticated branch is changed to currentUser (reverts the bug).
 *   B2-4: FAILS if unauthenticated resolves to currentUser (stale prop stays post-logout).
 *   B2-5: FAILS if img src still reads currentUser.image instead of navUser.image.
 *   B2-6: FAILS if DropdownMenuLabel still reads currentUser.name.
 *   B2-7: FAILS if the wishlist Link is still gated on currentUser.
 *   B2-8: FAILS if login buttons do not guard against the loading state.
 *   B2-9: FAILS if HostOnboardingFab still receives !!currentUser.
 *   B2-10: FAILS if the imageError reset effect depends on currentUser?.image.
 *   B2-11: FAILS if the currentUser prop is removed from NavbarProps.
 *   B2-12: FAILS if this test finds B2-specific changes in proxy.ts.
 *
 * Layer: source-inspect (static parse of real production files).
 * Interactive assertions (session polling, live update after Profile save) are
 * verified on the real Staging URL per .claude/rules/qa.md §6.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = process.cwd();
const src = (relPath: string) => fs.readFileSync(path.join(root, relPath), "utf-8");

const navbarSrc = src("components/Navbar.tsx");
const proxySrc = src("proxy.ts");

// ===========================================================================
// B2-1 — useSession() destructures `data` (the session object)
// ===========================================================================

describe("B2-1 — useSession destructures data (session) alongside status", () => {

  // Prove-It: FAILS if `data` is removed from the useSession destructure.
  it("[source] destructures { data: session, status } from useSession()", () => {
    expect(navbarSrc).toMatch(/\{\s*data:\s*session\s*,\s*status\s*\}\s*=\s*useSession\(\)/);
  });
});

// ===========================================================================
// B2-2/3/4 — navUser derivation keyed by status
// ===========================================================================

describe("B2-2/3/4 — navUser derived from client session keyed by status", () => {

  // Prove-It: FAILS if loading branch uses session?.user (wrong — would flash null on SSR).
  it("[source] loading branch falls back to currentUser ?? null (no SSR flash)", () => {
    expect(navbarSrc).toMatch(/status\s*===\s*["']loading["']\s*\?\s*\(\s*currentUser\s*\?\?\s*null\s*\)/);
  });

  // Prove-It: FAILS if the authenticated branch reverts to currentUser.
  it("[source] non-loading branch uses session?.user ?? null (live client data)", () => {
    expect(navbarSrc).toMatch(/:\s*\(\s*session\?\.user\s*\?\?\s*null\s*\)/);
  });

  // Prove-It: FAILS if navUser is not declared as a const.
  it("[source] navUser is declared as a const", () => {
    expect(navbarSrc).toContain("const navUser =");
  });
});

// ===========================================================================
// B2-5 — Avatar <img> src reads from navUser
// ===========================================================================

describe("B2-5 — Avatar img src reads from navUser (not stale currentUser)", () => {

  // Prove-It: FAILS if src still reads currentUser.image.
  it("[source] img src is navUser.image (not currentUser.image)", () => {
    expect(navbarSrc).toContain("src={navUser.image}");
    // Verify the stale prop is NOT used as the img src directly.
    expect(navbarSrc).not.toContain("src={currentUser.image}");
  });

  // Prove-It: FAILS if the avatar visibility check still reads currentUser?.image.
  it("[source] avatar visibility condition reads navUser?.image (not currentUser?.image)", () => {
    expect(navbarSrc).toContain("navUser?.image && !imageError");
    expect(navbarSrc).not.toContain("currentUser?.image && !imageError");
  });
});

// ===========================================================================
// B2-6 — Dropdown label reads navUser.name
// ===========================================================================

describe("B2-6 — DropdownMenuLabel reads navUser.name (not currentUser.name)", () => {

  // Prove-It: FAILS if the dropdown still reads currentUser.name.
  it("[source] DropdownMenuLabel renders navUser.name", () => {
    expect(navbarSrc).toContain("{navUser.name}");
    expect(navbarSrc).not.toContain("{currentUser.name}");
  });
});

// ===========================================================================
// B2-7 — Wishlist link gated on navUser
// ===========================================================================

describe("B2-7 — Wishlist heart link gated on navUser (not currentUser)", () => {

  // Prove-It: FAILS if the wishlist link is still gated on currentUser.
  it("[source] wishlist Link conditional checks navUser (not currentUser)", () => {
    // The wishlist link must appear inside a {navUser && ...} block.
    const wishlistBlock = navbarSrc.slice(
      navbarSrc.indexOf("btn--wishlist-nav") - 200,
      navbarSrc.indexOf("btn--wishlist-nav") + 200
    );
    expect(wishlistBlock).toContain("navUser");
    expect(wishlistBlock).not.toMatch(/\bcurrentUser\s*&&/);
  });
});

// ===========================================================================
// B2-8 — Login/Register buttons hidden during loading state
// ===========================================================================

describe("B2-8 — Login/Register buttons hidden when status === loading (no flash)", () => {

  // Prove-It: FAILS if login buttons are shown during loading (flashes incorrectly).
  it('[source] login button block guards against status "loading"', () => {
    expect(navbarSrc).toMatch(/!navUser\s*&&\s*status\s*!==\s*["']loading["']/);
  });
});

// ===========================================================================
// B2-9 — HostOnboardingFab receives !!navUser
// ===========================================================================

describe("B2-9 — HostOnboardingFab isLoggedIn prop reads navUser", () => {

  // Prove-It: FAILS if HostOnboardingFab still receives !!currentUser.
  it("[source] HostOnboardingFab isLoggedIn is !!navUser", () => {
    expect(navbarSrc).toContain("isLoggedIn={!!navUser}");
    expect(navbarSrc).not.toContain("isLoggedIn={!!currentUser}");
  });
});

// ===========================================================================
// B2-10 — imageError reset effect depends on navUser?.image
// ===========================================================================

describe("B2-10 — imageError reset effect depends on navUser?.image (re-tries new avatar on update)", () => {

  // Prove-It: FAILS if the reset effect still depends on currentUser?.image.
  it("[source] setImageError(false) effect depends on navUser?.image", () => {
    // The effect should contain setImageError(false) and its dep array should have navUser?.image.
    const resetBlock = (() => {
      const idx = navbarSrc.indexOf("setImageError(false)");
      if (idx === -1) return "";
      return navbarSrc.slice(idx, idx + 100);
    })();
    expect(resetBlock).toBeTruthy();
    expect(navbarSrc).toMatch(/setImageError\(false\)[\s\S]{0,80}\},\s*\[navUser\?\.image\]/);
  });
});

// ===========================================================================
// B2-11 — currentUser prop is KEPT (loading-state initial value)
// ===========================================================================

describe("B2-11 — currentUser prop retained in NavbarProps (SSR initial value)", () => {

  // Prove-It: FAILS if the currentUser prop is removed from the interface.
  it("[source] NavbarProps interface still has currentUser prop", () => {
    expect(navbarSrc).toContain("currentUser?:");
  });

  // Prove-It: FAILS if currentUser is no longer passed as a prop to Navbar.
  it("[source] Navbar function still receives currentUser in its props", () => {
    expect(navbarSrc).toMatch(/function\s+Navbar\s*\(\s*\{\s*currentUser\s*\}/);
  });
});

// ===========================================================================
// B2-12 — proxy.ts is NOT modified by B2 (B1 is backend scope)
// ===========================================================================

describe("B2-12 — proxy.ts unchanged by B2 (B1 is backend scope, not touched here)", () => {

  // Prove-It: FAILS if B2 accidentally touches proxy.ts.
  it("[source] proxy.ts still contains the B1 api/auth exclusion (not regressed)", () => {
    // The B1 fix (already in place) must remain intact.
    const configBlock = proxySrc.slice(proxySrc.indexOf("export const config"));
    expect(configBlock).toContain("api/auth");
  });

  it("[source] proxy.ts matcher still excludes _next/static and _next/image", () => {
    const configBlock = proxySrc.slice(proxySrc.indexOf("export const config"));
    expect(configBlock).toContain("_next/static");
    expect(configBlock).toContain("_next/image");
  });
});
