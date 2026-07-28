---
linear: CAM-634
feature: ai-assistant
epic: in-chat-guided-booking (CAM-630)
persona: platform
artifact: story
owner: product-owner
status: In Progress — spec-lite (G1 folds into G3 packet)
version: v3
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
| AC-7 | A hand-built `BookingPrefill` violates any rule `parseBookingPrefill` would reject on (malformed shape, past checkIn relative to `ctx.today`, inverted range, too_long, guests < 1) | `buildBookingPrefillQuery` is called with it and a `ctx.today` | Throws (fail-closed) — never serializes into a dead link | No query string produced | EC-6 |

## Rules
- BR-1 `checkIn` is INCLUSIVE (the first night); `checkOut` is EXCLUSIVE (the checkout day) — byte-identical semantics to `Booking.checkOutDate` / `lib/validations/booking.ts` (proves AC-1/AC-4).
- BR-2 `today` is an injected parameter on BOTH sides of the contract — `ctx.today` on the reader AND on the writer — never read from the system clock inside this module (zero clock reads: `grep -E "new Date\(\)|Date\.now|Intl\.DateTimeFormat" lib/booking-prefill.ts` → 0 hits). Same idiom `resolveDatesCore` uses (`lib/ai/tools/resolve-dates.ts:341`). Writer and reader are twins over the same contract and must not disagree about where "now" comes from; the caller sources `ctx.today` via the repo's Bangkok-local helper (`bangkokTodayISO()`, `lib/ai/date-phrases.ts:94`), never a naive UTC date (proves AC-3/AC-7).
- BR-3 Exactly one reject reason per failed parse, from a closed named set: `malformed | past | inverted | too_long | guests_out_of_range` — never a generic/opaque error (proves AC-2..AC-6).
- BR-4 The nights cap is shared: `MAX_BOOKING_NIGHTS` (30) is exported from `lib/validations/booking.ts` and imported into `lib/booking-prefill.ts` — one number, not two independently-chosen 30s (proves AC-5).
- BR-5 `guests` must be an integer >= 1, and <= `ctx.maxGuests` when `ctx.maxGuests` is not null (proves AC-6).
- BR-6 `parseBookingPrefill` (the READER, untrusted URL input) never throws for any input shape; a malformed/missing/duplicated field rejects the WHOLE prefill — dates are all-or-nothing, never a half-applied range (proves AC-2).
- BR-7 `buildBookingPrefillQuery` (the WRITER, our own code only) is fail-CLOSED — the opposite of BR-6. `.refine()` in zod doesn't narrow the inferred TS type, so a hand-built `BookingPrefill` can carry an unreal calendar date or a negative guest count and still type-check; the writer takes `ctx: {today: string}` (mirroring the reader) and re-validates, THROWING on the first violation (every reject reason the reader has, except the `guests > maxGuests` upper half — the writer has no camp-specific `maxGuests` context) (proves AC-7; G3 adversarial-review nit, tightened to symmetric injected-`today` in a follow-up nit round — see Changelog v3).

## Edge cases
- EC-1 IF `checkIn === ctx.today` THEN it is accepted, never rejected as `past` (boundary of AC-1/AC-3, BR-2).
- EC-2 IF a query param arrives duplicated (`?guests=1&guests=2`, array-valued) THEN the result is `{ok:false, reason:'malformed'}`, never a thrown error and never a silently-picked first/last value (BR-3/BR-6).
- EC-3 IF nights === `MAX_BOOKING_NIGHTS` (30) THEN it is accepted; IF nights === 31 THEN `too_long` (boundary of AC-1/AC-5, BR-4).
- EC-4 IF `guests === ctx.maxGuests` THEN it is accepted; IF `guests === ctx.maxGuests + 1` THEN `guests_out_of_range` (boundary of AC-1/AC-6, BR-5).
- EC-5 IF `raw` carries an unexpected/garbage shape (non-string values, `null`, an array where a scalar is expected, or `raw` itself is not an object) THEN `parseBookingPrefill` still returns `{ok:false, reason:'malformed'}` and never throws (BR-6).
- EC-6 IF `buildBookingPrefillQuery` is handed a value with an unreal calendar date AND a negative guest count at the same time (both wrong at once) THEN it still throws (does not partially validate) (BR-7).

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
- AC-7 → one throw-test per reject reason fed to `buildBookingPrefillQuery` (malformed/past/inverted/too_long/guests_out_of_range, all with a fixed injected `ctx.today`) + the combined-violation case (EC-6) + two control tests proving a valid prefill (incl. `checkIn === ctx.today`) still builds with no false-positive throw.
- Story-specific: no ownership/migration (pure lib, no DB) · `grep -n "MAX_BOOKING_NIGHTS" lib/validations/booking.ts lib/booking-prefill.ts` shows both files · updated the one pre-existing source-inspection test (`__tests__/cam-401-availability-cap.test.ts`) whose literal-`30` pin was made stale by extracting `MAX_BOOKING_NIGHTS` (CAM-224/226/229: update the pin to the new canonical form, don't revert the refactor).
- Gate = `/quality-gate`. Done = merged to `dev` with AC verified on localhost (no UI/caller exists yet to verify on a real URL — pure lib contract, verified via its own test suite).

## Changelog
- v1 (2026-07-29) — created; implemented in the same PR (spec-lite, G1 folds into G3).
- v2 (2026-07-29) — G3 adversarial-review nit: `buildBookingPrefillQuery` is now fail-CLOSED (BR-7/AC-7/EC-6) — it re-validates and throws on the first invalid field/rule instead of silently serializing a dead link, since `.refine()` doesn't narrow the TS type. Its own past-check reads the real Bangkok-local clock (documented distinctly from the reader's injected `ctx.today`, BR-2). 8 new tests added; round-trip tests switched to dates computed relative to the real clock (was hardcoded near-future literals) to avoid a ticking time bomb now that the writer enforces a real past-check.
- v3 (2026-07-29) — Follow-up G3 nit: removed the v2 clock read entirely. `buildBookingPrefillQuery` now takes `ctx: {today: string}`, symmetric with the reader — writer and reader are twins over the same contract and must not disagree about where "now" comes from. Module contains zero clock reads (verified: `grep -E "new Date\(\)|Date\.now|Intl\.DateTimeFormat" lib/booking-prefill.ts` → 0 hits). Test file reverted to fixed dates + injected `today` (no clock-relative arithmetic) — pure/deterministic, no Bangkok-midnight flake risk, and a caller can test its own link-building against a fixed date. The real caller (CAM-633's `BookingParseContext`) already holds `today` and passes it straight through.
