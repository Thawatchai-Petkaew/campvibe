/**
 * booking-pricing.ts — single source of truth for booking price math (CAM-58).
 *
 * Pure, framework-agnostic module. Import this on both the server (API route)
 * and the client (UI preview) so the displayed total always equals the recorded
 * total. No fees anywhere — fee model deferred to H-5.5 with a proper atomic
 * config model.
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
}

/** @public */
export interface BookingPriceResult {
  /** per-night price used */
  unitAmount: number;
  /** unitAmount × nights (no fees added) */
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
  /**
   * Total amount owed. Equals subtotalAmount — no platform fees.
   * (Fees are deferred to H-5.5 with an atomic config model.)
   */
  totalAmount: number;
}

/**
 * computeBookingPrice — calculates all price fields for a booking.
 *
 * Invariant: totalAmount === subtotalAmount (no fees).
 * VAT is extracted from the inclusive subtotal exactly as the API did inline
 * (lines 95-97 of the original route.ts).
 */
export function computeBookingPrice({
  unitPrice,
  nights,
  vatRate,
}: ComputeBookingPriceInput): BookingPriceResult {
  const safeNights = Math.max(0, nights);
  const subtotalAmount = unitPrice * safeNights;
  const vatInclusive = vatRate > 0;
  const taxAmount = vatInclusive
    ? Math.round((subtotalAmount - subtotalAmount / (1 + vatRate)) * 100) / 100
    : 0;
  const totalAmount = subtotalAmount; // no fees — invariant: total === subtotal

  return {
    unitAmount: unitPrice,
    subtotalAmount,
    nights: safeNights,
    taxRate: vatRate,
    taxAmount,
    vatInclusive,
    totalAmount,
  };
}
