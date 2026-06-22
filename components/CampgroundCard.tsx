"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { IconHeart, IconHeartFilled } from "@tabler/icons-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { CampSite } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { wishlistAPI } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface CampgroundCardProps {
    campground: CampSite & { location: { province: string }; images?: { url: string }[] };
    /** Whether this camp site is already in the user's wishlist (hydrated server-side). */
    initialSaved?: boolean;
    /** True when the user has an active session. Controls heart behaviour. */
    isLoggedIn?: boolean;
    /** Called when a guest (no session) taps the heart — parent opens LoginModal. */
    onGuestHeartClick?: () => void;
}

export function CampgroundCard({
    campground,
    initialSaved = false,
    isLoggedIn = false,
    onGuestHeartClick,
}: CampgroundCardProps) {
    const { t, formatCurrency, language } = useLanguage();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [saved, setSaved] = useState(initialSaved);
    const [isLoading, setIsLoading] = useState(false);

    const imageUrls = campground.images?.length ? campground.images.map((img) => img.url) : [
        "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&q=80&w=800"
    ];

    const nextImage = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % imageUrls.length);
    };

    const prevImage = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
    };

    const handleHeartClick = useCallback(async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Guest: open login modal, heart stays empty, no API call.
        if (!isLoggedIn) {
            onGuestHeartClick?.();
            return;
        }

        if (isLoading) return;

        // Optimistic toggle.
        const next = !saved;
        setSaved(next);
        setIsLoading(true);

        try {
            if (next) {
                const res = await wishlistAPI.save(campground.id);
                if (res.error) throw new Error(res.error);
                toast.success(t.wishlist.toastSaved);
            } else {
                const res = await wishlistAPI.remove(campground.id);
                if (res.error) throw new Error(res.error);
                toast.success(t.wishlist.toastRemoved);
            }
        } catch {
            // Rollback on failure.
            setSaved(!next);
            toast.error(next ? t.wishlist.toastErrorSave : t.wishlist.toastErrorRemove);
        } finally {
            setIsLoading(false);
        }
    }, [isLoggedIn, isLoading, saved, campground.id, t, onGuestHeartClick]);

    const heartAriaLabel = isLoading
        ? t.wishlist.heartAriaLabelLoading
        : saved
            ? t.wishlist.heartAriaLabelRemove
            : t.wishlist.heartAriaLabelSave;

    const name = language === 'en' ? (campground.nameEn || campground.nameTh) : campground.nameTh;
    const slug = language === 'en' ? (campground.nameEnSlug || campground.nameThSlug) : campground.nameThSlug;

    return (
        // Root is a div so the heart button is NOT inside the Link (AC 11).
        <div className="group relative space-y-3">
            {/* Clickable image+content area navigates to camp detail. */}
            <Link href={`/campgrounds/${slug}`} className="block cursor-pointer">
                <div className="relative aspect-square rounded-3xl overflow-hidden bg-muted">
                    {/* New Listing Badge */}
                    {new Date(campground.createdAt).getTime() > Date.now() - 14 * 24 * 60 * 60 * 1000 && (
                        <div className="absolute top-3 left-3 z-10">
                            <Badge variant="secondary" className="h-6 px-2 text-xs font-medium bg-background/90 backdrop-blur-sm text-foreground shadow-sm border-border/50">
                                New
                            </Badge>
                        </div>
                    )}

                    {/* Image Slider */}
                    <div className="relative w-full h-full">
                        <img
                            src={imageUrls[currentIndex]}
                            alt={name}
                            className="object-cover w-full h-full group-hover:scale-105 transition duration-500 ease-out"
                        />

                        {/* Navigation Arrows (visible on hover) */}
                        {imageUrls.length > 1 && (
                            <>
                                <button
                                    onClick={prevImage}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/80 hover:bg-background shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                    aria-label="Previous image"
                                >
                                    <ChevronLeft className="w-4 h-4 text-foreground" />
                                </button>
                                <button
                                    onClick={nextImage}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/80 hover:bg-background shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                    aria-label="Next image"
                                >
                                    <ChevronRight className="w-4 h-4 text-foreground" />
                                </button>
                            </>
                        )}

                        {/* Dot Indicators */}
                        {imageUrls.length > 1 && (
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                                {imageUrls.slice(0, 5).map((_, i) => (
                                    <div
                                        key={i}
                                        className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIndex ? 'bg-background scale-110' : 'bg-background/60'
                                            }`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-1 mt-3">
                    <div className="flex justify-between items-start">
                        <h3 className="font-semibold text-foreground truncate pr-4">{name}</h3>
                        <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-foreground text-foreground" />
                            <span className="text-sm">4.8</span>
                        </div>
                    </div>
                    <p className="text-muted-foreground text-sm">{campground.location.province}, Thailand</p>
                    <div className="flex items-baseline gap-1 pt-1">
                        <span className="font-semibold">{campground.priceLow ? formatCurrency(Number(campground.priceLow)) : t.common.free}</span>
                        <span className="text-muted-foreground">{t.common.night}</span>
                    </div>
                </div>
            </Link>

            {/*
              Heart button is a sibling of the Link — absolute-positioned over the image.
              It is NOT inside the Link, so tapping it does NOT navigate (AC 11).
            */}
            <button
                data-testid="btn--wishlist-toggle"
                aria-label={heartAriaLabel}
                aria-pressed={saved}
                disabled={isLoading}
                onClick={handleHeartClick}
                className={cn(
                    // Tap target ≥44px: w-11 h-11.
                    "absolute top-3 right-3 z-20 w-11 h-11",
                    "flex items-center justify-center",
                    "rounded-full",
                    "bg-background/20 backdrop-blur-sm",
                    // States
                    "transition-all duration-150",
                    "hover:bg-background/40 hover:scale-110",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "active:scale-95",
                    "disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100",
                )}
            >
                {saved ? (
                    // Filled = teal (--primary), per G2 brand decision.
                    <IconHeartFilled className="w-5 h-5 text-primary" aria-hidden="true" />
                ) : (
                    <IconHeart className="w-5 h-5 text-white drop-shadow-sm" aria-hidden="true" />
                )}
            </button>
        </div>
    );
}
