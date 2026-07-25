/**
 * cam-494-search-modal-pills.test.ts — CAM-494
 *
 * "Fix the SearchModal experience-type pills" — same dead-code bug as
 * CAM-491 (CategoryBar), fixed the same way. See
 * docs/specs/home-search-filters/CAM-487-home-search-filters/CAM-491-redefine-category-tabs/design.md
 * for the taxonomy this reuses.
 *
 * Source-inspection coverage (this repo's Vitest config runs
 * `environment: 'node'` with no jsdom — see cam-491-category-bar.test.ts for
 * the established convention). Proves: (1) the pill set only ever drives
 * `type=CAGD|CACP` or `terrain=BEAC|FORE|MTNS|RIVE`, never a `type=` value
 * outside campSiteType (GLAMP/LAKE/FOREST/VIEW/BAOT are gone), (2)
 * handleSearch clears the OTHER owned category param before setting its own
 * (mutual-exclude, single-select), (3) the required focus-visible ring is
 * present, (4) every label resolves through locales/, never inline.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const modalSrc = read("components/SearchModal.tsx");

describe("AC — the experience-type pills map to real MasterData codes only", () => {
  it("[structural] type pills only ever set CAGD or CACP (never GLAMP/LAKE/FOREST/VIEW/BAOT)", () => {
    expect(modalSrc).toContain("{ labelKey: 'campground', icon: Tent, param: 'type', value: 'CAGD' }");
    expect(modalSrc).toContain("{ labelKey: 'carCamping', icon: Caravan, param: 'type', value: 'CACP' }");
    expect(modalSrc).not.toMatch(/param:\s*'type'[^}]*value:\s*'(GLAMP|LAKE|FOREST|VIEW|BAOT)'/);
    expect(modalSrc).not.toMatch(/id:\s*'(GLAMP|LAKE|FOREST|VIEW|BAOT)'/);
  });

  it("[structural] terrain pills cover beach/forest/mountain/riverside with real Terrain codes", () => {
    expect(modalSrc).toContain("{ labelKey: 'beach', icon: Palmtree, param: 'terrain', value: 'BEAC' }");
    expect(modalSrc).toContain("{ labelKey: 'forest', icon: Trees, param: 'terrain', value: 'FORE' }");
    expect(modalSrc).toContain("{ labelKey: 'mountain', icon: Mountain, param: 'terrain', value: 'MTNS' }");
    expect(modalSrc).toContain("{ labelKey: 'riverside', icon: Waves, param: 'terrain', value: 'RIVE' }");
  });

  it("[structural] the All pill owns no param (clears the dimension, never sets type=)", () => {
    expect(modalSrc).toContain("{ labelKey: 'all', icon: Map, param: null, value: null }");
  });

  it("[structural] the old dead-code keys are gone from the component", () => {
    expect(modalSrc).not.toMatch(/labelKey:\s*'(glamping|lakefront|views|boatAccess|campgrounds)'/);
  });
});

describe("BR — handleSearch emits exactly one owned param, never both", () => {
  it("[unit] deletes BOTH type and terrain before setting the selected pill's own param", () => {
    const clearIdx = modalSrc.indexOf('params.delete("type")');
    const clearTerrainIdx = modalSrc.indexOf('params.delete("terrain")');
    const setIdx = modalSrc.indexOf("params.set(selected.param, selected.value)");
    expect(clearIdx).toBeGreaterThan(-1);
    expect(clearTerrainIdx).toBeGreaterThan(-1);
    expect(setIdx).toBeGreaterThan(clearIdx);
    expect(setIdx).toBeGreaterThan(clearTerrainIdx);
  });

  it("[unit] preserves every other existing query param via URLSearchParams(searchParams.toString())", () => {
    expect(modalSrc).toContain("new URLSearchParams(searchParams.toString())");
  });

  it("[unit] resolves the initial pill selection from the URL's type/terrain params, not a hardcoded default", () => {
    expect(modalSrc).toContain("function resolveSelectedExperience(searchParams: URLSearchParams)");
    expect(modalSrc).toContain("useState(() => resolveSelectedExperience(searchParams))");
  });
});

describe("a11y — required focus-visible ring (matches CAM-491's CategoryBar fix)", () => {
  it("[structural] pill buttons carry a visible focus ring using the ring-ring token", () => {
    expect(modalSrc).toContain("focus-visible:outline-none");
    expect(modalSrc).toContain("focus-visible:ring-2");
    expect(modalSrc).toContain("focus-visible:ring-ring");
    expect(modalSrc).toContain("focus-visible:ring-offset-2");
  });

  it("[structural] the active pill state is exposed via aria-pressed, not color alone", () => {
    expect(modalSrc).toContain("aria-pressed={active}");
  });
});

describe("i18n — no hardcoded label copy; every pill resolves through locales/", () => {
  it("[structural] every label renders via t.categories[item.labelKey], never an inline string", () => {
    expect(modalSrc).toContain("{(t.categories as any)[item.labelKey]}");
  });
});
