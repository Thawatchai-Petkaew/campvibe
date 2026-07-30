"use client";

import { useId, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickSpotDisplayImage, type SpotDisplayImage } from "@/lib/spot-display-image";
import { SpotViewport } from "./SpotViewport";
import { SpotDetailLine } from "./SpotDetailLine";
import { SpotStrip } from "./SpotStrip";
import type { SpotViewerSpot } from "./types";

interface SpotViewerProps {
    spots: SpotViewerSpot[];
    /** Opens the shared flat lightbox at `index` within `urls` (CAM-353 AC-3). */
    onOpenGallery: (urls: string[], index: number) => void;
    /** Opens the pan-strip viewer (CAM-354 BR-1) — `PanoramaViewer.tsx` itself is untouched. */
    onOpenPanorama: (url: string, alt: string, triggerEl: HTMLButtonElement) => void;
    /**
     * CAM-666: fired on every REAL selection (a tap/Enter/Space on a strip
     * tab) so the booking widget one level up can read which pitch is
     * picked — never fired on mount/default (the camper must actually
     * choose before price/reserve reveal, story.md). `selectedSpotId`
     * itself stays this component's OWN internal state (unchanged from
     * CAM-664) — this is purely an additional notification, not a lift of
     * the state itself, so SpotViewer's own behaviour stays identical.
     */
    onSelectSpot?: (spotId: string) => void;
}

/**
 * components/spot-viewer/SpotViewer.tsx — CAM-664 (S2)
 *
 * Replaces the old `<ul>` of full-width pitch cards (~200px each, so a
 * 16-pitch camp was ~3,200px of page) with ONE fixed-height viewport + a
 * selectable strip: switching the selected pitch only swaps content
 * `absolute inset-0` inside an already-sized box (`SpotViewport`) and the
 * fact sheet under it (`SpotDetailLine`) — CLS = 0, page height stays
 * constant regardless of pitch count.
 *
 * `selectedSpotId` is UI state only in this story (story.md "Scope
 * boundary") — it never touches price, the booking widget's totals, or
 * the reserve POST (that lands in CAM-666, after this one).
 */
export function SpotViewer({ spots, onOpenGallery, onOpenPanorama, onSelectSpot }: SpotViewerProps) {
    const { t, formatCurrency } = useLanguage();
    const idPrefix = useId();
    const [selectedSpotId, setSelectedSpotId] = useState(spots[0]?.id ?? "");

    // CAM-666: a REAL selection (never the mount default above) also notifies
    // the caller — see the onSelectSpot prop doc.
    const handleSelectSpot = (spotId: string) => {
        setSelectedSpotId(spotId);
        onSelectSpot?.(spotId);
    };

    const selectedSpot = useMemo(
        () => spots.find((s) => s.id === selectedSpotId) ?? spots[0],
        [spots, selectedSpotId]
    );

    if (!selectedSpot) return null;

    const displayImage: SpotDisplayImage | null = pickSpotDisplayImage(selectedSpot);
    const panelId = `${idPrefix}-panel`;
    const activeTabId = `${idPrefix}-tab-${selectedSpot.id}`;

    const handleExpand = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!displayImage) return;
        if (displayImage.kind === "PANORAMA") {
            onOpenPanorama(displayImage.url, displayImage.alt || t.panorama.title, e.currentTarget);
            return;
        }
        const urls = (selectedSpot.images ?? []).map((img) => img.url);
        const index = Math.max(0, urls.indexOf(displayImage.url));
        onOpenGallery(urls, index);
    };

    return (
        <div data-testid="section--spot-viewer">
            <SpotViewport
                displayImage={displayImage}
                spotName={selectedSpot.name}
                panelId={panelId}
                activeTabId={activeTabId}
                onExpand={handleExpand}
            />
            <SpotDetailLine spot={selectedSpot} />
            <SpotStrip
                spots={spots}
                selectedSpotId={selectedSpot.id}
                onSelect={handleSelectSpot}
                formatCurrency={formatCurrency}
                idPrefix={idPrefix}
                panelId={panelId}
            />
        </div>
    );
}
