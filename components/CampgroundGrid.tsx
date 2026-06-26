"use client";

/**
 * Client island for the campground grid.
 * Holds the LoginModal state for guest heart-clicks.
 * Parent (server) passes cards as serialisable props — no DB calls here.
 */

import { useState } from "react";
import { CampgroundCard } from "@/components/CampgroundCard";
import { LoginModal } from "@/components/LoginModal";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CampCardPayload } from "@/lib/read-models/camp-card";

/**
 * Serialised card shape passed from the server component (PERF-1 / CAM-192).
 * Derived from CampCardPayload: reviews are stripped server-side and replaced
 * with the computed avgRating / reviewCount scalars.
 * priceLow is serialised to number | null by serializeDecimals (was Decimal).
 * createdAt is serialised to ISO string.
 */
export type CampSiteCardData = Omit<CampCardPayload, 'reviews' | 'priceLow' | 'createdAt'> & {
    priceLow: number | null;   // Decimal serialised to number
    createdAt: string;          // Date serialised to ISO string
    /** CAM-147: server-computed average rating (1dp) or null when no reviews. */
    avgRating?: number | null;
    /** CAM-147: total non-deleted review count. */
    reviewCount?: number;
};

interface CampgroundGridProps {
    camps: CampSiteCardData[];
    savedIds: Set<string> | string[];
    isLoggedIn: boolean;
}

export function CampgroundGrid({ camps, savedIds, isLoggedIn }: CampgroundGridProps) {
    const { t } = useLanguage();
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const savedSet = savedIds instanceof Set ? savedIds : new Set(savedIds);

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10 mt-4">
                {camps.map((camp) => (
                    <CampgroundCard
                        key={camp.id}
                        campground={camp as any /* serialised CampSite — createdAt is string from JSON, card handles both */}
                        initialSaved={savedSet.has(camp.id)}
                        isLoggedIn={isLoggedIn}
                        onGuestHeartClick={() => setIsLoginOpen(true)}
                        avgRating={camp.avgRating}
                        reviewCount={camp.reviewCount}
                    />
                ))}
            </div>

            <LoginModal
                isOpen={isLoginOpen}
                onClose={() => setIsLoginOpen(false)}
                subtitle={t.wishlist.loginPromptGuest}
            />
        </>
    );
}
