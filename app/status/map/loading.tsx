/**
 * CAM-248 (LOAD-4): Route-level loading boundary for /status/map.
 *
 * Without this file, Next.js App Router falls back to the nearest ancestor
 * loading.tsx — which is app/loading.tsx (a delayed centered spinner as of
 * LOAD-5, CAM-273; previously RootShellSkeleton in LOAD-2, CAM-246). That
 * fallback is a generic last-resort, not tailored to this route.
 *
 * This file overrides the root for the /status/map segment. It renders ONLY
 * the MapProgress indicator (a full-screen dark background + indeterminate
 * amber progress bar) — no skeleton, no spinner from app/loading.tsx.
 *
 * Loading-UI standard: full-screen canvas/map modules use a progress indicator
 * only (no skeleton). Give such a route its own loading.tsx rendering the
 * progress so it does not inherit the root neutral skeleton.
 *
 * The page is force-dynamic (server-fetches live Linear data), so this
 * fallback fires on every cold-load and navigation to /status/map.
 */
import { MapProgress } from "./map-progress";

export default function Loading() {
  return <MapProgress />;
}
