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
import { getProvinceThaiNameMap, type CampSiteCardData } from "@/lib/read-models/camp-card";
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
                            // CAM-545: province (English) is unchanged — lib/campsite-filters.ts
                            // depends on it. district wired through (see CampSiteCardData's
                            // doc comment — not populated for any camp yet). The Thai province
                            // name is resolved downstream by NAME (getProvinceThaiNameMap),
                            // not via a relation here — see lib/read-models/camp-card.ts.
                            location: {
                                select: {
                                    province: true,
                                    district: true,
                                },
                            },
                            reviews: {
                                where: { deletedAt: null },
                                select: { rating: true },
                            },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            });

            // CAM-545: name-based Thai province lookup (fail-open — a lookup
            // error leaves every card on its English province, same as an
            // unmapped value; never blocks the wishlist from rendering).
            let provinceThaiNameMap = new Map<string, string>();
            try {
                provinceThaiNameMap = await getProvinceThaiNameMap();
            } catch (err) {
                console.error("[WishlistPage] Province Thai-name lookup failed (fail-open):", err);
            }

            items = rows.map((row) => {
                const { reviews, ...campSite } = row.campSite;
                const province = campSite.location.province ?? "";
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
                    location: {
                        province,
                        district: campSite.location.district,
                        provinceTh: province ? provinceThaiNameMap.get(province) : undefined,
                    },
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
