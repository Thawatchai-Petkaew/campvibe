/**
 * cam-560-category-label-overlap.test.ts — CAM-560 "Category labels stop
 * overlapping each other on a phone"
 *
 * The direct, unfakeable proof (rendered bounding boxes at 320/390px in a
 * real browser) lives in `e2e/regression/cam-560-category-label-overlap.
 * spec.ts` per story.md's Self-verify. These are the source-level guards
 * that must keep holding in CI, where no browser runs:
 *
 *   - `shrink-0` is present on the tab item (BR-1) — Prove-It: this repo's
 *     `findFloorBreaches`/scale-guard tooling can't catch a flex-shrink
 *     regression (it only inspects height/type tokens), so this test reads
 *     the source directly and is the one thing that goes red if `shrink-0`
 *     is ever removed.
 *   - the label still has no `truncate`/`overflow-hidden` — the fix holds
 *     the FULL label legible, it does not hide the overflow instead.
 *   - every entry in `CATEGORIES` has a real, non-empty TH + EN translation
 *     — "hold for the longest label in the set" requires every category to
 *     actually have copy, not just the two named in the bug report.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIES } from "../components/CategoryBar";
import translations from "../locales/translations.json";
import { findFloorBreaches } from "../scripts/check-scale.mjs";

const ROOT = join(__dirname, "..");
const categoryBarSrc = readFileSync(join(ROOT, "components/CategoryBar.tsx"), "utf8");

describe("CAM-560 BR-1: the tab item cannot shrink below its own label's content width", () => {
  it("PROVE-IT: the tab button className carries `shrink-0` next to the min-w floor", () => {
    // Scope to the tab's own className block, not the whole file, so this
    // can't accidentally match an unrelated `shrink-0` elsewhere.
    const tabClassBlock = categoryBarSrc.match(
      /"flex flex-col items-center[^"]*"/
    );
    expect(tabClassBlock, "could not find the CategoryBar tab className").not.toBeNull();
    expect(tabClassBlock![0]).toMatch(/\bshrink-0\b/);
    // The min-w pair CAM-552 introduced must remain — this fix builds on it,
    // it does not remove or replace it (a lower min-w alone would not fix
    // the bug: shrink-0 is what stops compression below CONTENT width).
    expect(tabClassBlock![0]).toMatch(/min-w-\[56px\]/);
    expect(tabClassBlock![0]).toMatch(/md:min-w-\[64px\]/);
  });

  it("the label is never truncated/clipped — the fix keeps it fully legible, it does not hide overflow", () => {
    const labelSpanBlock = categoryBarSrc.match(/<span[\s\S]*?<\/span>/);
    expect(labelSpanBlock).not.toBeNull();
    expect(labelSpanBlock![0]).not.toMatch(/\btruncate\b/);
    expect(labelSpanBlock![0]).not.toMatch(/overflow-hidden/);
    expect(labelSpanBlock![0]).toMatch(/whitespace-nowrap/);
  });
});

describe("CAM-560: every category — not only the reported pair — has real copy", () => {
  const th = (translations as any).th.categories;
  const en = (translations as any).en.categories;

  it.each(CATEGORIES.map((c) => c.labelKey))("category \"%s\" has a non-empty TH label", (key) => {
    expect(typeof th[key], `th.categories.${key}`).toBe("string");
    expect(th[key].trim().length, `th.categories.${key}`).toBeGreaterThan(0);
  });

  it.each(CATEGORIES.map((c) => c.labelKey))("category \"%s\" has a non-empty EN label", (key) => {
    expect(typeof en[key], `en.categories.${key}`).toBe("string");
    expect(en[key].trim().length, `en.categories.${key}`).toBeGreaterThan(0);
  });

  it("the longest TH label in the set is campground's ลานกางเต็นท์ — the fix must hold for it, not just short labels", () => {
    const longest = CATEGORIES.map((c) => c.labelKey).reduce((a, b) =>
      th[a].length >= th[b].length ? a : b
    );
    expect(longest).toBe("campground");
    expect(th.campground).toBe("ลานกางเต็นท์");
  });
});

describe("CAM-560 AC-4: the tab keeps CAM-552's 44px touch floor (unchanged by this fix)", () => {
  it("no mobile-step height/size drops under 44px in the tab className", () => {
    // Reuses the same guard CAM-552 introduced; this fix only touches
    // flex-shrink, never a height/size token.
    for (const line of categoryBarSrc.split("\n")) {
      expect(findFloorBreaches(line), line.trim()).toEqual([]);
    }
  });
});
