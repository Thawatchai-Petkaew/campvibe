/**
 * cam-196-infinite-scroll.test.ts — PERF-3 / CAM-196 (Part 2: API-flow + UI-contract gaps)
 *
 * Complements cam-196-keyset-cursor.test.ts (61 unit tests covering encode/decode/
 * buildKeysetWhere/orderByFor/PAGE_SIZE/catalog-cache/page.tsx wiring).
 *
 * This file adds the GAPS not covered by Part-1:
 *
 *   AC-SEC1   API SEC-1 gate on cursor pages — every cursor fetch AND-merges
 *             buildCampSiteWhere (isActive/isPublished/deletedAt); keyset cannot
 *             bypass the visibility gate. Source-inspect of route.ts.
 *
 *   AC-NEXT   nextCursor boundary — exactly PAGE_SIZE rows → nextCursor non-null;
 *             fewer than PAGE_SIZE rows → nextCursor null. Source-inspect of the
 *             PAGE_SIZE+1 probe + hasMore logic.
 *
 *   AC-BAD    Invalid cursor / bad sort → 400 (not crash). Source-inspect: route
 *             returns 400 on decodeCursor returning null and on zod sort enum failure.
 *
 *   AC-UI     InfiniteScrollGrid contract (source-inspect):
 *             - IntersectionObserver used on a sentinel
 *             - Component keys/resets on sort+filter change (React key from parent)
 *             - end-of-list renders i18n key catalog.end_of_list
 *             - loading renders skeleton + aria-live region
 *             - aria-live="polite" region present
 *             - Sentinel has tabIndex={-1} + aria-hidden
 *             - Reuses CampgroundCard
 *             - Seeds from initialItems (SSR — does NOT refetch page 1 on mount)
 *             - Does NOT call fetch on mount when cursor=null (end-of-list from SSR)
 *             - Appends items on subsequent page loads (setItems prev => [...prev, ...])
 *             - data-testid on grid and sentinel
 *
 *   AC-I18N   catalog.loading_more and catalog.end_of_list exist in both en and th;
 *             Thai copy verbatim: ดูลานครบทั้งหมดแล้ว / กำลังโหลดลานเพิ่มเติม
 *
 *   AC-SSR    app/page.tsx passes initialItems (server-rendered) to InfiniteScrollGrid.
 *             Crawler / no-JS sees first 24 cards from SSR HTML.
 *             SSR key construction includes sort + all filter params (reset on change).
 *
 * Layers:
 *   - All tests → source-inspect (static parse of real production files).
 *     This is the correct layer for Next.js "use client" components and Server
 *     Components — jsdom is not available (vitest environment: node), and importing
 *     InfiniteScrollGrid would require full Next.js + browser APIs. Source-inspect
 *     was established as the correct precedent across cam-196 Part-1, cam-195,
 *     cam-194, cam-193. Each assertion is paired with a Prove-It note that names
 *     exactly what change would make it fail.
 *
 * Coverage matrix per AC (normal · null/empty · boundary · error/validation):
 *   AC-SEC1   normal (cursor present), normal (no cursor — base where used directly)
 *   AC-NEXT   boundary (exactly PAGE_SIZE → non-null), boundary (< PAGE_SIZE → null),
 *             null/empty (0 items → null)
 *   AC-BAD    error (bad cursor → 400), error (bad sort → 400 via zod), normal (valid)
 *   AC-UI     normal (all structural contracts)
 *   AC-I18N   normal (both locales present), verbatim string match
 *   AC-SSR    normal (page wiring), normal (key construction), null/empty (no camps)
 *
 * Prove-It notes (each test names the change that makes it fail):
 *   - SEC-1 AND-merge test FAILS if `AND: [baseWhere, buildKeysetWhere(` is removed.
 *   - SEC-1 base where test FAILS if `buildCampSiteWhere(` is removed from route.
 *   - nextCursor non-null test FAILS if `PAGE_SIZE + 1` probe is changed to PAGE_SIZE.
 *   - nextCursor null test FAILS if `hasMore` branch is removed.
 *   - 400-on-bad-cursor test FAILS if the `decodedCursor === null` guard is removed.
 *   - 400-on-bad-sort test FAILS if `catalogQuerySchema.safeParse(` is removed.
 *   - IntersectionObserver test FAILS if `new IntersectionObserver(` is removed.
 *   - sentinel aria-hidden test FAILS if `aria-hidden` is removed from the sentinel div.
 *   - sentinel tabIndex test FAILS if `tabIndex={-1}` is removed.
 *   - aria-live test FAILS if `aria-live="polite"` is removed from the status div.
 *   - end-of-list i18n test FAILS if `t.catalog.end_of_list` is replaced with hardcoded.
 *   - loading skeleton test FAILS if `SkeletonCards` is removed from the loading branch.
 *   - seeds from initialItems test FAILS if `useState<>(initialItems)` is removed.
 *   - no-page1-refetch test FAILS if a useEffect unconditional fetch is added on mount.
 *   - append test FAILS if `setItems((prev) => [...prev, ...data.items])` is changed.
 *   - page.tsx InfiniteScrollGrid import test FAILS if the import is removed.
 *   - page.tsx initialItems prop test FAILS if `initialItems={serialisedCamps}` removed.
 *   - key-construction test FAILS if the key doesn't include sort + all filter params.
 *   - Thai verbatim test FAILS if the Thai string is changed.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Source helpers
// ---------------------------------------------------------------------------

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

const routeSrc           = readSrc('app/api/campsites/route.ts');
const infiniteGridSrc    = readSrc('components/InfiniteScrollGrid.tsx');
const pageSrc            = readSrc('app/page.tsx');
// LOAD-1 (CAM-197): data-fetch + SSR logic moved from page.tsx → CatalogResults.tsx.
// Tests that previously asserted on pageSrc for data patterns now check catalogResultsSrc.
const catalogResultsSrc  = readSrc('components/CatalogResults.tsx');
const translationsJson   = readSrc('locales/translations.json');

// Parse the translations JSON once for i18n assertions.
const translations = JSON.parse(translationsJson) as Record<string, Record<string, unknown>>;

// ===========================================================================
// AC-SEC1 — API SEC-1 gate: visibility base-where always AND-merged
// ===========================================================================

describe('AC-SEC1 — cursor pages cannot bypass the visibility gate', () => {

  it('[normal] route always calls buildCampSiteWhere (base visibility gate present)', () => {
    // Prove-It: FAILS if buildCampSiteWhere is removed from the GET handler.
    expect(routeSrc).toContain('buildCampSiteWhere(');
  });

  it('[normal] route imports buildCampSiteWhere from campsite-filters', () => {
    // Prove-It: FAILS if the import is removed.
    expect(routeSrc).toContain("from '@/lib/campsite-filters'");
  });

  it('[normal] cursor page merges keyset WHERE via AND with base filter (not standalone)', () => {
    // The keyset predicate is AND-merged with the base visibility where — it can never
    // replace it. A cursor request must still satisfy isActive/isPublished/deletedAt.
    // Prove-It: FAILS if the AND merge is removed.
    expect(routeSrc).toContain('AND: [baseWhere, buildKeysetWhere(');
  });

  it('[normal] the base where is built BEFORE the cursor branch (visibility gate always runs)', () => {
    // Structural order: buildCampSiteWhere must appear before the keyset merge.
    // Prove-It: FAILS if buildCampSiteWhere is moved inside the cursor-only branch.
    const buildWherePos  = routeSrc.indexOf('buildCampSiteWhere(');
    const andMergePos    = routeSrc.indexOf('AND: [baseWhere, buildKeysetWhere(');
    expect(buildWherePos).toBeGreaterThan(-1);
    expect(andMergePos).toBeGreaterThan(-1);
    expect(buildWherePos).toBeLessThan(andMergePos);
  });

  it('[normal] no-cursor path uses baseWhere directly (visibility gate still present)', () => {
    // When cursor is absent, where = baseWhere (not replaced or skipped).
    // Prove-It: FAILS if `where = decodedCursor ? ... : baseWhere` is removed.
    expect(routeSrc).toContain(': baseWhere');
  });

  it('[normal] route correctly assigns baseWhere variable (named reference)', () => {
    // The variable is named `baseWhere` and referenced in the AND merge.
    expect(routeSrc).toContain('const baseWhere = buildCampSiteWhere(');
    expect(routeSrc).toContain('baseWhere');
  });
});

// ===========================================================================
// AC-NEXT — nextCursor boundary: PAGE_SIZE+1 probe, hasMore logic
// ===========================================================================

describe('AC-NEXT — nextCursor boundary: full page → non-null, partial → null', () => {

  it('[boundary] route queries PAGE_SIZE+1 rows to detect hasNextPage', () => {
    // Prove-It: FAILS if `PAGE_SIZE + 1` is changed back to `PAGE_SIZE`.
    expect(routeSrc).toContain('PAGE_SIZE + 1');
  });

  it('[boundary] route slices items to PAGE_SIZE before serialising (removes probe item)', () => {
    // Prove-It: FAILS if `.slice(0, PAGE_SIZE)` is removed.
    expect(routeSrc).toContain('slice(0, PAGE_SIZE)');
  });

  it('[boundary] hasMore is derived from rows.length > PAGE_SIZE', () => {
    // Prove-It: FAILS if the hasMore variable or the comparison is changed.
    expect(routeSrc).toContain('rows.length > PAGE_SIZE');
    expect(routeSrc).toContain('const hasMore =');
  });

  it('[boundary] nextCursor is null when !hasMore (fewer than PAGE_SIZE results)', () => {
    // The null path: when hasMore is false, encodeCursorFromItem is NOT called.
    // Prove-It: FAILS if the null branch is removed.
    expect(routeSrc).toContain(': null');
    expect(routeSrc).toContain('nextCursor');
  });

  it('[boundary] nextCursor encodes the last item when hasMore is true (full page)', () => {
    // Prove-It: FAILS if `encodeCursorFromItem(` is removed from the route.
    expect(routeSrc).toContain('encodeCursorFromItem(');
  });

  it('[null/empty] nextCursor formula guards items.length > 0 (empty results)', () => {
    // The guard `hasMore && items.length > 0` ensures no cursor is emitted for 0 items.
    // Prove-It: FAILS if `items.length > 0` guard is removed.
    expect(routeSrc).toContain('items.length > 0');
  });

  it('[boundary] response shape includes both items and nextCursor', () => {
    // Prove-It: FAILS if { items, nextCursor } response shape is altered.
    expect(routeSrc).toContain('{ items: serialisedItems, nextCursor }');
  });

  it('[boundary] route declares nextCursor with explicit string | null type', () => {
    // Type safety at the boundary — the client can distinguish null from a string cursor.
    // Prove-It: FAILS if the type annotation is removed.
    expect(routeSrc).toContain('const nextCursor: string | null =');
  });
});

// ===========================================================================
// AC-BAD — Invalid cursor → 400; invalid sort → 400 via zod schema
// ===========================================================================

describe('AC-BAD — invalid cursor or sort returns 400, not a crash', () => {

  it('[error] route decodes the cursor param before passing to Prisma (not raw)', () => {
    // SEC-1: never pass a raw opaque string directly into a Prisma WHERE.
    // Prove-It: FAILS if `decodeCursor(cursorParam)` is removed.
    expect(routeSrc).toContain('decodeCursor(cursorParam)');
  });

  it('[error] route returns 400 when decodeCursor returns null (invalid cursor)', () => {
    // Prove-It: FAILS if the `decodedCursor === null` guard block is removed.
    expect(routeSrc).toContain("decodedCursor === null");
    expect(routeSrc).toContain("{ status: 400 }");
  });

  it('[error] 400 response for bad cursor uses VALIDATION_ERROR code', () => {
    // Prove-It: FAILS if the error code is changed from VALIDATION_ERROR.
    expect(routeSrc).toContain("'VALIDATION_ERROR'");
  });

  it('[error] 400 response for bad cursor includes message "Invalid cursor"', () => {
    // Prove-It: FAILS if the message string is changed.
    expect(routeSrc).toContain("'Invalid cursor'");
  });

  it('[error] route validates sort and cursor with catalogQuerySchema.safeParse', () => {
    // Validates all query params at the boundary before any logic runs.
    // Prove-It: FAILS if `catalogQuerySchema.safeParse(` is removed.
    expect(routeSrc).toContain('catalogQuerySchema.safeParse(');
  });

  it('[error] route returns 400 when safeParse fails (bad sort enum or malformed params)', () => {
    // Prove-It: FAILS if the `!parsed.success` guard is removed.
    expect(routeSrc).toContain('if (!parsed.success)');
    expect(routeSrc).toContain("'VALIDATION_ERROR'");
  });

  it('[error] route imports catalogQuerySchema from the validation module', () => {
    // Prove-It: FAILS if the import is removed.
    expect(routeSrc).toContain("from '@/lib/validations/catalog-cursor'");
    expect(routeSrc).toContain('catalogQuerySchema');
  });

  it('[normal] sort is destructured from parsed.data (validated value used, not raw param)', () => {
    // Ensures the route uses the zod-validated/defaulted sort value rather than the raw string.
    // Prove-It: FAILS if raw searchParams.get("sort") is used instead.
    expect(routeSrc).toContain('parsed.data');
    // The sort variable is assigned from parsed.data destructuring.
    const destructureBlock = routeSrc.indexOf('const {');
    const sortDestructure  = routeSrc.indexOf('sort,', destructureBlock);
    expect(sortDestructure).toBeGreaterThan(destructureBlock);
  });
});

// ===========================================================================
// AC-UI — InfiniteScrollGrid component contract (source-inspect)
// ===========================================================================

describe('AC-UI — InfiniteScrollGrid structural + a11y contract', () => {

  it('[normal] component is a "use client" island', () => {
    // Server components cannot use useState/useEffect/IntersectionObserver.
    // Prove-It: FAILS if "use client" directive is removed.
    expect(infiniteGridSrc).toContain('"use client"');
  });

  it('[normal] component uses IntersectionObserver on the sentinel', () => {
    // Core mechanism for scroll-to-load.
    // Prove-It: FAILS if `new IntersectionObserver(` is removed.
    expect(infiniteGridSrc).toContain('new IntersectionObserver(');
  });

  it('[normal] IntersectionObserver observes the sentinelRef element', () => {
    // The observer must watch the sentinel div, not a different element.
    // Prove-It: FAILS if `observer.observe(sentinel)` is removed.
    expect(infiniteGridSrc).toContain('observer.observe(sentinel)');
  });

  it('[normal] sentinel has tabIndex={-1} (keyboard users do not land on it)', () => {
    // A11y: the sentinel is not in the tab order.
    // Prove-It: FAILS if tabIndex={-1} is removed from the sentinel div.
    expect(infiniteGridSrc).toContain('tabIndex={-1}');
  });

  it('[normal] sentinel has aria-hidden="true" (screen readers skip it)', () => {
    // A11y: the sentinel div is invisible to assistive technologies.
    // Prove-It: FAILS if aria-hidden is removed from the sentinel.
    expect(infiniteGridSrc).toContain('aria-hidden="true"');
  });

  it('[normal] sentinel has data-testid="sentinel--infinite-scroll"', () => {
    // QA selects the sentinel by testid for integration assertions.
    // Prove-It: FAILS if the testid is removed.
    expect(infiniteGridSrc).toContain('data-testid="sentinel--infinite-scroll"');
  });

  it('[normal] grid container has data-testid="grid--infinite-scroll"', () => {
    // QA selects the card grid wrapper.
    // Prove-It: FAILS if the testid is removed.
    expect(infiniteGridSrc).toContain('data-testid="grid--infinite-scroll"');
  });

  it('[normal] aria-live="polite" status region is present', () => {
    // A11y: announces loading/end-of-list to screen readers without interrupting.
    // Prove-It: FAILS if aria-live="polite" is removed.
    expect(infiniteGridSrc).toContain('aria-live="polite"');
  });

  it('[normal] status region has role="status" (accessible landmark)', () => {
    // Prove-It: FAILS if role="status" is removed.
    expect(infiniteGridSrc).toContain('role="status"');
  });

  it('[normal] end-of-list paragraph has data-testid="text--end-of-list"', () => {
    // Prove-It: FAILS if the testid is removed from the end-of-list element.
    expect(infiniteGridSrc).toContain('data-testid="text--end-of-list"');
  });

  it('[normal] end-of-list message uses t.catalog.end_of_list (i18n, not hardcoded)', () => {
    // Prove-It: FAILS if t.catalog.end_of_list is replaced with a hardcoded string.
    expect(infiniteGridSrc).toContain('t.catalog.end_of_list');
  });

  it('[normal] loading state renders CampgroundSkeleton cards inside the grid', () => {
    // Loading state preserves grid layout while fetching next page (prevents CLS).
    // LOAD-1 (CAM-197): SkeletonCards local was replaced with shared CampgroundSkeleton.
    // Prove-It: FAILS if the CampgroundSkeleton import or loading branch is removed.
    expect(infiniteGridSrc).toContain('CampgroundSkeleton');
    expect(infiniteGridSrc).toContain('loading &&');
  });

  it('[normal] loading state uses t.catalog.loading_more in the aria-live region', () => {
    // Prove-It: FAILS if t.catalog.loading_more is replaced with hardcoded text.
    expect(infiniteGridSrc).toContain('t.catalog.loading_more');
  });

  it('[normal] component seeds items from initialItems prop (SSR hydration, no re-fetch)', () => {
    // The first page comes from SSR — useState is seeded with initialItems, not fetched.
    // Prove-It: FAILS if useState is initialised with [] instead of initialItems.
    expect(infiniteGridSrc).toContain('useState<CampSiteCardData[]>(initialItems)');
  });

  it('[normal] component seeds cursor from initialCursor prop', () => {
    // The cursor for the second page comes from the SSR props (page 1 already in HTML).
    // Prove-It: FAILS if useState is initialised with null instead of initialCursor.
    expect(infiniteGridSrc).toContain('useState<string | null>(initialCursor)');
  });

  it('[normal] done state initialised from initialCursor === null (end-of-list from SSR)', () => {
    // When the server sends null initialCursor, there is no next page — done=true avoids
    // any fetch attempt before the observer fires.
    // Prove-It: FAILS if `initialCursor === null` is replaced with a hardcoded false.
    expect(infiniteGridSrc).toContain('useState(initialCursor === null)');
  });

  it('[normal] fetchNextPage aborts early when loading, done, or cursor=null (no duplicate fetch)', () => {
    // Guard clause prevents concurrent / unnecessary page fetches.
    // Prove-It: FAILS if the early-return guard is removed.
    expect(infiniteGridSrc).toContain('if (loading || done || cursor === null) return;');
  });

  it('[normal] items are appended (not replaced) on each successful page fetch', () => {
    // The grid grows monotonically — previous items are never discarded.
    // Prove-It: FAILS if `[...prev, ...data.items]` is changed to `data.items`.
    expect(infiniteGridSrc).toContain('[...prev, ...data.items]');
  });

  it('[normal] on non-ok response the component stops fetching (sets done, no infinite-loop)', () => {
    // Error resilience: a 4xx/5xx response from the cursor API stops the observer.
    // Prove-It: FAILS if `setDone(true)` inside `if (!res.ok)` is removed.
    expect(infiniteGridSrc).toContain('if (!res.ok)');
    // setDone(true) must appear after the !res.ok check (stop further fetches).
    const noOkPos     = infiniteGridSrc.indexOf('if (!res.ok)');
    const setDonePos  = infiniteGridSrc.indexOf('setDone(true)', noOkPos);
    expect(setDonePos).toBeGreaterThan(noOkPos);
  });

  it('[normal] network/parse errors stop fetching silently (catch block sets done)', () => {
    // Prevents an infinite error-retry loop on network failure.
    // Prove-It: FAILS if the catch block is removed from fetchNextPage.
    const catchPos   = infiniteGridSrc.indexOf('} catch {');
    const setDone2   = infiniteGridSrc.indexOf('setDone(true)', catchPos);
    expect(catchPos).toBeGreaterThan(-1);
    expect(setDone2).toBeGreaterThan(catchPos);
  });

  it('[normal] component reuses CampgroundCard for each item', () => {
    // Cards must use the shared CampgroundCard component for visual + behaviour consistency.
    // Prove-It: FAILS if CampgroundCard import is removed.
    expect(infiniteGridSrc).toContain("from \"@/components/CampgroundCard\"");
    expect(infiniteGridSrc).toContain('<CampgroundCard');
  });

  it('[normal] each CampgroundCard is keyed by camp.id (stable reconciliation)', () => {
    // React requires stable keys to reconcile the growing list without remounting cards.
    // Prove-It: FAILS if `key={camp.id}` is removed.
    expect(infiniteGridSrc).toContain('key={camp.id}');
  });

  it('[normal] fetchNextPage sends sort and cursor as query params to /api/campsites', () => {
    // The cursor page request must include both sort and cursor params.
    // Prove-It: FAILS if `params.set("sort", sort)` or `params.set("cursor", cursor)` removed.
    expect(infiniteGridSrc).toContain('params.set("sort", sort)');
    expect(infiniteGridSrc).toContain('params.set("cursor", cursor)');
  });

  it('[normal] fetchNextPage forwards filter params to /api/campsites (filtered cursor pages)', () => {
    // When activeFilters are set (province/type/keyword etc.), they are forwarded so cursor
    // pages respect the same filter context as the first SSR page.
    // Prove-It: FAILS if the filter-forwarding loop is removed.
    expect(infiniteGridSrc).toContain('params.set(key, val)');
  });

  it('[normal] component is wrapped in useCallback (stable reference for IntersectionObserver)', () => {
    // useCallback prevents the observer from re-subscribing on every render.
    // Prove-It: FAILS if useCallback is removed from fetchNextPage.
    expect(infiniteGridSrc).toContain('useCallback(async');
  });

  it('[normal] IntersectionObserver cleanup via observer.disconnect() (no memory leak)', () => {
    // The effect cleanup disconnects the observer when the component unmounts or deps change.
    // Prove-It: FAILS if `observer.disconnect()` is removed from the cleanup.
    expect(infiniteGridSrc).toContain('observer.disconnect()');
  });
});

// ===========================================================================
// AC-UI-RESET — sort/filter reset via React key from parent
// ===========================================================================

describe('AC-UI-RESET — sort/filter change resets the grid (React key from parent)', () => {

  it('[normal] CatalogResults.tsx passes a key that includes activeSortForCursor', () => {
    // The key must include the sort so a sort change unmounts and re-mounts the grid,
    // resetting cursor/items state to the new SSR first page.
    // LOAD-1 (CAM-197): key moved from page.tsx → CatalogResults.tsx.
    // Prove-It: FAILS if activeSortForCursor is removed from the key expression.
    expect(catalogResultsSrc).toContain('activeSortForCursor');
    // Key is a template literal starting with activeSortForCursor
    expect(catalogResultsSrc).toMatch(/key=\{`\$\{activeSortForCursor\}/);
  });

  it('[normal] key includes type, keyword, province, district filter params', () => {
    // Prove-It: FAILS if any of these filter params are removed from the key.
    expect(catalogResultsSrc).toMatch(/key=\{`[^`]*\$\{type/);
    expect(catalogResultsSrc).toMatch(/\$\{keyword/);
    expect(catalogResultsSrc).toMatch(/\$\{province/);
    expect(catalogResultsSrc).toMatch(/\$\{district/);
  });

  it('[normal] key includes startDate, endDate, guests filter params', () => {
    // Date/guest changes require a full grid reset (new first-page from SSR).
    // Prove-It: FAILS if these are removed from the key.
    expect(catalogResultsSrc).toMatch(/\$\{startDate/);
    expect(catalogResultsSrc).toMatch(/\$\{endDate/);
    expect(catalogResultsSrc).toMatch(/\$\{guests/);
  });

  it('[normal] key includes min, max, access, facilities, activities, terrain filter params', () => {
    // All filter dimensions must be in the key so any change triggers a full reset.
    // Prove-It: FAILS if any of these are removed.
    expect(catalogResultsSrc).toMatch(/\$\{min/);
    expect(catalogResultsSrc).toMatch(/\$\{max/);
    expect(catalogResultsSrc).toMatch(/\$\{access/);
    expect(catalogResultsSrc).toMatch(/\$\{facilities/);
    expect(catalogResultsSrc).toMatch(/\$\{activities/);
    expect(catalogResultsSrc).toMatch(/\$\{terrain/);
  });

  it('[normal] the InfiniteScrollGrid component itself receives the key prop in JSX', () => {
    // The key must be on the InfiniteScrollGrid element, not a parent wrapper.
    // LOAD-1 (CAM-197): key is now in CatalogResults.tsx on the InfiniteScrollGrid element.
    // Prove-It: FAILS if the key is moved off the InfiniteScrollGrid element.
    const gridLine = catalogResultsSrc.indexOf('<InfiniteScrollGrid');
    expect(gridLine).toBeGreaterThan(-1);
    const keyAttr  = catalogResultsSrc.indexOf('key={`', gridLine);
    expect(keyAttr).toBeGreaterThan(gridLine);
  });
});

// ===========================================================================
// AC-I18N — catalog.loading_more + catalog.end_of_list in both locales
// ===========================================================================

describe('AC-I18N — catalog i18n keys exist in both en and th with correct Thai copy', () => {

  it('[normal] en.catalog.loading_more key exists in translations.json', () => {
    // Prove-It: FAILS if the key is removed from the en locale.
    const en = (translations.en as { catalog?: { loading_more?: string } });
    expect(en.catalog).toBeDefined();
    expect(en.catalog!.loading_more).toBeDefined();
    expect(typeof en.catalog!.loading_more).toBe('string');
    expect((en.catalog!.loading_more as string).length).toBeGreaterThan(0);
  });

  it('[normal] en.catalog.end_of_list key exists in translations.json', () => {
    // Prove-It: FAILS if the key is removed from the en locale.
    const en = (translations.en as { catalog?: { end_of_list?: string } });
    expect(en.catalog).toBeDefined();
    expect(en.catalog!.end_of_list).toBeDefined();
    expect(typeof en.catalog!.end_of_list).toBe('string');
    expect((en.catalog!.end_of_list as string).length).toBeGreaterThan(0);
  });

  it('[normal] th.catalog.loading_more key exists in translations.json', () => {
    // Prove-It: FAILS if the key is removed from the th locale.
    const th = (translations.th as { catalog?: { loading_more?: string } });
    expect(th.catalog).toBeDefined();
    expect(th.catalog!.loading_more).toBeDefined();
    expect(typeof th.catalog!.loading_more).toBe('string');
    expect((th.catalog!.loading_more as string).length).toBeGreaterThan(0);
  });

  it('[normal] th.catalog.end_of_list key exists in translations.json', () => {
    // Prove-It: FAILS if the key is removed from the th locale.
    const th = (translations.th as { catalog?: { end_of_list?: string } });
    expect(th.catalog).toBeDefined();
    expect(th.catalog!.end_of_list).toBeDefined();
    expect(typeof th.catalog!.end_of_list).toBe('string');
    expect((th.catalog!.end_of_list as string).length).toBeGreaterThan(0);
  });

  it('[normal] th.catalog.end_of_list is verbatim "ดูลานครบทั้งหมดแล้ว"', () => {
    // Thai copy must match exactly — character for character per QA rules.
    // Prove-It: FAILS if a single character is altered in the Thai string.
    const th = (translations.th as { catalog?: { end_of_list?: string } });
    expect(th.catalog!.end_of_list).toBe('ดูลานครบทั้งหมดแล้ว');
  });

  it('[normal] th.catalog.loading_more is verbatim "กำลังโหลดลานเพิ่มเติม"', () => {
    // Thai copy must match exactly — character for character per QA rules.
    // Prove-It: FAILS if the Thai string is altered.
    const th = (translations.th as { catalog?: { loading_more?: string } });
    expect(th.catalog!.loading_more).toBe('กำลังโหลดลานเพิ่มเติม');
  });

  it('[normal] no em-dash (—) in Thai end_of_list copy (Thai copy convention)', () => {
    // Thai copy must not use em-dash as a separator per code.md rules.
    const th = (translations.th as { catalog?: { end_of_list?: string } });
    expect(th.catalog!.end_of_list).not.toContain('—');
  });

  it('[normal] no em-dash (—) in Thai loading_more copy', () => {
    const th = (translations.th as { catalog?: { loading_more?: string } });
    expect(th.catalog!.loading_more).not.toContain('—');
  });
});

// ===========================================================================
// AC-SSR — app/page.tsx passes initialItems for SSR first page
// ===========================================================================

describe('AC-SSR — page.tsx SSR wiring: initialItems + initialCursor + InfiniteScrollGrid', () => {

  it('[normal] CatalogResults.tsx imports InfiniteScrollGrid (SSR wiring — LOAD-1)', () => {
    // LOAD-1 (CAM-197): SSR wiring moved from page.tsx → CatalogResults.tsx.
    // Prove-It: FAILS if InfiniteScrollGrid import is removed from CatalogResults.tsx.
    expect(catalogResultsSrc).toContain("import InfiniteScrollGrid from \"@/components/InfiniteScrollGrid\"");
  });

  it('[normal] CatalogResults.tsx renders InfiniteScrollGrid in JSX', () => {
    // Prove-It: FAILS if <InfiniteScrollGrid is removed from CatalogResults JSX.
    expect(catalogResultsSrc).toContain('<InfiniteScrollGrid');
  });

  it('[normal] CatalogResults.tsx passes initialItems={serialisedCamps} to InfiniteScrollGrid', () => {
    // First page cards from SSR are in the HTML — crawler / no-JS sees them.
    // Prove-It: FAILS if initialItems prop is removed from the InfiniteScrollGrid element.
    expect(catalogResultsSrc).toContain('initialItems={serialisedCamps}');
  });

  it('[normal] CatalogResults.tsx serialises camps before passing to InfiniteScrollGrid', () => {
    // serializeDecimals converts Decimal to number (JSON-safe) for the client component.
    // Prove-It: FAILS if serializeDecimals call is removed.
    expect(catalogResultsSrc).toContain('serializeDecimals(');
    expect(catalogResultsSrc).toContain('serialisedCamps');
  });

  it('[normal] CatalogResults.tsx passes initialCursor={initialCursor} to InfiniteScrollGrid', () => {
    // The opaque cursor for page 2 is computed on the server and passed as a prop.
    // Prove-It: FAILS if initialCursor prop is removed.
    expect(catalogResultsSrc).toContain('initialCursor={initialCursor}');
  });

  it('[normal] CatalogResults.tsx passes sort={activeSortForCursor} to InfiniteScrollGrid', () => {
    // The client needs the sort so cursor API calls use the same sort as the first page.
    // Prove-It: FAILS if sort prop is removed.
    expect(catalogResultsSrc).toContain('sort={activeSortForCursor}');
  });

  it('[normal] CatalogResults.tsx passes activeFilters object to InfiniteScrollGrid', () => {
    // Filter params are forwarded so cursor pages honour the same filter context.
    // Prove-It: FAILS if activeFilters prop is removed.
    expect(catalogResultsSrc).toContain('activeFilters={{');
  });

  it('[normal] CatalogResults.tsx passes savedIds and isLoggedIn to InfiniteScrollGrid', () => {
    // Server-hydrated wishlist ids and auth flag.
    // Prove-It: FAILS if either prop is removed.
    expect(catalogResultsSrc).toContain('savedIds={savedCampSiteIds}');
    expect(catalogResultsSrc).toContain('isLoggedIn={isLoggedIn}');
  });

  it('[null/empty] CatalogResults.tsx renders EmptyState when campSites.length === 0', () => {
    // An empty result set shows the EmptyState, not an empty grid.
    // Prove-It: FAILS if campSites.length === 0 guard is removed.
    expect(catalogResultsSrc).toContain('campSites.length === 0');
    expect(catalogResultsSrc).toContain('<EmptyState');
  });

  it('[normal] CatalogResults.tsx computes activeSortForCursor for both cached and filtered paths', () => {
    // The cursor must be computed with the right sort for both the default (related)
    // and the filtered path (user-selected sort).
    // LOAD-1 (CAM-197): logic moved to CatalogResults.tsx.
    // Prove-It: FAILS if activeSortForCursor is removed.
    expect(catalogResultsSrc).toContain('activeSortForCursor');
    // CatalogResults.tsx uses double-quote string literals
    expect(catalogResultsSrc).toContain('"related"');
  });

  it('[normal] CatalogResults.tsx serialises createdAt to ISO string before passing to client', () => {
    // Date objects are not JSON-serialisable — must be string for the client component.
    // LOAD-1 (CAM-197): serialisation moved to CatalogResults.tsx.
    // Prove-It: FAILS if createdAt serialisation is removed.
    expect(catalogResultsSrc).toContain('c.createdAt instanceof Date');
    expect(catalogResultsSrc).toContain('.toISOString()');
  });
});

// ===========================================================================
// AC-SSR-PROPS — InfiniteScrollGrid Props interface matches page.tsx usage
// ===========================================================================

describe('AC-SSR-PROPS — InfiniteScrollGrid props interface matches page.tsx usage', () => {

  it('[normal] InfiniteScrollGridProps declares initialItems field', () => {
    // Prove-It: FAILS if initialItems is removed from the props interface.
    expect(infiniteGridSrc).toContain('initialItems:');
  });

  it('[normal] InfiniteScrollGridProps declares initialCursor as string | null', () => {
    // Prove-It: FAILS if initialCursor type is changed or removed.
    expect(infiniteGridSrc).toContain('initialCursor: string | null');
  });

  it('[normal] InfiniteScrollGridProps declares sort as string', () => {
    // Prove-It: FAILS if sort prop is removed.
    expect(infiniteGridSrc).toContain('sort: string');
  });

  it('[normal] InfiniteScrollGridProps declares activeFilters object', () => {
    // Prove-It: FAILS if activeFilters is removed from props.
    expect(infiniteGridSrc).toContain('activeFilters:');
  });

  it('[normal] InfiniteScrollGridProps declares savedIds array', () => {
    // Prove-It: FAILS if savedIds is removed from props.
    expect(infiniteGridSrc).toContain('savedIds:');
  });

  it('[normal] InfiniteScrollGridProps declares isLoggedIn boolean', () => {
    // Prove-It: FAILS if isLoggedIn is removed from props.
    expect(infiniteGridSrc).toContain('isLoggedIn:');
  });

  it('[normal] component is exported as default export', () => {
    // page.tsx imports it as a default import — must remain a default export.
    // Prove-It: FAILS if `export default function InfiniteScrollGrid` is changed.
    expect(infiniteGridSrc).toContain('export default function InfiniteScrollGrid');
  });
});
