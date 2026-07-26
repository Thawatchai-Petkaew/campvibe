/**
 * cam-526-accommodation-types.test.ts — CAM-526 (S10, taxonomy-ui-foundation)
 *
 * `accommodationTypes` was fully wired in the middle (zod `AccommodationTypeEnum`,
 * POST write, edit prefill) but dead on both ends: the host form rendered
 * nothing (the `Accommodation type` MasterData group was never seeded), the
 * detail page had no display section, and the PUT route's `?.length` guard
 * treated an intentional "host cleared every selection" (`[]`) the same as
 * "field omitted" — a previously-set value could never be removed (the
 * CAM-341/CAM-360 collapse-to-skip bug class).
 *
 * This story seeds 4 of the 6 `AccommodationTypeEnum` members (CABI/DISP/
 * GROU/RECR) — `HORS`/`TENT` collide with a pre-existing MasterData code in
 * an UNRELATED group (`MasterData.code` is a global `@id`, not scoped per
 * group) and are deliberately excluded (see story.md BR-2). An invariant
 * test below proves the seed change never mutates those unrelated rows.
 *
 * Layer: (a) Prove-It integration test against the real PUT handler with a
 * mocked Prisma (same pattern as cam-360-logo-clear-persists.test.ts) —
 * failing FIRST against the pre-fix source (see the git-stash proof noted
 * in the PR description), green after; (b) source-parse coverage (same
 * pattern as cam-525-icon-i18n-coverage.test.ts) — prisma/seed.ts is READ AS
 * TEXT, never imported (importing it would execute `main()`, a real Prisma
 * seed run); (c) a real jsdom render of OptionGroupSection with the safe
 * codes (same pattern as cam-528-detail-taxonomy.test.ts Section A) +
 * source-inspection of the detail-page wiring.
 *
 * AC coverage matrix:
 *   AC-1  seeding alone brings the (unmodified) host-form picker to life
 *   AC-2  detail page shows a labeled tile per stored code, never the raw code
 *   AC-3  PUT accommodationTypes:[] clears the column (Prove-It)
 *   AC-4  the GLAMP nameTh typo is gone from the seed source
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { NextRequest } from "next/server";
import translations from "../locales/translations.json";
import { OptionGroupSection } from "@/components/ui/option-group-section";
import { getFacilityIcon } from "@/lib/facility-icon-map";
import { csvToArray, arrayToCsv } from "@/lib/api-utils";
import { AccommodationTypeEnum, campSiteSchema } from "@/lib/validations/campsite";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

afterEach(() => {
  cleanup();
});

// ===========================================================================
// Ground truth — parse prisma/seed.ts as TEXT (never import: importing runs
// `main()`, a real Prisma seed). Same extractor shape as cam-525's.
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

describe("CAM-526 setup — the seed parse actually reads real rows", () => {
  it("[normal] extracts a non-trivial row list from prisma/seed.ts", () => {
    expect(SEEDED_ROWS.length).toBeGreaterThan(50);
  });

  it("[teeth] the extractor reads the real file (a row absent from the block is absent from the result)", () => {
    const withoutCabi = masterDataBlock.replace(/\{\s*code:\s*'CABI',[^}]*\},?/, "");
    expect(extractRows(withoutCabi).find((r) => r.code === "CABI")).toBeUndefined();
    expect(byCode("CABI")).toBeDefined(); // present in the real file
  });
});

// ===========================================================================
// AC-1/BR-1 — the 4 non-colliding AccommodationTypeEnum members are seeded
// under group 'Accommodation type', each with a real name + icon.
// ===========================================================================
describe("CAM-526 (AC-1/BR-1) — the 4 safe AccommodationTypeEnum codes are seeded", () => {
  const SAFE_CODES = ["CABI", "DISP", "GROU", "RECR"] as const;

  it.each(SAFE_CODES)("[normal] %s is seeded under group 'Accommodation type'", (code) => {
    const row = byCode(code);
    expect(row, `no MasterData row seeded for "${code}"`).toBeDefined();
    expect(row!.group).toBe("Accommodation type");
    expect(row!.nameTh.length).toBeGreaterThan(0);
  });

  it.each(SAFE_CODES)("[normal] %s has an en + th filter.<CODE> locale key", (code) => {
    const enFilter = (translations as Record<string, Record<string, unknown>>).en.filter as Record<string, string>;
    const thFilter = (translations as Record<string, Record<string, unknown>>).th.filter as Record<string, string>;
    expect(enFilter[code], `en.filter.${code} missing`).toBeDefined();
    expect(thFilter[code], `th.filter.${code} missing`).toBeDefined();
  });

  it("[normal] the group label 'Accommodation type' already exists in both locales (unchanged by this story)", () => {
    const enFilter = (translations as Record<string, Record<string, unknown>>).en.filter as Record<string, string>;
    const thFilter = (translations as Record<string, Record<string, unknown>>).th.filter as Record<string, string>;
    expect(enFilter["Accommodation type"]).toBeDefined();
    expect(thFilter["Accommodation type"]).toBeDefined();
  });

  it("[normal] the seeded icon name for each safe code resolves via ICON_BY_NAME (host-form path, not the HelpCircle fallback)", () => {
    // Mirrors the CAM-525 icon-name coverage precedent, scoped to this story's rows.
    const iconByCode: Record<string, string> = {};
    const re = /\{\s*code:\s*'(CABI|DISP|GROU|RECR)',[^}]*icon:\s*'([^']+)'/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(masterDataBlock))) iconByCode[m[1]] = m[2];
    expect(Object.keys(iconByCode).sort()).toEqual(SAFE_CODES.slice().sort());
  });

  it.each(SAFE_CODES)("[normal] %s resolves to a real FACILITY_ICON_MAP entry (detail-page path, not the ShieldCheck fallback — required by the pre-existing CAM-525 coverage guard)", (code) => {
    expect(getFacilityIcon(code)).not.toBe(getFacilityIcon("NOT_A_REAL_CODE"));
  });
});

// ===========================================================================
// BR-2 (real conflict, not assumed) — HORS/TENT are excluded from this
// seeding; the seed change must NEVER mutate their pre-existing, unrelated
// MasterData rows (the actual failure mode of a naive upsert-by-code).
// ===========================================================================
describe("CAM-526 (BR-2) — HORS/TENT collision: excluded here, unrelated rows untouched", () => {
  it("[normal] every AccommodationTypeEnum member is accounted for: all 6 now seeded (CAM-536 supersedes the 4-of-6/2-excluded state this test originally pinned — HORS/TENT were renamed to HCMP/TSIT, see cam-536-accommodation-code-collision.test.ts)", () => {
    const allMembers = AccommodationTypeEnum.options;
    expect(allMembers.sort()).toEqual(["CABI", "DISP", "GROU", "HCMP", "RECR", "TSIT"].sort());
    const seededUnderAccommodation = SEEDED_ROWS.filter((r) => r.group === "Accommodation type").map((r) => r.code);
    expect(seededUnderAccommodation.sort()).toEqual(allMembers.slice().sort());
    const excluded = allMembers.filter((m) => !seededUnderAccommodation.includes(m));
    expect(excluded).toEqual([]); // CAM-536: nothing excluded anymore
  });

  it("[regression] HORS still resolves to its real, pre-existing group ('Activity'), not moved by this seed change", () => {
    const row = byCode("HORS");
    expect(row).toBeDefined();
    expect(row!.group).toBe("Activity");
  });

  it("[regression] TENT still resolves to its real, pre-existing group ('Equipment for rent'), not moved by this seed change", () => {
    const row = byCode("TENT");
    expect(row).toBeDefined();
    expect(row!.group).toBe("Equipment for rent");
  });

  it("[teeth] exactly one MasterData row exists per code (code is a global @id — a collision would show as 2 rows)", () => {
    const counts = new Map<string, number>();
    for (const r of SEEDED_ROWS) counts.set(r.code, (counts.get(r.code) ?? 0) + 1);
    expect(counts.get("HORS")).toBe(1);
    expect(counts.get("TENT")).toBe(1);
    expect(counts.get("CABI")).toBe(1);
  });
});

// ===========================================================================
// AC-4 — the GLAMP nameTh typo ('กลามปิ้ง' -> 'แกลมปิ้ง') is fixed in the seed
// ===========================================================================
describe("CAM-526 (AC-4) — GLAMP nameTh transliteration fix", () => {
  it("[normal] the seed's GLAMP row uses the corrected 'แกลมปิ้ง', never the old typo", () => {
    const row = byCode("GLAMP");
    expect(row).toBeDefined();
    expect(row!.nameTh).toBe("แกลมปิ้ง");
  });

  it("[regression] the misspelled 'กลามปิ้ง' string is gone from the seed source entirely", () => {
    expect(seedSrc).not.toContain("กลามปิ้ง");
  });

  it("[normal] the seed's GLAMP nameTh now matches the already-corrected locales/translations.json th key (CAM-531)", () => {
    const thFilter = (translations as Record<string, Record<string, unknown>>).th.filter as Record<string, string>;
    expect(thFilter.GLAMP).toBe(byCode("GLAMP")!.nameTh);
  });
});

// ===========================================================================
// AC-3 — PUT /api/campsites/[id]: accommodationTypes clearing fix (Prove-It)
// ===========================================================================
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campSite: { update: vi.fn(), findUnique: vi.fn() },
    location: { update: vi.fn() },
    spot: { count: vi.fn() },
  },
}));

vi.mock("@/lib/auth-utils", () => ({
  requireCampSitePermission: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { requireCampSitePermission } from "@/lib/auth-utils";
import { PUT as campSitePUT } from "@/app/api/campsites/[id]/route";

const CAMP_ID = "550e8400-e29b-41d4-a716-446655440526";
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function mockAllowed() {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: null,
    campSite: { id: CAMP_ID, operatorId: "op-1", isPublished: false } as never,
    session: { user: { id: "op-1" } } as never,
  });
}

function putRequest(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/campsites/${CAMP_ID}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("PUT /api/campsites/[id] — accommodationTypes clearing (AC-3, Prove-It; the CAM-341/360 bug class)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllowed();
    (prisma.campSite.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMP_ID,
      nameThSlug: "slug-th",
      nameEnSlug: "slug-en",
    });
  });

  it("[AC-3, teeth] an explicit empty array CLEARS the column to '' (this is the repro that was RED before the fix — the old `?.length` guard silently skipped the write)", async () => {
    const res = await campSitePUT(putRequest({ accommodationTypes: [] }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect("accommodationTypes" in call.data).toBe(true);
    expect(call.data.accommodationTypes).toBe("");
  });

  it("[normal] a non-empty array writes the joined CSV string", async () => {
    await campSitePUT(putRequest({ accommodationTypes: ["CABI", "GROU"] }), makeParams(CAMP_ID));

    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.accommodationTypes).toBe("CABI,GROU");
  });

  it("[EC-3/regression] omitting the accommodationTypes key entirely never touches the column (a price-only edit)", async () => {
    await campSitePUT(putRequest({ priceLow: 900 }), makeParams(CAMP_ID));

    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.priceLow).toBe(900);
    expect("accommodationTypes" in call.data).toBe(false);
  });

  it("[error/validation] an unknown accommodation code is rejected 400, no write", async () => {
    const res = await campSitePUT(putRequest({ accommodationTypes: ["NOTREAL"] }), makeParams(CAMP_ID));

    expect(res.status).toBe(400);
    expect(prisma.campSite.update).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// BR-3 — the TWO pitfalls this fix specifically works around: (1) zod's
// `.default([])` makes the PARSED value always-present even when the key is
// OMITTED, so the route must gate on RAW BODY presence, never `data.x !==
// undefined`; (2) `arrayToCsv([])` returns `undefined`, which Prisma treats
// as "leave untouched", so an explicit clear must coalesce to `''`.
// ===========================================================================
describe("CAM-526 (BR-3) — the zod-default pitfall: an omitted key still parses to [], not undefined", () => {
  it("[teeth] campSiteSchema.partial() defaults accommodationTypes to [] even when the key is completely absent from the input (proves `data.x !== undefined` would be the WRONG guard here)", () => {
    const result = campSiteSchema.partial().safeParse({ priceLow: 900 });
    expect(result.success).toBe(true);
    if (result.success) {
      // The key was never in the input, yet the parsed value is [] — not
      // undefined. A guard of `data.accommodationTypes !== undefined` would
      // therefore ALWAYS be true and wipe the column on every unrelated edit.
      expect(result.data.accommodationTypes).toEqual([]);
    }
  });

  it("[regression] the route reads presence off the RAW parsed body ('accommodationTypes' in body), matching the established replacesOptions pattern for the same pitfall", () => {
    const routeSrc = src("app/api/campsites/[id]/route.ts");
    expect(routeSrc).toContain("'accommodationTypes' in body &&");
    expect(routeSrc).not.toMatch(/data\.accommodationTypes\s*!==\s*undefined/);
    expect(routeSrc).not.toContain("data.accommodationTypes?.length");
  });
});

describe("CAM-526 (BR-3) — arrayToCsv([]) returns undefined; the route must coalesce to '' to actually clear", () => {
  it("[boundary] arrayToCsv([]) is undefined (not ''), which Prisma would otherwise treat as untouched", () => {
    expect(arrayToCsv([])).toBeUndefined();
  });

  it("[normal] arrayToCsv(['CABI']) still joins normally", () => {
    expect(arrayToCsv(["CABI"])).toBe("CABI");
  });

  it("[normal] csvToArray('') returns an empty array (round-trip symmetry with the cleared column)", () => {
    expect(csvToArray("")).toEqual([]);
  });
});

// ===========================================================================
// AC-2/BR-4 — detail page: OptionGroupSection render + the wiring source
// ===========================================================================
const getLabel = (code: string) => (translations.th.filter as Record<string, string>)[code] || code;
const getIcon = (code: string) => {
  const Icon = getFacilityIcon(code);
  return React.createElement(Icon, { className: "w-8 h-8 text-muted-foreground stroke-[1.2]" });
};

describe("CAM-526 (AC-2) — detail page renders localized Accommodation-type tiles for a CSV value", () => {
  it("[normal] a camp with accommodationTypes='CABI,GROU' renders both real Thai labels, never the raw code", () => {
    const codes = csvToArray("CABI,GROU");
    const { container } = render(
      React.createElement(OptionGroupSection, {
        heading: translations.th.filter["Accommodation type"],
        codes,
        getLabel,
        getIcon,
      })
    );

    expect(screen.getByRole("heading", { name: "ประเภทที่พัก" })).toBeTruthy();
    expect(screen.getByText("กระท่อม")).toBeTruthy(); // CABI
    expect(screen.getByText("ที่พักแบบกลุ่ม")).toBeTruthy(); // GROU
    expect(container.textContent).not.toContain("CABI");
    expect(container.textContent).not.toContain("GROU");
  });

  it("[null/empty] a camp with an empty accommodationTypes CSV renders nothing (no heading, no empty grid)", () => {
    const codes = csvToArray("");
    const { container } = render(
      React.createElement(OptionGroupSection, {
        heading: "ไม่ควรเห็น",
        codes,
        getLabel,
        getIcon,
      })
    );
    expect(codes).toEqual([]);
    expect(container.innerHTML).toBe("");
  });

  it("[boundary] a single stored code renders exactly one tile", () => {
    const codes = csvToArray("RECR");
    render(
      React.createElement(OptionGroupSection, {
        heading: translations.th.filter["Accommodation type"],
        codes,
        getLabel,
        getIcon,
      })
    );
    expect(screen.getByText("รถบ้าน (RV)")).toBeTruthy();
    expect(screen.getAllByRole("heading").length).toBe(1);
  });
});

describe("CampgroundDetailClient.tsx — Accommodation-type section wiring (AC-2, BR-4)", () => {
  const detailSrc = src("components/CampgroundDetailClient.tsx");

  it("[normal] parses the scalar CSV column via the shared csvToArray helper (never hand-split)", () => {
    expect(detailSrc).toMatch(/import\s*\{\s*csvToArray\s*\}\s*from\s*["']@\/lib\/api-utils["']/);
    expect(detailSrc).toContain("csvToArray(campground.accommodationTypes)");
  });

  it("[normal] the section is gated on accommodationCodes.length > 0, uses OptionGroupSection + t.filter[\"Accommodation type\"]", () => {
    expect(detailSrc).toContain("{accommodationCodes.length > 0 && (");
    expect(detailSrc).toContain('data-testid="section--accommodation-types"');
    expect(detailSrc).toContain('heading={t.filter["Accommodation type"]}');
    expect(detailSrc).toContain("codes={accommodationCodes}");
  });

  it("[teeth] mutating the real gate text away from the source makes the assertion fail (proves it reads the real file)", () => {
    const mutated = detailSrc.replace("{accommodationCodes.length > 0 && (", "{false && (");
    expect(mutated).not.toContain("{accommodationCodes.length > 0 && (");
    expect(detailSrc).toContain("{accommodationCodes.length > 0 && ("); // still true of the real file
  });

  it("[regression] CampgroundForm.tsx is untouched by this story (seeding alone brings the picker to life)", () => {
    const formSrc = src("components/CampgroundForm.tsx");
    expect(formSrc).toContain(
      'renderOptionGroup(t.filter["Accommodation type"], "Accommodation type", "accommodationTypes")'
    );
  });
});
