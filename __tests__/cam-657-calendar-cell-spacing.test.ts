// @vitest-environment jsdom
/**
 * cam-657-calendar-cell-spacing.test.ts — CAM-657
 *
 * Scoped to jsdom via the top-of-file pragma ONLY for this file (the repo default
 * vitest environment stays `node`, see vitest.config.ts) — same pattern as
 * __tests__/cam-533-calendar-shape.test.ts.
 *
 * Bug (owner report, 2026-07-29, staging booking page): "ปรับ UI ตอนกด แล้ว Active
 * ที่บริเวณวันนี้ให้ดูบาลานซ์ ตอนนี้ระยะห่างชิดขอบ" — the circle on the picked day and on
 * today crowds the cell boundary.
 *
 * Root cause (MEASURED in Chromium against the real compiled app/globals.css, not
 * reasoned): `--cell-size` was doing two jobs at once. The column PITCH and the day
 * CONTROL were the same 44px number, so the control filled its cell edge-to-edge —
 * 0px of air left/right, against 8px of air above/below coming from the `mt-2`
 * between weeks. Nothing was broken about the radius token: `--radius-full` resolves
 * correctly today (calc(infinity * 1px), pinned by CAM-533), so this was pure
 * geometry, not the CAM-533 undefined-token class of defect.
 *
 * Fix: split the two numbers. `--cell-size` (48px) is the pitch; `--day-size` (44px,
 * the DESIGN.md §2.0 touch floor) is the control. The control centres in its cell
 * with 2px of air on all four sides. The three RANGE states take the full cell back
 * so the band stays unbroken between consecutive days.
 *
 * NOTE ON WHAT THIS FILE PROVES: these are STRUCTURAL pins (source inspection +
 * rendered classNames), not visual proof. They pin the relationship that was settled
 * — pitch minus control = 4px, control = the 44px floor, range states span the cell —
 * so a later edit cannot silently collapse the two numbers back together. The pixel
 * geometry itself was verified separately by rendering the component in Chromium
 * against the real compiled stylesheet; the numbers below are that measurement
 * written down.
 *
 * Coverage:
 *   BR-1  the root declares BOTH sizes, and the arithmetic between them is the 2px
 *         inset the owner asked for.
 *   BR-2  the day control never drops below the 44px touch floor (DESIGN.md §2.0).
 *   BR-3  the day BUTTON sizes from --day-size and no longer stretches to the cell.
 *   BR-4  all three range states span the full cell, so the band has no gaps; a
 *         one-day range returns to the inset control.
 *   BR-5  the CELL owns pitch + centring (layout) and still declares no radius and
 *         no fill — CAM-533's ownership rule survives this change.
 *   AC-5  no motion is introduced (CAM-627: the owner's machine ran hot).
 */
import fs from "node:fs";
import path from "node:path";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Calendar } from "@/components/ui/calendar";

const root = path.resolve(__dirname, "..");
const CALENDAR = fs.readFileSync(
  path.join(root, "components/ui/calendar.tsx"),
  "utf-8"
);
const GLOBALS = fs.readFileSync(path.join(root, "app/globals.css"), "utf-8");

/** Tailwind v4's spacing base. Asserted below rather than assumed. */
const SPACING_BASE_PX = 4;

/** Read `[--name:--spacing(N)]` off the calendar root and return N * 4 in px. */
function sizeTokenPx(name: string): number {
  const m = CALENDAR.match(
    new RegExp(`\\[${name}:--spacing\\((\\d+(?:\\.\\d+)?)\\)\\]`)
  );
  if (!m) throw new Error(`${name} is not declared as a --spacing() step`);
  return Number(m[1]) * SPACING_BASE_PX;
}

const d = (iso: string) => new Date(`${iso}T00:00:00`);

afterEach(cleanup);

describe("CAM-657 · BR-1/BR-2 the pitch and the control are two different numbers", () => {
  it("keeps Tailwind's default spacing base, so the --spacing() steps below really are 4px each", () => {
    // A `--spacing` override in globals.css would silently rescale every number in
    // this file, so the arithmetic is only meaningful while this holds.
    expect(GLOBALS).not.toMatch(/^\s*--spacing\s*:/m);
  });

  it("declares both --cell-size and --day-size on the calendar root", () => {
    expect(CALENDAR).toMatch(/\[--cell-size:--spacing\(\d+\)\]/);
    expect(CALENDAR).toMatch(/\[--day-size:--spacing\(\d+\)\]/);
  });

  it("leaves exactly 2px of air on every side of the day control", () => {
    const cell = sizeTokenPx("--cell-size");
    const day = sizeTokenPx("--day-size");

    // This is THE relationship the owner reported against. Before the fix both
    // numbers were 44 and the difference was 0 — the control hugged the boundary.
    expect(cell - day).toBe(4); // 4px total → 2px per side, control centred
    expect(cell).toBe(48);
    expect(day).toBe(44);
  });

  it("never lets the day control fall under the 44px touch floor", () => {
    // DESIGN.md §2.0: 44px at every viewport, and it outranks compaction. Breathing
    // room has to come from growing the pitch, never from shrinking the control.
    expect(sizeTokenPx("--day-size")).toBeGreaterThanOrEqual(44);
  });

  it("keeps the whole month inside a 360px phone, with margin to spare", () => {
    // Every consumer portals this into a `PopoverContent` that is `w-auto p-0`, so
    // the calendar's intrinsic width IS the popover width. A month is 7 columns plus
    // the root padding on both sides. 360px is the most common small-Android width,
    // and the owner's report was about crowding against an edge — so the panel has
    // to keep real margin there, not merely avoid overflowing.
    const padStep = CALENDAR.match(/group\/calendar bg-background p-(\d+)/);
    expect(padStep, "the calendar root must declare its own padding step").toBeTruthy();
    const rootPadPx = Number(padStep![1]) * SPACING_BASE_PX;

    const monthWidth = 7 * sizeTokenPx("--cell-size") + 2 * rootPadPx;
    expect(monthWidth).toBe(352);
    expect(360 - monthWidth).toBeGreaterThanOrEqual(8);
  });

  it("keeps the month arrows on the control size, not the wider pitch", () => {
    expect(CALENDAR).toContain('"size-(--day-size) p-0 select-none');
    expect(CALENDAR).not.toContain("size-(--cell-size) p-0 select-none");
  });
});

describe("CAM-657 · BR-3/BR-4 the control is inset, the band is not", () => {
  const dayButton = (container: HTMLElement, selector: string) =>
    container.querySelector(selector) as HTMLElement | null;

  it("sizes the day button from --day-size instead of stretching it to the cell", () => {
    const { container } = render(
      React.createElement(Calendar, {
        mode: "single",
        selected: d("2026-08-12"),
        defaultMonth: d("2026-08-01"),
        onSelect: () => {},
      })
    );

    const picked = dayButton(container, 'button[data-selected-single="true"]');
    expect(picked).toBeTruthy();
    expect(picked!.className).toContain("size-(--day-size)");
    // the two utilities that made the control fill its cell are gone for good
    expect(picked!.className).not.toMatch(/(^|\s)w-full(\s|$)/);
    expect(picked!.className).not.toContain("min-w-(--cell-size)");
  });

  it("spans the full cell on every range state, so the band has no gaps", () => {
    const { container } = render(
      React.createElement(Calendar, {
        mode: "range",
        selected: { from: d("2026-08-10"), to: d("2026-08-14") },
        defaultMonth: d("2026-08-01"),
        onSelect: () => {},
      })
    );

    for (const sel of [
      'button[data-range-start="true"]',
      'button[data-range-middle="true"]',
      'button[data-range-end="true"]',
    ]) {
      const el = dayButton(container, sel);
      expect(el, sel).toBeTruthy();
      // an inset middle would read as a dashed band between consecutive days
      expect(el!.className).toContain("data-[range-start=true]:size-full");
      expect(el!.className).toContain("data-[range-middle=true]:size-full");
      expect(el!.className).toContain("data-[range-end=true]:size-full");
    }
  });

  it("returns a one-day range to the inset control, the state a camper sits in after picking check-in", () => {
    const { container } = render(
      React.createElement(Calendar, {
        mode: "range",
        selected: { from: d("2026-08-10"), to: d("2026-08-10") },
        defaultMonth: d("2026-08-01"),
        onSelect: () => {},
      })
    );

    const both = dayButton(
      container,
      'button[data-range-start="true"][data-range-end="true"]'
    );
    expect(both).toBeTruthy();
    // two attribute selectors outrank the single-attribute `size-full` rules, so a
    // day with no band to connect goes back to the 44px circle with air round it
    expect(both!.className).toContain(
      "data-[range-start=true]:data-[range-end=true]:size-(--day-size)"
    );
  });
});

describe("CAM-657 · BR-5 the cell still owns layout only", () => {
  it("holds the pitch and centres the control without declaring radius or fill", () => {
    const { container } = render(
      React.createElement(Calendar, {
        mode: "range",
        selected: { from: d("2026-08-10"), to: d("2026-08-14") },
        defaultMonth: d("2026-08-01"),
        onSelect: () => {},
      })
    );

    const cells = [...container.querySelectorAll("td")];
    expect(cells.length).toBeGreaterThan(0);

    for (const cell of cells) {
      // pitch + centring live here: that is layout, and layout is the cell's job
      expect(cell.className).toContain("min-w-(--cell-size)");
      expect(cell.className).toContain("items-center");
      expect(cell.className).toContain("justify-center");
      // …and CAM-533's rule survives: no radius, no selection fill on this layer
      expect(cell.className).not.toMatch(/(^|\s|:)rounded-/);
      expect(cell.className).not.toMatch(/(^|\s|:)bg-/);
    }
  });
});

describe("CAM-657 · AC-5 no motion sneaks in", () => {
  it("adds no transition or animation utility to the calendar", () => {
    // CAM-627 stripped chat animation because the owner's machine ran hot; the day
    // grid repaints on every hover, so it is the last place motion belongs.
    expect(CALENDAR).not.toMatch(/\btransition-/);
    expect(CALENDAR).not.toMatch(/\banimate-/);
  });
});
