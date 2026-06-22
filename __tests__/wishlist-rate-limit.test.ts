/**
 * CAM-131 — wishlist write rate-limit tests.
 *
 * Covers:
 *  1. checkRateLimit unit: allowed under limit, denied once over, retryAfterSec > 0
 *  2. remaining decrements correctly
 *  3. window resets after windowMs elapses (deterministic via fake clock)
 *  4. per-key isolation: different keys are independent
 *  5. POST /api/wishlist  → 429 when over limit
 *  6. DELETE /api/wishlist/[campSiteId] → 429 when over limit
 *  7. Retry-After header present on 429
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─────────────────────────────────────────────────────────────
// Unit tests for lib/rate-limit.ts  (no mocks needed)
// ─────────────────────────────────────────────────────────────
import { checkRateLimit, _store } from '../lib/rate-limit';

// Helper: clear the module-level store between tests for isolation
function resetStore() {
    _store.clear();
}

// ─────────────────────────────────────────────────────────────
// Mocks for route-level integration tests
// ─────────────────────────────────────────────────────────────

const mockAuth = vi.fn();

vi.mock('../lib/auth', () => ({
    auth: (...args: unknown[]) => mockAuth(...args),
}));

const mockPrismaWishlistCreate = vi.fn();
const mockPrismaWishlistDeleteMany = vi.fn();
const mockPrismaCampSiteFindUnique = vi.fn();

vi.mock('../lib/prisma', () => ({
    prisma: {
        wishlist: {
            create: (...args: unknown[]) => mockPrismaWishlistCreate(...args),
            deleteMany: (...args: unknown[]) => mockPrismaWishlistDeleteMany(...args),
        },
        campSite: {
            findUnique: (...args: unknown[]) => mockPrismaCampSiteFindUnique(...args),
        },
    },
}));

// Rate-limit module is NOT mocked here — we test the real module end-to-end
// in the unit section, and let the routes exercise it too (server-authoritative).

// ─────────────────────────────────────────────────────────────
// Route handlers (imported after mocks)
// ─────────────────────────────────────────────────────────────
const { POST: wishlistPOST } = await import('../app/api/wishlist/route');
const { DELETE: wishlistDELETE } = await import('../app/api/wishlist/[campSiteId]/route');

// ─────────────────────────────────────────────────────────────
// Shared test constants
// ─────────────────────────────────────────────────────────────
const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const USER_A = 'user-aaaa-0000-0000-000000000001';
const USER_B = 'user-bbbb-0000-0000-000000000002';

function makeSession(userId: string) {
    return { user: { id: userId, email: 'test@campvibe.com', name: 'Tester', role: 'CAMPER' } };
}

function makePostRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function makeDeleteRequest(): NextRequest {
    return new NextRequest(`http://localhost/api/wishlist/${VALID_UUID}`, { method: 'DELETE' });
}

function makeDeleteParams(campSiteId: string) {
    return { params: Promise.resolve({ campSiteId }) };
}

beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
});

// ═════════════════════════════════════════════════════════════
// 1. checkRateLimit unit tests
// ═════════════════════════════════════════════════════════════

describe('checkRateLimit — unit', () => {
    // Use a fake clock injected via the `now` option so tests are deterministic
    // without any real timers or sleep.

    it('allows the first request and returns remaining = limit - 1', () => {
        const t = 0;
        const result = checkRateLimit('k1', { limit: 3, windowMs: 1000, now: () => t });
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);
        expect(result.retryAfterSec).toBe(0);
    });

    it('allows requests up to the limit', () => {
        let t = 0;
        // Fire exactly `limit` requests — all must be allowed
        for (let i = 0; i < 5; i++) {
            const r = checkRateLimit('k2', { limit: 5, windowMs: 1000, now: () => t++ });
            expect(r.allowed).toBe(true);
        }
    });

    it('denies the (limit + 1)th request within the window', () => {
        let t = 0;
        for (let i = 0; i < 3; i++) {
            checkRateLimit('k3', { limit: 3, windowMs: 1000, now: () => t++ });
        }
        // The 4th call (over limit)
        const denied = checkRateLimit('k3', { limit: 3, windowMs: 1000, now: () => t });
        expect(denied.allowed).toBe(false);
        expect(denied.remaining).toBe(0);
    });

    it('returns retryAfterSec > 0 when denied', () => {
        let t = 0;
        for (let i = 0; i < 2; i++) {
            checkRateLimit('k4', { limit: 2, windowMs: 5000, now: () => t++ });
        }
        const denied = checkRateLimit('k4', { limit: 2, windowMs: 5000, now: () => t });
        expect(denied.allowed).toBe(false);
        expect(denied.retryAfterSec).toBeGreaterThan(0);
    });

    it('resets correctly after the window elapses', () => {
        const WINDOW = 1000;
        let t = 0;
        // Fill the bucket
        for (let i = 0; i < 3; i++) {
            checkRateLimit('k5', { limit: 3, windowMs: WINDOW, now: () => t++ });
        }
        // Advance time beyond the window so all prior timestamps are stale
        t = WINDOW + 100;
        const afterReset = checkRateLimit('k5', { limit: 3, windowMs: WINDOW, now: () => t });
        expect(afterReset.allowed).toBe(true);
        expect(afterReset.remaining).toBe(2);
    });

    it('different keys are counted independently', () => {
        let t = 0;
        // Fill key A to the limit
        for (let i = 0; i < 2; i++) {
            checkRateLimit('keyA', { limit: 2, windowMs: 5000, now: () => t++ });
        }
        // Key B should still be free
        const forB = checkRateLimit('keyB', { limit: 2, windowMs: 5000, now: () => t });
        expect(forB.allowed).toBe(true);
        // Key A should be blocked
        const forA = checkRateLimit('keyA', { limit: 2, windowMs: 5000, now: () => t });
        expect(forA.allowed).toBe(false);
    });

    it('remaining decrements monotonically with each allowed call', () => {
        let t = 0;
        const LIMIT = 5;
        for (let i = 0; i < LIMIT; i++) {
            const r = checkRateLimit('k6', { limit: LIMIT, windowMs: 60000, now: () => t++ });
            expect(r.remaining).toBe(LIMIT - 1 - i);
        }
    });

    it('retryAfterSec is at least 1 (rounded up, not 0) when denied', () => {
        // Use t values so the oldest entry is just barely inside the window
        let t = 0;
        checkRateLimit('k7', { limit: 1, windowMs: 2000, now: () => t });
        t = 1999; // still inside the 2 s window
        const denied = checkRateLimit('k7', { limit: 1, windowMs: 2000, now: () => t });
        expect(denied.allowed).toBe(false);
        // retryAfterMs = 0 + 2000 - 1999 = 1 ms → ceil(1/1000) = 1 sec
        expect(denied.retryAfterSec).toBeGreaterThanOrEqual(1);
    });
});

// ═════════════════════════════════════════════════════════════
// 2. POST /api/wishlist → 429 when over limit
// ═════════════════════════════════════════════════════════════

describe('POST /api/wishlist — rate limit integration', () => {
    // We use a real in-memory store here (not mocked) but reset it between tests.
    // The real checkRateLimit uses Date.now() for these route tests;
    // we exhaust the limit in fast succession (all in the same ms-band, effectively).

    it('returns 429 and Retry-After header after exceeding the default limit', async () => {
        // Override with a tiny limit via direct store pre-filling:
        // Pre-fill 100 entries for USER_A so the next call is over the limit.
        const now = Date.now();
        const timestamps = Array.from({ length: 100 }, (_, i) => now - i);
        _store.set(`wishlist:write:${USER_A}`, timestamps);

        mockAuth.mockResolvedValueOnce(makeSession(USER_A));

        const req = makePostRequest({ campSiteId: VALID_UUID });
        const res = await wishlistPOST(req);

        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.error).toBe('Too many requests');
        expect(typeof body.retryAfterSec).toBe('number');
        expect(body.retryAfterSec).toBeGreaterThan(0);

        const retryAfterHeader = res.headers.get('Retry-After');
        expect(retryAfterHeader).not.toBeNull();
        expect(Number(retryAfterHeader)).toBeGreaterThan(0);
    });

    it('does not call prisma when rate-limited', async () => {
        const now = Date.now();
        _store.set(`wishlist:write:${USER_A}`, Array.from({ length: 100 }, (_, i) => now - i));

        mockAuth.mockResolvedValueOnce(makeSession(USER_A));

        const req = makePostRequest({ campSiteId: VALID_UUID });
        await wishlistPOST(req);

        expect(mockPrismaWishlistCreate).not.toHaveBeenCalled();
        expect(mockPrismaCampSiteFindUnique).not.toHaveBeenCalled();
    });

    it('still allows requests when under the limit', async () => {
        // Fresh store (empty) — USER_A has 0 requests
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));
        mockPrismaCampSiteFindUnique.mockResolvedValueOnce({ id: VALID_UUID });
        mockPrismaWishlistCreate.mockResolvedValueOnce({
            id: 'wl-1', userId: USER_A, campSiteId: VALID_UUID, createdAt: new Date(),
        });

        const req = makePostRequest({ campSiteId: VALID_UUID });
        const res = await wishlistPOST(req);

        expect(res.status).toBe(201);
    });

    it('rate-limit is scoped per user (USER_A limit does not block USER_B)', async () => {
        const now = Date.now();
        _store.set(`wishlist:write:${USER_A}`, Array.from({ length: 100 }, (_, i) => now - i));

        // USER_B — fresh
        mockAuth.mockResolvedValueOnce(makeSession(USER_B));
        mockPrismaCampSiteFindUnique.mockResolvedValueOnce({ id: VALID_UUID });
        mockPrismaWishlistCreate.mockResolvedValueOnce({
            id: 'wl-2', userId: USER_B, campSiteId: VALID_UUID, createdAt: new Date(),
        });

        const req = makePostRequest({ campSiteId: VALID_UUID });
        const res = await wishlistPOST(req);

        expect(res.status).toBe(201);
    });
});

// ═════════════════════════════════════════════════════════════
// 3. DELETE /api/wishlist/[campSiteId] → 429 when over limit
// ═════════════════════════════════════════════════════════════

describe('DELETE /api/wishlist/[campSiteId] — rate limit integration', () => {
    it('returns 429 and Retry-After header after exceeding the default limit', async () => {
        const now = Date.now();
        _store.set(`wishlist:write:${USER_A}`, Array.from({ length: 100 }, (_, i) => now - i));

        mockAuth.mockResolvedValueOnce(makeSession(USER_A));

        const res = await wishlistDELETE(makeDeleteRequest(), makeDeleteParams(VALID_UUID));

        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.error).toBe('Too many requests');
        expect(typeof body.retryAfterSec).toBe('number');
        expect(body.retryAfterSec).toBeGreaterThan(0);

        const retryAfterHeader = res.headers.get('Retry-After');
        expect(retryAfterHeader).not.toBeNull();
        expect(Number(retryAfterHeader)).toBeGreaterThan(0);
    });

    it('does not call prisma when rate-limited', async () => {
        const now = Date.now();
        _store.set(`wishlist:write:${USER_A}`, Array.from({ length: 100 }, (_, i) => now - i));

        mockAuth.mockResolvedValueOnce(makeSession(USER_A));

        await wishlistDELETE(makeDeleteRequest(), makeDeleteParams(VALID_UUID));

        expect(mockPrismaWishlistDeleteMany).not.toHaveBeenCalled();
    });

    it('still allows DELETE when under the limit', async () => {
        // Fresh store
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));
        mockPrismaWishlistDeleteMany.mockResolvedValueOnce({ count: 1 });

        const res = await wishlistDELETE(makeDeleteRequest(), makeDeleteParams(VALID_UUID));

        expect(res.status).toBe(200);
    });

    it('POST and DELETE share the same rate-limit key (wishlist:write:<userId>)', async () => {
        // Use 99 timestamps — one call away from the limit.
        const now = Date.now();
        _store.set(`wishlist:write:${USER_A}`, Array.from({ length: 99 }, (_, i) => now - i));

        // 100th call: POST — allowed
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));
        mockPrismaCampSiteFindUnique.mockResolvedValueOnce({ id: VALID_UUID });
        mockPrismaWishlistCreate.mockResolvedValueOnce({
            id: 'wl-3', userId: USER_A, campSiteId: VALID_UUID, createdAt: new Date(),
        });
        const postRes = await wishlistPOST(makePostRequest({ campSiteId: VALID_UUID }));
        expect(postRes.status).toBe(201);

        // 101st call: DELETE — now over limit, uses the same shared key
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));
        const delRes = await wishlistDELETE(makeDeleteRequest(), makeDeleteParams(VALID_UUID));
        expect(delRes.status).toBe(429);
    });
});
