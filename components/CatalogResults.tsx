/**
 * CatalogResults — async Server Component (LOAD-1 / CAM-197).
 *
 * Lifted from app/page.tsx: owns the data-fetch (CACHE-1 / live Prisma branch),
 * cursor computation, per-user wishlist lookup, and the EmptyState / InfiniteScrollGrid
 * render decision. No "use client" — this is always server-rendered and streams
 * into the Suspense boundary in page.tsx.
 *
 * Wishlist lookup is intentionally NOT cached here: it is per-user and must be
 * fresh on every navigation. The CACHE-1 branch (getDefaultCatalog) caches the
 * default catalog read, but that happens inside getDefaultCatalog itself.
 *
 * AC: LOAD-1 A — async server child; Suspense in page.tsx shows skeleton instantly.
 */

import InfiniteScrollGrid from "@/components/InfiniteScrollGrid";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/prisma";
import { serializeDecimals } from "@/lib/serialize";
import { buildCampSiteWhere } from "@/lib/campsite-filters";
import { campCardSelect, type CampCardPayload } from "@/lib/read-models/camp-card";
import { getDefaultCatalog } from "@/lib/catalog-cache";
import { encodeCursorFromItem, PAGE_SIZE, VALID_SORTS, type CatalogSort } from "@/lib/catalog-cursor";

// ---------------------------------------------------------------------------
// Props — primitives parsed from searchParams in page.tsx
// ---------------------------------------------------------------------------

interface CatalogResultsProps {
  type?: string;
  keyword?: string;
  province?: string;
  district?: string;
  startDate?: string;
  endDate?: string;
  guests?: string;
  sort?: string;
  min?: string;
  max?: string;
  access?: string;
  facilities?: string;
  activities?: string;
  terrain?: string;
  userId?: string;
  isLoggedIn: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default async function CatalogResults({
  type,
  keyword,
  province,
  district,
  startDate,
  endDate,
  guests,
  sort,
  min,
  max,
  access,
  facilities,
  activities,
  terrain,
  userId,
  isLoggedIn,
}: CatalogResultsProps) {
  // Determine whether any search/filter/non-default-sort param is active.
  // Mirrors the logic that was in page.tsx verbatim.
  const isSearchActive = !!(
    keyword || province || district || startDate || endDate || guests ||
    (type && type !== "ALL") || min || max || access || facilities || activities || terrain
  );
  const isDefaultSort = !sort || sort === "related";
  const useCache = !isSearchActive && isDefaultSort;

  // CACHE-1 (CAM-195): default path uses the cached wrapper; filtered path stays live.
  type CampCard = CampCardPayload;
  let campSites: CampCard[] = [];

  if (useCache) {
    try {
      campSites = await getDefaultCatalog();
    } catch (error) {
      console.error("Cache/database error on default catalog:", error);
      campSites = [];
    }
  } else {
    const where = buildCampSiteWhere({
      type,
      keyword,
      province,
      district,
      startDate,
      endDate,
      guests,
      min,
      max,
      access,
      facilities,
      activities,
      terrain,
    });

    const sanitizedSort: CatalogSort =
      typeof sort === "string" && (VALID_SORTS as readonly string[]).includes(sort)
        ? (sort as CatalogSort)
        : "related";

    const orderBy =
      sanitizedSort === "price_asc"  ? { priceLow: "asc" as const }  :
      sanitizedSort === "price_desc" ? { priceLow: "desc" as const } :
      sanitizedSort === "rating"
        ? ({ avgRating: { sort: "desc", nulls: "last" } } as const)
        : { createdAt: "desc" as const };

    try {
      const rows = await prisma.campSite.findMany({
        where,
        select: campCardSelect,
        orderBy,
        take: PAGE_SIZE,
      });
      campSites = rows;
    } catch (error) {
      console.error("Database connection error:", error);
      campSites = [];
    }
  }

  // PERF-3 (CAM-196): Determine the active sort for cursor computation.
  const activeSortForCursor: CatalogSort =
    useCache
      ? "related"
      : (typeof sort === "string" && (VALID_SORTS as readonly string[]).includes(sort)
          ? (sort as CatalogSort)
          : "related");

  // PERF-3 (CAM-196): Compute initialCursor for InfiniteScrollGrid.
  const serialisedCamps = campSites.map((c: any) =>
    serializeDecimals({
      ...c,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    })
  );

  const initialCursor: string | null =
    campSites.length === PAGE_SIZE && campSites.length > 0
      ? encodeCursorFromItem(
          {
            id: campSites[campSites.length - 1].id,
            createdAt: campSites[campSites.length - 1].createdAt,
            priceLow:
              campSites[campSites.length - 1].priceLow !== null
                ? Number(campSites[campSites.length - 1].priceLow)
                : null,
            avgRating:
              campSites[campSites.length - 1].avgRating !== null
                ? Number(campSites[campSites.length - 1].avgRating)
                : null,
          },
          activeSortForCursor
        )
      : null;

  // Per-user wishlist lookup — NOT cached; must be fresh per request.
  // Runs only when logged in. Non-fatal on error (cards render with saved=false).
  let savedCampSiteIds: string[] = [];
  if (userId) {
    try {
      const wishlistRows = await prisma.wishlist.findMany({
        where: { userId },
        select: { campSiteId: true },
      });
      savedCampSiteIds = wishlistRows.map((r) => r.campSiteId);
    } catch {
      // Non-fatal — cards render with saved=false on error.
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (campSites.length === 0) {
    return <EmptyState showReset={isSearchActive} />;
  }

  return (
    <InfiniteScrollGrid
      key={`${activeSortForCursor}|${type ?? ""}|${keyword ?? ""}|${province ?? ""}|${district ?? ""}|${startDate ?? ""}|${endDate ?? ""}|${guests ?? ""}|${min ?? ""}|${max ?? ""}|${access ?? ""}|${facilities ?? ""}|${activities ?? ""}|${terrain ?? ""}`}
      initialItems={serialisedCamps}
      initialCursor={initialCursor}
      sort={activeSortForCursor}
      activeFilters={{
        type: type ?? undefined,
        keyword: keyword ?? undefined,
        province: province ?? undefined,
        district: district ?? undefined,
        startDate: startDate ?? undefined,
        endDate: endDate ?? undefined,
        guests: guests ?? undefined,
        min: min ?? undefined,
        max: max ?? undefined,
        access: access ?? undefined,
        facilities: facilities ?? undefined,
        activities: activities ?? undefined,
        terrain: terrain ?? undefined,
      }}
      savedIds={savedCampSiteIds}
      isLoggedIn={isLoggedIn}
    />
  );
}
