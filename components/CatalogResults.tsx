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
import { ErrorState } from "@/components/ErrorState";
import { prisma } from "@/lib/prisma";
import { serializeDecimals } from "@/lib/serialize";
import { buildCampSiteWhere, resolveProvinceAdminAreaIds } from "@/lib/campsite-filters";
import { campCardSelect, getProvinceThaiNameMap, withProvinceThaiNames, type CampCardPayload } from "@/lib/read-models/camp-card";
import { getDefaultCatalog } from "@/lib/catalog-cache";
import { encodeCursorFromItem, PAGE_SIZE, VALID_SORTS, type CatalogSort } from "@/lib/catalog-cursor";
import { getAvailabilityStatusForCamps, type CampAvailabilityStatus } from "@/lib/campsite-availability";

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
  /**
   * CAM-523 (S7) — external/equipment are independent registry-derived
   * params (External facility / Equipment for rent), already accepted by
   * catalogQuerySchema + buildCampSiteWhere; this component previously
   * omitted them from its props, so the /api/campsites cursor route
   * honoured them (via InfiniteScrollGrid) but the SSR/first-page path
   * silently dropped them. Fixed here (fold-side FilterModal writes still
   * merge these into `facilities`; a direct `?external=`/`?equipment=` link
   * now also works end-to-end).
   */
  external?: string;
  equipment?: string;
  activities?: string;
  terrain?: string;
  /** CAM-515 (S3) — the FIRST new MasterData group (Annotated features). */
  annotatedFeatures?: string;
  /** CAM-516 (S4) — the SECOND new MasterData group (Camper style). */
  camperStyle?: string;
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
  external,
  equipment,
  activities,
  terrain,
  annotatedFeatures,
  camperStyle,
  userId,
  isLoggedIn,
}: CatalogResultsProps) {
  // Determine whether any search/filter/non-default-sort param is active.
  // Mirrors the logic that was in page.tsx verbatim.
  // CAM-523: external/equipment added — previously omitted here meant a
  // request with ONLY ?external=/?equipment= silently fell through to the
  // cached default catalog (which ignores every filter) instead of the live
  // buildCampSiteWhere path.
  const isSearchActive = !!(
    keyword || province || district || startDate || endDate || guests ||
    (type && type !== "ALL") || min || max || access || facilities || external || equipment || activities || terrain || annotatedFeatures || camperStyle
  );
  const isDefaultSort = !sort || sort === "related";
  const useCache = !isSearchActive && isDefaultSort;

  // CACHE-1 (CAM-195): default path uses the cached wrapper; filtered path stays live.
  type CampCard = CampCardPayload;
  let campSites: CampCard[] = [];
  // CAM-616: a cache/DB failure on the catalog read is an infrastructure
  // problem, not "there are no campgrounds" — it must NOT collapse into
  // <EmptyState/>, which renders the outage as an ordinary "no campgrounds
  // match your filters" page to every visitor and hides the incident from
  // us in the same stroke (the exact shape CAM-588 already fixed on the
  // camp detail page). Tracked separately from `campSites` so the render
  // below can distinguish "genuinely 0 rows" from "the read itself failed".
  let catalogError = false;

  if (useCache) {
    try {
      campSites = await getDefaultCatalog();
    } catch (error) {
      console.error(JSON.stringify({
        level: "error",
        event: "catalog_default_load_failed",
        message: error instanceof Error ? error.message : String(error),
      }));
      campSites = [];
      catalogError = true;
    }
  } else {
    // CAM-573 — resolve the incoming province NAME (Thai or English) to its
    // AdminArea subtree ids so the filter below ALSO matches a camp stored
    // in the other language for the same real province (CAM-563's finding,
    // already wired into app/api/campsites/route.ts's cursor path and
    // lib/ai/tools/search-campsites.ts — this closes the SAME gap for the
    // SSR/first-page path). Fail-open: a lookup error never blocks the
    // catalog, it just leaves the legacy exact-string match as the only
    // path (identical to pre-CAM-573 behavior).
    let provinceAdminAreaIds: string[] = [];
    if (province) {
      try {
        provinceAdminAreaIds = await resolveProvinceAdminAreaIds(prisma, province);
      } catch (error) {
        console.error("[CAM-573] province admin-area resolution failed (fail-open, string match still applies)", error);
      }
    }

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
      external,
      equipment,
      activities,
      terrain,
      annotatedFeatures,
      camperStyle,
      provinceAdminAreaIds,
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
      console.error(JSON.stringify({
        level: "error",
        event: "catalog_filtered_load_failed",
        message: error instanceof Error ? error.message : String(error),
      }));
      campSites = [];
      catalogError = true;
    }
  }

  // CAM-616: short-circuit BEFORE the availability/province/wishlist reads —
  // during a real outage those would likely fail too, and there is no result
  // set to enrich. Renders the shared ErrorState primitive (compact, so the
  // Navbar/CategoryBar/FilterSortBar/ActiveFilters chrome above this
  // Suspense boundary stays visible) instead of throwing — throwing would
  // propagate to the ROOT app/error.tsx boundary and blank that chrome too,
  // which section-level Suspense (.claude/rules/loading.md §3) says to avoid.
  if (catalogError) {
    return <ErrorState variant="error" compact />;
  }

  // PERF-3 (CAM-196): Determine the active sort for cursor computation.
  const activeSortForCursor: CatalogSort =
    useCache
      ? "related"
      : (typeof sort === "string" && (VALID_SORTS as readonly string[]).includes(sort)
          ? (sort as CatalogSort)
          : "related");

  // CAM-344 (BR-7): compute the dated-search availability badge ONLY when
  // both check-in and check-out are present — undated search stays exactly
  // as it is today (no status computed, no badge on any card). Fail-open
  // (AC-9/EC-8): a thrown/timed-out computation never blocks or empties the
  // result list — it is caught here and simply yields no badge on any card.
  let availabilityByCampId: Record<string, CampAvailabilityStatus> = {};
  if (startDate && endDate && campSites.length > 0) {
    try {
      const guestsNum = guests ? parseInt(guests, 10) : 1;
      const requestedGuests = Number.isFinite(guestsNum) && guestsNum > 0 ? guestsNum : 1;
      availabilityByCampId = await getAvailabilityStatusForCamps(
        campSites.map((c) => c.id),
        new Date(startDate),
        new Date(endDate),
        requestedGuests
      );
    } catch (error) {
      console.error("Availability status computation failed (fail-open, no badge):", error);
      availabilityByCampId = {};
    }
  }

  // CAM-545: name-based Thai province lookup (fail-open — a lookup error
  // leaves every card on its English province, same as an unmapped value).
  let provinceThaiNameMap = new Map<string, string>();
  try {
    provinceThaiNameMap = await getProvinceThaiNameMap();
  } catch (error) {
    console.error("Province Thai-name lookup failed (fail-open, English province shown):", error);
  }
  const campSitesWithThaiProvince = withProvinceThaiNames(campSites, provinceThaiNameMap);

  // PERF-3 (CAM-196): Compute initialCursor for InfiniteScrollGrid.
  const serialisedCamps = campSitesWithThaiProvince.map((c: any) => {
    const availabilityStatus = availabilityByCampId[c.id];
    return serializeDecimals({
      ...c,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      ...(availabilityStatus ? { availabilityStatus } : {}),
    });
  });

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
      key={`${activeSortForCursor}|${type ?? ""}|${keyword ?? ""}|${province ?? ""}|${district ?? ""}|${startDate ?? ""}|${endDate ?? ""}|${guests ?? ""}|${min ?? ""}|${max ?? ""}|${access ?? ""}|${facilities ?? ""}|${external ?? ""}|${equipment ?? ""}|${activities ?? ""}|${terrain ?? ""}|${annotatedFeatures ?? ""}|${camperStyle ?? ""}`}
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
        external: external ?? undefined,
        equipment: equipment ?? undefined,
        activities: activities ?? undefined,
        terrain: terrain ?? undefined,
        annotatedFeatures: annotatedFeatures ?? undefined,
        camperStyle: camperStyle ?? undefined,
      }}
      savedIds={savedCampSiteIds}
      isLoggedIn={isLoggedIn}
    />
  );
}
