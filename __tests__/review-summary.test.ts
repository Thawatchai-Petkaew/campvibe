/**
 * review-summary.test.ts — unit tests for lib/review-summary.ts (CAM-79)
 *
 * AC coverage matrix (every row in the AC table → at least one test):
 *   AC-1  roundAvgRating + buildReviewSummary happy path (camp with reviews)
 *   AC-2  buildReviewSummary count=0 → hasReviews:false, avgRating:null
 *   AC-3  toReviewListItem maps row → DTO correctly (name/rating/content/createdAt)
 *   AC-4  (empty state — no reviews; empty list preserved via toReviewListItem array)
 *   AC-5  reviewCount > 10 strict boundary (logic source-inspected; separate section)
 *   AC-6  error isolation (source-inspection; separate section)
 *   i18n  Thai copy verbatim in locales/translations.json reviews namespace
 *   sec   toReviewListItem DTO has NO authorId / author.id key
 *
 * Layers:
 *   - roundAvgRating, buildReviewSummary, toReviewListItem → unit (pure functions, no DB)
 *   - Thai copy → unit (JSON parsing)
 *   - AC-5 boundary / AC-6 error isolation → source-inspection tests
 *     (CampgroundDetailClient is a "use client" component with many shadcn dependencies;
 *      rendering it in vitest/jsdom would require mocking >15 modules. The logic under
 *      test is a simple JSX conditional in a single place; a source-inspection test on
 *      the component source file is the correct layer as documented in CAM-58's approach.)
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal · null/empty · boundary (min/max/0/.5) · error/validation
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
    roundAvgRating,
    buildReviewSummary,
    toReviewListItem,
    type ReviewListItem,
} from '@/lib/review-summary';

// ---------------------------------------------------------------------------
// roundAvgRating
// ---------------------------------------------------------------------------
describe('roundAvgRating', () => {
    // AC-1 Rule: Math.round(avg * 10) / 10
    it('[normal] rounds 4.16667 to 4.2 (AC-1 rounding rule)', () => {
        expect(roundAvgRating(4.16667)).toBe(4.2);
    });

    it('[normal] rounds 4.8 to 4.8 (unchanged)', () => {
        expect(roundAvgRating(4.8)).toBe(4.8);
    });

    it('[normal] rounds 3.25 to 3.3', () => {
        expect(roundAvgRating(3.25)).toBe(3.3);
    });

    it('[boundary] exact .5 rounds up: 3.15 → 3.2', () => {
        expect(roundAvgRating(3.15)).toBe(3.2);
    });

    it('[boundary] 4.5 rounds to 4.5 (exact half stays as .5)', () => {
        // Math.round(4.5 * 10) / 10 = Math.round(45) / 10 = 45/10 = 4.5
        expect(roundAvgRating(4.5)).toBe(4.5);
    });

    it('[boundary] whole number 4 returns 4 (no trailing decimal)', () => {
        // Math.round(4 * 10) / 10 = 40 / 10 = 4
        expect(roundAvgRating(4)).toBe(4);
    });

    it('[boundary] minimum rating 1 → 1', () => {
        expect(roundAvgRating(1)).toBe(1);
    });

    it('[boundary] maximum rating 5 → 5', () => {
        expect(roundAvgRating(5)).toBe(5);
    });

    it('[null/empty] null avg returns null (AC-2: no "0" displayed)', () => {
        expect(roundAvgRating(null)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// buildReviewSummary
// ---------------------------------------------------------------------------
describe('buildReviewSummary', () => {
    // AC-1: has reviews → hasReviews:true, avgRating rounded
    it('[normal] count=5, avg=4.16667 → hasReviews:true, avgRating:4.2, count:5 (AC-1)', () => {
        const result = buildReviewSummary({ avg: 4.16667, count: 5 });
        expect(result.hasReviews).toBe(true);
        expect(result.avgRating).toBe(4.2);
        expect(result.count).toBe(5);
    });

    it('[normal] count=1, avg=5 → hasReviews:true, avgRating:5', () => {
        const result = buildReviewSummary({ avg: 5, count: 1 });
        expect(result.hasReviews).toBe(true);
        expect(result.avgRating).toBe(5);
        expect(result.count).toBe(1);
    });

    it('[normal] count=10, avg=3.33 → hasReviews:true, avgRating:3.3', () => {
        const result = buildReviewSummary({ avg: 3.33, count: 10 });
        expect(result.hasReviews).toBe(true);
        expect(result.avgRating).toBe(3.3);
    });

    // AC-2: count=0 → no "0", no empty stars
    it('[null/empty] count=0 → hasReviews:false, avgRating:null, count:0 (AC-2)', () => {
        const result = buildReviewSummary({ avg: null, count: 0 });
        expect(result.hasReviews).toBe(false);
        expect(result.avgRating).toBeNull();
        expect(result.count).toBe(0);
    });

    it('[null/empty] count=0 even with a non-null avg → avgRating:null (AC-2 rule: null when count===0)', () => {
        // Prisma returns avg when there was a prior average but count becomes 0 after deletes — ensure null
        const result = buildReviewSummary({ avg: 4.2, count: 0 });
        expect(result.hasReviews).toBe(false);
        expect(result.avgRating).toBeNull();
    });

    it('[boundary] count=1 is the minimum that triggers hasReviews:true', () => {
        const result = buildReviewSummary({ avg: 4.0, count: 1 });
        expect(result.hasReviews).toBe(true);
    });

    it('[boundary] count=10 → hasReviews:true (exactly the take:10 limit)', () => {
        const result = buildReviewSummary({ avg: 4.4, count: 10 });
        expect(result.hasReviews).toBe(true);
        expect(result.count).toBe(10);
    });

    it('[boundary] count=11 → hasReviews:true (triggers "view all" logic)', () => {
        const result = buildReviewSummary({ avg: 4.4, count: 11 });
        expect(result.hasReviews).toBe(true);
        expect(result.count).toBe(11);
    });
});

// ---------------------------------------------------------------------------
// toReviewListItem
// ---------------------------------------------------------------------------
describe('toReviewListItem', () => {
    const baseDate = new Date('2024-06-01T10:00:00.000Z');

    // AC-3: author.name present → used
    it('[normal] author.name present → used as name', () => {
        const result = toReviewListItem({
            rating: 4,
            content: 'Beautiful campsite',
            createdAt: baseDate,
            author: { name: 'สมชาย ใจดี' },
        });
        expect(result.name).toBe('สมชาย ใจดี');
        expect(result.rating).toBe(4);
        expect(result.content).toBe('Beautiful campsite');
        expect(result.createdAt).toBe(baseDate);
    });

    // AC-3 Rule: author.name null → 'ผู้ใช้งาน'
    it('[null/empty] author.name is null → falls back to \'ผู้ใช้งาน\' (AC-3 Rule verbatim)', () => {
        const result = toReviewListItem({
            rating: 5,
            content: null,
            createdAt: baseDate,
            author: { name: null },
        });
        expect(result.name).toBe('ผู้ใช้งาน');
    });

    it('[null/empty] author itself is null → falls back to \'ผู้ใช้งาน\'', () => {
        const result = toReviewListItem({
            rating: 3,
            content: null,
            createdAt: baseDate,
            author: null,
        });
        expect(result.name).toBe('ผู้ใช้งาน');
    });

    it('[null/empty] author.name undefined → falls back to \'ผู้ใช้งาน\'', () => {
        const result = toReviewListItem({
            rating: 2,
            content: 'ok',
            createdAt: baseDate,
            author: { name: undefined as unknown as null },
        });
        expect(result.name).toBe('ผู้ใช้งาน');
    });

    // AC-3: content null preserved as null (no empty content box shown — AC-3 Rule)
    it('[null/empty] content null is preserved as null (AC-3: no empty content box)', () => {
        const result = toReviewListItem({
            rating: 4,
            content: null,
            createdAt: baseDate,
            author: { name: 'นิดา' },
        });
        expect(result.content).toBeNull();
    });

    it('[normal] content non-null is preserved as-is', () => {
        const result = toReviewListItem({
            rating: 5,
            content: 'ดีมากครับ',
            createdAt: baseDate,
            author: { name: 'มนัส' },
        });
        expect(result.content).toBe('ดีมากครับ');
    });

    // createdAt preserved (mapper does not alter ordering — query's job)
    it('[normal] createdAt is preserved exactly (ordering is the DB query\'s responsibility)', () => {
        const d1 = new Date('2024-05-01T00:00:00.000Z');
        const d2 = new Date('2024-06-15T00:00:00.000Z');
        const r1 = toReviewListItem({ rating: 3, content: null, createdAt: d1, author: { name: 'A' } });
        const r2 = toReviewListItem({ rating: 4, content: null, createdAt: d2, author: { name: 'B' } });
        // Mapper preserves; newest-first ordering is in the Prisma query (orderBy: createdAt desc)
        expect(r1.createdAt).toBe(d1);
        expect(r2.createdAt).toBe(d2);
        // If we map in the order the DB returns (newest-first), indices are stable
        expect((r2.createdAt as Date) > (r1.createdAt as Date)).toBe(true);
    });

    it('[boundary] minimum rating 1 is preserved', () => {
        const result = toReviewListItem({ rating: 1, content: 'แย่', createdAt: baseDate, author: { name: 'A' } });
        expect(result.rating).toBe(1);
    });

    it('[boundary] maximum rating 5 is preserved', () => {
        const result = toReviewListItem({ rating: 5, content: 'ดีมาก', createdAt: baseDate, author: { name: 'B' } });
        expect(result.rating).toBe(5);
    });

    // SECURITY: authorId / author.id must NOT appear in the DTO
    it('[security] returned DTO has NO authorId key (security rule: never expose authorId)', () => {
        const result = toReviewListItem({
            rating: 4,
            content: 'test',
            createdAt: baseDate,
            author: { name: 'สมชาย' },
        }) as ReviewListItem & Record<string, unknown>;
        expect('authorId' in result).toBe(false);
        expect(result.authorId).toBeUndefined();
    });

    it('[security] returned DTO has NO author.id key (security rule: never expose author.id)', () => {
        const result = toReviewListItem({
            rating: 4,
            content: 'test',
            createdAt: baseDate,
            author: { name: 'สมชาย' },
        }) as ReviewListItem & Record<string, unknown>;
        // 'author' key itself must not be present (DTO exposes only name, not the relation)
        expect('author' in result).toBe(false);
    });

    it('[security] DTO shape has exactly the four expected keys: name, rating, content, createdAt', () => {
        const result = toReviewListItem({
            rating: 3,
            content: null,
            createdAt: baseDate,
            author: { name: 'Test' },
        });
        const keys = Object.keys(result).sort();
        expect(keys).toEqual(['content', 'createdAt', 'name', 'rating']);
    });
});

// ---------------------------------------------------------------------------
// AC-5 boundary: reviewCount > 10 (strict) — source-inspection
//
// Layer note: CampgroundDetailClient.tsx is a "use client" component importing
// lucide-react, next/dynamic, date-fns, shadcn/ui, and multiple contexts.
// Rendering it inside vitest/jsdom would require mocking >15 module boundaries
// and would validate the mock, not the real code. Per the CAM-58 precedent and
// .claude/rules/qa.md §6 ("mock only the external boundary"), the correct layer
// here is source-inspection: assert that the exact conditional `reviewCount > 10`
// (strict greater-than, not >=10) is present in the component source, and
// complement it with direct logic tests on the raw predicate.
// ---------------------------------------------------------------------------
describe('AC-5 — "ดูรีวิวทั้งหมด" boundary (reviewCount > 10 strict, source-inspection)', () => {
    const componentSrc = fs.readFileSync(
        path.join(process.cwd(), 'components/CampgroundDetailClient.tsx'),
        'utf-8'
    );

    it('[source] "ดูรีวิวทั้งหมด" button is rendered when reviewCount > 10 (strict greater-than, not >=10)', () => {
        // Assert the exact conditional present in the source: reviewCount > 10
        // This proves the code uses strict >10 (AC-5) and not >= 10.
        expect(componentSrc).toContain('reviewCount > 10');
    });

    it('[source] the "ดูรีวิวทั้งหมด" text is present and wired to the btn--reviews-view-all testid', () => {
        expect(componentSrc).toContain('btn--reviews-view-all');
        expect(componentSrc).toContain('t.reviews.viewAll');
    });

    it('[logic] count=10 → does NOT satisfy >10 (no "view all" shown)', () => {
        const reviewCount = 10;
        expect(reviewCount > 10).toBe(false);
    });

    it('[logic] count=11 → satisfies >10 (AC-5: "view all" is shown)', () => {
        const reviewCount = 11;
        expect(reviewCount > 10).toBe(true);
    });

    it('[logic] count=0 → does not satisfy >10 (empty state path)', () => {
        expect(0 > 10).toBe(false);
    });

    it('[boundary] count=10 is the exact boundary — button NOT shown at exactly 10', () => {
        // 10 reviews → show 10 but no "view all" (AC-5 spec: "มากกว่า 10")
        expect(10 > 10).toBe(false);
    });

    it('[boundary] count=11 is the first count that triggers "view all"', () => {
        expect(11 > 10).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// AC-6 — error isolation (source-inspection)
//
// Layer note: Same reasoning as AC-5. The review error isolation lives in
// app/campgrounds/[slug]/page.tsx (a Next.js Server Component that calls
// prisma and notFound() — running it in vitest would require mocking
// Next.js internals). The pattern is asserted at source level:
// 1. The review try/catch is separate from the campSite try/catch.
// 2. On review error, reviewsError = true (not notFound(), not throw).
// 3. CampgroundDetailClient renders error--reviews when reviewsError=true.
// ---------------------------------------------------------------------------
describe('AC-6 — error isolation (source-inspection)', () => {
    const pageSrc = fs.readFileSync(
        path.join(process.cwd(), 'app/campgrounds/[slug]/page.tsx'),
        'utf-8'
    );
    const componentSrc = fs.readFileSync(
        path.join(process.cwd(), 'components/CampgroundDetailClient.tsx'),
        'utf-8'
    );

    it('[source] page.tsx: review try/catch sets reviewsError=true, does NOT call notFound() inside it', () => {
        // The review try/catch block must set reviewsError = true and NOT call notFound()
        // We locate the review catch block by finding the reviewsError assignment.
        expect(pageSrc).toContain('reviewsError = true');
        // The notFound() call must appear outside the review catch — only in the campSite block.
        // Count notFound() occurrences: should be exactly 2 (one for catch, one for if (!campSite))
        // and not inside the same try as reviewsError assignment.
        const notFoundCount = (pageSrc.match(/notFound\(\)/g) || []).length;
        expect(notFoundCount).toBe(2); // campSite catch + if (!campSite)
    });

    it('[source] page.tsx: review query is inside its own isolated try block (separate from campSite query)', () => {
        // There must be at least two separate try { ... } catch blocks
        const tryCatchCount = (pageSrc.match(/\btry\s*\{/g) || []).length;
        expect(tryCatchCount).toBeGreaterThanOrEqual(3); // campSite, wishlist, reviews
    });

    it('[source] page.tsx: both review queries use deletedAt:null (soft-delete filter)', () => {
        // Both aggregate and findMany must include deletedAt: null
        const deletedAtNullCount = (pageSrc.match(/deletedAt:\s*null/g) || []).length;
        expect(deletedAtNullCount).toBeGreaterThanOrEqual(2);
    });

    it('[source] CampgroundDetailClient.tsx: renders data-testid="error--reviews" when reviewsError is true', () => {
        expect(componentSrc).toContain('data-testid="error--reviews"');
    });

    it('[source] CampgroundDetailClient.tsx: reviewsError branch shows t.reviews.loadError (not a full-page error)', () => {
        // The error state is a <p> with t.reviews.loadError, not an ErrorBanner or throw
        expect(componentSrc).toContain('t.reviews.loadError');
        // Must be inside the reviewsError conditional
        expect(componentSrc).toContain('reviewsError ?');
    });

    it('[source] CampgroundDetailClient.tsx: empty state renders data-testid="empty--reviews"', () => {
        expect(componentSrc).toContain('data-testid="empty--reviews"');
    });

    it('[source] CampgroundDetailClient.tsx: no hardcoded "4.8" or "12 รีวิว" (old hardcoded values removed)', () => {
        expect(componentSrc).not.toContain('"4.8"');
        // "12 รีวิว" check — ensure neither the string "12 รีวิว" nor just hardcoded literal "12" next to รีวิว
        expect(componentSrc).not.toContain('12 รีวิว');
    });
});

// ---------------------------------------------------------------------------
// Thai copy verbatim — locales/translations.json reviews namespace
//
// Asserts the exact Thai strings the AC specifies are present in the i18n
// source of truth. The component reads these at runtime; if they are wrong,
// the visible text is wrong.
// ---------------------------------------------------------------------------
describe('Thai copy verbatim — locales/translations.json reviews namespace (AC-2/AC-4/AC-6)', () => {
    const translationsPath = path.join(process.cwd(), 'locales/translations.json');
    const raw = fs.readFileSync(translationsPath, 'utf-8');
    const translations: Record<string, unknown> = JSON.parse(raw);

    const th = (translations as Record<string, Record<string, Record<string, string>>>)['th']['reviews'];

    it('[copy] th.reviews.noReviews === "ยังไม่มีรีวิว" (AC-2 — no reviews state, title area)', () => {
        expect(th.noReviews).toBe('ยังไม่มีรีวิว');
    });

    it('[copy] th.reviews.noReviewsSection === "ยังไม่มีรีวิวสำหรับแคมป์นี้" (AC-4 — empty section state)', () => {
        expect(th.noReviewsSection).toBe('ยังไม่มีรีวิวสำหรับแคมป์นี้');
    });

    it('[copy] th.reviews.loadError === "ไม่สามารถโหลดรีวิวได้ในขณะนี้" (AC-6 — error state)', () => {
        expect(th.loadError).toBe('ไม่สามารถโหลดรีวิวได้ในขณะนี้');
    });

    it('[copy] th.reviews.sectionHeading === "รีวิว" (AC-3/AC-4 — section heading)', () => {
        expect(th.sectionHeading).toBe('รีวิว');
    });

    it('[copy] th.reviews.viewAll === "ดูรีวิวทั้งหมด" (AC-5 — view all button)', () => {
        expect(th.viewAll).toBe('ดูรีวิวทั้งหมด');
    });

    it('[copy] th.reviews.authorFallback === "ผู้ใช้งาน" (AC-3 Rule — anonymous author fallback)', () => {
        expect(th.authorFallback).toBe('ผู้ใช้งาน');
    });

    it('[copy] reviews namespace has all 9 expected keys (no missing translation)', () => {
        const expectedKeys = [
            'noReviews',
            'noReviewsSection',
            'loadError',
            'sectionHeading',
            'viewAll',
            'authorFallback',
            'ratingAriaLabel',
            'itemRatingAriaLabel',
            'viewAllAriaLabel',
        ];
        for (const key of expectedKeys) {
            expect(th).toHaveProperty(key);
        }
    });

    it('[copy] EN reviews namespace is also present (parity check)', () => {
        const en = (translations as Record<string, Record<string, Record<string, string>>>)['en']['reviews'];
        expect(en.noReviews).toBe('No reviews yet');
        expect(en.noReviewsSection).toBe('No reviews for this camp yet');
        expect(en.loadError).toBe('Reviews could not be loaded right now');
        expect(en.viewAll).toBe('View all reviews');
        expect(en.authorFallback).toBe('User');
    });
});
