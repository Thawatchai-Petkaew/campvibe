/**
 * CAM-412 (ADR-015) — lib/ai/openrouter-client.ts `runAssistantTurnFromMessagesStreaming`
 *
 * All tests MOCK fetch (vi.stubGlobal, mirrors __tests__/cam-270-openrouter-client.test.ts)
 * — zero real spend, no real OpenRouter call ever made. `dispatchTool` is
 * mocked for the tool-round scenarios (mirrors cam-416's pattern) so no real
 * Prisma call happens either.
 *
 * Coverage matrix:
 *  - null/empty: OPENROUTER_API_KEY unset -> { type:'skipped' } as the ONLY
 *    event, fetch never called (AC-6/EC-4)
 *  - normal: no tool requested -> cleaned delta events + one terminal meta,
 *    no <suggestions> substring in any delta (AC-1)
 *  - boundary/EC-2: the <suggestions> delimiter split across two stream
 *    chunks never leaks into any delta; meta still carries the parsed
 *    suggestions
 *  - normal: a tool round (tool_calls first) is drained with ZERO delta
 *    events, then the post-tool follow-up call streams the real answer
 *    (the "tool-deciding call stays non-streamed" invariant)
 *  - error/validation: mid-stream failure (>=1 delta already yielded) ->
 *    terminal error event, no meta (AC-4/EC-1)
 *  - error/validation: primary call fails before ANY content -> falls back
 *    once to the fallback model, which then streams successfully
 *  - error/validation: primary AND fallback both fail before any content ->
 *    error is the FIRST-EVER event (never a delta) — this is what lets the
 *    route fall back to JSON
 *  - concurrent/ordering: an already-aborted external signal stops the loop
 *    with no further event (BR-6)
 *  - concurrent/ordering (QA bounce): a MID-FLIGHT abort (>=1 real delta
 *    already yielded) drives the REAL signal chain — external AbortController
 *    -> makeCallSignal's composed signal -> the upstream fetch's own
 *    `signal` — and asserts the upstream fetch's signal actually fires AND
 *    no further/fallback fetch call is ever issued (Prove-It: dropping
 *    `externalSignal` from `makeCallSignal`'s composition turns this red)
 *  - boundary (QA bounce): TURN_DEADLINE_MS breach mid-stream stops the loop
 *    (no further paid call) via the deadline path, not an infinite loop —
 *    both sub-branches (leftover content flushed vs no content -> error)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

const mockDispatchTool = vi.fn();
vi.mock('@/lib/ai/tool-registry', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/tool-registry')>('@/lib/ai/tool-registry');
  return {
    ...actual,
    dispatchTool: (...args: unknown[]) => mockDispatchTool(...args),
  };
});

const { runAssistantTurnFromMessagesStreaming, GENERIC_ERROR, TURN_DEADLINE_MS } = await import('@/lib/ai/openrouter-client');

const FAKE_KEY = 'sk-or-test-super-secret-123';

/** Builds an OpenRouter-shaped SSE `Response` from an array of raw string fragments (each fragment is written as one `controller.enqueue` — lets a test split a single `data:` line's bytes across two enqueues). */
function sseResponse(rawFragments: string[], opts?: { ok?: boolean; status?: number }): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frag of rawFragments) controller.enqueue(encoder.encode(frag));
      controller.close();
    },
  });
  return new Response(body, { status: opts?.status ?? 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function dataLine(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

function contentChunk(text: string) {
  return { choices: [{ delta: { content: text }, finish_reason: null }] };
}

function toolCallChunk(index: number, fields: { id?: string; name?: string; args?: string }) {
  return {
    choices: [
      {
        delta: {
          tool_calls: [
            {
              index,
              ...(fields.id ? { id: fields.id } : {}),
              ...(fields.name ? { type: 'function', function: { name: fields.name, arguments: fields.args ?? '' } } : {}),
              ...(!fields.name && fields.args !== undefined ? { function: { arguments: fields.args } } : {}),
            },
          ],
        },
        finish_reason: null,
      },
    ],
  };
}

/** Non-streaming failure response (bad status, no body needed). */
function failedResponse(status = 500): Response {
  return new Response(null, { status });
}

async function drain(gen: AsyncGenerator<{ type: string; [k: string]: unknown }>) {
  const events: Array<{ type: string; [k: string]: unknown }> = [];
  for await (const ev of gen) events.push(ev);
  return events;
}

/**
 * Races a promise against a short deterministic timeout (qa.md — never a
 * bare `sleep`-to-fix-flakiness; this is a bounded SAFETY NET around a real
 * condition, `promise`, so a broken abort/deadline path fails FAST with a
 * clear assertion instead of hanging until the runner's own global timeout).
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<{ timedOut: true } | { timedOut: false; value: T }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ timedOut: true }), ms);
    promise.then((value) => {
      clearTimeout(timer);
      resolve({ timedOut: false, value });
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENROUTER_API_KEY = FAKE_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_MODEL;
  delete process.env.OPENROUTER_MODEL_FALLBACK;
});

/* -------------------------------------------------------------------------- */
/* AC-6/EC-4 — key unset                                                       */
/* -------------------------------------------------------------------------- */

describe('runAssistantTurnFromMessagesStreaming — OPENROUTER_API_KEY absent (AC-6/EC-4)', () => {
  it('[null/empty] yields only {type:"skipped"}, fetch never called', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const events = await drain(runAssistantTurnFromMessagesStreaming([{ role: 'user', content: 'hi' }]));

    expect(events).toEqual([{ type: 'skipped' }]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* AC-1 — no tool requested, cleaned deltas + terminal meta                    */
/* -------------------------------------------------------------------------- */

describe('runAssistantTurnFromMessagesStreaming — content-only completion (AC-1)', () => {
  it('[normal] streams cleaned deltas then one terminal meta, no <suggestions> substring anywhere', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      sseResponse([
        dataLine(contentChunk('พบแคมป์ ')),
        dataLine(contentChunk('2 แห่งครับ')),
        dataLine(contentChunk('\n<suggestions>["ใกล้ๆนี้มีไหม"]</suggestions>')),
        'data: [DONE]\n\n',
      ])
    );
    vi.stubGlobal('fetch', mockFetch);

    const events = await drain(runAssistantTurnFromMessagesStreaming([{ role: 'user', content: 'หาแคมป์' }]));

    const deltas = events.filter((e) => e.type === 'delta');
    expect(deltas.length).toBeGreaterThan(0);
    const joined = deltas.map((d) => d.text).join('');
    expect(joined).not.toContain('<suggestions>');
    expect(joined).not.toContain('</suggestions>');
    expect(joined).not.toContain('[DONE]');

    const meta = events.find((e) => e.type === 'meta');
    expect(meta).toBeDefined();
    expect(meta?.cards).toEqual([]);
    expect(meta?.suggestions).toEqual(['ใกล้ๆนี้มีไหม']);
    expect(events[events.length - 1].type).toBe('meta'); // terminal — no further event after meta
  });
});

/* -------------------------------------------------------------------------- */
/* EC-2 — <suggestions> delimiter split across two chunks                     */
/* -------------------------------------------------------------------------- */

describe('runAssistantTurnFromMessagesStreaming — buffer-split safety (BR-3/EC-2)', () => {
  it('[boundary] a delimiter split across two stream chunks never reaches any delta', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      sseResponse([
        dataLine(contentChunk('คำตอบของคุณ')),
        dataLine(contentChunk('<sugg')), // split mid-tag
        dataLine(contentChunk('estions>["a","b"]</suggestions>')),
        'data: [DONE]\n\n',
      ])
    );
    vi.stubGlobal('fetch', mockFetch);

    const events = await drain(runAssistantTurnFromMessagesStreaming([{ role: 'user', content: 'q' }]));

    const joined = events
      .filter((e) => e.type === 'delta')
      .map((d) => d.text)
      .join('');
    expect(joined).toBe('คำตอบของคุณ');
    expect(joined).not.toContain('<');

    const meta = events.find((e) => e.type === 'meta');
    expect(meta?.suggestions).toEqual(['a', 'b']);
  });
});

/* -------------------------------------------------------------------------- */
/* Tool round stays non-streamed, then the follow-up answers                  */
/* -------------------------------------------------------------------------- */

describe('runAssistantTurnFromMessagesStreaming — tool round then follow-up answer', () => {
  it('[normal] the tool-deciding call yields ZERO delta events; only the follow-up streams', async () => {
    mockDispatchTool.mockResolvedValueOnce({ ok: true, data: { cards: [{ id: 'c1' }] } });

    const mockFetch = vi
      .fn()
      // Round 1: model decides to call a tool — no content ever.
      .mockResolvedValueOnce(
        sseResponse([
          dataLine(toolCallChunk(0, { id: 'call_1', name: 'searchCampsites', args: '' })),
          dataLine(toolCallChunk(0, { args: '{}' })),
          'data: [DONE]\n\n',
        ])
      )
      // Round 2 (post-tool follow-up): prose answer, streamed live.
      .mockResolvedValueOnce(
        sseResponse([dataLine(contentChunk('พบ 1 แห่งครับ')), 'data: [DONE]\n\n'])
      );
    vi.stubGlobal('fetch', mockFetch);

    const events = await drain(runAssistantTurnFromMessagesStreaming([{ role: 'user', content: 'หาแคมป์' }]));

    expect(mockFetch).toHaveBeenCalledTimes(2); // exactly the tool round + the follow-up — no extra paid call
    const deltas = events.filter((e) => e.type === 'delta');
    expect(deltas.map((d) => d.text).join('')).toBe('พบ 1 แห่งครับ');
    const meta = events.find((e) => e.type === 'meta');
    expect(meta?.cards).toEqual([{ id: 'c1' }]);
    expect(meta?.searchAttempted).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* AC-4/EC-1 — mid-stream failure                                             */
/* -------------------------------------------------------------------------- */

describe('runAssistantTurnFromMessagesStreaming — mid-stream failure (AC-4/EC-1)', () => {
  it('[error] a malformed frame after >=1 delta ends in a terminal error, no meta', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(dataLine(contentChunk('เริ่มตอบ'))));
        controller.enqueue(encoder.encode('data: {not valid json\n\n')); // malformed frame
        controller.close();
      },
    });
    const mockFetch = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const events = await drain(runAssistantTurnFromMessagesStreaming([{ role: 'user', content: 'q' }]));

    expect(events[0]).toEqual({ type: 'delta', text: 'เริ่มตอบ' });
    expect(events[events.length - 1]).toEqual({ type: 'error', code: GENERIC_ERROR });
    expect(events.some((e) => e.type === 'meta')).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* AC-6 fallback — pre-first-delta failure falls back once                    */
/* -------------------------------------------------------------------------- */

describe('runAssistantTurnFromMessagesStreaming — primary failure before any content (AC-6/BR-6)', () => {
  it('[error/validation] falls back once to the fallback model, which streams successfully', async () => {
    process.env.OPENROUTER_MODEL = 'primary/model';
    process.env.OPENROUTER_MODEL_FALLBACK = 'fallback/model';
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(failedResponse(500)) // primary — dies before any content
      .mockResolvedValueOnce(sseResponse([dataLine(contentChunk('สวัสดีครับ')), 'data: [DONE]\n\n']));
    vi.stubGlobal('fetch', mockFetch);

    const events = await drain(runAssistantTurnFromMessagesStreaming([{ role: 'user', content: 'q' }]));

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(events[0]).toEqual({ type: 'delta', text: 'สวัสดีครับ' });
    expect(events[events.length - 1].type).toBe('meta');
  });

  it('[error/validation] both primary and fallback fail before any content -> error is the FIRST-EVER event', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(failedResponse(500)).mockResolvedValueOnce(failedResponse(500));
    vi.stubGlobal('fetch', mockFetch);

    const events = await drain(runAssistantTurnFromMessagesStreaming([{ role: 'user', content: 'q' }]));

    expect(events).toEqual([{ type: 'error', code: GENERIC_ERROR }]);
  });
});

/* -------------------------------------------------------------------------- */
/* BR-6/AC-7/EC-6 — abort                                                     */
/* -------------------------------------------------------------------------- */

describe('runAssistantTurnFromMessagesStreaming — abort (BR-6/AC-7/EC-6)', () => {
  it('[concurrent] an already-aborted external signal stops the loop with no event and no fetch call', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    const controller = new AbortController();
    controller.abort();

    const events = await drain(
      runAssistantTurnFromMessagesStreaming([{ role: 'user', content: 'q' }], {}, controller.signal)
    );

    expect(events).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('[concurrent] REAL-ENGINE mid-flight abort: external AbortController -> composed signal -> the upstream fetch signal actually fires; no further/fallback call is issued (Prove-It: drop `externalSignal` from makeCallSignal and this turns red)', async () => {
    const controller = new AbortController();
    let observedAbortOnUpstreamSignal = false;
    let streamControllerRef: ReadableStreamDefaultController<Uint8Array> | undefined;

    const mockFetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          streamControllerRef = c;
          // One real delta immediately, then the "connection" stays open
          // (no close, no [DONE]) — simulating an in-progress upstream
          // response still being generated when the abort happens.
          c.enqueue(encoder.encode(dataLine(contentChunk('เริ่มตอบ'))));
        },
      });
      const upstreamSignal = init?.signal as AbortSignal | undefined;
      upstreamSignal?.addEventListener(
        'abort',
        () => {
          observedAbortOnUpstreamSignal = true;
          try {
            streamControllerRef?.error(new DOMException('aborted', 'AbortError'));
          } catch {
            // already closed/errored — fine
          }
        },
        { once: true }
      );
      return Promise.resolve(new Response(body, { status: 200 }));
    });
    vi.stubGlobal('fetch', mockFetch);

    const gen = runAssistantTurnFromMessagesStreaming([{ role: 'user', content: 'q' }], {}, controller.signal);

    const first = await gen.next();
    expect(first.value).toEqual({ type: 'delta', text: 'เริ่มตอบ' });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Mid-flight: the SAME real chain the route composes (request.signal ->
    // AbortController -> runAssistantTurnFromMessagesStreaming's externalSignal).
    controller.abort();

    const second = await withTimeout(gen.next(), 500);
    expect(second.timedOut).toBe(false); // the upstream read settles promptly — no hang
    if (!second.timedOut) {
      expect(second.value.done || second.value.value.type === 'error').toBeTruthy();
    }
    expect(observedAbortOnUpstreamSignal).toBe(true); // the upstream fetch's OWN signal fired
    expect(mockFetch).toHaveBeenCalledTimes(1); // no fallback / next-iteration call after abort
  });
});

/* -------------------------------------------------------------------------- */
/* QA bounce — TURN_DEADLINE_MS breach mid-stream (streaming engine)          */
/* -------------------------------------------------------------------------- */

describe('runAssistantTurnFromMessagesStreaming — TURN_DEADLINE_MS breach (spend guard, streaming engine)', () => {
  afterEach(() => {
    vi.restoreAllMocks(); // release the Date.now spy each test (afterEach above only unstubs fetch/env)
  });

  it('[boundary] no leftover content at the breach -> terminal error, NO further/second paid call (Prove-It: removing the deadline check lets a 2nd call through and this assertion goes red)', async () => {
    mockDispatchTool.mockResolvedValueOnce({ ok: true, data: { cards: [] } });

    const mockFetch = vi
      .fn()
      // Iteration 1: a tool round with NO content — lastRawContent stays ''.
      .mockResolvedValueOnce(
        sseResponse([
          dataLine(toolCallChunk(0, { id: 'call_1', name: 'searchCampsites', args: '' })),
          dataLine(toolCallChunk(0, { args: '{}' })),
          'data: [DONE]\n\n',
        ])
      )
      // A 2nd call would only ever be reached if the deadline guard were
      // removed — configured so THAT failure mode is a clean assertion
      // mismatch (toHaveBeenCalledTimes), never an unrelated crash.
      .mockResolvedValueOnce(sseResponse([dataLine(contentChunk('ไม่ควรถึงตรงนี้')), 'data: [DONE]\n\n']));
    vi.stubGlobal('fetch', mockFetch);

    // First Date.now() call computes turnDeadline; every call AFTER that
    // (iteration 2's check) reports comfortably past it.
    vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(TURN_DEADLINE_MS + 1_000);

    const events = await drain(runAssistantTurnFromMessagesStreaming([{ role: 'user', content: 'หาแคมป์' }]));

    expect(mockFetch).toHaveBeenCalledTimes(1); // the loop STOPPED at the deadline — no 2nd/infinite call
    expect(events).toEqual([{ type: 'error', code: GENERIC_ERROR }]);
  });

  it('[boundary] leftover content at the breach -> flushed as one delta + terminal meta, NO further/second paid call', async () => {
    mockDispatchTool.mockResolvedValueOnce({ ok: true, data: { cards: [] } });

    const mockFetch = vi
      .fn()
      // Iteration 1: tool_calls interleaved with SOME content — mode stays
      // 'tool_calls' (never streamed live, matches the "tool round stays
      // non-streamed" invariant) but rawContent still accumulates the text,
      // so `lastRawContent` is non-empty by the time iteration 2 checks.
      .mockResolvedValueOnce(
        sseResponse([
          dataLine(toolCallChunk(0, { id: 'call_1', name: 'searchCampsites', args: '' })),
          dataLine(contentChunk('กำลังค้นหาให้อยู่')),
          dataLine(toolCallChunk(0, { args: '{}' })),
          'data: [DONE]\n\n',
        ])
      )
      .mockResolvedValueOnce(sseResponse([dataLine(contentChunk('ไม่ควรถึงตรงนี้')), 'data: [DONE]\n\n']));
    vi.stubGlobal('fetch', mockFetch);

    vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(TURN_DEADLINE_MS + 1_000);

    const events = await drain(runAssistantTurnFromMessagesStreaming([{ role: 'user', content: 'หาแคมป์' }]));

    expect(mockFetch).toHaveBeenCalledTimes(1); // the loop STOPPED at the deadline — no 2nd/infinite call
    expect(events).toEqual([
      { type: 'delta', text: 'กำลังค้นหาให้อยู่' },
      { type: 'meta', cards: [], searchAttempted: true }, // searchCampsites WAS dispatched in the tool round before the breach
    ]);
  });
});
