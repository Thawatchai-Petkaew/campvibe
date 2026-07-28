/**
 * CAM-626 — does CAM-607's CSP-nonce request-header propagation hold under
 * `next dev`, not only a production build?
 *
 * Investigated behaviorally first (real `next dev` + real Playwright runs,
 * recorded in tech.md — 0 CSP violations, 100% nonce agreement, cold + warm
 * routes, home page, and 3 clean full-suite regression runs). Conclusion:
 * the fix already holds in both modes, because it is a plain, unconditional
 * line inside the request handler — never gated behind NODE_ENV/dev.
 *
 * This file is the regression GUARD for that conclusion: it does not re-prove
 * dev-mode behavior (that needs a real server, see
 * e2e/regression/cam-626-csp-dev-mode.spec.ts) — it proves the SOURCE can
 * never silently regress into a mode-gated fix again, and that Next's own
 * installed nonce extractor agrees on the SAME nonce regardless of which
 * mode built the CSP string.
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Same NextAuth mock as __tests__/cam-607-csp-request-header.test.ts — proxy.ts
// calls NextAuth(authConfig) at module top-level, whose real internals this
// vitest (node environment) cannot resolve. proxy.ts's own logic (buildCsp,
// the request/response CSP wiring) is never mocked or altered.
vi.mock("next-auth", () => ({
    default: () => ({ auth: (handler: unknown) => handler }),
}));

const rootDir = join(__dirname, "..");

function readProxySource(): string {
    return readFileSync(join(rootDir, "proxy.ts"), "utf-8");
}

// ---------------------------------------------------------------------------
// 1. Structural guard — the request-header CSP fix is NEVER mode-gated
// ---------------------------------------------------------------------------

describe("CAM-626 — the CAM-607 request-header CSP fix is not gated behind NODE_ENV/dev", () => {
    it("[source] the request handler body, up to the CSP-on-request line, contains ZERO NODE_ENV references", () => {
        const src = readProxySource();
        const handlerStart = src.indexOf("export default auth(async (req)");
        const fixLine = src.search(
            /requestHeaders\.set\(\s*['"]Content-Security-Policy['"]\s*,\s*csp\s*\)/
        );
        expect(handlerStart, "expected to find the auth() handler export").toBeGreaterThan(-1);
        expect(fixLine, "expected to find the request-header CSP fix line").toBeGreaterThan(-1);
        expect(fixLine, "the fix line must come after the handler starts").toBeGreaterThan(handlerStart);

        const between = src.slice(handlerStart, fixLine);
        expect(
            between,
            "a future edit must NEVER special-case the request-header CSP propagation " +
                "behind NODE_ENV (or any dev/prod branch) — that would silently reintroduce " +
                "CAM-607's defect in exactly one mode again (this is the whole shape of CAM-626)"
        ).not.toMatch(/NODE_ENV/);
    });

    it("[source] the response-side CSP set is likewise unconditional (no NODE_ENV between the two .set() calls)", () => {
        const src = readProxySource();
        const requestFixLine = src.search(
            /requestHeaders\.set\(\s*['"]Content-Security-Policy['"]\s*,\s*csp\s*\)/
        );
        const responseFixLine = src.search(
            /response\.headers\.set\(\s*['"]Content-Security-Policy['"]\s*,\s*csp\s*\)/
        );
        expect(requestFixLine).toBeGreaterThan(-1);
        expect(responseFixLine).toBeGreaterThan(requestFixLine);
        const between = src.slice(requestFixLine, responseFixLine);
        expect(between).not.toMatch(/NODE_ENV/);
    });
});

// ---------------------------------------------------------------------------
// 2. Behavioral proof — Next's own nonce extractor agrees in BOTH modes
// ---------------------------------------------------------------------------

import { buildCsp } from "../proxy";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getScriptNonceFromHeader } = require("next/dist/server/app-render/get-script-nonce-from-header");

describe("CAM-626 — buildCsp's nonce propagation is mode-agnostic (dev vs prod)", () => {
    it("[behavioral] dev and prod CSP strings differ ONLY by the 'unsafe-eval' addition — everything else, including the nonce, is byte-identical", () => {
        const nonce = "cam-626-mode-agnostic-nonce";
        const original = process.env.NODE_ENV;
        try {
            (process.env as Record<string, string>).NODE_ENV = "development";
            const devCsp = buildCsp(nonce);

            (process.env as Record<string, string>).NODE_ENV = "production";
            const prodCsp = buildCsp(nonce);

            expect(
                devCsp.replace(" 'unsafe-eval'", ""),
                "the ONLY difference between dev and prod CSP strings must be the unsafe-eval addition"
            ).toBe(prodCsp);
            expect(devCsp).toContain("'unsafe-eval'");
            expect(prodCsp).not.toContain("unsafe-eval");
        } finally {
            (process.env as Record<string, string>).NODE_ENV = original ?? "test";
        }
    });

    it("[behavioral] Next's OWN installed nonce extractor resolves the SAME nonce from both the dev and the prod CSP string", () => {
        const nonce = "cam-626-extractor-agreement-nonce";
        const original = process.env.NODE_ENV;
        try {
            (process.env as Record<string, string>).NODE_ENV = "development";
            const devCsp = buildCsp(nonce);
            (process.env as Record<string, string>).NODE_ENV = "production";
            const prodCsp = buildCsp(nonce);

            expect(getScriptNonceFromHeader(devCsp)).toBe(nonce);
            expect(getScriptNonceFromHeader(prodCsp)).toBe(nonce);
        } finally {
            (process.env as Record<string, string>).NODE_ENV = original ?? "test";
        }
    });
});

// ---------------------------------------------------------------------------
// 3. Route protection re-verified (CAM-203 lesson) — even though this story
//    changed zero lines in proxy.ts/lib/auth.config.ts
// ---------------------------------------------------------------------------

import { isRouteAllowed } from "../lib/auth.config";

describe("CAM-626 — /dashboard protection re-verified (no code changed, still re-checked per CAM-203)", () => {
    it("[protection] /dashboard is still blocked when NOT logged in", () => {
        expect(isRouteAllowed("/dashboard", false)).toBe(false);
    });

    it("[protection] /dashboard is still allowed when logged in", () => {
        expect(isRouteAllowed("/dashboard", true)).toBe(true);
    });

    it("[protection] /api/auth stays excluded from the proxy matcher (CAM-240)", () => {
        const src = readProxySource();
        expect(src).toMatch(/matcher:\s*\[[^\]]*api\/auth/);
    });
});
