/**
 * ProfileFormSkeleton — CAM-247 (LOAD-3)
 *
 * Section-level skeleton mirroring the profile form layout:
 *   round avatar block → form-field bars (name, email, phone) → role badge → save button.
 *
 * Dimensions match the real ProfilePage form so CLS=0 when real content arrives.
 * Token-only: all fills via <Skeleton> (bg-muted). No hardcoded hex/px/shadow.
 * a11y: role="status" + aria-busy + aria-live on the region; decorative shapes aria-hidden.
 * prefers-reduced-motion handled by the <Skeleton> primitive (motion-reduce:animate-none).
 */

import { Skeleton } from "@/components/ui/skeleton";
import translations from "@/locales/translations.json";

// SR label from i18n — never hardcoded.
const SR_LABEL = translations.th.common.loading_sr;

export function ProfileFormSkeleton() {
    return (
        <div
            role="status"
            aria-busy="true"
            aria-live="polite"
            data-testid="section--profile-form-skeleton"
        >
            <span className="sr-only">{SR_LABEL}</span>

            {/* Card shell — matches the real profile card dimensions */}
            <div className="bg-card rounded-3xl shadow-2xl p-8 space-y-8" aria-hidden="true">
                {/* Header title/subtitle */}
                <div className="text-center space-y-2">
                    <Skeleton className="h-7 w-36 mx-auto" />
                    <Skeleton className="h-4 w-52 mx-auto" />
                </div>

                {/* Round avatar block — matches w-32 h-32 rounded-full */}
                <div className="flex justify-center">
                    <Skeleton className="w-32 h-32 rounded-full" />
                </div>

                {/* Form fields — 3 bars matching name / email / phone (h-12 + label) */}
                <div className="space-y-5">
                    {/* Field: name */}
                    <div className="space-y-1.5">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-12 w-full rounded-full" />
                    </div>
                    {/* Field: email */}
                    <div className="space-y-1.5">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-12 w-full rounded-full" />
                    </div>
                    {/* Field: phone */}
                    <div className="space-y-1.5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-12 w-full rounded-full" />
                    </div>

                    {/* Role badge placeholder */}
                    <div className="flex justify-center pt-2">
                        <Skeleton className="h-7 w-24 rounded-full" />
                    </div>

                    {/* Save button — matches w-full h-12 rounded-full */}
                    <Skeleton className="h-12 w-full rounded-full" />
                </div>
            </div>
        </div>
    );
}
