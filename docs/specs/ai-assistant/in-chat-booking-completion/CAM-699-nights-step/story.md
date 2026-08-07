---
artifact: story
feature: ai-assistant
epic: in-chat-booking-completion (CAM-695)
story: nights-step (CAM-699)
status: In Progress
version: v1
updated: 2026-08-06
---

## Story
As a **Camper**, I want to say how many nights I'm staying and see the chat's summary and total match that real span, so that I never confirm a booking that misquotes my stay.
Why: verified defect (ADR-018) — the chat books exactly 1 night no matter what. The date CHIP path hardcodes `checkOut = checkIn + 1` (`use-ai-chat.ts`), and even when a typed phrase already resolves a real multi-night range (e.g. "สุดสัปดาห์นี้" = 2 nights via `resolveDatesCore`'s weekend rule), `buildSummaryView` hardcoded `nights: 1` regardless. ADR-018 D8 names this a correctness prerequisite of the coming confirm button (CAM-702): once the chat writes for real, a misquoted total is not a cosmetic bug, it is "the number I agreed to is not the number I was charged."
Scope: insert a new `nights` step into the booking flow's state machine (`components/ai-chat/booking-flow.ts`) between `date` and `guests`; wire its question view (`booking-view.ts`), its orchestration (`booking-turn.ts`), and its chip handler (`use-ai-chat.ts`); fix `buildSummaryView` to use the real night count for both the summary row and the priced total; add the `nights.*` copy (TH/EN). Pre-fill `nights` when the `date` step's own typed answer already resolved a genuine multi-night span, so the camper who said "สุดสัปดาห์นี้" is never asked again. Minimal necessary rendering support in `AiChatBookingStep.tsx` (chip kind + step-copy routing) so the step actually renders — see "Seams & refs" for why this file, though not in the dispatch's literal file list, could not be avoided.
Depends on: CAM-697 (design brief v2, §2/§3) · ADR-018 D8 · epic CAM-695

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The camper is at the `date` step | They tap a date chip (always a single open day) | `ขั้นที่ 2 จาก 4 · จำนวนคืน` then `{date} นะ ไปกันกี่คืนดี` | `nights` step becomes current; `checkOut` holds a 1-night placeholder the `nights` step will overwrite | EC-1 |
| AC-2 | The camper is at the `nights` step | They tap the "2 คืน" chip | Advances to `guests`, no `nights` question shown again | `slots.nights = 2`, `slots.checkOut` recomputed as `checkIn + 2` | EC-2 |
| AC-3 | The camper is at the `nights` step | They type `3` (or `สามคืน`) | Advances to `guests` identically to a "3 คืน" chip | `slots.nights = 3`, `checkOut = checkIn + 3` | EC-2/EC-3 |
| AC-4 | The camper typed "สุดสัปดาห์นี้" at the `date` step (weekend rule = 2 real nights) | The date step accepts the range | Flow goes straight to the `guests` question — no `nights` question shown | `slots.nights = 2` is PRE-FILLED from the resolved range; `nights` step's `isSatisfied` is true without an answer | AC-1 (the contrasting case: a 1-night span is never pre-filled) |
| AC-5 | The camper reaches `summary` (nights=2, guests=2, camp priced ฿500/night PER_SITE) | The summary view renders | `{date} พัก 2 คืน` and `ยอดรวมโดยประมาณ ฿1,000` | `buildSummaryView` reads `slots.nights` (never a hardcoded `1`); `computeBookingPrice` is called with the real `nights` | EC-4 (the regression this story closes) |
| AC-6 | The camper is at the `nights` step | They type `0` | Re-asked (reuses `nights.unreadable`, the same precedent `guests`' own non-capacity rejections already set) | `nights` NOT set; `consecutiveMisses` NOT incremented (a real, understood-but-rejected answer) | EC-5 |
| AC-7 | The camper is at the `nights` step | They type `31` | `จองได้สูงสุด 30 คืนต่อครั้ง ลองบอกจำนวนที่น้อยกว่านี้` | `nights` NOT set; `consecutiveMisses` NOT incremented | EC-6 |
| AC-8 | The camper is at the `nights` step | They type unreadable text (e.g. "แล้วมีเปลให้เช่าไหม") twice in a row | First: `ยังจับจำนวนคืนไม่ได้เลย บอกเป็นตัวเลขได้ เช่น 2 คืน`; second: the flow hands off to the assistant | First reprompts (`consecutiveMisses: 1`); second exits (`booking -> null`), `prefill` carries whatever was collected | EC-7 |
| AC-9 | The camper reaches `guests` from `nights` | They tap `ย้อนกลับ` | Returns to the `nights` question, freshly asked | `slots.nights` cleared; `checkIn`/`checkOut`/`guests` kept | EC-8 |
| AC-10 | The camper reaches `summary` | They tap `แก้วัน` | Returns to the `date` question | `checkIn`/`checkOut`/`nights` ALL cleared (a deliberate simplification — see Rules BR-5); `guests` kept | EC-9 |

## Rules
- BR-1 `BookingSlots` gains `nights?: number` (a flat, optional, serialisable field — the module's existing "flat optionals only" rule is unbroken). `checkOut` is always derived from `checkIn + nights` at the moment `nights` is accepted, never hand-computed elsewhere (proves AC-2/AC-3).
- BR-2 The `nights` step's `isSatisfied` checks `slots.nights !== undefined` — NOT a `checkOut - checkIn` span check. A span-only check cannot distinguish "not yet asked" (always a 1-night placeholder, whether from a date chip or a single typed day) from "the camper explicitly chose 1 night" (which recomputes the SAME 1-night span) — that ambiguity would loop the `nights` question forever the instant a camper picked exactly 1 night. This is a deliberate, reasoned deviation from the dispatch's "recommend keeping the slot shape unchanged" note (see `booking-flow.ts`'s own `BookingSlots` doc comment for the full argument).
- BR-3 `acceptDateCandidate` (the `date` step's own policy) PRE-FILLS `nights` from its own candidate's span whenever that span is genuinely > 1 night (a typed range phrase — weekend rule, long-weekend span, or the first range of a date-SET phrase). A date CHIP or a single-day typed answer always produces exactly a 1-night span, so this path never fires for them, and `nights` is deliberately left unset — the `nights` step still asks (proves AC-1/AC-4).
- BR-4 `nights` accepts a positive integer up to `MAX_BOOKING_NIGHTS` (30 — imported from `lib/validations/booking.ts`, the SAME real server bound, never a second independently-chosen 30). Over the ceiling → `reasonKey:"too_long"` with the real `{max}` (proves AC-7). `<= 0` or non-integer → `reasonKey:"invalid_nights"`, reusing the `unreadable` copy (the same precedent `guests`' `invalid_guests` already sets — proves AC-6).
- BR-5 `ย้อนกลับ`/`แก้วัน` to `date` clears `checkIn`, `checkOut`, AND `nights` together (never `nights` alone kept against a new date) — the safe, conservative choice over letting `nights` survive a date-only edit, which would need the `date` step itself to re-derive `checkOut` against a KEPT `nights` value (out of this story's scope; the design brief's later 409-rewind table, CAM-702's territory, does keep `nights` there under a different, system-triggered rewind). `ย้อนกลับ` to `nights` (from `guests`) clears ONLY `nights` (proves AC-9/AC-10).
- BR-6 `parseNightsCount` shares its digit-token regex AND its 0-99 Thai-number-word table with the `guests` step's `parseGuestCount` (both wrap one `parseCountToken(text, classifier)`) — the reuse the ticket requires, never a second hand-built Thai-number table (proves AC-3).
- BR-7 Chip generation (`buildNightChipSpecs`) always offers `1..MAX_BOOKING_NIGHT_CHIPS` (4) — the design brief's full formula also truncates to the consecutive-open-night "run" from the chosen check-in date; that scan is explicitly OUT of this story's scope (see Out of scope).

## Edge cases
- EC-1 IF a date CHIP is tapped THEN `checkOut` holds a 1-night PLACEHOLDER only — never shown to the camper before the `nights` step overwrites it (BR-1/BR-3).
- EC-2 IF a nights CHIP and the identical typed number are submitted for the SAME slots THEN both produce byte-identical outcomes (BR-1, the same typed/chip parity contract every other step proves).
- EC-3 IF the nights answer is a bare Thai number word with no digit (e.g. "สามคืน") THEN it still resolves correctly (BR-6) — this is the exact gap this story's own build caught and fixed (see Changelog).
- EC-4 IF `buildSummaryView` runs THEN `slots.nights` is always defined (guaranteed by `currentStep` never deriving to `summary` while `nights` is unsatisfied) — the `!` non-null assertion is safe by construction, not a runtime guess.
- EC-5 IF nights is `0` or negative THEN reject, never a miss (BR-4).
- EC-6 IF nights `> 30` THEN reject with the real ceiling in the copy, never a fabricated or hardcoded-elsewhere number (BR-4).
- EC-7 IF two consecutive nights answers are genuinely unparseable THEN the flow exits to the assistant with whatever was collected (`prefill`), identical to every other step's 2-strike escape hatch (BR unchanged from CAM-633).
- EC-8 IF `ย้อนกลับ` is tapped from `guests` THEN only `nights` clears — `checkIn`/`checkOut`/`guests` are kept (BR-5).
- EC-9 IF `แก้วัน` is tapped from `summary` THEN `nights` clears alongside `checkIn`/`checkOut` — `guests` is kept (BR-5).

## Data
- No schema/DB — `BookingSlots` is client-side flow state only (same as CAM-633's own module). Migration: none.

## Seams & refs
- Reuse: `MAX_BOOKING_NIGHTS` (`lib/validations/booking.ts`, already shared by `lib/booking-prefill.ts`) · `computeBookingPrice`/`buildBookingPriceArgs` (`lib/booking-pricing.ts`, unchanged call site, now given the real `nights`) · the guests step's Thai-number table, refactored into a shared `parseCountToken` rather than duplicated.
- Refs: ADR-018 D7/D8 (why nights is a correctness prerequisite) · CAM-697 design brief v2 §2/§3 (the nights step's exact copy/chip/control contract) · epic CAM-695.
- **Deviation, disclosed:** `components/ai-chat/AiChatBookingStep.tsx` is touched even though it is not named in the dispatch's literal file list. It is the ONLY component that renders a booking step; without widening its `step`/`BookingChipSpec` types and its chips-label/type-hint routing to include `"nights"`, the step could not render or even typecheck (the `BookingQuestionView.step` union is declared there, not in `booking-flow.ts`). The touch is minimal and mechanical — a type widening, one new chip-kind branch reusing the EXACT existing chip anatomy, and a 3-way copy lookup replacing a 2-way ternary. No new control was added (`editNights` from `summary` is deliberately NOT built — see Out of scope) specifically to avoid rippling into `AiChatMessageList.tsx`/`AiChatPanel.tsx`, which stayed untouched.
- **Sequencing note (Info, not a blocker):** the epic's own "Two-writer schedule" narrative lists Track A's serial order as CAM-701 before CAM-699; this dispatch built CAM-699 first (the story-dependency table only names CAM-697 as CAM-699's dependency). CAM-701, when it lands, will touch `BookingSummaryView`'s controls array in the same region this story edited — worth a fresh read of `booking-view.ts`/`AiChatBookingStep.tsx` before that story starts, not a merge conflict risk this story could resolve itself.

## Out of scope
- The design brief §3 `nights.overRun` bound (truncate chips to the consecutive open-night "run" from check-in, offer the run itself when a typed count exceeds it) — needs a scan across `weekendAvailability` this story does not add → follow-up, likely alongside CAM-700 (which already needs span-aware availability for pitches).
- A direct `แก้จำนวนคืน` edit shortcut from `summary` (reachable today via `แก้วัน` → re-answer `nights`) → would touch `AiChatMessageList.tsx`/`AiChatPanel.tsx`, outside this story's minimal surface.
- The `spot` step, the real confirm/write, submitting/success/failure states → CAM-700/CAM-701/CAM-702 respectively (ADR-018/epic CAM-695).
- Per-camp step-caption total (`{total}` stays the static `BOOKING_STEPS.length` = 4) → CAM-700 (design brief §2's own critical note).

## Self-verify
- AC-1..AC-10 → unit, `__tests__/cam-699-nights-step.test.ts` (booking-flow.ts + booking-view.ts + booking-turn.ts, driven exactly as `use-ai-chat.ts` drives them) + `__tests__/cam-699-ai-chat-booking-step-nights.test.ts` (jsdom render of the nights chips/caption/controls).
- AC-4/AC-5 also carry the RED-first regression case (documents the exact old-vs-new total for a typed "สุดสัปดาห์นี้").
- Story-specific: existing `cam-633`/`cam-638`/`cam-640` suites updated minimally to the new 4-step shape (registry order, `currentStep` derivation, caption counts, `back`/`editGuests`/`editNights`-adjacent controls) — every changed assertion carries a `[CAM-699]` tag and a dated comment, none silently deleted.
- Gate = `/quality-gate` · Done = merged into `dev` with the full suite green + AC verified on localhost (dev DB — no schema in this story, nothing to seed).

## Changelog
- v1 (2026-08-06) — created. Build-time finding: reusing `parseGuestCount` verbatim for `nights` (as the dispatch's phrasing suggested) silently failed on a bare Thai number WORD with no digit ("สามคืน") — `parseGuestCount` only strips the `คน` classifier, never `คืน`, so the Thai-number-word table lookup missed. Caught by a real test (`"3 คืน"` vs `"สามคืน"` parity), fixed by extracting the shared `parseCountToken(text, classifier)` core so BOTH steps share the SAME table and digit logic with only the classifier word differing — the reuse the ticket actually asked for, corrected to work.
