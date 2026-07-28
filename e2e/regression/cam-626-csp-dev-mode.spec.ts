/**
 * CAM-626 — CAM-607's CSP-nonce propagation must hold under `next dev`, the
 * mode THIS VERY REGRESSION HARNESS runs against (see e2e/regression/README.md
 * — the regression project's webServer is `npm run dev`, never a production
 * build). This spec is the behavioral, run-for-real proof that:
 *
 *   1. The response CSP header and a nonce actually stamped in the served
 *      HTML agree, with zero CSP violations — on a dashboard sub-route this
 *      harness's OTHER specs never visit (`/dashboard/settings`), so this is
 *      as close to a genuinely cold, first-compiled Turbopack hit as an
 *      ordinary suite run can get.
 *
 *   2. IF a transient React-Flight streaming container (`<div id="S:...">`,
 *      the CAM-604 signature) appears at all — tech.md measured this DOES
 *      happen under `next dev` even with zero CSP violations, because it is
 *      Turbopack's own dev-compile timing, not a CSP block — it ALWAYS
 *      resolves within a bounded window. This is the actual regression this
 *      spec guards: a future change that reintroduces a PERMANENTLY blocked
 *      (never-nonced) relocation script would fail this bounded wait outright,
 *      while the current, correct, harmless transient window passes it.
 *
 * See tech.md for the full measured evidence (cold-route timing table, the
 * CAM-608 independent corroboration, and the 3 clean full-suite runs this
 * spec's own green result is one member of).
 */
import { test, expect } from "@playwright/test";

test.describe("CAM-626 — CSP holds under next dev on a route this suite has not already warmed", () => {
  test("zero CSP violations + nonce agreement on /dashboard/settings, and any transient streaming container clears within 3s", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    const response = await page.goto("/dashboard/settings", { waitUntil: "commit" });
    expect(response).not.toBeNull();

    const cspHeader = response!.headers()["content-security-policy"];
    expect(cspHeader, "the response must carry an enforced Content-Security-Policy header").toBeTruthy();

    const nonceMatch = cspHeader.match(/'nonce-([A-Za-z0-9+/_=-]+)'/);
    expect(nonceMatch, `expected a 'nonce-...' token in script-src: ${cspHeader}`).not.toBeNull();
    const headerNonce = nonceMatch![1];

    // Bounded wait: IF the transient streaming container appears at all (tech.md
    // measured this on a cold `next dev` compile even with zero CSP violations),
    // it must clear within 3s — never stay permanently stuck. A permanently
    // stuck container is exactly CAM-604's original, pre-CAM-607 defect shape.
    await expect(
      page.locator('body > div[id^="S:"]'),
      "any transient React-Flight streaming container must clear within 3s under next dev " +
        "(a container that never clears is the ORIGINAL CSP-blocked-forever defect, not the " +
        "harmless dev-compile-timing window this story measured)"
    ).toHaveCount(0, { timeout: 3_000 });

    // Nonce agreement — the CAM-218 check this whole lineage was raised to prove,
    // re-asserted here specifically on a route CAM-607's own spec does not cover.
    const scriptNonces = await page
      .locator("script[nonce]")
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLScriptElement).nonce));
    expect(scriptNonces.length, "expected at least one Next.js-emitted <script nonce> tag").toBeGreaterThan(0);
    expect(
      scriptNonces,
      `the response CSP's nonce (${headerNonce}) must match a nonce actually stamped in the served HTML`
    ).toContain(headerNonce);

    const cspViolationLines = consoleErrors.filter((line) => /Content Security Policy/i.test(line));
    expect(
      cspViolationLines.length,
      `expected zero CSP violations under next dev, got: ${cspViolationLines.join("\n")}`
    ).toBe(0);
  });
});

test.describe("CAM-626 — route protection re-verified after this investigation (CAM-203 lesson: assert, don't assume)", () => {
  // Force a fresh, unauthenticated context — overrides the regression
  // project's default authenticated storageState for this describe block only.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("an unauthenticated visitor to /dashboard is still redirected to /login under next dev", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL((url) => url.pathname.startsWith("/login"), { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });
});
