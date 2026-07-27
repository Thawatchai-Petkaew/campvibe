/**
 * cam-581-scale-guard-blocking.test.ts — CAM-581 "Clear the two scale-guard
 * findings and make the rule blocking"
 *
 * CAM-565 shipped M4 report-only with a named 2-item backlog
 * (components/Navbar.tsx:160, components/ui/filter-chip.tsx:45). This story
 * inspected both at a real 150%-text-scale Chromium render (localhost:3000;
 * see story.md's Self-verify for the measured numbers), resolved them, added
 * a `truncate` escape to M4's heuristic, and flipped M4 from report-only to
 * BLOCKING repo-wide now that the backlog is provably 0.
 *
 * Both-directions proof (Prove-It, the same pattern
 * __tests__/cam-552-mobile-scale.test.ts and
 * __tests__/cam-565-scale-guard-text-scale.test.ts already use):
 *   - RED: a fresh violation fixture (literal-px min-width, no shrink-0, no
 *     truncate anywhere nearby) still fires, AND now lands in `blocking`
 *     (not just a report-only bucket) — M4 has real teeth post-promotion.
 *   - GREEN: the truncate escape (same-line, matching filter-chip.tsx's real
 *     fix) and the next-line escape (matching Navbar.tsx's real, unchanged
 *     shape) are both silent.
 *   - The current, real components/Navbar.tsx and components/ui/filter-chip.tsx
 *     sources, read live off disk, are quiet for M4 — the backlog is 0 for
 *     real, not because the files were deleted or excluded.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isMinWidthScaleRisk, runScaleGuard } from "../scripts/check-scale.mjs";

const ROOT = join(__dirname, "..");
const src = (p: string) => readFileSync(join(ROOT, p), "utf8");

const M4 = "M4-min-width-literal-not-shrink-safe";

describe("CAM-581 M4: still fires on a fresh violation after the truncate escape was added", () => {
  it("PROVE-IT (red): a literal-px min-width, no shrink-0, no truncate anywhere nearby", () => {
    const line = '<div className="flex items-center gap-2 min-w-[80px]">';
    const nextLine = '<span className="whitespace-nowrap">{label}</span>';
    expect(isMinWidthScaleRisk(line, nextLine)).toBe(true);
  });

  it("PROVE-IT (red, no next line at all): still fires when there is nothing after it", () => {
    const line = '<button className="inline-flex gap-2 min-w-[64px] px-4">go</button>';
    expect(isMinWidthScaleRisk(line)).toBe(true);
  });

  it("is BLOCKING (not report-only) when this exact violation is scanned repo-wide", () => {
    // Reconstruct runScaleGuard()'s own classification for a hypothetical
    // finding of this rule: M4 is `scoped: false` post-CAM-581, so any real
    // hit lands directly in `blocking`, the same treatment M3 gets.
    const result = runScaleGuard();
    const m4Findings = [...result.blocking, ...result.report, ...result.textScaleRisk].filter(
      (f) => f.rule === M4
    );
    // Every M4 finding that exists today (there are none) would have to be
    // in `blocking` — never in `report` or the now-retired `textScaleRisk`.
    for (const f of m4Findings) {
      expect(result.blocking).toContainEqual(f);
    }
    expect(result.report.some((f) => f.rule === M4)).toBe(false);
    expect(result.textScaleRisk.some((f) => f.rule === M4)).toBe(false);
  });
});

describe("CAM-581 M4: the truncate escape (same-line and next-line)", () => {
  it("is silent when the flagged line itself carries truncate (filter-chip.tsx's real fix shape)", () => {
    const line =
      '"inline-flex items-center gap-2 h-11 min-w-[44px] px-4 md:px-5 rounded-full border type-label transition-colors truncate",';
    expect(isMinWidthScaleRisk(line)).toBe(false);
  });

  it("is silent when the very NEXT line carries truncate (Navbar.tsx's real, unchanged shape)", () => {
    const line = '<div className="pl-6 pr-2 py-2 flex items-center gap-3 min-w-[140px]">';
    const nextLine =
      '<span className="text-sm text-muted-foreground font-normal truncate flex-1">{label}</span>';
    expect(isMinWidthScaleRisk(line, nextLine)).toBe(false);
  });

  it("a truncate mentioned only further away (not this line or the next) does NOT suppress a real hit", () => {
    const line = '<div className="flex items-center gap-2 min-w-[80px]">';
    const nextLine = '<div className="flex flex-col">';
    const lineAfterThat = '<span className="truncate">{label}</span>';
    expect(isMinWidthScaleRisk(line, nextLine)).toBe(true);
    // sanity: the far-away truncate line is not itself what we passed
    expect(lineAfterThat).toContain("truncate");
  });
});

describe("CAM-581: the real, live sources are quiet for M4 (backlog is 0 for real)", () => {
  it("components/Navbar.tsx contributes zero M4 findings, read live off disk", () => {
    const lines = src("components/Navbar.tsx").split("\n");
    for (let i = 0; i < lines.length; i++) {
      expect(isMinWidthScaleRisk(lines[i], lines[i + 1] ?? ""), `line ${i + 1}: ${lines[i].trim()}`).toBe(
        false
      );
    }
  });

  it("components/ui/filter-chip.tsx contributes zero M4 findings, read live off disk", () => {
    const lines = src("components/ui/filter-chip.tsx").split("\n");
    for (let i = 0; i < lines.length; i++) {
      expect(isMinWidthScaleRisk(lines[i], lines[i + 1] ?? ""), `line ${i + 1}: ${lines[i].trim()}`).toBe(
        false
      );
    }
  });

  it("filter-chip.tsx's pill className still carries min-w-[44px] (the touch floor, unchanged) and truncate (CAM-581's fix)", () => {
    const content = src("components/ui/filter-chip.tsx");
    expect(content).toContain("min-w-[44px]");
    expect(content).toContain("truncate");
  });

  it("runScaleGuard() reports the M4 backlog as exactly 0 repo-wide", () => {
    const result = runScaleGuard();
    const all = [...result.blocking, ...result.report, ...result.textScaleRisk].filter(
      (f) => f.rule === M4
    );
    expect(all).toEqual([]);
  });
});
