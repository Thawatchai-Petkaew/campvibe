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
        "flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm",
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
