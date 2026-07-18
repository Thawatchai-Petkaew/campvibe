/**
 * cam-422-cron-retention-route.test.ts — CAM-422 (ADR-013 S8)
 * `GET /api/cron/ai-chat-retention` — the daily retention cron route.
 *
 * AC -> test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-guard-1  no Authorization header -> 401; purgeExpiredConversations
 *             is NEVER called.
 * AC-guard-2  wrong secret -> 401; purge never called.
 * AC-guard-3  correct `Bearer $CRON_SECRET` -> 200 { purgedCount }; purge
 *             called exactly once.
 * EC-guard-1  CRON_SECRET unset on the env -> 401 even with a header
 *             present (default-deny, never falls open).
 * EC-guard-2  purge resolves {ok:false} -> 500 generic body, no internals
 *             leaked.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// lib/cron-auth.ts (imported by the route) declares `import "server-only"` —
// stub it, matching every other test file that imports a server-only module.
vi.mock('server-only', () => ({}));

vi.mock('@/lib/ai/conversation-store', () => ({
  purgeExpiredConversations: vi.fn(),
}));

import { GET } from '@/app/api/cron/ai-chat-retention/route';
import { purgeExpiredConversations } from '@/lib/ai/conversation-store';

const ORIGINAL_SECRET = process.env.CRON_SECRET;

function cronRequest(authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader !== undefined) headers.set('authorization', authHeader);
  return new NextRequest('https://example.test/api/cron/ai-chat-retention', { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'topsecret123';
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = ORIGINAL_SECRET;
  }
});

describe('GET /api/cron/ai-chat-retention', () => {
  it('AC-guard-1: 401 with no Authorization header; purge never called', async () => {
    const res = await GET(cronRequest());

    expect(res.status).toBe(401);
    expect(purgeExpiredConversations).not.toHaveBeenCalled();
  });

  it('AC-guard-2: 401 with the wrong secret; purge never called', async () => {
    const res = await GET(cronRequest('Bearer wrong-secret'));

    expect(res.status).toBe(401);
    expect(purgeExpiredConversations).not.toHaveBeenCalled();
  });

  it('EC-guard-1: 401 when CRON_SECRET is unset, even with a header present', async () => {
    delete process.env.CRON_SECRET;

    const res = await GET(cronRequest('Bearer topsecret123'));

    expect(res.status).toBe(401);
    expect(purgeExpiredConversations).not.toHaveBeenCalled();
  });

  it('AC-guard-3: 200 { purgedCount } with the correct secret; purge called exactly once', async () => {
    (purgeExpiredConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: { purgedCount: 5 },
    });

    const res = await GET(cronRequest('Bearer topsecret123'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ purgedCount: 5 });
    expect(purgeExpiredConversations).toHaveBeenCalledTimes(1);
  });

  it('EC-guard-2: 500 generic body when the store reports internal_error, no internals leaked', async () => {
    (purgeExpiredConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      code: 'internal_error',
    });

    const res = await GET(cronRequest('Bearer topsecret123'));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'internal_error' });
  });
});
