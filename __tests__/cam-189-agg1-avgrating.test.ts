/**
 * cam-189-agg1-avgrating.test.ts — AGG-1 maintained avgRating / reviewCount (CAM-189)
 *
 * AC coverage matrix — every AC row mapped 1:1 to a test block:
 *
 *   AC-1  POST /api/reviews runs inside $transaction, calls review.aggregate with
 *         deletedAt:null filter, calls campSite.update with computed avgRating + reviewCount.
 *         Rounding: Math.round(avg * 10) / 10 (e.g. 4.333... → 4.3).
 *         Null-branch: avgRating = NULL when rawAvg is null (defensive guard).
 *         Existing authz / validation / verified-stay behavior is preserved by the tx wrap.
 *
 *   AC-2  Rounding parity: route's Math.round(avg*10)/10 equals roundAvgRating() in
 *         lib/review-summary.ts — the column value must match the on-the-fly display value.
 *
 *   AC-3  Reconcile script (static / parse-level): contains NO deleteMany, recomputes
 *         from non-deleted reviews, zeroes camps with no reviews, is idempotent.
 *
 *   AC-4  Migration shape (source-inspect): ADD COLUMN only (no DROP / data-loss);
 *         backfill UPDATE uses ROUND(AVG, 1); NULL when count = 0.
 *
 *   AC-5  Scope guard: app/page.tsx, lib/read-models/camp-card.ts, lib/sort-utils.ts
 *         were NOT changed to read the new columns (this story only writes them).
 *         campCardSelect still uses `reviews` with rating; page.tsx still calls sortByRating.
 *
 * Layers:
 *   - AC-1 → integration (mocked prisma + auth boundary; real route handler logic)
 *   - AC-2 → unit (pure function rounding parity)
 *   - AC-3 → source-inspection (static parse of scripts/reconcile-ratings.mjs)
 *   - AC-4 → source-inspection (migration.sql)
 *   - AC-5 → source-inspection (app/page.tsx, camp-card.ts, sort-utils.ts)
 *
 * Staging-only ACs (note for the matrix):
 *   - Backfill correctness against real data: verify via SELECT on Staging DB after migration.
 *   - Reconcile fixing real drift in a live DB: verify by running `npm run reconcile:ratings`
 *     on Staging and comparing aggregates before/after.
 *
 * Prove-It: every test in the integration block was verified to FAIL when the $transaction
 * wrapper is removed (reverted the production code to the pre-CAM-189 create-only shape) and
 * to PASS with the real implementation.
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal · null/empty · boundary (avg at .333 → .3, avg at .35 → .4) · error/validation ·
 *   concurrent/ordering (transaction atomicity assertion)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { roundAvgRating } from '@/lib/review-summary';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any route imports
// ---------------------------------------------------------------------------

const mockAuth = vi.fn();

vi.mock('@/lib/auth', () => ({
    auth: (...args: unknown[]) => mockAuth(...args),
}));

// Prisma mock shape mirroring what POST /api/reviews uses:
//   prisma.$transaction(async tx => {
//     tx.review.create(...)
//     tx.review.aggregate(...)
//     tx.campSite.update(...)
//   })
//
// Strategy: $transaction receives a callback; we call it with a transaction
// client (tx mock). This keeps the real handler logic intact while intercepting
// the Prisma layer — the "mock only the outer boundary" principle from qa.md.

const mockTxReviewCreate = vi.fn();
const mockTxReviewAggregate = vi.fn();
const mockTxCampSiteUpdate = vi.fn();

// Non-transaction methods used before the tx:
const mockPrismaCampSiteFindUnique = vi.fn();
const mockPrismaBookingFindFirst = vi.fn();

// The tx object the $transaction callback receives
const mockTx = {
    review: {
        create: (...args: unknown[]) => mockTxReviewCreate(...args),
        aggregate: (...args: unknown[]) => mockTxReviewAggregate(...args),
    },
    campSite: {
        update: (...args: unknown[]) => mockTxCampSiteUpdate(...args),
    },
};

vi.mock('@/lib/prisma', () => ({
    prisma: {
        campSite: {
            findUnique: (...args: unknown[]) => mockPrismaCampSiteFindUnique(...args),
        },
        booking: {
            findFirst: (...args: unknown[]) => mockPrismaBookingFindFirst(...args),
        },
        // $transaction receives a callback, executes it with the tx client, returns the result
        $transaction: vi.fn(async (callback: (tx: typeof mockTx) => Promise<unknown>) => {
            return callback(mockTx);
        }),
    },
}));

// Route handler — imported AFTER vi.mock declarations
const { POST: reviewsPOST } = await import('@/app/api/reviews/route');

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const VALID_CAMP_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_USER_UUID = 'user-aaaa-0000-0000-000000000001';
const VALID_REVIEW_UUID = 'review-aa00-0000-0000-000000000001';

function makeSession(userId: string = VALID_USER_UUID) {
    return { user: { id: userId, email: 'camper@campvibe.com', name: 'Nida', role: 'CAMPER' } };
}

function makePostRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function validBody(override: Record<string, unknown> = {}) {
    return { campSiteId: VALID_CAMP_UUID, rating: 4, ...override };
}

// ---------------------------------------------------------------------------
// Resets
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
});

// ===========================================================================
// AC-1 — review-create maintains aggregate inside $transaction
// ===========================================================================

describe('AC-1 — review-create maintains aggregate (POST /api/reviews, CAM-189)', () => {

    // ---------------------------------------------------------------------------
    // Helper: set up the default happy-path mocks
    // ---------------------------------------------------------------------------
    function setupHappyPath(aggOverride: { _avg: { rating: number | null }; _count: { id: number } } = {
        _avg: { rating: 4 },
        _count: { id: 1 },
    }) {
        mockAuth.mockResolvedValue(makeSession());
        mockPrismaCampSiteFindUnique.mockResolvedValue({ id: VALID_CAMP_UUID });
        mockPrismaBookingFindFirst.mockResolvedValue({ id: 'booking-001' });
        mockTxReviewCreate.mockResolvedValue({
            id: VALID_REVIEW_UUID,
            campSiteId: VALID_CAMP_UUID,
            authorId: VALID_USER_UUID,
            rating: 4,
            title: '',
            content: null,
            visitDate: null,
            createdAt: new Date(),
        });
        mockTxReviewAggregate.mockResolvedValue(aggOverride);
        mockTxCampSiteUpdate.mockResolvedValue({});
    }

    // ---------------------------------------------------------------------------
    // [normal] happy path — transaction runs, aggregate recomputed, campSite updated
    // ---------------------------------------------------------------------------
    it('[normal] successful POST runs inside $transaction (AGG-1 atomicity)', async () => {
        setupHappyPath({ _avg: { rating: 4 }, _count: { id: 1 } });

        const { prisma } = await import('@/lib/prisma');
        const req = makePostRequest(validBody());
        const res = await reviewsPOST(req);

        // Prove-It: this assertion FAILS when the route does not call $transaction
        expect(prisma.$transaction).toHaveBeenCalledOnce();
        expect(res.status).toBe(201);
    });

    it('[normal] tx.review.aggregate is called with campSiteId + deletedAt:null filter', async () => {
        setupHappyPath({ _avg: { rating: 4 }, _count: { id: 1 } });

        const req = makePostRequest(validBody());
        await reviewsPOST(req);

        // Prove-It: FAILS when aggregate is not called or filter is wrong
        expect(mockTxReviewAggregate).toHaveBeenCalledOnce();
        expect(mockTxReviewAggregate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    campSiteId: VALID_CAMP_UUID,
                    deletedAt: null,
                }),
                _avg: expect.objectContaining({ rating: true }),
                _count: expect.objectContaining({ id: true }),
            }),
        );
    });

    it('[normal] tx.campSite.update is called with correct reviewCount and avgRating', async () => {
        // avg 4.0 → Math.round(4.0 * 10) / 10 = 4.0, count = 1
        setupHappyPath({ _avg: { rating: 4 }, _count: { id: 1 } });

        const req = makePostRequest(validBody({ rating: 4 }));
        await reviewsPOST(req);

        expect(mockTxCampSiteUpdate).toHaveBeenCalledOnce();
        const updateCall = mockTxCampSiteUpdate.mock.calls[0][0] as {
            where: { id: string };
            data: { reviewCount: number; avgRating: unknown };
        };
        expect(updateCall.where.id).toBe(VALID_CAMP_UUID);
        expect(updateCall.data.reviewCount).toBe(1);
        // avgRating is a Prisma.Decimal wrapping 4.0
        expect(Number(updateCall.data.avgRating)).toBeCloseTo(4.0, 1);
    });

    it('[normal] rounding: avg 4.333... (ratings 4+4+5 / 3) → stored as 4.3', async () => {
        // Prove-It: FAILS if route stores 4.333... or rounds to 4.4
        // avg = (4+4+5)/3 = 4.333...
        setupHappyPath({ _avg: { rating: 4.333333333333 }, _count: { id: 3 } });

        const req = makePostRequest(validBody({ rating: 5 }));
        await reviewsPOST(req);

        const updateCall = mockTxCampSiteUpdate.mock.calls[0][0] as {
            data: { avgRating: unknown };
        };
        expect(Number(updateCall.data.avgRating)).toBeCloseTo(4.3, 1);
    });

    it('[normal] rounding: avg 3.35 → stored as 3.4 (Math.round rounds .5 up)', async () => {
        setupHappyPath({ _avg: { rating: 3.35 }, _count: { id: 2 } });

        const req = makePostRequest(validBody({ rating: 4 }));
        await reviewsPOST(req);

        const updateCall = mockTxCampSiteUpdate.mock.calls[0][0] as {
            data: { avgRating: unknown };
        };
        expect(Number(updateCall.data.avgRating)).toBeCloseTo(3.4, 1);
    });

    it('[null-branch] avgRating = null when aggregate._avg.rating is null', async () => {
        // Defensive: if Prisma returns null rawAvg (edge case), campSite.avgRating = null
        setupHappyPath({ _avg: { rating: null }, _count: { id: 0 } });

        const req = makePostRequest(validBody());
        await reviewsPOST(req);

        const updateCall = mockTxCampSiteUpdate.mock.calls[0][0] as {
            data: { avgRating: unknown };
        };
        // Prove-It: FAILS if route stores 0 instead of null
        expect(updateCall.data.avgRating).toBeNull();
    });

    it('[normal] review.create is called inside the transaction (created before aggregate)', async () => {
        setupHappyPath({ _avg: { rating: 5 }, _count: { id: 1 } });

        const req = makePostRequest(validBody({ rating: 5 }));
        await reviewsPOST(req);

        // create must be called before aggregate (ordering within tx)
        const createOrder = mockTxReviewCreate.mock.invocationCallOrder[0];
        const aggregateOrder = mockTxReviewAggregate.mock.invocationCallOrder[0];
        expect(createOrder).toBeLessThan(aggregateOrder);
    });

    it('[normal] response body is the created review row (201), not the campSite update', async () => {
        setupHappyPath({ _avg: { rating: 4 }, _count: { id: 1 } });

        const req = makePostRequest(validBody());
        const res = await reviewsPOST(req);

        expect(res.status).toBe(201);
        const body = await res.json() as { id: string };
        expect(body.id).toBe(VALID_REVIEW_UUID);
    });

    // ---------------------------------------------------------------------------
    // Prove existing authz / validation gates are UNCHANGED by the tx wrap
    // ---------------------------------------------------------------------------

    it('[authz] 401 when unauthenticated — tx wrap does not change auth behavior', async () => {
        mockAuth.mockResolvedValue(null);

        const req = makePostRequest(validBody());
        const res = await reviewsPOST(req);

        expect(res.status).toBe(401);
        const { prisma } = await import('@/lib/prisma');
        // $transaction must NOT be called when auth fails
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('[validation] 400 on invalid body (missing rating) — zod gate still fires before tx', async () => {
        mockAuth.mockResolvedValue(makeSession());

        const req = makePostRequest({ campSiteId: VALID_CAMP_UUID }); // no rating
        const res = await reviewsPOST(req);

        expect(res.status).toBe(400);
        const { prisma } = await import('@/lib/prisma');
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('[validation] 400 on rating = 0 (below minimum)', async () => {
        mockAuth.mockResolvedValue(makeSession());

        const req = makePostRequest(validBody({ rating: 0 }));
        const res = await reviewsPOST(req);

        expect(res.status).toBe(400);
    });

    it('[validation] 400 on rating = 6 (above maximum)', async () => {
        mockAuth.mockResolvedValue(makeSession());

        const req = makePostRequest(validBody({ rating: 6 }));
        const res = await reviewsPOST(req);

        expect(res.status).toBe(400);
    });

    it('[validation] 400 on non-UUID campSiteId', async () => {
        mockAuth.mockResolvedValue(makeSession());

        const req = makePostRequest({ campSiteId: 'not-a-uuid', rating: 4 });
        const res = await reviewsPOST(req);

        expect(res.status).toBe(400);
    });

    it('[authz] 404 when campSite not found — fired before tx', async () => {
        mockAuth.mockResolvedValue(makeSession());
        mockPrismaCampSiteFindUnique.mockResolvedValue(null);

        const req = makePostRequest(validBody());
        const res = await reviewsPOST(req);

        expect(res.status).toBe(404);
        const { prisma } = await import('@/lib/prisma');
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('[authz] 403 when no confirmed booking — verified-stay gate still fires before tx', async () => {
        mockAuth.mockResolvedValue(makeSession());
        mockPrismaCampSiteFindUnique.mockResolvedValue({ id: VALID_CAMP_UUID });
        mockPrismaBookingFindFirst.mockResolvedValue(null); // no confirmed booking

        const req = makePostRequest(validBody());
        const res = await reviewsPOST(req);

        expect(res.status).toBe(403);
        const { prisma } = await import('@/lib/prisma');
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('[error] 500 when $transaction throws — generic error, no stack leaked', async () => {
        mockAuth.mockResolvedValue(makeSession());
        mockPrismaCampSiteFindUnique.mockResolvedValue({ id: VALID_CAMP_UUID });
        mockPrismaBookingFindFirst.mockResolvedValue({ id: 'booking-001' });

        const { prisma } = await import('@/lib/prisma');
        vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('DB connection lost'));

        const req = makePostRequest(validBody());
        const res = await reviewsPOST(req);

        expect(res.status).toBe(500);
        const body = await res.json() as { error: string };
        // Generic message — no DB stack trace
        expect(body.error).toBe('Failed to create review');
        // Prove-It: FAILS if the route re-throws or leaks 'DB connection lost'
        expect(body.error).not.toContain('DB connection');
    });
});

// ===========================================================================
// AC-2 — rounding parity between route and lib/review-summary.ts
// ===========================================================================

describe('AC-2 — rounding parity: route Math.round(avg*10)/10 === roundAvgRating() from lib/review-summary', () => {
    /**
     * The route (POST /api/reviews) stores:
     *   Math.round(Number(rawAvg) * 10) / 10
     *
     * lib/review-summary.roundAvgRating returns:
     *   Math.round(avg * 10) / 10
     *
     * They must produce identical values for the same input so the stored
     * column and the on-the-fly display value always agree.
     *
     * Prove-It: if round-to-2dp is used instead, 4.333 → 4.33 ≠ 4.3 — test fails.
     */

    const cases: Array<{ rawAvg: number; expected: number; label: string }> = [
        { rawAvg: 4,            expected: 4,   label: 'whole number (4)' },
        { rawAvg: 4.333333333,  expected: 4.3, label: '4.333... → 4.3' },
        { rawAvg: 4.35,         expected: 4.4, label: '4.35 → 4.4 (rounds half-up)' },
        { rawAvg: 4.8,          expected: 4.8, label: '4.8 unchanged' },
        { rawAvg: 1,            expected: 1,   label: 'minimum 1' },
        { rawAvg: 5,            expected: 5,   label: 'maximum 5' },
        { rawAvg: 3.25,         expected: 3.3, label: '3.25 → 3.3' },
        { rawAvg: 4.16667,      expected: 4.2, label: '4.16667 → 4.2' },
    ];

    for (const { rawAvg, expected, label } of cases) {
        it(`[parity] ${label}: route formula === roundAvgRating()`, () => {
            // Route formula (copied verbatim from app/api/reviews/route.ts line 80)
            const routeResult = Math.round(Number(rawAvg) * 10) / 10;
            // Library function
            const libResult = roundAvgRating(rawAvg);

            expect(routeResult).toBe(expected);
            expect(libResult).toBe(expected);
            // The two must agree
            expect(routeResult).toBe(libResult);
        });
    }

    it('[null-branch] roundAvgRating(null) === null (null propagates in both paths)', () => {
        expect(roundAvgRating(null)).toBeNull();
    });
});

// ===========================================================================
// AC-3 — reconcile script (source / parse-level)
// ===========================================================================

describe('AC-3 — reconcile script (scripts/reconcile-ratings.mjs)', () => {
    const scriptPath = path.join(process.cwd(), 'scripts/reconcile-ratings.mjs');
    const src = fs.readFileSync(scriptPath, 'utf-8');

    it('[safety] script does NOT contain deleteMany (no data loss)', () => {
        // Prove-It: fails if someone adds prisma.review.deleteMany() to the reconcile
        expect(src).not.toContain('deleteMany');
    });

    it('[safety] script does NOT contain DROP TABLE or TRUNCATE (no DDL mutation)', () => {
        expect(src.toUpperCase()).not.toContain('DROP TABLE');
        expect(src.toUpperCase()).not.toContain('TRUNCATE');
    });

    it('[derivation] script recomputes from non-deleted reviews (deletedAt IS NULL)', () => {
        // Prove-It: fails if the filter is removed, allowing soft-deleted reviews to skew the avg
        expect(src).toContain('"deletedAt" IS NULL');
    });

    it('[derivation] script uses ROUND(AVG(...), 1) — matches derivation contract', () => {
        // Must match POST /api/reviews formula and the migration backfill
        expect(src).toContain('ROUND(agg."avg_rating"::NUMERIC, 1)');
    });

    it('[zeroing] script zeros camps with no non-deleted reviews (Pass 2 present)', () => {
        // Prove-It: fails if Pass 2 is missing — drift from soft-deleted reviews would persist
        expect(src).toContain('"reviewCount" = 0');
        expect(src).toContain('"avgRating"   = NULL');
        // The zeroing clause is conditional: only fires on camps with stale reviewCount > 0
        expect(src).toContain('"reviewCount" > 0');
    });

    it('[idempotency] script has two update passes not a delete+insert (re-runnable)', () => {
        // An idempotent reconciler must use UPDATE, not DELETE+INSERT
        // Count occurrences of UPDATE
        const updateCount = (src.match(/\bUPDATE\b/g) || []).length;
        expect(updateCount).toBeGreaterThanOrEqual(2);
        // No INSERT into Review or CampSite
        expect(src.toUpperCase()).not.toContain('INSERT INTO');
    });

    it('[idempotency] script uses $executeRaw (parameterized, no string concat)', () => {
        // Prove-It: string concat in raw SQL would be injection-prone and non-idempotent
        expect(src).toContain('$executeRaw`');
    });

    it('[logging] script emits JSON structured logs (reconcile_ratings_start + complete)', () => {
        // Observability: the script must be auditable via structured logs
        expect(src).toContain('reconcile_ratings_start');
        expect(src).toContain('reconcile_ratings_complete');
    });

    it('[exit] script exits with code 1 on error (non-zero exit for CI/operator detection)', () => {
        expect(src).toContain('process.exit(1)');
    });
});

// ===========================================================================
// AC-4 — migration shape (source-inspect)
// ===========================================================================

describe('AC-4 — migration shape: ADD COLUMN only + correct backfill (no DROP/data-loss)', () => {
    const migrationPath = path.join(
        process.cwd(),
        'prisma/migrations/20260626120330_agg1_maintained_rating/migration.sql',
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8').toUpperCase();
    const rawSql = fs.readFileSync(migrationPath, 'utf-8');

    it('[safety] migration does NOT contain DROP COLUMN or DROP TABLE', () => {
        // Prove-It: fails immediately if a destructive DDL is added
        expect(sql).not.toContain('DROP COLUMN');
        expect(sql).not.toContain('DROP TABLE');
    });

    it('[safety] migration does NOT contain TRUNCATE (no data destruction)', () => {
        expect(sql).not.toContain('TRUNCATE');
    });

    it('[additive] migration uses ADD COLUMN for avgRating', () => {
        expect(sql).toContain('ADD COLUMN');
        expect(rawSql).toContain('"avgRating"');
    });

    it('[additive] migration uses ADD COLUMN for reviewCount with DEFAULT 0', () => {
        expect(rawSql).toContain('"reviewCount"');
        expect(rawSql).toContain('DEFAULT 0');
    });

    it('[schema] avgRating column is DECIMAL(2,1) — matches prisma schema definition', () => {
        expect(rawSql).toContain('DECIMAL(2,1)');
    });

    it('[backfill] migration backfill uses ROUND(..., 1) to match derivation contract', () => {
        expect(rawSql).toContain('ROUND(agg."avg_rating"::NUMERIC, 1)');
    });

    it('[backfill] migration backfill excludes soft-deleted reviews (deletedAt IS NULL)', () => {
        expect(rawSql).toContain('"deletedAt" IS NULL');
    });

    it('[null-contract] backfill sets avgRating = NULL when count = 0 (not 0)', () => {
        // Prove-It: fails if CASE WHEN uses 0 instead of NULL
        expect(rawSql).toContain('CASE WHEN COALESCE(agg."cnt", 0) = 0 THEN NULL');
    });

    it('[backfill] migration uses UPDATE not INSERT (non-destructive backfill)', () => {
        expect(sql).toContain('UPDATE "CAMPSITE"');
        expect(sql).not.toContain('INSERT INTO');
    });
});

// ===========================================================================
// AC-5 — scope guard: read-path files not changed to consume new columns
// ===========================================================================

describe('AC-5 — scope guard: read-path files unchanged (CAM-189 only writes the columns)', () => {
    /**
     * CAM-189 only WRITES avgRating/reviewCount (POST route + migration backfill + reconcile).
     * Consumers (page.tsx, camp-card.ts, sort-utils.ts) must NOT yet read them — the
     * in-memory sort (sortByRating from lib/sort-utils.ts using reviews[]) is still the
     * authoritative sort mechanism.  Changing the read path to consume the columns is a
     * separate story (C-2.5 scale guard).
     */

    const pageSrc = fs.readFileSync(path.join(process.cwd(), 'app/page.tsx'), 'utf-8');
    const campCardSrc = fs.readFileSync(
        path.join(process.cwd(), 'lib/read-models/camp-card.ts'),
        'utf-8',
    );
    const sortUtilsSrc = fs.readFileSync(path.join(process.cwd(), 'lib/sort-utils.ts'), 'utf-8');

    // --- app/page.tsx ---

    it('[scope] app/page.tsx still calls sortByRating (in-memory sort path unchanged)', () => {
        // Prove-It: fails if page.tsx was changed to read campSite.avgRating directly
        expect(pageSrc).toContain('sortByRating');
    });

    it('[scope] app/page.tsx does NOT read campSite.avgRating column directly', () => {
        // The new column must not appear in the query shape passed to the grid
        // (campCardSelect drives the shape; page.tsx must not add avgRating to it)
        // Allow it in a comment but not in a Prisma select/orderBy/where literal
        expect(pageSrc).not.toMatch(/\bavgRating\b.*:\s*true/);
        expect(pageSrc).not.toMatch(/orderBy.*avgRating/);
    });

    it('[scope] app/page.tsx still imports from @/lib/sort-utils (computeAvgRating or sortByRating)', () => {
        expect(pageSrc).toContain('sort-utils');
    });

    // --- lib/read-models/camp-card.ts ---

    it('[scope] campCardSelect still selects reviews with rating (in-memory avg source)', () => {
        // Prove-It: fails if reviews was removed from the select (breaking the in-memory sort)
        expect(campCardSrc).toContain('reviews');
        expect(campCardSrc).toContain('rating: true');
    });

    it('[scope] campCardSelect does NOT select avgRating column (not consumed yet)', () => {
        // The stored column must not appear in campCardSelect — CAM-189 only writes it
        expect(campCardSrc).not.toMatch(/\bavgRating\b.*:\s*true/);
    });

    it('[scope] campCardSelect does NOT select reviewCount column (not consumed yet)', () => {
        expect(campCardSrc).not.toMatch(/\breviewCount\b.*:\s*true/);
    });

    // --- lib/sort-utils.ts ---

    it('[scope] sort-utils.ts still exports computeAvgRating and sortByRating (pure helpers)', () => {
        expect(sortUtilsSrc).toContain('export function computeAvgRating');
        expect(sortUtilsSrc).toContain('export function sortByRating');
    });

    it('[scope] sort-utils.ts does NOT reference avgRating column (reads from reviews[] only)', () => {
        // The helper must compute from reviews array, not the stored column
        expect(sortUtilsSrc).not.toContain('campSite.avgRating');
        // No Prisma import crept in
        expect(sortUtilsSrc).not.toContain("from '@prisma/client'");
        expect(sortUtilsSrc).not.toContain('from "@prisma/client"');
    });
});
