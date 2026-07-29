"use client"

import * as React from "react"
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
  type Locale,
} from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  locale,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        // CAM-657 — SIZE OWNERSHIP: the grid PITCH and the day CONTROL are two
        // different numbers, and conflating them is what made a picked day hug its
        // cell edge (measured before the fix: a 44px control inside a 44px cell =
        // 0px of air left/right, against 8px of air above/below from the `mt-2`
        // between weeks).
        //   --cell-size (48px) = the pitch of one column. Cells stay edge-to-edge,
        //     which is what lets a range band run unbroken across a week.
        //   --day-size  (44px) = the day control itself. 44px is the touch floor
        //     (DESIGN.md §2.0) and never steps down, so the breathing room has to
        //     come from growing the pitch, never from shrinking the control.
        // The 4px difference centres the control with 2px of air on all four sides.
        //
        // `p-2` (was `p-3`): every consumer portals this into a `PopoverContent`
        // that is `w-auto p-0`, so the calendar's own intrinsic width IS the popover
        // width. Widening the pitch to 48px pushed that to 360px, which would sit
        // flush against both edges of a 360px phone — the report was about crowding
        // against an edge, so resolving it inside the cell and then parking the whole
        // panel on the viewport edge would move the crowding, not remove it. Trading
        // 4px of outer padding keeps 8px of margin on the most common small-Android
        // width. The air moves from the panel edge to around each day, which is where
        // the owner asked for it.
        "group/calendar bg-background p-2 [--cell-radius:var(--radius-full)] [--cell-size:--spacing(12)] [--day-size:--spacing(11)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      locale={locale}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString(locale?.code, { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 md:flex-row",
          defaultClassNames.months
        ),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        // CAM-657 — the nav sits in the same 48px band as the caption and centres a
        // 44px control inside it, so the month arrows keep the icon-button token
        // (`--day-size` = 44px, DESIGN.md §2.0 icon button) instead of inheriting
        // the wider column pitch.
        nav: cn(
          "absolute inset-x-0 top-0 flex h-(--cell-size) w-full items-center justify-between gap-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--day-size) p-0 select-none aria-disabled:opacity-50",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--day-size) p-0 select-none aria-disabled:opacity-50",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "relative rounded-(--cell-radius)",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "absolute inset-0 bg-popover opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "font-medium select-none",
          captionLayout === "label"
            ? "text-sm"
            : "flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
          defaultClassNames.caption_label
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 rounded-(--cell-radius) text-[0.8rem] font-normal text-muted-foreground select-none",
          defaultClassNames.weekday
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn(
          "w-(--cell-size) select-none",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "text-[0.8rem] text-muted-foreground select-none",
          defaultClassNames.week_number
        ),
        // CAM-533 — SHAPE OWNERSHIP: the day CELL owns layout only. Every radius and
        // every selection fill is declared exactly once, on the day BUTTON
        // (`CalendarDayButton` below). Two layers declaring the same shape is what
        // produced the circle / square / half-circle mix the owner reported.
        // CAM-657 — the cell holds the 48px column pitch and CENTRES its control;
        // centring is layout, so it belongs here. It still declares no radius and no
        // fill: those stay the button's, exactly as CAM-533 settled.
        day: cn(
          "group/day relative flex aspect-square h-full w-full min-w-(--cell-size) items-center justify-center p-0 text-center select-none",
          defaultClassNames.day
        ),
        // The range states below span the full cell (`size-full` on the button), so the
        // band is continuous without any cell-level background or bleed pseudo-element.
        range_start: defaultClassNames.range_start,
        range_middle: defaultClassNames.range_middle,
        range_end: defaultClassNames.range_end,
        // Today = a thin ring in the SAME round shape as every other day (never a
        // filled square). It is drawn on the button's border — focus uses `ring`, so
        // the two markers can never compete for one CSS property. `:not([data-selected])`
        // retires the ring the moment the day is picked, so "today while selected"
        // simply reads as the selection.
        today: cn(
          "[&:not([data-selected])>button]:border [&:not([data-selected])>button]:border-muted-foreground",
          defaultClassNames.today
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeft className={cn("size-4", className)} {...props} />
            )
          }

          if (orientation === "right") {
            return (
              <ChevronRight className={cn("size-4", className)} {...props} />
            )
          }

          return (
            <ChevronDown className={cn("size-4", className)} {...props} />
          )
        },
        DayButton: ({ ...props }) => (
          <CalendarDayButton locale={locale} {...props} />
        ),
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString(locale?.code)}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        // CAM-657 — the day control is `--day-size` (44px, the touch floor), centred by
        // its cell, so a picked day and a today ring carry 2px of air on all four sides
        // instead of butting against the cell boundary.
        "relative isolate z-10 flex aspect-square size-(--day-size) flex-col gap-1 border-0 leading-none font-normal",
        // …but the three RANGE states take the whole 48px cell back. Cells are
        // edge-to-edge, so a full-cell button is what keeps the band unbroken between
        // consecutive days; an inset middle would read as a dashed band. The cost is
        // deliberate and named: a range endpoint is a 48px round cap while a single
        // pick is a 44px circle, and the two never appear on the same calendar
        // (`data-selected-single` is false whenever any range modifier is set).
        "data-[range-start=true]:size-full data-[range-middle=true]:size-full data-[range-end=true]:size-full",
        // A one-day range (start AND end on the same day) has no band to connect, so it
        // goes back to the inset 44px circle and reads identically to a single pick.
        // This is the state a camper sits in after tapping check-in and before tapping
        // check-out, so it is the one they look at longest. Two attribute selectors
        // outrank the single-attribute `size-full` rules above, the same specificity
        // mechanism CAM-533 used to keep this day fully round.
        "data-[range-start=true]:data-[range-end=true]:size-(--day-size)",
        // CAM-533 — the ONE place a day's radius is declared. All four values read
        // `--cell-radius` (= `--radius-full`, app/globals.css), so a day is never a
        // stray px value. Endpoints round their OUTER edge and stay flat on the inner
        // edge so they close the band; the middle is flat on both sides so the band
        // connects. The compound start+end rule carries two attribute selectors, so it
        // outranks the two single-attribute rules and a one-day range stays a full
        // circle instead of two half-rounds fighting.
        "rounded-(--cell-radius)",
        "data-[range-start=true]:rounded-l-(--cell-radius) data-[range-start=true]:rounded-r-none",
        "data-[range-middle=true]:rounded-none",
        "data-[range-end=true]:rounded-r-(--cell-radius) data-[range-end=true]:rounded-l-none",
        "data-[range-start=true]:data-[range-end=true]:rounded-(--cell-radius)",
        // Fill: endpoints and a single pick are solid primary; the middle is the muted
        // band. Selection is carried by fill + shape together, never by colour alone.
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground",
        "data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground",
        "data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground",
        "data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground",
        // Focus ring — `ring`, never `border` (today owns the border).
        "group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50",
        "dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
