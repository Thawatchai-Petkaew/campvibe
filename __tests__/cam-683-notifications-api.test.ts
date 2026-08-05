/**
 * CAM-683 — Notifications API (GET list, PATCH one read, PATCH all read)
 *
 * Coverage
 * ─────────────────────────────────────────────────────────────────────────
 * GET /api/notifications        — caller's own rows only, deletedAt:null,
 *                                  createdAt desc, take:50
 * PATCH /api/notifications/[id] — own row: sets isRead + readAt
 *                                  wrong-owner: 404 AND the row is NOT
 *                                  mutated (load-bearing — assert the ROW,
 *                                  not just the status code; a fetch-then-
 *                                  check implementation can mutate before
 *                                  it checks)
 * PATCH /api/notifications      — marks all of the caller's unread rows
 *                                  read, returns {count}
 * unauthenticated                — 401 on every handler, no Prisma call fires
 *
 * Layer: integration — route handlers against an in-memory Prisma FAKE (not
 * a blanket vi.fn() stub): findMany/updateMany actually filter the fixture
 * table by the real `where` clause, the same way Postgres would. This is
 * what lets the load-bearing test prove ownership at the query layer rather
 * than trusting the handler's status code (.claude/rules/qa.md #6 — never
 * mock the layer you are about to assert).
 * ─────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────
// Fixture table + Prisma fake — declared before any dynamic import of the
// routes (vi.mock factories run before imports below).
// ─────────────────────────────────────────────────────────────────────────

type NotificationRow = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
};

type WhereClause = Record<string, unknown>;

let table: NotificationRow[] = [];

function rowMatchesWhere(row: NotificationRow, where: WhereClause): boolean {
  if ('id' in where && row.id !== where.id) return false;
  if ('userId' in where && row.userId !== where.userId) return false;
  if ('isRead' in where && row.isRead !== where.isRead) return false;
  if ('deletedAt' in where && row.deletedAt !== (where.deletedAt as Date | null)) return false;
  return true;
}

const mockFindMany = vi.fn(
  async (args: { where: WhereClause; orderBy?: { createdAt: 'asc' | 'desc' }; take?: number }) => {
    let rows = table.filter((r) => rowMatchesWhere(r, args.where));
    if (args.orderBy?.createdAt === 'desc') {
      rows = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    if (typeof args.take === 'number') rows = rows.slice(0, args.take);
    return rows;
  }
);

const mockUpdateMany = vi.fn(
  async (args: { where: WhereClause; data: { isRead: boolean; readAt: Date } }) => {
    let count = 0;
    for (const row of table) {
      if (rowMatchesWhere(row, args.where)) {
        row.isRead = args.data.isRead;
        row.readAt = args.data.readAt;
        count++;
      }
    }
    return { count };
  }
);

vi.mock('../lib/prisma', () => ({
  prisma: {
    notification: {
      findMany: (...args: unknown[]) => mockFindMany(...(args as Parameters<typeof mockFindMany>)),
      updateMany: (...args: unknown[]) => mockUpdateMany(...(args as Parameters<typeof mockUpdateMany>)),
    },
  },
}));

const mockRequireAuth = vi.fn();
vi.mock('../lib/auth-utils', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// ─────────────────────────────────────────────────────────────────────────
// Route handlers — imported after mocks are registered
// ─────────────────────────────────────────────────────────────────────────
const { GET: listGET, PATCH: markAllPATCH } = await import('../app/api/notifications/route');
const { PATCH: markOnePATCH } = await import('../app/api/notifications/[id]/route');

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOTIF_A1 = '11111111-1111-4111-8111-111111111111';
const NOTIF_A2 = '22222222-2222-4222-8222-222222222222';
const NOTIF_A_DELETED = '33333333-3333-4333-8333-333333333333';
const NOTIF_B1 = '44444444-4444-4444-8444-444444444444';

function makeSession(userId: string) {
  return { user: { id: userId, email: 'test@campvibe.com', name: 'Tester' } };
}

const UNAUTHORIZED_RESPONSE = new Response(JSON.stringify({ error: 'Unauthorized' }), {
  status: 401,
  headers: { 'Content-Type': 'application/json' },
});

function makeRow(overrides: Partial<NotificationRow>): NotificationRow {
  return {
    id: 'x',
    userId: USER_A,
    type: 'SYSTEM',
    title: 'title',
    body: null,
    link: null,
    isRead: false,
    readAt: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

function makePatchOneRequest(
  id: string
): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost/api/notifications/${id}`, { method: 'PATCH' });
  return [req, { params: Promise.resolve({ id }) }];
}

beforeEach(() => {
  vi.clearAllMocks();
  table = [
    makeRow({
      id: NOTIF_A1,
      userId: USER_A,
      isRead: false,
      createdAt: new Date('2025-01-02T00:00:00Z'),
      title: 'newer',
    }),
    makeRow({
      id: NOTIF_A2,
      userId: USER_A,
      isRead: false,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      title: 'older',
    }),
    makeRow({
      id: NOTIF_A_DELETED,
      userId: USER_A,
      isRead: false,
      deletedAt: new Date('2025-01-03T00:00:00Z'),
      title: 'deleted',
    }),
    makeRow({ id: NOTIF_B1, userId: USER_B, isRead: false, title: 'not mine' }),
  ];
});

// =============================================================================
// GET /api/notifications
// =============================================================================

describe('[integration] GET /api/notifications', () => {
  it('unauthenticated → 401, prisma never called', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: UNAUTHORIZED_RESPONSE, session: null });

    const res = await listGET();

    expect(res.status).toBe(401);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("returns only the caller's own rows, excluding another user's", async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_A) });

    const res = await listGET();
    const body = await res.json();

    expect(res.status).toBe(200);
    const ids = body.map((n: { id: string }) => n.id);
    expect(ids).not.toContain(NOTIF_B1);
  });

  it('excludes soft-deleted rows (deletedAt not null)', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_A) });

    const res = await listGET();
    const body = await res.json();

    const ids = body.map((n: { id: string }) => n.id);
    expect(ids).not.toContain(NOTIF_A_DELETED);
  });

  it('newest first (createdAt desc)', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_A) });

    const res = await listGET();
    const body = await res.json();

    expect(body[0].id).toBe(NOTIF_A1); // newer
    expect(body[1].id).toBe(NOTIF_A2); // older
  });

  it('caps the query at take:50', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_A) });

    await listGET();

    const callArg = mockFindMany.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.take).toBe(50);
  });

  it('response shape: id/type/title/body/link/isRead/createdAt', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_A) });

    const res = await listGET();
    const body = await res.json();

    expect(body[0]).toMatchObject({
      id: NOTIF_A1,
      type: 'SYSTEM',
      title: 'newer',
      isRead: false,
    });
    expect(typeof body[0].createdAt).toBe('string');
  });
});

// =============================================================================
// PATCH /api/notifications/[id]
// =============================================================================

describe('[integration] PATCH /api/notifications/[id]', () => {
  it('unauthenticated → 401, prisma never called', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: UNAUTHORIZED_RESPONSE, session: null });

    const [req, ctx] = makePatchOneRequest(NOTIF_A1);
    const res = await markOnePATCH(req, ctx);

    expect(res.status).toBe(401);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('invalid id (not a uuid) → 400, prisma never called', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_A) });

    const [req, ctx] = makePatchOneRequest('not-a-uuid');
    const res = await markOnePATCH(req, ctx);

    expect(res.status).toBe(400);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('own row → 200, sets isRead true + readAt on the real row', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_A) });

    const [req, ctx] = makePatchOneRequest(NOTIF_A1);
    const res = await markOnePATCH(req, ctx);

    expect(res.status).toBe(200);
    const row = table.find((r) => r.id === NOTIF_A1)!;
    expect(row.isRead).toBe(true);
    expect(row.readAt).not.toBeNull();
  });

  it('own but soft-deleted row → 404, row untouched', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_A) });

    const [req, ctx] = makePatchOneRequest(NOTIF_A_DELETED);
    const res = await markOnePATCH(req, ctx);

    expect(res.status).toBe(404);
    const row = table.find((r) => r.id === NOTIF_A_DELETED)!;
    expect(row.isRead).toBe(false);
  });

  it("LOAD-BEARING — user B PATCHes user A's notification id → 404 AND A's row is still isRead:false", async () => {
    // User B is authenticated, but targets NOTIF_A1 which belongs to user A.
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_B) });

    const [req, ctx] = makePatchOneRequest(NOTIF_A1);
    const res = await markOnePATCH(req, ctx);

    expect(res.status).toBe(404);
    expect(res.status).not.toBe(403); // no existence leak

    // The load-bearing assertion: the ROW itself, not just the status code —
    // an implementation that fetches then checks ownership after mutating
    // would pass a status-code-only assertion while still corrupting data.
    const row = table.find((r) => r.id === NOTIF_A1)!;
    expect(row.isRead).toBe(false);
    expect(row.readAt).toBeNull();
  });

  it('nonexistent id → 404 (same body as wrong-owner — no existence leak)', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_A) });

    const [req, ctx] = makePatchOneRequest('99999999-9999-4999-8999-999999999999');
    const res = await markOnePATCH(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Notification not found');
  });

  it('ownership is enforced in the updateMany `where`, not a post-fetch check', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_A) });

    const [req, ctx] = makePatchOneRequest(NOTIF_A1);
    await markOnePATCH(req, ctx);

    expect(mockUpdateMany).toHaveBeenCalledOnce();
    const callArg = mockUpdateMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(callArg.where.id).toBe(NOTIF_A1);
    expect(callArg.where.userId).toBe(USER_A);
    expect(callArg.where.deletedAt).toBeNull();
  });
});

// =============================================================================
// PATCH /api/notifications (mark all read)
// =============================================================================

describe('[integration] PATCH /api/notifications (mark all read)', () => {
  it('unauthenticated → 401, prisma never called', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: UNAUTHORIZED_RESPONSE, session: null });

    const res = await markAllPATCH();

    expect(res.status).toBe(401);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("marks all of the caller's unread rows read and returns the count", async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_A) });

    const res = await markAllPATCH();
    const body = await res.json();

    // USER_A has NOTIF_A1 + NOTIF_A2 unread + one soft-deleted (excluded) = 2
    expect(res.status).toBe(200);
    expect(body.count).toBe(2);
    expect(table.find((r) => r.id === NOTIF_A1)!.isRead).toBe(true);
    expect(table.find((r) => r.id === NOTIF_A2)!.isRead).toBe(true);
  });

  it("does not touch another user's unread rows", async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_A) });

    await markAllPATCH();

    const otherRow = table.find((r) => r.id === NOTIF_B1)!;
    expect(otherRow.isRead).toBe(false);
  });

  it('does not touch a soft-deleted row', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_A) });

    await markAllPATCH();

    const deletedRow = table.find((r) => r.id === NOTIF_A_DELETED)!;
    expect(deletedRow.isRead).toBe(false);
  });
});
