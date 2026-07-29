/**
 * lib/price-unit-display.ts — CAM-653 (epic CAM-648, ADR-014).
 *
 * The ONE place every price caption on screen turns a `PricingUnit` into
 * copy. `locales/translations.json` carries a single shared, unit-keyed
 * group under `common` (`priceUnitSuffix` / `priceUnitLabel`) — no surface
 * gets its own private duplicate string (that private-duplicate pattern is
 * exactly what CAM-643 patched over one call site at a time and this story
 * closes structurally: read the copy through this module, never index
 * `t.common.priceUnitSuffix`/`priceUnitLabel` directly in a component, and
 * never hardcode a per-unit phrase inline).
 *
 * Two renderings exist because two PRE-EXISTING visual conventions already
 * exist in the app (verified by reading every call site before this story
 * touched them, not assumed):
 *   - "suffix" — a short `/night`-shaped fragment glued directly after the
 *     amount (CampgroundCard.tsx, AiChatCampCard.tsx, AiChatDetailCard.tsx).
 *     For PER_SITE this is BYTE-IDENTICAL to the pre-existing
 *     `common.perNight` (asserted equal by test) — the safety property that
 *     keeps every caption unchanged today, since every real row is still
 *     PER_SITE (CAM-654 ships the host-facing unit picker next).
 *   - "word" — a standalone caption word/phrase, used by
 *     CampgroundDetailClient.tsx's booking-widget headline and its per-spot
 *     price list, which pre-date this story reading the bare `common.night`
 *     word (no leading slash) rather than the suffix form. For PER_SITE this
 *     stays the exact pre-existing `common.night` string; only a non-default
 *     unit (not reachable with real data yet — no camp is anything but
 *     PER_SITE today) switches to the shared, fuller `common.priceUnitLabel`
 *     phrase ("ต่อคน/คืน" / "per guest / night").
 */
import type { PricingUnit } from '@/lib/booking-pricing';
import type { TranslationType } from '@/locales/translations';

/**
 * The `/night`-shaped suffix glued directly after an amount. `unit`
 * null/undefined (an older/narrower payload, or a surface `lib/ai/**` has
 * not yet threaded a real unit through — see AiChatCampCard/AiChatDetailCard)
 * defaults to `PER_SITE`, the same "no unit recorded" default
 * `resolveUnitPrice` (`lib/booking-pricing.ts`) already applies.
 */
export function priceUnitSuffix(t: TranslationType, unit: PricingUnit | null | undefined): string {
  return t.common.priceUnitSuffix[unit ?? 'PER_SITE'];
}

/**
 * The standalone caption word/phrase used by CampgroundDetailClient's
 * headline + per-spot list. PER_SITE keeps the exact pre-existing
 * `common.night` string (zero visual diff, CAM-653's safety property); any
 * other unit reads the shared, fuller `common.priceUnitLabel` phrase.
 */
export function priceUnitWord(t: TranslationType, unit: PricingUnit | null | undefined): string {
  const safeUnit = unit ?? 'PER_SITE';
  return safeUnit === 'PER_SITE' ? t.common.night : t.common.priceUnitLabel[safeUnit];
}
