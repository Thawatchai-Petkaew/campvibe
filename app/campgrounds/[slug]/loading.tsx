/**
 * LOAD-3 (CAM-247): Campground detail nav-level loading fallback.
 *
 * Mirrors CampgroundDetailClient's layout:
 *   hero/cover image block → name + rating → price → info sections (amenities, location).
 *
 * Previously cold-load/navigation fell back to app/loading.tsx (neutral root shell),
 * which showed neither a detail-shaped skeleton nor the camp grid.
 * This route-specific loading.tsx shows a detail-shaped skeleton so navigation
 * to a camp detail page feels contextually correct (CLS=0 when data arrives).
 *
 * Standard §S3: route-specific loading.tsx for the campground detail route.
 * a11y §S5: role="status" + aria-busy + aria-live + sr-only Thai label.
 * Token-only: all fills via <Skeleton> (bg-muted). No hardcoded hex/px/shadow.
 */

import { Skeleton } from "@/components/ui/skeleton";
import translations from "@/locales/translations.json";

const SR_LABEL = translations.th.common.loading_sr;

export default function CampgroundDetailLoading() {
    return (
        <div
            role="status"
            aria-busy="true"
            aria-live="polite"
            data-testid="shell--campground-detail-loading"
        >
            <span className="sr-only">{SR_LABEL}</span>

            <div aria-hidden="true">
                {/* Navbar-height placeholder */}
                <div className="h-20 border-b border-border bg-background/95" />

                <div className="container mx-auto px-6 py-8 max-w-6xl">
                    {/* Hero / cover image block — matches the ImageGallery grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                        {/* Main cover image */}
                        <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
                        {/* Secondary images grid */}
                        <div className="hidden md:grid grid-cols-2 gap-3">
                            <Skeleton className="aspect-square w-full rounded-2xl" />
                            <Skeleton className="aspect-square w-full rounded-2xl" />
                            <Skeleton className="aspect-square w-full rounded-2xl" />
                            <Skeleton className="aspect-square w-full rounded-2xl" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                        {/* Left column: name + info */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Camp name */}
                            <Skeleton className="h-8 w-3/4" />

                            {/* Hosted-by + rating row */}
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-5 w-20" />
                            </div>

                            {/* Divider */}
                            <div className="border-t border-border" />

                            {/* Description lines */}
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-4/5" />
                                <Skeleton className="h-4 w-3/5" />
                            </div>

                            {/* Divider */}
                            <div className="border-t border-border" />

                            {/* Amenities grid — 3 cols matching real layout */}
                            <div className="space-y-3">
                                <Skeleton className="h-6 w-40" />
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <Skeleton className="w-6 h-6 rounded-xl flex-shrink-0" />
                                            <Skeleton className="h-4 w-20" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-border" />

                            {/* Location/map placeholder */}
                            <div className="space-y-3">
                                <Skeleton className="h-6 w-32" />
                                <Skeleton className="h-48 w-full rounded-2xl" />
                            </div>
                        </div>

                        {/* Right column: booking card */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-28 rounded-3xl border border-border shadow-lg p-6 space-y-5 bg-card">
                                {/* Price line */}
                                <div className="flex items-baseline gap-1">
                                    <Skeleton className="h-8 w-28" />
                                    <Skeleton className="h-5 w-12" />
                                </div>

                                {/* Check-in / check-out inputs */}
                                <div className="grid grid-cols-2 gap-2">
                                    <Skeleton className="h-14 w-full rounded-2xl" />
                                    <Skeleton className="h-14 w-full rounded-2xl" />
                                </div>

                                {/* Guests select */}
                                <Skeleton className="h-14 w-full rounded-2xl" />

                                {/* Reserve button */}
                                <Skeleton className="h-14 w-full rounded-full" />

                                {/* Price breakdown lines */}
                                <div className="space-y-2 pt-2 border-t border-border">
                                    <div className="flex justify-between">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-4 w-16" />
                                    </div>
                                    <div className="flex justify-between">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-4 w-16" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
