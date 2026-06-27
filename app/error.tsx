"use client";

// CAM-218 ERR-1: Root error boundary — required to be "use client".
// Receives { error, reset } from Next.js App Router.
// Does NOT surface error.message or stack to the user — generic copy only (security).
// Logs the error server-side/dev via useEffect.

import { Suspense, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { ErrorState } from "@/components/ErrorState";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Dev/server logging only — never rendered to the user (security: no stack trace to client).
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-background">
      {/* Navbar uses useSearchParams() — wrap in Suspense to avoid a CSR bailout. */}
      <Suspense fallback={null}>
        <Navbar />
      </Suspense>
      <ErrorState variant="error" onRetry={reset} />
    </main>
  );
}
