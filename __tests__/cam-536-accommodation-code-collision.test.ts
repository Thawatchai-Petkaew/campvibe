/**
 * cam-536-accommodation-code-collision.test.ts — CAM-536
 * (platform-hardening/taxonomy-ui-foundation)
 *
 * CAM-526 seeded the `Accommodation type` MasterData group but could only
 * place 4 of the 6 `AccommodationTypeEnum` members: `TENT` was already owned
 * by `group: 'Equipment for rent'` and `HORS` was already owned by
 * `group: 'Activity'` (`MasterData.code` is a global `@id`, not scoped per
 * group). Owner decision (2026-07-26): give the 2 colliding MEANINGS their
 * own distinct codes — `TENT`→`TSIT` ("Tent site"), `HORS`→`HCMP`
 * ("Horse camp") — and backfill the 486 (`TENT`) / 27 (`HORS`) existing
 * `CampSite.accommodationTypes` CSV rows already carrying the old codes
 * (dev DB, counted directly).
 *
 * Layers:
 *  (a) Prove-It on the backfill's pure transform — the CSV-substring trap
 *      (`.claude/rules/code.md` DEF-1/DEF-2 lesson class): a RED-FIRST case
 *      proves a naive global string replace would corrupt a neighboring
 *      value, then proves the real whole-value transform does not.
 *  (b) Prove-It on `runBackfill` against a fake Prisma client — idempotence
 *      (running twice updates 0 rows the second time) + the whole-CSV
 *      before/after counts.
 *  (c) source-parse coverage (same pattern as cam-525/526's own tests) —
 *      prisma/seed.ts and lib/validations/campsite.ts are READ AS TEXT,
 *      never imported as a live seed run; every AccommodationTypeEnum member
 *      has a seeded row + en/th i18n keys.
 *  (d) regression — the pre-existing, UNRELATED `Equipment for rent: TENT`
 *      and `Activity: HORS` rows are untouched by this seed edit.
 *  (e) the backfill script's safety guard (ALLOW flag / DATABASE_URL /
 *      production-looking target), same pattern as cam-369's db-reset.mjs
 *      coverage.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import translations from "../locales/translations.json";
import { AccommodationTypeEnum } from "@/lib/validations/campsite";
import { getFacilityIcon } from "@/lib/facility-icon-map";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

// ===========================================================================
// (a) renameAccommodationCsv — whole-value-only CSV transform (Prove-It)
// ===========================================================================
import {
  renameAccommodationCsv,
  CODE_RENAME_MAP,
  runBackfill,
  checkGuard,
} from "../scripts/backfill-cam-536-accommodation-codes.mjs";

describe("CAM-536 (a) — renameAccommodationCsv: whole-value-only, RED-FIRST substring proof", () => {
  it("[teeth, RED-FIRST] a naive global string replace WOULD corrupt a neighboring value that merely contains the old code as a substring (the failure mode this story guards against)", () => {
    const naiveReplace = (csv: string) => csv.replace(/TENT/g, "TSIT");
    // Proof that the naive approach is unsafe — NOT what the real
    // implementation does. If this assertion ever started failing, it would
    // mean .replace(/TENT/g,...) somehow stopped being a global substring
    // replace, which is exactly the bug class we're guarding against.
    expect(naiveReplace("STENT,CABI")).toBe("STSIT,CABI");
  });

  it("[normal] the REAL whole-value transform leaves a neighboring value containing the old code as a substring untouched (the fix for the RED-FIRST case above)", () => {
    expect(renameAccommodationCsv("STENT,CABI")).toBe("STENT,CABI");
    expect(renameAccommodationCsv("CABI,HORSE")).toBe("CABI,HORSE");
  });

  it("[normal] renames an exact whole-value TENT to TSIT", () => {
    expect(renameAccommodationCsv("TENT")).toBe("TSIT");
    expect(renameAccommodationCsv("TENT,CABI")).toBe("TSIT,CABI");
  });

  it("[normal] renames an exact whole-value HORS to HCMP", () => {
    expect(renameAccommodationCsv("HORS")).toBe("HCMP");
    expect(renameAccommodationCsv("HORS,GROU")).toBe("HCMP,GROU");
  });

  it("[boundary] both colliding codes in one CSV are renamed, order preserved", () => {
    expect(renameAccommodationCsv("TENT,HORS")).toBe("TSIT,HCMP");
    expect(renameAccommodationCsv("HORS,TENT")).toBe("HCMP,TSIT");
  });

  it("[null/empty] an empty string passes through unchanged", () => {
    expect(renameAccommodationCsv("")).toBe("");
  });

  it("[normal] values never in the rename map pass through byte-identical", () => {
    expect(renameAccommodationCsv("CABI,DISP,GROU,RECR")).toBe("CABI,DISP,GROU,RECR");
  });

  it("[normal] the rename map is exactly the 2 colliding codes, nothing else", () => {
    expect(CODE_RENAME_MAP).toEqual({ TENT: "TSIT", HORS: "HCMP" });
  });
});

// ===========================================================================
// (b) runBackfill — idempotent, whole-CSV DB backfill against a fake Prisma
// ===========================================================================
type FakeRow = { id: string; accommodationTypes: string };

function makeFakePrisma(rows: FakeRow[]) {
  const data: FakeRow[] = rows.map((r) => ({ ...r }));
  return {
    data,
    campSite: {
      findMany: async ({ where }: { where?: Record<string, unknown> }) => {
        if (!where) return data.map((d) => ({ ...d }));
        const orClauses = where.OR as Array<{ accommodationTypes?: { contains?: string } }> | undefined;
        if (orClauses) {
          const needles = orClauses.map((c) => c.accommodationTypes?.contains).filter(Boolean) as string[];
          return data
            .filter((d) => needles.some((needle) => d.accommodationTypes.includes(needle)))
            .map((d) => ({ ...d }));
        }
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

describe("CAM-536 (b) — runBackfill: whole-CSV rewrite + idempotence (Prove-It)", () => {
  const seedRows: FakeRow[] = [
    { id: "c1", accommodationTypes: "TENT" },
    { id: "c2", accommodationTypes: "TENT,CABI" },
    { id: "c3", accommodationTypes: "HORS,GROU" },
    { id: "c4", accommodationTypes: "TENT,HORS" },
    { id: "c5", accommodationTypes: "CABI,DISP" }, // untouched — no colliding code
    { id: "c6", accommodationTypes: "STENT,CABI" }, // substring trap — must NOT be touched
    { id: "c7", accommodationTypes: "" }, // empty — must NOT throw
  ];

  it("[AC-2/AC-3/EC-2/EC-3, teeth] first run rewrites exactly the rows carrying a whole-value old code, preserves neighbors + order, and never touches the substring-trap row", async () => {
    const fake = makeFakePrisma(seedRows);
    const result = await runBackfill(fake, { log: () => {} });

    expect(result.beforeTent).toBe(3); // c1, c2, c4
    expect(result.beforeHors).toBe(2); // c3, c4
    expect(result.updated).toBe(4); // c1, c2, c3, c4

    expect(fake.data.find((r) => r.id === "c1")!.accommodationTypes).toBe("TSIT");
    expect(fake.data.find((r) => r.id === "c2")!.accommodationTypes).toBe("TSIT,CABI");
    expect(fake.data.find((r) => r.id === "c3")!.accommodationTypes).toBe("HCMP,GROU");
    expect(fake.data.find((r) => r.id === "c4")!.accommodationTypes).toBe("TSIT,HCMP");
    // untouched rows, byte-identical
    expect(fake.data.find((r) => r.id === "c5")!.accommodationTypes).toBe("CABI,DISP");
    expect(fake.data.find((r) => r.id === "c6")!.accommodationTypes).toBe("STENT,CABI");
    expect(fake.data.find((r) => r.id === "c7")!.accommodationTypes).toBe("");

    expect(result.afterTent).toBe(0);
    expect(result.afterHors).toBe(0);
    expect(result.afterTsit).toBe(3);
    expect(result.afterHcmp).toBe(2);
  });

  it("[EC-4, teeth] a second run against the already-migrated data updates 0 rows (idempotent)", async () => {
    const fake = makeFakePrisma(seedRows);
    await runBackfill(fake, { log: () => {} }); // first run
    const before = fake.data.map((r) => ({ ...r }));

    const second = await runBackfill(fake, { log: () => {} }); // second run

    expect(second.updated).toBe(0);
    expect(second.beforeTent).toBe(0);
    expect(second.beforeHors).toBe(0);
    expect(fake.data).toEqual(before); // byte-identical, nothing moved
  });

  it("[normal] running the transform twice on a single value equals running it once (function-level idempotence)", () => {
    const once = renameAccommodationCsv("TENT,HORS,CABI");
    const twice = renameAccommodationCsv(once);
    expect(once).toBe("TSIT,HCMP,CABI");
    expect(twice).toBe(once); // TSIT/HCMP are not themselves in the rename map
  });
});

// ===========================================================================
// (e) checkGuard — refuses before touching any row (mirrors cam-369's
// db-reset.mjs coverage; scripts/db-reset.mjs's describeUrlShape is reused,
// not re-implemented)
// ===========================================================================
describe("CAM-536 (e) — checkGuard: refuses a run missing opt-in / DATABASE_URL / a production-looking target", () => {
  // NODE_ENV is typed `readonly` (next/types/global.d.ts augments
  // NodeJS.ProcessEnv) — vi.stubEnv is the established pattern in this repo
  // for mutating it under test (see cam-275-status-approve-chain.test.ts).
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("[error/validation] refuses when ALLOW_ACCOMMODATION_BACKFILL is unset", () => {
    vi.stubEnv("ALLOW_ACCOMMODATION_BACKFILL", "");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/campvibe_dev");
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("ALLOW_ACCOMMODATION_BACKFILL=1");
  });

  it("[error/validation] refuses when DATABASE_URL is unset", () => {
    vi.stubEnv("ALLOW_ACCOMMODATION_BACKFILL", "1");
    vi.stubEnv("DATABASE_URL", "");
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("DATABASE_URL is not set");
  });

  it("[error/validation] refuses when the target URL looks like production", () => {
    vi.stubEnv("ALLOW_ACCOMMODATION_BACKFILL", "1");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pw@prod-db.example.com:5432/campvibe");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "");
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("PRODUCTION");
  });

  it("[error/validation] refuses when NODE_ENV=production even if the URL looks safe", () => {
    vi.stubEnv("ALLOW_ACCOMMODATION_BACKFILL", "1");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/campvibe_dev");
    vi.stubEnv("NODE_ENV", "production");
    const result = checkGuard();
    expect(result.ok).toBe(false);
  });

  it("[normal] allows when opt-in + DATABASE_URL are set and the target does not look like production", () => {
    vi.stubEnv("ALLOW_ACCOMMODATION_BACKFILL", "1");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/campvibe_dev");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "");
    const result = checkGuard();
    expect(result.ok).toBe(true);
  });
});

// ===========================================================================
// (c) Ground truth — parse prisma/seed.ts as TEXT (never import: importing
// it would execute `main()`, a real Prisma seed run). Same extractor shape
// as cam-525/cam-526.
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

describe("CAM-536 (c) — every AccommodationTypeEnum member has a seeded row + en/th i18n keys", () => {
  // CAM-538 amended this pin: HCMP (itself this story's rename target for
  // HORS) was dropped entirely by CAM-538 (no Thai relevance) — 5 members
  // remain. See __tests__/cam-538-accommodation-clarity.test.ts.
  it("[normal] AccommodationTypeEnum is exactly CABI/DISP/GROU/RECR/TSIT (HORS/TENT/HCMP are gone)", () => {
    expect(AccommodationTypeEnum.options.slice().sort()).toEqual(
      ["CABI", "DISP", "GROU", "RECR", "TSIT"].sort()
    );
    expect(AccommodationTypeEnum.options).not.toContain("HORS");
    expect(AccommodationTypeEnum.options).not.toContain("TENT");
  });

  it.each(AccommodationTypeEnum.options)("[normal] %s is seeded exactly once under group 'Accommodation type'", (code) => {
    const rows = SEEDED_ROWS.filter((r) => r.code === code);
    expect(rows, `expected exactly 1 MasterData row for "${code}", found ${rows.length}`).toHaveLength(1);
    expect(rows[0].group).toBe("Accommodation type");
    expect(rows[0].nameTh.length).toBeGreaterThan(0);
  });

  it.each(AccommodationTypeEnum.options)("[normal] %s has an en + th filter.<CODE> locale key", (code) => {
    const enFilter = (translations as Record<string, Record<string, unknown>>).en.filter as Record<string, string>;
    const thFilter = (translations as Record<string, Record<string, unknown>>).th.filter as Record<string, string>;
    expect(enFilter[code], `en.filter.${code} missing`).toBeDefined();
    expect(thFilter[code], `th.filter.${code} missing`).toBeDefined();
  });

  // CAM-538 dropped HCMP from this each() — it no longer resolves to a real
  // icon (correctly falls back to ShieldCheck now that the code is retired).
  it.each(["TSIT"])("[normal] the new code %s resolves to a real FACILITY_ICON_MAP entry (not the ShieldCheck fallback)", (code) => {
    expect(getFacilityIcon(code)).not.toBe(getFacilityIcon("NOT_A_REAL_CODE"));
  });

  it("[teeth] the extractor reads the real file (a row absent from the block is absent from the result)", () => {
    const withoutTsit = masterDataBlock.replace(/\{\s*code:\s*'TSIT',[^}]*\},?/, "");
    expect(extractRows(withoutTsit).find((r) => r.code === "TSIT")).toBeUndefined();
    expect(byCode("TSIT")).toBeDefined(); // present in the real file
  });
});

// ===========================================================================
// (d) Regression — the pre-existing, UNRELATED Equipment/Activity rows are
// untouched by this seed edit (this is BR-2/AC-5 — the whole point of
// renaming rather than reusing the old codes)
// ===========================================================================
describe("CAM-536 (d) — Equipment:TENT and Activity:HORS are UNCHANGED by this story", () => {
  it("[regression] TENT still resolves to its real, pre-existing group ('Equipment for rent'), unmoved", () => {
    const row = byCode("TENT");
    expect(row).toBeDefined();
    expect(row!.group).toBe("Equipment for rent");
    expect(row!.nameTh).toBe("เต็นท์");
  });

  it("[regression] HORS still resolves to its real, pre-existing group ('Activity'), unmoved", () => {
    const row = byCode("HORS");
    expect(row).toBeDefined();
    expect(row!.group).toBe("Activity");
    expect(row!.nameTh).toBe("ขี่ม้า");
  });

  it("[teeth] exactly one MasterData row exists per code (code is a global @id — a collision would show as 2+ rows)", () => {
    const counts = new Map<string, number>();
    for (const r of SEEDED_ROWS) counts.set(r.code, (counts.get(r.code) ?? 0) + 1);
    expect(counts.get("TENT")).toBe(1);
    expect(counts.get("HORS")).toBe(1);
    expect(counts.get("TSIT")).toBe(1);
    // CAM-538 dropped HCMP entirely — no row remains under any group.
    expect(counts.get("HCMP")).toBeUndefined();
  });

  it("[regression] the pre-existing en/th i18n keys for TENT/HORS (owned by Equipment/Activity) are unchanged", () => {
    const enFilter = (translations as Record<string, Record<string, unknown>>).en.filter as Record<string, string>;
    const thFilter = (translations as Record<string, Record<string, unknown>>).th.filter as Record<string, string>;
    expect(enFilter.TENT).toBe("Tent");
    expect(thFilter.TENT).toBe("เต็นท์");
    expect(enFilter.HORS).toBe("Horseback riding");
    expect(thFilter.HORS).toBe("ขี่ม้า");
  });
});

// ===========================================================================
// (f) GUARD — no per-camp `accommodationTypes` literal anywhere in
// prisma/seed.ts (or prisma/seed-bookings.ts) may emit a code that is not a
// member of AccommodationTypeEnum. This is the guard that would have caught
// the real CI defect this story's follow-up fix addressed: CAM-526/536
// renamed the enum's collision codes (TENT->TSIT, HORS->HCMP) in
// lib/validations/campsite.ts and the MasterData rows in prisma/seed.ts, but
// the seed file's own PER-CAMP `accommodationTypes: 'TENT'` literals (12
// occurrences, unrelated to the masterData array) were missed on the first
// pass — every seeded camp then carried a value its own validator rejected,
// and CI's e2e regression (which seeds a FRESH database from this exact
// file) failed 4 specs waiting on a PUT/save the validator silently blocked.
// Parses prisma/seed.ts (and prisma/seed-bookings.ts) AS TEXT — never
// imports it (importing prisma/seed.ts executes `main()`, a real Prisma seed
// run) — same extractor precedent as cam-525/526's own coverage tests.
// ===========================================================================
describe("CAM-536 (f) — GUARD: every accommodationTypes literal in prisma/seed*.ts is a valid AccommodationTypeEnum member", () => {
  const VALID_CODES: Set<string> = new Set(AccommodationTypeEnum.options);

  /**
   * Extracts every `accommodationTypes: '<value>'` PER-CAMP literal (the
   * CampSite-creation shape) from a seed source string — deliberately a
   * DIFFERENT regex shape than the masterData-array extractor above (which
   * requires a sibling `group:` key) so it can never accidentally match a
   * MasterData row.
   */
  function extractCampLiterals(source: string): string[] {
    const re = /accommodationTypes:\s*'([^']*)'/g;
    const values: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) values.push(m[1]);
    return values;
  }

  it("[teeth] the extractor actually reads real literals from prisma/seed.ts (non-trivial count)", () => {
    const values = extractCampLiterals(seedSrc);
    expect(values.length).toBeGreaterThanOrEqual(12);
  });

  it("[teeth] the extractor would have caught the real CI defect: a stale 'TENT' literal is detected as invalid", () => {
    const withStaleLiteral = "accommodationTypes: 'TENT',";
    const values = extractCampLiterals(withStaleLiteral);
    expect(values).toEqual(["TENT"]);
    expect(VALID_CODES.has(values[0])).toBe(false); // this is exactly what shipped broken
  });

  it("[normal, GUARD] every accommodationTypes literal in prisma/seed.ts is a member of AccommodationTypeEnum (whole-value, comma-split for a future CSV literal)", () => {
    const values = extractCampLiterals(seedSrc);
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
    expect(values.length).toBeGreaterThanOrEqual(1);
    const invalid = values.flatMap((v) =>
      v
        .split(",")
        .map((code) => code.trim())
        .filter((code) => code.length > 0 && !VALID_CODES.has(code))
    );
    expect(invalid, `invalid accommodationTypes code(s) found in prisma/seed-bookings.ts: ${invalid.join(", ")}`).toEqual([]);
  });

  it("[normal, GUARD] every accomm[] pool entry in scripts/gen-mock-data.mjs is a member of AccommodationTypeEnum", () => {
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

  it("[normal, GUARD] the fallback default in scripts/load-mock-staging.mjs is a member of AccommodationTypeEnum", () => {
    const loaderSrc = src("scripts/load-mock-staging.mjs");
    const re = /accommodationTypes:\s*camp\.accommodationTypes\s*\?\?\s*'([^']+)'/g;
    const fallbacks: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(loaderSrc))) fallbacks.push(m[1]);
    expect(fallbacks.length).toBeGreaterThanOrEqual(1);
    for (const fallback of fallbacks) {
      expect(VALID_CODES.has(fallback), `invalid fallback default "${fallback}" in scripts/load-mock-staging.mjs`).toBe(true);
    }
  });
});
