/**
 * booking-pricing.test.ts — unit tests for lib/booking-pricing.ts (CAM-58, extended CAM-268, CAM-651)
 *
 * CAM-268 (PREP-2) added `extraFeeAmount` — a single atomic, host-set, one-time-per-stay
 * fee. Every pre-existing test below still passes unmodified (just re-typed): `extraFeeAmount`
 * defaults to 0, so any caller that omits it keeps the exact CAM-58 "no fee" totals (additive,
 * backward-compatible per .claude/rules/api.md #12). New cases below cover the
 * fee-inclusive path (AC-1: total = base + fee ที่คิดจริง).
 *
 * CAM-651 (epic CAM-648, ADR-014): `resolveUnitPrice` now returns
 * `{ unitPrice, unit, source }` instead of a bare number, and `computeBookingPrice`
 * requires `unit` + `quantity`. Every call below is updated to the new shape;
 * every call passes `unit: 'PER_SITE', quantity: 1` (or derives `unit` from
 * `resolveUnitPrice`'s result) so every PRE-EXISTING golden number in this
 * file is preserved byte-for-byte — none of these assertions were weakened.
 * The new engine-specific matrix (I1-I8: subtotal × quantity, unit
 * neutrality, resolver coupling, enum exhaustiveness, etc.) lives in
 * `__tests__/cam-651-pricing-engine-unit.test.ts`.
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal · null/empty · boundary (min/max/0) · error/validation · no-fee invariant ·
 *   fee-inclusive invariant (CAM-268)
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
    const result = resolveUnitPrice({
      campSitePriceLow: 800,
      campSitePriceUnit: null,
      spotPricePerNight: null,
      spotPriceUnit: null,
    });
    expect(result.unitPrice).toBe(800);
    expect(result.source).toBe('CAMP');
  });

  it('[normal] returns spotPricePerNight when present, overriding campSitePriceLow', () => {
    const result = resolveUnitPrice({
      campSitePriceLow: 800,
      campSitePriceUnit: null,
      spotPricePerNight: 1200,
      spotPriceUnit: null,
    });
    expect(result.unitPrice).toBe(1200);
    expect(result.source).toBe('SPOT');
  });

  it('[null/empty] falls back to 50 when both inputs are null', () => {
    const result = resolveUnitPrice({
      campSitePriceLow: null,
      campSitePriceUnit: null,
      spotPricePerNight: null,
      spotPriceUnit: null,
    });
    expect(result.unitPrice).toBe(50);
    expect(result.source).toBe('FALLBACK');
  });

  it('[null/empty] falls back to 50 when both inputs are undefined', () => {
    const input: ResolveUnitPriceInput = {
      campSitePriceLow: undefined,
      campSitePriceUnit: undefined,
      spotPricePerNight: undefined,
      spotPriceUnit: undefined,
    };
    expect(resolveUnitPrice(input).unitPrice).toBe(50);
  });

  it('[null/empty] uses campSitePriceLow fallback when spotPricePerNight is null', () => {
    expect(
      resolveUnitPrice({
        campSitePriceLow: 500,
        campSitePriceUnit: null,
        spotPricePerNight: null,
        spotPriceUnit: null,
      }).unitPrice
    ).toBe(500);
  });

  it('[null/empty] uses campSitePriceLow fallback when spotPricePerNight is undefined', () => {
    expect(
      resolveUnitPrice({
        campSitePriceLow: 500,
        campSitePriceUnit: null,
        spotPricePerNight: undefined,
        spotPriceUnit: undefined,
      }).unitPrice
    ).toBe(500);
  });

  it('[boundary] spot price of 0 is treated as absent — falls through to campSitePriceLow', () => {
    // 0 is falsy and not a valid price; campSitePriceLow should be used instead
    expect(
      resolveUnitPrice({
        campSitePriceLow: 600,
        campSitePriceUnit: null,
        spotPricePerNight: 0,
        spotPriceUnit: null,
      }).unitPrice
    ).toBe(600);
  });

  it('[boundary] campSitePriceLow of 0 falls through to the 50 fallback', () => {
    expect(
      resolveUnitPrice({
        campSitePriceLow: 0,
        campSitePriceUnit: null,
        spotPricePerNight: null,
        spotPriceUnit: null,
      }).unitPrice
    ).toBe(50);
  });

  it('[boundary] very large spot price is returned as-is', () => {
    expect(
      resolveUnitPrice({
        campSitePriceLow: 1000,
        campSitePriceUnit: null,
        spotPricePerNight: 99999,
        spotPriceUnit: null,
      }).unitPrice
    ).toBe(99999);
  });
});

// ---------------------------------------------------------------------------
// computeBookingPrice
// ---------------------------------------------------------------------------
describe('computeBookingPrice', () => {
  it('[normal] computes subtotal as unitPrice × quantity × nights (quantity 1 — unchanged from before CAM-651)', () => {
    const result = computeBookingPrice({ unitPrice: 800, unit: 'PER_SITE', quantity: 1, nights: 3, vatRate: 0 });
    expect(result.subtotalAmount).toBe(2400);
    expect(result.unitAmount).toBe(800);
    expect(result.nights).toBe(3);
  });

  it('[normal] totalAmount equals subtotalAmount — no-fee invariant', () => {
    const result = computeBookingPrice({ unitPrice: 800, unit: 'PER_SITE', quantity: 1, nights: 3, vatRate: 0 });
    expect(result.totalAmount).toBe(result.subtotalAmount);
  });

  it('[normal] vatRate 0 → vatInclusive false, taxAmount 0', () => {
    const result = computeBookingPrice({ unitPrice: 800, unit: 'PER_SITE', quantity: 1, nights: 2, vatRate: 0 });
    expect(result.vatInclusive).toBe(false);
    expect(result.taxAmount).toBe(0);
    expect(result.taxRate).toBe(0);
  });

  it('[normal] VAT-inclusive: extracts tax from subtotal (Thai 7% VAT)', () => {
    // subtotal = 800 × 2 = 1600; tax = round((1600 - 1600/1.07) × 100)/100
    const subtotal = 800 * 2;
    const expectedTax = Math.round((subtotal - subtotal / 1.07) * 100) / 100;

    const result = computeBookingPrice({ unitPrice: 800, unit: 'PER_SITE', quantity: 1, nights: 2, vatRate: 0.07 });

    expect(result.vatInclusive).toBe(true);
    expect(result.taxRate).toBe(0.07);
    expect(result.taxAmount).toBe(expectedTax);
    expect(result.subtotalAmount).toBe(subtotal);
    // totalAmount still equals subtotalAmount (VAT is inclusive, not added on top)
    expect(result.totalAmount).toBe(subtotal);
  });

  it('[normal] spot price overrides priceLow (end-to-end through both functions)', () => {
    const resolved = resolveUnitPrice({
      campSitePriceLow: 800,
      campSitePriceUnit: null,
      spotPricePerNight: 1200,
      spotPriceUnit: null,
    });
    const result = computeBookingPrice({
      unitPrice: resolved.unitPrice,
      unit: resolved.unit,
      quantity: 1,
      nights: 2,
      vatRate: 0,
    });
    expect(result.unitAmount).toBe(1200);
    expect(result.subtotalAmount).toBe(2400);
    expect(result.totalAmount).toBe(2400);
  });

  it('[boundary] 0 nights → all amounts are 0, no crash', () => {
    const result = computeBookingPrice({ unitPrice: 800, unit: 'PER_SITE', quantity: 1, nights: 0, vatRate: 0 });
    expect(result.nights).toBe(0);
    expect(result.subtotalAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it('[boundary] 0 nights with VAT → taxAmount still 0', () => {
    const result = computeBookingPrice({ unitPrice: 800, unit: 'PER_SITE', quantity: 1, nights: 0, vatRate: 0.07 });
    expect(result.subtotalAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it('[boundary] negative nights are clamped to 0', () => {
    const result = computeBookingPrice({ unitPrice: 800, unit: 'PER_SITE', quantity: 1, nights: -1, vatRate: 0 });
    expect(result.nights).toBe(0);
    expect(result.subtotalAmount).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it('[boundary] 1 night is handled correctly', () => {
    const result = computeBookingPrice({ unitPrice: 500, unit: 'PER_SITE', quantity: 1, nights: 1, vatRate: 0 });
    expect(result.subtotalAmount).toBe(500);
    expect(result.totalAmount).toBe(500);
  });

  it('[null/empty] fallback unit price (50) × nights produces a valid result', () => {
    const resolved = resolveUnitPrice({
      campSitePriceLow: null,
      campSitePriceUnit: null,
      spotPricePerNight: null,
      spotPriceUnit: null,
    });
    const result = computeBookingPrice({
      unitPrice: resolved.unitPrice,
      unit: resolved.unit,
      quantity: 1,
      nights: 2,
      vatRate: 0,
    });
    expect(result.unitAmount).toBe(50);
    expect(result.subtotalAmount).toBe(100);
    expect(result.totalAmount).toBe(100);
  });

  it('[invariant] totalAmount === subtotalAmount for every combination (no fees)', () => {
    const cases: ComputeBookingPriceInput[] = [
      { unitPrice: 0, unit: 'PER_SITE', quantity: 1, nights: 0, vatRate: 0 },
      { unitPrice: 500, unit: 'PER_SITE', quantity: 1, nights: 3, vatRate: 0 },
      { unitPrice: 800, unit: 'PER_SITE', quantity: 1, nights: 5, vatRate: 0.07 },
      { unitPrice: 1500, unit: 'PER_SITE', quantity: 1, nights: 10, vatRate: 0.1 },
    ];
    for (const c of cases) {
      const r = computeBookingPrice(c);
      expect(r.totalAmount).toBe(r.subtotalAmount);
    }
  });

  it('[invariant] taxAmount is never added to totalAmount (VAT is inclusive, not on top)', () => {
    // Regression: ensure we do NOT do totalAmount = subtotal + taxAmount
    const result = computeBookingPrice({ unitPrice: 1000, unit: 'PER_SITE', quantity: 1, nights: 1, vatRate: 0.07 });
    expect(result.totalAmount).toBe(result.subtotalAmount);
    expect(result.totalAmount).not.toBe(result.subtotalAmount + result.taxAmount);
  });

  // -------------------------------------------------------------------------
  // extraFeeAmount (CAM-268 / PREP-2 / AC-1)
  // -------------------------------------------------------------------------
  describe('extraFeeAmount (CAM-268)', () => {
    it('[normal] totalAmount = subtotalAmount + extraFeeAmount when a fee is set', () => {
      const result = computeBookingPrice({
        unitPrice: 500,
        unit: 'PER_SITE',
        quantity: 1,
        nights: 2,
        vatRate: 0,
        extraFeeAmount: 40,
      });
      expect(result.subtotalAmount).toBe(1000);
      expect(result.extraFeeAmount).toBe(40);
      expect(result.totalAmount).toBe(1040);
    });

    it('[normal] the fee is charged once per stay, never multiplied by nights', () => {
      const oneNight = computeBookingPrice({
        unitPrice: 500,
        unit: 'PER_SITE',
        quantity: 1,
        nights: 1,
        vatRate: 0,
        extraFeeAmount: 40,
      });
      const fiveNights = computeBookingPrice({
        unitPrice: 500,
        unit: 'PER_SITE',
        quantity: 1,
        nights: 5,
        vatRate: 0,
        extraFeeAmount: 40,
      });
      expect(oneNight.extraFeeAmount).toBe(40);
      expect(fiveNights.extraFeeAmount).toBe(40); // same fee, not 40 × 5
    });

    it('[normal] fee combines with VAT-inclusive pricing without altering taxAmount', () => {
      const subtotal = 800 * 2;
      const expectedTax = Math.round((subtotal - subtotal / 1.07) * 100) / 100;
      const result = computeBookingPrice({
        unitPrice: 800,
        unit: 'PER_SITE',
        quantity: 1,
        nights: 2,
        vatRate: 0.07,
        extraFeeAmount: 50,
      });
      expect(result.taxAmount).toBe(expectedTax); // fee is not itself taxed by this module
      expect(result.totalAmount).toBe(subtotal + 50);
    });

    it('[null/empty] omitted extraFeeAmount defaults to 0 — total unchanged from CAM-58 behavior', () => {
      const result = computeBookingPrice({ unitPrice: 500, unit: 'PER_SITE', quantity: 1, nights: 2, vatRate: 0 });
      expect(result.extraFeeAmount).toBe(0);
      expect(result.totalAmount).toBe(result.subtotalAmount);
    });

    it('[null/empty] extraFeeAmount: 0 explicitly behaves the same as omitted', () => {
      const result = computeBookingPrice({
        unitPrice: 500,
        unit: 'PER_SITE',
        quantity: 1,
        nights: 2,
        vatRate: 0,
        extraFeeAmount: 0,
      });
      expect(result.totalAmount).toBe(result.subtotalAmount);
    });

    it('[boundary] a negative extraFeeAmount is clamped to 0 (defense-in-depth)', () => {
      const result = computeBookingPrice({
        unitPrice: 500,
        unit: 'PER_SITE',
        quantity: 1,
        nights: 1,
        vatRate: 0,
        extraFeeAmount: -20,
      });
      expect(result.extraFeeAmount).toBe(0);
      expect(result.totalAmount).toBe(result.subtotalAmount);
    });

    it('[boundary] a large extraFeeAmount is added in full', () => {
      const result = computeBookingPrice({
        unitPrice: 100,
        unit: 'PER_SITE',
        quantity: 1,
        nights: 1,
        vatRate: 0,
        extraFeeAmount: 100000,
      });
      expect(result.totalAmount).toBe(100100);
    });

    it('[invariant] totalAmount === subtotalAmount + extraFeeAmount for every combination', () => {
      const cases: ComputeBookingPriceInput[] = [
        { unitPrice: 0, unit: 'PER_SITE', quantity: 1, nights: 0, vatRate: 0, extraFeeAmount: 0 },
        { unitPrice: 500, unit: 'PER_SITE', quantity: 1, nights: 3, vatRate: 0, extraFeeAmount: 30 },
        { unitPrice: 800, unit: 'PER_SITE', quantity: 1, nights: 5, vatRate: 0.07, extraFeeAmount: 100 },
        { unitPrice: 1500, unit: 'PER_SITE', quantity: 1, nights: 10, vatRate: 0.1 }, // omitted → 0
      ];
      for (const c of cases) {
        const r = computeBookingPrice(c);
        expect(r.totalAmount).toBe(r.subtotalAmount + r.extraFeeAmount);
      }
    });
  });
});
