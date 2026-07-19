/**
 * CAM-412 — the seam invariant (story.md "Seams & refs"): however a turn
 * resolves — full stream, stream+meta (zero deltas), mid-stream error,
 * before-first-delta failure (-> JSON), no-streaming-capability (-> JSON),
 * or abort — the client (`aiChatAPI.send`, `lib/api-client.ts`) ends in
 * EXACTLY ONE of the existing terminal outcome kinds, and the SAME
 * cards/suggestions validation (`isAiChatCardResponse`/`normalizeSuggestions`)
 * runs regardless of transport. All fetch calls are mocked — zero real
 * spend, no real endpoint ever called.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiChatAPI, type AiChatOutcome } from '@/lib/api-client';

const VALID_CARD = {
  id: 'c1',
  nameTh: 'แคมป์ทดสอบ',
  nameEn: 'Test Camp',
  nameThSlug: 'a',
  nameEnSlug: 'b',
  priceLow: 500,
  createdAt: '2026-01-01T00:00:00.000Z',
  avgRating: null,
  reviewCount: 0,
  location: { province: 'เชียงใหม่' },
};

function sseChunk(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

/** Every outcome kind this endpoint's client can ever resolve to (BR-1 closed set + the client-internal "aborted"). */
const TERMINAL_KINDS = ['ok', 'rate-limited', 'disabled', 'error', 'aborted'] as const;

function expectTerminal(outcome: AiChatOutcome) {
  expect(TERMINAL_KINDS).toContain(outcome.kind);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('seam invariant — every resolution path ends in one terminal outcome, same card/suggestion validation', () => {
  it('[normal] path 1/6 — full stream (deltas + meta with valid cards/suggestions) -> ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          sseChunk('delta', { text: 'พบแคมป์ ' }),
          sseChunk('delta', { text: '1 แห่งครับ' }),
          sseChunk('meta', { cards: [VALID_CARD, { bad: 'shape' }], suggestions: ['a', 'a', ''] }),
          sseChunk('done', {}),
        ])
      )
    );
    const outcome = await aiChatAPI.send([{ role: 'user', content: 'q' }], { onDelta: () => {} });
    expectTerminal(outcome);
    expect(outcome.kind).toBe('ok');
    if (outcome.kind === 'ok') {
      expect(outcome.answer).toBe('พบแคมป์ 1 แห่งครับ');
      expect(outcome.cards).toEqual([VALID_CARD]); // malformed card dropped — same validation as the JSON path
      expect(outcome.suggestions).toEqual(['a']); // dup + blank dropped — same normalizeSuggestions as the JSON path
    }
  });

  it('[normal] path 2/6 — stream+meta with ZERO deltas (empty-answer edge) -> ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([sseChunk('meta', { cards: [VALID_CARD] }), sseChunk('done', {})])));
    const outcome = await aiChatAPI.send([{ role: 'user', content: 'q' }], { onDelta: () => {} });
    expectTerminal(outcome);
    expect(outcome.kind).toBe('ok');
    if (outcome.kind === 'ok') {
      expect(outcome.answer).toBe(''); // no deltas ever arrived
      expect(outcome.cards).toEqual([VALID_CARD]);
    }
  });

  it('[error] path 3/6 — mid-stream error (>=1 delta already shown) -> error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse([sseChunk('delta', { text: 'เริ่มตอบ' }), sseChunk('error', { code: 'assistant_error' })]))
    );
    const outcome = await aiChatAPI.send([{ role: 'user', content: 'q' }], { onDelta: () => {} });
    expectTerminal(outcome);
    expect(outcome.kind).toBe('error');
  });

  it('[error/validation] path 4/6 — before-first-delta failure (server 502 JSON, never a stream) -> error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 502,
        headers: { get: () => 'application/json' },
        json: async () => ({ code: 'assistant_error' }),
      }))
    );
    const outcome = await aiChatAPI.send([{ role: 'user', content: 'q' }], { onDelta: () => {} });
    expectTerminal(outcome);
    expect(outcome.kind).toBe('error');
  });

  it('[normal] path 5/6 — no-streaming-capability (caller never passes streamOptions, no Accept header ever sent) -> ok via the existing JSON path', async () => {
    let sentAccept: string | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init: RequestInit) => {
        sentAccept = (init.headers as Record<string, string>).Accept;
        return {
          ok: true,
          status: 200,
          json: async () => ({ answer: 'สวัสดีครับ', cards: [VALID_CARD, { bad: 1 }], suggestions: ['x', 'x'] }),
        };
      })
    );
    const outcome = await aiChatAPI.send([{ role: 'user', content: 'q' }]); // no streamOptions at all
    expect(sentAccept).toBeUndefined();
    expectTerminal(outcome);
    expect(outcome.kind).toBe('ok');
    if (outcome.kind === 'ok') {
      expect(outcome.cards).toEqual([VALID_CARD]); // SAME validation as the streaming path
      expect(outcome.suggestions).toEqual(['x']); // SAME dedupe as the streaming path
    }
  });

  it('[concurrent] path 6/6 — abort -> aborted (never "error", so the UI shows no error notice)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      })
    );
    const controller = new AbortController();
    controller.abort();
    const outcome = await aiChatAPI.send([{ role: 'user', content: 'q' }], { signal: controller.signal });
    expectTerminal(outcome);
    expect(outcome.kind).toBe('aborted');
  });
});
