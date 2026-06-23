# ADR-002 — Money representation: Decimal + ISO-4217 currency

**Status:** Proposed (G2 pending) · **Epic:** Atomic Schema (CAM-96) · **Story:** S3 (CAM-100), snapshot in S6

## Context
Every monetary value is `Float` with no currency (`CampSite.priceLow/priceHigh`, `Spot.pricePerNight/pricePerSite`, `Booking.totalPrice`) — assumes THB. `.claude/rules/architecture.md` names `amount`+`currency` (Decimal, not float) as **the** canonical atomic example. The owner wants real multi-currency. Float causes rounding errors and cannot represent currency or zero-decimal currencies (JPY) correctly.

## Decision
Money is always a **Pixel pair**: `…Amount Decimal @db.Decimal(12,2)` + `…Currency String` (ISO-4217 alpha-3), classification **[Financial]**, on every money-bearing row.
- **Store source currency only.** Display in another currency is computed at read-time in the Buffet via an `ExchangeRate` reference table; the converted value is **never persisted as the price** (would make a cached aggregate the source of truth — anti-pattern).
- Decimal arithmetic in the **service layer** (`Prisma.Decimal`), never JS float math (fixes `pricePerNight * nights` in `app/api/bookings/route.ts`).
- Render via `Intl.NumberFormat(locale, {style:'currency', currency})`; remove the hardcoded `rate:35` THB↔USD placeholder in `contexts/LanguageContext.tsx`.
- Minor-unit formatting (JPY=0, BHD=3 decimals) driven by a Currency reference table at render; **storage scale stays `(12,2)`**.

## Alternatives
- **Keep Float + single global currency:** blocks multi-country, violates the standard. Rejected.
- **Integer minor units** (store satang/cents): more correct for zero/three-decimal currencies, but larger churn now and less readable. Reconsider only if exotic currencies go live.

## Consequences
- ✅ Exact arithmetic, multi-currency-ready, standards-conformant.
- ⚠️ `Decimal(12,2)` precision is **locked** — changing scale later is a real migration. Caps a single amount at 9,999,999,999.99.
- Tax (VAT) + any FX shown are snapshotted on Booking (ADR-005), not recomputed historically.
- Pre-launch → clean reset; seed numeric literals become Decimal-safe strings.
