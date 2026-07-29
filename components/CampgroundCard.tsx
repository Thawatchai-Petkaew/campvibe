"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Heart } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { wishlistAPI } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { useTheme } from "next-themes";
import type { CampAvailabilityStatus } from "@/lib/campsite-availability";
import type { PricingUnit } from "@/lib/booking-pricing";
import { priceUnitSuffix } from "@/lib/price-unit-display";

/**
 * The exact fields CampgroundCard reads, independent of the caller's full
 * record shape — every existing caller today passes its data `as any`
 * specifically because the real runtime value is already JSON-serialised
 * (priceLow: number, createdAt: string), never a live `Prisma.Decimal`/`Date`
 * (see CampgroundGrid.tsx's `CampSiteCardData`, the same convention). A full
 * `CampSite` AND the narrower AI-chat card payload (CAM-272,
 * `lib/read-models/camp-card.ts` `CampCardPayload` post-serialization) both
 * satisfy this structurally — no boundary adapter object needed (CAM-272
 * design.md §Seams).
 */
export interface CampgroundCardData {
    id: string;
    nameTh: string;
    nameEn?: string | null;
    nameThSlug: string;
    nameEnSlug: string;
    priceLow: number | null;
    /** CAM-545: optional — an older/narrower caller without a real range still satisfies this structurally. */
    priceHigh?: number | null;
    /**
     * CAM-653 (ADR-014): what `priceLow` is charged per. Optional — an
     * older/narrower caller (e.g. a stale cached payload) that omits it
     * defaults to `PER_SITE` at render time (`priceUnitSuffix`), matching
     * the column default and today's math (every real camp is PER_SITE
     * until CAM-654 ships the host-facing picker).
     */
    priceUnit?: PricingUnit;
    createdAt: string;
    location: {
        province: string;
        /**
         * CAM-545 (rework, 2026-07-26): the Thai province name. CAM-573
         * prefers an id-derived value (`Location.adminAreaId` -> the
         * resolved AdminArea's Thai name), falling back to the pre-existing
         * name-based match (`Location.province` against the admin-division
         * dataset's English name) when the id-derived value is absent — see
         * `lib/read-models/camp-card.ts`'s `withProvinceThaiNames`. Optional
         * — a province with no match at all falls back to `province`
         * (BR-1/EC-1); `province` itself is never touched by this field.
         */
        provinceTh?: string;
        /**
         * CAM-573 — the id-derived English province name (the same
         * AdminArea node `provinceTh` comes from, English side). Optional —
         * falls back to the raw `province` value when absent (every card
         * whose `adminArea` did not resolve).
         */
        provinceEn?: string;
        /**
         * CAM-545: district — owner requirement (2026-07-26): show
         * "district, province", drop the country entirely. This raw
         * free-text field is NO LONGER read by `buildLocationText` (CAM-573
         * — a Thai user was seeing this ENGLISH free-text value beside a
         * Thai province, CAM-567). Kept on the type for shape stability
         * only; the id-derived `districtTh`/`districtEn` below are what
         * renders now.
         */
        district?: string | null;
        /**
         * CAM-573 — the id-derived bilingual district name (from
         * `Location.adminAreaId`'s resolved AdminArea chain). Populated only
         * when the chain reached DISTRICT depth or deeper; absent = render
         * province-only for this level (never a wrong-language guess, EC-4).
         */
        districtTh?: string;
        districtEn?: string;
        /**
         * CAM-573 — the id-derived bilingual sub-district name. Populated
         * only when the chain reached SUBDISTRICT depth; absent = render
         * with no sub-district prefix.
         */
        subDistrictTh?: string;
        subDistrictEn?: string;
    };
    images?: { url: string }[];
}

interface CampgroundCardProps {
    campground: CampgroundCardData;
    /** Whether this camp site is already in the user's wishlist (hydrated server-side). */
    initialSaved?: boolean;
    /** True when the user has an active session. Controls heart behaviour. */
    isLoggedIn?: boolean;
    /** Called when a guest (no session) taps the heart — parent opens LoginModal. */
    onGuestHeartClick?: () => void;
    /** CAM-147: server-computed average rating (1dp) or null when no reviews. */
    avgRating?: number | null;
    /** CAM-147: total non-deleted review count. */
    reviewCount?: number;
    /**
     * CAM-344: computed, non-persisted availability status for the selected
     * dated search range. Undefined = no date context (undated search,
     * wishlist, similar-camps reuse) → no badge rendered (BR-4/BR-7).
     */
    availabilityStatus?: CampAvailabilityStatus;
    /**
     * CAM-199 (PERF-IMG-LCP): pass true only for the first N above-the-fold cards.
     * Sets fetchpriority="high" + eager loading on the underlying next/image.
     * Default false (lazy) for all below-the-fold cards.
     */
    priority?: boolean;
    /**
     * CAM-272: "compact" hides the wishlist heart + carousel arrows/dots —
     * Discover-only surfaces (the AI chat card) show no chat-side actions.
     * Default "default" preserves the catalog/wishlist-grid behaviour exactly.
     */
    variant?: "default" | "compact";
}

/**
 * CAM-545 (rework, 2026-07-26 owner requirement) — the localized location
 * line: "sub-district, district, province" (each level omitted when the
 * chain didn't resolve that deep), never the country ("User รู้อยู่แล้ว" —
 * the owner's own words).
 *
 * CAM-573 (closes CAM-567): district and sub-district now render from the
 * id-derived bilingual pair (`districtTh`/`districtEn`,
 * `subDistrictTh`/`subDistrictEn` — resolved server-side from
 * `Location.adminAreaId`'s AdminArea chain, see
 * `lib/read-models/camp-card.ts`'s `resolveLocationDisplayNames`), never
 * the raw free-text `district` column — that is what caused the defect
 * (an English free-text district shown beside a Thai province). A card
 * whose chain is absent (an older/narrower caller, or the 2 orphan
 * `Location` rows with no live camp) falls back to the raw `district`
 * value for BOTH languages (never a regression from pre-CAM-573 behavior,
 * just not yet the fully-localized fix — see tech.md "Known gap": the
 * detail page's own data-fetch is outside this story's file surface).
 * Province similarly prefers the id-derived `provinceTh`/`provinceEn`,
 * falling back to the raw `province` string when absent (EC-1).
 */
export function buildLocationText(
    location: CampgroundCardData["location"],
    language: "en" | "th",
): string {
    const province = language === "th"
        ? (location.provinceTh || location.province)
        : (location.provinceEn || location.province);
    const district = language === "th"
        ? (location.districtTh ?? location.district ?? undefined)
        : (location.districtEn ?? location.district ?? undefined);
    const subDistrict = language === "th" ? location.subDistrictTh : location.subDistrictEn;

    const prefix = [subDistrict, district].filter((part): part is string => !!part);
    return prefix.length > 0 ? `${prefix.join(", ")}, ${province}` : province;
}

/** What the price line renders — either the free copy or an amount (single or range). */
export interface CardPriceDisplay {
    isFree: boolean;
    isRange: boolean;
    /** Formatted amount text, e.g. "฿500" or "฿500-1,000". Empty when free. */
    amountText: string;
}

/**
 * CAM-545 — decides single price vs honest range vs free (BR-5/BR-6, EC-2/EC-3).
 * A range only renders when `priceHigh` is a real, greater upper bound; a
 * missing/inverted/equal `priceHigh` falls back to the single-price form
 * rather than showing a degenerate range. The currency symbol is stripped
 * from the high value (via the caller's own `currencySymbol`) so a range
 * reads as "฿500-1,000", not "฿500-฿1,000".
 */
export function buildCardPriceDisplay(
    priceLow: number | null,
    priceHigh: number | null | undefined,
    formatCurrency: (amount: number) => string,
    currencySymbol: string,
): CardPriceDisplay {
    const isFree = priceLow == null || priceLow <= 0;
    if (isFree) {
        return { isFree: true, isRange: false, amountText: "" };
    }

    const isRange = priceHigh != null && priceHigh > priceLow;
    if (!isRange) {
        return { isFree: false, isRange: false, amountText: formatCurrency(priceLow) };
    }

    const highFormatted = formatCurrency(priceHigh);
    const highNumberOnly = highFormatted.startsWith(currencySymbol)
        ? highFormatted.slice(currencySymbol.length)
        : highFormatted;
    return { isFree: false, isRange: true, amountText: `${formatCurrency(priceLow)}-${highNumberOnly}` };
}

export function CampgroundCard({
    campground,
    initialSaved = false,
    isLoggedIn = false,
    onGuestHeartClick,
    avgRating,
    reviewCount = 0,
    availabilityStatus,
    priority = false,
    variant = "default",
}: CampgroundCardProps) {
    const { t, formatCurrency, language } = useLanguage();
    const { resolvedTheme } = useTheme();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [saved, setSaved] = useState(initialSaved);
    const [isLoading, setIsLoading] = useState(false);

    const placeholderSrc = resolvedTheme === 'dark' ? '/placeholder-camp-dark.svg' : '/placeholder-camp.svg';
    const imageUrls = campground.images?.length ? campground.images.map((img) => img.url) : [placeholderSrc];

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

    // CAM-545: localized "province, country" line + honest single/range/free price.
    const locationText = buildLocationText(campground.location, language);
    const priceDisplay = buildCardPriceDisplay(
        campground.priceLow,
        campground.priceHigh,
        formatCurrency,
        t.currency.symbol,
    );

    return (
        // Root is a div so the heart button is NOT inside the Link (AC 11).
        <div className="group relative space-y-3">
            {/* Clickable image+content area navigates to camp detail. */}
            <Link href={`/campgrounds/${slug}`} className="block cursor-pointer">
                <div className="relative aspect-square rounded-3xl overflow-hidden bg-muted">
                    {/* New Listing Badge */}
                    {new Date(campground.createdAt).getTime() > Date.now() - 14 * 24 * 60 * 60 * 1000 && (
                        <div className="absolute top-3 left-3 z-10">
                            <Badge variant="overlay" className="px-2">
                                {t.common.new}
                            </Badge>
                        </div>
                    )}

                    {/*
                      CAM-344: dated-search availability badge — overlay on the image,
                      rendered IFF availabilityStatus is present (undated search,
                      wishlist, and similar-camps reuses of this card never pass the
                      field, BR-7 — the card looks identical to today). Placed
                      bottom-left so it never collides with the top-left "New" badge
                      or the top-right wishlist heart button; presentational only,
                      still inside the Link so the whole card stays one tap target
                      (BR-10). fully-unavailable = destructive (negative), partially-
                      unavailable = warning (caution) — both existing badge.tsx
                      variants, no new variant/token introduced.
                    */}
                    {availabilityStatus && (
                        <div className="absolute bottom-3 left-3 z-10">
                            <Badge
                                variant={availabilityStatus === "FULLY_UNAVAILABLE" ? "destructive" : "warning"}
                                className="px-2"
                                data-testid="badge--availability-status"
                            >
                                {availabilityStatus === "FULLY_UNAVAILABLE"
                                    ? t.catalog.fullyUnavailable
                                    : t.catalog.partiallyUnavailable}
                            </Badge>
                        </div>
                    )}

                    {/* Image Slider */}
                    <div className="relative w-full h-full">
                        <ImageWithFallback
                            src={imageUrls[currentIndex]}
                            alt={campground.images?.length ? name : t.campground.noImageAlt}
                            className="w-full h-full"
                            imgClassName="object-cover group-hover:scale-105 transition duration-500 ease-out"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            priority={priority}
                        />

                        {/* Navigation Arrows (visible on hover) — CAM-272: compact hides them (Discover-only, no chat-side actions). */}
                        {variant !== "compact" && imageUrls.length > 1 && (
                            <>
                                <button
                                    onClick={prevImage}
                                    // CAM-558: tap target grown to the size-11 (44px) icon-button
                                    // floor via a bigger hit area — the glyph itself stays w-4 h-4
                                    // (same convention as this file's own wishlist-heart button and
                                    // AiChatCardCarousel's prev/next arrows).
                                    className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 rounded-full bg-background/80 hover:bg-background shadow-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 z-10"
                                    aria-label={t.gallery.previousImage}
                                >
                                    <ChevronLeft className="w-4 h-4 text-foreground" />
                                </button>
                                <button
                                    onClick={nextImage}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 rounded-full bg-background/80 hover:bg-background shadow-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 z-10"
                                    aria-label={t.gallery.nextImage}
                                >
                                    <ChevronRight className="w-4 h-4 text-foreground" />
                                </button>
                            </>
                        )}

                        {/* Dot Indicators — CAM-272: hidden in compact too (no arrows means no way to navigate between them). */}
                        {variant !== "compact" && imageUrls.length > 1 && (
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
                        {reviewCount > 0 && avgRating != null ? (
                            <div
                                className="flex items-center gap-1 shrink-0"
                                aria-label={t.reviews.ratingAriaLabelShort.replace('{avg}', String(avgRating))}
                                data-testid="rating--card-avg"
                            >
                                <Star className="w-3.5 h-3.5 fill-foreground text-foreground" aria-hidden="true" />
                                <span className="text-sm tabular-nums">{avgRating}</span>
                            </div>
                        ) : (
                            <span
                                className="text-sm text-muted-foreground shrink-0"
                                aria-label={t.reviews.noReviews}
                                data-testid="empty--card-rating"
                            >
                                {t.reviews.noReviews}
                            </span>
                        )}
                    </div>
                    {/*
                      CAM-601 — measured behaviourally at every grid breakpoint
                      (mobile 1-col through 2xl 5-col): the real worst-case
                      string (sub-district+district+province all repeating
                      "เมือง") wraps to 2 visible lines ONLY at the md tier
                      (768-1023px, 3-col grid, ~224px card, the narrowest card
                      in the whole responsive grid) — every other tier
                      happens to fit by a hair (see design.md's measured
                      table). A wrapped row makes that card taller than its
                      grid siblings. `line-clamp-1` matches the exact
                      mechanism CAM-598 used on the assistant card (not
                      `truncate`'s white-space:nowrap+ellipsis — line-clamp
                      lets the line wrap normally then clips at 1 visible
                      line, so scrollWidth never exceeds clientWidth even
                      while clamping, unlike nowrap-ellipsis which reports a
                      wider virtual scrollWidth by design). Plain block
                      element, no flex/icon pairing, so no min-w-0 concern
                      applies (CAM-598 Decision 1: Thai script has no long
                      unbreakable run, so the flex min-content trap never
                      fires here either) — never drops a location level.
                    */}
                    <p className="text-muted-foreground text-sm line-clamp-1" data-testid="text--card-location">{locationText}</p>
                    <div className="flex items-baseline gap-1 pt-1" data-testid="text--card-price">
                        {priceDisplay.isFree ? (
                            <span className="font-semibold">{t.common.free}</span>
                        ) : (
                            <>
                                <span className="font-semibold">{priceDisplay.amountText}</span>
                                <span className="text-muted-foreground">{priceUnitSuffix(t, campground.priceUnit)}</span>
                            </>
                        )}
                    </div>
                </div>
            </Link>

            {/*
              Heart button is a sibling of the Link — absolute-positioned over the image.
              It is NOT inside the Link, so tapping it does NOT navigate (AC 11).
              CAM-272: hidden entirely in the compact variant — Discover-only
              surfaces (the AI chat card) show no wishlist/mutation action.
            */}
            {variant !== "compact" && (
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
                        <Heart className="w-5 h-5 text-primary fill-current" aria-hidden="true" />
                    ) : (
                        <Heart className="w-5 h-5 text-white drop-shadow-sm" aria-hidden="true" />
                    )}
                </button>
            )}
        </div>
    );
}
