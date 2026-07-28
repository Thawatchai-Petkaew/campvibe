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
 *                          bookings/holds against the effective capacity).
 *   - `maxGuestsPerDay` — the camp's stated per-day capacity
 *                          (`CampSite.maxGuestsPerDay`), available even
 *                          before any dates are picked.
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
 *   - both null            -> null (unbounded; caller offers a useful range)
 *   - one null, one number -> the number (the only real constraint present)
 *   - both numbers         -> the smaller (the tightest real constraint)
 */
export function computeGuestCeiling(
  remaining: number | null,
  maxGuestsPerDay: number | null
): number | null {
  if (remaining === null && maxGuestsPerDay === null) return null;
  if (remaining === null) return maxGuestsPerDay;
  if (maxGuestsPerDay === null) return remaining;
  return Math.min(remaining, maxGuestsPerDay);
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
