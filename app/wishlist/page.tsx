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
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            });

            items = rows.map((row) => ({
                id: row.campSite.id,
                nameTh: row.campSite.nameTh,
                nameEn: row.campSite.nameEn,
                nameThSlug: row.campSite.nameThSlug,
                nameEnSlug: row.campSite.nameEnSlug,
                images: row.campSite.images,
                priceLow: row.campSite.priceLow === null ? null : Number(row.campSite.priceLow),
                priceHigh: row.campSite.priceHigh === null ? null : Number(row.campSite.priceHigh),
                isVerified: row.campSite.isVerified,
                isPublished: row.campSite.isPublished,
                latitude: row.campSite.latitude,
                longitude: row.campSite.longitude,
                createdAt: row.campSite.createdAt.toISOString(),
                location: { province: row.campSite.location.province ?? "" },
            }));
        } catch (err) {
            console.error("[WishlistPage] Failed to fetch wishlist:", err);
            hasError = true;
        }
    }

    return (
        <main className="min-h-screen pb-20 bg-background text-foreground">
            <Navbar currentUser={session?.user} />

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
