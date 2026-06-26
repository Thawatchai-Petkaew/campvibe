import { Navbar } from "@/components/Navbar";
import { CategoryBar } from "@/components/CategoryBar";
import InfiniteScrollGrid from "@/components/InfiniteScrollGrid";
import { EmptyState } from "@/components/EmptyState";
import { SortDropdown } from "@/components/SortDropdown";
import { FilterSortBar } from "@/components/FilterSortBar";
import { FilterModal } from "@/components/FilterModal";
import { prisma } from "@/lib/prisma";
import { serializeDecimals } from "@/lib/serialize";
import { auth } from "@/lib/auth";
import { buildCampSiteWhere } from "@/lib/campsite-filters";
import { campCardSelect, type CampCardPayload } from "@/lib/read-models/camp-card";
import { getDefaultCatalog } from "@/lib/catalog-cache";
import { encodeCursorFromItem, PAGE_SIZE, VALID_SORTS, type CatalogSort } from "@/lib/catalog-cursor";

// CACHE-1 (CAM-195): force-dynamic removed. The page is still dynamic because auth()
// and the wishlist lookup are per-request. The default catalog read is now served from
// unstable_cache (getDefaultCatalog) to avoid a DB round-trip on warm requests.
// Filtered/search paths remain live (direct Prisma) — the page stays dynamic for those too.

interface HomeSearchParams {
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
}

interface HomeProps {
  // Next.js 16 may provide searchParams as a Promise in some runtimes (Turbopack).
  // Support both shapes to avoid "searchParams is a Promise" runtime errors.
  searchParams: HomeSearchParams | Promise<HomeSearchParams>;
}

export default async function Home({ searchParams }: HomeProps) {
  const session = await auth();
  const sp = await Promise.resolve(searchParams);
  const {
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
  } = sp;

  // Determine whether any search/filter/non-default-sort param is active.
  // Default path: all params undefined (or sort === 'related') → use the cached read.
  // Filtered path: any param present → live Prisma query (combinatorial space, must be fresh).
  const isSearchActive = !!(
    keyword || province || district || startDate || endDate || guests ||
    (type && type !== 'ALL') || min || max || access || facilities || activities || terrain
  );
  // sort=related (or absent) is the default — included in the default/cached path.
  const isDefaultSort = !sort || sort === 'related';
  const useCache = !isSearchActive && isDefaultSort;

  // CACHE-1 (CAM-195): default path uses the cached wrapper; filtered path stays live.
  // avgRating/reviewCount arrive directly from the stored columns (PERF-5 / CAM-193).
  type CampCard = CampCardPayload;
  let campSites: CampCard[] = [];

  if (useCache) {
    // DEFAULT path — cached. No Prisma call on warm requests.
    try {
      campSites = await getDefaultCatalog();
    } catch (error) {
      console.error("Cache/database error on default catalog:", error);
      campSites = [];
    }
  } else {
    // FILTERED/SEARCH path — live Prisma (stays dynamic; stale results would be wrong).
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

    // Sorting — sanitize the sort param against the shared allowlist from catalog-cursor.
    // Anything outside the allowlist (incl. undefined / injected values) falls back to 'related'.
    const sanitizedSort: CatalogSort =
      typeof sort === 'string' && (VALID_SORTS as readonly string[]).includes(sort)
        ? (sort as CatalogSort)
        : 'related';

    // PERF-5 (CAM-193): unified orderBy for ALL sort values — rating uses the stored column.
    // PERF-3 (CAM-196): orderBy now driven by orderByFor() from catalog-cursor for consistency
    // with the cursor API. avgRating is Decimal(2,1)? maintained by AGG-1.
    const orderBy =
      sanitizedSort === 'price_asc'  ? { priceLow: 'asc' as const }  :
      sanitizedSort === 'price_desc' ? { priceLow: 'desc' as const } :
      sanitizedSort === 'rating'
        ? ({ avgRating: { sort: 'desc', nulls: 'last' } } as const)
        : { createdAt: 'desc' as const };

    try {
      const rows = await prisma.campSite.findMany({
        where,
        select: campCardSelect,
        orderBy,
        // PERF-3 (CAM-196 OT-1=A): unified page size matches the cursor API.
        take: PAGE_SIZE,
      });
      campSites = rows;
    } catch (error) {
      console.error("Database connection error:", error);
      campSites = [];
    }
  }

  // PERF-3 (CAM-196): Determine the active sort for the cursor computation.
  // Default path always uses 'related'; filtered path uses sanitizedSort (computed above,
  // but we re-derive here for the cursor calculation which runs after both branches).
  const activeSortForCursor: CatalogSort =
    useCache
      ? 'related'
      : (typeof sort === 'string' && (VALID_SORTS as readonly string[]).includes(sort)
          ? (sort as CatalogSort)
          : 'related');

  // PERF-3 (CAM-196): Compute initialCursor for the frontend infinite-scroll client
  // (InfiniteScrollGrid, PR B follow-up). If the first page returned PAGE_SIZE items,
  // encode a cursor from the last item so the client can request page 2 without a
  // redundant re-fetch. If < PAGE_SIZE items came back, there is no next page.
  //
  // The cursor is passed to CampgroundGrid as an optional prop (currently unused by the
  // existing client component — the InfiniteScrollGrid wires it in PR B). This does NOT
  // change the current SSR render or break anything.
  const serialisedCamps = campSites.map((c: any) => serializeDecimals({
    ...c,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
  }));

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

  // Fetch wishlist ids once per page-load (only when logged in). No N+1.
  let savedCampSiteIds: string[] = [];
  if (session?.user?.id) {
    try {
      const wishlistRows = await prisma.wishlist.findMany({
        where: { userId: session.user.id },
        select: { campSiteId: true },
      });
      savedCampSiteIds = wishlistRows.map((r) => r.campSiteId);
    } catch {
      // Non-fatal — cards render with saved=false on error.
    }
  }

  return (
    <main className="min-h-screen pb-20 bg-background text-foreground">
      <Navbar currentUser={session?.user} />

      <div className="sticky top-20 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 mb-2">
        <div className="container mx-auto px-6 py-2">
          <CategoryBar />
        </div>
      </div>

      <FilterSortBar>
        <FilterModal />
        <div className="hidden md:block">
          <SortDropdown />
        </div>
      </FilterSortBar>

      <div className="container mx-auto px-6">
        {campSites.length === 0 ? (
          <EmptyState
            showReset={isSearchActive}
          />
        ) : (
          // PERF-3 (CAM-196) Part B: InfiniteScrollGrid replaces the static CampgroundGrid
          // on the home page. The SSR-rendered first page (initialItems) is seeded from
          // the server so the first 24 cards are fully in HTML for SEO / no-JS fallback.
          // The key resets the client component (and its state) whenever sort or filters change
          // — the server re-renders with new initialItems/initialCursor so no stale cursor
          // is ever forwarded to the cursor API.
          <InfiniteScrollGrid
            key={`${activeSortForCursor}|${type ?? ''}|${keyword ?? ''}|${province ?? ''}|${district ?? ''}|${startDate ?? ''}|${endDate ?? ''}|${guests ?? ''}|${min ?? ''}|${max ?? ''}|${access ?? ''}|${facilities ?? ''}|${activities ?? ''}|${terrain ?? ''}`}
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
            isLoggedIn={!!session?.user?.id}
          />
        )}
      </div>
    </main>
  );
}
