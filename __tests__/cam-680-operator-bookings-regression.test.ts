/**
 * CAM-680 — regression: /api/operator/bookings responses are UNCHANGED by
 * the lib/camp-access.ts extraction.
 *
 * Load-bearing per the ticket: assert against HARD-CODED golden values, not
 * values recomputed from lib/camp-access.ts — mocking that module's return
 * shape and then asserting the route's JSON body matches a literal object
 * written by hand (not derived from the mock) is what actually proves the
 * refactor is behavior-preserving, not just internally consistent.
 *
 * The route calls a single lib/camp-access.ts function
 * (getOperatorBookingAccessSummary) rather than also separately calling
 * listCampSiteIdsForBookingView — calling both would fire the underlying
 * team-membership query twice per request for no reason (see the doc
 * comment on getOperatorBookingAccessSummary in lib/camp-access.ts).
 * listCampSiteIdsForBookingView itself is covered directly, against the
 * verbatim pre-refactor block, in cam-680-camp-access.test.ts.
 *
 * Layer: integration — route handler with mocked lib/camp-access + mocked
 * Prisma (booking.findMany) + mocked auth boundary only.
 *
 * Coverage matrix (per .claude/rules/qa.md):
 *   normal      — owner request → golden array body, canUpdate: true (isOwner)
 *   normal      — team member with BOOKING_UPDATE → canUpdate: true
 *   boundary    — team member WITHOUT BOOKING_UPDATE → canUpdate: false
 *   null/empty  — no access at all (no membership) → 200 []
 *   error/abuse — host context but no BOOKING_VIEW anywhere → 403, exact body
 *   error/abuse — unauthenticated → 401, camp-access module never called
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — declared before any dynamic import of the route
// ─────────────────────────────────────────────────────────────────────────────

const mockRequireAuth = vi.fn();
vi.mock('../lib/auth-utils', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockBookingFindMany = vi.fn();
vi.mock('../lib/prisma', () => ({
  prisma: {
    booking: {
      findMany: (...args: unknown[]) => mockBookingFindMany(...args),
    },
  },
}));

const mockGetOperatorBookingAccessSummary = vi.fn();
vi.mock('../lib/camp-access', () => ({
  getOperatorBookingAccessSummary: (...args: unknown[]) => mockGetOperatorBookingAccessSummary(...args),
}));

const { GET: operatorBookingsGET } = await import('../app/api/operator/bookings/route');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const OWNER_ID = 'user-owner-0001';

function makeSession(userId: string) {
  return { user: { id: userId, email: 'test@campvibe.com', name: 'Tester' } };
}

const UNAUTHORIZED_RESPONSE = new Response(
  JSON.stringify({ error: 'Unauthorized' }),
  { status: 401, headers: { 'Content-Type': 'application/json' } }
);

function makeRequest(params = ''): NextRequest {
  return new NextRequest(`http://localhost/api/operator/bookings${params}`, { method: 'GET' });
}

/** A single raw booking row as prisma.booking.findMany would return it. */
function rawBooking() {
  return {
    id: 'b-001',
    campSiteId: 'camp-001',
    userId: 'camper-001',
    status: 'PENDING',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    campSite: { nameTh: 'แคมป์ทดสอบ', nameEn: 'Test Camp', images: [], operatorId: OWNER_ID, id: 'camp-001' },
    spot: { name: 'Spot A', zone: 'North' },
    user: { name: 'Camper One', email: 'camper@campvibe.com' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[integration] GET /api/operator/bookings — regression (CAM-680)', () => {
  it('normal — owner request returns the exact golden body with canUpdate: true (isOwner)', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(OWNER_ID) });
    mockGetOperatorBookingAccessSummary.mockResolvedValueOnce({
      campSiteIds: ['camp-001'],
      hasAnyMembership: false,
      permissionsByCampSiteId: new Map(),
    });
    mockBookingFindMany.mockResolvedValueOnce([rawBooking()]);

    const res = await operatorBookingsGET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    // Hard-coded golden value — written by hand, not derived from any mock above.
    expect(body).toEqual([
      {
        id: 'b-001',
        campSiteId: 'camp-001',
        userId: 'camper-001',
        status: 'PENDING',
        createdAt: '2025-01-01T00:00:00.000Z',
        campSite: { nameTh: 'แคมป์ทดสอบ', nameEn: 'Test Camp', images: [], operatorId: OWNER_ID, id: 'camp-001' },
        spot: { name: 'Spot A', zone: 'North' },
        user: { name: 'Camper One', email: 'camper@campvibe.com' },
        canUpdate: true,
      },
    ]);
  });

  it('normal — team member with BOOKING_UPDATE at that camp gets canUpdate: true', async () => {
    const MEMBER_ID = 'user-member-0002';
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(MEMBER_ID) });
    mockGetOperatorBookingAccessSummary.mockResolvedValueOnce({
      campSiteIds: ['camp-001'],
      hasAnyMembership: true,
      permissionsByCampSiteId: new Map([['camp-001', ['BOOKING_VIEW', 'BOOKING_UPDATE']]]),
    });
    mockBookingFindMany.mockResolvedValueOnce([rawBooking()]);

    const res = await operatorBookingsGET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body[0].canUpdate).toBe(true);
  });

  it('boundary — team member WITHOUT BOOKING_UPDATE at that camp gets canUpdate: false', async () => {
    const MEMBER_ID = 'user-member-0003';
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(MEMBER_ID) });
    mockGetOperatorBookingAccessSummary.mockResolvedValueOnce({
      campSiteIds: ['camp-001'],
      hasAnyMembership: true,
      permissionsByCampSiteId: new Map([['camp-001', ['BOOKING_VIEW']]]), // VIEWER — no BOOKING_UPDATE
    });
    mockBookingFindMany.mockResolvedValueOnce([rawBooking()]);

    const res = await operatorBookingsGET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body[0].canUpdate).toBe(false);
  });

  it('null/empty — no host access at all returns 200 [] and never queries bookings', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession('user-nobody') });
    mockGetOperatorBookingAccessSummary.mockResolvedValueOnce({
      campSiteIds: [],
      hasAnyMembership: false,
      permissionsByCampSiteId: new Map(),
    });

    const res = await operatorBookingsGET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
    expect(mockBookingFindMany).not.toHaveBeenCalled();
  });

  it('error/abuse — host context (has memberships) but none grant BOOKING_VIEW anywhere → 403 exact body', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession('user-no-view') });
    mockGetOperatorBookingAccessSummary.mockResolvedValueOnce({
      campSiteIds: [],
      hasAnyMembership: true, // e.g. a membership row whose explicit permissions exclude BOOKING_VIEW
      permissionsByCampSiteId: new Map([['camp-x', ['CAMPSITE_VIEW']]]),
    });

    const res = await operatorBookingsGET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    // Hard-coded golden value — the exact pre-refactor error shape.
    expect(body).toEqual({ error: 'Forbidden: missing BOOKING_VIEW permission' });
    expect(mockBookingFindMany).not.toHaveBeenCalled();
  });

  it('error/abuse — unauthenticated request returns 401 and never calls the camp-access module', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: UNAUTHORIZED_RESPONSE, session: null });

    const res = await operatorBookingsGET(makeRequest());

    expect(res.status).toBe(401);
    expect(mockGetOperatorBookingAccessSummary).not.toHaveBeenCalled();
    expect(mockBookingFindMany).not.toHaveBeenCalled();
  });
});
