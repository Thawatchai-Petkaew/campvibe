/**
 * LOAD-3 (CAM-247): Bookings-list nav-level loading fallback.
 *
 * Shows the hero/header chrome instantly + BookingListSkeleton in the list area.
 * Mirrors the real MyBookingsPage shell (CLS=0 when data arrives).
 *
 * Standard §S3: route-specific loading.tsx for the bookings route.
 * a11y §S5: the BookingListSkeleton carries role="status" + aria-busy + aria-live.
 */

import { BookingListSkeleton } from "@/components/ui/booking-list-skeleton";

export default function BookingsLoading() {
    return (
        <div
            className="min-h-screen bg-background"
            data-testid="shell--bookings-loading"
        >
            <div className="container mx-auto px-6 py-12">
                <div className="max-w-4xl mx-auto">
                    {/* Chrome: hero/header placeholder — matches real page layout */}
                    <div
                        className="flex justify-between items-center mb-10"
                        aria-hidden="true"
                    >
                        <div>
                            {/* Title + subtitle height match real h1 + p */}
                            <div className="text-3xl md:text-4xl font-bold opacity-0 select-none">&nbsp;</div>
                            <div className="mt-2 opacity-0 select-none">&nbsp;</div>
                        </div>
                    </div>

                    {/* Async section skeleton */}
                    <BookingListSkeleton count={3} />
                </div>
            </div>
        </div>
    );
}
