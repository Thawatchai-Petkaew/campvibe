/**
 * CAM-680 — lib/camp-access.ts (S1: camp access, forward and inverse)
 *
 * Layers:
 *   unit — the module is pure prisma-backed data (no NextResponse), tested
 *   directly with a mocked `lib/prisma`.
 *
 * Coverage matrix (per .claude/rules/qa.md):
 *   listCampSiteIdsForBookingView
 *     normal      — owner site + member site (BOOKING_VIEW) merge & dedupe
 *     null/empty  — no owned sites + no memberships → []
 *     boundary    — member site WITHOUT BOOKING_VIEW is excluded
 *   listBookingViewRecipients
 *     normal      — owner ∪ accepted BOOKING_VIEW member, deduped by userId
 *     boundary    — owner who ALSO holds an accepted OWNER team row for
 *                   their own camp appears exactly once (the CAM-680 "two
 *                   things most likely to go wrong" #1)
 *     error/edge  — isActive member with acceptedAt: null is NOT a recipient
 *                   (the CAM-680 "two things most likely to go wrong" #2)
 *     error/edge  — active + accepted member WITHOUT BOOKING_VIEW is NOT a
 *                   recipient
 *     null/empty  — no owner found + no members → []
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — declared before any dynamic import of the module under test
// ─────────────────────────────────────────────────────────────────────────────

const mockCampSiteFindMany = vi.fn();
const mockCampSiteFindUnique = vi.fn();
const mockCampSiteTeamMemberFindMany = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    campSite: {
      findMany: (...args: unknown[]) => mockCampSiteFindMany(...args),
      findUnique: (...args: unknown[]) => mockCampSiteFindUnique(...args),
    },
    campSiteTeamMember: {
      findMany: (...args: unknown[]) => mockCampSiteTeamMemberFindMany(...args),
    },
  },
}));

const {
  listCampSiteIdsForBookingView,
  listBookingViewRecipients,
  getOperatorBookingAccessSummary,
} = await import('../lib/camp-access');

const OWNER_ID = 'user-owner-0001';
const MEMBER_ID = 'user-member-0002';
const CAMP_ID = 'camp-0001';

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// listCampSiteIdsForBookingView
// =============================================================================

describe('[unit] listCampSiteIdsForBookingView (CAM-680)', () => {
  it('normal — merges owned sites with member sites that hold BOOKING_VIEW, deduped', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([{ id: 'camp-owned' }]);
    mockCampSiteTeamMemberFindMany.mockResolvedValueOnce([
      { campSiteId: 'camp-member-view', role: 'STAFF', permissions: [] }, // default incl. BOOKING_VIEW
      { campSiteId: 'camp-owned', role: 'VIEWER', permissions: [] }, // already owned — must not duplicate
    ]);

    const ids = await listCampSiteIdsForBookingView(MEMBER_ID);

    expect(ids.sort()).toEqual(['camp-member-view', 'camp-owned'].sort());
  });

  it('boundary — a member site WITHOUT BOOKING_VIEW is excluded', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);
    mockCampSiteTeamMemberFindMany.mockResolvedValueOnce([
      { campSiteId: 'camp-no-view', role: 'MANAGER', permissions: ['CAMPSITE_VIEW'] }, // explicit override, no BOOKING_VIEW
    ]);

    const ids = await listCampSiteIdsForBookingView(MEMBER_ID);

    expect(ids).toEqual([]);
  });

  it('null/empty — no owned sites and no memberships returns [] (matches the inlined code)', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);
    mockCampSiteTeamMemberFindMany.mockResolvedValueOnce([]);

    const ids = await listCampSiteIdsForBookingView(MEMBER_ID);

    expect(ids).toEqual([]);
  });

  it('queries campSiteTeamMember with isActive: true only (no acceptedAt filter — read path stays loose)', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);
    mockCampSiteTeamMemberFindMany.mockResolvedValueOnce([]);

    await listCampSiteIdsForBookingView(MEMBER_ID);

    const callArg = mockCampSiteTeamMemberFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(callArg.where).toEqual({ userId: MEMBER_ID, isActive: true });
  });
});

// =============================================================================
// listBookingViewRecipients
// =============================================================================

describe('[unit] listBookingViewRecipients (CAM-680)', () => {
  it('boundary — an owner who ALSO holds an accepted OWNER team row for their own camp appears exactly once', async () => {
    mockCampSiteFindUnique.mockResolvedValueOnce({
      operatorId: OWNER_ID,
      operator: { id: OWNER_ID, email: 'owner@campvibe.com' },
    });
    mockCampSiteTeamMemberFindMany.mockResolvedValueOnce([
      {
        role: 'OWNER',
        permissions: [],
        acceptedAt: new Date('2025-01-01T00:00:00Z'),
        user: { id: OWNER_ID, email: 'owner@campvibe.com' },
      },
    ]);

    const recipients = await listBookingViewRecipients(CAMP_ID);

    expect(recipients).toHaveLength(1);
    expect(recipients[0]).toEqual({ userId: OWNER_ID, email: 'owner@campvibe.com', isOwner: true });
  });

  it('error/edge — an isActive member with acceptedAt: null is NOT a recipient', async () => {
    mockCampSiteFindUnique.mockResolvedValueOnce({
      operatorId: OWNER_ID,
      operator: { id: OWNER_ID, email: 'owner@campvibe.com' },
    });
    // isActive:true / acceptedAt:null is filtered out by the query's own where clause,
    // so the mock returning [] here IS the assertion that route is querying acceptedAt: { not: null }.
    mockCampSiteTeamMemberFindMany.mockResolvedValueOnce([]);

    const recipients = await listBookingViewRecipients(CAMP_ID);

    expect(recipients).toEqual([{ userId: OWNER_ID, email: 'owner@campvibe.com', isOwner: true }]);

    const callArg = mockCampSiteTeamMemberFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(callArg.where).toEqual({ campSiteId: CAMP_ID, isActive: true, acceptedAt: { not: null } });
  });

  it('error/edge — an active, accepted member WITHOUT BOOKING_VIEW is not a recipient', async () => {
    mockCampSiteFindUnique.mockResolvedValueOnce({
      operatorId: OWNER_ID,
      operator: { id: OWNER_ID, email: 'owner@campvibe.com' },
    });
    mockCampSiteTeamMemberFindMany.mockResolvedValueOnce([
      {
        role: 'MANAGER',
        permissions: ['CAMPSITE_VIEW'], // explicit override — excludes BOOKING_VIEW
        acceptedAt: new Date('2025-01-01T00:00:00Z'),
        user: { id: MEMBER_ID, email: 'member@campvibe.com' },
      },
    ]);

    const recipients = await listBookingViewRecipients(CAMP_ID);

    expect(recipients).toEqual([{ userId: OWNER_ID, email: 'owner@campvibe.com', isOwner: true }]);
  });

  it('normal — owner + a distinct accepted BOOKING_VIEW member both appear', async () => {
    mockCampSiteFindUnique.mockResolvedValueOnce({
      operatorId: OWNER_ID,
      operator: { id: OWNER_ID, email: 'owner@campvibe.com' },
    });
    mockCampSiteTeamMemberFindMany.mockResolvedValueOnce([
      {
        role: 'STAFF',
        permissions: [],
        acceptedAt: new Date('2025-01-01T00:00:00Z'),
        user: { id: MEMBER_ID, email: 'member@campvibe.com' },
      },
    ]);

    const recipients = await listBookingViewRecipients(CAMP_ID);

    expect(recipients.sort((a, b) => a.userId.localeCompare(b.userId))).toEqual(
      [
        { userId: OWNER_ID, email: 'owner@campvibe.com', isOwner: true },
        { userId: MEMBER_ID, email: 'member@campvibe.com', isOwner: false },
      ].sort((a, b) => a.userId.localeCompare(b.userId))
    );
  });

  it('null/empty — no owner found and no members returns []', async () => {
    mockCampSiteFindUnique.mockResolvedValueOnce(null);
    mockCampSiteTeamMemberFindMany.mockResolvedValueOnce([]);

    const recipients = await listBookingViewRecipients('camp-does-not-exist');

    expect(recipients).toEqual([]);
  });
});

// =============================================================================
// getOperatorBookingAccessSummary (preservation-only helper, not one of the
// two directions — see the module doc comment in lib/camp-access.ts)
// =============================================================================

describe('[unit] getOperatorBookingAccessSummary (CAM-680)', () => {
  it('normal — reports campSiteIds (matching listCampSiteIdsForBookingView), hasAnyMembership, and the per-camp effective permissions, via a SINGLE query pair', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);
    mockCampSiteTeamMemberFindMany.mockResolvedValueOnce([
      { campSiteId: 'camp-a', role: 'STAFF', permissions: [] },
    ]);

    const summary = await getOperatorBookingAccessSummary(MEMBER_ID);

    expect(summary.campSiteIds).toEqual(['camp-a']);
    expect(summary.hasAnyMembership).toBe(true);
    expect(summary.permissionsByCampSiteId.get('camp-a')).toContain('BOOKING_UPDATE');
    // Exactly one query pair — the operator/bookings route relies on this NOT doubling up
    // with a separate listCampSiteIdsForBookingView call (see lib/camp-access.ts doc comment).
    expect(mockCampSiteFindMany).toHaveBeenCalledOnce();
    expect(mockCampSiteTeamMemberFindMany).toHaveBeenCalledOnce();
  });

  it('null/empty — no memberships and no owned sites → hasAnyMembership false, empty ids, empty map', async () => {
    mockCampSiteFindMany.mockResolvedValueOnce([]);
    mockCampSiteTeamMemberFindMany.mockResolvedValueOnce([]);

    const summary = await getOperatorBookingAccessSummary(MEMBER_ID);

    expect(summary.campSiteIds).toEqual([]);
    expect(summary.hasAnyMembership).toBe(false);
    expect(summary.permissionsByCampSiteId.size).toBe(0);
  });
});
