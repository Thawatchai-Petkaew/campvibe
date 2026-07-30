/**
 * components/spot-viewer/types.ts — CAM-664 (S2)
 *
 * The shared shape + small pure helpers every spot-viewer piece
 * (SpotViewport / SpotDetailLine / SpotStrip / SpotViewer) reads from —
 * kept in one file so the three sibling components never re-derive the
 * same field list or the same viewType->label lookup independently.
 */
import type { PricingUnit } from "@/lib/booking-pricing";
import type { TranslationType } from "@/locales/translations";
import type { SpotDisplayImageInput } from "@/lib/spot-display-image";

/** The exact fields the spot viewer reads off a `Spot` row (see prisma/schema.prisma). */
export interface SpotViewerSpot {
    id: string;
    name: string;
    zone?: string | null;
    /** Decimal serialized to string OR number, same convention as the rest of this page. */
    pricePerNight: number | string;
    priceUnit?: PricingUnit | null;
    maxCampers?: number | null;
    viewType?: string | null;
    /** CSV of Internal Facility MasterData codes (`lib/api-utils.ts` `csvToArray`). */
    nearFacilities?: string | null;
    /** Thai free text, e.g. "ริมหน้าผา วิวหมอก" — words only, never icon-mapped (story.md). */
    environment?: string | null;
    images?: SpotDisplayImageInput[];
}

/**
 * CAM-664 — `Spot.viewType` is either `null` OR the literal enum member
 * `'GENERAL'` (both mean "no particular view" — the host form's own
 * `NO_VIEW_TYPE` sentinel writes `null` for this exact case,
 * `spot-form-dialog.tsx`) OR one of the 5 named views (RIVER/MOUNTAIN/LAKE/
 * FOREST/BEACH). Reuses the `spotManagement.viewType*` keys the host form
 * already ships (`spot-form-dialog.tsx:421`) — never a private duplicate
 * label (CAM-643's private-duplicate-key lesson).
 */
export function viewTypeLabel(t: TranslationType, viewType: string | null | undefined): string {
    const key = !viewType || viewType === "GENERAL"
        ? "viewTypeGeneral"
        : `viewType${viewType.charAt(0)}${viewType.slice(1).toLowerCase()}`;
    const dict = t.spotManagement as unknown as Record<string, string>;
    return dict[key] ?? viewType ?? "";
}
