"use server";

import { prisma } from "@/lib/prisma";

export async function getCampgroundCount(filters: any) {
    const { type, min, max, access, facilities, activities, terrain } = filters;

    // Build filter object
    const where: any = {
        isActive: true,
        isPublished: true
    };

    if (type && type !== 'ALL') {
        where.campgroundType = type;
    }

    // Price Filter
    if (min || max) {
        where.priceLow = {};
        if (min) where.priceLow.gte = parseFloat(min);
        if (max) where.priceLow.lte = parseFloat(max);
    }

    // Helper for multi-select AND logic
    const addMultiSelectFilter = (field: string, param: string | undefined) => {
        if (!param) return;
        const codes = param.split(',').filter(Boolean);
        if (codes.length > 0) {
            where.AND = where.AND || [];
            codes.forEach(code => {
                where.AND.push({
                    [field]: { contains: code }
                });
            });
        }
    };

    addMultiSelectFilter('accessTypes', access);
    addMultiSelectFilter('facilities', facilities);
    addMultiSelectFilter('externalFacilities', filters.external);
    addMultiSelectFilter('equipment', filters.equipment);
    addMultiSelectFilter('activities', activities);
    addMultiSelectFilter('terrain', terrain);

    try {
        const count = await prisma.campground.count({
            where
        });
        return count;
    } catch (error) {
        console.error("Count error:", error);
        return 0;
    }
}
