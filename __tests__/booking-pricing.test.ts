/**
 * booking-pricing.test.ts — unit tests for lib/booking-pricing.ts (CAM-58)
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal · null/empty · boundary (min/max/0) · error/validation · no-fee invariant
 */

import { describe, it, expect } from 'vitest';
import {
  resolveUnitPrice,
  computeBookingPrice,
  type ResolveUnitPriceInput,
  type ComputeBookingPriceInput,
} from '@/lib/booking-pricing';

// ---------------------------------------------------------------------------
// resolveUnitPrice
// ---------------------------------------------------------------------------
describe('resolveUnitPrice', () => {
  it('[normal] returns campSitePriceLow when no spot price is given', () => {
    const result = resolveUnitPrice({ campSitePriceLow: 800, spotPricePerNight: null });
    expect(result).toBe(800);
  });

  it('[normal] returns spotPricePerNight when present, overriding campSitePriceLow', () => {
    const result = resolveUnitPrice({ campSitePriceLow: 800, spotPricePerNight: 1200 });
    expect(result).toBe(1200);
  });

  it('[null/empty] falls back to 50 when both inputs are null', () => {
    const result = resolveUnitPrice({ campSitePriceLow: null, spotPricePerNight: null });
    expect(result).toBe(50);
  });

  it('[null/empty] falls back to 50 when both inputs are undefined', () => {
    const input: ResolveUnitPriceInput = {
      campSitePriceLow: undefined,
      spotPricePerNight: undefined,
    };
    expect(resolveUnitPrice(input)).toBe(50);
  });

  it('[null/empty] uses campSitePriceLow fallback when spotPricePerNight is null', () => {
    expect(resolveUnitPrice({ campSitePriceLow: 500, spotPricePerNight: null })).toBe(500);
  });

  it('[null/empty] uses campSitePriceLow fallback when spotPricePerNight is undefined', () => {
    expect(resolveUnitPrice({ campSitePriceLow: 500, spotPricePerNight: undefined })).toBe(500);
  });

  it('[boundary] spot price of 0 is treated as absent — falls through to campSitePriceLow', () => {
    // 0 is falsy and not a valid price; campSitePriceLow should be used instead
    expect(resolveUnitPrice({ campSitePriceLow: 600, spotPricePerNight: 0 })).toBe(600);
  });

  it('[boundary] campSitePriceLow of 0 falls through to the 50 fallback', () => {
    expect(resolveUnitPrice({ campSitePriceLow: 0, spotPricePerNight: null })).toBe(50);
  });

  it('[boundary] very large spot price is returned as-is', () => {
    expect(resolveUnitPrice({ campSitePriceLow: 1000, spotPricePerNight: 99999 })).toBe(99999);
  });
});

// ---------------------------------------------------------------------------
// computeBookingPrice
// ---------------------------------------------------------------------------
describe('computeBookingPrice', () => {
  it('[normal] computes subtotal as unitPrice × nights', () => {
    const result = computeBookingPrice({ unitPrice: 800, nights: 3, vatRate: 0 });
    expect(result.subtotalAmount).toBe(2400);
    expect(result.unitAmount).toBe(800);
    expect(result.nights).toBe(3);
  });

  it('[normal] totalAmount equals subtotalAmount — no-fee invariant', () => {
    const result = computeBookingPrice({ unitPrice: 800, nights: 3, vatRate: 0 });
    expect(result.totalAmount).toBe(result.subtotalAmount);
  });

  it('[normal] vatRate 0 → vatInclusive false, taxAmount 0', () => {
    const result = computeBookingPrice({ unitPrice: 800, nights: 2, vatRate: 0 });
    expect(result.vatInclusive).toBe(false);
    expect(result.taxAmount).toBe(0);
    expect(result.taxRate).toBe(0);
  });

  it('[normal] VAT-inclusive: extracts tax from subtotal (Thai 7% VAT)', () => {
    // subtotal = 800 × 2 = 1600; tax = round((1600 - 1600/1.07) × 100)/100
    const subtotal = 800 * 2;
    const expectedTax = Math.round((subtotal - subtotal / 1.07) * 100) / 100;

    const result = computeBookingPrice({ unitPrice: 800, nights: 2, vatRate: 0.07 });

    expect(result.vatInclusive).toBe(true);
    expect(result.taxRate).toBe(0.07);
    expect(result.taxAmount).toBe(expectedTax);
    expect(result.subtotalAmount).toBe(subtotal);
    // totalAmount still equals subtotalAmount (VAT is inclusive, not added on top)
    expect(result.totalAmount).toBe(subtotal);
  });

  it('[normal] spot price overrides priceLow (end-to-end through both functions)', () => {
    const unitPrice = resolveUnitPrice({ campSitePriceLow: 800, spotPricePerNight: 1200 });
    const result = computeBookingPrice({ unitPrice, nights: 2, vatRate: 0 });
    expect(result.unitAmount).toBe(1200);
    expect(result.subtotalAmount).toBe(2400);
    expect(result.totalAmount).toBe(2400);
  });

  it('[boundary] 0 nights → all amounts are 0, no crash', () => {
    const result = computeBookingPrice({ unitPrice: 800, nights: 0, vatRate: 0 });
    expect(result.nights).toBe(0);
    expect(result.subtotalAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it('[boundary] 0 nights with VAT → taxAmount still 0', () => {
    const result = computeBookingPrice({ unitPrice: 800, nights: 0, vatRate: 0.07 });
    expect(result.subtotalAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it('[boundary] negative nights are clamped to 0', () => {
    const result = computeBookingPrice({ unitPrice: 800, nights: -1, vatRate: 0 });
    expect(result.nights).toBe(0);
    expect(result.subtotalAmount).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it('[boundary] 1 night is handled correctly', () => {
    const result = computeBookingPrice({ unitPrice: 500, nights: 1, vatRate: 0 });
    expect(result.subtotalAmount).toBe(500);
    expect(result.totalAmount).toBe(500);
  });

  it('[null/empty] fallback unit price (50) × nights produces a valid result', () => {
    const unitPrice = resolveUnitPrice({ campSitePriceLow: null, spotPricePerNight: null });
    const result = computeBookingPrice({ unitPrice, nights: 2, vatRate: 0 });
    expect(result.unitAmount).toBe(50);
    expect(result.subtotalAmount).toBe(100);
    expect(result.totalAmount).toBe(100);
  });

  it('[invariant] totalAmount === subtotalAmount for every combination (no fees)', () => {
    const cases: ComputeBookingPriceInput[] = [
      { unitPrice: 0, nights: 0, vatRate: 0 },
      { unitPrice: 500, nights: 3, vatRate: 0 },
      { unitPrice: 800, nights: 5, vatRate: 0.07 },
      { unitPrice: 1500, nights: 10, vatRate: 0.1 },
    ];
    for (const c of cases) {
      const r = computeBookingPrice(c);
      expect(r.totalAmount).toBe(r.subtotalAmount);
    }
  });

  it('[invariant] taxAmount is never added to totalAmount (VAT is inclusive, not on top)', () => {
    // Regression: ensure we do NOT do totalAmount = subtotal + taxAmount
    const result = computeBookingPrice({ unitPrice: 1000, nights: 1, vatRate: 0.07 });
    expect(result.totalAmount).toBe(result.subtotalAmount);
    expect(result.totalAmount).not.toBe(result.subtotalAmount + result.taxAmount);
  });
});
