---
linear: CAM-58
feature: bookings-trips
epic: camper-availability-booking (CAM-23)
persona: camper
artifact: tech
owner: architect
status: Done
version: v1
updated: 2026-06-23
---
# Tech — แก้ bug ความโปร่งใสค่าธรรมเนียม (CAM-58)

> Rich-contract artifact: the fix introduces a shared pricing module used by both the
> server route and the client widget, so the contract + invariant are recorded here.
> No schema change (no migration) — the durable Booking model lives in `prisma/schema.prisma`
> + `docs/adr/ADR-005-booking-snapshot.md`.

## Data model
No new fields, no migration. The `Booking` model is unchanged — `totalPrice` (Decimal) + the
crystallized `snapshot…` block already exist (ADR-005). CAM-58 only changes *how* the price
fields are computed before they are written:

- `snapshotUnitAmount` ← `resolveUnitPrice(...)`
- `snapshotSubtotalAmount` ← `computeBookingPrice(...).subtotalAmount`
- `snapshotTaxRate` / `snapshotTaxAmount` / `snapshotVatInclusive` ← `computeBookingPrice(...)` (VAT from `Country.vatRate`, extracted inclusive)
- `snapshotTotalAmount` and `totalPrice` ← `computeBookingPrice(...).totalAmount`

Money note (ADR-002): the DB stores `Decimal`; the API converts `priceLow`/`pricePerNight`
via `Number()` before calling the pricing module, which computes in `number` (THB, 2 dp).

## Shared module contract — `lib/booking-pricing.ts`
Pure, framework-agnostic. Single source of truth imported by `app/api/bookings/route.ts`
(server) and `components/CampgroundDetailClient.tsx` (UI) so the displayed total always
equals the recorded total.

```ts
resolveUnitPrice({
  campSitePriceLow: number | null | undefined,
  spotPricePerNight: number | null | undefined,
}): number
// Priority: spotPricePerNight (when present and > 0) → campSitePriceLow (when > 0) → 50 (THB fallback).

computeBookingPrice({
  unitPrice: number,
  nights: number,
  vatRate: number,   // decimal fraction, e.g. 0.07 = 7% Thai VAT; 0 = no VAT
}): {
  unitAmount: number;       // per-night price used
  subtotalAmount: number;   // unitPrice × max(0, nights)  — no fees added
  nights: number;           // clamped to >= 0
  taxRate: number;          // = vatRate passed in
  taxAmount: number;        // VAT extracted from the inclusive subtotal when vatRate > 0, else 0 (rounded 2 dp)
  vatInclusive: boolean;    // true when vatRate > 0
  totalAmount: number;      // = subtotalAmount  (no fees)
}
```

**Invariant: `totalAmount === subtotalAmount`** (no platform fees). VAT is *extracted from*
the inclusive subtotal (`subtotal − subtotal / (1 + vatRate)`), never *added on top* — so the
total a Camper sees is the total recorded. The UI calls it with `vatRate: 0`.

## API refactor — `POST /api/bookings`
Server behaviour is unchanged; the inline price arithmetic (formerly route.ts lines ~76–97)
was extracted into the shared module:

- `resolveUnitPrice({ campSitePriceLow, spotPricePerNight })` replaces the inline spot/priceLow
  fallback.
- `computeBookingPrice({ unitPrice, nights, vatRate })` replaces the inline subtotal + VAT
  extraction; `vatRate` is read from the camp's `Country.vatRate` (fallback 0 for legacy
  null-country camps), `timezone` from `Country.timezone` (fallback `Asia/Bangkok`).
- `totalPrice = pricing.totalAmount`; the `snapshot…` Pixels are populated from the same result.

Contract unchanged: auth required (`requireAuth`); `userId` injected from the NextAuth session,
never from the body (`bookingSchema.safeParse({ ...body, userId: session.user.id })`); overlap →
`409`, capacity exceeded → `409`, camp not found → `404`, validation → `400`, success → `201`.

The bug being fixed: the UI previously added placeholder +฿20 cleaning + ฿35 service fees that
the API never persisted (so display ≠ record), and the UI used `priceLow` while the API used the
spot price. The shared module removes the placeholder fees and unifies the unit-price resolution.

## ADRs
`docs/adr/ADR-005-booking-snapshot.md` (booking crystallization scope — the snapshot block this
fix writes into) · `docs/adr/ADR-002-money-decimal-currency.md` (money as Decimal + currency).
No new ADR — CAM-58 is a behaviour-preserving extraction, not a hard-to-reverse decision.

## Links
`../../feature.md` (## Architecture overview) · `prisma/schema.prisma` (`model Booking`) · `lib/booking-pricing.ts` · `app/api/bookings/route.ts` · `story.md`

## Changelog
- v1 (2026-06-23) — created from shipped CAM-58 (shared pricing module contract + no-migration API refactor).
