/**
 * cam-240-b2-navbar-session.test.ts — CAM-240 MEDIA-2 / B2 (updated for CAM-242 MEDIA-4)
 *
 * B2: Navbar avatar/name must update live (no re-login) after a Profile save.
 *
 * CAM-242 root fix: SessionProvider is now hydrated with the server session in
 * layout.tsx so useSession() is authoritative on first paint. The Navbar no
 * longer needs the frozen server `currentUser` prop; navUser is the single
 * source: session?.user ?? null.
 *
 * Source-inspection tests (matching repo style: cam-234, cam-220, cam-197, etc.).
 * The vitest environment is "node" — no DOM renderer.
 *
 * AC coverage (updated for CAM-242 single-source architecture):
 *   B2-1  useSession() destructures `data` (session) in addition to `status`.
 *   B2-2  navUser single-source: session?.user ?? null (no dual-source / loading branch).
 *   B2-3  navUser is declared as a const.
 *   B2-5  Avatar <img> src reads from navUser.image (not stale prop directly).
 *   B2-6  Dropdown label reads navUser.name (not currentUser.name).
 *   B2-7  Wishlist heart link gated on navUser.
 *   B2-8  Login/Register buttons guarded against loading state.
 *   B2-9  HostOnboardingFab receives !!navUser.
 *   B2-10 imageError reset effect depends on navUser?.image.
 *   B2-11 currentUser prop REMOVED from NavbarProps (CAM-242: vestigial, prevents regression).
 *   B2-12 proxy.ts is NOT modified by B2 (B1 is backend scope only).
 *
 * Prove-It notes:
 *   B2-1:  FAILS if `data` is removed from the useSession destructure.
 *   B2-2:  FAILS if the dual-source status-keyed ternary is re-introduced.
 *   B2-3:  FAILS if navUser is not declared as a const.
 *   B2-5:  FAILS if img src still reads currentUser.image.
 *   B2-6:  FAILS if DropdownMenuLabel still reads currentUser.name.
 *   B2-7:  FAILS if the wishlist Link is still gated on currentUser.
 *   B2-8:  FAILS if login buttons do not guard against the loading state.
 *   B2-9:  FAILS if HostOnboardingFab still receives !!currentUser.
 *   B2-10: FAILS if the imageError reset effect depends on currentUser?.image.
 *   B2-11: FAILS if the currentUser prop is re-added to NavbarProps.
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
// B2-2 — navUser single-source (CAM-242: no dual-source status ternary)
// ===========================================================================

describe("B2-2 — navUser is single-source session?.user ?? null (CAM-242 root fix)", () => {

  // Prove-It: FAILS if the dual-source status ternary is re-introduced.
  it("[source] navUser is session?.user ?? null (single-source, no status ternary)", () => {
    expect(navbarSrc).toMatch(/const\s+navUser\s*=\s*session\?\.user\s*\?\?\s*null/);
  });

  // Prove-It: FAILS if the old status-keyed dual-source ternary is still present.
  it("[source] navUser does NOT use the status-keyed loading ternary (removed in CAM-242)", () => {
    expect(navbarSrc).not.toMatch(/status\s*===\s*["']loading["']\s*\?\s*\(\s*currentUser/);
  });
});

// ===========================================================================
// B2-3 — navUser declared as a const
// ===========================================================================

describe("B2-3 — navUser declared as a const", () => {

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
// B2-11 — currentUser prop REMOVED from NavbarProps (CAM-242 cleanup)
// ===========================================================================

describe("B2-11 — currentUser prop removed from NavbarProps (CAM-242: vestigial prop eliminated)", () => {

  // Prove-It: FAILS if the currentUser prop is re-added to the NavbarProps interface.
  it("[source] NavbarProps interface does NOT declare currentUser prop", () => {
    expect(navbarSrc).not.toContain("currentUser?:");
  });

  // Prove-It: FAILS if Navbar function still receives currentUser in its props.
  it("[source] Navbar function does NOT destructure currentUser from props", () => {
    expect(navbarSrc).not.toMatch(/function\s+Navbar\s*\(\s*\{\s*currentUser/);
  });
});

// ===========================================================================
// B2-12 — proxy.ts is NOT modified by B2 (B1 is backend scope)
// ===========================================================================

describe("B2-12 — proxy.ts unchanged by B2 (B1 is backend scope, not touched here)", () => {

  // Prove-It: FAILS if B2 accidentally touches proxy.ts.
  it("[source] proxy.ts still contains the B1 api/auth exclusion (not regressed)", () => {
    const configBlock = proxySrc.slice(proxySrc.indexOf("export const config"));
    expect(configBlock).toContain("api/auth");
  });

  it("[source] proxy.ts matcher still excludes _next/static and _next/image", () => {
    const configBlock = proxySrc.slice(proxySrc.indexOf("export const config"));
    expect(configBlock).toContain("_next/static");
    expect(configBlock).toContain("_next/image");
  });
});
