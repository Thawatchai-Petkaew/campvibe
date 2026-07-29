"use client";

import { useState, useEffect, useCallback, useRef, Suspense, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { ImageGallery } from "@/components/ImageGallery";
import { AmenitiesModal } from "@/components/AmenitiesModal";
import { LoginModal } from "@/components/LoginModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { wishlistAPI } from "@/lib/api-client";
import { runWishlistToggle } from "@/lib/wishlist-toggle";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Edit, Share, Heart, MapPin, Star, HelpCircle, Users, Smartphone, Plug, Loader2, LayoutGrid, MoveHorizontal, PawPrint, AlertCircle, RotateCcw } from "lucide-react";
import { getFacilityIcon } from "@/lib/facility-icon-map";
import { OptionGroupSection } from "@/components/ui/option-group-section";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ReviewsListSkeleton } from "@/components/ui/reviews-list-skeleton";
import type { ReviewListItem } from "@/lib/review-summary";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { format, parseISO, differenceInCalendarDays, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { buildBookingPriceArgs, computeBookingPrice, type PricingUnit } from "@/lib/booking-pricing";
import { priceUnitWord } from "@/lib/price-unit-display";
import { resolveCancellationPolicyCopy } from "@/lib/cancellation-policy";
import { computeGuestCeiling, buildGuestOptions, clampGuestsToInitialCeiling } from "@/lib/guest-capacity";
import type { BookingPrefill } from "@/lib/booking-prefill";
// CAM-548: reuse the CAM-545 seam verbatim — same localized "district, province"
// text builder the camp card already uses (never a second implementation).
import { buildLocationText } from "@/components/CampgroundCard";
// CAM-526 (S10): accommodationTypes is a scalar CSV string column (NOT part of
// the `options` MasterData relation) — parse it with the existing shared
// helper, never hand-split the string.
import { csvToArray } from "@/lib/api-utils";
import Link from "next/link";
import { th, enUS } from 'date-fns/locale';

/** CAM-394: the review-list findMany, streamed unawaited from the server page.
 *  Never rejects — resolves ok:false so a review error stays isolated (AC-6). */
export type ReviewsListResult =
    | { ok: true; reviews: ReviewListItem[] }
    | { ok: false };

const DynamicMap = dynamic(() => import("@/components/MapComponent"), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-muted animate-pulse rounded-xl" />
});

// CAM-354 BR-3: the module-load fallback for the panorama viewer — shown the
// instant a PANORAMA thumbnail is tapped, while the viewer's own chunk
// downloads (loading.md: "isolated module/widget -> spinner, shown
// immediately"). A real component (not a plain arrow function) so it can call
// useLanguage() for the i18n label; the `dynamic()` call below stays a stable
// module-scope reference (never re-created on render).
function PanoramaModuleLoading() {
    const { t } = useLanguage();
    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
            data-testid="status--panorama-module-loading"
        >
            <LoadingSpinner text={t.common.loading_sr} />
        </div>
    );
}

// CAM-354 BR-3: dynamic({ssr:false}) — the pan-strip viewer is never part of
// the detail route's initial bundle; its chunk downloads only the first time
// a PANORAMA thumbnail is opened (see openPanorama / the conditional mount
// below, which is what actually defers the import — see PanoramaViewer.tsx).
const PanoramaViewer = dynamic(() => import("@/components/PanoramaViewer"), {
    ssr: false,
    loading: PanoramaModuleLoading,
});

export default function CampgroundDetailClient({
    campground,
    isOwner = false,
    initialSaved = false,
    avgRating = null,
    reviewCount = 0,
    reviewsPromise,
    reviewsError = false,
    prefill = null,
    fromChat = false,
}: {
    campground: any;
    isOwner?: boolean;
    /** Server-resolved initial wishlist state (AC-2, BR-3). */
    initialSaved?: boolean;
    /**
     * Server-rendered session snapshot — kept only so the existing caller
     * (app/campgrounds/[slug]/page.tsx) doesn't need a prop-shape change.
     * CAM-397 BR-1: never read as a gate input — both handleReserve and
     * handleWishlistToggle gate on the LIVE client session (`useSession()`
     * status === "authenticated") because this snapshot lags
     * `router.refresh()` after a modal login (CAM-396 G4 finding).
     *
     * CAM-527: confirmed dead INSIDE this component (never destructured from
     * props below) — kept only because removing it from the type breaks
     * `app/campgrounds/[slug]/page.tsx`'s JSX excess-property check (that
     * file is outside this story's file surface); see needs_decision.
     */
    isLoggedIn?: boolean;
    /** CAM-79 AC-1/AC-2: average rating rounded to 1dp, or null when no reviews. */
    avgRating?: number | null;
    /** CAM-79 AC-1/AC-2: total review count for this campsite (from the fast-path aggregate). */
    reviewCount?: number;
    /** CAM-394: the review list, streamed unawaited so the shell renders first.
     *  Unwrapped with use() inside a Suspense boundary; may be undefined when reviewCount is 0. */
    reviewsPromise?: Promise<ReviewsListResult>;
    /** CAM-79 AC-6: true when the review AGGREGATE query threw; rest of page stays usable. */
    reviewsError?: boolean;
    /**
     * CAM-635: booking widget seed from a chat handoff link, already
     * validated server-side by `parseBookingPrefill` (lib/booking-prefill.ts,
     * CAM-634). Null when there was no prefill link or it failed validation —
     * rendered exactly as the no-prefill default (empty dates, guests 1; no
     * toast/banner, see page.tsx).
     */
    prefill?: BookingPrefill | null;
    /**
     * CAM-635/CAM-642: true when the URL carried `from=chat` — independent of
     * whether `prefill` itself validated (the camper may still be re-picking
     * a rejected date range from a chat-originated link). Attaches
     * `source: 'CHAT'` to the reserve POST; a client-asserted attribution
     * label only, never an authz/pricing/capacity input.
     */
    fromChat?: boolean;
}) {
    const { t, formatCurrency, language } = useLanguage();
    const { resolvedTheme } = useTheme();
    const router = useRouter();

    // CAM-397 BR-1: gate on the LIVE client session — a server-rendered snapshot
    // stays stale until router.refresh() lands after a modal login, so the first
    // press right after login would re-open the modal on a stale value (CAM-396
    // G4 finding). LoginModal.handleSubmit already calls update() on success
    // (LoginModal.tsx:52-67), which flips this immediately — no refresh hack needed.
    const { status: sessionStatus } = useSession();
    const isLoggedInLive = sessionStatus === "authenticated";
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryStartIndex, setGalleryStartIndex] = useState(0);
    // CAM-353 AC-3: the shared photo viewer's source array — the camp hero gallery
    // and each spot's own gallery both open the SAME ImageGallery instance (no prop
    // change, no new component) by swapping which image list it points at.
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [isAmenitiesOpen, setIsAmenitiesOpen] = useState(false);

    // CAM-354 AC-1..7: the pan-strip panorama viewer. Mounted (and its dynamic
    // chunk downloaded, BR-3) only while `panorama` is non-null; unmounts on
    // close. panoramaTriggerRef restores focus to the originating thumbnail
    // (AC-5, EC-5, EC-7).
    const [panorama, setPanorama] = useState<{ url: string; alt: string } | null>(null);
    const panoramaTriggerRef = useRef<HTMLButtonElement | null>(null);

    // Wishlist toggle state — AC-1, AC-2, AC-3, AC-4, AC-5, BR-1..5.
    const [saved, setSaved] = useState(!!initialSaved);
    const [isWishlistLoading, setIsWishlistLoading] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);

    // Changed to Date objects. CAM-635: seeded from `prefill` in the
    // initializer (never an effect) so an immediate date change by the
    // camper isn't fought after the fact. `prefill.checkIn`/`checkOut` are
    // already-validated real calendar `YYYY-MM-DD` strings (BR-1..BR-6,
    // lib/booking-prefill.ts) — parseISO reads them as LOCAL dates, matching
    // every other date in this component (format()/isDateDisabled() below
    // all use local components too, never a UTC-parsed Date).
    const [checkIn, setCheckIn] = useState<Date | undefined>(() =>
        prefill ? parseISO(prefill.checkIn) : undefined
    );
    const [checkOut, setCheckOut] = useState<Date | undefined>(() =>
        prefill ? parseISO(prefill.checkOut) : undefined
    );

    // CAM-635: seed guests from `prefill`, but COOPERATE with the CAM-636
    // capacity clamp effect below rather than racing it —
    // `clampGuestsToInitialCeiling` (lib/guest-capacity.ts) applies the exact
    // same pure functions that effect uses (computeGuestCeiling +
    // buildGuestOptions) with the same `remaining: null` a just-mounted
    // component always starts with (the live per-date capacity hasn't been
    // fetched yet). This guarantees the FIRST paint's `guests` value is
    // always one of the FIRST paint's own `guestOptions` — the <Select>
    // never renders a value absent from its options (React would otherwise
    // show it blank). If the live remaining-capacity fetch later resolves a
    // lower ceiling, the effect below (unchanged) clamps further — this seed
    // never fights that effect, it only removes the avoidable first-paint
    // mismatch. A per-spot camp (no synchronously-known ceiling) falls back
    // to the same UNBOUNDED_GUEST_OPTIONS_MAX-capped range the effect itself
    // would offer.
    const [guests, setGuests] = useState<number>(() => {
        if (!prefill) return 1;
        return clampGuestsToInitialCeiling(
            prefill.guests,
            typeof campground?.maxGuestsPerDay === "number" ? campground.maxGuestsPerDay : null,
            campground?.useSpotView === true
        );
    });
    const [isReserving, setIsReserving] = useState(false);
    const [hasAttemptedReserve, setHasAttemptedReserve] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [availability, setAvailability] = useState<Record<string, { available: boolean; guests: number; maxGuests: number | null }>>({});
    // CAM-616: an availability-load failure must not render every future
    // date as bookable. `isDateDisabled` below treats `availabilityError`
    // as "unknown -> blocked" (never "unknown -> free") until a retry
    // succeeds.
    const [availabilityError, setAvailabilityError] = useState(false);

    // CAM-267 PREP-1: remaining capacity for the exact selected stay (เหลือ X ที่ / เต็มแล้ว).
    // null = no selection yet, or capacity is unbounded (maxGuestsPerDay not set) and the
    // stay is not host-blocked — nothing to show in either case.
    const [remainingCapacity, setRemainingCapacity] = useState<{ remaining: number | null; blockedByHost: boolean } | null>(null);
    const [loadingRemaining, setLoadingRemaining] = useState(false);

    // Calculate nights using date-fns
    const nights = (checkIn && checkOut && checkOut > checkIn)
        ? differenceInCalendarDays(checkOut, checkIn)
        : 0;

    const displayNights = nights > 0 ? nights : 0;
    // CAM-615: the same honest "no price / genuinely 0" rule CampgroundCard.tsx
    // uses for the catalog card price badge — never a second divergent check.
    const isHeadlinePriceFree = campground.priceLow == null || Number(campground.priceLow) <= 0;
    // CAM-58: use the shared pricing module so displayed total matches what the API records.
    // No spot-selection state in this component — spotPricePerNight is null (uses priceLow).
    // CAM-268 (PREP-2, AC-1): the camp's atomic one-time fee, via the same single
    // pricing source the real booking-creation API uses — so this preview's total
    // always equals what actually gets recorded.
    const campExtraFeeAmount = campground.extraFeeAmount != null ? Number(campground.extraFeeAmount) : 0;
    // CAM-652 (ADR-014): reads the camp's real `priceUnit` column and the
    // camper's own `guests` state through the SAME buildBookingPriceArgs the
    // server uses — a preview showing a different total than what the server
    // records (a divergent quantity) is exactly the failure CAM-58 exists to
    // prevent. `nights`/`vatRate` stay as today (server-authoritative VAT is
    // 0 client-side; harmless because VAT is inclusive, unchanged by this story).
    const priceArgs = buildBookingPriceArgs({
        campSite: {
            priceLow: campground.priceLow != null ? Number(campground.priceLow) : null,
            priceUnit: (campground.priceUnit ?? null) as PricingUnit | null,
            extraFeeAmount: campground.extraFeeAmount != null ? campExtraFeeAmount : null,
        },
        spot: null,
        party: { guests },
        nights: displayNights || 1,
        vatRate: 0,
    });
    // `ok:false` (TENT_COUNT_UNAVAILABLE) is unreachable today — no host form
    // writes CampSite.priceUnit yet (CAM-654 is a separate story), so every
    // camp still carries the column default PER_SITE (ADR-014 §2) — the
    // fallback below only satisfies the discriminated-union return type.
    const { unitAmount: unitPrice, totalAmount, subtotalAmount, extraFeeAmount } = priceArgs.ok
        ? computeBookingPrice(priceArgs.input)
        : { unitAmount: 0, totalAmount: 0, subtotalAmount: 0, extraFeeAmount: 0 };
    const bookingPricingUnit: PricingUnit = priceArgs.ok ? priceArgs.input.unit : "PER_SITE";
    const bookingQuantity = priceArgs.ok ? priceArgs.input.quantity : 1;

    // Fetch availability data — CAM-616: lifted to a stable useCallback (not
    // an effect-local function) so the retry banner below can re-issue the
    // SAME fetch on demand.
    const fetchAvailability = useCallback(async () => {
        if (!campground.id) return;

        setAvailabilityError(false);

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
                // CAM-616: do NOT setAvailability({}) here — an empty map
                // reads as "every date is free" to isDateDisabled below.
                // availabilityError makes every future date disabled instead.
                setAvailabilityError(true);
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
            setAvailabilityError(true);
        }
    }, [campground.id]);

    useEffect(() => {
        fetchAvailability();
    }, [fetchAvailability]);

    // CAM-267 PREP-1: fetch remaining capacity for the EXACT stay once both dates are
    // picked (server-authoritative — reuses getRemainingCapacity, the same math the
    // booking write path checks). Cleared whenever the selection is incomplete/invalid.
    // CAM-636 G3 nit: also cleared the instant a NEW valid pair of dates is picked
    // (before the fetch resolves) — otherwise the previous stay's number (and the
    // guests ceiling/badge derived from it) briefly describes dates the camper is
    // no longer looking at.
    useEffect(() => {
        if (!campground.id || !checkIn || !checkOut || checkOut <= checkIn) {
            setRemainingCapacity(null);
            return;
        }

        setRemainingCapacity(null);

        let cancelled = false;
        const fetchRemaining = async () => {
            setLoadingRemaining(true);
            try {
                const response = await fetch(
                    `/api/campsites/${campground.id}/remaining-capacity?startDate=${format(checkIn, 'yyyy-MM-dd')}&endDate=${format(checkOut, 'yyyy-MM-dd')}`
                );
                const payload = await response.json().catch(() => null);

                if (cancelled) return;

                if (!response.ok) {
                    console.error("Remaining capacity API error:", {
                        status: response.status,
                        statusText: response.statusText,
                        payload,
                    });
                    setRemainingCapacity(null);
                    return;
                }

                const data = payload?.data ?? payload;
                setRemainingCapacity({
                    remaining: data?.remaining ?? null,
                    blockedByHost: !!data?.blockedByHost,
                });
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to fetch remaining capacity:', error);
                    setRemainingCapacity(null);
                }
            } finally {
                if (!cancelled) setLoadingRemaining(false);
            }
        };

        fetchRemaining();
        return () => { cancelled = true; };
    }, [campground.id, checkIn, checkOut]);

    // CAM-267 PREP-1: derive the display state — เต็มแล้ว takes priority (whole-site
    // block OR numeric capacity hit 0); เหลือ N ที่ shows only while a real number
    // exists; unbounded capacity (no maxGuestsPerDay) with no block renders nothing.
    const isFullyBooked = !!remainingCapacity
        && (remainingCapacity.blockedByHost || remainingCapacity.remaining === 0);
    const showRemainingCount = !!remainingCapacity
        && !isFullyBooked
        && remainingCapacity.remaining !== null;

    // CAM-636: the party-size ("guests") control is bounded by the REAL
    // capacity ceiling, never a hardcoded literal list. `remaining` (live
    // capacity for the EXACT selected stay, once dates are picked) and
    // `maxGuestsPerDay` (the camp's stated per-day cap, available even
    // before any dates are picked) are both nullable with the SAME meaning
    // (null = no cap set, NEVER "full"/"zero") — see lib/guest-capacity.ts.
    // G3 finding: `maxGuestsPerDay` is a KNOWN-STALE column for a per-spot
    // camp (`useSpotView: true`, CAM-355 BR-6 — no spot write route ever
    // rewrites it) — `isPerSpot` tells computeGuestCeiling to exclude it
    // for that mode so a stale/zero column can never cap a per-spot camp;
    // `remaining` (already correctly spot-derived server-side) is the only
    // signal once dates are picked.
    const maxGuestsPerDay: number | null =
        typeof campground?.maxGuestsPerDay === "number" ? campground.maxGuestsPerDay : null;
    const isPerSpot = campground?.useSpotView === true;
    const guestCeiling = computeGuestCeiling(remainingCapacity?.remaining ?? null, maxGuestsPerDay, isPerSpot);
    const guestOptions = buildGuestOptions(guestCeiling);

    // Keep the selected guest count inside the current ceiling — e.g.
    // narrowing to dates with less remaining capacity after already
    // picking a higher guest count must not leave `guests` pointing at an
    // option that no longer exists.
    useEffect(() => {
        if (guestCeiling !== null && guests > guestCeiling) {
            setGuests(Math.max(1, guestCeiling));
        }
    }, [guestCeiling]);

    // Check if date is disabled (full or past)
    const isDateDisabled = (date: Date) => {
        const dateKey = format(date, 'yyyy-MM-dd');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Disable past dates
        if (date < today) return true;

        // CAM-616: an availability-load failure is "unknown", not "free" —
        // block every future date rather than let the empty map silently
        // present them all as bookable (a camper could otherwise pick a
        // date that is actually blocked).
        if (availabilityError) return true;

        // Disable full dates
        const dayAvailability = availability[dateKey];
        if (dayAvailability && !dayAvailability.available) {
            return true;
        }
        
        return false;
    };

    // CAM-396 AC-1/EC-1, BR-1: guest tap → open the existing LoginModal (mirrors
    // the wishlist gate below), never fire the unauthenticated booking request.
    // CAM-397 BR-1: gates on isLoggedInLive (the live client session), not the
    // stale isLoggedIn prop — fixes the first-press-after-login bug (AC-2).
    const handleReserve = async () => {
        if (!isLoggedInLive) {
            setLoginOpen(true);
            return;
        }

        // CAM-400 BR-4/EC-3: defense-in-depth — the button is already disabled
        // when isFullyBooked, but a direct dispatch must not slip past the
        // banner it disagrees with. Server (write gate) stays authoritative.
        if (isFullyBooked) {
            return;
        }

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
                    guests,
                    // CAM-642: attribution only — omitted (server defaults to
                    // WEB) unless the page was opened via a chat handoff link.
                    ...(fromChat ? { source: 'CHAT' as const } : {}),
                })
            });

            const data = await res.json();
            const { toast } = await import("sonner");

            if (res.ok) {
                // CAM-59: redirect immediately to the confirmation page (no toast delay).
                router.push(`/bookings/${data.id}/confirmation`);
            } else {
                // CAM-396 AC-3/EC-3, BR-2: never surface the server's raw data.error
                // (e.g. "Unauthorized", "Dates not available") — always show Thai copy.
                toast.error(t.newCampground.failedToReserve);
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
    // CAM-397 BR-1: pass the LIVE client session value into the gate argument,
    // not the stale isLoggedIn prop (lib/wishlist-toggle.ts is unchanged).
    const handleWishlistToggle = useCallback(async () => {
        setIsWishlistLoading(true);

        const result = await runWishlistToggle({
            isLoggedIn: isLoggedInLive,
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
    }, [isLoggedInLive, isWishlistLoading, saved, campground.id, t]);

    // BR-5: dynamic aria-label per state.
    const wishlistAriaLabel = isWishlistLoading
        ? t.wishlist.heartAriaLabelLoading
        : saved
            ? t.wishlist.heartAriaLabelRemove
            : t.wishlist.heartAriaLabelSave;

    const name = language === 'en' ? (campground.nameEn || campground.nameTh) : campground.nameTh;

    // CAM-548: localized "district, province" location line — country is NEVER shown
    // (owner requirement 2026-07-26, "User รู้อยู่แล้ว"). Same helper + same
    // provinceTh/district data seam CampgroundCard already uses (BR-1..BR-8 there).
    const locationText = buildLocationText(campground.location, language);

    // S4a: taxonomy now lives in the `options` MasterData relation; derive per-group code lists.
    const _options: { code: string; group: string }[] = campground.options || [];
    const codesByGroup = (g: string) => _options.filter((o) => o.group === g).map((o) => o.code);
    const accessCodes = codesByGroup('Access type');
    const terrainCodes = codesByGroup('Terrain');
    // CAM-517 (S5) — campSiteType is a scalar column (single value, e.g. CAGD/
    // GLAMP/VIEW), NOT part of the `options` MasterData relation above — read
    // it directly off the camp row.
    const campSiteTypeCode: string | undefined = campground.campSiteType;
    // CAM-526 (S10): accommodationTypes is a scalar CSV `String` column too
    // (not part of the `options` relation, and not a single scalar code like
    // campSiteType above) — parse via the shared `csvToArray` helper.
    const accommodationCodes = csvToArray(campground.accommodationTypes);
    const facilityCodes = codesByGroup('Internal facility');
    const externalCodes = codesByGroup('External facility');
    const equipmentCodes = codesByGroup('Equipment for rent');
    // CAM-528 (S1) — Activity was never bucketed on this page even though the
    // AI-chat detail card already showed it; icons + i18n landed in CAM-525 (S9).
    const activityCodes = codesByGroup('Activity');
    // CAM-515 (S3) — the FIRST new MasterData group (ALCO/FIRE/FIWD/ADAA/RESV).
    const annotatedCodes = codesByGroup('Annotated features');
    // CAM-516 (S4) — the SECOND new MasterData group (CHIC/GENR/DIFT/IDMT).
    const camperStyleCodes = codesByGroup('Camper style');
    // CAM-521 (S8) — final taxonomy slice, 3 NEW MasterData groups
    // (host-input + camper-detail-display only, NOT searchable — see BR-4).
    const stayConnectedCodes = codesByGroup('Stay connected');
    const markingMethodCodes = codesByGroup('Marking method');
    const drivewayCodes = codesByGroup('Driveway');

    // Parse images from relation
    const placeholderSrc = resolvedTheme === 'dark' ? '/placeholder-camp-dark.svg' : '/placeholder-camp.svg';
    const images: string[] = campground.images?.length
        ? campground.images.map((img: { url: string }) => img.url)
        : [placeholderSrc];

    const displayImages = images.slice(0, 5);

    // CAM-353 BR-1 (AC-1, AC-5, EC-2, EC-7): the spot section renders only for a
    // PER-SPOT-mode camp (useSpotView) that has at least one live spot. Spots ride
    // the payload pre-filtered to deletedAt: null by getCampBySlug (BR-2), so any
    // row present here is already live.
    const spots: any[] = campground.spots || [];
    const showSpotSection = !!campground.useSpotView && spots.length > 0;

    const openGallery = (index: number = 0) => {
        if (images.length === 0) return;
        const safe = Math.min(Math.max(index, 0), images.length - 1);
        setGalleryImages(images);
        setGalleryStartIndex(safe);
        setIsGalleryOpen(true);
    };

    // CAM-353 AC-3: opens the same shared viewer for a spot's own photos.
    const openSpotGallery = (spotImages: string[], index: number = 0) => {
        if (spotImages.length === 0) return;
        const safe = Math.min(Math.max(index, 0), spotImages.length - 1);
        setGalleryImages(spotImages);
        setGalleryStartIndex(safe);
        setIsGalleryOpen(true);
    };

    // CAM-354 BR-1, AC-1: opens the pan-strip viewer for a PANORAMA-kind spot
    // photo (the flat lightbox never opens for this image, EC-1).
    const openPanorama = (url: string, alt: string, triggerEl: HTMLButtonElement) => {
        panoramaTriggerRef.current = triggerEl;
        setPanorama({ url, alt });
    };

    // CAM-354 AC-5, EC-5, EC-7: unmounts the viewer and restores focus to the
    // thumbnail that opened it.
    const closePanorama = useCallback(() => {
        setPanorama(null);
        panoramaTriggerRef.current?.focus();
    }, []);

    // Helper to format displayed dates based on locale
    const formatDateDisplay = (date: Date | undefined) => {
        if (!date) return <span className="text-muted-foreground">{t.common.pickDate || "Pick a date"}</span>;
        return <span className="truncate">{format(date, "dd MMM yyyy", { locale: language === 'th' ? th : enUS })}</span>;
    };

    // CAM-525 (S9): the icon lookup is unified into lib/facility-icon-map.ts
    // (the single source of truth for MasterData code -> lucide icon) — no
    // more per-component facilityIconMap copy to drift out of sync.
    const getIcon = (code: string) => {
        const IconComponent = getFacilityIcon(code);
        return <IconComponent className="w-8 h-8 text-muted-foreground stroke-[1.2]" />;
    };

    // CAM-528 (S1): the label lookup every OptionGroupSection tile shares —
    // same `t.filter[code] || code` fallback every migrated section already used.
    const getLabel = (code: string) => t.filter[code as keyof typeof t.filter] || code;

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
                            <span className="font-semibold text-foreground">{campground.address || locationText}</span>
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
                            sizes="100vw"
                            priority
                        />
                        <div className="absolute top-4 right-4 bg-foreground/60 text-background text-xs font-bold px-2 py-1 rounded-xl backdrop-blur-sm">
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
                                    sizes="100vw"
                                    priority
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
                                        sizes="(max-width: 1024px) 100vw, 50vw"
                                        priority={i === 0}
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
                                    sizes="(max-width: 1024px) 100vw, 66vw"
                                    priority
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
                                        sizes="(max-width: 1024px) 50vw, 33vw"
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
                                    sizes="(max-width: 1024px) 100vw, 50vw"
                                    priority
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
                                    sizes="(max-width: 1024px) 50vw, 25vw"
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
                                    sizes="(max-width: 1024px) 50vw, 25vw"
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
                                    sizes="(max-width: 1024px) 50vw, 25vw"
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
                                    sizes="(max-width: 1024px) 100vw, 50vw"
                                    priority
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
                                        sizes="(max-width: 1024px) 50vw, 25vw"
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
                                    sizes="(max-width: 1024px) 50vw, 25vw"
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

                        {/* CAM-353: per-spot gallery section — PER-SPOT camps with >=1 live
                            spot only (BR-1); absent entirely otherwise (AC-5, EC-2, EC-7). */}
                        {showSpotSection && (
                            <div className="pb-8 border-b border-border/60" data-testid="section--campground-spots">
                                <h2 className="text-2xl font-bold font-display text-foreground mb-6">
                                    {t.campground.spotsHeading}
                                </h2>
                                <ul className="space-y-4" data-testid="list--campground-spots">
                                    {spots.map((spot: any) => {
                                        const spotImages: string[] = (spot.images || []).map((img: { url: string }) => img.url);
                                        const hasCapacity = typeof spot.maxCampers === 'number' && spot.maxCampers >= 1;
                                        const isFree = Number(spot.pricePerNight) === 0;

                                        return (
                                            <li
                                                key={spot.id}
                                                className="rounded-2xl border border-border p-4 md:p-6"
                                                data-testid={`item--campground-spot-${spot.id}`}
                                            >
                                                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-foreground">{spot.name}</h3>
                                                        {spot.zone && (
                                                            <p className="text-sm text-muted-foreground">{spot.zone}</p>
                                                        )}
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className="font-semibold text-foreground">
                                                            {isFree ? t.common.free : formatCurrency(Number(spot.pricePerNight))}
                                                        </span>{" "}
                                                        {/* CAM-653 (ADR-014): THIS spot's own unit, never the camp's
                                                            (a per-spot camp can show both on one screen —
                                                            `resolveUnitPrice`'s "never re-pair a row's price with
                                                            another row's unit" contract, lib/booking-pricing.ts). */}
                                                        <span className="text-muted-foreground">{priceUnitWord(t, spot.priceUnit as PricingUnit | null | undefined)}</span>
                                                    </div>
                                                </div>

                                                {hasCapacity && (
                                                    <p className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                                                        <Users className="w-4 h-4" aria-hidden="true" />
                                                        {t.campground.spotCapacityLabel.replace("{N}", String(spot.maxCampers))}
                                                    </p>
                                                )}

                                                {spotImages.length > 0 && (
                                                    <div className="flex gap-2 overflow-x-auto">
                                                        {spot.images.map((img: { url: string; kind?: string; alt?: string | null }, i: number) => (
                                                            <button
                                                                key={`${spot.id}-${i}`}
                                                                type="button"
                                                                className="relative flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                                aria-label={
                                                                    img.kind === "PANORAMA"
                                                                        ? t.panorama.openLabel
                                                                        : t.gallery.viewImage.replace("{n}", String(i + 1))
                                                                }
                                                                onClick={(e) => {
                                                                    // CAM-354 BR-1: kind branch — PANORAMA opens the
                                                                    // pan-strip viewer; PHOTO keeps the flat lightbox
                                                                    // path byte-for-byte (AC-1, AC-2, EC-1, EC-2).
                                                                    if (img.kind === "PANORAMA") {
                                                                        openPanorama(img.url, img.alt || t.panorama.title, e.currentTarget);
                                                                    } else {
                                                                        openSpotGallery(spotImages, i);
                                                                    }
                                                                }}
                                                            >
                                                                <ImageWithFallback
                                                                    src={img.url}
                                                                    alt=""
                                                                    width={80}
                                                                    height={80}
                                                                    loading="lazy"
                                                                    className="w-full h-full"
                                                                    imgClassName="object-cover"
                                                                />
                                                                {img.kind === "PANORAMA" && (
                                                                    <Badge
                                                                        variant="overlay"
                                                                        className="absolute bottom-0.5 left-0.5 gap-1"
                                                                        data-testid={`badge--campground-spot-panorama-${spot.id}`}
                                                                    >
                                                                        <MoveHorizontal aria-hidden="true" />
                                                                        {t.spotManagement.panoramaBadge}
                                                                    </Badge>
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

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

                        {/* 3a. CAM-528 (S1) AC-2/BR-2 — campSiteType gets its OWN labeled
                            section (was an unlabeled tile mixed into "Site Types" below).
                            Scalar column, so it's a single-code array. */}
                        {campSiteTypeCode && (
                            <div className="pb-8 border-b border-border/60" data-testid="section--campground-type">
                                <OptionGroupSection
                                    heading={t.filter["Campground type"]}
                                    codes={[campSiteTypeCode]}
                                    getLabel={getLabel}
                                    getIcon={getIcon}
                                />
                            </div>
                        )}

                        {/* 3a-2. CAM-526 (S10) AC-2/BR-4 — Accommodation type: a scalar CSV
                            `String` column (not part of the `options` relation), parsed via
                            csvToArray. Was fully wired end-to-end except this display section
                            and the (until now unseeded) host-form group. */}
                        {accommodationCodes.length > 0 && (
                            <div className="pb-8 border-b border-border/60" data-testid="section--accommodation-types">
                                <OptionGroupSection
                                    heading={t.filter["Accommodation type"]}
                                    codes={accommodationCodes}
                                    getLabel={getLabel}
                                    getIcon={getIcon}
                                />
                            </div>
                        )}

                        {/* 3b. Site Types (Terrain) — CAM-528 (S1) BR-1: migrated onto the
                            shared OptionGroupSection primitive, zero visual change. */}
                        {terrainCodes.length > 0 && (
                            <div className="pb-8 border-b border-border/60">
                                <OptionGroupSection
                                    heading={t.campground.siteTypes}
                                    codes={terrainCodes}
                                    getLabel={getLabel}
                                    getIcon={getIcon}
                                />
                            </div>
                        )}

                        {/* 3c. CAM-528 (S1) AC-1/BR-4 — Activity: never bucketed on this
                            page before, even though the AI-chat detail card already showed
                            it. Icons + i18n landed in CAM-525 (S9). */}
                        {activityCodes.length > 0 && (
                            <div className="pb-8 border-b border-border/60" data-testid="section--activities">
                                <OptionGroupSection
                                    heading={t.filter["Activity"]}
                                    codes={activityCodes}
                                    getLabel={getLabel}
                                    getIcon={getIcon}
                                />
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

                        {/* 6. CAM-515 (S3) — Annotated features (คุณลักษณะ): rules/rights
                            the camp carries (alcohol/fire/firewood/accessible/reservable),
                            the FIRST new MasterData group added post-launch. */}
                        {annotatedCodes.length > 0 && (
                            <div className="pb-8 border-b border-border/60" data-testid="section--annotated-features">
                                <OptionGroupSection
                                    heading={t.filter["Annotated features"]}
                                    codes={annotatedCodes}
                                    getLabel={getLabel}
                                    getIcon={getIcon}
                                />
                            </div>
                        )}

                        {/* 7. CAM-516 (S4) — Camper style (รูปแบบแคมป์): host-declared
                            vibe/style (chic/general/difficult/indomitable), the SECOND new
                            MasterData group added post-launch. */}
                        {camperStyleCodes.length > 0 && (
                            <div className="pb-8 border-b border-border/60" data-testid="section--camper-style">
                                <OptionGroupSection
                                    heading={t.filter["Camper style"]}
                                    codes={camperStyleCodes}
                                    getLabel={getLabel}
                                    getIcon={getIcon}
                                />
                            </div>
                        )}

                        {/* 8. CAM-521 (S8) — final taxonomy slice: a small "ข้อมูลเพิ่มเติม"
                            (additional info) block for the 3 metadata-only groups (phone
                            signal / spot-marking method / driveway type) — host-input +
                            camper-detail-display ONLY, deliberately NOT a filter/search
                            dimension (BR-4). */}
                        {(stayConnectedCodes.length > 0 || markingMethodCodes.length > 0 || drivewayCodes.length > 0) && (
                            <div className="pb-8 border-b border-border/60" data-testid="section--additional-info">
                                <h2 className="text-2xl font-bold font-display text-foreground mb-6">{t.campground.additionalInfo}</h2>
                                <div className="space-y-6">
                                    {stayConnectedCodes.length > 0 && (
                                        <OptionGroupSection
                                            heading={t.filter["Stay connected"]}
                                            headingTag="h3"
                                            headingClassName="text-sm font-semibold text-muted-foreground mb-3"
                                            gridClassName="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4"
                                            codes={stayConnectedCodes}
                                            getLabel={getLabel}
                                            getIcon={getIcon}
                                        />
                                    )}
                                    {markingMethodCodes.length > 0 && (
                                        <OptionGroupSection
                                            heading={t.filter["Marking method"]}
                                            headingTag="h3"
                                            headingClassName="text-sm font-semibold text-muted-foreground mb-3"
                                            gridClassName="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4"
                                            codes={markingMethodCodes}
                                            getLabel={getLabel}
                                            getIcon={getIcon}
                                        />
                                    )}
                                    {drivewayCodes.length > 0 && (
                                        <OptionGroupSection
                                            heading={t.filter["Driveway"]}
                                            headingTag="h3"
                                            headingClassName="text-sm font-semibold text-muted-foreground mb-3"
                                            gridClassName="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4"
                                            codes={drivewayCodes}
                                            getLabel={getLabel}
                                            getIcon={getIcon}
                                        />
                                    )}
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
                                // AC-3/AC-5: has reviews — streamed behind Suspense so the shell
                                // (name/hero/description/booking + header rating) renders first;
                                // the list fills in when its unawaited promise resolves (CAM-394).
                                <Suspense fallback={<ReviewsListSkeleton />}>
                                    <ReviewsListStreamed
                                        reviewsPromise={reviewsPromise}
                                        reviewCount={reviewCount}
                                    />
                                </Suspense>
                            )}
                        </div>

                    </div>

                    {/* Right Column: Booking Widget */}
                    <div className="md:col-span-1 relative">
                        <div className="sticky top-28 border border-border rounded-3xl p-6 shadow-lg shadow-foreground/5 bg-card">
                            <div className="flex justify-between items-baseline mb-6">
                                <div>
                                    {/* CAM-615: `campground.priceLow || 50` rendered a genuinely
                                        free camp (priceLow null/0) as ฿50/night - the booking
                                        total below (unitPrice, line ~172) already checks
                                        `!= null` honestly; this headline now uses the SAME
                                        isFree rule CampgroundCard.tsx already uses for the
                                        catalog card, instead of a second divergent one. */}
                                    {isHeadlinePriceFree ? (
                                        <span className="text-2xl font-bold text-foreground">{t.common.free}</span>
                                    ) : (
                                        <>
                                            <span className="text-2xl font-bold text-foreground">{formatCurrency(Number(campground.priceLow))} </span>
                                            {/* CAM-653 (ADR-014): unit-aware — reuses `bookingPricingUnit`,
                                                the SAME camp-level unit already resolved above for the
                                                booking-preview total (never a second resolution). PER_SITE
                                                keeps the exact pre-existing `common.night` word (zero visual
                                                diff — every camp is still PER_SITE until CAM-654 ships the
                                                host picker); another unit reads the shared `common.priceUnitLabel`
                                                phrase instead (`priceUnitWord`, lib/price-unit-display.ts). */}
                                            <span className="text-muted-foreground">{priceUnitWord(t, bookingPricingUnit)}</span>
                                        </>
                                    )}
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

                            {/* CAM-616: an availability-load failure disables every date
                                (see isDateDisabled) — this banner is what tells the camper
                                WHY, with a retry, instead of a silently unselectable calendar. */}
                            {availabilityError && (
                                <div
                                    role="alert"
                                    data-testid="banner--availability-error"
                                    className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                                >
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                                        <span>{t.booking.availabilityLoadError}</span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={fetchAvailability}
                                        data-testid="btn--availability-retry"
                                        className="rounded-full shrink-0"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                                        {t.common.retry}
                                    </Button>
                                </div>
                            )}

                            <div className="border border-border rounded-xl overflow-hidden mb-4 bg-background">
                                <div className="flex border-b border-border/60">
                                    <div className="w-1/2 p-3 border-r border-border/60">
                                        <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">{t.booking.checkIn}</label>
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
                                        <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">{t.booking.checkOut}</label>
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
                                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-2">{t.booking.guests}</label>
                                    {/* CAM-636: options come from the real capacity ceiling
                                        (guestOptions, above) — never a hardcoded literal list.
                                        guestOptions is empty only when the ceiling is 0 (no
                                        capacity left for the selected stay); the control is
                                        disabled in that case — the Reserve button's own
                                        isFullyBooked-disabled path (below) already blocks
                                        the actual booking regardless. */}
                                    <Select
                                        value={guests.toString()}
                                        onValueChange={(val) => setGuests(parseInt(val))}
                                        disabled={guestOptions.length === 0}
                                    >
                                        <SelectTrigger
                                            data-testid="select--booking-guests"
                                            className="w-full border border-border hover:border-foreground transition"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4 text-muted-foreground" />
                                                <SelectValue />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="shadow-2xl">
                                            {guestOptions.map(num => (
                                                <SelectItem key={num} value={num.toString()} className="cursor-pointer">
                                                    {num} {num === 1 ? t.booking.guest : t.search.guests}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* CAM-267 PREP-1: live remaining capacity for the selected stay — เหลือ X ที่ / เต็มแล้ว. */}
                            {!loadingRemaining && (showRemainingCount || isFullyBooked) && (
                                <p
                                    className={cn(
                                        "text-xs text-center mb-3",
                                        isFullyBooked ? "text-destructive font-semibold" : "text-muted-foreground"
                                    )}
                                    data-testid="row--booking-remaining-capacity"
                                    aria-live="polite"
                                >
                                    {isFullyBooked
                                        ? t.booking.fullyBooked
                                        : t.booking.remainingSpots.replace('{n}', String(remainingCapacity?.remaining))}
                                </p>
                            )}

                            <Button
                                onClick={handleReserve}
                                size="lg"
                                disabled={isReserving || isFullyBooked}
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
                                    {/* CAM-652 (ADR-014): PER_PERSON adds the quantity term (x N guests) so the
                                        breakdown's own math reads as `unit x guests x nights`, matching the
                                        totalAmount the server records — never just `unit x nights` when a
                                        party-size multiplier is actually being applied. */}
                                    <span className="underline">
                                        {formatCurrency(unitPrice)}
                                        {bookingPricingUnit === "PER_PERSON" &&
                                            ` x ${t.booking.guestsCount.replace("{count}", String(bookingQuantity))}`}
                                        {` x ${displayNights} ${t.booking.nights}`}
                                    </span>
                                    <span>{formatCurrency(subtotalAmount)}</span>
                                </div>
                                {/* CAM-268 (PREP-2, AC-1): itemized breakdown — only rendered when the
                                    camp actually has an atomic extra fee, so total always = base + this row. */}
                                {extraFeeAmount > 0 && (
                                    <div className="flex justify-between" data-testid="row--booking-extra-fee">
                                        <span>{campground.extraFeeLabel || t.booking.fees}</span>
                                        <span>{formatCurrency(extraFeeAmount)}</span>
                                    </div>
                                )}
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

                                {/* CAM-528 (S1) AC-3/BR-3: petFriendly is saved + prefilled on the
                                    host form but was never rendered anywhere on this page — a
                                    camper had no way to tell. Renders only when true (BR-3): the
                                    absence of the row is the correct default state, not a claim
                                    that pets are disallowed. */}
                                {campground.petFriendly && (
                                    <div
                                        className="flex items-center gap-3 py-2 border-b border-border/60"
                                        data-testid="row--campground-pet-friendly"
                                    >
                                        <PawPrint className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                                        <span className="font-medium text-foreground">{t.newCampground.petFriendly}</span>
                                    </div>
                                )}

                                {campground.minimumAge !== undefined && campground.minimumAge > 0 && (
                                    <div className="flex justify-between items-center py-2 border-b border-border/60">
                                        <span className="text-muted-foreground">{t.campground.minimumAge || "Minimum Age"}</span>
                                        <span className="font-medium text-foreground">{campground.minimumAge}+ Years</span>
                                    </div>
                                )}

                                {/* CAM-268 (PREP-2, AC-1): show the real, atomic fee (label + amount, the
                                    same one included in the total above) when the host has set one — never
                                    a vague "fees may apply" implying a charge that isn't actually counted. */}
                                {(campground.extraFeeAmount != null || campground.feeInfo) && (
                                    <div className="py-2 border-b border-border/60" data-testid="row--campground-fees">
                                        <span className="block text-muted-foreground mb-1">{t.campground.fees || "Fees"}</span>
                                        <span className="font-medium text-foreground">
                                            {campground.extraFeeAmount != null
                                                ? `${campground.extraFeeLabel || t.booking.fees}: ${formatCurrency(Number(campground.extraFeeAmount))}`
                                                : campground.feeInfo}
                                        </span>
                                        {campground.extraFeeAmount != null && campground.feeInfo && (
                                            <span className="block text-muted-foreground mt-1">{campground.feeInfo}</span>
                                        )}
                                    </div>
                                )}

                                {/* CAM-268 (PREP-2, AC-2/AC-3): cancellation policy — always shown, with
                                    an explicit "not set" copy when the host hasn't configured one yet. */}
                                <div className="py-2 border-b border-border/60" data-testid="row--campground-cancellation-policy">
                                    <span className="block text-muted-foreground mb-1">{t.campground.cancellationPolicy.title}</span>
                                    <span className="font-medium text-foreground">
                                        {resolveCancellationPolicyCopy(campground.cancellationPolicy, t.campground.cancellationPolicy)}
                                    </span>
                                </div>

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
                        <span>{locationText}</span>
                    </div>
                    <div className="w-full h-[320px] md:h-[480px]">
                        <DynamicMap
                            latitude={campground.latitude}
                            longitude={campground.longitude}
                            campground={campground}
                            avgRating={avgRating}
                            reviewCount={reviewCount}
                        />
                    </div>
                </div>

            </div>

            {/* Image Gallery Modal — shared viewer; source array switches between the
                camp hero gallery and a spot's own gallery (CAM-353 AC-3). */}
            <ImageGallery
                images={galleryImages}
                isOpen={isGalleryOpen}
                onClose={() => setIsGalleryOpen(false)}
                initialIndex={galleryStartIndex}
            />

            {/* CAM-354 BR-3: mounted (and its dynamic chunk fetched) only while a
                PANORAMA thumbnail is open — never for a PHOTO-only spot (EC-2). */}
            {panorama && (
                <PanoramaViewer url={panorama.url} alt={panorama.alt} onClose={closePanorama} />
            )}

            {/* Amenities Modal */}
            <AmenitiesModal
                isOpen={isAmenitiesOpen}
                onClose={() => setIsAmenitiesOpen(false)}
                facilities={facilityCodes}
            />

            {/* AC-4, BR-2: LoginModal for guest wishlist tap. CAM-396 AC-1/BR-1: also
                opened by the guest reserve tap (handleReserve) — same modal instance. */}
            <LoginModal
                isOpen={loginOpen}
                onClose={() => setLoginOpen(false)}
                subtitle={t.wishlist.loginPromptGuest}
            />
        </>
    );
}

/**
 * CAM-394: the streamed review list. The server page passes the review-list
 * findMany as an UNAWAITED promise; this client leaf unwraps it with use()
 * inside the parent's <Suspense> so the shell renders first and the list fills
 * in when the promise resolves. Cards stay client-rendered (language-reactive
 * date + copy). A resolved { ok: false } shows the isolated error (CAM-79 AC-6).
 */
function ReviewsListStreamed({
    reviewsPromise,
    reviewCount,
}: {
    reviewsPromise?: Promise<ReviewsListResult>;
    reviewCount: number;
}) {
    const { t, language } = useLanguage();
    // reviewsPromise is always provided when this renders (reviewCount > 0 gate),
    // but stay defensive: a missing promise resolves to an empty list.
    const result = reviewsPromise ? use(reviewsPromise) : { ok: true as const, reviews: [] };

    if (!result.ok) {
        // AC-6: the review list query failed — isolated, rest of page stays usable.
        return (
            <p className="text-muted-foreground text-sm" data-testid="error--reviews">
                {t.reviews.loadError}
            </p>
        );
    }

    return (
        <>
            <ul className="space-y-6" data-testid="list--reviews">
                {result.reviews.map((review, index) => {
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
                            className="py-4 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors rounded-xl -mx-1 px-1"
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
    );
}
