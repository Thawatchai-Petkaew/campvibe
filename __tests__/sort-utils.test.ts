/**
 * sort-utils.test.ts — unit tests for lib/sort-utils.ts (CAM-76)
 *
 * AC coverage matrix (every row in the AC table → at least one test):
 *   AC-3  sanitize allowlist in app/page.tsx — source-inspection
 *   AC-4  DB error → silent empty list (source-inspection; no error message added)
 *   AC-5  URL ?sort=rating deep-link (source-inspection; SSR path present)
 *   Rule  computeAvgRating: normal, single, empty → null, boundary 1–5
 *   Rule  reviews include uses deletedAt: null (source-inspection)
 *   Rule  reviews array stripped before forwarding to grid (source-inspection)
 *
 * CAM-527: AC-1/AC-2 and the sortByRating unit-test block were removed —
 * sortByRating (+ its WithReviewRatings generic) was dead code (no caller;
 * the in-memory rating sort was replaced by a DB `orderBy avgRating` in
 * PERF-5/CAM-193) and was deleted from lib/sort-utils.ts. The rating-order
 * behavior it used to prove is now proven at the DB layer — see
 * __tests__/cam-193-perf5-db-rating-sort.test.ts AC-2 (orderBy avgRating,
 * nulls:"last") and __tests__/cam-196-keyset-cursor.test.ts.
 *
 * Layers:
 *   - computeAvgRating → unit (pure function, no DB)
 *   - app/page.tsx logic → source-inspection tests
 *     (page.tsx is an async Next.js Server Component that calls prisma, auth(),
 *      and returns JSX. Running it in vitest/jsdom requires mocking Next.js
 *      internals, prisma, next-auth, and every imported UI component. The
 *      pattern is established by CAM-79 review-summary.test.ts §AC-5/AC-6;
 *      source-inspection is the correct layer for Server Component conditionals.)
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal · null/empty · boundary (min/max/0) · error/validation · ordering
 *
 * Prove-It note: every key test was verified to FAIL when the logic is broken
 * and to PASS with the real implementation. See inline comments.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { computeAvgRating } from '@/lib/sort-utils';

// ---------------------------------------------------------------------------
// computeAvgRating
// ---------------------------------------------------------------------------
describe('computeAvgRating', () => {
  // normal — average of multiple reviews
  it('[normal] returns average of multiple ratings (AC-1 Rule: AVG of Review.rating)', () => {
    // Prove-It: without `sum / reviews.length` this would NOT equal 3
    expect(computeAvgRating([{ rating: 1 }, { rating: 2 }, { rating: 4 }, { rating: 5 }])).toBe(3);
  });

  it('[normal] returns exact average for uneven division', () => {
    // 5 + 4 + 3 = 12, 12/3 = 4
    expect(computeAvgRating([{ rating: 5 }, { rating: 4 }, { rating: 3 }])).toBe(4);
  });

  it('[normal] returns fractional average (not rounded by this function)', () => {
    // 5 + 4 = 9, 9/2 = 4.5
    expect(computeAvgRating([{ rating: 5 }, { rating: 4 }])).toBe(4.5);
  });

  // single review
  it('[normal] single review returns that rating unchanged', () => {
    expect(computeAvgRating([{ rating: 4 }])).toBe(4);
  });

  it('[boundary] single rating = 1 (minimum) returns 1', () => {
    expect(computeAvgRating([{ rating: 1 }])).toBe(1);
  });

  it('[boundary] single rating = 5 (maximum) returns 5', () => {
    expect(computeAvgRating([{ rating: 5 }])).toBe(5);
  });

  // null/empty — the NULLS LAST contract depends on this returning null
  it('[null/empty] empty array → null (AC-2 Rule: no reviews = null, not 0)', () => {
    // Prove-It: if this returned 0 instead of null, the NULLS-LAST comparator would
    // treat no-review camps as having avg 0 and sort them to LAST only accidentally.
    // The comparator checks `=== null`, so this MUST return null.
    expect(computeAvgRating([])).toBeNull();
  });

  // boundary — all same rating
  it('[boundary] all ratings equal → average equals that rating (no drift)', () => {
    expect(computeAvgRating([{ rating: 3 }, { rating: 3 }, { rating: 3 }])).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Source-inspection — app/page.tsx
//
// Layer note: app/page.tsx is an async Next.js Server Component that calls
// prisma, auth(), and renders JSX. Rendering it inside vitest/jsdom requires
// mocking Next.js server internals, prisma, next-auth, and 10+ UI components.
// Per the precedent in CAM-79 (review-summary.test.ts §AC-5/AC-6) and
// .claude/rules/qa.md §6 ("mock only the external boundary"), source-inspection
// is the correct layer for Server Component conditionals.
// ---------------------------------------------------------------------------
describe('Source-inspection — CatalogResults.tsx (CAM-76 implementation checks + LOAD-1 CAM-197)', () => {
  // LOAD-1 (CAM-197): data-fetch logic moved from page.tsx → CatalogResults.tsx.
  const catalogResultsSrc = fs.readFileSync(
    path.join(process.cwd(), 'components/CatalogResults.tsx'),
    'utf-8'
  );

  // AC-3 / Rule §5 — sanitize allowlist: unknown/undefined sort → 'related'
  it('[source] VALID_SORT allowlist contains exactly the 4 documented values', () => {
    // Prove-It: if 'rating' were missing from the allowlist, sort=rating would
    // fall back to 'related' and the campsite order would never change.
    // CatalogResults.tsx uses double-quote string literals.
    expect(catalogResultsSrc).toContain('"related"');
    expect(catalogResultsSrc).toContain('"price_asc"');
    expect(catalogResultsSrc).toContain('"price_desc"');
    expect(catalogResultsSrc).toContain('"rating"');
    // The constant is named VALID_SORT
    expect(catalogResultsSrc).toContain('VALID_SORT');
  });

  it('[source] unknown sort value falls back to "related" (AC-3 / Rule §5)', () => {
    // The sanitization expression must assign 'related' as the fallback
    expect(catalogResultsSrc).toContain(': "related"');
  });

  it('[source] sort param is sanitized via VALID_SORT.includes() before any branch (AC-3 security)', () => {
    // Ensures the raw `sort` string from searchParams never reaches a Prisma field directly
    expect(catalogResultsSrc).toContain('VALID_SORT');
    expect(catalogResultsSrc).toContain('includes(sort');
  });

  // AC-1 — rating branch reuses buildCampSiteWhere (filter-compat)
  it('[source] rating branch uses buildCampSiteWhere result (filter-compat with province/keyword etc.)', () => {
    // The `where` variable (produced by buildCampSiteWhere) must be passed inside
    // the rating branch's findMany call — not a separate, filter-less query.
    // LOAD-1 (CAM-197): logic in CatalogResults.tsx.
    expect(catalogResultsSrc).toContain('buildCampSiteWhere');
    expect(catalogResultsSrc).toContain('where,');
  });

  // Rule — soft-delete: PERF-5 (CAM-193) — deletedAt filter now lives in app/wishlist/page.tsx (reviews select)
  it('[source] soft-delete filter (deletedAt: null) exists in wishlist page reviews select (not campCardSelect)', () => {
    // PERF-5 (CAM-193): campCardSelect no longer selects reviews, so deletedAt filter is only
    // in app/wishlist/page.tsx which still uses a bespoke reviews select.
    const wishlistSrc = fs.readFileSync(
      path.join(process.cwd(), 'app/wishlist/page.tsx'),
      'utf-8'
    );
    expect(wishlistSrc).toContain('deletedAt: null');
  });

  // Rule — PERF-5: no reviews array (columns deliver avgRating/reviewCount)
  it('[source] CatalogResults.tsx does NOT contain reviews strip pattern (PERF-5: no reviews to strip)', () => {
    // PERF-5 (CAM-193): avgRating/reviewCount come from stored columns; no reviews fetch in campCardSelect.
    // LOAD-1 (CAM-197): logic in CatalogResults.tsx.
    expect(catalogResultsSrc).not.toContain('_reviews');
    // campSites assignment still present
    expect(catalogResultsSrc).toContain('campSites =');
  });

  // AC-4 — DB error → silent empty list (no user-facing error message)
  it('[source] DB error falls back to empty array, no new user-facing error message (AC-4)', () => {
    // The catch block assigns campSites = [] (silent empty list per AC-4 and Rule §6)
    expect(catalogResultsSrc).toContain('campSites = []');
    // The catch block must use console.error (server-side log), not a user-facing throw
    expect(catalogResultsSrc).toContain('console.error');
  });

  // AC-5 — PERF-5 (CAM-193): deep link ?sort=rating now uses DB sort via avgRating column
  it('[source] sanitizedSort === "rating" triggers DB-level sort via avgRating orderBy (PERF-5)', () => {
    // PERF-5: the rating branch no longer calls sortByRating; orderBy uses avgRating column instead.
    // CatalogResults.tsx uses double-quote string literals.
    expect(catalogResultsSrc).toContain('sanitizedSort === "rating"');
    expect(catalogResultsSrc).toContain('avgRating');
    expect(catalogResultsSrc).not.toContain('sortByRating');
  });

  // Rule — CAM-527: sortByRating was removed from lib/sort-utils.ts (dead code, no
  // caller); this guard now just confirms CatalogResults.tsx never reintroduces an
  // in-memory sort-utils import for the rating branch (DB `orderBy avgRating` only).
  it('[source] CatalogResults.tsx does NOT import from sort-utils (rating sort stays DB-side)', () => {
    expect(catalogResultsSrc).not.toContain('sort-utils');
    expect(catalogResultsSrc).not.toContain('sortByRating');
  });
});
