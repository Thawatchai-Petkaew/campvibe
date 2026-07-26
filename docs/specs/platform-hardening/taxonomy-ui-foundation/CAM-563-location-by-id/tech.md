---
feature: Platform hardening
epic: taxonomy-ui-foundation
persona: Host
artifact: tech
owner: backend-engineer
status: done
version: v1
updated: 2026-07-26
---
# Tech — Camps reference their location by id instead of free text (CAM-563)

## Data model

**No migration.** `Location.adminAreaId` (`prisma/schema.prisma:236`) and its index (`:247`) already exist — designed, never populated. Confirmed against the real dev DB, before and after every change in this story:

```
$ prisma migrate status            # BEFORE
23 migrations found in prisma/migrations
Database schema is up to date!

$ prisma migrate status            # AFTER all code changes in this story
23 migrations found in prisma/migrations
Database schema is up to date!

$ prisma migrate dev --name cam-563-noop-check
Already in sync, no schema change or pending migration was found.
```
`git status --short prisma/migrations/ prisma/schema.prisma` is empty. This story is a data backfill + additive query/write-path changes only.

**Backfill result (real run against the dev DB, `scripts/backfill-cam-563-location-admin-area.mjs`):**

| | rows |
|---|---|
| `adminAreaId` set BEFORE | 12 of 652 |
| `adminAreaId` set AFTER | **650 of 652** |
| rows updated by this run | 638 |
| unresolved | 2 |

Idempotency proof (same script, run twice in a row): first run → `candidates scanned: 640, rows updated: 638`; second run → `candidates scanned: 2, rows updated: 0` (both unresolved rows remain candidates each time — never re-touched once resolved, never silently retried into a wrong value).

**Unresolved (2 of 652, reported not silenced):**
```json
[
  {"id":"89dffcba-d981-45a1-9d87-ddc818f6c464","province":"x","district":null,"subDistrict":null,"hasLiveCamp":false},
  {"id":"e9ca66f2-c96e-43e1-b71c-0865b8df6287","province":"x","district":null,"subDistrict":null,"hasLiveCamp":false}
]
```
Both are orphaned placeholder rows (`province: "x"`, no `CampSite` attached) — verified directly (`prisma.location.findMany({ where: { province: 'x' }, include: { campSites: true } })` → `campSites: []` on both). **Every one of the 650 real, live camps in the dev DB now has `adminAreaId` set.** All 78 distinct `Location.province` values in the dev DB are stored in English today (0 Thai-stored rows found) — the bilingual branch of the matcher is exercised and tested (see `test.md`/the test files), but has no CURRENT mismatched row to fix in this dataset; it closes the gap the moment one exists (CAM-559's root-cause finding is about the write path's behavior, not a claim that today's dev-DB snapshot already contains a mismatch).

## API contract

No new endpoint, no contract-shape change. Additive-only, backward-compatible (api.md §12):

- `lib/campsite-filters.ts` `CampSiteFilterParams` gains one new **optional** field: `provinceAdminAreaIds?: string[]`. Absent (every existing caller) → `buildCampSiteWhere`'s `province: string` branch is byte-identical to pre-CAM-563 (pinned by the EXISTING `__tests__/cam-463-campsite-filters-province-set.test.ts`, untouched by this story). Present → `where.location.OR = [{province}, {adminAreaId:{in:ids}}]`, additive (never removes the string path).
- New export `resolveProvinceAdminAreaIds(prisma, name): Promise<string[]>` — resolves a province name (Thai or English) to itself + every descendant district + every descendant sub-district AdminArea id. Returns `[]` on no match (never throws on an unknown name).
- `POST /api/location` — unchanged method/path/authz/error codes. `adminAreaId` resolution (already present, province-only) now ALSO walks `DISTRICT` then `SUBDISTRICT` when the host typed those free-text fields (confirmed live in `components/CampgroundForm.tsx`'s POST body today), stopping at the deepest level that matches.

Confirmation: `__tests__/cam-563-campsite-filters-province-id.test.ts` (shape + count-parity), `__tests__/cam-563-campsites-route-province-id.test.ts` (route wiring + fail-open), `__tests__/cam-563-location-route-admin-area.test.ts` (write-path depth), `__tests__/cam-563-location-admin-area-backfill.test.ts` (backfill + idempotency + unresolved report).

## Reader/writer inventory (architecture.md §15b — mandatory sweep)

**Search method:** `grep -rn "buildCampSiteWhere\|Location.province\|location.province\|withProvinceThaiNames\|getProvinceThaiNameMap" app/ lib/ components/ scripts/` + `grep -rln "buildCampSiteWhere" __tests__/`, then read every hit's call site. Cross-checked against the ticket's own named readers (`lib/campsite-filters.ts`, CAM-531's dropdown, CAM-545's card lookup, CAM-548's detail page, search, AI-chat tools).

| Reader/writer | Touches `province`/location how | Action this story | Why |
|---|---|---|---|
| `lib/campsite-filters.ts` `buildCampSiteWhere` (string branch) | exact-equality `where.location.province` | **NOW** — additive `provinceAdminAreaIds` OR-branch, opt-in | the ticket's named root-cause reader |
| `app/api/campsites/route.ts` `GET` (catalog list/pagination) | calls `buildCampSiteWhere` with the URL `province` param | **NOW** — resolves the incoming name to its AdminArea subtree before calling `buildCampSiteWhere`, fail-open | the live public catalog endpoint; the one the AC-2 count-parity requirement targets |
| `lib/ai/tools/search-campsites.ts` `executeSearchCampsites` | calls `buildCampSiteWhere` with `provinceFilter` (already bilingual via CAM-404's `resolveProvinceForSearch` → `ThailandLocation`) | **NOW** — additive id-resolution alongside the existing CAM-404 bridge, single-province branch only | the ticket's named "any AI-chat tool that filters by location"; CAM-404 already closes the CURRENT bug via a different (name-to-name) bridge, this adds robustness against a future Thai-stored `province` column |
| `POST /api/location` (`app/api/location/route.ts`) | writes `Location.adminAreaId`, was province-only | **NOW** — walks DISTRICT/SUBDISTRICT when typed | satisfies AC-3/AC-4 directly; the only live write path for a new camp |
| `lib/read-models/camp-card.ts` `withProvinceThaiNames`/`campCardSelect` (CAM-545's Thai card name) | name-matches `Location.province` against `ThailandLocation.provinceNameEn` | **INVESTIGATED, DEFERRED** | adding `adminArea` to the shared `campCardSelect` makes it a required key on the Prisma-derived `CampCardPayload`/`CampSiteCardData` type, which ripples into `lib/read-models/ai-camp-card.ts` (spreads `campCardSelect` verbatim into `aiCampCardSelect`) and `app/wishlist/page.tsx` (type-annotates an independently-shaped hand-rolled query result as `CampSiteCardData`) — both broke `tsc --noEmit` the moment the field became required (the SAME ripple CAM-545 itself hit adding `district`, which DID touch `ai-camp-card.ts`'s test fixtures at the time — see that story). Both files are outside this dispatch's allowed surface. The existing name-match already covers 650/650 real camps today (no live defect) — recommend a follow-up story scoped to touch `camp-card.ts` + `ai-camp-card.ts` + `wishlist/page.tsx` together. |
| CAM-531's province dropdown (`app/actions/getSearchLocations.ts`, `components/SearchModal.tsx`) | `SELECT DISTINCT province` on the free-text column, `Select` value = the raw string | **OUT-OF-SURFACE** | neither file is in this dispatch's allowed surface (`getSearchLocations.ts` isn't listed; `SearchModal.tsx` is explicitly out-of-bounds, CAM-561 in flight). The dropdown's underlying values are unaffected by this story either way — it still lists whatever distinct `province` strings exist; the id-aware match in `buildCampSiteWhere` still applies once a value from this dropdown reaches `app/api/campsites/route.ts` (the actual filter path) |
| `app/actions/getCampSiteCount.ts` (FilterModal's live match-count preview, CAM-524) | calls `buildCampSiteWhere` directly | **OUT-OF-SURFACE** | not in this dispatch's allowed file surface; can adopt the new additive `provinceAdminAreaIds` param in a follow-up with a one-line change (resolve then pass through, same pattern as `app/api/campsites/route.ts`) |
| `components/CatalogResults.tsx` (SSR initial catalog page load) | calls `buildCampSiteWhere` directly, server component | **OUT-OF-SURFACE** | not in this dispatch's allowed file surface; same follow-up shape as above |
| CAM-548's detail page (`components/CampgroundDetailClient.tsx`, `app/api/campsites/[id]/route.ts`) | reads `Location.province`/`district` for display (CAM-545's seam, no filtering) | **NO-CHANGE** | a display-only reader (renders the stored string, no matching/filtering logic) — not part of the silent-zero failure mode this story closes; out of the ticket's named scope besides |
| `lib/validations/catalog-cursor.ts` `catalogQuerySchema` | `province: z.string().optional()` — the query-param contract | **NO-CHANGE** | the contract shape is unaffected; `province` is still a plain string, `provinceAdminAreaIds` is resolved server-side, never a client-supplied param |

## ADRs

No new ADR — this is a data backfill + additive query/write-path change to an EXISTING, already-designed FK (`adminAreaId`), not a new architectural pattern. The AdminArea-tree-as-source-of-truth decision itself was already made in the S5 multi-region ADR (`docs/adr/`, referenced by CAM-553's tech.md).

Confirmation: `__tests__/cam-563-location-admin-area-backfill.test.ts` (backfill correctness/idempotency), `__tests__/cam-563-campsite-filters-province-id.test.ts` (count-parity — the behavioral proof this story does not regress the catalog).

## Seams — CAM-554 coordination (read before merging either PR)

`app/api/geocode/_shared.ts`'s `matchAdminArea`/`normalizeAdminName` (CAM-554, PR #640, **not yet merged into `dev`** as of this story) is bilingual + hierarchical + exact-match — the SAME algorithm this story needs for its backfill script and the location-route's deeper resolution. Because #640 is an open, unmerged PR, this story could not import it directly (would create a hard, unmergeable dependency on another in-flight PR). Instead:

- `scripts/backfill-cam-563-location-admin-area.mjs` and `app/api/location/route.ts` each carry a **faithful, standalone port** of `normalizeAdminName`/`matchAdminArea` (same prefix/suffix list, same exact-equals-scoped-by-parentId matching) — documented inline as a port, not an independent reimplementation.
- **Recommended follow-up once #640 merges:** extract `normalizeAdminName`/`matchAdminArea` into ONE shared module (e.g. `lib/geo/admin-area-match.ts`) that `app/api/geocode/_shared.ts`, `app/api/location/route.ts`, and `lib/campsite-filters.ts`'s `resolveProvinceAdminAreaIds` all import, retiring the two/three duplicate copies this coordination gap produced. Flagging this explicitly so whichever PR merges second does the consolidation rather than leaving 2-3 near-identical matchers to drift apart.

## Links
`prisma/schema.prisma` (`Location.adminAreaId` :236, `AdminArea` :203) · `docs/RUNBOOK-db-migrations.md` · `story.md` · `scripts/backfill-cam-563-location-admin-area.mjs` · CAM-554 tech.md (`app/api/geocode/_shared.ts`, PR #640)

## Changelog
- v1 (2026-07-26) — created
