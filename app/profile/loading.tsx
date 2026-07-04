/**
 * LOAD-3 (CAM-247): Profile nav-level loading fallback.
 *
 * Shows the back-link chrome instantly + ProfileFormSkeleton in the card area.
 * Mirrors the real ProfilePage shell (CLS=0 when data arrives).
 *
 * Standard §S3: route-specific loading.tsx for the profile route.
 * a11y §S5: live region on the skeleton section.
 */

import { ProfileFormSkeleton } from "@/components/ui/profile-form-skeleton";

export default function ProfileLoading() {
    return (
        <div
            className="min-h-screen bg-background py-12 px-4"
            data-testid="shell--profile-loading"
        >
            <div className="max-w-xl mx-auto">
                {/* Chrome: back-link placeholder — matches real layout height */}
                <div className="inline-flex items-center gap-2 mb-8 opacity-0 select-none" aria-hidden="true">
                    &nbsp;
                </div>

                {/* Async section skeleton */}
                <ProfileFormSkeleton />
            </div>
        </div>
    );
}
