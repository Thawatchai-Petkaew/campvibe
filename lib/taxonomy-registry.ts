/**
 * lib/taxonomy-registry.ts — CAM-523 (S7, foundation refactor)
 *
 * ONE typed registry describing every MasterData option group the camper-
 * facing catalog/filter surfaces care about. Before this file, the same
 * group <-> URL-param <-> zod-field <-> i18n-key map was hand-copied ~20
 * times across FilterModal (x6) / CatalogResults (x5) / InfiniteScrollGrid
 * (x2) / app/page.tsx (x4) / lib/validations/catalog-cursor.ts /
 * lib/campsite-filters.ts (x3) — the reason every new group historically
 * missed a touchpoint (see docs/specs/.../CAM-523-taxonomy-registry/story.md).
 *
 * Adding a NEW filterable MasterData group going forward should touch only:
 *   1. prisma/seed.ts            — the MasterData rows for the new group
 *   2. this file                — one new TAXONOMY_GROUPS entry
 *   3. locales/translations.json — `filter.<GroupName>` + per-code i18n keys
 * — every catalog touchpoint this registry feeds (FilterModal sections,
 * CatalogResults/InfiniteScrollGrid/page.tsx prop-forwarding, the zod query
 * schema, and CampSiteFilterParams's taxonomy fields) updates itself.
 *
 * `group` MUST match `MasterData.group` exactly (prisma/seed.ts) — it is the
 * join key camper-facing code uses to look up options from getFilterOptions().
 *
 * `Campground type` is intentionally NOT in this registry: its codes write to
 * `CampSite.campSiteType`, a single scalar enum column (equality filter,
 * single-select `type` URL param) — never the `CampSite.options` m2m relation
 * every group below uses. It stays a MasterData group (label/icon lookup) but
 * does not fit this registry's "CSV multi-value via options relation" shape.
 * FilterModal / CatalogResults / buildCampSiteWhere keep handling `type` as
 * the special case it already is — unchanged by this refactor.
 *
 * NOTE — one deliberate exception: `components/FilterModal.tsx`'s
 * `NON_FILTERABLE_GROUPS` constant stays a hand-written literal array (NOT an
 * import of NON_FILTERABLE_GROUP_NAMES below), because an existing pinned
 * test (`__tests__/cam-521-metadata-groups.test.ts`) source-inspects that
 * exact `NON_FILTERABLE_GROUPS = [...]` literal and is outside this story's
 * file surface. `__tests__/cam-523-taxonomy-registry.test.ts` guards the two
 * lists staying in sync so they cannot silently drift apart.
 */

export interface TaxonomyGroupDef {
  /** MasterData.group — exact string (prisma/seed.ts), the join key. */
  readonly group: string;
  /** Catalog URL query-param name (page.tsx / CatalogResults / InfiniteScrollGrid / /api/campsites). */
  readonly urlParam: string;
  /** Field name on CampSiteFilterParams (lib/campsite-filters.ts) + catalogQuerySchema (lib/validations/catalog-cursor.ts). */
  readonly zodField: string;
  /** Key into t.filter[...] (locales/translations.json) for the section/group title — today identical to `group`. */
  readonly i18nGroupKey: string;
  /** Whether this group is a camper-facing filter (renders a FilterModal section + participates in buildCampSiteWhere). */
  readonly filterable: boolean;
  /**
   * CAM-496 — when set, FilterModal's WRITE path merges this group's
   * selected codes into the OWNING group's URL param (`facilities`, owned by
   * Internal facility) instead of this group's own `urlParam`. Read-side
   * (buildCampSiteWhere, catalogQuerySchema, the /api/campsites cursor route)
   * still accepts this group's own `urlParam` independently — folding is a
   * FilterModal UI convenience, not a query-builder restriction (S7 wires
   * the independent pass-through correctly; see story.md HARD REQ #3).
   */
  readonly foldsInto?: "facilities";
}

// Declaration order = FilterModal's display/section order (Campground type,
// rendered separately, always comes first — see FilterModal.tsx's own
// sortOrder). This order is NOT the buildCampSiteWhere `where.AND` push
// order (kept as its own explicit, unchanged sequence in campsite-filters.ts
// to stay byte-equivalent with pre-CAM-523 output).
export const TAXONOMY_GROUPS = [
  { group: "Terrain", urlParam: "terrain", zodField: "terrain", i18nGroupKey: "Terrain", filterable: true, foldsInto: undefined },
  { group: "Activity", urlParam: "activities", zodField: "activities", i18nGroupKey: "Activity", filterable: true, foldsInto: undefined },
  { group: "Access type", urlParam: "access", zodField: "access", i18nGroupKey: "Access type", filterable: true, foldsInto: undefined },
  { group: "Internal facility", urlParam: "facilities", zodField: "facilities", i18nGroupKey: "Internal facility", filterable: true, foldsInto: undefined },
  { group: "External facility", urlParam: "external", zodField: "external", i18nGroupKey: "External facility", filterable: true, foldsInto: "facilities" },
  { group: "Equipment for rent", urlParam: "equipment", zodField: "equipment", i18nGroupKey: "Equipment for rent", filterable: true, foldsInto: "facilities" },
  { group: "Annotated features", urlParam: "annotatedFeatures", zodField: "annotatedFeatures", i18nGroupKey: "Annotated features", filterable: true, foldsInto: undefined },
  { group: "Camper style", urlParam: "camperStyle", zodField: "camperStyle", i18nGroupKey: "Camper style", filterable: true, foldsInto: undefined },
  // CAM-521 (S8) — host-input + camper-detail-display only, NOT a search/filter dimension (BR-4).
  { group: "Stay connected", urlParam: "stayConnected", zodField: "stayConnected", i18nGroupKey: "Stay connected", filterable: false, foldsInto: undefined },
  { group: "Marking method", urlParam: "markingMethod", zodField: "markingMethod", i18nGroupKey: "Marking method", filterable: false, foldsInto: undefined },
  { group: "Driveway", urlParam: "driveway", zodField: "driveway", i18nGroupKey: "Driveway", filterable: false, foldsInto: undefined },
] as const satisfies readonly TaxonomyGroupDef[];

export type TaxonomyGroupEntry = (typeof TAXONOMY_GROUPS)[number];
export type FilterableTaxonomyGroupEntry = Extract<TaxonomyGroupEntry, { filterable: true }>;
export type FilterableZodField = FilterableTaxonomyGroupEntry["zodField"];
export type FilterableUrlParam = FilterableTaxonomyGroupEntry["urlParam"];

/** The 8 camper-facing filter groups, in FilterModal's display order. */
export const FILTERABLE_GROUPS: readonly FilterableTaxonomyGroupEntry[] = TAXONOMY_GROUPS.filter(
  (g): g is FilterableTaxonomyGroupEntry => g.filterable
);

/** The 3 host-input/display-only groups (CAM-521 S8) — never rendered as a FilterModal section. */
export const NON_FILTERABLE_GROUP_NAMES: readonly string[] = TAXONOMY_GROUPS.filter((g) => !g.filterable).map(
  (g) => g.group
);

/**
 * CAM-496 — the 3 sections whose selected codes all fold into the single
 * `facilities` URL param when FilterModal applies its selections (Internal
 * facility owns the param; External facility + Equipment for rent fold in).
 */
export const FACILITY_SECTION_GROUP_NAMES: readonly string[] = TAXONOMY_GROUPS.filter(
  (g) => g.filterable && (g.urlParam === "facilities" || g.foldsInto === "facilities")
).map((g) => g.group);

/** Every filterable group's own URL param (registry declaration order). */
export const FILTERABLE_URL_PARAMS: readonly FilterableUrlParam[] = FILTERABLE_GROUPS.map((g) => g.urlParam);

/** Every filterable group's zod/CampSiteFilterParams field name (registry declaration order). */
export const FILTERABLE_ZOD_FIELDS: readonly FilterableZodField[] = FILTERABLE_GROUPS.map((g) => g.zodField);
