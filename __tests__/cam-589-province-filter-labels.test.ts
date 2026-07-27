/**
 * cam-589-province-filter-labels.test.ts — CAM-589
 *
 * "The province filter lists provinces in the chosen language" — the
 * province dropdown showed Amnat Charoen / Ang Thong / Bangkok in ENGLISH
 * even when the UI language was Thai, because `getSearchProvinces()`
 * returned a bare `string[]` built straight from the raw (always-English)
 * `Location.province` free-text column, and `SearchModal.tsx` rendered
 * those strings verbatim as option labels.
 *
 * Fix: `getSearchProvinces()` now returns `SearchProvinceOption[]`
 * ({ id, nameTh, nameEn }), resolved against the AdminArea PROVINCE node
 * set (batched, one query — CAM-553's imported hierarchy). The SUBMITTED
 * value (`nameEn`) stays byte-identical to the raw province string — the
 * smaller, safer option over moving the filter path onto ids (see
 * story.md's decision record) — because `lib/campsite-filters.ts` still
 * matches province by exact string equality (BR-2, the trap this whole arc
 * has been about: change the submitted value without changing the matcher
 * and the catalog returns zero results, silently).
 *
 * Coverage matrix (.claude/rules/qa.md §7):
 *   AC-1 (normal)     a raw province string that matches an AdminArea
 *                     PROVINCE node (case-insensitive) returns nameTh/nameEn
 *                     from that node.
 *   AC-1 (structural) exactly ONE `adminArea.findMany` call regardless of
 *                     how many distinct provinces are offered (no N+1).
 *   AC-2 (unit)       BR-2 value fidelity — `nameEn` round-trips through
 *                     `buildCampSiteWhere` byte-identical to the raw string.
 *   AC-2 (boundary)   a raw province with NO AdminArea match falls back to
 *                     itself for both id and nameTh (defensive; never a
 *                     crash, never blocks the option from being offered).
 *   canary            "Chiang Mai" (the arc's numeric canary — measured at
 *                     18 camps in the dev DB, see story.md) still resolves
 *                     with its real Thai label through this exact pipeline.
 *   SearchModal (structural) the label renders by active language, the
 *                     value stays `nameEn`, and the list sorts via
 *                     `Intl.Collator` keyed to the active language (not
 *                     always English order with a translated label pasted
 *                     on top).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { buildCampSiteWhere } from "@/lib/campsite-filters";

const mockCampSiteFindMany = vi.fn();
const mockAdminAreaFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    campSite: {
      findMany: (...args: unknown[]) => mockCampSiteFindMany(...args),
    },
    adminArea: {
      findMany: (...args: unknown[]) => mockAdminAreaFindMany(...args),
    },
  },
}));

const { getSearchProvinces } = await import("@/app/actions/getSearchLocations");

function campWithProvince(province: string | null) {
  return { location: { province } };
}

const PROVINCE_AREAS = [
  { id: "aa-chiang-mai", nameTh: "เชียงใหม่", nameEn: "Chiang Mai" },
  { id: "aa-krabi", nameTh: "กระบี่", nameEn: "Krabi" },
];

beforeEach(() => {
  mockCampSiteFindMany.mockReset();
  mockAdminAreaFindMany.mockReset();
  mockAdminAreaFindMany.mockResolvedValue(PROVINCE_AREAS);
});

describe("AC-1 — getSearchProvinces() resolves the AdminArea node (id + nameTh + nameEn), not a bare string", () => {
  it("[normal] a raw province matching an AdminArea PROVINCE node returns its real id/nameTh/nameEn", async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([campWithProvince("Chiang Mai")]);

    const result = await getSearchProvinces();
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("unreachable");

    expect(result.provinces).toEqual([
      { id: "aa-chiang-mai", nameTh: "เชียงใหม่", nameEn: "Chiang Mai" },
    ]);
  });

  it("[normal] matching is case-insensitive against AdminArea.nameEn", async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([campWithProvince("chiang mai")]);

    const result = await getSearchProvinces();
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("unreachable");

    expect(result.provinces[0].nameTh).toBe("เชียงใหม่");
    // BR-2 — the SUBMITTED value stays the exact raw casing from the DB, never
    // normalized to the AdminArea node's canonical casing.
    expect(result.provinces[0].nameEn).toBe("chiang mai");
  });

  it("[structural] resolves every province with ONE adminArea.findMany call, never one call per distinct province (no N+1)", async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([
      campWithProvince("Chiang Mai"),
      campWithProvince("Krabi"),
      campWithProvince("Chiang Mai"),
    ]);

    await getSearchProvinces();

    expect(mockAdminAreaFindMany).toHaveBeenCalledTimes(1);
    expect(mockAdminAreaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryCode: "TH", level: "PROVINCE" } })
    );
  });

  it("[null/empty] zero matching camps skips the AdminArea lookup entirely (nothing to resolve)", async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);

    const result = await getSearchProvinces();
    expect(result).toEqual({ status: "ok", provinces: [] });
    expect(mockAdminAreaFindMany).not.toHaveBeenCalled();
  });
});

describe("AC-2 / BR-2 — the submitted value (nameEn) stays byte-identical; the trap this arc is about", () => {
  it("[unit] nameEn round-trips through buildCampSiteWhere targeting the exact same string, unaffected by the Thai label", async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([campWithProvince("Chiang Mai")]);

    const result = await getSearchProvinces();
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("unreachable");

    const [option] = result.provinces;
    const where = buildCampSiteWhere({ province: option.nameEn });
    expect(where.location).toEqual({ province: option.nameEn });
    expect(option.nameEn).toBe("Chiang Mai");
  });

  it("[boundary] a raw province with no AdminArea match falls back to itself (id + nameTh) — never crashes, never dropped", async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([campWithProvince("Unmapped Province")]);

    const result = await getSearchProvinces();
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("unreachable");

    expect(result.provinces).toEqual([
      { id: "Unmapped Province", nameTh: "Unmapped Province", nameEn: "Unmapped Province" },
    ]);
  });

  it("[canary] Chiang Mai — the arc's numeric canary — resolves through this exact pipeline with its real Thai label", async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([campWithProvince("Chiang Mai")]);

    const result = await getSearchProvinces();
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("unreachable");

    const chiangMai = result.provinces.find((p) => p.nameEn === "Chiang Mai");
    expect(chiangMai).toBeDefined();
    expect(chiangMai?.nameTh).toBe("เชียงใหม่");
    // The real DB-measured count behind this option (see story.md): 18.
    // Asserted at the DB/HTTP layers directly, not re-derived here — this
    // test proves the OPTION resolves correctly through the same pipeline.
  });
});

describe("SearchModal.tsx — label follows the active language; value + sort per story.md", () => {
  const root = process.cwd();
  const modalSrc = readFileSync(path.join(root, "components/SearchModal.tsx"), "utf-8");

  it("[structural] imports the bilingual option type from getSearchLocations", () => {
    expect(modalSrc).toContain("SearchProvinceOption");
    expect(modalSrc).toContain('from "@/app/actions/getSearchLocations"');
  });

  it("[structural] the SelectItem VALUE is always nameEn (byte-identical submission — BR-2), never nameTh", () => {
    const itemMatch = modalSrc.match(/<SelectItem key=\{p\.id\} value=\{p\.nameEn\}[^>]*>/);
    expect(itemMatch).not.toBeNull();
  });

  it("[structural] the LABEL renders by active language (Thai shows nameTh, English shows nameEn)", () => {
    expect(modalSrc).toContain('{language === "th" ? p.nameTh : p.nameEn}');
  });

  it("[structural] the list sorts via Intl.Collator keyed to the active language, not a fixed English order", () => {
    expect(modalSrc).toContain('new Intl.Collator(language === "th" ? "th" : "en")');
    expect(modalSrc).toContain("sortedProvinces");
    // The rendered list maps the SORTED array, not the raw fetch order.
    expect(modalSrc).toContain("sortedProvinces.map(p =>");
  });

  it("[structural] language is read from the same useLanguage() context every other copy in this file uses", () => {
    expect(modalSrc).toContain("const { t, language } = useLanguage();");
  });

  it("[structural] the loading/empty/error states are untouched by this shape change (still gated on provinces.length / provincesLoading / provincesError)", () => {
    expect(modalSrc).toContain("disabled={provincesLoading || provincesError}");
    expect(modalSrc).toContain("provinces.length === 0");
    expect(modalSrc).toContain("t.search.provinceEmpty");
    expect(modalSrc).toContain("<ErrorBanner message={t.search.provinceLoadFailed} />");
  });
});
