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
 *
 * CAM-532 (S5) retarget: the pill list and the URL rule moved OUT of
 * SearchModal into `components/CategoryBar.tsx` (exported `CATEGORIES` +
 * `buildCategoryUrl`), and the pill markup moved into the `FilterChip`
 * primitive. The CAM-494 invariants are unchanged — these assertions now read
 * them at their canonical home instead of duplicating the greps in the
 * consumer (see `.claude/rules/qa.md`: assert at the shared primitive).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const modalSrc = read("components/SearchModal.tsx");
const barSrc = read("components/CategoryBar.tsx");
const chipSrc = read("components/ui/filter-chip.tsx");

describe("AC — the experience-type pills map to real MasterData codes only", () => {
  it("[structural] type pills only ever set real Campground-type codes (never LAKE/FOREST/BAOT)", () => {
    expect(barSrc).toContain('{ labelKey: "campground", icon: Tent, param: "type", value: "CAGD" }');
    expect(barSrc).toContain('{ labelKey: "carCamping", icon: Caravan, param: "type", value: "CACP" }');
    // GLAMP became a real Campground-type MasterData row in CAM-513/CAM-521 and
    // a tab in CAM-529; LAKE/FOREST/BAOT never had one.
    expect(barSrc).not.toMatch(/param:\s*"type"[^}]*value:\s*"(LAKE|FOREST|BAOT)"/);
  });

  it("[structural] terrain pills cover beach/forest/mountain/riverside with real Terrain codes", () => {
    expect(barSrc).toContain('{ labelKey: "beach", icon: Palmtree, param: "terrain", value: "BEAC" }');
    expect(barSrc).toContain('{ labelKey: "forest", icon: Trees, param: "terrain", value: "FORE" }');
    expect(barSrc).toContain('{ labelKey: "mountain", icon: Mountain, param: "terrain", value: "MTNS" }');
    expect(barSrc).toContain('{ labelKey: "riverside", icon: Waves, param: "terrain", value: "RIVE" }');
  });

  it("[structural] the All pill owns no param (clears the dimension, never sets type=)", () => {
    expect(barSrc).toContain('{ labelKey: "all", icon: Mountain, param: null, value: null }');
  });

  it("[structural] the old dead-code keys are gone from the component", () => {
    expect(modalSrc).not.toMatch(/labelKey:\s*'(glamping|lakefront|views|boatAccess|campgrounds)'/);
  });

  it("[structural] SearchModal reads that one list instead of keeping a copy", () => {
    expect(modalSrc).toContain('from "@/components/CategoryBar"');
    expect(modalSrc).not.toContain("EXPERIENCE_TYPES");
  });
});

describe("BR — handleSearch emits exactly one owned param, never both", () => {
  it("[unit] the shared URL builder deletes every owned param before setting the selected one", () => {
    const clearIdx = barSrc.indexOf("OWNED_PARAMS.forEach((p) => params.delete(p))");
    const setIdx = barSrc.indexOf("params.set(cat.param, cat.value)");
    expect(clearIdx).toBeGreaterThan(-1);
    expect(setIdx).toBeGreaterThan(clearIdx);
    expect(barSrc).toContain('const OWNED_PARAMS = ["type", "terrain"] as const');
  });

  it("[structural] SearchModal delegates the category write to that builder", () => {
    expect(modalSrc).toContain("buildCategoryUrl(selected, params)");
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
    // CAM-532: the ring now lives once, in the primitive the modal renders.
    expect(modalSrc).toMatch(/<FilterChip\b/);
    expect(chipSrc).toContain("focus-visible:outline-none");
    expect(chipSrc).toContain("focus-visible:ring-2");
    expect(chipSrc).toContain("focus-visible:ring-ring");
    expect(chipSrc).toContain("focus-visible:ring-offset-2");
  });

  it("[structural] the active pill state is exposed via aria-pressed, not color alone", () => {
    expect(chipSrc).toContain("aria-pressed={selected}");
    expect(modalSrc).toContain("selected={experienceType === item.labelKey}");
  });
});

describe("i18n — no hardcoded label copy; every pill resolves through locales/", () => {
  it("[structural] every label renders via t.categories[item.labelKey], never an inline string", () => {
    expect(modalSrc).toContain("{(t.categories as any)[item.labelKey]}");
  });
});
