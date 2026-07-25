/**
 * CAM-416 (ADR-013 D4) — the bounded agent loop in
 * lib/ai/openrouter-client.ts's `runTurnFromBaseMessages` (shared by
 * `runAssistantTurn` and `runAssistantTurnFromMessages`).
 *
 * All tests MOCK fetch (vi.stubGlobal, mirrors __tests__/cam-270-openrouter-
 * client.test.ts) — zero real spend, no real OpenRouter call ever made.
 *
 * Coverage matrix:
 *   - normal: multi-round chain — 2 tool-call rounds, then a natural final
 *     answer at iteration 3 (never reaching the iteration cap)
 *   - normal: no tool requested → exactly ONE completion call (unaffected by
 *     the loop — same behavior as the pre-CAM-416 single-round engine)
 *   - boundary: 4-round forced final — the model keeps requesting tool_calls
 *     through iteration 4; the forced-final call (`tool_choice:'none'`)
 *     still (defensively) carries tool_calls in the mocked response, and the
 *     engine ignores them — never a 5th completion call, never a 4th
 *     dispatchTool call
 *   - security/boundary: MAX_TOOL_CALLS_PER_TURN (6) bounds the SUM executed
 *     across rounds, independent of the unchanged per-round cap (3) — a 3rd
 *     round's requests are rejected once the turn budget is spent
 *   - error/validation: turn wall-clock deadline (Date.now() spied/injected)
 *     — zero-content deadline → handled GENERIC_ERROR, no further call;
 *     content-bearing deadline → the existing content becomes the final
 *     answer, no further call
 *   - normal: model fallback pins whichever model answered first — once the
 *     fallback model succeeds on iteration 1, iteration 2 calls that SAME
 *     model directly (no repeat primary attempt)
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

const {
  runAssistantTurn,
  GENERIC_ERROR,
  MAX_AGENT_ITERATIONS,
  MAX_TOOL_CALLS_PER_ROUND,
  MAX_TOOL_CALLS_PER_TURN,
  TURN_DEADLINE_MS,
  MODEL_CALL_TIMEOUT_MS,
} = await import('@/lib/ai/openrouter-client');
const { maxDuration } = await import('@/app/api/ai/chat/route');

const FAKE_KEY = 'sk-or-test-cam416-agent-loop';

function res(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

function assistantMessage(content: string | null, toolCalls?: unknown[]) {
  return { choices: [{ message: { role: 'assistant', content, tool_calls: toolCalls } }] };
}

function toolCall(id: string, name = 'searchCampsites') {
  return { id, type: 'function', function: { name, arguments: '{}' } };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENROUTER_API_KEY = FAKE_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_MODEL;
  delete process.env.OPENROUTER_MODEL_FALLBACK;
});

describe('CAM-416 — constants match ADR-013 D4', () => {
  it('[unit] loop caps are the ratified D4 values', () => {
    expect(MAX_AGENT_ITERATIONS).toBe(4);
    expect(MAX_TOOL_CALLS_PER_ROUND).toBe(3);
    expect(MAX_TOOL_CALLS_PER_TURN).toBe(6);
  });
});

describe('CAM-416 — Security Info fix: TURN_DEADLINE_MS leaves headroom under route maxDuration (boundary)', () => {
  it('[boundary] TURN_DEADLINE_MS + MODEL_CALL_TIMEOUT_MS stays strictly below maxDuration*1000 — a deadline check that JUST passes can never let its one final model call push the route past its own execution ceiling (would surface a raw Vercel 504 instead of the graceful 502 assistant_unavailable)', () => {
    expect(TURN_DEADLINE_MS + MODEL_CALL_TIMEOUT_MS).toBeLessThan(maxDuration * 1000);
    // Pin the real numbers too (not just the relationship) so a change to
    // either constant is a deliberate, reviewed edit — never a silent drift.
    expect(TURN_DEADLINE_MS).toBe(40_000);
    expect(MODEL_CALL_TIMEOUT_MS).toBe(15_000);
    expect(maxDuration).toBe(60);
  });
});

describe('CAM-416 — multi-round chain (normal)', () => {
  it('[normal] two tool-call rounds then a natural final answer at iteration 3 — never reaches the iteration cap', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('call_1')])))
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('call_2', 'checkAvailability')])))
      .mockResolvedValueOnce(res(assistantMessage('พบแคมป์ที่ว่างครับ')));
    vi.stubGlobal('fetch', mockFetch);
    mockDispatchTool.mockResolvedValue({ ok: true, data: { cards: [{ id: 'c1' }] } });

    const result = await runAssistantTurn('มีแคมป์ในเชียงใหม่ที่ว่างสุดสัปดาห์นี้ไหม');

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockDispatchTool).toHaveBeenCalledTimes(2);
    // CAM-430: round 1 dispatched a 'searchCampsites' call -> searchAttempted:true.
    // CAM-485: the SAME camp (id 'c1') surfaced by both round 1 (search) and
    // round 2 (checkAvailability) is deduped by id -> renders ONCE, not twice.
    expect(result).toEqual({
      ok: true,
      answer: 'พบแคมป์ที่ว่างครับ',
      cards: [{ id: 'c1' }],
      searchAttempted: true,
    });

    // The natural-stop call (iteration 3, not the iteration cap) never forces tool_choice.
    const thirdBody = JSON.parse((mockFetch.mock.calls[2][1] as RequestInit).body as string);
    expect(thirdBody.tool_choice).toBeUndefined();
  });
});

describe('CAM-416 — no tool requested (unaffected by the loop)', () => {
  it('[normal] exactly ONE completion call when the model never requests a tool', async () => {
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('สวัสดีครับ มีอะไรให้ช่วยไหมครับ')));
    vi.stubGlobal('fetch', mockFetch);

    const result = await runAssistantTurn('สวัสดี');

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockDispatchTool).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, answer: 'สวัสดีครับ มีอะไรให้ช่วยไหมครับ', cards: [] });
  });
});

describe('CAM-416 — 4-round forced final (boundary, AC iteration cap)', () => {
  it('[boundary] the model requests tool_calls through iteration 4; the forced-final call (tool_choice:none) ignores any tool_calls it still carries — never a 5th call, never a 4th dispatch', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('call_1')])))
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('call_2')])))
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('call_3')])))
      // Iteration 4 is forced final (tool_choice:'none'); the mocked model
      // defensively still returns tool_calls alongside content — the engine
      // must ignore them, per EC "model requests tools at iteration 4".
      .mockResolvedValueOnce(res(assistantMessage('คำตอบสุดท้ายครับ', [toolCall('call_4')])));
    vi.stubGlobal('fetch', mockFetch);
    mockDispatchTool.mockResolvedValue({ ok: true, data: {} });

    const result = await runAssistantTurn('question needing many tool rounds');

    expect(mockFetch).toHaveBeenCalledTimes(MAX_AGENT_ITERATIONS);
    expect(mockDispatchTool).toHaveBeenCalledTimes(3); // rounds 1-3 only — call_4 is never dispatched
    // CAM-430: rounds 1-3 all dispatched 'searchCampsites' calls (toolCall()'s default name) -> searchAttempted:true.
    expect(result).toEqual({ ok: true, answer: 'คำตอบสุดท้ายครับ', cards: [], searchAttempted: true });

    const forcedFinalBody = JSON.parse(
      (mockFetch.mock.calls[MAX_AGENT_ITERATIONS - 1][1] as RequestInit).body as string
    );
    expect(forcedFinalBody.tool_choice).toBe('none');
  });
});

describe('CAM-416 — MAX_TOOL_CALLS_PER_TURN bounds the SUM across rounds (security/boundary)', () => {
  it('[security] round 1 executes 3, round 2 executes 3 (turn budget spent), round 3 requests 2 more but the turn cap rejects all of them', async () => {
    const round1Calls = [toolCall('r1_a'), toolCall('r1_b'), toolCall('r1_c')];
    const round2Calls = [toolCall('r2_a'), toolCall('r2_b'), toolCall('r2_c')];
    const round3Calls = [toolCall('r3_a'), toolCall('r3_b')];
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage(null, round1Calls)))
      .mockResolvedValueOnce(res(assistantMessage(null, round2Calls)))
      .mockResolvedValueOnce(res(assistantMessage(null, round3Calls)))
      .mockResolvedValueOnce(res(assistantMessage('จบการค้นหาครับ'))); // iteration 4, forced final
    vi.stubGlobal('fetch', mockFetch);
    mockDispatchTool.mockResolvedValue({ ok: true, data: {} });

    const result = await runAssistantTurn('question requesting far more tools than the turn budget allows');

    expect(mockFetch).toHaveBeenCalledTimes(4);
    // 3 (round 1, at the per-turn cap) + 3 (round 2, exhausts the remaining
    // budget) + 0 (round 3, turn budget already spent) = 6 total dispatched.
    expect(mockDispatchTool).toHaveBeenCalledTimes(MAX_TOOL_CALLS_PER_TURN);
    expect(result.ok).toBe(true);

    // Round 3's tool messages (visible in the iteration-4 request body) are
    // ALL rejected as too_many_tool_calls — never executed.
    const finalBody = JSON.parse((mockFetch.mock.calls[3][1] as RequestInit).body as string);
    const toolMessages = finalBody.messages.filter((m: { role: string }) => m.role === 'tool');
    expect(toolMessages).toHaveLength(round1Calls.length + round2Calls.length + round3Calls.length);
    const round3ToolMessages = toolMessages.slice(-round3Calls.length);
    for (const m of round3ToolMessages) {
      expect(JSON.parse(m.content)).toEqual({ ok: false, code: 'too_many_tool_calls' });
    }
  });
});

describe('CAM-416 — turn wall-clock deadline (error/validation, Date.now() spied)', () => {
  it('[error/validation] zero-content deadline: the deadline breaches before iteration 2 and the last completion carried no content → handled GENERIC_ERROR, no further call', async () => {
    const nowSpy = vi
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1_000) // turn start
      .mockReturnValueOnce(1_000 + 46_000); // iteration-2 deadline check — breached (TURN_DEADLINE_MS = 40s)

    const mockFetch = vi.fn().mockResolvedValueOnce(res(assistantMessage(null, [toolCall('call_1')])));
    vi.stubGlobal('fetch', mockFetch);
    mockDispatchTool.mockResolvedValueOnce({ ok: true, data: {} });

    const result = await runAssistantTurn('question');

    expect(mockFetch).toHaveBeenCalledOnce(); // only iteration 1 — no call attempted past the deadline
    expect(result).toEqual({ ok: false, error: GENERIC_ERROR });
    nowSpy.mockRestore();
  });

  it('[error/validation] content-bearing deadline: iteration 1 already carried prose alongside its tool_calls → that content becomes the final answer, no further call', async () => {
    const nowSpy = vi
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1_000) // turn start
      .mockReturnValueOnce(1_000 + 46_000); // iteration-2 deadline check — breached

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage('เท่าที่เจอตอนนี้ครับ', [toolCall('call_1')])));
    vi.stubGlobal('fetch', mockFetch);
    mockDispatchTool.mockResolvedValueOnce({ ok: true, data: { cards: [{ id: 'partial' }] } });

    const result = await runAssistantTurn('question');

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockDispatchTool).toHaveBeenCalledOnce(); // iteration 1's round still executes before the NEXT call is skipped
    // CAM-430: iteration 1 dispatched a 'searchCampsites' call -> searchAttempted:true.
    expect(result).toEqual({
      ok: true,
      answer: 'เท่าที่เจอตอนนี้ครับ',
      cards: [{ id: 'partial' }],
      searchAttempted: true,
    });
    nowSpy.mockRestore();
  });
});

describe('CAM-416 — model fallback pins whichever model answered first (normal)', () => {
  it('[normal] iteration 1 falls back once (primary fails); iteration 2 calls the SAME fallback model directly — no repeat primary attempt', async () => {
    process.env.OPENROUTER_MODEL = 'primary/model';
    process.env.OPENROUTER_MODEL_FALLBACK = 'fallback/model';

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res({}, false, 500)) // primary fails
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('call_1')]))) // fallback succeeds, requests a tool
      .mockResolvedValueOnce(res(assistantMessage('ตอบจากโมเดลสำรองครับ'))); // iteration 2, same pinned model
    vi.stubGlobal('fetch', mockFetch);
    mockDispatchTool.mockResolvedValueOnce({ ok: true, data: {} });

    const result = await runAssistantTurn('question');

    // 3 calls total: primary (fail) + fallback (iteration 1) + iteration 2 —
    // NEVER a 4th call re-attempting primary at iteration 2.
    expect(mockFetch).toHaveBeenCalledTimes(3);
    const iteration2Body = JSON.parse((mockFetch.mock.calls[2][1] as RequestInit).body as string);
    expect(iteration2Body.model).toBe('fallback/model');
    // CAM-430: iteration 1 dispatched a 'searchCampsites' call -> searchAttempted:true.
    expect(result).toEqual({ ok: true, answer: 'ตอบจากโมเดลสำรองครับ', cards: [], searchAttempted: true });
  });
});
