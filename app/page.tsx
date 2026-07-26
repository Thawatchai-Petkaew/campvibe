import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { CategoryBar } from "@/components/CategoryBar";
import { SortDropdown } from "@/components/SortDropdown";
import { FilterSortBar } from "@/components/FilterSortBar";
import { FilterModal } from "@/components/FilterModal";
import { ActiveFilters } from "@/components/ActiveFilters";
import { CampgroundGridSkeleton } from "@/components/CampgroundSkeleton";
import CatalogResults from "@/components/CatalogResults";
import { auth } from "@/lib/auth";

// CACHE-1 (CAM-195): force-dynamic removed. The page is still dynamic because auth()
// and the wishlist lookup are per-request. The default catalog read is now served from
// unstable_cache (getDefaultCatalog) to avoid a DB round-trip on warm requests.
// Filtered/search paths remain live (direct Prisma) — the page stays dynamic for those too.
//
// LOAD-1 (CAM-197): Data-fetch + results render moved to CatalogResults (async server child).
// Suspense with a key derived from all search/filter params triggers the skeleton fallback
// instantly on every sort/filter/search/category change (cases 2–5 in the loading matrix).

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
  /** CAM-523 (S7) — independent registry-derived params, wired end-to-end alongside `facilities`. */
  external?: string;
  equipment?: string;
  activities?: string;
  terrain?: string;
  /** CAM-515 (S3) — the FIRST new MasterData group (Annotated features). */
  annotatedFeatures?: string;
  /** CAM-516 (S4) — the SECOND new MasterData group (Camper style). */
  camperStyle?: string;
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
    external,
    equipment,
    activities,
    terrain,
    annotatedFeatures,
    camperStyle,
  } = sp;

  // Compose the Suspense key from all params that can change the results set.
  // Mirrors the key used for InfiniteScrollGrid in page.tsx previously (same formula).
  // When any param changes → key changes → React shows the fallback skeleton instantly.
  const searchParamsKey = [
    sort ?? "",
    type ?? "",
    keyword ?? "",
    province ?? "",
    district ?? "",
    startDate ?? "",
    endDate ?? "",
    guests ?? "",
    min ?? "",
    max ?? "",
    access ?? "",
    facilities ?? "",
    external ?? "",
    equipment ?? "",
    activities ?? "",
    terrain ?? "",
    annotatedFeatures ?? "",
    camperStyle ?? "",
  ].join("|");

  return (
    <main className="min-h-screen pb-20 bg-background text-foreground">
      <Navbar />

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
        {/*
          CAM-530 (S3): ActiveFilters is a client component reading useSearchParams
          directly — it lives OUTSIDE the Suspense boundary below so the chip summary
          renders instantly as part of the static chrome and stays in sync with the URL
          on every navigation, independent of the async grid fetch (renders nothing when
          no filter is active).
        */}
        <ActiveFilters />

        {/*
          LOAD-1: Suspense boundary wraps only the results area.
          The shell (Navbar, CategoryBar, FilterSortBar) renders synchronously — users see
          the nav + filters instantly. The key change on every param triggers the fallback
          (CampgroundGridSkeleton) immediately, before the server stream arrives.
          CatalogResults is an async server component — SSR first-page cards are in HTML.
        */}
        <Suspense key={searchParamsKey} fallback={<CampgroundGridSkeleton />}>
          <CatalogResults
            type={type}
            keyword={keyword}
            province={province}
            district={district}
            startDate={startDate}
            endDate={endDate}
            guests={guests}
            sort={sort}
            min={min}
            max={max}
            access={access}
            facilities={facilities}
            external={external}
            equipment={equipment}
            activities={activities}
            terrain={terrain}
            annotatedFeatures={annotatedFeatures}
            camperStyle={camperStyle}
            userId={session?.user?.id}
            isLoggedIn={!!session?.user?.id}
          />
        </Suspense>
      </div>
    </main>
  );
}
