"use client";

// CAM-218 ERR-1: Global error boundary — replaces the ROOT layout.
// This component owns its own <html><body>; no LanguageProvider or Navbar available.
// Renders a minimal self-contained bilingual block (TH + EN) + reload button.
// Token-class based; robust to missing providers.

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Dev/server logging only — never surfaced to the user (security: no stack trace to client).
    console.error(error);
  }, [error]);

  return (
    <html lang="th" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground flex items-center justify-center min-h-screen p-8">
        <div className="text-center max-w-sm">
          {/* Mascot image — plain img with onError hide; providers are unavailable here */}
          <img
            src="/mascot/coding.png"
            alt="mascot"
            width={160}
            height={160}
            className="mx-auto mb-8 w-32 h-auto"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />

          {/* Bilingual copy — TH line + EN line, self-contained */}
          <h1 className="text-2xl font-bold text-foreground mb-3">
            เกิดข้อผิดพลาด
          </h1>
          <p className="text-muted-foreground text-base mb-2">
            มีข้อผิดพลาดที่ไม่คาดคิดเกิดขึ้น กรุณาโหลดหน้าใหม่
          </p>
          <p className="text-muted-foreground text-sm mb-8">
            Something went wrong. Please reload the page.
          </p>

          <button
            onClick={() => {
              try {
                reset();
              } catch {
                window.location.reload();
              }
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground h-12 px-6 text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:opacity-90 active:scale-95 transition-opacity"
          >
            ลองใหม่อีกครั้ง / Try again
          </button>
        </div>
      </body>
    </html>
  );
}
