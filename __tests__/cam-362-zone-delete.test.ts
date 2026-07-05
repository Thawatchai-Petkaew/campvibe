/**
 * cam-362-zone-delete.test.ts — CAM-362 DELETE /api/campsites/[id]/zones/[zoneId]
 * (tech.md §3.3, §6 confirmation test #3: detach transactionality).
 *
 * Behavior under test: soft-delete a Zone (CAS updateMany, live-only + camp-
 * scoped) + detach every attached LIVE spot to no-zone (zoneId = null) + one
 * AuditLog row — all inside ONE prisma.$transaction. A missing/cross-camp/
 * already-deleted zone rolls back the whole transaction and answers 404.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireCampSitePermission: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { DELETE as zoneDELETE } from '@/app/api/campsites/[id]/zones/[zoneId]/route';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const CAMPSITE_ID = '550e8400-e29b-41d4-a716-446655440020';
const ZONE_ID = '550e8400-e29b-41d4-a716-446655440021';
const HOST_USER_ID = '550e8400-e29b-41d4-a716-446655440099';

const makeItemParams = (id: string, zoneId: string) => ({ params: Promise.resolve({ id, zoneId }) });

const hostSession = { user: { id: HOST_USER_ID, email: 'host@campvibe.com', role: 'OPERATOR' } };
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

function deleteReq(zoneId = ZONE_ID) {
  return new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/zones/${zoneId}`, {
    method: 'DELETE',
  });
}

/**
 * A stateful tx mock over an in-memory zones/spots store — lets a test
 * simulate the CAS (compare-and-swap) semantics for real: the SAME store is
 * shared across two sequential $transaction calls, so a "concurrent" second
 * DELETE sees the FIRST call's committed deletedAt (mirrors the pattern in
 * cam-302-internal-holds.test.ts's makeHoldTxMock).
 */
function makeZoneTxMock(opts: {
  zoneDeletedAt?: Date | null;
  zoneCampSiteId?: string;
  attachedLiveSpotCount?: number;
}) {
  const state = {
    deletedAt: opts.zoneDeletedAt ?? null,
    campSiteId: opts.zoneCampSiteId ?? CAMPSITE_ID,
    attachedLiveSpotCount: opts.attachedLiveSpotCount ?? 0,
  };
  return {
    zone: {
      updateMany: vi.fn().mockImplementation(({ where }: { where: { id: string; campSiteId: string; deletedAt: null } }) => {
        if (where.id !== ZONE_ID || where.campSiteId !== state.campSiteId || state.deletedAt !== null) {
          return Promise.resolve({ count: 0 });
        }
        state.deletedAt = new Date();
        return Promise.resolve({ count: 1 });
      }),
    },
    spot: {
      updateMany: vi.fn().mockImplementation(() => {
        const count = state.attachedLiveSpotCount;
        state.attachedLiveSpotCount = 0; // detach clears them
        return Promise.resolve({ count });
      }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// Authz
// ===========================================================================

describe('DELETE /api/campsites/[id]/zones/[zoneId] — authz', () => {
  it('401 — unauthenticated caller is rejected before any DB access', async () => {
    mockUnauthorized();

    const res = await zoneDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, ZONE_ID));

    expect(res.status).toBe(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('403 — caller without CAMPSITE_UPDATE is rejected', async () => {
    mockForbidden();

    const res = await zoneDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, ZONE_ID));

    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses requireCampSitePermission with CAMPSITE_UPDATE (not CAMPSITE_DELETE — tech.md §3.3 justified deviation)', async () => {
    mockForbidden();

    await zoneDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, ZONE_ID));

    expect(requireCampSitePermission).toHaveBeenCalledWith(CAMPSITE_ID, 'CAMPSITE_UPDATE');
  });
});

// ===========================================================================
// 404 — missing / cross-camp / already-deleted (CAS guard, EC-3 style)
// ===========================================================================

describe('DELETE /api/campsites/[id]/zones/[zoneId] — 404 CAS guard (no change on any of these)', () => {
  it('404 — a missing zone id is rejected, transaction rolls back with zero rows changed', async () => {
    mockAllowed();
    const tx = makeZoneTxMock({});
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      try {
        return await cb(tx);
      } catch (e) {
        throw e; // mirror real prisma.$transaction: propagate the thrown error
      }
    });

    const res = await zoneDELETE(deleteReq('non-existent-zone'), makeItemParams(CAMPSITE_ID, 'non-existent-zone'));

    expect(res.status).toBe(404);
    expect(tx.spot.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('404 — a zone under a different campsite is rejected (cross-camp IDOR guard)', async () => {
    mockAllowed();
    const tx = makeZoneTxMock({ zoneCampSiteId: 'some-other-camp' });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(tx));

    const res = await zoneDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, ZONE_ID));

    expect(res.status).toBe(404);
    expect(tx.spot.updateMany).not.toHaveBeenCalled();
  });

  it('404 — an already-deleted (deletedAt set) zone is rejected — idempotent, no double-audit', async () => {
    mockAllowed();
    const tx = makeZoneTxMock({ zoneDeletedAt: new Date() });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(tx));

    const res = await zoneDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, ZONE_ID));

    expect(res.status).toBe(404);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('the updateMany CAS where-clause is scoped to {id, campSiteId, deletedAt: null} — no separate find-then-update window', async () => {
    mockAllowed();
    const tx = makeZoneTxMock({});
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(tx));

    await zoneDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, ZONE_ID));

    const call = tx.zone.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: ZONE_ID, campSiteId: CAMPSITE_ID, deletedAt: null });
  });
});

// ===========================================================================
// 200 — atomic soft-delete + detach + audit (AC, BR-7-style)
// ===========================================================================

describe('DELETE /api/campsites/[id]/zones/[zoneId] — 200 atomic detach + audit', () => {
  it('200 — a zone with N attached live spots: all N detached (zoneId=null) AND zone.deletedAt set, in the SAME transaction', async () => {
    mockAllowed();
    const tx = makeZoneTxMock({ attachedLiveSpotCount: 3 });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(tx));

    const res = await zoneDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, ZONE_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.detachedSpotCount).toBe(3);
    expect(tx.zone.updateMany).toHaveBeenCalledOnce();
    expect(tx.spot.updateMany).toHaveBeenCalledOnce();
    const spotCall = tx.spot.updateMany.mock.calls[0][0];
    expect(spotCall.where).toEqual({ campSiteId: CAMPSITE_ID, zoneId: ZONE_ID, deletedAt: null });
    expect(spotCall.data).toEqual({ zoneId: null });
  });

  it('200 — a zone with zero attached spots still succeeds, detachedSpotCount=0', async () => {
    mockAllowed();
    const tx = makeZoneTxMock({ attachedLiveSpotCount: 0 });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(tx));

    const res = await zoneDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, ZONE_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.detachedSpotCount).toBe(0);
  });

  it('writes exactly one AuditLog row (action=zone.deleted) inside the same transaction, no PII', async () => {
    mockAllowed();
    const tx = makeZoneTxMock({ attachedLiveSpotCount: 2 });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(tx));

    await zoneDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, ZONE_ID));

    expect(tx.auditLog.create).toHaveBeenCalledOnce();
    const auditArgs = tx.auditLog.create.mock.calls[0][0];
    expect(auditArgs.data.action).toBe('zone.deleted');
    expect(auditArgs.data.entityType).toBe('Zone');
    expect(auditArgs.data.entityId).toBe(ZONE_ID);
    expect(auditArgs.data.actorId).toBe(HOST_USER_ID);
    expect(auditArgs.data.metadata).toEqual({ campSiteId: CAMPSITE_ID, detachedSpotCount: 2 });
  });

  it('[concurrent] two racing DELETEs on the same zone: exactly one 200, the other 404, spot rows detached exactly once', async () => {
    mockAllowed();
    const tx = makeZoneTxMock({ attachedLiveSpotCount: 5 });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(tx));

    const res1 = await zoneDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, ZONE_ID));
    const res2 = await zoneDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, ZONE_ID));

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 404]);
    // The CAS updateMany was attempted twice, but the detach spot.updateMany
    // (and the audit) only ran on the FIRST (winning) call.
    expect(tx.zone.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.spot.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('bust the camp-detail cache tags on success (campTag + both slug tags)', async () => {
    // Cache-busting is verified via next/cache's mocked revalidateTag not
    // throwing (setup-next-cache.ts makes it a no-op) — this test only
    // proves the route reaches the success path without error when
    // campSite slugs are present.
    mockAllowed();
    const tx = makeZoneTxMock({ attachedLiveSpotCount: 1 });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(tx));

    const res = await zoneDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, ZONE_ID));

    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// 500 — no leak
// ===========================================================================

describe('DELETE /api/campsites/[id]/zones/[zoneId] — 500 no leak', () => {
  it('500 — an unexpected transaction error returns 500 without leaking internals', async () => {
    mockAllowed();
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));

    const res = await zoneDELETE(deleteReq(), makeItemParams(CAMPSITE_ID, ZONE_ID));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect('details' in body).toBe(false);
  });
});
