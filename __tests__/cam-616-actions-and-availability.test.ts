/**
 * cam-616-actions-and-availability.test.ts — CAM-616 (Part 3 of 3)
 *
 * app/actions/getCampSiteCount.ts:41 and app/actions/getFilterOptions.ts:24 —
 * both server actions silently returned a fabricated "0" / "{}" on a DB
 * failure, which FilterModal.tsx (the sole consumer, out of this ticket's
 * file surface) reads as a real answer ("No Campgrounds found" / zero filter
 * sections). Fixed here at the source: log structured, then re-throw (the
 * CAM-588 shape) so the failure can never again masquerade as a genuine
 * empty answer.
 *
 * components/CampgroundDetailClient.tsx (the availability catches only) —
 * an availability-load failure used to leave `availability` as `{}`, and
 * `isDateDisabled` only disables a date it can find in that map — so a
 * failed load rendered EVERY future date as bookable. Fixed by tracking
 * `availabilityError` and treating "unknown" as "blocked", never "free".
 * Tested via source-inspection (the established precedent for THIS
 * component in this repo — cam-397, cam-354, cam-528, f3-detail-surface all
 * source-inspect it; it has ~15 heavy dependencies — dynamic MapComponent,
 * next-auth useSession, ImageGallery, AmenitiesModal — with no existing
 * render harness), with Prove-It position/behaviour assertions, not a bare
 * "the string is present" grep.
 *
 * Also documents HOW the 14 deliberate/correct catches were told apart from
 * this defect (tech.md's own summary, pinned here as a regression guard):
 *   - SEC-1 anti-enumeration 404 (app/campgrounds/[slug]/page.tsx) — OUT OF
 *     BOUNDS for this story, asserted UNTOUCHED.
 *   - lib/safe-fetch.ts's `{ok:false}` never-throw shape — OUT OF BOUNDS,
 *     asserted UNTOUCHED, and reused (not reinvented) by NotificationCenter.
 *   - CatalogResults.tsx's OTHER three fail-open catches (province
 *     admin-area resolution, Thai-province-name lookup, availability-badge
 *     computation, wishlist lookup) are INDEPENDENT, already-scoped
 *     enhancements whose failure leaves the REST of a successful catalog
 *     read intact — correctly left as catch-and-continue, NOT converted to
 *     a throw (converting them would turn a cosmetic miss into an outage).
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal (successful count/options) · error/teeth (a DB failure throws,
 *   never fabricates 0/{}) · error/validation (CampgroundDetailClient: an
 *   availability failure disables every future date) · concurrent/ordering
 *   (the untouched fail-open catches keep their catch-and-continue shape)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const root = process.cwd();
function src(rel: string): string {
  return readFileSync(path.join(root, rel), "utf-8");
}

// ---------------------------------------------------------------------------
// Part 1 — app/actions/getCampSiteCount.ts
// ---------------------------------------------------------------------------

const mockCount = vi.fn();
const mockAdminAreaFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    campSite: { count: (...args: unknown[]) => mockCount(...args) },
    adminArea: { findFirst: (...args: unknown[]) => mockAdminAreaFindFirst(...args) },
  },
}));

const { getCampSiteCount } = await import("@/app/actions/getCampSiteCount");

beforeEach(() => {
  vi.clearAllMocks();
  mockAdminAreaFindFirst.mockResolvedValue(null);
});

describe("getCampSiteCount — a DB failure must never fabricate a 0 (CAM-616 :41)", () => {
  it("[normal] a successful count resolves the real number (sanity)", async () => {
    mockCount.mockResolvedValue(42);
    await expect(getCampSiteCount({ keyword: "river" })).resolves.toBe(42);
  });

  it("[error/teeth] a count-query failure THROWS — never resolves 0", async () => {
    mockCount.mockRejectedValue(new Error("connection refused"));
    await expect(getCampSiteCount({ keyword: "river" })).rejects.toThrow("connection refused");
  });

  it("[unit] logs a structured server-side line before re-throwing", async () => {
    mockCount.mockRejectedValue(new Error("boom"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getCampSiteCount({})).rejects.toThrow("boom");
    const logged = errSpy.mock.calls
      .map((c) => c[0])
      .find((line) => typeof line === "string" && line.includes("campsite_count_failed"));
    expect(logged).toBeDefined();
    errSpy.mockRestore();
  });

  it("[concurrent/ordering] the OTHER catch in this file (province admin-area resolution) is left fail-open, untouched", async () => {
    // A resolution failure must NOT make the whole action throw — only the
    // final count query's failure does. This is the deliberate CAM-573
    // fail-open pattern this story must not disturb.
    mockAdminAreaFindFirst.mockRejectedValue(new Error("lookup down"));
    mockCount.mockResolvedValue(7);
    await expect(getCampSiteCount({ province: "Chiang Mai" })).resolves.toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Part 2 — app/actions/getFilterOptions.ts
// ---------------------------------------------------------------------------

describe("getFilterOptions — a DB failure must never fabricate an empty options set (CAM-616 :24)", () => {
  it("[normal] a successful read groups options by their MasterData.group (sanity)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        masterData: {
          findMany: vi.fn().mockResolvedValue([{ code: "RIVE", group: "Terrain" }]),
        },
      },
    }));
    const { getFilterOptions } = await import("@/app/actions/getFilterOptions");
    const result = await getFilterOptions();
    expect(result).toEqual({ Terrain: [{ code: "RIVE", group: "Terrain" }] });
  });

  it("[error/teeth] a DB failure THROWS — never resolves {}", async () => {
    vi.resetModules();
    vi.doMock("@/lib/prisma", () => ({
      prisma: { masterData: { findMany: vi.fn().mockRejectedValue(new Error("db down")) } },
    }));
    const { getFilterOptions } = await import("@/app/actions/getFilterOptions");
    await expect(getFilterOptions()).rejects.toThrow("db down");
  });

  it("[unit] logs a structured server-side line before re-throwing", async () => {
    vi.resetModules();
    vi.doMock("@/lib/prisma", () => ({
      prisma: { masterData: { findMany: vi.fn().mockRejectedValue(new Error("boom")) } },
    }));
    const { getFilterOptions } = await import("@/app/actions/getFilterOptions");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getFilterOptions()).rejects.toThrow("boom");
    const logged = errSpy.mock.calls
      .map((c) => c[0])
      .find((line) => typeof line === "string" && line.includes("filter_options_load_failed"));
    expect(logged).toBeDefined();
    errSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Part 3 — components/CampgroundDetailClient.tsx (availability catches only)
// ---------------------------------------------------------------------------

describe("CampgroundDetailClient — an availability-load failure must disable every date, never present them all as free (CAM-616)", () => {
  const detailSrc = src("components/CampgroundDetailClient.tsx");

  it("[error/teeth] isDateDisabled checks availabilityError BEFORE the availability map lookup (unknown -> blocked, not free)", () => {
    const disabledFn = detailSrc.match(/const isDateDisabled = \(date: Date\) => \{[\s\S]*?\n    \};/);
    expect(disabledFn).not.toBeNull();
    const body = disabledFn![0];
    expect(body).toContain("if (availabilityError) return true;");
    const errorCheckPos = body.indexOf("if (availabilityError) return true;");
    const mapLookupPos = body.indexOf("const dayAvailability = availability[dateKey];");
    expect(errorCheckPos).toBeGreaterThan(-1);
    expect(mapLookupPos).toBeGreaterThan(-1);
    expect(errorCheckPos).toBeLessThan(mapLookupPos);
  });

  it("[error] the non-ok branch no longer calls setAvailability({}) (an empty map used to read as 'every date free')", () => {
    const nonOkBlock = detailSrc.match(/if \(!response\.ok\) \{[\s\S]*?setAvailabilityError\(true\);\s*\n\s*return;\s*\n\s*\}/);
    expect(nonOkBlock).not.toBeNull();
    expect(nonOkBlock![0]).not.toContain("setAvailability({});");
  });

  it("[error] the catch block also sets availabilityError (network/parse failure -> blocked, not free)", () => {
    const catchBlock = detailSrc.match(/\} catch \(error\) \{\s*\n\s*console\.error\('Failed to fetch availability:', error\);\s*\n\s*setAvailabilityError\(true\);/);
    expect(catchBlock).not.toBeNull();
  });

  it("[normal] a successful fetch resets availabilityError to false BEFORE the request (a retry can recover)", () => {
    const fnStart = detailSrc.indexOf("const fetchAvailability = useCallback(async () => {");
    const firstCatchPos = detailSrc.indexOf("setAvailabilityError(false);", fnStart);
    expect(fnStart).toBeGreaterThan(-1);
    expect(firstCatchPos).toBeGreaterThan(fnStart);
  });

  it("[normal] fetchAvailability is a stable useCallback (not effect-local) so a retry button can re-invoke it", () => {
    expect(detailSrc).toContain("const fetchAvailability = useCallback(async () => {");
    expect(detailSrc).toContain("}, [campground.id]);");
  });

  it("[a11y] the retry banner has role=\"alert\" + a retry button wired to fetchAvailability", () => {
    expect(detailSrc).toContain('data-testid="banner--availability-error"');
    expect(detailSrc).toContain('onClick={fetchAvailability}');
    expect(detailSrc).toContain('data-testid="btn--availability-retry"');
  });

  it("[i18n] the banner copy comes from t.booking.availabilityLoadError (never a hardcoded string)", () => {
    expect(detailSrc).toContain("{t.booking.availabilityLoadError}");
  });
});

// ---------------------------------------------------------------------------
// Part 4 — the 14 deliberate/correct catches: proof they were told apart
// ---------------------------------------------------------------------------

describe("The 14 deliberate catches this story must NOT touch (how the two shapes were told apart)", () => {
  it("SEC-1 anti-enumeration: app/campgrounds/[slug]/page.tsx's notFound() gate is untouched (OUT OF BOUNDS)", () => {
    const slugPageSrc = src("app/campgrounds/[slug]/page.tsx");
    // A wrong-owner (SEC-1) and a non-existent id must still look identical —
    // both routes to notFound(), never a distinguishable error/status.
    expect(slugPageSrc).toContain("if (!canViewCampSite(campSite, session)) {");
    expect(slugPageSrc).toContain("notFound();");
  });

  it("lib/safe-fetch.ts's never-throw {ok:false} shape is untouched (OUT OF BOUNDS) and reused, not reinvented, by NotificationCenter", () => {
    const safeFetchSrc = src("lib/safe-fetch.ts");
    expect(safeFetchSrc).toContain("export type SafeJsonResult<T> = { ok: true; data: T } | { ok: false };");
    expect(safeFetchSrc).toContain("export async function fetchJsonSafe<T>");

    const notifSrc = src("components/NotificationCenter.tsx");
    expect(notifSrc).toContain('import { fetchJsonSafe, type SafeJsonResult } from "@/lib/safe-fetch"');
  });

  it("CatalogResults.tsx's THREE other fail-open catches stay catch-and-continue (an independent enhancement's miss must not become an outage)", () => {
    const catalogSrc = src("components/CatalogResults.tsx");
    // Province admin-area id-boost (CAM-573) — fail-open, string match still applies.
    expect(catalogSrc).toContain("province admin-area resolution failed (fail-open, string match still applies)");
    // Thai province-name lookup (CAM-545) — fail-open, English name shown.
    expect(catalogSrc).toContain("Province Thai-name lookup failed (fail-open, English province shown)");
    // Dated-availability badge (CAM-344) — fail-open, no badge.
    expect(catalogSrc).toContain("Availability status computation failed (fail-open, no badge)");
    // None of these three set `catalogError = true` — only the two catches
    // that decide whether campSites itself is trustworthy do.
    const catalogErrorAssignments = (catalogSrc.match(/catalogError = true;/g) || []).length;
    expect(catalogErrorAssignments).toBe(2);
  });
});
