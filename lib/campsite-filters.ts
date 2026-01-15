import { Prisma } from "@prisma/client";

export interface CampSiteFilterParams {
  type?: string;
  keyword?: string;
  province?: string;
  district?: string;
  startDate?: string;
  endDate?: string;
  guests?: string;
  min?: string;
  max?: string;
  access?: string;
  facilities?: string;
  external?: string;
  equipment?: string;
  activities?: string;
  terrain?: string;
}

// Shared helper to build Prisma where-clause for camp site listing & counts
export function buildCampSiteWhere(params: CampSiteFilterParams): Prisma.CampSiteWhereInput {
  const {
    type,
    keyword,
    province,
    district,
    startDate,
    endDate,
    min,
    max,
    access,
    facilities,
    external,
    equipment,
    activities,
    terrain,
  } = params;

  const where: Prisma.CampSiteWhereInput = {
    isActive: true,
    isPublished: true,
  };

  // 1. Type filter
  if (type && type !== "ALL") {
    where.campSiteType = type;
  }

  // 2. Keyword filter
  if (keyword) {
    where.OR = [
      { nameTh: { contains: keyword } },
      { nameEn: { contains: keyword } },
      { description: { contains: keyword } },
      { operator: { name: { contains: keyword } } },
    ];
  }

  // 3. Location filter
  if (province || district) {
    where.location = where.location || {};
    if (province) where.location.province = province;
    if (district) where.location.district = district;
  }

  // 4. Price Filter
  if (min || max) {
    where.priceLow = {};
    if (min) where.priceLow.gte = parseFloat(min);
    if (max) where.priceLow.lte = parseFloat(max);
  }

  // 5. Multi-select Filters (AND logic)
  const addMultiSelectFilter = (field: keyof Prisma.CampSiteWhereInput, param?: string) => {
    if (!param) return;
    const codes = param.split(",").filter(Boolean);
    if (codes.length > 0) {
      // Initialise AND as array of conditions if not present
      if (!where.AND) where.AND = [];
      const andArray = Array.isArray(where.AND) ? where.AND : [where.AND];
      codes.forEach((code) => {
        andArray.push({
          [field]: { contains: code },
        } as Prisma.CampSiteWhereInput);
      });
      where.AND = andArray;
    }
  };

  // Match schema fields
  addMultiSelectFilter("accessTypes" as any, access);
  addMultiSelectFilter("facilities" as any, facilities);
  addMultiSelectFilter("externalFacilities" as any, external);
  addMultiSelectFilter("equipment" as any, equipment);
  addMultiSelectFilter("activities" as any, activities);
  addMultiSelectFilter("terrain" as any, terrain);

  // 6. Availability Filter (used only when dates are provided)
  if (startDate && endDate) {
    where.spots = {
      some: {
        bookings: {
          none: {
            OR: [
              {
                checkInDate: { lte: new Date(endDate) },
                checkOutDate: { gte: new Date(startDate) },
              },
            ],
            status: { not: "CANCELLED" },
          },
        },
      },
    };
  }

  return where;
}

