/**
 * BookingListSkeleton — CAM-247 (LOAD-3)
 *
 * Section-level skeleton mirroring the bookings list layout:
 *   N booking-card rows: thumbnail (md:w-64 h-48) + name + dates + status + buttons.
 *
 * Dimensions match MyBookingsPage's real card layout so CLS=0 when data arrives.
 * Token-only: all fills via <Skeleton> (bg-muted). No hardcoded hex/px/shadow.
 * a11y: role="status" + aria-busy + aria-live on the region; decorative shapes aria-hidden.
 * prefers-reduced-motion handled by the <Skeleton> primitive (motion-reduce:animate-none).
 */

import { Skeleton } from "@/components/ui/skeleton";
import translations from "@/locales/translations.json";

const SR_LABEL = translations.th.common.loading_sr;

/** Single booking-card skeleton row — matches the real booking card structure. */
function BookingCardSkeleton() {
    return (
        <div
            className="bg-card rounded-3xl overflow-hidden border border-border shadow-sm"
            aria-hidden="true"
        >
            <div className="flex flex-col md:flex-row">
                {/* Thumbnail — matches md:w-64 h-48 */}
                <div className="md:w-64 h-48 flex-shrink-0">
                    <Skeleton className="w-full h-full rounded-none" />
                </div>

                {/* Info section */}
                <div className="flex-1 p-6 flex flex-col justify-between">
                    <div>
                        {/* Camp name + price row */}
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-2">
                            <div className="space-y-1.5">
                                <Skeleton className="h-6 w-48" />
                                <Skeleton className="h-4 w-28" />
                            </div>
                            <div className="text-right space-y-1">
                                <Skeleton className="h-3 w-16 ml-auto" />
                                <Skeleton className="h-6 w-24 ml-auto" />
                            </div>
                        </div>

                        {/* Check-in / check-out date pair */}
                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <div className="flex items-center gap-3">
                                <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
                                <div className="space-y-1">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
                                <div className="space-y-1">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer: guests/nights + action buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-8 pt-6 border-t border-border/60 gap-4">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-16" />
                        </div>
                        <div className="flex gap-3">
                            <Skeleton className="h-11 w-28 rounded-full" />
                            <Skeleton className="h-11 w-32 rounded-full" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** BookingListSkeleton — N card rows matching the real list */
export function BookingListSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div
            role="status"
            aria-busy="true"
            aria-live="polite"
            data-testid="section--booking-list-skeleton"
        >
            <span className="sr-only">{SR_LABEL}</span>
            <div className="space-y-6" aria-hidden="true">
                {Array.from({ length: count }).map((_, i) => (
                    <BookingCardSkeleton key={i} />
                ))}
            </div>
        </div>
    );
}
