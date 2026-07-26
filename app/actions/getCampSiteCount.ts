"use server";

import { prisma } from "@/lib/prisma";
import { buildCampSiteWhere, resolveProvinceAdminAreaIds, CampSiteFilterParams } from "@/lib/campsite-filters";

/**
 * CAM-573 — the FilterModal live "Show N" count preview shares
 * `buildCampSiteWhere` with the catalog/pagination/AI-tool readers. Resolves
 * the incoming province NAME (Thai or English) to its AdminArea subtree ids
 * first (CAM-563's mechanism, already wired into `app/api/campsites/
 * route.ts`, `components/CatalogResults.tsx`, and
 * `lib/ai/tools/search-campsites.ts` — this closes the same gap for the
 * count preview) so the previewed count matches what the apply button will
 * actually return, regardless of which language `Location.province` happens
 * to be stored in for a given camp (CAM-559 finding). Fail-open: a lookup
 * error never blocks the count, it just leaves the legacy exact-string
 * match as the only path (identical to pre-CAM-573 behavior). Only ever
 * engaged when `province` is a plain string — the AI-tool-only `string[]`
 * region-expansion branch is unaffected (matches `buildCampSiteWhere`'s own
 * `provinceAdminAreaIds` doc comment).
 */
export async function getCampSiteCount(filters: CampSiteFilterParams) {
    let provinceAdminAreaIds: string[] = [];
    if (typeof filters.province === "string" && filters.province) {
        try {
            provinceAdminAreaIds = await resolveProvinceAdminAreaIds(prisma, filters.province);
        } catch (error) {
            console.error("[CAM-573] province admin-area resolution failed in getCampSiteCount (fail-open, string match still applies)", error);
        }
    }

    const where = buildCampSiteWhere({ ...filters, provinceAdminAreaIds });

    try {
        const count = await prisma.campSite.count({
            where,
        });
        return count;
    } catch (error) {
        console.error("Count error:", error);
        return 0;
    }
}
