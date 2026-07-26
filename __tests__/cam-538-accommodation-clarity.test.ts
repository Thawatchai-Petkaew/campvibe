/**
 * cam-538-accommodation-clarity.test.ts — CAM-538
 * (platform-hardening/taxonomy-ui-foundation)
 *
 * The owner opened the host form and could not tell the 6 accommodation-type
 * options apart. Two were real defects: `TSIT` (tent site) and `DISP`
 * (dispersed camping) both mean "camper brings their own tent" — the only
 * real difference is whether the ground is divided into marked pitches, and
 * neither label said so. `HCMP` ("Horse camp") is a US-origin
 * `AccommodationTypeEnum` member inherited from the original v1 spec with no
 * Thai camp relevance. Owner decision (2026-07-26): rename the 2 ambiguous
 * labels so the difference is IN THE NAME, add a one-line hint under every
 * option (i18n-only, no new MasterData column), and drop `HCMP` entirely —
 * 5 members remain.
 *
 * Layers:
 *  (a) every remaining AccommodationTypeEnum member has a seeded MasterData
 *      row + en/th `filter.<CODE>` + en/th `filterDescription.<CODE>`.
 *  (b) GUARD — HCMP appears in NO emitter: prisma/seed.ts (MasterData row +
 *      per-camp literals), prisma/seed-bookings.ts, scripts/gen-mock-data.mjs
 *      accomm pools, the committed mock-staging(-all).json fixtures, and
 *      lib/facility-icon-map.ts. Same parse-as-text precedent as
 *      cam-525/526/536 (never import prisma/seed.ts — it runs a live seed).
 *  (c) the marked-pitch (TSIT) vs no-marked-pitch (DISP) pair is
 *      distinguishable by NAME ALONE (not only the description).
 *  (d) source-inspection — CampgroundForm.tsx renders the per-option
 *      description; the toggle/selection logic is untouched.
 *  (e) removeAccommodationCode — whole-value-only CSV transform (Prove-It,
 *      red-first substring-corruption proof, the same trap class CAM-536
 *      guarded against).
 *  (f) runBackfill — idempotent whole-CSV DB backfill against a fake Prisma.
 *  (g) checkGuard — the backfill script's safety guard (ALLOW flag /
 *      DATABASE_URL / production-looking target), same pattern as
 *      cam-536's/cam-369's db-reset.mjs coverage.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import translations from "../locales/translations.json";
import { AccommodationTypeEnum } from "@/lib/validations/campsite";
import { getFacilityIcon } from "@/lib/facility-icon-map";
import {
  removeAccommodationCode,
  DROPPED_CODE,
  runBackfill,
  checkGuard,
} from "../scripts/backfill-cam-538-drop-horse-camp.mjs";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const enFilter = (translations as Record<string, Record<string, unknown>>).en.filter as Record<string, string>;
const thFilter = (translations as Record<string, Record<string, unknown>>).th.filter as Record<string, string>;
const enDesc = (translations as Record<string, Record<string, unknown>>).en.filterDescription as
  | Record<string, string>
  | undefined;
const thDesc = (translations as Record<string, Record<string, unknown>>).th.filterDescription as
  | Record<string, string>
  | undefined;

// ===========================================================================
// Ground truth — parse prisma/seed.ts as TEXT (never import: importing it
// would execute `main()`, a real Prisma seed run). Same extractor shape as
// cam-525/526/536.
// ===========================================================================
const seedSrc = src("prisma/seed.ts");
const seedStart = seedSrc.indexOf("const masterData = [");
const seedEnd = seedSrc.indexOf("\n]", seedStart);
const masterDataBlock = seedSrc.slice(seedStart, seedEnd);

function extractRows(block: string): Array<{ code: string; group: string; nameTh: string }> {
  const re = /\{\s*code:\s*'([A-Z0-9]+)',\s*group:\s*'([^']+)',\s*nameTh:\s*'([^']*)'/g;
  const rows: Array<{ code: string; group: string; nameTh: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) rows.push({ code: m[1], group: m[2], nameTh: m[3] });
  return rows;
}

const SEEDED_ROWS = extractRows(masterDataBlock);
const byCode = (code: string) => SEEDED_ROWS.find((r) => r.code === code);

// ===========================================================================
// (a) every remaining member is fully specified
// ===========================================================================
describe("CAM-538 (a) — every remaining AccommodationTypeEnum member is fully specified", () => {
  it("[normal] AccommodationTypeEnum is exactly CABI/DISP/GROU/RECR/TSIT (5 members, HCMP gone)", () => {
    expect(AccommodationTypeEnum.options.slice().sort()).toEqual(
      ["CABI", "DISP", "GROU", "RECR", "TSIT"].sort()
    );
    expect(AccommodationTypeEnum.options).not.toContain("HCMP");
  });

  it.each(AccommodationTypeEnum.options)("[normal] %s is seeded exactly once under group 'Accommodation type'", (code) => {
    const rows = SEEDED_ROWS.filter((r) => r.code === code);
    expect(rows, `expected exactly 1 MasterData row for "${code}", found ${rows.length}`).toHaveLength(1);
    expect(rows[0].group).toBe("Accommodation type");
    expect(rows[0].nameTh.length).toBeGreaterThan(0);
  });

  it.each(AccommodationTypeEnum.options)("[normal] %s has an en + th filter.<CODE> locale key", (code) => {
    expect(enFilter[code], `en.filter.${code} missing`).toBeDefined();
    expect(thFilter[code], `th.filter.${code} missing`).toBeDefined();
  });

  it.each(AccommodationTypeEnum.options)("[normal] %s has an en + th filterDescription.<CODE> one-line hint", (code) => {
    expect(enDesc?.[code], `en.filterDescription.${code} missing`).toBeDefined();
    expect(thDesc?.[code], `th.filterDescription.${code} missing`).toBeDefined();
    expect((enDesc as Record<string, string>)[code].length).toBeGreaterThan(0);
    expect((thDesc as Record<string, string>)[code].length).toBeGreaterThan(0);
  });

  it("[boundary] every description is a single short line, not a paragraph", () => {
    for (const code of AccommodationTypeEnum.options) {
      expect((thDesc as Record<string, string>)[code]).not.toMatch(/\n/);
      expect((enDesc as Record<string, string>)[code]).not.toMatch(/\n/);
      expect((thDesc as Record<string, string>)[code].length).toBeLessThanOrEqual(80);
    }
  });

  it("[teeth] the extractor reads the real file (a row absent from the block is absent from the result)", () => {
    const withoutTsit = masterDataBlock.replace(/\{\s*code:\s*'TSIT',[^}]*\},?/, "");
    expect(extractRows(withoutTsit).find((r) => r.code === "TSIT")).toBeUndefined();
    expect(byCode("TSIT")).toBeDefined(); // present in the real file
  });
});

// ===========================================================================
// (b) GUARD — HCMP appears in NO emitter (prisma/seed.ts is READ AS TEXT)
// ===========================================================================
describe("CAM-538 (b) — GUARD: HCMP appears in no emitter", () => {
  const VALID_CODES: Set<string> = new Set(AccommodationTypeEnum.options);

  it("[normal] HCMP is not a filter.<CODE> key in en or th", () => {
    expect(enFilter.HCMP).toBeUndefined();
    expect(thFilter.HCMP).toBeUndefined();
  });

  it("[normal] HCMP is not seeded under any MasterData group", () => {
    expect(byCode("HCMP")).toBeUndefined();
  });

  it("[normal] HCMP resolves to the ShieldCheck fallback (no FACILITY_ICON_MAP entry left)", () => {
    expect(getFacilityIcon("HCMP")).toBe(getFacilityIcon("NOT_A_REAL_CODE"));
  });

  it("[normal] lib/facility-icon-map.ts has no HCMP map entry", () => {
    const iconSrc = src("lib/facility-icon-map.ts");
    expect(iconSrc).not.toMatch(/\bHCMP:\s*\w+,/);
  });

  /** Extracts every per-camp `accommodationTypes: '<value>'` literal. */
  function extractCampLiterals(source: string): string[] {
    const re = /accommodationTypes:\s*'([^']*)'/g;
    const values: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) values.push(m[1]);
    return values;
  }

  it("[teeth] the extractor would catch a reintroduced HCMP literal", () => {
    const values = extractCampLiterals("accommodationTypes: 'HCMP',");
    expect(values).toEqual(["HCMP"]);
    expect(VALID_CODES.has(values[0])).toBe(false); // this is exactly the defect class this guard blocks
  });

  it("[normal, GUARD] every accommodationTypes literal in prisma/seed.ts is a member of AccommodationTypeEnum (no HCMP)", () => {
    const values = extractCampLiterals(seedSrc);
    expect(values.length).toBeGreaterThanOrEqual(1);
    const invalid = values.flatMap((v) =>
      v
        .split(",")
        .map((code) => code.trim())
        .filter((code) => code.length > 0 && !VALID_CODES.has(code))
    );
    expect(invalid, `invalid accommodationTypes code(s) found in prisma/seed.ts: ${invalid.join(", ")}`).toEqual([]);
  });

  it("[normal, GUARD] every accommodationTypes literal in prisma/seed-bookings.ts is a member of AccommodationTypeEnum", () => {
    const bookingsSrc = src("prisma/seed-bookings.ts");
    const values = extractCampLiterals(bookingsSrc);
    const invalid = values.flatMap((v) =>
      v
        .split(",")
        .map((code) => code.trim())
        .filter((code) => code.length > 0 && !VALID_CODES.has(code))
    );
    expect(invalid, `invalid accommodationTypes code(s) found in prisma/seed-bookings.ts: ${invalid.join(", ")}`).toEqual([]);
  });

  it("[normal, GUARD] every accomm[] pool entry in scripts/gen-mock-data.mjs is a member of AccommodationTypeEnum (no HCMP)", () => {
    const genSrc = src("scripts/gen-mock-data.mjs");
    const re = /accomm:\s*\[([^\]]*)\]/g;
    const invalid: string[] = [];
    let m: RegExpExecArray | null;
    let poolCount = 0;
    while ((m = re.exec(genSrc))) {
      poolCount++;
      const codes = m[1].match(/'([^']+)'/g)?.map((s) => s.slice(1, -1)) ?? [];
      for (const code of codes) {
        if (!VALID_CODES.has(code)) invalid.push(code);
      }
    }
    expect(poolCount).toBeGreaterThanOrEqual(6);
    expect(invalid, `invalid accomm[] code(s) found in scripts/gen-mock-data.mjs: ${invalid.join(", ")}`).toEqual([]);
  });

  it("[normal, GUARD] neither committed mock fixture carries a whole-value HCMP", () => {
    for (const file of ["prisma/data/mock-staging.json", "prisma/data/mock-staging-all.json"]) {
      const data = JSON.parse(src(file)) as {
        hosts: Array<{ campsites: Array<{ accommodationTypes?: string }> }>;
      };
      const camps = data.hosts.flatMap((h) => h.campsites);
      expect(camps.length).toBeGreaterThan(0);
      const offenders = camps.filter((c) =>
        (c.accommodationTypes ?? "")
          .split(",")
          .map((v) => v.trim())
          .includes("HCMP")
      );
      expect(offenders, `${file} still carries a whole-value HCMP on ${offenders.length} camp(s)`).toHaveLength(0);
    }
  });
});

// ===========================================================================
// (c) marked-pitch (TSIT) vs no-marked-pitch (DISP) — distinguishable by
// NAME ALONE, not only the description
// ===========================================================================
describe("CAM-538 (c) — TSIT (marked pitch) vs DISP (no marked pitch): distinguishable by name alone", () => {
  it("[normal] neither TH label is a substring of the other", () => {
    expect(thFilter.DISP.includes(thFilter.TSIT)).toBe(false);
    expect(thFilter.TSIT.includes(thFilter.DISP)).toBe(false);
  });

  it("[normal] neither EN label is a substring of the other", () => {
    expect(enFilter.DISP.includes(enFilter.TSIT)).toBe(false);
    expect(enFilter.TSIT.includes(enFilter.DISP)).toBe(false);
  });

  it("[normal] the TH labels name the load-bearing difference explicitly", () => {
    expect(thFilter.TSIT).toContain("แบ่งล็อค");
    expect(thFilter.DISP).toContain("ไม่แบ่งล็อค");
  });

  it("[normal] the EN labels name the load-bearing difference explicitly", () => {
    expect(enFilter.TSIT.toLowerCase()).toContain("marked pitch");
    expect(enFilter.DISP.toLowerCase()).toContain("no marked pitch");
  });

  it("[normal] each of the two carries its own, distinct description", () => {
    expect((thDesc as Record<string, string>).TSIT).not.toBe((thDesc as Record<string, string>).DISP);
    expect((enDesc as Record<string, string>).TSIT).not.toBe((enDesc as Record<string, string>).DISP);
  });
});

// ===========================================================================
// (d) Source-inspection — CampgroundForm.tsx renders the per-option
// description; the toggle/selection logic is untouched.
// ===========================================================================
describe("CAM-538 (d) — CampgroundForm.tsx renders the per-option description", () => {
  const formSrc = src("components/CampgroundForm.tsx");

  it("[normal] looks up t.filterDescription keyed by the option's code", () => {
    expect(formSrc).toMatch(/t\.filterDescription\?\.\[\s*opt\.code/);
  });

  it("[normal] conditionally renders the description text when present (no description = no empty row)", () => {
    expect(formSrc).toMatch(/\{description\s*&&/);
  });

  it("[normal] the selection/toggle logic is untouched — toggleArrayItem still drives onClick", () => {
    expect(formSrc).toContain("onClick={() => toggleArrayItem(fieldName, opt.code)}");
  });
});

// ===========================================================================
// (e) removeAccommodationCode — whole-value-only CSV transform (Prove-It)
// ===========================================================================
describe("CAM-538 (e) — removeAccommodationCode: whole-value-only, RED-FIRST substring proof", () => {
  it("[teeth, RED-FIRST] a naive global string replace WOULD corrupt a neighboring value that merely contains HCMP as a substring", () => {
    const naiveRemove = (csv: string) => csv.replace(/HCMP/g, "");
    // Proof that the naive approach is unsafe — NOT what the real
    // implementation does.
    expect(naiveRemove("XHCMPY,CABI")).toBe("XY,CABI");
  });

  it("[normal] the REAL whole-value transform leaves a neighboring value containing HCMP as a substring untouched", () => {
    expect(removeAccommodationCode("XHCMPY,CABI")).toBe("XHCMPY,CABI");
  });

  it("[normal] removes an exact whole-value HCMP", () => {
    expect(removeAccommodationCode("HCMP")).toBe("");
    expect(removeAccommodationCode("HCMP,CABI")).toBe("CABI");
    expect(removeAccommodationCode("CABI,HCMP")).toBe("CABI");
  });

  it("[boundary] HCMP in the middle of a 3-value CSV: neighbors + order preserved", () => {
    expect(removeAccommodationCode("GROU,HCMP,TSIT")).toBe("GROU,TSIT");
  });

  it("[null/empty] an empty string passes through unchanged", () => {
    expect(removeAccommodationCode("")).toBe("");
  });

  it("[normal] values never equal to HCMP pass through byte-identical", () => {
    expect(removeAccommodationCode("CABI,DISP,GROU,RECR,TSIT")).toBe("CABI,DISP,GROU,RECR,TSIT");
  });

  it("[normal] DROPPED_CODE is exactly 'HCMP'", () => {
    expect(DROPPED_CODE).toBe("HCMP");
  });

  it("[normal] running the transform twice equals running it once (function-level idempotence)", () => {
    const once = removeAccommodationCode("GROU,HCMP,TSIT");
    const twice = removeAccommodationCode(once);
    expect(once).toBe("GROU,TSIT");
    expect(twice).toBe(once);
  });
});

// ===========================================================================
// (f) runBackfill — idempotent whole-CSV DB backfill against a fake Prisma
// ===========================================================================
type FakeRow = { id: string; accommodationTypes: string };

function makeFakePrisma(rows: FakeRow[]) {
  const data: FakeRow[] = rows.map((r) => ({ ...r }));
  return {
    data,
    campSite: {
      findMany: async ({ where }: { where?: Record<string, unknown> }) => {
        if (!where) return data.map((d) => ({ ...d }));
        const containsClause = (where.accommodationTypes as { contains?: string } | undefined)?.contains;
        if (containsClause) {
          return data.filter((d) => d.accommodationTypes.includes(containsClause)).map((d) => ({ ...d }));
        }
        return data.map((d) => ({ ...d }));
      },
      update: async ({ where, data: patch }: { where: { id: string }; data: Partial<FakeRow> }) => {
        const row = data.find((d) => d.id === where.id);
        if (!row) throw new Error(`no row for id ${where.id}`);
        Object.assign(row, patch);
        return { ...row };
      },
    },
  };
}

describe("CAM-538 (f) — runBackfill: whole-CSV rewrite + idempotence (Prove-It)", () => {
  const seedRows: FakeRow[] = [
    { id: "c1", accommodationTypes: "HCMP" },
    { id: "c2", accommodationTypes: "GROU,HCMP" },
    { id: "c3", accommodationTypes: "HCMP,TSIT" },
    { id: "c4", accommodationTypes: "CABI,DISP" }, // untouched — no HCMP
    { id: "c5", accommodationTypes: "XHCMPY,CABI" }, // substring trap — must NOT be touched
    { id: "c6", accommodationTypes: "" }, // empty — must not throw
  ];

  it("[AC-3/EC-2/EC-3, teeth] first run removes HCMP whole-value only, preserves neighbors + order, never touches the substring-trap row", async () => {
    const fake = makeFakePrisma(seedRows);
    const result = await runBackfill(fake, { log: () => {} });

    expect(result.before).toBe(3); // c1, c2, c3
    expect(result.updated).toBe(3);

    expect(fake.data.find((r) => r.id === "c1")!.accommodationTypes).toBe("");
    expect(fake.data.find((r) => r.id === "c2")!.accommodationTypes).toBe("GROU");
    expect(fake.data.find((r) => r.id === "c3")!.accommodationTypes).toBe("TSIT");
    // untouched rows, byte-identical
    expect(fake.data.find((r) => r.id === "c4")!.accommodationTypes).toBe("CABI,DISP");
    expect(fake.data.find((r) => r.id === "c5")!.accommodationTypes).toBe("XHCMPY,CABI");
    expect(fake.data.find((r) => r.id === "c6")!.accommodationTypes).toBe("");

    expect(result.after).toBe(0);
  });

  it("[EC-4, teeth] a second run against the already-migrated data updates 0 rows (idempotent)", async () => {
    const fake = makeFakePrisma(seedRows);
    await runBackfill(fake, { log: () => {} }); // first run
    const before = fake.data.map((r) => ({ ...r }));

    const second = await runBackfill(fake, { log: () => {} }); // second run

    expect(second.updated).toBe(0);
    expect(second.before).toBe(0);
    expect(fake.data).toEqual(before); // byte-identical, nothing moved
  });
});

// ===========================================================================
// (g) checkGuard — refuses before touching any row (mirrors cam-536's /
// cam-369's db-reset.mjs coverage)
// ===========================================================================
describe("CAM-538 (g) — checkGuard: refuses a run missing opt-in / DATABASE_URL / a production-looking target", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("[error/validation] refuses when ALLOW_HORSE_CAMP_BACKFILL is unset", () => {
    vi.stubEnv("ALLOW_HORSE_CAMP_BACKFILL", "");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/campvibe_dev");
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("ALLOW_HORSE_CAMP_BACKFILL=1");
  });

  it("[error/validation] refuses when DATABASE_URL is unset", () => {
    vi.stubEnv("ALLOW_HORSE_CAMP_BACKFILL", "1");
    vi.stubEnv("DATABASE_URL", "");
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("DATABASE_URL is not set");
  });

  it("[error/validation] refuses when the target URL looks like production", () => {
    vi.stubEnv("ALLOW_HORSE_CAMP_BACKFILL", "1");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pw@prod-db.example.com:5432/campvibe");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "");
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("PRODUCTION");
  });

  it("[error/validation] refuses when NODE_ENV=production even if the URL looks safe", () => {
    vi.stubEnv("ALLOW_HORSE_CAMP_BACKFILL", "1");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/campvibe_dev");
    vi.stubEnv("NODE_ENV", "production");
    const result = checkGuard();
    expect(result.ok).toBe(false);
  });

  it("[normal] allows when opt-in + DATABASE_URL are set and the target does not look like production", () => {
    vi.stubEnv("ALLOW_HORSE_CAMP_BACKFILL", "1");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/campvibe_dev");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "");
    const result = checkGuard();
    expect(result.ok).toBe(true);
  });
});
