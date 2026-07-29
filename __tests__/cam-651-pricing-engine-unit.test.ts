/**
 * cam-651-pricing-engine-unit.test.ts — CAM-651 (epic CAM-648, ADR-014):
 * the pricing engine knows what it is charging per.
 *
 * `computeBookingPrice` used to charge `unitPrice × nights` with no guest
 * multiplier — 3 guests × 1 night at ฿250 totalled ฿250, not the owner's
 * expected ฿750. CAM-650 landed the schema (`PricingUnit`,
 * `CampSite.priceUnit`/`Spot.priceUnit` both `@default(PER_SITE)`) proven
 * inert. This story teaches the engine to actually multiply by `quantity` —
 * but BOTH real call sites (`app/api/bookings/route.ts`,
 * `components/CampgroundDetailClient.tsx`) still force `PER_SITE` +
 * `quantity: 1` today, so no camp is charged differently yet (CAM-652
 * threads the real values).
 *
 * I1-I8 below are the matrix that actually carries this story's weight —
 * see the story ticket's `## Self-verify` / done_when.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { PricingUnit as PrismaPricingUnit } from '@prisma/client';
import {
  resolveUnitPrice,
  resolveQuantity,
  computeBookingPrice,
  buildBookingPriceArgs,
  type PricingUnit,
} from '@/lib/booking-pricing';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

const ALL_UNITS: readonly PricingUnit[] = ['PER_PERSON', 'PER_TENT', 'PER_SITE'];

// ---------------------------------------------------------------------------
// I1 — subtotal === unitPrice × quantity × nights, over a full matrix
// ---------------------------------------------------------------------------
describe('I1 — subtotal === unitPrice × quantity × nights (the bug this story fixes)', () => {
  const unitPrice = 250; // the owner's exact reported price
  const nightsRange = [0, 1, 2, 3, 4, 5];
  const quantityRange = [1, 2, 3, 4, 5];

  for (const unit of ALL_UNITS) {
    for (const quantity of quantityRange) {
      for (const nights of nightsRange) {
        it(`[matrix] unit=${unit} quantity=${quantity} nights=${nights} -> subtotal = ${unitPrice}×${quantity}×${nights}`, () => {
          const result = computeBookingPrice({ unitPrice, unit, quantity, nights, vatRate: 0 });
          expect(result.subtotalAmount).toBe(unitPrice * quantity * nights);
        });
      }
    }
  }

  it('[the exact reported gap] PER_PERSON, 3 guests, 1 night, ฿250 -> ฿750 (NOT ฿250)', () => {
    const result = computeBookingPrice({ unitPrice: 250, unit: 'PER_PERSON', quantity: 3, nights: 1, vatRate: 0 });
    expect(result.subtotalAmount).toBe(750);
    expect(result.totalAmount).toBe(750);
  });
});

// ---------------------------------------------------------------------------
// I2 — unit neutrality: PER_SITE + quantity 1 reproduces TODAY's output,
// pinned against hard-coded golden numbers (never a re-derived formula) so
// this guard breaks the instant PER_SITE stops meaning "today's math".
// ---------------------------------------------------------------------------
describe('I2 — PER_SITE + quantity 1 golden numbers (forward-only migration guard)', () => {
  it('[golden] 1 night at 250/night, no VAT, no fee -> totals 250 (the owner-reported camp, unchanged today)', () => {
    const result = computeBookingPrice({ unitPrice: 250, unit: 'PER_SITE', quantity: 1, nights: 1, vatRate: 0 });
    expect(result).toEqual({
      unitAmount: 250,
      subtotalAmount: 250,
      nights: 1,
      taxRate: 0,
      taxAmount: 0,
      vatInclusive: false,
      extraFeeAmount: 0,
      totalAmount: 250,
    });
  });

  it('[golden] 3 nights at 500/night + 100 one-time fee + 7% VAT -> matches the pinned CAM-268-era total', () => {
    const result = computeBookingPrice({
      unitPrice: 500,
      unit: 'PER_SITE',
      quantity: 1,
      nights: 3,
      vatRate: 0.07,
      extraFeeAmount: 100,
    });
    expect(result).toEqual({
      unitAmount: 500,
      subtotalAmount: 1500,
      nights: 3,
      taxRate: 0.07,
      taxAmount: 98.13,
      vatInclusive: true,
      extraFeeAmount: 100,
      totalAmount: 1600,
    });
  });
});

// ---------------------------------------------------------------------------
// I3 — extraFeeAmount is never multiplied by quantity (extends CAM-268's
// nights guard onto the new quantity axis)
// ---------------------------------------------------------------------------
describe('I3 — extraFeeAmount is charged once per stay, never multiplied by quantity', () => {
  const quantities = [1, 2, 3, 5];

  it.each(quantities)('[quantity=%i] extraFeeAmount stays 40 regardless of quantity', (quantity) => {
    const result = computeBookingPrice({
      unitPrice: 500,
      unit: 'PER_PERSON',
      quantity,
      nights: 2,
      vatRate: 0,
      extraFeeAmount: 40,
    });
    expect(result.extraFeeAmount).toBe(40); // never 40 × quantity
  });

  it('[invariant] totalAmount === subtotalAmount + extraFeeAmount across the quantity axis', () => {
    for (const quantity of quantities) {
      const result = computeBookingPrice({
        unitPrice: 300,
        unit: 'PER_PERSON',
        quantity,
        nights: 2,
        vatRate: 0,
        extraFeeAmount: 75,
      });
      expect(result.totalAmount).toBe(result.subtotalAmount + 75);
      expect(result.subtotalAmount).toBe(300 * quantity * 2);
    }
  });
});

// ---------------------------------------------------------------------------
// I4 — VAT semantics are unchanged by the quantity axis (verbatim assertion
// style from booking-pricing.test.ts, extended with unit/quantity)
// ---------------------------------------------------------------------------
describe('I4 — VAT extraction is unchanged (inclusive, never added on top, quantity-neutral)', () => {
  it('[unchanged] VAT-inclusive: extracts tax from subtotal (Thai 7% VAT) regardless of quantity', () => {
    const quantity = 4;
    const subtotal = 800 * quantity * 2; // unitPrice × quantity × nights
    const expectedTax = Math.round((subtotal - subtotal / 1.07) * 100) / 100;

    const result = computeBookingPrice({
      unitPrice: 800,
      unit: 'PER_PERSON',
      quantity,
      nights: 2,
      vatRate: 0.07,
    });

    expect(result.vatInclusive).toBe(true);
    expect(result.taxRate).toBe(0.07);
    expect(result.taxAmount).toBe(expectedTax);
    expect(result.subtotalAmount).toBe(subtotal);
    // totalAmount still equals subtotalAmount — VAT is inclusive, not added on top
    expect(result.totalAmount).toBe(subtotal);
  });

  it('[unchanged] taxAmount is never added to totalAmount, for any quantity', () => {
    const result = computeBookingPrice({ unitPrice: 1000, unit: 'PER_PERSON', quantity: 3, nights: 1, vatRate: 0.07 });
    expect(result.totalAmount).toBe(result.subtotalAmount);
    expect(result.totalAmount).not.toBe(result.subtotalAmount + result.taxAmount);
  });
});

// ---------------------------------------------------------------------------
// I5 — resolver coupling: a price is never paired with another row's unit
// ---------------------------------------------------------------------------
describe('I5 — resolveUnitPrice never pairs a price with another row\'s unit', () => {
  const table: Array<{
    name: string;
    spotPricePerNight: number | null;
    spotPriceUnit: PricingUnit | null;
    campSitePriceLow: number | null;
    campSitePriceUnit: PricingUnit | null;
    expectSource: 'SPOT' | 'CAMP' | 'FALLBACK';
    expectUnit: PricingUnit;
  }> = [
    {
      name: 'spot present (PER_PERSON) + camp present (PER_SITE) -> SPOT wins, carries SPOT unit',
      spotPricePerNight: 400,
      spotPriceUnit: 'PER_PERSON',
      campSitePriceLow: 900,
      campSitePriceUnit: 'PER_SITE',
      expectSource: 'SPOT',
      expectUnit: 'PER_PERSON',
    },
    {
      name: 'spot present (PER_TENT), camp absent -> SPOT wins, carries SPOT unit',
      spotPricePerNight: 350,
      spotPriceUnit: 'PER_TENT',
      campSitePriceLow: null,
      campSitePriceUnit: null,
      expectSource: 'SPOT',
      expectUnit: 'PER_TENT',
    },
    {
      name: 'spot absent, camp present (PER_PERSON) -> CAMP wins, carries CAMP unit',
      spotPricePerNight: null,
      spotPriceUnit: null,
      campSitePriceLow: 250,
      campSitePriceUnit: 'PER_PERSON',
      expectSource: 'CAMP',
      expectUnit: 'PER_PERSON',
    },
    {
      name: 'spot absent, camp present with a null unit -> CAMP wins, unit normalises to PER_SITE',
      spotPricePerNight: null,
      spotPriceUnit: null,
      campSitePriceLow: 600,
      campSitePriceUnit: null,
      expectSource: 'CAMP',
      expectUnit: 'PER_SITE',
    },
    {
      name: 'spot absent, camp absent -> FALLBACK, always PER_SITE (never presented as a host choice)',
      spotPricePerNight: null,
      spotPriceUnit: null,
      campSitePriceLow: null,
      campSitePriceUnit: null,
      expectSource: 'FALLBACK',
      expectUnit: 'PER_SITE',
    },
    {
      name: 'spot price is 0 (treated as absent) even with a spot unit set -> falls through to CAMP unit',
      spotPricePerNight: 0,
      spotPriceUnit: 'PER_PERSON',
      campSitePriceLow: 700,
      campSitePriceUnit: 'PER_SITE',
      expectSource: 'CAMP',
      expectUnit: 'PER_SITE',
    },
  ];

  it.each(table)('[$name]', ({ spotPricePerNight, spotPriceUnit, campSitePriceLow, campSitePriceUnit, expectSource, expectUnit }) => {
    const result = resolveUnitPrice({ campSitePriceLow, campSitePriceUnit, spotPricePerNight, spotPriceUnit });
    expect(result.source).toBe(expectSource);
    expect(result.unit).toBe(expectUnit);
    if (expectSource === 'SPOT') expect(result.unit).toBe(spotPriceUnit);
    if (expectSource === 'CAMP') expect(result.unit).toBe(campSitePriceUnit ?? 'PER_SITE');
    if (expectSource === 'FALLBACK') expect(result.unit).toBe('PER_SITE');
  });
});

// ---------------------------------------------------------------------------
// I6 — client/server parity, structural: both real call sites go through
// buildBookingPriceArgs; NEITHER calls computeBookingPrice with an object
// literal directly (that would risk re-deriving unit/quantity divergently).
// ---------------------------------------------------------------------------
describe('I6 — client/server parity (structural, source-inspection)', () => {
  const routeSrc = src('app/api/bookings/route.ts');
  const detailSrc = src('components/CampgroundDetailClient.tsx');

  it('[route] app/api/bookings/route.ts calls buildBookingPriceArgs(', () => {
    expect(routeSrc).toContain('buildBookingPriceArgs(');
  });

  it('[detail page] components/CampgroundDetailClient.tsx calls buildBookingPriceArgs(', () => {
    expect(detailSrc).toContain('buildBookingPriceArgs(');
  });

  it('[route] never calls computeBookingPrice({ directly (object-literal call)', () => {
    expect(routeSrc).not.toContain('computeBookingPrice({');
  });

  it('[detail page] never calls computeBookingPrice({ directly (object-literal call)', () => {
    expect(detailSrc).not.toContain('computeBookingPrice({');
  });
});

// ---------------------------------------------------------------------------
// I7 — enum exhaustiveness: the client-safe local union can never silently
// drift from the real Prisma.PricingUnit enum (server-only test — imports
// @prisma/client, which lib/booking-pricing.ts itself deliberately does not).
// ---------------------------------------------------------------------------
describe('I7 — local PricingUnit union stays in sync with the Prisma enum', () => {
  it('[enum exhaustiveness] every local union member exists in Prisma.PricingUnit, and vice versa', () => {
    const localMembers: PricingUnit[] = ['PER_PERSON', 'PER_TENT', 'PER_SITE'];
    const prismaMembers = Object.keys(PrismaPricingUnit);

    expect(new Set(localMembers)).toEqual(new Set(prismaMembers));
    expect(localMembers.length).toBe(prismaMembers.length);
  });
});

// ---------------------------------------------------------------------------
// I8 — boundary: quantity <= 0 clamps to 1; PER_TENT with no tent count is a
// clean {ok:false}, never a throw.
// ---------------------------------------------------------------------------
describe('I8 — boundary: quantity clamp + PER_TENT without a tent count', () => {
  it('[boundary] computeBookingPrice clamps quantity 0 to 1', () => {
    const result = computeBookingPrice({ unitPrice: 500, unit: 'PER_PERSON', quantity: 0, nights: 1, vatRate: 0 });
    expect(result.subtotalAmount).toBe(500); // 500 × 1 × 1, not 0
  });

  it('[boundary] computeBookingPrice clamps a negative quantity to 1', () => {
    const result = computeBookingPrice({ unitPrice: 500, unit: 'PER_PERSON', quantity: -3, nights: 1, vatRate: 0 });
    expect(result.subtotalAmount).toBe(500);
  });

  it('[boundary] resolveQuantity(PER_TENT, no tents) returns {ok:false} and never throws', () => {
    expect(() => resolveQuantity('PER_TENT', { guests: 2 })).not.toThrow();
    const result = resolveQuantity('PER_TENT', { guests: 2 });
    expect(result).toEqual({ ok: false, reason: 'TENT_COUNT_UNAVAILABLE' });
  });

  it('[boundary] resolveQuantity(PER_TENT, tents present) resolves ok', () => {
    const result = resolveQuantity('PER_TENT', { guests: 2, tents: 2 });
    expect(result).toEqual({ ok: true, quantity: 2 });
  });

  it('[boundary] buildBookingPriceArgs propagates {ok:false, reason: TENT_COUNT_UNAVAILABLE} for a PER_TENT camp with no tent count, never throws', () => {
    expect(() =>
      buildBookingPriceArgs({
        campSite: { priceLow: 400, priceUnit: 'PER_TENT', extraFeeAmount: null },
        spot: null,
        party: { guests: 2 },
        nights: 1,
        vatRate: 0,
      })
    ).not.toThrow();

    const result = buildBookingPriceArgs({
      campSite: { priceLow: 400, priceUnit: 'PER_TENT', extraFeeAmount: null },
      spot: null,
      party: { guests: 2 },
      nights: 1,
      vatRate: 0,
    });
    expect(result).toEqual({ ok: false, reason: 'TENT_COUNT_UNAVAILABLE' });
  });

  it('[boundary] resolveQuantity(PER_PERSON, guests 0) clamps to 1 (a booking is never for 0 people)', () => {
    expect(resolveQuantity('PER_PERSON', { guests: 0 })).toEqual({ ok: true, quantity: 1 });
  });

  it('[boundary] resolveQuantity(PER_SITE, ...) always resolves quantity 1 regardless of party size', () => {
    expect(resolveQuantity('PER_SITE', { guests: 12, tents: 5 })).toEqual({ ok: true, quantity: 1 });
  });
});

// ---------------------------------------------------------------------------
// buildBookingPriceArgs — happy path sanity, PER_SITE explicitly passed in
// (CAM-652 threads the REAL per-camp/spot unit through the two call sites —
// this is a pure unit test of the builder itself with PER_SITE as the input,
// not a claim about what either caller forces).
// ---------------------------------------------------------------------------
describe('buildBookingPriceArgs — happy path (explicit PER_SITE input)', () => {
  it('[normal] campSite-only pricing, PER_SITE, quantity 1 — matches pre-CAM-651 output', () => {
    const result = buildBookingPriceArgs({
      campSite: { priceLow: 250, priceUnit: 'PER_SITE', extraFeeAmount: null },
      spot: null,
      party: { guests: 1 },
      nights: 1,
      vatRate: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    const pricing = computeBookingPrice(result.input);
    expect(pricing.totalAmount).toBe(250);
  });

  it('[normal] a spot price overrides the camp price, both forced PER_SITE', () => {
    const result = buildBookingPriceArgs({
      campSite: { priceLow: 800, priceUnit: 'PER_SITE', extraFeeAmount: null },
      spot: { pricePerNight: 1200, priceUnit: 'PER_SITE' },
      party: { guests: 1 },
      nights: 2,
      vatRate: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.input.unitPrice).toBe(1200);
    expect(computeBookingPrice(result.input).totalAmount).toBe(2400);
  });
});
