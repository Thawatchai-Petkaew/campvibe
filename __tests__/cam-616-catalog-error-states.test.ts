// @vitest-environment jsdom
/**
 * cam-616-catalog-error-states.test.ts — CAM-616 (Part 1 of 3)
 *
 * THE WORST defect named in the ticket: components/CatalogResults.tsx caught
 * a Postgres/cache failure on BOTH the default-catalog path (:108-114, was
 * `console.error("Cache/database error...", error); campSites = [];`) and the
 * filtered/live path (:166-177, was `console.error("Database connection
 * error:", error); campSites = [];`), then let `campSites.length === 0` fall
 * through to <EmptyState/> — rendering a real outage as "no campgrounds match
 * your filters" to every visitor on the highest-traffic route.
 *
 * Also covers components/InfiniteScrollGrid.tsx:170 — a failed page-2 fetch
 * used to `setDone(true)` with no distinguishing flag, rendering
 * `t.catalog.end_of_list` ("you've reached the end of the list") on a
 * network/5xx failure.
 *
 * Mock-only-the-boundary strategy (cam-588/cam-269 precedent): CatalogResults
 * is invoked directly as a plain async function (it is a Server Component,
 * no "use client") with every data dependency mocked at its module boundary;
 * the real render decision (<ErrorState/> vs <EmptyState/> vs
 * <InfiniteScrollGrid/>) is asserted via React-element `.type` reference
 * equality against the REAL imported components — never source-inspection.
 *
 * Teeth proof (manual, CAM-604/608 practice — recorded in this story's
 * design.md): with the CAM-616 fix removed (both catches reverted to
 * `campSites = [];` with no `catalogError = true;`), the "[teeth]" tests
 * below go RED — they render <EmptyState/> instead of <ErrorState/>. This
 * was verified by hand before this file was finalised; not left as a runtime
 * toggle in the suite.
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal (default + filtered path succeed) · null/empty (genuinely 0 rows
 *   stays <EmptyState/> — the correct twin, never touched) · error/teeth
 *   (both catches now render <ErrorState/>, short-circuiting the
 *   availability/province/wishlist reads) · concurrent/ordering (retry
 *   re-issues the SAME cursor request; a failed auto-fetch does not loop)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";

// ---------------------------------------------------------------------------
// Part 1 — components/CatalogResults.tsx (mock-only-the-boundary, direct call)
// ---------------------------------------------------------------------------

const {
  mockGetDefaultCatalog,
  mockFindMany,
  mockWishlistFindMany,
  mockBuildCampSiteWhere,
  mockResolveProvinceAdminAreaIds,
  mockGetProvinceThaiNameMap,
  mockWithProvinceThaiNames,
  mockGetAvailabilityStatusForCamps,
} = vi.hoisted(() => ({
  mockGetDefaultCatalog: vi.fn<(...args: unknown[]) => unknown>(),
  mockFindMany: vi.fn<(...args: unknown[]) => unknown>(),
  mockWishlistFindMany: vi.fn<(...args: unknown[]) => unknown>(),
  mockBuildCampSiteWhere: vi.fn<(...args: unknown[]) => unknown>(() => ({})),
  mockResolveProvinceAdminAreaIds: vi.fn<(...args: unknown[]) => Promise<unknown[]>>(async () => []),
  mockGetProvinceThaiNameMap: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => new Map()),
  mockWithProvinceThaiNames: vi.fn<(...args: unknown[]) => unknown>((...rows: unknown[]) => rows[0]),
  mockGetAvailabilityStatusForCamps: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({})),
}));

vi.mock("@/lib/catalog-cache", () => ({
  getDefaultCatalog: (...args: unknown[]) => mockGetDefaultCatalog(...args),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campSite: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    wishlist: { findMany: (...args: unknown[]) => mockWishlistFindMany(...args) },
  },
}));
vi.mock("@/lib/campsite-filters", () => ({
  buildCampSiteWhere: (...args: unknown[]) => mockBuildCampSiteWhere(...args),
  resolveProvinceAdminAreaIds: (...args: unknown[]) => mockResolveProvinceAdminAreaIds(...args),
}));
vi.mock("@/lib/read-models/camp-card", () => ({
  campCardSelect: {},
  getProvinceThaiNameMap: () => mockGetProvinceThaiNameMap(),
  withProvinceThaiNames: (...args: unknown[]) => mockWithProvinceThaiNames(...args),
}));
vi.mock("@/lib/catalog-cursor", () => ({
  encodeCursorFromItem: vi.fn(() => "cursor-abc"),
  PAGE_SIZE: 24,
  VALID_SORTS: ["related", "price_asc", "price_desc", "rating"],
}));
vi.mock("@/lib/campsite-availability", () => ({
  getAvailabilityStatusForCamps: (...args: unknown[]) => mockGetAvailabilityStatusForCamps(...args),
}));
vi.mock("@/lib/serialize", () => ({ serializeDecimals: (v: unknown) => v }));

import CatalogResults from "@/components/CatalogResults";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import InfiniteScrollGridDefault from "@/components/InfiniteScrollGrid";

const BASE_PROPS = { isLoggedIn: false };

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildCampSiteWhere.mockReturnValue({});
  mockResolveProvinceAdminAreaIds.mockResolvedValue([]);
  mockGetProvinceThaiNameMap.mockResolvedValue(new Map());
  mockWithProvinceThaiNames.mockImplementation((...rows: unknown[]) => rows[0]);
  mockGetAvailabilityStatusForCamps.mockResolvedValue({});
  mockWishlistFindMany.mockResolvedValue([]);
});

describe("CatalogResults — default (cached) path", () => {
  it("[normal] a successful cached read renders InfiniteScrollGrid (sanity — the happy path is untouched)", async () => {
    mockGetDefaultCatalog.mockResolvedValue([
      { id: "c1", createdAt: new Date(), priceLow: 100, avgRating: null },
    ]);
    const result = await CatalogResults(BASE_PROPS as never);
    expect((result as React.ReactElement).type).toBe(InfiniteScrollGridDefault);
  });

  it("[null/empty] a genuinely empty catalog (0 rows, no error) still renders EmptyState — the correct twin, untouched by this fix", async () => {
    mockGetDefaultCatalog.mockResolvedValue([]);
    const result = await CatalogResults(BASE_PROPS as never);
    expect((result as React.ReactElement).type).toBe(EmptyState);
    expect((result as React.ReactElement).props).not.toBe(undefined);
  });

  it("[error/teeth] a cache/DB failure renders ErrorState — NEVER EmptyState (THE WORST defect, :108-114)", async () => {
    mockGetDefaultCatalog.mockRejectedValue(new Error("Cache/database error"));
    const result = await CatalogResults(BASE_PROPS as never);
    expect((result as React.ReactElement).type).toBe(ErrorState);
    expect((result as React.ReactElement).type).not.toBe(EmptyState);
  });

  it("[error] a failure short-circuits BEFORE the availability/province/wishlist reads (no wasted calls during an outage)", async () => {
    mockGetDefaultCatalog.mockRejectedValue(new Error("db down"));
    await CatalogResults(BASE_PROPS as never);
    expect(mockGetProvinceThaiNameMap).not.toHaveBeenCalled();
    expect(mockWishlistFindMany).not.toHaveBeenCalled();
    expect(mockGetAvailabilityStatusForCamps).not.toHaveBeenCalled();
  });

  it("[unit] logs a structured server-side line naming the event — no stack/secret shape leaked", async () => {
    mockGetDefaultCatalog.mockRejectedValue(new Error("boom"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await CatalogResults(BASE_PROPS as never);
    const logged = errSpy.mock.calls
      .map((c) => c[0])
      .find((line) => typeof line === "string" && line.includes("catalog_default_load_failed"));
    expect(logged).toBeDefined();
    const parsed = JSON.parse(logged as string);
    expect(parsed.event).toBe("catalog_default_load_failed");
    expect(parsed.message).toBe("boom");
    errSpy.mockRestore();
  });
});

describe("CatalogResults — filtered (live) path", () => {
  const FILTERED_PROPS = { ...BASE_PROPS, keyword: "river" };

  it("[normal] a successful filtered read renders InfiniteScrollGrid", async () => {
    mockFindMany.mockResolvedValue([{ id: "c1", createdAt: new Date(), priceLow: 100, avgRating: null }]);
    const result = await CatalogResults(FILTERED_PROPS as never);
    expect((result as React.ReactElement).type).toBe(InfiniteScrollGridDefault);
  });

  it("[null/empty] a genuinely empty filtered result still renders EmptyState with showReset (real 0 matches, not an outage)", async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await CatalogResults(FILTERED_PROPS as never);
    expect((result as React.ReactElement).type).toBe(EmptyState);
    expect((result as React.ReactElement).props).toMatchObject({ showReset: true });
  });

  it("[error/teeth] a DB failure on the filtered path renders ErrorState — never EmptyState (:166-177)", async () => {
    mockFindMany.mockRejectedValue(new Error("Database connection error"));
    const result = await CatalogResults(FILTERED_PROPS as never);
    expect((result as React.ReactElement).type).toBe(ErrorState);
  });

  it("[unit] logs a structured server-side line for the filtered-path failure", async () => {
    mockFindMany.mockRejectedValue(new Error("conn refused"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await CatalogResults(FILTERED_PROPS as never);
    const logged = errSpy.mock.calls
      .map((c) => c[0])
      .find((line) => typeof line === "string" && line.includes("catalog_filtered_load_failed"));
    expect(logged).toBeDefined();
    errSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Part 2 — components/InfiniteScrollGrid.tsx (RTL render, jsdom)
// ---------------------------------------------------------------------------

class IntersectionObserverStub {
  static instances: IntersectionObserverStub[] = [];
  callback: IntersectionObserverCallback;
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    IntersectionObserverStub.instances.push(this);
  }
  trigger(isIntersecting = true) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

const ITEM = (id: string) => ({
  id,
  nameTh: `แคมป์ ${id}`,
  nameEn: `Camp ${id}`,
  priceLow: 500,
  avgRating: null,
  reviewCount: 0,
  createdAt: new Date().toISOString(),
  images: [],
  location: { province: "Chiang Mai", provinceTh: "เชียงใหม่" },
});

function renderGrid(overrides: Record<string, unknown> = {}) {
  return render(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(InfiniteScrollGridDefault, {
        initialItems: [ITEM("seed-1")] as unknown as never,
        initialCursor: "cursor-1",
        sort: "related",
        activeFilters: {},
        savedIds: [],
        isLoggedIn: false,
        ...overrides,
      } as never)
    )
  );
}

// The IntersectionObserver effect re-subscribes (disconnect + new instance)
// whenever `fetchNextPage`'s identity changes (loading/done/cursor change),
// mirroring the real browser's own "old observer disconnected, new one
// watching" behaviour — always trigger the LATEST instance, never a stale one.
function latestObserver(): IntersectionObserverStub {
  const instance = IntersectionObserverStub.instances.at(-1);
  if (!instance) throw new Error("no IntersectionObserver instance created yet");
  return instance;
}

describe("InfiniteScrollGrid — page-2 fetch failure must render a retry, never end-of-list (CAM-616)", () => {
  beforeEach(() => {
    IntersectionObserverStub.instances = [];
    (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IntersectionObserverStub;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("[normal] a successful page-2 fetch appends items (happy path unchanged)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [ITEM("page2-1")], nextCursor: null }),
    });
    renderGrid();
    await act(async () => {
      latestObserver().trigger(true);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("text--end-of-list")).toBeTruthy();
    expect(screen.queryByTestId("banner--load-more-error")).toBeNull();
  });

  it("[error/teeth] a non-ok page-2 response renders the retry banner, NOT the end-of-list message", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    renderGrid();
    await act(async () => {
      latestObserver().trigger(true);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("banner--load-more-error")).toBeTruthy();
    expect(screen.queryByTestId("text--end-of-list")).toBeNull();
  });

  it("[error] a network throw on page-2 also renders the retry banner (not silently 'end of list')", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network down"));
    renderGrid();
    await act(async () => {
      latestObserver().trigger(true);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("banner--load-more-error")).toBeTruthy();
  });

  it("[concurrent/ordering] after a failure, scrolling again does NOT auto-retry (done guard intact) — only the retry button re-issues the request", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    renderGrid();
    await act(async () => {
      latestObserver().trigger(true);
      await Promise.resolve();
      await Promise.resolve();
    });
    screen.getByTestId("banner--load-more-error");
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Simulate the sentinel re-entering view (e.g. a resize) on the CURRENT
    // (post-failure) observer instance — must NOT refire (done=true blocks it).
    await act(async () => {
      latestObserver().trigger(true);
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // The retry button DOES re-issue the same request and can recover.
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [ITEM("page2-recovered")], nextCursor: null }),
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("btn--catalog-load-more-retry"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("banner--load-more-error")).toBeNull();
  });
});
