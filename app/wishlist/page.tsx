/**
 * /wishlist — "รายการที่ถูกใจ" page (CAM-18)
 *
 * Server component — fetches wishlist data, then delegates UI states
 * (guest / empty / list / error) to the WishlistPageClient island.
 *
 * States:
 *   loading  — handled by app/wishlist/loading.tsx (Suspense shell)
 *   guest    — unauthenticated: login prompt
 *   empty    — authenticated but no saved items
 *   list     — authenticated + items → grid of CampgroundCard (saved=true)
 *   error    — fetch failed → inline ErrorBanner
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { WishlistPageClient } from "@/components/WishlistPageClient";
import type { CampSiteCardData } from "@/components/CampgroundGrid";
import { computeAvgRating } from "@/lib/sort-utils";
import { roundAvgRating } from "@/lib/review-summary";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
    const session = await auth();
    const isLoggedIn = !!session?.user?.id;

    let items: CampSiteCardData[] = [];
    let hasError = false;

    if (isLoggedIn) {
        try {
            const rows = await prisma.wishlist.findMany({
                where: { userId: session!.user!.id },
                include: {
                    campSite: {
                        select: {
                            id: true,
                            nameTh: true,
                            nameEn: true,
                            nameThSlug: true,
                            nameEnSlug: true,
                            images: true,
                            priceLow: true,
                            priceHigh: true,
                            isVerified: true,
                            isPublished: true,
                            latitude: true,
                            longitude: true,
                            createdAt: true,
                            location: { select: { province: true } },
                            reviews: {
                                where: { deletedAt: null },
                                select: { rating: true },
                            },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            });

            items = rows.map((row) => {
                const { reviews, ...campSite } = row.campSite;
                return {
                    id: campSite.id,
                    nameTh: campSite.nameTh,
                    nameEn: campSite.nameEn,
                    nameThSlug: campSite.nameThSlug,
                    nameEnSlug: campSite.nameEnSlug,
                    images: campSite.images,
                    priceLow: campSite.priceLow === null ? null : Number(campSite.priceLow),
                    priceHigh: campSite.priceHigh === null ? null : Number(campSite.priceHigh),
                    isVerified: campSite.isVerified,
                    isPublished: campSite.isPublished,
                    latitude: campSite.latitude,
                    longitude: campSite.longitude,
                    createdAt: campSite.createdAt.toISOString(),
                    location: { province: campSite.location.province ?? "" },
                    avgRating: roundAvgRating(computeAvgRating(reviews)),
                    reviewCount: reviews.length,
                };
            });
        } catch (err) {
            console.error("[WishlistPage] Failed to fetch wishlist:", err);
            hasError = true;
        }
    }

    return (
        <main className="min-h-screen pb-20 bg-background text-foreground">
            <Navbar />

            <div className="container mx-auto px-6 pt-8">
                <WishlistPageClient
                    isLoggedIn={isLoggedIn}
                    items={items}
                    hasError={hasError}
                />
            </div>
        </main>
    );
}
