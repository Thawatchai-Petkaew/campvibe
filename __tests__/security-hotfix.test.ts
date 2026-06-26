/**
 * Security regression tests — hotfix/security-4-bugs
 *
 * Covers 4 security fixes:
 *   1. apiError info-leak: 5xx must NOT expose `details`; 4xx may expose `details`
 *   2. Spot IDOR: GET/PUT/DELETE scoped to campSiteId so cross-campsite access → 404
 *   3. Upload auth + validation: 401 when unauthenticated; 400 for wrong type or oversize
 *   4. isVerified self-grant: CAMPER cannot set isVerified=true on campsite create
 *
 * Mocking style mirrors existing tests:
 *   - vi.mock('@/lib/prisma') with factory for per-test mockResolvedValue overrides
 *   - vi.mock('@/lib/auth-utils') for requireAuth / requireCampSiteOwnership
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before module imports (vi.mock is hoisted by vitest)
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    spot: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    campSite: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireAuth: vi.fn(),
  requireCampSiteOwnership: vi.fn(),
  requireCampSitePermission: vi.fn(),
}));

// Mock next-auth/auth that lib/auth-utils imports internally
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock campsite-filters since campsites/route.ts imports it for GET
vi.mock('@/lib/campsite-filters', () => ({
  buildCampSiteWhere: vi.fn().mockReturnValue({}),
}));

// ---------------------------------------------------------------------------
// Top-level imports of modules under test (after vi.mock declarations)
// ---------------------------------------------------------------------------

import { apiError, apiSuccess, arrayToCsv, csvToArray, calculateNights } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireCampSiteOwnership, requireCampSitePermission } from '@/lib/auth-utils';

// Route handlers are imported once; their mocked dependencies are already wired.
import { GET as spotGET, PUT as spotPUT, DELETE as spotDELETE } from '@/app/api/campsites/[id]/spots/[spotId]/route';
import { POST as uploadPOST } from '@/app/api/upload/route';
import { POST as campsitePOST } from '@/app/api/campsites/route';
import { POST as campgroundPOST } from '@/app/api/campgrounds/route';

// ---------------------------------------------------------------------------
// 1. apiError info-leak (lib/api-utils.ts) — pure unit, no mocks needed
// ---------------------------------------------------------------------------

describe('apiError info-leak — unit', () => {
  it('5xx: response body does NOT contain `details` key', async () => {
    const raw = new Error('DB connection refused');
    const res = apiError('Internal Server Error', 500, raw);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect('details' in body).toBe(false);
    expect(body.error).toBe('Internal Server Error');
  });

  it('5xx with no details arg: response body has only `error` key', async () => {
    const res = apiError('Something went wrong', 500);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect('details' in body).toBe(false);
    expect(body.error).toBe('Something went wrong');
  });

  it('4xx (400): response body DOES contain `details` key when details arg supplied', async () => {
    const zodErr = { fieldErrors: { name: ['Required'] } };
    const res = apiError('Validation Error', 400, zodErr);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect('details' in body).toBe(true);
    expect(body.details).toEqual(zodErr);
    expect(body.error).toBe('Validation Error');
  });

  it('4xx (401): details exposed for 4xx status codes', async () => {
    const info = { hint: 'missing token' };
    const res = apiError('Unauthorized', 401, info);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.details).toEqual(info);
  });

  it('5xx (503): details suppressed regardless of error shape', async () => {
    const res = apiError('Service Unavailable', 503, { stack: 'sensitive-stack-trace' });
    const body = await res.json();

    expect(res.status).toBe(503);
    expect('details' in body).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 1b. api-utils helper coverage (arrayToCsv / csvToArray / calculateNights / apiSuccess)
// ---------------------------------------------------------------------------

describe('api-utils helpers — unit', () => {
  describe('arrayToCsv', () => {
    it('joins array elements with commas', () => {
      expect(arrayToCsv(['a', 'b', 'c'])).toBe('a,b,c');
    });

    it('returns undefined for empty array', () => {
      expect(arrayToCsv([])).toBeUndefined();
    });

    it('returns undefined for null', () => {
      expect(arrayToCsv(null)).toBeUndefined();
    });

    it('returns undefined for undefined', () => {
      expect(arrayToCsv(undefined)).toBeUndefined();
    });
  });

  describe('csvToArray', () => {
    it('splits CSV string into array', () => {
      expect(csvToArray('a,b,c')).toEqual(['a', 'b', 'c']);
    });

    it('returns empty array for null', () => {
      expect(csvToArray(null)).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      expect(csvToArray('')).toEqual([]);
    });
  });

  describe('calculateNights', () => {
    it('calculates 1 night difference', () => {
      const checkIn = new Date('2025-01-01');
      const checkOut = new Date('2025-01-02');
      expect(calculateNights(checkIn, checkOut)).toBe(1);
    });

    it('calculates 3 nights difference', () => {
      const checkIn = new Date('2025-06-01');
      const checkOut = new Date('2025-06-04');
      expect(calculateNights(checkIn, checkOut)).toBe(3);
    });
  });

  describe('apiSuccess', () => {
    it('returns 200 with data by default', async () => {
      const res = apiSuccess({ id: 1 });
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({ id: 1 });
    });

    it('accepts custom status code', async () => {
      const res = apiSuccess({ created: true }, 201);
      expect(res.status).toBe(201);
    });
  });
});

// ---------------------------------------------------------------------------
// 1c. campsites/route.ts GET coverage (needed to hit 80% on that file)
// ---------------------------------------------------------------------------

import { GET as campsiteGET } from '@/app/api/campsites/route';

describe('GET /api/campsites — coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with { items, nextCursor } shape (PERF-3/CAM-196 cursor API)', async () => {
    // PERF-3 (CAM-196): GET /api/campsites now returns { items, nextCursor } instead of a
    // flat array. nextCursor is null when items.length < PAGE_SIZE (end of results).
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'site-1', nameTh: 'ค่าย A', location: {}, spots: [], reviews: [], createdAt: new Date(), priceLow: null, avgRating: null },
    ]);

    const req = new NextRequest('http://localhost/api/campsites');
    const res = await campsiteGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    // New contract: { items: CampCardPayload[], nextCursor: string | null }
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('nextCursor');
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(1);
    // 1 item < PAGE_SIZE=24 → no next page
    expect(body.nextCursor).toBeNull();
  });

  it('returns 200 with empty items and null nextCursor when no campsites exist', async () => {
    // PERF-3 (CAM-196): empty result → items:[], nextCursor:null.
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/campsites');
    const res = await campsiteGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('items');
    expect(body.items).toEqual([]);
    expect(body.nextCursor).toBeNull();
  });

  it('returns 500 when prisma throws', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));

    const req = new NextRequest('http://localhost/api/campsites');
    const res = await campsiteGET(req);

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// 2. Spot IDOR (app/api/campsites/[id]/spots/[spotId]/route.ts)
// ---------------------------------------------------------------------------

describe('Spot IDOR — scope spot access by campSiteId', () => {
  const CAMPSITE_ID = '550e8400-e29b-41d4-a716-446655440000';
  const SPOT_ID = '550e8400-e29b-41d4-a716-446655440001';
  const OTHER_SPOT_ID = '550e8400-e29b-41d4-a716-446655440002';

  // Params helper — route params are Promises in Next.js App Router
  const makeParams = (id: string, spotId: string) => ({
    params: Promise.resolve({ id, spotId }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: permission check passes (no auth error) — CAM-83: handlers use requireCampSitePermission
    (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
    // SEC-1: the GET handler now fetches campsite visibility fields first.
    // Default to a publicly visible camp so IDOR tests focus on spot-level scoping.
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isActive: true,
      isPublished: true,
      deletedAt: null,
      operatorId: 'op-default',
    });
  });

  // ---- GET ----------------------------------------------------------------

  describe('GET', () => {
    it('returns 404 when spot does not belong to requested campsite (cross-campsite read)', async () => {
      // Spot exists in a different campsite — findFirst with campSiteId scoping returns null
      (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots/${OTHER_SPOT_ID}`);
      const res = await spotGET(req, makeParams(CAMPSITE_ID, OTHER_SPOT_ID));
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBeTruthy();
    });

    it('findFirst called with where: { id: spotId, campSiteId } for GET', async () => {
      (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`);
      await spotGET(req, makeParams(CAMPSITE_ID, SPOT_ID));

      expect(prisma.spot.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: SPOT_ID, campSiteId: CAMPSITE_ID }),
        })
      );
    });

    it('returns 200 when spot belongs to the requested campsite', async () => {
      const ownedSpot = { id: SPOT_ID, campSiteId: CAMPSITE_ID, name: 'Spot A', campSite: {} };
      (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(ownedSpot);

      const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`);
      const res = await spotGET(req, makeParams(CAMPSITE_ID, SPOT_ID));

      expect(res.status).toBe(200);
    });

    it('returns 500 when prisma throws during GET', async () => {
      (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

      const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`);
      const res = await spotGET(req, makeParams(CAMPSITE_ID, SPOT_ID));

      expect(res.status).toBe(500);
    });
  });

  // ---- PUT ----------------------------------------------------------------

  describe('PUT', () => {
    it('returns auth error when requireCampSitePermission returns error (RBAC check branch)', async () => {
      const forbiddenResponse = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: forbiddenResponse,
      });

      const req = new NextRequest(
        `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
        { method: 'PUT', body: JSON.stringify({ name: 'x' }), headers: { 'content-type': 'application/json' } }
      );
      const res = await spotPUT(req, makeParams(CAMPSITE_ID, SPOT_ID));

      expect(res.status).toBe(403);
      expect(prisma.spot.findFirst).not.toHaveBeenCalled();
    });

    it('returns 404 when spotId does not belong to campsite — spot.update NOT called', async () => {
      // findFirst (IDOR scope check) returns null
      (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const req = new NextRequest(
        `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${OTHER_SPOT_ID}`,
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Hijacked', pricePerNight: 0 }),
          headers: { 'content-type': 'application/json' },
        }
      );
      const res = await spotPUT(req, makeParams(CAMPSITE_ID, OTHER_SPOT_ID));
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBeTruthy();
      expect(prisma.spot.update).not.toHaveBeenCalled();
    });

    it('returns 400 when PUT body fails Zod validation', async () => {
      const req = new NextRequest(
        `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
        {
          method: 'PUT',
          // pricePerNight must be a number — sending string fails validation
          body: JSON.stringify({ pricePerNight: 'not-a-number' }),
          headers: { 'content-type': 'application/json' },
        }
      );
      const res = await spotPUT(req, makeParams(CAMPSITE_ID, SPOT_ID));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toMatch(/validation/i);
      expect(prisma.spot.findFirst).not.toHaveBeenCalled();
    });

    it('findFirst for PUT called with where: { id: spotId, campSiteId }', async () => {
      (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const req = new NextRequest(
        `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'My Spot', pricePerNight: 0 }),
          headers: { 'content-type': 'application/json' },
        }
      );
      await spotPUT(req, makeParams(CAMPSITE_ID, SPOT_ID));

      expect(prisma.spot.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: SPOT_ID, campSiteId: CAMPSITE_ID }),
        })
      );
    });

    it('returns 500 when prisma.spot.update throws', async () => {
      (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });
      (prisma.spot.update as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

      const req = new NextRequest(
        `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated', pricePerNight: 100 }),
          headers: { 'content-type': 'application/json' },
        }
      );
      const res = await spotPUT(req, makeParams(CAMPSITE_ID, SPOT_ID));

      expect(res.status).toBe(500);
    });

    it('proceeds (200) when spot belongs to campsite', async () => {
      (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });
      (prisma.spot.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID, name: 'Updated' });

      const req = new NextRequest(
        `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated', pricePerNight: 100 }),
          headers: { 'content-type': 'application/json' },
        }
      );
      const res = await spotPUT(req, makeParams(CAMPSITE_ID, SPOT_ID));

      expect(res.status).toBe(200);
      expect(prisma.spot.update).toHaveBeenCalledOnce();
    });
  });

  // ---- DELETE -------------------------------------------------------------

  describe('DELETE', () => {
    it('returns auth error when requireCampSitePermission returns error (RBAC check branch)', async () => {
      const forbiddenResponse = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: forbiddenResponse,
      });

      const req = new NextRequest(
        `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
        { method: 'DELETE' }
      );
      const res = await spotDELETE(req, makeParams(CAMPSITE_ID, SPOT_ID));

      expect(res.status).toBe(403);
      expect(prisma.spot.findFirst).not.toHaveBeenCalled();
    });

    it('returns 404 when spotId does not belong to campsite — spot.delete NOT called', async () => {
      (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const req = new NextRequest(
        `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${OTHER_SPOT_ID}`,
        { method: 'DELETE' }
      );
      const res = await spotDELETE(req, makeParams(CAMPSITE_ID, OTHER_SPOT_ID));
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBeTruthy();
      expect(prisma.spot.delete).not.toHaveBeenCalled();
    });

    it('findFirst for DELETE called with where: { id: spotId, campSiteId }', async () => {
      (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const req = new NextRequest(
        `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
        { method: 'DELETE' }
      );
      await spotDELETE(req, makeParams(CAMPSITE_ID, SPOT_ID));

      expect(prisma.spot.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: SPOT_ID, campSiteId: CAMPSITE_ID }),
        })
      );
    });

    it('proceeds (200) when spot belongs to campsite', async () => {
      (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });
      (prisma.spot.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });

      const req = new NextRequest(
        `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
        { method: 'DELETE' }
      );
      const res = await spotDELETE(req, makeParams(CAMPSITE_ID, SPOT_ID));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(prisma.spot.delete).toHaveBeenCalledOnce();
    });

    it('returns 500 when prisma throws during DELETE', async () => {
      (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });
      (prisma.spot.delete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

      const req = new NextRequest(
        `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
        { method: 'DELETE' }
      );
      const res = await spotDELETE(req, makeParams(CAMPSITE_ID, SPOT_ID));

      expect(res.status).toBe(500);
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Upload auth + validation (app/api/upload/route.ts)
// ---------------------------------------------------------------------------

describe('Upload auth + validation — security branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper: build a FormData POST request carrying a File
  function makeUploadRequest(file: File): Request {
    const fd = new FormData();
    fd.append('file', file);
    return new Request('http://localhost/api/upload', {
      method: 'POST',
      body: fd,
    });
  }

  it('returns 401 when no session (requireAuth returns error response)', async () => {
    const unauthorizedResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ error: unauthorizedResponse, session: null });

    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    const req = makeUploadRequest(file);
    const res = await uploadPOST(req);

    expect(res.status).toBe(401);
  });

  it('returns 400 for non-image file type (text/plain) when authenticated', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: null,
      session: { user: { id: 'user-1', role: 'CAMPER' } },
    });

    const file = new File(['not an image'], 'doc.txt', { type: 'text/plain' });
    const req = makeUploadRequest(file);
    const res = await uploadPOST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/unsupported file type/i);
  });

  it('returns 400 for oversized image (>5MB) when authenticated', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: null,
      session: { user: { id: 'user-1', role: 'CAMPER' } },
    });

    // 5MB + 1 byte — just over the limit
    const oversizeBytes = new Uint8Array(5 * 1024 * 1024 + 1);
    const file = new File([oversizeBytes], 'large.png', { type: 'image/png' });
    const req = makeUploadRequest(file);
    const res = await uploadPOST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/too large/i);
  });

  it('returns 400 when no file field is present in FormData', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: null,
      session: { user: { id: 'user-1', role: 'CAMPER' } },
    });

    // Send FormData without a "file" field
    const fd = new FormData();
    const req = new Request('http://localhost/api/upload', { method: 'POST', body: fd });
    const res = await uploadPOST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/no file/i);
  });

  it('does not reject image/png at exactly 5MB (boundary — passes size check)', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: null,
      session: { user: { id: 'user-1', role: 'CAMPER' } },
    });

    // Exactly at the limit — must NOT be rejected by size check
    const exactBytes = new Uint8Array(5 * 1024 * 1024);
    const file = new File([exactBytes], 'exact.png', { type: 'image/png' });
    const req = makeUploadRequest(file);
    const res = await uploadPOST(req);

    // Not 401 (auth passed), not rejected for "too large"
    expect(res.status).not.toBe(401);
    if (res.status === 400) {
      const body = await res.json();
      expect(body.error).not.toMatch(/too large/i);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. isVerified self-grant (app/api/campsites/route.ts POST)
// ---------------------------------------------------------------------------

describe('isVerified self-grant prevention — POST /api/campsites', () => {
  // Minimal payload satisfying campSiteSchema required fields
  const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
  const MINIMAL_VALID_PAYLOAD = {
    nameTh: 'ค่ายทดสอบ',
    latitude: 13.75,
    longitude: 100.5,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    bookingMethod: 'ONLI',
    locationId: VALID_UUID,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // prisma.campSite.create echoes back the data argument
    (prisma.campSite.create as ReturnType<typeof vi.fn>).mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'new-campsite-id', ...data })
    );
  });

  it('CAMPER sending isVerified:true → campSite.create receives isVerified:false', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: null,
      session: { user: { id: 'user-camper-1', role: 'CAMPER', email: 'camper@test.com' } },
    });

    const req = new NextRequest('http://localhost/api/campsites', {
      method: 'POST',
      body: JSON.stringify({ ...MINIMAL_VALID_PAYLOAD, isVerified: true }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await campsitePOST(req);
    expect(res.status).toBe(201);

    expect(prisma.campSite.create).toHaveBeenCalledOnce();
    const createArg = (prisma.campSite.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createArg.data.isVerified).toBe(false);
  });

  it('ADMIN sending isVerified:true → campSite.create receives isVerified:true', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: null,
      session: { user: { id: 'user-admin-1', role: 'ADMIN', email: 'admin@test.com' } },
    });

    const req = new NextRequest('http://localhost/api/campsites', {
      method: 'POST',
      body: JSON.stringify({ ...MINIMAL_VALID_PAYLOAD, isVerified: true }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await campsitePOST(req);
    expect(res.status).toBe(201);

    expect(prisma.campSite.create).toHaveBeenCalledOnce();
    const createArg = (prisma.campSite.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createArg.data.isVerified).toBe(true);
  });

  it('OPERATOR sending isVerified:true → campSite.create receives isVerified:false', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: null,
      session: { user: { id: 'user-op-1', role: 'OPERATOR', email: 'op@test.com' } },
    });

    const req = new NextRequest('http://localhost/api/campsites', {
      method: 'POST',
      body: JSON.stringify({ ...MINIMAL_VALID_PAYLOAD, isVerified: true }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await campsitePOST(req);
    expect(res.status).toBe(201);

    const createArg = (prisma.campSite.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createArg.data.isVerified).toBe(false);
  });

  it('ADMIN sending isVerified:false → campSite.create receives isVerified:false', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: null,
      session: { user: { id: 'user-admin-1', role: 'ADMIN', email: 'admin@test.com' } },
    });

    const req = new NextRequest('http://localhost/api/campsites', {
      method: 'POST',
      body: JSON.stringify({ ...MINIMAL_VALID_PAYLOAD, isVerified: false }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await campsitePOST(req);
    expect(res.status).toBe(201);

    const createArg = (prisma.campSite.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createArg.data.isVerified).toBe(false);
  });

  it('returns 401 when caller is unauthenticated', async () => {
    const unauthorizedResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ error: unauthorizedResponse, session: null });

    const req = new NextRequest('http://localhost/api/campsites', {
      method: 'POST',
      body: JSON.stringify({ ...MINIMAL_VALID_PAYLOAD, isVerified: true }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await campsitePOST(req);
    expect(res.status).toBe(401);
    expect(prisma.campSite.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4b. isVerified self-grant — POST /api/campgrounds (parallel route, same bug)
// ---------------------------------------------------------------------------

describe('isVerified self-grant prevention — POST /api/campgrounds', () => {
  const MINIMAL_VALID_PAYLOAD = {
    nameTh: 'ค่ายทดสอบ',
    latitude: 13.75,
    longitude: 100.5,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    bookingMethod: 'ONLI',
    locationId: '123e4567-e89b-12d3-a456-426614174000',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.campSite.create as ReturnType<typeof vi.fn>).mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'new-campground-id', ...data })
    );
  });

  it('CAMPER sending isVerified:true → create receives isVerified:false', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: null,
      session: { user: { id: 'u-camper', role: 'CAMPER', email: 'c@test.com' } },
    });
    const req = new NextRequest('http://localhost/api/campgrounds', {
      method: 'POST',
      body: JSON.stringify({ ...MINIMAL_VALID_PAYLOAD, isVerified: true }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await campgroundPOST(req);
    expect(res.status).toBe(201);
    const createArg = (prisma.campSite.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createArg.data.isVerified).toBe(false);
  });

  it('ADMIN sending isVerified:true → create receives isVerified:true', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: null,
      session: { user: { id: 'u-admin', role: 'ADMIN', email: 'a@test.com' } },
    });
    const req = new NextRequest('http://localhost/api/campgrounds', {
      method: 'POST',
      body: JSON.stringify({ ...MINIMAL_VALID_PAYLOAD, isVerified: true }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await campgroundPOST(req);
    expect(res.status).toBe(201);
    const createArg = (prisma.campSite.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createArg.data.isVerified).toBe(true);
  });
});
