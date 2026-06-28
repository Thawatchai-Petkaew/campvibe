/**
 * LOAD-2 (CAM-246): Root loading.tsx — neutral shell fallback.
 *
 * Replaces CampgroundGridSkeleton (LOAD-1, CAM-197) with the neutral
 * RootShellSkeleton so that routes without their own loading.tsx
 * (profile, host, detail, etc.) no longer flash a camp-grid skeleton.
 *
 * Home's grid skeleton is unaffected — it comes from the <Suspense>
 * fallback inside app/page.tsx (CampgroundGridSkeleton), which is
 * independent of this file.
 *
 * Standard §S3 (loading-ui-standard): root app/loading.tsx must be a
 * minimal, neutral last-resort only — NOT a substitute for route-specific
 * skeletons.
 */

import { RootShellSkeleton } from "@/components/ui/root-shell-skeleton";

export default function Loading() {
  return <RootShellSkeleton />;
}
