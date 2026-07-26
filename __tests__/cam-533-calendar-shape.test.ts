// @vitest-environment jsdom
/**
 * cam-533-calendar-shape.test.ts — CAM-533
 *
 * Scoped to jsdom via the top-of-file pragma ONLY for this file (the repo default
 * vitest environment stays `node`, see vitest.config.ts) — same pattern as
 * __tests__/cam-496-filter-modal-hydration.test.ts.
 *
 * Bug (owner report, 2026-07-26): "ตอนนี้ state ในการเลือกเดี๋ยวก็เป็นวงกลม เดี๋ยวก็เป็น
 * สี่เหลี่ยม เดี๋ยวก็เป็นครึ่งวงกลม. งงไปหมด." — the day-selection states rendered as an
 * incoherent mix of circle / square / half-circle.
 *
 * Root cause: `components/ui/calendar.tsx` set `[--cell-radius:var(--radius-full)]`,
 * but `--radius-full` was defined NOWHERE in the repo. `var()` on an undefined
 * custom property makes every `rounded-(--cell-radius)` declaration invalid at
 * computed-value time, so each element fell back to a different shape. On top of
 * that the radii were declared twice (cell layer + button layer) and fought.
 *
 * Coverage:
 *   BR-1  --radius-full is defined in an EMITTED `:root` block, never only inside
 *         `@theme inline` (a `@theme inline` entry is inlined into utilities and is
 *         NOT emitted as a runtime variable — putting it there looks like a fix and
 *         leaves the defect in place). Proven by a real Tailwind 4 compile.
 *   BR-1  no `rounded-(--x)` / `var(--x)` in calendar.tsx points at a custom
 *         property that nothing defines (the whole bug class, not just this token).
 *   BR-2  the day CELL layer declares ZERO radius — exactly one owner (the button).
 *   BR-3  the day BUTTON carries exactly one radius per state: single = full circle ·
 *         range start = outer round + inner flat · middle = flat · range end = outer
 *         round + inner flat · one-day range = full circle.
 *   AC-3  today is marked with a ring on the day control, and the regression class
 *         `data-[selected=true]:rounded-none` (today turning square when picked) is gone.
 */
import fs from "node:fs";
import path from "node:path";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { compile } from "tailwindcss";
import { Calendar } from "@/components/ui/calendar";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const GLOBALS = src("app/globals.css");
const CALENDAR = src("components/ui/calendar.tsx");

/** Top-level `:root { … }` blocks (none of them nest braces in this file). */
const rootBlocks = () =>
  [...GLOBALS.matchAll(/(?:^|\n)\s*:root\s*\{([^}]*)\}/g)].map((m) => m[1]);
/** `@theme { … }` / `@theme inline { … }` blocks. */
const themeBlocks = () =>
  [...GLOBALS.matchAll(/@theme[^{]*\{([^}]*)\}/g)].map((m) => m[1]);

/**
 * Group a className string into `variant-prefix -> [radius utilities]`.
 * Tailwind separates variants with `:`; the arbitrary values used here
 * (`[range-start=true]`) never contain a colon, so a plain split is safe.
 */
function radiusMap(className: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const token of className.split(/\s+/).filter(Boolean)) {
    const parts = token.split(":");
    const util = parts.pop() as string;
    if (!/^rounded/.test(util)) continue;
    const key = parts.join(":");
    (out[key] ||= []).push(util);
  }
  for (const key of Object.keys(out)) out[key].sort();
  return out;
}

const d = (iso: string) => new Date(`${iso}T00:00:00`);

afterEach(cleanup);

describe("CAM-533 · BR-1 the radius token actually resolves", () => {
  it("defines --radius-full in a :root block", () => {
    expect(rootBlocks().some((b) => /--radius-full\s*:/.test(b))).toBe(true);
  });

  it("does NOT hide --radius-full inside @theme, where it would not be emitted", () => {
    expect(themeBlocks().some((b) => /--radius-full\s*:/.test(b))).toBe(false);
  });

  it("compiles to a real runtime variable that rounded-(--cell-radius) can read", async () => {
    const twDir = path.join(root, "node_modules/tailwindcss");
    const declarations = rootBlocks().find((b) => /--radius-full\s*:/.test(b)) as string;

    const compiler = await compile(`@import "tailwindcss";\n:root {${declarations}}\n`, {
      base: twDir,
      loadStylesheet: async () => ({
        path: path.join(twDir, "index.css"),
        base: twDir,
        content: fs.readFileSync(path.join(twDir, "index.css"), "utf-8"),
      }),
    });
    const out = compiler.build(["rounded-(--cell-radius)"]);

    // the token survives into the stylesheet the browser actually loads …
    expect(out).toMatch(/--radius-full:\s*calc\(infinity \* 1px\)/);
    // … and the utility that consumes it is generated, reading the variable.
    expect(out).toContain("border-radius: var(--cell-radius)");
  });

  it("leaves no custom-property reference in calendar.tsx undefined", () => {
    const reads = new Set<string>();
    for (const m of CALENDAR.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) reads.add(m[1]);
    for (const m of CALENDAR.matchAll(/[a-z-]+-\((--[a-z0-9-]+)\)/gi)) reads.add(m[1]);

    const defined = new Set<string>();
    for (const m of CALENDAR.matchAll(/\[\s*(--[a-z0-9-]+)\s*:/gi)) defined.add(m[1]);
    for (const m of GLOBALS.matchAll(/(--[a-z0-9-]+)\s*:/gi)) defined.add(m[1]);

    expect([...reads].filter((name) => !defined.has(name))).toEqual([]);
  });
});

describe("CAM-533 · BR-2/BR-3 one radius owner, one shape language", () => {
  const EXPECTED_BUTTON_SHAPE = {
    // default + single selection: a full circle
    "": ["rounded-(--cell-radius)"],
    // endpoints round their OUTER edge and stay flat on the inner edge …
    "data-[range-start=true]": ["rounded-l-(--cell-radius)", "rounded-r-none"],
    "data-[range-end=true]": ["rounded-l-none", "rounded-r-(--cell-radius)"],
    // … the middle is flat on both sides so the band connects …
    "data-[range-middle=true]": ["rounded-none"],
    // … and a one-day range (start AND end) stays a full circle.
    "data-[range-start=true]:data-[range-end=true]": ["rounded-(--cell-radius)"],
  };

  it("single mode: the picked day is a filled full circle, and no cell declares a radius", () => {
    const { container } = render(
      React.createElement(Calendar, {
        mode: "single",
        selected: d("2026-08-12"),
        defaultMonth: d("2026-08-01"),
        onSelect: () => {},
      })
    );

    const picked = container.querySelector('button[data-selected-single="true"]');
    expect(picked).toBeTruthy();
    expect(picked!.className).toContain("data-[selected-single=true]:bg-primary");
    expect(radiusMap(picked!.className)).toEqual(EXPECTED_BUTTON_SHAPE);

    // BR-2: the cell layer owns layout only — zero radius anywhere in the grid.
    for (const cell of container.querySelectorAll("td")) {
      expect(radiusMap(cell.className)).toEqual({});
    }
  });

  it("range mode: start / middle / end carry one state each, and cells stay radius-free", () => {
    const { container } = render(
      React.createElement(Calendar, {
        mode: "range",
        selected: { from: d("2026-08-10"), to: d("2026-08-14") },
        defaultMonth: d("2026-08-01"),
        onSelect: () => {},
      })
    );

    const start = container.querySelector('button[data-range-start="true"]');
    const middles = container.querySelectorAll('button[data-range-middle="true"]');
    const end = container.querySelector('button[data-range-end="true"]');

    expect(start).toBeTruthy();
    expect(end).toBeTruthy();
    expect(middles.length).toBe(3); // 11th, 12th, 13th

    // each endpoint is an endpoint only — never also a middle, never a "single"
    expect(start!.getAttribute("data-range-end")).toBe("false");
    expect(start!.getAttribute("data-selected-single")).toBe("false");
    expect(end!.getAttribute("data-range-start")).toBe("false");
    expect(middles[0].getAttribute("data-range-start")).toBe("false");
    expect(middles[0].getAttribute("data-range-end")).toBe("false");

    // the shape map is the same on every day — the state picks the branch
    expect(radiusMap(start!.className)).toEqual(EXPECTED_BUTTON_SHAPE);
    expect(radiusMap(middles[0].className)).toEqual(EXPECTED_BUTTON_SHAPE);
    expect(radiusMap(end!.className)).toEqual(EXPECTED_BUTTON_SHAPE);

    for (const cell of container.querySelectorAll("td")) {
      expect(radiusMap(cell.className)).toEqual({});
    }
  });

  it("range mode: a one-day range is a single circle, not two fighting half-rounds", () => {
    const { container } = render(
      React.createElement(Calendar, {
        mode: "range",
        selected: { from: d("2026-08-10"), to: d("2026-08-10") },
        defaultMonth: d("2026-08-01"),
        onSelect: () => {},
      })
    );

    const both = container.querySelector(
      'button[data-range-start="true"][data-range-end="true"]'
    );
    expect(both).toBeTruthy();
    expect(both!.getAttribute("data-range-middle")).toBe("false");
    // the compound rule carries two attribute selectors, so it outranks the two
    // single-attribute half-round rules and the day renders fully round.
    expect(both!.className).toContain(
      "data-[range-start=true]:data-[range-end=true]:rounded-(--cell-radius)"
    );
  });
});

describe("CAM-533 · AC-3/AC-4 today keeps the shape language", () => {
  it("marks today with a ring on the day control and never a filled square", () => {
    const today = new Date();
    const { container } = render(
      React.createElement(Calendar, {
        mode: "single",
        defaultMonth: today,
        onSelect: () => {},
      })
    );

    const todayCell = container.querySelector("td[data-today]");
    expect(todayCell).toBeTruthy();
    // ring on the button's border (focus uses `ring`, so the two never collide) …
    expect(todayCell!.className).toContain(
      "[&:not([data-selected])>button]:border-muted-foreground"
    );
    // … and no shape of its own on the cell.
    expect(radiusMap(todayCell!.className)).toEqual({});
  });

  it("retires the today ring once today is selected, instead of squaring it off", () => {
    const today = new Date();
    const { container } = render(
      React.createElement(Calendar, {
        mode: "single",
        selected: today,
        defaultMonth: today,
        onSelect: () => {},
      })
    );

    // the marker is scoped `:not([data-selected])`; this is the attribute that
    // switches it off, so it has to be present on the selected today cell.
    const todayCell = container.querySelector("td[data-today]");
    expect(todayCell).toBeTruthy();
    expect(todayCell!.hasAttribute("data-selected")).toBe(true);

    // regression: the class that turned today into a square the moment it was
    // picked is gone for good.
    expect(CALENDAR).not.toContain("data-[selected=true]:rounded-none");
  });
});
