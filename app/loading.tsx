import { CampgroundGridSkeleton } from "@/components/CampgroundSkeleton";

export default function Loading() {
    return (
        <main className="min-h-screen pb-20">
            {/* Navbar Placeholder space */}
            <div className="h-20" />

            {/* Category Bar Placeholder */}
            <div className="sticky top-20 bg-white z-40 border-b border-gray-100 py-6">
                <div className="container mx-auto px-6 flex gap-8">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-2 min-w-[64px]">
                            <div className="w-6 h-6 bg-gray-100 rounded-full animate-pulse" />
                            <div className="h-3 bg-gray-100 rounded w-12 animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>

            <div className="container mx-auto px-6 pt-6">
                <CampgroundGridSkeleton />
            </div>
        </main>
    );
}
