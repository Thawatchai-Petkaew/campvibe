import { Prisma, type PrismaClient } from "@prisma/client";
import { type FilterableZodField } from "@/lib/taxonomy-registry";

/**
 * CAM-523 (S7) — the 8 taxonomy fields (access/facilities/external/equipment/
 * activities/terrain/annotatedFeatures/camperStyle) are GENERATED from
 * lib/taxonomy-registry.ts's `FilterableZodField` union instead of being
 * hand-listed here (collapses the last of ~20 hand-maintained param<->group
 * copies — see docs/specs/.../CAM-523-taxonomy-registry/story.md). Adding a
 * new filterable MasterData group to the registry widens this type
 * automatically; no change needed in this file's type declaration.
 *
 * CAM-461 Decision 1 — each generated field accepts EITHER a `string`
 * (unchanged — comma-separated codes, AND-per-code, byte-identical to
 * pre-CAM-523 for every existing caller, see `__tests__/cam-408-*.test.ts:61`,
 * pinned) OR a `string[]` (the AI tool only: OR-within-group,
 * `{ code: { in: [...] } }` — see `addOptionFilter` below for the exact
 * branch). Widening `string` to `string | string[]` is additive — every
 * existing string caller still type-checks unchanged.
 */
type TaxonomyFilterFields = {
  [K in FilterableZodField]?: string | string[];
};

export type CampSiteFilterParams = TaxonomyFilterFields & {
  type?: string;
  keyword?: string;
  /**
   * CAM-463 Decision 4 — widened from `string` to `string | string[]`
   * (additive, reuses the CAM-461 `string | string[]` widening TECHNIQUE).
   * `string` (unchanged — EVERY existing catalog caller): byte-identical
   * equality shape (`where.location.province = province`). `string[]` (NEW,
   * the AI `searchCampsites` tool's region-expansion only): emits
   * `{ in: [...] }` — the province-SET match a resolved region needs.
   */
  province?: string | string[];
  /**
   * CAM-563 — additive, OPT-IN: AdminArea ids (already resolved by the
   * caller, see `resolveProvinceAdminAreaIds` below) that ALSO count as a
   * match for the `province` NAME given above. Only consulted when
   * `province` is a plain `string` (the array/`in` branch — CAM-461/463's
   * AI region-expansion — is UNCHANGED and does not read this field; see
   * tech.md's Seams section for why). Absent/empty = the exact pre-CAM-563
   * string-equality behavior, BYTE-IDENTICAL to before — pinned by
   * `__tests__/cam-463-campsite-filters-province-set.test.ts`, which never
   * sets this field.
   *
   * Root cause this closes: `Location.province`/`district`/`subDistrict`
   * are free text written in whichever UI language was active when the
   * host saved (CAM-559 finding), so an exact string match on `province`
   * alone can miss a camp stored in the other language for the SAME real
   * province. Resolving the incoming name to its AdminArea subtree
   * (province node + every descendant district/sub-district) FIRST, then
   * OR-ing that id-set alongside the legacy string, means a camp matches
   * regardless of which language its `province` column happens to hold —
   * without ever removing the legacy path (no big-bang swap, BR-3).
   */
  provinceAdminAreaIds?: string[];
  district?: string;
  startDate?: string;
  endDate?: string;
  guests?: string;
  min?: string;
  max?: string;
  /**
   * CAM-270 BR-9 — additive pet-friendly filter for the AI searchCampsites
   * tool. Only applied when explicitly `true` (absent/false = no filtering,
   * existing behavior unchanged for every other caller of this function).
   */
  petFriendly?: boolean;
  /**
   * CAM-461 BR-1 — id-exclusion for the AI searchCampsites tool's `excludeIds`
   * ("ขออีก" — hide already-shown camps). Empty/absent = no exclusion
   * (unchanged behavior for every other caller). Bounding to MAX_EXCLUDE_IDS
   * happens in the caller (search-campsites.ts), BEFORE this function runs
   * (CAM-344 — cap a model-controlled array length before the query).
   */
  excludeIds?: string[];
};

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
    annotatedFeatures,
    camperStyle,
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
  // CAM-463 Decision 4 — `province` is now `string | string[]`. The `string`
  // branch is UNCHANGED — byte-identical equality shape for every existing
  // catalog caller, INCLUDING the falsy guard: an empty string ('') means
  // "no province filter", exactly like the pre-CAM-463 `if (province) …`
  // (regression CAM-463 QA found: a widened `province !== undefined` guard
  // let '' through and set `where.location.province = ''`, matching zero
  // camps instead of falling through — fixed by keeping the truthy check on
  // the string path). The `string[]` branch (NEW, AI tool region-expansion
  // only) emits an `in`-set; an empty array means "no province filter"
  // (mirrors `addOptionFilter`'s EC guard below), never a zero-match query.
  if (province || district) {
    where.location = where.location || {};
    if (Array.isArray(province)) {
      const names = province.filter(Boolean);
      if (names.length > 0) where.location.province = { in: names };
    } else if (province) {
      // CAM-563 — only engaged when the caller supplies resolved ids
      // (`provinceAdminAreaIds`); every existing caller that omits it keeps
      // the exact pre-CAM-563 plain-equality shape on the line below,
      // UNCHANGED (byte-identical for every catalog caller — '' falls
      // through, no filter).
      const ids = params.provinceAdminAreaIds;
      if (ids && ids.length > 0) {
        where.location.OR = [
          { province }, // legacy exact-string match — never removed (BR-3)
          { adminAreaId: { in: ids } }, // CAM-563 — id-based, language-agnostic match
        ];
      } else {
        where.location.province = province; // UNCHANGED — byte-identical for every catalog caller ('' falls through, no filter)
      }
    }
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

  // 6. Multi-select taxonomy filters — S4a: taxonomy now lives in the `options`
  // MasterData relation.
  //
  // CAM-461 Decision 1 — `param` is now `string | string[]`:
  //   - `string` (unchanged, EVERY existing catalog caller): comma-split, ONE
  //     `{ options: { some: { code } } }` element PER code pushed onto
  //     where.AND (AND-per-code) — byte-identical to the pre-CAM-461 shape
  //     (see `__tests__/cam-408-*.test.ts:61`, pinned).
  //   - `string[]` (NEW, the AI tool only): ONE
  //     `{ options: { some: { code: { in: [...] } } } }` element (OR-within-
  //     group — a camp matching ANY of the listed codes satisfies this
  //     group). Groups still stay AND-ed against each other because both
  //     branches push onto the SAME where.AND array.
  // Codes are globally unique (MasterData.code is the PK) so the group is
  // implied and need not be matched.
  const addOptionFilter = (param?: string | string[]) => {
    if (param === undefined) return;
    if (Array.isArray(param)) {
      // NEW: OR-within-group (CAM-461 BR-3). EC-3 — an empty array means
      // "group not specified" (no filter for that group), never a
      // zero-match query.
      const codes = param.filter(Boolean);
      if (codes.length === 0) return;
      if (!where.AND) where.AND = [];
      const andArray = Array.isArray(where.AND) ? where.AND : [where.AND];
      andArray.push({ options: { some: { code: { in: codes } } } } as Prisma.CampSiteWhereInput);
      where.AND = andArray;
      return;
    }
    // UNCHANGED string path — equality shape preserved exactly.
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
  addOptionFilter(annotatedFeatures);
  addOptionFilter(camperStyle);

  // 7. CAM-270 BR-9 — additive pet-friendly filter (AI searchCampsites tool).
  // Only applied when explicitly requested (`petFriendly: true`); pushed into
  // where.AND so it never clobbers the keyword OR built in step 2. Absent or
  // false leaves pet filtering untouched — this is a pure addition, no other
  // caller's behavior changes.
  if (params.petFriendly) {
    if (!where.AND) where.AND = [];
    const andArray = Array.isArray(where.AND) ? where.AND : [where.AND];
    andArray.push({ petFriendly: true } as Prisma.CampSiteWhereInput);
    where.AND = andArray;
  }

  // 8. CAM-461 BR-1 — additive id-exclusion (AI searchCampsites tool's
  // `excludeIds`, "ขออีก"/"ไม่เอาที่แสดงไปแล้ว"). Only applied when a
  // non-empty array is supplied; absent/[] leaves every other caller
  // untouched. Bounding to MAX_EXCLUDE_IDS happens in the caller BEFORE this
  // function runs (CAM-344 — cap a model-controlled array length before the
  // query), so `where.id.notIn` here is already bounded.
  if (params.excludeIds && params.excludeIds.length > 0) {
    where.id = { notIn: params.excludeIds };
  }

  // 9. (REMOVED — CAM-344, hide→badge pivot, BR-6) Dated search no longer
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

/**
 * CAM-563 — resolves a province NAME (Thai or English) to every AdminArea id
 * that should count as "a camp in this province": the matched PROVINCE node
 * itself, plus every DISTRICT and SUBDISTRICT node beneath it. A camp's
 * `Location.adminAreaId` holds the DEEPEST level actually resolved for that
 * camp (subDistrict ?? district ?? province — see the CAM-563 backfill
 * script), so matching ONLY the province-level id would silently miss every
 * camp whose id points to a deeper node.
 *
 * Returns `[]` when the name matches no known province — the caller must
 * treat that as "no id-based boost available" and fall back to the legacy
 * string-equality path alone (never a silent zero; `buildCampSiteWhere`
 * above OR's the id-set alongside the string, so an empty array here simply
 * means the OR contributes nothing new).
 *
 * Matching is exact (case-insensitive `equals`), never `contains` — the
 * DEF-1/DEF-2 Thai-substring collision lesson (`.claude/rules/code.md`)
 * applies to a closed administrative-name set too.
 */
export async function resolveProvinceAdminAreaIds(
  prisma: Pick<PrismaClient, "adminArea">,
  name: string
): Promise<string[]> {
  if (!name) return [];

  const nameMatch = {
    OR: [
      { nameTh: { equals: name, mode: "insensitive" as const } },
      { nameEn: { equals: name, mode: "insensitive" as const } },
    ],
  };

  const province = await prisma.adminArea.findFirst({
    where: { countryCode: "TH", level: "PROVINCE", ...nameMatch },
    select: { id: true },
  });
  if (!province) return [];

  const districts = await prisma.adminArea.findMany({
    where: { countryCode: "TH", level: "DISTRICT", parentId: province.id },
    select: { id: true },
  });
  const districtIds = districts.map((d) => d.id);

  const subDistricts = districtIds.length
    ? await prisma.adminArea.findMany({
        where: { countryCode: "TH", level: "SUBDISTRICT", parentId: { in: districtIds } },
        select: { id: true },
      })
    : [];

  return [province.id, ...districtIds, ...subDistricts.map((s) => s.id)];
}

