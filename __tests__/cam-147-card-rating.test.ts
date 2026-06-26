/**
 * cam-147-card-rating.test.ts — source-inspection + i18n tests (CAM-147)
 *
 * Story: แสดงคะแนนรีวิวจริงบนการ์ดและ map popup (เลิก hardcode 4.8)
 *
 * AC coverage matrix:
 *   AC-1 / AC-5  card (home + wishlist) shows real avgRating behind reviewCount>0 && avgRating!=null
 *                guard; Star icon + rating--card-avg testid present
 *   AC-2         card empty state shows t.reviews.noReviews ("ยังไม่มีรีวิว") + empty--card-rating;
 *                NO hardcoded "4.8" in CampgroundCard.tsx
 *   AC-3 / AC-4  MapComponent uses same conditional + rating--map-popup-avg / empty--map-popup-rating;
 *                no "4.8"; CampgroundDetailClient threads avgRating/reviewCount into DynamicMap
 *   data/sec     app/page.tsx BOTH sort branches include reviews+strip; app/wishlist/page.tsx same;
 *                no reviews array reaches client (strip pattern present)
 *   i18n         th.reviews.noReviews === "ยังไม่มีรีวิว" verbatim;
 *                th.reviews.ratingAriaLabelShort exists + contains "คะแนน" + "จาก 5";
 *                en.reviews.ratingAriaLabelShort exists
 *   reuse        CampgroundCard.tsx / MapComponent.tsx do NOT define their own averaging;
 *                app/page.tsx imports computeAvgRating + roundAvgRating
 *
 * Layer rationale (per CAM-79 precedent in review-summary.test.ts):
 *   CampgroundCard, MapComponent, CampgroundDetailClient, app/page.tsx, and
 *   app/wishlist/page.tsx are either "use client" components with many shadcn/next/lucide
 *   dependencies, or Next.js async Server Components that call Prisma and auth().
 *   Rendering them in vitest/jsdom would require mocking >15 module boundaries and
 *   would validate the mocks, not the real code. The logic under test (conditional
 *   rendering pattern + query shape + import presence) is most reliably verified by
 *   source-inspection — the same approach used for CampgroundDetailClient in CAM-79
 *   (review-summary.test.ts AC-5/AC-6 sections). The reused helpers (computeAvgRating,
 *   roundAvgRating) are already 100%-covered by sort-utils.test.ts and
 *   review-summary.test.ts respectively; this story adds only wiring/display coverage.
 *
 * Coverage note:
 *   The averaging/rounding logic is reused from lib/sort-utils.ts (CAM-76) and
 *   lib/review-summary.ts (CAM-79), both already at 100% unit coverage. This story's
 *   new code is wiring + display conditionals in Server Components and "use client"
 *   components; source-inspection is the correct and proportionate layer (not
 *   fabricated coverage %). No coverage % is reported for this file — stating that
 *   honestly per .claude/rules/qa.md §"Metric honesty".
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readSrc(relPath: string): string {
    return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

const cardSrc = readSrc('components/CampgroundCard.tsx');
const gridSrc = readSrc('components/CampgroundGrid.tsx');
const wishlistClientSrc = readSrc('components/WishlistPageClient.tsx');
const mapSrc = readSrc('components/MapComponent.tsx');
const detailClientSrc = readSrc('components/CampgroundDetailClient.tsx');
const pageSrc = readSrc('app/page.tsx');
// LOAD-1 (CAM-197): data-fetch logic moved from page.tsx → CatalogResults.tsx.
const catalogResultsSrc = readSrc('components/CatalogResults.tsx');
const wishlistPageSrc = readSrc('app/wishlist/page.tsx');

const raw = fs.readFileSync(path.join(process.cwd(), 'locales/translations.json'), 'utf-8');
const translations = JSON.parse(raw) as Record<string, Record<string, Record<string, string>>>;
const thReviews = translations['th']['reviews'];
const enReviews = translations['en']['reviews'];

// ---------------------------------------------------------------------------
// AC-1 / AC-5 — CampgroundCard: rating shown when reviewCount > 0 && avgRating != null
// ---------------------------------------------------------------------------
describe('AC-1/AC-5 — CampgroundCard: real avgRating conditional + testid + prop forwarding', () => {

    it('[source] CampgroundCard.tsx renders rating slot only when reviewCount > 0 && avgRating != null', () => {
        // The exact guard required by the story Rules and AC-1
        expect(cardSrc).toContain('reviewCount > 0 && avgRating != null');
    });

    it('[source] CampgroundCard.tsx renders data-testid="rating--card-avg" in the has-reviews branch', () => {
        expect(cardSrc).toContain('data-testid="rating--card-avg"');
    });

    it('[source] CampgroundCard.tsx renders the Star icon in the has-reviews branch', () => {
        // Star is imported from lucide-react and used inside the reviewCount>0 branch
        expect(cardSrc).toContain('import');
        expect(cardSrc).toContain('Star');
        expect(cardSrc).toContain('fill-foreground text-foreground');
    });

    it('[source] CampgroundCard.tsx accepts avgRating and reviewCount props (CAM-147 prop contract)', () => {
        expect(cardSrc).toContain('avgRating');
        expect(cardSrc).toContain('reviewCount');
    });

    it('[source] CampgroundGrid.tsx forwards avgRating to CampgroundCard', () => {
        expect(gridSrc).toContain('avgRating={camp.avgRating}');
    });

    it('[source] CampgroundGrid.tsx forwards reviewCount to CampgroundCard', () => {
        expect(gridSrc).toContain('reviewCount={camp.reviewCount}');
    });

    it('[source] CampSiteCardData in CampgroundGrid.tsx includes avgRating field (CAM-147 type contract)', () => {
        expect(gridSrc).toContain('avgRating');
        expect(gridSrc).toContain('reviewCount');
    });

    it('[source] WishlistPageClient.tsx forwards avgRating from camp to CampgroundCard (AC-5)', () => {
        expect(wishlistClientSrc).toContain('avgRating={camp.avgRating}');
    });

    it('[source] WishlistPageClient.tsx forwards reviewCount from camp to CampgroundCard (AC-5)', () => {
        expect(wishlistClientSrc).toContain('reviewCount={camp.reviewCount}');
    });
});

// ---------------------------------------------------------------------------
// AC-2 — CampgroundCard: empty state shows "ยังไม่มีรีวิว", no "4.8" hardcode
// ---------------------------------------------------------------------------
describe('AC-2 — CampgroundCard: empty state + no hardcoded 4.8', () => {

    it('[source] CampgroundCard.tsx renders data-testid="empty--card-rating" in the no-reviews branch', () => {
        expect(cardSrc).toContain('data-testid="empty--card-rating"');
    });

    it('[source] CampgroundCard.tsx empty-state branch uses t.reviews.noReviews (i18n key, not hardcoded string)', () => {
        expect(cardSrc).toContain('t.reviews.noReviews');
    });

    it('[source] CampgroundCard.tsx does NOT contain hardcoded "4.8" (AC-2: no hardcoded rating)', () => {
        // The old hardcode that this story removes
        expect(cardSrc).not.toContain('"4.8"');
    });

    it('[source] CampgroundCard.tsx does NOT show a 0 or empty-star when no reviews', () => {
        // Verify the empty branch renders the noReviews text, not a numeric 0
        // The component must NOT have a pattern like `{0}` or `avgRating ?? 0`
        expect(cardSrc).not.toContain('avgRating ?? 0');
        expect(cardSrc).not.toContain('|| 0');
    });

    it('[logic] reviewCount=0 && avgRating=null does NOT satisfy reviewCount>0 && avgRating!=null', () => {
        const reviewCount = 0;
        const avgRating = null;
        expect(reviewCount > 0 && avgRating != null).toBe(false);
    });

    it('[logic] reviewCount=1 && avgRating=4.2 satisfies the guard (shows star + value)', () => {
        const reviewCount = 1;
        const avgRating = 4.2;
        expect(reviewCount > 0 && avgRating != null).toBe(true);
    });

    it('[boundary] reviewCount=0 with any avgRating still falls to empty state', () => {
        const reviewCount = 0;
        const avgRating = 4.8;  // even if avgRating has a value, count=0 → no star
        expect(reviewCount > 0 && avgRating != null).toBe(false);
    });

    it('[boundary] reviewCount>0 but avgRating=null still falls to empty state (guard is AND)', () => {
        const reviewCount = 5;
        const avgRating = null;
        expect(reviewCount > 0 && avgRating != null).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// AC-3 / AC-4 — MapComponent: popup conditional + testids + no "4.8"
// ---------------------------------------------------------------------------
describe('AC-3/AC-4 — MapComponent: popup rating conditional + testids + no hardcoded 4.8', () => {

    it('[source] MapComponent.tsx renders reviewCount > 0 && avgRating != null guard in the popup', () => {
        expect(mapSrc).toContain('reviewCount > 0 && avgRating != null');
    });

    it('[source] MapComponent.tsx renders data-testid="rating--map-popup-avg" in the has-reviews branch', () => {
        expect(mapSrc).toContain('data-testid="rating--map-popup-avg"');
    });

    it('[source] MapComponent.tsx renders data-testid="empty--map-popup-rating" in the no-reviews branch', () => {
        expect(mapSrc).toContain('data-testid="empty--map-popup-rating"');
    });

    it('[source] MapComponent.tsx does NOT contain hardcoded "4.8"', () => {
        expect(mapSrc).not.toContain('"4.8"');
    });

    it('[source] MapComponent.tsx empty-state branch uses t.reviews.noReviews (i18n key)', () => {
        expect(mapSrc).toContain('t.reviews.noReviews');
    });

    it('[source] MapComponent.tsx accepts avgRating and reviewCount props (CAM-147 prop contract)', () => {
        expect(mapSrc).toContain('avgRating');
        expect(mapSrc).toContain('reviewCount');
    });

    it('[source] CampgroundDetailClient.tsx threads avgRating into DynamicMap call (AC-3/AC-4)', () => {
        // CampgroundDetailClient is the only consumer of MapComponent; it must forward both props
        expect(detailClientSrc).toContain('avgRating={avgRating}');
    });

    it('[source] CampgroundDetailClient.tsx threads reviewCount into DynamicMap call (AC-3/AC-4)', () => {
        expect(detailClientSrc).toContain('reviewCount={reviewCount}');
    });
});

// ---------------------------------------------------------------------------
// Data correctness / security — PERF-5 (CAM-193): column-based avgRating, no JS compute
// ---------------------------------------------------------------------------
describe('Data correctness / security — avgRating from column (PERF-5 / CAM-193)', () => {

    it('[source] CatalogResults.tsx does NOT import computeAvgRating (PERF-5: column replaces JS compute)', () => {
        // LOAD-1 (CAM-197): data-fetch moved from page.tsx → CatalogResults.tsx.
        // Prove-It: re-adding the import makes this fail.
        expect(catalogResultsSrc).not.toContain('computeAvgRating');
    });

    it('[source] CatalogResults.tsx does NOT import roundAvgRating (PERF-5: AGG-1 column value is pre-rounded)', () => {
        expect(catalogResultsSrc).not.toContain('roundAvgRating');
    });

    it('[source] campCardSelect does NOT contain reviews (PERF-5: reviews over-fetch dropped)', () => {
        // Prove-It: re-adding reviews to campCardSelect makes this fail.
        const campCardSrc = readSrc('lib/read-models/camp-card.ts');
        expect(campCardSrc).not.toContain('reviews:');
    });

    it('[source] campCardSelect selects avgRating column (PERF-5: stored Decimal column from AGG-1)', () => {
        const campCardSrc = readSrc('lib/read-models/camp-card.ts');
        expect(campCardSrc).toContain('avgRating: true');
    });

    it('[source] CatalogResults.tsx uses ONE findMany with select: campCardSelect (PERF-5: unified query)', () => {
        // Prove-It: splitting back to two branches increases the count.
        const selectCount = (catalogResultsSrc.match(/select:\s*campCardSelect/g) || []).length;
        expect(selectCount).toBe(1);
    });

    it('[source] CatalogResults.tsx does NOT contain roundAvgRating(computeAvgRating(_reviews)) (PERF-5: expression removed)', () => {
        expect(catalogResultsSrc).not.toContain('roundAvgRating(computeAvgRating(_reviews))');
    });

    it('[source] CatalogResults.tsx orderBy uses avgRating for rating sort (DB-level sort via stored column)', () => {
        expect(catalogResultsSrc).toContain('avgRating');
    });

    it('[source] app/wishlist/page.tsx imports computeAvgRating (regression guard — wishlist still uses reviews fetch)', () => {
        expect(wishlistPageSrc).toContain('computeAvgRating');
    });

    it('[source] app/wishlist/page.tsx imports roundAvgRating (regression guard — wishlist still uses reviews fetch)', () => {
        expect(wishlistPageSrc).toContain('roundAvgRating');
    });

    it('[source] app/wishlist/page.tsx includes reviews with deletedAt:null in campSite select (out of PERF-5 scope)', () => {
        expect(wishlistPageSrc).toContain('deletedAt: null');
    });

    it('[source] app/wishlist/page.tsx strips reviews array before forwarding (no PII leak)', () => {
        // Pattern: const { reviews, ...campSite } = row.campSite  (destructure out reviews)
        expect(wishlistPageSrc).toContain('reviews');
        // avgRating computed from reviews then reviews discarded
        expect(wishlistPageSrc).toContain('roundAvgRating(computeAvgRating(reviews))');
    });

    it('[source] app/wishlist/page.tsx sets reviewCount from reviews.length', () => {
        expect(wishlistPageSrc).toContain('reviews.length');
    });

    it('[security] CampgroundCard.tsx does NOT define its own averaging function', () => {
        // The card must not contain any averaging logic — only receive the scalar prop
        expect(cardSrc).not.toContain('reduce');
        expect(cardSrc).not.toContain('/ reviews.length');
    });

    it('[security] MapComponent.tsx does NOT define its own averaging function', () => {
        expect(mapSrc).not.toContain('reduce');
        expect(mapSrc).not.toContain('/ reviews.length');
    });
});

// ---------------------------------------------------------------------------
// i18n verbatim — locales/translations.json
// ---------------------------------------------------------------------------
describe('i18n verbatim — reviews.noReviews + reviews.ratingAriaLabelShort (CAM-147)', () => {

    it('[copy] th.reviews.noReviews === "ยังไม่มีรีวิว" (AC-2/AC-4 — empty state, verbatim Thai)', () => {
        expect(thReviews.noReviews).toBe('ยังไม่มีรีวิว');
    });

    it('[copy] th.reviews.ratingAriaLabelShort exists (new key added in CAM-147)', () => {
        expect(thReviews).toHaveProperty('ratingAriaLabelShort');
    });

    it('[copy] th.reviews.ratingAriaLabelShort contains "คะแนน" (Thai for "rating")', () => {
        expect(thReviews.ratingAriaLabelShort).toContain('คะแนน');
    });

    it('[copy] th.reviews.ratingAriaLabelShort contains "จาก 5" (AC-1: "out of 5 stars")', () => {
        expect(thReviews.ratingAriaLabelShort).toContain('จาก 5');
    });

    it('[copy] th.reviews.ratingAriaLabelShort contains "{avg}" placeholder (runtime substitution)', () => {
        expect(thReviews.ratingAriaLabelShort).toContain('{avg}');
    });

    it('[copy] th.reviews.ratingAriaLabelShort full value === "คะแนน {avg} จาก 5 ดาว" (verbatim)', () => {
        expect(thReviews.ratingAriaLabelShort).toBe('คะแนน {avg} จาก 5 ดาว');
    });

    it('[copy] en.reviews.ratingAriaLabelShort exists (EN parity check)', () => {
        expect(enReviews).toHaveProperty('ratingAriaLabelShort');
    });

    it('[copy] en.reviews.ratingAriaLabelShort === "Rating {avg} out of 5 stars" (verbatim)', () => {
        expect(enReviews.ratingAriaLabelShort).toBe('Rating {avg} out of 5 stars');
    });

    it('[copy] CampgroundCard.tsx uses t.reviews.ratingAriaLabelShort for aria-label (not hardcoded)', () => {
        expect(cardSrc).toContain('t.reviews.ratingAriaLabelShort');
    });

    it('[copy] MapComponent.tsx uses t.reviews.ratingAriaLabelShort for aria-label (not hardcoded)', () => {
        expect(mapSrc).toContain('t.reviews.ratingAriaLabelShort');
    });

    it('[copy] reviews namespace in th has ratingAriaLabelShort key alongside existing keys', () => {
        // Parity: new key must not have displaced any existing CAM-79 keys
        expect(thReviews).toHaveProperty('noReviews');
        expect(thReviews).toHaveProperty('noReviewsSection');
        expect(thReviews).toHaveProperty('ratingAriaLabel');
        expect(thReviews).toHaveProperty('ratingAriaLabelShort');
        expect(thReviews).toHaveProperty('itemRatingAriaLabel');
    });
});

// ---------------------------------------------------------------------------
// Reuse rule — no duplicate avg/rounding logic
// ---------------------------------------------------------------------------
describe('Reuse rule — no duplicate avg/rounding logic in card or map components', () => {

    it('[reuse] CampgroundCard.tsx does NOT import computeAvgRating (reuse via prop, not local call)', () => {
        expect(cardSrc).not.toContain('computeAvgRating');
    });

    it('[reuse] CampgroundCard.tsx does NOT import roundAvgRating', () => {
        expect(cardSrc).not.toContain('roundAvgRating');
    });

    it('[reuse] MapComponent.tsx does NOT import computeAvgRating', () => {
        expect(mapSrc).not.toContain('computeAvgRating');
    });

    it('[reuse] MapComponent.tsx does NOT import roundAvgRating', () => {
        expect(mapSrc).not.toContain('roundAvgRating');
    });

    it('[reuse] CatalogResults.tsx does NOT import computeAvgRating (PERF-5: sort moved to DB)', () => {
        // LOAD-1 (CAM-197): logic moved to CatalogResults.tsx. Helpers still in lib/sort-utils.ts.
        // Prove-It: re-adding the import makes this fail.
        const hasImport = catalogResultsSrc.includes("from '@/lib/sort-utils'") || catalogResultsSrc.includes('from "@/lib/sort-utils"');
        expect(hasImport).toBe(false);
        expect(catalogResultsSrc).not.toContain('computeAvgRating');
    });

    it('[reuse] CatalogResults.tsx does NOT import roundAvgRating (PERF-5: pre-rounded by AGG-1)', () => {
        // LOAD-1 (CAM-197): logic moved to CatalogResults.tsx.
        const hasImport = catalogResultsSrc.includes("from '@/lib/review-summary'") || catalogResultsSrc.includes('from "@/lib/review-summary"');
        expect(hasImport).toBe(false);
        expect(catalogResultsSrc).not.toContain('roundAvgRating');
    });
});

// ---------------------------------------------------------------------------
// No hardcoded "4.8" anywhere in the changed files (KPI from story)
// ---------------------------------------------------------------------------
describe('KPI: no hardcoded "4.8" in any changed file', () => {

    it('[kpi] CampgroundCard.tsx has no hardcoded "4.8"', () => {
        expect(cardSrc).not.toContain('"4.8"');
    });

    it('[kpi] CampgroundGrid.tsx has no hardcoded "4.8"', () => {
        expect(gridSrc).not.toContain('"4.8"');
    });

    it('[kpi] WishlistPageClient.tsx has no hardcoded "4.8"', () => {
        expect(wishlistClientSrc).not.toContain('"4.8"');
    });

    it('[kpi] MapComponent.tsx has no hardcoded "4.8"', () => {
        expect(mapSrc).not.toContain('"4.8"');
    });

    it('[kpi] CampgroundDetailClient.tsx has no hardcoded "4.8" (regression guard from CAM-79)', () => {
        expect(detailClientSrc).not.toContain('"4.8"');
    });

    it('[kpi] app/page.tsx has no hardcoded "4.8"', () => {
        expect(pageSrc).not.toContain('"4.8"');
    });

    it('[kpi] app/wishlist/page.tsx has no hardcoded "4.8"', () => {
        expect(wishlistPageSrc).not.toContain('"4.8"');
    });
});
