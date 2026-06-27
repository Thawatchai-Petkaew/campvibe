/**
 * CAM-212 (RATE-4) — Bounded booking list queries
 *
 * Asserts that both list endpoints pass `take: 100` (BOOKING_LIST_LIMIT) and
 * `orderBy: { createdAt: 'desc' }` to prisma.booking.findMany, and that the
 * response shape is still a flat array (no shape change for the 3 FE consumers).
 *
 * Layers:
 *   integration — route handler with mocked Prisma + auth boundary only.
 *
 * Coverage matrix (per .claude/rules/qa.md):
 *   normal        — authenticated request → findMany called with take:100 + orderBy
 *   boundary      — take value is exactly 100 (not undefined, not unlimited)
 *   error/abuse   — unauthenticated request → 401, findMany never called
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — declared before any dynamic import of the routes
// ─────────────────────────────────────────────────────────────────────────────

const mockRequireAuth = vi.fn();

vi.mock('../lib/auth-utils', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockBookingFindMany = vi.fn();
const mockCampSiteFindMany = vi.fn();
const mockCampSiteTeamMemberFindMany = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    booking: {
      findMany: (...args: unknown[]) => mockBookingFindMany(...args),
    },
    campSite: {
      findMany: (...args: unknown[]) => mockCampSiteFindMany(...args),
    },
    campSiteTeamMember: {
      findMany: (...args: unknown[]) => mockCampSiteTeamMemberFindMany(...args),
    },
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Route handlers — imported after mocks are registered
// ─────────────────────────────────────────────────────────────────────────────
const { GET: camperBookingsGET } = await import('../app/api/bookings/route');
const { GET: operatorBookingsGET } = await import('../app/api/operator/bookings/route');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const USER_ID = 'user-aaaa-0001-0000-000000000001';

function makeSession(userId: string) {
  return { user: { id: userId, email: 'test@campvibe.com', name: 'Tester' } };
}

const UNAUTHORIZED_RESPONSE = new Response(
  JSON.stringify({ error: 'Unauthorized' }),
  { status: 401, headers: { 'Content-Type': 'application/json' } }
);

function makeCamperRequest(): NextRequest {
  return new NextRequest('http://localhost/api/bookings', { method: 'GET' });
}

function makeOperatorRequest(params = ''): NextRequest {
  return new NextRequest(`http://localhost/api/operator/bookings${params}`, { method: 'GET' });
}

/** Minimal booking fixture (flat fields only — response shape must stay a flat array). */
function makeBookingFixture(id: string) {
  return {
    id,
    campSiteId: 'camp-001',
    userId: USER_ID,
    status: 'PENDING',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    campSite: { nameTh: 'แคมป์', nameEn: 'Camp', images: [], operatorId: USER_ID, id: 'camp-001' },
    spot: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// GET /api/bookings (camper list)
// =============================================================================

describe('[integration] GET /api/bookings — camper booking list (CAM-212)', () => {
  describe('normal — authenticated request uses take:100 + orderBy:createdAt desc', () => {
    it('calls prisma.booking.findMany with take: 100', async () => {
      // Arrange
      mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
      mockBookingFindMany.mockResolvedValueOnce([makeBookingFixture('b-001')]);

      // Act
      await camperBookingsGET(makeCamperRequest());

      // Assert — take is exactly 100
      expect(mockBookingFindMany).toHaveBeenCalledOnce();
      const callArg = mockBookingFindMany.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.take).toBe(100);
    });

    it('calls prisma.booking.findMany with orderBy: { createdAt: "desc" }', async () => {
      // Arrange
      mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
      mockBookingFindMany.mockResolvedValueOnce([]);

      // Act
      await camperBookingsGET(makeCamperRequest());

      // Assert — newest-first preserved
      const callArg = mockBookingFindMany.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('response is still a flat array (no shape change for FE consumers)', async () => {
      // Arrange
      mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
      const fixtures = [makeBookingFixture('b-001'), makeBookingFixture('b-002')];
      mockBookingFindMany.mockResolvedValueOnce(fixtures);

      // Act
      const res = await camperBookingsGET(makeCamperRequest());
      const body = await res.json();

      // Assert — response still a flat array (not wrapped, not paginated)
      expect(res.status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
      expect(body[0].id).toBe('b-001');
    });

    it('empty list returns 200 with an empty array', async () => {
      // Arrange
      mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
      mockBookingFindMany.mockResolvedValueOnce([]);

      // Act
      const res = await camperBookingsGET(makeCamperRequest());
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(0);
    });
  });

  describe('error/abuse — unauthenticated request', () => {
    it('returns 401 and never calls prisma.booking.findMany', async () => {
      // Arrange
      mockRequireAuth.mockResolvedValueOnce({ error: UNAUTHORIZED_RESPONSE, session: null });

      // Act
      const res = await camperBookingsGET(makeCamperRequest());

      // Assert
      expect(res.status).toBe(401);
      expect(mockBookingFindMany).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// GET /api/operator/bookings (operator list)
// =============================================================================

describe('[integration] GET /api/operator/bookings — operator booking list (CAM-212)', () => {
  describe('normal — authenticated operator uses take:100 + orderBy:createdAt desc', () => {
    it('calls prisma.booking.findMany with take: 100', async () => {
      // Arrange
      mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
      // Operator owns one campsite, no team memberships
      mockCampSiteFindMany.mockResolvedValueOnce([{ id: 'camp-001' }]);
      mockCampSiteTeamMemberFindMany.mockResolvedValueOnce([]);
      mockBookingFindMany.mockResolvedValueOnce([makeBookingFixture('b-001')]);

      // Act
      await operatorBookingsGET(makeOperatorRequest());

      // Assert — take is exactly 100
      expect(mockBookingFindMany).toHaveBeenCalledOnce();
      const callArg = mockBookingFindMany.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.take).toBe(100);
    });

    it('calls prisma.booking.findMany with orderBy: { createdAt: "desc" } (default sort)', async () => {
      // Arrange
      mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
      mockCampSiteFindMany.mockResolvedValueOnce([{ id: 'camp-001' }]);
      mockCampSiteTeamMemberFindMany.mockResolvedValueOnce([]);
      mockBookingFindMany.mockResolvedValueOnce([]);

      // Act
      await operatorBookingsGET(makeOperatorRequest());

      // Assert — newest-first preserved
      const callArg = mockBookingFindMany.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('response is still a flat array (no shape change for FE consumers)', async () => {
      // Arrange
      mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
      mockCampSiteFindMany.mockResolvedValueOnce([{ id: 'camp-001' }]);
      mockCampSiteTeamMemberFindMany.mockResolvedValueOnce([]);
      const fixtures = [makeBookingFixture('b-001'), makeBookingFixture('b-002')];
      mockBookingFindMany.mockResolvedValueOnce(fixtures);

      // Act
      const res = await operatorBookingsGET(makeOperatorRequest());
      const body = await res.json();

      // Assert — flat array, each item may carry canUpdate but the outer shape is still an array
      expect(res.status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
      expect(body[0].id).toBe('b-001');
    });

    it('?sort=asc preserves take:100 (bounded regardless of sort direction)', async () => {
      // Arrange
      mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
      mockCampSiteFindMany.mockResolvedValueOnce([{ id: 'camp-001' }]);
      mockCampSiteTeamMemberFindMany.mockResolvedValueOnce([]);
      mockBookingFindMany.mockResolvedValueOnce([]);

      // Act
      await operatorBookingsGET(makeOperatorRequest('?sort=asc'));

      // Assert — take still 100 even with ascending sort
      const callArg = mockBookingFindMany.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.take).toBe(100);
      expect(callArg.orderBy).toEqual({ createdAt: 'asc' });
    });
  });

  describe('error/abuse — unauthenticated request', () => {
    it('returns 401 and never calls prisma.booking.findMany', async () => {
      // Arrange
      mockRequireAuth.mockResolvedValueOnce({ error: UNAUTHORIZED_RESPONSE, session: null });

      // Act
      const res = await operatorBookingsGET(makeOperatorRequest());

      // Assert
      expect(res.status).toBe(401);
      expect(mockBookingFindMany).not.toHaveBeenCalled();
    });
  });

  describe('boundary — operator with no campsites skips the findMany', () => {
    it('returns 200 [] and does NOT call prisma.booking.findMany when operator has no sites', async () => {
      // Arrange: owns zero sites and has no memberships
      mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
      mockCampSiteFindMany.mockResolvedValueOnce([]);
      mockCampSiteTeamMemberFindMany.mockResolvedValueOnce([]);

      // Act
      const res = await operatorBookingsGET(makeOperatorRequest());
      const body = await res.json();

      // Assert — early-exit path, booking query never fires
      expect(res.status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(0);
      expect(mockBookingFindMany).not.toHaveBeenCalled();
    });
  });
});
