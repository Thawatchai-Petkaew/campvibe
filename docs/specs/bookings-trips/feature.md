---
artifact: feature
feature: bookings-trips (Bookings & Trips)
personas: [camper]
status: active
version: v2
updated: 2026-06-23
---
# Bookings & Trips

## Overview
Lets a Camper turn a chosen campsite + dates into a real `Booking` and see the trips they have made. It serves the **Camper** persona and the core marketplace loop "search → detail → book". · ↑ Master-Plan: `docs/project/master-plan.md` (Booking = a primary domain Set; "successful Bookings/month" is the headline KPI) · product-plan item: **C-3 Availability & booking** (`docs/project/product-plan.md`).

## Architecture overview
- Entities (atomic, linked by ID):
  - `Booking` — a transactional Set linked to `User`, `CampSite`, and optional `Spot` by ID. Carries the live price fields (`totalPrice` + `currency`) plus a crystallized `snapshot…` block (camp name, unit/subtotal/tax/total amounts, nights, check-in/out times, timezone) frozen at create time per **ADR-005** so later host edits never mutate a recorded booking.
  - Money is stored as `Decimal` (ADR-002); price math is computed in `number` for the simple THB total and serialized back.
- API surface:
  - `POST /api/bookings` — create a booking (auth required; `userId` from the NextAuth session, never the body); validates overlap + daily capacity, computes price, creates the row as `PENDING`.
  - `GET /api/bookings` — list the signed-in user's bookings.
- Pricing source of truth: `lib/booking-pricing.ts` — a pure, framework-agnostic module imported by **both** the API route and the UI so the displayed total always equals the recorded total (CAM-58).
- ADRs: `docs/adr/ADR-005-booking-snapshot.md` (crystallization scope) · `docs/adr/ADR-002-money-decimal-currency.md` (money as Decimal + currency) · schema: `prisma/schema.prisma` (`model Booking`).

## Design overview
The booking summary lives on the campsite detail page, rendered by `components/CampgroundDetailClient.tsx` (the sticky booking widget in the right column). The Camper picks check-in/check-out dates + guests, sees a price breakdown — one room subtotal row (`row--booking-room-subtotal`) and a total row (`row--booking-total`) — then presses Reserve. Token-only styling per `DESIGN.md`; all copy via `locales/` (e.g. `t.booking.total`, `t.common.reserve`). No fee rows are shown (CAM-58).

## Epics & Stories
| Epic | Stories | Status |
|---|---|---|
| `camper-availability-booking` (CAM-23) | CAM-58 — แก้ bug ความโปร่งใสค่าธรรมเนียม · role: qa-engineer (backend → frontend → qa) | Done |

## Key decisions
- **No-fee invariant (CAM-58):** the UI used to show placeholder +฿20 cleaning + ฿35 service fees that `POST /api/bookings` never persisted, so the displayed total did not equal the recorded total; the UI base price also used `priceLow` while the API used the spot price. The fix removed the placeholder fees (no fee model existed and they were never charged) and centralised the math in `lib/booking-pricing.ts` with the invariant `totalAmount === subtotalAmount` (no fees; VAT extracted inclusive, not added on top).
- **Single source of truth for price:** `lib/booking-pricing.ts` is shared by the server route and the client widget — one place to change, guaranteeing display == record.
- **Real platform fees are deferred to H-5.5** (a proper atomic fee-config model). The shared pricing module is the extension point for that work.
- **Booking is crystallized (ADR-005):** legal/financial values are snapshotted at booking time; host edits to the live camp do not rewrite an existing booking.

## Changelog
- v2 (2026-06-23) — filled stub from shipped CAM-58: architecture, design, epic rollup, key decisions.
- v1 (2026-06-22) — feature created
