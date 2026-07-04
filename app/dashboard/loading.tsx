/**
 * LOAD-3 (CAM-247): Dashboard nav-level loading fallback.
 *
 * Shows the dashboard page header (chrome) instantly + DashboardOverviewSkeleton
 * in the stats/table section — matching the real page layout (CLS=0).
 * Replaces the previous full-page spinner.
 *
 * Standard §S3: route-specific loading.tsx for the dashboard route.
 * a11y §S5: role="status" + aria-busy + aria-live + sr-only Thai label.
 */

import { DashboardOverviewSkeleton } from "@/components/ui/loading-skeleton";
import translations from "@/locales/translations.json";

const SR_LABEL = translations.th.common.loading_sr;

export default function DashboardLoading() {
    return (
        <div className="space-y-8" data-testid="shell--dashboard-loading">
            {/* Chrome header — mirrors the real dashboard page header */}
            <div className="flex justify-between items-end" aria-hidden="true">
                <div>
                    <div className="text-3xl font-bold text-foreground tracking-tight opacity-0 select-none">
                        &nbsp;
                    </div>
                    <div className="text-muted-foreground mt-2 opacity-0 select-none">&nbsp;</div>
                </div>
            </div>

            {/* Async section skeleton — mirrors the real stats+table area */}
            <div
                role="status"
                aria-busy="true"
                aria-live="polite"
                data-testid="section--dashboard-skeleton"
            >
                <span className="sr-only">{SR_LABEL}</span>
                <div aria-hidden="true">
                    <DashboardOverviewSkeleton />
                </div>
            </div>
        </div>
    );
}
