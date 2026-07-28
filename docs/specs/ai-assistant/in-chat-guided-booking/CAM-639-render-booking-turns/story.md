---
artifact: story
feature: ai-assistant
epic: in-chat-guided-booking (CAM-630)
story: render-booking-turns (CAM-639)
status: In Review
version: v1
updated: 2026-07-29
---

<!--
This story wires a NEW entry kind into the transcript's render + history
plumbing. Nothing produces a `kind:"booking"` entry yet (CAM-640 wires
`advanceBookingFlow` into `use-ai-chat.ts` next), so the AC table's fixtures
are the same authoring device CAM-638 used: a reviewer/QA renders the
component from a constructed `ChatEntry[]`, not a live camper conversation.
-->

## Story
As a **Camper** (indirectly — via the future guided booking flow CAM-640 wires on top of this), I want a booking-step turn to render inline in the chat transcript exactly like every other turn, and to behave correctly with respect to model history and conversation resume, so that CAM-640 can start producing real booking turns without inventing a display path or re-discovering the history/resume safety rules at that point.
Why: CAM-638 built the presentation (`AiChatBookingStep`/`ChatChipRow`) and CAM-633 built the pure state machine (`booking-flow.ts`); nothing yet connects a rendered step block to the running conversation, and the transcript's existing history-building and resume paths must keep excluding a booking turn once one can exist, or the model starts believing it produced a booking, and a resumed session starts showing stale prices/availability.
Scope: add a `kind:"booking"` arm to the `ChatEntry` union (`components/ai-chat/conversation.ts`) carrying an immutable per-turn snapshot (`step` + `view`); add one new render branch in `components/ai-chat/AiChatMessageList.tsx` that mounts `AiChatBookingStep` for that entry. No wiring of `advanceBookingFlow`, no chip/back/edit/cancel handler behavior, no change to `use-ai-chat.ts`, `AiChatPanel.tsx`, or `booking-flow.ts`.
Depends on: CAM-638 (`AiChatBookingStep`/`ChatChipRow`, merged) · CAM-633 (`booking-flow.ts` registry, read-only import) · epic CAM-630

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A booking entry snapshot for the `date` step (question view, live chips) is in the transcript | A reviewer renders the fixture through `AiChatMessageList` | The step block appears with the caption `ขั้นที่ 1 จาก 3 · เลือกวัน`, the question, and its chip row, exactly as CAM-638 built it | No slot/flow state is read or derived by the render; it is pure presentation | EC-1 |
| AC-2 | A booking entry snapshot for the `guests` step is in the transcript | A reviewer renders the fixture | The step block appears with the caption `ขั้นที่ 2 จาก 3 · จำนวนคน` and its guest-count chips | Same as AC-1 | EC-1 |
| AC-3 | A booking entry snapshot for the `summary` step is in the transcript | A reviewer renders the fixture | The card appears with the handoff button reading `ไปกรอกต่อที่หน้าจอง` (never a confirmation word) | Same as AC-1 | EC-2 |
| AC-4 | A booking entry snapshot whose view is the E3 check-failed shape is in the transcript | A reviewer renders the fixture | The row shows `ตรวจสอบที่ว่างไม่สำเร็จ ลองอีกทีได้เลย` plus a `ลองใหม่` button, with no step-block caption/chip chrome around it | Same as AC-1 | EC-3 |
| AC-5 | A thread contains one or more `kind:"booking"` entries interleaved with user/answer turns | A new question is sent | N/A — a structural guarantee, not new copy (see System effect) | `buildOutgoingHistory` produces a model-facing history byte-identical to the same thread with every booking entry removed, regardless of where they sit in the array | EC-4 |
| AC-6 | The transcript's last entry is a `kind:"booking"` entry when a turn's outcome settles | `replaceStreamingWithOutcome` runs | N/A — a structural guarantee, not new copy (see System effect) | The booking entry is preserved and the new answer is appended after it — only a trailing `kind:"streaming"` entry is ever dropped | EC-5 |
| AC-7 | A persisted conversation contains an assistant message whose text was produced during a booking turn | The conversation is restored (reopened) | The camper sees the assistant's saved text, and nothing else | `restoreEntriesFromMessages` never produces a `kind:"booking"` entry — every non-user message restores as a plain `kind:"answer"` entry | EC-6 |

## Rules
- BR-1 The rendered block's step attribute is always derived from `entry.step`, typed via the registry-owned `BookingStepId` (`booking-flow.ts`) — `AiChatMessageList.tsx` never hand-copies a `'date'|'guests'|'summary'` literal list of its own. (proves AC-1/AC-2/AC-3)
- BR-2 A booking entry's `view` is an IMMUTABLE SNAPSHOT recorded once, at the moment the turn is appended — the same "record once, never re-derive" discipline `zeroResult` already uses on the `answer` entry. Scrollback never re-renders a booking turn with newer slots. (proves AC-1..AC-4 stay stable once later turns are appended)
- BR-3 `buildOutgoingHistory` excludes every `kind:"booking"` entry structurally — its `kind` matches neither `"user"` nor `"answer"` — and this story does not change that function. (proves AC-5)
- BR-4 `replaceStreamingWithOutcome`'s drop condition checks `last.kind === "streaming"` only, and this story does not change that function — a trailing `kind:"booking"` entry always falls through to append, never gets dropped. (proves AC-6)
- BR-5 `restoreEntriesFromMessages` has no branch that produces `kind:"booking"` — every non-user restored message becomes a plain `kind:"answer"` entry, so a reopened conversation never resurrects a live interactive step block. (proves AC-7)
- BR-6 The new render branch adds no motion utility of its own (no CSS transition/animate utility, no shared entrance-motion class) — the mounted `AiChatBookingStep` block already ships with none either (CAM-638's own rule, unchanged here). (proves AC-1..AC-4)
- BR-7 The new branch wires no handler — every `AiChatBookingStep` interaction prop (`onChipSelect`/`onBack`/`onEditDate`/`onEditGuests`/`onCancel`) is left undefined, since nothing drives the flow yet; a tap on a chip or control is inert until CAM-640 wires it. (proves the story's scope boundary — presentation + entry type only)

## Edge cases
- EC-1 IF a booking entry's view kind is `"question"` (`date` or `guests`) THEN it renders through the existing chip/type-hint/controls shape with no new pattern introduced by this story (BR-1/BR-6)
- EC-2 IF a booking entry's view kind is `"summary"` THEN the handoff button never reads `ยืนยัน`/`จองเลย`, and no writes occur (CAM-638's own rule, re-confirmed by the wiring) (BR-6)
- EC-3 IF a booking entry's view kind is `"checkFailed"` THEN no `msg--ai-chat-booking-step` wrapper appears in the render at all (BR-1 does not apply to this shape)
- EC-4 IF booking entries sit at the start, middle, or end of the entries array THEN `buildOutgoingHistory` ignores every one of them regardless of position (BR-3)
- EC-5 IF the LAST entry is a booking entry when `replaceStreamingWithOutcome` runs THEN it is preserved and the new outcome is appended after it, never dropped (BR-4)
- EC-6 IF a persisted message's stored text happens to read like booking copy THEN `restoreEntriesFromMessages` still restores it as a plain `kind:"answer"` entry, never `kind:"booking"` (BR-5)

## Data
- No schema/DB change. The new `kind:"booking"` `ChatEntry` arm lives only in client React state (`use-ai-chat.ts`'s `useState<ChatEntry[]>`, untouched by this story) — never persisted or serialized. A booking turn's live presentation ends with the browser tab, which is precisely why AC-7/EC-6 hold structurally rather than needing a special-cased persistence rule. Migration: none.

## Seams & refs
- Reuse: `AiChatBookingStep`/`ChatChipRow` (CAM-638, unchanged) · `BOOKING_STEPS`/`BookingStepId` (`booking-flow.ts`, CAM-633, read-only import) · the entry-row chain + the log's existing `role="log" aria-live="polite" aria-relevant="additions"` (`AiChatMessageList.tsx`, unchanged) · the `zeroResult` "record once, never re-derive" discipline (`conversation.ts`, CAM-430/CAM-445) this entry's `view` snapshot follows.
- Refs: design brief `docs/specs/ai-assistant/in-chat-guided-booking/CAM-637-design-brief/design.md` (§1-§8) · CAM-638 story `docs/specs/ai-assistant/in-chat-guided-booking/CAM-638-booking-copy-step-ui/story.md` · epic CAM-630.

## Out of scope
- Producing/appending a `kind:"booking"` entry from a real flow (`advanceBookingFlow` wiring), the pre-summary availability re-check, and real chip/back/edit/cancel handler behavior → CAM-640.
- Any change to `booking-flow.ts`, `use-ai-chat.ts`, or `AiChatPanel.tsx` (including the detail-card's second entry button) → CAM-640-adjacent.
- Persisting a booking turn to the conversation store → not planned; see `## Data`.

## Self-verify
- AC-1..AC-4 → unit (fixture-driven render through `AiChatMessageList`, `__tests__/cam-639-render-booking-turns.test.ts`), covering every step id in the registry plus the design brief's three error shapes (E1 day-filled → an ordinary `date` question render, E2 over-capacity → an ordinary `guests` question render with the single ceiling chip, E3 check-failed → the dedicated view).
- AC-5 → unit (`__tests__/cam-639-conversation-booking-entry.test.ts`, a byte-identical `buildOutgoingHistory` assertion with/without interleaved booking entries).
- AC-6 → unit (same file, a trailing-booking-entry-is-preserved assertion, alongside an unchanged trailing-streaming-entry-is-still-dropped case).
- AC-7 → unit (same file, `restoreEntriesFromMessages` never yields `kind:"booking"` across normal and adversarial-looking stored text).
- Story-specific: `grep -rnE "animate-|transition-|ENTRANCE_MOTION_CLASS"` over this story's new/changed render code = 0 · `grep -rn "BookingStepId|BOOKING_STEPS" components/ai-chat/AiChatMessageList.tsx` shows registry-typed usage, never a hand-copied step-id literal.
- Gate = `/quality-gate` · Done = AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-29) — created
