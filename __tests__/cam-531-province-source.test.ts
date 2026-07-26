/**
 * cam-531-province-source.test.ts — CAM-531 (S4)
 *
 * "Province filter offers every province that has camps" — real source for
 * the SearchModal `จังหวัด` dropdown (`app/actions/getSearchLocations.ts`),
 * replacing the hardcoded 7-key `lib/thailand-data.ts` literal.
 *
 * Coverage matrix (.claude/rules/qa.md §7):
 *   AC-1 (normal)   getSearchProvinces() only offers provinces with a
 *                   matching camp under buildCampSiteWhere's visibility
 *                   predicate; a province with none is never offered.
 *   AC-1 (boundary) duplicate provinces across camps dedupe to one entry;
 *                   result is sorted; a null Location.province is excluded.
 *   AC-2 (unit)     value-fidelity round-trip — a returned province value,
 *                   fed into buildCampSiteWhere({ province }), targets the
 *                   exact same string (BR-2 — the mismatch guard).
 *   error/validation getSearchProvinces() surfaces {status:'error'} (never
 *                   throws to the caller) when the DB read fails.
 *   BR-1 (structural) getSearchProvinces reuses buildCampSiteWhere({})
 *                   unmodified as the query's where-clause (same predicate
 *                   the whole catalog uses) — not a hand-rolled filter.
 *   (c) the old 7-item stub is gone: lib/thailand-data.ts no longer exists
 *                   and SearchModal.tsx no longer imports it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { buildCampSiteWhere } from "@/lib/campsite-filters";

const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    campSite: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { getSearchProvinces } = await import("@/app/actions/getSearchLocations");

function campWithProvince(province: string | null) {
  return { location: { province } };
}

beforeEach(() => {
  mockFindMany.mockReset();
});

describe("AC-1 — getSearchProvinces() offers only provinces that have a matching camp", () => {
  it("[unit] a province with a matching mocked camp IS offered; a province with none is NOT", async () => {
    // Simulate the DB already having applied buildCampSiteWhere's visibility
    // predicate (isActive/isPublished/deletedAt) — findMany only ever
    // returns rows for camps that pass it. "Bangkok" has no matching row
    // here and must never appear in the result.
    mockFindMany.mockResolvedValueOnce([
      campWithProvince("Chiang Mai"),
      campWithProvince("Krabi"),
    ]);

    const result = await getSearchProvinces();

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("unreachable");
    expect(result.provinces).toContain("Chiang Mai");
    expect(result.provinces).toContain("Krabi");
    expect(result.provinces).not.toContain("Bangkok");
  });

  it("[structural] queries with buildCampSiteWhere({}) unmodified — the exact catalog visibility predicate (BR-1)", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await getSearchProvinces();

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where).toEqual(buildCampSiteWhere({}));
    expect(callArgs.where).toEqual({ isActive: true, isPublished: true, deletedAt: null });
  });

  it("[boundary] dedupes duplicate provinces across camps and sorts the result", async () => {
    mockFindMany.mockResolvedValueOnce([
      campWithProvince("Phuket"),
      campWithProvince("Chiang Mai"),
      campWithProvince("Phuket"),
    ]);

    const result = await getSearchProvinces();
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("unreachable");
    expect(result.provinces).toEqual(["Chiang Mai", "Phuket"]);
  });

  it("[null/empty] a camp with a null Location.province is excluded, never an empty option", async () => {
    mockFindMany.mockResolvedValueOnce([
      campWithProvince(null),
      campWithProvince("Krabi"),
    ]);

    const result = await getSearchProvinces();
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("unreachable");
    expect(result.provinces).toEqual(["Krabi"]);
    expect(result.provinces).not.toContain(null);
    expect(result.provinces).not.toContain("");
  });

  it("[null/empty] zero matching camps anywhere returns an empty array (EC-1 empty state), not an error", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const result = await getSearchProvinces();
    expect(result).toEqual({ status: "ok", provinces: [] });
  });
});

describe("AC-2 / BR-2 — value fidelity: the returned province round-trips through buildCampSiteWhere", () => {
  it("[unit] a province value from getSearchProvinces(), fed back into buildCampSiteWhere, targets the exact same string", async () => {
    mockFindMany.mockResolvedValueOnce([campWithProvince("Nakhon Ratchasima")]);

    const result = await getSearchProvinces();
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("unreachable");

    const [value] = result.provinces;
    const where = buildCampSiteWhere({ province: value });
    // The exact mismatch guard: the dropdown's option VALUE must be the same
    // byte-identical string the catalog's equality filter matches against.
    expect(where.location).toEqual({ province: value });
    expect(value).toBe("Nakhon Ratchasima");
  });
});

describe("error/validation — getSearchProvinces() never throws to the caller", () => {
  it("[error] a DB failure resolves {status:'error'}, distinguishable from the empty-ok state", async () => {
    mockFindMany.mockRejectedValueOnce(new Error("connection refused"));
    const result = await getSearchProvinces();
    expect(result).toEqual({ status: "error" });
  });
});

describe("(c) the old 7-item hardcoded stub is retired", () => {
  const root = process.cwd();

  it("[structural] lib/thailand-data.ts no longer exists on disk", () => {
    expect(existsSync(path.join(root, "lib/thailand-data.ts"))).toBe(false);
  });

  it("[structural] components/SearchModal.tsx no longer imports it", () => {
    const modalSrc = readFileSync(path.join(root, "components/SearchModal.tsx"), "utf-8");
    expect(modalSrc).not.toMatch(/thailand-data/);
    expect(modalSrc).not.toContain("PROVINCES");
    expect(modalSrc).not.toContain("THAILAND_DATA");
  });

  it("[structural] SearchModal.tsx sources its province list from getSearchProvinces()", () => {
    const modalSrc = readFileSync(path.join(root, "components/SearchModal.tsx"), "utf-8");
    expect(modalSrc).toContain('import { getSearchProvinces } from "@/app/actions/getSearchLocations"');
    expect(modalSrc).toContain("getSearchProvinces()");
  });
});

describe("states — loading / empty / error wiring present in SearchModal.tsx (Design Gate §5)", () => {
  const root = process.cwd();
  const modalSrc = readFileSync(path.join(root, "components/SearchModal.tsx"), "utf-8");

  it("[structural] the province Select is disabled while loading or on error (never a silently-empty interactive list)", () => {
    expect(modalSrc).toContain("disabled={provincesLoading || provincesError}");
  });

  it("[structural] a loading indicator renders on the trigger + an aria-live status region", () => {
    expect(modalSrc).toContain("provincesLoading &&");
    expect(modalSrc).toContain('role="status" aria-live="polite"');
  });

  it("[structural] an empty state renders the provinceEmpty copy key (never a bare empty list)", () => {
    expect(modalSrc).toContain("t.search.provinceEmpty");
  });

  it("[structural] an error state renders ErrorBanner + a retry control wired to loadProvinces", () => {
    expect(modalSrc).toContain("<ErrorBanner message={t.search.provinceLoadFailed} />");
    expect(modalSrc).toContain("onClick={loadProvinces}");
  });
});
