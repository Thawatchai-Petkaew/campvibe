// @vitest-environment node
/**
 * cam-610-theme-script-nonce.test.ts — CAM-610
 *
 * Proves that `components/Providers.tsx` threads a CSP nonce down to
 * next-themes's own inline FOUC-prevention `<script>` (CAM-607 found this
 * script was the ONE unnonced inline script left in the app, blocked by our
 * own CSP on every page load, since CAM-203 enforcement).
 *
 * Layer: behavioral, not source-inspection. `Providers` is server-rendered
 * with the REAL `react-dom/server` (same harness pattern as
 * __tests__/cam-544-dark-default-theme.test.ts) and the ACTUAL emitted
 * <script> tag is inspected for its `nonce` attribute — proving what a real
 * browser/CSP would see, not merely that a prop is declared in source.
 *
 * ACs covered:
 *   AC-1  a nonce passed to <Providers> reaches next-themes's <script> tag
 *   BR-3  no nonce passed → script renders exactly as before (no attribute,
 *         no crash) — the safe fallback for a route that somehow bypasses
 *         the proxy matcher
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { Providers } from "../components/Providers";

function renderProvidersHtml(nonce?: string): string {
    const element = Providers({
        session: null,
        nonce,
        children: React.createElement("div", null, "app"),
    });
    return renderToStaticMarkup(element);
}

/** Returns the opening `<script ...>` tag (attributes included) for the
 * next-themes inline init script — the same script CAM-544's harness locates
 * by body, here we need the TAG itself to inspect its attributes. */
function extractScriptOpenTag(html: string): string {
    const match = html.match(/<script[^>]*>/);
    if (!match) {
        throw new Error("cam-610: no <script> tag found in Providers SSR output");
    }
    return match[0];
}

describe("AC-1: the nonce passed to <Providers> reaches next-themes's <script> tag", () => {
    it("[behavior] a nonce prop is rendered as the script's nonce attribute", () => {
        const html = renderProvidersHtml("abc123nonce==");
        const openTag = extractScriptOpenTag(html);
        expect(openTag).toContain('nonce="abc123nonce=="');
    });

    it("[behavior] a different nonce value renders exactly that value (not hardcoded)", () => {
        const html = renderProvidersHtml("zzz999==");
        const openTag = extractScriptOpenTag(html);
        expect(openTag).toContain('nonce="zzz999=="');
        expect(openTag).not.toContain("abc123nonce");
    });
});

describe("BR-3: no nonce → safe fallback (no attribute, no crash) — unchanged pre-fix shape", () => {
    it("[behavior] nonce=undefined renders a <script> tag with no nonce attribute", () => {
        const html = renderProvidersHtml(undefined);
        const openTag = extractScriptOpenTag(html);
        expect(openTag).not.toContain("nonce=");
    });

    it("[behavior] rendering with no nonce does not throw", () => {
        expect(() => renderProvidersHtml(undefined)).not.toThrow();
    });
});

describe("[wiring] Providers.tsx source forwards nonce to ThemeProvider (pin)", () => {
    it("[pin] the nonce prop is passed through to next-themes's <ThemeProvider>", () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require("fs") as typeof import("fs");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require("path") as typeof import("path");
        const src = fs.readFileSync(path.resolve(__dirname, "../components/Providers.tsx"), "utf-8");
        expect(src).toMatch(/<ThemeProvider[\s\S]*?nonce=\{nonce\}/);
    });
});
