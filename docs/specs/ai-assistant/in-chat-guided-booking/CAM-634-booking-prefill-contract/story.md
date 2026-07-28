---
linear: CAM-634
feature: ai-assistant
epic: in-chat-guided-booking (CAM-630)
persona: platform
artifact: story
owner: product-owner
status: In Progress — spec-lite (G1 folds into G3 packet)
version: v1
updated: 2026-07-29
---
# One shared contract carries dates and party size into the booking page (CAM-634)

<!-- Spec-lite (S): no schema/migration · no new API contract · single file-surface (lib/booking-prefill.ts + a 2-line export in lib/validations/booking.ts) · diff ≤ ~150 lines (+tests). G1 folds into G3 per Gate policy v2. -->

## Story
As the **platform**, I want ONE shared zod contract (a single writer + a single reader) for encoding booking dates and party size into the camp detail page's URL, so that the in-chat guided booking flow and the camp page never independently guess the same shape.
Why: this repo has a documented scar from exactly that failure mode — the same MasterData group<->URL-param<->zod-field map was hand-copied ~20 times across the codebase before `lib/taxonomy-registry.ts` consolidated it (CAM-523). This ticket exists to prevent the same drift at the booking-prefill layer, before the chat writer and the page reader are ever built.
Scope: `lib/booking-prefill.ts` only (schema + writer + reader), plus exporting `MAX_BOOKING_NIGHTS` from `lib/validations/booking.ts` so both consumers share one cap instead of two independently-chosen 30s. No callers yet — wiring the chat flow to build the link, and the camp page to read it, are follow-up tickets under epic CAM-630.
Depends on: epic CAM-630 (in-chat guided booking)

## AC
<!-- Pure backend/infra contract, no UI surface yet — "Then" is dev-facing (return shape), not a Thai-copy screen, matching the CAM-469 precedent for this class of ticket. -->
| # | Given | When | Then (dev-facing, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A valid `BookingPrefill` (checkIn >= today, checkOut > checkIn, nights <= 30, guests between 1 and maxGuests when maxGuests is known) | `buildBookingPrefillQuery` serializes it into a query string, then `parseBookingPrefill` reads that exact query string back with the same `ctx` | Returns `{ok:true, value}` where `value` deep-equals the original input (round-trip) | No data written; both functions are pure | EC-1 |
| AC-2 | `raw` is missing a required field, carries a duplicated (array-valued) query param, or a `checkIn`/`checkOut` that is non-ISO or not a real calendar date (e.g. `2026-02-31`) | `parseBookingPrefill` is called | Returns `{ok:false, reason:'malformed'}` | No throw; no partial value ever returned | EC-2/EC-5 |
| AC-3 | `checkIn` is earlier than `ctx.today` | `parseBookingPrefill` is called | Returns `{ok:false, reason:'past'}` | — | EC-1 (boundary twin) |
| AC-4 | `checkOut` is the same as or earlier than `checkIn` | `parseBookingPrefill` is called | Returns `{ok:false, reason:'inverted'}` | — | — |
| AC-5 | The night count (`checkOut` - `checkIn`) exceeds `MAX_BOOKING_NIGHTS` (30) | `parseBookingPrefill` is called | Returns `{ok:false, reason:'too_long'}` | — | EC-3 (boundary twin) |
| AC-6 | `guests` is less than 1, or greater than `ctx.maxGuests` when `ctx.maxGuests` is not null | `parseBookingPrefill` is called | Returns `{ok:false, reason:'guests_out_of_range'}` | — | EC-4 (boundary twin) |

## Rules
- BR-1 `checkIn` is INCLUSIVE (the first night); `checkOut` is EXCLUSIVE (the checkout day) — byte-identical semantics to `Booking.checkOutDate` / `lib/validations/booking.ts` (proves AC-1/AC-4).
- BR-2 `ctx.today` is an injected parameter, never read from the system clock inside this module — the same idiom `resolveDatesCore` uses (`lib/ai/tools/resolve-dates.ts:341`) so the module stays pure and unit-testable (proves AC-3).
- BR-3 Exactly one reject reason per failed parse, from a closed named set: `malformed | past | inverted | too_long | guests_out_of_range` — never a generic/opaque error (proves AC-2..AC-6).
- BR-4 The nights cap is shared: `MAX_BOOKING_NIGHTS` (30) is exported from `lib/validations/booking.ts` and imported into `lib/booking-prefill.ts` — one number, not two independently-chosen 30s (proves AC-5).
- BR-5 `guests` must be an integer >= 1, and <= `ctx.maxGuests` when `ctx.maxGuests` is not null (proves AC-6).
- BR-6 `parseBookingPrefill` never throws for any input shape; a malformed/missing/duplicated field rejects the WHOLE prefill — dates are all-or-nothing, never a half-applied range (proves AC-2).

## Edge cases
- EC-1 IF `checkIn === ctx.today` THEN it is accepted, never rejected as `past` (boundary of AC-1/AC-3, BR-2).
- EC-2 IF a query param arrives duplicated (`?guests=1&guests=2`, array-valued) THEN the result is `{ok:false, reason:'malformed'}`, never a thrown error and never a silently-picked first/last value (BR-3/BR-6).
- EC-3 IF nights === `MAX_BOOKING_NIGHTS` (30) THEN it is accepted; IF nights === 31 THEN `too_long` (boundary of AC-1/AC-5, BR-4).
- EC-4 IF `guests === ctx.maxGuests` THEN it is accepted; IF `guests === ctx.maxGuests + 1` THEN `guests_out_of_range` (boundary of AC-1/AC-6, BR-5).
- EC-5 IF `raw` carries an unexpected/garbage shape (non-string values, `null`, an array where a scalar is expected, or `raw` itself is not an object) THEN `parseBookingPrefill` still returns `{ok:false, reason:'malformed'}` and never throws (BR-6).

## Data
- No entities/schema touched — pure TypeScript module, no Prisma/DB involvement. Migration: none.
- Files: `lib/booking-prefill.ts` (new) + a 2-line export change in `lib/validations/booking.ts` (`MAX_BOOKING_NIGHTS` extracted from an inline `.refine` literal) + its test (`__tests__/cam-634-booking-prefill.test.ts`).

## Seams & refs
- Reuse: `lib/validations/booking.ts` (`MAX_BOOKING_NIGHTS`, checkIn/checkOut-exclusive semantics — no parallel logic) · `lib/ai/tools/resolve-dates.ts:341` (the injected-`today` idiom, reused not re-implemented) · `lib/taxonomy-registry.ts:3-19` (the hand-copied-map scar this ticket exists to prevent, at the URL-contract layer instead of the MasterData-group layer).
- Refs: epic CAM-630 (in-chat guided booking) · CAM-523 (`lib/taxonomy-registry.ts`, the precedent this pattern follows).

## Out of scope
- Wiring the in-chat booking flow to actually build the link with `buildBookingPrefillQuery` → follow-up ticket under epic CAM-630 (not yet filed).
- Wiring the camp detail page to read the prefill with `parseBookingPrefill` and pre-fill the booking widget → follow-up ticket under epic CAM-630 (not yet filed).
- Resolving `maxGuests` from a specific camp/spot's real capacity (the caller supplies `ctx.maxGuests`; this ticket only consumes it) → the future page-reader ticket.

## Self-verify
- AC-1..6 → unit tests (vitest), `__tests__/cam-634-booking-prefill.test.ts`: happy-path round-trip (with and without `from:'chat'`) + one test per named reject reason + the 4 boundary pairs (checkIn===today, nights===30/31, guests===maxGuests/+1, a null maxGuests never upper-bounds) + a duplicated-param case + a fuzz table of garbage `raw` shapes asserting `parseBookingPrefill` never throws.
- Story-specific: no ownership/migration (pure lib, no DB) · `grep -n "MAX_BOOKING_NIGHTS" lib/validations/booking.ts lib/booking-prefill.ts` shows both files · updated the one pre-existing source-inspection test (`__tests__/cam-401-availability-cap.test.ts`) whose literal-`30` pin was made stale by extracting `MAX_BOOKING_NIGHTS` (CAM-224/226/229: update the pin to the new canonical form, don't revert the refactor).
- Gate = `/quality-gate`. Done = merged to `dev` with AC verified on localhost (no UI/caller exists yet to verify on a real URL — pure lib contract, verified via its own test suite).

## Changelog
- v1 (2026-07-29) — created; implemented in the same PR (spec-lite, G1 folds into G3).
