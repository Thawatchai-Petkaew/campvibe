/**
 * cam-421-conversation-routes.test.ts — CAM-421 (ADR-013 S7) route-level
 * tests for GET /api/ai/conversations, GET /api/ai/conversations/[id], and
 * DELETE /api/ai/conversations/[id].
 *
 * `lib/ai/conversation-store` is mocked (its own behavior is proven in
 * __tests__/cam-421-conversation-store.test.ts); `lib/auth-utils`'
 * `requireAuth` is mocked (session shape only). The rate-limit layer is the
 * REAL `lib/rate-limit` module (server-authoritative testing, qa.md §6 —
 * never mock the layer you are about to assert), store reset between tests
 * (mirrors __tests__/cam-271-ai-chat-route.test.ts).
 *
 * AC -> test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-1 GET /api/ai/conversations -> 200 { conversations }; 401 unauthenticated.
 * AC-2 GET /api/ai/conversations/[id] -> 200 full ordered messages;
 *      400 non-UUID id; 401 unauthenticated; 404 not found / not owner
 *      (no 403/404 split, getOwnedBooking precedent).
 * AC-3 DELETE /api/ai/conversations/[id] -> 200 hard delete;
 *      400 non-UUID id; 401 unauthenticated; 404 not found / not owner;
 *      429 after DELETE_RATE_LIMIT requests in the window.
 * Two-user fixture: OTHER_USER_ID's session never reaches USER_ID's data —
 * asserted at the route by checking the store fn receives session.user.id.
 * 500 on unexpected store internal_error.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { _store } from '@/lib/rate-limit';

const mockRequireAuth = vi.fn();
const mockListConversations = vi.fn();
const mockGetConversationWithMessages = vi.fn();
const mockDeleteConversation = vi.fn();

vi.mock('@/lib/auth-utils', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock('@/lib/ai/conversation-store', () => ({
  listConversations: (...args: unknown[]) => mockListConversations(...args),
  getConversationWithMessages: (...args: unknown[]) => mockGetConversationWithMessages(...args),
  deleteConversation: (...args: unknown[]) => mockDeleteConversation(...args),
}));

const { GET: listGET } = await import('@/app/api/ai/conversations/route');
const { GET: detailGET, DELETE: detailDELETE } = await import(
  '@/app/api/ai/conversations/[id]/route'
);

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440002';
const CONVERSATION_ID = '550e8400-e29b-41d4-a716-446655440010';

function makeSession(userId: string) {
  return { user: { id: userId, email: 'test@campvibe.com', name: 'Tester' } };
}

const UNAUTHORIZED = {
  error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  }),
  session: null,
};

function makeListRequest(): NextRequest {
  return new NextRequest('http://localhost/api/ai/conversations', { method: 'GET' });
}

function makeDetailContext(id = CONVERSATION_ID): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(method: 'GET' | 'DELETE', id = CONVERSATION_ID): NextRequest {
  return new NextRequest(`http://localhost/api/ai/conversations/${id}`, { method });
}

async function json(res: Response) {
  return res.json();
}

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
});

// ---------------------------------------------------------------------------
// GET /api/ai/conversations — AC-1
// ---------------------------------------------------------------------------
describe('GET /api/ai/conversations (AC-1)', () => {
  it('401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValueOnce(UNAUTHORIZED);

    const res = await listGET(makeListRequest());

    expect(res.status).toBe(401);
    expect(mockListConversations).not.toHaveBeenCalled();
  });

  it('200 with { conversations } for the session user, scoped by session.user.id', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
    mockListConversations.mockResolvedValueOnce({
      ok: true,
      data: [
        { id: 'conv-a', title: 'มีแคมป์ใกล้เขาใหญ่ไหม', messageCount: 4, updatedAt: new Date('2026-07-19T10:00:00Z') },
      ],
    });

    const res = await listGET(makeListRequest());
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.conversations).toHaveLength(1);
    expect(body.conversations[0].title).toBe('มีแคมป์ใกล้เขาใหญ่ไหม');
    expect(mockListConversations).toHaveBeenCalledWith(USER_ID);
  });

  it('500 on an unexpected store internal_error', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
    mockListConversations.mockResolvedValueOnce({ ok: false, code: 'internal_error' });

    const res = await listGET(makeListRequest());

    expect(res.status).toBe(500);
  });

  it('two-user fixture: OTHER_USER_ID session calls the store with ITS OWN id, not USER_ID', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(OTHER_USER_ID) });
    mockListConversations.mockResolvedValueOnce({ ok: true, data: [] });

    await listGET(makeListRequest());

    expect(mockListConversations).toHaveBeenCalledWith(OTHER_USER_ID);
    expect(mockListConversations).not.toHaveBeenCalledWith(USER_ID);
  });
});

// ---------------------------------------------------------------------------
// GET /api/ai/conversations/[id] — AC-2
// ---------------------------------------------------------------------------
describe('GET /api/ai/conversations/[id] (AC-2)', () => {
  it('401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValueOnce(UNAUTHORIZED);

    const res = await detailGET(makeRequest('GET'), makeDetailContext());

    expect(res.status).toBe(401);
    expect(mockGetConversationWithMessages).not.toHaveBeenCalled();
  });

  it('400 when the id param is not a UUID', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });

    const res = await detailGET(makeRequest('GET', 'not-a-uuid'), makeDetailContext('not-a-uuid'));

    expect(res.status).toBe(400);
    expect(mockGetConversationWithMessages).not.toHaveBeenCalled();
  });

  it('200 with the full ordered message history for the owner', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
    const messages = [
      { id: 'm1', role: 'USER', seq: 1, contentText: 'hi', blocks: null, createdAt: new Date() },
      { id: 'm2', role: 'ASSISTANT', seq: 2, contentText: 'hello', blocks: null, createdAt: new Date() },
    ];
    mockGetConversationWithMessages.mockResolvedValueOnce({
      ok: true,
      data: { id: CONVERSATION_ID, updatedAt: new Date(), messages },
    });

    const res = await detailGET(makeRequest('GET'), makeDetailContext());
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.id).toBe(CONVERSATION_ID);
    expect(body.messages).toHaveLength(2);
    expect(mockGetConversationWithMessages).toHaveBeenCalledWith(CONVERSATION_ID, USER_ID);
  });

  it('404 when the conversation does not exist (not_found)', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
    mockGetConversationWithMessages.mockResolvedValueOnce({ ok: false, code: 'not_found' });

    const res = await detailGET(makeRequest('GET'), makeDetailContext());

    expect(res.status).toBe(404);
    expect(res.status).not.toBe(403); // no 403/404 split
  });

  it('two-user fixture: OTHER_USER_ID gets the SAME 404 as a missing id (no existence leak)', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(OTHER_USER_ID) });
    mockGetConversationWithMessages.mockResolvedValueOnce({ ok: false, code: 'not_found' });

    const res = await detailGET(makeRequest('GET'), makeDetailContext());
    const body = await json(res);

    expect(res.status).toBe(404);
    expect(mockGetConversationWithMessages).toHaveBeenCalledWith(CONVERSATION_ID, OTHER_USER_ID);
    expect(body.error).toBeTruthy();
  });

  it('500 on an unexpected store internal_error', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
    mockGetConversationWithMessages.mockResolvedValueOnce({ ok: false, code: 'internal_error' });

    const res = await detailGET(makeRequest('GET'), makeDetailContext());

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/ai/conversations/[id] — AC-3
// ---------------------------------------------------------------------------
describe('DELETE /api/ai/conversations/[id] (AC-3)', () => {
  it('401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValueOnce(UNAUTHORIZED);

    const res = await detailDELETE(makeRequest('DELETE'), makeDetailContext());

    expect(res.status).toBe(401);
    expect(mockDeleteConversation).not.toHaveBeenCalled();
  });

  it('400 when the id param is not a UUID', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });

    const res = await detailDELETE(
      makeRequest('DELETE', 'not-a-uuid'),
      makeDetailContext('not-a-uuid')
    );

    expect(res.status).toBe(400);
    expect(mockDeleteConversation).not.toHaveBeenCalled();
  });

  it('AC-3/delete-is-hard: 200 with { id } on a real delete (no soft-delete field in the response)', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
    mockDeleteConversation.mockResolvedValueOnce({ ok: true, data: { id: CONVERSATION_ID } });

    const res = await detailDELETE(makeRequest('DELETE'), makeDetailContext());
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.id).toBe(CONVERSATION_ID);
    expect(body).not.toHaveProperty('deletedAt');
    expect(mockDeleteConversation).toHaveBeenCalledWith(CONVERSATION_ID, USER_ID);
  });

  it('404 when the conversation does not exist (not_found)', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
    mockDeleteConversation.mockResolvedValueOnce({ ok: false, code: 'not_found' });

    const res = await detailDELETE(makeRequest('DELETE'), makeDetailContext());

    expect(res.status).toBe(404);
    expect(res.status).not.toBe(403);
  });

  it('two-user fixture: OTHER_USER_ID cannot delete USER_ID conversation — same 404, store called with its own id', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(OTHER_USER_ID) });
    mockDeleteConversation.mockResolvedValueOnce({ ok: false, code: 'not_found' });

    const res = await detailDELETE(makeRequest('DELETE'), makeDetailContext());

    expect(res.status).toBe(404);
    expect(mockDeleteConversation).toHaveBeenCalledWith(CONVERSATION_ID, OTHER_USER_ID);
  });

  it('500 on an unexpected store internal_error', async () => {
    mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
    mockDeleteConversation.mockResolvedValueOnce({ ok: false, code: 'internal_error' });

    const res = await detailDELETE(makeRequest('DELETE'), makeDetailContext());

    expect(res.status).toBe(500);
  });

  it('429 + Retry-After after the rate limit is exceeded, no delete attempted on the 31st call', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, session: makeSession(USER_ID) });
    mockDeleteConversation.mockResolvedValue({ ok: true, data: { id: CONVERSATION_ID } });

    // Exhaust the real 30/15min budget for this exact key.
    for (let i = 0; i < 30; i++) {
      const res = await detailDELETE(makeRequest('DELETE'), makeDetailContext());
      expect(res.status).toBe(200);
    }

    const limited = await detailDELETE(makeRequest('DELETE'), makeDetailContext());

    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBeTruthy();
    expect(mockDeleteConversation).toHaveBeenCalledTimes(30); // the 31st never reached the store
  });
});
