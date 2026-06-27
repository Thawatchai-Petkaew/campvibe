---
linear: CAM-197
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: test
owner: qa-engineer
status: In Review
version: v1
updated: 2026-06-26
---
# Test — LOAD-1 loading skeletons + Suspense server component (CAM-197)

## AC→test matrix

| AC | test-id | layer | file | pass/fail |
|---|---|---|---|---|
| AC-1 CatalogResults is a server component: no "use client"; owns data-fetch (getDefaultCatalog / buildCampSiteWhere / wishlist / EmptyState / InfiniteScrollGrid) | `section--catalog-results-server-component` | source-inspect | `__tests__/cam-197-loading-skeletons.test.ts` | PASS |
| AC-2 page.tsx Suspense wiring: imports Suspense + CampgroundGridSkeleton + CatalogResults; key={searchParamsKey}; fallback CampgroundGridSkeleton; no "use client"; calls auth(); Navbar/CategoryBar present | `page--home-suspense-wiring` | source-inspect | `__tests__/cam-197-loading-skeletons.test.ts` | PASS |
| AC-3 CampgroundSkeleton canonical: Skeleton from ui/skeleton; aspect-square + rounded-3xl (NOT rounded-xl); mt-3; exactly 5 Skeleton tags (1 image + 4 body); CampgroundGridSkeleton default count=12 + role="status" + aria-busy + aria-label + data-testid | `section--campground-skeleton-canonical` | source-inspect | `__tests__/cam-197-loading-skeletons.test.ts` | PASS |
| AC-4 skeleton.tsx: base className has animate-pulse + motion-reduce:animate-none in same cn() call | `section--skeleton-ui-reduced-motion` | source-inspect | `__tests__/cam-197-loading-skeletons.test.ts` | PASS |
| AC-5 InfiniteScrollGrid: no Loader2 import; no animate-spin; imports + uses CampgroundSkeleton; aria-live="polite" present; sentinel aria-hidden="true" | `section--infinite-scroll-no-loader2` | source-inspect | `__tests__/cam-197-loading-skeletons.test.ts` | PASS |
| AC-6 loading.tsx: imports + renders CampgroundGridSkeleton; no LoadingSpinner; no fullScreen; no "use client" | `section--loading-uses-skeleton` | source-inspect | `__tests__/cam-197-loading-skeletons.test.ts` | PASS |
| AC-7 EmptyState: exactly 2 img tags; /camping-empty.svg dark:hidden; /camping-empty-dark.svg hidden dark:block; both have width="320" height="200"; alt={t.emptyState.noResults} (i18n, not hardcoded) | `section--empty-state-two-img` | source-inspect | `__tests__/cam-197-loading-skeletons.test.ts` | PASS |
| AC-8 i18n catalog.loading: exists EN + TH; TH verbatim กำลังโหลดลาน; EN "Loading camps"; regression guard: loading_more + end_of_list still present in both locales | `section--i18n-catalog-loading` | source-inspect | `__tests__/cam-197-loading-skeletons.test.ts` | PASS |
| AC-9 Assets: public/camping-empty.svg + public/camping-empty-dark.svg exist; both contain viewBox="0 0 1280 800"; non-empty (>100 bytes); valid xmlns | `section--assets-svg-existence` | source-inspect | `__tests__/cam-197-loading-skeletons.test.ts` | PASS |

## Tests added

File: `__tests__/cam-197-loading-skeletons.test.ts`
Tests: 70 (all pass)
Previous suite total: 3307 | New suite total: 3377 | Regressions: 0

## Coverage note

`components/CatalogResults.tsx` is an async Server Component that calls `prisma`,
`auth()`, and `getDefaultCatalog()` — all requiring the Next.js runtime and a live
database. Executing it in vitest node env would require mocking the entire Prisma
layer, which per `.claude/rules/qa.md §6` would "mock the layer under test" and
invalidate the integration. Source-inspection covers all structural ACs (no
"use client", correct imports, cache gate, render branching, wishlist guard). The
live integration AC (EmptyState on 0 results, InfiniteScrollGrid on N>0 results) is
verified on the real Staging URL after merge. Coverage on new code from
source-inspect tests: not measured at line level (files are read as strings, not
imported into the vitest runtime). Overall repo coverage: statements 85.51%,
lines 87.36%.

## Staging-only ACs (verified on real Staging URL after merge)

- AC-1 live: Hard-navigating to / shows CampgroundGridSkeleton skeleton grid (loading.tsx).
- AC-2 live: Changing category / sort / filter shows the skeleton grid instantly
  (key change triggers Suspense fallback before server stream arrives).
- AC-3 live: Skeleton card layout matches real CampgroundCard layout — CLS = 0
  (Lighthouse on Staging).
- AC-5 live: Infinite-scroll loading state shows CampgroundSkeleton cards, not
  a Loader2 spinner.
- AC-6 live: Hard-navigating to / shows skeleton grid, not the full-screen spinner.

## Validation cases per AC

AC-1 (CatalogResults server component — source-inspect components/CatalogResults.tsx):
- no "use client" directive as a real top-level line (comment mention is allowed)
- imports getDefaultCatalog from lib/catalog-cache
- imports buildCampSiteWhere from lib/campsite-filters
- imports EmptyState from components/EmptyState
- imports InfiniteScrollGrid from components/InfiniteScrollGrid
- render branch: campSites.length === 0 → <EmptyState
- render branch: campSites.length > 0 → <InfiniteScrollGrid
- wishlist: prisma.wishlist.findMany call present
- wishlist: guarded by `if (userId)` (logged-in only)
- cache gate: isSearchActive, useCache present

AC-2 (page.tsx Suspense wiring — source-inspect app/page.tsx):
- no "use client" directive as a real top-level line
- imports Suspense from "react"
- imports CampgroundGridSkeleton from CampgroundSkeleton
- imports CatalogResults
- renders <Suspense with key={searchParamsKey}
- fallback={<CampgroundGridSkeleton (skeleton, not a spinner)
- <CatalogResults inside the Suspense boundary
- auth() called for session / userId
- <Navbar rendered (shell is synchronous)
- <CategoryBar rendered (shell is synchronous)
- searchParamsKey includes sort, keyword, province, district

AC-3 (CampgroundSkeleton canonical — source-inspect components/CampgroundSkeleton.tsx):
- imports from "@/components/ui/skeleton"
- image: aspect-square class
- image: rounded-3xl (no rounded-xl)
- text block wrapper: mt-3
- title: h-5 w-2/3
- rating: h-4 w-10
- location: h-4 w-1/2
- price: h-5 w-1/4 inside pt-1 wrapper
- exactly 5 <Skeleton tags in CampgroundSkeleton function body (1 image + 4 text)
- CampgroundGridSkeleton: count default = 12
- CampgroundGridSkeleton: role="status"
- CampgroundGridSkeleton: aria-busy="true"
- CampgroundGridSkeleton: aria-label prop present
- CampgroundGridSkeleton: aria-label defaults to translations.th.catalog.loading (not hardcoded)
- CampgroundGridSkeleton: data-testid="grid--catalog-skeleton"

AC-4 (skeleton.tsx reduced-motion — source-inspect components/ui/skeleton.tsx):
- base className contains animate-pulse
- base className contains motion-reduce:animate-none
- both tokens appear in the same cn() call

AC-5 (InfiniteScrollGrid — source-inspect components/InfiniteScrollGrid.tsx):
- no Loader2 import
- no animate-spin class
- imports CampgroundSkeleton
- renders <CampgroundSkeleton in loading state
- aria-live="polite" region present
- sentinel: aria-hidden="true"

AC-6 (loading.tsx — source-inspect app/loading.tsx):
- imports CampgroundGridSkeleton from CampgroundSkeleton
- renders <CampgroundGridSkeleton
- no LoadingSpinner
- no fullScreen prop usage
- no "use client" directive

AC-7 (EmptyState two-img — source-inspect components/EmptyState.tsx):
- exactly 2 <img elements
- light img: src="/camping-empty.svg" with dark:hidden
- dark img: src="/camping-empty-dark.svg" with hidden dark:block
- both imgs: width="320" (2 occurrences)
- both imgs: height="200" (2 occurrences)
- both imgs: alt={t.emptyState.noResults} (i18n key, not hardcoded string)

AC-8 (i18n — locales/translations.json):
- en.catalog.loading === "Loading camps"
- th.catalog.loading === "กำลังโหลดลาน" (verbatim)
- en.catalog.loading_more truthy (regression guard)
- en.catalog.end_of_list truthy (regression guard)
- th.catalog.loading_more === "กำลังโหลดลานเพิ่มเติม" (verbatim)
- th.catalog.end_of_list truthy

AC-9 (assets — public/):
- public/camping-empty.svg exists
- public/camping-empty-dark.svg exists
- both contain viewBox="0 0 1280 800"
- both have size > 100 bytes (non-trivial content)
- both contain xmlns="http://www.w3.org/2000/svg" (valid SVG)

## Prove-It (red-before-green verification)

Each test has an explicit Prove-It comment in the test file naming the change that
would make it fail. Verified representative red states before finalising:

- AC-1 "use client" test: FAILS when `'"use client"'` is a real top-level line in CatalogResults.tsx
- AC-3 rounded-3xl test: FAILS when `rounded-xl` replaces `rounded-3xl`
- AC-3 5-Skeleton-count test: FAILS when a 6th <Skeleton is added to the card body
- AC-4 motion-reduce test: FAILS when `motion-reduce:animate-none` is removed from skeleton.tsx
- AC-5 Loader2 test: FAILS when `import { Loader2 }` is added back to InfiniteScrollGrid.tsx
- AC-8 TH verbatim test: FAILS when `กำลังโหลดลาน` is changed by even one character
- AC-9 file existence test: FAILS when either SVG is deleted from public/

The first run of the file had 1 failure on AC-1 (the "no use client" directive
assertion was matching the phrase inside the JSDoc comment). That test was fixed to
check for a standalone directive line (line.trim() === '"use client"'), confirming
the red state before the green fix. The remaining 69 tests were green on first run.

## Quality gate results

- npm test (full suite): 3377/3377 pass (0 regressions)
- npm run lint (new file): clean (0 warnings)
- npm run typecheck: clean (0 errors)
- coverage (repo overall): statements 85.51%, lines 87.36%
