---
linear: CAM-640
feature: ai-assistant
epic: in-chat-guided-booking (CAM-630)
persona: Camper
artifact: story
owner: frontend
status: In Progress
version: v1
updated: 2026-07-29
---

# Starting a booking from the chat runs the whole flow (CAM-640)

<!-- G2: standard class (criteria met) — composes existing tokens/components/flows per DESIGN.md
     and the CAM-637 design brief only; no new screen/flow/token. -->

## Story
As a **Camper**, I want tapping "เริ่มจอง" on a camp's detail card in the chat to walk me through
date, party size, and a summary, so that I land on that camp's booking page with my dates and party
size already filled in.

Scope: wires the already-built pieces (`booking-flow.ts` state machine, `AiChatBookingStep`
presentation, the `kind:"booking"` entry render) into a live flow — holds the flow state, intercepts
the composer's `sendMessage` for a typed answer, handles every chip/control tap, and produces the
handoff link on `summary`. Does **not** touch `lib/ai/**` (CAM-641 owns the assistant's own
answer-policy change) and does **not** implement the design brief's §5 E1/E3 LIVE pre-summary
availability re-check (see `## Out of scope`).

Depends on: CAM-633 (state machine) · CAM-634 (prefill contract) · CAM-635 (camp page reads the
prefill) · CAM-637 (design brief) · CAM-638 (presentation) · CAM-639 (entry render)

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The detail card's async fetch has resolved | Camper looks at the footer | Two buttons, `ดูหน้าลาน` (outline) and `เริ่มจอง` (primary) | No state change | EC-1 |
| AC-2 | Camper taps `เริ่มจอง` | — | The chat shows `ขั้นที่ 1 จาก 3 · เลือกวัน` and the camp's own ask sentence + open-day chips; the detail pane closes | A fresh `BookingFlowState` starts; `weekendAvailability`/capacity/price are captured once from the already-fetched detail | — |
| AC-3 | The `date` question is showing | Camper taps an open-day chip | A user bubble echoing that day, then `ขั้นที่ 2 จาก 3 · จำนวนคน` with the day's own remaining count in the sentence | `slots.checkIn`/`checkOut` are set (one night) | EC-2 |
| AC-4 | The `date` question is showing | Camper types `เสาร์หน้า` instead of tapping a chip | The SAME next question as AC-3 would show for that Saturday's chip | Identical `slots` result to the chip path (same `parse`→`accept` gate) | EC-3 |
| AC-5 | The `guests` question is showing, ceiling is 6 | Camper types `9999 คน` | `{date} เหลือ 6 ที่ ไป 9999 คนอาจไม่พอ เลือก 6 คนได้เลย หรือกดย้อนกลับไปหาวันที่รับได้ทั้งกลุ่ม` + one chip `6 คนก็ได้` | `slots.guests` NOT set; still on `guests` | EC-4 |
| AC-6 | Camper types a date that is full in the captured snapshot | — | The `date` question re-appears: `ขอโทษที {date} เต็มแล้ว ลองวันอื่นดูไหม` + a fresh chip row (that day excluded) | `slots` unchanged (never committed) | EC-5 |
| AC-7 | `date` + `guests` are both answered | — | `ขั้นที่ 3 จาก 3 · ตรวจดูอีกที` + a summary card (camp/dates/guests/total) + `ไปกรอกต่อที่หน้าจอง` | Handoff link built via `buildBookingPrefillQuery`, `today` from `bangkokTodayISO(now)` | — |
| AC-8 | The summary is showing | Camper taps `ไปกรอกต่อที่หน้าจอง` | Navigates to `/campgrounds/<slug>?checkIn=…&checkOut=…&guests=…&from=chat`; the camp page shows those exact dates + guest count | No booking is created (round-1 writes nothing) | — |
| AC-9 | Any step is showing | Camper taps `ยกเลิกการจอง` | `ยกเลิกให้แล้ว อยากดูลานอื่นต่อไหม` | Flow state cleared; composer returns to a normal turn | — |
| AC-10 | A booking turn is active (any step) | Camper types **anything** at any point | The composer NEVER disables — typing always works, a chip is only ever a shortcut | `sending` stays `false` for the whole turn (no network call) | EC-6 |
| AC-11 | Camper's input is unreadable at the current step, twice in a row | — | Second miss: `โอเค พักเรื่องจองไว้ก่อน เดี๋ยวเราตอบเรื่องนี้ให้`; the turn after that reaches the assistant normally | Flow state cleared; the NEXT `sendMessage` call is a normal network turn | EC-7 |

## Rules
- BR-1 The composer's `disabled` prop is never set by booking-flow code (`sending` is untouched by any booking handler) — proves AC-10.
- BR-2 The intercept in `sendMessage` sits strictly AFTER the existing `if (sending || !isSendableQuestion(text)) return;` guard — a send while `sending` is true can never create a booking entry.
- BR-3 A chip candidate goes through the SAME step `accept()` a typed candidate goes through (`booking-flow.ts`, unmodified) — no separate, unchecked chip merge path.
- BR-4 `today` for both `BookingParseContext` and `buildBookingPrefillQuery`'s `ctx.today` is derived from `bangkokTodayISO(now)` — never a naive UTC-derived date.
- BR-5 `source: 'CHAT'` is set by the ARRIVING page (`app/campgrounds/[slug]/page.tsx`, CAM-635/CAM-642) from `from=chat` — this story never sets or relays it.
- BR-6 `ย้อนกลับ`/`แก้วัน`/`แก้จำนวนคน` clear only the field(s) owned by the returned-to step; anything answered further along is kept (the derived-step design).

## Edge cases
- EC-1 IF the detail fetch is still loading or failed THEN `เริ่มจอง` is `disabled` (no seed data to start from) (BR-1)
- EC-2 IF a chip is tapped on a SUPERSEDED (non-current) booking entry THEN it is a no-op (handler props are `undefined` for any entry whose `view.isCurrent` is `false`)
- EC-3 IF the camper types something the current step's `parse()` cannot read THEN the step re-asks once (`unreadable` copy), never advances
- EC-4 IF a typed guest count is a non-integer or ≤ 0 THEN it is rejected the same way an over-capacity count is (the `unreadable` copy — booking-flow.ts's own `invalid_guests` reason has no dedicated UI copy in this round)
- EC-5 IF the full-day candidate has NO entry at all in the captured snapshot (a date past the fetched window) THEN it is accepted (never fabricate a rejection from absent data)
- EC-6 IF a booking turn is in flight (there is none — it resolves synchronously) THEN N/A — every booking turn resolves in the same tick, so `sending` never has a "true" moment to represent it
- EC-7 IF the camper cancels mid-flow THEN no `handedToAssistant` notice fires — `ยกเลิกให้แล้ว…` fires instead, immediately, from any step (BR-6 note: cancel is unconditional, not a 2-strike case)

## Data
- No schema/migration. In-memory-only client state (`BookingFlowState` + a `BookingCampContext` snapshot), held in a `useRef` in `use-ai-chat.ts` — nothing persisted.

## Seams & refs
- Reuse: `components/ai-chat/booking-flow.ts` (state machine, unmodified) · `components/ai-chat/AiChatBookingStep.tsx` + `ChatChipRow.tsx` (presentation, unmodified) · `components/ai-chat/conversation.ts` (extended: `appendBookingEntry`/`appendBookingNotice`) · `lib/booking-prefill.ts` (`buildBookingPrefillQuery`, unmodified) · `lib/booking-pricing.ts` (`computeBookingPrice`/`resolveUnitPrice`, unmodified) · `lib/ai/date-phrases.ts` (`bangkokTodayISO`, unmodified).
- New: `components/ai-chat/booking-view.ts` (pure view-builders) · `components/ai-chat/booking-turn.ts` (pure orchestration reducer).
- Refs: design brief `docs/specs/ai-assistant/in-chat-guided-booking/CAM-637-design-brief/design.md`.

## Out of scope
- The design brief's §5 E1/E3 LIVE pre-summary availability re-check (a network re-fetch right as `guests` completes, with its own `isChecking`/`checkFailed` UI) — this story's §1 "typed full day" check is a SYNCHRONOUS lookup against the snapshot captured at flow start, not a live re-check. → follow-up ticket (none filed yet; the epic has no remaining frontend story slot — flag to the PO if this gap matters before release).
- Focus management on step transition (design brief §7's "move focus to the new block's caption" table) — not wired in this story; the log's existing `aria-live="polite"` still announces every new block once. → follow-up ticket if an a11y audit flags it.
- `EC-4`'s `invalid_guests` case (a typed non-integer/≤0 count) reuses the `unreadable` copy rather than a dedicated string — the design brief's copy catalog has no separate key for it.

## Self-verify
- AC-1..11 → unit (`__tests__/cam-640-booking-view.test.ts`, `cam-640-booking-turn.test.ts`, `cam-640-use-ai-chat-wiring.test.ts`) + e2e (`e2e/regression/cam-640-chat-booking-round-trip.spec.ts`, AC-1/2/3/7/8)
- Story-specific: intercept-after-guard ordering, composer-never-disabled (structural + source-inspection), chip/typed equivalence, 2-strike exit clears the flow
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge

## Changelog
- v1 (2026-07-29) — created
