import { Navbar } from "@/components/Navbar";
import { CategoryBar } from "@/components/CategoryBar";
import { CampgroundGrid } from "@/components/CampgroundGrid";
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

    // Sorting — sanitize the sort param against an allowlist before any branch.
    // Anything outside the allowlist (incl. undefined / injected values) falls back to 'related'.
    const VALID_SORT = ['related', 'price_asc', 'price_desc', 'rating'] as const;
    type SortParam = typeof VALID_SORT[number];
    const sanitizedSort: SortParam =
      typeof sort === 'string' && (VALID_SORT as readonly string[]).includes(sort)
        ? (sort as SortParam)
        : 'related';

    // PERF-5 (CAM-193): unified orderBy for ALL sort values — rating now uses the stored column.
    // avgRating is Decimal(2,1)? maintained by AGG-1; nulls: 'last' keeps nulls at the end.
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
        take: 40,
      });
      campSites = rows;
    } catch (error) {
      console.error("Database connection error:", error);
      campSites = [];
    }
  }

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
          <CampgroundGrid
            camps={campSites.map((c: any) => serializeDecimals({
              ...c,
              createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
            }))}
            savedIds={savedCampSiteIds}
            isLoggedIn={!!session?.user?.id}
          />
        )}
      </div>
    </main>
  );
}
