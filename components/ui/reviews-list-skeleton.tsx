/**
 * ReviewsListSkeleton — CAM-394: the Suspense fallback for the streamed review
 * list on the campground detail page. Mirrors the real review-card list layout
 * (`ReviewsListStreamed` in CampgroundDetailClient.tsx): a `space-y-6` list of
 * cards, each with a name bar, a 5-star row, a date, and two text lines — so the
 * real reviews arrive with no layout shift (CLS=0) when the promise resolves.
 *
 * loading.md §5 a11y: role="status" + aria-busy + aria-live + an sr-only Thai
 * label; decorative shapes are aria-hidden. Token-only fills via <Skeleton>
 * (bg-muted); shimmer disabled under prefers-reduced-motion by the primitive.
 */
import { Skeleton } from "@/components/ui/skeleton";
import translations from "@/locales/translations.json";

const SR_LABEL = translations.th.common.loading_sr;

export function ReviewsListSkeleton() {
    return (
        <div role="status" aria-busy="true" aria-live="polite" data-testid="skeleton--reviews-list">
            <span className="sr-only">{SR_LABEL}</span>
            <ul className="space-y-6" aria-hidden="true">
                {Array.from({ length: 3 }).map((_, i) => (
                    <li key={i} className="py-4 border-b border-border last:border-b-0 -mx-1 px-1">
                        {/* reviewer name */}
                        <Skeleton className="h-4 w-32 mb-2 rounded-md" />
                        {/* 5-star row + date */}
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, s) => (
                                    <Skeleton key={s} className="w-3.5 h-3.5 rounded-sm" />
                                ))}
                            </div>
                            <Skeleton className="h-3.5 w-20 rounded-sm" />
                        </div>
                        {/* two content lines */}
                        <div className="space-y-2 mt-1">
                            <Skeleton className="h-4 w-full rounded-md" />
                            <Skeleton className="h-4 w-4/5 rounded-md" />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
