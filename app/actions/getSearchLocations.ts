"use server";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildCampSiteWhere } from "@/lib/campsite-filters";
import { CATALOG_TAG } from "@/lib/catalog-cache";

/**
 * CAM-531 — real province source for the SearchModal `จังหวัด` dropdown.
 *
 * Replaces the hardcoded 7-key `PROVINCES` object literal with the DISTINCT
 * `Location.province` values that actually have a
 * published, active, non-deleted camp — the SAME visibility predicate
 * `buildCampSiteWhere` applies everywhere else in the catalog (called here
 * with no filters, unmodified). A province can only ever be offered if
 * selecting it is guaranteed to return >=1 result; this never offers a
 * province that would return zero.
 *
 * Value fidelity (BR-2, story.md): the returned strings ARE the exact
 * `Location.province` values (English `provinceNameEn`, per prisma/seed.ts)
 * that `buildCampSiteWhere`'s province branch matches by equality — the
 * caller must use them as the `SelectItem` value verbatim, never re-derive
 * or translate them before setting the value.
 *
 * Cached via `unstable_cache` (BR-3): the province-with-camps set only
 * changes when a camp is created/published/edited/deleted, and the existing
 * write paths (app/api/campsites/route.ts POST, [id]/route.ts PUT/DELETE)
 * already call `revalidateTag(CATALOG_TAG)` on every one of those — reusing
 * that tag here means this cache busts automatically with no new wiring.
 * `revalidate: 3600` is a belt-and-suspenders TTL (matches the "changes
 * rarely" nature of this data), mirroring the pattern in lib/catalog-cache.ts.
 *
 * Discriminated union return (per .claude/rules/api.md #11): the caller can
 * distinguish "loaded, zero provinces" ({status:'ok', provinces:[]}) from
 * "the fetch itself failed" ({status:'error'}) — the two are different UI
 * states (empty vs error) and must not collapse into the same value.
 */
export type SearchProvincesResult =
  | { status: "ok"; provinces: string[] }
  | { status: "error" };

const loadProvincesWithCamps = unstable_cache(
  async (): Promise<string[]> => {
    const camps = await prisma.campSite.findMany({
      where: buildCampSiteWhere({}),
      select: { location: { select: { province: true } } },
    });

    const provinces = new Set<string>();
    for (const camp of camps) {
      if (camp.location?.province) {
        provinces.add(camp.location.province);
      }
    }
    return Array.from(provinces).sort();
  },
  ["search-provinces-with-camps"],
  { revalidate: 3600, tags: [CATALOG_TAG] }
);

export async function getSearchProvinces(): Promise<SearchProvincesResult> {
  try {
    const provinces = await loadProvincesWithCamps();
    return { status: "ok", provinces };
  } catch (error) {
    console.error("Failed to fetch search provinces:", error);
    return { status: "error" };
  }
}
