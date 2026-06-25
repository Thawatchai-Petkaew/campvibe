/**
 * CAM-83 — Spot CRUD RBAC regression tests
 *
 * Proves that spot mutation endpoints use the team RBAC engine
 * (requireCampSitePermission) instead of owner-only checks, so that:
 *   - owner (via session.user.id === campSite.operatorId)  → allowed
 *   - platform ADMIN (session.user.role === 'ADMIN')       → allowed
 *   - team member with CAMPSITE_UPDATE (e.g. ADMIN role)   → allowed for POST/PUT
 *   - team member with CAMPSITE_DELETE (OWNER role)        → allowed for DELETE
 *   - team member WITHOUT the required permission (VIEWER) → 403
 *   - non-member (authenticated, not on the team)          → 403
 *   - unauthenticated                                      → 401
 *
 * Error-code set per handler:
 *   POST   /spots           : 401 · 403 · 400 · 201 · 500
 *   PUT    /spots/[spotId]  : 401 · 403 · 400 · 404 · 200 · 500
 *   DELETE /spots/[spotId]  : 401 · 403 · 404 · 200 · 500
 *
 * Mocking strategy: vi.mock('@/lib/auth-utils') controls the entire
 * RBAC decision surface so we test the handler wiring, not the helper
 * internals (those are tested in auth-utils / team-permissions unit tests).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findUnique: vi.fn(),
    },
    spot: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireCampSitePermission: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/prisma';
import { requireCampSitePermission } from '@/lib/auth-utils';

import {
  GET as spotsGET,
  POST as spotsPOST,
} from '@/app/api/campsites/[id]/spots/route';

import {
  PUT as spotPUT,
  DELETE as spotDELETE,
} from '@/app/api/campsites/[id]/spots/[spotId]/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CAMPSITE_ID = '550e8400-e29b-41d4-a716-446655440000';
const SPOT_ID = '550e8400-e29b-41d4-a716-446655440001';

const makeCollectionParams = (id: string) => ({
  params: Promise.resolve({ id }),
});

const makeItemParams = (id: string, spotId: string) => ({
  params: Promise.resolve({ id, spotId }),
});

const allowedResult = { error: null, campSite: { id: CAMPSITE_ID } as never, session: {} as never };
const unauthorizedResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const forbiddenResponse = NextResponse.json({ error: 'Forbidden' }, { status: 403 });

function mockAllowed() {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue(allowedResult);
}
function mockUnauthorized() {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: unauthorizedResponse,
    campSite: null,
    session: null,
  });
}
function mockForbidden() {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: forbiddenResponse,
    campSite: null,
    session: null,
  });
}

// ---------------------------------------------------------------------------
// POST /api/campsites/[id]/spots  (create spot — CAMPSITE_UPDATE required)
// ---------------------------------------------------------------------------

describe('POST /api/campsites/[id]/spots — RBAC', () => {
  const VALID_BODY = {
    name: 'Spot A',
    pricePerNight: 500,
    maxCampers: 4,
    maxTents: 2,
  };

  beforeEach(() => vi.clearAllMocks());

  it('401 — unauthenticated caller is rejected before any DB access', async () => {
    mockUnauthorized();

    const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots`, {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
      headers: { 'content-type': 'application/json' },
    });
    const res = await spotsPOST(req, makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(401);
    expect(prisma.spot.create).not.toHaveBeenCalled();
  });

  it('403 — authenticated non-member (no CAMPSITE_UPDATE) is rejected', async () => {
    mockForbidden();

    const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots`, {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
      headers: { 'content-type': 'application/json' },
    });
    const res = await spotsPOST(req, makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(403);
    expect(prisma.spot.create).not.toHaveBeenCalled();
  });

  it('403 — team member WITHOUT CAMPSITE_UPDATE (VIEWER role) is rejected', async () => {
    // VIEWER default permissions = ['BOOKING_VIEW'] — no CAMPSITE_UPDATE
    mockForbidden();

    const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots`, {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
      headers: { 'content-type': 'application/json' },
    });
    const res = await spotsPOST(req, makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(403);
    expect(prisma.spot.create).not.toHaveBeenCalled();
  });

  it('uses requireCampSitePermission with CAMPSITE_UPDATE — not requireCampSiteOwnership', async () => {
    mockForbidden();

    const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots`, {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
      headers: { 'content-type': 'application/json' },
    });
    await spotsPOST(req, makeCollectionParams(CAMPSITE_ID));

    expect(requireCampSitePermission).toHaveBeenCalledWith(CAMPSITE_ID, 'CAMPSITE_UPDATE');
  });

  it('201 — owner/team-admin with CAMPSITE_UPDATE is allowed to create a spot', async () => {
    mockAllowed();
    (prisma.spot.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: SPOT_ID,
      name: 'Spot A',
      campSiteId: CAMPSITE_ID,
    });

    const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots`, {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
      headers: { 'content-type': 'application/json' },
    });
    const res = await spotsPOST(req, makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(201);
    expect(prisma.spot.create).toHaveBeenCalledOnce();
  });

  it('400 — valid permission but invalid body returns validation error', async () => {
    mockAllowed();

    const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots`, {
      method: 'POST',
      body: JSON.stringify({ pricePerNight: 'not-a-number' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await spotsPOST(req, makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(400);
    expect(prisma.spot.create).not.toHaveBeenCalled();
  });

  it('500 — prisma.spot.create throws returns 500 without leaking details', async () => {
    mockAllowed();
    (prisma.spot.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

    const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots`, {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
      headers: { 'content-type': 'application/json' },
    });
    const res = await spotsPOST(req, makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect('details' in body).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/campsites/[id]/spots/[spotId]  (update — CAMPSITE_UPDATE required)
// ---------------------------------------------------------------------------

describe('PUT /api/campsites/[id]/spots/[spotId] — RBAC', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 — unauthenticated caller is rejected before any DB access', async () => {
    mockUnauthorized();

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
      { method: 'PUT', body: JSON.stringify({ name: 'x' }), headers: { 'content-type': 'application/json' } }
    );
    const res = await spotPUT(req, makeItemParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(401);
    expect(prisma.spot.findFirst).not.toHaveBeenCalled();
    expect(prisma.spot.update).not.toHaveBeenCalled();
  });

  it('403 — non-member (no CAMPSITE_UPDATE) is rejected', async () => {
    mockForbidden();

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
      { method: 'PUT', body: JSON.stringify({ name: 'x' }), headers: { 'content-type': 'application/json' } }
    );
    const res = await spotPUT(req, makeItemParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(403);
    expect(prisma.spot.update).not.toHaveBeenCalled();
  });

  it('403 — team member WITHOUT CAMPSITE_UPDATE (VIEWER/STAFF/MANAGER) is rejected', async () => {
    // MANAGER default = ['BOOKING_VIEW', 'BOOKING_UPDATE', 'TEAM_VIEW', 'ANALYTICS_VIEW']
    // STAFF/VIEWER have even fewer — none have CAMPSITE_UPDATE
    mockForbidden();

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
      { method: 'PUT', body: JSON.stringify({ name: 'Hacked' }), headers: { 'content-type': 'application/json' } }
    );
    const res = await spotPUT(req, makeItemParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(403);
    expect(prisma.spot.update).not.toHaveBeenCalled();
  });

  it('uses requireCampSitePermission with CAMPSITE_UPDATE', async () => {
    mockForbidden();

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
      { method: 'PUT', body: JSON.stringify({ name: 'x' }), headers: { 'content-type': 'application/json' } }
    );
    await spotPUT(req, makeItemParams(CAMPSITE_ID, SPOT_ID));

    expect(requireCampSitePermission).toHaveBeenCalledWith(CAMPSITE_ID, 'CAMPSITE_UPDATE');
  });

  it('200 — owner/team-admin WITH CAMPSITE_UPDATE can update the spot', async () => {
    mockAllowed();
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
    const res = await spotPUT(req, makeItemParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(200);
    expect(prisma.spot.update).toHaveBeenCalledOnce();
  });

  it('404 — spot does not belong to this campsite even with permission', async () => {
    mockAllowed();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
      {
        method: 'PUT',
        body: JSON.stringify({ name: 'Hijacked' }),
        headers: { 'content-type': 'application/json' },
      }
    );
    const res = await spotPUT(req, makeItemParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(404);
    expect(prisma.spot.update).not.toHaveBeenCalled();
  });

  it('400 — valid permission but invalid body returns validation error', async () => {
    mockAllowed();

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
      {
        method: 'PUT',
        body: JSON.stringify({ pricePerNight: 'bad' }),
        headers: { 'content-type': 'application/json' },
      }
    );
    const res = await spotPUT(req, makeItemParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(400);
    expect(prisma.spot.findFirst).not.toHaveBeenCalled();
    expect(prisma.spot.update).not.toHaveBeenCalled();
  });

  it('500 — prisma.spot.update throws returns 500 without leaking details', async () => {
    mockAllowed();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });
    (prisma.spot.update as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
      {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated', pricePerNight: 100 }),
        headers: { 'content-type': 'application/json' },
      }
    );
    const res = await spotPUT(req, makeItemParams(CAMPSITE_ID, SPOT_ID));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect('details' in body).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/campsites/[id]/spots/[spotId]  (CAMPSITE_DELETE required)
// ---------------------------------------------------------------------------

describe('DELETE /api/campsites/[id]/spots/[spotId] — RBAC', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 — unauthenticated caller is rejected before any DB access', async () => {
    mockUnauthorized();

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
      { method: 'DELETE' }
    );
    const res = await spotDELETE(req, makeItemParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(401);
    expect(prisma.spot.findFirst).not.toHaveBeenCalled();
    expect(prisma.spot.delete).not.toHaveBeenCalled();
  });

  it('403 — non-member is rejected (no CAMPSITE_DELETE)', async () => {
    mockForbidden();

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
      { method: 'DELETE' }
    );
    const res = await spotDELETE(req, makeItemParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(403);
    expect(prisma.spot.delete).not.toHaveBeenCalled();
  });

  it('403 — team ADMIN (has CAMPSITE_UPDATE but NOT CAMPSITE_DELETE) is rejected', async () => {
    // ADMIN default permissions include CAMPSITE_UPDATE but NOT CAMPSITE_DELETE.
    // Deleting a spot requires CAMPSITE_DELETE — only OWNER has it by default.
    mockForbidden();

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
      { method: 'DELETE' }
    );
    const res = await spotDELETE(req, makeItemParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(403);
    expect(prisma.spot.delete).not.toHaveBeenCalled();
  });

  it('uses requireCampSitePermission with CAMPSITE_DELETE', async () => {
    mockForbidden();

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
      { method: 'DELETE' }
    );
    await spotDELETE(req, makeItemParams(CAMPSITE_ID, SPOT_ID));

    expect(requireCampSitePermission).toHaveBeenCalledWith(CAMPSITE_ID, 'CAMPSITE_DELETE');
  });

  it('200 — owner with CAMPSITE_DELETE can delete the spot', async () => {
    mockAllowed();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });
    (prisma.spot.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
      { method: 'DELETE' }
    );
    const res = await spotDELETE(req, makeItemParams(CAMPSITE_ID, SPOT_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.spot.delete).toHaveBeenCalledOnce();
  });

  it('404 — spot does not belong to this campsite even with permission', async () => {
    mockAllowed();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
      { method: 'DELETE' }
    );
    const res = await spotDELETE(req, makeItemParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(404);
    expect(prisma.spot.delete).not.toHaveBeenCalled();
  });

  it('500 — prisma.spot.delete throws returns 500 without leaking details', async () => {
    mockAllowed();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });
    (prisma.spot.delete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
      { method: 'DELETE' }
    );
    const res = await spotDELETE(req, makeItemParams(CAMPSITE_ID, SPOT_ID));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect('details' in body).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/campsites/[id]/spots  (public read — no authz gate)
// ---------------------------------------------------------------------------

describe('GET /api/campsites/[id]/spots — no auth required for public camps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // SEC-1: GET now checks campsite visibility before returning spots.
    // Default to a publicly visible camp so RBAC-focused tests are unaffected.
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isActive: true,
      isPublished: true,
      deletedAt: null,
      operatorId: 'op-default',
    });
  });

  it('200 — returns spots for a public camp without any RBAC permission check', async () => {
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: SPOT_ID, name: 'Spot A', campSiteId: CAMPSITE_ID, images: [] },
    ]);

    const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots`);
    const res = await spotsGET(req, makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(200);
    expect(requireCampSitePermission).not.toHaveBeenCalled();
  });
});
