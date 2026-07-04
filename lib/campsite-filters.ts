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
  // NOTE: startDate/endDate are still part of CampSiteFilterParams (the shared
  // shape carried through the whole query pipeline) but are intentionally NOT
  // destructured/used here since CAM-344 removed the date-availability
  // exclusion (former step 7, see below) — dates now drive ONLY the badge
  // computation (lib/campsite-availability.ts getAvailabilityStatusForCamps),
  // never the WHERE clause.
  const {
    type,
    keyword,
    province,
    district,
    guests,
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

  // 5. Guest-capacity filter — only include camps that can host at least N guests.
  // Uses CampSite.maxGuestsPerDay (the authoritative camp-level capacity field, set by
  // the operator). Camps where maxGuestsPerDay is NULL have no explicit capacity set and
  // MUST remain visible for all guest counts (we cannot exclude capacity-unknown camps).
  // Guard: only apply when guests is a positive integer; ignore 0 / NaN / missing.
  //
  // SQL emitted: WHERE (maxGuestsPerDay >= N OR maxGuestsPerDay IS NULL)
  // We push into where.AND so we never clobber where.OR (used by keyword search, step 2).
  const guestsNum = guests !== undefined ? parseInt(guests, 10) : NaN;
  if (!isNaN(guestsNum) && guestsNum > 0) {
    if (!where.AND) where.AND = [];
    const andArray = Array.isArray(where.AND) ? where.AND : [where.AND];
    andArray.push({
      OR: [{ maxGuestsPerDay: { gte: guestsNum } }, { maxGuestsPerDay: null }],
    } as Prisma.CampSiteWhereInput);
    where.AND = andArray;
  }

  // 6. Multi-select taxonomy filters (AND logic) — S4a: taxonomy now lives in the `options`
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

  // 7. (REMOVED — CAM-344, hide→badge pivot, BR-6) Dated search no longer
  // excludes any camp by date-availability. The former step 7 excluded camps
  // by Booking overlap + whole-camp BlockedDate, but was blind to InternalHold
  // (CAM-302) — a data-correctness bug fixed by construction now that no
  // date-availability exclusion runs here at all. A camp unavailable for the
  // selected dates now stays in the results, badged instead (see
  // lib/campsite-availability.ts getAvailabilityStatusForCamps), computed from
  // the single availability source (ADR-009). Step 5 (static guest-capacity,
  // a structural gate independent of dates) is unchanged above.

  return where;
}

