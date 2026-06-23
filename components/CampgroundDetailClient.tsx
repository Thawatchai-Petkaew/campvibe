"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useLanguage } from "@/contexts/LanguageContext";
import { ImageGallery } from "@/components/ImageGallery";
import { AmenitiesModal } from "@/components/AmenitiesModal";
import { LoginModal } from "@/components/LoginModal";
import { Button } from "@/components/ui/button";
import { wishlistAPI } from "@/lib/api-client";
import { runWishlistToggle } from "@/lib/wishlist-toggle";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Edit, Share, Heart, MapPin, Star, ShieldCheck, Tent, Wifi, Car, ShowerHead, Utensils, Zap, Coffee, ShoppingBasket, Store, Waves, Fish, Mountain, Music, Truck, Anchor, HelpCircle, Users, Home, Trash2, Smartphone, CalendarCheck, Droplets, Plug, Wine, Snowflake, Armchair, Umbrella, Layers, Table, Wind, Bath, Loader2, LayoutGrid } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReviewListItem } from "@/lib/review-summary";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { format, differenceInCalendarDays, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { resolveUnitPrice, computeBookingPrice } from "@/lib/booking-pricing";
import Link from "next/link";
import { th, enUS } from 'date-fns/locale';

const DynamicMap = dynamic(() => import("@/components/MapComponent"), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-muted animate-pulse rounded-xl" />
});

export default function CampgroundDetailClient({
    campground,
    isOwner = false,
    initialSaved = false,
    isLoggedIn = false,
    avgRating = null,
    reviewCount = 0,
    reviews = [],
    reviewsError = false,
}: {
    campground: any;
    isOwner?: boolean;
    /** Server-resolved initial wishlist state (AC-2, BR-3). */
    initialSaved?: boolean;
    /** True when there is an active user session (AC-4, BR-2). */
    isLoggedIn?: boolean;
    /** CAM-79 AC-1/AC-2: average rating rounded to 1dp, or null when no reviews. */
    avgRating?: number | null;
    /** CAM-79 AC-1/AC-2: total review count for this campsite. */
    reviewCount?: number;
    /** CAM-79 AC-3/AC-5: up to 10 newest reviews (client-safe DTOs, no authorId). */
    reviews?: ReviewListItem[];
    /** CAM-79 AC-6: true when the review query threw; rest of page stays usable. */
    reviewsError?: boolean;
}) {
    const { t, formatCurrency, language } = useLanguage();
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryStartIndex, setGalleryStartIndex] = useState(0);
    const [isAmenitiesOpen, setIsAmenitiesOpen] = useState(false);

    // Wishlist toggle state — AC-1, AC-2, AC-3, AC-4, AC-5, BR-1..5.
    const [saved, setSaved] = useState(!!initialSaved);
    const [isWishlistLoading, setIsWishlistLoading] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);

    // Changed to Date objects
    const [checkIn, setCheckIn] = useState<Date>();
    const [checkOut, setCheckOut] = useState<Date>();

    const [guests, setGuests] = useState(1);
    const [isReserving, setIsReserving] = useState(false);
    const [hasAttemptedReserve, setHasAttemptedReserve] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [availability, setAvailability] = useState<Record<string, { available: boolean; guests: number; maxGuests: number | null }>>({});
    const [loadingAvailability, setLoadingAvailability] = useState(false);

    // Calculate nights using date-fns
    const nights = (checkIn && checkOut && checkOut > checkIn)
        ? differenceInCalendarDays(checkOut, checkIn)
        : 0;

    const displayNights = nights > 0 ? nights : 0;
    // CAM-58: use the shared pricing module so displayed total matches what the API records.
    // No spot-selection state in this component — spotPricePerNight is null (uses priceLow).
    const unitPrice = resolveUnitPrice({
        campSitePriceLow: campground.priceLow != null ? Number(campground.priceLow) : null,
        spotPricePerNight: null,
    });
    const { totalAmount, subtotalAmount } = computeBookingPrice({
        unitPrice,
        nights: displayNights || 1,
        vatRate: 0,
    });

    // Fetch availability data
    useEffect(() => {
        const fetchAvailability = async () => {
            if (!campground.id) return;
            
            setLoadingAvailability(true);
            try {
                const start = startOfMonth(new Date());
                const end = endOfMonth(addMonths(new Date(), 3)); // Next 3 months
                
                const response = await fetch(
                    `/api/campsites/${campground.id}/availability?startDate=${start.toISOString()}&endDate=${end.toISOString()}`
                );
                
                const payload = await response.json().catch(() => null);

                if (!response.ok) {
                    console.error("Availability API error:", {
                        status: response.status,
                        statusText: response.statusText,
                        payload,
                    });
                    setAvailability({});
                    return;
                }

                // API returns: { campSiteId, availability: [...] }
                const list = payload?.availability || payload?.data?.availability || [];
                const availabilityMap: Record<string, { available: boolean; guests: number; maxGuests: number | null }> = {};

                if (Array.isArray(list)) {
                    list.forEach((item: any) => {
                        const guests = item?.bookedGuests ?? item?.guests ?? 0;
                        availabilityMap[item.date] = {
                            available: !!item.available,
                            guests,
                            maxGuests: item?.maxGuests ?? null,
                        };
                    });
                }

                setAvailability(availabilityMap);
            } catch (error) {
                console.error('Failed to fetch availability:', error);
            } finally {
                setLoadingAvailability(false);
            }
        };

        fetchAvailability();
    }, [campground.id]);

    // Check if date is disabled (full or past)
    const isDateDisabled = (date: Date) => {
        const dateKey = format(date, 'yyyy-MM-dd');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Disable past dates
        if (date < today) return true;
        
        // Disable full dates
        const dayAvailability = availability[dateKey];
        if (dayAvailability && !dayAvailability.available) {
            return true;
        }
        
        return false;
    };

    const handleReserve = async () => {
        if (!checkIn || !checkOut) {
            setHasAttemptedReserve(true);
            import("sonner").then(({ toast }) => toast.error(t.newCampground.pleaseSelectDates));
            return;
        }

        setIsReserving(true);
        try {
            const res = await fetch("/api/bookings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    campSiteId: campground.id,
                    checkInDate: format(checkIn, 'yyyy-MM-dd'),
                    checkOutDate: format(checkOut, 'yyyy-MM-dd'),
                    guests
                })
            });

            const data = await res.json();
            const { toast } = await import("sonner");

            if (res.ok) {
                toast.success(t.newCampground.bookingReservedSuccess);
                // Optionally redirect to /bookings
                setTimeout(() => window.location.href = "/bookings", 1500);
            } else {
                toast.error(data.error || t.newCampground.failedToReserve);
            }
        } catch (error) {
            console.error(error);
            const { toast } = await import("sonner");
            toast.error(t.newCampground.errorOccurred);
        } finally {
            setIsReserving(false);
        }
    };

    // AC-1/AC-3/AC-4/AC-5, BR-1/BR-2/BR-4/BR-5 — optimistic toggle with rollback.
    // Decision logic lives in lib/wishlist-toggle.ts (runWishlistToggle); React
    // state / sonner wiring stays here.
    const handleWishlistToggle = useCallback(async () => {
        setIsWishlistLoading(true);

        const result = await runWishlistToggle({
            isLoggedIn,
            savedBefore: saved,
            isLoading: isWishlistLoading,
            campSiteId: campground.id,
            api: wishlistAPI,
            strings: {
                toastSaved: t.wishlist.toastSaved,
                toastRemoved: t.wishlist.toastRemoved,
                toastErrorSave: t.wishlist.toastErrorSave,
                toastErrorRemove: t.wishlist.toastErrorRemove,
            },
        });

        // Apply the outcomes to React state.
        setSaved(result.saved);
        if (result.loginModalOpened) setLoginOpen(true);

        if (result.toastKey) {
            const { toast } = await import("sonner");
            const isError = result.toastKey === t.wishlist.toastErrorSave
                || result.toastKey === t.wishlist.toastErrorRemove;
            if (isError) {
                toast.error(result.toastKey);
            } else {
                toast.success(result.toastKey);
            }
        }

        setIsWishlistLoading(false);
    }, [isLoggedIn, isWishlistLoading, saved, campground.id, t]);

    // BR-5: dynamic aria-label per state.
    const wishlistAriaLabel = isWishlistLoading
        ? t.wishlist.heartAriaLabelLoading
        : saved
            ? t.wishlist.heartAriaLabelRemove
            : t.wishlist.heartAriaLabelSave;

    const name = language === 'en' ? (campground.nameEn || campground.nameTh) : campground.nameTh;

    // S4a: taxonomy now lives in the `options` MasterData relation; derive per-group code lists.
    const _options: { code: string; group: string }[] = campground.options || [];
    const codesByGroup = (g: string) => _options.filter((o) => o.group === g).map((o) => o.code);
    const accessCodes = codesByGroup('Access type');
    const terrainCodes = codesByGroup('Terrain');
    const facilityCodes = codesByGroup('Internal facility');
    const externalCodes = codesByGroup('External facility');
    const equipmentCodes = codesByGroup('Equipment for rent');

    // Parse images from CSV
    const images: string[] = campground.images?.length
        ? campground.images.map((img: { url: string }) => img.url)
        : ["https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&q=80&w=1200"];

    const displayImages = images.slice(0, 5);

    const openGallery = (index: number = 0) => {
        if (images.length === 0) return;
        const safe = Math.min(Math.max(index, 0), images.length - 1);
        setGalleryStartIndex(safe);
        setIsGalleryOpen(true);
    };

    // Helper to format displayed dates based on locale
    const formatDateDisplay = (date: Date | undefined) => {
        if (!date) return <span className="text-muted-foreground">{t.common.pickDate || "Pick a date"}</span>;
        return <span className="truncate">{format(date, "dd MMM yyyy", { locale: language === 'th' ? th : enUS })}</span>;
    };

    // Facility Icon Mapping
    const facilityIconMap: Record<string, any> = {
        'WIFI': Wifi,
        'ELEC': Zap,
        'TOIL': Bath, // Or customized icon
        'SHOW': ShowerHead,
        'CAFE': Coffee,
        'REST': Utensils,
        'CART': ShoppingBasket,
        'LOTS': Store,
        'MIBC': Store,
        'MAKT': Store,
        '711': Store,
        'BOAT': Anchor,
        'FISH': Fish,
        'SWIM': Waves,
        'HIKG': Mountain,
        'HIKE': Mountain,
        'LIVE': Music,
        'OFFR': Truck,
        'RV': Car,
        // Access
        'DRIV': Car,
        'WALK': Mountain,
        'BAOT': Anchor,
        // Terrain / Site Types
        'FOREST': Mountain,
        'FORE': Mountain, // Forest
        'LAKE': Waves,
        'MOUNTAIN': Mountain,
        'MOUN': Mountain,
        'BEACH': Waves,
        'BEAC': Waves,
        'RIVE': Waves, // Riverside
        // Facilities
        'FEDW': Droplets,
        'FEIC': Snowflake,
        'GRIL': Utensils, // Grill icon would be better if available
        'SANI': Trash2,
        'SHTR': ShieldCheck,
        'SINK': Droplets,
        'TRAS': Trash2,
        'WATE': Droplets,
        'MIMT': Store,
        'PICN': Table,
        'SVEL': Store,
        // Equipment / Extras
        'TENT': Tent,
        'MATT': Layers,
        'CHAI': Armchair,
        'FYST': Umbrella,
        'ICBK': Snowflake,
        'LEDL': Zap,
        'STOV': Utensils,
        'BLANKET': Home,
        'BLKT': Home,
        'GDST': Layers,
        'LSTV': Utensils,
        'SSTV': Utensils,
        'POWE': Zap,
        'TFAN': Wind, // Wind for fan
        // Fallbacks
        'default': ShieldCheck
    };

    const getIcon = (code: string) => {
        const IconComponent = facilityIconMap[code] || facilityIconMap['default'];
        return <IconComponent className="w-8 h-8 text-muted-foreground stroke-[1.2]" />;
    };

    const getAccessDescription = (code: string) => {
        const descMap: Record<string, string> = {
            'DRIV': t.campground.driveInDesc || "Park next to your site",
            'WALK': t.campground.walkInDesc || "Park and walk to your site",
            'BOAT': t.campground.boatAccessDesc || "Accessible by boat only",
            'RV': t.campground.rvAccessDesc || "RV accessible site"
        };
        return descMap[code] || "";
    };

    return (
        <>
            <div className="container mx-auto px-6 pt-6">
                {/* Header - Title & Actions */}
                <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4 md:gap-0">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground mb-2">
                            {name}
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground underline cursor-pointer">
                            {/* CAM-79 AC-1/AC-2: real rating or empty state */}
                            <div
                                data-testid="rating--detail-title"
                                className="flex items-center gap-1"
                                aria-label={
                                    reviewCount > 0 && avgRating !== null
                                        ? t.reviews.ratingAriaLabel
                                            .replace('{avg}', String(avgRating))
                                            .replace('{count}', String(reviewCount))
                                        : t.reviews.noReviews
                                }
                            >
                                {reviewCount > 0 && avgRating !== null ? (
                                    <>
                                        <Star className="w-4 h-4 fill-foreground text-foreground" aria-hidden="true" />
                                        <span className="font-semibold text-foreground tabular-nums">{avgRating}</span>
                                        <span className="text-muted-foreground">({reviewCount} {t.common.reviews})</span>
                                    </>
                                ) : (
                                    <span className="text-muted-foreground">{t.reviews.noReviews}</span>
                                )}
                            </div>
                            <span className="hidden sm:inline">·</span>
                            <span className="font-semibold text-foreground">{campground.address || `${campground.location.province}, Thailand`}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0">
                        {isOwner && (
                            <Button asChild variant="default" size="lg" className="gap-2 px-6">
                                <Link href={`/dashboard/campsites/${campground.id}/edit`}>
                                    <Edit className="w-4 h-4" /> <span>{t.newCampground.editCampground}</span>
                                </Link>
                            </Button>
                        )}
                        <Button variant="ghost" className="gap-2 px-4 hover:bg-muted font-medium underline">
                            <Share className="w-4 h-4" /> <span>{t.common.share}</span>
                        </Button>
                        {/* AC-1..5, BR-1..5: wishlist toggle — mirrors CampgroundCard pattern. */}
                        <Button
                            data-testid="btn--wishlist-detail-toggle"
                            variant="ghost"
                            aria-pressed={saved}
                            aria-label={wishlistAriaLabel}
                            disabled={isWishlistLoading}
                            onClick={handleWishlistToggle}
                            className="gap-2 px-4 hover:bg-muted font-medium underline"
                        >
                            <Heart
                                className={cn("w-4 h-4", saved && "fill-current text-primary")}
                                aria-hidden="true"
                            />
                            <span>{saved ? t.wishlist.savedLabel : t.common.save}</span>
                        </Button>
                    </div>
                </div>

                {/* Hero Grid - Responsive Layout */}
                <div className="relative rounded-3xl overflow-hidden mb-10 group">
                    {/* Mobile View: Single Hero Image */}
                    <div className="md:hidden h-[300px] w-full relative">
                        <ImageWithFallback
                            src={images[0]}
                            alt={name}
                            className="w-full h-full cursor-pointer"
                            imgClassName="object-cover"
                            onClick={() => openGallery(0)}
                        />
                        <div className="absolute top-4 right-4 bg-foreground/60 text-background text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm">
                            {t.gallery.imageOf.replace("{n}", "1").replace("{total}", String(images.length))}
                        </div>
                        <Button
                            variant="secondary"
                            onClick={() => openGallery(0)}
                            className="absolute bottom-4 right-4 h-11 text-xs font-bold rounded-full border border-border shadow-sm bg-background/90 text-foreground hover:bg-background backdrop-blur-md"
                        >
                            {t.gallery.openGallery}
                        </Button>
                    </div>

                    {/* Desktop View: Adaptive Grid (1/2/3/4/5+) */}
                    {images.length === 1 && (
                        <div className="hidden md:block h-[480px]">
                            <button
                                type="button"
                                className="w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={t.gallery.viewImage.replace("{n}", "1")}
                                onClick={() => openGallery(0)}
                            >
                                <ImageWithFallback
                                    src={images[0]}
                                    alt={name}
                                    className="w-full h-full"
                                    imgClassName="object-cover hover:brightness-95 transition duration-200"
                                />
                            </button>
                        </div>
                    )}
                    {images.length === 2 && (
                        <div className="hidden md:grid grid-cols-2 gap-2 h-[480px]">
                            {images.slice(0, 2).map((src, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    className="relative focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    aria-label={t.gallery.viewImage.replace("{n}", String(i + 1))}
                                    onClick={() => openGallery(i)}
                                >
                                    <ImageWithFallback
                                        src={src}
                                        alt={i === 0 ? name : ""}
                                        className="w-full h-full"
                                        imgClassName="object-cover hover:brightness-95 transition duration-200"
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                    {images.length === 3 && (
                        <div className="hidden md:grid grid-cols-3 gap-2 h-[480px]">
                            <button
                                type="button"
                                className="col-span-2 relative focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={t.gallery.viewImage.replace("{n}", "1")}
                                onClick={() => openGallery(0)}
                            >
                                <ImageWithFallback
                                    src={images[0]}
                                    alt={name}
                                    className="w-full h-full"
                                    imgClassName="object-cover hover:brightness-95 transition duration-200"
                                />
                            </button>
                            {images.slice(1, 3).map((src, i) => (
                                <button
                                    key={i + 1}
                                    type="button"
                                    className="relative focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    aria-label={t.gallery.viewImage.replace("{n}", String(i + 2))}
                                    onClick={() => openGallery(i + 1)}
                                >
                                    <ImageWithFallback
                                        src={src}
                                        alt=""
                                        className="w-full h-full"
                                        imgClassName="object-cover hover:brightness-95 transition duration-200"
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                    {images.length === 4 && (
                        <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 h-[480px]">
                            <button
                                type="button"
                                className="col-span-2 row-span-2 relative focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={t.gallery.viewImage.replace("{n}", "1")}
                                onClick={() => openGallery(0)}
                            >
                                <ImageWithFallback
                                    src={images[0]}
                                    alt={name}
                                    className="w-full h-full"
                                    imgClassName="object-cover hover:brightness-95 transition duration-200"
                                />
                            </button>
                            <button
                                type="button"
                                className="relative focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={t.gallery.viewImage.replace("{n}", "2")}
                                onClick={() => openGallery(1)}
                            >
                                <ImageWithFallback
                                    src={images[1]}
                                    alt=""
                                    className="w-full h-full"
                                    imgClassName="object-cover hover:brightness-95 transition duration-200"
                                />
                            </button>
                            <button
                                type="button"
                                className="relative focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={t.gallery.viewImage.replace("{n}", "3")}
                                onClick={() => openGallery(2)}
                            >
                                <ImageWithFallback
                                    src={images[2]}
                                    alt=""
                                    className="w-full h-full"
                                    imgClassName="object-cover hover:brightness-95 transition duration-200"
                                />
                            </button>
                            <button
                                type="button"
                                className="col-span-2 relative focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={t.gallery.viewImage.replace("{n}", "4")}
                                onClick={() => openGallery(3)}
                            >
                                <ImageWithFallback
                                    src={images[3]}
                                    alt=""
                                    className="w-full h-full"
                                    imgClassName="object-cover hover:brightness-95 transition duration-200"
                                />
                            </button>
                        </div>
                    )}
                    {images.length >= 5 && (
                        <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 h-[480px]">
                            <button
                                type="button"
                                className="col-span-2 row-span-2 relative focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={t.gallery.viewImage.replace("{n}", "1")}
                                onClick={() => openGallery(0)}
                            >
                                <ImageWithFallback
                                    src={images[0]}
                                    alt={name}
                                    className="w-full h-full"
                                    imgClassName="object-cover hover:brightness-95 transition duration-200"
                                />
                            </button>
                            {images.slice(1, 4).map((src, i) => (
                                <button
                                    key={i + 1}
                                    type="button"
                                    className="relative focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    aria-label={t.gallery.viewImage.replace("{n}", String(i + 2))}
                                    onClick={() => openGallery(i + 1)}
                                >
                                    <ImageWithFallback
                                        src={src}
                                        alt=""
                                        className="w-full h-full"
                                        imgClassName="object-cover hover:brightness-95 transition duration-200"
                                    />
                                </button>
                            ))}
                            <button
                                type="button"
                                className="relative focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={t.gallery.viewImage.replace("{n}", "5")}
                                onClick={() => openGallery(4)}
                            >
                                <ImageWithFallback
                                    src={images[4]}
                                    alt=""
                                    className="w-full h-full"
                                    imgClassName="object-cover hover:brightness-95 transition duration-200"
                                />
                                {images.length > 5 && (
                                    <div className="absolute bottom-4 right-4">
                                        <Button
                                            variant="secondary"
                                            onClick={(e) => { e.stopPropagation(); openGallery(0); }}
                                            className="gap-2 text-sm font-semibold rounded-full border border-border shadow-sm transition h-11 bg-background/90 text-foreground hover:bg-background backdrop-blur-md"
                                        >
                                            <LayoutGrid className="w-4 h-4" aria-hidden="true" />
                                            {t.newCampground.showAllPhotos}
                                        </Button>
                                    </div>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Content Layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">

                    {/* Left Column: Details */}
                    <div className="md:col-span-2 space-y-8">

                        {/* 1. About the mountains (Description) */}
                        <div className="pb-8 border-b border-border/60">
                            {/* Host Info - Keeping distinct but subtle above description */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 border border-border/60 bg-muted">
                                    {(campground.operator.image && !imageError) ? (
                                        <img
                                            src={campground.operator.image}
                                            alt={campground.operator.name || 'Owner'}
                                            className="w-full h-full object-cover"
                                            onError={() => setImageError(true)}
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-xl">
                                            {campground.operator.name?.[0] || 'O'}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-foreground leading-tight">{t.campground.hostedBy} {campground.operator.name || 'Owner'}</h2>
                                    <p className="text-sm font-medium text-muted-foreground">
                                        {t.campground.joined} {new Date(campground.operator.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>

                            <h2 className="text-2xl font-bold font-display text-foreground mb-4">{t.campground.aboutPlace}</h2>
                            <p className="leading-relaxed text-base whitespace-pre-line text-foreground/80">
                                {campground.description || `${t.campground.aboutPlace} ${name}. ${t.campground.verifiedDesc}`}
                            </p>
                        </div>

                        {/* 2. Access */}
                        {accessCodes.length > 0 && (
                            <div className="pb-8 border-b border-border/60">
                                <h2 className="text-2xl font-bold font-display text-foreground mb-6">{t.campground.access}</h2>
                                <div className="space-y-6">
                                    {accessCodes.map((access: string) => (
                                        <div key={access} className="flex items-start gap-5">
                                            <div className="mt-1">
                                                {getIcon(access)}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-foreground mb-1">
                                                    {(t.filter as any)[access] || access}
                                                </h3>
                                                <p className="text-muted-foreground">
                                                    {getAccessDescription(access)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 3. Site Types */}
                        {terrainCodes.length > 0 && (
                            <div className="pb-8 border-b border-border/60">
                                <h2 className="text-2xl font-bold font-display text-foreground mb-6">{t.campground.siteTypes}</h2>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-4">
                                    {terrainCodes.map((terrain: string) => (
                                        <div key={terrain} className="flex flex-col items-start gap-3">
                                            {getIcon(terrain)}
                                            <span className="font-medium text-foreground capitalize text-base">
                                                {t.filter[terrain as keyof typeof t.filter] || terrain}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 4. What this place offers (Features) */}
                        <div className="pb-8 border-b border-border/60">
                            <h2 className="text-2xl font-bold font-display text-foreground mb-6">{t.campground.whatOffers}</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                                {/* Internal */}
                                <div>
                                    <h3 className="text-xs font-bold text-muted-foreground mb-5 uppercase tracking-widest">{t.campground.internalFacilities}</h3>
                                    <div className="grid grid-cols-1 gap-y-5">
                                        {facilityCodes.slice(0, 8).map((facility: string) => (
                                            <div key={facility} className="flex items-center gap-4">
                                                {getIcon(facility)}
                                                <span className="font-normal text-base capitalize text-foreground/80">
                                                    {t.filter[facility as keyof typeof t.filter] || facility}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* External */}
                                {externalCodes.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-bold text-muted-foreground mb-5 uppercase tracking-widest">{t.campground.externalFacilities}</h3>
                                        <div className="grid grid-cols-1 gap-y-5">
                                            {externalCodes.slice(0, 6).map((facility: string) => (
                                                <div key={facility} className="flex items-center gap-4">
                                                    {getIcon(facility)}
                                                    <span className="font-normal text-base capitalize text-foreground/80">
                                                        {t.filter[facility as keyof typeof t.filter] || facility}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {facilityCodes.length > 8 && (
                                <Button
                                    variant="outline"
                                    onClick={() => setIsAmenitiesOpen(true)}
                                    className="mt-8 px-8 font-bold border-2 border-border hover:border-foreground hover:bg-muted transition text-foreground"
                                >
                                    {t.common.showAll} {facilityCodes.length} {t.common.amenities}
                                </Button>
                            )}
                        </div>

                        {/* 5. Equipment for Rent */}
                        {equipmentCodes.length > 0 && (
                            <div className="pb-8 border-b border-border/60">
                                <h2 className="text-2xl font-bold font-display text-foreground mb-6">{t.campground.equipmentRent}</h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
                                    {equipmentCodes.map((item: string) => (
                                        <div key={item} className="flex items-center gap-4">
                                            {getIcon(item)}
                                            <span className="font-normal text-base capitalize text-foreground/80">
                                                {t.filter[item as keyof typeof t.filter] || item}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* CAM-79 AC-3/AC-4/AC-5/AC-6: Review section */}
                        <div
                            className="pb-8 border-b border-border/60"
                            data-testid="section--reviews"
                        >
                            <h2 className="text-2xl font-bold font-display text-foreground mb-6">
                                {t.reviews.sectionHeading}
                            </h2>

                            {reviewsError ? (
                                // AC-6: isolated error — rest of page stays usable
                                <p
                                    className="text-muted-foreground text-sm"
                                    data-testid="error--reviews"
                                >
                                    {t.reviews.loadError}
                                </p>
                            ) : reviewCount === 0 ? (
                                // AC-4: empty state
                                <p
                                    className="text-muted-foreground text-sm"
                                    data-testid="empty--reviews"
                                >
                                    {t.reviews.noReviewsSection}
                                </p>
                            ) : (
                                // AC-3/AC-5: has reviews
                                <>
                                    <ul className="space-y-6" data-testid="list--reviews">
                                        {reviews.map((review, index) => {
                                            const reviewDate = typeof review.createdAt === 'string'
                                                ? new Date(review.createdAt)
                                                : review.createdAt;
                                            const formattedDate = format(
                                                reviewDate,
                                                'd MMM yyyy',
                                                { locale: language === 'th' ? th : enUS }
                                            );
                                            return (
                                                <li
                                                    key={index}
                                                    className="py-4 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors rounded-sm -mx-1 px-1"
                                                    data-testid={`item--review-${index}`}
                                                >
                                                    <p className="font-semibold text-foreground text-sm mb-1">
                                                        {review.name}
                                                    </p>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div
                                                            role="img"
                                                            aria-label={t.reviews.itemRatingAriaLabel.replace('{rating}', String(review.rating))}
                                                            className="flex items-center gap-0.5"
                                                        >
                                                            {Array.from({ length: 5 }, (_, i) => (
                                                                <Star
                                                                    key={i}
                                                                    className={cn(
                                                                        "w-3.5 h-3.5",
                                                                        i < review.rating
                                                                            ? "fill-foreground text-foreground"
                                                                            : "text-muted-foreground"
                                                                    )}
                                                                    aria-hidden="true"
                                                                />
                                                            ))}
                                                        </div>
                                                        <span className="text-sm text-muted-foreground tabular-nums">
                                                            {formattedDate}
                                                        </span>
                                                    </div>
                                                    {review.content && review.content.trim().length > 0 && (
                                                        <p className="text-sm text-foreground leading-relaxed mt-1">
                                                            {review.content}
                                                        </p>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    {/* AC-5: "ดูรีวิวทั้งหมด" placeholder — shown when reviewCount > 10 */}
                                    {reviewCount > 10 && (
                                        <div className="flex justify-center mt-4">
                                            <Button
                                                variant="outline"
                                                size="default"
                                                disabled
                                                aria-disabled="true"
                                                aria-label={t.reviews.viewAllAriaLabel}
                                                data-testid="btn--reviews-view-all"
                                            >
                                                {t.reviews.viewAll}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                    </div>

                    {/* Right Column: Booking Widget */}
                    <div className="md:col-span-1 relative">
                        <div className="sticky top-28 border border-border rounded-3xl p-6 shadow-lg shadow-foreground/5 bg-card">
                            <div className="flex justify-between items-baseline mb-6">
                                <div>
                                    <span className="text-2xl font-bold text-foreground">{formatCurrency(campground.priceLow || 50)} </span>
                                    <span className="text-muted-foreground">{t.common.night}</span>
                                </div>
                                {/* CAM-79 AC-1/AC-2: real rating in booking widget */}
                                <div
                                    data-testid="rating--detail-widget"
                                    className="flex items-center gap-1 text-sm"
                                    aria-label={
                                        reviewCount > 0 && avgRating !== null
                                            ? t.reviews.ratingAriaLabel
                                                .replace('{avg}', String(avgRating))
                                                .replace('{count}', String(reviewCount))
                                            : t.reviews.noReviews
                                    }
                                >
                                    {reviewCount > 0 && avgRating !== null ? (
                                        <>
                                            <Star className="w-3.5 h-3.5 fill-foreground text-foreground" aria-hidden="true" />
                                            <span className="font-semibold tabular-nums">{avgRating}</span>
                                            <span className="text-muted-foreground/60">·</span>
                                            <span className="text-muted-foreground underline tabular-nums">{reviewCount} {t.common.reviews}</span>
                                        </>
                                    ) : (
                                        <span className="text-muted-foreground">{t.reviews.noReviews}</span>
                                    )}
                                </div>
                            </div>

                            <div className="border border-border rounded-xl overflow-hidden mb-4 bg-background">
                                <div className="flex border-b border-border/60">
                                    <div className="w-1/2 p-3 border-r border-border/60">
                                        <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">{t.booking.checkIn}</label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal p-0 h-auto hover:bg-transparent",
                                                        !checkIn && "text-muted-foreground"
                                                    )}
                                                >
                                                    {formatDateDisplay(checkIn)}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={checkIn}
                                                    onSelect={setCheckIn}
                                                    disabled={(date) => {
                                                        if (!!checkOut && date >= checkOut) return true;
                                                        return isDateDisabled(date);
                                                    }}
                                                    autoFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="w-1/2 p-3">
                                        <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">{t.booking.checkOut}</label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal p-0 h-auto hover:bg-transparent",
                                                        !checkOut && "text-muted-foreground"
                                                    )}
                                                >
                                                    {formatDateDisplay(checkOut)}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={checkOut}
                                                    onSelect={setCheckOut}
                                                    disabled={(date) => {
                                                        if (!!checkIn && date <= checkIn) return true;
                                                        return isDateDisabled(date);
                                                    }}
                                                    autoFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-2">{t.booking.guests}</label>
                                    <Select value={guests.toString()} onValueChange={(val) => setGuests(parseInt(val))}>
                                        <SelectTrigger className="w-full border border-border hover:border-foreground transition">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4 text-muted-foreground" />
                                                <SelectValue />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="shadow-2xl">
                                            {[1, 2, 3, 4, 5, 6].map(num => (
                                                <SelectItem key={num} value={num.toString()} className="cursor-pointer">
                                                    {num} {num === 1 ? t.booking.guest : t.search.guests}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <Button
                                onClick={handleReserve}
                                size="lg"
                                disabled={isReserving}
                                aria-busy={isReserving}
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition mb-2 text-lg"
                            >
                                {isReserving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        {t.newCampground.reserving}
                                    </>
                                ) : t.common.reserve}
                            </Button>

                            {hasAttemptedReserve && (!checkIn || !checkOut) && (
                                <p className="text-destructive text-xs text-center mb-2">
                                    {t.booking.selectDatesFirst}
                                </p>
                            )}

                            <p className="text-center text-xs text-muted-foreground mb-4">{t.booking.notChargedYet}</p>

                            <div className="space-y-3 text-sm text-muted-foreground">
                                <div className="flex justify-between" data-testid="row--booking-room-subtotal">
                                    <span className="underline">{formatCurrency(unitPrice)} x {displayNights} {t.booking.nights}</span>
                                    <span>{formatCurrency(subtotalAmount)}</span>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-border/60 flex justify-between font-bold text-foreground" data-testid="row--booking-total">
                                <span>{t.booking.total}</span>
                                <span>{formatCurrency(totalAmount)}</span>
                            </div>


                        </div>

                        {/* Operations & Info Card */}
                        <div className="mt-6 bg-card rounded-2xl border border-border p-6 space-y-4 shadow-sm">
                            <h3 className="font-bold text-lg text-foreground">{t.campground.goodToKnow || "good to know"}</h3>

                            <div className="space-y-4 text-sm">
                                <div className="flex justify-between items-center py-2 border-b border-border/60">
                                    <span className="text-muted-foreground">{t.campground.checkInOut || "Check-in / Out"}</span>
                                    <span className="font-medium text-foreground">
                                        {campground.checkInTime || "14:00"} - {campground.checkOutTime || "11:00"}
                                    </span>
                                </div>

                                {campground.minimumAge !== undefined && campground.minimumAge > 0 && (
                                    <div className="flex justify-between items-center py-2 border-b border-border/60">
                                        <span className="text-muted-foreground">{t.campground.minimumAge || "Minimum Age"}</span>
                                        <span className="font-medium text-foreground">{campground.minimumAge}+ Years</span>
                                    </div>
                                )}

                                {(campground.feeInfo || campground.priceLow !== null) && (
                                    <div className="py-2 border-b border-border/60">
                                        <span className="block text-muted-foreground mb-1">{t.campground.fees || "Fees"}</span>
                                        <span className="font-medium text-foreground">
                                            {campground.feeInfo || `Entry fees may apply (starts at ${formatCurrency(campground.priceLow || 0)})`}
                                        </span>
                                    </div>
                                )}

                                {campground.toiletInfo && (
                                    <div className="py-2 border-b border-border/60">
                                        <span className="block text-muted-foreground mb-1">{t.campground.restrooms || "Restrooms"}</span>
                                        <span className="font-medium text-foreground">{campground.toiletInfo}</span>
                                    </div>
                                )}

                                {campground.contacts && (
                                    <div className="py-2">
                                        <span className="block text-muted-foreground mb-1">{t.campground.contacts || "Contacts"}</span>
                                        <span className="font-medium text-foreground">{campground.contacts}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>

                {/* Map Section */}
                <div className="py-12 border-t border-border/60 mt-10">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold font-display">{t.campground.whereYouBe}</h2>
                        <Button
                            variant="outline"
                            className="gap-2 px-4 font-medium hover:bg-muted text-muted-foreground border-border"
                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${campground.latitude},${campground.longitude}`, '_blank')}
                        >
                            <MapPin className="w-4 h-4" />
                            {t.newCampground.getDirections}
                        </Button>
                    </div>

                    {(campground.address || campground.directions) && (
                        <p className="text-muted-foreground mb-6 max-w-3xl leading-relaxed">
                            {campground.address && <span className="block mb-2 font-medium text-foreground">{campground.address}</span>}
                            {campground.directions}
                        </p>
                    )}
                    <div className="flex gap-2 mb-6 text-muted-foreground">
                        <MapPin className="w-5 h-5 text-foreground" />
                        <span>{campground.location.province}, Thailand</span>
                    </div>
                    <div className="w-full h-[320px] md:h-[480px]">
                        <DynamicMap
                            latitude={campground.latitude}
                            longitude={campground.longitude}
                            campground={campground}
                        />
                    </div>
                </div>

            </div>

            {/* Image Gallery Modal */}
            <ImageGallery
                images={images}
                isOpen={isGalleryOpen}
                onClose={() => setIsGalleryOpen(false)}
                initialIndex={galleryStartIndex}
            />

            {/* Amenities Modal */}
            <AmenitiesModal
                isOpen={isAmenitiesOpen}
                onClose={() => setIsAmenitiesOpen(false)}
                facilities={facilityCodes}
            />

            {/* AC-4, BR-2: LoginModal for guest wishlist tap. */}
            <LoginModal
                isOpen={loginOpen}
                onClose={() => setLoginOpen(false)}
                subtitle={t.wishlist.loginPromptGuest}
            />
        </>
    );
}
