"use client";

// CAM-218 ERR-1: Dashboard segment error boundary — required to be "use client".
// No Navbar — the dashboard layout/sidebar remains mounted.
// Renders compact ErrorState so the sidebar context is preserved.

import { useEffect } from "react";
import { ErrorState } from "@/components/ErrorState";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    // Dev/server logging only — never rendered to the user (security: no stack trace to client).
    console.error(error);
  }, [error]);

  return <ErrorState variant="error" onRetry={reset} compact />;
}
