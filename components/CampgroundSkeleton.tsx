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
 */

import { Skeleton } from "@/components/ui/skeleton";
import translations from "@/locales/translations.json";

// Static label from translations — no hook required, safe in server context.
const DEFAULT_LABEL = translations.th.catalog.loading;

export function CampgroundSkeleton() {
  return (
    <div className="space-y-3">
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

export function CampgroundGridSkeleton({
  count = 12,
  label = DEFAULT_LABEL,
}: CampgroundGridSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10 mt-4"
      data-testid="grid--catalog-skeleton"
    >
      {Array.from({ length: count }).map((_, i) => (
        <CampgroundSkeleton key={i} />
      ))}
    </div>
  );
}
