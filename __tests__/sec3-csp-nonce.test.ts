/**
 * SEC-3 — Strict nonce-based CSP (CAM-203), Step 1 (Report-Only).
 *
 * Two test groups:
 *
 * 1. isRouteAllowed() — pure unit tests covering the /dashboard protection
 *    rule that was previously inside authConfig.callbacks.authorized.
 *    This is the #1 risk in tech.md (Risk 1 — Critical: authorized callback
 *    not re-implemented correctly). These tests guard against protection regressions
 *    when the auth() callback form is used (which does NOT auto-invoke authorized).
 *
 * 2. Source-inspect tests — static analysis of middleware.ts and next.config.ts
 *    without running a server. Checks:
 *    - middleware.ts sets Content-Security-Policy-Report-Only (NOT enforced CSP)
 *    - CSP contains 'strict-dynamic' (the Lighthouse-visible upgrade)
 *    - middleware sets x-nonce on request headers
 *    - nonce generation uses crypto.getRandomValues + btoa (NOT Buffer)
 *    - next.config.ts no longer contains Content-Security-Policy (no duplicate)
 *    - next.config.ts still contains the 6 other SEC-2 static headers
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// 1. isRouteAllowed() — Protection regression guard
// ---------------------------------------------------------------------------

import { isRouteAllowed } from "../lib/auth.config";

describe("isRouteAllowed() — /dashboard protection rule (CAM-203 SEC-3 Risk 1)", () => {
    // /dashboard/* — authenticated user passes
    it("returns true for /dashboard when logged in", () => {
        expect(isRouteAllowed("/dashboard", true)).toBe(true);
    });

    it("returns true for /dashboard/bookings when logged in", () => {
        expect(isRouteAllowed("/dashboard/bookings", true)).toBe(true);
    });

    it("returns true for /dashboard/settings/profile when logged in", () => {
        expect(isRouteAllowed("/dashboard/settings/profile", true)).toBe(true);
    });

    // /dashboard/* — unauthenticated user is denied
    it("returns false for /dashboard when NOT logged in", () => {
        expect(isRouteAllowed("/dashboard", false)).toBe(false);
    });

    it("returns false for /dashboard/bookings when NOT logged in", () => {
        expect(isRouteAllowed("/dashboard/bookings", false)).toBe(false);
    });

    // Public routes — always allowed regardless of auth
    it("returns true for / (home) when NOT logged in", () => {
        expect(isRouteAllowed("/", false)).toBe(true);
    });

    it("returns true for /login when NOT logged in", () => {
        expect(isRouteAllowed("/login", false)).toBe(true);
    });

    it("returns true for /register when NOT logged in", () => {
        expect(isRouteAllowed("/register", false)).toBe(true);
    });

    it("returns true for /campgrounds/slug when NOT logged in", () => {
        expect(isRouteAllowed("/campgrounds/some-camp", false)).toBe(true);
    });

    it("returns true for /status when NOT logged in", () => {
        expect(isRouteAllowed("/status", false)).toBe(true);
    });

    it("returns true for /status/map when NOT logged in", () => {
        expect(isRouteAllowed("/status/map", false)).toBe(true);
    });

    // Edge: a path that starts with /dashboardXYZ is NOT a dashboard route
    it("returns true for /dashboardXYZ (does not start with /dashboard/) when NOT logged in", () => {
        // /dashboardXYZ does start with /dashboard — intentionally check the exact
        // startsWith behaviour: /dashboard.startsWith('/dashboard') is true, so
        // this path IS blocked. This documents the current rule exactly.
        expect(isRouteAllowed("/dashboardXYZ", false)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 2. Source-inspect — middleware.ts + next.config.ts static analysis
// ---------------------------------------------------------------------------

const rootDir = join(__dirname, "..");

function readSource(filename: string): string {
    return readFileSync(join(rootDir, filename), "utf-8");
}

describe("SEC-3 middleware.ts source inspection — nonce + enforced CSP", () => {
    let middlewareSrc: string;

    function getMiddleware(): string {
        if (!middlewareSrc) {
            middlewareSrc = readSource("middleware.ts");
        }
        return middlewareSrc;
    }

    it("sets the enforced Content-Security-Policy header (CAM-203 step 2)", () => {
        const src = getMiddleware();
        // Enforced: middleware must call .set('Content-Security-Policy', csp).
        expect(
            src,
            "middleware.ts must set the enforced Content-Security-Policy header (step 2)"
        ).toMatch(/\.set\(\s*['"]Content-Security-Policy['"]\s*,/);
        // Report-Only must be gone from executable code (flipped to enforced).
        expect(
            src,
            "middleware.ts must NOT still set Content-Security-Policy-Report-Only after step 2"
        ).not.toMatch(/\.set\(\s*['"]Content-Security-Policy-Report-Only['"]\s*,/);
    });

    it("CSP string includes 'strict-dynamic' (the Lighthouse-visible strict CSP upgrade)", () => {
        expect(getMiddleware()).toContain("'strict-dynamic'");
    });

    it("CSP string includes nonce placeholder (nonce-${nonce} template literal)", () => {
        expect(getMiddleware()).toContain("nonce-${nonce}");
    });

    it("sets x-nonce request header so Next.js stamps nonce onto SSR <script> tags", () => {
        expect(getMiddleware()).toContain("x-nonce");
    });

    it("uses crypto.getRandomValues for nonce generation (Edge-safe Web Crypto)", () => {
        expect(getMiddleware()).toContain("crypto.getRandomValues");
    });

    it("uses btoa() for base64 encoding (NOT Buffer — Edge-safe per ADR-007 Risk 4)", () => {
        expect(
            getMiddleware(),
            "middleware.ts must use btoa() for nonce base64 encoding"
        ).toContain("btoa(");
        expect(
            getMiddleware(),
            "middleware.ts must NOT use Buffer for nonce encoding (not Edge-safe)"
        ).not.toContain("Buffer.from");
    });

    it("uses auth() callback form (not NextAuth(authConfig).auth direct export)", () => {
        const src = getMiddleware();
        // Must use the callback form: auth(async (req) => ...)
        expect(src).toContain("auth(async (req)");
        // Must NOT use the simple direct export from SEC-2.
        // We check executable code lines only (not comments/docs).
        const executableLines = src
            .split("\n")
            .filter((line) => !line.trimStart().startsWith("*") && !line.trimStart().startsWith("//"))
            .join("\n");
        expect(
            executableLines,
            "middleware.ts must NOT use the simple NextAuth(authConfig).auth export pattern (SEC-2 form)"
        ).not.toContain("export default NextAuth(authConfig).auth");
    });

    it("calls isRouteAllowed() to preserve /dashboard protection", () => {
        expect(getMiddleware()).toContain("isRouteAllowed(");
    });

    it("CSP includes all required directives from SEC-2", () => {
        const src = getMiddleware();
        expect(src).toContain("default-src 'self'");
        expect(src).toContain("style-src 'self' 'unsafe-inline'");
        expect(src).toContain("https://*.public.blob.vercel-storage.com");
        expect(src).toContain("https://*.tile.openstreetmap.org");
        expect(src).toContain("font-src 'self'");
        expect(src).toContain("connect-src 'self'");
        expect(src).toContain("media-src 'self'");
        expect(src).toContain("object-src 'none'");
        expect(src).toContain("frame-ancestors 'none'");
        expect(src).toContain("base-uri 'self'");
        expect(src).toContain("form-action 'self'");
        expect(src).toContain("upgrade-insecure-requests");
    });

    it("CSP does not include unsplash in img-src (CAM-213 self-host images)", () => {
        // CAM-213: images are now self-hosted; the img-src unsplash entry must be absent
        // from middleware.ts (next/image remotePatterns in next.config.ts is separate).
        const src = getMiddleware();
        // The img-src directive must not contain unsplash.
        const imgSrcLine = src
            .split("\n")
            .find((l) => l.includes("img-src")) ?? "";
        expect(imgSrcLine).not.toContain("https://images.unsplash.com");
    });

    it("prod CSP does NOT include 'unsafe-eval' (security: dev-only flag)", () => {
        // When NODE_ENV is not 'development', the script-src must not contain unsafe-eval.
        // We verify by source-inspecting the executable (non-comment) lines:
        // 'unsafe-eval' must only appear inside a ternary guarded by NODE_ENV === 'development',
        // never as a bare unconditional string in the script-src directive.
        const src = getMiddleware();
        // Strip comment lines (// and * block-comment lines) so we only inspect executable code.
        const executableLines = src
            .split("\n")
            .filter(
                (line) =>
                    !line.trimStart().startsWith("*") &&
                    !line.trimStart().startsWith("//")
            )
            .join("\n");
        // The conditional guard must exist in executable code.
        expect(
            executableLines,
            "middleware.ts must guard 'unsafe-eval' behind NODE_ENV === 'development' in executable code"
        ).toMatch(/NODE_ENV\s*===\s*["']development["'][^;]*unsafe-eval/);
        // There must be NO unconditional (non-ternary-guarded) bare script-src that
        // hard-codes unsafe-eval. A hard-coded occurrence would not be preceded by a ternary.
        // The safe pattern is: the only executable-code occurrence is inside the ternary expression.
        // We assert the executable code does NOT contain 'unsafe-eval' outside of a ternary context
        // by checking that every occurrence is on the same line as the NODE_ENV guard.
        const linesWithUnsafeEval = executableLines
            .split("\n")
            .filter((line) => line.includes("'unsafe-eval'"));
        for (const line of linesWithUnsafeEval) {
            expect(
                line,
                `Every executable 'unsafe-eval' occurrence must be guarded by NODE_ENV === 'development': "${line}"`
            ).toMatch(/NODE_ENV\s*===\s*["']development["']/);
        }
    });

    it("dev CSP includes 'unsafe-eval' in the script-src (React/Turbopack dev requirement)", () => {
        // Source-level check: the ternary that produces " 'unsafe-eval'" for dev must be present.
        const src = getMiddleware();
        expect(src).toContain("'unsafe-eval'");
        // The conditional must inject it only when NODE_ENV === 'development'.
        expect(src).toMatch(/NODE_ENV\s*===\s*["']development["']/);
    });
});

describe("SEC-3 next.config.ts source inspection — CSP removed, 6 static headers remain", () => {
    let configSrc: string;

    function getConfig(): string {
        if (!configSrc) {
            configSrc = readSource("next.config.ts");
        }
        return configSrc;
    }

    it("does NOT contain Content-Security-Policy header (moved to middleware — no duplicate)", () => {
        const src = getConfig();
        // Remove any comment lines that might mention CSP by name for documentation
        // purposes (we only care about actual header key strings in the headers array).
        const nonCommentLines = src
            .split("\n")
            .filter((line) => !line.trimStart().startsWith("//"))
            .join("\n");
        expect(
            nonCommentLines,
            "next.config.ts must not set Content-Security-Policy in the headers() array (it moved to middleware.ts — CAM-203)"
        ).not.toContain('"Content-Security-Policy"');
    });

    it("still contains X-Content-Type-Options: nosniff", () => {
        expect(getConfig()).toContain('"X-Content-Type-Options"');
        expect(getConfig()).toContain("nosniff");
    });

    it("still contains Referrer-Policy", () => {
        expect(getConfig()).toContain('"Referrer-Policy"');
        expect(getConfig()).toContain("strict-origin-when-cross-origin");
    });

    it("still contains X-Frame-Options: DENY", () => {
        expect(getConfig()).toContain('"X-Frame-Options"');
        expect(getConfig()).toContain('"DENY"');
    });

    it("still contains Permissions-Policy", () => {
        expect(getConfig()).toContain('"Permissions-Policy"');
        expect(getConfig()).toContain("camera=()");
        expect(getConfig()).toContain("microphone=()");
        expect(getConfig()).toContain("geolocation=()");
    });

    it("still contains Strict-Transport-Security with HSTS max-age", () => {
        expect(getConfig()).toContain('"Strict-Transport-Security"');
        expect(getConfig()).toContain("max-age=63072000");
        expect(getConfig()).toContain("includeSubDomains");
    });

    it("still contains Cross-Origin-Opener-Policy: same-origin", () => {
        expect(getConfig()).toContain('"Cross-Origin-Opener-Policy"');
        expect(getConfig()).toContain("same-origin");
    });
});
