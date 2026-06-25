/**
 * SEC-1 — Residual visibility gate on sub-routes
 *
 * Proves that the 4 sub-routes now apply the same visibility gate as the
 * campsite detail route: a non-public (unpublished/inactive/deleted) campsite
 * is 404 to anonymous callers, but the owner/ADMIN bypass keeps legit authed
 * access working.
 *
 * Routes under test:
 *   GET /api/campsites/[id]/availability
 *   GET /api/campgrounds/[id]/availability
 *   GET /api/campsites/[id]/spots
 *   GET /api/campsites/[id]/spots/[spotId]
 *
 * Mocking strategy:
 *   - vi.mock('@/lib/prisma')   — controls whether the camp exists + its visibility state
 *   - vi.mock('@/lib/auth')     — controls the session (anonymous / owner / admin)
 *   - vi.mock('@/lib/campsite-availability') — keeps availability tests fast (no DB)
 *
 * Error-code set (GET read-only routes):
 *   200  published camp, any caller
 *   404  non-existent camp
 *   404  unpublished camp + anonymous caller
 *   200  unpublished camp + owner (owner bypass)
 *   200  unpublished camp + ADMIN (admin bypass)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/campsite-availability', () => ({
  getCampSiteDailyAvailability: vi.fn().mockResolvedValue({}),
}));

// spots/[spotId]/route also requires requireCampSitePermission for mutation methods —
// mock it so GET can run independently of the RBAC helper.
vi.mock('@/lib/auth-utils', () => ({
  requireCampSitePermission: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

import { GET as campsiteAvailabilityGET } from '@/app/api/campsites/[id]/availability/route';
import { GET as campgroundAvailabilityGET } from '@/app/api/campgrounds/[id]/availability/route';
import { GET as spotsGET } from '@/app/api/campsites/[id]/spots/route';
import { GET as spotGET } from '@/app/api/campsites/[id]/spots/[spotId]/route';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CAMPSITE_ID = 'cs-test-0001';
const SPOT_ID = 'sp-test-0001';
const OPERATOR_ID = 'op-test-0001';

/** Publicly visible campsite returned by Prisma. */
const publicCampRow = {
  isActive: true,
  isPublished: true,
  deletedAt: null,
  operatorId: OPERATOR_ID,
  maxGuestsPerDay: 20,
  maxTentsPerDay: 10,
};

/** Unpublished campsite (should be invisible to anonymous callers). */
const unpublishedCampRow = {
  isActive: true,
  isPublished: false,
  deletedAt: null,
  operatorId: OPERATOR_ID,
  maxGuestsPerDay: 20,
  maxTentsPerDay: 10,
};

// Only the visibility-field subset is needed for spots routes.
const publicCampVisibility = {
  isActive: true,
  isPublished: true,
  deletedAt: null,
  operatorId: OPERATOR_ID,
};

const unpublishedCampVisibility = {
  isActive: true,
  isPublished: false,
  deletedAt: null,
  operatorId: OPERATOR_ID,
};

const anonymousSession = null;

const ownerSession = {
  user: { id: OPERATOR_ID, role: 'OPERATOR' },
};

const adminSession = {
  user: { id: 'admin-0001', role: 'ADMIN' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAvailabilityReq(base: string, id: string): NextRequest {
  return new NextRequest(
    `http://localhost${base}/${id}/availability?startDate=2026-07-01T00:00:00.000Z&endDate=2026-07-07T00:00:00.000Z`
  );
}

function makeSpotsReq(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/campsites/${id}/spots`);
}

function makeSpotReq(id: string, spotId: string): NextRequest {
  return new NextRequest(`http://localhost/api/campsites/${id}/spots/${spotId}`);
}

const makeAvailabilityParams = (id: string) => ({ params: Promise.resolve({ id }) });
const makeSpotsParams = (id: string) => ({ params: Promise.resolve({ id }) });
const makeSpotParams = (id: string, spotId: string) => ({ params: Promise.resolve({ id, spotId }) });

// ---------------------------------------------------------------------------
// GET /api/campsites/[id]/availability
// ---------------------------------------------------------------------------

describe('GET /api/campsites/[id]/availability — visibility gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 — published camp is accessible to anonymous callers', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(publicCampRow);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(anonymousSession);

    const res = await campsiteAvailabilityGET(
      makeAvailabilityReq('/api/campsites', CAMPSITE_ID),
      makeAvailabilityParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(200);
    // auth must NOT have been called for a public camp (lazy-auth hot-path).
    expect(auth).not.toHaveBeenCalled();
  });

  it('404 — unpublished camp + anonymous caller is blocked', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unpublishedCampRow);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(anonymousSession);

    const res = await campsiteAvailabilityGET(
      makeAvailabilityReq('/api/campsites', CAMPSITE_ID),
      makeAvailabilityParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(404);
  });

  it('200 — unpublished camp + owner session passes the owner bypass', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unpublishedCampRow);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(ownerSession);

    const res = await campsiteAvailabilityGET(
      makeAvailabilityReq('/api/campsites', CAMPSITE_ID),
      makeAvailabilityParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(200);
  });

  it('200 — unpublished camp + ADMIN session passes the admin bypass', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unpublishedCampRow);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);

    const res = await campsiteAvailabilityGET(
      makeAvailabilityReq('/api/campsites', CAMPSITE_ID),
      makeAvailabilityParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(200);
  });

  it('404 — non-existent campsite returns 404', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await campsiteAvailabilityGET(
      makeAvailabilityReq('/api/campsites', CAMPSITE_ID),
      makeAvailabilityParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/campgrounds/[id]/availability
// ---------------------------------------------------------------------------

describe('GET /api/campgrounds/[id]/availability — visibility gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 — published camp is accessible to anonymous callers', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(publicCampRow);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(anonymousSession);

    const res = await campgroundAvailabilityGET(
      makeAvailabilityReq('/api/campgrounds', CAMPSITE_ID),
      makeAvailabilityParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(200);
    expect(auth).not.toHaveBeenCalled();
  });

  it('404 — unpublished camp + anonymous caller is blocked', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unpublishedCampRow);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(anonymousSession);

    const res = await campgroundAvailabilityGET(
      makeAvailabilityReq('/api/campgrounds', CAMPSITE_ID),
      makeAvailabilityParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(404);
  });

  it('200 — unpublished camp + owner session passes the owner bypass', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unpublishedCampRow);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(ownerSession);

    const res = await campgroundAvailabilityGET(
      makeAvailabilityReq('/api/campgrounds', CAMPSITE_ID),
      makeAvailabilityParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(200);
  });

  it('200 — unpublished camp + ADMIN session passes the admin bypass', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unpublishedCampRow);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);

    const res = await campgroundAvailabilityGET(
      makeAvailabilityReq('/api/campgrounds', CAMPSITE_ID),
      makeAvailabilityParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(200);
  });

  it('404 — non-existent campsite returns 404', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await campgroundAvailabilityGET(
      makeAvailabilityReq('/api/campgrounds', CAMPSITE_ID),
      makeAvailabilityParams(CAMPSITE_ID)
    );

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/campsites/[id]/spots
// ---------------------------------------------------------------------------

describe('GET /api/campsites/[id]/spots — visibility gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: spots query returns empty list (happy path shape).
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('200 — published camp is accessible to anonymous callers', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(publicCampVisibility);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(anonymousSession);

    const res = await spotsGET(makeSpotsReq(CAMPSITE_ID), makeSpotsParams(CAMPSITE_ID));

    expect(res.status).toBe(200);
    expect(auth).not.toHaveBeenCalled();
  });

  it('404 — unpublished camp + anonymous caller is blocked', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unpublishedCampVisibility);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(anonymousSession);

    const res = await spotsGET(makeSpotsReq(CAMPSITE_ID), makeSpotsParams(CAMPSITE_ID));

    expect(res.status).toBe(404);
    expect(prisma.spot.findMany).not.toHaveBeenCalled();
  });

  it('200 — unpublished camp + owner session passes the owner bypass', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unpublishedCampVisibility);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(ownerSession);

    const res = await spotsGET(makeSpotsReq(CAMPSITE_ID), makeSpotsParams(CAMPSITE_ID));

    expect(res.status).toBe(200);
    expect(prisma.spot.findMany).toHaveBeenCalled();
  });

  it('200 — unpublished camp + ADMIN session passes the admin bypass', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unpublishedCampVisibility);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);

    const res = await spotsGET(makeSpotsReq(CAMPSITE_ID), makeSpotsParams(CAMPSITE_ID));

    expect(res.status).toBe(200);
  });

  it('404 — non-existent campsite returns 404 without querying spots', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await spotsGET(makeSpotsReq(CAMPSITE_ID), makeSpotsParams(CAMPSITE_ID));

    expect(res.status).toBe(404);
    expect(prisma.spot.findMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/campsites/[id]/spots/[spotId]
// ---------------------------------------------------------------------------

describe('GET /api/campsites/[id]/spots/[spotId] — visibility gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: spot exists under the campsite.
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: SPOT_ID,
      campSiteId: CAMPSITE_ID,
      campSite: { id: CAMPSITE_ID },
      images: [],
    });
  });

  it('200 — published camp is accessible to anonymous callers', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(publicCampVisibility);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(anonymousSession);

    const res = await spotGET(makeSpotReq(CAMPSITE_ID, SPOT_ID), makeSpotParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(200);
    expect(auth).not.toHaveBeenCalled();
  });

  it('404 — unpublished camp + anonymous caller is blocked', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unpublishedCampVisibility);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(anonymousSession);

    const res = await spotGET(makeSpotReq(CAMPSITE_ID, SPOT_ID), makeSpotParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(404);
    expect(prisma.spot.findFirst).not.toHaveBeenCalled();
  });

  it('200 — unpublished camp + owner session passes the owner bypass', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unpublishedCampVisibility);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(ownerSession);

    const res = await spotGET(makeSpotReq(CAMPSITE_ID, SPOT_ID), makeSpotParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(200);
    expect(prisma.spot.findFirst).toHaveBeenCalled();
  });

  it('200 — unpublished camp + ADMIN session passes the admin bypass', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(unpublishedCampVisibility);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);

    const res = await spotGET(makeSpotReq(CAMPSITE_ID, SPOT_ID), makeSpotParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(200);
  });

  it('404 — non-existent campsite returns 404 without querying the spot', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await spotGET(makeSpotReq(CAMPSITE_ID, SPOT_ID), makeSpotParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(404);
    expect(prisma.spot.findFirst).not.toHaveBeenCalled();
  });

  it('404 — campsite visible but spot does not exist under it', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(publicCampVisibility);
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(anonymousSession);

    const res = await spotGET(makeSpotReq(CAMPSITE_ID, SPOT_ID), makeSpotParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(404);
  });
});
