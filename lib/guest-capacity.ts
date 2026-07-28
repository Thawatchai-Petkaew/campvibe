/**
 * lib/guest-capacity.ts — CAM-636 (epic CAM-630, in-chat guided booking)
 *
 * The party-size ("guests") control on the camp detail page must offer
 * options bounded by the REAL capacity ceiling, never a hardcoded literal
 * list ([1,2,3,4,5,6] — the bug this story fixes).
 *
 * Two signals bound the ceiling, and BOTH are nullable with the SAME
 * meaning: `null` = "no cap set" (unbounded), NEVER "full" or "zero":
 *   - `remaining`       — live remaining capacity for the exact selected
 *                          stay (`getRemainingCapacity`, already nets off
 *                          bookings/holds against the effective capacity,
 *                          and is already spot-derived for a per-spot camp).
 *   - `maxGuestsPerDay` — the camp's stated per-day capacity
 *                          (`CampSite.maxGuestsPerDay`), available even
 *                          before any dates are picked — BUT ONLY TRUSTED
 *                          for a WHOLE-CAMP camp (`useSpotView: false`).
 *
 * G3 finding (CAM-636 review round): `maxGuestsPerDay` is a KNOWN-STALE
 * column for a per-spot camp (`useSpotView: true`) — CAM-355 BR-6 already
 * documents this (`lib/spot-aggregation.ts`, `components/CampgroundForm.tsx`),
 * and no spot create/update/delete route ever rewrites it. A brand-new
 * per-spot camp's form default is even `0` (`CampgroundForm.tsx:282/713`).
 * Taking `Math.min(remaining, maxGuestsPerDay)` unconditionally lets that
 * stale/zero column permanently cap a per-spot camp even when its real
 * spot-derived capacity (and therefore `remaining`, once dates are picked)
 * is far higher — reintroducing this story's own bug ("a camp that can
 * hold 8 friends cannot be booked") through a new mechanism, and WORSE than
 * the original hardcoded [1..6]: that never made a camp fully unbookable.
 * FIX (option b, chosen over re-deriving spot capacity client-side — that
 * would mean importing a server-only module — `lib/spot-aggregation.ts` —
 * that pulls in `prisma`/`next/cache`, unsafe in a client bundle, or a new
 * fetch on the detail page's critical path): a per-spot camp NEVER lets
 * `maxGuestsPerDay` cap the ceiling — `remaining` (already correctly
 * spot-derived server-side) is the only signal once dates are picked;
 * before dates are picked there is honestly no trustworthy ceiling yet, so
 * the unbounded default range is offered instead. `isPerSpot` is
 * `CampSite.useSpotView`, passed straight through by the caller.
 *
 * A falsy check (`!remaining`, `remaining || x`) would collapse `null` and
 * `0` and hide every uncapped camp behind a single option — branch on
 * `null` explicitly, every time (never `||`/`??` on the raw values here).
 */

/**
 * A useful, bounded range to offer when NEITHER signal caps the stay (both
 * null = genuinely unbounded capacity, e.g. no dates picked yet and the
 * host never set a per-day cap). Keeps the <Select> usable instead of
 * listing an arbitrary/huge range.
 */
export const UNBOUNDED_GUEST_OPTIONS_MAX = 20;

/**
 * The real ceiling for the guests control:
 *   - `isPerSpot` (`CampSite.useSpotView`): `maxGuestsPerDay` is a known-
 *     stale manual column for this mode (see the module header) — it is
 *     EXCLUDED from the ceiling entirely; `remaining` is the only signal
 *     (null until dates are picked, then the true spot-derived number).
 *   - `!isPerSpot` (whole-camp): both signals combine as before —
 *     both null            -> null (unbounded; caller offers a useful range)
 *     one null, one number -> the number (the only real constraint present)
 *     both numbers         -> the smaller (the tightest real constraint)
 */
export function computeGuestCeiling(
  remaining: number | null,
  maxGuestsPerDay: number | null,
  isPerSpot: boolean
): number | null {
  const trustedMax = isPerSpot ? null : maxGuestsPerDay;
  if (remaining === null && trustedMax === null) return null;
  if (remaining === null) return trustedMax;
  if (trustedMax === null) return remaining;
  return Math.min(remaining, trustedMax);
}

/**
 * Build the [1..ceiling] option list for the guests <Select> (or
 * [1..UNBOUNDED_GUEST_OPTIONS_MAX] when ceiling is null/unbounded).
 * ceiling === 0 -> [] (no valid guest count — the caller disables the
 * control; the reserve button's own already-disabled path still holds).
 */
export function buildGuestOptions(ceiling: number | null): number[] {
  const max = ceiling === null ? UNBOUNDED_GUEST_OPTIONS_MAX : ceiling;
  if (max <= 0) return [];
  return Array.from({ length: max }, (_, i) => i + 1);
}
