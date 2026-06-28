/**
 * RootShellSkeleton — CAM-246 (LOAD-2)
 *
 * Neutral last-resort fallback for app/loading.tsx (§S3 of loading-ui-standard).
 * Renders a navbar-height bar + a generic content shimmer block.
 * NOT a camp-grid — this is the shell shown for any route that has no
 * route-specific loading.tsx of its own (profile, host, detail, etc.).
 *
 * Token-only: bg-muted via the <Skeleton> primitive (no hardcoded hex/px/shadow).
 * a11y: role="status" + aria-busy="true" + aria-live="polite" + sr-only Thai label.
 * Decorative shapes are aria-hidden="true".
 * prefers-reduced-motion handled by <Skeleton> (motion-reduce:animate-none).
 */

import { Skeleton } from "@/components/ui/skeleton";
import translations from "@/locales/translations.json";

// SR label from the shared common.loading_sr key (TH verbatim: กำลังโหลด…).
// Never hardcoded — resolves via the i18n JSON so the key is the source of truth.
const SR_LABEL = translations.th.common.loading_sr;

export function RootShellSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid="shell--root-skeleton"
    >
      {/* Screen-reader live-region text — the only announced content */}
      <span className="sr-only">{SR_LABEL}</span>

      {/* Navbar-height placeholder — mirrors the sticky nav bar (h-20 from Navbar) */}
      <div
        className="h-20 border-b border-border bg-background/95"
        aria-hidden="true"
      />

      {/* Generic content shimmer — a few skeleton bars representing page content */}
      <div
        className="container mx-auto px-6 py-8 space-y-6"
        aria-hidden="true"
      >
        {/* Title / heading line */}
        <Skeleton className="h-8 w-1/3" />

        {/* Subtitle line */}
        <Skeleton className="h-5 w-1/2" />

        {/* Content block — three paragraph-width bars */}
        <div className="space-y-3 pt-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>

        {/* Secondary content block */}
        <div className="space-y-3 pt-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}
