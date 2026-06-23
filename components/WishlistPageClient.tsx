"use client";

/**
 * Client island for /wishlist page.
 * Handles LoginModal state for guest flows and card interactivity.
 */

import { useState } from "react";
import Link from "next/link";
import { Heart, AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { CampgroundCard } from "@/components/CampgroundCard";
import { LoginModal } from "@/components/LoginModal";
import { Button } from "@/components/ui/button";
import type { CampSiteCardData } from "@/components/CampgroundGrid";

interface WishlistPageClientProps {
    /** Null = guest (not authenticated). */
    isLoggedIn: boolean;
    items: CampSiteCardData[];
    hasError: boolean;
}

export function WishlistPageClient({ isLoggedIn, items, hasError }: WishlistPageClientProps) {
    const { t } = useLanguage();
    const [isLoginOpen, setIsLoginOpen] = useState(false);

    // ── Guest state ──────────────────────────────────────────────────────────
    if (!isLoggedIn) {
        return (
            <>
                <h1 className="font-display text-2xl font-bold text-foreground mb-8">{t.wishlist.pageTitle}</h1>
                <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
                    <div className="flex items-center justify-center w-20 h-20 rounded-full bg-muted">
                        <Heart className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <div className="space-y-2 max-w-xs">
                        <h2 className="text-xl font-bold text-foreground">{t.wishlist.guestHeading}</h2>
                        <p className="text-sm text-muted-foreground">{t.wishlist.guestSubtitle}</p>
                    </div>
                    <Button
                        className="h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8"
                        onClick={() => setIsLoginOpen(true)}
                    >
                        {t.wishlist.loginButton}
                    </Button>
                </div>

                <LoginModal
                    isOpen={isLoginOpen}
                    onClose={() => setIsLoginOpen(false)}
                    subtitle={t.wishlist.loginPromptGuest}
                />
            </>
        );
    }

    // ── Error state ──────────────────────────────────────────────────────────
    if (hasError) {
        return (
            <>
            <h1 className="font-display text-2xl font-bold text-foreground mb-8">{t.wishlist.pageTitle}</h1>
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm max-w-lg">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t.wishlist.errorLoad}</span>
            </div>
            </>
        );
    }

    // ── Empty state ──────────────────────────────────────────────────────────
    if (items.length === 0) {
        return (
            <>
            <h1 className="font-display text-2xl font-bold text-foreground mb-8">{t.wishlist.pageTitle}</h1>
            <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
                <div className="flex items-center justify-center w-20 h-20 rounded-full bg-muted">
                    <Heart className="w-10 h-10 text-muted-foreground/40 fill-current" aria-hidden="true" />
                </div>
                <div className="space-y-2 max-w-xs">
                    <h2 className="text-xl font-bold text-foreground">{t.wishlist.emptyHeading}</h2>
                    <p className="text-sm text-muted-foreground">{t.wishlist.emptySubtitle}</p>
                </div>
                <Button
                    asChild
                    className="h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8"
                >
                    <Link href="/">{t.wishlist.startSearching}</Link>
                </Button>
            </div>
            </>
        );
    }

    // ── List state ───────────────────────────────────────────────────────────
    return (
        <>
            <h1 className="font-display text-2xl font-bold text-foreground mb-8">{t.wishlist.pageTitle}</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
                {items.map((camp) => (
                    <CampgroundCard
                        key={camp.id}
                        campground={camp as any /* serialised CampSite — createdAt is string from JSON, card handles both */}
                        initialSaved={true}
                        isLoggedIn={true}
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
