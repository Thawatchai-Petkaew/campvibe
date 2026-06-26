/**
 * cam-195-cache-catalog.test.ts — CACHE-1 / CAM-195 PR B
 *
 * Proves every AC for the cache activation (PR B):
 *
 *   AC-1  getDefaultCatalog where-clause + select + orderBy + take + tag + revalidate
 *         Source-inspect lib/catalog-cache.ts: the cached default catalog must filter
 *         isPublished:true, isActive:true, deletedAt:null (only public camps cached),
 *         use campCardSelect, order by createdAt desc, take 40, tag CATALOG_TAG,
 *         revalidate 60.
 *
 *   AC-2  getCampBySlug wraps the detail read
 *         Source-inspect: wraps findFirst by slug (OR nameThSlug / nameEnSlug),
 *         revalidate 300; does NOT include the canViewCampSite decision.
 *
 *   AC-3  canViewCampSite outside cache
 *         Source-inspect app/campgrounds/[slug]/page.tsx: canViewCampSite is called
 *         in the page AFTER getCampBySlug, NOT inside lib/catalog-cache.ts; the
 *         notFound() gate is intact. canViewCampSite itself is pure (no I/O) — verify
 *         unit behavior still holds for the access-control scenarios.
 *
 *   AC-4  page.tsx default-vs-filtered branch
 *         Source-inspect: force-dynamic is removed; an isSearchActive / isDefaultSort
 *         gate selects getDefaultCatalog (default) vs live Prisma (filtered path);
 *         wishlist lookup is outside the cache wrapper (stays live / per-request).
 *
 *   AC-5  freshness-guard still green
 *         Source-inspect: every file in the FRESH-1 write-path manifest still contains
 *         a revalidateTag or revalidatePath call (revalidate wiring intact after PR B).
 *
 *   AC-6  tag wiring consistency
 *         Source-inspect: the write paths (PUT, DELETE /api/campsites/[id]) call
 *         revalidateTag(campTag(id)) and revalidateTag(CATALOG_TAG) — the same tag
 *         names that the catalog wrapper (getDefaultCatalog) and the campTag helper
 *         (getCampBySlug bust target) export from lib/catalog-cache.ts.
 *
 * Layers:
 *   - AC-1, AC-2, AC-4, AC-5, AC-6 → source-inspect (static parse of real files)
 *     Static source-inspection is the correct layer for Next.js Server Components and
 *     unstable_cache wrappers — the same precedent used in cam-193, cam-189 AC-3/AC-4.
 *   - AC-3 → source-inspect (page.tsx) + unit (canViewCampSite pure function; already
 *     covered in campsite-visibility.test.ts — we add the cache-boundary assertion here)
 *
 * Prove-It notes:
 *   - AC-1 where-clause tests FAIL if isPublished/isActive/deletedAt are removed from
 *     lib/catalog-cache.ts.
 *   - AC-1 take:40 test FAILS if take is changed to 20 or removed.
 *   - AC-1 revalidate 60 test FAILS if LISTING_REVALIDATE_S is changed to 300.
 *   - AC-2 revalidate 300 test FAILS if DETAIL_REVALIDATE_S is changed to 60.
 *   - AC-2 no-canViewCampSite test FAILS if canViewCampSite is imported or called inside
 *     lib/catalog-cache.ts.
 *   - AC-3 canViewCampSite-outside-cache test FAILS if getCampBySlug is removed from
 *     page.tsx.
 *   - AC-4 force-dynamic removal test FAILS if "force-dynamic" is re-added to page.tsx.
 *   - AC-4 getDefaultCatalog usage test FAILS if getDefaultCatalog import is removed.
 *   - AC-4 useCache gate test FAILS if isSearchActive / isDefaultSort gate is removed.
 *   - AC-4 wishlist-live test FAILS if wishlist is moved inside getDefaultCatalog.
 *   - AC-5 write-path tests FAIL if revalidateTag is removed from a write-path file.
 *   - AC-6 campTag/CATALOG_TAG import test FAILS if those exports are removed.
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal · null/empty · boundary · error/validation (where applicable per source-inspect layer)
 *
 * Staging-verify note (non-automated):
 *   After merge to staging, verify:
 *   - Default home page (no filters) does not make a DB round-trip on warm requests
 *     (observed via Vercel response headers x-nextjs-cache: HIT).
 *   - Filtered home page (any param) returns live Prisma data — not cached results.
 *   - Camp detail page serves cached data on warm requests; invalidated after PUT/DELETE.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  CATALOG_TAG,
  campTag,
  campSlugTag,
} from '../lib/catalog-cache';
import { canViewCampSite } from '../lib/campsite-visibility';

// ---------------------------------------------------------------------------
// Paths (all root-relative via process.cwd())
// ---------------------------------------------------------------------------

const root = process.cwd();

function src(relPath: string): string {
  return readFileSync(path.join(root, relPath), 'utf-8');
}

const catalogCacheSrc = src('lib/catalog-cache.ts');
const slugPageSrc = src('app/campgrounds/[slug]/page.tsx');
const homeSrc = src('app/page.tsx');
// LOAD-1 (CAM-197): data-fetch logic moved from page.tsx → CatalogResults.tsx.
const catalogResultsSrc = src('components/CatalogResults.tsx');
const campsiteIdRouteSrc = src('app/api/campsites/[id]/route.ts');

// ===========================================================================
// AC-1 — getDefaultCatalog: where-clause + select + orderBy + take + tag + revalidate
// ===========================================================================

describe('AC-1 — getDefaultCatalog shape (lib/catalog-cache.ts)', () => {
  // Prove-It: these FAIL when the respective field is removed from the wrapper.

  it('[where] filters isPublished: true (only published camps cached)', () => {
    expect(catalogCacheSrc).toContain('isPublished: true');
  });

  it('[where] filters isActive: true (only active camps cached)', () => {
    expect(catalogCacheSrc).toContain('isActive: true');
  });

  it('[where] filters deletedAt: null (soft-deleted camps excluded from cache)', () => {
    expect(catalogCacheSrc).toContain('deletedAt: null');
  });

  it('[select] uses campCardSelect (not a custom inline select)', () => {
    // The wrapper must re-use the shared campCardSelect to stay in sync with
    // the filtered path — not define its own inline select.
    expect(catalogCacheSrc).toContain('select: campCardSelect');
  });

  it('[select] imports campCardSelect from lib/read-models/camp-card', () => {
    expect(catalogCacheSrc).toContain("from '@/lib/read-models/camp-card'");
  });

  it('[orderBy] orders by createdAt descending', () => {
    // Matches the zero-filter base of buildCampSiteWhere (per OQ-3 comment in source)
    expect(catalogCacheSrc).toContain("orderBy: { createdAt: 'desc' }");
  });

  it('[take] caps the result at 24 rows (PERF-3/CAM-196 OT-1=A: unified page size)', () => {
    // PERF-3 (CAM-196 OT-1=A): getDefaultCatalog now uses take:24 (was 40) to match the
    // cursor API page size. This reduces the cached first-page size for faster SSR TTI.
    // Prove-It: FAILS if take is changed back to 40 or to any other value.
    expect(catalogCacheSrc).toMatch(/take:\s*24/);
    expect(catalogCacheSrc).not.toMatch(/take:\s*40/);
  });

  it('[tag] carries the CATALOG_TAG so write paths can bust it', () => {
    expect(catalogCacheSrc).toContain('[CATALOG_TAG]');
  });

  it('[revalidate] LISTING_REVALIDATE_S is 60 (short belt-and-suspenders TTL)', () => {
    // The comment in source says "60 s — default catalog listing: shorter TTL because
    // a new publish must appear quickly even if a write path misses revalidation".
    // Prove-It: FAILS if changed to 300 or removed.
    expect(catalogCacheSrc).toMatch(/LISTING_REVALIDATE_S\s*=\s*60/);
  });

  it('[revalidate] getDefaultCatalog uses LISTING_REVALIDATE_S (not a hardcoded literal)', () => {
    // Must use the named constant — not a magic number — so a single change site suffices.
    expect(catalogCacheSrc).toContain('revalidate: LISTING_REVALIDATE_S');
  });

  it('[cachekey] uses catalog-default as the cache key part', () => {
    // Each unstable_cache entry has a stable [keyParts] string so Next.js can identify it.
    expect(catalogCacheSrc).toContain("'catalog-default'");
  });
});

// ===========================================================================
// AC-2 — getCampBySlug: detail read, revalidate 300, no canViewCampSite inside
// ===========================================================================

describe('AC-2 — getCampBySlug shape (lib/catalog-cache.ts)', () => {
  it('[query] uses findFirst with OR nameThSlug / nameEnSlug slug matching', () => {
    expect(catalogCacheSrc).toContain('nameThSlug: slug');
    expect(catalogCacheSrc).toContain('nameEnSlug: slug');
    expect(catalogCacheSrc).toContain('OR: [');
  });

  it('[revalidate] DETAIL_REVALIDATE_S is 300 (5-min safety net for slug-based entries)', () => {
    // Prove-It: FAILS if changed to 60 or removed.
    expect(catalogCacheSrc).toMatch(/DETAIL_REVALIDATE_S\s*=\s*300/);
  });

  it('[revalidate] getCampBySlug uses DETAIL_REVALIDATE_S (not a hardcoded literal)', () => {
    expect(catalogCacheSrc).toContain('revalidate: DETAIL_REVALIDATE_S');
  });

  it('[cachekey] uses camp-detail as the cache key part', () => {
    expect(catalogCacheSrc).toContain("'camp-detail'");
  });

  it('[security] canViewCampSite is NOT imported inside lib/catalog-cache.ts', () => {
    // Caching the access-control decision would cache a session-dependent gate for all
    // future callers — a potential info-disclosure security defect (SEC-1).
    // The function name appears in a JSDoc comment (documentation); we assert the import
    // statement is absent — that is the actual security boundary.
    // Prove-It: FAILS if canViewCampSite is imported into catalog-cache.ts.
    expect(catalogCacheSrc).not.toContain("import { canViewCampSite }");
    expect(catalogCacheSrc).not.toContain('campsite-visibility');
  });

  it('[include] includes location, operator, spots, options, images (full detail shape)', () => {
    // The detail wrapper must carry the full include — same as the pre-CAM-195 direct query.
    expect(catalogCacheSrc).toContain('location: true');
    expect(catalogCacheSrc).toContain('spots: true');
    expect(catalogCacheSrc).toContain('options: true');
    expect(catalogCacheSrc).toContain('images:');
  });
});

// ===========================================================================
// AC-3 — canViewCampSite is called OUTSIDE the cache (in page.tsx, not in lib/catalog-cache.ts)
// ===========================================================================

describe('AC-3 — canViewCampSite outside cache (app/campgrounds/[slug]/page.tsx)', () => {
  it('[page] imports getCampBySlug from lib/catalog-cache', () => {
    // Source uses double-quotes — match the actual import statement.
    expect(slugPageSrc).toContain('import { getCampBySlug } from "@/lib/catalog-cache"');
  });

  it('[page] imports canViewCampSite from lib/campsite-visibility', () => {
    expect(slugPageSrc).toContain('import { canViewCampSite } from "@/lib/campsite-visibility"');
  });

  it('[page] calls getCampBySlug(slug) to load the camp from cache', () => {
    expect(slugPageSrc).toContain('getCampBySlug(slug)');
  });

  it('[page] calls canViewCampSite after getCampBySlug (per-request session gate)', () => {
    // canViewCampSite must run AFTER the cached call — with the live per-request session.
    // We verify ordering by checking that getCampBySlug appears before canViewCampSite
    // in the source file.
    const getCampPos = slugPageSrc.indexOf('getCampBySlug(slug)');
    const canViewPos = slugPageSrc.indexOf('canViewCampSite(');
    expect(getCampPos).toBeGreaterThanOrEqual(0);
    expect(canViewPos).toBeGreaterThanOrEqual(0);
    expect(getCampPos).toBeLessThan(canViewPos);
  });

  it('[page] calls notFound() when canViewCampSite returns false (no info-disclosure)', () => {
    // The gate must call notFound(), not return 403 — prevents info-disclosure of
    // camp existence (SEC-1 pattern consistent with API route).
    expect(slugPageSrc).toContain('notFound()');
  });

  it('[page] canViewCampSite runs with the live session, not inside the cache wrapper', () => {
    // Confirm canViewCampSite is not imported into lib/catalog-cache.ts (AC-2 double-check)
    // and IS present in the page — the session check is always per-request.
    expect(catalogCacheSrc).not.toContain('import { canViewCampSite }');
    expect(slugPageSrc).toContain('canViewCampSite(');
  });

  // Unit assertion: the pure canViewCampSite correctly gates unpublished camps.
  // This is a minimal regression guard; full coverage lives in campsite-visibility.test.ts.
  // Uses static import at module level (see top of file) — compatible with the vitest mock setup.
  it('[unit] canViewCampSite(unpublished, null-session) returns false — anonymous cannot view', () => {
    const unpublishedCamp = {
      isActive: true,
      isPublished: false,
      deletedAt: null,
      operatorId: 'op-1',
    };
    expect(canViewCampSite(unpublishedCamp, null)).toBe(false);
  });

  it('[unit] canViewCampSite(publicCamp, null) returns true — anonymous CAN view published camp', () => {
    const publicCamp = {
      isActive: true,
      isPublished: true,
      deletedAt: null,
      operatorId: 'op-1',
    };
    expect(canViewCampSite(publicCamp, null)).toBe(true);
  });
});

// ===========================================================================
// AC-4 — page.tsx: force-dynamic removed + default-vs-filtered gate + wishlist live
// ===========================================================================

describe('AC-4 — page.tsx default-vs-filtered branch (app/page.tsx)', () => {
  it('[force-dynamic] force-dynamic export is REMOVED from page.tsx (CACHE-1)', () => {
    // Prove-It: FAILS if "export const dynamic = 'force-dynamic'" is re-added.
    // The string "force-dynamic" appears in a comment documenting its removal;
    // we check the actual export declaration is absent.
    expect(homeSrc).not.toContain("export const dynamic = 'force-dynamic'");
    expect(homeSrc).not.toContain('export const dynamic = "force-dynamic"');
  });

  it('[import] CatalogResults.tsx imports getDefaultCatalog from lib/catalog-cache (LOAD-1)', () => {
    // LOAD-1 (CAM-197): data logic moved from page.tsx → CatalogResults.tsx.
    expect(catalogResultsSrc).toContain('import { getDefaultCatalog } from "@/lib/catalog-cache"');
  });

  it('[gate] CatalogResults.tsx defines isSearchActive to decide the cache-vs-live branch', () => {
    // The gate variable must be present — it drives the useCache flag.
    expect(catalogResultsSrc).toContain('isSearchActive');
  });

  it('[gate] CatalogResults.tsx defines isDefaultSort to exclude non-default sort from cached path', () => {
    expect(catalogResultsSrc).toContain('isDefaultSort');
  });

  it('[gate] CatalogResults.tsx derives useCache from isSearchActive and isDefaultSort', () => {
    // Both conditions must be false for useCache to be true (default path).
    expect(catalogResultsSrc).toContain('useCache');
    expect(catalogResultsSrc).toContain('!isSearchActive && isDefaultSort');
  });

  it('[cache-path] CatalogResults.tsx calls getDefaultCatalog() when useCache is true', () => {
    // Prove-It: FAILS if the cache call is replaced with a direct prisma.findMany.
    expect(catalogResultsSrc).toContain('getDefaultCatalog()');
  });

  it('[live-path] CatalogResults.tsx calls buildCampSiteWhere when the filtered path is active', () => {
    // The live Prisma path must still use buildCampSiteWhere — same as before CACHE-1.
    expect(catalogResultsSrc).toContain('buildCampSiteWhere(');
  });

  it('[wishlist] CatalogResults.tsx fetches wishlist via prisma.wishlist.findMany (live, not cached)', () => {
    // Wishlist lookup is per-user and must remain live (not inside the catalog cache wrapper).
    // Prove-It: FAILS if the wishlist fetch is moved inside getDefaultCatalog.
    expect(catalogResultsSrc).toContain('prisma.wishlist.findMany(');
    // Confirm it is NOT in lib/catalog-cache.ts
    expect(catalogCacheSrc).not.toContain('wishlist');
  });

  it('[wishlist] wishlist lookup is guarded by userId (only when logged in)', () => {
    // LOAD-1: userId is passed as a prop (not session directly) in CatalogResults.
    expect(catalogResultsSrc).toContain("userId");
  });
});

// ===========================================================================
// AC-5 — freshness guard: all write paths still contain a revalidate call
// ===========================================================================

describe('AC-5 — freshness guard (write paths carry revalidateTag/revalidatePath)', () => {
  // Mirrors freshness-guard.test.ts from PR A — confirms wiring is intact after PR B.
  const WRITE_PATHS: { file: string; description: string }[] = [
    { file: 'app/api/campsites/route.ts',         description: 'POST /api/campsites (create)' },
    { file: 'app/api/campsites/[id]/route.ts',    description: 'PUT/DELETE /api/campsites/[id]' },
    { file: 'app/api/reviews/route.ts',           description: 'POST /api/reviews' },
    { file: 'app/api/seed/route.ts',              description: 'GET /api/seed' },
    { file: 'app/api/bulk-seed/route.ts',         description: 'POST /api/bulk-seed' },
    { file: 'app/api/scrape-seed/route.ts',       description: 'POST /api/scrape-seed' },
  ];

  for (const { file, description } of WRITE_PATHS) {
    it(`[revalidate] ${description} still contains revalidateTag or revalidatePath`, () => {
      const content = src(file);
      const hasRevalidate =
        content.includes('revalidateTag(') || content.includes('revalidatePath(');
      // Prove-It: FAILS if revalidateTag is removed from any write-path file.
      expect(hasRevalidate).toBe(true);
    });
  }
});

// ===========================================================================
// AC-6 — tag wiring consistency: write paths use the same tags the wrappers carry
// ===========================================================================

describe('AC-6 — tag wiring consistency (write paths bust the same tags as the wrappers)', () => {
  // Tag constants exported from lib/catalog-cache.ts (imported at the top of this file)

  it('[CATALOG_TAG] CATALOG_TAG constant is the string "catalog"', () => {
    // Must be a stable string — if changed, all write-path calls that hardcode the old
    // string would silently stop busting the cache.
    expect(CATALOG_TAG).toBe('catalog');
  });

  it('[campTag] campTag("abc") returns "camp:abc"', () => {
    // The format must match what write paths call: revalidateTag(campTag(id)).
    expect(campTag('abc')).toBe('camp:abc');
  });

  it('[campSlugTag] campSlugTag("my-camp") returns "camp:slug:my-camp"', () => {
    // Narrow tag for slug-based bust (detail page entries).
    expect(campSlugTag('my-camp')).toBe('camp:slug:my-camp');
  });

  it('[write-path] PUT /api/campsites/[id] imports CATALOG_TAG from lib/catalog-cache', () => {
    // Prove-It: FAILS if the import is removed (means the tag is no longer busted on edit).
    expect(campsiteIdRouteSrc).toContain("from '@/lib/catalog-cache'");
    expect(campsiteIdRouteSrc).toContain('CATALOG_TAG');
  });

  it('[write-path] PUT /api/campsites/[id] calls revalidateTag(campTag(id)) after mutation', () => {
    // The campTag bust is critical — it invalidates the detail-page cache entry for
    // the specific camp that was edited.
    expect(campsiteIdRouteSrc).toContain('revalidateTag(campTag(id)');
  });

  it('[write-path] PUT /api/campsites/[id] calls revalidateTag(CATALOG_TAG) after mutation', () => {
    // The catalog bust ensures the default listing cache reflects the edit/publish/unpublish.
    expect(campsiteIdRouteSrc).toContain('revalidateTag(CATALOG_TAG');
  });

  it('[write-path] DELETE /api/campsites/[id] calls revalidateTag(campTag(id)) after deletion', () => {
    // Both PUT and DELETE must bust the cache — DELETE is a catalog-affecting mutation too.
    // The route has two separate handlers; campTag appears twice in the source.
    const occurrences = (campsiteIdRouteSrc.match(/revalidateTag\(campTag\(id\)/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('[write-path] DELETE /api/campsites/[id] calls revalidateTag(CATALOG_TAG) after deletion', () => {
    const occurrences = (campsiteIdRouteSrc.match(/revalidateTag\(CATALOG_TAG/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('[consistency] lib/catalog-cache.ts imports CATALOG_TAG and uses it in getDefaultCatalog tags', () => {
    // The catalog wrapper must reference the SAME CATALOG_TAG constant that write paths bust.
    // Prove-It: FAILS if tags:[] is used instead of [CATALOG_TAG].
    expect(catalogCacheSrc).toContain('tags: [CATALOG_TAG]');
  });

  it('[null-boundary] campTag("") returns "camp:" (handles empty id gracefully)', () => {
    expect(campTag('')).toBe('camp:');
  });

  it('[null-boundary] campSlugTag("") returns "camp:slug:" (handles empty slug gracefully)', () => {
    expect(campSlugTag('')).toBe('camp:slug:');
  });
});
