import { CampgroundGridSkeleton } from "@/components/CampgroundSkeleton";

/**
 * Suspense loading shell for /wishlist.
 * Shown while the server fetches wishlist data — prevents empty flash.
 */
export default function WishlistLoading() {
    return (
        <div className="container mx-auto px-6 pt-8">
            <div className="h-8 w-48 bg-muted rounded animate-pulse mb-8" />
            <CampgroundGridSkeleton />
        </div>
    );
}
