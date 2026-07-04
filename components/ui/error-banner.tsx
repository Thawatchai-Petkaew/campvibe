"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ErrorBannerProps {
  message: string;
  className?: string;
  /** Optional data-testid forwarded to the root element (for QA assertions). */
  "data-testid"?: string;
}

export function ErrorBanner({ message, className, "data-testid": dataTestId }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div
      className={cn(
        // CAM-261: bg-destructive/2 (was /10) — text-destructive on the same
        // hue's tint loses AA contrast as the tint's opacity rises (measured
        // real-browser color-mix; same fix as components/ui/badge.tsx). This
        // component never had a dark:-specific override, so the single value
        // applies to both modes — verified >=4.5:1 in light AND dark.
        "flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/2 border border-destructive/20 text-destructive text-sm",
        className
      )}
      role="alert"
      data-testid={dataTestId}
    >
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
