---
artifact: story
feature: platform-hardening
epic: taxonomy-ui-foundation
story: CAM-533
title: Date picker uses one selection shape language
status: In Progress
class: spec-lite
version: v1
updated: 2026-07-26
---

<!--
G1 class: SPEC-LITE. Qualifies: no schema/migration · no API contract · single component
surface (components/ui/calendar.tsx) + its design-system home (app/globals.css, DESIGN.md) ·
expected diff <= ~200 lines. G1 folds into the G3 packet.
G2 class: DESIGNER-AUTHORED (not standard class) — this story defines a NEW token
(--radius-full) and a NEW DESIGN.md spec section (calendar selection states), so it routes
through the designer per the plan's Design-gate note.
Provenance: owner report on the live SearchModal, 2026-07-26 — "ตอนนี้ state ในการเลือกเดี๋ยวก็
เป็นวงกลม เดี๋ยวก็เป็นสี่เหลี่ยม เดี๋ยวก็เป็นครึ่งวงกลม. งงไปหมด."
-->

## Story
As a **Camper** picking check-in and check-out dates (and a **Host** picking a range on the
dashboard), I want every day in the date picker to use ONE selection shape language, so that
I can tell at a glance which day is picked, which days are in between, and which day is today,
instead of reading a mix of circles, squares, and half-circles.
Why: the shapes are not a style preference here, they are the only signal the picker gives.
The mix is a real defect, not drift: `components/ui/calendar.tsx` sets the day radius from
`--radius-full`, a custom property that is **defined nowhere in the repo**, so every
`rounded-(--cell-radius)` declaration is invalid at computed-value time and each element
falls back to a different shape.
Scope: `components/ui/calendar.tsx` (CSS classes only, no logic or prop changes), the missing
radius token in `app/globals.css`, and the missing calendar selection-state spec in `DESIGN.md`.
Both `mode="single"` (booking check-in/out) and `mode="range"` (dashboard) mount this one
component, so both must read coherently.
Depends on: —

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The check-in picker is open in single-date mode | The camper taps a day | That day becomes a filled teal **full circle** with a white number; every other day keeps its plain round shape with no fill | Picker selection state only, nothing is written | EC-1 |
| AC-2 | The dashboard range picker is open and a range of 3 or more days is chosen | The host looks at the chosen range | The first day is a filled teal shape rounded on its **outer** edge and flat on its inner edge; the days between form ONE continuous grey band with flat edges; the last day is a filled teal shape rounded on its **outer** edge and flat on its inner edge | Picker selection state only, nothing is written | EC-2 |
| AC-3 | Any month is shown and today is not selected | The camper looks at today | Today shows a thin outline ring in the **same round shape** as every other day, never a filled square | None | EC-3 |
| AC-4 | Today is inside the chosen range or is the chosen single day | The camper selects today | Today takes the selection shape for that position (full circle, or a range end rounded on its outer edge) and the today ring disappears; today never turns into a square | Picker selection state only | AC-3 |
| AC-5 | The picker is open | The camper moves focus onto a day with the keyboard | A visible focus ring appears around that day and the day's shape does not change | None | EC-4 |

## Rules
- BR-1 The day control's fully-round radius comes from ONE token, `--radius-full`, defined in
  `app/globals.css` inside `:root` (value `calc(infinity * 1px)`, identical to Tailwind's own
  `rounded-full`). It must NOT live only inside `@theme inline`: a `@theme inline` entry is not
  emitted as a runtime CSS variable, so `var(--radius-full)` would still resolve to nothing and
  the defect would survive the "fix" (verified by compiling Tailwind 4.1.18, see `design.md`).
  (proves AC-1..AC-5)
- BR-2 Exactly ONE layer declares the day's radius: the day **button** (`CalendarDayButton`).
  The grid **cell** (the DayPicker `classNames` layer) declares no radius at all. (proves AC-1..AC-4)
- BR-3 Shape per state, all read from `--cell-radius` (which reads `--radius-full`):
  single-selected = all four corners round · range start = outer (left) corners round, inner
  corners flat · range middle = all corners flat · range end = outer (right) corners round,
  inner corners flat · a range whose start and end are the same day = all four corners round.
  (proves AC-1, AC-2, EC-2)
- BR-4 Today's marker is a 1px ring in `--muted-foreground`, shown only while that day is not
  selected. Measured contrast against `--background`: 4.61:1 light, 8.07:1 dark, both above the
  3:1 floor for a non-text indicator. `--primary` was measured and rejected at 2.62:1 in dark.
  (proves AC-3, AC-4)
- BR-5 The focus ring stays the existing `ring-ring` treatment on the day button and is never
  replaced by the today ring; today uses `border`, focus uses `ring`, so the two never compete
  for the same CSS property. (proves AC-5)
- BR-6 No new user-facing copy is introduced, so no `locales/` key changes.

## Edge cases
- EC-1 IF a day is disabled THEN it renders muted at 50% opacity, keeps the same round shape as
  every other day, and does not respond to a tap. (BR-3)
- EC-2 IF the chosen range starts and ends on the same day THEN that day renders as ONE full
  circle, never two fighting half-rounds. (BR-3)
- EC-3 IF a day belongs to the previous or next month THEN it renders in muted text with the
  same round shape as the current month's days. (BR-3)
- EC-4 IF a range spans a week boundary THEN the band's row-end edges stay flat, so the range
  reads as continuing onto the next row. (BR-2, BR-3)

## Data
- None. No entity, field, or migration is touched. migration: none

## Seams & refs
- Reuse: `components/ui/calendar.tsx` is the single owner of day-cell shape; its three consumers
  (`components/SearchModal.tsx` ×2 single, `components/CampgroundDetailClient.tsx` ×2 single,
  `components/ui/date-range-picker.tsx` ×1 range) pass no `classNames` override, so fixing this
  one file fixes every surface. Grep-verified 2026-07-26: no other caller and no other definition
  or consumer of `--radius-full` exists in the repo. · Refs: —

## Out of scope
- Re-wiring booking check-in/out from two `mode="single"` pickers to one `mode="range"` → separate
  story, already listed as a follow-up in the epic plan.
- `components/availability-calendar.tsx` (a 4th, hand-rolled calendar style on the host dashboard)
  → separate surface, separate story.
- Changing the range band's fill token (`--muted`, measured 1.11:1 against `--background` in light)
  → recorded as an Info finding in `design.md`; `--muted` is used app-wide and changing it is not
  in this AC.

## Self-verify
- AC-1..AC-5, EC-1..EC-4 → unit (`__tests__/cam-533-calendar-shape.test.ts`: a real Tailwind 4
  compile proving the token resolves, plus jsdom renders of both modes asserting the state→class
  map and that the cell layer carries zero radius)
- Story-specific: `--radius-full` is defined in an emitted `:root` block, not only in
  `@theme inline` · no `rounded-(--…)` reference in `calendar.tsx` points at an undefined custom
  property · `data-[selected=true]:rounded-none` on `today` is gone
- Gate = /quality-gate (`npm run lint` · `npm run typecheck` · `npm test` · `npm run check:ds` ·
  `npm run check:palette`; `next build` verified by CI) · Done = AC verified on localhost (dev DB)
  before merge into `dev`

## Changelog
- v1 (2026-07-26) — created
