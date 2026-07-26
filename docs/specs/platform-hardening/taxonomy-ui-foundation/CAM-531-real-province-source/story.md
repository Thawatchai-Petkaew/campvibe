## Story
As a **Camper**, I want the "จังหวัด" dropdown in the search modal to offer every province that actually has a camp, so that I can search anywhere in Thailand instead of the 7 provinces the app happened to hardcode.
Why: owner-reported from the live UI (`.claude/plans/research-user-jolly-mochi.md` "Province stub" root-cause bullet) — `components/SearchModal.tsx` populated `จังหวัด`/`อำเภอ` from `PROVINCES`/`THAILAND_DATA` in `lib/thailand-data.ts`, a hardcoded object literal with exactly 7 keys, while `buildCampSiteWhere` (`lib/campsite-filters.ts`) already matches `Location.province` (English `provinceNameEn`) against all ~77 seeded provinces — the dropdown offered far fewer options than the filter could ever match.
Scope: `components/SearchModal.tsx` + a new server action (`app/actions/getSearchLocations.ts`) that returns the distinct provinces with a published/active/non-deleted camp; retires `lib/thailand-data.ts` (its only importer). Does not touch `buildCampSiteWhere`/`lib/campsite-filters.ts` (read-only reuse of the exact same visibility predicate), `components/FilterModal.tsx`, `components/CategoryBar.tsx`, `components/ActiveFilters.tsx`, or `components/CampgroundDetailClient.tsx`.
Depends on: `.claude/plans/research-user-jolly-mochi.md` §S4 "Province/district — real source"

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper opens the search modal | The `จังหวัด` dropdown loads | The list shows every province that has at least one published, active, non-deleted camp (not a fixed 7-item list) | `getSearchProvinces()` queries `Location.province` for camps matching `buildCampSiteWhere({})` (the same visibility predicate the catalog uses), dedupes, sorts | EC-1 |
| AC-2 | Camper selects a province from the dropdown and presses ค้นหา | The catalog navigates to `/?province=<value>` | Results are camps in that exact province (never 0 results because the option was offered) | The option's `value` is byte-identical to the `Location.province` string `buildCampSiteWhere` matches by equality — no display/value mismatch | EC-2 |
| AC-3 | The province list is still loading from the server | Camper opens the dropdown | The trigger shows a loading indicator and is not selectable yet | The dropdown is `disabled` while the fetch is in flight; no stale/empty list flashes as if it were final | EC-3 |
| AC-4 | The province fetch fails (network/server error) | Camper opens the search modal | An inline error message appears under the field with a "ลองอีกครั้ง" retry control | The dropdown stays disabled (never silently empty with no explanation); pressing retry re-fetches | EC-4 |

## Rules
- BR-1 `getSearchProvinces()` reuses `buildCampSiteWhere({})` unmodified as its visibility predicate (`isActive: true`, `isPublished: true`, `deletedAt: null`) — a province is only offered when it has ≥1 camp matching that exact predicate (proves AC-1).
- BR-2 The dropdown's `SelectItem` `value` is the raw string returned by `getSearchProvinces()` (== `Location.province`, English `provinceNameEn`) — never re-derived, translated, or reformatted before being set as the value (proves AC-2).
- BR-3 The result is cached (`unstable_cache`, `revalidate: 3600`, tag = the existing `CATALOG_TAG` from `lib/catalog-cache.ts`) — busted automatically on the same publish/edit/delete writes that already bust the catalog cache, so a newly-published camp's province appears without a manual cache-clear.

## Edge cases
- EC-1 IF zero camps are published anywhere THEN the dropdown renders the empty-state copy (`ยังไม่มีจังหวัดให้เลือก`) instead of a silently empty list (BR-1)
- EC-2 IF the DB has a camp whose `Location.province` is `null` THEN that camp is excluded from the offered list (never an empty/blank option) (BR-1)
- EC-3 IF the camper opens the dropdown mid-fetch THEN it stays disabled with the loading indicator until the fetch resolves (never a stale prior list) (AC-3)
- EC-4 IF the server action throws THEN the component shows the error banner + retry, never an unexplained empty dropdown (AC-4)

## Data
- No schema/migration. Reads existing `Location.province` (already populated by `prisma/seed.ts` as the English `provinceNameEn`) through the existing `CampSite.location` relation. No new column, no new table.

## Seams & refs
- Reuse: `lib/campsite-filters.ts`'s `buildCampSiteWhere` (read-only, unmodified — the exact visibility predicate) · `lib/catalog-cache.ts`'s `CATALOG_TAG` (read-only — reusing the tag every camp create/publish/edit/delete write path already busts, per `app/api/campsites/route.ts` + `[id]/route.ts`) · `lib/hooks/use-minimum-loading.ts` (existing anti-flicker hook, not used here — see rationale below) · `components/ui/error-banner.tsx` (existing `ErrorBanner` primitive, same block-scoped pattern as `components/spot-management-section.tsx`'s zone-manager retry).
- Rationale — `useMinimumLoading` NOT used: the province fetch runs once per modal open (not a route-level client-fetch skeleton the hook targets), and the loading state renders as a small inline `Loader2` in the trigger (per `.claude/rules/loading.md` §1 decision matrix: "isolated module/widget → spinner", not a skeleton needing anti-flicker gating). The Select is simply `disabled` while `provincesLoading` is true; a sub-second real network round-trip inside a modal already open does not need a delay-before-show gate the way a page-level skeleton does.
- District control — REMOVED, not "derived from real data". Grep-verified (`grep -n "district:" prisma/seed.ts scripts/gen-mock-data.mjs` → no match): `Location.district` is never written for any seeded `CampSite` (curated hand-authored camps AND the generated mock-data pool alike) — every camp's `Location.district` is `null`. Deriving "districts-with-camps" from real data would return an empty list for every single province, which fails the "never offer/render a silently-empty control" rule harder than removing it outright. The district `Select`, its `district`/`setDistrict` state, the province-change reset effect, and the now-unused `t.search.district`/`t.search.anyDistrict` i18n keys are deleted. `district` remains a valid (unused-by-this-UI) filter param on `buildCampSiteWhere`/the catalog URL contract — unaffected, read-only.
- Out of bounds (owned elsewhere): `components/CategoryBar.tsx`, `components/FilterModal.tsx`, `components/ActiveFilters.tsx`, `components/CampgroundDetailClient.tsx`, `lib/campsite-filters.ts`, `lib/taxonomy-registry.ts`, `lib/validations/**`, `prisma/**`, `app/api/**`.

## Out of scope
- Displaying Thai province names in the dropdown (today shows the raw English `provinceNameEn`, unchanged by this story — no G2 design change requested) → follow-up ticket if the owner wants localized display labels.
- SearchModal chip standardization (`FilterChip`) and the date-picker shape fix → CAM-532/CAM-533 (separate stories, same plan §S5/§S6).
- Re-adding a district control once `Location.district` has real data at scale → follow-up ticket, data-dependent.

## Self-verify
- AC-1 → unit (`__tests__/cam-531-province-source.test.ts`: mock `prisma.campSite.findMany`, assert only provinces with a matching mocked camp are returned, a province with none is not) + owner-verify (open the search modal on localhost dev DB, confirm more than 7 provinces render)
- AC-2 → unit (round-trip: a returned province value fed into `buildCampSiteWhere({ province })` produces `where.location.province === value`, byte-identical)
- AC-3 → owner-verify (browser-only: throttle network, observe the trigger's disabled + loading indicator before the list appears)
- AC-4 → owner-verify (browser-only: force the action to reject, confirm the `ErrorBanner` + retry render and retry re-fetches)
- Story-specific: `grep -rc "thailand-data" components/ app/ lib/` → no live importer after this PR; `grep -c 'กลามปิ้ง' locales/translations.json` → 0 (drive-by GLAMP transliteration fix, `แกลมปิ้ง` is correct)
- Gate = `/quality-gate` (`npm run lint` · `npm run typecheck` · `npm test` · `npm run check:ds` · `npm run check:palette`) · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-26) — created
