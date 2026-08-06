## Story
As a **Camper**, I want the in-chat booking summary to total what my stay will really cost, so that I am never quoted a lower price than the booking actually charges.
Why: `AiChatDetailCard.tsx`'s `handleStartBooking` hardcoded `campSitePriceUnit: null` into its `resolveUnitPrice` call, even though `get-camp-detail.ts` (CAM-656) has selected + returned the real `CampSite.priceUnit` as `detail.price.unit` since that story shipped. A hardcoded `null` normalizes to `PER_SITE` (ADR-014 §2), so the booking summary never multiplied by guest count — after CAM-673 (~95% of camps priced `PER_PERSON`), the chat quoted ฿500 for a stay the write path (`POST /api/bookings`) correctly charges ฿1,500 for 3 guests.
Scope: (1) `components/ai-chat/AiChatDetailCard.tsx`'s `handleStartBooking` threads `detail.price.unit` (real, `NOT NULL`) into `resolveUnitPrice` instead of a hardcoded `null`. (2) Investigated and closed a SECOND suspected gap — the card's own price captions (`priceUnitSuffix(t, card.priceUnit)`) — but found `lib/read-models/ai-camp-card.ts`'s `aiCampCardSelect` already selects `CampSite.priceUnit` (inherited from `campCardSelect` via its `...campCardSelect` spread, CAM-653 added `priceUnit: true` there and `ai-camp-card.ts` was not itself touched by that story) and it already flows unchanged onto the `AiChatCardResponse` wire type (`lib/api-client.ts`) — confirmed by a runtime module test + a `tsc` type-level check this story ran. No select or wire-type change was needed; two stale doc comments claiming otherwise (in `AiChatDetailCard.tsx` and `lib/api-client.ts`) are corrected in this diff. `booking-view.ts`/`booking-flow.ts` are untouched (already correct, pinned by `__tests__/cam-640-booking-view.test.ts:218-222`).
Depends on: CAM-652 (real callers) · CAM-653 (card captions + `campCardSelect.priceUnit`) · CAM-656 (`get-camp-detail.ts` selects `price.unit`) · CAM-673 (the PER_PERSON data that made this visible)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camp is priced `PER_PERSON` at ฿500/guest and the camper has picked 3 guests for 1 night | The camper reaches the booking summary step (`เริ่มจอง` → date → guests) | Total reads `฿1,500` (previously `฿500`) | `BookingCampContext.priceUnit` carries the camp's real `detail.price.unit` (`PER_PERSON`), not a hardcoded `PER_SITE`; `buildSummaryView` multiplies by guest count via `buildBookingPriceArgs` | EC-1 |
| AC-2 | A camp is priced `PER_SITE` (the pre-CAM-654 default) | The camper reaches the booking summary step | Total is unchanged from before this story (no guest multiplier) | `resolveUnitPrice` still resolves `PER_SITE`, `resolveQuantity` returns `1` | AC-1 (positive twin) |
| AC-3 | A camp is priced `PER_PERSON` | The camper opens the detail card and views the price caption (hero section + CTA row) | Caption reads `/คน/คืน` (not the `/คืน` default) | `card.priceUnit` (`PER_PERSON`) is already on the wire; `priceUnitSuffix` renders the unit-aware suffix — no code change needed here, this AC is a regression-proof, not a fix | — (already correct; regression-tested this story) |

## Rules
- BR-1 `handleStartBooking` (`AiChatDetailCard.tsx`) passes `campSitePriceUnit: detail.price.unit` to `resolveUnitPrice` — `detail.price.unit` is a `NOT NULL` `PricingUnit` (never `null`/fabricated, see `CampDetailPrice`'s doc comment in `get-camp-detail.ts`).
- BR-2 No other caller of `resolveUnitPrice`/`buildBookingPriceArgs` changes — `booking-view.ts`, `app/api/bookings/route.ts`, `CampgroundDetailClient.tsx` are all untouched and stay pinned by their existing tests.

## Edge cases
- EC-1 IF the camp's `priceLow` is `0`/`null` (unpriced) THEN `resolveUnitPrice`'s existing `฿50` `FALLBACK` branch still applies, always tagged `PER_SITE` — unchanged by this story (the fallback branch never reads `campSitePriceUnit`).

## Data
- No schema/migration. Read-only: `CampSite.priceUnit` already exists (CAM-650) and is already selected by both `get-camp-detail.ts` (CAM-656) and `aiCampCardSelect` (CAM-653, inherited).

## Seams & refs
- Reuse: `lib/booking-pricing.ts`'s `resolveUnitPrice`/`buildBookingPriceArgs` (unchanged) · `components/ai-chat/booking-view.ts`'s `buildSummaryView` (unchanged, already routes through `buildBookingPriceArgs` per CAM-652).
- Reader/writer sweep (architecture.md §15b — this story changes what VALUE is handed into an existing, unchanged read path, not the read path itself): grepped `campSitePriceUnit`/`aiCampCardSelect`/`priceUnit` across `components/ai-chat/**`, `lib/read-models/ai-camp-card.ts`, `lib/api-client.ts`. Touched NOW: `AiChatDetailCard.tsx` (the one call-site argument + 2 stale comments), `lib/api-client.ts` (1 stale comment, no type change). NO-CHANGE (already correct): `lib/read-models/ai-camp-card.ts` (select already includes `priceUnit` via the `campCardSelect` spread), `booking-view.ts`, `booking-flow.ts`.
- Refs: ADR-014 (CAM-649) · CAM-652/653/656/673.

## Out of scope
- Spot-level pricing for the in-chat flow (`spotPricePerNight`/`spotPriceUnit` stay `null` here — `GetCampDetailResult` is a whole-camp read; per-spot chat booking is a separate, unbuilt flow) → no follow-up ticket yet, not requested.
- `PER_TENT` party-size capture in the chat flow → ADR-014 §1, unchanged (`resolveQuantity`'s `PER_TENT` branch stays unreachable from this surface, same as every other caller).

## Self-verify
- AC-1/BR-1 → unit + render (`__tests__/cam-698-chat-price-unit.test.ts`: renders `AiChatDetailCard`, resolves a mocked `PER_PERSON` detail, clicks `เริ่มจอง`, asserts `onStartBooking`'s captured `priceUnit`/`unitPrice`, then feeds that context through the REAL `buildSummaryView` for 3 guests → `฿1,500`; Prove-It confirmed red pre-fix, green post-fix).
- AC-2 → unit (`__tests__/cam-651-pricing-engine-unit.test.ts`/`cam-640-booking-view.test.ts` PER_SITE cases already cover this, unchanged by this diff).
- AC-3 → render regression test in the same new file (asserts the CTA price caption's exact suffix span text for a PER_PERSON card).
- Story-specific: full `npm test` green · `npm run typecheck`/`npm run lint` clean · `npm run build` per CI.
- Gate = /quality-gate (spec-lite class: no schema, no new API contract, single file-surface, ≤150 lines expected diff) · Done = AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-08-06) — created
