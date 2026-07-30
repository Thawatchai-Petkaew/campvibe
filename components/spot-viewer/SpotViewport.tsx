"use client";

import { Expand, MoveHorizontal } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { Badge } from "@/components/ui/badge";
import type { SpotDisplayImage } from "@/lib/spot-display-image";

interface SpotViewportProps {
    /** null = the dominant case (2 of 3,006 seeded pitches have any image, story.md). */
    displayImage: SpotDisplayImage | null;
    spotName: string;
    panelId: string;
    activeTabId: string;
    onExpand: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * components/spot-viewer/SpotViewport.tsx — CAM-664 (S2)
 *
 * ONE viewport box, fixed aspect ratio declared in CSS (`aspect-[3/2]`
 * mobile / `aspect-[16/9]` desktop per DESIGN.md §2.0) so its height exists
 * before any image loads — switching the selected pitch only swaps the
 * `src`/badge inside an already-sized box, so CLS = 0 by construction.
 *
 * The empty state (no display image) is the DOMINANT one and needs no
 * special-casing here: `ImageWithFallback` already renders DESIGN.md's
 * "Empty image slot" (CAM-539 — whole `ImageIcon`, `bg-muted`, full-opacity
 * `text-muted-foreground`, `role="img"` + `aria-label`) the instant `src`
 * is `undefined`. When there IS an image, ONE real `<button>` (not a
 * disabled control on the empty path — there is nothing to expand) spans
 * the whole box: tapping/Enter/Space anywhere calls the page's existing
 * `openPanorama` / `openSpotGallery` (via `onExpand`, wired one level up in
 * SpotViewer) — `components/PanoramaViewer.tsx` itself is untouched.
 */
export function SpotViewport({ displayImage, spotName, panelId, activeTabId, onExpand }: SpotViewportProps) {
    const { t } = useLanguage();

    const altText = displayImage?.alt || spotName;
    const expandAriaLabel = displayImage?.kind === "PANORAMA" ? t.panorama.openLabel : t.gallery.openGallery;

    return (
        <div
            id={panelId}
            role="tabpanel"
            aria-labelledby={activeTabId}
            tabIndex={0}
            className="relative aspect-[3/2] md:aspect-[16/9] w-full overflow-hidden rounded-3xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid="section--spot-viewport"
        >
            <ImageWithFallback
                src={displayImage?.url}
                alt={displayImage ? altText : t.campground.noImageAlt}
                className="absolute inset-0"
                imgClassName="object-cover"
                sizes="(max-width: 768px) 100vw, 66vw"
            />

            {displayImage?.kind === "PANORAMA" && (
                <Badge
                    variant="overlay"
                    className="absolute bottom-3 left-3 gap-1.5"
                    data-testid="badge--spot-viewport-panorama"
                >
                    <MoveHorizontal aria-hidden="true" />
                    {t.spotManagement.panoramaBadge}
                </Badge>
            )}

            {displayImage && (
                <button
                    type="button"
                    onClick={onExpand}
                    aria-label={expandAriaLabel}
                    data-testid="btn--spot-viewport-expand"
                    className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                    <span
                        aria-hidden="true"
                        className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/90 shadow-sm backdrop-blur-md"
                    >
                        <Expand className="h-4 w-4 text-foreground" />
                    </span>
                </button>
            )}
        </div>
    );
}
