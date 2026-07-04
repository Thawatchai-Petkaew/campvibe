---
artifact: epic
feature: bookings-trips
epic: camper-availability-booking (CAM-23)
status: Done
version: v2
updated: 2026-06-23
---
# Camper: availability & booking (CAM-23)

## Why
A Camper must be able to check availability and book a campsite with confidence — and the price they see must be the price the system records, or trust (and any future receipt/refund) breaks. · **KPI:** 0 "total mismatch" complaints after deploy — the displayed total equals the recorded `Booking.totalPrice` 100% of the time.

## Scope
- In: the fee-transparency fix (CAM-58) — make the booking summary's displayed total equal the persisted total by removing the placeholder cleaning/service fees and centralising price math in one shared module (`lib/booking-pricing.ts`).
- Out:
  - Real platform fees (cleaning/service) → **H-5.5** (a proper atomic fee-config model); the shared pricing module is the extension point.
  - Atomic availability lock / race-condition handling on concurrent bookings → **CAM-68**.
  - VAT-added-on-top, confirmation page + booking reference, special requests, guest checkout → later C-3 stories (`docs/project/product-plan.md` C-3.5–C-3.7).

## Stories
| CAM-id | Story | Role (final) | Status |
|---|---|---|---|
| CAM-58 | แก้ bug ความโปร่งใสค่าธรรมเนียม (fee transparency: display total == recorded total) | qa-engineer (backend → frontend → qa) | Done |

## Links
`../feature.md` · Master-Plan item (`docs/project/master-plan.md`) · product-plan C-3 (`docs/project/product-plan.md`) · ADRs: `docs/adr/ADR-005-booking-snapshot.md`, `docs/adr/ADR-002-money-decimal-currency.md`

## Changelog
- v2 (2026-06-23) — filled stub: Why+KPI, scope (in/out with H-5.5 + CAM-68), CAM-58 story rollup.
- v1 (2026-06-22) — epic scoped
