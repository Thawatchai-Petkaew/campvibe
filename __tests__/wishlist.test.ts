/**
 * CAM-18 Wishlist API tests.
 *
 * Covers every AC in CAM-18:
 *  1. Zod schema (lib/validations/wishlist.ts)
 *  2. POST /api/wishlist  — 401 / 400 / 404 / 201 / P2002 idempotent
 *  3. GET  /api/wishlist  — 401 / ordered desc / session-scoped / single query (no N+1)
 *  4. DELETE /api/wishlist/[campSiteId] — 401 / 400 uuid / 200 + ownership where / idempotent
 *  5. GET  /api/wishlist/ids            — 401 / {campSiteIds} session-scoped
 *
 * Mock boundary: lib/prisma + lib/auth only.
 * Handler logic is real (imported directly).
 */

import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';
import { NextRequest } from 'next/server';

// ─────────────────────────────────────────────────────────────
// 1. Zod validation (pure — no mocks needed)
// ─────────────────────────────────────────────────────────────
import { wishlistBodySchema, campSiteIdParamSchema } from '../lib/validations/wishlist';

// ─────────────────────────────────────────────────────────────
// Mocks — declared before any dynamic import of the routes
// ─────────────────────────────────────────────────────────────

const mockAuth = vi.fn();

vi.mock('../lib/auth', () => ({
    auth: (...args: unknown[]) => mockAuth(...args),
}));

// Prisma mock — complete stub for all methods used across the wishlist routes
const mockPrismaWishlistCreate = vi.fn();
const mockPrismaWishlistFindMany = vi.fn();
const mockPrismaWishlistDeleteMany = vi.fn();
const mockPrismaCampSiteFindUnique = vi.fn();

vi.mock('../lib/prisma', () => ({
    prisma: {
        wishlist: {
            create: (...args: unknown[]) => mockPrismaWishlistCreate(...args),
            findMany: (...args: unknown[]) => mockPrismaWishlistFindMany(...args),
            deleteMany: (...args: unknown[]) => mockPrismaWishlistDeleteMany(...args),
        },
        campSite: {
            findUnique: (...args: unknown[]) => mockPrismaCampSiteFindUnique(...args),
        },
    },
}));

// ─────────────────────────────────────────────────────────────
// Route handlers — imported after mocks are registered
// ─────────────────────────────────────────────────────────────
const { POST: wishlistPOST, GET: wishlistGET } = await import(
    '../app/api/wishlist/route'
);
const { DELETE: wishlistDELETE } = await import(
    '../app/api/wishlist/[campSiteId]/route'
);
const { GET: wishlistIdsGET } = await import(
    '../app/api/wishlist/ids/route'
);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const VALID_UUID_A = '123e4567-e89b-12d3-a456-426614174000';
const VALID_UUID_B = '987fcdeb-51a2-43d7-9000-000000000001';
const USER_A = 'user-aaaa-0000-0000-000000000001';
const USER_B = 'user-bbbb-0000-0000-000000000002';

function makeSession(userId: string) {
    return { user: { id: userId, email: 'test@campvibe.com', name: 'Tester', role: 'CAMPER' } };
}

function makeRequest(body: unknown, url = 'http://localhost/api/wishlist'): NextRequest {
    return new NextRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function parseJson(response: Response) {
    return response.json();
}

// ─────────────────────────────────────────────────────────────
// Reset mocks between tests
// ─────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks();
});

// =============================================================
// AC-1: Zod schema (lib/validations/wishlist.ts)
// =============================================================

describe('wishlistBodySchema', () => {
    it('accepts a valid UUID campSiteId', () => {
        const result = wishlistBodySchema.safeParse({ campSiteId: VALID_UUID_A });
        expect(result.success).toBe(true);
    });

    it('rejects an empty campSiteId string', () => {
        const result = wishlistBodySchema.safeParse({ campSiteId: '' });
        expect(result.success).toBe(false);
    });

    it('rejects a non-UUID campSiteId', () => {
        const result = wishlistBodySchema.safeParse({ campSiteId: 'not-a-uuid' });
        expect(result.success).toBe(false);
    });

    it('rejects missing campSiteId', () => {
        const result = wishlistBodySchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it('strips unknown fields (userId must not be accepted from body)', () => {
        const result = wishlistBodySchema.safeParse({ campSiteId: VALID_UUID_A, userId: USER_A });
        expect(result.success).toBe(true);
        if (result.success) {
            expect('userId' in result.data).toBe(false);
        }
    });
});

describe('campSiteIdParamSchema', () => {
    it('accepts a valid UUID', () => {
        const result = campSiteIdParamSchema.safeParse(VALID_UUID_A);
        expect(result.success).toBe(true);
    });

    it('rejects an empty string', () => {
        const result = campSiteIdParamSchema.safeParse('');
        expect(result.success).toBe(false);
    });

    it('rejects a non-UUID string', () => {
        const result = campSiteIdParamSchema.safeParse('abc-not-uuid');
        expect(result.success).toBe(false);
    });
});

// =============================================================
// AC-2: POST /api/wishlist
// =============================================================

describe('POST /api/wishlist', () => {
    describe('AC-2a — no session → 401', () => {
        it('returns 401 when auth() returns null', async () => {
            mockAuth.mockResolvedValueOnce(null);

            const req = makeRequest({ campSiteId: VALID_UUID_A });
            const res = await wishlistPOST(req);

            expect(res.status).toBe(401);
            const body = await parseJson(res);
            expect(body.error).toBe('Authentication required');
        });

        it('returns 401 when session has no user.id', async () => {
            mockAuth.mockResolvedValueOnce({ user: {} });

            const req = makeRequest({ campSiteId: VALID_UUID_A });
            const res = await wishlistPOST(req);

            expect(res.status).toBe(401);
        });
    });

    describe('AC-2b — invalid body → 400', () => {
        it('returns 400 for non-UUID campSiteId', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));

            const req = makeRequest({ campSiteId: 'not-a-uuid' });
            const res = await wishlistPOST(req);

            expect(res.status).toBe(400);
            const body = await parseJson(res);
            expect(body.error).toBe('Validation Error');
        });

        it('returns 400 for missing campSiteId', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));

            const req = makeRequest({});
            const res = await wishlistPOST(req);

            expect(res.status).toBe(400);
        });
    });

    describe('AC-2c — campSite not found → 404', () => {
        it('returns 404 when the camp site does not exist', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));
            mockPrismaCampSiteFindUnique.mockResolvedValueOnce(null);

            const req = makeRequest({ campSiteId: VALID_UUID_A });
            const res = await wishlistPOST(req);

            expect(res.status).toBe(404);
            const body = await parseJson(res);
            expect(body.error).toBe('Camp site not found');
        });
    });

    describe('AC-2d — valid request → 201 + correct prisma args', () => {
        it('returns 201 with {campSiteId} and calls wishlist.create with session userId', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));
            mockPrismaCampSiteFindUnique.mockResolvedValueOnce({ id: VALID_UUID_A });
            mockPrismaWishlistCreate.mockResolvedValueOnce({
                id: 'wl-1',
                userId: USER_A,
                campSiteId: VALID_UUID_A,
                createdAt: new Date(),
            });

            const req = makeRequest({ campSiteId: VALID_UUID_A });
            const res = await wishlistPOST(req);

            expect(res.status).toBe(201);
            const body = await parseJson(res);
            expect(body.campSiteId).toBe(VALID_UUID_A);

            // Assert prisma.wishlist.create was called with session userId (not from body)
            expect(mockPrismaWishlistCreate).toHaveBeenCalledOnce();
            expect(mockPrismaWishlistCreate).toHaveBeenCalledWith({
                data: { userId: USER_A, campSiteId: VALID_UUID_A },
            });
        });

        it('userId in body is ignored — session userId is used', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));
            mockPrismaCampSiteFindUnique.mockResolvedValueOnce({ id: VALID_UUID_A });
            mockPrismaWishlistCreate.mockResolvedValueOnce({
                id: 'wl-1',
                userId: USER_A,
                campSiteId: VALID_UUID_A,
                createdAt: new Date(),
            });

            // Even if the body includes userId: USER_B, the route must use USER_A from session
            const req = makeRequest({ campSiteId: VALID_UUID_A, userId: USER_B });
            await wishlistPOST(req);

            const createCall = mockPrismaWishlistCreate.mock.calls[0][0];
            expect(createCall.data.userId).toBe(USER_A);
            expect(createCall.data.userId).not.toBe(USER_B);
        });
    });

    describe('AC-2e — duplicate (P2002) → still 201 (idempotent)', () => {
        it('returns 201 when prisma throws P2002 (already wishlisted)', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));
            mockPrismaCampSiteFindUnique.mockResolvedValueOnce({ id: VALID_UUID_A });
            mockPrismaWishlistCreate.mockRejectedValueOnce({ code: 'P2002' });

            const req = makeRequest({ campSiteId: VALID_UUID_A });
            const res = await wishlistPOST(req);

            expect(res.status).toBe(201);
            const body = await parseJson(res);
            expect(body.campSiteId).toBe(VALID_UUID_A);
        });

        it('does NOT surface P2002 error to client', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));
            mockPrismaCampSiteFindUnique.mockResolvedValueOnce({ id: VALID_UUID_A });
            mockPrismaWishlistCreate.mockRejectedValueOnce({ code: 'P2002' });

            const req = makeRequest({ campSiteId: VALID_UUID_A });
            const res = await wishlistPOST(req);
            const body = await parseJson(res);

            expect(body.error).toBeUndefined();
        });

        it('re-throws non-P2002 errors (results in 500)', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));
            mockPrismaCampSiteFindUnique.mockResolvedValueOnce({ id: VALID_UUID_A });
            mockPrismaWishlistCreate.mockRejectedValueOnce({ code: 'P2003' });

            const req = makeRequest({ campSiteId: VALID_UUID_A });
            const res = await wishlistPOST(req);

            expect(res.status).toBe(500);
        });
    });
});

// =============================================================
// AC-3: GET /api/wishlist
// =============================================================

describe('GET /api/wishlist', () => {
    describe('AC-3a — no session → 401', () => {
        it('returns 401 when unauthenticated', async () => {
            mockAuth.mockResolvedValueOnce(null);

            const res = await wishlistGET();

            expect(res.status).toBe(401);
            const body = await parseJson(res);
            expect(body.error).toBe('Authentication required');
        });
    });

    describe('AC-3b — returns ordered list, session-scoped, single query', () => {
        const sampleCampSite = {
            id: VALID_UUID_A,
            nameTh: 'แคมป์ทดสอบ',
            nameEn: 'Test Camp',
            nameThSlug: 'camp-test',
            nameEnSlug: 'camp-test',
            images: null,
            priceLow: 500,
            priceHigh: 1000,
            isVerified: false,
            isPublished: true,
            latitude: 13.7,
            longitude: 100.5,
        };

        it('calls findMany with userId from session and orderBy createdAt desc', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));
            mockPrismaWishlistFindMany.mockResolvedValueOnce([]);

            await wishlistGET();

            expect(mockPrismaWishlistFindMany).toHaveBeenCalledOnce();
            const callArgs = mockPrismaWishlistFindMany.mock.calls[0][0];
            expect(callArgs.where.userId).toBe(USER_A);
            expect(callArgs.orderBy).toEqual({ createdAt: 'desc' });
        });

        it('uses a single query with include (no N+1 — no loop calls to prisma)', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));
            mockPrismaWishlistFindMany.mockResolvedValueOnce([]);

            await wishlistGET();

            // Only one prisma call should have been made (findMany with include)
            const totalCalls =
                mockPrismaWishlistFindMany.mock.calls.length +
                mockPrismaCampSiteFindUnique.mock.calls.length +
                mockPrismaWishlistCreate.mock.calls.length;
            expect(totalCalls).toBe(1);
        });

        it('returns shaped array with campSite nested and createdAt as ISO string', async () => {
            const createdAt = new Date('2025-01-15T10:00:00Z');
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));
            mockPrismaWishlistFindMany.mockResolvedValueOnce([
                {
                    id: 'wl-row-1',
                    campSiteId: VALID_UUID_A,
                    createdAt,
                    campSite: sampleCampSite,
                },
            ]);

            const res = await wishlistGET();

            expect(res.status).toBe(200);
            const body = await parseJson(res);
            expect(Array.isArray(body)).toBe(true);
            expect(body).toHaveLength(1);
            expect(body[0].id).toBe('wl-row-1');
            expect(body[0].campSiteId).toBe(VALID_UUID_A);
            expect(body[0].createdAt).toBe(createdAt.toISOString());
            expect(body[0].campSite.nameTh).toBe('แคมป์ทดสอบ');
        });

        it('scopes results to session user — user B cannot see user A wishlist', async () => {
            // Simulate user B calling the endpoint
            mockAuth.mockResolvedValueOnce(makeSession(USER_B));
            mockPrismaWishlistFindMany.mockResolvedValueOnce([]);

            await wishlistGET();

            const callArgs = mockPrismaWishlistFindMany.mock.calls[0][0];
            // The where must use USER_B's id, proving scoping
            expect(callArgs.where.userId).toBe(USER_B);
            expect(callArgs.where.userId).not.toBe(USER_A);
        });

        it('returns empty array when no wishlisted items', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));
            mockPrismaWishlistFindMany.mockResolvedValueOnce([]);

            const res = await wishlistGET();
            const body = await parseJson(res);

            expect(body).toEqual([]);
        });
    });
});

// =============================================================
// AC-4: DELETE /api/wishlist/[campSiteId]
// =============================================================

describe('DELETE /api/wishlist/[campSiteId]', () => {
    function makeDeleteParams(campSiteId: string) {
        return { params: Promise.resolve({ campSiteId }) };
    }

    function makeDeleteRequest(): NextRequest {
        return new NextRequest(`http://localhost/api/wishlist/${VALID_UUID_A}`, {
            method: 'DELETE',
        });
    }

    describe('AC-4a — no session → 401', () => {
        it('returns 401 when unauthenticated', async () => {
            mockAuth.mockResolvedValueOnce(null);

            const res = await wishlistDELETE(
                makeDeleteRequest(),
                makeDeleteParams(VALID_UUID_A),
            );

            expect(res.status).toBe(401);
            const body = await parseJson(res);
            expect(body.error).toBe('Authentication required');
        });
    });

    describe('AC-4b — invalid UUID param → 400', () => {
        it('returns 400 for non-UUID campSiteId param', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));

            const res = await wishlistDELETE(
                makeDeleteRequest(),
                makeDeleteParams('not-a-uuid'),
            );

            expect(res.status).toBe(400);
            const body = await parseJson(res);
            expect(body.error).toContain('Invalid campSiteId');
        });

        it('returns 400 for empty campSiteId param', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));

            const res = await wishlistDELETE(
                makeDeleteRequest(),
                makeDeleteParams(''),
            );

            expect(res.status).toBe(400);
        });
    });

    describe('AC-4c — valid delete → 200 + ownership scoped where', () => {
        it('returns 200 and calls deleteMany with session userId in where', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));
            mockPrismaWishlistDeleteMany.mockResolvedValueOnce({ count: 1 });

            const res = await wishlistDELETE(
                makeDeleteRequest(),
                makeDeleteParams(VALID_UUID_A),
            );

            expect(res.status).toBe(200);
            const body = await parseJson(res);
            expect(body.success).toBe(true);

            expect(mockPrismaWishlistDeleteMany).toHaveBeenCalledOnce();
            const whereArg = mockPrismaWishlistDeleteMany.mock.calls[0][0].where;
            expect(whereArg.userId).toBe(USER_A);
            expect(whereArg.campSiteId).toBe(VALID_UUID_A);
        });

        it('ownership: user B delete cannot touch user A rows — where includes session userId', async () => {
            // User B is authenticated
            mockAuth.mockResolvedValueOnce(makeSession(USER_B));
            mockPrismaWishlistDeleteMany.mockResolvedValueOnce({ count: 0 });

            await wishlistDELETE(
                makeDeleteRequest(),
                makeDeleteParams(VALID_UUID_A),
            );

            const whereArg = mockPrismaWishlistDeleteMany.mock.calls[0][0].where;
            // The where must bind to USER_B, not USER_A
            expect(whereArg.userId).toBe(USER_B);
            expect(whereArg.userId).not.toBe(USER_A);
        });
    });

    describe('AC-4d — deleting non-existent → still 200 (idempotent)', () => {
        it('returns 200 even when deleteMany count is 0', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));
            mockPrismaWishlistDeleteMany.mockResolvedValueOnce({ count: 0 });

            const res = await wishlistDELETE(
                makeDeleteRequest(),
                makeDeleteParams(VALID_UUID_A),
            );

            expect(res.status).toBe(200);
            const body = await parseJson(res);
            expect(body.success).toBe(true);
        });
    });
});

// =============================================================
// AC-5: GET /api/wishlist/ids
// =============================================================

describe('GET /api/wishlist/ids', () => {
    describe('AC-5a — no session → 401', () => {
        it('returns 401 when unauthenticated', async () => {
            mockAuth.mockResolvedValueOnce(null);

            const res = await wishlistIdsGET();

            expect(res.status).toBe(401);
            const body = await parseJson(res);
            expect(body.error).toBe('Authentication required');
        });
    });

    describe('AC-5b — returns {campSiteIds} scoped to session userId', () => {
        it('returns campSiteIds array for authenticated user', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));
            mockPrismaWishlistFindMany.mockResolvedValueOnce([
                { campSiteId: VALID_UUID_A },
                { campSiteId: VALID_UUID_B },
            ]);

            const res = await wishlistIdsGET();

            expect(res.status).toBe(200);
            const body = await parseJson(res);
            expect(body).toHaveProperty('campSiteIds');
            expect(Array.isArray(body.campSiteIds)).toBe(true);
            expect(body.campSiteIds).toContain(VALID_UUID_A);
            expect(body.campSiteIds).toContain(VALID_UUID_B);
        });

        it('scopes query to session userId', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));
            mockPrismaWishlistFindMany.mockResolvedValueOnce([]);

            await wishlistIdsGET();

            const callArgs = mockPrismaWishlistFindMany.mock.calls[0][0];
            expect(callArgs.where.userId).toBe(USER_A);
        });

        it('returns empty campSiteIds array when user has no wishlist', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_A));
            mockPrismaWishlistFindMany.mockResolvedValueOnce([]);

            const res = await wishlistIdsGET();
            const body = await parseJson(res);

            expect(body.campSiteIds).toEqual([]);
        });

        it('user B session returns user B scoped ids, not user A', async () => {
            mockAuth.mockResolvedValueOnce(makeSession(USER_B));
            mockPrismaWishlistFindMany.mockResolvedValueOnce([
                { campSiteId: VALID_UUID_B },
            ]);

            await wishlistIdsGET();

            const callArgs = mockPrismaWishlistFindMany.mock.calls[0][0];
            expect(callArgs.where.userId).toBe(USER_B);
            expect(callArgs.where.userId).not.toBe(USER_A);
        });
    });
});
