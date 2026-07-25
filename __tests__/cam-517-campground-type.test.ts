/**
 * cam-517-campground-type.test.ts — CAM-517 (S5)
 *
 * Reconcile the `Campground type` MasterData group (previously CAGD/CACP
 * only) with `CampSiteTypeEnum` (which already listed GLAMP/VIEW/LAKE/
 * FOREST) by adding GLAMP + VIEW as MasterData rows + seeding camps with
 * those `campSiteType` values. Reuses the EXISTING scalar `campSiteType`
 * column + the existing `type` search filter — no new m2m group, no schema
 * change (story.md BR-1/BR-2/BR-3/BR-4).
 *
 * Coverage matrix:
 *   - normal: type=GLAMP / type=VIEW reach `buildCampSiteWhere` as a plain
 *     scalar-equals `where.campSiteType` assignment (AC-1, BR-2)
 *   - normal: GLAMP/VIEW are real `CampSiteTypeEnum` members, verbatim (BR-1)
 *   - normal: `prisma/seed.ts` seeds GLAMP + VIEW rows under the
 *     'Campground type' group with the exact Thai copy AC-3 requires (BR-1)
 *   - normal: searchCampsites + bulkAvailability jsonSchema `type`
 *     description teaches GLAMP/VIEW + the Thai trigger words (AC-4, BR-3)
 *   - boundary: the seeded mock fixture's GLAMP/VIEW share is discriminating
 *     (~8-20%) and CAGD/CACP remain the majority (BR-4)
 *   - null/empty: type=ALL / type unset never touches `where.campSiteType`
 *     (EC-2 — existing camps/behavior untouched)
 *   - teeth: removing GLAMP from the seed block fails the MasterData-row
 *     assertion (proves the test actually reads the real file, not a stub)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildCampSiteWhere } from "@/lib/campsite-filters";
import { CampSiteTypeEnum } from "@/lib/validations/campsite";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

/* -------------------------------------------------------------------------- */
/* AC-1/BR-2 — type=GLAMP/VIEW reach buildCampSiteWhere as a scalar equals    */
/* -------------------------------------------------------------------------- */

describe("buildCampSiteWhere — campSiteType scalar filter (AC-1, BR-2)", () => {
  it("[normal] type='GLAMP' sets where.campSiteType = 'GLAMP' (single scalar, not an array/CSV)", () => {
    const where = buildCampSiteWhere({ type: "GLAMP" });
    expect(where.campSiteType).toBe("GLAMP");
  });

  it("[normal] type='VIEW' sets where.campSiteType = 'VIEW'", () => {
    const where = buildCampSiteWhere({ type: "VIEW" });
    expect(where.campSiteType).toBe("VIEW");
  });

  it("[normal] existing CAGD/CACP behavior is unchanged (byte-identical shape)", () => {
    expect(buildCampSiteWhere({ type: "CAGD" }).campSiteType).toBe("CAGD");
    expect(buildCampSiteWhere({ type: "CACP" }).campSiteType).toBe("CACP");
  });

  it("[null/empty] type='ALL' never sets where.campSiteType (EC-2 guard, unset by default)", () => {
    const where = buildCampSiteWhere({ type: "ALL" });
    expect(where.campSiteType).toBeUndefined();
  });

  it("[null/empty] no `type` param at all never sets where.campSiteType", () => {
    const where = buildCampSiteWhere({});
    expect(where.campSiteType).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/* BR-1 — GLAMP/VIEW are real CampSiteTypeEnum members, verbatim              */
/* -------------------------------------------------------------------------- */

describe("CampSiteTypeEnum — GLAMP/VIEW already present verbatim (BR-1)", () => {
  it("[normal] GLAMP and VIEW parse as valid enum members", () => {
    expect(CampSiteTypeEnum.safeParse("GLAMP").success).toBe(true);
    expect(CampSiteTypeEnum.safeParse("VIEW").success).toBe(true);
  });

  it("[error/validation] an unrelated code still fails the enum (guard against an over-wide change)", () => {
    expect(CampSiteTypeEnum.safeParse("GLAM").success).toBe(false);
    expect(CampSiteTypeEnum.safeParse("VIEWS").success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* BR-1 — prisma/seed.ts seeds GLAMP + VIEW under 'Campground type'          */
/* -------------------------------------------------------------------------- */

describe("prisma/seed.ts — GLAMP + VIEW rows seeded under 'Campground type' (BR-1, AC-2, AC-3)", () => {
  const seedSrc = read("prisma/seed.ts");
  const start = seedSrc.indexOf("const masterData = [");
  const end = seedSrc.indexOf("\n]", start);
  const masterDataBlock = seedSrc.slice(start, end);

  it("[normal] a GLAMP row exists in group 'Campground type' with the exact AC-3 Thai copy 'กลามปิ้ง'", () => {
    const re = /\{\s*code:\s*'GLAMP',\s*group:\s*'Campground type',\s*nameTh:\s*'([^']+)',\s*nameEn:\s*'([^']+)',\s*icon:\s*'([^']+)'/;
    const m = masterDataBlock.match(re);
    expect(m, "prisma/seed.ts: no GLAMP row found in group 'Campground type'").not.toBeNull();
    expect(m![1]).toBe("กลามปิ้ง"); // AC-3 verbatim Thai copy
    expect(m![2]).toBe("Glamping");
    expect(typeof m![3]).toBe("string");
    expect(m![3].length).toBeGreaterThan(0);
  });

  it("[normal] a VIEW row exists in group 'Campground type' with Thai copy 'วิวสวย'", () => {
    const re = /\{\s*code:\s*'VIEW',\s*group:\s*'Campground type',\s*nameTh:\s*'([^']+)',\s*nameEn:\s*'([^']+)',\s*icon:\s*'([^']+)'/;
    const m = masterDataBlock.match(re);
    expect(m, "prisma/seed.ts: no VIEW row found in group 'Campground type'").not.toBeNull();
    expect(m![1]).toBe("วิวสวย");
    expect(typeof m![3]).toBe("string");
    expect(m![3].length).toBeGreaterThan(0);
  });

  it("[normal] GLAMP/VIEW icons are real lucide-react exports (EC-1)", async () => {
    const lucide = await import("lucide-react");
    const iconRe = (code: string) => {
      const re = new RegExp(`code:\\s*'${code}',\\s*group:\\s*'Campground type',[^}]*icon:\\s*'([^']+)'`);
      const m = masterDataBlock.match(re);
      return m ? m[1] : null;
    };
    const glampIcon = iconRe("GLAMP");
    const viewIcon = iconRe("VIEW");
    expect(glampIcon).not.toBeNull();
    expect(viewIcon).not.toBeNull();
    expect((lucide as Record<string, unknown>)[glampIcon as string]).toBeDefined();
    expect((lucide as Record<string, unknown>)[viewIcon as string]).toBeDefined();
  });

  it("[teeth] removing the GLAMP row from the seed block would fail the assertion above (proves the regex reads the real file)", () => {
    const withoutGlamp = masterDataBlock.replace(
      /\{\s*code:\s*'GLAMP',\s*group:\s*'Campground type',[^}]*\},?/,
      ""
    );
    const re = /\{\s*code:\s*'GLAMP',\s*group:\s*'Campground type'/;
    expect(withoutGlamp.match(re)).toBeNull(); // red without the row
    expect(masterDataBlock.match(re)).not.toBeNull(); // green with the real file
  });
});

/* -------------------------------------------------------------------------- */
/* BR-3 — AI tool jsonSchema teaches GLAMP/VIEW + Thai triggers               */
/* -------------------------------------------------------------------------- */

describe("searchCampsites/bulkAvailability jsonSchema — `type` teaches GLAMP/VIEW (AC-4, BR-3)", () => {
  it("[normal] searchCampsitesTool.jsonSchema.properties.type mentions GLAMP/VIEW + Thai trigger words", async () => {
    const { searchCampsitesTool } = await import("@/lib/ai/tools/search-campsites");
    const schema = searchCampsitesTool.jsonSchema as {
      properties: { type: { description: string } };
    };
    expect(schema.properties.type.description).toContain("GLAMP");
    expect(schema.properties.type.description).toContain("VIEW");
    expect(schema.properties.type.description).toContain("กลามปิ้ง");
    expect(schema.properties.type.description).toContain("แกลมปิ้ง");
    expect(schema.properties.type.description).toContain("glamping");
    expect(schema.properties.type.description).toContain("วิวสวย");
  });

  it("[normal] bulkAvailabilityTool.jsonSchema.properties.type mirrors the same GLAMP/VIEW teaching", async () => {
    const { bulkAvailabilityTool } = await import("@/lib/ai/tools/bulk-availability");
    const schema = bulkAvailabilityTool.jsonSchema as {
      properties: { type: { description: string } };
    };
    expect(schema.properties.type.description).toContain("GLAMP");
    expect(schema.properties.type.description).toContain("VIEW");
    expect(schema.properties.type.description).toContain("กลามปิ้ง");
    expect(schema.properties.type.description).toContain("วิวสวย");
  });
});

/* -------------------------------------------------------------------------- */
/* BR-4 — seed fixture has a discriminating (~8-20%) GLAMP/VIEW share        */
/* -------------------------------------------------------------------------- */

describe("mock-staging-all.json — GLAMP/VIEW seeded with a discriminating, non-dominant share (BR-4)", () => {
  interface MockCamp {
    campSiteType: string;
  }
  interface MockHost {
    campsites: MockCamp[];
  }
  const mockStagingAll = JSON.parse(read("prisma/data/mock-staging-all.json")) as {
    hosts: MockHost[];
  };
  const ALL_CAMPS = mockStagingAll.hosts.flatMap((h) => h.campsites);
  const total = ALL_CAMPS.length;
  const countOf = (code: string) => ALL_CAMPS.filter((c) => c.campSiteType === code).length;

  it("[boundary] GLAMP has >=1 backing camp and its share is within ~8-20% of the fixture", () => {
    const n = countOf("GLAMP");
    expect(n, "GLAMP has ZERO backing camps — a search for type=GLAMP would return empty").toBeGreaterThan(0);
    const pct = (n / total) * 100;
    expect(pct, `GLAMP share was ${pct.toFixed(1)}%, expected roughly 8-20%`).toBeGreaterThanOrEqual(5);
    expect(pct, `GLAMP share was ${pct.toFixed(1)}%, expected roughly 8-20%`).toBeLessThanOrEqual(25);
  });

  it("[boundary] VIEW has >=1 backing camp and its share is within ~8-20% of the fixture", () => {
    const n = countOf("VIEW");
    expect(n, "VIEW has ZERO backing camps — a search for type=VIEW would return empty").toBeGreaterThan(0);
    const pct = (n / total) * 100;
    expect(pct, `VIEW share was ${pct.toFixed(1)}%, expected roughly 8-20%`).toBeGreaterThanOrEqual(5);
    expect(pct, `VIEW share was ${pct.toFixed(1)}%, expected roughly 8-20%`).toBeLessThanOrEqual(25);
  });

  it("[normal] CAGD + CACP together still hold the majority of the fixture", () => {
    const combined = countOf("CAGD") + countOf("CACP");
    expect((combined / total) * 100).toBeGreaterThan(50);
  });
});
