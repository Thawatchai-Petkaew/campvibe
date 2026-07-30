"use client";

import { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { csvToArray } from "@/lib/api-utils";
import { cn } from "@/lib/utils";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { priceUnitWord } from "@/lib/price-unit-display";
import { pickSpotDisplayImage } from "@/lib/spot-display-image";
import { renderMasterDataIcon } from "./master-data-icon";
import { viewTypeLabel, type SpotViewerSpot } from "./types";

/** DESIGN.md "at most 4 facility icons (+N beyond)" — the card is compact; the full list lives in SpotDetailLine. */
const MAX_CARD_FACILITY_ICONS = 4;

interface SpotStripProps {
    spots: SpotViewerSpot[];
    selectedSpotId: string;
    onSelect: (spotId: string) => void;
    formatCurrency: (amount: number) => string;
    /** Unique per-mount prefix (React `useId()`, wired one level up) so tab ids never collide across pages. */
    idPrefix: string;
    /** The single tabpanel (viewport + detail line) every tab controls. */
    panelId: string;
}

/**
 * components/spot-viewer/SpotStrip.tsx — CAM-664 (S2)
 *
 * Single-select navigation swapping a panel = tab grammar (`role="tablist"`
 * + `aria-selected`), NOT chip grammar — `FilterChip` is reserved for
 * multi-select filters (DESIGN.md §3 "Chip family") and structurally
 * cannot carry an image + price + icon row. Layout precedent:
 * `components/CategoryBar.tsx:97` (`overflow-x-auto no-scrollbar` +
 * `shrink-0`), never a wrapping row.
 *
 * Keyboard = WAI-ARIA APG manual-activation tabs: arrow keys move FOCUS
 * only (roving tabindex — only the focused tab is in the Tab order),
 * Home/End jump to the first/last tab, Enter/Space ACTIVATES (selects) the
 * focused tab. Selection-follows-focus would fire an image load for every
 * pitch a keyboard user arrows past (story.md) — deliberately not used.
 *
 * Selection is shown by a solid `border-primary` + `bg-primary/5` tint on
 * the SELECTED card only (§2 token table: primary = "selected state").
 * Unselected cards stay at full opacity — the owner's standing rule bans
 * using opacity to make something look LESS prominent, so de-emphasis
 * never comes from dimming a sibling card.
 */
export function SpotStrip({ spots, selectedSpotId, onSelect, formatCurrency, idPrefix, panelId }: SpotStripProps) {
    const { t } = useLanguage();
    const [focusedSpotId, setFocusedSpotId] = useState(selectedSpotId);
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    // A real (non-keyboard-focus) selection change resyncs the roving
    // tabindex too, so a later Tab-key entry into the strip lands on the
    // now-selected tab. Pure arrow-key focus movement never touches
    // `selectedSpotId`, so this never fires mid-navigation (manual activation).
    useEffect(() => {
        setFocusedSpotId(selectedSpotId);
    }, [selectedSpotId]);

    const focusTabAt = (index: number) => {
        const target = spots[index];
        if (!target) return;
        setFocusedSpotId(target.id);
        tabRefs.current[target.id]?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        switch (e.key) {
            case "ArrowRight":
                e.preventDefault();
                focusTabAt((index + 1) % spots.length);
                break;
            case "ArrowLeft":
                e.preventDefault();
                focusTabAt((index - 1 + spots.length) % spots.length);
                break;
            case "Home":
                e.preventDefault();
                focusTabAt(0);
                break;
            case "End":
                e.preventDefault();
                focusTabAt(spots.length - 1);
                break;
            case "Enter":
            case " ":
                e.preventDefault();
                onSelect(spots[index].id);
                break;
            default:
                break;
        }
    };

    return (
        <div
            role="tablist"
            aria-label={t.campground.spotStripLabel}
            aria-orientation="horizontal"
            className="mt-4 flex gap-3 overflow-x-auto no-scrollbar pb-1"
            data-testid="tablist--spot-strip"
        >
            {spots.map((spot, index) => {
                const selected = spot.id === selectedSpotId;
                const displayImage = pickSpotDisplayImage(spot);
                const isFree = Number(spot.pricePerNight) === 0;
                const hasCapacity = typeof spot.maxCampers === "number" && spot.maxCampers >= 1;
                const facilityCodes = csvToArray(spot.nearFacilities);
                const visibleFacilityCodes = facilityCodes.slice(0, MAX_CARD_FACILITY_ICONS);
                const hiddenFacilityCount = facilityCodes.length - visibleFacilityCodes.length;
                const tabId = `${idPrefix}-tab-${spot.id}`;

                return (
                    <button
                        key={spot.id}
                        ref={(el) => { tabRefs.current[spot.id] = el; }}
                        type="button"
                        role="tab"
                        id={tabId}
                        aria-selected={selected}
                        aria-controls={panelId}
                        tabIndex={focusedSpotId === spot.id ? 0 : -1}
                        onClick={() => { setFocusedSpotId(spot.id); onSelect(spot.id); }}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        data-testid={`tab--spot-strip-${spot.id}`}
                        className={cn(
                            "w-44 shrink-0 rounded-2xl border text-left transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            "active:scale-95",
                            selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-foreground"
                        )}
                    >
                        <div className="relative aspect-video w-full overflow-hidden rounded-t-2xl">
                            <ImageWithFallback
                                src={displayImage?.url}
                                alt={displayImage ? (displayImage.alt || spot.name) : t.campground.noImageAlt}
                                className="absolute inset-0"
                                imgClassName="object-cover"
                                sizes="176px"
                            />
                        </div>

                        <div className="space-y-1.5 p-2.5">
                            <p className="truncate text-sm font-semibold text-foreground">{spot.name}</p>
                            {spot.zone && <p className="truncate text-xs text-muted-foreground">{spot.zone}</p>}

                            {/* CAM-653 (ADR-014): THIS spot's own priceUnit, moved wholesale
                                from CampgroundDetailClient.tsx (the per-spot price/unit
                                expression that pre-dates this story) — never re-paired with
                                another row's unit. */}
                            <div className="flex items-baseline gap-1 text-sm">
                                <span className="font-semibold text-foreground">
                                    {isFree ? t.common.free : formatCurrency(Number(spot.pricePerNight))}
                                </span>
                                <span className="text-xs text-muted-foreground">{priceUnitWord(t, spot.priceUnit)}</span>
                            </div>

                            <div className="flex items-center gap-2 text-muted-foreground">
                                <span role="img" aria-label={viewTypeLabel(t, spot.viewType)}>
                                    {renderMasterDataIcon(spot.viewType ?? "GENERAL", "h-3.5 w-3.5")}
                                </span>
                                {hasCapacity && (
                                    <span className="flex items-center gap-1 text-xs">
                                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                                        {spot.maxCampers}
                                    </span>
                                )}
                            </div>

                            {visibleFacilityCodes.length > 0 && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    {visibleFacilityCodes.map((code) => (
                                        <span key={code} role="img" aria-label={t.filter[code as keyof typeof t.filter] || code}>
                                            {renderMasterDataIcon(code, "h-3.5 w-3.5")}
                                        </span>
                                    ))}
                                    {hiddenFacilityCount > 0 && (
                                        <span
                                            className="text-xs tabular-nums"
                                            aria-label={t.campground.spotMoreFacilitiesAriaLabel.replace("{N}", String(hiddenFacilityCount))}
                                        >
                                            +{hiddenFacilityCount}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
