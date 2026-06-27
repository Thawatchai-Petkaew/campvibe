import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

// CAM-187 MEAS-1c — bundle size analysis.
// Enable with: ANALYZE=1 npm run build
// Output: .next/analyze/client.html + server.html
// The analyzer is NEVER enabled in Vercel production builds (ANALYZE env var not set).
const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "1",
  openAnalyzer: false,
});

const nextConfig: NextConfig = {
  images: {
    formats: ["image/webp"],
    qualities: [75],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 80, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 31, // 31 days in seconds (CAM-194 PERF-4)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    dangerouslyAllowSVG: false,
  },
  // CAM-201 — walking-agent flicker root cause: the /status/map walk + relax sprite
  // frames are swapped via background-image every frame. Next.js' default for /public
  // is `max-age=0, must-revalidate`, so on deployed envs (Staging/Prod) the browser
  // revalidates each frame over the network before painting → a blank flash mid-walk
  // (invisible on localhost where the round-trip is ~0ms). These sprites are immutable
  // build assets — cache them hard so a frame swap never triggers a revalidation.
  //
  // SEC-2 — Security response headers applied to all routes.
  //
  // CAM-203 SEC-3 — Content-Security-Policy is NO LONGER set here.
  // The CSP is now a per-request dynamic header set in middleware.ts so it can
  // carry a unique nonce per request (strict nonce-based CSP). A static CSP in
  // next.config.ts cannot carry a nonce and would conflict with (or override)
  // the dynamic nonce CSP from middleware. See ADR-007.
  //
  // NOTE: api/* routes are excluded from the middleware matcher and therefore
  // receive no CSP header after this change. This is correct — api/* routes
  // return JSON, not HTML, and CSP script-src only applies to HTML documents.
  //
  // The 6 remaining static headers below are kept here (no nonce dependency).
  async headers() {
    return [
      // SEC-2: security headers on every route (CSP moved to middleware — see above).
      {
        source: "/(.*)",
        headers: [
          // Prevent MIME-type sniffing attacks.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Send full URL only for same-origin; strip to origin-only for cross-origin.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Legacy iframe-embedding backstop (frame-ancestors in CSP takes precedence
          // for CSP-aware browsers; this covers older browsers).
          { key: "X-Frame-Options", value: "DENY" },
          // Permissions-Policy: disable features the app does not use.
          // geolocation: navigator.geolocation has zero callers in the codebase.
          // camera / microphone: no media capture features exist.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // HSTS: 2 years, include subdomains, preload-eligible.
          // Vercel already sets this; included here for completeness and local parity.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Cross-Origin-Opener-Policy: isolate the browsing context.
          // NextAuth uses server-side redirects (not popups) so same-origin is safe.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      // CAM-201: immutable cache for /status/map sprite assets.
      {
        source: "/status-map/sprites/:file*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default withAnalyzer(nextConfig);
