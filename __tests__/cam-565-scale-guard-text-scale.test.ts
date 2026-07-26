/**
 * cam-565-scale-guard-text-scale.test.ts — CAM-565 "The scale guard checks
 * geometry at one text size only"
 *
 * check-scale.mjs reasons about geometry ARITHMETICALLY (Tailwind step → px),
 * never by rendering a browser — M1/M2/M3 never covered the one className
 * shape CAM-560 shipped: a literal-px `min-w-[Npx]` beside a rem-based label,
 * missing `shrink-0`. A literal px value never scales with the browser/OS
 * text-size setting the way rem-based content does, so a check that only
 * ever reasons about ONE text size can watch this pass forever (see
 * scripts/check-scale.mjs's file header, "M4 min-width-literal-not-shrink-safe").
 *
 * Both-directions proof (Prove-It, same pattern __tests__/cam-552-mobile-scale
 * .test.ts already uses for M1/M2/M3 — reconstructing the condition, per
 * story.md, rather than committing a reverted components/CategoryBar.tsx):
 *   - RED: the exact pre-CAM-560 CategoryBar tab className (git blame:
 *     components/CategoryBar.tsx before commit a4f32bf) — same min-w pair,
 *     no shrink-0 — must fire.
 *   - GREEN: the CURRENT CategoryBar.tsx source (shrink-0 restored by
 *     CAM-560) must be quiet, read directly off disk (not a hand-typed
 *     copy), so a future edit that reintroduces the bug fails THIS test.
 *
 * The real-browser side of the 150% mechanism (measuring actual overlap, not
 * just reasoning about the className) already lives in
 * e2e/regression/cam-560-category-label-overlap.spec.ts's "PROVE-IT" test and
 * e2e/regression/cam-558-touch-targets.spec.ts's EC-5 — both already apply
 * `page.addStyleTag({ content: "html { font-size: 24px !important; }" })`
 * (150%). This story does not duplicate that browser run (Lean); it hardens
 * the static side, which is what check-scale.mjs's own architecture is.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isMinWidthScaleRisk, runScaleGuard } from "../scripts/check-scale.mjs";

const ROOT = join(__dirname, "..");
const src = (p: string) => readFileSync(join(ROOT, p), "utf8");

const categoryBarSrc = src("components/CategoryBar.tsx");
const badgeSrc = src("components/ui/badge.tsx");
const themeToggleSrc = src("components/ThemeToggle.tsx");

// The exact tab className CAM-560 fixed, with `shrink-0` removed — this is
// components/CategoryBar.tsx's line as it existed before commit a4f32bf
// ("fix(cam-560): stop the category labels overlapping on a phone"), not a
// synthetic invention.
const PRE_CAM_560_TAB_CLASS =
  '"flex flex-col items-center gap-1.5 md:gap-2 min-w-[56px] md:min-w-[64px] pb-2 md:pb-3 border-b-2 transition group",';

describe("CAM-565 M4: fires on the pre-CAM-560 shape (RED), is silent once shrink-0 is present (GREEN)", () => {
  it("PROVE-IT (red): the reconstructed pre-fix tab className is flagged", () => {
    expect(isMinWidthScaleRisk(PRE_CAM_560_TAB_CLASS)).toBe(true);
  });

  it("PROVE-IT (green): restoring shrink-0 on that exact line makes it silent again", () => {
    const withShrinkZero = PRE_CAM_560_TAB_CLASS.replace(
      "min-w-[56px] md:min-w-[64px] pb-2",
      "min-w-[56px] md:min-w-[64px] shrink-0 pb-2"
    );
    expect(withShrinkZero).toContain("shrink-0"); // sanity: the replace actually landed
    expect(isMinWidthScaleRisk(withShrinkZero)).toBe(false);
  });

  it("is quiet on the CURRENT CategoryBar.tsx source, read live off disk", () => {
    for (const line of categoryBarSrc.split("\n")) {
      expect(isMinWidthScaleRisk(line), line.trim()).toBe(false);
    }
  });
});

describe("CAM-565 M4: fires on a violation", () => {
  it.each([
    [PRE_CAM_560_TAB_CLASS, "the real pre-CAM-560 CategoryBar tab (reconstructed)"],
    ['<div className="flex min-w-[64px]">tab</div>', "a plain flex div with a literal-px floor"],
    ['<button className="inline-flex items-center gap-2 min-w-[44px] px-4">go</button>', "inline-flex counts as flex-ish"],
    ['"flex flex-col md:min-w-[64px] pb-2"', "the md: variant alone, no bare step"],
  ])("flags: %s (%s)", (line) => {
    expect(isMinWidthScaleRisk(line)).toBe(true);
  });
});

describe("CAM-565 M4: is silent on a safe or out-of-scope shape", () => {
  it.each([
    ['"flex flex-col items-center gap-1.5 md:gap-2 min-w-[56px] md:min-w-[64px] shrink-0 pb-2 md:pb-3 border-b-2 transition group",', "shrink-0 present — the actual CAM-560 fix"],
    ['<div className="w-full min-w-[640px]">table-ish</div>', "no flex token at all — a table/select width, not a flex item"],
    ['<SelectContent className="rounded-2xl border-border shadow-lg min-w-[180px]">', "popover content width, not a flex row item"],
    ['<div className="flex items-center gap-3 size-11 min-w-[44px]" />', "size-N — a symmetric icon box, not a label row"],
    ['<div className="flex w-7 h-7 min-w-[28px]" />', "matching w-N/h-N — square, not a label row"],
    ['<div className="flex min-w-[1.25rem]" />', "rem unit, not px — scales WITH root font-size, not this rule's target"],
    ["// a comment mentioning flex min-w-[56px] with no shrink-0", "a comment is documentation"],
    ['<div className="flex min-w-[56px] shrink-0" />', "shrink-0 present"],
  ])("is silent on %s (%s)", (line) => {
    expect(isMinWidthScaleRisk(line)).toBe(false);
  });

  it("badge.tsx's pill min-w is rem-based — real source, correctly out of M4's scope", () => {
    const pillLine = badgeSrc.split("\n").find((l) => l.includes("min-w-[1.25rem]"));
    expect(pillLine, "expected to find badge.tsx's pill min-w line").toBeDefined();
    expect(isMinWidthScaleRisk(pillLine!)).toBe(false);
  });

  it("ThemeToggle.tsx's icon-button min-w carries no flex token on its own line — real source, correctly out of scope", () => {
    const iconLine = themeToggleSrc.split("\n").find((l) => l.includes("min-h-[44px] min-w-[44px]"));
    expect(iconLine, "expected to find ThemeToggle.tsx's icon-button min-w line").toBeDefined();
    expect(isMinWidthScaleRisk(iconLine!)).toBe(false);
  });
});

describe("CAM-565: M4 ships REPORT-ONLY repo-wide (rollout rule, .claude/rules/ops.md)", () => {
  const result = runScaleGuard();
  const M4 = "M4-min-width-literal-not-shrink-safe";

  it("contributes zero BLOCKING findings, regardless of the backlog size", () => {
    expect(result.blocking.filter((f) => f.rule === M4)).toEqual([]);
  });

  it("never lands in the M1/M2 `report` bucket either — its own dedicated bucket, per runScaleGuard()'s doc comment", () => {
    expect(result.report.filter((f) => f.rule === M4)).toEqual([]);
  });

  it("the current, real backlog is reported honestly (not hidden, not tuned away)", () => {
    const backlog = result.textScaleRisk.filter((f) => f.rule === M4);
    // Named explicitly so a silent regression (new violation OR a violation
    // quietly dropped without review) fails this test either direction.
    const locations = backlog.map((f) => `${f.file}:${f.line}`).sort();
    expect(locations).toEqual([
      "components/Navbar.tsx:160",
      "components/ui/filter-chip.tsx:45",
    ]);
  });

  it("CategoryBar.tsx itself contributes zero M4 findings (the fixed instance stays fixed)", () => {
    const categoryBarFindings = [...result.textScaleRisk, ...result.blocking].filter(
      (f) => f.rule === M4 && f.file === "components/CategoryBar.tsx"
    );
    expect(categoryBarFindings).toEqual([]);
  });
});
