"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useLanguage } from "@/contexts/LanguageContext";
import { ImageGallery } from "@/components/ImageGallery";
import { AmenitiesModal } from "@/components/AmenitiesModal";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Edit, Share, Heart, MapPin, Star, ShieldCheck, Tent, Wifi, Car, ShowerHead, Utensils, Zap, Coffee, ShoppingBasket, Store, Waves, Fish, Mountain, Music, Truck, Anchor, HelpCircle, Users, Home, Trash2, Smartphone, CalendarCheck, Droplets, Plug, Wine, Snowflake, Armchair, Umbrella, Layers, Table, Wind, Bath } from "lucide-react";
import { format, differenceInCalendarDays, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { th, enUS } from 'date-fns/locale';

const DynamicMap = dynamic(() => import("@/components/MapComponent"), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-muted animate-pulse rounded-xl" />
});

export default function CampgroundDetailClient({ campground, isOwner = false }: { campground: any, isOwner?: boolean }) {
    const { t, formatCurrency, language } = useLanguage();
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryStartIndex, setGalleryStartIndex] = useState(0);
    const [isAmenitiesOpen, setIsAmenitiesOpen] = useState(false);

    // Changed to Date objects
    const [checkIn, setCheckIn] = useState<Date>();
    const [checkOut, setCheckOut] = useState<Date>();

    const [guests, setGuests] = useState(1);
    const [isReserving, setIsReserving] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [availability, setAvailability] = useState<Record<string, { available: boolean; guests: number; maxGuests: number | null }>>({});
    const [loadingAvailability, setLoadingAvailability] = useState(false);

    // Calculate nights using date-fns
    const nights = (checkIn && checkOut && checkOut > checkIn)
        ? differenceInCalendarDays(checkOut, checkIn)
        : 0;

    const displayNights = nights > 0 ? nights : 0;
    const basePrice = (campground.priceLow || 50) * (displayNights || 1);
    const cleaningFee = 20;
    const serviceFee = 35;
    const totalPrice = basePrice + cleaningFee + serviceFee;

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

    const name = language === 'en' ? (campground.nameEn || campground.nameTh) : campground.nameTh;

    // Parse images from CSV
    const images = campground.images
        ? campground.images.split(',')
        : ["https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&q=80&w=1200"];

    const displayImages = images.slice(0, 5);

    const openGallery = (index: number = 0) => {
        setGalleryStartIndex(index);
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
                            <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 fill-black text-black" />
                                <span className="font-semibold text-foreground">4.8</span>
                                <span>(12 {t.common.reviews})</span>
                            </div>
                            <span className="hidden sm:inline">·</span>
                            <span className="font-semibold text-foreground">{campground.address || `${campground.location.province}, Thailand`}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0">
                        {isOwner && (
                            <Button asChild variant="default" className="gap-2 rounded-full h-12 px-6">
                                <Link href={`/dashboard/campsites/${campground.id}/edit`}>
                                    <Edit className="w-4 h-4" /> <span>{t.newCampground.editCampground}</span>
                                </Link>
                            </Button>
                        )}
                        <Button variant="ghost" className="gap-2 rounded-full h-12 px-4 hover:bg-muted font-medium underline">
                            <Share className="w-4 h-4" /> <span>{t.common.share}</span>
                        </Button>
                        <Button variant="ghost" className="gap-2 rounded-full h-12 px-4 hover:bg-muted font-medium underline">
                            <Heart className="w-4 h-4" /> <span>{t.common.save}</span>
                        </Button>
                    </div>
                </div>

                {/* Hero Grid - Responsive Layout */}
                <div className="relative rounded-[24px] overflow-hidden mb-10 group">
                    {/* Mobile View: Single Hero Image */}
                    <div className="md:hidden h-[300px] w-full relative">
                        <img
                            src={images[0]}
                            alt="hero-mobile"
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => openGallery(0)}
                        />
                        <div className="absolute top-4 right-4 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm">
                            1 / {images.length}
                        </div>
                            <Button
                                variant="secondary"
                                onClick={() => openGallery(0)}
                                className="absolute bottom-4 right-4 h-8 text-xs font-bold rounded-full border border-border shadow-sm bg-background/90 text-foreground hover:bg-background backdrop-blur-md"
                        >
                            {t.newCampground.allPhotos}
                        </Button>
                    </div>

                    {/* Desktop View: Airbnb Style Grid */}
                    <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 h-[480px]">
                        <div className="col-span-2 row-span-2 relative">
                            <img
                                src={images[0]}
                                alt="main"
                                className="w-full h-full object-cover hover:brightness-95 transition cursor-pointer"
                                onClick={() => openGallery(0)}
                            />
                        </div>
                        <div className="col-span-1 row-span-1 relative">
                            <img
                                src={images[1]}
                                alt="sub 1"
                                className="w-full h-full object-cover hover:brightness-95 transition cursor-pointer"
                                onClick={() => openGallery(1)}
                            />
                        </div>
                        <div className="col-span-1 row-span-1 relative">
                            <img
                                src={images[2]}
                                alt="sub 2"
                                className="w-full h-full object-cover hover:brightness-95 transition cursor-pointer"
                                onClick={() => openGallery(2)}
                            />
                        </div>
                        <div className="col-span-1 row-span-1 relative">
                            <img
                                src={images[3]}
                                alt="sub 3"
                                className="w-full h-full object-cover hover:brightness-95 transition cursor-pointer"
                                onClick={() => openGallery(3)}
                            />
                        </div>
                        <div className="col-span-1 row-span-1 relative">
                            <img
                                src={images[4]}
                                alt="sub 4"
                                className="w-full h-full object-cover hover:brightness-95 transition cursor-pointer"
                                onClick={() => openGallery(4)}
                            />
                            <Button
                                variant="secondary"
                                onClick={() => openGallery(0)}
                                className="absolute bottom-4 right-4 gap-2 text-sm font-semibold rounded-full border border-border shadow-sm transition h-9 bg-background/90 text-foreground hover:bg-background backdrop-blur-md"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true" role="presentation" focusable="false" style={{ display: 'block', height: '12px', width: '12px', fill: 'currentcolor' }}><path d="M3 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H3zm0 2h10v3H3V3zm0 5h10v6H3V8z"></path></svg>
                                {t.newCampground.showAllPhotos}
                            </Button>
                        </div>
                    </div>
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
                        {campground.accessTypes && (
                            <div className="pb-8 border-b border-border/60">
                                <h2 className="text-2xl font-bold font-display text-foreground mb-6">{t.campground.access}</h2>
                                <div className="space-y-6">
                                    {campground.accessTypes.split(',').map((access: string) => (
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
                        {campground.terrain && (
                            <div className="pb-8 border-b border-border/60">
                                <h2 className="text-2xl font-bold font-display text-foreground mb-6">{t.campground.siteTypes}</h2>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-4">
                                    {campground.terrain.split(',').map((terrain: string) => (
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
                                        {(campground.facilities ? campground.facilities.split(',') : []).slice(0, 8).map((facility: string) => (
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
                                {campground.externalFacilities && (
                                    <div>
                                        <h3 className="text-xs font-bold text-muted-foreground mb-5 uppercase tracking-widest">{t.campground.externalFacilities}</h3>
                                        <div className="grid grid-cols-1 gap-y-5">
                                            {campground.externalFacilities.split(',').slice(0, 6).map((facility: string) => (
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

                            {(campground.facilities?.split(',').length || 0) > 8 && (
                                <Button
                                    variant="outline"
                                    onClick={() => setIsAmenitiesOpen(true)}
                                    className="mt-8 rounded-lg px-8 h-12 font-bold border-2 border-border hover:border-foreground hover:bg-muted transition text-foreground"
                                >
                                    {t.common.showAll} {campground.facilities?.split(',').length} {t.common.amenities}
                                </Button>
                            )}
                        </div>

                        {/* 5. Equipment for Rent */}
                        {campground.equipment && (
                            <div className="pb-8 border-b border-border/60">
                                <h2 className="text-2xl font-bold font-display text-foreground mb-6">{t.campground.equipmentRent}</h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
                                    {campground.equipment.split(',').map((item: string) => (
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

                    </div>

                    {/* Right Column: Booking Widget */}
                    <div className="md:col-span-1 relative">
                        <div className="sticky top-28 border border-border rounded-[24px] p-6 shadow-xl shadow-muted bg-card">
                            <div className="flex justify-between items-baseline mb-6">
                                <div>
                                    <span className="text-2xl font-bold text-foreground">{formatCurrency(campground.priceLow || 50)} </span>
                                    <span className="text-muted-foreground">{t.common.night}</span>
                                </div>
                                <div className="flex items-center gap-1 text-sm">
                                    <Star className="w-3.5 h-3.5 fill-black" />
                                    <span className="font-semibold">4.8</span>
                                    <span className="text-muted-foreground/60">·</span>
                                    <span className="text-muted-foreground underline">12 {t.common.reviews}</span>
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
                                                    fromDate={new Date()}
                                                    disabled={(date) => {
                                                        if (!!checkOut && date >= checkOut) return true;
                                                        return isDateDisabled(date);
                                                    }}
                                                    initialFocus
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
                                                    fromDate={checkIn || new Date()}
                                                    disabled={(date) => {
                                                        if (!!checkIn && date <= checkIn) return true;
                                                        return isDateDisabled(date);
                                                    }}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-2">{t.booking.guests}</label>
                                    <Select value={guests.toString()} onValueChange={(val) => setGuests(parseInt(val))}>
                                        <SelectTrigger className="h-10 border border-border rounded-full hover:border-foreground transition text-sm font-medium focus:ring-0 w-full">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4 text-muted-foreground" />
                                                <SelectValue />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                                            {[1, 2, 3, 4, 5, 6].map(num => (
                                                <SelectItem key={num} value={num.toString()} className="rounded-xl focus:bg-muted focus:text-foreground cursor-pointer py-2.5">
                                                    {num} {num === 1 ? t.booking.guest : t.search.guests}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <Button
                                onClick={handleReserve}
                                disabled={isReserving}
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-full transition mb-4 text-lg"
                            >
                                {isReserving ? "Reserving..." : t.common.reserve}
                            </Button>

                            <p className="text-center text-xs text-muted-foreground mb-4">{t.booking.notChargedYet}</p>

                            <div className="space-y-3 text-sm text-muted-foreground">
                                <div className="flex justify-between">
                                    <span className="underline">{formatCurrency(campground.priceLow || 50)} x {displayNights} {t.booking.nights}</span>
                                    <span>{formatCurrency(basePrice)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="underline">{t.booking.cleaningFee}</span>
                                    <span>{formatCurrency(cleaningFee)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="underline">{t.booking.serviceFee}</span>
                                    <span>{formatCurrency(serviceFee)}</span>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-border/60 flex justify-between font-bold text-foreground">
                                <span>{t.booking.totalBeforeTaxes}</span>
                                <span>{formatCurrency(totalPrice)}</span>
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
                            className="gap-2 h-10 px-4 rounded-lg font-medium hover:bg-muted text-muted-foreground border-border"
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
                facilities={campground.facilities ? campground.facilities.split(',') : []}
            />
        </>
    );
}
