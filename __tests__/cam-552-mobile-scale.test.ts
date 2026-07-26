/**
 * cam-552-mobile-scale.test.ts — CAM-552 "Mobile has a real compact scale,
 * including typography"
 *
 * Proves, per story.md:
 *   AC-1  the mobile step exists on the migrated surfaces (source-level)
 *   AC-2  the 44px touch floor is never stepped below (BR-2)
 *   AC-3  SearchModal's date buttons match their row's height (BR-5, CAM-542)
 *   AC-4  the guard fires on a violation AND is silent on the fixed tree —
 *         BOTH directions, for all three rules
 *   AC-5  /preview carries the Mobile scale section
 *   BR-4  seven type roles, exactly four of which step at 768px
 *
 * The pixel-level proof (rendered heights at 390x844 in a real browser) lives
 * in the PR body and design.md; these are the checks that must keep holding in
 * CI, where no browser runs.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cn } from "../lib/utils";
import {
  findFloorBreaches,
  isControlHeightViolation,
  isDisplayTypeViolation,
  runScaleGuard,
  TOUCH_FLOOR_PX,
} from "../scripts/check-scale.mjs";

const ROOT = join(__dirname, "..");
const src = (p: string) => readFileSync(join(ROOT, p), "utf8");

const globalsCss = src("app/globals.css");
const buttonSrc = src("components/ui/button.tsx");
const inputSrc = src("components/ui/input.tsx");
const chipSrc = src("components/ui/filter-chip.tsx");
const filterModalSrc = src("components/FilterModal.tsx");
const searchModalSrc = src("components/SearchModal.tsx");
const categoryBarSrc = src("components/CategoryBar.tsx");
const previewSrc = src("app/preview/PreviewClient.tsx");
const designMd = src("DESIGN.md");

// ── BR-4 — the type roles ────────────────────────────────────────────────────

describe("BR-4: seven responsive type roles, four of which step at 768px", () => {
  const ROLES = [
    "display",
    "heading-1",
    "heading-2",
    "heading-3",
    "body",
    "label",
    "caption",
  ];
  const STEPPING = ["display", "heading-1", "heading-2", "heading-3"];
  const NON_STEPPING = ["body", "label", "caption"];

  it.each(ROLES)("--type-%s is declared with a mobile value + line-height", (role) => {
    expect(globalsCss).toMatch(new RegExp(`--type-${role}:\\s*[\\d.]+rem`));
    expect(globalsCss).toMatch(new RegExp(`--type-${role}-lh:\\s*[\\d.]+rem`));
  });

  it.each(ROLES)("a `type-%s` utility exists so components pick a role, not a size", (role) => {
    expect(globalsCss).toMatch(new RegExp(`@utility\\s+type-${role}\\s*\\{`));
    expect(globalsCss).toMatch(new RegExp(`var\\(--type-${role}\\)`));
  });

  it("the desktop step lives in exactly ONE media query at 768px (one breakpoint, BR-1)", () => {
    const mediaBlocks = globalsCss.match(/@media\s*\(min-width:\s*\d+px\)/g) ?? [];
    expect(mediaBlocks).toEqual(["@media (min-width: 768px)"]);
  });

  it.each(STEPPING)("type-%s steps: it is redefined inside the 768px block", (role) => {
    const block = globalsCss.match(/@media\s*\(min-width:\s*768px\)\s*\{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    expect(block![0]).toContain(`--type-${role}:`);
  });

  it.each(NON_STEPPING)(
    "type-%s does NOT step — it is at an accessibility floor, not an oversight",
    (role) => {
      const block = globalsCss.match(/@media\s*\(min-width:\s*768px\)\s*\{[\s\S]*?\n\}/);
      expect(block![0]).not.toContain(`--type-${role}:`);
    }
  );

  it("type-body stays 1rem — under 16px iOS Safari auto-zooms a focused input", () => {
    expect(globalsCss).toMatch(/--type-body:\s*1rem/);
  });

  /**
   * Prove-It — the reason these roles are named `type-*` and not `text-*`.
   *
   * `cn()` = clsx + tailwind-merge. tailwind-merge classifies an unrecognised
   * `text-<x>` as a TEXT COLOUR, so `cn("text-label", "text-foreground")`
   * silently DROPS `text-label` and the role never reaches the DOM. That was
   * observed for real: the FilterChip pill measured 16px in the browser while
   * its source said `text-label`. A className read would never have shown it.
   *
   * If someone "tidies" these back to `text-*`, this test goes red first.
   */
  it("BUG GUARD: cn() must not swallow a role class next to a text colour", () => {
    for (const role of ROLES) {
      const merged = cn(`type-${role} transition-colors`, "text-foreground");
      expect(merged, `type-${role} was dropped by tailwind-merge`).toContain(`type-${role}`);
      expect(merged).toContain("text-foreground");
    }
  });

  it("BUG GUARD: the `text-*` spelling really is unsafe (why the rename happened)", () => {
    // Demonstrates the hazard rather than asserting it away — if a future
    // tailwind-merge learns these names, this flips and the rename can be
    // revisited deliberately instead of by accident.
    expect(cn("text-label transition-colors", "text-foreground")).not.toContain("text-label");
  });

  it("no component uses the unsafe `text-<role>` spelling", () => {
    for (const [name, source] of [
      ["filter-chip", chipSrc],
      ["FilterModal", filterModalSrc],
      ["SearchModal", searchModalSrc],
      ["CategoryBar", categoryBarSrc],
      ["preview", previewSrc],
    ] as const) {
      expect(source, name).not.toMatch(
        /\btext-(display|heading-[123]|body|label|caption)\b/
      );
    }
  });

  it("the type roles are NOT declared in @theme (that namespace would collide)", () => {
    // `^` anchored: globals.css *documents* this hazard in a comment that names
    // both `@theme` and `--text-body`, and an unanchored match would swallow it.
    const themeBlocks = globalsCss.match(/^@theme[^{]*\{[\s\S]*?\n\}/gm) ?? [];
    expect(themeBlocks.length).toBeGreaterThan(0);
    for (const block of themeBlocks) {
      expect(block).not.toMatch(/--text-(display|heading-\d|body|label|caption)\b/);
    }
  });
});

// ── BR-3 / BR-2 — control height + the touch floor ───────────────────────────

describe("BR-3: lg is the one control height that steps; the rest sit on the floor", () => {
  it("Button lg = h-11 md:h-12 (44px on a phone, 48px from md up)", () => {
    const lg = buttonSrc.match(/\blg:\s*["'`]([^"'`]*)["'`]/);
    expect(lg).not.toBeNull();
    expect(lg![1]).toMatch(/\bh-11\b/);
    expect(lg![1]).toMatch(/\bmd:h-12\b/);
  });

  it("Input inputSize lg = h-11 md:h-12", () => {
    const lg = inputSrc.match(/\blg:\s*["'`]([^"'`]*)["'`]/);
    expect(lg![1]).toMatch(/\bh-11\b/);
    expect(lg![1]).toMatch(/\bmd:h-12\b/);
  });

  it("Button md/default stays h-11 at BOTH steps — it is already the 44px floor", () => {
    // Scope to the `size:` block — `variant:` also has a `default:` key and it
    // comes first in the file.
    const sizeBlock = buttonSrc.match(/\bsize:\s*\{[\s\S]*?\n\s{6}\}/);
    expect(sizeBlock).not.toBeNull();
    const def = sizeBlock![0].match(/\bdefault:\s*\n?\s*["'`]([^"'`]*)["'`]/);
    expect(def).not.toBeNull();
    expect(def![1]).toMatch(/\bh-11\b/);
    expect(def![1]).not.toMatch(/\bmd:h-\d+\b/);
  });

  it("the icon button stays size-11 at both steps (44px)", () => {
    expect(buttonSrc).toMatch(/\bicon:\s*["'`]size-11["'`]/);
  });

  it("BR-2: the FilterChip pill height never steps — only its padding does", () => {
    const pill = chipSrc.match(/inline-flex[^"]*rounded-full[^"]*/);
    expect(pill).not.toBeNull();
    expect(pill![0]).toMatch(/\bh-11\b/);
    expect(pill![0]).not.toMatch(/\bmd:h-\d+\b/);
    expect(pill![0]).toMatch(/\bpx-4\b/);
    expect(pill![0]).toMatch(/\bmd:px-5\b/);
    expect(pill![0]).toMatch(/min-w-\[44px\]/);
  });

  it("BR-2: no migrated surface steps a control height below the floor", () => {
    for (const [name, source] of [
      ["button", buttonSrc],
      ["input", inputSrc],
      ["filter-chip", chipSrc],
      ["FilterModal", filterModalSrc],
      ["SearchModal", searchModalSrc],
      ["CategoryBar", categoryBarSrc],
    ] as const) {
      for (const line of source.split("\n")) {
        expect(findFloorBreaches(line), `${name}: ${line.trim()}`).toEqual([]);
      }
    }
  });
});

// ── AC-3 / CAM-542 — one height per control row ──────────────────────────────

describe("AC-3 (BR-5, absorbs CAM-542): SearchModal keeps one height per control row", () => {
  it("the check-in / check-out date buttons no longer opt into size=lg", () => {
    // They sit beside the province + guests SelectTriggers (h-11); a lg button
    // there was the h-12/h-11 mix CAM-542 was raised for.
    const dateButtons = searchModalSrc.match(
      /<PopoverTrigger asChild>[\s\S]*?<\/PopoverTrigger>/g
    );
    expect(dateButtons).not.toBeNull();
    expect(dateButtons!.length).toBeGreaterThanOrEqual(2);
    for (const block of dateButtons!) {
      expect(block).not.toMatch(/size=["']lg["']/);
    }
  });

  it("exactly one lg control remains: the footer search CTA", () => {
    expect((searchModalSrc.match(/size=["']lg["']/g) ?? []).length).toBe(1);
  });

  it("the lg CTAs drop their px-8 override so size=lg owns padding too", () => {
    expect(searchModalSrc).not.toMatch(/className="px-8 font-bold"/);
    expect(filterModalSrc).not.toMatch(/text-primary-foreground px-8 rounded-full/);
  });
});

// ── AC-1 — the mobile step is really applied on the reported surfaces ────────

describe("AC-1: the three reported surfaces carry the mobile step", () => {
  it("FilterModal content padding steps p-4 -> md:p-8 and the stack tightens", () => {
    expect(filterModalSrc).toMatch(/p-4 md:p-8/);
    expect(filterModalSrc).toMatch(/space-y-4 md:space-y-6/);
    expect(filterModalSrc).not.toMatch(/overflow-y-auto p-6 md:p-8/);
  });

  it("FilterModal section titles use the responsive heading role", () => {
    expect(filterModalSrc).toMatch(/type-heading-3 font-bold/);
    expect(filterModalSrc).not.toMatch(/text-lg font-bold/);
  });

  it("SearchModal content padding + section stack step", () => {
    expect(searchModalSrc).toMatch(/p-4 md:p-8/);
    expect(searchModalSrc).toMatch(/space-y-5 md:space-y-8/);
  });

  it("CategoryBar gutter and tab gap step", () => {
    expect(categoryBarSrc).toMatch(/gap-6 md:gap-8/);
    expect(categoryBarSrc).toMatch(/px-4 md:px-6/);
  });

  it("chip card / icon-card block heights compact (they sit far above the floor)", () => {
    expect(chipSrc).toMatch(/h-28 p-4 md:h-32 md:p-5/);
    expect(chipSrc).toMatch(/h-20 p-2\.5 md:h-24 md:p-3/);
  });

  it("the Card primitive finally matches the p-4 md:p-6 rule DESIGN.md documented", () => {
    const cardSrc = src("components/ui/card.tsx");
    expect(cardSrc).toMatch(/\[--card-spacing:--spacing\(4\)\] md:\[--card-spacing:--spacing\(6\)\]/);
  });
});

// ── AC-4 — the guard, proven in BOTH directions ──────────────────────────────

describe("AC-4: M1 control-height rule fires on a violation", () => {
  it.each([
    ['<Button className="h-12 rounded-full px-5">Book</Button>', "consumer control"],
    ['lg: "h-12 gap-2 px-5"', "cva lg size variant"],
    ['<SelectTrigger className="h-12 rounded-full border-border" />', "select trigger"],
  ])("flags %s (%s)", (line) => {
    expect(isControlHeightViolation(line)).toBe(true);
  });

  it.each([
    ['<Button className="h-11 md:h-12 rounded-full">Book</Button>', "already responsive"],
    ['lg: "h-11 gap-2 px-4 md:h-12 md:px-5"', "responsive cva variant"],
    ['<div className="h-12 w-12 rounded-full bg-muted" />', "square = avatar, not a control"],
    ['<Skeleton className="h-12 w-full rounded-full" />', "skeleton mirrors its control"],
    ['<div className="h-12 bg-muted" />', "no control radius, not a control"],
    ["{/* Save button — matches w-full h-12 rounded-full */}", "a comment is documentation"],
    ['lg: "w-12 h-12 border-4"', "spinner square"],
  ])("is silent on %s (%s)", (line) => {
    expect(isControlHeightViolation(line)).toBe(false);
  });
});

describe("AC-4: M2 display-type rule fires on a violation", () => {
  it.each([
    '<h1 className="text-3xl font-bold">Title</h1>',
    '<h2 className="text-2xl font-bold font-display">Title</h2>',
    '<div className="text-4xl tabular-nums">42</div>',
  ])("flags %s", (line) => {
    expect(isDisplayTypeViolation(line)).toBe(true);
  });

  it.each([
    ['<h1 className="type-heading-1 font-bold">Title</h1>', "uses the responsive role"],
    ['<h1 className="text-xl md:text-3xl font-bold">Title</h1>', "has a responsive twin"],
    ['<p className="text-base">body</p>', "not a display size"],
    ['<p className="text-sm text-muted-foreground">helper</p>', "not a display size"],
    ["// the old text-2xl heading was replaced by type-heading-2", "a comment"],
  ])("is silent on %s (%s)", (line) => {
    expect(isDisplayTypeViolation(line)).toBe(false);
  });
});

describe("AC-4 (BR-2): M3 floor rule fires on any mobile step under 44px", () => {
  it.each([
    ['<Button className="h-9 md:h-12">go</Button>', 36],
    ['<Button className="h-10 md:h-11">go</Button>', 40],
    ['<Button className="size-8 md:size-11" aria-label="x" />', 32],
  ])("flags %s (mobile = %ipx)", (line, mobilePx) => {
    const hits = findFloorBreaches(line);
    expect(hits.length).toBe(1);
    expect(hits[0].mobilePx).toBe(mobilePx);
    expect(hits[0].mobilePx).toBeLessThan(TOUCH_FLOOR_PX);
  });

  it.each([
    ['<Button className="h-11 md:h-12">go</Button>', "mobile step is exactly the floor"],
    ['<Button className="h-12 md:h-14">go</Button>', "mobile step is above the floor"],
    ['<Button className="h-11">go</Button>', "no step at all"],
    ['<img src="/logo.png" className="h-8 md:h-10 w-auto" />', "an image is not a tap target"],
    ['<Skeleton className="h-4 md:h-5 w-24" />', "a skeleton is not a tap target"],
    ['<div className="h-14 md:h-10" />', "shrinks toward desktop — not a mobile step"],
  ])("is silent on %s (%s)", (line) => {
    expect(findFloorBreaches(line)).toEqual([]);
  });

  it("TOUCH_FLOOR_PX is the 44px figure the codebase already uses", () => {
    expect(TOUCH_FLOOR_PX).toBe(44);
    expect(chipSrc).toContain("min-w-[44px]");
  });
});

describe("AC-4: the guard is silent on the fixed tree (blocking backlog = 0)", () => {
  const result = runScaleGuard();

  it("reports zero BLOCKING findings across the whole repo", () => {
    expect(result.blocking).toEqual([]);
  });

  it("M3 has a zero backlog everywhere — it is blocking repo-wide, not scoped", () => {
    expect(result.report.filter((f) => f.rule === "M3-mobile-step-under-touch-floor")).toEqual([]);
  });

  it("the report-mode backlog is non-empty and therefore honestly staged, not hidden", () => {
    // ops.md: report -> clear to 0 -> blocking. M1/M2 are blocking only over the
    // surface this story cleared; the rest is counted, not quietly dropped.
    expect(result.report.length).toBeGreaterThan(0);
    for (const f of result.report) {
      expect(f.rule).toMatch(/^M[12]-/);
    }
  });

  it("every named exemption carries a written reason", () => {
    for (const f of result.exempt) {
      expect(typeof f.reason).toBe("string");
      expect(f.reason.length).toBeGreaterThan(20);
    }
  });
});

// ── AC-5 + DESIGN.md ─────────────────────────────────────────────────────────

describe("AC-5: /preview shows the mobile view", () => {
  it("renders a Mobile scale section", () => {
    expect(previewSrc).toContain("<SectionHeading>Mobile scale</SectionHeading>");
  });

  it("states the touch floor on the page, not only in the doc", () => {
    expect(previewSrc).toMatch(/Touch floor 44 × 44px/);
  });

  it("shows which step the reader is currently looking at", () => {
    expect(previewSrc).toMatch(/mobile step \(&lt; 768px\)|mobile step \(< 768px\)/);
    expect(previewSrc).toMatch(/desktop step/);
  });

  it("exercises all seven type roles so none can be dropped from the build", () => {
    for (const role of [
      "type-display",
      "type-heading-1",
      "type-heading-2",
      "type-heading-3",
      "type-body",
      "type-label",
      "type-caption",
    ]) {
      expect(previewSrc).toContain(role);
    }
  });
});

describe("DESIGN.md carries the rule (it is the source of truth agents read)", () => {
  it("documents the single breakpoint at 768px", () => {
    expect(designMd).toMatch(/Responsive scale/);
    expect(designMd).toMatch(/768px/);
  });

  it("states the 44px touch floor in the scale itself", () => {
    expect(designMd).toMatch(/44/);
    expect(designMd).toMatch(/touch floor/i);
  });

  it("closes the /preview mobile-view backlog item", () => {
    // §8 used to list "mobile view" as an open living-reference gap.
    const livingRef = designMd.match(/\*\*Living reference[^\n]*\n/);
    expect(livingRef).not.toBeNull();
    expect(livingRef![0]).not.toMatch(/,\s*mobile view/);
  });
});
