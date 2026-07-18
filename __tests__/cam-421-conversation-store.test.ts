/**
 * cam-421-conversation-store.test.ts — CAM-421 (ADR-013 S7) conversation
 * list / view / delete store functions, extending CAM-414's
 * `lib/ai/conversation-store.ts`.
 *
 * AC -> test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-1 listConversations -> newest-updated-first, derived title (truncated),
 *      messageCount, ONE query (no per-row follow-up — no N+1).
 * AC-2 getConversationWithMessages -> ownership-scoped, full ordered history
 *      in ONE query; missing/other-user -> not_found, no message leak.
 * AC-3 deleteConversation -> HARD delete via deleteMany's WHERE (ownership +
 *      delete atomic, no TOCTOU); missing/other-user -> not_found, 0 rows.
 * BR-1 title truncated to TITLE_MAX_LENGTH (60) with an ellipsis; empty
 *      conversation (no USER message yet) -> title null.
 * BR-6 an unexpected DB error on any path -> internal_error, never a raw throw.
 * Two-user fixture: USER_ID's conversation is invisible to OTHER_USER_ID on
 * every one of the three functions (zero cross-access).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    chatConversation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  listConversations,
  getConversationWithMessages,
  deleteConversation,
  TITLE_MAX_LENGTH,
} from '@/lib/ai/conversation-store';

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440002';
const CONVERSATION_ID = '550e8400-e29b-41d4-a716-446655440010';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// listConversations — AC-1
// ---------------------------------------------------------------------------
describe('listConversations', () => {
  it('AC-1: returns newest-updated-first with a derived title + messageCount, one query', async () => {
    const newer = new Date('2026-07-19T10:00:00Z');
    const older = new Date('2026-07-18T10:00:00Z');
    (prisma.chatConversation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'conv-a',
        updatedAt: newer,
        messages: [{ contentText: 'มีแคมป์ใกล้เขาใหญ่ไหม' }],
        _count: { messages: 4 },
      },
      {
        id: 'conv-b',
        updatedAt: older,
        messages: [{ contentText: 'สวัสดี' }],
        _count: { messages: 2 },
      },
    ]);

    const result = await listConversations(USER_ID);

    expect(prisma.chatConversation.findMany).toHaveBeenCalledTimes(1); // one query, no N+1
    expect(prisma.chatConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        orderBy: { updatedAt: 'desc' },
      })
    );
    expect(result).toEqual({
      ok: true,
      data: [
        { id: 'conv-a', title: 'มีแคมป์ใกล้เขาใหญ่ไหม', messageCount: 4, updatedAt: newer },
        { id: 'conv-b', title: 'สวัสดี', messageCount: 2, updatedAt: older },
      ],
    });
  });

  it('BR-1: a title over TITLE_MAX_LENGTH is truncated with an ellipsis', async () => {
    const longText = 'ก'.repeat(TITLE_MAX_LENGTH + 20);
    (prisma.chatConversation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'conv-a', updatedAt: new Date(), messages: [{ contentText: longText }], _count: { messages: 1 } },
    ]);

    const result = await listConversations(USER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0].title).toBe(`${'ก'.repeat(TITLE_MAX_LENGTH)}…`);
      expect(result.data[0].title!.length).toBe(TITLE_MAX_LENGTH + 1); // +1 for the ellipsis char
    }
  });

  it('empty conversation (no USER message yet) -> title is null, never invented text', async () => {
    (prisma.chatConversation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'conv-empty', updatedAt: new Date(), messages: [], _count: { messages: 0 } },
    ]);

    const result = await listConversations(USER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0].title).toBeNull();
      expect(result.data[0].messageCount).toBe(0);
    }
  });

  it('no conversations -> returns an empty array, not an error', async () => {
    (prisma.chatConversation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await listConversations(USER_ID);

    expect(result).toEqual({ ok: true, data: [] });
  });

  it('BR-6: an unexpected DB error returns internal_error, never throws', async () => {
    (prisma.chatConversation.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('connection reset')
    );

    const result = await listConversations(USER_ID);

    expect(result).toEqual({ ok: false, code: 'internal_error' });
  });

  it('two-user fixture: USER_ID never sees OTHER_USER_ID rows (scoped by the WHERE, not post-filter)', async () => {
    (prisma.chatConversation.findMany as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ where }: { where: { userId: string } }) =>
        where.userId === USER_ID
          ? [{ id: 'conv-a', updatedAt: new Date(), messages: [{ contentText: 'hi' }], _count: { messages: 1 } }]
          : []
    );

    const mine = await listConversations(USER_ID);
    const theirs = await listConversations(OTHER_USER_ID);

    expect(mine.ok && mine.data).toHaveLength(1);
    expect(theirs.ok && theirs.data).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getConversationWithMessages — AC-2
// ---------------------------------------------------------------------------
describe('getConversationWithMessages', () => {
  it('AC-2: returns the full ordered history for the owner, in one query', async () => {
    const messages = [
      { id: 'm1', role: 'USER', seq: 1, contentText: 'hi', blocks: null, createdAt: new Date() },
      { id: 'm2', role: 'ASSISTANT', seq: 2, contentText: 'hello', blocks: { cards: [] }, createdAt: new Date() },
    ];
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CONVERSATION_ID,
      updatedAt: new Date(),
      messages,
    });

    const result = await getConversationWithMessages(CONVERSATION_ID, USER_ID);

    expect(prisma.chatConversation.findFirst).toHaveBeenCalledTimes(1); // ownership + fetch in one query
    expect(prisma.chatConversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CONVERSATION_ID, userId: USER_ID } })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(CONVERSATION_ID);
      expect(result.data.messages).toEqual(messages);
    }
  });

  it('AC-2: a missing conversationId returns not_found', async () => {
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await getConversationWithMessages('does-not-exist', USER_ID);

    expect(result).toEqual({ ok: false, code: 'not_found' });
  });

  it('two-user fixture: OTHER_USER_ID gets not_found for USER_ID conversation (no cross-access, no message leak)', async () => {
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ where }: { where: { id: string; userId: string } }) =>
        where.userId === USER_ID
          ? { id: CONVERSATION_ID, updatedAt: new Date(), messages: [{ id: 'm1', role: 'USER', seq: 1, contentText: 'secret', blocks: null, createdAt: new Date() }] }
          : null
    );

    const owner = await getConversationWithMessages(CONVERSATION_ID, USER_ID);
    const intruder = await getConversationWithMessages(CONVERSATION_ID, OTHER_USER_ID);

    expect(owner.ok).toBe(true);
    expect(intruder).toEqual({ ok: false, code: 'not_found' }); // no 403 split, no data leaked
  });

  it('BR-6: an unexpected DB error returns internal_error, never throws', async () => {
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('timeout')
    );

    const result = await getConversationWithMessages(CONVERSATION_ID, USER_ID);

    expect(result).toEqual({ ok: false, code: 'internal_error' });
  });
});

// ---------------------------------------------------------------------------
// deleteConversation — AC-3
// ---------------------------------------------------------------------------
describe('deleteConversation', () => {
  it('AC-3: deletes when owned — ownership + delete are the SAME deleteMany call', async () => {
    (prisma.chatConversation.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    const result = await deleteConversation(CONVERSATION_ID, USER_ID);

    expect(prisma.chatConversation.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.chatConversation.deleteMany).toHaveBeenCalledWith({
      where: { id: CONVERSATION_ID, userId: USER_ID },
    });
    expect(result).toEqual({ ok: true, data: { id: CONVERSATION_ID } });
  });

  it('AC-3/delete-is-hard: no soft-delete flag is ever written — deleteMany is the only call', async () => {
    (prisma.chatConversation.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    await deleteConversation(CONVERSATION_ID, USER_ID);

    const call = (prisma.chatConversation.deleteMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call).not.toHaveProperty('data'); // a real delete, never an update({data:{deletedAt}})
  });

  it('a missing conversationId returns not_found (count 0), no cross-access', async () => {
    (prisma.chatConversation.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

    const result = await deleteConversation('does-not-exist', USER_ID);

    expect(result).toEqual({ ok: false, code: 'not_found' });
  });

  it('two-user fixture: OTHER_USER_ID cannot delete USER_ID conversation (count 0, same not_found)', async () => {
    (prisma.chatConversation.deleteMany as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ where }: { where: { id: string; userId: string } }) => ({
        count: where.userId === USER_ID && where.id === CONVERSATION_ID ? 1 : 0,
      })
    );

    const intruderResult = await deleteConversation(CONVERSATION_ID, OTHER_USER_ID);
    const ownerResult = await deleteConversation(CONVERSATION_ID, USER_ID);

    expect(intruderResult).toEqual({ ok: false, code: 'not_found' }); // no existence leak, no 403
    expect(ownerResult).toEqual({ ok: true, data: { id: CONVERSATION_ID } });
  });

  it('BR-6: an unexpected DB error returns internal_error, never throws', async () => {
    (prisma.chatConversation.deleteMany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('connection reset')
    );

    const result = await deleteConversation(CONVERSATION_ID, USER_ID);

    expect(result).toEqual({ ok: false, code: 'internal_error' });
  });
});
