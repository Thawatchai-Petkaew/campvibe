"use client";

import { Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { csvToArray } from "@/lib/api-utils";
import { renderMasterDataIcon } from "./master-data-icon";
import { viewTypeLabel, type SpotViewerSpot } from "./types";

interface SpotDetailLineProps {
    spot: SpotViewerSpot;
}

/**
 * components/spot-viewer/SpotDetailLine.tsx — CAM-664 (S2)
 *
 * The full-width fact sheet for the SELECTED pitch, under the viewport.
 * Unlike the compact strip card (icons only, at most 4 facilities), this
 * line has room to carry everything with a WORD beside every icon — view
 * type, capacity, and every `nearFacilities` code (not truncated).
 *
 * `Spot.environment` is Thai free text (5 real seeded values) — rendered as
 * words only, never icon-mapped: a value outside the known set would
 * otherwise silently carry no icon (story.md).
 */
export function SpotDetailLine({ spot }: SpotDetailLineProps) {
    const { t } = useLanguage();
    const hasCapacity = typeof spot.maxCampers === "number" && spot.maxCampers >= 1;
    const facilityCodes = csvToArray(spot.nearFacilities);

    return (
        <div className="mt-4 space-y-3" data-testid="section--spot-detail-line">
            <div>
                <h3 className="text-lg font-bold text-foreground">{spot.name}</h3>
                {spot.zone && <p className="text-sm text-muted-foreground">{spot.zone}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground/80">
                <span className="flex items-center gap-2" data-testid="text--spot-detail-view-type">
                    {renderMasterDataIcon(spot.viewType ?? "GENERAL", "h-4 w-4 text-muted-foreground")}
                    {viewTypeLabel(t, spot.viewType)}
                </span>

                {hasCapacity && (
                    <span className="flex items-center gap-2" data-testid="text--spot-detail-capacity">
                        <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        {t.campground.spotCapacityLabel.replace("{N}", String(spot.maxCampers))}
                    </span>
                )}

                {facilityCodes.map((code) => (
                    <span key={code} className="flex items-center gap-2">
                        {renderMasterDataIcon(code, "h-4 w-4 text-muted-foreground")}
                        {t.filter[code as keyof typeof t.filter] || code}
                    </span>
                ))}
            </div>

            {spot.environment && (
                <p
                    className="type-caption italic text-muted-foreground"
                    data-testid="text--spot-detail-environment"
                >
                    &ldquo;{spot.environment}&rdquo;
                </p>
            )}
        </div>
    );
}
