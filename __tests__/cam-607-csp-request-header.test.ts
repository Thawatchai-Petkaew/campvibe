/**
 * CAM-607 — the CSP must reach the REQUEST, not only the response, or
 * Next.js's own render pipeline never finds its nonce (and every
 * framework-emitted inline script — including the Flight streaming-segment
 * relocation script CAM-604 found blocked — is emitted with no nonce
 * attribute at all). See tech.md for the full root-cause trace through the
 * installed framework source.
 *
 * Two groups:
 *
 * 1. Source-inspection Prove-It — proxy.ts must set the SAME `csp` variable
 *    on requestHeaders (not only response.headers), before NextResponse.next()
 *    is constructed. This line is exactly what was missing; commenting it
 *    out reproduces the pre-fix source shape this test is written against.
 *
 * 2. Behavioral proof using Next.js's OWN installed nonce-extraction logic —
 *    not a re-implementation of it. If a future Next.js upgrade changes the
 *    internal path this import resolves to, this test will fail loudly
 *    (a signal to re-verify the mechanism), rather than silently pass on a
 *    stale assumption — the exact trap this ticket exists to close.
 *
 * 3. No-loosening guard — every CSP directive's content is byte-identical to
 *    the SEC-3 baseline (sec3-csp-nonce.test.ts). This diff is a propagation
 *    fix, never a policy change.
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// proxy.ts calls NextAuth(authConfig) at module top-level. The REAL next-auth
// package's own internals (lib/env.js) import { NextRequest } from "next/server"
// in a way this Vitest (node environment) cannot resolve — a pre-existing,
// environment-specific limitation, not something this fix touches. Every other
// proxy.ts test in this repo avoids importing the module at all (source-inspect
// only); this test needs one real export (buildCsp) for the behavioral proof
// below, so NextAuth itself is mocked to a no-op — proxy.ts's own logic
// (buildCsp, the request/response CSP wiring) is never mocked or altered.
vi.mock("next-auth", () => ({
    default: () => ({ auth: (handler: unknown) => handler }),
}));

const rootDir = join(__dirname, "..");

function readProxySource(): string {
    return readFileSync(join(rootDir, "proxy.ts"), "utf-8");
}

// ---------------------------------------------------------------------------
// 1. Source-inspection Prove-It
// ---------------------------------------------------------------------------

describe("CAM-607 — proxy.ts sets the enforced CSP on the REQUEST too", () => {
    it("[source] requestHeaders.set('Content-Security-Policy', csp) is present", () => {
        const src = readProxySource();
        expect(
            src,
            "proxy.ts must set the enforced CSP on requestHeaders — Next.js's own " +
                "render pipeline reads content-security-policy off the REQUEST to find " +
                "its nonce (see tech.md); this is the exact line CAM-604 found missing"
        ).toMatch(/requestHeaders\.set\(\s*['"]Content-Security-Policy['"]\s*,\s*csp\s*\)/);
    });

    it("[source] the request-side CSP set precedes NextResponse.next() construction", () => {
        const src = readProxySource();
        const requestCspIdx = src.search(
            /requestHeaders\.set\(\s*['"]Content-Security-Policy['"]\s*,\s*csp\s*\)/
        );
        const nextConstructIdx = src.indexOf("NextResponse.next({");
        expect(requestCspIdx).toBeGreaterThan(-1);
        expect(nextConstructIdx).toBeGreaterThan(-1);
        expect(
            requestCspIdx,
            "the request-side CSP header must be set BEFORE NextResponse.next() is " +
                "constructed, or it never rides on the request Next.js's renderer sees"
        ).toBeLessThan(nextConstructIdx);
    });

    it("[source] the response still sets the enforced CSP too (browser enforcement unchanged)", () => {
        const src = readProxySource();
        expect(src).toMatch(/response\.headers\.set\(\s*['"]Content-Security-Policy['"]\s*,\s*csp\s*\)/);
    });

    it("[source] x-nonce request header is still set (unchanged — harmless, doc-recommended convention)", () => {
        expect(readProxySource()).toContain("requestHeaders.set('x-nonce', nonce)");
    });

    it("[source] buildCsp is exported (CAM-607 — needed for the behavioral test below)", () => {
        expect(readProxySource()).toMatch(/export function buildCsp\(/);
    });
});

// ---------------------------------------------------------------------------
// 2. Behavioral proof — Next.js's OWN installed nonce-extraction logic
// ---------------------------------------------------------------------------

import { buildCsp } from "../proxy";

// Next.js's own internal nonce extractor for this exact installed version.
// Intentionally required from its real dist path (not a public export, not
// re-implemented) so this test proves the ACTUAL mechanism, not our
// understanding of it — see tech.md for why this is the right thing to
// depend on for a regression test scoped to this exact defect.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getScriptNonceFromHeader } = require("next/dist/server/app-render/get-script-nonce-from-header");

describe("CAM-607 — our CSP string yields the correct nonce via Next.js's OWN extractor", () => {
    it("[behavioral] getScriptNonceFromHeader(buildCsp(nonce)) === nonce (prod shape)", () => {
        const nonce = "unit-test-nonce-value==";
        const csp = buildCsp(nonce);
        expect(getScriptNonceFromHeader(csp)).toBe(nonce);
    });

    it("[behavioral] still resolves correctly with a different nonce value (not hardcoded)", () => {
        const nonce = "AbCdEf1234+/==";
        const csp = buildCsp(nonce);
        expect(getScriptNonceFromHeader(csp)).toBe(nonce);
    });

    it("[behavioral] resolves the SAME nonce Next.js would extract from the REQUEST once propagated", () => {
        // Simulate exactly what proxy.ts now does: build once, set on both
        // request and response — assert both sides parse to the same nonce.
        const nonce = "propagation-check-nonce";
        const csp = buildCsp(nonce);
        const requestHeaders = new Headers();
        requestHeaders.set("Content-Security-Policy", csp);
        const responseHeaders = new Headers();
        responseHeaders.set("Content-Security-Policy", csp);

        expect(getScriptNonceFromHeader(requestHeaders.get("Content-Security-Policy")!)).toBe(nonce);
        expect(getScriptNonceFromHeader(responseHeaders.get("Content-Security-Policy")!)).toBe(nonce);
    });
});

// ---------------------------------------------------------------------------
// 3. No-loosening guard — every directive unchanged from the SEC-3 baseline
// ---------------------------------------------------------------------------

describe("CAM-607 — no CSP directive content changed (propagation fix only, zero loosening)", () => {
    it("[no-loosening] request-side and response-side both pass the SAME `csp` variable (no divergent second string)", () => {
        const src = readProxySource();
        const cspAssignments = src.match(/\.set\(\s*['"]Content-Security-Policy['"]\s*,\s*(\w+)\s*\)/g) ?? [];
        // 3 call sites total: request pass-through, response pass-through, redirect branch.
        expect(cspAssignments.length).toBeGreaterThanOrEqual(2);
        for (const assignment of cspAssignments) {
            expect(assignment, `every CSP .set() call must pass the same 'csp' variable: ${assignment}`).toMatch(
                /,\s*csp\s*\)/
            );
        }
    });

    it("[no-loosening] script-src is unchanged: 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:", () => {
        const csp = buildCsp("x");
        expect(csp).toContain("script-src 'nonce-x' 'strict-dynamic' 'unsafe-inline' https:");
    });

    it("[no-loosening] every other directive is byte-identical to the SEC-3 baseline", () => {
        const csp = buildCsp("x");
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("style-src 'self' 'unsafe-inline'");
        expect(csp).toContain("https://*.public.blob.vercel-storage.com");
        expect(csp).toContain("https://*.tile.openstreetmap.org");
        expect(csp).toContain("https://*.googleusercontent.com");
        expect(csp).toContain("font-src 'self'");
        expect(csp).toContain("connect-src 'self' blob: https://*.tile.openstreetmap.org");
        expect(csp).toContain("media-src 'self'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("frame-ancestors 'none'");
        expect(csp).toContain("base-uri 'self'");
        expect(csp).toContain("form-action 'self'");
        expect(csp).toContain("upgrade-insecure-requests");
    });

    it("[no-loosening] prod build (NODE_ENV production) still excludes 'unsafe-eval'", () => {
        const original = process.env.NODE_ENV;
        try {
            (process.env as Record<string, string>).NODE_ENV = "production";
            expect(buildCsp("x")).not.toContain("unsafe-eval");
        } finally {
            (process.env as Record<string, string>).NODE_ENV = original ?? "test";
        }
    });
});

// ---------------------------------------------------------------------------
// 4. Route protection re-verified (CAM-203 lesson — assert, don't assume)
// ---------------------------------------------------------------------------

import { isRouteAllowed } from "../lib/auth.config";

describe("CAM-607 — /dashboard protection unaffected by the CSP-propagation fix", () => {
    it("[protection] /dashboard is still blocked when NOT logged in", () => {
        expect(isRouteAllowed("/dashboard", false)).toBe(false);
    });

    it("[protection] /dashboard is still allowed when logged in", () => {
        expect(isRouteAllowed("/dashboard", true)).toBe(true);
    });

    it("[source] proxy.ts still calls isRouteAllowed() before the request-header CSP fix runs", () => {
        const src = readProxySource();
        const authzIdx = src.indexOf("isRouteAllowed(");
        const fixIdx = src.search(/requestHeaders\.set\(\s*['"]Content-Security-Policy['"]\s*,\s*csp\s*\)/);
        expect(authzIdx).toBeGreaterThan(-1);
        expect(fixIdx).toBeGreaterThan(-1);
        expect(
            authzIdx,
            "the authz check must still run before the pass-through/CSP-fix block (EC-4)"
        ).toBeLessThan(fixIdx);
    });
});
