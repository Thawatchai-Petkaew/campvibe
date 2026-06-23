# ADR-005 — Booking snapshot (crystallization) scope

**Status:** Proposed (G2 pending) · **Epic:** Atomic Schema (CAM-96) · **Story:** S6 (CAM-103)

## Context
`Booking` stores only live FKs + `totalPrice Float`. A booking is a financial/legal document: if a host later edits the campsite price, name, or cancellation policy — or a region's VAT rate changes — historical bookings must NOT change. `.claude/rules/architecture.md` mandates that transactional Sets **snapshot** the values with legal/financial impact **+ keep the source ID** for trace.

## Decision
On transition to **CONFIRMED/PAID**, write atomic `snapshot…`-prefixed Pixels on Booking; keep `campSiteId`/`spotId` as live source links (trace only):
- Money (all [Financial], in source currency): `snapshotCurrency`, `snapshotSubtotalAmount`, `snapshotTaxRate`, `snapshotTaxAmount`, `snapshotVatInclusive`, `snapshotTotalAmount`.
- Context: `snapshotCampName`, `snapshotCancellationPolicy`, `snapshotCheckInDate/CheckOutDate`, `snapshotNights`, `snapshotTimezone` (IANA), `snapshotCountryCode` (tax jurisdiction), `snapshotBookingLocale`.
- FX (only if a converted amount was shown/charged) as an **audit triple**: `snapshotFxQuoteCurrency`, `snapshotFxRate`, `snapshotFxAsOf`. The canonical amount owed is always `snapshotTotalAmount` + `snapshotCurrency`.
- Tax sourced from `Country.vatRate`/`vatInclusive` at confirm time → a later VAT change never rewrites past invoices.
- **Immutability rule:** host edits to the live CampSite/Spot never mutate an existing booking's snapshot.

## Alternatives
- **Link-only (status quo):** booking always reflects current camp price/policy — wrong for a financial record (host raises price → old booking total changes). Rejected.
- **Full JSON blob snapshot:** opaque, not queryable, violates atomicity. Rejected — snapshot as discrete Pixels.

## Consequences
- ✅ Bookings are stable legal documents; reporting/payouts use frozen amounts; conforms to crystallization rule.
- ⚠️ Snapshot field shape is **locked** once real bookings exist — finalize now (depends on ADR-002 money + S1 BookingStatus enum).
- Slight denormalization (intentional): snapshot duplicates current values at confirm time, by design.
