/**
 * cam-269-verified-stay-gate.test.ts — PREP-3 verified-stay gate for reviews (CAM-269)
 *
 * Ground truth (established before writing this story — see PR body for the full
 * write-up): POST /api/reviews already required auth + SOME booking check before this
 * story, but the check was incomplete against the ticket's Rule:
 *   - it accepted status CONFIRMED (a reservation), not COMPLETED (a stay that happened)
 *   - it never checked checkInDate had passed ("ผ่านวันเข้าพัก")
 *   - it had no bookingId / verified column and no one-review-per-booking dedupe (no 409)
 * This story closes those three gaps. It does NOT touch auth (already correct, 401)
 * and does NOT touch input validation (already correct zod boundary, 400 — see
 * reviews-authz.test.ts, unchanged).
 *
 * AC coverage matrix (ticket CAM-269, every row → at least one test):
 *   AC-1  No qualifying booking at all → 403, server does not create a review.
 *   AC-2  A qualifying (COMPLETED, past checkInDate) booking → 201, review.verified=true,
 *         review.bookingId bound to that booking.
 *   AC-3  Review list query filters `verified: true` — asserted via source-inspection on
 *         app/campgrounds/[slug]/page.tsx (a Next.js Server Component; running it under
 *         vitest would need mocking >10 module boundaries incl. auth/session/notFound —
 *         the CAM-58/CAM-79 precedent for this exact file is source-inspection).
 *
 * Rules coverage (business rule, not just the AC's happy/sad path):
 *   - status alone is not enough: CONFIRMED/PAID/PENDING/CANCELLED bookings must NOT qualify.
 *   - checkInDate alone is not enough: a COMPLETED booking with a FUTURE checkInDate (host
 *     mistake) must NOT qualify — enforced twice (DB `where` filter AND an application-level
 *     hasStayOccurred() re-check, defense-in-depth per security.md "assume breach") and
 *     proven at both the query-shape layer and the application-filter layer below.
 *   - one review per booking (409) — proven both via the pre-check dedupe path and via the
 *     DB unique-constraint race backstop (P2002 → 409, never a raw 500).
 *   - authz stays server-side: authorId/bookingId always derived from session + the
 *     server's own qualifying-booking lookup — never from the request body.
 *
 * Layers:
 *   - hasStayOccurred / canReview → unit (pure functions, no DB, no mocked boundary)
 *   - POST /api/reviews gate (401/403/409/201) → integration (mocked prisma + auth
 *     boundary; real route handler logic — same "mock only the outer boundary"
 *     strategy as cam-189-agg1-avgrating.test.ts)
 *   - AC-3 list filter → source-inspection (page.tsx)
 *
 * Prove-It: every [prove-it] test below was verified to FAIL against the PRE-CAM-269
 * route (VERIFIED_STAY_STATUSES = ['CONFIRMED'], booking.findFirst with no checkInDate
 * filter, no bookingId/verified, no dedupe) and to PASS against the CAM-269 implementation.
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal · null/empty · boundary (checkInDate exactly now, exactly one qualifying
 *   booking vs many) · error/validation (401/403/409) · concurrent/ordering (P2002 race)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
// Real '@prisma/client' package (not mocked) — only '@/lib/prisma' (our own facade) is
// mocked below, same strategy as cam-189-agg1-avgrating.test.ts. Using the REAL
// Prisma.PrismaClientKnownRequestError means the route's `instanceof` check is exercised
// against the actual class it imports, not a hand-rolled look-alike.
import { Prisma } from '@prisma/client';
import { canReview, hasStayOccurred, VERIFIED_STAY_STATUSES } from '@/lib/validations/review';
import { _store as rateLimitStore } from '@/lib/rate-limit';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any route imports
// ---------------------------------------------------------------------------

const mockAuth = vi.fn();

vi.mock('@/lib/auth', () => ({
    auth: (...args: unknown[]) => mockAuth(...args),
}));

const mockTxReviewCreate = vi.fn();
const mockTxReviewAggregate = vi.fn();
const mockTxCampSiteUpdate = vi.fn();

const mockPrismaCampSiteFindUnique = vi.fn();
const mockPrismaBookingFindMany = vi.fn();

const mockTx = {
    review: {
        create: (...args: unknown[]) => mockTxReviewCreate(...args),
        aggregate: (...args: unknown[]) => mockTxReviewAggregate(...args),
    },
    campSite: {
        update: (...args: unknown[]) => mockTxCampSiteUpdate(...args),
    },
};

function makeP2002(message: string): InstanceType<typeof Prisma.PrismaClientKnownRequestError> {
    return new Prisma.PrismaClientKnownRequestError(message, { code: 'P2002', clientVersion: '5.22.0' });
}

vi.mock('@/lib/prisma', () => ({
    prisma: {
        campSite: {
            findUnique: (...args: unknown[]) => mockPrismaCampSiteFindUnique(...args),
        },
        booking: {
            findMany: (...args: unknown[]) => mockPrismaBookingFindMany(...args),
        },
        $transaction: vi.fn(async (callback: (tx: typeof mockTx) => Promise<unknown>) => {
            return callback(mockTx);
        }),
    },
}));

// Route handler — imported AFTER vi.mock declarations
const { POST: reviewsPOST } = await import('@/app/api/reviews/route');

// ---------------------------------------------------------------------------
// Shared constants / helpers
// ---------------------------------------------------------------------------

const VALID_CAMP_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_USER_UUID = 'user-aaaa-0000-0000-000000000001';
const VALID_REVIEW_UUID = 'review-aa00-0000-0000-000000000001';
const QUALIFYING_BOOKING_ID = 'booking-cam269-0000-000000000001';

// checkInDate fixtures — the route's `where` clause already restricts the DB result to
// checkInDate <= now, so in a mocked test the returned row's checkInDate is whatever WE
// say it is. PAST_CHECK_IN represents a normal, already-filtered-by-the-query row;
// FUTURE_CHECK_IN represents the defense-in-depth scenario (see the dedicated describe
// block below) where a row slips past the query (e.g. a future refactor bug) and must
// still be rejected by the application-level hasStayOccurred() re-check.
const PAST_CHECK_IN = new Date('2026-01-01T00:00:00.000Z');
const FUTURE_CHECK_IN = new Date('2099-01-01T00:00:00.000Z');

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
    return { campSiteId: VALID_CAMP_UUID, rating: 4, content: 'Great stay, would come back', ...override };
}

/** A qualifying-shaped booking row as booking.findMany would return it (past check-in). */
function qualifyingBookingRow(overrides: { id?: string; review?: { id: string } | null } = {}) {
    return {
        id: overrides.id ?? QUALIFYING_BOOKING_ID,
        checkInDate: PAST_CHECK_IN,
        review: overrides.review === undefined ? null : overrides.review,
    };
}

function setupCommonHappyPath() {
    mockAuth.mockResolvedValue(makeSession());
    mockPrismaCampSiteFindUnique.mockResolvedValue({ id: VALID_CAMP_UUID });
    mockTxReviewCreate.mockResolvedValue({
        id: VALID_REVIEW_UUID,
        campSiteId: VALID_CAMP_UUID,
        authorId: VALID_USER_UUID,
        bookingId: QUALIFYING_BOOKING_ID,
        verified: true,
        rating: 4,
        title: '',
        content: 'Great stay, would come back',
        visitDate: null,
        createdAt: new Date(),
    });
    mockTxReviewAggregate.mockResolvedValue({ _avg: { rating: 4 }, _count: { id: 1 } });
    mockTxCampSiteUpdate.mockResolvedValue({});
}

beforeEach(() => {
    vi.clearAllMocks();
    rateLimitStore.clear();
});

// ===========================================================================
// Pure functions — no DB, no mocked boundary
// ===========================================================================

describe('hasStayOccurred (pure) — "ผ่านวันเข้าพัก" boundary', () => {
    const now = new Date('2026-07-04T12:00:00.000Z');

    it('[normal] returns true when checkInDate is in the past', () => {
        expect(hasStayOccurred(new Date('2026-07-01T00:00:00.000Z'), now)).toBe(true);
    });

    it('[normal] returns false when checkInDate is in the future', () => {
        // [prove-it] fails against a route with no date check (would treat this as qualifying)
        expect(hasStayOccurred(new Date('2026-08-01T00:00:00.000Z'), now)).toBe(false);
    });

    it('[boundary] returns true when checkInDate is exactly now (inclusive <=)', () => {
        expect(hasStayOccurred(new Date('2026-07-04T12:00:00.000Z'), now)).toBe(true);
    });

    it('[boundary] returns false one millisecond in the future', () => {
        expect(hasStayOccurred(new Date('2026-07-04T12:00:00.001Z'), now)).toBe(false);
    });

    it('[boundary] returns true one millisecond in the past', () => {
        expect(hasStayOccurred(new Date('2026-07-04T11:59:59.999Z'), now)).toBe(true);
    });

    it('[default] uses the real clock when `now` is not supplied', () => {
        const past = new Date(Date.now() - 60_000);
        expect(hasStayOccurred(past)).toBe(true);
    });
});

describe('canReview (pure) — CAM-269 renamed param', () => {
    it('[normal] false with no qualifying booking', () => {
        expect(canReview({ hasQualifyingBooking: false })).toBe(false);
    });

    it('[normal] true with a qualifying booking', () => {
        expect(canReview({ hasQualifyingBooking: true })).toBe(true);
    });
});

describe('VERIFIED_STAY_STATUSES — CAM-269 business rule', () => {
    it('[prove-it] is COMPLETED only, not CONFIRMED (the pre-CAM-269 rule)', () => {
        expect([...VERIFIED_STAY_STATUSES]).toEqual(['COMPLETED']);
    });
});

// ===========================================================================
// AC-1 — no qualifying stay → 403, no review created
// ===========================================================================

describe('AC-1 — no qualifying stay rejects with 403 (server-side, not client-trusted)', () => {
    it('[error/validation] 403 when the user has zero bookings at this campsite', async () => {
        mockAuth.mockResolvedValue(makeSession());
        mockPrismaCampSiteFindUnique.mockResolvedValue({ id: VALID_CAMP_UUID });
        mockPrismaBookingFindMany.mockResolvedValue([]);

        const res = await reviewsPOST(makePostRequest(validBody()));

        expect(res.status).toBe(403);
        const body = await res.json() as { error: string };
        expect(body.error).not.toMatch(/prisma|stack|at Object/i); // no internals leaked
        expect(mockTxReviewCreate).not.toHaveBeenCalled();
    });

    it('[prove-it][boundary] 403 when the only booking is CONFIRMED, not COMPLETED — a reservation is not a stay', async () => {
        mockAuth.mockResolvedValue(makeSession());
        mockPrismaCampSiteFindUnique.mockResolvedValue({ id: VALID_CAMP_UUID });
        // The route's `where` filters status to VERIFIED_STAY_STATUSES; a CONFIRMED-only
        // booking would never be returned by the real query — the mock simulates that by
        // returning an empty result (proves the query, not just the JS decision).
        mockPrismaBookingFindMany.mockResolvedValue([]);

        const res = await reviewsPOST(makePostRequest(validBody()));

        expect(res.status).toBe(403);
        expect(mockTxReviewCreate).not.toHaveBeenCalled();
    });

    it('[shape] booking.findMany is called with status COMPLETED + checkInDate <= now + scoped to this user+campsite', async () => {
        mockAuth.mockResolvedValue(makeSession());
        mockPrismaCampSiteFindUnique.mockResolvedValue({ id: VALID_CAMP_UUID });
        mockPrismaBookingFindMany.mockResolvedValue([]);

        await reviewsPOST(makePostRequest(validBody()));

        // [prove-it] fails if the route trusts a client-supplied userId or drops either filter
        expect(mockPrismaBookingFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    userId: VALID_USER_UUID, // from the session, never the body
                    campSiteId: VALID_CAMP_UUID,
                    status: { in: ['COMPLETED'] },
                    checkInDate: { lte: expect.any(Date) },
                }),
            }),
        );
    });

    it('[authz] 401 before any booking lookup when unauthenticated', async () => {
        mockAuth.mockResolvedValue(null);

        const res = await reviewsPOST(makePostRequest(validBody()));

        expect(res.status).toBe(401);
        expect(mockPrismaBookingFindMany).not.toHaveBeenCalled();
    });
});

// ===========================================================================
// Defense-in-depth — application-level hasStayOccurred() re-check
//
// The DB `where` clause already excludes a future checkInDate (proven by the [shape]
// test above). These tests exercise the SECOND layer directly: even if a row with a
// future checkInDate is (hypothetically) returned by booking.findMany — e.g. a future
// refactor accidentally drops the `where` filter — the route must still reject it.
// ===========================================================================

describe('Defense-in-depth — a future checkInDate row is rejected even if the DB query returns it', () => {
    it('[prove-it][boundary] 403 when the only returned booking has a FUTURE checkInDate', async () => {
        mockAuth.mockResolvedValue(makeSession());
        mockPrismaCampSiteFindUnique.mockResolvedValue({ id: VALID_CAMP_UUID });
        mockPrismaBookingFindMany.mockResolvedValue([
            { id: QUALIFYING_BOOKING_ID, checkInDate: FUTURE_CHECK_IN, review: null },
        ]);

        const res = await reviewsPOST(makePostRequest(validBody()));

        // [prove-it] fails if the route trusts the DB result without re-checking hasStayOccurred()
        expect(res.status).toBe(403);
        expect(mockTxReviewCreate).not.toHaveBeenCalled();
    });

    it('[boundary] a mix of one future and one past booking still qualifies via the past one', async () => {
        setupCommonHappyPath();
        mockPrismaBookingFindMany.mockResolvedValue([
            { id: 'booking-future', checkInDate: FUTURE_CHECK_IN, review: null },
            qualifyingBookingRow({ id: QUALIFYING_BOOKING_ID }),
        ]);

        const res = await reviewsPOST(makePostRequest(validBody()));

        expect(res.status).toBe(201);
        expect(mockTxReviewCreate).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ bookingId: QUALIFYING_BOOKING_ID }) }),
        );
    });
});

// ===========================================================================
// AC-2 — qualifying stay → 201, verified=true, bound to the booking
// ===========================================================================

describe('AC-2 — a qualifying stay is accepted: verified=true, bookingId bound', () => {
    it('[normal] 201 when exactly one qualifying, unreviewed booking exists', async () => {
        setupCommonHappyPath();
        mockPrismaBookingFindMany.mockResolvedValue([qualifyingBookingRow()]);

        const res = await reviewsPOST(makePostRequest(validBody()));

        expect(res.status).toBe(201);
    });

    it('[prove-it] tx.review.create is called with verified:true and bookingId set to the qualifying booking', async () => {
        setupCommonHappyPath();
        mockPrismaBookingFindMany.mockResolvedValue([qualifyingBookingRow()]);

        await reviewsPOST(makePostRequest(validBody()));

        expect(mockTxReviewCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    verified: true,
                    bookingId: QUALIFYING_BOOKING_ID,
                    authorId: VALID_USER_UUID,
                }),
            }),
        );
    });

    it('[normal] response body reflects the created review including verified + bookingId', async () => {
        setupCommonHappyPath();
        mockPrismaBookingFindMany.mockResolvedValue([qualifyingBookingRow()]);

        const res = await reviewsPOST(makePostRequest(validBody()));
        const body = await res.json() as { verified: boolean; bookingId: string };

        expect(body.verified).toBe(true);
        expect(body.bookingId).toBe(QUALIFYING_BOOKING_ID);
    });

    it('[boundary] multiple qualifying bookings, one already reviewed → binds to the UNREVIEWED one', async () => {
        setupCommonHappyPath();
        mockPrismaBookingFindMany.mockResolvedValue([
            qualifyingBookingRow({ id: 'booking-already-reviewed', review: { id: 'existing-review-id' } }),
            qualifyingBookingRow({ id: QUALIFYING_BOOKING_ID }),
        ]);

        await reviewsPOST(makePostRequest(validBody()));

        expect(mockTxReviewCreate).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ bookingId: QUALIFYING_BOOKING_ID }) }),
        );
    });

    it('[authz] authorId in the created review is always the session user, never the request body', async () => {
        setupCommonHappyPath();
        mockPrismaBookingFindMany.mockResolvedValue([qualifyingBookingRow()]);

        // Attacker attempts to smuggle a different authorId — reviewBodySchema doesn't even
        // accept the field, and the route never reads it from `body`.
        await reviewsPOST(makePostRequest({ ...validBody(), authorId: 'someone-elses-id' }));

        expect(mockTxReviewCreate).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ authorId: VALID_USER_UUID }) }),
        );
    });
});

// ===========================================================================
// Dedupe — one review per booking (409), not in the ticket's AC table verbatim
// but required by the Data section ("bookingId อ้างอิง") + the handoff brief's
// explicit 409 requirement.
// ===========================================================================

describe('Dedupe — 409 when every qualifying stay has already been reviewed', () => {
    it('[error/validation] 409 when the (only) qualifying booking already has a review', async () => {
        mockAuth.mockResolvedValue(makeSession());
        mockPrismaCampSiteFindUnique.mockResolvedValue({ id: VALID_CAMP_UUID });
        mockPrismaBookingFindMany.mockResolvedValue([
            qualifyingBookingRow({ review: { id: 'existing-review-id' } }),
        ]);

        const res = await reviewsPOST(makePostRequest(validBody()));

        expect(res.status).toBe(409);
        expect(mockTxReviewCreate).not.toHaveBeenCalled();
    });

    it('[error/validation] 409 when ALL qualifying bookings already have a review (multiple stays, all reviewed)', async () => {
        mockAuth.mockResolvedValue(makeSession());
        mockPrismaCampSiteFindUnique.mockResolvedValue({ id: VALID_CAMP_UUID });
        mockPrismaBookingFindMany.mockResolvedValue([
            qualifyingBookingRow({ id: 'booking-1', review: { id: 'review-1' } }),
            qualifyingBookingRow({ id: 'booking-2', review: { id: 'review-2' } }),
        ]);

        const res = await reviewsPOST(makePostRequest(validBody()));

        expect(res.status).toBe(409);
    });

    it('[concurrent/ordering] 409 (not 500) when the DB unique constraint catches a race missed by the pre-check', async () => {
        // Pre-check sees the booking as unreviewed (review: null)...
        setupCommonHappyPath();
        mockPrismaBookingFindMany.mockResolvedValue([qualifyingBookingRow()]);
        // ...but a concurrent request wins the write first — Postgres unique constraint fires.
        mockTxReviewCreate.mockRejectedValueOnce(makeP2002('Unique constraint failed on Review_bookingId_key'));

        const res = await reviewsPOST(makePostRequest(validBody()));

        // [prove-it] fails (500 + leaked Prisma message) if the route doesn't catch P2002 specially
        expect(res.status).toBe(409);
        const body = await res.json() as { error: string };
        expect(body.error).not.toMatch(/prisma|constraint|P2002/i);
    });

    it('[error] a genuinely unrelated DB error during create still surfaces as 500, not swallowed as 409', async () => {
        setupCommonHappyPath();
        mockPrismaBookingFindMany.mockResolvedValue([qualifyingBookingRow()]);
        mockTxReviewCreate.mockRejectedValueOnce(new Error('connection terminated unexpectedly'));

        const res = await reviewsPOST(makePostRequest(validBody()));

        expect(res.status).toBe(500);
        const body = await res.json() as { error: string };
        expect(body.error).not.toContain('connection terminated');
    });
});

// ===========================================================================
// AC-3 — review list query filters verified only (source-inspection)
//
// Layer note: app/campgrounds/[slug]/page.tsx is a Next.js Server Component that
// calls auth(), prisma, notFound(), and getCampBySlug's unstable_cache wrapper —
// exercising it end-to-end under vitest would mean mocking a large slice of the
// Next.js request lifecycle to test one `where` clause. Per the CAM-58/CAM-79
// precedent already used for this exact file (review-summary.test.ts AC-6), a
// source-inspection assertion on the two Prisma calls is the correct layer.
// ===========================================================================

describe('AC-3 — "เห็นเฉพาะรีวิว verified" (review list + rating summary filter verified:true)', () => {
    const pageSrc = fs.readFileSync(
        path.join(process.cwd(), 'app/campgrounds/[slug]/page.tsx'),
        'utf-8',
    );

    it('[source] both the aggregate and findMany review queries filter verified: true', () => {
        // [prove-it] fails if either query drops the filter and starts showing/counting
        // unverified (e.g. legacy pre-CAM-269) reviews again.
        const verifiedTrueCount = (pageSrc.match(/verified:\s*true/g) || []).length;
        expect(verifiedTrueCount).toBeGreaterThanOrEqual(2);
    });

    it('[source] the verified filter sits alongside the existing deletedAt:null soft-delete filter (both must hold)', () => {
        // Confirms this story ADDED to the existing filter rather than replacing it.
        const bothFiltersCount = (pageSrc.match(/deletedAt:\s*null,\s*verified:\s*true/g) || []).length;
        expect(bothFiltersCount).toBeGreaterThanOrEqual(2);
    });
});
