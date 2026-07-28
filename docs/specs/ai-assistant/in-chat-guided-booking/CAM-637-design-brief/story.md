---
linear: CAM-637
feature: ai-assistant
epic: CAM-630 in-chat-guided-booking
persona: Camper
artifact: story
owner: ux-designer
status: In Review
version: v1
updated: 2026-07-29
---

## Story
As a **Camper**, I want the in-chat booking flow designed before it is built, so that the
step bubble, answer chips and summary card are specified once and the build story renders
them from `locales/` instead of inventing copy and layout at the keyboard.
Why: this is a real G2. New UI is being introduced, not reused, so `DESIGN.md`'s pre-authorized
standard class does not apply.
Scope: design artefacts and i18n copy only. `design.md` (layout per step, all 8 states, both
named error shapes plus the third one found during design, a11y, tokens, testid table) and
the TH+EN copy table under `aiChat.booking.*`, ready for the build story to paste. **No
component code, no `locales/translations.json` edit, no state machine.**
Depends on: the owner-approved plan (`.claude/plans/research-user-jolly-mochi.md`) · CAM-630

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The brief is being reviewed at G2 | The reviewer opens `design.md` | Every one of the 8 states from `DESIGN.md` §5 is specified for each of the 4 interactive elements, with "not applicable" stated and reasoned wherever a state genuinely does not exist | No code changes | EC-1 |
| AC-2 | The reviewer looks for the step-indicator decision | They read the brief's verdict section | An explicit verdict with reasoning, and the reasoning names a consequence (double announcement on `aria-live`) rather than a preference | No code changes | EC-2 |
| AC-3 | The build story needs copy | They read the copy table | Every `aiChat.booking.*` key carries both a TH and an EN value, and no Thai value contains `—` | No `locales/` write in this story | EC-3 |
| AC-4 | A camper reaches the summary step | They read the summary card | `ยอดรวมโดยประมาณ` with `คุณจะยังไม่ถูกเรียกเก็บเงิน` below it, and no booking code, ticket or the word `สำเร็จ` anywhere in the specified copy | Nothing written to the database in the round this brief describes | EC-4 |
| AC-5 | The brief introduces a new token or primitive | The gate checks `DESIGN.md` | `DESIGN.md` is unchanged, and the brief states in the header that it is unchanged | `git diff origin/dev --name-only` lists no file under `app/`, `lib/` or `components/` | EC-5 |

## Rules
- BR-1 The step is stated in a caption inside the step block. No permanent bar, track or chrome above the composer. `aria-current="step"` sits on the newest caption only. (proves AC-2)
- BR-2 Answer chips are `<Button variant="outline" size="sm" className="h-11 rounded-full">`. `FilterChip` is forbidden: its `aria-pressed` contract announces a toggle state that a one-shot answer does not have. (proves AC-1)
- BR-3 Chip counts are layout constants (`MAX_DATE_CHIPS = 4`, `MAX_GUEST_CHIPS = 4`, both = how many `h-11` pills fill one row of a ~380px column). Chip **values** always derive from live capacity: `1..min(min(remaining, maxGuestsPerDay), 4)`. No capacity number appears anywhere in the brief as a literal. (proves AC-1)
- BR-4 The composer is never disabled during the flow. The interception happens before any network call, so `sending` stays `false`. Every step parses typed input of its own. (proves AC-1)
- BR-5 No `transition-*`, no `animate-*`, no `--ai-*` loop, and specifically no `ENTRANCE_MOTION_CLASS` on the step block, unlike every neighbouring row in `AiChatMessageList.tsx`. The re-check indicator is therefore text (`กำลังตรวจสอบที่ว่าง…`), not `LoadingSpinner`. (proves AC-1)
- BR-6 Nothing may read as a completed booking: no booking code, no ticket, no `จองสำเร็จ`. The terminal button is `ไปกรอกต่อที่หน้าจอง`, never `ยืนยัน` or `จองเลย`. (proves AC-4)
- BR-7 The total is computed by `computeBookingPrice` (`unitPrice * nights`, no guest multiplier) and labelled `ยอดรวมโดยประมาณ`. There is no third price path. (proves AC-4)
- BR-8 `data-testid` values carry the step in a sibling `data-step` attribute, never inside the testid string and never keyed to a visual treatment. (proves AC-1)
- BR-9 After any transition that replaces the chip row, focus moves to the new block's caption (`tabIndex={-1}`), except on E3 where it moves to `ลองใหม่` and on cancel where it returns to the composer. (proves AC-1)

## Edge cases
- EC-1 IF an interactive element genuinely has no instance of a state THEN the brief says so and gives the reason, rather than omitting the row (BR-1, BR-5)
- EC-2 IF the flow later grows past three steps THEN BR-1 is re-opened rather than inherited (BR-1)
- EC-3 IF a copy value needs an em-dash as a separator THEN use a space, a period or parentheses; `—` is only ever an empty table value (BR-6)
- EC-4 IF `remaining` is `null` (the camp set no per-day cap) THEN the date chip reads `มีที่ว่าง` and the over-capacity check is skipped entirely. Never fabricate a ceiling (BR-3)
- EC-5 IF a new token or primitive were genuinely required THEN say so loudly in the brief header and edit `DESIGN.md` + `app/globals.css` together. None was required (BR-2)
- EC-6 IF the pre-summary re-check returns 0 remaining THEN clear the date slots, keep `guests`, and rewind to the date step with the now-full day excluded from the fresh chip row (BR-3)
- EC-7 IF the pre-summary re-check itself fails THEN show `ErrorBanner` + the existing `aiChat.retry`, leave all slots intact, and move focus to the retry button. Never show a summary built on an unverified check (BR-9)
- EC-8 IF an input is unreadable twice in a row THEN end the flow quietly with `aiChat.booking.handedToAssistant` and let that turn reach the assistant, rather than re-asking forever (BR-4)

## Data
- No entities, no fields, no writes. `migration: none`.

## Seams & refs
- Reuse: the chat's existing chip treatment (`components/ai-chat/AiChatMessageList.tsx:398-417`, to be extracted as `ChatChipRow`) · the panel's inset grammar (`AiChatDetailCard.tsx:163,194`) · `components/ui/error-banner.tsx` · `lib/booking-pricing.ts` `computeBookingPrice` · existing keys `aiChat.retry`, `aiChat.detail.openNoCap`, `booking.notChargedYet`, `aiChat.detail.viewCampPage`
- Refs: `DESIGN.md` §2 / §2.0 / §2.1 / §3 / §5 / §6 / §7 · `.claude/rules/loading.md` · `components/ui/form-patterns.md`

## Out of scope
- Writing `aiChat.booking.*` into `locales/translations.json` → the B4 i18n story
- Building `ChatChipRow`, the step block, or the summary card → the B4 / B5 stories
- The state machine and its parsers → B1 / B1a
- The prefill contract and the receiving camp page → B2 / B3
- Unblocking the hardcoded `[1,2,3,4,5,6]` guest cap → CAM-636 / B3b
- The pre-existing `aiChat.detail.statPriceLabel` wording bug (`ต่อคน/คืน` contradicts per-night pricing) → its own follow-up ticket
- Multi-night stays, spot selection, gear rental, and any real write → round 2

## Self-verify
- AC-1..AC-5 → owner-verify at G2 by reading `design.md`
- AC-3 → machine-checkable: no `—` in any Thai value in the copy table; every key has TH and EN
- AC-5 → machine-checkable: `git diff origin/dev --name-only` lists nothing under `app/ lib/ components/`, and `DESIGN.md` is absent from the diff
- Story-specific: `npm run check:ds` and `npm run check:palette` green (both are no-ops on a docs-only diff, confirmed by running them)
- Gate = G2 design review. This story ships no code, so its Done is the brief being accepted.

## Changelog
- v1 (2026-07-29) — created
