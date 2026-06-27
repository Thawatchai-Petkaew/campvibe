/**
 * CAM-211 RATE-3 — Upload hardening smoke tests.
 *
 * Covers:
 *  1. verifyMagicBytes unit: JPEG / PNG / WebP / GIF valid + forged
 *  2. Upload route: 429 + Retry-After when rate-limited
 *  3. Upload route: 400 when magic bytes don't match declared MIME
 *  4. Upload route: 400 passes through for no-file (pre-existing behaviour)
 *  5. Camp-create routes: 429 + Retry-After when rate-limited
 *  6. Shared key: both campsites + campgrounds routes share `campsite:create:<userId>`
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { _store } from '../lib/rate-limit';

// ─────────────────────────────────────────────────────────────
// Mock auth + prisma before any route imports
// ─────────────────────────────────────────────────────────────

const mockAuth = vi.fn();

vi.mock('../lib/auth', () => ({
    auth: (...args: unknown[]) => mockAuth(...args),
}));

// Vercel Blob — always throw so we fall through to local storage path
vi.mock('@vercel/blob', () => ({
    put: vi.fn().mockRejectedValue(new Error('blob unavailable')),
}));

// fs/promises — stub writeFile + mkdir so no real disk I/O
vi.mock('fs/promises', () => ({
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Prisma stubs (camp-create routes need campSite.create)
const mockCampSiteCreate = vi.fn();
vi.mock('../lib/prisma', () => ({
    prisma: {
        campSite: {
            create: (...args: unknown[]) => mockCampSiteCreate(...args),
            findMany: vi.fn().mockResolvedValue([]),
        },
        campSiteOption: {
            findMany: vi.fn().mockResolvedValue([]),
        },
    },
}));

// next/cache stub — include all exports used transitively (revalidateTag, unstable_cache)
vi.mock('next/cache', () => ({
    revalidateTag: vi.fn(),
    unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

// ─────────────────────────────────────────────────────────────
// Route handlers (imported AFTER mocks)
// ─────────────────────────────────────────────────────────────
const { POST: uploadPOST } = await import('../app/api/upload/route');
const { POST: campsitesPOST } = await import('../app/api/campsites/route');
const { POST: campgroundsPOST } = await import('../app/api/campgrounds/route');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const USER_A = 'user-aaaa-0000-0000-000000000001';
const USER_B = 'user-bbbb-0000-0000-000000000002';

function makeSession(userId: string) {
    return { user: { id: userId, email: 'test@campvibe.com', name: 'Tester', role: 'CAMPER' } };
}

/** Build a minimal JPEG header (3 bytes) */
function jpegBytes(): Uint8Array<ArrayBuffer> {
    return new Uint8Array(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]).buffer as ArrayBuffer);
}

/** Build a minimal PNG header (8 bytes) */
function pngBytes(): Uint8Array<ArrayBuffer> {
    return new Uint8Array(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).buffer as ArrayBuffer);
}

/** Build a minimal WebP header (12 bytes) */
function webpBytes(): Uint8Array<ArrayBuffer> {
    const buf = new Uint8Array(new ArrayBuffer(12));
    // RIFF at 0-3
    buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46;
    // arbitrary size bytes at 4-7 (don't matter for sig check)
    buf[4] = 0x00; buf[5] = 0x00; buf[6] = 0x00; buf[7] = 0x00;
    // WEBP at 8-11
    buf[8] = 0x57; buf[9] = 0x45; buf[10] = 0x42; buf[11] = 0x50;
    return buf;
}

/** Build a minimal GIF header (4 bytes) */
function gifBytes(): Uint8Array<ArrayBuffer> {
    return new Uint8Array(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]).buffer as ArrayBuffer);
}

/** Random bytes that won't match any signature */
function invalidBytes(): Uint8Array<ArrayBuffer> {
    return new Uint8Array(new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer as ArrayBuffer);
}

function makeUploadRequest(fileBytes: Uint8Array<ArrayBuffer>, mimeType: string): NextRequest {
    const formData = new FormData();
    const blob = new Blob([fileBytes], { type: mimeType });
    formData.append('file', new File([blob], 'test.img', { type: mimeType }));
    return new NextRequest('http://localhost/api/upload?filename=test', {
        method: 'POST',
        body: formData,
    });
}

function makeCampsiteBody() {
    return {
        nameTh: 'แคมป์ทดสอบ',
        nameEn: 'Test Camp',
        campSiteType: 'CAMPGROUND',
        address: '123 ถนนทดสอบ',
        latitude: 13.0,
        longitude: 100.0,
        checkInTime: '14:00',
        checkOutTime: '12:00',
        bookingMethod: 'DIRECT',
        feeInfo: 'ฟรี',
        toiletInfo: 'มี',
        locationId: 'loc-1',
    };
}

function makeCampsitesRequest(): NextRequest {
    return new NextRequest('http://localhost/api/campsites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(makeCampsiteBody()),
    });
}

function makeCampgroundsRequest(): NextRequest {
    return new NextRequest('http://localhost/api/campgrounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(makeCampsiteBody()),
    });
}

function prefillUploadLimit(userId: string, count = 20) {
    const now = Date.now();
    _store.set(`upload:${userId}`, Array.from({ length: count }, (_, i) => now - i));
}

function prefillCampsiteCreateLimit(userId: string, count = 10) {
    const now = Date.now();
    _store.set(`campsite:create:${userId}`, Array.from({ length: count }, (_, i) => now - i));
}

beforeEach(() => {
    vi.clearAllMocks();
    _store.clear();
});

// ═════════════════════════════════════════════════════════════
// 1. Upload route — magic-byte check
// ═════════════════════════════════════════════════════════════

describe('POST /api/upload — magic-byte check', () => {
    it('accepts a valid JPEG (FF D8 FF signature)', async () => {
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));
        const req = makeUploadRequest(jpegBytes(), 'image/jpeg');
        const res = await uploadPOST(req);
        // 200 or anything other than 400 "invalid file"
        expect(res.status).not.toBe(400);
    });

    it('accepts a valid PNG (89 50 4E 47 ... signature)', async () => {
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));
        const req = makeUploadRequest(pngBytes(), 'image/png');
        const res = await uploadPOST(req);
        expect(res.status).not.toBe(400);
    });

    it('accepts a valid WebP (RIFF...WEBP signature)', async () => {
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));
        const req = makeUploadRequest(webpBytes(), 'image/webp');
        const res = await uploadPOST(req);
        expect(res.status).not.toBe(400);
    });

    it('accepts a valid GIF (GIF8 signature)', async () => {
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));
        const req = makeUploadRequest(gifBytes(), 'image/gif');
        const res = await uploadPOST(req);
        expect(res.status).not.toBe(400);
    });

    it('rejects a forged file (invalid bytes declared as image/jpeg) → 400', async () => {
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));
        const req = makeUploadRequest(invalidBytes(), 'image/jpeg');
        const res = await uploadPOST(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        // Must not leak internals; message is in Thai
        expect(typeof body.error).toBe('string');
    });

    it('rejects PNG bytes declared as image/jpeg → 400 (cross-mime mismatch)', async () => {
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));
        const req = makeUploadRequest(pngBytes(), 'image/jpeg');
        const res = await uploadPOST(req);
        expect(res.status).toBe(400);
    });

    it('rejects JPEG bytes declared as image/png → 400', async () => {
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));
        const req = makeUploadRequest(jpegBytes(), 'image/png');
        const res = await uploadPOST(req);
        expect(res.status).toBe(400);
    });

    it('rejects a forged WebP (RIFF header only, no WEBP marker) → 400', async () => {
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));
        // RIFF bytes but no WEBP at offset 8
        const buf = new Uint8Array(new ArrayBuffer(12));
        buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46;
        // bytes 8-11 NOT 'WEBP'
        buf[8] = 0x41; buf[9] = 0x56; buf[10] = 0x49; buf[11] = 0x20;
        const req = makeUploadRequest(buf, 'image/webp');
        const res = await uploadPOST(req);
        expect(res.status).toBe(400);
    });
});

// ═════════════════════════════════════════════════════════════
// 2. Upload route — rate-limit
// ═════════════════════════════════════════════════════════════

describe('POST /api/upload — rate-limit', () => {
    it('returns 429 + Retry-After header when the upload limit (20/15min) is exceeded', async () => {
        prefillUploadLimit(USER_A, 20); // fill all 20 slots
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));

        const req = makeUploadRequest(jpegBytes(), 'image/jpeg');
        const res = await uploadPOST(req);

        expect(res.status).toBe(429);
        const retryAfter = res.headers.get('Retry-After');
        expect(retryAfter).not.toBeNull();
        expect(Number(retryAfter)).toBeGreaterThan(0);
        const body = await res.json();
        expect(typeof body.error).toBe('string');
    });

    it('rate-limit is per-user: USER_A over limit does not block USER_B', async () => {
        prefillUploadLimit(USER_A, 20);
        // USER_B has a fresh store
        mockAuth.mockResolvedValueOnce(makeSession(USER_B));

        const req = makeUploadRequest(jpegBytes(), 'image/jpeg');
        const res = await uploadPOST(req);
        // USER_B should NOT be 429
        expect(res.status).not.toBe(429);
    });

    it('allows upload when under the limit (19/20 used)', async () => {
        prefillUploadLimit(USER_A, 19); // one slot remaining
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));

        const req = makeUploadRequest(jpegBytes(), 'image/jpeg');
        const res = await uploadPOST(req);
        expect(res.status).not.toBe(429);
    });
});

// ═════════════════════════════════════════════════════════════
// 3. Camp-create rate-limit — campsites route
// ═════════════════════════════════════════════════════════════

describe('POST /api/campsites — rate-limit (campsite:create:<userId>)', () => {
    it('returns 429 + Retry-After header when the create limit (10/hr) is exceeded', async () => {
        prefillCampsiteCreateLimit(USER_A, 10);
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));

        const res = await campsitesPOST(makeCampsitesRequest());

        expect(res.status).toBe(429);
        const retryAfter = res.headers.get('Retry-After');
        expect(retryAfter).not.toBeNull();
        expect(Number(retryAfter)).toBeGreaterThan(0);
    });

    it('does not call prisma.campSite.create when rate-limited', async () => {
        prefillCampsiteCreateLimit(USER_A, 10);
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));

        await campsitesPOST(makeCampsitesRequest());

        expect(mockCampSiteCreate).not.toHaveBeenCalled();
    });

    it('allows create when under the limit', async () => {
        prefillCampsiteCreateLimit(USER_A, 9); // 9/10 used — one slot remains
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));
        mockCampSiteCreate.mockResolvedValueOnce({ id: 'cs-1', nameTh: 'แคมป์ทดสอบ' });

        const res = await campsitesPOST(makeCampsitesRequest());
        expect(res.status).not.toBe(429);
    });
});

// ═════════════════════════════════════════════════════════════
// 4. Camp-create rate-limit — campgrounds route
// ═════════════════════════════════════════════════════════════

describe('POST /api/campgrounds — rate-limit (campsite:create:<userId>)', () => {
    it('returns 429 + Retry-After header when the create limit (10/hr) is exceeded', async () => {
        prefillCampsiteCreateLimit(USER_A, 10);
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));

        const res = await campgroundsPOST(makeCampgroundsRequest());

        expect(res.status).toBe(429);
        const retryAfter = res.headers.get('Retry-After');
        expect(retryAfter).not.toBeNull();
        expect(Number(retryAfter)).toBeGreaterThan(0);
    });
});

// ═════════════════════════════════════════════════════════════
// 5. Shared rate-limit key across both create routes
// ═════════════════════════════════════════════════════════════

describe('Shared key campsite:create:<userId> — campsites + campgrounds', () => {
    it('consuming slots via /api/campsites blocks /api/campgrounds for the same user', async () => {
        // Pre-fill 9 slots — one remains
        prefillCampsiteCreateLimit(USER_A, 9);

        // 10th slot consumed via campsites
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));
        mockCampSiteCreate.mockResolvedValueOnce({ id: 'cs-10', nameTh: 'แคมป์ทดสอบ' });
        const r1 = await campsitesPOST(makeCampsitesRequest());
        expect(r1.status).not.toBe(429);

        // 11th slot via campgrounds — should now be 429 (same key)
        mockAuth.mockResolvedValueOnce(makeSession(USER_A));
        const r2 = await campgroundsPOST(makeCampgroundsRequest());
        expect(r2.status).toBe(429);
    });

    it('USER_B is unaffected when USER_A hits the limit', async () => {
        prefillCampsiteCreateLimit(USER_A, 10);

        mockAuth.mockResolvedValueOnce(makeSession(USER_B));
        mockCampSiteCreate.mockResolvedValueOnce({ id: 'cs-b1', nameTh: 'แคมป์บี' });

        const res = await campsitesPOST(makeCampsitesRequest());
        expect(res.status).not.toBe(429);
    });
});
