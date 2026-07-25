/**
 * cam-493-filter-coverage.test.ts — CAM-493
 *
 * CI guard: fails if any Home tab/search-pill or any MasterData filter
 * option would return ZERO results against the seed data
 * (`prisma/data/mock-staging-all.json`, the same fixture `db:sync-from-staging`
 * loads into the local dev DB). Deterministic, DB-free — scans the committed
 * JSON directly, mirroring `lib/campsite-filters.ts`'s real filter semantics
 * (options.some.code for CSV taxonomy groups; plain equality for
 * `campSiteType`).
 *
 * Catches two failure modes going forward:
 *   (a) the dead-TAB bug — a Home/SearchModal tab points at a `type=`/
 *       `terrain=` value with no backing camp (CAM-491's original bug).
 *   (b) the dead-OPTION bug — a MasterData filter code (any of the 7 groups
 *       seeded in `prisma/seed.ts`) has zero backing camps.
 *
 * The code universe is SOURCED, not hardcoded: MasterData codes are parsed
 * from `prisma/seed.ts`'s `masterData` array (never imported — that file
 * runs a live Prisma seed on module load) and the tab/pill pairs are parsed
 * from `components/CategoryBar.tsx`'s `CATEGORIES` array, so a future
 * added/renamed code or tab is picked up automatically — nothing here can
 * silently drift from the real source.
 *
 * Coverage matrix:
 *   - normal: every MasterData code across all 7 groups has >=1 camp
 *   - normal: every Home tab/pill (type=CAGD/CACP, terrain=BEAC/FORE/MTNS/RIVE)
 *     returns >=1 camp
 *   - boundary: distinct-province coverage >=60 (of 77) + every one of the
 *     6 geographic regions has >=1 backing camp
 *   - boundary: price spread reaches a premium band (max priceHigh >=15000)
 *   - error/naming: a failing assertion NAMES the exact dead code(s), never
 *     a bare boolean, so a future regression is diagnosable at a glance
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { REGION_TO_PROVINCES } from "@/lib/thai-regions";
import mockStagingAll from "@/prisma/data/mock-staging-all.json";

// ---------------------------------------------------------------------------
// Fixture — flatten hosts[].campsites into one camp array (same fixture
// db:sync-from-staging loads into the local dev DB; see CLAUDE.md §Env).
// ---------------------------------------------------------------------------
interface MockCamp {
  campSiteType: string;
  accessTypes: string;
  facilities: string;
  externalFacilities: string;
  equipment: string;
  activities: string;
  terrain: string;
  province: string;
  priceHigh: number;
}
interface MockHost {
  campsites: MockCamp[];
}
interface MockStagingAll {
  hosts: MockHost[];
}
const ALL_CAMPS: MockCamp[] = (mockStagingAll as MockStagingAll).hosts.flatMap((h) => h.campsites);

const csvIncludes = (csv: string | undefined, code: string): boolean =>
  String(csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(code);

// ---------------------------------------------------------------------------
// Source of truth #1 — MasterData codes, parsed from prisma/seed.ts (never
// imported: that module runs `main()` — a live Prisma seed — on import).
// ---------------------------------------------------------------------------
const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

interface MasterDataEntry {
  code: string;
  group: string;
}
function extractMasterDataFromSeed(): MasterDataEntry[] {
  const src = read("prisma/seed.ts");
  const start = src.indexOf("const masterData = [");
  if (start === -1) throw new Error("prisma/seed.ts: `const masterData = [` not found — has the seed file moved?");
  const end = src.indexOf("\n]", start);
  const block = src.slice(start, end);
  const re = /\{\s*code:\s*'([A-Z0-9]+)',\s*group:\s*'([^']+)'/g;
  const out: MasterDataEntry[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) out.push({ code: m[1], group: m[2] });
  if (out.length === 0) throw new Error("prisma/seed.ts: parsed zero MasterData entries — regex drifted from the source shape.");
  return out;
}
const MASTER_DATA = extractMasterDataFromSeed();

// Group -> the camp field + comparison kind that backs it (mirrors
// lib/campsite-filters.ts's addOptionFilter for the 6 CSV/options groups,
// and CampSite.campSiteType's plain equality for "Campground type" — that
// field is NOT part of the `options` relation, see prisma/seed.ts's
// optionCodes extraction which excludes it).
type FieldKind = "csv" | "equals";
const GROUP_FIELD: Record<string, { field: keyof MockCamp; kind: FieldKind }> = {
  "Internal facility": { field: "facilities", kind: "csv" },
  "Equipment for rent": { field: "equipment", kind: "csv" },
  "External facility": { field: "externalFacilities", kind: "csv" },
  "Campground type": { field: "campSiteType", kind: "equals" },
  "Access type": { field: "accessTypes", kind: "csv" },
  Activity: { field: "activities", kind: "csv" },
  Terrain: { field: "terrain", kind: "csv" },
};

function countCampsForCode(camps: MockCamp[], group: string, code: string): number {
  const cfg = GROUP_FIELD[group];
  if (!cfg) {
    throw new Error(
      `prisma/seed.ts declares a MasterData group "${group}" with no GROUP_FIELD mapping in this test — ` +
        `add its backing camp field to GROUP_FIELD before this guard can cover it.`
    );
  }
  if (cfg.kind === "equals") {
    return camps.filter((c) => c[cfg.field] === code).length;
  }
  return camps.filter((c) => csvIncludes(c[cfg.field] as string, code)).length;
}

// ---------------------------------------------------------------------------
// Source of truth #2 — Home tab/pill param->value pairs, parsed from
// components/CategoryBar.tsx's CATEGORIES array (the exact regression CAM-491
// fixed: a tab pointing at a value with no backing camp).
// ---------------------------------------------------------------------------
interface TabPair {
  param: "type" | "terrain";
  value: string;
}
function extractCategoryBarPairs(): TabPair[] {
  const src = read("components/CategoryBar.tsx");
  const re = /param:\s*"(type|terrain)",\s*value:\s*"([A-Z]+)"/g;
  const out: TabPair[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push({ param: m[1] as "type" | "terrain", value: m[2] });
  if (out.length === 0) throw new Error("components/CategoryBar.tsx: parsed zero tab pairs — CATEGORIES shape drifted.");
  return out;
}
const TAB_PAIRS = extractCategoryBarPairs();

function countCampsForTabPair(camps: MockCamp[], pair: TabPair): number {
  if (pair.param === "type") return camps.filter((c) => c.campSiteType === pair.value).length;
  return camps.filter((c) => csvIncludes(c.terrain, pair.value)).length;
}

// ---------------------------------------------------------------------------
// 1. Every MasterData filter code has >=1 backing camp
// ---------------------------------------------------------------------------
describe("AC-1 — every MasterData filter code has >=1 backing camp (no dead filter option)", () => {
  const groups = [...new Set(MASTER_DATA.map((e) => e.group))];

  it.each(groups)('[normal] group "%s" — every seeded code returns at least one camp', (group) => {
    const codesInGroup = MASTER_DATA.filter((e) => e.group === group).map((e) => e.code);
    const deadCodes = codesInGroup.filter((code) => countCampsForCode(ALL_CAMPS, group, code) === 0);
    expect(
      deadCodes,
      `dead MasterData code(s) in group "${group}" with ZERO backing camps: [${deadCodes.join(", ")}] ` +
        `— a filter selecting any of these returns an empty result set`
    ).toEqual([]);
  });

  it("[boundary] the code universe under test is non-trivial (seed.ts parsed >=30 codes across >=5 groups)", () => {
    expect(MASTER_DATA.length).toBeGreaterThanOrEqual(30);
    expect(groups.length).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// 2. Every Home tab / SearchModal pill value returns data
// ---------------------------------------------------------------------------
describe("AC-2 — every Home tab/pill value returns >=1 camp (no dead tab, CAM-491 regression)", () => {
  it("[normal] every type=/terrain= pair parsed from CategoryBar.tsx has >=1 backing camp", () => {
    const dead = TAB_PAIRS.filter((p) => countCampsForTabPair(ALL_CAMPS, p) === 0);
    expect(
      dead,
      `dead Home tab(s) with ZERO backing camps: [${dead.map((p) => `${p.param}=${p.value}`).join(", ")}] ` +
        `— tapping this tab shows an empty result grid`
    ).toEqual([]);
  });

  it("[normal] the exact CAM-491 regression pairs are present and covered: type=CAGD/CACP, terrain=BEAC/FORE/MTNS/RIVE", () => {
    const required: TabPair[] = [
      { param: "type", value: "CAGD" },
      { param: "type", value: "CACP" },
      { param: "terrain", value: "BEAC" },
      { param: "terrain", value: "FORE" },
      { param: "terrain", value: "MTNS" },
      { param: "terrain", value: "RIVE" },
    ];
    for (const pair of required) {
      expect(TAB_PAIRS, `expected CategoryBar.tsx to still declare ${pair.param}=${pair.value}`).toContainEqual(pair);
      expect(
        countCampsForTabPair(ALL_CAMPS, pair),
        `${pair.param}=${pair.value} has zero backing camps`
      ).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Province coverage
// ---------------------------------------------------------------------------
describe("AC-3 — province coverage is broad enough that a province filter is rarely empty", () => {
  const campProvinces = new Set(ALL_CAMPS.map((c) => c.province));

  it("[boundary] distinct seeded provinces with >=1 camp is >=60 (data currently has 77)", () => {
    expect(campProvinces.size).toBeGreaterThanOrEqual(60);
  });

  it.each(Object.entries(REGION_TO_PROVINCES))(
    "[normal] region %s has >=1 backing camp across its province set",
    (region, provinces) => {
      const covered = provinces.filter((p) => campProvinces.has(p));
      expect(covered.length, `region "${region}" has ZERO camps across all ${provinces.length} of its provinces`).toBeGreaterThan(0);
    }
  );
});

// ---------------------------------------------------------------------------
// 4. Price spread
// ---------------------------------------------------------------------------
describe("AC-4 — price spread reaches a premium band (a high-end price filter is not empty)", () => {
  it("[boundary] max priceHigh across all camps is >=15000", () => {
    const max = Math.max(...ALL_CAMPS.map((c) => c.priceHigh));
    expect(max, `max priceHigh across ${ALL_CAMPS.length} camps was only ${max}, expected >=15000`).toBeGreaterThanOrEqual(15000);
  });
});
