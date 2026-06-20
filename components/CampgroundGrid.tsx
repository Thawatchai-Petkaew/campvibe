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

// Minimal shape serialised from the server component.
export interface CampSiteCardData {
    id: string;
    nameTh: string;
    nameEn: string | null;
    nameThSlug: string;
    nameEnSlug: string;
    images: string | null;
    priceLow: number | null;
    priceHigh: number | null;
    isVerified: boolean;
    isPublished: boolean;
    latitude: number;
    longitude: number;
    createdAt: string; // ISO string (Date serialised)
    location: { province: string };
}

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
