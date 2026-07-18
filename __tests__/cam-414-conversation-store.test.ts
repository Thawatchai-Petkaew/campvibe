/**
 * cam-414-conversation-store.test.ts — CAM-414 persistent chat history data
 * model + store service (ADR-013 foundation slice, no UI this story).
 *
 * AC -> test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-1 createConversation under the cap -> new row, count unchanged otherwise.
 * AC-2/EC-1 at MAX_CONVERSATIONS_PER_USER -> oldest (updatedAt asc) evicted
 *       in the SAME transaction as the create.
 * AC-3 appendTurn -> exactly 2 messages (seq N+1/N+2) + updatedAt bump, ONE
 *       transaction (all writes go through the mocked tx).
 * AC-4/EC-3 at MAX_MESSAGES_PER_CONVERSATION -> conversation_full, no insert.
 * AC-5/EC-7 contentText over MAX_CONTENT_TEXT_LENGTH -> truncated, still commits.
 * EC-6 blocks over MAX_BLOCKS_BYTES -> stored as undefined (NULL), warn logged,
 *       turn still commits with contentText intact.
 * AC-6/EC-4 appendTurn on another user's / missing conversationId -> not_found,
 *       no message written.
 * EC-2 seq unique-constraint race (P2002) -> concurrent_write, never an
 *       unhandled throw.
 * AC-7 loadWindow with > 10 messages -> newest 10, ascending (chronological).
 * AC-8/EC-4 loadWindow on another user's / missing conversationId -> not_found.
 * EC-5 loadWindow with < 10 messages -> all of them, ascending.
 * BR-6 an unexpected DB error on any path -> internal_error, never a raw throw.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Module mock — hoisted before imports. The mocked prisma object doubles as
// the `tx` client passed into `$transaction`'s callback (same shape as the
// real PrismaClient), matching this repo's other Prisma-mocked unit tests.
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    chatConversation: {
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    chatMessage: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  createConversation,
  appendTurn,
  loadWindow,
  MAX_CONVERSATIONS_PER_USER,
  MAX_MESSAGES_PER_CONVERSATION,
  MAX_CONTENT_TEXT_LENGTH,
  MAX_BLOCKS_BYTES,
  DEFAULT_WINDOW_SIZE,
} from '@/lib/ai/conversation-store';

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440002';
const CONVERSATION_ID = '550e8400-e29b-41d4-a716-446655440010';

/** prisma.$transaction mock: invokes the callback with the SAME mocked
 * prisma object as `tx` (the delegate methods are identical). */
function mockTransactionPassthrough() {
  (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    async (callback: (tx: typeof prisma) => unknown) => callback(prisma)
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransactionPassthrough();
});

// ---------------------------------------------------------------------------
// createConversation — AC-1, AC-2, EC-1
// ---------------------------------------------------------------------------
describe('createConversation', () => {
  it('AC-1: creates a new conversation when under the cap (no eviction)', async () => {
    (prisma.chatConversation.count as ReturnType<typeof vi.fn>).mockResolvedValue(
      MAX_CONVERSATIONS_PER_USER - 1
    );
    (prisma.chatConversation.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CONVERSATION_ID,
    });

    const result = await createConversation(USER_ID);

    expect(result).toEqual({ ok: true, data: { id: CONVERSATION_ID } });
    expect(prisma.chatConversation.delete).not.toHaveBeenCalled();
    expect(prisma.chatConversation.create).toHaveBeenCalledWith({
      data: { userId: USER_ID },
      select: { id: true },
    });
  });

  it('AC-2/EC-1: at the cap, evicts the least-recently-updated conversation before creating', async () => {
    const oldestId = 'oldest-convo-id';
    (prisma.chatConversation.count as ReturnType<typeof vi.fn>).mockResolvedValue(
      MAX_CONVERSATIONS_PER_USER
    );
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: oldestId,
    });
    (prisma.chatConversation.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CONVERSATION_ID,
    });

    const result = await createConversation(USER_ID);

    expect(prisma.chatConversation.findFirst).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: { updatedAt: 'asc' },
      select: { id: true },
    });
    expect(prisma.chatConversation.delete).toHaveBeenCalledWith({
      where: { id: oldestId },
    });
    expect(result).toEqual({ ok: true, data: { id: CONVERSATION_ID } });
  });

  it('BR-6: an unexpected DB error returns internal_error, never throws', async () => {
    (prisma.chatConversation.count as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('connection reset')
    );

    const result = await createConversation(USER_ID);

    expect(result).toEqual({ ok: false, code: 'internal_error' });
  });
});

// ---------------------------------------------------------------------------
// appendTurn — AC-3, AC-4, AC-5, AC-6, EC-2, EC-3, EC-4, EC-6, EC-7
// ---------------------------------------------------------------------------
describe('appendTurn', () => {
  function mockOwnedConversation() {
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CONVERSATION_ID,
    });
  }

  it('AC-3: writes exactly 2 messages (seq N+1/N+2) + bumps updatedAt, in one transaction', async () => {
    mockOwnedConversation();
    (prisma.chatMessage.count as ReturnType<typeof vi.fn>).mockResolvedValue(4);
    (prisma.chatMessage.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ seq: 4 });
    (prisma.chatMessage.create as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'user-msg-id' })
      .mockResolvedValueOnce({ id: 'assistant-msg-id' });
    (prisma.chatConversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await appendTurn(CONVERSATION_ID, USER_ID, {
      userText: 'มีแคมป์ใกล้เขาใหญ่ไหม',
      assistantText: 'มีครับ แนะนำ 3 แห่ง',
    });

    expect(result).toEqual({
      ok: true,
      data: { userMessageId: 'user-msg-id', assistantMessageId: 'assistant-msg-id' },
    });
    expect(prisma.chatMessage.create).toHaveBeenNthCalledWith(1, {
      data: {
        conversationId: CONVERSATION_ID,
        role: 'USER',
        seq: 5,
        contentText: 'มีแคมป์ใกล้เขาใหญ่ไหม',
      },
      select: { id: true },
    });
    expect(prisma.chatMessage.create).toHaveBeenNthCalledWith(2, {
      data: {
        conversationId: CONVERSATION_ID,
        role: 'ASSISTANT',
        seq: 6,
        contentText: 'มีครับ แนะนำ 3 แห่ง',
        blocks: undefined,
      },
      select: { id: true },
    });
    expect(prisma.chatConversation.update).toHaveBeenCalledWith({
      where: { id: CONVERSATION_ID },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it('AC-3: seq starts at 1/2 when the conversation has no prior messages', async () => {
    mockOwnedConversation();
    (prisma.chatMessage.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.chatMessage.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.chatMessage.create as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'u1' })
      .mockResolvedValueOnce({ id: 'a1' });
    (prisma.chatConversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await appendTurn(CONVERSATION_ID, USER_ID, { userText: 'hi', assistantText: 'hello' });

    expect(prisma.chatMessage.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ seq: 1 }) })
    );
    expect(prisma.chatMessage.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ seq: 2 }) })
    );
  });

  it('AC-4/EC-3: at the message cap, rejects with conversation_full and writes nothing', async () => {
    mockOwnedConversation();
    (prisma.chatMessage.count as ReturnType<typeof vi.fn>).mockResolvedValue(
      MAX_MESSAGES_PER_CONVERSATION
    );

    const result = await appendTurn(CONVERSATION_ID, USER_ID, {
      userText: 'x',
      assistantText: 'y',
    });

    expect(result).toEqual({ ok: false, code: 'conversation_full' });
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
    expect(prisma.chatConversation.update).not.toHaveBeenCalled();
  });

  it('AC-5/EC-7: truncates contentText over the cap and still commits the turn', async () => {
    mockOwnedConversation();
    (prisma.chatMessage.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.chatMessage.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.chatMessage.create as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'u1' })
      .mockResolvedValueOnce({ id: 'a1' });
    (prisma.chatConversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const oversizedText = 'a'.repeat(MAX_CONTENT_TEXT_LENGTH + 500);
    const result = await appendTurn(CONVERSATION_ID, USER_ID, {
      userText: oversizedText,
      assistantText: 'ok',
    });

    expect(result.ok).toBe(true);
    const userCreateCall = (prisma.chatMessage.create as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(userCreateCall.data.contentText).toHaveLength(MAX_CONTENT_TEXT_LENGTH);
  });

  it('EC-6: blocks over MAX_BLOCKS_BYTES are dropped (undefined), turn still commits + warns', async () => {
    mockOwnedConversation();
    (prisma.chatMessage.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.chatMessage.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.chatMessage.create as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'u1' })
      .mockResolvedValueOnce({ id: 'a1' });
    (prisma.chatConversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const oversizedBlocks = { cards: Array(2000).fill({ nameTh: 'แคมป์เขาใหญ่ยาวมาก' }) };
    expect(JSON.stringify(oversizedBlocks).length).toBeGreaterThan(MAX_BLOCKS_BYTES);

    const result = await appendTurn(CONVERSATION_ID, USER_ID, {
      userText: 'x',
      assistantText: 'y',
      blocks: oversizedBlocks,
    });

    expect(result.ok).toBe(true);
    const assistantCreateCall = (prisma.chatMessage.create as ReturnType<typeof vi.fn>).mock
      .calls[1][0];
    expect(assistantCreateCall.data.blocks).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('chat_blocks_oversize')
    );
    warnSpy.mockRestore();
  });

  it('blocks within the size cap are stored as-is', async () => {
    mockOwnedConversation();
    (prisma.chatMessage.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.chatMessage.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.chatMessage.create as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'u1' })
      .mockResolvedValueOnce({ id: 'a1' });
    (prisma.chatConversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const smallBlocks = { cards: [{ nameTh: 'แคมป์เขาใหญ่' }] };
    await appendTurn(CONVERSATION_ID, USER_ID, {
      userText: 'x',
      assistantText: 'y',
      blocks: smallBlocks,
    });

    const assistantCreateCall = (prisma.chatMessage.create as ReturnType<typeof vi.fn>).mock
      .calls[1][0];
    expect(assistantCreateCall.data.blocks).toEqual(smallBlocks);
  });

  it('AC-6/EC-4: a missing/other-user conversationId returns not_found, writes nothing', async () => {
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await appendTurn(CONVERSATION_ID, OTHER_USER_ID, {
      userText: 'x',
      assistantText: 'y',
    });

    expect(result).toEqual({ ok: false, code: 'not_found' });
    expect(prisma.chatConversation.findFirst).toHaveBeenCalledWith({
      where: { id: CONVERSATION_ID, userId: OTHER_USER_ID },
      select: { id: true },
    });
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it('EC-2: a seq unique-constraint race (P2002) returns concurrent_write, never throws', async () => {
    (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
      })
    );

    const result = await appendTurn(CONVERSATION_ID, USER_ID, {
      userText: 'x',
      assistantText: 'y',
    });

    expect(result).toEqual({ ok: false, code: 'concurrent_write' });
  });

  it('BR-6: an unexpected non-P2002 error returns internal_error, never throws', async () => {
    (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('pool exhausted')
    );

    const result = await appendTurn(CONVERSATION_ID, USER_ID, {
      userText: 'x',
      assistantText: 'y',
    });

    expect(result).toEqual({ ok: false, code: 'internal_error' });
  });
});

// ---------------------------------------------------------------------------
// loadWindow — AC-7, AC-8, EC-4, EC-5
// ---------------------------------------------------------------------------
describe('loadWindow', () => {
  it('AC-7: returns the newest `limit` messages in ascending (chronological) order', async () => {
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CONVERSATION_ID,
    });
    // The store queries newest-first (seq desc) and re-sorts ascending.
    const newestFirstFromDb = [
      { id: 'm12', role: 'ASSISTANT', seq: 12, contentText: 'l', blocks: null, createdAt: new Date() },
      { id: 'm11', role: 'USER', seq: 11, contentText: 'k', blocks: null, createdAt: new Date() },
      { id: 'm10', role: 'ASSISTANT', seq: 10, contentText: 'j', blocks: null, createdAt: new Date() },
    ];
    (prisma.chatMessage.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      newestFirstFromDb
    );

    const result = await loadWindow(CONVERSATION_ID, USER_ID, 3);

    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
      where: { conversationId: CONVERSATION_ID },
      orderBy: { seq: 'desc' },
      take: 3,
      select: {
        id: true,
        role: true,
        seq: true,
        contentText: true,
        blocks: true,
        createdAt: true,
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.map((m) => m.seq)).toEqual([10, 11, 12]);
    }
  });

  it('EC-5: fewer than `limit` messages -> returns all of them, ascending', async () => {
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CONVERSATION_ID,
    });
    const twoMessages = [
      { id: 'm2', role: 'ASSISTANT', seq: 2, contentText: 'b', blocks: null, createdAt: new Date() },
      { id: 'm1', role: 'USER', seq: 1, contentText: 'a', blocks: null, createdAt: new Date() },
    ];
    (prisma.chatMessage.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(twoMessages);

    const result = await loadWindow(CONVERSATION_ID, USER_ID, 10);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.map((m) => m.seq)).toEqual([1, 2]);
    }
  });

  it('AC-8/EC-4: a missing/other-user conversationId returns not_found, never queries messages', async () => {
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await loadWindow(CONVERSATION_ID, OTHER_USER_ID, 10);

    expect(result).toEqual({ ok: false, code: 'not_found' });
    expect(prisma.chatMessage.findMany).not.toHaveBeenCalled();
  });

  it('BR-6: an unexpected DB error returns internal_error, never throws', async () => {
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('timeout')
    );

    const result = await loadWindow(CONVERSATION_ID, USER_ID, 10);

    expect(result).toEqual({ ok: false, code: 'internal_error' });
  });

  it('uses DEFAULT_WINDOW_SIZE (10) when no limit argument is passed', async () => {
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CONVERSATION_ID,
    });
    (prisma.chatMessage.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await loadWindow(CONVERSATION_ID, USER_ID);

    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: DEFAULT_WINDOW_SIZE })
    );
  });
});

// =============================================================================
// Adversarial QA additions (CAM-414 independent verify, 2026-07-19).
// Covers 7 verdicts requested by the orchestrator that the original suite
// either asserted indirectly or not at all:
//  (a) transaction shape (tx vs. outer client) + a real mid-tx rollback path
//  (b) the P2002 backstop exercised at the exact colliding statement
//  (c) eviction-by-updatedAt + FK cascade, guarded at the schema/migration level
//  (d) cap boundary (199 vs 200)
//  (e) contentText exact-boundary (4000) + warn-log field hygiene (no content)
//  (f) loadWindow default-parameter branch (see above, appended to loadWindow)
//  (g) migration additive-only guard
// =============================================================================

describe('(a) transaction shape — every write goes through tx, never the outer (non-tx) client', () => {
  it('createConversation: count/evict/create all run on tx; the outer prisma accessor is never touched directly', async () => {
    const mockTx = {
      chatConversation: {
        count: vi.fn().mockResolvedValue(MAX_CONVERSATIONS_PER_USER),
        findFirst: vi.fn().mockResolvedValue({ id: 'oldest-id' }),
        delete: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({ id: CONVERSATION_ID }),
      },
    };
    (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(mockTx)
    );

    const result = await createConversation(USER_ID);

    expect(result).toEqual({ ok: true, data: { id: CONVERSATION_ID } });
    expect(mockTx.chatConversation.count).toHaveBeenCalledTimes(1);
    expect(mockTx.chatConversation.delete).toHaveBeenCalledWith({ where: { id: 'oldest-id' } });
    expect(mockTx.chatConversation.create).toHaveBeenCalledTimes(1);
    // Nothing escaped the transaction — the outer, non-tx accessors are untouched.
    expect(prisma.chatConversation.count).not.toHaveBeenCalled();
    expect(prisma.chatConversation.delete).not.toHaveBeenCalled();
    expect(prisma.chatConversation.create).not.toHaveBeenCalled();
  });

  it('appendTurn: ownership check, cap check, both message creates, and the updatedAt bump all run on tx', async () => {
    const mockTx = {
      chatConversation: {
        findFirst: vi.fn().mockResolvedValue({ id: CONVERSATION_ID }),
        update: vi.fn().mockResolvedValue({}),
      },
      chatMessage: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 'u1' })
          .mockResolvedValueOnce({ id: 'a1' }),
      },
    };
    (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(mockTx)
    );

    const result = await appendTurn(CONVERSATION_ID, USER_ID, { userText: 'x', assistantText: 'y' });

    expect(result.ok).toBe(true);
    expect(mockTx.chatConversation.findFirst).toHaveBeenCalledTimes(1);
    expect(mockTx.chatMessage.create).toHaveBeenCalledTimes(2);
    expect(mockTx.chatConversation.update).toHaveBeenCalledTimes(1);
    // Nothing escaped the transaction.
    expect(prisma.chatConversation.findFirst).not.toHaveBeenCalled();
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
    expect(prisma.chatConversation.update).not.toHaveBeenCalled();
  });
});

describe('(a) rollback path — a mid-transaction throw commits ZERO further writes', () => {
  it('appendTurn: the assistant-message create throws mid-tx -> internal_error; updatedAt bump never attempted', async () => {
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CONVERSATION_ID,
    });
    (prisma.chatMessage.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.chatMessage.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.chatMessage.create as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'user-msg-id' }) // user message "commits" inside the tx callback
      .mockRejectedValueOnce(new Error('connection reset mid-transaction')); // assistant create fails

    const result = await appendTurn(CONVERSATION_ID, USER_ID, { userText: 'x', assistantText: 'y' });

    expect(result).toEqual({ ok: false, code: 'internal_error' });
    expect(prisma.chatMessage.create).toHaveBeenCalledTimes(2); // both attempted, second failed
    // The callback aborted on the first throw — no further statement (the updatedAt
    // bump) was ever attempted, which is exactly the condition that lets Prisma's
    // real interactive transaction roll back everything already issued.
    expect(prisma.chatConversation.update).not.toHaveBeenCalled();
  });

  it('createConversation: the eviction delete throws mid-tx -> internal_error; create is never attempted', async () => {
    (prisma.chatConversation.count as ReturnType<typeof vi.fn>).mockResolvedValue(
      MAX_CONVERSATIONS_PER_USER
    );
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'oldest-id',
    });
    (prisma.chatConversation.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('fk violation')
    );

    const result = await createConversation(USER_ID);

    expect(result).toEqual({ ok: false, code: 'internal_error' });
    expect(prisma.chatConversation.create).not.toHaveBeenCalled();
  });
});

describe('(b) P2002 backstop — exercised at the exact colliding statement, not just $transaction rejecting wholesale', () => {
  it('appendTurn: the USER-message insert itself collides (a concurrent writer already took nextSeq) -> concurrent_write', async () => {
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CONVERSATION_ID,
    });
    (prisma.chatMessage.count as ReturnType<typeof vi.fn>).mockResolvedValue(4);
    // Both racing calls read the same stale "last seq" before either commits.
    (prisma.chatMessage.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ seq: 4 });
    (prisma.chatMessage.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`conversationId`,`seq`)',
        { code: 'P2002', clientVersion: '5.22.0' }
      )
    );

    const result = await appendTurn(CONVERSATION_ID, USER_ID, { userText: 'x', assistantText: 'y' });

    expect(result).toEqual({ ok: false, code: 'concurrent_write' });
    expect(prisma.chatMessage.create).toHaveBeenCalledTimes(1); // only the losing insert was attempted
    expect(prisma.chatConversation.update).not.toHaveBeenCalled();
  });
});

describe('branch coverage — defensive edges', () => {
  it('createConversation: at the cap but findFirst races to null (row already gone) -> creates anyway, no delete attempted', async () => {
    (prisma.chatConversation.count as ReturnType<typeof vi.fn>).mockResolvedValue(
      MAX_CONVERSATIONS_PER_USER
    );
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.chatConversation.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CONVERSATION_ID,
    });

    const result = await createConversation(USER_ID);

    expect(result).toEqual({ ok: true, data: { id: CONVERSATION_ID } });
    expect(prisma.chatConversation.delete).not.toHaveBeenCalled();
  });

  it('BR-6: a non-Error thrown value is still mapped to internal_error (never leaks the raw value)', async () => {
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockRejectedValue(
      'a bare string rejection, not an Error instance'
    );

    const result = await loadWindow(CONVERSATION_ID, USER_ID, 10);

    expect(result).toEqual({ ok: false, code: 'internal_error' });
  });
});

describe('(d) boundary — cap edges (off-by-one guards)', () => {
  it('appendTurn: at 199 messages (one under the 200 cap) the turn still commits', async () => {
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CONVERSATION_ID,
    });
    (prisma.chatMessage.count as ReturnType<typeof vi.fn>).mockResolvedValue(
      MAX_MESSAGES_PER_CONVERSATION - 1
    );
    (prisma.chatMessage.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ seq: 199 });
    (prisma.chatMessage.create as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'u1' })
      .mockResolvedValueOnce({ id: 'a1' });
    (prisma.chatConversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await appendTurn(CONVERSATION_ID, USER_ID, { userText: 'x', assistantText: 'y' });

    expect(result.ok).toBe(true);
    expect(prisma.chatMessage.create).toHaveBeenCalledTimes(2);
  });
});

describe('(e) boundary — contentText exact-length + oversized-blocks log field hygiene', () => {
  it('appendTurn: contentText at exactly MAX_CONTENT_TEXT_LENGTH is stored unmodified (no off-by-one shortening)', async () => {
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CONVERSATION_ID,
    });
    (prisma.chatMessage.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.chatMessage.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.chatMessage.create as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'u1' })
      .mockResolvedValueOnce({ id: 'a1' });
    (prisma.chatConversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const exactText = 'b'.repeat(MAX_CONTENT_TEXT_LENGTH);
    await appendTurn(CONVERSATION_ID, USER_ID, { userText: exactText, assistantText: 'ok' });

    const userCreateCall = (prisma.chatMessage.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(userCreateCall.data.contentText).toHaveLength(MAX_CONTENT_TEXT_LENGTH);
    expect(userCreateCall.data.contentText).toBe(exactText); // unchanged, not re-sliced short
  });

  it('EC-6: the oversized-blocks warn payload is allowlisted fields only — no block content/PII leaks into the log', async () => {
    (prisma.chatConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CONVERSATION_ID,
    });
    (prisma.chatMessage.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.chatMessage.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.chatMessage.create as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'u1' })
      .mockResolvedValueOnce({ id: 'a1' });
    (prisma.chatConversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const secretMarker = 'ความลับเฉพาะทริปนี้ห้ามหลุด';
    const oversizedBlocks = { cards: Array(2000).fill({ nameTh: secretMarker }) };
    expect(JSON.stringify(oversizedBlocks).length).toBeGreaterThan(MAX_BLOCKS_BYTES);

    await appendTurn(CONVERSATION_ID, USER_ID, {
      userText: 'x',
      assistantText: 'y',
      blocks: oversizedBlocks,
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const loggedLine = warnSpy.mock.calls[0][0] as string;
    expect(loggedLine).not.toContain(secretMarker); // no content leak
    const parsed = JSON.parse(loggedLine);
    expect(Object.keys(parsed).sort()).toEqual(
      ['byteLength', 'conversationId', 'event', 'level', 'maxBytes'].sort()
    );
    warnSpy.mockRestore();
  });
});

describe('(c)/(g) migration & schema guard — cascade wired, additive only (CAM-414)', () => {
  const schemaSource = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf-8');
  const migrationSource = readFileSync(
    join(
      process.cwd(),
      'prisma/migrations/20260718173946_cam414_chat_persistence/migration.sql'
    ),
    'utf-8'
  );

  it('ChatMessage cascades away when its ChatConversation is hard-deleted (regression guard on the FK)', () => {
    const chatMessageModel = schemaSource.match(/model ChatMessage \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(chatMessageModel).toContain('ChatConversation @relation');
    expect(chatMessageModel).toContain('onDelete: Cascade');
  });

  it('the eviction query orders by updatedAt (least-recently-updated), never createdAt', () => {
    // Regression guard at the source level: the eviction findFirst call (asserted
    // in the createConversation suite above) must never flip to createdAt.
    const storeSource = readFileSync(join(process.cwd(), 'lib/ai/conversation-store.ts'), 'utf-8');
    expect(storeSource).toContain("orderBy: { updatedAt: 'asc' }");
    expect(storeSource).not.toContain("orderBy: { createdAt: 'asc' }");
  });

  it('the migration is additive only — no DROP and no ALTER against a pre-existing table', () => {
    expect(migrationSource).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migrationSource).not.toMatch(/ALTER TABLE "User"/);
    const alterLines = migrationSource.match(/ALTER TABLE "(\w+)"/g) ?? [];
    expect(alterLines.length).toBeGreaterThan(0); // sanity: the FK ALTERs are actually present
    expect(
      alterLines.every(
        (l) => l === 'ALTER TABLE "ChatConversation"' || l === 'ALTER TABLE "ChatMessage"'
      )
    ).toBe(true);
  });
});
