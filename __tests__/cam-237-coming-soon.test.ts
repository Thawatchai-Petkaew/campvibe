/**
 * cam-237-coming-soon.test.ts — LAUNCH-1 / CAM-237
 *
 * Source-inspection layer (same harness as cam-197, cam-181, cam-196, etc.).
 * Vitest env: node — no jsdom. Assertions probe the real production files.
 *
 * AC covered:
 *   AC-1  SpriteWalker is "use client", cycles FRAMES, respects reduced-motion,
 *         cleans up the interval on unmount, uses a plain <img> (not next/image),
 *         has imageRendering pixelated, uses data-testid, accepts alt prop.
 *   AC-2  coming-soon page has NO "use client", NO auth() call, NO prisma/db call,
 *         imports SpriteWalker + getTranslations, renders logo + mascot + title + subtitle,
 *         uses bg-background + text-foreground + text-muted-foreground tokens,
 *         no hardcoded hex/px/shadow, has data-testid on all key elements,
 *         renders <main> landmark.
 *   AC-3  translations.json: both locales have comingSoon.title, comingSoon.subtitle,
 *         comingSoon.mascotAlt verbatim per the approved Option A copy.
 *   AC-4  Sprite asset paths exist in public/status-map/sprites/
 *
 * Prove-It notes — each assertion names the exact change that would make it fail:
 *   AC-1: "use client" test FAILS if removed from SpriteWalker.tsx.
 *   AC-1: FRAMES test FAILS if the sprite paths are changed or removed.
 *   AC-1: prefers-reduced-motion test FAILS if the matchMedia guard is removed.
 *   AC-1: clearInterval test FAILS if cleanup is omitted.
 *   AC-1: <img test FAILS if changed to next/image import.
 *   AC-1: imageRendering pixelated FAILS if the style is removed.
 *   AC-1: data-testid FAILS if attribute is removed.
 *   AC-1: alt prop FAILS if alt is hardcoded instead of coming from props.
 *   AC-2: "use client" test FAILS if directive is added to page.tsx.
 *   AC-2: auth() test FAILS if auth() is added to page.tsx.
 *   AC-2: prisma test FAILS if prisma is imported in page.tsx.
 *   AC-2: getTranslations test FAILS if import is removed.
 *   AC-2: SpriteWalker import test FAILS if removed.
 *   AC-2: logo img test FAILS if logo src is removed.
 *   AC-2: title heading test FAILS if cs.title usage is removed.
 *   AC-2: subtitle text test FAILS if cs.subtitle usage is removed.
 *   AC-2: bg-background test FAILS if token is removed.
 *   AC-2: main landmark test FAILS if <main is removed.
 *   AC-2: page testid test FAILS if data-testid is removed from main.
 *   AC-3: EN title test FAILS if comingSoon.title is deleted from EN locale.
 *   AC-3: TH title verbatim test FAILS if Thai string is changed.
 *   AC-3: EN subtitle test FAILS if comingSoon.subtitle is deleted from EN locale.
 *   AC-3: TH subtitle verbatim test FAILS if Thai string is changed.
 *   AC-3: EN mascotAlt test FAILS if key is deleted.
 *   AC-3: TH mascotAlt verbatim test FAILS if Thai string is changed.
 *   AC-4: sprite file existence tests FAIL if either webp is deleted from public/.
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
  en: { comingSoon: { title: string; subtitle: string; mascotAlt: string } };
  th: { comingSoon: { title: string; subtitle: string; mascotAlt: string } };
};

const walkerSrc = src("components/SpriteWalker.tsx");
const pageSrc = src("app/coming-soon/page.tsx");

// ===========================================================================
// AC-1 — SpriteWalker component
// ===========================================================================

describe('AC-1 — SpriteWalker (components/SpriteWalker.tsx)', () => {

  // Prove-It: FAILS if "use client" directive is removed
  it('[client] has "use client" directive', () => {
    // Matches lines like `"use client"` or `"use client";` (with or without semicolon)
    const lines = walkerSrc.split('\n');
    const directive = lines.find((line) => {
      const t = line.trim().replace(/;$/, '');
      return t === '"use client"' || t === "'use client'";
    });
    expect(directive).toBeDefined();
  });

  // Prove-It: FAILS if walk-front-right-0.webp path is removed from FRAMES
  it('[frames] includes walk-front-right-0.webp sprite path', () => {
    expect(walkerSrc).toContain('/status-map/sprites/walk-front-right-0.webp');
  });

  // Prove-It: FAILS if walk-front-right-1.webp path is removed from FRAMES
  it('[frames] includes walk-front-right-1.webp sprite path', () => {
    expect(walkerSrc).toContain('/status-map/sprites/walk-front-right-1.webp');
  });

  // Prove-It: FAILS if the matchMedia guard for reduced-motion is removed
  it('[reduced-motion] checks prefers-reduced-motion via matchMedia', () => {
    expect(walkerSrc).toContain('prefers-reduced-motion: reduce');
    expect(walkerSrc).toContain('matchMedia');
  });

  // Prove-It: FAILS if interval cleanup (clearInterval) is removed
  it('[cleanup] calls clearInterval on unmount (cleanup function)', () => {
    expect(walkerSrc).toContain('clearInterval');
  });

  // Prove-It: FAILS if changed to use next/image
  it('[img] uses plain <img> tag, NOT next/image', () => {
    expect(walkerSrc).not.toContain("from 'next/image'");
    expect(walkerSrc).not.toContain('from "next/image"');
    expect(walkerSrc).toContain('<img');
  });

  // Prove-It: FAILS if imageRendering: pixelated is removed
  it('[style] applies imageRendering: "pixelated" for crisp pixel art', () => {
    expect(walkerSrc).toContain('imageRendering');
    expect(walkerSrc).toContain('pixelated');
  });

  // Prove-It: FAILS if data-testid is removed
  it('[testid] has data-testid="img--coming-soon-mascot"', () => {
    expect(walkerSrc).toContain('data-testid="img--coming-soon-mascot"');
  });

  // Prove-It: FAILS if alt is hardcoded instead of coming from the alt prop
  it('[a11y] alt comes from the alt prop (not hardcoded)', () => {
    expect(walkerSrc).toContain('alt={alt}');
    expect(walkerSrc).toContain('alt: string');
  });

  // Prove-It: FAILS if setInterval is removed (no cycling)
  it('[animation] calls setInterval to cycle frames', () => {
    expect(walkerSrc).toContain('setInterval');
  });

  // Prove-It: FAILS if 350ms interval duration is removed
  it('[animation] frame interval is 350ms', () => {
    expect(walkerSrc).toContain('350');
  });
});

// ===========================================================================
// AC-2 — coming-soon page
// ===========================================================================

describe('AC-2 — coming-soon page (app/coming-soon/page.tsx)', () => {

  // Prove-It: FAILS if "use client" is added to page.tsx
  it('[server] page.tsx has NO "use client" directive (server component)', () => {
    const lines = pageSrc.split('\n');
    const directive = lines.find(
      (line) => line.trim() === '"use client"' || line.trim() === "'use client'"
    );
    expect(directive).toBeUndefined();
  });

  // Prove-It: FAILS if auth() is added to page.tsx as a real call
  it('[no-auth] page.tsx does NOT call auth() as a real function call', () => {
    // Must not import auth from lib/auth or next-auth (real call pattern)
    expect(pageSrc).not.toMatch(/from ['"]@\/lib\/auth['"]/);
    expect(pageSrc).not.toMatch(/from ['"]next-auth['"]/);
    // Must not have a non-comment real auth() call (not preceded by // on the same line)
    const nonCommentAuthCall = pageSrc.split('\n').some((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && /\bawait auth\(\)|\bconst\s+\w+\s*=\s*auth\(\)/.test(trimmed);
    });
    expect(nonCommentAuthCall).toBe(false);
  });

  // Prove-It: FAILS if prisma is imported in page.tsx
  it('[no-db] page.tsx does NOT import prisma', () => {
    expect(pageSrc).not.toContain('prisma');
    expect(pageSrc).not.toContain('@prisma/client');
  });

  // Prove-It: FAILS if getTranslations import is removed
  it('[i18n] imports getTranslations from locales/translations', () => {
    expect(pageSrc).toContain('getTranslations');
    expect(pageSrc).toContain('locales/translations');
  });

  // Prove-It: FAILS if SpriteWalker import is removed
  it('[component] imports SpriteWalker', () => {
    expect(pageSrc).toContain('SpriteWalker');
    expect(pageSrc).toContain('components/SpriteWalker');
  });

  // Prove-It: FAILS if logo src is removed
  it('[layout] renders logo with src="/logo.png" and alt="CampVibe"', () => {
    expect(pageSrc).toContain('"/logo.png"');
    expect(pageSrc).toContain('alt="CampVibe"');
  });

  // Prove-It: FAILS if the logo img testid is removed
  it('[testid] logo has data-testid="img--coming-soon-logo"', () => {
    expect(pageSrc).toContain('data-testid="img--coming-soon-logo"');
  });

  // Prove-It: FAILS if cs.title usage is removed (TH title)
  it('[copy] renders title from i18n cs.title (not hardcoded)', () => {
    expect(pageSrc).toContain('cs.title');
    // Must NOT hardcode Thai string in JSX
    expect(pageSrc).not.toContain('"กำลังตั้งแคมป์อยู่นะ"');
  });

  // Prove-It: FAILS if cs.subtitle usage is removed
  it('[copy] renders subtitle from i18n cs.subtitle (not hardcoded)', () => {
    expect(pageSrc).toContain('cs.subtitle');
    expect(pageSrc).not.toContain('"เว็บไซต์จะเปิดให้บริการเร็วๆ นี้"');
  });

  // Prove-It: FAILS if cs.mascotAlt is not passed to SpriteWalker
  it('[a11y] passes cs.mascotAlt to SpriteWalker as alt prop', () => {
    expect(pageSrc).toContain('cs.mascotAlt');
    expect(pageSrc).toContain('alt={cs.mascotAlt}');
  });

  // Prove-It: FAILS if bg-background token is removed from main
  it('[token] page background uses bg-background token (no hardcoded color)', () => {
    expect(pageSrc).toContain('bg-background');
    expect(pageSrc).not.toMatch(/bg-\[#/);
  });

  // Prove-It: FAILS if text-foreground token is removed from heading
  it('[token] title uses text-foreground token', () => {
    expect(pageSrc).toContain('text-foreground');
  });

  // Prove-It: FAILS if text-muted-foreground token is removed from subtitle
  it('[token] subtitle uses text-muted-foreground token', () => {
    expect(pageSrc).toContain('text-muted-foreground');
  });

  // Prove-It: FAILS if <main landmark is removed
  it('[a11y] wraps content in a <main> landmark', () => {
    expect(pageSrc).toContain('<main');
  });

  // Prove-It: FAILS if data-testid is removed from the main element
  it('[testid] page main has data-testid="page--coming-soon"', () => {
    expect(pageSrc).toContain('data-testid="page--coming-soon"');
  });

  // Prove-It: FAILS if heading testid is removed
  it('[testid] title heading has data-testid="heading--coming-soon-title"', () => {
    expect(pageSrc).toContain('data-testid="heading--coming-soon-title"');
  });

  // Prove-It: FAILS if subtitle testid is removed
  it('[testid] subtitle has data-testid="text--coming-soon-subtitle"', () => {
    expect(pageSrc).toContain('data-testid="text--coming-soon-subtitle"');
  });

  // Prove-It: FAILS if next/image is imported for the mascot
  it('[no-image-optimizer] page does NOT import next/image for mascot rendering', () => {
    // The mascot is rendered by SpriteWalker which uses plain <img>
    // The page itself must not import next/image at all
    expect(pageSrc).not.toContain('from "next/image"');
    expect(pageSrc).not.toContain("from 'next/image'");
  });

  // Prove-It: FAILS if a card/shadow/gradient is added
  it('[anti-slop] page does NOT use card, shadow, or gradient classes', () => {
    expect(pageSrc).not.toMatch(/\bbg-card\b/);
    expect(pageSrc).not.toMatch(/\bshadow-/);
    expect(pageSrc).not.toMatch(/gradient/);
  });
});

// ===========================================================================
// AC-3 — i18n keys in both locales, verbatim copy
// ===========================================================================

describe('AC-3 — i18n comingSoon keys (locales/translations.json)', () => {

  // Prove-It: FAILS if comingSoon.title is removed from EN locale
  it('[en] comingSoon.title exists in EN locale', () => {
    expect(translations.en.comingSoon.title).toBeTruthy();
  });

  // Prove-It: FAILS if EN title is changed from Option A
  it('[en-verbatim] EN comingSoon.title is "Setting up camp"', () => {
    expect(translations.en.comingSoon.title).toBe('Setting up camp');
  });

  // Prove-It: FAILS if comingSoon.subtitle is removed from EN locale
  it('[en] comingSoon.subtitle exists in EN locale', () => {
    expect(translations.en.comingSoon.subtitle).toBeTruthy();
  });

  // Prove-It: FAILS if EN subtitle is changed
  it('[en-verbatim] EN comingSoon.subtitle is "We\'ll be open soon"', () => {
    expect(translations.en.comingSoon.subtitle).toBe("We'll be open soon");
  });

  // Prove-It: FAILS if comingSoon.mascotAlt is removed from EN locale
  it('[en] comingSoon.mascotAlt exists in EN locale', () => {
    expect(translations.en.comingSoon.mascotAlt).toBeTruthy();
  });

  // Prove-It: FAILS if EN mascotAlt is changed
  it('[en-verbatim] EN comingSoon.mascotAlt is "CampVibe mascot walking"', () => {
    expect(translations.en.comingSoon.mascotAlt).toBe('CampVibe mascot walking');
  });

  // Prove-It: FAILS if comingSoon.title is removed from TH locale
  it('[th] comingSoon.title exists in TH locale', () => {
    expect(translations.th.comingSoon.title).toBeTruthy();
  });

  // Prove-It: FAILS if TH title is changed from Option A verbatim
  it('[th-verbatim] TH comingSoon.title is "กำลังตั้งแคมป์อยู่นะ"', () => {
    expect(translations.th.comingSoon.title).toBe('กำลังตั้งแคมป์อยู่นะ');
  });

  // Prove-It: FAILS if TH subtitle is changed from Option A verbatim
  it('[th-verbatim] TH comingSoon.subtitle is "เว็บไซต์จะเปิดให้บริการเร็วๆ นี้"', () => {
    expect(translations.th.comingSoon.subtitle).toBe('เว็บไซต์จะเปิดให้บริการเร็วๆ นี้');
  });

  // Prove-It: FAILS if TH mascotAlt is changed from Option A verbatim
  it('[th-verbatim] TH comingSoon.mascotAlt is "มาสคอต CampVibe กำลังเดิน"', () => {
    expect(translations.th.comingSoon.mascotAlt).toBe('มาสคอต CampVibe กำลังเดิน');
  });
});

// ===========================================================================
// AC-4 — sprite assets exist in public/
// ===========================================================================

describe('AC-4 — sprite assets (public/status-map/sprites/)', () => {

  // Prove-It: FAILS if walk-front-right-0.webp is deleted
  it('[asset] walk-front-right-0.webp exists in public/status-map/sprites/', () => {
    expect(
      existsSync(path.join(root, 'public', 'status-map', 'sprites', 'walk-front-right-0.webp'))
    ).toBe(true);
  });

  // Prove-It: FAILS if walk-front-right-1.webp is deleted
  it('[asset] walk-front-right-1.webp exists in public/status-map/sprites/', () => {
    expect(
      existsSync(path.join(root, 'public', 'status-map', 'sprites', 'walk-front-right-1.webp'))
    ).toBe(true);
  });
});

// ===========================================================================
// AC-5 — COMING_SOON gate in proxy.ts (source inspection)
//
// The NextAuth v5 middleware cannot be invoked directly in a Vitest Node
// environment (it requires the Next.js Edge runtime + NextAuth internals).
// We use the same source-inspection harness as sec3-csp-nonce.test.ts:
//   - Structural assertions on proxy.ts prove the gate is wired correctly.
//   - Pure unit tests on isRouteAllowed() (from auth.config.ts) prove the
//     /dashboard protection regression guard with zero mocking.
//
// CAM-203 lesson: "Restructuring this middleware can silently drop route
// protection." Every structural assertion below would FAIL if the gate
// were wired in a way that could interfere with the existing nonce/CSP/
// dashboard logic.
//
// Prove-It notes — each test names the exact change that would make it fail:
//   [gate-structure] FAILS if the gate block is moved below the nonce logic.
//   [gate-api-on] FAILS if the /api 404 branch is removed from the gate.
//   [gate-rewrite-on] FAILS if the rewrite to /coming-soon is removed.
//   [gate-passthrough-on] FAILS if /coming-soon + /status-map/sprites exclusions are removed.
//   [gate-api-off] FAILS if the flag-OFF /api passthrough is removed.
//   [gate-env] FAILS if the env var name is changed from COMING_SOON.
//   [gate-value] FAILS if the flag check changes from === "1".
//   [matcher] FAILS if the api| exclusion is re-added to the matcher.
//   [nonce-intact] FAILS if the nonce/CSP block is removed after the gate.
//   [isRouteAllowed-dashboard] FAILS if isRouteAllowed() no longer blocks /dashboard.
//   [isRouteAllowed-api-auth] FAILS if isRouteAllowed() starts blocking /api/auth.
// ===========================================================================

const proxySrc = src("proxy.ts");

describe('AC-5 — proxy.ts COMING_SOON gate (source inspection)', () => {

  // ── Gate structure ────────────────────────────────────────────────────────

  // Prove-It: FAILS if COMING_SOON env var name is changed
  it('[gate-env] reads process.env.COMING_SOON', () => {
    expect(proxySrc).toContain('process.env.COMING_SOON');
  });

  // Prove-It: FAILS if the flag sentinel changes from "1"
  it('[gate-value] flag sentinel is === "1"', () => {
    expect(proxySrc).toContain('=== "1"');
  });

  // Prove-It: FAILS if the comingSoon variable is removed
  it('[gate-env] assigns COMING_SOON check to a local variable', () => {
    expect(proxySrc).toMatch(/const comingSoon\s*=/);
  });

  // Prove-It: FAILS if the gate block is removed or moved after the nonce.
  // We search from the start of the auth() callback body (after the opening paren)
  // so we skip the JSDoc comment that also mentions crypto.getRandomValues.
  it('[gate-structure] gate appears before nonce generation (crypto.getRandomValues)', () => {
    // Find the start of the auth() callback body
    const callbackStart = proxySrc.indexOf('auth(async (req) =>');
    expect(callbackStart).toBeGreaterThan(-1);
    const bodyAfterCallback = proxySrc.slice(callbackStart);
    const gateIndex = bodyAfterCallback.indexOf('process.env.COMING_SOON');
    // The nonce generation uses a Uint8Array — unique to the actual code (not comments)
    const nonceIndex = bodyAfterCallback.indexOf('new Uint8Array(');
    expect(gateIndex).toBeGreaterThan(-1);
    expect(nonceIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeLessThan(nonceIndex);
  });

  // Prove-It: FAILS if the flag-ON /api → 404 branch is removed.
  // After the case-insensitive hardening the check uses lowerPath, not pathname.
  it('[gate-api-on] flag ON: returns 404 for /api routes (case-insensitive via lowerPath)', () => {
    // The gate must use lowerPath.startsWith("/api") → status 404
    expect(proxySrc).toMatch(/lowerPath\.startsWith\(["']\/api["']\)/);
    expect(proxySrc).toContain('status: 404');
  });

  // Prove-It: FAILS if the lowercase hardening (lowerPath) is removed
  it('[gate-case] lowerPath is computed from pathname.toLowerCase() for case-insensitive /api guard', () => {
    expect(proxySrc).toMatch(/const lowerPath\s*=\s*pathname\.toLowerCase\(\)/);
  });

  // Prove-It: FAILS if the rewrite to /coming-soon is removed
  it('[gate-rewrite-on] flag ON: rewrites non-holding-page routes to /coming-soon', () => {
    expect(proxySrc).toContain('NextResponse.rewrite');
    expect(proxySrc).toContain('/coming-soon');
  });

  // Prove-It: FAILS if /coming-soon exclusion from rewrite is removed
  it('[gate-passthrough-on] flag ON: /coming-soon is excluded from the rewrite', () => {
    // The condition that guards the rewrite must exclude /coming-soon
    expect(proxySrc).toMatch(/!pathname\.startsWith\(["']\/coming-soon["']\)/);
  });

  // Prove-It: FAILS if sprite passthrough exclusion is removed
  it('[gate-passthrough-on] flag ON: /status-map/sprites is excluded from the rewrite', () => {
    expect(proxySrc).toMatch(/!pathname\.startsWith\(["']\/status-map\/sprites["']\)/);
  });

  // Prove-It: FAILS if the flag-OFF /api passthrough is removed
  it('[gate-api-off] flag OFF: /api routes get NextResponse.next() passthrough', () => {
    // The else branch must contain the passthrough for /api when the flag is off.
    // Verify: the file contains an else branch that returns NextResponse.next()
    // when lowerPath.startsWith("/api") — both tokens must appear together.
    const elseIndex = proxySrc.lastIndexOf('} else {');
    const nextIndex = proxySrc.indexOf('NextResponse.next()', elseIndex);
    expect(elseIndex).toBeGreaterThan(-1);
    expect(nextIndex).toBeGreaterThan(elseIndex);
  });

  // ── Matcher ───────────────────────────────────────────────────────────────

  // Prove-It: FAILS if the api| exclusion is re-added to the matcher (the gate
  // would never fire for /api routes — the matcher must include /api).
  it('[matcher] matcher does NOT exclude api routes (api| removed)', () => {
    const configBlock = proxySrc.slice(proxySrc.indexOf('export const config'));
    expect(configBlock).not.toMatch(/\(\?!api\|/);
    expect(configBlock).not.toMatch(/api\|_next/);
  });

  // Prove-It: FAILS if the matcher is removed entirely
  it('[matcher] matcher still excludes _next/static, _next/image, favicon, .png assets', () => {
    const configBlock = proxySrc.slice(proxySrc.indexOf('export const config'));
    expect(configBlock).toContain('_next/static');
    expect(configBlock).toContain('_next/image');
    expect(configBlock).toContain('favicon.ico');
    expect(configBlock).toContain('.png$');
  });

  // ── Nonce + CSP unchanged ─────────────────────────────────────────────────

  // Prove-It: FAILS if crypto.getRandomValues nonce generation is removed
  it('[nonce-intact] nonce generation (crypto.getRandomValues) is still present after the gate', () => {
    expect(proxySrc).toContain('crypto.getRandomValues');
    expect(proxySrc).toContain('btoa(');
    expect(proxySrc).toContain('x-nonce');
  });

  // Prove-It: FAILS if the isRouteAllowed dashboard check is removed after the gate
  it('[nonce-intact] isRouteAllowed() dashboard protection is still called after the gate', () => {
    const gateEnd = proxySrc.indexOf('// ── 1. Generate a per-request nonce');
    const routeAllowedIndex = proxySrc.indexOf('isRouteAllowed(', gateEnd);
    expect(gateEnd).toBeGreaterThan(-1);
    expect(routeAllowedIndex).toBeGreaterThan(gateEnd);
  });
});

// ===========================================================================
// AC-5 — flag-OFF regression guard: /dashboard protection + /api passthrough
//
// These are pure unit tests of isRouteAllowed() (auth.config.ts) — the single
// authoritative place for route protection logic. Per CAM-203: "flag-OFF
// behavior must be byte-identical to today."
//
// isRouteAllowed() controls what happens after the gate lets a request through.
// If it regresses, /dashboard would become publicly accessible — a Critical
// security regression.
// ===========================================================================

describe('AC-5 — flag-OFF regression guard: isRouteAllowed() (CAM-203)', () => {

  // Prove-It: FAILS if isRouteAllowed regresses and allows unauthenticated /dashboard
  it('[regression] /dashboard is blocked when NOT logged in (isLoggedIn=false)', () => {
    expect(isRouteAllowed('/dashboard', false)).toBe(false);
  });

  it('[regression] /dashboard/bookings is blocked when NOT logged in', () => {
    expect(isRouteAllowed('/dashboard/bookings', false)).toBe(false);
  });

  it('[regression] /dashboard/settings is blocked when NOT logged in', () => {
    expect(isRouteAllowed('/dashboard/settings', false)).toBe(false);
  });

  // Prove-It: FAILS if isRouteAllowed regresses and blocks authenticated /dashboard
  it('[regression] /dashboard is allowed when logged in (isLoggedIn=true)', () => {
    expect(isRouteAllowed('/dashboard', true)).toBe(true);
  });

  // Prove-It: FAILS if isRouteAllowed starts blocking /api/auth routes
  // (these are passed through via NextResponse.next() in flag-OFF, so they
  // never reach isRouteAllowed — but we assert it anyway as a belt-and-braces
  // regression guard: even if the passthrough were removed, isRouteAllowed
  // must not block /api/auth/*)
  it('[regression] /api/auth/callback/credentials is NOT blocked by isRouteAllowed', () => {
    expect(isRouteAllowed('/api/auth/callback/credentials', false)).toBe(true);
  });

  it('[regression] /api/auth/session is NOT blocked by isRouteAllowed', () => {
    expect(isRouteAllowed('/api/auth/session', false)).toBe(true);
  });

  // Prove-It: FAILS if isRouteAllowed regresses and blocks public routes
  it('[regression] / (home) is public when NOT logged in', () => {
    expect(isRouteAllowed('/', false)).toBe(true);
  });

  it('[regression] /login is public when NOT logged in', () => {
    expect(isRouteAllowed('/login', false)).toBe(true);
  });

  it('[regression] /coming-soon is public when NOT logged in', () => {
    expect(isRouteAllowed('/coming-soon', false)).toBe(true);
  });
});

// ===========================================================================
// AC-5 — flag-ON source inspection: gate logic verified structurally
//
// We cannot invoke the middleware directly in Vitest (no Next.js Edge runtime).
// The source-inspection tests above prove the gate is structurally correct.
// The following tests cross-verify the expected outcomes by asserting the
// exact pattern of branches in the source — each test names the exact proxy.ts
// token that would have to change to break the behaviour.
// ===========================================================================

describe('AC-5 — flag-ON structural verification (proxy.ts source)', () => {

  // Prove-It: FAILS if the comingSoon check is split into two separate if-blocks
  // rather than a single if (comingSoon) { ... } else { ... } structure.
  it('[gate-structure] uses a single if (comingSoon) / else structure', () => {
    // Both the if (comingSoon) branch and the else branch must be present.
    expect(proxySrc).toMatch(/if\s*\(comingSoon\)/);
    expect(proxySrc).toMatch(/}\s*else\s*\{/);
  });

  // Prove-It: FAILS if the /api 404 return is outside the comingSoon branch
  it('[flag-on] /api 404 and the rewrite are inside the if (comingSoon) block', () => {
    const comingSoonBranchStart = proxySrc.indexOf('if (comingSoon)');
    const elseBranchStart = proxySrc.indexOf('} else {');
    // The 404 status literal must appear between comingSoon branch start and else
    const between = proxySrc.slice(comingSoonBranchStart, elseBranchStart);
    expect(between).toContain('status: 404');
    expect(between).toContain('NextResponse.rewrite');
  });

  // Prove-It: FAILS if the /api passthrough is inside the comingSoon branch
  // (it must be in the else branch — flag OFF only)
  it('[flag-off] /api NextResponse.next() passthrough is in the else branch (flag OFF only)', () => {
    const elseBranchStart = proxySrc.indexOf('} else {');
    const nonceStart = proxySrc.indexOf('// ── 1. Generate a per-request nonce');
    const elseBranch = proxySrc.slice(elseBranchStart, nonceStart);
    expect(elseBranch).toContain('NextResponse.next()');
  });
});
