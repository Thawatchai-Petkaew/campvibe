---
ticket: CAM-523
epic: taxonomy-ui-foundation
title: One taxonomy registry so a new option group is wired in one place (S7)
class: standard-refactor
version: 1
---

# CAM-523 — GROUP_REGISTRY (S7, foundation refactor)

## Story

As a **Host/Camper-facing platform** (internal-facing story — the persona is the engineering team maintaining the catalog/filter surfaces), I want ONE typed registry describing every camper-facing MasterData option group, so that adding a new filterable group in the future touches the registry + seed + i18n only, instead of the ~20 hand-maintained param↔group copies spread across 6 files today.

Scope: new `lib/taxonomy-registry.ts` (group ↔ URL param ↔ zod field ↔ i18n key ↔ filterable flag ↔ facilities-fold flag) collapsing the copies in `FilterModal.tsx` / `CatalogResults.tsx` / `InfiniteScrollGrid.tsx` / `app/page.tsx` / `lib/validations/catalog-cursor.ts` / `lib/campsite-filters.ts`; type the FilterModal filter path (`useState<any[]>` → `FilterSection[]`, `filters: any` → `CampSiteFilterParams`); fix the `equipment`/`external` pass-through gap (CatalogResults never forwarded them to `buildCampSiteWhere`, so a `?equipment=`/`?external=` URL param was silently dropped even though the zod schema + query-builder already supported it). Behavior-preserving for every already-wired param (pinned by a URL-param contract test run before AND after). NO migration, NO new UI, NO change to `lib/ai/tools/*`'s pinned CODES consts.
Depends on: CAM-512 (campsite taxonomy epic). Sibling story CAM-525 (icon/i18n unification, S9) touches `lib/facility-icon-map.ts`/`CampgroundForm.tsx` — disjoint file surface, no conflict.

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper has Terrain/Activity/Access-type/facility/Annotated-features/Camper-style chips selected plus a keyword and a date range in the filter modal | The camper presses `แสดง {N} แคมป์` | The camp grid shown is byte-identical to the pre-refactor grid for the same selections | `buildCampSiteWhere` emits the same Prisma `where` shape as before (no new/removed/reordered filter) | EC-1 |
| AC-2 | A camper opens a shared link carrying `?equipment=TENT` or `?external=SVEL` directly (no chip sets this today) | The camper loads the home page | The camp grid narrows to camps offering that equipment/external facility, instead of showing the unfiltered full catalog | `equipment`/`external` now reach `buildCampSiteWhere` via `CatalogResults` → `InfiniteScrollGrid` (previously silently dropped) | EC-2 |
| AC-3 | The FilterModal is open | The camper toggles any chip | The section list, chip layout, and applied filters look and behave exactly as before (no visual regression) | `FilterModal`'s section source/order/write/hydrate logic is now registry-driven but produces the same `selectedFilters`/URL shape | EC-3 |

## Rules

- BR-1: `lib/taxonomy-registry.ts` exports `TAXONOMY_GROUPS: { group, urlParam, zodField, i18nGroupKey, filterable, foldsInto? }[]` — `group` matches `MasterData.group` verbatim (prisma/seed.ts). `Campground type` is excluded (scalar `campSiteType` equality filter, not an `options` relation group — stays hardcoded as the special case it already was).
- BR-2: `CampSiteFilterParams` (`lib/campsite-filters.ts`) and `catalogQuerySchema` (`lib/validations/catalog-cursor.ts`) generate their 8 taxonomy fields from the registry's `FilterableZodField` union instead of a hand-written list per file; `buildCampSiteWhere`'s `addOptionFilter` call order and the province/keyword/date/price logic stay byte-for-byte unchanged (pinned by the AC-1 contract test).
- BR-3: `FilterModal.tsx`'s `useState<any[]>` (filter sections) and `filters: any` (match-count query object) are replaced with real types (`FilterSection[]`, `CampSiteFilterParams`) — no unjustified `any` remains in the file.
- BR-4: `equipment`/`external` are wired end-to-end (props + `isSearchActive` + the Suspense/grid remount key + `buildCampSiteWhere` args) in `CatalogResults.tsx`, `InfiniteScrollGrid.tsx`, and `app/page.tsx` — kept as their OWN independent URL params (not folded into `facilities`), matching what `catalogQuerySchema`/`buildCampSiteWhere` already accepted; FilterModal's own UI still folds External facility + Equipment-for-rent chip selections into the shared `facilities` param on write (CAM-496, unchanged) — the fix only makes the read-side pass-through honor a direct `equipment=`/`external=` param, it does not change what FilterModal itself writes.
- BR-5: `NON_FILTERABLE_GROUPS` in `FilterModal.tsx` stays a hand-written literal (not imported from the registry) because `__tests__/cam-521-metadata-groups.test.ts` source-inspects that exact literal and is outside this story's file surface; a new guard test keeps the literal and the registry's `NON_FILTERABLE_GROUP_NAMES` in sync.

## Edge cases

- EC-1: IF the URL-param contract test (run on the untouched code before this refactor) shows a param NOT surviving `page.tsx → CatalogResults → buildCampSiteWhere` THEN that gap is the deliberate BR-4 fix (equipment/external), not a regression — every OTHER param must still survive unchanged.
- EC-2: IF `equipment`/`external` are absent from the URL THEN `buildCampSiteWhere` behaves exactly as before (no filter added) — the fix is additive, not user-triggered by any FilterModal chip today (dormant capability wired for future direct-link/AI-chat callers).
- EC-3: IF a future group is added to the registry with `filterable:false` (like CAM-521's 3 metadata groups) THEN it must not render as a FilterModal section, participate in `buildCampSiteWhere`, or appear in `catalogQuerySchema` (mirrors the existing `Stay connected`/`Marking method`/`Driveway` exclusion).

## Data

No schema/migration change. Touches only application code (`lib/`, `components/`, `app/page.tsx`) + tests.

## Seams & refs

- Reuse: `lib/campsite-filters.ts`'s `buildCampSiteWhere`/`addOptionFilter` stay the single query-building owner (no parallel logic added); `app/actions/getFilterOptions.ts` stays the single MasterData-group reader.
- Refs: CAM-496 (facilities-fold origin), CAM-461 (string\|string[] widening technique reused by the registry-derived type), CAM-512 epic plan §"S7 · GROUP_REGISTRY".
- Reader/writer inventory (architecture.md §15b — `equipment`/`external` shape unchanged, only NEWLY WIRED): `lib/campsite-filters.ts` addOptionFilter (NO-CHANGE, already accepted both) · `lib/validations/catalog-cursor.ts` zod schema (NO-CHANGE, already accepted both) · `app/api/campsites/route.ts` GET (NO-CHANGE, already destructures + forwards both — confirmed by reading the route; out of this story's file surface) · `components/CatalogResults.tsx` (NOW forwards, was the gap) · `components/InfiniteScrollGrid.tsx` (NOW forwards) · `app/page.tsx` (NOW forwards) · `components/FilterModal.tsx` (NO-CHANGE — still folds these 2 groups' chip selections into `facilities` on write; only the independent-param READ path changed elsewhere) · `lib/ai/tools/search-campsites.ts`/`bulk-availability` (NO-CHANGE, out of bounds, pinned CODES consts untouched, group names still match the registry).

## Out of scope

- FilterModal count-vs-apply parity (S8, CAM-524 — separate story; this story does not touch the match-count query's base-param parity, only its typing).
- Icon/i18n unification (S9, CAM-525 — separate story, disjoint file surface).
- Reconciling `app/api/campgrounds/*` legacy route or any other S11 dead-code removal.

## Self-verify

- AC-1 → unit (`__tests__/cam-523-url-param-contract.test.ts`, `buildCampSiteWhere` shape pin) + integration (behavioral render tests already covering FilterModal: `cam-496-*`, `cam-515-*`, `cam-516-*`, `cam-521-*` re-run green)
- AC-2 → unit (`CatalogResults` invoked directly with mocked prisma/campsite-filters, asserting `equipment`/`external` reach `buildCampSiteWhere`)
- AC-3 → integration (existing jsdom-rendered FilterModal tests unchanged/green — behavior, not source-text, pinned)
- Story-specific: no `any` left in `FilterModal.tsx` (`grep -c ': any'` → 0); `npx vitest run` full suite green (no pre-existing test broken) — ONE known, deliberate exception documented in the PR: `__tests__/cam-344-availability-badge.test.ts`'s `const filters: any = {};` source-inspection anchor no longer matches after BR-3's typing fix (that test file is outside this story's surface; the anchor needs a one-line follow-up update)
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-26) — created
