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
    deletedAt: null, // exclude soft-deleted (S2 — Atomic Data Framework)
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

  // 5. Multi-select taxonomy filters (AND logic) — S4a: taxonomy now lives in the `options`
  // MasterData relation. Each selected code must be present, so AND one
  // `options: { some: { code } }` per code. Codes are globally unique (MasterData.code is the
  // PK) so the group is implied and need not be matched.
  const addOptionFilter = (param?: string) => {
    if (!param) return;
    const codes = param.split(",").filter(Boolean);
    if (codes.length === 0) return;
    if (!where.AND) where.AND = [];
    const andArray = Array.isArray(where.AND) ? where.AND : [where.AND];
    codes.forEach((code) => {
      andArray.push({ options: { some: { code } } } as Prisma.CampSiteWhereInput);
    });
    where.AND = andArray;
  };

  addOptionFilter(access);
  addOptionFilter(facilities);
  addOptionFilter(external);
  addOptionFilter(equipment);
  addOptionFilter(activities);
  addOptionFilter(terrain);

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

