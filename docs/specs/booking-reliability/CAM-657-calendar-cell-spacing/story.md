---
ticket: CAM-657
epic: CAM-395
status: In Progress
version: 2
---

## Story
As a **Camper**, I want the picked date and today's date to sit inside their own cell with visible space around them, so that I can tell at a glance which single day I chose instead of reading one unbroken row of touching circles.

Why: the owner reported it from the camp booking page on staging — *"ปรับ UI ตอนกด แล้ว Active ที่บริเวณวันนี้ให้ดูบาลานซ์ ตอนนี้ระยะห่างชิดขอบ"*. The date picker is shared by four surfaces, so the imbalance shows up on every one of them.

Scope: geometry only inside `components/ui/calendar.tsx` — the relationship between the column pitch, the day control, and the selected/today shape. The numeral, the font and the grid structure are untouched, and no consumer changes.
Depends on: CAM-533 (the one-shape-language rule this story must not break) · blocks nothing, but CAM-658 switches the camper booking page to `mode="range"` immediately after, so range must be correct here.

**Measured before the fix** (component rendered in Chromium against the real compiled `app/globals.css`, not reasoned): the day cell was 44×44px and the day control was 44×44px at the *same* x/y — the control filled its cell edge-to-edge. A picked day therefore had **0px of air left and right**, against **8px above and below** (the `mt-2` between week rows). That asymmetry is the "ไม่บาลานซ์" the owner saw. `--radius-full` was checked first and resolves correctly today (`calc(infinity * 1px)`, `app/globals.css`), so this is a geometry defect, not a repeat of the CAM-533 undefined-token defect.

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The date picker is open on the camp booking page | The camper taps a date | The teal circle on that date has an even gap on all four sides between the circle and the edge of its own cell, and does not touch the circle of the day beside it | Selected date unchanged; layout only | EC-1 |
| AC-2 | The date picker is open in any month containing today | The camper looks at today without picking it | The thin ring marking today has the same even gap on all four sides and does not touch its neighbours | No state change | EC-2 |
| AC-3 | A date range with at least one day between check-in and check-out is selected | The camper looks at the selected range | The band runs unbroken from the check-in circle to the check-out circle, with no gap between consecutive days | No state change | EC-3 |
| AC-4 | The picker is in range mode | The camper taps check-in and has not yet tapped check-out | That single day shows the same circle, with the same gap, as a single pick | Range holds one date | EC-4 |
| AC-5 | Any state above | The camper hovers or presses a day | Nothing fades, slides or animates | No animation utility ships | AC-1 |
| AC-6 | The camper is on a 360px-wide phone | The camper opens the date picker | The picker panel keeps a visible margin from both edges of the screen instead of sitting flush against them | No state change | EC-6 |

## Rules
- BR-1 The column pitch and the day control are two separate values. Pitch = 48px; control = 44px. The 4px difference centres the control with 2px of air per side. (proves AC-1, AC-2)
- BR-2 The day control is never smaller than 44px at any viewport — the touch floor in `DESIGN.md` §2.0 outranks compaction, so breathing room comes from growing the pitch, never from shrinking the control. (proves AC-1)
- BR-3 Cells stay edge-to-edge with no gap between them; the three range states take the whole cell, which is what keeps the band unbroken. (proves AC-3)
- BR-4 A range whose start and end are the same day has no band to connect, so it returns to the inset 44px control. (proves AC-4)
- BR-5 The cell owns pitch and centring (layout); the day control owns radius and fill. Neither declares the other's property — CAM-533's ownership rule carries forward unchanged. (proves AC-1, AC-3)
- BR-6 No transition or animation utility is added, per CAM-627 (the owner's machine ran hot). (proves AC-5)
- BR-7 One month is at most 352px wide (`7 × pitch + 2 × root padding`), leaving at least 8px of margin on a 360px phone. Every consumer portals the calendar into a popover that is `w-auto p-0`, so the calendar's intrinsic width is the popover width. (proves AC-6)

## Edge cases
- EC-1 IF the pitch is ever set equal to the control size THEN the control fills its cell again and the reported defect returns; the guard test fails on the pitch-minus-control arithmetic. (BR-1)
- EC-2 IF today is also the selected day THEN the today ring retires and the selection shape is shown, with the same 2px of air. (BR-1, BR-5)
- EC-3 IF a range wraps across a week boundary THEN the row-end edges stay flat and the 8px between week rows reads as "continues on the next row", exactly as before this change. (BR-3)
- EC-4 IF only check-in is picked in range mode THEN the day renders as the inset circle, not as a full-cell round cap. (BR-4)
- EC-5 IF the day control were dropped below 44px to make room THEN the touch floor is broken; the guard test fails. (BR-2)
- EC-6 IF the pitch is raised again without re-checking the width budget THEN the panel eats the 8px phone margin; the guard test fails on the 352px ceiling. (BR-7)

## Data
- None. No entity, field, query or copy is touched · migration: none

## Seams & refs
- Reuse: `components/ui/calendar.tsx` is the single owner of day geometry. Grep-inventory of every consumer, all unchanged by this story:
  - **Direct importers (3):** `components/CampgroundDetailClient.tsx` (single, ×2 popovers — where the report came from) · `components/SearchModal.tsx` (single, ×2 popovers) · `components/ui/date-range-picker.tsx` (range, `numberOfMonths={2}`).
  - **Indirect via `DatePickerWithRange` (3):** `components/host-holds-section.tsx` · `app/dashboard/campsites/[id]/availability/page.tsx` · `app/dashboard/bookings/page.tsx`.
  - **NOT a consumer:** `components/availability-calendar.tsx` is a separate hand-rolled month grid and does not read this primitive; `app/dashboard/bookings/page.tsx` also imports a lucide icon named `Calendar`, which is unrelated.
  - All six mount it inside `PopoverContent className="w-auto p-0"`, so the calendar's intrinsic width is the popover width in every case. No parallel geometry exists in any of them.
- Refs: CAM-533 (shape ownership) · CAM-627 (no motion) · `DESIGN.md` §2.0 (44px touch floor), §Radius (calendar day = `--radius-full`)

## Out of scope
- Switching the camper booking page to `mode="range"` → CAM-658
- The 8px between week rows (`mt-2`) is unchanged.
- The calendar's outer padding moved `p-3` → `p-2` as part of this story (BR-7), not as a separate change: growing the pitch pushed a month to 360px, which would have parked the whole panel flush against both edges of a 360px phone. Owner ruling, 2026-07-29: resolving the crowding inside the cell and then crowding the panel against the screen edge moves the problem rather than removing it.

## Self-verify
- AC-1..AC-4 → structural pins in `__tests__/cam-657-calendar-cell-spacing.test.ts` + pixel geometry measured in Chromium against the real compiled stylesheet; final visual sign-off is owner-verify (browser-only)
- AC-5 → unit (no `transition-` / `animate-` in the file)
- Story-specific: guard teeth proven once — restoring the old pitch turns the arithmetic assertion red (`expected +0 to be 4`)
- Gate = /quality-gate · Done = every AC verified on the real Staging URL

## Changelog

- v1 (2026-07-29) — created
- v2 (2026-07-29) — owner ruling: outer padding `p-3` → `p-2` so a month is 352px and keeps 8px of margin on a 360px phone. Added AC-6 / BR-7 / EC-6 (width budget) and corrected the consumer inventory (6 consumers, 3 direct + 3 via `DatePickerWithRange`; `availability-calendar.tsx` is not one).
