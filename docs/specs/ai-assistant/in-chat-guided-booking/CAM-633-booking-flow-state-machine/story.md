---
artifact: story
feature: ai-assistant
epic: in-chat-guided-booking (CAM-630)
story: booking-flow-state-machine (CAM-633)
status: In Progress
version: v1
updated: 2026-07-29
---

<!--
This story ships a pure, framework-free state machine only. NOTHING imports it
yet — wiring into AiChatPanel/AiChatMessageList (chips, the composer, the
availability re-check, the handoff link) is CAM-639/CAM-640. Because there is
no UI in this story, the AC table's "Then" column states the OBSERVABLE
RETURN SHAPE of `advanceBookingFlow` (a future consumer's contract) rather
than rendered Thai copy — the exact Thai copy for this flow already exists in
the CAM-637 design brief and is out of scope here (this story returns
semantic outcomes/reasons; CAM-639/640 maps them to that copy).
-->

## Story
As a **Camper** (indirectly — via the future in-chat booking flow CAM-639/640 wires on top of this), I want the 3-step booking flow (date -> guests -> summary) to be a pure, unit-testable state machine with the current step DERIVED from what is already filled in, so that a later story can wire chips/typing/back/cancel into the chat UI without re-deriving this logic per component.
Why: `components/ai-chat/conversation.ts` states the repo convention in its own header — pure transition logic lives apart from the `"use client"` glue so it is unit-testable directly (vitest here runs `environment: 'node'`, no jsdom) — and `lib/taxonomy-registry.ts:3-19` documents the exact scar of NOT doing this for a data shape used across many components (a step-id list hand-copied per consumer).
Scope: build `components/ai-chat/booking-flow.ts` — the step registry (`BOOKING_STEPS`), the derived-step functions (`currentStep`, `stepProgress`), the flow state (`BookingFlowState`/`BookingSlots`), and the single transition function `advanceBookingFlow` (typed input for every step; chips are modeled as the same typed path, never a parallel one; cancel; the 2-strike escape hatch; the guests-step capacity check). No React, no network, no DB, no `AiChatPanel`/`AiChatMessageList` changes.
Depends on: CAM-632 (`resolveDatesCore`, the pure date resolver this reuses unchanged) · CAM-637 (design brief — the flow/copy/testid contract this machine's outcomes will eventually drive) · epic CAM-630

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Empty slots (`{}`) | `currentStep(slots)` is called | N/A (no UI in this story) | Returns the `date` step — the first unsatisfied step in `BOOKING_STEPS`, never a stored cursor | EC-1 |
| AC-2 | `checkIn`/`checkOut` are filled, `guests` is not | `currentStep(slots)` is called | N/A (no UI in this story) | Returns the `guests` step | EC-1 |
| AC-3 | All three slots are filled | `currentStep(slots)` is called | N/A (no UI in this story) | Returns `summary` — the terminal step (`isSatisfied` always `false`), so it stays current even if called again | EC-1 |
| AC-4 | At the `date` step, empty slots | A camper types `เสาร์หน้า` (or `พรุ่งนี้`) | N/A (no UI in this story) | `advanceBookingFlow` returns `{kind:"advance", state:{slots:{checkIn,checkOut}, consecutiveMisses:0}}` with the SAME real calendar date `resolveDatesCore` itself would resolve — identical to what a chip carrying that date would produce | EC-2 |
| AC-5 | At the `guests` step, a date already picked | A camper types `8 คน`, `แปดคน`, or a bare `8` | N/A (no UI in this story) | All three produce the IDENTICAL outcome `{kind:"advance", ..., guests:8}` — typed input equals chip input, by construction (one parse path, not two) | EC-3 |
| AC-6 | At the `guests` step, `remaining:3` (a real live cap), `maxGuestsPerDay:null` | A camper types `5` | N/A (no UI in this story) | Returns `{kind:"reprompt", reason:"over_capacity", limit:3}` — the real ceiling, never a silently truncated/guessed number; the slot is left unfilled | EC-4 |
| AC-7 | At the `guests` step, `remaining:null` (no cap set on this camp), `maxGuestsPerDay:null` | A camper types `50` | N/A (no UI in this story) | Advances with `guests:50` — `null` is read as "unbounded", never as "reject everything" (the capacity trap this ticket exists to close) | EC-4 |
| AC-8 | Any step, one prior unparsed turn already reprompted once | A camper's SECOND consecutive turn is also unparsed | N/A (no UI in this story) | Returns `{kind:"exit", reason:"handoff", prefill:{...slots so far}}` — the flow hands the turn back to the model rather than reprompting a third time | EC-5 |
| AC-9 | Any step, any slots | A camper presses cancel | N/A (no UI in this story) | Returns `{kind:"exit", reason:"cancelled"}` immediately, with no prefill | EC-6 |

## Rules
- BR-1 Steps are a REGISTRY (`BOOKING_STEPS: readonly BookingStepDef[]`), and the current step is DERIVED via `currentStep(slots)` (first step whose `isSatisfied(slots)` is `false`, else the last step) — never stored on `BookingFlowState`. Adding a step later touches exactly the registry array + its own i18n keys, nothing else (proves AC-1/AC-2/AC-3).
- BR-2 `BookingSlots` is flat optionals only — `{checkIn?: string; checkOut?: string; guests?: number}` — ISO `YYYY-MM-DD`, `checkIn` inclusive, `checkOut` EXCLUSIVE (byte-identical convention to `resolveDatesCore`/`Booking.checkOutDate`). No `Date` objects, no functions, no money (proves the whole state is JSON-serialisable for a later persistence round).
- BR-3 (the capacity trap) `remaining`/`maxGuestsPerDay` on `BookingParseContext` are `number | null`. `null` means that particular cap is NOT SET (unbounded), never "full"/"zero". The combined ceiling (`combineCapacityLimit`, exported) is the tighter of whichever side(s) are actually set; both `null` = no ceiling at all. Every branch is an explicit `=== null` check, never a falsy (`!remaining`) check (proves AC-6/AC-7).
- BR-4 A chip tap and a typed answer are the SAME code path — `BookingFlowInput` has only `{kind:'text', text}` and `{kind:'cancel'}`; there is no separate chip-input variant. This makes "typing equals chip" true by construction, not by two implementations kept in sync by hand (proves AC-4/AC-5).
- BR-5 (the escape hatch) An unparsed input reprompts once (`consecutiveMisses` +1); a SECOND consecutive unparsed input exits with `reason:"handoff"` and a `prefill` carrying whatever slots were already collected (however incomplete). A successful parse (`advance` OR `over_capacity`) resets `consecutiveMisses` to 0 — an over-capacity reply is a real, understood answer, not a miss (proves AC-8).
- BR-6 `advanceBookingFlow` never mutates its `state` or `ctx` arguments — every outcome carries freshly-constructed objects (proves the module is safe to call from a React state updater without a defensive clone).
- BR-7 This module does no money math. A future summary UI that needs a total goes through `computeBookingPrice` (`lib/booking-pricing.ts`) — the same function the camp page and `POST /api/bookings` use — never a second, hand-rolled multiplication (price is per night; guests do not multiply it).

## Edge cases
- EC-1 IF `summary`'s `isSatisfied` is ever asked THEN it returns `false` — it is the terminal step and `currentStep` derives back to it for good once `date`+`guests` are filled (BR-1).
- EC-2 IF the date-step text does not resolve via `resolveDatesCore` (including `15 ส.ค.` — see the Changelog/known-limitation note below) THEN `advanceBookingFlow` returns `reprompt`/`reason:"unparsed"`, never a fabricated date (BR-5).
- EC-3 IF the guests-step text names `0` or cannot be read as a number (Arabic digit or a Thai number word 0-99) THEN it reprompts as `unparsed`, never advances with an invalid count (BR-4).
- EC-4 IF a typed guest count exceeds the combined ceiling (`combineCapacityLimit`) THEN the flow stays on `guests`, reprompts with `reason:"over_capacity"` and the real `limit`, and does NOT increment `consecutiveMisses` (BR-3/BR-5).
- EC-5 IF a second consecutive turn (at any step) is unparsed THEN the flow exits with `reason:"handoff"` and a `prefill` of whatever `BookingSlots` fields are already set — never a third reprompt (BR-5).
- EC-6 IF `cancel` is submitted at any step (including `summary`) THEN the flow exits immediately with `reason:"cancelled"` and no `prefill` (BR-5).

## Data
- No schema/DB — this module persists nothing. `BookingSlots`/`BookingFlowState` are designed to be plain, JSON-serialisable data (BR-2) so a later story can round-trip them through a login/redirect without a bespoke (de)serializer. Migration: none.

## Seams & refs
- Reuse: `resolveDatesCore` (`lib/ai/date-phrases.ts`, CAM-632) is the ONLY date-resolution logic the `date` step calls — reused verbatim, not reimplemented, not extended. `computeBookingPrice` (`lib/booking-pricing.ts`) is named (BR-7) as the seam a future summary UI must use, but is not called from this module. `lib/taxonomy-registry.ts:3-19` is the pattern this file's registry structure follows.
- Refs: ADR-016 (camper direct booking + in-chat completion) · CAM-637 design brief (the flow/copy/testid contract a future consumer maps these outcomes onto) · epic CAM-630.

## Out of scope
- Wiring `BOOKING_STEPS`/`advanceBookingFlow` into `AiChatPanel`/`AiChatMessageList` (chips, the composer, focus management, the live availability re-check before `summary`, the `back`/`edit` controls, the handoff `<Link>`) → CAM-639/CAM-640.
- Delivering `ThaiHoliday` data to the browser so the `date` step can resolve holiday-phrases client-side → CAM-640 (already scoped out of CAM-632 too).
- `lib/booking-prefill.ts` (the module that will consume the `exit`/`handoff` `prefill` payload) — landing in a separate, not-yet-merged ticket (CAM-634); this story does not import it, only shapes its payload as plain `BookingSlots`.
- Extending `resolveDatesCore` with an absolute day+Thai-month rule (e.g. `15 ส.ค.`) — see the Changelog note; a follow-up story if the product wants this literal example from the design brief to actually resolve.

## Self-verify
- AC-1..AC-3 (registry/derivation) → unit, `__tests__/cam-633-booking-flow.test.ts` ("BOOKING_STEPS registry + derived current step" + `stepProgress`).
- AC-4/AC-5 (typed equals chip) → unit, same file ("date step — parse", "guests step — parse"), pinned against the real `resolveDatesCore` output (not a mock).
- AC-6/AC-7 (capacity trap) → unit, same file ("the capacity trap"), covering both-null / remaining-only / maxGuestsPerDay-only / both-set / exactly-at-limit.
- AC-8 (escape hatch) → unit, same file ("the escape hatch"), including the prefill-carries-partial-slots case and the miss-streak-resets-on-a-real-answer case.
- AC-9 (cancel) → unit, one case per step (`date`/`guests`/`summary`).
- Story-specific: never-mutates-input (`structuredClone` before/after comparison) · a registry guard (source-inspects `components/ai-chat/` for a second hand-copied step-id list) · a static import guard (no React/Prisma/fetch/real-clock import in the module's own source).
- Gate = `/quality-gate` · Done = merged into `dev` with the full suite green on localhost (dev DB not touched — no schema in this story).

## Changelog
- v1 (2026-07-29) — created. **Known limitation surfaced during build (not fixed here):** the CAM-633 ticket and the CAM-637 design brief both name `15 ส.ค.` as a typed date-step example, but the real `resolveDatesCore` (CAM-632, reused as-is) has no rule for an absolute day+Thai-month phrase — verified behaviourally against the function, not assumed (`{ok:false, reason:'unsupported'}`). Pinned as a `[documented-limitation]` test rather than silently dropped or silently "fixed" by extending `lib/ai/date-phrases.ts` outside this story's surface. Flagged back to the ticket/design-brief owner: either add the absolute-date rule in a follow-up story, or correct the two documents' wording.
