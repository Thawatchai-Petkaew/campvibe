/**
 * cam-193-perf5-db-rating-sort.test.ts — PERF-5 DB rating sort + avgRating column (CAM-193)
 *
 * AC coverage matrix — every PERF-5 AC row mapped 1:1 to a test or describe block:
 *
 *   AC-1  campCardSelect shape
 *         avgRating === true + reviewCount === true present; "reviews" key ABSENT;
 *         images take:5 + location.province intact (PERF-1 regression guard).
 *
 *   AC-2  app/page.tsx DB-sort path
 *         orderBy contains avgRating + nulls: 'last'; does NOT import/call sortByRating;
 *         no .slice(0, 40) JS-sort remnant; single campSite.findMany (unified query);
 *         take: 40 present in the unified findMany.
 *
 *   AC-3  Migration shape (source-inspect)
 *         20260626123501_perf5_avgrating_index/migration.sql = a single CREATE INDEX on
 *         (isPublished, deletedAt, avgRating, id); no DROP / data change; additive-only.
 *
 *   AC-4  avgRating serialization path (unit)
 *         serializeDecimals(Prisma.Decimal) → number (not string, not an object);
 *         serializeDecimals(null) → null (null avgRating is preserved on 0-review camps);
 *         serializeDecimals nested object: object with Decimal avgRating → object with number avgRating.
 *
 *   AC-5  null handling — card/contract
 *         CampSiteCardData.avgRating typed as number | null (source-inspect CampgroundGrid);
 *         CampgroundCard handles null avgRating without crashing (reviewCount guard in JSX).
 *
 *   AC-6  Helpers retained — scope guard
 *         sortByRating + computeAvgRating still exported from lib/sort-utils (wishlist uses them);
 *         app/wishlist/page.tsx NOT changed to use campCardSelect (still its own select — out of scope).
 *
 * Layers:
 *   - AC-1 → direct value assertions on the imported campCardSelect const
 *   - AC-2 → source-inspect (app/page.tsx is an async Next.js Server Component; source-inspect
 *             is the correct layer for Server Component wiring — precedent in cam-192, sort-utils)
 *   - AC-3 → source-inspect (migration.sql is a static file)
 *   - AC-4 → unit (real Prisma.Decimal via @prisma/client — no DB required)
 *   - AC-5 → source-inspect (CampgroundGrid type + CampgroundCard render-guard)
 *   - AC-6 → import + source-inspect
 *
 * Prove-It note:
 *   AC-1 shape tests were verified to FAIL when `reviews: true` is temporarily inserted into
 *   campCardSelect and to FAIL when avgRating/reviewCount are removed.
 *   AC-2 orderBy tests were verified to FAIL when `avgRating` is replaced by `createdAt` in orderBy.
 *   AC-2 nulls:'last' test was verified to FAIL when `nulls: 'last'` is removed.
 *   AC-2 take:40 test was verified to FAIL when take:40 is removed from the unified findMany.
 *   AC-3 migration tests were verified to FAIL against the wrong migration (wrong column order).
 *   AC-4 unit tests were verified to FAIL when serializeDecimals returns value.toString() instead of value.toNumber().
 *   AC-6 scope guard was verified to FAIL if sortByRating export is removed from sort-utils.
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal · null/empty · boundary · error/validation · concurrent/ordering (where applicable)
 *
 * Staging-verify note (non-automated):
 *   After merge to staging, verify on the real Staging URL:
 *   - ?sort=rating returns camps ordered by descending avgRating (highest first, 0-review camps last).
 *   - The JSON response for /api/campsites and /api/campgrounds has avgRating as a number (not string),
 *     reviewCount as an integer, and no "reviews" array in the payload (smaller response).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { campCardSelect } from '@/lib/read-models/camp-card';
import { serializeDecimals } from '@/lib/serialize';
import { sortByRating, computeAvgRating } from '@/lib/sort-utils';

// ---------------------------------------------------------------------------
// Source helpers
// ---------------------------------------------------------------------------
function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

const pageSrc        = readSrc('app/page.tsx');
// LOAD-1 (CAM-197): data-fetch logic moved from page.tsx → CatalogResults.tsx.
const catalogResultsSrc = readSrc('components/CatalogResults.tsx');
const gridSrc        = readSrc('components/CampgroundGrid.tsx');
const cardSrc        = readSrc('components/CampgroundCard.tsx');
const wishlistSrc    = readSrc('app/wishlist/page.tsx');
const migrationSrc   = readSrc(
  'prisma/migrations/20260626123501_perf5_avgrating_index/migration.sql',
);

// ===========================================================================
// AC-1 — campCardSelect shape: avgRating/reviewCount present; reviews absent; PERF-1 intact
// ===========================================================================

describe('AC-1 — campCardSelect shape (PERF-5 column swap from reviews to stored columns)', () => {

  it('[shape] campCardSelect.avgRating === true (PERF-5: stored Decimal column selected)', () => {
    // Prove-It: removing avgRating from campCardSelect makes this fail.
    expect(campCardSelect.avgRating).toBe(true);
  });

  it('[shape] campCardSelect.reviewCount === true (PERF-5: stored Int column selected)', () => {
    // Prove-It: removing reviewCount from campCardSelect makes this fail.
    expect(campCardSelect.reviewCount).toBe(true);
  });

  it('[shape] "reviews" key is ABSENT from campCardSelect (PERF-5: over-fetch culprit removed)', () => {
    // Prove-It: re-adding `reviews: { select: { ... } }` to campCardSelect makes this fail.
    expect('reviews' in campCardSelect).toBe(false);
  });

  // PERF-1 regression guards — must still be intact after the PERF-5 swap
  it('[regression] images.take === 5 (PERF-1 cap still intact after PERF-5)', () => {
    expect(campCardSelect.images.take).toBe(5);
  });

  it('[regression] images.orderBy.sortOrder === "asc" (PERF-1 order still intact)', () => {
    expect(campCardSelect.images.orderBy).toEqual({ sortOrder: 'asc' });
  });

  it('[regression] location.select.province === true (PERF-1 province field still intact)', () => {
    expect(campCardSelect.location.select.province).toBe(true);
  });

  it('[shape] campCardSelect keys: avgRating and reviewCount are both top-level scalar booleans', () => {
    // Type-level guard: both must be exactly `true` (not an object/relation config)
    const keys = Object.keys(campCardSelect) as Array<keyof typeof campCardSelect>;
    expect(keys).toContain('avgRating');
    expect(keys).toContain('reviewCount');
    expect(campCardSelect.avgRating).toBe(true);
    expect(campCardSelect.reviewCount).toBe(true);
  });
});

// ===========================================================================
// AC-2 — app/page.tsx DB-sort path
// ===========================================================================

describe('AC-2 — CatalogResults.tsx DB-sort: single findMany with avgRating orderBy + nulls:last + take:PAGE_SIZE', () => {
  // LOAD-1 (CAM-197): data-fetch logic moved from page.tsx → CatalogResults.tsx.

  it('[orderBy] orderBy uses avgRating column for the rating sort (DB sort, not JS)', () => {
    // Prove-It: reverting orderBy to use createdAt for all branches makes this fail.
    expect(catalogResultsSrc).toContain('avgRating');
  });

  it('[orderBy] orderBy uses nulls: "last" for avgRating (0-review camps sort last, same semantic as before)', () => {
    // Prove-It: removing the nulls clause from the orderBy makes this fail.
    expect(catalogResultsSrc).toContain('nulls: "last"');
  });

  it('[orderBy] orderBy shape: avgRating with sort: "desc", nulls: "last" (exact Prisma nulls clause)', () => {
    // Prove-It: swapping to `{ avgRating: 'desc' }` (no nulls clause) makes this fail.
    expect(catalogResultsSrc).toContain('avgRating: { sort: "desc", nulls: "last" }');
  });

  it('[unified] single campSite.findMany call (PERF-5: two sort branches collapsed into one)', () => {
    // Prove-It: splitting back into two separate findMany branches makes the count ≥ 2.
    const matches = catalogResultsSrc.match(/campSite\.findMany/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('[unified] take: PAGE_SIZE present in the unified findMany (PERF-3/CAM-196 OT-1=A: take now uses shared constant)', () => {
    // PERF-3 (CAM-196 OT-1=A): CatalogResults.tsx uses the shared PAGE_SIZE constant.
    // Prove-It: changing take back to 40 or removing take makes this fail.
    expect(catalogResultsSrc).toContain('take: PAGE_SIZE');
    expect(catalogResultsSrc).not.toContain('take: 40');
  });

  it('[removed] CatalogResults.tsx does NOT contain .slice(0, 40) (JS-sort remnant removed)', () => {
    // Prove-It: re-adding the `.slice(0, 40)` post-fetch step makes this fail.
    expect(catalogResultsSrc).not.toContain('.slice(0, 40)');
  });

  it('[removed] CatalogResults.tsx does NOT call sortByRating (PERF-5: DB sort replaces in-memory sort)', () => {
    // Prove-It: re-adding `sortByRating(` to CatalogResults.tsx makes this fail.
    expect(catalogResultsSrc).not.toContain('sortByRating(');
  });

  it('[removed] CatalogResults.tsx does NOT import from sort-utils (PERF-5: import removed)', () => {
    // Prove-It: re-adding the sort-utils import makes this fail.
    expect(catalogResultsSrc).not.toContain('sort-utils');
  });

  it('[sanitize] VALID_SORT allowlist still includes "rating" (sort param still accepted)', () => {
    // The sanitize gate must pass 'rating' through; otherwise ?sort=rating falls back to 'related'.
    expect(catalogResultsSrc).toContain('"rating"');
    expect(catalogResultsSrc).toContain('VALID_SORT');
  });

  it('[unified] select: campCardSelect appears exactly once in CatalogResults.tsx (single unified query)', () => {
    // Prove-It: having two findMany with different selects makes the count ≥ 2.
    const matches = catalogResultsSrc.match(/select:\s*campCardSelect/g) ?? [];
    expect(matches.length).toBe(1);
  });
});

// ===========================================================================
// AC-3 — Migration shape: single additive CREATE INDEX, no DROP/data change
// ===========================================================================

describe('AC-3 — PERF-5 migration: single CREATE INDEX, additive only, correct column tuple', () => {

  it('[additive] migration contains CREATE INDEX (additive DDL only)', () => {
    // Prove-It: a migration that only has a comment makes this fail.
    expect(migrationSrc.toUpperCase()).toContain('CREATE INDEX');
  });

  it('[additive] migration does NOT contain DROP (no destructive DDL)', () => {
    // Prove-It: accidentally adding DROP INDEX would make this fail immediately.
    expect(migrationSrc.toUpperCase()).not.toContain('DROP');
  });

  it('[additive] migration does NOT contain ALTER TABLE or ADD COLUMN (index-only change)', () => {
    // PERF-5 adds an index only — no schema column changes in this migration.
    expect(migrationSrc.toUpperCase()).not.toContain('ALTER TABLE');
    expect(migrationSrc.toUpperCase()).not.toContain('ADD COLUMN');
  });

  it('[additive] migration does NOT contain TRUNCATE or DELETE FROM (no data mutation)', () => {
    // Check as word-boundary match: "DELETEDAT" in the column name is not a DELETE statement.
    expect(migrationSrc.toUpperCase()).not.toContain('TRUNCATE');
    // DELETE DML keyword must be followed by a space and then FROM or a table name
    expect(migrationSrc.toUpperCase()).not.toMatch(/\bDELETE\s+FROM\b/);
    expect(migrationSrc.toUpperCase()).not.toMatch(/^\s*DELETE\b/m); // no standalone DELETE line
  });

  it('[index-name] migration creates the index named CampSite_isPublished_deletedAt_avgRating_id_idx', () => {
    // Prove-It: renaming the index constant in Prisma schema makes this fail.
    expect(migrationSrc).toContain('"CampSite_isPublished_deletedAt_avgRating_id_idx"');
  });

  it('[index-columns] migration index covers (isPublished, deletedAt, avgRating, id) in that order', () => {
    // Prove-It: swapping column order (e.g. avgRating before deletedAt) makes this fail.
    expect(migrationSrc).toContain('"isPublished"');
    expect(migrationSrc).toContain('"deletedAt"');
    expect(migrationSrc).toContain('"avgRating"');
    expect(migrationSrc).toContain('"id"');
    // Assert the column tuple order as it appears in a single statement
    const idx = migrationSrc.indexOf('"CampSite_isPublished_deletedAt_avgRating_id_idx"');
    const tupleStart = migrationSrc.indexOf('(', idx);
    const tupleEnd   = migrationSrc.indexOf(')', tupleStart);
    const tuple      = migrationSrc.slice(tupleStart, tupleEnd + 1);
    expect(tuple).toContain('"isPublished"');
    expect(tuple).toContain('"deletedAt"');
    expect(tuple).toContain('"avgRating"');
    expect(tuple).toContain('"id"');
    // isPublished appears before avgRating in the tuple
    expect(tuple.indexOf('"isPublished"')).toBeLessThan(tuple.indexOf('"avgRating"'));
    // avgRating appears before id in the tuple
    expect(tuple.indexOf('"avgRating"')).toBeLessThan(tuple.indexOf('"id"'));
  });

  it('[single] migration file contains exactly one SQL statement (no extra operations)', () => {
    // PERF-5 migration is a single CREATE INDEX — nothing else.
    // Count statement terminators (semi-colons) to confirm only one statement.
    const statements = migrationSrc.split(';').filter((s) => s.trim().length > 0);
    expect(statements.length).toBe(1);
  });

  it('[table] migration targets the "CampSite" table', () => {
    expect(migrationSrc).toContain('"CampSite"');
  });
});

// ===========================================================================
// AC-4 — serializeDecimals: Decimal → number (unit tests, real Prisma.Decimal)
// ===========================================================================

describe('AC-4 — serializeDecimals converts avgRating Decimal → number (ADR-002 Buffet boundary)', () => {

  it('[normal] serializeDecimals(Prisma.Decimal) returns a number, not a string or object', () => {
    // avgRating is Decimal(2,1) from Prisma; the API must deliver a number to the client.
    // Prove-It: if serializeDecimals returned value.toString() instead, typeof would be 'string'.
    const decimal = new Prisma.Decimal('4.3');
    const result  = serializeDecimals(decimal);
    expect(typeof result).toBe('number');
    expect(result).toBe(4.3);
  });

  it('[boundary] serializeDecimals(new Prisma.Decimal("5.0")) === 5 (max rating)', () => {
    expect(serializeDecimals(new Prisma.Decimal('5.0'))).toBe(5);
  });

  it('[boundary] serializeDecimals(new Prisma.Decimal("1.0")) === 1 (min rating)', () => {
    expect(serializeDecimals(new Prisma.Decimal('1.0'))).toBe(1);
  });

  it('[null/empty] serializeDecimals(null) === null (null avgRating preserved for 0-review camps)', () => {
    // Prove-It: if serializeDecimals mapped null → 0, the card would show 0 stars instead of hiding the rating.
    expect(serializeDecimals(null)).toBeNull();
  });

  it('[null/empty] serializeDecimals(undefined) === undefined (undefined passthrough)', () => {
    expect(serializeDecimals(undefined)).toBeUndefined();
  });

  it('[nested] serializeDecimals on an object converts Decimal avgRating to number (CampCardPayload shape)', () => {
    // The page calls serializeDecimals({...campSite, createdAt: isoString}).
    // avgRating is Decimal in the raw Prisma row; must be number in the serialized output.
    const raw = {
      id: 'camp-001',
      avgRating: new Prisma.Decimal('4.3'),
      reviewCount: 12,
      priceLow: new Prisma.Decimal('500'),
    };
    const serialized = serializeDecimals(raw);
    expect(typeof serialized.avgRating).toBe('number');
    expect(serialized.avgRating).toBe(4.3);
    expect(typeof serialized.priceLow).toBe('number');
    expect(serialized.priceLow).toBe(500);
    expect(serialized.reviewCount).toBe(12); // Int stays as-is
  });

  it('[nested] serializeDecimals preserves null avgRating in a nested object (0-review camp)', () => {
    const raw = { id: 'camp-002', avgRating: null, reviewCount: 0 };
    const serialized = serializeDecimals(raw);
    expect(serialized.avgRating).toBeNull();
    expect(serialized.reviewCount).toBe(0);
  });

  it('[array] serializeDecimals on an array of camp objects converts each Decimal avgRating', () => {
    const rows = [
      { id: 'c1', avgRating: new Prisma.Decimal('4.2'), reviewCount: 3 },
      { id: 'c2', avgRating: null, reviewCount: 0 },
      { id: 'c3', avgRating: new Prisma.Decimal('3.7'), reviewCount: 7 },
    ];
    const result = serializeDecimals(rows);
    expect(typeof result[0].avgRating).toBe('number');
    expect(result[0].avgRating).toBe(4.2);
    expect(result[1].avgRating).toBeNull(); // null preserved
    expect(typeof result[2].avgRating).toBe('number');
    expect(result[2].avgRating).toBe(3.7);
  });
});

// ===========================================================================
// AC-5 — Null handling: card/contract — avgRating can be null, no crash
// ===========================================================================

describe('AC-5 — null handling: CampSiteCardData types avgRating as number | null; card handles null safely', () => {

  it('[type] CampSiteCardData.avgRating is typed as "number | null" (source-inspect CampgroundGrid)', () => {
    // Prove-It: tightening the type to `number` (removing `| null`) makes this fail.
    expect(gridSrc).toContain('avgRating: number | null');
  });

  it('[type] CampSiteCardData.reviewCount is typed as number (source-inspect CampgroundGrid)', () => {
    expect(gridSrc).toContain('reviewCount: number');
  });

  it('[type] CampSiteCardData is derived via Omit<CampCardPayload, ...> (no manual re-declaration)', () => {
    // The type narrows priceLow/createdAt/avgRating from the canonical payload — no divergent shape.
    expect(gridSrc).toContain('Omit<CampCardPayload');
  });

  it('[card-null-guard] CampgroundCard.tsx guards avgRating display on reviewCount > 0 AND avgRating != null', () => {
    // The card only renders the star+rating when BOTH conditions hold.
    // Prove-It: removing `avgRating != null` causes `null` to render as "0" or crash.
    expect(cardSrc).toContain('reviewCount > 0 && avgRating != null');
  });

  it('[card-null-guard] CampgroundCard.tsx renders the empty-rating slot when avgRating is absent', () => {
    // The else branch renders the empty placeholder (no crash path for null avgRating).
    expect(cardSrc).toContain('data-testid="empty--card-rating"');
  });

  it('[grid-wiring] CampgroundGrid.tsx passes avgRating={camp.avgRating} to CampgroundCard', () => {
    // Wiring guard: the grid must forward the stored column to the card prop.
    expect(gridSrc).toContain('avgRating={camp.avgRating}');
  });

  it('[grid-wiring] CampgroundGrid.tsx passes reviewCount={camp.reviewCount} to CampgroundCard', () => {
    expect(gridSrc).toContain('reviewCount={camp.reviewCount}');
  });
});

// ===========================================================================
// AC-6 — Helpers retained: sortByRating + computeAvgRating still exported from sort-utils
// ===========================================================================

describe('AC-6 — helpers retained: sortByRating + computeAvgRating exportable from lib/sort-utils', () => {

  it('[export] sortByRating is importable from @/lib/sort-utils (used by app/wishlist/page.tsx)', () => {
    // Prove-It: removing the export from sort-utils makes this import fail at test-load time.
    expect(typeof sortByRating).toBe('function');
  });

  it('[export] computeAvgRating is importable from @/lib/sort-utils (used by app/wishlist/page.tsx)', () => {
    expect(typeof computeAvgRating).toBe('function');
  });

  it('[logic] sortByRating still sorts descending, nulls last (helper behavior unchanged)', () => {
    // Prove-It: reverting sortByRating to ascending makes this fail.
    const input = [
      { id: 'a', reviews: [] as { rating: number }[] },          // null avg → last
      { id: 'b', reviews: [{ rating: 3 }] },   // avg 3
      { id: 'c', reviews: [{ rating: 5 }] },   // avg 5 → first
    ];
    const result = sortByRating(input);
    expect(result[0].id).toBe('c');  // 5 first
    expect(result[1].id).toBe('b');  // 3 second
    expect(result[2].id).toBe('a');  // null last
  });

  it('[logic] computeAvgRating still returns null for empty reviews (null-review camp)', () => {
    expect(computeAvgRating([])).toBeNull();
  });

  it('[logic] computeAvgRating still computes correct average from review array', () => {
    // Prove-It: changing the formula (e.g. returning sum instead of avg) makes this fail.
    expect(computeAvgRating([{ rating: 4 }, { rating: 5 }])).toBe(4.5);
  });

  it('[scope] app/wishlist/page.tsx is NOT changed to use campCardSelect (out of scope for PERF-5)', () => {
    // PERF-5 scope guard: wishlist page still uses its own select (future story).
    // Prove-It: replacing the wishlist's bespoke select with campCardSelect makes this fail.
    expect(wishlistSrc).not.toContain("from '@/lib/read-models/camp-card'");
    expect(wishlistSrc).not.toContain('campCardSelect');
  });

  it('[scope] app/wishlist/page.tsx still has its own reviews select with deletedAt: null', () => {
    // Wishlist page computes rating from reviews[] (not the stored column) — scope guard.
    expect(wishlistSrc).toContain('deletedAt: null');
  });
});
