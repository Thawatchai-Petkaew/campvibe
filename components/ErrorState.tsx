"use client";

// CAM-218 ERR-1: Platform error-state standard component.
// Covers all 4 variants (not-found / error / forbidden / generic) and the compact mode.
// Layout B (asymmetric): mascot LEFT + text RIGHT on desktop; stacked on mobile.
// Copy from locales/translations.json via useLanguage(); never hardcoded.

import Link from "next/link";
import { Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { useLanguage } from "@/contexts/LanguageContext";

export type ErrorVariant = "not-found" | "error" | "forbidden" | "generic" | "coming-soon";

export interface ErrorStateProps {
  variant: ErrorVariant;
  /** Overrides the i18n default title for this variant */
  title?: string;
  /** Overrides the i18n default message */
  message?: string;
  /** Overrides the primary CTA label */
  actionLabel?: string;
  /** Primary CTA href — defaults to "/" */
  actionHref?: string;
  /** If provided on "error" variant, the retry button is shown */
  onRetry?: () => void;
  /** Renders inline at reduced size with no full-screen min-height */
  compact?: boolean;
}

const VARIANT_MASCOT: Record<ErrorVariant, string> = {
  "not-found": "/mascot/thinking.png",
  error: "/mascot/coding.png",
  forbidden: "/mascot/waving.png",
  generic: "/mascot/walking.png",
  "coming-soon": "/mascot/walking.png",
};

// Map variant to the i18n key used in t.errors.<key>
const VARIANT_KEY: Record<ErrorVariant, "notFound" | "unexpected" | "forbidden" | "generic" | "comingSoon"> = {
  "not-found": "notFound",
  error: "unexpected",
  forbidden: "forbidden",
  generic: "generic",
  "coming-soon": "comingSoon",
};

export function ErrorState({
  variant,
  title,
  message,
  actionLabel,
  actionHref = "/",
  onRetry,
  compact = false,
}: ErrorStateProps) {
  const { t } = useLanguage();
  const key = VARIANT_KEY[variant];
  const copy = t.errors[key];

  const resolvedTitle = title ?? copy.title;
  const resolvedMessage = message ?? copy.message;
  const resolvedActionLabel = actionLabel ?? ("cta" in copy ? copy.cta : undefined);
  const mascotSrc = VARIANT_MASCOT[variant];
  const mascotAlt = copy.mascotAlt;

  // Retry label only exists on the unexpected/error variant
  const retryLabel =
    variant === "error" && "retryLabel" in copy
      ? (copy as typeof t.errors.unexpected).retryLabel
      : undefined;

  const wrapperClass = compact
    ? "py-12 flex items-center justify-center px-4"
    : "min-h-[calc(100vh-64px)] flex items-center justify-center bg-background px-4";

  const mascotWrapperClass = compact ? "w-32" : "w-48 md:w-64";

  return (
    <div
      className={wrapperClass}
      role={variant === "error" ? "alert" : "status"}
    >
      <div className="flex flex-col md:flex-row items-center md:items-center gap-12 md:gap-16 max-w-4xl mx-auto py-16 px-6">
        {/* LEFT — mascot column */}
        <div className={`relative mb-8 md:mb-0 group flex-shrink-0 ${mascotWrapperClass}`}>
          {/* Glow ring behind mascot — motion-safe only, per DESIGN.md motion tokens */}
          <div
            className="absolute inset-0 bg-primary/10 rounded-full blur-3xl opacity-20 motion-safe:transition-opacity motion-safe:duration-200 group-hover:opacity-30"
            aria-hidden="true"
          />
          <ImageWithFallback
            src={mascotSrc}
            alt={mascotAlt}
            width={320}
            height={320}
            unoptimized
            data-testid={`img--error-mascot-${variant}`}
            className="relative rounded-full"
            imgClassName="object-contain"
          />
        </div>

        {/* RIGHT — text block (left-aligned on desktop, centered on mobile) */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {resolvedTitle}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-sm mb-3 mt-3">
            {resolvedMessage}
          </p>

          {/* CTA group — not rendered for coming-soon (no navigation on a gated site) */}
          {variant !== "coming-soon" && (
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            {variant === "error" && onRetry ? (
              <>
                {/* Primary: retry */}
                <Button
                  size="lg"
                  onClick={onRetry}
                  data-testid={`btn--error-primary-${variant}`}
                >
                  <RotateCcw size={16} aria-hidden="true" className="mr-2" />
                  {retryLabel}
                </Button>
                {/* Secondary: go home */}
                <Button
                  variant="outline"
                  size="default"
                  asChild
                  data-testid={`btn--error-secondary-${variant}`}
                >
                  <Link href={actionHref}>
                    <Home size={16} aria-hidden="true" className="mr-2" />
                    {resolvedActionLabel}
                  </Link>
                </Button>
              </>
            ) : (
              /* Single primary CTA: go home / action */
              <Button
                size="lg"
                asChild
                data-testid={`btn--error-primary-${variant}`}
              >
                <Link href={actionHref}>
                  <Home size={16} aria-hidden="true" className="mr-2" />
                  {resolvedActionLabel}
                </Link>
              </Button>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
