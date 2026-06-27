/**
 * LOAD-1 (CAM-197): Cold-load skeleton shell (case 1 — first hard navigation).
 * Replaces the full-screen spinner to keep the loading experience consistent:
 * every loading case on the Home page now shows the same card-shaped skeleton.
 * Container padding mirrors the page.tsx layout so there is no layout shift
 * when the real content streams in.
 */

import { CampgroundGridSkeleton } from "@/components/CampgroundSkeleton";

export default function Loading() {
  return (
    <div className="min-h-screen pb-20 bg-background">
      <div className="container mx-auto px-6">
        <CampgroundGridSkeleton />
      </div>
    </div>
  );
}
