---
artifact: story
feature: ai-assistant
epic: in-chat-guided-booking (CAM-630)
story: booking-copy-and-step-ui (CAM-638)
status: In Review
version: v1
updated: 2026-07-29
---

<!--
This story ships copy + a presentation component only — nothing renders it
yet. CAM-639 wires AiChatBookingStep into AiChatMessageList's message stream;
CAM-640 drives it from advanceBookingFlow (booking-flow.ts, CAM-633). Because
there is no live consumer yet, the AC table's "Then" column states what a
reviewer/QA sees by RENDERING the component from a fixture (this story's own
test), not a real camper conversation.
-->

## Story
As a **Camper** (indirectly — via the future in-chat booking flow CAM-639/640 wires on top of this), I want every step of the guided booking flow to have its final copy and a tested visual treatment ready, so that the build stories that follow only wire state into an already-correct component instead of inventing layout or strings at the keyboard.
Why: design brief CAM-637 is G2-approved and carries the full copy table + every state; this story is the one place that copy and that layout become real, checkable artifacts before any state machine touches them.
Scope: add all 44 `aiChat.booking.*` keys (TH+EN) to `locales/translations.json`; build `AiChatBookingStep` (the step block: caption, question, chip row, type hint, summary card, handoff CTA, control row, the checking status line, and the E3 error row) plus the shared `ChatChipRow` it (and later AiChatMessageList) render chips through. No wiring into `AiChatMessageList`/`AiChatPanel`, no state machine, no `AiChatDetailCard` entry-button change.
Depends on: CAM-637 (design brief, G2-approved) · CAM-633 (`BOOKING_STEPS` registry, imported read-only for step position/count) · epic CAM-630

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A `date` step is rendered with live chip data (a date with a real remaining count, and a date with no per-day cap) | A reviewer renders the fixture | The caption reads `ขั้นที่ 1 จาก 3 · เลือกวัน`; each chip's accessible name is built from one string (`{date} เหลือ {count} ที่` / `{date} มีที่ว่าง`); the type-hint caption `หรือพิมพ์วันที่เองก็ได้ เช่น เสาร์หน้า หรือ 15 ส.ค.` renders below the chips | No writes; component is presentation-only | EC-1 |
| AC-2 | A `date` step has zero open weekends | A reviewer renders the empty fixture | The block shows `ช่วงนี้ยังไม่มีเสาร์ว่างเลย ลองพิมพ์วันที่อยากไปมาได้เลย เดี๋ยวเราหาให้` with no chip row and no type-hint caption | No writes | EC-2 |
| AC-3 | A `guests` step's pre-summary availability re-check is in flight | A reviewer renders the checking fixture | The chip row is visibly disabled and a line reads `กำลังตรวจสอบที่ว่าง…` | No writes; no spinner is used (loading.md: text status, not a spinner) | EC-3 |
| AC-4 | A camper reaches the `summary` step | A reviewer renders the summary fixture | The card shows `ยอดรวมโดยประมาณ` with `คุณจะยังไม่ถูกเรียกเก็บเงิน` beneath it, and the handoff button reads `ไปกรอกต่อที่หน้าจอง` (never `ยืนยัน`/`จองเลย`, no booking code, no `จองสำเร็จ`) | No writes to the database in this story | EC-4 |
| AC-5 | The pre-summary re-check itself fails (network) | A reviewer renders the check-failed fixture | The row shows the chat's existing error banner with `ตรวจสอบที่ว่างไม่สำเร็จ ลองอีกทีได้เลย` plus a `ลองใหม่` button, with no step-block caption/chip chrome around it | No writes; all prior slots stay conceptually untouched (state ownership is CAM-640's) | EC-5 |
| AC-6 | Every `aiChat.booking.*` key the design brief's copy table names | QA reads `locales/translations.json` | Both a TH and an EN value exist for all 44 keys, and no TH value contains `—` or a `ครับ`/`ค่ะ` particle | No `component`/state-machine code depends on a missing key (typed via `typeof translations.en`) | EC-6 |

## Rules
- BR-1 The step is stated only in the newest block's caption (`aria-current="step"`); a superseded block keeps its caption text and loses the attribute. No permanent bar/track is added anywhere in this diff. (proves AC-1/AC-3/AC-4)
- BR-2 Answer chips render as `<Button variant="outline" size="sm" className="h-11 rounded-full">` via the shared `ChatChipRow` — never the existing selectable/toggle pill primitive (its `aria-pressed` contract announces a toggle state a one-shot answer does not have). (proves AC-1)
- BR-3 Chip copy is a formula, never a caller-supplied string: a date chip's accessible name and visible text are built from the live `date`/`remaining` values passed in, and a `remaining: null` chip reads `มีที่ว่าง` — never a fabricated number. (proves AC-1/AC-2)
- BR-4 The component never disables anything belonging to the composer — it has no opinion on the composer at all; only the chip row disables, and only while `isChecking` is true. (proves AC-3)
- BR-5 No motion-utility class (no CSS transition/animate utility, no extra press-scale class) is added by any new file in this story, and the step block never carries the shared entrance-motion class every neighbouring row in `AiChatMessageList.tsx` carries. (proves AC-1..AC-5)
- BR-6 The summary's total is displayed exactly as handed in by the caller (pre-formatted via the shared `computeBookingPrice`/`THB_FORMAT`) — this component performs no money math of its own. (proves AC-4)
- BR-7 `data-testid` values carry the step in a sibling `data-step` attribute, never inside the testid string (e.g. `btn--ai-chat-booking-chip` + `data-step="date"`). (proves AC-1..AC-4)
- BR-8 The `E3` (check-failed) view renders no step-block wrapper at all — only the existing error-banner + retry shape, matching `AiChatMessageList.tsx`'s own error row byte-for-byte in structure. (proves AC-5)

## Edge cases
- EC-1 IF a date chip carries `remaining: null` THEN its label/aria-label read `มีที่ว่าง`, never a fabricated count (BR-3)
- EC-2 IF the `date` step's chip list is empty THEN no chip row and no type-hint caption render, and the empty message itself carries the "type it yourself" affordance (BR-1)
- EC-3 IF `isChecking` is true on a `guests` render THEN every chip is `disabled` + the group is `aria-busy`, and the checking status line is `role="status" aria-live="polite"` (BR-4)
- EC-4 IF the `guests` step renders a single `guestsCap` chip (the E2 ceiling offer) THEN its value is the ceiling count itself, never a second alternative-date chip (BR-3)
- EC-5 IF the view is `checkFailed` (E3) THEN no `msg--ai-chat-booking-step` wrapper exists in the render at all (BR-8)
- EC-6 IF a Thai `aiChat.booking.*` value is checked for an em-dash or a `ครับ`/`ค่ะ` particle THEN the count is 0 across every leaf (BR-1..BR-8, i18n contract)

## Data
- `locales/translations.json` — 44 new leaf keys under `aiChat.booking.*` (both `en` and `th`), nested per the design brief (`stepName`, `date`, `guests`, `summary` sub-groups). No entity/schema change. Migration: none.

## Seams & refs
- Reuse: `components/ai-chat/booking-flow.ts`'s `BOOKING_STEPS` registry (read-only import, for step position/count — never a hand-copied step-id list) · the panel's inset grammar (`AiChatDetailCard.tsx` `StatTile`/`WeekendChip` container classes) · `components/ui/error-banner.tsx` · existing keys `aiChat.retry`, `aiChat.detail.openNoCap`, `aiChat.card.remaining`, `booking.notChargedYet`
- Refs: design brief `docs/specs/ai-assistant/in-chat-guided-booking/CAM-637-design-brief/design.md` (§1-§8, authoritative) · `DESIGN.md` §3/§5/§6/§7 · `.claude/rules/loading.md`

## Out of scope
- Wiring `AiChatBookingStep` into `AiChatMessageList`/`AiChatPanel` → CAM-639
- The state machine driving which view/step renders (`advanceBookingFlow` consumption) → CAM-640
- The detail-card footer's second (`เริ่มจอง`) entry button → a CAM-639/640-adjacent story
- Multi-night stays, spot selection, gear rental, any real write → round 2 (per CAM-637)

## Self-verify
- AC-1..AC-3, AC-5 → unit (component fixture render, `__tests__/cam-638-ai-chat-booking-step.test.ts`)
- AC-4 → unit (same file, summary fixture) + owner-verify (visual card treatment on a real screenshot)
- AC-6 → unit (`__tests__/cam-638-booking-copy.test.ts` — verbatim TH assertions + EN/TH parity + em-dash/particle scan)
- Story-specific: no `FilterChip` import in any new file · no added motion-utility class in any new file · `BOOKING_STEPS` imported, never a hand-copied `['date','guests','summary']` literal (guarded by `cam-633-booking-flow.test.ts`'s existing co-occurrence check)
- Gate = `/quality-gate` · Done = AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-29) — created
