/**
 * LOAD-5 (CAM-273): Root loading.tsx — delayed centered spinner.
 *
 * Root last-resort fallback per the loading-ui-standard decision matrix
 * (.claude/rules/loading.md §Quick Reference): "~100ms-1s, unknown layout ->
 * delayed spinner (or nothing), show after ~300ms". app/loading.tsx has no
 * knowledge of the destination route's layout, so it cannot mirror a
 * structure the way a route-level skeleton can — a spinner is the correct
 * choice here, not a skeleton.
 *
 * Supersedes LOAD-2's (CAM-246) RootShellSkeleton: that neutral shell still
 * rendered a fixed shape (navbar bar + content bars) for every route with no
 * loading.tsx of its own, which produced a generic-skeleton flash before the
 * route's own loading.tsx/skeleton took over. A delayed spinner has no shape
 * to mismatch, so it never causes that flash or any layout shift.
 *
 * The `skeleton-delay-show` utility (app/globals.css) delays the spinner's
 * appearance by ~300ms so fast navigations never flash it at all; under
 * prefers-reduced-motion it shows immediately (no animation dependency).
 *
 * Route-level loading.tsx files (e.g. app/status/map/loading.tsx) are
 * unaffected — Next.js prefers the nearest ancestor boundary, so this root
 * fallback only fires for routes with no loading.tsx of their own.
 */

import { LoadingSpinner } from "@/components/ui/loading-spinner";
import translations from "@/locales/translations.json";

// SR label from the shared common.loading_sr key (TH verbatim: กำลังโหลด…).
// Never hardcoded — resolves via the i18n JSON so the key is the source of truth.
const SR_LABEL = translations.th.common.loading_sr;

export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="skeleton-delay-show"
      data-testid="shell--root-spinner"
    >
      {/* Screen-reader live-region text — the only announced content */}
      <span className="sr-only">{SR_LABEL}</span>

      {/* Decorative spinner — meaning is conveyed by the sr-only label above */}
      <div aria-hidden="true">
        <LoadingSpinner size="lg" fullScreen />
      </div>
    </div>
  );
}
