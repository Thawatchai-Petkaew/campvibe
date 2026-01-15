"use server";

import { prisma } from "@/lib/prisma";
import { buildCampSiteWhere, CampSiteFilterParams } from "@/lib/campsite-filters";

export async function getCampSiteCount(filters: CampSiteFilterParams) {
    const where = buildCampSiteWhere(filters);

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
