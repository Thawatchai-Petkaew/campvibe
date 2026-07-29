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
 * CAM-651 (epic CAM-648, ADR-014): the engine now knows WHAT a price is charged
 * per — `PricingUnit` travels with the price (never re-paired with another row's
 * unit) and `computeBookingPrice` requires an explicit `quantity` (no default —
 * a default is exactly how the missing guest multiplier survived CAM-58 and
 * CAM-268; making it required turns every call site into a compiler-enumerated
 * list, see `.claude/rules/api.md` §11 discriminated unions). This story does
 * NOT change what any camp is charged: both existing call sites
 * (`app/api/bookings/route.ts`, `components/CampgroundDetailClient.tsx`) force
 * `PER_SITE` + `quantity: 1` through `buildBookingPriceArgs` — CAM-652 threads
 * the real per-camp/spot unit and party size.
 *
 * `PricingUnit` below is a LOCAL union, deliberately NOT imported from
 * `@prisma/client` — this module is imported by client components ("use client"),
 * and the Prisma client must never ship in a client bundle. A server-only test
 * (`__tests__/cam-651-pricing-engine-unit.test.ts`, I7) asserts this union stays
 * byte-for-byte in sync with the real `Prisma.PricingUnit` enum, so the two can
 * never silently drift apart.
 *
 * Money note (ADR-002): DB stores Decimal; callers pass Number here (the API
 * already converts priceLow / pricePerNight via Number() before calling). THB
 * has no sub-unit concerns at 2 dp.
 */

/**
 * @public
 * Local, client-safe mirror of the Prisma `PricingUnit` enum (ADR-014 / CAM-650).
 * Kept as a plain string union (not `import { PricingUnit } from '@prisma/client'`)
 * because this module is imported by `"use client"` components — importing the
 * Prisma client there would ship server-only code into the browser bundle.
 */
export type PricingUnit = 'PER_PERSON' | 'PER_TENT' | 'PER_SITE';

/**
 * Normalises a possibly-null/undefined unit to `PER_SITE` — the single place
 * that decides "no unit recorded" means "per site" (matches the Prisma column
 * default set by CAM-650, and today's math, which has never had a guest
 * multiplier). Every caller of `resolveUnitPrice` goes through this — do not
 * re-implement the `null → PER_SITE` fallback anywhere else.
 */
function normalizeUnit(unit: PricingUnit | null | undefined): PricingUnit {
  return unit ?? 'PER_SITE';
}

/** @public */
export interface ResolveUnitPriceInput {
  /** campSite.priceLow converted to number (may be null/undefined) */
  campSitePriceLow: number | null | undefined;
  /** campSite.priceUnit (may be null/undefined pre-migration or in a test fixture) */
  campSitePriceUnit: PricingUnit | null | undefined;
  /** selected spot's pricePerNight converted to number (absent when no spotId) */
  spotPricePerNight: number | null | undefined;
  /** selected spot's priceUnit (absent when no spotId) */
  spotPriceUnit: PricingUnit | null | undefined;
}

/** @public */
export interface ResolveUnitPriceResult {
  /** the per-night price to charge */
  unitPrice: number;
  /**
   * the unit `unitPrice` is charged per — ALWAYS the unit that came from the
   * SAME row as `unitPrice` (never a different row's unit); a fabricated
   * fallback price is always tagged `PER_SITE`, never presented as a host's
   * choice.
   */
  unit: PricingUnit;
  /** which row `unitPrice`/`unit` came from */
  source: 'SPOT' | 'CAMP' | 'FALLBACK';
}

/**
 * resolveUnitPrice — returns the per-night price to charge, plus the unit it
 * is charged per and which row it came from.
 *
 * Priority (unchanged since CAM-58): spot price (when present and > 0) →
 * campSite priceLow → fallback 50. Each branch carries its OWN row's unit —
 * a price is never paired with another row's unit. Mirrors the logic that
 * was inline in app/api/bookings/route.ts lines 76-80.
 */
export function resolveUnitPrice({
  campSitePriceLow,
  campSitePriceUnit,
  spotPricePerNight,
  spotPriceUnit,
}: ResolveUnitPriceInput): ResolveUnitPriceResult {
  if (spotPricePerNight !== null && spotPricePerNight !== undefined && spotPricePerNight > 0) {
    return { unitPrice: spotPricePerNight, unit: normalizeUnit(spotPriceUnit), source: 'SPOT' };
  }
  if (campSitePriceLow !== null && campSitePriceLow !== undefined && campSitePriceLow > 0) {
    return { unitPrice: campSitePriceLow, unit: normalizeUnit(campSitePriceUnit), source: 'CAMP' };
  }
  // sane fallback (THB) when no price is configured — a fabricated number is
  // never multiplied by a party size, so it is always tagged PER_SITE.
  return { unitPrice: 50, unit: 'PER_SITE', source: 'FALLBACK' };
}

/** @public */
export interface ResolveQuantityParty {
  guests: number;
  tents?: number;
}

/** @public */
export type ResolveQuantityResult =
  | { ok: true; quantity: number }
  | { ok: false; reason: 'TENT_COUNT_UNAVAILABLE' };

/**
 * resolveQuantity — turns a PricingUnit + party size into the multiplier
 * `computeBookingPrice` applies.
 *
 * PER_SITE -> 1 (unchanged — no guest multiplier, matches every existing row).
 * PER_PERSON -> max(1, guests) — a booking is never for 0 people.
 * PER_TENT -> the caller's tent count when present, else `{ok:false}` — no
 * client sends a tent count today (`POST /api/bookings` sends only `guests`),
 * so this branch is unreachable in practice; it must stay that way until a
 * story ships tent-count capture in the booking flow (ADR-014 §1).
 */
export function resolveQuantity(
  unit: PricingUnit,
  party: ResolveQuantityParty
): ResolveQuantityResult {
  if (unit === 'PER_SITE') {
    return { ok: true, quantity: 1 };
  }
  if (unit === 'PER_PERSON') {
    return { ok: true, quantity: Math.max(1, party.guests) };
  }
  // PER_TENT
  if (party.tents !== undefined && party.tents !== null) {
    return { ok: true, quantity: party.tents };
  }
  return { ok: false, reason: 'TENT_COUNT_UNAVAILABLE' };
}

/** @public */
export interface ComputeBookingPriceInput {
  unitPrice: number;
  /** the unit `unitPrice` is charged per (CAM-651) */
  unit: PricingUnit;
  /**
   * the multiplier to apply — REQUIRED, never defaulted. A default here is
   * exactly how the missing guest multiplier survived two prior stories
   * (CAM-58, CAM-268); making it required forces every call site through the
   * compiler.
   */
  quantity: number;
  nights: number;
  /** vatRate as a decimal fraction, e.g. 0.07 for 7% Thai VAT (0 = no VAT) */
  vatRate: number;
  /**
   * PREP-2 (CAM-268): the camp's atomic CampSite.extraFeeAmount, charged ONCE per
   * stay (never multiplied by nights, and never multiplied by quantity — CAM-651
   * keeps this rule unchanged). Optional; defaults to 0 so every existing
   * caller that omits it keeps the prior no-fee total unchanged. Negative input is
   * clamped to 0 (defensive — the zod boundary already rejects negative values).
   */
  extraFeeAmount?: number;
}

/** @public */
export interface BookingPriceResult {
  /** per-night price used */
  unitAmount: number;
  /** unitAmount × quantity × nights (CAM-651) */
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
 * subtotalAmount === unitPrice × quantity × nights (CAM-651 — quantity was
 * always silently 1 before this story; PER_SITE callers still get exactly
 * that today).
 * VAT is extracted from the inclusive subtotal exactly as the API did inline
 * (lines 95-97 of the original route.ts, pre-CAM-58).
 */
export function computeBookingPrice({
  unitPrice,
  quantity,
  nights,
  vatRate,
  extraFeeAmount = 0,
}: ComputeBookingPriceInput): BookingPriceResult {
  const safeNights = Math.max(0, nights);
  // I8: a booking is never for 0 (or fewer) people/tents/sites — mirrors the
  // existing Math.max(0, nights) defensive clamp, floored at 1 instead of 0
  // because quantity multiplies revenue rather than counting elapsed nights.
  const safeQuantity = Math.max(1, quantity);
  const subtotalAmount = unitPrice * safeQuantity * safeNights;
  const vatInclusive = vatRate > 0;
  const taxAmount = vatInclusive
    ? Math.round((subtotalAmount - subtotalAmount / (1 + vatRate)) * 100) / 100
    : 0;
  const safeExtraFeeAmount = Math.max(0, extraFeeAmount);
  const totalAmount = subtotalAmount + safeExtraFeeAmount; // CAM-268: additive atomic fee, never multiplied by quantity

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

/** @public */
export interface BuildBookingPriceArgsInput {
  campSite: {
    priceLow: number | null;
    priceUnit: PricingUnit | null;
    extraFeeAmount: number | null;
  };
  spot?: { pricePerNight: number | null; priceUnit: PricingUnit | null } | null;
  party: ResolveQuantityParty;
  nights: number;
  vatRate: number;
}

/** @public */
export type BuildBookingPriceArgsResult =
  | { ok: true; input: ComputeBookingPriceInput }
  | { ok: false; reason: 'TENT_COUNT_UNAVAILABLE' };

/**
 * buildBookingPriceArgs — the ONE place both booking-price call sites
 * (`app/api/bookings/route.ts`, `components/CampgroundDetailClient.tsx`) build
 * a `ComputeBookingPriceInput`. Wires `resolveUnitPrice` (which row's price +
 * unit) into `resolveQuantity` (unit + party -> multiplier) so a caller can
 * never pair one row's price with another row's unit, and never forgets to
 * resolve a quantity for the unit it got back (CAM-651).
 */
export function buildBookingPriceArgs({
  campSite,
  spot,
  party,
  nights,
  vatRate,
}: BuildBookingPriceArgsInput): BuildBookingPriceArgsResult {
  const resolved = resolveUnitPrice({
    campSitePriceLow: campSite.priceLow,
    campSitePriceUnit: campSite.priceUnit,
    spotPricePerNight: spot?.pricePerNight,
    spotPriceUnit: spot?.priceUnit,
  });

  const quantityResult = resolveQuantity(resolved.unit, party);
  if (!quantityResult.ok) {
    return { ok: false, reason: quantityResult.reason };
  }

  return {
    ok: true,
    input: {
      unitPrice: resolved.unitPrice,
      unit: resolved.unit,
      quantity: quantityResult.quantity,
      nights,
      vatRate,
      extraFeeAmount: campSite.extraFeeAmount ?? undefined,
    },
  };
}
