---
linear: CAM-636
feature: ai-assistant
epic: in-chat-guided-booking-camper-sets-dates-and-party (CAM-630)
persona: camper
artifact: story
owner: product-owner
status: In Progress (spec-lite, S — G1 folded into the G3 packet)
version: v1
updated: 2026-07-29
---
# Party size follows real capacity, not a hardcoded list of six (CAM-636)

<!-- Spec-lite (S): no schema/migration · no new API contract (bookingSchema.guests keeps its existing shape, only its bound tightens) · one cohesive feature surface (the guests control + its server-side bound) · diff ≤ ~150 lines (+tests). G1 folds into G3 per Gate policy v2. -->

## Story
As a **Camper**, I want the guests dropdown on the camp detail page to offer exactly the party sizes the camp can actually take, so that I can book a real group (e.g. 8 friends) at a camp that can hold them, and I find out about a tight or full stay from the dropdown itself, not from a rejected booking.
Why: `components/CampgroundDetailClient.tsx` rendered the dropdown from a literal `[1, 2, 3, 4, 5, 6]` — a camp with `maxGuestsPerDay = 50` could only ever be booked for up to 6 through the UI, and a camp with 2 places left still offered 6 (discovered only when the reservation was rejected). The server had no upper bound on `guests` at all, so a crafted request for 9999 guests passed validation.
Scope: make the guests `<Select>` on the camp detail page compute its option list from the real capacity ceiling (the camp's stated `maxGuestsPerDay` and, once dates are picked, the live remaining capacity for that exact stay — reusing the existing `remaining-capacity` fetch, no new fetch path) — and give `bookingSchema.guests` a real, sane upper bound as defense-in-depth. Does NOT change the actual availability enforcement (`checkDateAvailabilityInTx` inside the booking transaction already rejects an over-capacity request; unchanged by this story) and does NOT touch `lib/ai/` (a separate paid CI gate).
Depends on: CAM-267 PREP-1 (the existing remaining-capacity fetch/badge this story reuses, not re-implements) · epic CAM-630 (in-chat guided booking)

## AC
<!-- Then = user-visible (verbatim Thai where a fixed string exists) · System effect = data outcome, plain language · Neg/edge = failure twin. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camp with `maxGuestsPerDay = 50`, no check-in/check-out dates picked yet | Camper opens the "ผู้เข้าพัก" (guests) dropdown | The dropdown lists 1 through 50 guests — never capped at 6 | Option list computed from `campground.maxGuestsPerDay` (50); no remaining-capacity fetch needed yet | EC-1 |
| AC-2 | A camp with no stated `maxGuestsPerDay` (null) and no dates picked yet (capacity genuinely unbounded so far) | Camper opens the guests dropdown | The dropdown offers a useful range, 1 through 20 — never an unbounded/huge list and never empty | Ceiling resolves to `null` (both signals null) → the shared 20-option default is used | EC-2 |
| AC-3 | The same camp as AC-2 (`maxGuestsPerDay` null); camper then picks dates where the live remaining capacity for that exact stay is 8 | Remaining capacity finishes loading | The dropdown updates to offer 1 through 8 guests | Ceiling resolves to `remaining` (8) alone (`maxGuestsPerDay` still null) | EC-3 |
| AC-4 | A camp with `maxGuestsPerDay = 50`; camper picks dates where only 2 places are left for that exact stay | Remaining capacity finishes loading | The dropdown narrows to offer only 1 through 2 guests, and the page shows `เหลือ {n} ที่` (`{n}` = `2`) | Ceiling resolves to `min(2, 50) = 2` (both signals present, the tighter one wins) | EC-4 |
| AC-5 | A camp where the exact selected stay has 0 places left (numeric capacity hit 0, or the host blocked the whole stay) | Remaining capacity finishes loading | The guests dropdown is disabled (unusable) and the page shows `เต็มแล้ว`; the Reserve button stays disabled | `guestOptions` is empty (ceiling 0); Reserve's existing `isFullyBooked`-disabled path (unchanged by this story) still blocks the actual booking | EC-5 |
| AC-6 | A crafted request sends `guests: 9999` for any camp (bypassing the UI dropdown entirely) | The request reaches `POST /api/bookings` | The camper (if this ever happened through the UI) would see the existing generic `จองไม่สำเร็จ` failure — never a technical message | `bookingSchema` rejects the payload with `400` before the booking transaction runs; no `Booking` row is created | EC-6 |

## Rules
- BR-1 The real ceiling for the guests control combines two independently-nullable signals — `remaining` (live capacity for the exact selected stay, from the existing `remaining-capacity` fetch) and `maxGuestsPerDay` (the camp's stated per-day cap, available even before any dates are picked). `null` on either means "no cap from that signal", **never** "full" or "zero" — a falsy check (`!remaining`, `remaining || x`) is forbidden here because it would collapse `null` and `0` and hide every uncapped camp behind a single option. Combining rule: both null → unbounded; one null → use the other; both set → the smaller (the tightest real constraint) (proves AC-1..AC-5).
- BR-2 When the combined ceiling is unbounded (both signals null), the dropdown offers a fixed, useful range of 1 through 20 — bounded so the `<Select>` stays usable, never an arbitrarily long or empty list (proves AC-2).
- BR-3 When the combined ceiling is exactly 0, the dropdown has no valid options and is rendered disabled. This is a UI-only signal; the actual write-blocking guard remains the pre-existing `isFullyBooked` check on the Reserve button (`remainingCapacity.blockedByHost || remainingCapacity.remaining === 0`), unchanged by this story (proves AC-5).
- BR-4 The selected guest count is clamped down whenever it exceeds a newly-computed ceiling (e.g. the camper had 6 selected, then picked tighter dates where remaining is 2) — the control never keeps a selection that no longer appears in its own option list (proves EC-3 below).
- BR-5 `bookingSchema.guests` gains a real upper bound, `MAX_BOOKING_GUESTS = 500`, plus `.int()` (guests must be a whole number, per the existing capacity validation catalog, `.claude/rules/ux.md` §2). This is defense-in-depth ONLY — the actual availability check is `checkDateAvailabilityInTx` inside the booking transaction (`app/api/bookings/route.ts`), unchanged by this story. 500 is a sane hard ceiling: no real Thai camp listing (even a large group/event camp) legitimately takes more guests in a single booking, and it leaves generous headroom above any real `maxGuestsPerDay` a host would set (proves AC-6).

## Edge cases
<!-- cover: invalid · empty/zero · concurrent/duplicate · permission · boundary. -->
- EC-1 IF no dates are picked yet THEN the dropdown renders immediately from `maxGuestsPerDay` alone (or the AC-2 unbounded default) — it never waits on / blocks on the remaining-capacity fetch, which only exists once both dates are chosen (boundary of AC-1/AC-2, BR-1).
- EC-2 IF the remaining-capacity fetch fails (network error or a non-OK response) THEN `remainingCapacity` resets to `null` exactly as it does today, and the guests ceiling falls back to `maxGuestsPerDay` alone (or the unbounded default) — never crashes, never silently shows a wrong list (boundary of AC-3/AC-4; reuses the existing catch/`!response.ok` handling in `CampgroundDetailClient.tsx`, untouched by this story).
- EC-3 IF the ceiling shrinks after a guest count is already selected (e.g. 6 selected, then dates picked where remaining is 2) THEN the selected value clamps down to the new ceiling automatically — never left pointing at an option that no longer exists (BR-4).
- EC-4 IF `remaining` is 0 because the host blocked the whole stay (`blockedByHost = true`) rather than a numeric count hitting 0 THEN the guests control is disabled exactly the same as the numeric-0 case — both routes combine to ceiling 0 (boundary of AC-5, BR-1/BR-3).
- EC-5 IF a client sends `guests` as a non-integer (e.g. `2.5`) or a value above `MAX_BOOKING_GUESTS` (500) THEN the server rejects with `400` before the transaction runs — same as the `9999` case in AC-6 (boundary of AC-6, BR-5).

## Data
- No schema/migration. Reads only the existing `CampSite.maxGuestsPerDay` column (already on the `campground` prop passed into `CampgroundDetailClient`) and the existing `remaining-capacity` endpoint response (`{remaining, blockedByHost}`, `app/api/campsites/[id]/remaining-capacity/route.ts`, unchanged). `bookingSchema.guests` keeps its existing shape (`number`), only its zod bound tightens (`.int().min(1).max(500)`).

## Seams & refs
- Reuse: `remainingCapacity` state + the existing fetch effect in `CampgroundDetailClient.tsx` (CAM-267 PREP-1) — no new fetch path added. `MAX_BOOKING_NIGHTS`'s pattern in `lib/validations/booking.ts` (an exported, named cap constant) — `MAX_BOOKING_GUESTS` follows the same shape. The `null`-means-unbounded / `0`-means-full invariant already established across the capacity seam (`getRemainingCapacity`, `checkDateAvailabilityInTx`) — CAM-355/CAM-400 precedent, not re-derived here.
- New, single-purpose: `lib/guest-capacity.ts` (`computeGuestCeiling`, `buildGuestOptions`) — the ONE place the ceiling-combining rule (BR-1) and the option-list rule (BR-2/BR-3) live; the component imports it rather than hand-rolling the logic inline.
- Refs: epic CAM-630 (in-chat guided booking) · CAM-267 (remaining-capacity display this reuses) · CAM-355/CAM-400 (the null/0 capacity-invariant precedent).

## Out of scope
- Wiring the in-chat booking-prefill `guests` param (`lib/booking-prefill.ts`, already validates against an injected `ctx.maxGuests`) into this page's initial guest selection → a separate follow-up ticket under epic CAM-630 (not yet filed).
- Any change to `lib/ai/` tool schemas or behavior → explicitly out of scope for this ticket (triggers a separate paid CI gate).
- Per-camp-tier or per-host-configurable upper bounds above `MAX_BOOKING_GUESTS` → a future ticket if a real host need ever surfaces.

## Self-verify
- AC-1..AC-5 → unit tests, `__tests__/cam-636-guest-capacity.test.ts` (`computeGuestCeiling`/`buildGuestOptions` covering all four capacity shapes plus the `0`-ceiling case, with an explicit regression guard against the falsy-check trap named in BR-1) + source-inspection wiring test, `__tests__/cam-636-guests-select-wiring.test.ts` (proves the component imports and actually wires the shared helpers, the `disabled` state, and the clamp effect — no React render harness exists for this ~15-dependency component; source-inspection with position/behavior assertions is the established precedent for this file: cam-397, cam-354, cam-528, cam-616).
- AC-6 → unit tests, `__tests__/cam-636-booking-guests-bound.test.ts` (`bookingSchema` rejects `9999` and `MAX_BOOKING_GUESTS + 1`, accepts `MAX_BOOKING_GUESTS` and a realistic `30`, rejects a non-integer, keeps the existing `min(1)`/`default(1)` behavior unchanged).
- Story-specific: `grep -nE "\[\s*1\s*,\s*2\s*,\s*3\s*,\s*4\s*,\s*5\s*,\s*6\s*\]" components/CampgroundDetailClient.tsx` → 0 hits (regression guard for the exact literal this story removes).
- Gate = `/quality-gate`. Done = merged to `dev` with AC-1..AC-5 verified on localhost (dev DB) against a real camp (one with `maxGuestsPerDay` set, one without, and dated stays at remaining 8 / 2 / 0) before merge; AC-6 is server-side only, verified via its test suite (no browser surface to check). G4 re-verifies on the real Staging URL after the batched promote.

## Changelog
- v1 (2026-07-29) — created; implemented in the same PR (spec-lite: single cohesive feature surface, no schema/migration/new API contract).
