/**
 * cam-242-media4-session-hydration.test.ts — CAM-242 MEDIA-4
 *
 * Root fix for the session-sync bug: hydrate SessionProvider with the server
 * session so useSession() is authoritative on first paint everywhere.
 *
 * Problem: SessionProvider was mounted with no initial session prop → useSession()
 * started at status="loading" on every page load. Navbar used a dual-source
 * arbitration (frozen server prop vs client session) that caused stale
 * avatar/name on login/logout until a full reload.
 *
 * Fix:
 *   1. app/layout.tsx calls auth() and passes session to <Providers session={session}>.
 *   2. Providers.tsx accepts + forwards the session prop to <SessionProvider session={session}>.
 *   3. Navbar.tsx uses navUser = session?.user ?? null (single authoritative source).
 *   4. currentUser prop removed from NavbarProps (vestigial; prevents regression).
 *   5. All 8 <Navbar> call sites remove the currentUser={...} prop.
 *
 * Layer: source-inspect (static parse of real production files).
 *
 * AC coverage:
 *   AC-1  layout.tsx imports auth from @/lib/auth.
 *   AC-2  RootLayout is async.
 *   AC-3  layout.tsx calls auth() and captures the result.
 *   AC-4  layout.tsx passes session to <Providers session={session}>.
 *   AC-5  Providers.tsx imports Session type from next-auth.
 *   AC-6  Providers function signature accepts { children, session: Session | null }.
 *   AC-7  Providers passes session to <SessionProvider session={session}>.
 *   AC-8  Navbar navUser is single-source: session?.user ?? null.
 *   AC-9  NavbarProps has no currentUser prop.
 *   AC-10 No Navbar call site in app/ passes currentUser prop.
 *
 * Prove-It notes:
 *   AC-1:  FAILS if auth import is removed from layout.tsx.
 *   AC-2:  FAILS if RootLayout is not async.
 *   AC-3:  FAILS if auth() is not called in layout.tsx.
 *   AC-4:  FAILS if <Providers> is called without session prop in layout.tsx.
 *   AC-5:  FAILS if Session type import is removed from Providers.tsx.
 *   AC-6:  FAILS if Providers signature loses the session param.
 *   AC-7:  FAILS if SessionProvider no longer receives the session prop.
 *   AC-8:  FAILS if the dual-source ternary is re-introduced in Navbar.
 *   AC-9:  FAILS if currentUser prop is re-added to NavbarProps.
 *   AC-10: FAILS if any call site passes currentUser={...} to <Navbar>.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = process.cwd();
const src = (relPath: string) => fs.readFileSync(path.join(root, relPath), "utf-8");

const layoutSrc = src("app/layout.tsx");
const providersSrc = src("components/Providers.tsx");
const navbarSrc = src("components/Navbar.tsx");

// ===========================================================================
// AC-1 — layout.tsx imports auth
// ===========================================================================

describe("AC-1 — layout.tsx imports auth from @/lib/auth", () => {
  it("[source] layout.tsx has import { auth } from @/lib/auth", () => {
    expect(layoutSrc).toMatch(/import\s+\{[^}]*\bauth\b[^}]*\}\s+from\s+["']@\/lib\/auth["']/);
  });
});

// ===========================================================================
// AC-2 — RootLayout is async
// ===========================================================================

describe("AC-2 — RootLayout is an async function", () => {
  it("[source] RootLayout function is async", () => {
    expect(layoutSrc).toMatch(/export\s+default\s+async\s+function\s+RootLayout/);
  });
});

// ===========================================================================
// AC-3 — layout.tsx calls auth()
// ===========================================================================

describe("AC-3 — layout.tsx calls auth() to obtain the server session", () => {
  it("[source] layout.tsx calls await auth()", () => {
    expect(layoutSrc).toMatch(/await\s+auth\(\)/);
  });

  it("[source] layout.tsx captures the result as session", () => {
    expect(layoutSrc).toMatch(/const\s+session\s*=\s*await\s+auth\(\)/);
  });
});

// ===========================================================================
// AC-4 — layout.tsx passes session to <Providers>
// ===========================================================================

describe("AC-4 — layout.tsx passes session prop to <Providers>", () => {
  it("[source] <Providers session={session}> in layout.tsx", () => {
    expect(layoutSrc).toMatch(/<Providers\s+session=\{session\}/);
  });

  it("[source] <Providers> is NOT called without the session prop", () => {
    // Must not have a bare <Providers> or <Providers> without session= after the fix.
    expect(layoutSrc).not.toMatch(/<Providers\s*>/);
  });
});

// ===========================================================================
// AC-5 — Providers.tsx imports Session type from next-auth
// ===========================================================================

describe("AC-5 — Providers.tsx imports Session type from next-auth", () => {
  it("[source] Providers.tsx has import type { Session } from next-auth", () => {
    expect(providersSrc).toMatch(/import\s+type\s+\{[^}]*\bSession\b[^}]*\}\s+from\s+["']next-auth["']/);
  });
});

// ===========================================================================
// AC-6 — Providers accepts { children, session: Session | null }
// ===========================================================================

describe("AC-6 — Providers function accepts { children, session: Session | null }", () => {
  it("[source] Providers signature includes session: Session | null", () => {
    expect(providersSrc).toMatch(/session\s*:\s*Session\s*\|\s*null/);
  });

  it("[source] Providers destructures both children and session", () => {
    expect(providersSrc).toMatch(/\{\s*children\s*,\s*session\s*\}/);
  });
});

// ===========================================================================
// AC-7 — Providers passes session to <SessionProvider>
// ===========================================================================

describe("AC-7 — Providers passes session prop to <SessionProvider>", () => {
  it("[source] <SessionProvider session={session}> in Providers.tsx", () => {
    expect(providersSrc).toMatch(/<SessionProvider\s+session=\{session\}/);
  });

  it("[source] SessionProvider is NOT called without session prop", () => {
    // Must not have a bare <SessionProvider> without session.
    expect(providersSrc).not.toMatch(/<SessionProvider\s*>/);
  });
});

// ===========================================================================
// AC-8 — Navbar navUser is single-source (no dual-source status ternary)
// ===========================================================================

describe("AC-8 — Navbar navUser = session?.user ?? null (single-source, no loading ternary)", () => {
  it("[source] navUser is single-source session?.user ?? null", () => {
    expect(navbarSrc).toMatch(/const\s+navUser\s*=\s*session\?\.user\s*\?\?\s*null/);
  });

  it("[source] dual-source status ternary is NOT present in Navbar", () => {
    expect(navbarSrc).not.toMatch(/status\s*===\s*["']loading["']\s*\?\s*\(\s*currentUser/);
  });
});

// ===========================================================================
// AC-9 — NavbarProps has no currentUser prop
// ===========================================================================

describe("AC-9 — NavbarProps does NOT declare currentUser (vestigial prop removed)", () => {
  it("[source] NavbarProps interface has no currentUser property", () => {
    expect(navbarSrc).not.toContain("currentUser?:");
  });

  it("[source] Navbar function does not destructure currentUser", () => {
    expect(navbarSrc).not.toMatch(/function\s+Navbar\s*\(\s*\{\s*currentUser/);
  });
});

// ===========================================================================
// AC-10 — No call site passes currentUser={...} to <Navbar>
// ===========================================================================

describe("AC-10 — No app/ call site passes currentUser prop to <Navbar>", () => {
  const callSites = [
    "app/page.tsx",
    "app/wishlist/page.tsx",
    "app/host/page.tsx",
    "app/host/new/page.tsx",
    "app/campgrounds/[slug]/page.tsx",
    "app/bookings/page.tsx",
    "app/bookings/[id]/page.tsx",
    "app/bookings/[id]/confirmation/page.tsx",
  ];

  for (const file of callSites) {
    it(`[source] ${file} does NOT pass currentUser to <Navbar>`, () => {
      const fileSrc = src(file);
      // <Navbar currentUser= must not appear in any call site
      expect(fileSrc).not.toMatch(/<Navbar\s+currentUser=/);
    });
  }
});
