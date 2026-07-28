/**
 * CAM-610 — the next-themes anti-flash script must be nonced and run under
 * our CSP, on a public (unauthenticated) page, in the steady state.
 *
 * Companion to e2e/regression/cam-607-csp-nonce-agreement.spec.ts, which
 * (correctly, at the time) capped its CSP-violation count at `<= 1` because
 * this exact script was the one known, pre-existing, out-of-surface
 * violation on every page load. This story fixes that one violation, so
 * this spec asserts the STRICTER bound (`0`) on a public route — it would
 * fail on the pre-fix source (the bare, un-nonced next-themes <script> logs
 * a CSP violation on every load) and passes once the nonce is wired.
 *
 * Uses "/" (public, no auth needed) rather than "/dashboard" — CAM-610's
 * fix lives in the root layout/Providers, so it applies to every route, and
 * a public page is the more direct proof this is not a `/dashboard`-only fix.
 */
import { test, expect } from "@playwright/test";

test.describe("CAM-610 — next-themes script is nonced and logs no CSP violation on a public page", () => {
  test("no CSP violation is logged loading '/', and the theme script's nonce matches the response header", async ({
    page,
  }) => {
    const cspViolations: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && /Content Security Policy/i.test(msg.text())) {
        cspViolations.push(msg.text());
      }
    });

    const response = await page.goto("/", { waitUntil: "networkidle" });
    expect(response).not.toBeNull();

    const cspHeader = response!.headers()["content-security-policy"];
    expect(cspHeader, "the response must carry an enforced Content-Security-Policy header").toBeTruthy();

    const nonceMatch = cspHeader.match(/'nonce-([A-Za-z0-9+/_=-]+)'/);
    expect(nonceMatch, `expected a 'nonce-...' token in script-src: ${cspHeader}`).not.toBeNull();
    const headerNonce = nonceMatch![1];

    // Every <script nonce> actually served must carry the SAME nonce as the
    // response header — read the "nonce" IDL PROPERTY, never
    // getAttribute("nonce") (browsers blank the content attribute once the
    // element is in the document — the CAM-607 lesson).
    const scriptNonces = await page
      .locator("script[nonce]")
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLScriptElement).nonce));

    expect(scriptNonces.length, "expected at least one nonced <script> tag").toBeGreaterThan(0);
    for (const n of scriptNonces) {
      expect(n, "every served script nonce must match the response CSP header's nonce").toBe(headerNonce);
    }

    // The strict bound this story earns: zero CSP violations on a page load,
    // where CAM-607 could only assert <= 1 (this exact known gap).
    expect(
      cspViolations.length,
      `expected zero CSP violations, got: ${cspViolations.join("\n")}`
    ).toBe(0);
  });
});
