"use client";

export function CampgroundSkeleton() {
    return (
        <div className="space-y-3 animate-pulse">
            {/* Image Placeholder */}
            <div className="aspect-square rounded-xl bg-gray-200" />

            <div className="space-y-2">
                <div className="flex justify-between items-start">
                    {/* Title */}
                    <div className="h-5 bg-gray-200 rounded w-2/3" />
                    {/* Rating */}
                    <div className="h-4 bg-gray-200 rounded w-1/6" />
                </div>
                {/* Location */}
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                {/* Time */}
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                {/* Price */}
                <div className="h-5 bg-gray-200 rounded w-1/4 pt-1" />
            </div>
        </div>
    );
}

export function CampgroundGridSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
            {[...Array(8)].map((_, i) => (
                <CampgroundSkeleton key={i} />
            ))}
        </div>
    );
}
