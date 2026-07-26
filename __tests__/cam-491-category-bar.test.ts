/**
 * cam-491-category-bar.test.ts — CAM-491
 *
 * "Redefine Home category tabs to real filterable dimensions" — full spec:
 * docs/specs/home-search-filters/CAM-487-home-search-filters/CAM-491-redefine-category-tabs/design.md
 *
 * CAM-529 (S2) updated 2 assertions below to the new canonical truth: `GLAMP`
 * is now a real seeded Campground-type MasterData code (CAM-521), so a
 * `type=GLAMP` tab is legitimate (previously excluded when GLAMP had no
 * backing row); `OWNED_PARAMS` dropped the dead `"access"` deleter (see
 * cam-529-category-tabs.test.ts for the Prove-It). See qa.md: updating a
 * guard to a legitimate spec change is correct, not weakening it.
 *
 * Source-inspection coverage (this repo's Vitest config runs
 * `environment: 'node'` with no jsdom — see cam-434-global-launcher.test.ts
 * for the established convention). Proves: (1) the original 7-tab set still
 * only ever drives `type=CAGD|CACP` or `terrain=BEAC|FORE|MTNS|RIVE`, never a
 * `type=` value outside campSiteType (excluding the still-unbacked-as-a-tab
 * LAKE/FOREST/VIEW/BAOT), (2) a click clears the OTHER owned category param
 * (mutual-exclude), (3) active-tab detection reads the owned param exactly,
 * (4) the required focus-visible ring is present.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const barSrc = read("components/CategoryBar.tsx");

describe("AC — the 7-tab set maps to real MasterData codes only", () => {
  it("[structural] type tabs only ever set CAGD/CACP/GLAMP (never the still-unbacked-as-a-tab LAKE/FOREST/VIEW/BAOT)", () => {
    expect(barSrc).toContain('{ labelKey: "campground", icon: Tent, param: "type", value: "CAGD" }');
    expect(barSrc).toContain('{ labelKey: "carCamping", icon: Caravan, param: "type", value: "CACP" }');
    expect(barSrc).not.toMatch(/param:\s*"type"[^}]*value:\s*"(LAKE|FOREST|VIEW|BAOT)"/);
  });

  it("[structural] terrain tabs cover beach/forest/mountain/riverside with real Terrain codes", () => {
    expect(barSrc).toContain('{ labelKey: "beach", icon: Palmtree, param: "terrain", value: "BEAC" }');
    expect(barSrc).toContain('{ labelKey: "forest", icon: Trees, param: "terrain", value: "FORE" }');
    expect(barSrc).toContain('{ labelKey: "mountain", icon: Mountain, param: "terrain", value: "MTNS" }');
    expect(barSrc).toContain('{ labelKey: "riverside", icon: Waves, param: "terrain", value: "RIVE" }');
  });

  it("[structural] All tab owns no param (clears the dimension, never sets type=)", () => {
    expect(barSrc).toContain('{ labelKey: "all", icon: Mountain, param: null, value: null }');
  });
});

describe("BR — single-select: a click clears the other owned category params", () => {
  it("[unit] handleCategoryClick deletes every OWNED_PARAMS entry before setting its own (access excluded, CAM-529)", () => {
    expect(barSrc).toContain('const OWNED_PARAMS = ["type", "terrain"] as const;');
    expect(barSrc).toMatch(/OWNED_PARAMS\.forEach\(\(p\)\s*=>\s*params\.delete\(p\)\)/);
    // the set happens AFTER the clear-all, so a stale type=CAGD can never
    // survive under a newly-tapped terrain=BEAC (or vice versa).
    const clearIdx = barSrc.indexOf("OWNED_PARAMS.forEach");
    const setIdx = barSrc.indexOf("params.set(cat.param, cat.value)");
    expect(clearIdx).toBeGreaterThan(-1);
    expect(setIdx).toBeGreaterThan(clearIdx);
  });

  it("[unit] preserves every other existing query param via URLSearchParams(searchParams.toString())", () => {
    expect(barSrc).toContain("new URLSearchParams(searchParams.toString())");
  });
});

describe("BR — active-tab detection reads the owned param exactly", () => {
  it("[unit] All is active only when neither type nor terrain is set", () => {
    expect(barSrc).toMatch(/if\s*\(cat\.param === null\)\s*{\s*return !typeParam && !terrainParam;/);
  });

  it("[unit] a type tab is active only on exact type match", () => {
    expect(barSrc).toMatch(/if\s*\(cat\.param === "type"\)\s*{\s*return typeParam === cat\.value;/);
  });

  it("[unit] a terrain tab is active only on an exact single-code match (no CSV false-positive)", () => {
    expect(barSrc).toContain("return terrainParam === cat.value;");
  });
});

describe("a11y — required focus-visible ring (Critical gap fix per design.md)", () => {
  it("[structural] tab buttons carry a visible focus ring using the ring-ring token", () => {
    expect(barSrc).toContain("focus-visible:outline-none");
    expect(barSrc).toContain("focus-visible:ring-2");
    expect(barSrc).toContain("focus-visible:ring-ring");
    expect(barSrc).toContain("focus-visible:ring-offset-2");
  });
});

describe("i18n — no hardcoded label copy; every tab resolves through locales/", () => {
  it("[structural] every label renders via t.categories[cat.labelKey], never an inline string", () => {
    expect(barSrc).toContain("{(t.categories as any)[cat.labelKey]}");
  });
});
