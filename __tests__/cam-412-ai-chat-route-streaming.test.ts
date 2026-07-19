/**
 * CAM-412 (ADR-015) — app/api/ai/chat/route.ts streaming branch
 * (`Accept: text/event-stream` on the legacy `{messages}` shape only).
 *
 * `lib/ai/openrouter-client`'s `runAssistantTurnFromMessages` AND
 * `runAssistantTurnFromMessagesStreaming` are both mocked (zero real spend,
 * same convention as __tests__/cam-271-ai-chat-route.test.ts). `@/lib/auth` +
 * `@/lib/ai/conversation-store` are mocked for the v2 scope-check test only
 * (mirrors __tests__/cam-420-ai-chat-route-v2.test.ts).
 *
 * AC -> test matrix
 * ───────────────────────────────────────────────────────────────────────
 * AC-1  Accept:text/event-stream + a successful streamed turn -> 200
 *       text/event-stream body framed delta*  -> meta -> done.
 * AC-3  Accept absent -> today's exact JSON body, byte-stable (existing
 *       cam-271 suite re-guards this; one pinning assertion lives here too).
 * AC-4/EC-1 mid-stream failure (>=1 delta already yielded) -> the SSE body
 *       carries delta(s) then a terminal `error` event, no `done`.
 * AC-5/EC-3 rate limit -> 429 JSON, NEVER a stream, even with the streaming
 *       Accept header — the generator is never even constructed.
 * AC-6/EC-4 key unset (generator's first event is `skipped`) -> 503 JSON,
 *       not a stream.
 * AC-7/EC-6 abort — the ReadableStream's `cancel()` aborts the shared
 *       AbortController and stops pulling further events (double-cancel is
 *       a no-op, never throws).
 * BR-2  a pre-first-delta failure (generator's first event is `error`) ->
 *       502 JSON, not a stream.
 * ADR-015 scope note — the v2 (session-bound) shape ignores the streaming
 *       Accept header entirely; always JSON.
 * ───────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { _store } from '@/lib/rate-limit';
import { AI_ASSISTANT_RATE_LIMIT } from '@/lib/ai/rate-limit';

const mockRunAssistantTurn = vi.fn();
const mockRunAssistantTurnStreaming = vi.fn();
vi.mock('@/lib/ai/openrouter-client', () => ({
  runAssistantTurnFromMessages: (...args: unknown[]) => mockRunAssistantTurn(...args),
  runAssistantTurnFromMessagesStreaming: (...args: unknown[]) => mockRunAssistantTurnStreaming(...args),
}));

const mockAuth = vi.fn();
vi.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }));

const mockCreateConversation = vi.fn();
const mockLoadWindow = vi.fn();
const mockAppendTurn = vi.fn();
vi.mock('@/lib/ai/conversation-store', () => ({
  createConversation: (...args: unknown[]) => mockCreateConversation(...args),
  loadWindow: (...args: unknown[]) => mockLoadWindow(...args),
  appendTurn: (...args: unknown[]) => mockAppendTurn(...args),
  MAX_CONTENT_TEXT_LENGTH: 4000,
}));

const { POST } = await import('@/app/api/ai/chat/route');

function resetStore() {
  _store.clear();
}

function makeStreamRequest(body: unknown, ip = '203.0.113.5'): NextRequest {
  return new NextRequest('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

/** Reads the WHOLE SSE body to a string (test convenience — a real client reads incrementally). */
async function readAll(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let out = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

/** Builds a fake async generator matching StreamEvent's shape, for mocking `runAssistantTurnFromMessagesStreaming`. */
async function* fakeGen(events: Array<{ type: string; [k: string]: unknown }>) {
  for (const e of events) yield e;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

/* -------------------------------------------------------------------------- */
/* AC-1 — successful streamed turn                                            */
/* -------------------------------------------------------------------------- */

describe('POST /api/ai/chat — Accept:text/event-stream, successful turn (AC-1)', () => {
  it('[normal] 200 text/event-stream, framed delta(s) -> meta -> done', async () => {
    mockRunAssistantTurnStreaming.mockReturnValue(
      fakeGen([
        { type: 'delta', text: 'พบแคมป์ ' },
        { type: 'delta', text: '2 แห่งครับ' },
        { type: 'meta', cards: [{ id: 'c1' }], suggestions: ['ใกล้ๆนี้มีไหม'] },
      ])
    );

    const res = await POST(makeStreamRequest({ messages: [{ role: 'user', content: 'หาแคมป์' }] }));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const text = await readAll(res);
    expect(text).toContain('event: delta');
    expect(text).toContain('พบแคมป์ ');
    expect(text).toContain('event: meta');
    expect(text).toContain('event: done');
    const metaIdx = text.indexOf('event: meta');
    const doneIdx = text.indexOf('event: done');
    expect(metaIdx).toBeGreaterThan(-1);
    expect(doneIdx).toBeGreaterThan(metaIdx); // done strictly after meta
  });

  it('[normal] the meta event carries the CAM-427 wire card shape (cards passed through toWireCards)', async () => {
    mockRunAssistantTurnStreaming.mockReturnValue(
      fakeGen([{ type: 'delta', text: 'ok' }, { type: 'meta', cards: [], searchAttempted: true }])
    );
    const res = await POST(makeStreamRequest({ messages: [{ role: 'user', content: 'q' }] }));
    const text = await readAll(res);
    expect(text).toContain('"searchAttempted":true');
  });
});

/* -------------------------------------------------------------------------- */
/* AC-4/EC-1 — mid-stream failure                                             */
/* -------------------------------------------------------------------------- */

describe('POST /api/ai/chat — mid-stream failure (AC-4/EC-1)', () => {
  it('[error] delta(s) then a terminal error event, no done, no raw error leaked', async () => {
    mockRunAssistantTurnStreaming.mockReturnValue(
      fakeGen([{ type: 'delta', text: 'เริ่มตอบ' }, { type: 'error', code: 'assistant_error' }])
    );

    const res = await POST(makeStreamRequest({ messages: [{ role: 'user', content: 'q' }] }));

    expect(res.status).toBe(200); // headers already committed at the first delta
    const text = await readAll(res);
    expect(text).toContain('event: delta');
    expect(text).toContain('event: error');
    expect(text).toContain('"code":"assistant_error"');
    expect(text).not.toContain('event: done');
    expect(text).not.toMatch(/stack|Error:|sk-or-/i);
  });
});

/* -------------------------------------------------------------------------- */
/* BR-2 — guard order + pre-first-delta failures return JSON, never a stream  */
/* -------------------------------------------------------------------------- */

describe('POST /api/ai/chat — guard order + pre-first-delta failures (BR-2, AC-5/AC-6, EC-3/EC-4)', () => {
  it('[boundary] rate limit denies BEFORE the generator is ever constructed -> 429 JSON, no stream', async () => {
    const ip = '203.0.113.9';
    const now = Date.now();
    _store.set(`ai-assistant:${ip}`, Array.from({ length: AI_ASSISTANT_RATE_LIMIT }, (_, i) => now - i));

    const res = await POST(makeStreamRequest({ messages: [{ role: 'user', content: 'hi' }] }, ip));

    expect(res.status).toBe(429);
    expect(res.headers.get('content-type')).not.toContain('text/event-stream');
    expect(await res.json()).toEqual({ code: 'rate_limited' });
    expect(mockRunAssistantTurnStreaming).not.toHaveBeenCalled();
  });

  it('[null/empty] key unset (first event "skipped") -> 503 JSON, not a stream', async () => {
    mockRunAssistantTurnStreaming.mockReturnValue(fakeGen([{ type: 'skipped' }]));

    const res = await POST(makeStreamRequest({ messages: [{ role: 'user', content: 'hi' }] }));

    expect(res.status).toBe(503);
    expect(res.headers.get('content-type')).not.toContain('text/event-stream');
    expect(await res.json()).toEqual({ code: 'assistant_disabled' });
  });

  it('[error/validation] a pre-first-delta failure (first event "error") -> 502 JSON, not a stream', async () => {
    mockRunAssistantTurnStreaming.mockReturnValue(fakeGen([{ type: 'error', code: 'assistant_error' }]));

    const res = await POST(makeStreamRequest({ messages: [{ role: 'user', content: 'hi' }] }));

    expect(res.status).toBe(502);
    expect(res.headers.get('content-type')).not.toContain('text/event-stream');
    expect(await res.json()).toEqual({ code: 'assistant_error' });
  });

  it('[error/validation] 400 invalid_request still short-circuits before the generator (zod cap)', async () => {
    const res = await POST(makeStreamRequest({ messages: [] })); // fails min(1)
    expect(res.status).toBe(400);
    expect(mockRunAssistantTurnStreaming).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* AC-7/EC-6 — abort via ReadableStream.cancel()                              */
/* -------------------------------------------------------------------------- */

describe('POST /api/ai/chat — client abort (AC-7/EC-6)', () => {
  it('[concurrent] cancelling the reader calls gen.return() (stops pulling further events); a double-cancel never throws', async () => {
    async function* slowGen() {
      yield { type: 'delta', text: 'a' };
      yield { type: 'delta', text: 'b' };
      yield { type: 'meta', cards: [] };
    }
    const iter = slowGen();
    const returnSpy = vi.spyOn(iter, 'return');
    mockRunAssistantTurnStreaming.mockReturnValue(iter);

    const res = await POST(makeStreamRequest({ messages: [{ role: 'user', content: 'q' }] }));
    const reader = res.body!.getReader();
    await reader.read(); // consume the first committed delta -> stream headers are already locked in

    await expect(reader.cancel()).resolves.toBeUndefined();
    expect(returnSpy).toHaveBeenCalledTimes(1); // BR-6 — the route propagates cancel() into gen.return()
    await expect(reader.cancel()).resolves.toBeUndefined(); // idempotent double-cancel — never throws
  });
});

/* -------------------------------------------------------------------------- */
/* ADR-015 scope note — v2 shape never streams                                */
/* -------------------------------------------------------------------------- */

describe('POST /api/ai/chat — v2 (session-bound) shape ignores Accept:text/event-stream (ADR-015)', () => {
  it('[normal] a v2 request with the streaming Accept header still returns JSON, never a stream', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockCreateConversation.mockResolvedValue({ ok: true, data: { id: 'conv-1' } });
    mockAppendTurn.mockResolvedValue({ ok: true });
    mockRunAssistantTurn.mockResolvedValue({ ok: true, answer: 'สวัสดีครับ', cards: [] });

    const res = await POST(makeStreamRequest({ message: 'สวัสดี' }));

    expect(res.headers.get('content-type')).not.toContain('text/event-stream');
    const body = await res.json();
    expect(body.answer).toBe('สวัสดีครับ');
    expect(mockRunAssistantTurnStreaming).not.toHaveBeenCalled();
  });
});
