/**
 * cam-530-active-filters.test.ts — CAM-530 (S3, taxonomy-ui-foundation epic)
 *
 * Full spec:
 * docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-530-active-filters/story.md
 *
 * Behavioral coverage against the exported pure functions (`getActiveFilterChips`,
 * `removeActiveFilterValue`, `clearAllActiveFilters`) — this repo's convention
 * (`environment: 'node'`, no jsdom/@testing-library — see cam-410-chip-render,
 * cam-529-category-tabs): a hook/router-dependent component is proven by testing
 * the pure logic it calls, plus a source check for the wiring.
 *
 * Proves:
 * (a) AC — every chip renders its LOCALIZED label (annotatedFeatures/camperStyle
 *     included) and no raw MasterData code string survives into a label,
 * (b) AC — removing one value from a multi-value CSV param leaves siblings intact,
 * (c) AC — no active filter -> the component renders nothing (empty chip list +
 *     the early-return guard in source),
 * (d) AC — registry-driven property: every `FILTERABLE_GROUPS` entry (imported
 *     from the SAME `lib/taxonomy-registry.ts` the component imports) is
 *     representable as a chip with NO edit to this component — a hypothetical
 *     future 9th group would flow through the identical loop.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  getActiveFilterChips,
  removeActiveFilterValue,
  clearAllActiveFilters,
} from "../components/ActiveFilters";
import { FILTERABLE_GROUPS } from "../lib/taxonomy-registry";
import translations from "../locales/translations.json";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");
const componentSrc = read("components/ActiveFilters.tsx");

const enT = translations.en;
const thT = translations.th;

describe("AC — chips show localized labels, never a raw MasterData code", () => {
  it("[unit] EN: terrain/annotatedFeatures/camperStyle/type/min/max all resolve to their localized label", () => {
    const params = new URLSearchParams(
      "type=GLAMP&min=500&max=2000&terrain=SEA,WATF&annotatedFeatures=ALCO&camperStyle=CHIC"
    );
    const chips = getActiveFilterChips(params, enT);

    expect(chips.some((c) => c.label === "Terrain: Sea")).toBe(true);
    expect(chips.some((c) => c.label === "Terrain: Waterfall")).toBe(true);
    expect(chips.some((c) => c.label === "Annotated Features: Alcohol allowed")).toBe(true);
    expect(chips.some((c) => c.label === "Camper Style: Chic")).toBe(true);
    expect(chips.some((c) => c.label === "Campground Type: Glamping")).toBe(true);
    expect(chips.some((c) => c.label === "Min Price: 500")).toBe(true);
    expect(chips.some((c) => c.label === "Max Price: 2000")).toBe(true);

    // no raw code token (SEA/WATF/ALCO/CHIC/GLAMP) survives standalone in any label
    for (const chip of chips) {
      for (const raw of ["SEA", "WATF", "ALCO", "CHIC", "GLAMP"]) {
        expect(chip.label).not.toMatch(new RegExp(`\\b${raw}\\b`));
      }
    }
  });

  it("[unit] TH: the same params resolve to real Thai labels, never a raw code", () => {
    const params = new URLSearchParams("terrain=SEA&annotatedFeatures=ALCO&camperStyle=CHIC");
    const chips = getActiveFilterChips(params, thT);

    expect(chips.some((c) => c.label.includes("ทะเล"))).toBe(true);
    expect(chips.some((c) => c.label.includes("ดื่มแอลกอฮอล์ได้"))).toBe(true);
    expect(chips.some((c) => c.label.includes("สบาย"))).toBe(true);
    for (const chip of chips) {
      for (const raw of ["SEA", "ALCO", "CHIC"]) {
        expect(chip.label).not.toMatch(new RegExp(`\\b${raw}\\b`));
      }
    }
  });

  it("[unit] type=ALL never becomes a chip (no active-filter meaning)", () => {
    const chips = getActiveFilterChips(new URLSearchParams("type=ALL"), enT);
    expect(chips.find((c) => c.key === "type")).toBeUndefined();
  });
});

describe("AC — removing one chip removes exactly that value from its URL param", () => {
  it("[unit] a CSV param keeps its other values after removing one", () => {
    const params = new URLSearchParams("terrain=SEA,WATF,MTNS");
    const next = removeActiveFilterValue(params, "terrain", "WATF");
    expect(next.get("terrain")).toBe("SEA,MTNS");
  });

  it("[unit] removing the last remaining value deletes the param entirely", () => {
    const params = new URLSearchParams("terrain=SEA");
    const next = removeActiveFilterValue(params, "terrain", "SEA");
    expect(next.get("terrain")).toBeNull();
  });

  it("[unit] sibling params (keyword/min/other groups) are untouched", () => {
    const params = new URLSearchParams("terrain=SEA,WATF&keyword=camp&min=500&camperStyle=CHIC");
    const next = removeActiveFilterValue(params, "terrain", "SEA");
    expect(next.get("terrain")).toBe("WATF");
    expect(next.get("keyword")).toBe("camp");
    expect(next.get("min")).toBe("500");
    expect(next.get("camperStyle")).toBe("CHIC");
  });

  it("[unit] clearAllActiveFilters removes every managed param but preserves search context", () => {
    const params = new URLSearchParams(
      "type=GLAMP&min=500&max=2000&terrain=SEA&camperStyle=CHIC&keyword=camp&province=Chiang+Mai&startDate=2026-08-01&sort=price_asc"
    );
    const next = clearAllActiveFilters(params);
    expect(next.get("type")).toBeNull();
    expect(next.get("min")).toBeNull();
    expect(next.get("terrain")).toBeNull();
    expect(next.get("camperStyle")).toBeNull();
    // search context is NOT a "filter" and must survive a clear-all
    expect(next.get("keyword")).toBe("camp");
    expect(next.get("province")).toBe("Chiang Mai");
    expect(next.get("startDate")).toBe("2026-08-01");
    expect(next.get("sort")).toBe("price_asc");
  });
});

describe("AC — no active filter renders nothing (no empty shell)", () => {
  it("[unit] getActiveFilterChips returns an empty array with no relevant params present", () => {
    expect(getActiveFilterChips(new URLSearchParams(), enT)).toEqual([]);
    expect(getActiveFilterChips(new URLSearchParams("keyword=camp&sort=rating"), enT)).toEqual([]);
  });

  it("[structural] the component early-returns null when there are no chips", () => {
    expect(componentSrc).toMatch(/if\s*\(\s*chips\.length\s*===\s*0\s*\)\s*return\s+null;/);
  });
});

describe("Registry-driven (WORK ITEM 1) — every FILTERABLE_GROUPS entry is representable with no component edit", () => {
  it("[unit] a chip renders for every current registry group's urlParam, with its localized group title", () => {
    const params = new URLSearchParams();
    FILTERABLE_GROUPS.forEach((g, i) => params.set(g.urlParam, `FAKECODE${i}`));

    const chips = getActiveFilterChips(params, enT);

    // exactly one chip per group (single fake code each) — proves the loop is
    // driven by FILTERABLE_GROUPS's actual length, not a hardcoded count.
    expect(chips.length).toBe(FILTERABLE_GROUPS.length);

    for (const group of FILTERABLE_GROUPS) {
      const chip = chips.find((c) => c.key === group.urlParam);
      expect(chip).toBeTruthy();
      const expectedGroupTitle = (enT.filter as Record<string, string>)[group.i18nGroupKey];
      expect(chip!.label.startsWith(`${expectedGroupTitle}:`)).toBe(true);
    }
  });

  it("[structural] the component imports FILTERABLE_GROUPS from lib/taxonomy-registry — not a hand-written duplicate list", () => {
    expect(componentSrc).toMatch(/from ["']@\/lib\/taxonomy-registry["']/);
    expect(componentSrc).toContain("FILTERABLE_GROUPS");
    // guard against re-introducing a hand-copied param list (the CAM-523 problem
    // this story exists to close) — every registry urlParam must appear via the
    // loop, never as an individual literal `addFilter('activities', ...)` call.
    expect(componentSrc).not.toMatch(/addFilter\(/);
  });
});

describe("Mount point (done_when) — ActiveFilters is imported at a real page mount", () => {
  it("[structural] app/page.tsx imports and renders <ActiveFilters />", () => {
    const pageSrc = read("app/page.tsx");
    expect(pageSrc).toContain('import { ActiveFilters } from "@/components/ActiveFilters"');
    expect(pageSrc).toMatch(/<ActiveFilters\s*\/>/);
  });
});
