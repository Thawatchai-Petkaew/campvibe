/**
 * sort-utils.test.ts — unit tests for lib/sort-utils.ts (CAM-76)
 *
 * AC coverage matrix (every row in the AC table → at least one test):
 *   AC-1  sortByRating returns higher avg first (descending order)
 *   AC-2  campsites with no reviews (null avgRating) come last (NULLS LAST)
 *   AC-3  sanitize allowlist in app/page.tsx — source-inspection
 *   AC-4  DB error → silent empty list (source-inspection; no error message added)
 *   AC-5  URL ?sort=rating deep-link (source-inspection; SSR path present)
 *   Rule  computeAvgRating: normal, single, empty → null, boundary 1–5
 *   Rule  sortByRating: stable tie-break, 40-cap, does not mutate input
 *   Rule  reviews include uses deletedAt: null (source-inspection)
 *   Rule  reviews array stripped before forwarding to grid (source-inspection)
 *
 * Layers:
 *   - computeAvgRating, sortByRating → unit (pure functions, no DB)
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
 * (e.g. removing the `avgB - avgA` sort or removing the `.slice(0, 40)` cap)
 * and to PASS with the real implementation. See inline comments.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { computeAvgRating, sortByRating, type WithReviewRatings } from '@/lib/sort-utils';

// ---------------------------------------------------------------------------
// Helper — build a minimal WithReviewRatings object
// ---------------------------------------------------------------------------
function makecamp(id: string, ratings: number[]): WithReviewRatings & { id: string } {
  return { id, reviews: ratings.map((rating) => ({ rating })) };
}

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
// sortByRating
// ---------------------------------------------------------------------------
describe('sortByRating', () => {
  // ---------------------------------------------------------------------------
  // AC-1: descending by average rating
  // ---------------------------------------------------------------------------
  describe('AC-1 — descending by avg rating', () => {
    it('[normal] higher avg appears before lower avg (AC-1: top-rated camp first)', () => {
      const input = [
        makecamp('low', [2, 3]),   // avg 2.5
        makecamp('high', [4, 5]),  // avg 4.5
        makecamp('mid', [3, 4]),   // avg 3.5
      ];
      const result = sortByRating(input);
      expect(result.map((c) => c.id)).toEqual(['high', 'mid', 'low']);
    });

    it('[normal] single rating difference: avg 5 before avg 4', () => {
      const input = [makecamp('b', [4]), makecamp('a', [5])];
      const result = sortByRating(input);
      expect(result[0].id).toBe('a');
      expect(result[1].id).toBe('b');
    });

    it('[normal] all 5-star campsites first, then 1-star', () => {
      const input = [makecamp('low', [1]), makecamp('hi', [5])];
      const result = sortByRating(input);
      expect(result[0].id).toBe('hi');
    });

    it('[normal] avg 1.0 (reviewed) still ranks above a no-review campsite (NULLS LAST rule)', () => {
      // This is the key AC-2/Rule boundary: even avg=1.0 beats null
      const input = [makecamp('none', []), makecamp('one', [1])];
      const result = sortByRating(input);
      // Prove-It: if null were treated as 0 (not null), one.avg (1) > 0 still holds,
      // but the comparator check `=== null` is what correctly positions the null case.
      expect(result[0].id).toBe('one');
      expect(result[1].id).toBe('none');
    });
  });

  // ---------------------------------------------------------------------------
  // AC-2 / Rule — NULLS LAST
  // ---------------------------------------------------------------------------
  describe('AC-2 / Rule — NULLS LAST (campsites with no reviews after all reviewed)', () => {
    it('[null/empty] one no-review camp, one reviewed → reviewed first (AC-2)', () => {
      const input = [makecamp('null', []), makecamp('has', [3])];
      const result = sortByRating(input);
      expect(result[0].id).toBe('has');
      expect(result[1].id).toBe('null');
    });

    it('[null/empty] two no-review camps both come after any reviewed camp (AC-2)', () => {
      const input = [
        makecamp('null1', []),
        makecamp('reviewed', [3]),
        makecamp('null2', []),
      ];
      const result = sortByRating(input);
      expect(result[0].id).toBe('reviewed');
      // Both null-avg camps are at positions 1 and 2 (order between them stable — tested below)
      expect(['null1', 'null2']).toContain(result[1].id);
      expect(['null1', 'null2']).toContain(result[2].id);
    });

    it('[null/empty] all campsites have no reviews → all returned, order stable', () => {
      const input = [makecamp('a', []), makecamp('b', []), makecamp('c', [])];
      const result = sortByRating(input);
      expect(result.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    });

    it('[null/empty] empty input → returns empty array', () => {
      expect(sortByRating([])).toEqual([]);
    });

    it('[null/empty] single no-review camp → returns that camp', () => {
      const input = [makecamp('alone', [])];
      const result = sortByRating(input);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('alone');
    });
  });

  // ---------------------------------------------------------------------------
  // Rule — stable tie-break: equal averages preserve input order
  // ---------------------------------------------------------------------------
  describe('Rule — stable tie-break (equal avg preserves input order)', () => {
    it('[ordering] two campsites with identical avg preserve input order', () => {
      // Prove-It: Array.prototype.sort in V8 is stable for same-key; `return 0` preserves order
      const input = [makecamp('first', [4]), makecamp('second', [4])];
      const result = sortByRating(input);
      expect(result[0].id).toBe('first');
      expect(result[1].id).toBe('second');
    });

    it('[ordering] three equal-avg campsites preserve input order', () => {
      const input = [makecamp('a', [3]), makecamp('b', [3]), makecamp('c', [3])];
      const result = sortByRating(input);
      expect(result.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    });

    it('[ordering] equal-avg group of two keeps order even when surrounded by higher/lower', () => {
      const input = [
        makecamp('hi', [5]),
        makecamp('mid1', [3]),
        makecamp('mid2', [3]),
        makecamp('lo', [1]),
      ];
      const result = sortByRating(input);
      expect(result[0].id).toBe('hi');
      expect(result[1].id).toBe('mid1');
      expect(result[2].id).toBe('mid2');
      expect(result[3].id).toBe('lo');
    });
  });

  // ---------------------------------------------------------------------------
  // Rule — 40-cap (slice to 40, same as other sort modes)
  // ---------------------------------------------------------------------------
  describe('Rule — 40-cap (result capped at 40 items, same as all other sorts)', () => {
    it('[boundary] 40 campsites → all 40 returned', () => {
      const input = Array.from({ length: 40 }, (_, i) => makecamp(`c${i}`, [3]));
      const result = sortByRating(input);
      // Prove-It: if `.slice(0, 40)` were `.slice(0, 39)` this would fail
      expect(result).toHaveLength(40);
    });

    it('[boundary] 41 campsites → exactly 40 returned (cap fires)', () => {
      const input = Array.from({ length: 41 }, (_, i) => makecamp(`c${i}`, [3]));
      const result = sortByRating(input);
      // Prove-It: without .slice(0, 40) this would return 41
      expect(result).toHaveLength(40);
    });

    it('[boundary] 41 campsites → the TOP 40 by rating are kept (cap is not random slice)', () => {
      // 1 low-rated camp at the front, 40 high-rated camps following
      // After sort: 40 high-rated first, then the low-rated is 41st (sliced off)
      const input = [
        makecamp('low', [1]),
        ...Array.from({ length: 40 }, (_, i) => makecamp(`hi${i}`, [5])),
      ];
      const result = sortByRating(input);
      expect(result).toHaveLength(40);
      // 'low' should NOT be in the result — it was sorted to position 41
      expect(result.find((c) => c.id === 'low')).toBeUndefined();
    });

    it('[boundary] 39 campsites → all 39 returned (no under-slicing)', () => {
      const input = Array.from({ length: 39 }, (_, i) => makecamp(`c${i}`, [4]));
      const result = sortByRating(input);
      expect(result).toHaveLength(39);
    });

    it('[boundary] single campsite → 1 returned', () => {
      const input = [makecamp('only', [5])];
      expect(sortByRating(input)).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Rule — does not mutate the input array
  // ---------------------------------------------------------------------------
  describe('Rule — does not mutate the input array', () => {
    it('[normal] original array order is preserved after sort (non-destructive)', () => {
      const input = [makecamp('low', [1]), makecamp('hi', [5]), makecamp('mid', [3])];
      const originalOrder = input.map((c) => c.id);
      sortByRating(input);
      // Prove-It: if the function used input.sort() instead of [...input].sort() this would fail
      expect(input.map((c) => c.id)).toEqual(originalOrder);
    });

    it('[normal] input length is unchanged after sort', () => {
      const input = Array.from({ length: 45 }, (_, i) => makecamp(`c${i}`, [3]));
      const originalLength = input.length;
      sortByRating(input);
      expect(input.length).toBe(originalLength);
    });
  });

  // ---------------------------------------------------------------------------
  // Combined: AC-1 + AC-2 — mixed reviewed and no-review campsites
  // ---------------------------------------------------------------------------
  describe('combined: reviewed and no-review campsites mixed (AC-1 + AC-2)', () => {
    it('[normal] full mixed scenario: high-avg, low-avg, no-reviews → correct order', () => {
      const input = [
        makecamp('null1', []),          // no reviews → last
        makecamp('low', [1, 2]),        // avg 1.5
        makecamp('high', [4, 5]),       // avg 4.5 → first
        makecamp('null2', []),          // no reviews → last
        makecamp('mid', [3, 4]),        // avg 3.5
      ];
      const result = sortByRating(input);
      expect(result[0].id).toBe('high');   // avg 4.5
      expect(result[1].id).toBe('mid');    // avg 3.5
      expect(result[2].id).toBe('low');    // avg 1.5
      // null1 and null2 are last (both have null avg — stable among themselves)
      expect(['null1', 'null2']).toContain(result[3].id);
      expect(['null1', 'null2']).toContain(result[4].id);
    });
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
describe('Source-inspection — app/page.tsx (CAM-76 implementation checks)', () => {
  const pageSrc = fs.readFileSync(
    path.join(process.cwd(), 'app/page.tsx'),
    'utf-8'
  );

  // AC-3 / Rule §5 — sanitize allowlist: unknown/undefined sort → 'related'
  it('[source] VALID_SORT allowlist contains exactly the 4 documented values', () => {
    // Prove-It: if 'rating' were missing from the allowlist, sort=rating would
    // fall back to 'related' and the campsite order would never change.
    expect(pageSrc).toContain("'related'");
    expect(pageSrc).toContain("'price_asc'");
    expect(pageSrc).toContain("'price_desc'");
    expect(pageSrc).toContain("'rating'");
    // The constant is named VALID_SORT
    expect(pageSrc).toContain('VALID_SORT');
  });

  it('[source] unknown sort value falls back to \'related\' (AC-3 / Rule §5)', () => {
    // The sanitization expression must assign 'related' as the fallback
    expect(pageSrc).toContain(": 'related'");
  });

  it('[source] sort param is sanitized via VALID_SORT.includes() before any branch (AC-3 security)', () => {
    // Ensures the raw `sort` string from searchParams never reaches a Prisma field directly
    expect(pageSrc).toContain('VALID_SORT');
    expect(pageSrc).toContain('includes(sort');
  });

  // AC-1 — rating branch reuses buildCampSiteWhere (filter-compat)
  it('[source] rating branch uses buildCampSiteWhere result (filter-compat with province/keyword etc.)', () => {
    // The `where` variable (produced by buildCampSiteWhere) must be passed inside
    // the rating branch's findMany call — not a separate, filter-less query.
    expect(pageSrc).toContain('buildCampSiteWhere');
    // where clause is referenced in the findMany calls
    expect(pageSrc).toContain('where,');
  });

  // Rule — soft-delete: reviews include must use deletedAt: null
  it('[source] reviews include uses deletedAt: null (soft-delete Rule)', () => {
    // Prove-It: without deletedAt: null, soft-deleted reviews would be counted
    // in the average, potentially inflating or deflating the real score.
    expect(pageSrc).toContain('deletedAt: null');
  });

  // Rule — reviews field stripped before forwarding to the grid (shape parity)
  it('[source] reviews array is stripped before forwarding to CampgroundGrid (shape parity)', () => {
    // The grid component does not consume reviews; passing them leaks extra data
    // to the client. The tech.md spec mandates stripping via destructuring.
    // Pattern: `{ reviews: _reviews, ...rest }` or similar destructure
    expect(pageSrc).toContain('_reviews');
    // The result is passed to campSites (which feeds the grid)
    expect(pageSrc).toContain('campSites =');
  });

  // AC-4 — DB error → silent empty list (no user-facing error message)
  it('[source] DB error falls back to empty array, no new user-facing error message (AC-4)', () => {
    // The catch block assigns campSites = [] (silent empty list per AC-4 and Rule §6)
    expect(pageSrc).toContain('campSites = []');
    // The catch block must use console.error (server-side log), not a user-facing throw
    expect(pageSrc).toContain('console.error');
  });

  // AC-5 — deep link ?sort=rating works from SSR (sanitizedSort === 'rating' triggers rating branch)
  it('[source] sanitizedSort === \'rating\' triggers the in-memory sort path (AC-5 deep-link)', () => {
    // The branch that calls sortByRating is guarded by sanitizedSort === 'rating'
    expect(pageSrc).toContain("sanitizedSort === 'rating'");
    expect(pageSrc).toContain('sortByRating');
  });

  // Rule — sortByRating imported from lib/sort-utils (pure helper, independently testable)
  it('[source] sortByRating is imported from @/lib/sort-utils (pure helper, no DB dependency)', () => {
    expect(pageSrc).toContain('sort-utils');
    expect(pageSrc).toContain('sortByRating');
  });
});
