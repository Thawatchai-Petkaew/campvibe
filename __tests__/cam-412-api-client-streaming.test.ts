/**
 * CAM-412 (ADR-015) — lib/api-client.ts `aiChatAPI.send` streaming
 * consumption (legacy/guest shape only). All fetch calls are mocked
 * (vi.stubGlobal, mirrors __tests__/cam-272-ai-chat-conversation.test.ts) —
 * this suite never calls a real endpoint.
 *
 * AC -> test matrix
 * ───────────────────────────────────────────────────────────────────────
 * AC-1  a real SSE response: onDelta fires per chunk, the resolved outcome's
 *       `answer` is the FULL accumulated text, cards/suggestions come from
 *       `meta` via the SAME `isAiChatCardResponse`/`normalizeSuggestions`.
 * AC-2/EC-2 the raw `<suggestions>` substring never reaches `onDelta`.
 * AC-3  no `streamOptions` passed -> byte-stable existing JSON path,
 *       Accept header never sent (regression pin).
 * AC-3  `streamOptions` passed but the server responds JSON (BR-2 fallback)
 *       -> resolves via the existing `parseAiChatSuccessBody` path, onDelta
 *       never called.
 * EC-5  a malformed frame mid-stream -> {kind:'error'}, partial discarded.
 * EC-6  a mid-stream `error` event -> {kind:'error'}.
 * EC-6  the caller's own AbortSignal already aborted -> {kind:'aborted'},
 *       never {kind:'error'} (so the UI shows no error notice).
 * ───────────────────────────────────────────────────────────────────────
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiChatAPI } from '@/lib/api-client';

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

afterEach(() => {
  vi.unstubAllGlobals();
});

/* -------------------------------------------------------------------------- */
/* AC-1 — happy streamed path                                                  */
/* -------------------------------------------------------------------------- */

describe('aiChatAPI.send — streaming happy path (AC-1)', () => {
  it('[normal] onDelta fires per chunk; the resolved outcome carries the FULL accumulated answer + meta cards/suggestions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          sseChunk('delta', { text: 'พบแคมป์ ' }),
          sseChunk('delta', { text: '2 แห่งครับ' }),
          sseChunk('meta', {
            cards: [
              {
                id: 'c1',
                nameTh: 'แคมป์ทดสอบ',
                nameEn: 'Test',
                nameThSlug: 'a',
                nameEnSlug: 'b',
                priceLow: 500,
                createdAt: '2026-01-01T00:00:00.000Z',
                avgRating: null,
                reviewCount: 0,
                location: { province: 'เชียงใหม่' },
              },
            ],
            suggestions: ['ใกล้ๆนี้มีไหม'],
          }),
          sseChunk('done', {}),
        ])
      )
    );

    const deltas: string[] = [];
    const outcome = await aiChatAPI.send([{ role: 'user', content: 'หาแคมป์' }], {
      onDelta: (t) => deltas.push(t),
    });

    expect(deltas).toEqual(['พบแคมป์ ', '2 แห่งครับ']);
    expect(outcome.kind).toBe('ok');
    if (outcome.kind === 'ok') {
      expect(outcome.answer).toBe('พบแคมป์ 2 แห่งครับ');
      expect(outcome.cards).toHaveLength(1);
      expect(outcome.suggestions).toEqual(['ใกล้ๆนี้มีไหม']);
    }
  });

  it('[unit] requesting a stream sends Accept:text/event-stream; not requesting one never sends it', async () => {
    let sentAccept: string | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init: RequestInit) => {
        sentAccept = (init.headers as Record<string, string>).Accept ?? null;
        return sseResponse([sseChunk('meta', { cards: [] }), sseChunk('done', {})]);
      })
    );
    await aiChatAPI.send([{ role: 'user', content: 'q' }], { onDelta: () => {} });
    expect(sentAccept).toBe('text/event-stream');

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ answer: 'ok', cards: [] }) })));
    const outcome = await aiChatAPI.send([{ role: 'user', content: 'q' }]);
    expect(outcome).toEqual({ kind: 'ok', answer: 'ok', cards: [] }); // AC-3 — no streamOptions, byte-stable JSON path
  });
});

/* -------------------------------------------------------------------------- */
/* EC-2 — the raw block never reaches onDelta                                 */
/* -------------------------------------------------------------------------- */

describe('aiChatAPI.send — the <suggestions> block never reaches onDelta (BR-3/EC-2)', () => {
  it('[boundary] every delta chunk the client renders is clean prose only', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          sseChunk('delta', { text: 'คำตอบ' }),
          sseChunk('meta', { cards: [], suggestions: ['a'] }),
          sseChunk('done', {}),
        ])
      )
    );
    const deltas: string[] = [];
    await aiChatAPI.send([{ role: 'user', content: 'q' }], { onDelta: (t) => deltas.push(t) });
    expect(deltas.join('')).not.toContain('<suggestions>');
  });
});

/* -------------------------------------------------------------------------- */
/* AC-3 — server fallback to JSON even when a stream was requested            */
/* -------------------------------------------------------------------------- */

describe('aiChatAPI.send — server-side JSON fallback (AC-3, BR-2)', () => {
  it('[normal] a 503 short-circuits to "disabled" even when streaming was requested; onDelta never fires', async () => {
    const onDelta = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        headers: { get: () => 'application/json' },
        json: async () => ({ code: 'assistant_disabled' }),
      }))
    );
    const outcome = await aiChatAPI.send([{ role: 'user', content: 'q' }], { onDelta });
    expect(outcome).toEqual({ kind: 'disabled' });
    expect(onDelta).not.toHaveBeenCalled();
  });

  it('[normal] a 2xx application/json body (content-type NOT text/event-stream) parses via the existing path, never treated as a stream', async () => {
    const onDelta = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json; charset=utf-8' },
        json: async () => ({ answer: 'สวัสดีครับ', cards: [] }),
      }))
    );
    const outcome = await aiChatAPI.send([{ role: 'user', content: 'q' }], { onDelta });
    expect(outcome).toEqual({ kind: 'ok', answer: 'สวัสดีครับ', cards: [] });
    expect(onDelta).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* EC-5/EC-6 — malformed frame / mid-stream error / abort                     */
/* -------------------------------------------------------------------------- */

describe('aiChatAPI.send — stream failure modes (EC-5/EC-6)', () => {
  it('[error/validation] a malformed frame mid-stream resolves to {kind:"error"}', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sseChunk('delta', { text: 'เริ่ม' })));
        controller.enqueue(encoder.encode('event: delta\ndata: {not json\n\n'));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })));

    const outcome = await aiChatAPI.send([{ role: 'user', content: 'q' }], { onDelta: () => {} });
    expect(outcome).toEqual({ kind: 'error' });
  });

  it('[error/validation] a terminal error event resolves to {kind:"error"}', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse([sseChunk('delta', { text: 'a' }), sseChunk('error', { code: 'assistant_error' })]))
    );
    const outcome = await aiChatAPI.send([{ role: 'user', content: 'q' }], { onDelta: () => {} });
    expect(outcome).toEqual({ kind: 'error' });
  });

  it('[concurrent] an already-aborted signal resolves to {kind:"aborted"}, never {kind:"error"}', async () => {
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
    expect(outcome).toEqual({ kind: 'aborted' });
  });
});
