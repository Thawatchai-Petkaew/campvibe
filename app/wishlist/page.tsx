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
import { getProvinceThaiNameMap, resolveLocationDisplayNames, adminAreaChainSelect, type CampSiteCardData } from "@/lib/read-models/camp-card";
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
                            // depends on it. district kept selected for shape stability (no
                            // longer read for display, see below). The Thai province name
                            // falls back to a NAME lookup (getProvinceThaiNameMap) only when
                            // the id-derived value below is absent. CAM-573: adminArea added —
                            // the resolved chain closes CAM-567 (district/sub-district now
                            // render in the chosen language, derived from the id instead of
                            // the raw free-text column).
                            location: {
                                select: {
                                    province: true,
                                    district: true,
                                    adminArea: { select: adminAreaChainSelect },
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
                // CAM-573 — prefer the id-derived bilingual chain; fall back to
                // the name-based provinceTh lookup only when it's absent (the 2
                // orphan Location rows with no live camp).
                const idDerived = resolveLocationDisplayNames(campSite.location.adminArea);
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
                        provinceTh: idDerived.provinceTh ?? (province ? provinceThaiNameMap.get(province) : undefined),
                        provinceEn: idDerived.provinceEn,
                        districtTh: idDerived.districtTh,
                        districtEn: idDerived.districtEn,
                        subDistrictTh: idDerived.subDistrictTh,
                        subDistrictEn: idDerived.subDistrictEn,
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
