/**
 * cam-619-coordinates-and-price.test.ts — CAM-619
 *
 * Zod-boundary unit coverage for two of the five sibling-asymmetry defects:
 *   AC-1/BR-1 — `campSiteSchema.latitude`/`longitude` now share the SAME
 *     -90..90/-180..180 + `.finite()` bound `POST /api/location` already
 *     enforces for the same host pin (was a bare `z.number()`, no bound).
 *   AC-2/BR-2 — `campSiteSchema.priceLow`/`priceHigh` now carry `.min(0)
 *     .max(100000)` (matching `extraFeeAmount` in the same file) AND a
 *     `priceLow<=priceHigh` cross-field check via `isPriceOrderValid`.
 *
 * These are rejected-input tests that FAIL on the pre-fix schema (bare
 * `z.number()`, no `isPriceOrderValid` export) and PASS once the bound is in
 * place — the "teeth" the ticket asks for at the zod layer. The trigger-
 * propagation proof itself lives in a separate real-DB test
 * (cam-619-coordinate-trigger-guard.test.ts) and a mocked-route test
 * (cam-619-campsites-rate-limit.test.ts's price-order case) — this file only
 * proves the boundary rejects, per qa.md's unit-layer scope.
 */
import { describe, it, expect } from 'vitest';
import { campSiteSchema, isPriceOrderValid, PRICE_ORDER_ERROR } from '@/lib/validations/campsite';

const VALID_BASE = {
  nameTh: 'ทดสอบ',
  campSiteType: 'CAGD' as const,
  latitude: 13.75,
  longitude: 100.5,
  checkInTime: '12:00',
  checkOutTime: '12:00',
  bookingMethod: 'ONST' as const,
  locationId: '550e8400-e29b-41d4-a716-446655440000',
};

describe('campSiteSchema.latitude/longitude — CAM-619 AC-1/BR-1', () => {
  it('[normal] a valid Thailand-range coordinate pair passes', () => {
    const result = campSiteSchema.safeParse(VALID_BASE);
    expect(result.success).toBe(true);
  });

  it('[boundary] the exact edge values (-90/90, -180/180) pass', () => {
    expect(campSiteSchema.safeParse({ ...VALID_BASE, latitude: -90, longitude: -180 }).success).toBe(true);
    expect(campSiteSchema.safeParse({ ...VALID_BASE, latitude: 90, longitude: 180 }).success).toBe(true);
  });

  it('[error/validation, teeth] latitude 999 (out of range) is REJECTED', () => {
    const result = campSiteSchema.safeParse({ ...VALID_BASE, latitude: 999 });
    expect(result.success).toBe(false);
  });

  it('[error/validation, teeth] longitude -999 (out of range) is REJECTED', () => {
    const result = campSiteSchema.safeParse({ ...VALID_BASE, longitude: -999 });
    expect(result.success).toBe(false);
  });

  it('[error/validation, teeth] Infinity is REJECTED (was previously accepted by a bare z.number())', () => {
    expect(campSiteSchema.safeParse({ ...VALID_BASE, latitude: Infinity }).success).toBe(false);
    expect(campSiteSchema.safeParse({ ...VALID_BASE, longitude: -Infinity }).success).toBe(false);
  });

  it('[error/validation] NaN is rejected', () => {
    expect(campSiteSchema.safeParse({ ...VALID_BASE, latitude: NaN }).success).toBe(false);
  });

  it('[normal] a partial (PUT-shape) update with only a valid latitude passes', () => {
    const result = campSiteSchema.partial().safeParse({ latitude: 18.79 });
    expect(result.success).toBe(true);
  });

  it('[error/validation, teeth] a partial (PUT-shape) update with an out-of-range latitude is REJECTED', () => {
    const result = campSiteSchema.partial().safeParse({ latitude: 999 });
    expect(result.success).toBe(false);
  });
});

describe('campSiteSchema.priceLow/priceHigh — CAM-619 AC-2/BR-2 (range)', () => {
  it('[normal] priceLow=500, priceHigh=1200 passes', () => {
    const result = campSiteSchema.safeParse({ ...VALID_BASE, priceLow: 500, priceHigh: 1200 });
    expect(result.success).toBe(true);
  });

  it('[boundary] the exact edges 0 and 100000 pass', () => {
    expect(campSiteSchema.safeParse({ ...VALID_BASE, priceLow: 0, priceHigh: 100000 }).success).toBe(true);
  });

  it('[error/validation, teeth] a negative priceLow is REJECTED (was previously accepted)', () => {
    const result = campSiteSchema.safeParse({ ...VALID_BASE, priceLow: -1 });
    expect(result.success).toBe(false);
  });

  it('[error/validation, teeth] priceHigh above 100,000 is REJECTED', () => {
    const result = campSiteSchema.safeParse({ ...VALID_BASE, priceHigh: 100001 });
    expect(result.success).toBe(false);
  });

  it('[normal] null (explicit clear) is still accepted on both fields', () => {
    const result = campSiteSchema.partial().safeParse({ priceLow: null, priceHigh: null });
    expect(result.success).toBe(true);
  });
});

describe('isPriceOrderValid — CAM-619 AC-2/BR-2 (cross-field order)', () => {
  it('[normal] priceLow <= priceHigh is valid', () => {
    expect(isPriceOrderValid({ priceLow: 500, priceHigh: 1200 })).toBe(true);
  });

  it('[boundary] priceLow === priceHigh is valid', () => {
    expect(isPriceOrderValid({ priceLow: 500, priceHigh: 500 })).toBe(true);
  });

  it('[error/validation, teeth] priceLow > priceHigh is REJECTED', () => {
    expect(isPriceOrderValid({ priceLow: 5000, priceHigh: 1000 })).toBe(false);
  });

  it('[normal] either side null/undefined always passes (nothing to compare yet)', () => {
    expect(isPriceOrderValid({ priceLow: 5000, priceHigh: null })).toBe(true);
    expect(isPriceOrderValid({ priceLow: null, priceHigh: 1000 })).toBe(true);
    expect(isPriceOrderValid({})).toBe(true);
  });

  it('PRICE_ORDER_ERROR is the exact Thai copy already shown client-side (minPriceError)', () => {
    expect(PRICE_ORDER_ERROR).toBe('ราคาต่ำสุดไม่สามารถมากกว่าราคาสูงสุดได้');
  });
});

describe('campSiteSchema still supports .partial() — CAM-619 BR-2 compile-time guard', () => {
  it('[normal] campSiteSchema.partial() is callable (proves no top-level .refine() was added to the object)', () => {
    expect(typeof campSiteSchema.partial).toBe('function');
    const result = campSiteSchema.partial().safeParse({});
    expect(result.success).toBe(true);
  });
});
