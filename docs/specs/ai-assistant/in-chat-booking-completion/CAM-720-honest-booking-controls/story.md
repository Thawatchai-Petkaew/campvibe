# CAM-720 — Booking controls look like buttons, and dead controls look dead

version 1 · 2026-08-13

## Story

As a **camper** in the booking flow, I want every control that works to look pressable and every control that no longer works to look finished, so that I never stare at plain text wondering if it is a button, and never press a live-looking button that silently does nothing.

Why: the owner reported the cancel control "ไม่ดูเป็น button เพราะมีแค่ text". Exploration found three layers: (1) ControlsRow uses variant ghost — no border, no fill at rest — beside outline chips; (2) a superseded QUESTION block keeps fully enabled-looking chips and controls whose handlers are undefined — press does nothing, silently (CAM-701 fixed summary/submitting only; the brief deferred question steps explicitly); (3) after the 2-strike exit or a cancel, `bookingRef` nulls but the last block stays `isCurrent` — every control alive-looking but dead.

Scope: `components/ai-chat/AiChatBookingStep.tsx` · `ChatChipRow.tsx` (a disabled pass-through if missing) · `conversation.ts` / `booking-turn.ts` (the exit-supersede) · tests. Depends on: —

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Any active booking step with controls | The camper looks at ยกเลิกการจอง / แก้วัน / ย้อนกลับ | ปุ่มมีพื้นสีอ่อนมองออกทันทีว่ากดได้ ไม่ใช่ตัวหนังสือลอย | ControlsRow renders variant secondary (existing token; chips stay outline — the two read differently) | — |
| AC-2 | A question block has been superseded by a newer one (e.g. after an unreadable reprompt) | The camper looks at or tries the OLD block | ชิปและปุ่มของกล่องเก่าเป็นสีจาง disabled ชัดเจน กดไม่ได้ และกด Tab ไม่ถึง | Chips + controls carry real `disabled` when not current — the flat disabled token pair, never opacity (the standing rule) | EC-1 |
| AC-3 | The flow exits (typed misses hit the 2-strike escape, or the camper cancels) | The camper looks at the last booking block | กล่องสุดท้ายกลายเป็นสถานะจบเหมือนกล่องเก่า ไม่มีปุ่มหน้าตาเป็น ๆ ที่กดแล้วเงียบ | The exit path revokes `isCurrent` on the last booking entry so it renders disabled like every superseded block | EC-2 |

## Rules

- BR-1 Ghost → secondary on ControlsRow only (back/edit/cancel). The summary's primary confirm/handoff CTAs and the chips are untouched. Supersede the round-1 brief's ghost decision with a dated note in the brief file — never silently contradict a ratified design (the CAM-235/661 lesson: absence/choice of a style can be a decision; here we supersede it explicitly).
- BR-2 Disabled = the flat `disabled`/`disabled-foreground` token pair via the button's own disabled styling — NO opacity anywhere (owner rule 2026-07-30, DESIGN.md's no-transparency ruling).
- BR-3 The superseded treatment extends CAM-701's exact pattern (`controlsDisabled = !view.isCurrent`) from summary/submitting to ALL question steps: chips (`ChatChipRow` gains/uses a disabled prop keyed on it) and ControlsRow both.
- BR-4 The exit-supersede: when `processBookingTurn`/`processBookingCancel` ends the flow (`booking: null`), the same mutation that appends the notice also flips the last booking entry's `isCurrent` to false — one place, both exit shapes (escape-hatch and cancel).
- BR-5 The CAM-639 invariants (booking entries excluded from model history, never restored) and the CAM-647 focus rules are untouched.

## Edge cases

- EC-1 IF a block is superseded while its chips row was in the isChecking state THEN disabled wins (already-disabled chips stay disabled; no flicker back to enabled).
- EC-2 IF the camper cancels DURING the submitting state THEN the existing CAM-701/702 semantics stand (submitting controls are already disabled); the exit-supersede must not fight them.
- EC-3 IF the flow exits and the camper starts a NEW booking THEN the new block is current and live; the old dead block stays dead (no resurrection).

## Data

None.

## Seams & refs

`AiChatBookingStep.tsx:508-542` (question branch — isCurrent used only for aria-current today), `:540` (ControlsRow without disabled), `:669-754` (the ghost variants), `:303` (CAM-701's controlsDisabled pattern to extend) · `ChatChipRow.tsx:83-85` (outline chips; disabled pass-through) · `conversation.ts:126-134` (appendBookingEntry — the isCurrent flip to mirror), `:142-144` (appendBookingNotice — does NOT supersede today) · `booking-turn.ts:283-287` (escape-hatch exit), `:379-381` (cancel exit) · `components/ui/button.tsx:11` (the flat disabled styling that comes free with real `disabled`). Pins: cam-638-ai-chat-booking-step :133-143 (aria-current-only — supersede with dated note) · cam-701-* :147-207 (the summary/submitting pattern — extend, do not disturb) · cam-640-use-ai-chat-wiring (isCurrent handler gating — unchanged, the render layer now matches it).

## Out of scope

- Any change to which controls each step OFFERS (the per-step control table stands).
- The chips' outline variant and content formula (CAM-638 BR-3).
- lib/ai — nothing here touches the model gate.

## Self-verify

- Render tests: three states per question step (current = secondary buttons enabled; superseded = chips+controls flat-disabled, out of tab order; post-exit = last block disabled). Prove the exit-supersede for BOTH exit shapes.
- check:ds + check:palette green (tokens only, no opacity) · full suite last act (named pins superseded with dated notes, cam-701 suite still green) · lint · typecheck · the cam-640 e2e must still pass (it drives current-block chips).
- Localhost: reproduce the owner's screenshot state (one unreadable miss → two stacked blocks) and screenshot that the old block reads dead and the new one's cancel reads like a button.
