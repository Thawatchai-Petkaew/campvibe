/**
 * CAM-410 — app/api/ai/chat/route.ts wire-body shape (BR-1: additive by
 * addition, `suggestions` optional and backward-compatible).
 *
 * Split from __tests__/cam-410-suggestions.test.ts because that file needs
 * the REAL lib/ai/openrouter-client.ts (to test extraction/sanitize logic
 * directly against a mocked `fetch`), while this file needs
 * `runAssistantTurn` MOCKED (mirrors __tests__/cam-271-ai-chat-route.test.ts)
 * — `vi.mock` is hoisted module-wide, so the two cannot share a file.
 *
 * All tests mock lib/ai/openrouter-client's runAssistantTurn (zero real
 * spend, no real OpenRouter call ever made).
 *
 * Coverage matrix:
 *   - normal: a turn resolving with suggestions ships them in the 200 body
 *   - null/empty: EC-6 regression guard — a turn with no `suggestions` field
 *     keeps the EXACT pre-CAM-410 key set (`{answer, cards}`, nothing added)
 *   - boundary: an empty `suggestions: []` on the turn result also omits the
 *     key (BR-1 "absent means no chips") rather than shipping a defined []
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { _store } from '@/lib/rate-limit';

const mockRunAssistantTurn = vi.fn();
// CAM-415: the route now calls runAssistantTurnFromMessages (a real
// multi-turn messages array), not runAssistantTurn (a flattened string).
vi.mock('@/lib/ai/openrouter-client', () => ({
  runAssistantTurnFromMessages: (...args: unknown[]) => mockRunAssistantTurn(...args),
}));

const { POST } = await import('@/app/api/ai/chat/route');

function makeRequest(body: unknown, ip: string): NextRequest {
  return new NextRequest('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

let ipCounter = 500;
function freshIp(): string {
  ipCounter += 1;
  return `203.0.116.${ipCounter}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
});

describe('POST /api/ai/chat — CAM-410 wire body', () => {
  it('[normal] a turn resolving with suggestions ships them in the 200 body', async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: 'ok', cards: [], suggestions: ['q1', 'q2'] });

    const res = await POST(makeRequest({ messages: [{ role: 'user', content: 'q' }] }, freshIp()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ answer: 'ok', cards: [], suggestions: ['q1', 'q2'] });
  });

  it('[null/empty] EC-6 regression guard: a turn with no `suggestions` field keeps the EXACT pre-CAM-410 key set', async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: 'ok', cards: [] });

    const res = await POST(makeRequest({ messages: [{ role: 'user', content: 'q' }] }, freshIp()));
    const body = await res.json();

    expect(Object.keys(body).sort()).toEqual(['answer', 'cards']);
    expect(body).toEqual({ answer: 'ok', cards: [] });
  });

  it('[boundary] BR-1: a turn resolving with `suggestions: []` also omits the key (absent means no chips)', async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: 'ok', cards: [], suggestions: [] });

    const res = await POST(makeRequest({ messages: [{ role: 'user', content: 'q' }] }, freshIp()));
    const body = await res.json();

    expect(Object.keys(body).sort()).toEqual(['answer', 'cards']);
  });
});
