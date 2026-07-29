## Story
As a **Host**, I want the pricing engine to be able to charge per person or per tent (not only per site), so that a future story can flip my camp's total from ฿250 to ฿750 for a 3-guest booking without a silent, unreviewed change in how any camp is charged today.
Why: CAM-650 landed the schema (`PricingUnit`, `CampSite.priceUnit`/`Spot.priceUnit`, `Booking.snapshotPricingUnit`/`snapshotQuantity`) but the engine (`lib/booking-pricing.ts`) still multiplies `unitPrice x nights` with no quantity factor at all — this story teaches the engine the math; it does not turn it on for any camp yet.
Scope: `lib/booking-pricing.ts` only, plus the two mechanical call-site updates needed to keep it the single source of truth (`app/api/bookings/route.ts`, `components/CampgroundDetailClient.tsx` — both forced to `PER_SITE` + `quantity: 1`, so neither charges differently). No host-facing form, no AI-tool change, no new endpoint.
Depends on: ADR-014 (CAM-649) · CAM-650 (epic CAM-648, schema)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camp priced ฿250, `priceUnit = PER_PERSON`, booked by 3 guests for 1 night | `computeBookingPrice` is called with `unit: 'PER_PERSON', quantity: 3` | No screen calls this path yet — no visible change | `subtotalAmount = 750` (not 250) — the exact gap the owner reported | — (no product surface reaches this combination yet; proven by unit test, not a screen) |
| AC-2 | Any existing camp/spot (still `priceUnit = PER_SITE`, the DB default) | A guest completes a booking through the unmodified booking flow | Booking total on the confirmation screen is identical to before this story | `app/api/bookings/route.ts` calls `buildBookingPriceArgs` with `priceUnit` forced to `PER_SITE` and `quantity: 1` — `totalPrice` byte-identical to pre-CAM-651 | EC-1 |
| AC-3 | The camp-detail page's booking-total preview, any camp | The camper opens a camp's detail page and picks dates | The previewed total (`฿{amount}` row) is identical to before this story | `components/CampgroundDetailClient.tsx` calls `buildBookingPriceArgs` with `priceUnit` forced to `PER_SITE` and `quantity: 1` — preview byte-identical to pre-CAM-651 | EC-1 |
| AC-4 | A camp with `priceUnit = PER_TENT` and no tent-count field anywhere in the booking flow | `buildBookingPriceArgs` is called for that camp (hypothetically — no caller does this today) | No screen shows this — `PER_TENT` is unreachable from any real caller today | Returns `{ ok: false, reason: 'TENT_COUNT_UNAVAILABLE' }`, never throws, never guesses a quantity | EC-2 |
| AC-5 | `CampSite.extraFeeAmount` set on a camp, any `quantity` | `computeBookingPrice` runs with `quantity` > 1 | Total = base subtotal (already multiplied by quantity) + the fee once, never the fee x quantity | `extraFeeAmount` in the result equals the input `extraFeeAmount`, unaffected by `quantity` (CAM-268's rule extended to the new axis) | EC-3 |

## Rules
- BR-1 `subtotalAmount = unitPrice x quantity x nights` — `quantity` is a **required** input to `computeBookingPrice` (never defaulted); a default is exactly how the missing multiplier survived CAM-58 and CAM-268 unnoticed.
- BR-2 `resolveUnitPrice` returns the unit from the SAME row its price came from — the spot's price is never paired with the camp's unit or vice versa; a fabricated fallback price (no price configured anywhere) is always tagged `PER_SITE`, never presented as a host's choice.
- BR-3 `resolveQuantity`: `PER_SITE` -> always `1` (party size never read) · `PER_PERSON` -> `max(1, guests)` · `PER_TENT` -> the caller's tent count when present, else `{ok:false, reason:'TENT_COUNT_UNAVAILABLE'}` (no client sends a tent count today).
- BR-4 `extraFeeAmount` stays a one-time-per-stay additive charge — never multiplied by `nights` (CAM-268, unchanged) and never multiplied by `quantity` (this story's extension of the same rule).
- BR-5 Both real call sites (`app/api/bookings/route.ts`, `components/CampgroundDetailClient.tsx`) pass `priceUnit: 'PER_SITE'` and `party: { guests: 1 }` **explicitly, forced** — not read from the live `CampSite.priceUnit`/`Spot.priceUnit` columns or the real guest count — so this story changes zero camps' totals; the follow-up story (CAM-652) threads the real values through both callers.

## Edge cases
- EC-1 IF a camp/spot's `priceUnit` column is `PER_SITE` (the DB default, every existing row today) THEN `resolveQuantity` returns `quantity: 1` regardless of party size, reproducing today's total exactly (BR-1/BR-3).
- EC-2 IF `buildBookingPriceArgs` is called for a `PER_TENT` camp with no tent count in the party THEN it returns `{ok:false, reason:'TENT_COUNT_UNAVAILABLE'}` — never a thrown exception, never a guessed quantity of 1 or 0 (BR-3).
- EC-3 IF `quantity` is `0` or negative (a defensive caller bug, not a real product path) THEN `computeBookingPrice` clamps it to `1` — mirrors the existing `Math.max(0, nights)` clamp, floored at 1 because a booking can never be for 0 people/tents/sites (BR-1).

## Data
- No schema change — this story is pure logic against the CAM-650 schema. `lib/booking-pricing.ts`'s exported shapes change (`resolveUnitPrice` returns `{unitPrice, unit, source}` instead of a bare number; `computeBookingPrice` requires `unit`+`quantity`; new `resolveQuantity` + `buildBookingPriceArgs` exports) — a compile-time-only change, not a data migration.
- Migration: none.

## Seams & refs
- Reuse: `lib/booking-pricing.ts` remains the ONE pricing module (CAM-58); `buildBookingPriceArgs` is the new single entry point both callers must use so a caller can never re-derive `unit`/`quantity` divergently from `resolveUnitPrice`'s result.
- Reader/writer sweep (architecture.md §15b — `resolveUnitPrice`'s return type changed, a derivation-shape change): grepped `resolveUnitPrice(`/`computeBookingPrice(` across `app/`, `lib/`, `components/`, `__tests__/`. Real production consumers found: `app/api/bookings/route.ts` (NOW — routed through `buildBookingPriceArgs`, forced PER_SITE/quantity 1), `components/CampgroundDetailClient.tsx` (NOW — same), `components/ai-chat/AiChatDetailCard.tsx` (NOW — mechanical fix only: extracts `.unitPrice` from the new object shape, `BookingCampContext.unitPrice` stays a plain number, unchanged behavior), `components/ai-chat/booking-view.ts` (NOW — mechanical fix only: adds `unit:'PER_SITE', quantity:1` to its existing `computeBookingPrice` call; NOT routed through `buildBookingPriceArgs` — that would require reshaping `BookingCampContext`, out of this story's stated two-caller scope; flagged for CAM-652 to reconcile). Test-file mocks updated (compiler-enumerated, not behavior-changing): `__tests__/cam-57-atomic-lock.test.ts`, `cam-355-per-spot-capacity-enforcement.test.ts`, `cam-400-capacity-invariant.test.ts`, `cam-642-booking-source.test.ts` (all mock `@/lib/booking-pricing` and now mock `buildBookingPriceArgs` instead of `resolveUnitPrice`), plus `booking-pricing.test.ts`, `cam-650-pricing-unit-schema.test.ts`, `f3-detail-surface.test.ts`, `cam-268-price-fee-cancellation-policy.test.ts` (source-inspection regexes updated to match the new `buildBookingPriceArgs(` call shape).
- Refs: ADR-014 (CAM-649) · CAM-650 (schema) · `.claude/rules/api.md` §11 (discriminated unions, branded results) · `.claude/rules/architecture.md` §15b (reader/writer sweep).

## Out of scope
- Threading the real `CampSite.priceUnit`/`Spot.priceUnit` and the real party size (guests/tents) through the two call sites, so a camp actually charges per-person/per-tent → CAM-652.
- Reconciling `components/ai-chat/booking-view.ts` onto `buildBookingPriceArgs` (currently a direct, mechanically-fixed `computeBookingPrice` call) → CAM-652, alongside the chat flow's own party-size threading.
- Exposing `PER_TENT` at any zod/UI/AI-tool boundary, or capturing a tent count anywhere in the booking flow → a future "per tent" story (ADR-014 §1).
- Writing `Booking.snapshotPricingUnit`/`snapshotQuantity` on booking creation → CAM-652 (this story does not touch booking-write snapshot fields).

## Self-verify
- AC-1 → unit (`__tests__/cam-651-pricing-engine-unit.test.ts` I1 — the reported-gap case + the full unit x quantity x nights matrix).
- AC-2 → unit + integration (I2 golden numbers against `app/api/bookings/route.ts`'s forced-PER_SITE call; `__tests__/cam-57-atomic-lock.test.ts`/`cam-355-*`/`cam-400-*`/`cam-642-*` still pass against the route unmodified in behavior).
- AC-3 → unit + source-inspection (I6; `f3-detail-surface.test.ts`, `cam-268-*` regexes confirm `buildBookingPriceArgs(` is the call site).
- AC-4 → unit (I8 — `resolveQuantity`/`buildBookingPriceArgs` PER_TENT-no-tent-count boundary, asserted never-throws).
- AC-5 → unit (I3 — fee-never-multiplied-by-quantity, extends CAM-268's nights-axis guard).
- Story-specific: I5 (resolver coupling table) · I7 (server-only enum-exhaustiveness test, local union vs `Prisma.PricingUnit`) · I4 (VAT semantics re-asserted unchanged on the new quantity axis) · full `npm test` green (11500+ tests, 0 regressions) · `npm run typecheck`/`npm run lint` clean.
- Gate = /quality-gate · Done = every AC verified on the real Staging URL

## Changelog
- v1 (2026-07-29) — created
