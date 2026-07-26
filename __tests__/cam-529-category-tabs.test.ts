/**
 * cam-529-category-tabs.test.ts — CAM-529 (S2)
 *
 * Full spec:
 * docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-529-category-tabs/story.md
 *
 * Behavioral coverage against `buildCategoryUrl` (a real `URLSearchParams`,
 * no DOM/router mock needed — see qa.md: "prefer a behavioral/measurable
 * assertion over a source grep where the env allows"). Proves:
 * (1) AC-4/BR-1 — the Prove-It: an unowned param (`access`) survives a tab
 *     tap; this exact test FAILED before the fix (`OWNED_PARAMS` used to
 *     include `"access"` with no category ever setting it, so every tap
 *     deleted a camper's FilterModal Access-type selection),
 * (2) AC-1/AC-2/AC-3/BR-3 — the 3 new tabs (ทะเล/น้ำตก/แกลมปิ้ง) each set
 *     the expected param/value and clear the other owned dimension,
 * (3) AC-5/BR-2 — a tab tap REPLACES an existing multi-value terrain CSV,
 *     never merges into it,
 * (4) AC-6/BR-4 — every tab's `categories.<key>` resolves in both en and th.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { CATEGORIES, buildCategoryUrl } from "../components/CategoryBar";
import translations from "../locales/translations.json";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");
const barSrc = read("components/CategoryBar.tsx");

const findTab = (labelKey: string) => {
  const tab = CATEGORIES.find((c) => c.labelKey === labelKey);
  if (!tab) throw new Error(`no CATEGORIES entry for labelKey "${labelKey}"`);
  return tab;
};

const parseUrl = (url: string) => new URLSearchParams(url.split("?")[1] ?? "");

describe("Prove-It (AC-4/BR-1) — a tab tap must not wipe a param it doesn't own", () => {
  it("[unit] access=DRIV survives tapping an unrelated category (beach)", () => {
    const before = new URLSearchParams("access=DRIV");
    const url = buildCategoryUrl(findTab("beach"), before);
    const after = parseUrl(url);

    // This is the exact regression: pre-fix OWNED_PARAMS included "access"
    // with no category ever setting it, so every tap deleted it.
    expect(after.get("access")).toBe("DRIV");
    expect(after.get("terrain")).toBe("BEAC");
  });

  it("[unit] other unowned params (keyword/province/min/max/facilities) also survive a tap", () => {
    const before = new URLSearchParams(
      "keyword=camp&province=Chiang+Mai&min=500&max=2000&facilities=HOTW,LIGT"
    );
    const url = buildCategoryUrl(findTab("mountain"), before);
    const after = parseUrl(url);

    expect(after.get("keyword")).toBe("camp");
    expect(after.get("province")).toBe("Chiang Mai");
    expect(after.get("min")).toBe("500");
    expect(after.get("max")).toBe("2000");
    expect(after.get("facilities")).toBe("HOTW,LIGT");
    expect(after.get("terrain")).toBe("MTNS");
  });

  it("[structural] OWNED_PARAMS excludes access — the dead deleter is gone", () => {
    expect(barSrc).toContain('const OWNED_PARAMS = ["type", "terrain"] as const;');
    expect(barSrc).not.toMatch(/OWNED_PARAMS\s*=\s*\[[^\]]*"access"/);
  });
});

describe("AC-1/AC-2/AC-3 (BR-3) — the 3 new tabs set the expected param/value", () => {
  it("[unit] ทะเล sets terrain=SEA and clears an existing type", () => {
    const url = buildCategoryUrl(findTab("sea"), new URLSearchParams("type=CAGD"));
    const params = parseUrl(url);
    expect(params.get("terrain")).toBe("SEA");
    expect(params.get("type")).toBeNull();
  });

  it("[unit] น้ำตก sets terrain=WATF and clears an existing type", () => {
    const url = buildCategoryUrl(findTab("waterfall"), new URLSearchParams("type=CACP"));
    const params = parseUrl(url);
    expect(params.get("terrain")).toBe("WATF");
    expect(params.get("type")).toBeNull();
  });

  it("[unit] แกลมปิ้ง sets type=GLAMP and clears an existing terrain", () => {
    const url = buildCategoryUrl(findTab("glamping"), new URLSearchParams("terrain=BEAC"));
    const params = parseUrl(url);
    expect(params.get("type")).toBe("GLAMP");
    expect(params.get("terrain")).toBeNull();
  });

  it("[structural] the bar stays scannable — only 3 new codes added, no other new-terrain code", () => {
    const newCodes = ["SEA", "WATF", "GLAMP"];
    for (const code of newCodes) {
      expect(barSrc).toContain(`value: "${code}"`);
    }
    for (const notAdded of ["COAS", "LAKE", "SWMH", "FILD", "CAVE", "FARM", "VIEW"]) {
      expect(barSrc).not.toContain(`value: "${notAdded}"`);
    }
  });
});

describe("AC-5 (BR-2) — a tab tap replaces a multi-value terrain CSV, never merges", () => {
  it("[unit] terrain=SEA,WATF is replaced (not merged) by a mountain tap", () => {
    const url = buildCategoryUrl(findTab("mountain"), new URLSearchParams("terrain=SEA,WATF"));
    const params = parseUrl(url);
    expect(params.get("terrain")).toBe("MTNS");
    expect(params.get("terrain")).not.toContain(",");
  });

  it("[null/empty] the All tab clears an existing multi-value terrain entirely", () => {
    const url = buildCategoryUrl(findTab("all"), new URLSearchParams("terrain=SEA,WATF,BEAC"));
    const params = parseUrl(url);
    expect(params.get("terrain")).toBeNull();
  });
});

describe("AC-6 (BR-4) — every tab's categories.<key> resolves in en AND th", () => {
  it("[unit] every CATEGORIES labelKey has a non-empty en and th translation", () => {
    for (const cat of CATEGORIES) {
      const en = (translations.en.categories as Record<string, string>)[cat.labelKey];
      const th = (translations.th.categories as Record<string, string>)[cat.labelKey];
      expect(en, `missing en categories.${cat.labelKey}`).toBeTruthy();
      expect(th, `missing th categories.${cat.labelKey}`).toBeTruthy();
    }
  });

  it("[unit] the 3 new labels resolve to the exact verbatim Thai copy", () => {
    const th = translations.th.categories as Record<string, string>;
    expect(th.sea).toBe("ทะเล");
    expect(th.waterfall).toBe("น้ำตก");
    expect(th.glamping).toBe("แกลมปิ้ง");
  });
});
