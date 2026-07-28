/**
 * CAM-607 — the response's CSP header and the nonce actually stamped in the
 * served HTML must agree (the exact check CAM-218 needed and did not have).
 *
 * This is the STEADY-STATE regression guard: it runs under normal load, no
 * fault injection. The fault-injection reproduction (a real production build
 * under deliberate CPU pressure, per CAM-604's own method) is a manual,
 * evidenced self-verify step instead — see story.md BR-3/EC-2 and tech.md for
 * why: an automated fault-injection assertion in ordinary CI is exactly the
 * flaky-test trap `.claude/rules/qa.md` warns against, and CAM-604's own
 * e2e spec (cam-604-availability-renders-once.spec.ts) made the identical
 * call for the identical defect. Under normal load this spec is stable and
 * still has teeth: it fails outright on the pre-fix source (no CSP header
 * ever carried a nonce Next.js could parse from the request), and it would
 * catch a future regression that re-breaks the propagation.
 *
 * CSP-violation count is capped at <= 1, NOT asserted to zero: this story's
 * own production-build manual verification (see tech.md "Out-of-surface
 * finding") found ONE pre-existing, unrelated CSP violation on every page
 * load — `next-themes`'s own FOUC-prevention inline script
 * (`components/Providers.tsx`'s `<ThemeProvider>`) is rendered via
 * `dangerouslySetInnerHTML` with no `nonce` prop wired, and has been blocked
 * since CAM-203 enforced the CSP, unrelated to this story's fix and outside
 * its file surface (`components/Providers.tsx` is not in scope here) —
 * reported, not fixed, matching the CAM-604 precedent for an out-of-surface
 * finding. Asserting a hard zero here would be a false-red on a real ticket
 * every future CI run, for an issue this story's diff neither causes nor can
 * fix; the `<= 1` cap still catches any NEW violation (a real regression).
 */
import { test, expect } from "@playwright/test";

test.describe("CAM-607 — CSP header and served nonce agree on /dashboard (steady state)", () => {
  test("the response CSP's nonce matches a nonce stamped on a real page <script>, with no NEW CSP violation logged", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    const response = await page.goto("/dashboard", { waitUntil: "networkidle" });
    expect(response).not.toBeNull();

    const cspHeader = response!.headers()["content-security-policy"];
    expect(cspHeader, "the response must carry an enforced Content-Security-Policy header").toBeTruthy();

    const nonceMatch = cspHeader.match(/'nonce-([A-Za-z0-9+/_=-]+)'/);
    expect(nonceMatch, `expected a 'nonce-...' token in script-src: ${cspHeader}`).not.toBeNull();
    const headerNonce = nonceMatch![1];

    // A persistent, Next.js-emitted <script> (the external bootstrap chunk)
    // stays in the DOM after hydration — unlike React Flight's OWN internal
    // relocation/coordinator scripts, which remove themselves once they run.
    //
    // Read the "nonce" IDL PROPERTY, never getAttribute("nonce") — browsers
    // deliberately blank the nonce CONTENT attribute once a <script> is in
    // the document (to prevent a CSS attribute-selector side-channel leak),
    // so getAttribute("nonce") always returns "" here. Caught manually during
    // this story's own production-build self-verify (see tech.md) before it
    // could ship as a silently-always-passing (empty-string-vs-empty-string)
    // false green.
    const scriptNonces = await page
      .locator("script[nonce]")
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLScriptElement).nonce));

    expect(scriptNonces.length, "expected at least one Next.js-emitted <script nonce> tag").toBeGreaterThan(0);
    expect(
      scriptNonces,
      `the response CSP's nonce (${headerNonce}) must match a nonce actually stamped in the served HTML`
    ).toContain(headerNonce);

    // <= 1, not 0 — see the file-level comment: one pre-existing, unrelated,
    // out-of-surface violation (next-themes) is known and reported, not
    // fixed here. This still catches a NEW (2nd+) violation as a regression.
    const cspViolationLines = consoleErrors.filter((line) => /Content Security Policy/i.test(line));
    expect(
      cspViolationLines.length,
      `expected at most the 1 known pre-existing (next-themes) violation, got: ${cspViolationLines.join("\n")}`
    ).toBeLessThanOrEqual(1);
  });
});

test.describe("CAM-607 — route protection re-verified after the proxy.ts change (CAM-203 lesson: assert, don't assume)", () => {
  // Force a fresh, unauthenticated context — overrides the regression
  // project's default authenticated storageState for this describe block only.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("an unauthenticated visitor to /dashboard is still redirected to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL((url) => url.pathname.startsWith("/login"), { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });
});
