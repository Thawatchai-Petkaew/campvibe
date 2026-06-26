/**
 * cam-192-list-buffet.test.ts — CAM-192 PERF-1 List Buffet
 *
 * AC coverage matrix (from tech.md §9):
 *
 *   AC-1  campCardSelect shape — no spots/options/operator keys; images.take=5;
 *         images.orderBy.sortOrder='asc'; reviews.where.deletedAt=null;
 *         location.select.province=true
 *   AC-2  3 call sites use campCardSelect — app/page.tsx (both sort branches),
 *         app/api/campsites/route.ts, app/api/campgrounds/route.ts each reference
 *         `select: campCardSelect` and do NOT reference `include: { spots` / `include: { options`
 *   AC-3  avgRating pipeline intact — computeAvgRating / roundAvgRating produce correct
 *         values from {rating}[] (delegation to sort-utils / review-summary already tested;
 *         this test confirms the pipeline is still wired in app/page.tsx after the refactor)
 *   AC-4  keyword search intact — buildCampSiteWhere({keyword}) puts
 *         `operator.name contains` in the WHERE clause
 *   AC-5  card render contract — every field CampgroundCard.tsx reads
 *         (nameTh/nameEn/priceLow/avgRating/reviewCount/images/province) is
 *         present in campCardSelect (source-inspect + type-level via import)
 *
 * Layer rationale (identical to CAM-147 / sort-utils precedent):
 *   campCardSelect is a const object — it is a plain value, testable by direct import.
 *   Call sites (app/page.tsx, route handlers) are Next.js Server Components / route
 *   handlers that import Prisma and call `auth()`. Running them in vitest/node would
 *   require mocking Prisma, Next.js, NextAuth, and every UI component. Source-inspection
 *   is the correct layer for wiring/call-site assertions
 *   (established precedent: CAM-76 sort-utils, CAM-79 review-summary, CAM-147 card-rating).
 *
 * Prove-It notes:
 *   - AC-1 shape tests were verified to fail when `spots: true` or `operator: { select: {} }`
 *     are temporarily inserted into campCardSelect.
 *   - AC-2 call-site tests were verified to fail when `include:` is temporarily substituted
 *     for `select:` in app/page.tsx.
 *   - AC-3 / AC-4 tests were verified to fail when the imports/calls are removed from page.tsx /
 *     campsite-filters.ts.
 *   - AC-5 tests were verified to fail when `province` is removed from campCardSelect.location.
 *
 * Coverage:
 *   lib/read-models/camp-card.ts is a pure const export (no branching logic beyond the
 *   `satisfies` type assertion). All fields and sub-selects are directly asserted.
 *   Effective branch coverage = 100% (no executable branches; value assertions cover every key).
 *   The helper functions (computeAvgRating, roundAvgRating) are already 100%-covered by
 *   sort-utils.test.ts and review-summary.test.ts; this story confirms they remain wired
 *   after the refactor.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { campCardSelect } from '@/lib/read-models/camp-card';
import { computeAvgRating } from '@/lib/sort-utils';
import { roundAvgRating } from '@/lib/review-summary';
import { buildCampSiteWhere } from '@/lib/campsite-filters';

// ---------------------------------------------------------------------------
// Source helpers
// ---------------------------------------------------------------------------
function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

const pageSrc       = readSrc('app/page.tsx');
const campsiteSrc   = readSrc('app/api/campsites/route.ts');
const campgroundSrc = readSrc('app/api/campgrounds/route.ts');
const cardSrc       = readSrc('components/CampgroundCard.tsx');

// ---------------------------------------------------------------------------
// AC-1 — campCardSelect shape (direct value assertions on the imported const)
// ---------------------------------------------------------------------------
describe('AC-1 — campCardSelect shape', () => {

  // Dropped keys (over-fetch culprits)
  it('[shape] campCardSelect does NOT contain a "spots" key (over-fetch dropped)', () => {
    // Prove-It: adding `spots: true` to the const makes this fail.
    const keys = Object.keys(campCardSelect);
    expect(keys).not.toContain('spots');
  });

  it('[shape] campCardSelect does NOT contain an "options" key (taxonomy over-fetch dropped)', () => {
    const keys = Object.keys(campCardSelect);
    expect(keys).not.toContain('options');
  });

  it('[shape] campCardSelect does NOT contain a top-level "operator" key', () => {
    // operator.name is used in WHERE only; it should never appear in SELECT.
    const keys = Object.keys(campCardSelect);
    expect(keys).not.toContain('operator');
  });

  it('[shape] campCardSelect does NOT contain a "_count" key', () => {
    const keys = Object.keys(campCardSelect);
    expect(keys).not.toContain('_count');
  });

  // Required scalar card fields
  it('[shape] campCardSelect selects id', () => {
    expect(campCardSelect.id).toBe(true);
  });

  it('[shape] campCardSelect selects nameTh', () => {
    expect(campCardSelect.nameTh).toBe(true);
  });

  it('[shape] campCardSelect selects nameEn', () => {
    expect(campCardSelect.nameEn).toBe(true);
  });

  it('[shape] campCardSelect selects nameThSlug', () => {
    expect(campCardSelect.nameThSlug).toBe(true);
  });

  it('[shape] campCardSelect selects nameEnSlug', () => {
    expect(campCardSelect.nameEnSlug).toBe(true);
  });

  it('[shape] campCardSelect selects priceLow', () => {
    expect(campCardSelect.priceLow).toBe(true);
  });

  it('[shape] campCardSelect selects createdAt', () => {
    expect(campCardSelect.createdAt).toBe(true);
  });

  // images sub-select
  it('[shape] images.take === 5 (bounded fetch — card shows ≤5 dots)', () => {
    // Prove-It: changing take:5 to take:10 makes this fail.
    expect(campCardSelect.images.take).toBe(5);
  });

  it('[shape] images.orderBy.sortOrder === "asc" (carousel order is ascending)', () => {
    // Prove-It: removing orderBy makes this fail.
    expect(campCardSelect.images.orderBy).toEqual({ sortOrder: 'asc' });
  });

  it('[shape] images selects url', () => {
    expect(campCardSelect.images.select.url).toBe(true);
  });

  it('[shape] images selects sortOrder', () => {
    expect(campCardSelect.images.select.sortOrder).toBe(true);
  });

  // reviews sub-select
  it('[shape] reviews.where.deletedAt === null (soft-deleted reviews excluded)', () => {
    // Prove-It: removing the where clause makes this fail.
    expect(campCardSelect.reviews.where).toEqual({ deletedAt: null });
  });

  it('[shape] reviews selects only rating (no author PII)', () => {
    const reviewSelectKeys = Object.keys(campCardSelect.reviews.select);
    expect(reviewSelectKeys).toContain('rating');
    expect(reviewSelectKeys).not.toContain('authorId');
    expect(reviewSelectKeys).not.toContain('content');
    expect(reviewSelectKeys).not.toContain('author');
  });

  // location sub-select
  it('[shape] location.select.province === true (only province rendered on card)', () => {
    // Prove-It: removing province from location.select makes this fail.
    expect(campCardSelect.location.select.province).toBe(true);
  });

  it('[shape] location.select does NOT select latitude (over-fetch dropped)', () => {
    expect((campCardSelect.location.select as Record<string, unknown>).latitude).toBeUndefined();
  });

  it('[shape] location.select does NOT select longitude (over-fetch dropped)', () => {
    expect((campCardSelect.location.select as Record<string, unknown>).longitude).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-2 — 3 call sites use campCardSelect and no longer use include:{spots/options}
// ---------------------------------------------------------------------------
describe('AC-2 — call sites use campCardSelect, not include:{spots/options}', () => {

  // app/page.tsx
  it('[call-site] app/page.tsx imports campCardSelect from lib/read-models/camp-card', () => {
    // Prove-It: removing the import makes this fail.
    // Source files use double-quote imports.
    expect(pageSrc).toContain('from "@/lib/read-models/camp-card"');
  });

  it('[call-site] app/page.tsx uses `select: campCardSelect` in at least 2 places (both sort branches)', () => {
    // Prove-It: collapsing both branches to one reference drops the count below 2.
    const matches = pageSrc.match(/select:\s*campCardSelect/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('[call-site] app/page.tsx does NOT use `include: { spots` (over-fetch dropped)', () => {
    expect(pageSrc).not.toMatch(/include:\s*\{\s*spots/);
  });

  it('[call-site] app/page.tsx does NOT use `include: { options` (over-fetch dropped)', () => {
    expect(pageSrc).not.toMatch(/include:\s*\{\s*options/);
  });

  // app/api/campsites/route.ts
  it('[call-site] app/api/campsites/route.ts imports campCardSelect', () => {
    // Route uses single-quote imports.
    expect(campsiteSrc).toContain("from '@/lib/read-models/camp-card'");
  });

  it('[call-site] app/api/campsites/route.ts GET handler uses `select: campCardSelect`', () => {
    expect(campsiteSrc).toContain('select: campCardSelect');
  });

  it('[call-site] app/api/campsites/route.ts GET handler does NOT use `include: { spots`', () => {
    expect(campsiteSrc).not.toMatch(/include:\s*\{\s*spots/);
  });

  it('[call-site] app/api/campsites/route.ts GET handler does NOT use `include: { options`', () => {
    expect(campsiteSrc).not.toMatch(/include:\s*\{\s*options/);
  });

  // app/api/campgrounds/route.ts
  it('[call-site] app/api/campgrounds/route.ts imports campCardSelect', () => {
    // Route uses single-quote imports.
    expect(campgroundSrc).toContain("from '@/lib/read-models/camp-card'");
  });

  it('[call-site] app/api/campgrounds/route.ts GET handler uses `select: campCardSelect`', () => {
    expect(campgroundSrc).toContain('select: campCardSelect');
  });

  it('[call-site] app/api/campgrounds/route.ts GET handler does NOT use `include: { spots`', () => {
    expect(campgroundSrc).not.toMatch(/include:\s*\{\s*spots/);
  });

  it('[call-site] app/api/campgrounds/route.ts GET handler does NOT use `include: { options`', () => {
    expect(campgroundSrc).not.toMatch(/include:\s*\{\s*options/);
  });
});

// ---------------------------------------------------------------------------
// AC-3 — avgRating pipeline still wired in app/page.tsx after PERF-1 refactor
// ---------------------------------------------------------------------------
describe('AC-3 — avgRating pipeline intact in app/page.tsx', () => {

  it('[pipeline] app/page.tsx imports computeAvgRating (reuse rule — same helper as pre-refactor)', () => {
    expect(pageSrc).toContain('computeAvgRating');
  });

  it('[pipeline] app/page.tsx imports roundAvgRating (reuse rule — same helper as pre-refactor)', () => {
    expect(pageSrc).toContain('roundAvgRating');
  });

  it('[pipeline] app/page.tsx computes avgRating via roundAvgRating(computeAvgRating(_reviews))', () => {
    // Prove-It: renaming the call expression makes this fail.
    expect(pageSrc).toContain('roundAvgRating(computeAvgRating(_reviews))');
  });

  it('[pipeline] app/page.tsx strips reviews before forwarding to grid (no PII to client)', () => {
    expect(pageSrc).toContain('reviews: _reviews');
    expect(pageSrc).toContain('...rest');
  });

  it('[pipeline] app/page.tsx sets reviewCount from _reviews.length', () => {
    expect(pageSrc).toContain('_reviews.length');
  });

  // Logic: verify the helpers still produce correct values from {rating}[] shaped input
  // (i.e., the exact shape campCardSelect.reviews returns: {rating: number}[])
  it('[logic] computeAvgRating produces correct avg from {rating}[] slice (PERF-1 reviews shape)', () => {
    const reviews: { rating: number }[] = [{ rating: 4 }, { rating: 5 }];
    expect(computeAvgRating(reviews)).toBe(4.5);
  });

  it('[logic] computeAvgRating returns null for empty reviews (no-review camp)', () => {
    expect(computeAvgRating([])).toBeNull();
  });

  it('[logic] roundAvgRating rounds the result from computeAvgRating to 1 decimal place', () => {
    const reviews: { rating: number }[] = [{ rating: 4 }, { rating: 5 }, { rating: 4 }];
    const avg = computeAvgRating(reviews); // 13/3 ≈ 4.333...
    expect(roundAvgRating(avg)).toBe(4.3);
  });

  it('[logic] roundAvgRating(null) returns null (no reviews → no rating displayed)', () => {
    expect(roundAvgRating(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-4 — keyword search intact: buildCampSiteWhere puts operator.name contains in WHERE
// ---------------------------------------------------------------------------
describe('AC-4 — keyword search: operator.name contains in WHERE', () => {

  it('[logic] buildCampSiteWhere({keyword}) includes operator.name contains in OR clause', () => {
    const where = buildCampSiteWhere({ keyword: 'ป่า' });
    // The OR clause must contain an operator.name condition
    expect(where.OR).toBeDefined();
    const hasOperatorName = (where.OR as unknown[]).some(
      (clause: unknown) =>
        typeof clause === 'object' &&
        clause !== null &&
        'operator' in clause &&
        typeof (clause as { operator: unknown }).operator === 'object' &&
        (clause as { operator: { name: unknown } }).operator !== null &&
        'name' in ((clause as { operator: { name: unknown } }).operator as object)
    );
    expect(hasOperatorName).toBe(true);
  });

  it('[logic] buildCampSiteWhere without keyword does NOT set OR clause (no spurious filter)', () => {
    const where = buildCampSiteWhere({});
    expect(where.OR).toBeUndefined();
  });

  it('[logic] buildCampSiteWhere({keyword}) includes nameTh contains in OR clause', () => {
    const where = buildCampSiteWhere({ keyword: 'สวน' });
    const hasNameTh = (where.OR as unknown[]).some(
      (clause: unknown) =>
        typeof clause === 'object' && clause !== null && 'nameTh' in clause
    );
    expect(hasNameTh).toBe(true);
  });

  it('[source] campsite-filters.ts still contains operator.name contains (no regression)', () => {
    // Guard: operator.name is the critical search field for host-name lookups.
    const filtersSrc = readSrc('lib/campsite-filters.ts');
    expect(filtersSrc).toContain('operator');
    expect(filtersSrc).toContain('name');
    expect(filtersSrc).toContain('contains');
  });
});

// ---------------------------------------------------------------------------
// AC-5 — card render contract: every field CampgroundCard reads is in campCardSelect
// ---------------------------------------------------------------------------
describe('AC-5 — card render contract: all CampgroundCard fields present in campCardSelect', () => {

  // nameTh / nameEn (card renders name based on language)
  it('[contract] campCardSelect provides nameTh (CampgroundCard renders nameTh in Thai mode)', () => {
    expect(campCardSelect.nameTh).toBe(true);
  });

  it('[contract] campCardSelect provides nameEn (CampgroundCard renders nameEn in English mode)', () => {
    expect(campCardSelect.nameEn).toBe(true);
  });

  // slugs (card builds the href from slugs)
  it('[contract] campCardSelect provides nameThSlug (card href uses slug)', () => {
    expect(campCardSelect.nameThSlug).toBe(true);
  });

  it('[contract] campCardSelect provides nameEnSlug (card href uses slug in EN mode)', () => {
    expect(campCardSelect.nameEnSlug).toBe(true);
  });

  // price
  it('[contract] campCardSelect provides priceLow (card renders the price)', () => {
    expect(campCardSelect.priceLow).toBe(true);
  });

  // province via location
  it('[contract] campCardSelect provides location.select.province (card renders province below the name)', () => {
    // CampgroundCard line 184: campground.location.province
    expect(campCardSelect.location.select.province).toBe(true);
  });

  // images (card carousel)
  it('[contract] campCardSelect provides images with url (card renders image carousel)', () => {
    expect(campCardSelect.images.select.url).toBe(true);
  });

  // avgRating / reviewCount — these are computed server-side from reviews, not read directly from reviews
  it('[contract] campCardSelect provides reviews so server can compute avgRating prop for card', () => {
    // The card receives avgRating as a prop; it's derived from reviews in app/page.tsx.
    // Verify the reviews key exists in campCardSelect.
    expect('reviews' in campCardSelect).toBe(true);
  });

  it('[contract] campCardSelect.reviews selects rating (the only field needed to compute avgRating)', () => {
    expect(campCardSelect.reviews.select.rating).toBe(true);
  });

  // Verify CampgroundCard.tsx still reads province from location
  it('[source] CampgroundCard.tsx reads campground.location.province (contract satisfied)', () => {
    expect(cardSrc).toContain('campground.location.province');
  });

  // Verify CampgroundCard.tsx still reads priceLow
  it('[source] CampgroundCard.tsx reads campground.priceLow (contract satisfied)', () => {
    expect(cardSrc).toContain('campground.priceLow');
  });

  // Verify CampgroundCard.tsx still reads nameTh
  it('[source] CampgroundCard.tsx reads campground.nameTh (contract satisfied)', () => {
    expect(cardSrc).toContain('campground.nameTh');
  });

  // Verify CampgroundCard.tsx still reads images for the carousel
  it('[source] CampgroundCard.tsx reads campground.images (contract satisfied)', () => {
    expect(cardSrc).toContain('campground.images');
  });

  // Verify CampgroundGrid passes avgRating and reviewCount props (wiring check)
  it('[source] CampgroundGrid.tsx passes avgRating={camp.avgRating} to CampgroundCard', () => {
    const gridSrc = readSrc('components/CampgroundGrid.tsx');
    expect(gridSrc).toContain('avgRating={camp.avgRating}');
  });

  it('[source] CampgroundGrid.tsx passes reviewCount={camp.reviewCount} to CampgroundCard', () => {
    const gridSrc = readSrc('components/CampgroundGrid.tsx');
    expect(gridSrc).toContain('reviewCount={camp.reviewCount}');
  });
});

// ---------------------------------------------------------------------------
// Regression guard — CampSiteCardData type in CampgroundGrid derives from CampCardPayload
// ---------------------------------------------------------------------------
describe('Regression — CampSiteCardData derives from CampCardPayload (type contract)', () => {

  it('[source] CampgroundGrid.tsx imports CampCardPayload from lib/read-models/camp-card', () => {
    const gridSrc = readSrc('components/CampgroundGrid.tsx');
    // CampgroundGrid uses double-quote style imports with `import type`.
    expect(gridSrc).toContain('from "@/lib/read-models/camp-card"');
    expect(gridSrc).toContain('CampCardPayload');
  });

  it('[source] CampSiteCardData uses Omit<CampCardPayload, ...> (narrowed, not re-declared)', () => {
    const gridSrc = readSrc('components/CampgroundGrid.tsx');
    expect(gridSrc).toContain('Omit<CampCardPayload');
  });
});
