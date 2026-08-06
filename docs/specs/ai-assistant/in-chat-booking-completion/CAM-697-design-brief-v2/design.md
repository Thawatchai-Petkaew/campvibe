---
linear: CAM-697
feature: ai-assistant
epic: CAM-695 in-chat-booking-completion
persona: Camper
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-08-06
---
# Design — In-chat booking completion, round 2 (CAM-697)

> **G2, full human tap.** Round 2 turns a draft into a write. It introduces **no new token** and
> **no new `components/ui/*` primitive**; the only `DESIGN.md` edit is the §2.1 inventory
> correction in §15, which legalises code that already shipped.
>
> **Reads on top of `docs/specs/ai-assistant/in-chat-guided-booking/CAM-637-design-brief/design.md`.**
> Every idiom that brief established is inherited verbatim unless a section below overturns it
> **by name and with a date**. Nothing here is a silent contradiction.

---

## §0 What round 2 changes, and the one rule it retires

Round 1 shipped a flow whose last button meant *carry on over there*. Round 2's last button
**writes a `Booking` row**. That single fact is what every change below descends from.

### The confirm-verb ban expires here — dated supersession

CAM-637 §3 ruled the summary CTA `ไปกรอกต่อที่หน้าจอง` and banned `ยืนยัน` / `จองเลย` on the
stated ground that *"nothing has been written"*, and its Non-goals banned "the word `สำเร็จ`"
for the same reason.

> **Superseded 2026-08-06 (CAM-697).** The premise expired, not the reasoning. The summary CTA
> now POSTs to `/api/bookings` and a real row is created, so `ยืนยันการจอง` and `จองสำเร็จแล้ว`
> are the *accurate* words rather than the forbidden ones. **The ban stays fully in force for
> any surface that does not write** — a confirm verb on a draft is still a Critical gate
> violation. What changed is this surface, not the rule.

### The handoff CTA is removed, not demoted

`POST /api/bookings` accepts exactly `campSiteId · checkInDate · checkOutDate · guests ·
spotId? · source` (`lib/validations/booking.ts:21-60`). The round-2 flow collects **all** of
them. The booking page therefore has no remaining job in this flow: it would collect nothing,
confirm nothing, and sit beside `ยืนยันการจอง` as a second `size="lg"` control whose intent also
resolves to "book this camp" — the duplicate-CTA-intent failure `DESIGN.md` §6 layout sanity
names. A camper who still wants the camp page reaches it from the detail card's own `ดูหน้าลาน`,
which round 1 kept.

Consequence: `aiChat.booking.handoff` and `aiChat.booking.summary.intro` become unread (§13.4).

### Scope of round 2

| # | Change | Section |
|---|---|---|
| 1 | New step `nights`, after `date` | §3 |
| 2 | New step `spot` (per-pitch camps only), after `guests` | §4 |
| 3 | `summary` gains the real confirm + the guest login gate | §5 |
| 4 | New state `submitting` | §6 |
| 5 | New state `booked` | §7 |
| 6 | New state `bookingFailed` (rateLimited · uncertain · sessionExpired) + the 409 rewind | §8 |
| 7 | The step-indicator decision, re-opened at 5 steps as round 1 ordered | §2 |

**Out of scope (name it, don't wander into it):** cancelling a booking from chat (that lives at
`/bookings`) · payment of any kind (the row is created `PENDING`, nothing is charged) · a
booking code or QR inside the chat (§7, with the correction) · gear/add-on steps · editing a
booking after it is written.

---

## §1 Flow

```text
detail card footer ──[ เริ่มจอง ]──▶ date ──▶ nights ──▶ guests ──▶ [ spot ]* ──▶ summary
                                       ▲        ▲          ▲           ▲            │
                                       └────────┴──────────┴───────────┘            │
                                          ย้อนกลับ / แก้วัน / แก้จำนวนคืน /            │
                                          แก้จำนวนคน / แก้จุดกางเต็นท์                  │
                                                                                    │
      ┌─────────────────────────────────────────────────────────────────────────────┘
      │
      ├─ guest ──[ เข้าสู่ระบบเพื่อยืนยันการจอง ]──▶ LoginModal ──▶ label flips ──▶ (camper taps)
      │
      └─ member ──[ ยืนยันการจอง ]──▶ submitting ──┬──▶ booked  ──▶ flow ends, chat continues
                                                   ├──▶ bookingFailed · rateLimited
                                                   ├──▶ bookingFailed · uncertain
                                                   ├──▶ bookingFailed · sessionExpired
                                                   └──▶ 409 ──▶ rewind to date (justFilled)

* the spot step exists only for a `useSpotView` camp that has at least one bookable pitch.
  Whole-camp flow = 4 steps. Per-pitch flow = 5 steps.

ยกเลิกการจอง at any step BEFORE submitting ──▶ flow ends, conversation continues normally.
```

**Step order is not arbitrary.** `nights` sits directly after `date` because a night count is a
property of the stay the camper has just named, and because every later question depends on the
span: the guest ceiling, the pitch availability and the total are all computed *for the span*.
`spot` sits after `guests` because a pitch is filtered by party size (`Spot.maxCampers`) — asking
for a pitch before knowing the party would offer pitches the group cannot use.

Everything else about the block — its shape, its seven-part top-to-bottom order, the narrow
column at every viewport, the entry button on the detail card footer — is CAM-637 §1 unchanged.

---

## §2 The step-indicator decision, re-opened at five steps

CAM-637 ruled: no permanent step chrome, the step lives in a caption that scrolls away with its
block, and it ordered — verbatim — *"If round 2 adds `spot` and `gear` and the flow reaches five
steps, re-open this decision. Do not inherit it silently."* The flow now reaches five. Re-opened.

**Verdict: hold. No permanent step bar. The caption stays.** Three of round 1's reasons are
untouched by the step count, and the fourth argument is new and points the same way.

1. **The double-announcement cost scales *against* a bar, not for it.** The log is already
   `aria-live="polite" aria-relevant="additions"`; a new block announces itself once, free. A bar
   mutates in place and needs its own live region, so every advance fires two announcements for
   one event. At three steps that was three double-announcements. At five it is five. More steps
   makes this reason stronger, never weaker.
2. **It still takes height from the one scrolling region** (`AiChatPanel` is a fixed-height flex
   column: header, `ScrollArea min-h-0`, composer dock). Unchanged.
3. **The current step is still derived, not stored** (`currentStep(slots)`). Unchanged.
4. **New at five steps: the total is now variable, and a bar cannot state it honestly.** The
   flow is 4 steps for a whole-camp listing and 5 for a per-pitch one. A permanent bar renders
   one number for the whole conversation and would have to guess before the camp is known, or
   re-render its own total when the camper switches camps. A caption is authored at the moment
   the assistant speaks, about the camp being booked, so `ขั้นที่ 4 จาก 5` is true of that camp
   and stays true forever as history.

**What the camper gets instead.** The counter *is* the progress indicator — it just lives in the
newest block. `aria-current="step"` sits on the newest caption only. And at the one moment
"what have I actually chosen" matters, the summary card recaps every answer on screen.

**⚠ Critical build note — the caption's `{total}` must be this camp's step count.**
`AiChatBookingStep.StepCaption` currently reads `BOOKING_STEPS.length`
(`components/ai-chat/AiChatBookingStep.tsx:229`), a registry constant. With a conditional
`spot` step, a whole-camp flow would print `ขั้นที่ 3 จาก 5` and then finish at 4 — a counter
that lies about a step that never comes. The total must be the length of **the step list
resolved for this camp**. Shipping the constant is a Critical defect against this brief.

**What would flip the verdict next time:** a step revisitable out of order (the caption cannot
express a non-linear position), a flow beyond five steps, or field evidence of mid-flow
abandonment that a bar would plausibly fix. None is true today. Re-open again at six.

---

## §3 Step `nights`

```text
┌──────────────────────────────────────┐
│              ส. 2 ส.ค. · เหลือ 6 ที่  │ ← the camper's own answer, user bubble
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ ขั้นที่ 2 จาก 4 · จำนวนคืน             │ ← caption, aria-current="step"
│                                      │
│ ส. 2 ส.ค. นะ ไปกันกี่คืนดี              │
│                                      │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│ │ 1 คืน│ │ 2 คืน│ │ 3 คืน│ │ 4 คืน│  │ ← answer chips (max 4)
│ └──────┘ └──────┘ └──────┘ └──────┘  │
│                                      │
│ อยากพักนานกว่านี้ พิมพ์จำนวนคืนมาได้เลย  │
│                                      │
│ ย้อนกลับ   ยกเลิกการจอง               │
└──────────────────────────────────────┘
│ [ 5 คืน                          ] ▶ │ ← composer, LIVE
```

**Chip generation — the pattern, never a fixed set.** Identical grammar to round 1's guests step:

```text
run     = consecutive open nights from the chosen check-in date
ceiling = min(run, MAX_BOOKING_NIGHTS)          // MAX_BOOKING_NIGHTS = 30, a real server bound
chips   = 1 .. min(ceiling, MAX_NIGHT_CHIPS)    // MAX_NIGHT_CHIPS = 4, a layout constant
```

`4` is how many pills fit one row of a ~380px column and **nothing else**. `run` is never
fabricated: the chosen check-in date is open by construction, so `run ≥ 1` and the row is never
empty. Truncation is signalled by the type-hint directly below it, the same contract round 1
established for the date row.

**Typed nights are a first-class path.** The step's `parse()` must read digits (`2`, `2 คืน`),
Thai number words for 1-30 (`สองคืน`, `สามคืน`), and the bare number with no unit. Anything it
cannot read is re-asked once with `nights.unreadable`; a second consecutive unreadable input ends
the flow with `handedToAssistant`, exactly as round 1 specified.

**Two real bounds, two real messages — neither may be silent.**

| condition | copy | what the block then offers |
|---|---|---|
| typed nights > `run` | `nights.overRun` | one chip: the run itself (`nights.chip`) + `แก้วัน` named in words |
| typed nights > 30 | `nights.tooLong` (`{max}` = 30) | the chip row is re-rendered unchanged |

The 30-night ceiling is not a design preference: `bookingSchema` rejects it server-side
(`lib/validations/booking.ts:54`) with an English message no camper may ever see. Catching it in
the step is what keeps that message off the screen.

**The summary reads `พัก {N} คืน`.** Round 1 hardcoded `พัก 1 คืน` and wrote *"Multi-night is a
round-2 copy change, not a placeholder waiting here."* This is that change (§13.2).

---

## §4 Step `spot` — the pitch picker, in the chat's own idiom

```text
┌──────────────────────────────────────┐
│ ขั้นที่ 4 จาก 5 · เลือกจุดกางเต็นท์      │
│                                      │
│ เลือกจุดกางเต็นท์ที่ชอบได้เลย            │
│                                      │
│ ┌───────────────────┐ ┌────────────┐ │
│ │ ริมน้ำ A · คืนละ ฿500 │ │ เนินสน B …│ │ ← answer chips (max 4)
│ └───────────────────┘ └────────────┘ │
│                                      │
│ อยากได้จุดอื่น พิมพ์ชื่อจุดมาได้เลย       │
│                                      │
│ ย้อนกลับ   ยกเลิกการจอง               │
└──────────────────────────────────────┘
```

**This is deliberately not the camp page's pitch picker.** `SpotViewer` is a fixed-height
viewport plus a photo strip plus a fact sheet (`components/spot-viewer/*`) — a browsing surface,
built to let a camper compare pitches by looking at them. Rebuilding it inside a ~380px chat
block would (a) require a photo payload the assistant does not carry, (b) put a second browsing
surface *after* the camper already said "start booking" and the detail pane closed, and (c)
introduce a second selection grammar into a flow that has exactly one. The chat's job here is
**pick, not browse**: a name, a price, and the guarantee that everything offered is actually
takeable. A camper who wants to look at pitches taps `ดูหน้าลาน` and looks at them.

**Chip content.** One `<Button variant="outline" size="sm" className="h-11 rounded-full">` per
offered pitch: the pitch name, an `aria-hidden` `·`, then the per-night price in
`text-foreground/70 tabular-nums` — the exact anatomy of round 1's date chip. The accessible
name is overridden with a single string built from `spot.chip` so no stray separator is
announced.

**What may be offered — the filter is the honesty mechanism.**

```text
offered = pitches that are
            free for EVERY night of the chosen span
          AND (maxCampers is null OR maxCampers >= guests)
shown   = the 4 cheapest of `offered`, cheapest first
```

Never offer a pitch that cannot be taken — the same rule that makes the date chips trustworthy.
**Cheapest-first is the correct truncation order here** because price is the one dimension the
chip can state truthfully without a photo, so the four shown are a fact the camper can verify
("these are the four cheapest that fit"), not an arbitrary four. Truncation is signalled by
`spot.typeHint`, and a typed pitch name reaches any pitch, shown or not.

**Occupied → re-offer, one shape for three routes.** A pitch can turn out to be taken from
three directions: a race between render and tap, a typed name for a pitch that is not free, and
a `400 Invalid spotId` from the write. All three render the same block: `spot.occupied` naming
the pitch, then a **fresh** chip row with that pitch excluded, then the control row. The flow
stays on `spot`; `aria-current` does not move. This is round 1's E1 treatment applied to a new
slot: nothing failed, the world changed, so it is conversation and not an `ErrorBanner`.

**Empty is real here, unlike the guests step.** Every pitch taken for the span, or none big
enough for the party, is entirely reachable. The block renders `spot.empty`, **no chip row**, and
the control row is the way out — `แก้วัน`, `แก้จำนวนคืน`, `แก้จำนวนคน` are each a one-tap fix for
one of the causes. One message covers both causes because the camper's next move is the same
either way and a second key would only split one dead end into two.

**⚠ Critical dependency — this step has no data today.** `lib/ai/tools/get-camp-detail.ts`
returns neither `useSpotView` nor any pitch list, so the assistant cannot currently tell a
per-pitch camp from a whole-camp one. This step is unbuildable until that payload exists. The
shape of it is the **architect's** call (`tech.md` / ADR), not this brief's; what the design
requires is: a per-camp per-pitch flag, and per pitch a `name`, a per-night price, a
`maxCampers`, and availability resolved **for the chosen span** rather than per single night.

---

## §5 Step `summary` — the real confirm, and the login gate

```text
┌──────────────────────────────────────┐
│ ขั้นที่ 5 จาก 5 · ตรวจดูอีกที           │
│                                      │
│ ตรวจดูอีกทีนะ ถ้าโอเคแล้วกดยืนยันได้เลย  │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ ลาน               ภูชี้ฟ้า         │ │
│ │ วันเข้าพัก        ส. 2 ส.ค. พัก 2 คืน│ │
│ │ จำนวนคน           2 คน            │ │
│ │ จุดกางเต็นท์        ริมน้ำ A         │ │ ← per-pitch camps only
│ │ ──────────────────────────────── │ │
│ │ ยอดรวมโดยประมาณ          ฿1,000  │ │
│ │ คุณจะยังไม่ถูกเรียกเก็บเงิน          │ │
│ │ ยอดนี้คำนวณจากข้อมูลล่าสุดที่เราเห็น   │ │
│ │ ยอดจริงจะยืนยันอีกทีตอนจองสำเร็จ      │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │        ยืนยันการจอง               │ │ ← the one primary; it WRITES
│ └──────────────────────────────────┘ │
│                                      │
│ แก้วัน  แก้จำนวนคืน  แก้จำนวนคน         │
│ แก้จุดกางเต็นท์  ยกเลิกการจอง           │
└──────────────────────────────────────┘
│ [ พิมพ์อะไรก็ได้                 ] ▶ │ ← composer, still LIVE
```

Container, row anatomy, divider, `text-foreground` on the total, no interactive rows inside the
card: **all inherited from CAM-637 §3 unchanged.** Three things change.

**1 · The card gains a pitch row** (`data-field="spot"`) for per-pitch camps only. An absent
pitch renders no row, never a `—`.

**2 · The estimate note was factually wrong, and its pointer is now dead.** Round 1 wrote
`ค่าธรรมเนียมของลานยังไม่รวมในนี้ ดูยอดเต็มได้ที่หน้าจอง` on the stated ground that per-camp fees
are not modelled in the chat. They are: `get-camp-detail.ts:375` returns `extraFeeAmount` and
`extraFeeLabel`, and `AiChatDetailCard.tsx:581-588` already displays them. So the chat can feed
`computeBookingPrice` **the same inputs the server does** and its preview should match the
recorded total. Meanwhile the second half of the sentence points at a page this flow no longer
offers. Both halves are replaced (§13.2).

**The label stays `ยอดรวมโดยประมาณ`** even so, and that is not timidity: the chat's numbers come
from a payload snapshot that a host can invalidate mid-conversation, and the server is
authoritative. Keeping `โดยประมาณ` here is what makes the success card's plain `ยอดรวม` mean
something — *that* one is the record.

**3 · The CTA writes.** `ยืนยันการจอง`, `Button default size="lg" w-full`, the single primary.
The control row grows to four edits plus cancel and **wraps to two lines at a ~380px column**;
that is expected, not a defect. `ยกเลิกการจอง` is last in DOM order so it lands at the end of
the wrap, where "get me out of here" belongs and where a mis-tap from the primary cannot reach it.

### The login gate

The camper may be a guest. The gate sits on the **confirm button itself**, not on an earlier
step — a guest can walk the whole flow, and asking them to sign in before they have seen the
total would be asking for a commitment before showing the price.

| session | button label | key |
|---|---|---|
| guest | `เข้าสู่ระบบเพื่อยืนยันการจอง` | `loginToConfirm` |
| member | `ยืนยันการจอง` | `confirm` |

It is **one control with two labels**, not two controls: same `data-testid`, same position, same
`size="lg"` primary, distinguished for e2e by a `data-auth="guest|member"` sibling attribute.

**Tapping it as a guest opens `LoginModal` over the panel** — the existing component, lazily
imported exactly as `InfiniteScrollGrid.tsx:37-41` already does it for guest heart-clicks, with
`subtitle={t.aiChat.booking.loginPrompt}` (the same slot the wishlist prompt uses). `LoginModal`
is a `Dialog`: it traps focus, renders above the panel, and returns focus to its trigger on
close. No new overlay pattern.

> **⚠ Critical — after login the label flips, and nothing auto-submits.** The camper signs in,
> the modal closes, focus returns to the same button, and that button now reads `ยืนยันการจอง`.
> **The camper taps it themselves.** Auto-submitting on a session change would write a booking
> the camper never confirmed while a modal was closing over the top of it. The flip must read the
> **live** `useSession()` status, never a server-rendered prop — a server prop lags
> `router.refresh()` after a modal login and the first press lands on a stale value (CAM-396).

### Once the flow leaves `summary`, the historical summary must go inert

> **⚠ Critical.** `appendBookingEntry` (`components/ai-chat/conversation.ts:127-134`) revises
> exactly one field on a superseded entry: `isCurrent`. Everything else in a scrolled-back block
> stays live. A superseded summary block therefore keeps a **working `ยืนยันการจอง` button**, and
> scrolling up and tapping it would write a second booking. A summary view with
> `isCurrent === false` renders its confirm button and every control **`disabled`** (the real
> attribute — a history block never holds focus, and it must also leave the tab order so a
> keyboard camper cannot reach a stale confirm).

**Important, pre-existing, and not this story's surface:** the same gap leaves *chips* in
superseded blocks tappable, so an old date chip can still be pressed mid-flow. That is a round-1
behaviour, it writes nothing, and widening this dispatch to fix it would be scope creep — but it
is named here so it is not rediscovered as new.

---

## §6 State `submitting`

```text
┌──────────────────────────────────────┐
│ ขั้นที่ 5 จาก 5 · ตรวจดูอีกที           │
│ …the summary card, FROZEN, unchanged…│
│ ┌──────────────────────────────────┐ │
│ │        ยืนยันการจอง               │ │ ← aria-disabled, keeps focus
│ └──────────────────────────────────┘ │
│ กำลังยืนยันการจอง…                    │ ← role="status" aria-live="polite"
│ แก้วัน  แก้จำนวนคืน  …                 │ ← every control disabled
└──────────────────────────────────────┘
│ [ พิมพ์อะไรก็ได้                 ] ▶ │ ← composer, STILL LIVE
```

**The rows stay on screen, unchanged.** The camper must be able to see what is being written
while it is being written. Nothing is skeletonised: there is no incoming layout to mirror, only
a wait (`loading.md` §1, the same reasoning that made round 1's re-check a text line).

**A text line, not a spinner.** `กำลังยืนยันการจอง…` in `text-xs text-foreground/70`, wrapped in
`role="status" aria-live="polite"`, rendered directly below the button. This satisfies
`loading.md`'s "user action → immediate local feedback on the control" with **zero animation** —
CAM-627 removed added motion from this panel, `LoadingSpinner` is `animate-spin`, and a chat's
own idiom for "working" is words. Round 1's `checking` line is the pattern; this is the same
shape with a different string. The wait is short and bounded: the write is one Serializable
transaction with at most three 50/100/150ms retries (`app/api/bookings/route.ts:264-270`), well
inside the 10s threshold that would demand a progress bar.

> **⚠ Critical — the confirm button takes `aria-disabled="true"`, not `disabled`.** It is the
> element that has focus at the instant of the tap. Setting the `disabled` attribute on a focused
> button drops focus to `<body>`, stranding a keyboard camper mid-write with nothing to read the
> status line from. `aria-disabled` plus an `onClick` guard keeps the focus, keeps the accessible
> name, and still refuses the second press. The control row's ghost buttons take the real
> `disabled` — none of them holds focus at that moment.

**Every control is disabled for the duration.** `แก้วัน`, `แก้จำนวนคืน`, `แก้จำนวนคน`,
`แก้จุดกางเต็นท์`, `ยกเลิกการจอง` — rewinding or cancelling a request already in flight would
promise something the client cannot deliver. `ยกเลิกการจอง` returns the moment the outcome does.

**The composer stays live, and that rule survives round 2.** CAM-637 §4 rule E is binding: the
textarea is never disabled by the booking flow. A turn typed during `submitting` goes to the
assistant as an ordinary question; the write continues and its outcome appends as a new block
when it lands. Disabling the composer to protect a one-second write would break the panel's core
promise for the one second the camper is most likely to want to ask something.

---

## §7 State `booked`

```text
┌──────────────────────────────────────┐
│ [CheckCircle2] จองสำเร็จแล้ว           │ ← heading, tabIndex={-1}, focus lands here
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ ลาน               ภูชี้ฟ้า         │ │
│ │ วันเข้าพัก        ส. 2 ส.ค. พัก 2 คืน│ │
│ │ จำนวนคน           2 คน            │ │
│ │ จุดกางเต็นท์        ริมน้ำ A         │ │
│ │ ──────────────────────────────── │ │
│ │ ยอดรวม                   ฿1,000  │ │ ← the SERVER-recorded total
│ │ คุณจะยังไม่ถูกเรียกเก็บเงิน          │ │
│ │ ลานจะยืนยันการจองอีกครั้ง            │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │      ดูรายละเอียดการจอง            │ │ → /bookings/{id}/confirmation
│ └──────────────────────────────────┘ │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │      ดูการจองทั้งหมด               │ │ → /bookings
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**It mirrors the confirmation page's information, in the chat's grammar.** Same container as the
summary card — `rounded-2xl border border-ai-tint/60 bg-muted/20 p-4`, the panel's inset grammar.
Deliberately **not** `Card`: `Card` is `rounded-3xl` and raised, and a raised card inside the
panel's glass is the card-on-card `DESIGN.md` §5 names as slop. The confirmation *page* uses
`Card` because it is a page; this is a block in a log.

**`ยอดรวม`, flat, and the label change is the point.** The value is the `totalPrice` the server
recorded on the created row — computed by `computeBookingPrice` including the camp's frozen
`snapshotExtraFeeAmount` (`app/api/bookings/route.ts:217-247`). It is not a preview, so it does
not carry `โดยประมาณ`, and the estimate note does not repeat here: repeating "the real amount is
confirmed later" beside the recorded amount would contradict it.

**`คุณจะยังไม่ถูกเรียกเก็บเงิน` stays, and it stays true.** The row is created `PENDING`
(`route.ts:232`); no payment is taken anywhere in this flow.

**One line the plan did not name, and why it is not optional.** The booking is `PENDING` — the
host still confirms it. A block that says `จองสำเร็จแล้ว` and shows a settled-looking total with
nothing else would read as *confirmed and done*. The confirmation page solves this with a status
badge (`bookings.statusPending` → `รอยืนยัน`); the chat solves it with one caption in the
assistant's own voice, `ลานจะยืนยันการจองอีกครั้ง`, which says the same thing without a status
enum. `notChargedYet` covers the money; this covers the commitment. One added key, flagged in
§13.1.

**The success mark.** A single lucide `CheckCircle2` at `size-4`, `text-success`, `aria-hidden`,
inline before the heading. It carries the outcome, which is information, not chrome — and it is
the same mark the confirmation page uses, so the two surfaces agree. `--success` is a standard
token and standard tokens remain available inside the §2.1 exception (the exception *adds* the
`--ai-*` set; it removes nothing). Colour is never the only signal: the heading states the
outcome in words. **Contrast of `--success` on `bg-muted/20` over `bg-ai-surface`: not measured.**
The build measures it against the 3:1 non-text floor in both themes and reports, or drops the
mark. No confetti, no animation, no `motion-safe:` anything.

**Two actions, one primary.** `ดูรายละเอียดการจอง` (`default`, `size="lg"`, `w-full`) →
`/bookings/{id}/confirmation`, the exact destination the camp page redirects to on its own
success (`CampgroundDetailClient.tsx:645`). `ดูการจองทั้งหมด` (`outline`, `size="lg"`, `w-full`)
→ `/bookings`. Both are `<Link>` inside `<Button asChild>` — the round-1 handoff idiom. No
loading state on either: the destination route owns its own (`loading.md` §1).

**No booking code, no QR — and the plan's stated reason was wrong.** The plan said none exists.
A QR indeed does not. **A booking reference does**: `formatBookingRef` (`lib/booking-ref.ts`)
renders `CAMP-A1B2C3D4` from the booking id, and the confirmation page shows it prominently under
`bookings.bookingRefLabel` (`รหัสการจอง`). It is deliberately **not** repeated in the chat, for a
real reason rather than a false one: **one receipt surface.** A reference is the thing a camper
screenshots and quotes to a host; a chat block scrolls away into a log. Printing the reference
here would invite the camper to treat the disappearing block as the receipt, when the durable
copy is one tap away behind the primary button. See §14 — this is one row if the owner disagrees.

**The flow ends here.** No control row, no cancel: a written booking is cancelled at `/bookings`,
not in the chat. The conversation continues normally.

---

## §8 State `bookingFailed`, and the 409 rewind

### The classification rule — read this before the table

> **Anything we cannot prove did not write is `uncertain`.**

A failure is only ever reported as a failure when the response *proves* no row was created —
`429` (refused before the handler), `401` (refused before the handler), `409` (the transaction
rolled back), `400`/`404` (rejected at validation). Everything else — a dropped connection, a
timeout, a `5xx`, an unparseable body — is `uncertain`, because the transaction may have
committed before the answer was lost. Telling a camper "จองไม่สำเร็จ" over a booking that exists
is worse than admitting we do not know: they book again, and now there are two.

### The shapes

These are the only failures in this flow that get an `ErrorBanner`, and that is exactly
`form-patterns.md`'s rule: a server error after a submit. The banner renders **above** the
summary block, which stays on screen with its rows intact.

| # | trigger | copy | actions |
|---|---|---|---|
| **F1 · rateLimited** | `429` (20 writes / 60s per user, `route.ts:296-301`) | `failed.rateLimited` | none new. The summary's own `ยืนยันการจอง` is re-enabled; waiting and pressing it again is the whole recovery |
| **F2 · uncertain** | network drop · timeout · `5xx` · unparseable body | `failed.uncertain` | primary `failed.checkAndRetry` · secondary `failed.viewMyBookings` → `/bookings` |
| **F3 · sessionExpired** | `401` mid-flight | `sessionExpired` | the confirm button reverts to `loginToConfirm`; tapping it opens `LoginModal` |
| **F4 · pitch gone** | `400 Invalid spotId` | reuses `spot.occupied` | rewinds to `spot` and re-offers (§4). No banner: nothing failed, a pitch was taken |
| **F5 · camp gone** | `404` | reuses `handedToAssistant` | the flow ends quietly and the turn goes to the assistant |
| **F6 · dates gone** | `409` | reuses `justFilled` | the rewind, below. No banner |

F4, F5 and F6 add **zero** new copy — each one already has a true sentence in the flow's
vocabulary. Only the three that genuinely have nothing to say get new strings.

### F2 in detail — the one action that must not be a plain retry

> **⚠ Critical.** `ตรวจสอบแล้วลองใหม่` must **check before it writes**. A blind re-POST after an
> uncertain outcome is exactly how one camper ends up with two bookings for one weekend, and the
> `429` limit of 20/minute will not stop it. The button's contract: look for a booking matching
> this camper, camp and span; if one exists, render the `booked` card for it; only if none exists,
> submit. How that check is implemented — a lookup endpoint, an idempotency key on the write, or
> something better — is the **architect's** contract (`tech.md`), not this brief's. What this
> brief fixes is that the camper is never offered a button that can double-book them.

The copy carries the same promise so the button is not a leap of faith:
`เรายังไม่แน่ใจว่าการจองบันทึกไปหรือยัง กดตรวจสอบก่อนได้เลย จะได้ไม่จองซ้ำ`. It states the
uncertainty, names the action, and gives the reason. It never says the word "failed".

`ดูการจองของฉัน` exists beside it because some campers will trust their own eyes over any button,
and `/bookings` is the honest place to look.

### F3 in detail — sessionExpired

The camper was signed in when the summary rendered and is not signed in when the write lands
(session expired, or signed out in another tab). The banner reads
`คุณออกจากระบบไปแล้ว เข้าสู่ระบบอีกครั้งแล้วกดยืนยันได้เลย` — plain, and it names the two steps.
The confirm button reverts to `loginToConfirm`, so the recovery path is the §5 gate, unchanged.
**Nothing auto-submits after the re-login**, for the same reason as §5.

### F6 in detail — the 409 rewind

A `409` means the dates went while the camper was deciding. Reuse `justFilled` verbatim —
`ขอโทษที {date} เพิ่งเต็มไปเมื่อกี้ ลองวันอื่นดูไหม`, dormant since round 1 and written for exactly
this. The block is an ordinary `date` step block, not a banner: nothing failed, the world changed.

**Which answers survive the rewind** follows round 1's principle — *the camper never re-answers
something still true*:

| slot | after the 409 | why |
|---|---|---|
| `checkIn` / `checkOut` | **cleared** | this is the answer that became false |
| `nights` | **kept** | "we want 2 nights" is still true of a different weekend |
| `guests` | **kept** | unchanged by the date |
| `spot` | **cleared** | pitch availability is span-specific; a kept pitch would be an unchecked claim |

`currentStep(slots)` then derives back to `date`, and once a new day is picked it derives
straight past `nights` and `guests` to `spot` (or `summary`). The plan said "guests kept"; this
is that instruction with the same rule applied to the two slots the plan's shorthand did not
name — an extension, not a contradiction.

---

## §9 States (8) — every new interactive element

Round 1's four elements are unchanged and are not restated. Four new ones ship here; the
`nights` and `spot` chips inherit round 1's **B** column verbatim (`Button outline size="sm"
h-11 rounded-full`, all eight states), and the two new controls `แก้จำนวนคืน` / `แก้จุดกางเต็นท์`
inherit its **C** column verbatim.

| | **F** confirm / login-to-confirm | **G** `ดูรายละเอียดการจอง` | **H** `ดูการจองทั้งหมด` | **I** `ตรวจสอบแล้วลองใหม่` |
|---|---|---|---|---|
| **default** | `Button default size="lg" w-full` | `Button default size="lg" w-full` (`asChild` + `Link`) | `Button outline size="lg" w-full` (`asChild` + `Link`) | `Button default size="sm" h-11 rounded-full` |
| **hover** | `hover:bg-primary/80` (primitive) | `hover:bg-primary/80` | `hover:bg-muted hover:text-foreground` | `hover:bg-primary/80` |
| **focus** | `focus-visible:ring-3 ring-ring/30` + `focus-visible:border-ring` (primitive, visible) | same | same | same |
| **active** | primitive press only — **no class added by this design** | same | same | same |
| **loading** | **`aria-disabled="true"`** + the `role="status"` text line below (§6). Never `disabled` (focus), never a spinner (CAM-627) | **none** — it is a `<Link>`; the destination route owns its loader | none, same reason | same as F: `aria-disabled` + the status line, reusing `submitting` copy |
| **error** | F1/F2/F3 render an `ErrorBanner` **above** the block; the button itself returns to `default` (F1) or to the `loginToConfirm` label (F3) | none — navigation failure is the browser's | none | if the check itself fails, it stays on F2 and the banner text is unchanged. **It never escalates to "failed"** |
| **empty** | n/a — `summary` only exists once every slot is filled | n/a | n/a | n/a |
| **disabled** | **two distinct cases.** In-flight → `aria-disabled` (keeps focus). Superseded block (`isCurrent === false`) → real `disabled`, out of the tab order (§5) | never | never | while its own check is in flight |

**Empty states that are real elsewhere in round 2:** `spot` with no offerable pitch (§4,
`empty--ai-chat-booking-no-spots`). The `nights` row is never empty by construction; the `date`
empty state is round 1's, unchanged.

---

## §10 Focus per transition

Round 1's rule holds and extends: **after any transition that replaces the interactive row, focus
moves to the new block's caption** (`tabIndex={-1}`), never to a chip — focusing a chip skips the
assistant's question and visually pre-selects an answer.

| transition | focus lands on |
|---|---|
| chip tap advances any step (`date→nights`, `nights→guests`, `guests→spot`, `spot→summary`) | the new block's caption |
| typed answer advances a step | nowhere — the caret stays in the composer; the log announces (round 1, unchanged) |
| `ย้อนกลับ` / `แก้วัน` / `แก้จำนวนคืน` / `แก้จำนวนคน` / `แก้จุดกางเต็นท์` | the returned-to block's caption |
| guest taps `เข้าสู่ระบบเพื่อยืนยันการจอง` | into `LoginModal` (the `Dialog` primitive traps it) |
| `LoginModal` closes, signed in | **back on the same button**, which now reads `ยืนยันการจอง`. The camper taps it |
| `LoginModal` closes, dismissed | back on the same button, label unchanged |
| member taps `ยืนยันการจอง` → `submitting` | **stays on the button** (`aria-disabled`, §6). The status line announces beneath it |
| `submitting` → `booked` | the success **heading** (`tabIndex={-1}`). Not the primary link: the camper hears the outcome before the next action |
| `submitting` → F1 / F2 / F3 | the **`ErrorBanner`** (`tabIndex={-1}`). Tab from there walks banner → actions → controls |
| `submitting` → F4 (pitch gone) | the new `spot` block's caption |
| `submitting` → F6 (409 rewind) | the new `date` block's caption |
| `submitting` → F5 (camp gone) | the composer — the conversation is the way forward again |
| `ยกเลิกการจอง` | the composer (round 1, unchanged) |

**One deliberate divergence from round 1, stated so it is not read as drift.** CAM-637 §7 sent
E3's focus to the `ลองใหม่` button because that block had exactly one possible action. Round 2's
submit failures have zero (F1), one (F3) or two (F2) actions depending on the flavour, so naming
a button would mean a different landing per flavour. The banner is the one element present in all
three, it carries the reason, and Tab from it reaches whatever actions exist. E3 itself is
unchanged.

---

## §11 Components, tokens, test ids

### Components — all existing, none invented

| element | component | note |
|---|---|---|
| confirm, success links, check-retry | `components/ui/button.tsx` | `default` / `outline`; `size="lg"` and `size="sm"` + `h-11` |
| the new chip rows (`nights`, `spot`) | `components/ai-chat/ChatChipRow.tsx` | the round-1 extraction, unchanged — new `dataStep` values only |
| F1/F2/F3 banners | `components/ui/error-banner.tsx` | unchanged; brings its own `AlertCircle` |
| the login gate | `components/LoginModal.tsx` | lazily imported, `subtitle` prop, exactly as `InfiniteScrollGrid.tsx:37-41` |
| success + summary containers | none — `div` with the panel's inset grammar | **not** `Card` (card-on-card, §7) |
| navigation out of the success card | `next/link` via `<Button asChild>` | the round-1 handoff idiom |

Icons: **lucide-react only** (`DESIGN.md` §7). This design specifies exactly **one**:
`CheckCircle2` on the success heading (§7). No icon on any caption, chip, control or banner
(`ErrorBanner` supplies its own).

### Tokens — nothing new

| use | token |
|---|---|
| confirm + success primary fill | `--primary` / `--primary-foreground` |
| success secondary, chips, controls | `--background` / `--muted` on hover; boundary `--border` |
| summary + success container | `border-ai-tint/60` + `bg-muted/20` |
| divider before the total | `border-border/60` |
| captions, labels, status line, type-hints | `text-foreground/70` (7.41:1 light / 8.69:1 dark on `--ai-surface`, CAM-541) |
| assistant sentences, row values, totals | `--foreground` |
| the success mark | `--success` — **contrast on this composite not measured** (§7) |
| F1/F2/F3 banners | `--destructive`, via `ErrorBanner` |
| focus ring | `--ring` (`ring-ring/30`, primitive) |
| radius | chips/controls/buttons `rounded-full` · summary + success card `rounded-2xl` |

**New tokens: none. `app/globals.css`: untouched. `DESIGN.md`: §2.1 inventory only (§15).**

### Motion — none added, round 1's two prohibitions restated

- **No `ENTRANCE_MOTION_CLASS`** on any new block. Every neighbouring row in
  `AiChatMessageList.tsx` carries one; a build agent copying the adjacent row will inherit it.
  **Do not.** (Critical.)
- **No `motion-safe:active:scale-95`** className on any new chip or control.
- No success animation of any kind: no confetti, no check-mark draw, no pulse. CAM-627 removed
  added motion from this panel and a celebratory exception would reintroduce it at the single
  most tempting moment.

### `data-testid` — keyed to the element, step in a sibling attribute

Round 1's contract is unchanged: the step id lives in `data-step`, never inside the testid
string, so every id keeps the `<type>--<module>-<detail>` grammar (`DESIGN.md` §6).

| `data-testid` | element | extra attributes |
|---|---|---|
| `btn--ai-chat-booking-confirm` | the confirm / login-to-confirm button (one control, two labels) | `data-auth="guest\|member"` |
| `status--ai-chat-booking-submitting` | the `role="status"` line during the write | — |
| `block--ai-chat-booking-success` | the success card (`role="group"`) | — |
| `text--ai-chat-booking-success-title` | `จองสำเร็จแล้ว` heading, `tabIndex={-1}` | — |
| `row--ai-chat-booking-success-line` | one success row | `data-field="camp\|dates\|guests\|spot\|total"` |
| `btn--ai-chat-booking-view-confirmation` | `ดูรายละเอียดการจอง` | — |
| `btn--ai-chat-booking-view-bookings` | `ดูการจองทั้งหมด` | — |
| `error--ai-chat-booking-failed` | the F1/F2/F3 banner, `tabIndex={-1}` | `data-reason="rateLimited\|uncertain\|sessionExpired"` |
| `btn--ai-chat-booking-check-retry` | `ตรวจสอบแล้วลองใหม่` | — |
| `btn--ai-chat-booking-view-my-bookings` | `ดูการจองของฉัน` (F2 secondary) | — |
| `empty--ai-chat-booking-no-spots` | the `spot` empty state sentence | — |

**Round-1 ids that gain values, and gain nothing else:**

| id | what is new |
|---|---|
| `msg--ai-chat-booking-step` | `data-step` also takes `nights` and `spot` |
| `text--ai-chat-booking-step-caption` | same, plus `{total}` is now per-camp (§2) |
| `group--ai-chat-booking-chips` · `btn--ai-chat-booking-chip` | same two new `data-step` values; `data-value` = the night count or the pitch id |
| `btn--ai-chat-booking-edit` | `data-step` also takes `nights` and `spot` |
| `row--ai-chat-booking-summary-line` | `data-field` also takes `spot` |

---

## §12 a11y — WCAG 2.1 AA

**Structure.** Every new block is `role="group"` + `aria-label`, matching round 1. The success
card is `role="group"` + `aria-label={success.label}`. Decorative `·` separators are
`aria-hidden="true"`. The success mark is `aria-hidden="true"`; its meaning is in the heading.

**Live regions — still exactly one at a time.** The log's existing
`role="log" aria-live="polite" aria-relevant="additions"` announces every new block for free,
including the success and failure blocks. Round 2 adds **one** region, and only because it
changes in place rather than being appended: `status--ai-chat-booking-submitting`
(`role="status" aria-live="polite"`). **Do not add a second live region for the outcome** — the
outcome block is an addition and is already announced.

**Focus.** Every transition in §10 has a named destination. The two rules that carry real weight:
the in-flight confirm button uses `aria-disabled` so focus survives the write (§6), and the
superseded confirm uses real `disabled` so a keyboard camper cannot tab back into a stale write
(§5).

> **Important — a pre-existing ARIA violation the success card must not copy.**
> `AiChatBookingStep.SummaryRow` renders `role="row"` inside a `role="group"`
> (`AiChatBookingStep.tsx:246`). `row` requires a `rowgroup` / `table` / `grid` / `treegrid`
> ancestor; without one, axe's `aria-required-parent` flags it, and this component renders today
> via CAM-639. The success rows must ship **without** `role="row"` — a label/value pair reads
> correctly as plain text — and the same attribute should be dropped from the summary rows in the
> same PR. Round 1 required "axe clean on the panel"; this is what that check would have caught.

**Contrast — measured, inherited, and honestly labelled.**

| pair | measured | source |
|---|---|---|
| `text-foreground/70` on `--ai-surface` | 7.41:1 light / 8.69:1 dark | CAM-541 |
| `--primary-foreground` on `--primary` fill | 5.17:1 light / 7.23:1 dark | CAM-532 |
| all other token pairs used | pinned by `npm run check:contrast` (54 enforced pairs) | `DESIGN.md` §8.11 |
| `--success` mark on `bg-muted/20` over `bg-ai-surface` | **not measured** | build measures against the 3:1 non-text floor, both themes, or drops the mark |
| `bg-muted/20` behind row values | **not measured** (a composite over the glass; round 1 left the same note) | build measures or swaps to bare `bg-muted` |

**Remaining checklist.**

- **Tap ≥44px everywhere.** Chips and controls `h-11` even at `size="sm"`; confirm and the two
  success links are `size="lg"` (`h-11` mobile, `md:h-12`).
- **Mobile-first, one scale.** The panel is a bounded reading column at every viewport, so the
  flow is specified once at mobile width (round 1's §"narrow column" reasoning, unchanged). The
  only value that steps is `size="lg"`'s height, inside the primitive.
- **Colour is never the only signal.** Success, pending, every failure flavour, the pitch price
  and the night count are all stated in words.
- **`tabular-nums`** on every count, date, night count and price.
- **Keyboard.** Fully operable; no trap. `LoginModal` traps deliberately and returns focus, which
  is a `Dialog` doing its job. The flow binds no key; Esc remains the detail card's.
- **axe clean** on the panel at each of the five steps plus `submitting`, `booked`, and all three
  failure flavours, before handoff — including the `role="row"` finding above.

---

## §13 Copy — TH + EN, `locales/translations.json`

Voice check, re-run: น้องกองไฟ speaks first-person `เรา`, friendly, and uses **no `ครับ` / `ค่ะ`
particles anywhere**. Every string below matches. **No em-dash (`—`) in any Thai value. No
technical jargon. No emoji.**

### §13.1 New keys — 35 (every row has TH **and** EN; zero em-dashes in any Thai value)

| key | TH | EN |
|---|---|---|
| `aiChat.booking.confirm` | `ยืนยันการจอง` | `Confirm booking` |
| `aiChat.booking.loginToConfirm` | `เข้าสู่ระบบเพื่อยืนยันการจอง` | `Sign in to confirm booking` |
| `aiChat.booking.loginPrompt` | `เข้าสู่ระบบก่อน จะได้จองให้เสร็จในแชทนี้เลย` | `Sign in first and you can finish booking right here in the chat.` |
| `aiChat.booking.sessionExpired` | `คุณออกจากระบบไปแล้ว เข้าสู่ระบบอีกครั้งแล้วกดยืนยันได้เลย` | `You've been signed out. Sign in again, then confirm.` |
| `aiChat.booking.submitting` | `กำลังยืนยันการจอง…` | `Confirming your booking…` |
| `aiChat.booking.stepName.nights` | `จำนวนคืน` | `Nights` |
| `aiChat.booking.stepName.spot` | `เลือกจุดกางเต็นท์` | `Choose a pitch` |
| `aiChat.booking.editNights` | `แก้จำนวนคืน` | `Change nights` |
| `aiChat.booking.editSpot` | `แก้จุดกางเต็นท์` | `Change pitch` |
| `aiChat.booking.nights.ask` | `{date} นะ ไปกันกี่คืนดี` | `{date} it is. How many nights?` |
| `aiChat.booking.nights.chipsLabel` | `จำนวนคืน` | `Number of nights` |
| `aiChat.booking.nights.chip` | `{count} คืน` | `{count} nights` |
| `aiChat.booking.nights.typeHint` | `อยากพักนานกว่านี้ พิมพ์จำนวนคืนมาได้เลย` | `Staying longer? Just type the number of nights.` |
| `aiChat.booking.nights.unreadable` | `ยังจับจำนวนคืนไม่ได้เลย บอกเป็นตัวเลขได้ เช่น 2 คืน` | `I didn't catch a number of nights. Tell me like "2 nights".` |
| `aiChat.booking.nights.overRun` | `{date} ว่างต่อเนื่อง {count} คืน เลือกเท่านี้ก่อน หรือกดแก้วันไปหาช่วงที่ยาวกว่านี้` | `{date} has {count} nights open in a row. Take those, or change the date to find a longer stretch.` |
| `aiChat.booking.nights.tooLong` | `จองได้สูงสุด {max} คืนต่อครั้ง ลองบอกจำนวนที่น้อยกว่านี้` | `You can book up to {max} nights at a time. Try a smaller number.` |
| `aiChat.booking.spot.ask` | `เลือกจุดกางเต็นท์ที่ชอบได้เลย` | `Pick the pitch you like.` |
| `aiChat.booking.spot.chipsLabel` | `จุดกางเต็นท์ที่ยังว่าง` | `Pitches still open` |
| `aiChat.booking.spot.chip` | `{name} คืนละ {price}` | `{name}, {price} per night` |
| `aiChat.booking.spot.typeHint` | `อยากได้จุดอื่น พิมพ์ชื่อจุดมาได้เลย` | `Want a different pitch? Just type its name.` |
| `aiChat.booking.spot.unreadable` | `ยังจับชื่อจุดไม่ได้เลย ลองเลือกจากที่มีให้ด้านบน` | `I didn't catch that pitch name. Try picking one from the list above.` |
| `aiChat.booking.spot.occupied` | `{name} เพิ่งถูกจองไปเมื่อกี้ เลือกจุดอื่นได้เลย` | `{name} was taken just now. Pick another pitch.` |
| `aiChat.booking.spot.empty` | `ช่วงวันนั้นยังไม่มีจุดที่ว่างและรับได้ทั้งกลุ่ม ลองแก้วันหรือจำนวนคนดูไหม` | `No pitch is open and big enough for your group on those dates. Want to change the dates or the group size?` |
| `aiChat.booking.summary.spotRow` | `จุดกางเต็นท์` | `Pitch` |
| `aiChat.booking.summary.introConfirm` | `ตรวจดูอีกทีนะ ถ้าโอเคแล้วกดยืนยันได้เลย` | `Have a look. If it's right, go ahead and confirm.` |
| `aiChat.booking.success.title` | `จองสำเร็จแล้ว` | `Booking confirmed` |
| `aiChat.booking.success.label` | `สรุปการจองที่สำเร็จแล้ว` | `Your completed booking` |
| `aiChat.booking.success.totalRow` | `ยอดรวม` | `Total` |
| `aiChat.booking.success.pendingNote` | `ลานจะยืนยันการจองอีกครั้ง` | `The camp will confirm your booking.` |
| `aiChat.booking.success.viewBooking` | `ดูรายละเอียดการจอง` | `View booking details` |
| `aiChat.booking.success.viewAll` | `ดูการจองทั้งหมด` | `View all bookings` |
| `aiChat.booking.failed.rateLimited` | `กดจองถี่เกินไป รอสักครู่แล้วกดยืนยันอีกที` | `That's a lot of booking attempts in a row. Wait a moment, then confirm again.` |
| `aiChat.booking.failed.uncertain` | `เรายังไม่แน่ใจว่าการจองบันทึกไปหรือยัง กดตรวจสอบก่อนได้เลย จะได้ไม่จองซ้ำ` | `I'm not sure yet whether the booking went through. Check first so you don't book twice.` |
| `aiChat.booking.failed.checkAndRetry` | `ตรวจสอบแล้วลองใหม่` | `Check, then try again` |
| `aiChat.booking.failed.viewMyBookings` | `ดูการจองของฉัน` | `See my bookings` |

> **Count note.** The plan estimated ~16. Two of its bullets (`nights.*`, `spot.*`) are step
> *groups*: round 1 needed 7 keys per step (ask · chipsLabel · chip · typeHint · unreadable ·
> stepName · edit control) plus a bound message, and round 2 adds two whole steps. The list above
> is the honest expansion of the plan's own scope, not extra design.
>
> **Two named deviations from the plan's key list, both recorded rather than silent:**
> 1. The plan's `summary.pickPitch` is authored here as **`summary.spotRow`**. Its four siblings
>    are `campRow` / `datesRow` / `guestsRow` / `totalRow`; `pickPitch` names an action for a
>    key that is a row label. Copy and behaviour are identical.
> 2. **`success.pendingNote` is added** beyond the plan's list — see §7. A success block showing a
>    settled-looking total with no "the camp still has to confirm" line misrepresents a `PENDING`
>    booking.

### §13.2 Changed keys — 2 (existing keys whose value is now wrong)

| key | was | becomes | why |
|---|---|---|---|
| `aiChat.booking.summary.datesValue` | TH `{date} พัก 1 คืน` · EN `{date}, 1 night` | TH `{date} พัก {nights} คืน` · EN `{date}, {nights} nights` | the flow now asks for nights. Round 1 wrote this change into its own §3 |
| `aiChat.booking.summary.estimateNote` | TH `ค่าธรรมเนียมของลานยังไม่รวมในนี้ ดูยอดเต็มได้ที่หน้าจอง` · EN `The camp's own fees aren't included here. See the full amount at the booking page.` | TH `ยอดนี้คำนวณจากข้อมูลล่าสุดที่เราเห็น ยอดจริงจะยืนยันอีกทีตอนจองสำเร็จ` · EN `This is worked out from the latest information I have. The real amount is confirmed when the booking goes through.` | **both halves were wrong.** The chat *does* carry `extraFeeAmount` (§5), and "the booking page" is a destination this flow no longer offers |

### §13.3 Keys deliberately REUSED — add nothing for these

| need | existing key | value |
|---|---|---|
| the 409 rewind sentence | `aiChat.booking.justFilled` | `ขอโทษที {date} เพิ่งเต็มไปเมื่อกี้ ลองวันอื่นดูไหม` |
| a `400 Invalid spotId` from the write | `aiChat.booking.spot.occupied` | see §13.1 |
| a `404` camp-gone exit | `aiChat.booking.handedToAssistant` | `โอเค พักเรื่องจองไว้ก่อน เดี๋ยวเราตอบเรื่องนี้ให้` |
| the not-charged reassurance | `booking.notChargedYet` | `คุณจะยังไม่ถูกเรียกเก็บเงิน` |
| the caption template | `aiChat.booking.stepCaption` | `ขั้นที่ {current} จาก {total}` — text unchanged, `{total}` now per-camp |
| the ฿ value format | none — the existing `THB_FORMAT` | — |

**Why `success.viewAll` is a new key even though `bookings.viewAllBookings` already says
`ดูการจองทั้งหมด`.** Round 1 set the rule when it refused to share `aiChat.detail.back`: a shared
**fact** may be reused across surfaces, a shared **control label** may not, because a future
reword of the bookings page would silently change a chat button. `notChargedYet` is a fact and is
reused; this is a control label and is not.

### §13.4 Keys retired by round 2 — remove in the build PR

| key | why it is now unread |
|---|---|
| `aiChat.booking.handoff` (`ไปกรอกต่อที่หน้าจอง`) | the handoff CTA is removed (§0) |
| `aiChat.booking.summary.intro` | superseded by `summary.introConfirm` |

Leaving a key nothing reads is drift in the copy glossary the same way dead code is drift in a
module. Delete both in the PR that lands the confirm.

---

## §14 Handoffs, dependencies and flagged findings

**To the architect (blocking, not this brief's to answer):**

1. **Critical.** The `spot` step has no data. `get-camp-detail.ts` exposes neither `useSpotView`
   nor a pitch list. Required: a per-camp per-pitch flag, and per pitch `name`, per-night price,
   `maxCampers`, and availability **for the chosen span**. §4.
2. **Critical.** `ตรวจสอบแล้วลองใหม่` must check before it writes. The mechanism — a lookup, an
   idempotency key, or better — is the architect's; the requirement is that no camper is offered
   a button that can double-book them. §8.

**To Frontend (Critical build notes, each one a defect if ignored):**

3. The caption's `{total}` must be this camp's step count, not `BOOKING_STEPS.length`. §2.
4. The in-flight confirm button takes `aria-disabled`, never `disabled`. §6.
5. A superseded summary (`isCurrent === false`) renders its confirm and controls **`disabled`**,
   out of the tab order. §5.
6. Nothing auto-submits after a login or a re-login. §5, §8.
7. No entrance-motion class, no `active:scale-95`, no success animation on any new block. §11.

**To Frontend (Important):**

8. Drop `role="row"` from `SummaryRow` and do not repeat it in the success rows — an orphan
   `role="row"` is an axe `aria-required-parent` violation that ships today. §12.
9. Delete the two retired copy keys in the same PR. §13.4.
10. Measure `--success` on the success card's composite background in both themes, or drop the
    mark. §7, §12.

**Open for the owner (Suggestion, one row either way):**

11. **The success card carries no booking reference, and the plan's stated reason was factually
    wrong.** `formatBookingRef` exists and the confirmation page shows `CAMP-XXXXXXXX` under
    `รหัสการจอง`. This design still omits it, for the "one receipt surface" reason in §7. If the
    owner would rather the reference appear the moment the booking lands, it is one more
    `row--ai-chat-booking-success-line` with `data-field="ref"` and the existing
    `bookings.bookingRefLabel` — no new copy, no new pattern.

**Pre-existing, named so it is not rediscovered as new (Info):** superseded blocks keep their
chips tappable (`conversation.ts:127-134` revises only `isCurrent`). Harmless in round 1, and out
of this dispatch's surface. §5.

---

## §15 `DESIGN.md` change — the §2.1 inventory correction

The §2.1 scope list names six `components/ai-chat/*` files. Four more exist and belong there.
This is not housekeeping: **`AiChatBookingStep.tsx` already uses `border-ai-tint/60`
(`:157`) while sitting outside §2.1's named scope**, so today the shipped code uses the sanctioned
exception without being sanctioned by it. The edit makes the code legal, and it removes the same
latent problem for the three siblings.

| file | why it belongs in the scope list |
|---|---|
| `AiChatBookingStep` | uses `border-ai-tint/60` today (CAM-638) |
| `ChatChipRow` | the chip row shared by the booking flow and the existing suggestion chips (CAM-638) |
| `AiChatLauncher` | the launcher FAB — §2.1 item 6 already refers to it by name in its own prose while omitting it from the scope list |
| `AiChatCardCarousel` | the card carousel inside the panel, on `--ai-*` surfaces |

Nothing else in `DESIGN.md` changes: no token, no scale, no component contract, no gate item.

---

## Links

`../../../in-chat-guided-booking/CAM-637-design-brief/design.md` (round 1, inherited in full) ·
`DESIGN.md` (§2 tokens · §2.0 mobile scale · §2.1 assistant exception · §3 components ·
§5 anti-slop · §6 gate · §7 icons) · `.claude/rules/loading.md` · `.claude/rules/ux.md` ·
`components/ui/form-patterns.md` · `components/ai-chat/AiChatBookingStep.tsx` ·
`lib/validations/booking.ts` · `app/api/bookings/route.ts` ·
`app/bookings/[id]/confirmation/BookingConfirmationClient.tsx`

## Changelog
- v1 (2026-08-06) — created
