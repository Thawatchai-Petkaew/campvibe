/**
 * cam-362-zone-api.test.ts — CAM-362 GET/POST /api/campsites/[id]/zones +
 * the additive spot-write zoneId resolution (tech.md §3.1, §3.2, §4.2,
 * §6 confirmation tests #4, #5, #6).
 *
 * Covers:
 *  - GET  — visibility gate (mirrors spots GET, NOT requireCampSitePermission),
 *    live-only + ordering, 404 no-info-disclosure.
 *  - POST — 400 bounds (empty/whitespace/>50/exactly-50), 409 duplicate
 *    (case/whitespace collide) + P2002 race backstop, soft-deleted name
 *    re-creatable (201), 401/403 authz, IDOR scoping.
 *  - Spot POST/PUT — zoneId validated (belongs to camp + live) + T1 mirror
 *    into Spot.zone; legacy zone-string-only path unchanged; 404 IDOR guard
 *    for a cross-camp/soft-deleted/nonexistent zoneId.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import {
  ZONE_NAME_REQUIRED_MESSAGE,
  ZONE_NAME_TOO_LONG_MESSAGE,
  ZONE_DUPLICATE_MESSAGE,
} from '@/lib/validations/zone';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: { findUnique: vi.fn() },
    zone: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    spot: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireCampSitePermission: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { auth } from '@/lib/auth';

import { GET as zonesGET, POST as zonesPOST } from '@/app/api/campsites/[id]/zones/route';
import { POST as spotsPOST } from '@/app/api/campsites/[id]/spots/route';
import { PUT as spotPUT } from '@/app/api/campsites/[id]/spots/[spotId]/route';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const CAMPSITE_ID = '550e8400-e29b-41d4-a716-446655440030';
const ZONE_ID = '550e8400-e29b-41d4-a716-446655440031';
const SPOT_ID = '550e8400-e29b-41d4-a716-446655440032';

const makeCollectionParams = (id: string) => ({ params: Promise.resolve({ id }) });
const makeItemParams = (id: string, spotId: string) => ({ params: Promise.resolve({ id, spotId }) });

const hostSession = { user: { id: 'host-1', email: 'host@campvibe.com', role: 'OPERATOR' } };
const allowedResult = {
  error: null,
  campSite: { id: CAMPSITE_ID, nameThSlug: 'slug-th', nameEnSlug: 'slug-en' } as never,
  session: hostSession as never,
};
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

function getReq() {
  return new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/zones`);
}
function postReq(body: unknown) {
  return new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/zones`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

/** Runs the tx callback against a plain mocked tx object (zone.findFirst/count/create). */
function makeZoneCreateTxMock(opts: { existingLiveZone?: { id: string } | null; liveCount?: number }) {
  return {
    zone: {
      findFirst: vi.fn().mockResolvedValue(opts.existingLiveZone ?? null),
      count: vi.fn().mockResolvedValue(opts.liveCount ?? 0),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: ZONE_ID,
          campSiteId: data.campSiteId,
          name: data.name,
          sortOrder: data.sortOrder,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      ),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// Group A: GET /api/campsites/[id]/zones — visibility gate (tech.md §3.1)
// ===========================================================================

describe('GET /api/campsites/[id]/zones — visibility gate (mirrors spots GET)', () => {
  it('404 — camp not found', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await zonesGET(getReq(), makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(404);
    expect(prisma.zone.findMany).not.toHaveBeenCalled();
  });

  it('404 — a private (unpublished) camp is not viewable by an anonymous caller (no info-disclosure)', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isActive: true,
      isPublished: false,
      deletedAt: null,
      operatorId: 'someone-else',
    });
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await zonesGET(getReq(), makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(404);
    expect(requireCampSitePermission).not.toHaveBeenCalled();
  });

  it('200 — a public camp is readable by anyone, no requireCampSitePermission call', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isActive: true,
      isPublished: true,
      deletedAt: null,
      operatorId: 'op-1',
    });
    (prisma.zone.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: ZONE_ID, campSiteId: CAMPSITE_ID, name: 'โซน A', sortOrder: 0 },
    ]);

    const res = await zonesGET(getReq(), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(requireCampSitePermission).not.toHaveBeenCalled();
  });

  it('200 — the owner can view zones on their own unpublished camp', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isActive: true,
      isPublished: false,
      deletedAt: null,
      operatorId: 'owner-1',
    });
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'owner-1', role: 'OPERATOR' } });
    (prisma.zone.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await zonesGET(getReq(), makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(200);
  });

  it('queries live zones only, ordered sortOrder asc then name asc (no N+1 — single query)', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isActive: true,
      isPublished: true,
      deletedAt: null,
      operatorId: 'op-1',
    });
    (prisma.zone.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await zonesGET(getReq(), makeCollectionParams(CAMPSITE_ID));

    expect(prisma.zone.findMany).toHaveBeenCalledOnce();
    const call = (prisma.zone.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where).toEqual({ campSiteId: CAMPSITE_ID, deletedAt: null });
    expect(call.orderBy).toEqual([{ sortOrder: 'asc' }, { name: 'asc' }]);
  });

  it('500 — prisma throws returns 500 without leaking details', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isActive: true,
      isPublished: true,
      deletedAt: null,
      operatorId: 'op-1',
    });
    (prisma.zone.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));

    const res = await zonesGET(getReq(), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect('details' in body).toBe(false);
  });
});

// ===========================================================================
// Group B: POST /api/campsites/[id]/zones — authz + bounds + duplicate (tech.md §3.2)
// ===========================================================================

describe('POST /api/campsites/[id]/zones — authz', () => {
  it('401 — unauthenticated caller is rejected before any DB access', async () => {
    mockUnauthorized();

    const res = await zonesPOST(postReq({ name: 'โซน A' }), makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('403 — caller without CAMPSITE_UPDATE is rejected', async () => {
    mockForbidden();

    const res = await zonesPOST(postReq({ name: 'โซน A' }), makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses requireCampSitePermission with CAMPSITE_UPDATE', async () => {
    mockForbidden();

    await zonesPOST(postReq({ name: 'โซน A' }), makeCollectionParams(CAMPSITE_ID));

    expect(requireCampSitePermission).toHaveBeenCalledWith(CAMPSITE_ID, 'CAMPSITE_UPDATE');
  });
});

describe('POST /api/campsites/[id]/zones — name bounds (BR, tech.md §3.2)', () => {
  it('400 — an empty name is rejected with the exact Thai copy', async () => {
    mockAllowed();

    const res = await zonesPOST(postReq({ name: '' }), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe(ZONE_NAME_REQUIRED_MESSAGE);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('400 — a whitespace-only name collapses to empty and is rejected (same Thai copy)', async () => {
    mockAllowed();

    const res = await zonesPOST(postReq({ name: '   ' }), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe(ZONE_NAME_REQUIRED_MESSAGE);
  });

  it('400 — a name over 50 chars (after normalization) is rejected with the exact Thai copy', async () => {
    mockAllowed();

    const res = await zonesPOST(postReq({ name: 'a'.repeat(51) }), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe(ZONE_NAME_TOO_LONG_MESSAGE);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('[boundary] a name exactly 50 chars is accepted (not rejected at the bound)', async () => {
    mockAllowed();
    const tx = makeZoneCreateTxMock({ existingLiveZone: null, liveCount: 0 });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(tx));

    const res = await zonesPOST(postReq({ name: 'a'.repeat(50) }), makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(201);
  });

  it('collapses internal whitespace + trims before bounds/dup checks (transform then bound)', async () => {
    mockAllowed();
    const tx = makeZoneCreateTxMock({ existingLiveZone: null, liveCount: 0 });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(tx));

    await zonesPOST(postReq({ name: '  โซน   A  ' }), makeCollectionParams(CAMPSITE_ID));

    expect(tx.zone.create).toHaveBeenCalledOnce();
    const createArgs = tx.zone.create.mock.calls[0][0];
    expect(createArgs.data.name).toBe('โซน A');
  });
});

describe('POST /api/campsites/[id]/zones — 409 duplicate + soft-delete semantics (tech.md §3.2)', () => {
  it('409 — a duplicate LIVE name (exact match) is rejected with the exact Thai copy, no row created', async () => {
    mockAllowed();
    const tx = makeZoneCreateTxMock({ existingLiveZone: { id: 'existing-zone' } });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      try {
        return await cb(tx);
      } catch (e) {
        throw e;
      }
    });

    const res = await zonesPOST(postReq({ name: 'โซน A' }), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe(ZONE_DUPLICATE_MESSAGE);
    expect(tx.zone.create).not.toHaveBeenCalled();
  });

  it('409 — a case/whitespace-variant duplicate is rejected (the pre-check uses mode: insensitive)', async () => {
    mockAllowed();
    const tx = makeZoneCreateTxMock({ existingLiveZone: { id: 'existing-zone' } });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(tx));

    const res = await zonesPOST(postReq({ name: 'โซน a' }), makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(409);
    const findArgs = tx.zone.findFirst.mock.calls[0][0];
    expect(findArgs.where.name).toEqual({ equals: 'โซน a', mode: 'insensitive' });
    expect(findArgs.where.deletedAt).toBeNull();
  });

  it('409 — P2002 (partial unique index race backstop) on create is mapped to 409, same Thai copy', async () => {
    mockAllowed();
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });
    const tx = {
      zone: {
        findFirst: vi.fn().mockResolvedValue(null), // pre-check missed the race
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockRejectedValue(p2002),
      },
    };
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      try {
        return await cb(tx);
      } catch (e) {
        throw e;
      }
    });

    const res = await zonesPOST(postReq({ name: 'โซน A' }), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe(ZONE_DUPLICATE_MESSAGE);
  });

  it('201 — a previously soft-deleted name is re-creatable (the pre-check excludes deletedAt rows)', async () => {
    mockAllowed();
    // The mocked findFirst is scoped deletedAt: null by the route's own where
    // clause — a soft-deleted row is never returned, so this simulates that
    // by resolving null even though a tombstone "exists" conceptually.
    const tx = makeZoneCreateTxMock({ existingLiveZone: null, liveCount: 1 });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(tx));

    const res = await zonesPOST(postReq({ name: 'โซน VIP' }), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.name).toBe('โซน VIP');
    // sortOrder appends after the live count.
    expect(body.sortOrder).toBe(1);
  });

  it('the duplicate pre-check + create are scoped to THIS campSiteId (no cross-camp collision)', async () => {
    mockAllowed();
    const tx = makeZoneCreateTxMock({ existingLiveZone: null, liveCount: 0 });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(tx));

    await zonesPOST(postReq({ name: 'โซน A' }), makeCollectionParams(CAMPSITE_ID));

    const findArgs = tx.zone.findFirst.mock.calls[0][0];
    expect(findArgs.where.campSiteId).toBe(CAMPSITE_ID);
    const createArgs = tx.zone.create.mock.calls[0][0];
    expect(createArgs.data.campSiteId).toBe(CAMPSITE_ID);
  });

  it('500 — a non-duplicate transaction error returns 500 without leaking internals', async () => {
    mockAllowed();
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNRESET'));

    const res = await zonesPOST(postReq({ name: 'โซน A' }), makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect('details' in body).toBe(false);
  });
});

// ===========================================================================
// Group C: Spot write paths — zoneId resolution + T1 mirror (tech.md §4.2)
// ===========================================================================

function spotPostReq(body: unknown) {
  return new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}
function spotPutReq(body: unknown) {
  return new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/campsites/[id]/spots — zoneId resolution + T1 mirror (tech.md §4.2)', () => {
  it('201 — a valid zoneId (belongs to camp, live) sets Spot.zoneId AND mirrors Zone.name into Spot.zone (T1)', async () => {
    mockAllowed();
    (prisma.zone.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ name: 'โซน A' });
    (prisma.spot.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });

    const res = await spotsPOST(
      spotPostReq({ name: 'Spot A', pricePerNight: 500, zoneId: ZONE_ID }),
      makeCollectionParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(201);
    const findArgs = (prisma.zone.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(findArgs.where).toEqual({ id: ZONE_ID, campSiteId: CAMPSITE_ID, deletedAt: null });
    const createArgs = (prisma.spot.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createArgs.data.zoneId).toBe(ZONE_ID);
    expect(createArgs.data.zone).toBe('โซน A'); // T1 mirror
  });

  it('404 — a zoneId that does not belong to this campsite (cross-camp IDOR) is rejected, no spot created', async () => {
    mockAllowed();
    (prisma.zone.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await spotsPOST(
      spotPostReq({ name: 'Spot A', pricePerNight: 500, zoneId: ZONE_ID }),
      makeCollectionParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(404);
    expect(prisma.spot.create).not.toHaveBeenCalled();
  });

  it('404 — a soft-deleted zoneId is rejected (the findFirst where excludes deletedAt rows)', async () => {
    mockAllowed();
    (prisma.zone.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null); // deletedAt:null scoping means a tombstone never resolves

    const res = await spotsPOST(
      spotPostReq({ name: 'Spot A', pricePerNight: 500, zoneId: ZONE_ID }),
      makeCollectionParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(404);
  });

  it('201 — the legacy zone string alone (no zoneId) keeps working unchanged, zoneId untouched', async () => {
    mockAllowed();
    (prisma.spot.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });

    const res = await spotsPOST(
      spotPostReq({ name: 'Spot A', pricePerNight: 500, zone: 'Legacy Zone' }),
      makeCollectionParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(201);
    expect(prisma.zone.findFirst).not.toHaveBeenCalled();
    const createArgs = (prisma.spot.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createArgs.data.zone).toBe('Legacy Zone');
    expect(createArgs.data.zoneId).toBeUndefined();
  });
});

describe('PUT /api/campsites/[id]/spots/[spotId] — zoneId resolution + T1 mirror (tech.md §4.2)', () => {
  it('200 — a valid zoneId updates Spot.zoneId AND mirrors Zone.name into Spot.zone', async () => {
    mockAllowed();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });
    (prisma.zone.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ name: 'โซน B' });
    (prisma.spot.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });

    const res = await spotPUT(spotPutReq({ zoneId: ZONE_ID }), makeItemParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(200);
    const updateArgs = (prisma.spot.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateArgs.data.zoneId).toBe(ZONE_ID);
    expect(updateArgs.data.zone).toBe('โซน B');
  });

  it('404 — a cross-camp zoneId on PUT is rejected, no update written', async () => {
    mockAllowed();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });
    (prisma.zone.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await spotPUT(spotPutReq({ zoneId: ZONE_ID }), makeItemParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(404);
    expect(prisma.spot.update).not.toHaveBeenCalled();
  });

  it('200 — neither zoneId nor zone sent -> no-op, existing zone/zoneId left untouched', async () => {
    mockAllowed();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });
    (prisma.spot.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });

    const res = await spotPUT(spotPutReq({ name: 'Renamed only' }), makeItemParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(200);
    expect(prisma.zone.findFirst).not.toHaveBeenCalled();
    const updateArgs = (prisma.spot.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateArgs.data.zoneId).toBeUndefined();
    expect(updateArgs.data.zone).toBeUndefined();
  });
});
