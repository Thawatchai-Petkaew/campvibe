"use client";

export function CampgroundSkeleton() {
    return (
        <div className="space-y-3 animate-pulse">
            {/* Image Placeholder - matches aspect-square rounded-xl */}
            <div className="aspect-square rounded-xl bg-gray-200" />

            {/* Content - matches space-y-1 */}
            <div className="space-y-1">
                {/* Title and Rating Row */}
                <div className="flex justify-between items-start">
                    {/* Title */}
                    <div className="h-5 bg-gray-200 rounded w-2/3" />
                    {/* Rating */}
                    <div className="h-4 bg-gray-200 rounded w-12" />
                </div>

                {/* Location */}
                <div className="h-4 bg-gray-200 rounded w-1/2" />

                {/* New Listing / Time */}
                <div className="h-4 bg-gray-200 rounded w-1/3" />

                {/* Price - with pt-1 to match actual card */}
                <div className="pt-1">
                    <div className="h-5 bg-gray-200 rounded w-1/4" />
                </div>
            </div>
        </div>
    );
}

export function CampgroundGridSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10 mt-4">
            {[...Array(10)].map((_, i) => (
                <CampgroundSkeleton key={i} />
            ))}
        </div>
    );
}
