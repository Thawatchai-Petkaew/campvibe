---
linear: CAM-533
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: CAMPER
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-07-26
---
# Design — Date picker uses one selection shape language (CAM-533)

## User job

A camper picking check-in / check-out dates (and a host picking a range on the dashboard) must
be able to read, at a glance, **which day is picked, which days are in between, and which day is
today**. The shape IS the signal here, so a mix of shapes is a broken signal, not a style nit.

**Flow:** open a date field → the `Popover` opens `Calendar` → tap a day (single) or a start then
an end day (range) → the picked days read as one coherent shape system → close.

No screen, route, prop, or copy changes. This is a shape/token repair inside one primitive.

## Root cause (re-confirmed before designing, not taken on trust)

`components/ui/calendar.tsx:34` sets `[--cell-radius:var(--radius-full)]`. **`--radius-full` was
defined nowhere in the repo** — grep across `*.css`/`*.ts`/`*.tsx`/`*.mjs` returned exactly ONE hit,
the consumer itself. `app/globals.css` defined only `--radius-sm … --radius-4xl`, and Tailwind v4 has
no `--radius-full` theme key (`rounded-full` is a built-in static utility, `border-radius: calc(infinity * 1px)`).

A `var()` on an undefined custom property makes the whole declaration **invalid at computed-value
time**, so `border-radius` fell back to its initial value (`0`) wherever the dropped rule won the
cascade, and to whatever else was on the element (the shadcn Button base `rounded-full`) where it
did not. Longhand corners (`rounded-l-*` / `rounded-r-*`) collapsed independently. That is precisely
the reported "เดี๋ยวก็เป็นวงกลม เดี๋ยวก็เป็นสี่เหลี่ยม เดี๋ยวก็เป็นครึ่งวงกลม".

Second fault, layered on top: the radii were declared **twice** — once on the DayPicker cell layer
and once on the day button — and the two fought (the button set `rounded-(--cell-radius)` on all
four corners AND `rounded-l-(--cell-radius)`, contradicting itself for a range start).

## Decision 1 — where the token lives, and why (this is the load-bearing call)

**Chosen: define `--radius-full: calc(infinity * 1px)` in `app/globals.css` inside `:root`.**

The dispatch offered "add it to `@theme inline`" as one option. **That option does not work**, and it
is worth recording because it looks correct. Compiling Tailwind 4.1.18 (the installed version) both
ways, with the same declaration:

| declaration site | emitted as a runtime CSS variable? | `var(--radius-full)` resolves? |
|---|---|---|
| `@theme inline { --radius-full: … }` | **no** | **no — defect survives** |
| `:root { --radius-full: … }` | yes | yes |

`@theme inline` inlines the value into the utilities it generates and does not emit the variable, so
the "fix" would have looked applied and changed nothing. `:root` also matches the existing house
pattern in this file (`--radius: 0.625rem` is a raw `:root` value that `@theme inline` reads).

Rejected alternatives:

- **A fallback in the component** (`var(--radius-full, calc(infinity * 1px))`) — patches one consumer
  and leaves the token still undefined for the next one. The hole is what shipped the bug.
- **Adding `--radius-full` to `@theme` to also generate a utility** — it would redefine the app-wide
  `rounded-full` utility (buttons, inputs, chips, every icon-button) for zero benefit: the compile
  shows Tailwind's built-in `rounded-full` is already `calc(infinity * 1px)`, byte-identical. Not
  worth the blast radius.

Radius is theme-invariant, so there is deliberately **no `.dark` twin** (same as `--radius`). A
comment at the declaration states the `@theme inline` trap so nobody "tidies" it back into the theme
block and silently re-breaks the picker.

## Decision 2 — one owner for the range band: the BUTTON

The **day button** (`CalendarDayButton`) owns every radius and every selection fill. The **cell**
layer (DayPicker `classNames`) owns layout only and declares **zero radius**.

Why the button and not the cell: the button is the actual control the user hovers, focuses, and taps;
it already carries every state as a data attribute (`data-selected-single`, `data-range-start/middle/end`);
and it spans the full cell (`w-full` inside an `aspect-square` `<td>`, no gaps between cells), so a band
painted on the button is continuous with no cell background and no bleed pseudo-element.

Removed from the cell layer as part of this: `bg-muted` + the `after:` bleed strips on `range_start` /
`range_end`, the `rounded-none` on `range_middle`, the base `rounded-(--cell-radius)` on `day`, and the
first/last-child row-edge rounding hacks. **No visual regression from dropping the row-edge rounding** —
those rules read the same undefined token, so they already rendered flat; flat row ends read as "the
range continues on the next row", which is truthful.

## States (all 8 + the calendar-specific ones)

| state | shape | fill / marker | token |
|---|---|---|---|
| default | full round | none | `--radius-full` via `--cell-radius` |
| hover | full round (unchanged) | `bg-muted` (ghost variant) | `--muted` |
| focus | full round (unchanged) | visible `ring-[3px]` + `border-ring` | `--ring` |
| active | full round (unchanged) | press scale from the Button base | — |
| disabled | full round (unchanged) | `text-muted-foreground opacity-50`, no pointer events | `--muted-foreground` |
| loading | n/a — the picker renders from local state, it has no async dependency | — | — |
| empty | n/a — a month grid is never empty; "no selection" IS the default state | — | — |
| error | n/a in this primitive — an invalid range surfaces on the field, per `form-patterns.md` | — | — |
| single selected | full round | `bg-primary` + `text-primary-foreground` | `--primary` |
| range start | outer (left) round, inner flat | `bg-primary` + `text-primary-foreground` | `--primary` |
| range middle | flat both edges | `bg-muted` + `text-foreground` | `--muted` |
| range end | outer (right) round, inner flat | `bg-primary` + `text-primary-foreground` | `--primary` |
| range of one day (start = end) | full round | `bg-primary` | `--primary` |
| today, not selected | full round + 1px ring on the control | `border-muted-foreground` | `--muted-foreground` |
| today, selected | the selection shape for its position; today ring retires | per selection state | — |
| outside month | full round (unchanged) | `text-muted-foreground` | `--muted-foreground` |

The `loading` / `empty` / `error` rows are marked n/a with the reason stated, rather than omitted —
`Calendar` has no async dependency, so `.claude/rules/loading.md` does not apply to it.

**Cascade determinism** (why this cannot go back to fighting):

- The base full-round rule is a bare utility (specificity 0,1,0); every range rule carries an
  attribute selector (0,2,0), so the state always wins over the default.
- A one-day range sets `data-range-start` AND `data-range-end`. Those two single-attribute rules
  would otherwise tie and resolve by source order, so a compound rule carrying **both** attributes
  (0,3,0) is declared explicitly and renders the day as one full circle.
- Today uses `border`; focus uses `ring`. Different CSS properties, so they can never override one
  another and a focused today cell keeps its visible focus ring.

## Non-goals

- Re-wiring booking check-in/out from two `mode="single"` pickers into one `mode="range"` — an
  explicit separate story in the epic plan. This story makes the shapes coherent in both modes as
  they are mounted today.
- Folding in `components/availability-calendar.tsx` (the 4th, hand-rolled calendar style).

## Alternatives considered

- **Cell owns the band, button owns only the endpoint pill** (the classic Airbnb split). Rejected:
  it needs the band's outer edge rounded on the cell as well, so radius would still be declared on
  two layers — the exact failure this story exists to end.
- **Today marked with `--primary`.** Rejected on measurement: 2.62:1 against `--background` in dark
  mode, below the 3:1 non-text floor. `--muted-foreground` passes in both themes.

## Components & tokens

- Components: `components/ui/calendar.tsx` only (`Calendar` + `CalendarDayButton`), consumed by
  `components/ui/date-range-picker.tsx`, `components/SearchModal.tsx`, `components/CampgroundDetailClient.tsx`.
  No consumer passes a `classNames` override, so this one file governs every surface. No new component.
- Tokens used: `--radius-full` (**new**, `app/globals.css` `:root`), `--primary`,
  `--primary-foreground`, `--muted`, `--muted-foreground`, `--foreground`, `--ring`. No hardcoded
  hex or px anywhere in the diff.
- `DESIGN.md`: the radius role table now names the calendar day and the token; a new
  §3 "Calendar day selection states" table is the implementable spec whose absence let this drift.

## Validation UX

None. This story adds no input, no validation rule, and no error copy. An invalid range is surfaced
by the consuming field per `components/ui/form-patterns.md`, unchanged.

## i18n

No new or changed user-facing string, so no `locales/` change. Nothing in the diff is a literal
rendered to the user.

## a11y (WCAG 2.1 AA)

- **Contrast, measured** (OKLCH → sRGB → WCAG relative luminance, both themes):
  today ring `--muted-foreground` on `--background` = **4.61:1 light / 8.07:1 dark** (non-text floor 3:1) ·
  endpoint label `--primary-foreground` on `--primary` = **5.17:1 light / 7.23:1 dark** (text floor 4.5:1) ·
  band label `--foreground` on `--muted` = **17.72:1 light / 14.25:1 dark**.
- **Focus:** the existing visible `ring-[3px] ring-ring/50` + `border-ring` on the day button is
  untouched, and by design cannot be overridden by the today marker (ring vs border).
- **Colour is not the only signal:** selection is carried by fill **and** shape; today is carried by
  a ring (a shape signal), not by hue alone.
- **Tap target:** unchanged at `--cell-size` = `--spacing(11)` = 44px minimum per day.
- **Accessible name / roles:** untouched — react-day-picker's `role="gridcell"` + `aria-selected` +
  per-day `aria-label` still come from the library. No ARIA was added or removed.
- **Not measured:** axe was not run against a rendered browser page in this dispatch (no visual
  screenshot surface for `Calendar` in `/preview`); the change is class-only and adds no new
  interactive element, and every colour pair above was measured numerically instead.

## Anti-slop criteria that must pass

- Every value from a token — no floating hex, no `rounded-[Npx]` (`check:palette` + `check:ds` green).
- One radius per role, not "every corner at 16px": the day control is the `rounded-full` role, and it
  stays that role in every state.
- No decorative extras added; the removed cell-layer bleed pseudo-elements are chrome that served
  nothing once the button spans the cell.
- Holds the CampVibe tone: teal fill on clean white, muted band, no gradient, no shadow tier added.

## Reference

shadcn/ui Calendar (the upstream this file is derived from) — <https://ui.shadcn.com/docs/components/calendar>.
Its range treatment is the endpoints-round-the-outer-edge / middle-connects convention this brief
locks in, with the ownership split and the token defined so it actually renders.

## Links

`../../../../DESIGN.md` (§2 Radius, §3 Calendar day selection states) · `story.md` (BR-1..BR-6) ·
`__tests__/cam-533-calendar-shape.test.ts`

## Changelog

- v1 (2026-07-26) — created
