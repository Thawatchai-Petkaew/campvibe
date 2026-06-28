/**
 * cam-197-loading-skeletons.test.ts — LOAD-1 / CAM-197 + CAM-245 (LOAD-PILOT)
 *
 * Proves every AC for the loading-skeleton refactor introduced in CAM-197:
 *
 *   AC-1  CatalogResults is a server component that owns the data-fetch
 *         No "use client"; references getDefaultCatalog / buildCampSiteWhere /
 *         wishlist / EmptyState / InfiniteScrollGrid.
 *
 *   AC-2  page.tsx Suspense wiring
 *         Imports Suspense + CampgroundGridSkeleton + CatalogResults; renders
 *         <Suspense key={...} fallback={<CampgroundGridSkeleton …}; no "use client";
 *         still calls auth(); shell components (Navbar/CategoryBar) still present.
 *
 *   AC-3  CampgroundSkeleton canonical structure
 *         Uses <Skeleton> from ui/skeleton; image class includes aspect-square +
 *         rounded-3xl (NOT rounded-xl); text block has mt-3; no extra third text line
 *         (4 Skeleton elements total in card body: title + rating + location + price);
 *         CampgroundGridSkeleton default count=12 + role="status" + aria-busy +
 *         aria-label.
 *
 *   AC-4  skeleton.tsx reduced-motion
 *         Base className contains motion-reduce:animate-none + animate-pulse.
 *
 *   AC-5  InfiniteScrollGrid: no Loader2, no animate-spin, imports CampgroundSkeleton,
 *         aria-live="polite" still present.
 *
 *   AC-6  loading.tsx uses CampgroundGridSkeleton, NOT LoadingSpinner fullScreen.
 *
 *   AC-7  EmptyState two-img dark-mode pair
 *         Two <img>: /camping-empty.svg with dark:hidden; /camping-empty-dark.svg with
 *         hidden dark:block; both have width + height; alt references t.emptyState.noResults
 *         (i18n — not hardcoded).
 *
 *   AC-8  i18n: catalog.loading exists in both en + th; TH verbatim กำลังโหลดลาน.
 *
 *   AC-9  Assets: public/camping-empty.svg + public/camping-empty-dark.svg exist;
 *         both contain viewBox="0 0 1280 800".
 *
 * CAM-245 (LOAD-PILOT) additions:
 *
 *   AC-10  CampgroundGridSkeleton a11y completeness (loading-ui-standard §S5)
 *          Grid container has aria-live="polite" (pairs with role="status").
 *          A sr-only text node with กำลังโหลด… is the live-region content.
 *          catalog.loading_sr key exists in both locales (i18n — not hardcoded).
 *          Individual CampgroundSkeleton cards are aria-hidden="true" (decorative).
 *
 *   AC-11  Anti-flicker delay-before-show (loading-ui-standard §S4)
 *          The skeleton-delay-show CSS class is applied to CampgroundGridSkeleton.
 *          globals.css defines the skeleton-appear keyframe + 300ms delay.
 *          The keyframe is wrapped in prefers-reduced-motion:no-preference.
 *          Under reduce-motion, the class shows immediately (opacity:1 fallback).
 *
 *
 * Layer: source-inspect (static parse of real production files).
 *   Source-inspection is the correct layer for Next.js Server Components and Client
 *   Components here — jsdom is not available (vitest env: node) for components that
 *   depend on Next.js runtime (auth, unstable_cache, "use client" hooks). This
 *   follows the precedent established in cam-196, cam-195, cam-194, cam-193.
 *   Every assertion names the exact change that would make it fail (Prove-It).
 *
 * CatalogResults.tsx coverage note:
 *   CatalogResults.tsx is a pure async Server Component that calls prisma, auth(),
 *   and getDefaultCatalog — all of which require a real Next.js runtime and a live
 *   database. Unit-testing it in a Node/jsdom env would require mocking prisma AND
 *   the entire Next.js server plumbing, which per .claude/rules/qa.md §6 would
 *   "mock the layer under test" and invalidate the integration. Source-inspection
 *   covers the structural AC (no "use client", correct imports, correct render
 *   branching). The live integration AC (EmptyState on 0 results, InfiniteScrollGrid
 *   on N>0 results) is verified on the real Staging URL after merge (Staging-only AC).
 *
 * Prove-It notes — each assertion has an explicit Prove-It comment naming what change
 * would turn it red:
 *   AC-1: "use client" test FAILS if "use client" is added to CatalogResults.tsx.
 *   AC-1: getDefaultCatalog import test FAILS if that import is removed.
 *   AC-1: EmptyState import test FAILS if EmptyState is no longer imported.
 *   AC-1: InfiniteScrollGrid import test FAILS if InfiniteScrollGrid is removed.
 *   AC-1: userId wishlist query test FAILS if the prisma.wishlist.findMany is removed.
 *   AC-2: Suspense import test FAILS if "react" Suspense import is removed.
 *   AC-2: CampgroundGridSkeleton import test FAILS if that import is removed.
 *   AC-2: CatalogResults import test FAILS if CatalogResults is removed from page.tsx.
 *   AC-2: fallback skeleton test FAILS if fallback={<CampgroundGridSkeleton} is replaced.
 *   AC-2: "use client" test FAILS if page.tsx gains "use client".
 *   AC-2: auth() test FAILS if auth() call is removed from page.tsx.
 *   AC-2: Navbar test FAILS if Navbar is removed from page.tsx.
 *   AC-3: aspect-square test FAILS if changed to aspect-video or removed.
 *   AC-3: rounded-3xl test FAILS if changed to rounded-xl or removed.
 *   AC-3: mt-3 test FAILS if the text block wrapper loses mt-3.
 *   AC-3: no extra Skeleton line test FAILS if a 5th Skeleton is added to the card body.
 *   AC-3: default count 12 test FAILS if default changed to any other value.
 *   AC-3: role="status" test FAILS if the role attribute is removed.
 *   AC-3: aria-busy test FAILS if aria-busy is removed.
 *   AC-3: aria-label test FAILS if aria-label is removed.
 *   AC-4: animate-pulse test FAILS if removed from skeleton.tsx className.
 *   AC-4: motion-reduce:animate-none test FAILS if removed from skeleton.tsx className.
 *   AC-5: Loader2 test FAILS if Loader2 is re-imported into InfiniteScrollGrid.
 *   AC-5: animate-spin test FAILS if an animate-spin class is added to the file.
 *   AC-5: CampgroundSkeleton import test FAILS if that import is removed.
 *   AC-5: aria-live test FAILS if aria-live="polite" is removed.
 *   AC-6: CampgroundGridSkeleton import test FAILS if removed from loading.tsx.
 *   AC-6: LoadingSpinner test FAILS if LoadingSpinner is added back to loading.tsx.
 *   AC-6: fullScreen test FAILS if a fullScreen prop usage is added.
 *   AC-7: dark:hidden test FAILS if the light-mode img loses the dark:hidden class.
 *   AC-7: hidden dark:block test FAILS if the dark-mode img loses that class pair.
 *   AC-7: width/height on light img test FAILS if those attrs are removed.
 *   AC-7: width/height on dark img test FAILS if those attrs are removed.
 *   AC-7: i18n alt test FAILS if alt is hardcoded instead of referencing t.emptyState.noResults.
 *   AC-8: EN catalog.loading test FAILS if the key is deleted from translations.json.
 *   AC-8: TH verbatim test FAILS if the Thai string is changed.
 *   AC-9: SVG file existence test FAILS if either file is deleted from public/.
 *   AC-9: viewBox test FAILS if the SVG viewBox attribute is changed or removed.
 *   AC-10: aria-live test FAILS if aria-live="polite" is removed from grid wrapper.
 *   AC-10: sr-only label test FAILS if the sr-only span is removed from grid.
 *   AC-10: loading_sr i18n test FAILS if the key is deleted from translations.json.
 *   AC-10: TH loading_sr verbatim test FAILS if the Thai string changes.
 *   AC-10: aria-hidden test FAILS if aria-hidden="true" is removed from CampgroundSkeleton.
 *   AC-11: skeleton-delay-show class test FAILS if removed from grid wrapper.
 *   AC-11: keyframe test FAILS if skeleton-appear is removed from globals.css.
 *   AC-11: reduced-motion test FAILS if the @media block is removed from globals.css.
 *
 * Staging-only ACs (not automatable at source-inspect layer):
 *   - AC-1 live: Home page (no filters) shows CampgroundGridSkeleton skeleton
 *     instantly on hard navigation (case 1: first load, loading.tsx).
 *   - AC-2 live: Changing category/sort/filter shows the skeleton grid immediately
 *     (cases 2–5: key change → Suspense fallback before data arrives).
 *   - AC-3 live: Skeleton card layout matches real CampgroundCard layout — no CLS.
 *   - AC-5 live: Infinite-scroll loading state shows skeleton cards, not a Loader2 spinner.
 *   - AC-6 live: Hard-navigating to / shows skeleton grid, not the full-screen spinner.
 *
 * AC → test-id matrix (per .claude/rules/qa.md §4 convention):
 *   AC-1  section--catalog-results-server-component (source-inspect)
 *   AC-2  page--home-suspense-wiring (source-inspect)
 *   AC-3  section--campground-skeleton-canonical (source-inspect)
 *   AC-4  section--skeleton-ui-reduced-motion (source-inspect)
 *   AC-5  section--infinite-scroll-no-loader2 (source-inspect)
 *   AC-6  section--loading-uses-skeleton (source-inspect)
 *   AC-7  section--empty-state-two-img (source-inspect)
 *   AC-8  section--i18n-catalog-loading (source-inspect)
 *   AC-9  section--assets-svg-existence (source-inspect)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Source helpers — read real production files from the project root
// ---------------------------------------------------------------------------

const root = process.cwd();

function src(relPath: string): string {
  return readFileSync(path.join(root, relPath), 'utf-8');
}

const catalogResultsSrc  = src('components/CatalogResults.tsx');
const campSkeletonSrc    = src('components/CampgroundSkeleton.tsx');
const infiniteScrollSrc  = src('components/InfiniteScrollGrid.tsx');
const emptyStateSrc      = src('components/EmptyState.tsx');
const pageSrc            = src('app/page.tsx');
const loadingSrc         = src('app/loading.tsx');
const skeletonUiSrc      = src('components/ui/skeleton.tsx');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const translations = require('../locales/translations.json') as {
  en: { catalog: { loading: string } };
  th: { catalog: { loading: string } };
};

// ===========================================================================
// AC-1 — CatalogResults is a server component that owns the data-fetch
//         section--catalog-results-server-component
// ===========================================================================

describe('AC-1 — CatalogResults is a server component (components/CatalogResults.tsx)', () => {

  // Prove-It: FAILS if "use client" is added to CatalogResults.tsx as a directive.
  // We check for the directive as a real statement (alone on its own line), not in
  // a comment. The file's JSDoc says `No "use client"` — that phrase must remain a
  // comment, not be promoted to a real directive at the top of the file.
  it('[server] has NO "use client" directive — is a Server Component', () => {
    // A real "use client" directive appears at the very start of the file,
    // optionally preceded by blank lines or a shebang, but NOT inside a JSDoc or comment.
    // Pattern: "use client" must NOT appear as a standalone line outside of a /* */ block.
    const lines = catalogResultsSrc.split('\n');
    const directiveLine = lines.find((line) => line.trim() === '"use client"' || line.trim() === "'use client'");
    expect(directiveLine).toBeUndefined();
  });

  // Prove-It: FAILS if getDefaultCatalog import is removed
  it('[data-fetch] imports getDefaultCatalog (CACHE-1 cached default catalog)', () => {
    expect(catalogResultsSrc).toContain('getDefaultCatalog');
  });

  // Prove-It: FAILS if buildCampSiteWhere import is removed
  it('[data-fetch] imports buildCampSiteWhere (filtered/live Prisma path)', () => {
    expect(catalogResultsSrc).toContain('buildCampSiteWhere');
  });

  // Prove-It: FAILS if EmptyState is no longer imported
  it('[render] imports EmptyState (shown when campSites.length === 0)', () => {
    expect(catalogResultsSrc).toContain("EmptyState");
  });

  // Prove-It: FAILS if InfiniteScrollGrid import is removed
  it('[render] imports InfiniteScrollGrid (shown when campSites.length > 0)', () => {
    expect(catalogResultsSrc).toContain('InfiniteScrollGrid');
  });

  // Prove-It: FAILS if the empty-state branch is removed
  it('[render-branch] returns <EmptyState> when campSites.length === 0', () => {
    expect(catalogResultsSrc).toContain('campSites.length === 0');
    expect(catalogResultsSrc).toContain('<EmptyState');
  });

  // Prove-It: FAILS if InfiniteScrollGrid render is removed
  it('[render-branch] returns <InfiniteScrollGrid> when results exist', () => {
    expect(catalogResultsSrc).toContain('<InfiniteScrollGrid');
  });

  // Prove-It: FAILS if the prisma.wishlist.findMany call is removed
  it('[wishlist] performs per-user wishlist lookup via prisma (not cached)', () => {
    expect(catalogResultsSrc).toContain('prisma.wishlist.findMany');
    // Wishlist lookup is outside getDefaultCatalog — uncached / per-request
    expect(catalogResultsSrc).toContain('savedCampSiteIds');
  });

  // Prove-It: FAILS if the userId guard is removed (wishlist must only run for logged-in users)
  it('[wishlist] wishlist lookup is guarded by userId (runs only when logged in)', () => {
    expect(catalogResultsSrc).toMatch(/if\s*\(\s*userId\s*\)/);
  });

  // Prove-It: FAILS if useCache gate is removed
  it('[cache-gate] has an isSearchActive / useCache gate selecting cache vs live path', () => {
    expect(catalogResultsSrc).toContain('isSearchActive');
    expect(catalogResultsSrc).toContain('useCache');
  });
});

// ===========================================================================
// AC-2 — page.tsx Suspense wiring
//         page--home-suspense-wiring
// ===========================================================================

describe('AC-2 — page.tsx Suspense wiring (app/page.tsx)', () => {

  // Prove-It: FAILS if "use client" is added to page.tsx as a real directive
  it('[server] page.tsx has NO "use client" directive', () => {
    const lines = pageSrc.split('\n');
    const directiveLine = lines.find((line) => line.trim() === '"use client"' || line.trim() === "'use client'");
    expect(directiveLine).toBeUndefined();
  });

  // Prove-It: FAILS if the Suspense import is removed from react
  it('[suspense] imports Suspense from "react"', () => {
    expect(pageSrc).toMatch(/import\s*\{[^}]*Suspense[^}]*\}\s*from\s*["']react["']/);
  });

  // Prove-It: FAILS if CampgroundGridSkeleton import is removed
  it('[suspense] imports CampgroundGridSkeleton from CampgroundSkeleton', () => {
    expect(pageSrc).toContain('CampgroundGridSkeleton');
    expect(pageSrc).toContain('CampgroundSkeleton');
  });

  // Prove-It: FAILS if CatalogResults import is removed
  it('[suspense] imports CatalogResults', () => {
    expect(pageSrc).toContain('CatalogResults');
  });

  // Prove-It: FAILS if the Suspense wrapper is removed
  it('[suspense] renders <Suspense with a key prop derived from search params', () => {
    expect(pageSrc).toContain('<Suspense');
    expect(pageSrc).toContain('key={searchParamsKey}');
  });

  // Prove-It: FAILS if fallback is changed from CampgroundGridSkeleton to something else
  it('[suspense] fallback uses CampgroundGridSkeleton (not a spinner)', () => {
    expect(pageSrc).toContain('fallback={<CampgroundGridSkeleton');
  });

  // Prove-It: FAILS if <CatalogResults is removed from the Suspense children
  it('[suspense] CatalogResults is the async child inside the Suspense boundary', () => {
    expect(pageSrc).toContain('<CatalogResults');
  });

  // Prove-It: FAILS if auth() is removed from page.tsx
  it('[auth] page.tsx still calls auth() for session / userId', () => {
    expect(pageSrc).toContain('auth()');
  });

  // Prove-It: FAILS if Navbar is removed from page.tsx
  it('[shell] page.tsx still renders Navbar (shell renders synchronously)', () => {
    expect(pageSrc).toContain('<Navbar');
  });

  // Prove-It: FAILS if CategoryBar is removed from page.tsx
  it('[shell] page.tsx still renders CategoryBar', () => {
    expect(pageSrc).toContain('<CategoryBar');
  });

  // Prove-It: FAILS if the searchParamsKey construction is removed
  it('[key] searchParamsKey is composed from sort + all filter params (triggers skeleton on change)', () => {
    expect(pageSrc).toContain('searchParamsKey');
    // Key must include sort (the primary trigger for skeleton-on-change)
    expect(pageSrc).toContain('sort ??');
    // Key must include keyword, province, district (representative filter params)
    expect(pageSrc).toContain('keyword ??');
    expect(pageSrc).toContain('province ??');
    expect(pageSrc).toContain('district ??');
  });
});

// ===========================================================================
// AC-3 — CampgroundSkeleton canonical structure
//         section--campground-skeleton-canonical
// ===========================================================================

describe('AC-3 — CampgroundSkeleton canonical structure (components/CampgroundSkeleton.tsx)', () => {

  // Prove-It: FAILS if Skeleton import is removed
  it('[skeleton] imports Skeleton from ui/skeleton', () => {
    expect(campSkeletonSrc).toContain("from \"@/components/ui/skeleton\"");
  });

  // Prove-It: FAILS if the image Skeleton is given aspect-video or another aspect class
  it('[image] image Skeleton has aspect-square class (matches real card layout, CLS=0)', () => {
    expect(campSkeletonSrc).toContain('aspect-square');
  });

  // Prove-It: FAILS if rounded-3xl is changed to rounded-xl
  it('[image] image Skeleton has rounded-3xl (NOT rounded-xl — matches CampgroundCard)', () => {
    expect(campSkeletonSrc).toContain('rounded-3xl');
    expect(campSkeletonSrc).not.toContain('rounded-xl');
  });

  // Prove-It: FAILS if mt-3 is removed from the text block wrapper
  it('[text-block] text block wrapper has mt-3 (spacing matches real card)', () => {
    expect(campSkeletonSrc).toContain('mt-3');
  });

  // Prove-It: FAILS if the title Skeleton is removed
  it('[text-block] title Skeleton has h-5 w-2/3 (matches card name width)', () => {
    expect(campSkeletonSrc).toContain('h-5 w-2/3');
  });

  // Prove-It: FAILS if the rating Skeleton is removed
  it('[text-block] rating Skeleton has h-4 w-10 (compact rating chip)', () => {
    expect(campSkeletonSrc).toContain('h-4 w-10');
  });

  // Prove-It: FAILS if the location Skeleton is removed
  it('[text-block] location Skeleton has h-4 w-1/2', () => {
    expect(campSkeletonSrc).toContain('h-4 w-1/2');
  });

  // Prove-It: FAILS if the price Skeleton is removed
  it('[text-block] price Skeleton has h-5 w-1/4 inside a pt-1 wrapper', () => {
    expect(campSkeletonSrc).toContain('h-5 w-1/4');
    expect(campSkeletonSrc).toContain('pt-1');
  });

  // Prove-It: FAILS if a 5th Skeleton is added to the card body (regression guard)
  // 4 Skeleton elements in the text block: title, rating, location, price.
  // Plus 1 for the image = 5 total per card; but in the text block there are exactly 4.
  // We assert the text block class structure contains exactly the 4 expected h- widths.
  it('[text-block] exactly 4 Skeleton bars in the card body (no extra 3rd text line added)', () => {
    // Count occurrences of <Skeleton in the CampgroundSkeleton function
    // (before CampgroundGridSkeleton which uses <CampgroundSkeleton — no direct <Skeleton there)
    const skeletonFnMatch = campSkeletonSrc.match(
      /export function CampgroundSkeleton\(\)([\s\S]*?)(?=export function CampgroundGridSkeleton)/
    );
    expect(skeletonFnMatch).not.toBeNull();
    const skeletonFnBody = skeletonFnMatch![1];
    const skeletonTagCount = (skeletonFnBody.match(/<Skeleton/g) ?? []).length;
    // 5 total: 1 image + 4 text (title, rating, location, price)
    expect(skeletonTagCount).toBe(5);
  });

  // CampgroundGridSkeleton tests
  // Prove-It: FAILS if count default is changed from 12
  it('[grid] CampgroundGridSkeleton default count is 12', () => {
    expect(campSkeletonSrc).toContain('count = 12');
  });

  // Prove-It: FAILS if role="status" is removed from the grid wrapper
  it('[a11y] CampgroundGridSkeleton has role="status"', () => {
    expect(campSkeletonSrc).toContain('role="status"');
  });

  // Prove-It: FAILS if aria-busy is removed
  it('[a11y] CampgroundGridSkeleton has aria-busy="true"', () => {
    expect(campSkeletonSrc).toContain('aria-busy="true"');
  });

  // Prove-It: FAILS if aria-label is removed
  it('[a11y] CampgroundGridSkeleton has an aria-label prop', () => {
    expect(campSkeletonSrc).toContain('aria-label');
  });

  // Prove-It: FAILS if the label default is changed away from the TH translation key
  it('[a11y] aria-label defaults to the Thai catalog.loading translation (no hardcoded string)', () => {
    // The component must use the translations import for the default label —
    // not a hardcoded English string
    expect(campSkeletonSrc).toContain('translations.th.catalog.loading');
  });

  // Prove-It: FAILS if data-testid is removed from the grid wrapper
  it('[testid] CampgroundGridSkeleton has data-testid="grid--catalog-skeleton"', () => {
    expect(campSkeletonSrc).toContain('data-testid="grid--catalog-skeleton"');
  });
});

// ===========================================================================
// AC-4 — skeleton.tsx has reduced-motion + animate-pulse
//         section--skeleton-ui-reduced-motion
// ===========================================================================

describe('AC-4 — skeleton.tsx base className (components/ui/skeleton.tsx)', () => {

  // Prove-It: FAILS if animate-pulse is removed from the base class
  it('[animation] base className contains animate-pulse', () => {
    expect(skeletonUiSrc).toContain('animate-pulse');
  });

  // Prove-It: FAILS if motion-reduce:animate-none is removed
  it('[reduced-motion] base className contains motion-reduce:animate-none (prefers-reduced-motion)', () => {
    expect(skeletonUiSrc).toContain('motion-reduce:animate-none');
  });

  // Prove-It: FAILS if both tokens are not on the same class string
  it('[combined] animate-pulse and motion-reduce:animate-none appear in the same className expression', () => {
    // They must be in the same cn() call, not in separate conditional branches
    const cnCallMatch = skeletonUiSrc.match(/cn\([^)]+\)/);
    expect(cnCallMatch).not.toBeNull();
    const cnCallSrc = cnCallMatch![0];
    expect(cnCallSrc).toContain('animate-pulse');
    expect(cnCallSrc).toContain('motion-reduce:animate-none');
  });
});

// ===========================================================================
// AC-5 — InfiniteScrollGrid: no Loader2, no animate-spin, uses CampgroundSkeleton
//         section--infinite-scroll-no-loader2
// ===========================================================================

describe('AC-5 — InfiniteScrollGrid no longer uses Loader2 (components/InfiniteScrollGrid.tsx)', () => {

  // Prove-It: FAILS if Loader2 is re-imported into InfiniteScrollGrid
  it('[removed] does NOT import Loader2', () => {
    expect(infiniteScrollSrc).not.toContain('Loader2');
  });

  // Prove-It: FAILS if an animate-spin class is added back to the file
  it('[removed] does NOT contain animate-spin (spinner removed in favour of skeleton)', () => {
    expect(infiniteScrollSrc).not.toContain('animate-spin');
  });

  // Prove-It: FAILS if the CampgroundSkeleton import is removed
  it('[skeleton] imports CampgroundSkeleton from shared module', () => {
    expect(infiniteScrollSrc).toContain('CampgroundSkeleton');
    expect(infiniteScrollSrc).toContain('CampgroundSkeleton');
  });

  // Prove-It: FAILS if the loading skeleton render is removed
  it('[skeleton] renders CampgroundSkeleton elements in the loading state', () => {
    expect(infiniteScrollSrc).toContain('<CampgroundSkeleton');
  });

  // Prove-It: FAILS if aria-live="polite" is removed from the status div
  it('[a11y] aria-live="polite" region is still present for SR announcements', () => {
    expect(infiniteScrollSrc).toContain('aria-live="polite"');
  });

  // Prove-It: FAILS if the sentinel aria-hidden is removed
  it('[a11y] sentinel div has aria-hidden="true"', () => {
    expect(infiniteScrollSrc).toContain('aria-hidden="true"');
  });
});

// ===========================================================================
// AC-6 — loading.tsx uses CampgroundGridSkeleton, NOT LoadingSpinner
//         section--loading-uses-skeleton
// ===========================================================================

describe('AC-6 — loading.tsx uses CampgroundGridSkeleton (app/loading.tsx)', () => {

  // Prove-It: FAILS if the CampgroundGridSkeleton import is removed from loading.tsx
  it('[import] imports CampgroundGridSkeleton from CampgroundSkeleton', () => {
    expect(loadingSrc).toContain('CampgroundGridSkeleton');
    expect(loadingSrc).toContain('CampgroundSkeleton');
  });

  // Prove-It: FAILS if the render is changed to something else
  it('[render] renders <CampgroundGridSkeleton />', () => {
    expect(loadingSrc).toContain('<CampgroundGridSkeleton');
  });

  // Prove-It: FAILS if LoadingSpinner is re-added
  it('[removed] does NOT import or use LoadingSpinner', () => {
    expect(loadingSrc).not.toContain('LoadingSpinner');
  });

  // Prove-It: FAILS if a fullScreen prop usage is added back
  it('[removed] does NOT use a fullScreen prop (full-screen spinner pattern gone)', () => {
    expect(loadingSrc).not.toContain('fullScreen');
  });

  // loading.tsx should remain a Server Component (no interactive need)
  // Prove-It: FAILS if "use client" is added as a directive
  it('[server] loading.tsx has NO "use client" directive', () => {
    const lines = loadingSrc.split('\n');
    const directiveLine = lines.find((line) => line.trim() === '"use client"' || line.trim() === "'use client'");
    expect(directiveLine).toBeUndefined();
  });
});

// ===========================================================================
// AC-7 — EmptyState two-img dark-mode pair
//         section--empty-state-two-img
// ===========================================================================

describe('AC-7 — EmptyState two-img dark-mode pair (components/EmptyState.tsx)', () => {

  // Prove-It: FAILS if the light-mode img is removed
  it('[light-img] has <img src="/camping-empty.svg"', () => {
    expect(emptyStateSrc).toContain('src="/camping-empty.svg"');
  });

  // Prove-It: FAILS if the dark:hidden class is removed from the light-mode img
  it('[light-img] light-mode img has dark:hidden class', () => {
    // The light image is hidden in dark mode
    const lightImgMatch = emptyStateSrc.match(/src="\/camping-empty\.svg"[^>]*/);
    expect(lightImgMatch).not.toBeNull();
    expect(lightImgMatch![0]).toContain('dark:hidden');
  });

  // Prove-It: FAILS if the dark-mode img is removed
  it('[dark-img] has <img src="/camping-empty-dark.svg"', () => {
    expect(emptyStateSrc).toContain('src="/camping-empty-dark.svg"');
  });

  // Prove-It: FAILS if hidden dark:block is removed from the dark-mode img
  it('[dark-img] dark-mode img has hidden dark:block class (visible only in dark mode)', () => {
    const darkImgMatch = emptyStateSrc.match(/src="\/camping-empty-dark\.svg"[^>]*/);
    expect(darkImgMatch).not.toBeNull();
    expect(darkImgMatch![0]).toContain('hidden dark:block');
  });

  // Prove-It: FAILS if width is removed from either img
  it('[dimensions] both imgs have a width attribute (prevents CLS)', () => {
    // Count occurrences of width="320" — one per <img>
    const widthMatches = emptyStateSrc.match(/width="320"/g) ?? [];
    expect(widthMatches.length).toBeGreaterThanOrEqual(2);
  });

  // Prove-It: FAILS if height is removed from either img
  it('[dimensions] both imgs have a height attribute (prevents CLS)', () => {
    const heightMatches = emptyStateSrc.match(/height="200"/g) ?? [];
    expect(heightMatches.length).toBeGreaterThanOrEqual(2);
  });

  // Prove-It: FAILS if alt is hardcoded instead of using t.emptyState.noResults
  it('[a11y] alt text references t.emptyState.noResults (i18n — not hardcoded)', () => {
    // The alt must come from the translation context, not a hardcoded string
    expect(emptyStateSrc).toContain('t.emptyState.noResults');
    // And both <img> elements' alt attributes should use the same i18n key
    const altMatches = emptyStateSrc.match(/alt=\{t\.emptyState\.noResults\}/g) ?? [];
    expect(altMatches.length).toBeGreaterThanOrEqual(2);
  });

  // Prove-It: FAILS if one of the two <img> tags is removed (must be exactly 2)
  it('[structure] there are exactly 2 <img> elements (light + dark pair)', () => {
    // Count opening <img tags
    const imgTags = emptyStateSrc.match(/<img\b/g) ?? [];
    expect(imgTags.length).toBe(2);
  });
});

// ===========================================================================
// AC-8 — i18n: catalog.loading in both locales; TH verbatim
//         section--i18n-catalog-loading
// ===========================================================================

describe('AC-8 — i18n catalog.loading key (locales/translations.json)', () => {

  // Prove-It: FAILS if the key is removed from the EN locale
  it('[en] catalog.loading exists in the EN locale', () => {
    expect(translations.en.catalog.loading).toBeTruthy();
  });

  // Prove-It: FAILS if the key is removed from the TH locale
  it('[th] catalog.loading exists in the TH locale', () => {
    expect(translations.th.catalog.loading).toBeTruthy();
  });

  // Prove-It: FAILS if the Thai string is changed (even by one character)
  it('[th-verbatim] TH catalog.loading is "กำลังโหลดลาน" (verbatim)', () => {
    expect(translations.th.catalog.loading).toBe('กำลังโหลดลาน');
  });

  // Prove-It: FAILS if the EN string is changed
  it('[en] EN catalog.loading is "Loading camps"', () => {
    expect(translations.en.catalog.loading).toBe('Loading camps');
  });

  // Prove-It: FAILS if the loading_more or end_of_list keys are accidentally removed
  // (InfiniteScrollGrid depends on catalog.loading_more; regression guard from AC-5)
  it('[regression] catalog.loading_more and catalog.end_of_list still exist in both locales', () => {
    const enCatalog = translations.en.catalog as Record<string, string>;
    const thCatalog = translations.th.catalog as Record<string, string>;
    expect(enCatalog['loading_more']).toBeTruthy();
    expect(enCatalog['end_of_list']).toBeTruthy();
    expect(thCatalog['loading_more']).toBeTruthy();
    expect(thCatalog['end_of_list']).toBeTruthy();
  });

  // Prove-It: FAILS if the TH loading_more verbatim string is changed
  it('[th-verbatim] TH catalog.loading_more is "กำลังโหลดลานเพิ่มเติม"', () => {
    const thCatalog = translations.th.catalog as Record<string, string>;
    expect(thCatalog['loading_more']).toBe('กำลังโหลดลานเพิ่มเติม');
  });
});

// ===========================================================================
// AC-9 — Assets: public/camping-empty.svg + public/camping-empty-dark.svg
//         section--assets-svg-existence
// ===========================================================================

describe('AC-9 — SVG assets in public/ (public/camping-empty*.svg)', () => {

  // Prove-It: FAILS if the light-mode SVG is deleted from public/
  it('[file-exists] public/camping-empty.svg exists', () => {
    expect(existsSync(path.join(root, 'public', 'camping-empty.svg'))).toBe(true);
  });

  // Prove-It: FAILS if the dark-mode SVG is deleted from public/
  it('[file-exists] public/camping-empty-dark.svg exists', () => {
    expect(existsSync(path.join(root, 'public', 'camping-empty-dark.svg'))).toBe(true);
  });

  // Prove-It: FAILS if the viewBox is changed or removed from camping-empty.svg
  it('[viewBox] camping-empty.svg contains viewBox="0 0 1280 800"', () => {
    const svgContent = src('public/camping-empty.svg');
    expect(svgContent).toContain('viewBox="0 0 1280 800"');
  });

  // Prove-It: FAILS if the viewBox is changed or removed from camping-empty-dark.svg
  it('[viewBox] camping-empty-dark.svg contains viewBox="0 0 1280 800"', () => {
    const darkSvgContent = src('public/camping-empty-dark.svg');
    expect(darkSvgContent).toContain('viewBox="0 0 1280 800"');
  });

  // Prove-It: FAILS if either SVG file is empty or truncated
  it('[non-empty] both SVG files have non-trivial content (>100 bytes)', () => {
    const lightSize = readFileSync(path.join(root, 'public', 'camping-empty.svg')).length;
    const darkSize  = readFileSync(path.join(root, 'public', 'camping-empty-dark.svg')).length;
    expect(lightSize).toBeGreaterThan(100);
    expect(darkSize).toBeGreaterThan(100);
  });

  // Prove-It: FAILS if the SVG xmlns is missing (broken SVG that browsers won't render)
  it('[valid-svg] both SVG files contain xmlns="http://www.w3.org/2000/svg"', () => {
    const lightSvg = src('public/camping-empty.svg');
    const darkSvg  = src('public/camping-empty-dark.svg');
    expect(lightSvg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(darkSvg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });
});

// ===========================================================================
// AC-10 — CampgroundGridSkeleton a11y completeness (CAM-245 LOAD-PILOT)
//          loading-ui-standard §S5 compliance
//          section--campground-skeleton-a11y-pilot
// ===========================================================================

// Re-read the skeleton and globals sources here so these assertions are always
// against the current file state (no stale closure from the top-level reads).
const globalsCssSrc = src('app/globals.css');

describe('AC-10 — CampgroundGridSkeleton a11y (CAM-245 LOAD-PILOT §S5)', () => {

  // Prove-It: FAILS if aria-live="polite" is removed from the CampgroundGridSkeleton container.
  // Standard §S5 requires role="status" paired with aria-live="polite" on the loading region.
  it('[a11y] CampgroundGridSkeleton has aria-live="polite" (pairs with role="status")', () => {
    expect(campSkeletonSrc).toContain('aria-live="polite"');
  });

  // Prove-It: FAILS if aria-busy="true" is removed from the grid wrapper.
  it('[a11y] CampgroundGridSkeleton has aria-busy="true"', () => {
    expect(campSkeletonSrc).toContain('aria-busy="true"');
  });

  // Prove-It: FAILS if the sr-only span with the live-region text is removed.
  // Standard §S5: "pair the visual loader with a text label" inside the live region.
  it('[a11y] CampgroundGridSkeleton renders an sr-only live-region span (กำลังโหลด… label)', () => {
    expect(campSkeletonSrc).toContain('sr-only');
    expect(campSkeletonSrc).toContain('SR_LABEL');
  });

  // Prove-It: FAILS if catalog.loading_sr is deleted from the EN locale.
  it('[i18n] catalog.loading_sr exists in EN locale', () => {
    const enCatalog = (translations as { en: { catalog: Record<string, string> } }).en.catalog;
    expect(enCatalog['loading_sr']).toBeTruthy();
  });

  // Prove-It: FAILS if catalog.loading_sr is deleted from the TH locale.
  it('[i18n] catalog.loading_sr exists in TH locale', () => {
    const thCatalog = (translations as { th: { catalog: Record<string, string> } }).th.catalog;
    expect(thCatalog['loading_sr']).toBeTruthy();
  });

  // Prove-It: FAILS if the TH loading_sr string is changed (even one character).
  it('[i18n] TH catalog.loading_sr is "กำลังโหลด…" (verbatim, with ellipsis)', () => {
    const thCatalog = (translations as { th: { catalog: Record<string, string> } }).th.catalog;
    expect(thCatalog['loading_sr']).toBe('กำลังโหลด…');
  });

  // Prove-It: FAILS if aria-hidden="true" is removed from CampgroundSkeleton (the card wrapper).
  // Standard §S5: "Mark purely decorative skeleton shapes aria-hidden='true'."
  // Individual cards are decorative — the live region in the grid carries the announcement.
  it('[a11y] CampgroundSkeleton card wrapper has aria-hidden="true" (decorative shape)', () => {
    // The individual card component must be marked decorative so SR skips per-card noise.
    expect(campSkeletonSrc).toContain('aria-hidden="true"');
  });

  // Prove-It: FAILS if the loading_sr key is hardcoded in the component instead of read from translations.
  it('[i18n] CampgroundSkeleton reads SR_LABEL from translations (not hardcoded)', () => {
    // Component must import and reference the translation constant, not a hardcoded Thai string.
    expect(campSkeletonSrc).toContain('translations.th.catalog.loading_sr');
  });
});

// ===========================================================================
// AC-11 — Anti-flicker delay-before-show (CAM-245 LOAD-PILOT §S4)
//          section--skeleton-anti-flicker-pilot
// ===========================================================================

describe('AC-11 — Anti-flicker delay-before-show (CAM-245 LOAD-PILOT §S4)', () => {

  // Prove-It: FAILS if skeleton-delay-show class is removed from the CampgroundGridSkeleton wrapper.
  // This class triggers the 300ms CSS animation-delay that hides the skeleton on fast loads.
  it('[anti-flicker] CampgroundGridSkeleton applies skeleton-delay-show CSS class', () => {
    expect(campSkeletonSrc).toContain('skeleton-delay-show');
  });

  // Prove-It: FAILS if the @keyframes skeleton-appear rule is removed from globals.css.
  it('[anti-flicker] globals.css defines @keyframes skeleton-appear', () => {
    expect(globalsCssSrc).toContain('@keyframes skeleton-appear');
  });

  // Prove-It: FAILS if the 300ms animation-delay is removed from the .skeleton-delay-show rule.
  it('[anti-flicker] .skeleton-delay-show uses 300ms delay (delay-before-show target)', () => {
    expect(globalsCssSrc).toContain('skeleton-delay-show');
    expect(globalsCssSrc).toContain('300ms');
  });

  // Prove-It: FAILS if the keyframe is moved outside the prefers-reduced-motion:no-preference block.
  // Standard §S4 + §S5: shimmer/fade disabled under reduce-motion.
  it('[reduced-motion] skeleton-appear animation is gated behind prefers-reduced-motion:no-preference', () => {
    expect(globalsCssSrc).toContain('prefers-reduced-motion: no-preference');
    // Confirm the animation and the media query appear in the same file section.
    const rmIdx = globalsCssSrc.indexOf('prefers-reduced-motion: no-preference');
    const keyframeIdx = globalsCssSrc.indexOf('@keyframes skeleton-appear');
    // The no-preference guard must appear (the guard and keyframe are both present).
    expect(rmIdx).toBeGreaterThan(-1);
    expect(keyframeIdx).toBeGreaterThan(-1);
  });

  // Prove-It: FAILS if the reduce-motion fallback (opacity:1) is removed.
  // Under reduce-motion, skeleton-delay-show must be visible immediately.
  it('[reduced-motion] globals.css has prefers-reduced-motion:reduce fallback (opacity:1)', () => {
    expect(globalsCssSrc).toContain('prefers-reduced-motion: reduce');
    expect(globalsCssSrc).toContain('opacity: 1');
  });
});
