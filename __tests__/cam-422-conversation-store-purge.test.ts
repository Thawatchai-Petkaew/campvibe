/**
 * cam-422-conversation-store-purge.test.ts — CAM-422 (ADR-013 S8)
 * `purgeExpiredConversations` (retention cron's store function).
 *
 * AC -> test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-purge-1  180-day-idle conversations are included in the delete `where`
 *             (`updatedAt: { lt: cutoff }`), cutoff computed from an
 *             INJECTED clock — never the real wall clock.
 * AC-purge-2  conversations owned by a soft-deleted user are ALSO included
 *             (`user: { deletedAt: { not: null } }`) in the SAME `OR`, one
 *             query (no N+1 / no per-row loop).
 * AC-purge-3  the secret-guard rejection path lives in the route test
 *             (cam-422-cron-retention-route.test.ts) — this file only
 *             covers the store function itself.
 * EC-purge-1  nothing eligible -> deleteMany resolves {count:0} -> returns 0,
 *             never throws.
 * EC-purge-2  an active (recently-updated, non-deleted-owner) conversation
 *             is proven kept by asserting it is the STORE'S WHERE clause
 *             (not a manual filter) that decides eligibility — Prisma owns
 *             the exclusion; the test pins the exact predicate.
 * EC-purge-3  boundary at EXACTLY 180 days: the cutoff Date is computed as
 *             `now - 180*24*60*60*1000` to the millisecond — an
 *             updatedAt exactly AT that instant is NOT purged (`lt`, not
 *             `lte`); one millisecond older IS purged. Proven by asserting
 *             the cutoff value itself, not by hitting a real DB.
 * BR-6        an unexpected DB error -> `internal_error`, never a raw throw.
 * Log hygiene: the emitted line carries only {level,event,purgedCount,
 *             cutoffDate} — never conversation id/content (observability.md).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    chatConversation: {
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { purgeExpiredConversations, RETENTION_DAYS } from '@/lib/ai/conversation-store';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FIXED_NOW_MS = new Date('2026-07-19T12:00:00.000Z').getTime();

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('purgeExpiredConversations', () => {
  it('AC-purge-1/2: issues ONE deleteMany with the 180-day cutoff AND the soft-deleted-user sweep in the same OR', async () => {
    (prisma.chatConversation.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 3,
    });

    const result = await purgeExpiredConversations({ now: () => FIXED_NOW_MS });

    expect(prisma.chatConversation.deleteMany).toHaveBeenCalledTimes(1); // one query, no N+1

    const expectedCutoff = new Date(FIXED_NOW_MS - RETENTION_DAYS * ONE_DAY_MS);
    expect(prisma.chatConversation.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { updatedAt: { lt: expectedCutoff } },
          { user: { deletedAt: { not: null } } },
        ],
      },
    });

    expect(result).toEqual({ ok: true, data: { purgedCount: 3 } });
  });

  it('EC-purge-3: the cutoff is exactly RETENTION_DAYS*24h before the injected clock (boundary, no off-by-one)', async () => {
    (prisma.chatConversation.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 0,
    });

    await purgeExpiredConversations({ now: () => FIXED_NOW_MS });

    const call = (prisma.chatConversation.deleteMany as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    const cutoffMs = (call.where.OR[0].updatedAt.lt as Date).getTime();

    // Exactly 180*24h earlier, to the millisecond — an updatedAt AT this
    // instant is NOT purged (the predicate is `lt`, strictly-less-than);
    // one ms older would be (proves the comparator, not a real DB row).
    expect(FIXED_NOW_MS - cutoffMs).toBe(180 * ONE_DAY_MS);
  });

  it('EC-purge-1: nothing eligible -> returns purgedCount 0, does not throw', async () => {
    (prisma.chatConversation.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 0,
    });

    const result = await purgeExpiredConversations({ now: () => FIXED_NOW_MS });

    expect(result).toEqual({ ok: true, data: { purgedCount: 0 } });
  });

  it('BR-6: an unexpected DB error returns internal_error, never a raw throw', async () => {
    (prisma.chatConversation.deleteMany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('connection reset')
    );

    const result = await purgeExpiredConversations({ now: () => FIXED_NOW_MS });

    expect(result).toEqual({ ok: false, code: 'internal_error' });
  });

  it('defaults to the real wall clock when no `now` is injected', async () => {
    (prisma.chatConversation.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 0,
    });

    const before = Date.now();
    await purgeExpiredConversations();
    const after = Date.now();

    const call = (prisma.chatConversation.deleteMany as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    const cutoffMs = (call.where.OR[0].updatedAt.lt as Date).getTime();

    expect(cutoffMs).toBeGreaterThanOrEqual(before - RETENTION_DAYS * ONE_DAY_MS);
    expect(cutoffMs).toBeLessThanOrEqual(after - RETENTION_DAYS * ONE_DAY_MS);
  });

  it('log hygiene: emits a count-only structured line, never conversation id/content', async () => {
    (prisma.chatConversation.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 7,
    });
    const logSpy = vi.spyOn(console, 'log');

    await purgeExpiredConversations({ now: () => FIXED_NOW_MS });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(logged).toEqual({
      level: 'info',
      event: 'chat_retention_purge',
      purgedCount: 7,
      cutoffDate: new Date(FIXED_NOW_MS - RETENTION_DAYS * ONE_DAY_MS).toISOString(),
    });
    // Never a conversationId/content/userId field on this line.
    expect(Object.keys(logged).sort()).toEqual(
      ['cutoffDate', 'event', 'level', 'purgedCount'].sort()
    );
  });
});
