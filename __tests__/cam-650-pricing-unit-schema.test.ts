/**
 * cam-650-pricing-unit-schema.test.ts — CAM-650 (schema-only, epic CAM-648)
 *
 * The whole point of this story is that it changes NO behaviour: it lands
 * PricingUnit + CampSite.priceUnit + Spot.priceUnit (both @default(PER_SITE))
 * + Booking.snapshotPricingUnit/snapshotQuantity (both nullable, NOT
 * backfilled) so the follow-up engine story can be a pure logic change
 * against a proven-inert base.
 *
 * Two proofs, matching the story's done_when:
 *
 *  1. [pure unit, no DB] computeBookingPrice's output is byte-identical to
 *     before this change — asserted against hard-coded golden numbers, never
 *     a re-derived formula. CAM-651 (the follow-up engine story) made
 *     `unit`/`quantity` required inputs; these two calls now pass
 *     `unit: 'PER_SITE', quantity: 1` explicitly to keep asserting the exact
 *     same golden totals this story pinned (see also
 *     `__tests__/cam-651-pricing-engine-unit.test.ts` I2 "unit neutrality",
 *     which owns this invariant going forward).
 *
 *  2. [real DB, skipped when DATABASE_URL is absent — same gating pattern as
 *     __tests__/cam-617-location-exclusivity-real-db.test.ts] a Booking
 *     created without an explicit unit stores NULL for both new columns
 *     (never PER_SITE — that would assert a host choice that was never
 *     made), and a fresh CampSite/Spot row defaults to PER_SITE without the
 *     caller setting it (BR: today's math IS per-site, so every existing row
 *     keeps costing exactly what it costs). Every created row is a throwaway
 *     scratch row, deleted in `afterAll` regardless of pass/fail.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { config as loadDotenv } from 'dotenv';
import { computeBookingPrice } from '@/lib/booking-pricing';

// Vite/vitest's ambient .env injection is observed to be inconsistent across
// this repo's worker pool when this file runs in isolation (a sibling
// real-DB test file — cam-617 — sometimes ends up first to populate
// process.env). Load it explicitly and deterministically, same approach as
// scripts/setup-e2e-db.ts; a no-op if DATABASE_URL is already set.
loadDotenv();

// ---------------------------------------------------------------------------
// 1. computeBookingPrice — byte-identical golden numbers (proves the engine
//    was NOT touched by this schema-only story)
// ---------------------------------------------------------------------------
describe('CAM-650 — computeBookingPrice is unchanged (golden numbers, no guest/tent multiplier)', () => {
  it('[golden] 1 night at 250/night, no VAT, no fee -> totals 250 (the exact owner-reported gap: NOT 750 for 3 guests)', () => {
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
// 2. Real DB — schema defaults + NULL crystallization (skips in CI, runs on
//    localhost dev DB per CLAUDE.md Definition of Done)
// ---------------------------------------------------------------------------
const hasRealDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasRealDb)('CAM-650 (real DB) — priceUnit defaults + snapshot NULL, no price movement', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  let userId: string;
  let campSiteId: string;
  let scratchSpotId: string | undefined;
  let scratchBookingId: string | undefined;

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();

    const user = await prisma.user.findFirst({ select: { id: true } });
    if (!user) throw new Error('CAM-650 real-DB test needs at least one User row in the dev DB');
    userId = user.id;

    const campSite = await prisma.campSite.findFirst({ select: { id: true } });
    if (!campSite) throw new Error('CAM-650 real-DB test needs at least one CampSite row in the dev DB');
    campSiteId = campSite.id;
  });

  afterAll(async () => {
    if (scratchBookingId) {
      await prisma.booking.delete({ where: { id: scratchBookingId } }).catch(() => {});
    }
    if (scratchSpotId) {
      await prisma.spot.delete({ where: { id: scratchSpotId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('[normal] an existing (seeded) CampSite row defaults priceUnit to PER_SITE without ever setting it', async () => {
    const campSite = await prisma.campSite.findUnique({
      where: { id: campSiteId },
      select: { priceUnit: true },
    });
    expect(campSite.priceUnit).toBe('PER_SITE');
  });

  it('[normal] a freshly created Spot defaults priceUnit to PER_SITE without the caller setting it', async () => {
    const spot = await prisma.spot.create({
      data: {
        name: 'CAM-650 scratch spot (deleted in afterAll)',
        pricePerNight: 350,
        campSiteId,
        // priceUnit intentionally omitted — proving the schema default fires
      },
      select: { id: true, priceUnit: true },
    });
    scratchSpotId = spot.id;
    expect(spot.priceUnit).toBe('PER_SITE');
  });

  it('[null/empty] a Booking created without an explicit unit stores NULL for snapshotPricingUnit and snapshotQuantity (never PER_SITE)', async () => {
    const booking = await prisma.booking.create({
      data: {
        checkInDate: new Date('2026-08-01T00:00:00.000Z'),
        checkOutDate: new Date('2026-08-02T00:00:00.000Z'),
        totalPrice: 250,
        userId,
        campSiteId,
        // snapshotPricingUnit / snapshotQuantity intentionally omitted —
        // NULL means "booked before this change"; this story must never
        // backfill/assert a unit the host was never asked to choose.
      },
      select: { id: true, snapshotPricingUnit: true, snapshotQuantity: true },
    });
    scratchBookingId = booking.id;
    expect(booking.snapshotPricingUnit).toBeNull();
    expect(booking.snapshotQuantity).toBeNull();
  });
});
