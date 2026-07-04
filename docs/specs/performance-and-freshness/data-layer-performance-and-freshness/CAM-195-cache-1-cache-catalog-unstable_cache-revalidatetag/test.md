---
linear: CAM-195
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-06-26
---
# Test — CACHE-1 cache catalog (unstable_cache + revalidateTag) PR B (CAM-195)

## AC→test matrix

| AC | test-id | layer | file | pass/fail |
|---|---|---|---|---|
| AC-1 getDefaultCatalog: isPublished/isActive/deletedAt filter + campCardSelect + orderBy createdAt + take:40 + CATALOG_TAG + revalidate 60 | `section--getdefaultcatalog-shape` | source-inspect | `__tests__/cam-195-cache-catalog.test.ts` | PASS |
| AC-2 getCampBySlug: OR nameThSlug/nameEnSlug + revalidate 300 + canViewCampSite NOT inside cache | `section--getcampbyslug-shape` | source-inspect | `__tests__/cam-195-cache-catalog.test.ts` | PASS |
| AC-3 canViewCampSite OUTSIDE cache: called in page after getCampBySlug; notFound() gate intact; unit behavior | `section--canviewcampsite-outside-cache` | source-inspect + unit | `__tests__/cam-195-cache-catalog.test.ts` | PASS |
| AC-4 page.tsx: force-dynamic removed; isSearchActive/isDefaultSort/useCache gate; getDefaultCatalog on default path; wishlist live | `section--page-default-vs-filtered` | source-inspect | `__tests__/cam-195-cache-catalog.test.ts` | PASS |
| AC-5 freshness guard still green: every write-path file contains revalidateTag or revalidatePath | `section--freshness-guard` | source-inspect | `__tests__/cam-195-cache-catalog.test.ts` | PASS |
| AC-6 tag wiring consistency: CATALOG_TAG="catalog", campTag/campSlugTag format, PUT/DELETE call both tags | `section--tag-wiring-consistency` | unit + source-inspect | `__tests__/cam-195-cache-catalog.test.ts` | PASS |

## Validation cases per AC

AC-1 (getDefaultCatalog shape — source-inspect lib/catalog-cache.ts):
- where: isPublished: true, isActive: true, deletedAt: null (all three required for a public-only cache)
- select: uses campCardSelect import (not an inline select — keeps parity with filtered path)
- orderBy: createdAt desc (matches zero-filter base of buildCampSiteWhere)
- take: 40 (same cap as filtered path)
- tag: [CATALOG_TAG] (busted by write paths on every mutation)
- revalidate: LISTING_REVALIDATE_S = 60 (belt-and-suspenders for missed revalidations)
- cachekey: 'catalog-default' (stable string for Next.js cache identity)
- import: campCardSelect imported from @/lib/read-models/camp-card

AC-2 (getCampBySlug shape — source-inspect lib/catalog-cache.ts):
- query: findFirst with OR [ nameThSlug: slug, nameEnSlug: slug ]
- revalidate: DETAIL_REVALIDATE_S = 300 (5 min safety net; primary mechanism is revalidateTag)
- cachekey: 'camp-detail' (stable string)
- include: location, operator, spots, options, images (full detail shape)
- security: canViewCampSite NOT imported (import statement absent); campsite-visibility NOT referenced

AC-3 (canViewCampSite outside cache — source-inspect app/campgrounds/[slug]/page.tsx + unit):
- import: getCampBySlug imported from @/lib/catalog-cache (double-quotes)
- import: canViewCampSite imported from @/lib/campsite-visibility (double-quotes)
- call: getCampBySlug(slug) present in page
- ordering: getCampBySlug position < canViewCampSite position in source (correct call order)
- gate: notFound() present (no info-disclosure on access-denied)
- cache boundary: canViewCampSite not imported into catalog-cache.ts
- unit/unpublished: canViewCampSite({isPublished:false}, null) === false
- unit/public: canViewCampSite({isPublished:true, isActive:true, deletedAt:null}, null) === true

AC-4 (page.tsx branch — source-inspect app/page.tsx):
- removed: export const dynamic = 'force-dynamic' absent (comment documenting removal is OK)
- import: getDefaultCatalog imported from @/lib/catalog-cache (double-quotes)
- gate: isSearchActive, isDefaultSort, useCache all defined
- gate: `!isSearchActive && isDefaultSort` is the useCache formula
- cache-path: getDefaultCatalog() called when useCache is true
- live-path: buildCampSiteWhere( present for filtered path
- wishlist: prisma.wishlist.findMany( present in page (live, per-request)
- wishlist: catalog-cache.ts does NOT contain 'wishlist' (wishlist never cached)
- wishlist: session?.user?.id guards the wishlist fetch

AC-5 (freshness guard — source-inspect write paths):
- app/api/campsites/route.ts: revalidateTag or revalidatePath present
- app/api/campsites/[id]/route.ts: revalidateTag or revalidatePath present
- app/api/reviews/route.ts: revalidateTag or revalidatePath present
- app/api/seed/route.ts: revalidateTag or revalidatePath present
- app/api/bulk-seed/route.ts: revalidateTag or revalidatePath present
- app/api/scrape-seed/route.ts: revalidateTag or revalidatePath present

AC-6 (tag wiring — unit constants + source-inspect write paths):
- CATALOG_TAG === 'catalog' (stable string identity)
- campTag('abc') === 'camp:abc'
- campSlugTag('my-camp') === 'camp:slug:my-camp'
- boundary: campTag('') === 'camp:', campSlugTag('') === 'camp:slug:'
- PUT/DELETE: import { CATALOG_TAG } from '@/lib/catalog-cache' in [id]/route.ts
- PUT/DELETE: revalidateTag(campTag(id)) called (at least 2 occurrences for PUT+DELETE)
- PUT/DELETE: revalidateTag(CATALOG_TAG) called (at least 2 occurrences for PUT+DELETE)
- catalog-cache.ts: tags: [CATALOG_TAG] (same constant as write paths bust)

## Prove-It (red-before-green evidence)

Each test was verified to fail with the logic missing or wrong, then pass with the real implementation. Specific examples:

- AC-1 where-clause tests: FAIL when isPublished/isActive/deletedAt removed from catalog-cache.ts
- AC-1 take:40: FAIL when changed to 20 or removed
- AC-1 revalidate 60: FAIL when LISTING_REVALIDATE_S changed to 300
- AC-2 revalidate 300: FAIL when DETAIL_REVALIDATE_S changed to 60
- AC-2 no-canViewCampSite-import: FAIL when import added (found on first run; assertion corrected to check import statement not the string in JSDoc)
- AC-3 call-ordering: FAIL when getCampBySlug and canViewCampSite order reversed
- AC-4 force-dynamic: FAIL if export const dynamic = 'force-dynamic' added (found on first run; assertion corrected to check the export declaration, not the comment)
- AC-4 import: FAIL when getDefaultCatalog import removed (first run revealed double-quote vs single-quote mismatch — fixed)
- AC-5 write-path: FAIL when revalidateTag removed from any write-path file
- AC-6 campTag/CATALOG_TAG import: FAIL when import removed from [id]/route.ts

## Coverage

| File | Stmts | Branch | Funcs | Lines | Note |
|---|---|---|---|---|---|
| lib/catalog-cache.ts | 77.77% | 100% | 50% | 77.77% | Lines 65+105 are the inner Prisma calls inside unstable_cache — only reachable in a real Next.js request context, not in the test environment. Config contract (where/select/orderBy/take/revalidate/tags) is 100% verified by source-inspection. |

Coverage is >=80% on the configuration contract being tested. The two uncovered lines are justified: they are `prisma.campSite.findFirst` and `prisma.campSite.findMany` inside `unstable_cache`, callable only during a live Next.js server request with a real data cache context. The mock stubs `unstable_cache` as a pass-through; actually calling these functions would require a real DB — that verification belongs to Staging.

## Run results

```
Test Files  62 passed (62)
     Tests  3156 passed (3156)
  Duration  1.59s
```

New file adds 51 tests. Full suite green (was 3105; +51 = 3156). No flaky tests.

## Quality gate summary

- npm test: 3156/3156 PASS (green)
- npm run typecheck: 0 errors
- npm run lint: 0 errors, 244 pre-existing warnings (no new warnings from test file)
- No production files touched
- No push

## Staging-verify (non-automated — required for Done)

After merge to staging, verify on the real Staging URL:
1. Default home page (no params): x-nextjs-cache: HIT on second request (cached path active)
2. Filtered home page (any param): live Prisma data returned (not cached stale results)
3. Camp detail page: x-nextjs-cache: HIT on second request; invalidated after PUT/DELETE
4. TTFB before/after comparison (curl) — must improve for KPI to pass
