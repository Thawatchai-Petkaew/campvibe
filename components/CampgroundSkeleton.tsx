/**
 * CampgroundSkeleton — canonical card-shaped skeleton for the Home catalog.
 *
 * No "use client" — this component is used as a React Suspense fallback
 * (server-rendered) AND in app/wishlist/loading.tsx. It must not depend on
 * any client-only hook.
 *
 * i18n approach: translations are imported directly from the JSON file.
 * The aria-label defaults to the Thai string (TH is the primary locale for
 * this product). An optional `label` prop overrides it when callers need EN.
 * This avoids both hardcoding and a client-only useLanguage() hook.
 *
 * AC: LOAD-1 B — skeleton matches real CampgroundCard layout exactly (CLS = 0).
 *
 * CAM-245 (LOAD-PILOT) a11y compliance per loading-ui-standard §S5:
 *   - The grid container has aria-busy="true" + role="status" + aria-live="polite"
 *     so screen readers announce loading state without repeating per-card noise.
 *   - A single visually-hidden sr-only text node carries the กำลังโหลด… label
 *     inside the live region (in addition to aria-label on the outer element).
 *   - Individual skeleton card shapes are aria-hidden="true" (purely decorative).
 *
 * CAM-245 (LOAD-PILOT) anti-flicker (delay-before-show) per §S4:
 *   For a Suspense fallback, delay-before-show is implemented via CSS
 *   animation-delay on the skeleton's opacity. The grid wrapper starts at
 *   opacity:0 and fades in after 300ms using a CSS keyframe. Loads that
 *   resolve in <300ms will never be visible. This is the practical approach
 *   for Suspense fallbacks — see pilot learnings in the handoff report.
 *   Min-display is intentionally NOT implemented for Suspense (see pilot
 *   report §anti-flicker-friction).
 */

import { Skeleton } from "@/components/ui/skeleton";
import translations from "@/locales/translations.json";

// Static labels from translations — no hook required, safe in server context.
const DEFAULT_LABEL = translations.th.catalog.loading;
const SR_LABEL = translations.th.catalog.loading_sr;

/**
 * CampgroundSkeleton — a single card-shaped skeleton.
 * Purely decorative; the containing grid carries the a11y role/live.
 * aria-hidden="true" so screen readers skip per-card shapes.
 */
export function CampgroundSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-3">
      {/* Image — matches CampgroundCard: aspect-square rounded-3xl */}
      <Skeleton className="aspect-square w-full rounded-3xl" />

      {/* Text block — matches CampgroundCard content section */}
      <div className="space-y-1 mt-3">
        {/* Title row: name (2/3 width) + rating (w-10 shrink-0) */}
        <div className="flex justify-between items-start gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-10 shrink-0" />
        </div>

        {/* Location */}
        <Skeleton className="h-4 w-1/2" />

        {/* Price with top padding to match card layout */}
        <div className="pt-1">
          <Skeleton className="h-5 w-1/4" />
        </div>
      </div>
    </div>
  );
}

interface CampgroundGridSkeletonProps {
  count?: number;
  /**
   * Accessible label for the loading region.
   * Defaults to the Thai catalog.loading string.
   * Pass an EN string when rendering in an EN-only context.
   */
  label?: string;
}

/**
 * CampgroundGridSkeleton — the full grid of card skeletons shown while
 * the catalog is loading. Mirrors the InfiniteScrollGrid layout exactly
 * (same grid-cols / gap / mt) to ensure CLS = 0.
 *
 * a11y: role="status" + aria-live="polite" + aria-busy="true" on the outer
 * wrapper, plus a visually-hidden text node with กำลังโหลด… so screen
 * readers announce the loading state once (not per card).
 *
 * Anti-flicker: `skeleton-delay-show` CSS class fades the grid in after
 * ~300ms via animation-delay so fast responses (<300ms) never flash a
 * skeleton. See `app/globals.css` for the keyframe.
 */
export function CampgroundGridSkeleton({
  count = 12,
  label = DEFAULT_LABEL,
}: CampgroundGridSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className="skeleton-delay-show grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10 mt-4"
      data-testid="grid--catalog-skeleton"
    >
      {/*
        Single visually-hidden live-region text node.
        Announces once on mount; screen readers skip the decorative shapes
        below (each card is aria-hidden).
      */}
      <span className="sr-only">{SR_LABEL}</span>

      {Array.from({ length: count }).map((_, i) => (
        <CampgroundSkeleton key={i} />
      ))}
    </div>
  );
}
