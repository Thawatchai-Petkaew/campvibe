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
        console.error("Failed to fetch filter options:", error);
        return {};
    }
}
