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
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
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
  // CSP origin inventory (verified against the codebase):
  //   script-src  : Next.js hydration requires 'unsafe-inline'; no external scripts.
  //   style-src   : Next.js injects inline styles; no external CSS CDN.
  //   img-src     : next/image remote patterns (unsplash + blob storage); Leaflet tile
  //                 map in MapComponent loads tiles from *.tile.openstreetmap.org;
  //                 data: + blob: for image-preview fallbacks.
  //   font-src    : next/font/google (Inter/Outfit/Sarabun) is self-hosted at build —
  //                 no runtime call to fonts.gstatic.com; 'self' is sufficient.
  //   connect-src : VitalsReporter posts to /api/vitals (same-origin via sendBeacon);
  //                 /status/map SSE polls /status/map/data (same-origin);
  //                 Leaflet tile requests also appear in connect-src.
  //   frame-ancestors 'none': no iframe embedding of CampVibe pages.
  //   geolocation : navigator.geolocation is NOT used anywhere in the app → disabled.
  //   /status/map : fully self-hosted assets under /status-map/ (sprites, bg, audio) —
  //                 no external tile server or CDN; no CSP widening required.
  //   NextAuth    : credential/session flow uses server-side redirects (no popup) →
  //                 Cross-Origin-Opener-Policy: same-origin is safe.
  async headers() {
    // Content-Security-Policy directives assembled as an array for readability,
    // then joined into a single-line header value.
    const csp = [
      "default-src 'self'",
      // 'unsafe-inline' required for Next.js hydration scripts and inline event handlers.
      // 'unsafe-eval' is intentionally omitted — Next.js App Router production build
      // does not require it; add only if a build step proves it is needed.
      "script-src 'self' 'unsafe-inline'",
      // 'unsafe-inline' required for Next.js CSS-in-JS and Tailwind inline styles.
      "style-src 'self' 'unsafe-inline'",
      // Unsplash + Vercel Blob Storage for campsite images; data: + blob: for previews;
      // *.tile.openstreetmap.org for Leaflet map tiles in campground detail pages.
      "img-src 'self' data: blob: https://images.unsplash.com https://*.public.blob.vercel-storage.com https://*.tile.openstreetmap.org",
      // next/font/google self-hosts font files at build time under /_next/static.
      "font-src 'self'",
      // All XHR/fetch/sendBeacon targets are same-origin; OSM tile HTTP requests
      // are also reflected here (Leaflet uses XHR for tile discovery in some configs).
      "connect-src 'self' https://*.tile.openstreetmap.org",
      // No audio/video from external sources (/status-map audio is self-hosted).
      "media-src 'self'",
      // No <object> or <embed> usage.
      "object-src 'none'",
      // Block all framing — X-Frame-Options: DENY is the legacy backstop below.
      "frame-ancestors 'none'",
      // No <base> tag overrides.
      "base-uri 'self'",
      // All form submissions go to our own routes.
      "form-action 'self'",
      // Upgrade any accidental http:// sub-resource requests to https://.
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      // SEC-2: security headers on every route.
      {
        source: "/(.*)",
        headers: [
          // Full CSP — conservative; no nonces or Trusted Types.
          { key: "Content-Security-Policy", value: csp },
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
