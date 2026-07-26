/**
 * CAM-568 — the ai-guardrail-gate was failing all 6 cases with every model
 * call failure swallowed down to a bare `{level, event, model}` log line, so
 * the real cause (an HTTP status or a thrown exception's message) was never
 * visible in CI output. This file proves the teeth of the fix:
 *
 *  - AC-1/EC-1: a non-2xx response and a thrown network exception both
 *    surface `status`/`reason` on the `ai_primary_call_failed` /
 *    `ai_fallback_call_failed` structured log lines (non-streaming path,
 *    `runAssistantTurn` -> `callModelOnce`/`callModelWithFallback`, AND the
 *    streaming path, `runAssistantTurnFromMessagesStreaming` ->
 *    `drainOneStreamingCall`/`streamOneCompletion`).
 *  - [security] the enriched log NEVER leaks the API key (extends the
 *    existing cam-270 invariant to the new fields).
 *  - AC-2/EC-2/BR-2: `categorizeFailureReason` (scripts/ai-eval/guardrail-
 *    retry.ts) classifies a `replayCase`-failed reason as "environmental"
 *    and a `scoreCase`-failed reason as "behavioral" — the distinction the
 *    guardrail gate's own failure summary now reports, so an environmental
 *    fault (the model was never reached) is never read as an assistant
 *    regression.
 *
 * All openrouter-client tests MOCK fetch (vi.stubGlobal, mirrors
 * __tests__/cam-270-openrouter-client.test.ts / cam-412-openrouter-
 * streaming.test.ts) — zero real spend, no real OpenRouter call ever made.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

const mockDispatchTool = vi.fn();
vi.mock('@/lib/ai/tool-registry', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/tool-registry')>('@/lib/ai/tool-registry');
  return { ...actual, dispatchTool: (...args: unknown[]) => mockDispatchTool(...args) };
});

const { runAssistantTurn, runAssistantTurnFromMessagesStreaming } = await import('@/lib/ai/openrouter-client');
import { categorizeFailureReason } from '../scripts/ai-eval/guardrail-retry';

const FAKE_KEY = 'sk-or-test-super-secret-cam568';

function res(body: unknown, ok = true, status = 200, statusText = ''): Response {
  return { ok, status, statusText, json: async () => body } as Response;
}

async function drain(gen: AsyncGenerator<{ type: string; [k: string]: unknown }>) {
  const events: Array<{ type: string; [k: string]: unknown }> = [];
  for await (const ev of gen) events.push(ev);
  return events;
}

function failedStreamResponse(status = 500): Response {
  return new Response(null, { status });
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
/* AC-1/EC-1 — non-streaming path: the swallowed cause now surfaces           */
/* -------------------------------------------------------------------------- */

describe('CAM-568 non-streaming call failure — the real cause is logged, not swallowed', () => {
  it('[error/validation] a non-2xx primary+fallback response logs status + reason on both events, never a bare {level,event,model}', async () => {
    const mockFetch = vi.fn().mockResolvedValue(res({ error: 'meltdown' }, false, 401, 'Unauthorized'));
    vi.stubGlobal('fetch', mockFetch);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await runAssistantTurn('hi');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const primaryLog = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(primaryLog.event).toBe('ai_primary_call_failed');
    expect(primaryLog.status).toBe(401);
    expect(primaryLog.reason).toMatch(/401/);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const fallbackLog = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(fallbackLog.event).toBe('ai_fallback_call_failed');
    expect(fallbackLog.status).toBe(401);
    expect(fallbackLog.reason).toMatch(/401/);

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('[error/validation] a thrown network exception (e.g. DNS/timeout) logs the exception message as the reason', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND openrouter.ai'));
    vi.stubGlobal('fetch', mockFetch);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await runAssistantTurn('hi');

    const primaryLog = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(primaryLog.status).toBeNull(); // no HTTP response was ever received
    expect(primaryLog.reason).toBe('getaddrinfo ENOTFOUND openrouter.ai');

    const fallbackLog = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(fallbackLog.reason).toBe('getaddrinfo ENOTFOUND openrouter.ai');

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('[security] the enriched status/reason fields never leak the API key', async () => {
    const mockFetch = vi.fn().mockResolvedValue(res({}, false, 500, 'Internal Server Error'));
    vi.stubGlobal('fetch', mockFetch);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await runAssistantTurn('hi');

    for (const call of [...warnSpy.mock.calls, ...errorSpy.mock.calls]) {
      expect(JSON.stringify(call)).not.toContain(FAKE_KEY);
    }
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

/* -------------------------------------------------------------------------- */
/* AC-1/EC-1 — streaming path: same enrichment, drainOneStreamingCall         */
/* -------------------------------------------------------------------------- */

describe('CAM-568 streaming call failure — the real cause is logged, not swallowed', () => {
  it('[error/validation] both primary and fallback non-2xx responses log status + reason', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(failedStreamResponse(429))
      .mockResolvedValueOnce(failedStreamResponse(429));
    vi.stubGlobal('fetch', mockFetch);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await drain(runAssistantTurnFromMessagesStreaming([{ role: 'user', content: 'q' }]));

    const primaryLog = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(primaryLog.event).toBe('ai_primary_call_failed');
    expect(primaryLog.status).toBe(429);
    expect(primaryLog.reason).toMatch(/429/);

    const fallbackLog = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(fallbackLog.event).toBe('ai_fallback_call_failed');
    expect(fallbackLog.status).toBe(429);
    expect(fallbackLog.reason).toMatch(/429/);

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

/* -------------------------------------------------------------------------- */
/* AC-2/EC-2/BR-2 — environmental vs behavioral categorization                */
/* -------------------------------------------------------------------------- */

describe('CAM-568 categorizeFailureReason — environmental vs behavioral (BR-2)', () => {
  it('[normal] a replayCase model-call failure reason ("model call failed: ...") is environmental', () => {
    expect(categorizeFailureReason('model call failed: HTTP 401 Unauthorized')).toBe('environmental');
    expect(categorizeFailureReason('model call failed: unknown')).toBe('environmental');
  });

  it('[normal] a scoreCase reason (anything else) is behavioral — the model DID answer, but violated the guardrail', () => {
    expect(categorizeFailureReason('dispatched searchCampsites with a province param (guardrail forbids it)')).toBe(
      'behavioral'
    );
    expect(categorizeFailureReason('expected no_tool but a tool was dispatched')).toBe('behavioral');
  });

  it('[boundary] an empty reason string is treated as behavioral (never mis-labels an unknown case as environmental)', () => {
    expect(categorizeFailureReason('')).toBe('behavioral');
  });
});
