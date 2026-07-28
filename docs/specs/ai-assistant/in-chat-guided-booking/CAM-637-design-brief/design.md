---
linear: CAM-637
feature: ai-assistant
epic: CAM-630 in-chat-guided-booking
persona: Camper
artifact: design
owner: ux-designer
status: In Review
version: v1
updated: 2026-07-29
---
# Design — In-chat guided booking, round 1 (CAM-637)

> **G2, full human tap.** This is new UI, not a reuse of an existing flow. It introduces
> no new token and no new `components/ui/*` primitive — `DESIGN.md` is **unchanged** by
> this brief (see §7).

## Flow

The camper's job: **turn "this camp looks right" into a booking page that is already filled in.**
Nothing is written to the database in this round. The last button means *carry on over there*,
never *confirm*.

```text
detail card footer ──[ เริ่มจอง ]──▶ step date ──▶ step guests ──▶ step summary ──▶ /campgrounds/<slug>?…
                                        ▲             │                   │            (values prefilled)
                                        └─ ย้อนกลับ ───┘                   │
                                        └────────── แก้วัน ────────────────┘
     ยกเลิกการจอง at any step ──▶ flow ends, conversation continues normally
```

Three steps, all inside the chat log. Each step is one block appended to the log
(`role="log" aria-live="polite" aria-relevant="additions"`, `AiChatMessageList.tsx:173-181`)
and then scrolls away as history, exactly like every other turn.

**The step block, top to bottom — one shape for all three steps:**

1. **step caption** — `ขั้นที่ 1 จาก 3 · เลือกวัน`
2. **assistant sentence** — the question, in น้องกองไฟ's voice
3. **answer chip row** — the fast path (absent on `summary`)
4. **type-it-instead caption** — the escape hatch (absent on `summary`)
5. **the summary card** — `summary` only
6. **the handoff CTA** — `summary` only
7. **flow control row** — `ย้อนกลับ` / `แก้…` / `ยกเลิกการจอง`

The order is load-bearing. The question comes before the options; the options come
before the escape hatch (chips are the fast path, typing is the fallback); leaving and
undoing sit last, where "get me out of here" belongs and where a mis-tap cannot reach
them from the answer row.

### The panel is a narrow column at every viewport

Collapsed the panel is roughly 380px; expanded it is capped at `max-w-2xl` / `sm:max-w-3xl`
(`AiChatPanel.tsx:860`). The flow therefore lives in a bounded reading column and is
specified **once, at the mobile width**. The only value in this brief that steps at `md`
is the `lg` button height, and it steps inside the primitive (`h-11 md:h-12`,
`button.tsx` `size.lg`). This is not a skipped mobile step — the column *is* mobile-width
at all viewports, so a second layout would be a second scale for no gain (`DESIGN.md` §2.0).

### Entry — the detail card footer gains a second button

Today the footer is a price line plus one full-width `size="lg"` primary `ดูหน้าลาน`
(`AiChatDetailCard.tsx:701-718`). It becomes two buttons on one row, `flex gap-2`, each
`flex-1`, both `size="lg"`:

| position | label | variant | why |
|---|---|---|---|
| left | `ดูหน้าลาน` | `outline` | demoted — `DESIGN.md` §3 allows exactly one primary per view |
| right | `เริ่มจอง` | `default` | the new primary; the flow is now the intended next step |

**The detail pane closes when the flow starts, at every viewport.** Not just on mobile.
If the pane stayed open on the desktop split rail, the screen would carry two `size="lg"`
primaries — `ดูหน้าลาน` and `ไปกรอกต่อที่หน้าจอง` — whose intents both resolve to
"go to that camp's page". `DESIGN.md` §6 layout sanity names duplicate CTA intent as a
gate failure, and it would be one here. Closing the pane also matches the camper's own
statement: they asked to start booking, so browsing is finished.

**Build note (Critical):** if the two Thai labels wrap at 320px, stack the row
(`flex-col`) rather than shrink the type or truncate a label. `DESIGN.md` §6: a CTA does
not wrap. Verify on a real 320px viewport, not by reading classNames.

---

## The step-indicator verdict

**No permanent step chrome. The step is stated in a caption inside the step block and
scrolls away with it.** I agree with the plan's proposal, and I am overturning the part
of it that left `aria-current` homeless. Three reasons, strongest first:

**1 · A permanent bar double-announces every step change.** The chat log is already
`aria-live="polite" aria-relevant="additions"`. A new step block is an *addition*, so it
announces itself, once, for free. A bar above the composer is a region that **mutates in
place** — its text changes from `ขั้นที่ 1 จาก 3` to `ขั้นที่ 2 จาก 3`. To make that
audible it needs its own live region, and then every single step advance fires two
announcements describing one event: the bar's mutation and the new block's addition. A
screen-reader camper hears the step twice, every time. That is a measurable a11y cost,
not a matter of taste, and it is the reason this decision would not flip even if the
panel were wide.

**2 · It takes height from the one scrolling region.** The panel is a fixed-height flex
column: header, `ScrollArea` (`min-h-0`), composer dock. The dock already reserves
`pb-[max(1.5rem,env(safe-area-inset-bottom))]` on mobile (`AiChatPanel.tsx:866`). A bar
wedged between the log and the dock can only take its height from the log — the single
place the entire conversation lives, including the answer that made the camper start
booking in the first place.

**3 · The current step is derived, not stored.** The state machine derives the current
step from which slots are filled (`currentStep(slots)`, the architect's decision). A
persistent bar is a second surface that must re-render that derivation and stay in sync
with it. A caption is authored once, at the moment the assistant speaks, and then it is
history — and history never desyncs.

**What replaces it, and where `aria-current` lives.** Each step block is a
`role="group"` with an `aria-label`, and its caption element carries **`aria-current="step"`
on the newest block only**. When a step is superseded its caption keeps its text (it is a
true record of what was asked) and loses `aria-current`. So the "which step am I on"
question has a real programmatic answer without a pixel of permanent chrome — which is
precisely what `aria-current="step"` was specified for.

**What would flip this:** a flow of five or more steps, or a step that can be revisited
out of order. Neither is true here. If round 2 adds `spot` and `gear` and the flow reaches
five steps, re-open this decision — do not inherit it silently.

---

## Non-goals

- **No permanent step bar / progress track.** Reasoned above; do not add one "for clarity".
- **No booking code, ticket, QR, confetti or the word `สำเร็จ`.** The prototype ends in a
  ticket with a booking code (`chat-prototype.html:934-945`). That belongs to the round
  that actually writes. Round 1 writes nothing, so nothing may look like proof of a booking.
- **No `เช็คอิน 14:00 · เช็คเอาท์ 12:00` line in the summary.** Those are per-camp fields
  (`CampSite.checkInTime/checkOutTime`) not carried in the card payload; the camp page
  already shows them. Hardcoding a per-camp fact into chat copy is exactly what the tool
  layer exists to prevent.
- **No `× ฿ราคา` on the guests row.** `computeBookingPrice` is `unitPrice * nights`;
  guests do not multiply. The prototype's `${people} คน × ฿${price}` (`:918`) would print
  a different number than the camp page for the same booking.
- **No calendar / date-range picker at the date step.** A full calendar shows days that
  are already full as tappable. Chips built from `weekendAvailability` can only offer days
  that are genuinely open — that is the reason chips win here, not the prototype's habit.

## Alternatives considered

- **`FilterChip` for the answer chips** — rejected on contract, not on looks. Its API is
  `aria-pressed` + `onToggle` (`DESIGN.md:429`), i.e. it announces a *toggle state*. A
  booking answer is a one-shot command with no pressed state, so `aria-pressed` would lie
  to a screen reader on every chip. `check:ds` R9 is satisfied anyway, because what we use
  is a real `<Button>`, not a hand-rolled pill.
- **A new `BookingChip` primitive in `DESIGN.md` §3.1** — rejected. The chat already has
  exactly one chip treatment that campers tap to put a phrase into the conversation
  (`AiChatMessageList.tsx:405-416` and the welcome pills at `:215-226`). A booking answer
  chip does the identical job. A new primitive would put two chip looks inside one panel,
  which is the drift `DESIGN.md` §3 "Chip family" was written to stop.
- **Edit affordances inside the summary card rows** — rejected. Making each row a button
  puts interactive and static rows in one visually identical stack, and forces two 44px
  targets into a compact card. The control row below the card reuses the grammar already
  established at steps 1 and 2, so the whole flow has one control vocabulary instead of two.
- **Offering alternative *date* chips at the over-capacity error** (the plan's shape) —
  rejected. It silently rewinds a step the camper did not ask to leave, and it would put a
  date-valued chip inside a block whose `data-step` says `guests`, breaking the very
  testid contract that lets us redesign this later. The error stays on `guests` and points
  at `ย้อนกลับ` in words.

---

## §1 Step 1 — `date`

```text
┌──────────────────────────────────────┐
│ ขั้นที่ 1 จาก 3 · เลือกวัน            │ ← caption, aria-current="step"
│                                      │
│ เริ่มจองภูชี้ฟ้ากันเลย อยากไปวันไหนดี  │ ← assistant sentence
│                                      │
│ ┌────────────────┐ ┌───────────────┐ │
│ │ ส. 2 ส.ค. · เหลือ 6 ที่ │ │ ส. 9 ส.ค. …│ │ ← answer chips (max 4)
│ └────────────────┘ └───────────────┘ │
│                                      │
│ หรือพิมพ์วันที่เองก็ได้ เช่น เสาร์หน้า  │ ← type-it-instead caption
│ หรือ 15 ส.ค.                          │
│                                      │
│ ยกเลิกการจอง                          │ ← control row (ghost)
└──────────────────────────────────────┘
│ [ เสาร์หน้า                      ] ▶ │ ← composer, LIVE (never disabled)
```

**Chip source and filter.** Chips come from `weekendAvailability` already in hand from the
detail fetch, filtered by the same predicate `WeekendChip` uses today —
`!blockedByHost && remaining !== 0` (`AiChatDetailCard.tsx:191`). A full day is never offered.

**Chip count is a layout constant, not a capacity number.** Show at most **4**, soonest
first. Four `h-11 rounded-full` pills fill two rows in a ~380px column; eight would fill
four rows and push the question off screen. Soonest-first is the correct truncation order:
a camper booking a weekend wants the near ones, and truncating by recency would drop
exactly the days they are choosing between (`performance.md` §3). The truncation is
**signalled** — the type-it-instead caption directly below tells the camper the list is not
the whole world.

**Chip content.** One `<Button variant="outline" size="sm" className="h-11 rounded-full">`
per open day, whose children are the date, an `aria-hidden` `·`, and the remaining count in
`text-foreground/70 tabular-nums`. The button carries an explicit `aria-label` built from
one string, so the announced name reads cleanly with no stray separator.

**`remaining === null` is a real case.** The camp has no per-day cap set. The chip then
reads `{date} มีที่ว่าง` and reuses the existing `aiChat.detail.openNoCap`. **Never
fabricate a number** — this is the same rule `WeekendChip` already follows.

**Typing a date is a first-class path.** `resolveDatesCore` already understands `พรุ่งนี้`,
`เสาร์หน้า`, `15 ส.ค.`, `สุดสัปดาห์นี้`, `สิ้นเดือน`. Typing a **full** day is answered
immediately with `aiChat.booking.date.full` plus a fresh chip row — the camper learns it is
full here, not at the booking page.

---

## §2 Step 2 — `guests`

```text
┌──────────────────────────────────────┐
│              ส. 2 ส.ค. · เหลือ 6 ที่  │ ← the camper's own answer, user bubble
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ ขั้นที่ 2 จาก 3 · จำนวนคน             │
│                                      │
│ ส. 2 ส.ค. นะ วันนั้นเหลือ 6 ที่        │
│ ไปกันกี่คน                            │
│                                      │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│ │ 1 คน │ │ 2 คน │ │ 3 คน │ │ 4 คน │  │
│ └──────┘ └──────┘ └──────┘ └──────┘  │
│                                      │
│ ไปกันหลายคนกว่านี้ พิมพ์จำนวนมาได้เลย  │
│                                      │
│ ย้อนกลับ   ยกเลิกการจอง               │
└──────────────────────────────────────┘
│ [ 8 คน                          ] ▶ │ ← composer, LIVE
```

**Chip generation — the pattern, never a fixed set.**

```text
ceiling = min(remaining, maxGuestsPerDay)     // whichever of the two is known
chips   = 1 .. min(ceiling, MAX_GUEST_CHIPS)  // MAX_GUEST_CHIPS = 4, a layout constant
```

- `ceiling` unknown on both sides (no per-day cap **and** no `maxGuestsPerDay`) → render
  `1..4` and **skip the over-capacity check entirely**. Never invent a ceiling.
- `ceiling < 4` → render only up to `ceiling`.
- `ceiling === 0` → unreachable: the date would have failed at step 1 or at the re-check
  (error shape **E1**).

`[1,2,3,4,5,6]` as it appears in `CampgroundDetailClient.tsx:1374` is the shape this design
exists to avoid. **4 here is how many pills fit on one row of a 380px column, and nothing
else.** Every value in the row is derived from live capacity.

**"More than that" is a caption, not a chip.** The plan's wireframe made
`มากกว่านั้น พิมพ์ได้เลย` a chip. Rejected: a chip is an answer, and tapping that one
answers nothing. It becomes the type-it-instead caption, where every other step already
puts its escape hatch.

**Completing this step is the one asynchronous moment in the flow** — see §4 Loading.

---

## §3 Step 3 — `summary`

```text
┌──────────────────────────────────────┐
│ ขั้นที่ 3 จาก 3 · ตรวจดูอีกที          │
│                                      │
│ ตรวจดูอีกทีนะ ถ้าโอเคแล้วไปกรอกต่อ     │
│ ที่หน้าจองได้เลย                       │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ ลาน               ภูชี้ฟ้า         │ │
│ │ วันเข้าพัก        ส. 2 ส.ค. พัก 1 คืน│ │
│ │ จำนวนคน           2 คน            │ │
│ │ ──────────────────────────────── │ │
│ │ ยอดรวมโดยประมาณ            ฿500  │ │
│ │ คุณจะยังไม่ถูกเรียกเก็บเงิน          │ │
│ │ ค่าธรรมเนียมของลานยังไม่รวมในนี้     │ │
│ │ ดูยอดเต็มได้ที่หน้าจอง               │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │     ไปกรอกต่อที่หน้าจอง            │ │ ← the one primary
│ └──────────────────────────────────┘ │
│                                      │
│ แก้วัน   แก้จำนวนคน   ยกเลิกการจอง     │
└──────────────────────────────────────┘
│ [ พิมพ์อะไรก็ได้                 ] ▶ │ ← composer, still LIVE
```

**The card is a read surface, deliberately.** No row inside it is interactive. Editing
happens in the control row below, in the same grammar steps 1 and 2 already use. A card of
tabular data with no nested tap targets is both the a11y-cleanest and the most obviously
*a draft to check* rather than *a thing to operate*.

**Container:** `rounded-2xl border border-ai-tint/60 bg-muted/20 p-4` — the panel's own
inset grammar, copied verbatim from `StatTile` / `DetailSection`
(`AiChatDetailCard.tsx:163,194`). **Deliberately not `Card`.** `Card` is `rounded-3xl` and
raised, the grammar the camp cards and the detail card already own; a `Card` sitting inside
the panel's glass would be a card stacked on a card, which `DESIGN.md` §5 names as slop.

**Rows:** `flex items-baseline justify-between gap-3` · label
`text-xs text-foreground/70` left · value `text-sm font-medium text-foreground tabular-nums`
right. Divider before the total: `border-t border-border/60 pt-3 mt-3`.

**The total is shown, and it is labelled honestly.** The plan proposed holding the total
row until the price-unit question cleared. The formula *is* clear — `computeBookingPrice`
is `unitPrice * nights` with no guest multiplier (`lib/booking-pricing.ts:97-110`); the
unresolved thing is only the wording of a *different* key (`aiChat.detail.statPriceLabel`),
which is a pre-existing bug on another surface. So:

- The value is computed by **`computeBookingPrice`**, the same module the camp page and the
  API call. There is no third price path.
- The label is **`ยอดรวมโดยประมาณ`**, not `ยอดรวม`, because per-camp fees are not modelled
  in the chat and the booking page is authoritative.
- Two captions follow it, both small, both `text-foreground/70`: the existing
  **`booking.notChargedYet`** (`คุณจะยังไม่ถูกเรียกเก็บเงิน` — already in the app, already
  saying exactly the draft-ness this needs) and one new line naming the excluded fees.

A summary with no money in it is not a summary anyone can check, and checking is this
step's entire job. Showing a number the camper cannot reconcile against the booking page
would be worse than showing none — which is why it comes from the shared module and says
*โดยประมาณ*.

**The total value is `text-foreground`, not `text-ai-price`.** `--ai-price` is scoped by
`DESIGN.md` §2.1 item 7 to the card *price hero* — the camp's own price. This is a booking
subtotal, a different quantity; painting it in the price-hero colour would imply otherwise.

**One night, stated in the copy.** Round 1 books the Saturday night that
`weekendAvailability` describes, so the night count is part of the string rather than a
placeholder. Multi-night is a round-2 copy change, not a placeholder waiting here.

**The handoff button must not read as confirmation.** `ไปกรอกต่อที่หน้าจอง` —
"go and carry on filling it in at the booking page". Not `ยืนยัน`, not `จองเลย`. The verb
`กรอกต่อ` states that work remains, which is true: nothing has been written.

---

## §4 States (8) — every interactive element

Four interactive elements ship in this flow. **E** (the composer) is unchanged code but has
a binding behavioural rule, stated below the table.

| | **A** `เริ่มจอง` (entry) | **B** answer chip | **C** flow control | **D** handoff CTA |
|---|---|---|---|---|
| **default** | `Button default size="lg" flex-1` | `Button outline size="sm" h-11 rounded-full` | `Button ghost size="sm" h-11 rounded-full` | `Button default size="lg" w-full` |
| **hover** | `hover:bg-primary/80` (primitive) | `hover:bg-muted hover:text-foreground` | `hover:bg-muted hover:text-foreground` | `hover:bg-primary/80` |
| **focus** | `focus-visible:ring-3 ring-ring/30` + `focus-visible:border-ring` (primitive, visible) | same | same | same |
| **active** | primitive press only — **no class added by this design** (see Motion) | same | same | same |
| **loading** | **disabled** while the detail fetch is in flight or failed. No spinner on the button: the detail card's own skeleton is that region's one loader (`loading.md` §1) | **none, by construction** — `advanceBookingFlow` is synchronous. **Exception:** the chip that completes `guests` triggers the availability re-check → the row goes `disabled` and a text-only status line appears (see below) | none — pure transitions | **none.** It is a `<Link>`; the destination route owns its own loading. A spinner here would be a second loader for one navigation (`loading.md` §1) |
| **error** | none of its own — the detail card's existing retry owns the failed fetch | E1 · E2 · E3 (§5) | none | none — navigation failure is the browser's |
| **empty** | n/a | **date:** no open weekend → no chip row, `aiChat.booking.date.empty` + the composer stays the way out. **guests:** unreachable (`ceiling === 0` is caught earlier) | n/a — `ย้อนกลับ` is simply absent on step 1, which is correct, not empty | n/a — `summary` only exists once both slots are filled |
| **disabled** | while `isLoading` or `failed` on the detail fetch → `disabled:opacity-50 disabled:pointer-events-none` (primitive) | while the re-check is in flight | never | never |

**The re-check indicator is text, not a spinner.** While the availability re-check runs
(≤ ~1s), the guest chip row is `disabled` + `aria-busy="true"`, and a single line renders
below it: `กำลังตรวจสอบที่ว่าง…` in `text-xs text-foreground/70`, wrapped in
`role="status" aria-live="polite"`. This satisfies `loading.md`'s "user action → immediate
local feedback on the control" **with zero animation** — the no-animation constraint
(CAM-627) rules out `LoadingSpinner`'s `animate-spin`, and a chat's own idiom for "working"
is words anyway. `Skeleton` is wrong here for the same reason `loading.md` gives for a
canvas: there is no layout to mirror, only a wait.

**E · The composer is live at every step, without exception.** Today the textarea is
`disabled={sending || disabled}` (`AiChatPanel.tsx:888`). The booking flow intercepts the
turn **before** any network call, so `sending` must stay `false` throughout the flow and the
composer is never disabled by it. **If the build ever sets `sending` to gate a booking step,
that is a Critical defect against this brief** — chips are a shortcut, never the only path,
and every step parses typed input of its own.

---

## §5 Error shapes

Three, not two. Two were named in the ticket; the third is real and must not be folded
into either.

### E1 · The day filled up while we were talking

**Trigger:** the pre-summary re-check returns 0 remaining for the chosen date.
**This is not an error banner.** Nothing failed — the world changed. `ErrorBanner` is
`destructive`-toned and is reserved by `form-patterns.md` for a server error after a
submit; using it here would tell the camper they did something wrong.

**Treatment:** a normal step block, captioned back at `ขั้นที่ 1 จาก 3 · เลือกวัน`, text
`ขอโทษที {date} เพิ่งเต็มไปเมื่อกี้ ลองวันอื่นดูไหม`, then a **fresh** chip row with the
now-full date excluded, then the control row.

**Slots:** clear `checkIn`/`checkOut`, **keep `guests`**. `currentStep` then derives back to
`date` because the date slot is empty, and once a new day is picked it derives straight past
`guests` to `summary` — the camper never re-answers something still true. This is the
derived-step design paying for itself; a stored cursor would need explicit rewind logic here.

### E2 · That party size exceeds what is left

**Trigger:** a typed number above `min(remaining, maxGuestsPerDay)`. (Not reachable from a
chip — chips are generated from the ceiling.)
**Treatment:** the flow **stays on `guests`**; `aria-current` does not move. The block
states the real ceiling, then offers exactly one answer chip: the ceiling itself,
`{count} คนก็ได้`, which turns a rejection into a one-tap answer. The way to try a bigger
day is named in words and executed by `ย้อนกลับ`, already in the control row.

No alternative-date chips here. A date-valued chip inside a block whose `data-step` says
`guests` would break the testid contract in §6 — the one thing protecting a later redesign.

### E3 · The re-check itself failed (network)

**Trigger:** the pre-summary re-check request fails or returns a bad shape.
**Why it must exist:** without it, a failed re-check either shows a summary that may be
stale — defeating the only reason the re-check exists — or silently drops the camper out
of the flow.
**Treatment:** reuse the chat's existing error row verbatim: `ErrorBanner` with
`aiChat.booking.checkFailed`, plus a `ลองใหม่` button reusing the existing `aiChat.retry`
(same shape as `AiChatMessageList.tsx:454-467`). **Slots are untouched**, so retry is one
tap and re-runs the same check. No new pattern, no new copy for the button.

### Unreadable input, and typing about something else

Per step, an input the step's own `parse()` cannot read is re-asked **once**
(`aiChat.booking.date.unreadable` / `guests.unreadable`). A **second consecutive**
unreadable input ends the flow quietly with `aiChat.booking.handedToAssistant` and lets
that turn go to the assistant as a normal question. The prototype re-asks forever
(`chat-prototype.html:876,883`), which traps a camper who simply changed the subject.
Repeating "I don't understand" is the failure, not the unreadable input.

## Validation UX

No form fields, so no inline field errors. All three error shapes render as conversation
(E1, E2) or as the chat's existing error row (E3), per `form-patterns.md`'s split: E3 is
the only one that is a *server error after an action*, and it is the only one that gets
`ErrorBanner`.

---

## §6 Components, tokens, testids

### Components — all existing, none invented

| element | component | note |
|---|---|---|
| entry, chips, controls, handoff | `components/ui/button.tsx` | `default` / `outline` / `ghost`; `size="lg"` and `size="sm"` + `h-11` |
| E3 error | `components/ui/error-banner.tsx` | unchanged |
| handoff navigation | `next/link` via `<Button asChild>` | same idiom as `AiChatDetailCard.tsx:712-717` |
| the chip row | **`ChatChipRow`**, extracted from `AiChatMessageList.tsx:398-417` | an internal extraction inside `components/ai-chat/`, shared with the existing suggestion chips. **Not** a new design-system primitive, so **no `DESIGN.md` §3.1 entry** |

Icons: **lucide-react only** (`DESIGN.md` §7 — `@tabler/icons-react` was removed under DS-5).
This design specifies **no icon at all**: an icon on the step caption would be chrome
carrying no information, and `ErrorBanner` brings its own `AlertCircle`.

### Tokens — every value from the token layer, nothing new

| use | token |
|---|---|
| primary fill (entry, handoff) | `--primary` / `--primary-foreground` |
| chip + control surface | `--background` / `--muted` on hover; boundary `--border` |
| step caption, type-hint, summary labels, captions | `text-foreground/70` |
| assistant sentence, summary values, total | `--foreground` |
| summary container | `border-ai-tint/60` + `bg-muted/20` |
| summary divider | `border-border/60` |
| focus ring | `--ring` (`ring-ring/30`, primitive) |
| E3 error | `--destructive` (via `ErrorBanner`) |
| radius | chip/control/button `rounded-full` · summary card `rounded-2xl` (`DESIGN.md` §2 radius-by-role) |

**`text-foreground/70` and not `text-muted-foreground`.** CAM-541 measured
`text-muted-foreground` on `--ai-surface` at **4.40:1** in light mode, under the 4.5:1 body
floor; `text-foreground/70` measures **7.41:1 light / 8.69:1 dark** on the same surface.
The flow renders on the panel's `bg-ai-surface` glass, so it inherits that finding rather
than re-deriving it.

**New tokens: none. `DESIGN.md` edits: none.**

### Motion — none added, and one inherited fact stated honestly

This design adds **no** `transition-*`, **no** `animate-*`, and **no** `--ai-*` loop.
Two specific consequences the build must not undo:

- **The step block does NOT get `ENTRANCE_MOTION_CLASS`.** Every neighbouring row in
  `AiChatMessageList.tsx` carries `motion-safe:animate-in …duration-200`. A build agent
  copying the adjacent row will inherit it. **Do not.** (Critical.)
- **No `motion-safe:active:scale-95` className** on any chip or control, unlike the
  existing suggestion chips at `:410`.

**Inherited, and out of this story's surface (Info):** `components/ui/button.tsx`'s base
class already carries `transition-all`, `motion-safe:active:scale-95` and
`active:not-aria-[haspopup]:translate-y-px`. Every button in the app, including the ones
already in this panel, presses that way. This design does not introduce it and **must not
strip it from the primitive** — that is a repo-wide design-system change outside this
dispatch. CAM-627 was about a *continuous idle* GPU cost (the aurora drift loop plus a
looping particle canvas behind stacked `backdrop-blur-xl` layers); a press transform that
fires only on tap is a different cost class. If the owner wants press motion gone too,
that is its own ticket against `components/ui/button.tsx`.

### `data-testid` — keyed to the step id, never to the treatment

The step id lives in a **`data-step` attribute** alongside a stable testid, rather than
inside the testid string. This keeps every id in the `<type>--<module>-<detail>` grammar
(`DESIGN.md` §6) while letting e2e select
`[data-testid="msg--ai-chat-booking-step"][data-step="guests"]`. Baking the step into the
testid would fork the grammar into three ids for one element.

| `data-testid` | element | extra attributes |
|---|---|---|
| `btn--ai-chat-booking-start` | entry button, detail card footer | — |
| `msg--ai-chat-booking-step` | the step block wrapper (`role="group"`) | `data-step="date\|guests\|summary"` |
| `text--ai-chat-booking-step-caption` | the `ขั้นที่ N จาก 3 · …` line | `data-step`, `aria-current="step"` on the newest only |
| `group--ai-chat-booking-chips` | the answer chip row | `data-step` |
| `btn--ai-chat-booking-chip` | one answer chip | `data-step`, `data-value` (the ISO date or the guest count) |
| `text--ai-chat-booking-type-hint` | the type-it-instead caption | `data-step` |
| `group--ai-chat-booking-controls` | the flow control row | `data-step` |
| `btn--ai-chat-booking-back` | `ย้อนกลับ` | `data-step` (the step it returns to) |
| `btn--ai-chat-booking-edit` | `แก้วัน` / `แก้จำนวนคน` | `data-step="date"\|"guests"` (the step it returns to) |
| `btn--ai-chat-booking-cancel` | `ยกเลิกการจอง` | `data-step` |
| `block--ai-chat-booking-summary` | the summary card | — |
| `row--ai-chat-booking-summary-line` | one summary row | `data-field="camp\|dates\|guests\|total"` |
| `btn--ai-chat-booking-handoff` | `ไปกรอกต่อที่หน้าจอง` | — |
| `status--ai-chat-booking-checking` | the re-check text status (`role="status"`) | — |
| `error--ai-chat-booking-check-failed` | E3 `ErrorBanner` | — |
| `empty--ai-chat-booking-no-dates` | the date-step empty state | — |

The four ids named in the plan — `msg--ai-chat-booking-step`,
`block--ai-chat-booking-summary`, `btn--ai-chat-booking-chip`,
`btn--ai-chat-booking-handoff` — are preserved exactly.

---

## §7 a11y — WCAG 2.1 AA

**Structure**

- Each step block is `role="group"` with `aria-label={aiChat.booking.groupLabel}`.
- The caption of the **newest** block carries `aria-current="step"`; superseded captions keep
  their text and lose the attribute.
- The chip row is `role="group"` with its own step-specific label
  (`aiChat.booking.date.chipsLabel` / `guests.chipsLabel`) — the same pattern the existing
  suggestion chips already use (`AiChatMessageList.tsx:398-401`).
- The summary card is `role="group"` + `aria-label={aiChat.booking.summary.label}`; its
  `·` separators and decorative glyphs are `aria-hidden="true"`.

**The step-change announcement — one live region, not two**

The step announcement is delivered by the log's **existing**
`role="log" aria-live="polite" aria-relevant="additions"`. A new step block is an addition,
so it is announced once, automatically, caption and chips included. **Do not add a second
live region for step changes** — that is the double-announcement described in the
step-indicator verdict, and it would be a defect, not extra care.

Exactly one new live region is needed, because it is the only thing here that changes **in
place** rather than being added: `status--ai-chat-booking-checking`, scoped
`role="status" aria-live="polite"`, mirroring the resuming indicator at
`AiChatMessageList.tsx:188-197`.

**Focus when chips are replaced — the load-bearing rule**

Tapping a chip removes that chip from the DOM. Without a rule, focus falls to `<body>`: a
keyboard camper is stranded mid-flow and a screen reader loses its place.

> **After any transition that replaces the chip row, move focus to the new block's caption
> element**, which takes `tabIndex={-1}`.

Not the first new chip: focusing a chip skips the assistant's question (the camper would
hear `ส. 2 ส.ค.` without hearing *why*) and visually pre-selects an answer, which is a
nudge. The caption puts the camper at the top of the new block; Tab then walks
caption → chips → hint → controls in reading order. Same principle as the detail card's own
`backButtonRef.current?.focus()` on open (`AiChatDetailCard.tsx:225-227`).

Per transition:

| transition | focus lands on |
|---|---|
| chip tap advances a step | the new block's caption |
| typed answer advances a step | the new block's caption (the composer keeps the caret; focus does **not** leave the textarea when the camper is typing — announce only) |
| `ย้อนกลับ` / `แก้…` | the returned-to block's caption |
| E1 / E2 | the new block's caption |
| E3 | the `ลองใหม่` button — the row that had focus is gone and retry is the only next action |
| `ยกเลิกการจอง` | the composer textarea — the conversation is the way forward again |

**Contrast — measured, and honestly labelled**

| pair | measured | source |
|---|---|---|
| `text-foreground/70` on `--ai-surface` | 7.41:1 light / 8.69:1 dark | CAM-541, `check:contrast` |
| `--primary-foreground` on `--primary` fill | 5.17:1 light / 7.23:1 dark | CAM-532 |
| all other token pairs used | pinned by `npm run check:contrast` (54 enforced pairs) | `DESIGN.md` §8.11 |
| `bg-muted/20` behind summary values | **not measured** — a composite over the glass; the build measures it and reports, or swaps to bare `bg-muted` |

**Info, not a blocker:** `--border` measures 1.25:1 light / 1.26–1.34 dark as a boundary,
below the 3:1 non-text floor. It is the boundary of every `outline` and `ghost` button in
the app, and `DESIGN.md` §8 item 11 records it as an **owner-deferred look decision** with
its own measured numbers, not an open bug. This design does not worsen it, and every chip
and control here carries a **text label** — the control is identifiable without relying on
its boundary, so it is never colour- or border-only.

**Remaining checklist**

- **Tap ≥44px, everywhere.** Chips and controls are `h-11` (44px, the floor) even at
  `size="sm"` — `size="sm"` alone is `h-9` and would be under the floor. Entry and handoff
  are `size="lg"` (`h-11` mobile, `md:h-12`).
- **Keyboard.** Fully operable; no trap; reading order matches DOM order. Esc is already
  claimed by the detail card's window-level capture listener
  (`AiChatDetailCard.tsx:231-239`) — the flow does **not** bind Esc, so no key is stolen.
- **Colour is never the only signal.** Remaining counts, full/open, the current step and
  every error are stated in words.
- **`tabular-nums`** on every count, date and price (`DESIGN.md` §4).
- **axe** clean on the panel with the flow open at each of the three steps, before handoff.

---

## §8 Copy — `aiChat.booking.*`, TH + EN

Voice check first. น้องกองไฟ as shipped speaks in **first person `เรา`**, friendly, and
uses **no `ครับ` / `ค่ะ` particles anywhere** — verified: zero occurrences of either in
`locales/translations.json`. The prototype's copy is `ครับ`-heavy throughout; **that is the
prototype's voice, not this app's.** Every string below matches the shipped voice
(`สวัสดี เราน้องกองไฟเอง …`, `ยังไม่เจอที่ถูกใจเลย … ได้นะ`).

**No em-dash (`—`) in any Thai value.** **No technical jargon in any value.**

### New keys — 44 (every row has TH **and** EN; zero em-dashes in any Thai value)

| key | TH | EN |
|---|---|---|
| `aiChat.booking.start` | `เริ่มจอง` | `Start booking` |
| `aiChat.booking.startAriaLabel` | `เริ่มจองลาน {name}` | `Start booking {name}` |
| `aiChat.booking.groupLabel` | `ขั้นตอนการจอง` | `Booking step` |
| `aiChat.booking.stepCaption` | `ขั้นที่ {current} จาก {total}` | `Step {current} of {total}` |
| `aiChat.booking.stepName.date` | `เลือกวัน` | `Choose a date` |
| `aiChat.booking.stepName.guests` | `จำนวนคน` | `How many people` |
| `aiChat.booking.stepName.summary` | `ตรวจดูอีกที` | `Check it over` |
| `aiChat.booking.date.ask` | `เริ่มจอง {name} กันเลย อยากไปวันไหนดี` | `Let's get {name} booked. Which day would you like?` |
| `aiChat.booking.date.chipsLabel` | `วันที่ยังว่าง` | `Days still open` |
| `aiChat.booking.date.chip` | `{date} เหลือ {count} ที่` | `{date}, {count} spots left` |
| `aiChat.booking.date.chipNoCap` | `{date} มีที่ว่าง` | `{date}, spots open` |
| `aiChat.booking.date.typeHint` | `หรือพิมพ์วันที่เองก็ได้ เช่น เสาร์หน้า หรือ 15 ส.ค.` | `Or type a date yourself, like "next Saturday" or "15 Aug".` |
| `aiChat.booking.date.empty` | `ช่วงนี้ยังไม่มีเสาร์ว่างเลย ลองพิมพ์วันที่อยากไปมาได้เลย เดี๋ยวเราหาให้` | `No Saturdays are open in this stretch. Type the day you have in mind and I'll go look.` |
| `aiChat.booking.date.unreadable` | `ยังจับวันไม่ได้เลย ลองบอกใหม่อีกที เช่น เสาร์หน้า หรือ 15 ส.ค.` | `I didn't catch a date there. Try again, like "next Saturday" or "15 Aug".` |
| `aiChat.booking.date.full` | `{date} เต็มแล้ว ลองวันอื่นดูไหม` | `{date} is fully booked. Want to try another day?` |
| `aiChat.booking.guests.ask` | `{date} นะ วันนั้นเหลือ {count} ที่ ไปกันกี่คน` | `{date} it is. That day has {count} spots left. How many of you are going?` |
| `aiChat.booking.guests.askNoCap` | `{date} นะ ไปกันกี่คน` | `{date} it is. How many of you are going?` |
| `aiChat.booking.guests.chipsLabel` | `จำนวนคน` | `Number of people` |
| `aiChat.booking.guests.chip` | `{count} คน` | `{count} people` |
| `aiChat.booking.guests.typeHint` | `ไปกันหลายคนกว่านี้ พิมพ์จำนวนมาได้เลย` | `Going with more than that? Just type the number.` |
| `aiChat.booking.guests.unreadable` | `ยังจับจำนวนไม่ได้เลย บอกเป็นตัวเลขได้ เช่น 2 คน` | `I didn't catch a number there. Tell me like "2 people".` |
| `aiChat.booking.guests.overCapacity` | `{date} เหลือ {remaining} ที่ ไป {requested} คนอาจไม่พอ` | `{date} has {remaining} spots left, so {requested} people may not fit.` |
| `aiChat.booking.guests.overCapacityHint` | `เลือก {remaining} คนได้เลย หรือกดย้อนกลับไปหาวันที่รับได้ทั้งกลุ่ม` | `Take {remaining} instead, or go back and find a day that fits everyone.` |
| `aiChat.booking.guests.capChip` | `{count} คนก็ได้` | `{count} works` |
| `aiChat.booking.summary.intro` | `ตรวจดูอีกทีนะ ถ้าโอเคแล้วไปกรอกต่อที่หน้าจองได้เลย` | `Have a look. If it's right, carry on at the booking page.` |
| `aiChat.booking.summary.label` | `สรุปการจองที่เลือกไว้` | `Your booking draft` |
| `aiChat.booking.summary.campRow` | `ลาน` | `Campsite` |
| `aiChat.booking.summary.datesRow` | `วันเข้าพัก` | `Stay` |
| `aiChat.booking.summary.datesValue` | `{date} พัก 1 คืน` | `{date}, 1 night` |
| `aiChat.booking.summary.guestsRow` | `จำนวนคน` | `People` |
| `aiChat.booking.summary.guestsValue` | `{count} คน` | `{count} people` |
| `aiChat.booking.summary.totalRow` | `ยอดรวมโดยประมาณ` | `Estimated total` |
| `aiChat.booking.summary.estimateNote` | `ค่าธรรมเนียมของลานยังไม่รวมในนี้ ดูยอดเต็มได้ที่หน้าจอง` | `The camp's own fees aren't included here. See the full amount at the booking page.` |
| `aiChat.booking.handoff` | `ไปกรอกต่อที่หน้าจอง` | `Continue at the booking page` |
| `aiChat.booking.back` | `ย้อนกลับ` | `Back` |
| `aiChat.booking.editDate` | `แก้วัน` | `Change date` |
| `aiChat.booking.editGuests` | `แก้จำนวนคน` | `Change people` |
| `aiChat.booking.cancel` | `ยกเลิกการจอง` | `Cancel booking` |
| `aiChat.booking.controlsLabel` | `ตัวเลือกอื่น` | `Other options` |
| `aiChat.booking.cancelled` | `ยกเลิกให้แล้ว อยากดูลานอื่นต่อไหม` | `Cancelled. Want to look at other camps?` |
| `aiChat.booking.checking` | `กำลังตรวจสอบที่ว่าง…` | `Checking availability…` |
| `aiChat.booking.checkFailed` | `ตรวจสอบที่ว่างไม่สำเร็จ ลองอีกทีได้เลย` | `Couldn't check availability. Please try again.` |
| `aiChat.booking.justFilled` | `ขอโทษที {date} เพิ่งเต็มไปเมื่อกี้ ลองวันอื่นดูไหม` | `Sorry, {date} filled up just now. Want to try another day?` |
| `aiChat.booking.handedToAssistant` | `โอเค พักเรื่องจองไว้ก่อน เดี๋ยวเราตอบเรื่องนี้ให้` | `OK, let's park the booking. I'll answer that instead.` |

### Keys deliberately REUSED — add nothing for these

| need | existing key | value |
|---|---|---|
| the retry button on E3 | `aiChat.retry` | `ลองใหม่` / `Try again` |
| a day with no cap set | `aiChat.detail.openNoCap` | `มีที่ว่าง` / `Spots open` |
| the not-charged reassurance under the total | `booking.notChargedYet` | `คุณจะยังไม่ถูกเรียกเก็บเงิน` / `You won't be charged yet` |
| the demoted footer button | `aiChat.detail.viewCampPage` | `ดูหน้าลาน` / `View camp page` |
| the ฿ total value | none — formatted by the existing `THB_FORMAT` in `AiChatDetailCard` | — |

`aiChat.booking.back` duplicates the *text* of `aiChat.detail.back`, and that is deliberate:
they belong to two different surfaces, and sharing the key would make a future reword of the
detail pane's back button silently change a booking control.

---

## Links

`../../feature.md` · `DESIGN.md` (§2 tokens · §2.0 mobile scale · §2.1 assistant exception ·
§3 components · §5 anti-slop · §6 gate · §7 icons) · `.claude/rules/loading.md` ·
`.claude/rules/ux.md` · `components/ui/form-patterns.md` · `story.md` ·
`docs/research/ai-chat/chat-prototype.html:822-978` (intent only)

## Changelog
- v1 (2026-07-29) — created
