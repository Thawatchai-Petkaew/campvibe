/**
 * booking-pricing.ts — single source of truth for booking price math (CAM-58).
 *
 * Pure, framework-agnostic module. Import this on both the server (API route)
 * and the client (UI preview) so the displayed total always equals the recorded
 * total.
 *
 * PREP-2 (CAM-268): `extraFeeAmount` is the ONE atomic, host-set, one-time-per-stay
 * additive charge on CampSite (e.g. an entrance fee) — added on top of the subtotal
 * so the displayed price and the recorded booking total never diverge (closes the
 * C-3.4 "fee shown but not counted" gap). This is deliberately NOT the deferred H-5.5
 * platform fee-config model (multi-fee-type, admin-managed, VAT-aware per fee type —
 * see docs/project/product-plan.md H-5.5); this module remains the extension point
 * for that future work.
 *
 * Money note (ADR-002): DB stores Decimal; callers pass Number here (the API
 * already converts priceLow / pricePerNight via Number() before calling). THB
 * has no sub-unit concerns at 2 dp.
 */

/** @public */
export interface ResolveUnitPriceInput {
  /** campSite.priceLow converted to number (may be null/undefined) */
  campSitePriceLow: number | null | undefined;
  /** selected spot's pricePerNight converted to number (absent when no spotId) */
  spotPricePerNight: number | null | undefined;
}

/**
 * resolveUnitPrice — returns the per-night price to charge.
 *
 * Priority: spot price (when present and > 0) → campSite priceLow → fallback 50.
 * Mirrors the logic that was inline in app/api/bookings/route.ts lines 76-80.
 */
export function resolveUnitPrice({
  campSitePriceLow,
  spotPricePerNight,
}: ResolveUnitPriceInput): number {
  if (spotPricePerNight !== null && spotPricePerNight !== undefined && spotPricePerNight > 0) {
    return spotPricePerNight;
  }
  if (campSitePriceLow !== null && campSitePriceLow !== undefined && campSitePriceLow > 0) {
    return campSitePriceLow;
  }
  return 50; // sane fallback (THB) when no price is configured
}

/** @public */
export interface ComputeBookingPriceInput {
  unitPrice: number;
  nights: number;
  /** vatRate as a decimal fraction, e.g. 0.07 for 7% Thai VAT (0 = no VAT) */
  vatRate: number;
  /**
   * PREP-2 (CAM-268): the camp's atomic CampSite.extraFeeAmount, charged ONCE per
   * stay (never multiplied by nights). Optional; defaults to 0 so every existing
   * caller that omits it keeps the prior no-fee total unchanged. Negative input is
   * clamped to 0 (defensive — the zod boundary already rejects negative values).
   */
  extraFeeAmount?: number;
}

/** @public */
export interface BookingPriceResult {
  /** per-night price used */
  unitAmount: number;
  /** unitAmount × nights */
  subtotalAmount: number;
  nights: number;
  /** vatRate passed in */
  taxRate: number;
  /**
   * VAT extracted from subtotal when vatInclusive=true (Thai displayed prices
   * are VAT-inclusive); 0 when vatRate is 0.
   * Rounded to 2 decimal places.
   */
  taxAmount: number;
  /** true when taxRate > 0 (prices include VAT) */
  vatInclusive: boolean;
  /** CAM-268: the atomic fee actually applied (0 when none/omitted). */
  extraFeeAmount: number;
  /**
   * Total amount owed = subtotalAmount + extraFeeAmount. VAT stays inclusive
   * (extracted from subtotalAmount only, never added on top) — extraFeeAmount is
   * a flat additive charge, not itself taxed by this module.
   */
  totalAmount: number;
}

/**
 * computeBookingPrice — calculates all price fields for a booking.
 *
 * Invariant: totalAmount === subtotalAmount + extraFeeAmount.
 * VAT is extracted from the inclusive subtotal exactly as the API did inline
 * (lines 95-97 of the original route.ts, pre-CAM-58).
 */
export function computeBookingPrice({
  unitPrice,
  nights,
  vatRate,
  extraFeeAmount = 0,
}: ComputeBookingPriceInput): BookingPriceResult {
  const safeNights = Math.max(0, nights);
  const subtotalAmount = unitPrice * safeNights;
  const vatInclusive = vatRate > 0;
  const taxAmount = vatInclusive
    ? Math.round((subtotalAmount - subtotalAmount / (1 + vatRate)) * 100) / 100
    : 0;
  const safeExtraFeeAmount = Math.max(0, extraFeeAmount);
  const totalAmount = subtotalAmount + safeExtraFeeAmount; // CAM-268: additive atomic fee

  return {
    unitAmount: unitPrice,
    subtotalAmount,
    nights: safeNights,
    taxRate: vatRate,
    taxAmount,
    vatInclusive,
    extraFeeAmount: safeExtraFeeAmount,
    totalAmount,
  };
}
