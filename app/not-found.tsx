// CAM-218 ERR-1: Global 404 page.
// SERVER component on purpose: a "use client" not-found falls under the root
// app/loading.tsx Suspense boundary and gets stuck on the skeleton fallback for
// unmatched routes. Rendering server-side resolves synchronously (no skeleton).
// The child ErrorState is "use client" and handles TH/EN via useLanguage().
// Renders Navbar + full-page ErrorState variant="not-found".
//
// CAM-218 fix: force-dynamic so the page is SSR-rendered per request.
// Without this, Next.js statically prerendering (○) the /_not-found route and
// the middleware's per-request CSP nonce is NEVER stamped onto the static HTML's
// script tags ("nonce":"$undefined" throughout the RSC payload). The CSP header
// contains 'nonce-{N}' which — per CSP Level 3 — causes 'unsafe-inline' to be
// ignored, so the inline next-themes script is blocked. Result: theme class is
// never applied to <html> and LanguageProvider never hydrates correctly.
// With force-dynamic the route becomes ƒ (dynamic), gets SSR-rendered per
// request, and the middleware nonce is stamped onto every <script> tag.
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { ErrorState } from "@/components/ErrorState";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background">
      {/* Navbar uses useSearchParams() — must be wrapped in Suspense so the
          static /404 prerender does not bail out (Next.js CSR-bailout rule). */}
      <Suspense fallback={null}>
        <Navbar />
      </Suspense>
      <ErrorState variant="not-found" />
    </main>
  );
}
