"use client";

// CAM-218 ERR-1: Global 404 page.
// Must be "use client" to use useLanguage().
// Renders Navbar + full-page ErrorState variant="not-found".

import { Navbar } from "@/components/Navbar";
import { ErrorState } from "@/components/ErrorState";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <ErrorState variant="not-found" />
    </main>
  );
}
