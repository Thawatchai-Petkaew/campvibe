/**
 * SEC-2 — Security response headers regression guard.
 *
 * Asserts that next.config.ts defines a headers() entry for all routes
 * (source "/(.*)" or equivalent) containing each required security header
 * and the key CSP directive values.
 *
 * This is a static-analysis test — it imports the resolved header config from
 * next.config.ts directly (no running server needed) and walks the header list.
 * It guards against accidental deletion or misconfiguration of the headers that
 * security.md mandates (§Misconfig + §Hardening).
 *
 * If any assertion fails the CI gate blocks merge — the headers are not present
 * on staging and must be restored before the story can be Done.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Load the headers config from next.config.ts
// ---------------------------------------------------------------------------

// next.config.ts exports a NextConfig wrapped in withBundleAnalyzer.
// We resolve headers() by calling it directly — it returns the raw array.
// The "withAnalyzer" wrapper passes through the config unchanged (ANALYZE is unset).

// Dynamic import avoids top-level await issues in Vitest.
async function loadHeaders(): Promise<Array<{ key: string; value: string }>> {
  const mod = await import("../next.config");
  // The default export may be the raw config or the analyzer-wrapped version.
  // Both expose `headers` as an async function on the NextConfig object.
  const config = mod.default as {
    headers?: () => Promise<
      Array<{ source: string; headers: Array<{ key: string; value: string }> }>
    >;
  };

  if (typeof config.headers !== "function") {
    throw new Error("next.config.ts does not export a headers() function");
  }

  const entries = await config.headers();

  // Find the catch-all entry that applies to all routes.
  // We accept either "/(.*)" or "/:path*" as the all-routes source.
  const allRoutes = entries.find(
    (e) => e.source === "/(.*)" || e.source === "/:path*"
  );

  if (!allRoutes) {
    throw new Error(
      `headers() has no catch-all entry (source "/(.*)" or "/:path*"). ` +
        `Found sources: ${entries.map((e) => e.source).join(", ")}`
    );
  }

  return allRoutes.headers;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findHeader(
  headers: Array<{ key: string; value: string }>,
  key: string
): string | undefined {
  return headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SEC-2 security headers — next.config.ts headers() regression guard", () => {
  // Shared headers loaded once for all assertions.
  let headers: Array<{ key: string; value: string }>;

  // Vitest doesn't have a top-level beforeAll outside describe, so we use a
  // lazy initialiser pattern: load once, reuse across its().
  async function getHeaders() {
    if (!headers) {
      headers = await loadHeaders();
    }
    return headers;
  }

  // ── Presence checks ────────────────────────────────────────────────────

  it("defines Content-Security-Policy header", async () => {
    const h = await getHeaders();
    const csp = findHeader(h, "Content-Security-Policy");
    expect(csp, "Content-Security-Policy header is missing").toBeDefined();
    expect(csp!.length).toBeGreaterThan(0);
  });

  it("defines X-Content-Type-Options: nosniff", async () => {
    const h = await getHeaders();
    const val = findHeader(h, "X-Content-Type-Options");
    expect(val, "X-Content-Type-Options header is missing").toBeDefined();
    expect(val).toBe("nosniff");
  });

  it("defines Referrer-Policy", async () => {
    const h = await getHeaders();
    const val = findHeader(h, "Referrer-Policy");
    expect(val, "Referrer-Policy header is missing").toBeDefined();
    expect(val).toBe("strict-origin-when-cross-origin");
  });

  it("defines X-Frame-Options: DENY", async () => {
    const h = await getHeaders();
    const val = findHeader(h, "X-Frame-Options");
    expect(val, "X-Frame-Options header is missing").toBeDefined();
    expect(val).toBe("DENY");
  });

  it("defines Permissions-Policy disabling camera, microphone, and geolocation", async () => {
    const h = await getHeaders();
    const val = findHeader(h, "Permissions-Policy");
    expect(val, "Permissions-Policy header is missing").toBeDefined();
    expect(val).toContain("camera=()");
    expect(val).toContain("microphone=()");
    expect(val).toContain("geolocation=()");
  });

  it("defines Strict-Transport-Security with a long max-age", async () => {
    const h = await getHeaders();
    const val = findHeader(h, "Strict-Transport-Security");
    expect(val, "Strict-Transport-Security header is missing").toBeDefined();
    // max-age must be at least 1 year (31536000 seconds).
    const match = val!.match(/max-age=(\d+)/);
    expect(match, "HSTS max-age directive not found").toBeTruthy();
    expect(Number(match![1])).toBeGreaterThanOrEqual(31536000);
    expect(val).toContain("includeSubDomains");
  });

  // ── CSP directive checks ───────────────────────────────────────────────

  it("CSP includes default-src 'self'", async () => {
    const h = await getHeaders();
    const csp = findHeader(h, "Content-Security-Policy")!;
    expect(csp).toMatch(/default-src\s+['"]?self['"]?/);
  });

  it("CSP allows script-src 'self' with unsafe-inline (required for Next.js hydration)", async () => {
    const h = await getHeaders();
    const csp = findHeader(h, "Content-Security-Policy")!;
    expect(csp).toContain("script-src");
    expect(csp).toContain("'unsafe-inline'");
  });

  it("CSP img-src allows Unsplash", async () => {
    const h = await getHeaders();
    const csp = findHeader(h, "Content-Security-Policy")!;
    expect(csp).toContain("https://images.unsplash.com");
  });

  it("CSP img-src allows Vercel Blob Storage", async () => {
    const h = await getHeaders();
    const csp = findHeader(h, "Content-Security-Policy")!;
    expect(csp).toContain("https://*.public.blob.vercel-storage.com");
  });

  it("CSP img-src allows OpenStreetMap tile server (Leaflet map on campground detail)", async () => {
    const h = await getHeaders();
    const csp = findHeader(h, "Content-Security-Policy")!;
    expect(
      csp,
      "CSP must allow *.tile.openstreetmap.org for Leaflet tile images"
    ).toContain("https://*.tile.openstreetmap.org");
  });

  it("CSP img-src allows data: and blob: for image previews", async () => {
    const h = await getHeaders();
    const csp = findHeader(h, "Content-Security-Policy")!;
    expect(csp).toContain("data:");
    expect(csp).toContain("blob:");
  });

  it("CSP font-src is 'self' (next/font/google self-hosts at build time)", async () => {
    const h = await getHeaders();
    const csp = findHeader(h, "Content-Security-Policy")!;
    expect(csp).toContain("font-src");
    // Must NOT include fonts.gstatic.com — next/font self-hosts at build time.
    expect(csp).not.toContain("fonts.gstatic.com");
  });

  it("CSP connect-src allows OpenStreetMap (Leaflet tile XHR)", async () => {
    const h = await getHeaders();
    const csp = findHeader(h, "Content-Security-Policy")!;
    expect(
      csp,
      "CSP connect-src must allow *.tile.openstreetmap.org for Leaflet"
    ).toContain("https://*.tile.openstreetmap.org");
  });

  it("CSP blocks frame-ancestors 'none'", async () => {
    const h = await getHeaders();
    const csp = findHeader(h, "Content-Security-Policy")!;
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("CSP blocks object-src 'none'", async () => {
    const h = await getHeaders();
    const csp = findHeader(h, "Content-Security-Policy")!;
    expect(csp).toContain("object-src 'none'");
  });

  it("CSP restricts base-uri to 'self'", async () => {
    const h = await getHeaders();
    const csp = findHeader(h, "Content-Security-Policy")!;
    expect(csp).toContain("base-uri 'self'");
  });

  it("CSP restricts form-action to 'self'", async () => {
    const h = await getHeaders();
    const csp = findHeader(h, "Content-Security-Policy")!;
    expect(csp).toContain("form-action 'self'");
  });

  it("CSP includes upgrade-insecure-requests", async () => {
    const h = await getHeaders();
    const csp = findHeader(h, "Content-Security-Policy")!;
    expect(csp).toContain("upgrade-insecure-requests");
  });
});
