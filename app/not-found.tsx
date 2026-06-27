// CAM-218 ERR-1: Global 404 page.
// SERVER component on purpose: a "use client" not-found falls under the root
// app/loading.tsx Suspense boundary and gets stuck on the skeleton fallback for
// unmatched routes. Rendering server-side resolves synchronously (no skeleton).
// The child ErrorState is "use client" and handles TH/EN via useLanguage().
// Renders Navbar + full-page ErrorState variant="not-found".

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
