"use server";

import { prisma } from "@/lib/prisma";

export async function getFilterOptions() {
    try {
        const allOptions = await prisma.masterData.findMany({
            orderBy: { code: 'asc' }
        });

        // Group by 'group' field
        const grouped = allOptions.reduce((acc, option) => {
            const groupKey = option.group;
            if (!acc[groupKey]) {
                acc[groupKey] = [];
            }
            acc[groupKey].push(option);
            return acc;
        }, {} as Record<string, typeof allOptions>);

        return grouped;
    } catch (error) {
        // CAM-616: a DB failure here used to return {}, which FilterModal
        // renders as zero filter sections — indistinguishable from "this
        // catalog has no filterable options" and read by a camper as "we
        // do not support filtering". Log structured, then re-throw (the
        // CAM-588 shape) so the failure cannot silently masquerade as an
        // intentionally empty filter set.
        console.error(JSON.stringify({
            level: "error",
            event: "filter_options_load_failed",
            message: error instanceof Error ? error.message : String(error),
        }));
        throw error;
    }
}
