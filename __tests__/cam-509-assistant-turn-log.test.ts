/**
 * cam-509-assistant-turn-log.test.ts — CAM-509 (S2/SEE pillar): AssistantTurnLog
 * capture at the two turn-completion seams in lib/ai/openrouter-client.ts
 * (`runAssistantTurnFromMessages` covering guest_nonstream + authed, BR-5;
 * `runAssistantTurnFromMessagesStreaming` covering guest_sse) + the pure
 * helpers in lib/ai/turn-log.ts.
 *
 * All tests MOCK fetch (mirrors __tests__/cam-270-openrouter-client.test.ts)
 * and `dispatchTool` (mirrors cam-416's pattern) — zero real spend, no real
 * tool execution. `@/lib/prisma` is FULLY mocked so no real DB write ever
 * happens from this file; `logAssistantTurn`'s fire-and-forget write is never
 * awaited by its caller, so every test that asserts on the mocked
 * `assistantTurnLog.create` call uses `vi.waitFor` (the write lands on a
 * later microtask, via the `after()`-unavailable-outside-a-request-scope
 * fallback — this vitest environment has no real Next.js request context,
 * so `logAssistantTurn` always takes that fallback path here).
 *
 * Coverage matrix:
 *   - unit: hashUserId — stable per input, never equal to the raw id
 *   - unit: computeMissFlags — zero_result / deferred_tool / no_tool truth
 *     table, including EC-4 (empty/whitespace userText never sets no_tool)
 *   - unit: deleteTurnLogsOlderThan — deleteMany where.createdAt.lt ~90 days
 *     ago (BR-4 retention), returns the deleted count
 *   - normal (AC-1/AC-3, BR-5): runAssistantTurnFromMessages writes exactly
 *     one row per turn with path="guest_nonstream" (ctx.userId absent) and
 *     path="authed" (ctx.userId present) — userIdHash null vs hashUserId(id)
 *   - normal (AC-2): runAssistantTurnFromMessagesStreaming writes one row
 *     with path="guest_sse"
 *   - error/validation (AC-4): a forced log-write throw is swallowed — the
 *     turn's own answer is still returned unaffected
 *   - normal (AC-5): a search tool call returning 0 cards sets missFlags
 *     to include "zero_result"
 *   - normal (AC-6): a tool the dispatcher reports as unknown sets missFlags
 *     to include "deferred_tool"
 *   - security/PDPA: the persisted `toolCalls` JSON is exactly {tool,params}
 *     per entry — no transient bookkeeping field (e.g. unknownTool) leaks in
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

const mockCreate = vi.fn();
const mockDeleteMany = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: {
    assistantTurnLog: {
      create: (...args: unknown[]) => mockCreate(...args),
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
  },
}));

const { runAssistantTurnFromMessages, runAssistantTurnFromMessagesStreaming } = await import('@/lib/ai/openrouter-client');
const { hashUserId, computeMissFlags, deleteTurnLogsOlderThan } = await import('@/lib/ai/turn-log');

const FAKE_KEY = 'sk-or-test-cam509-turn-log';
const USER_ID = '550e8400-e29b-41d4-a716-446655440099';

function res(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

function assistantMessage(content: string | null, toolCalls?: unknown[]) {
  return { choices: [{ message: { role: 'assistant', content, tool_calls: toolCalls } }] };
}

function toolCall(id: string, name: string, args = '{}') {
  return { id, type: 'function', function: { name, arguments: args } };
}

/** SSE helpers (mirrors __tests__/cam-412-openrouter-streaming.test.ts). */
function sseResponse(rawFragments: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frag of rawFragments) controller.enqueue(encoder.encode(frag));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}
function dataLine(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}
function contentChunk(text: string) {
  return { choices: [{ delta: { content: text }, finish_reason: null }] };
}
async function drain(gen: AsyncGenerator<{ type: string; [k: string]: unknown }>) {
  const events: Array<{ type: string; [k: string]: unknown }> = [];
  for await (const ev of gen) events.push(ev);
  return events;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENROUTER_API_KEY = FAKE_KEY;
  process.env.AI_TURN_LOG_SALT = 'cam509-test-salt';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_MODEL;
  delete process.env.OPENROUTER_MODEL_FALLBACK;
  delete process.env.AI_TURN_LOG_SALT;
});

/* -------------------------------------------------------------------------- */
/* Unit — lib/ai/turn-log.ts pure helpers                                     */
/* -------------------------------------------------------------------------- */

describe('hashUserId (BR-4/EC-2)', () => {
  it('[unit] the same userId hashes to the same value, deterministically', () => {
    expect(hashUserId(USER_ID)).toBe(hashUserId(USER_ID));
  });

  it('[unit] different userIds hash to different values', () => {
    expect(hashUserId(USER_ID)).not.toBe(hashUserId('a-different-user-id'));
  });

  it('[security/PDPA] the hash is never equal to the raw id and never contains it as a substring', () => {
    const hash = hashUserId(USER_ID);
    expect(hash).not.toBe(USER_ID);
    expect(hash).not.toContain(USER_ID);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('computeMissFlags (BR-3) — deterministic truth table', () => {
  it('[normal] a clean turn (search with results, a tool ran) sets no flags', () => {
    expect(
      computeMissFlags({ searchAttempted: true, cardCount: 3, toolCallCount: 1, deferredTool: false, userText: 'หาแคมป์ริมทะเล' })
    ).toEqual([]);
  });

  it('[normal] zero_result — a search ran and returned 0 cards', () => {
    const flags = computeMissFlags({ searchAttempted: true, cardCount: 0, toolCallCount: 1, deferredTool: false, userText: 'หาแคมป์' });
    expect(flags).toContain('zero_result');
  });

  it('[normal] no zero_result when no search ran, even with 0 cards', () => {
    const flags = computeMissFlags({ searchAttempted: false, cardCount: 0, toolCallCount: 0, deferredTool: false, userText: '' });
    expect(flags).not.toContain('zero_result');
  });

  it('[normal] deferred_tool — the model requested an unknown/unbuilt tool', () => {
    const flags = computeMissFlags({ searchAttempted: false, cardCount: 0, toolCallCount: 1, deferredTool: true, userText: 'ทำอะไรสักอย่าง' });
    expect(flags).toContain('deferred_tool');
  });

  it('[normal] no_tool — zero tool calls on a non-trivial userText', () => {
    const flags = computeMissFlags({ searchAttempted: false, cardCount: 0, toolCallCount: 0, deferredTool: false, userText: 'สวัสดีครับ' });
    expect(flags).toContain('no_tool');
  });

  it('[edge/EC-4] an empty userText never sets no_tool, even with zero tool calls', () => {
    const flags = computeMissFlags({ searchAttempted: false, cardCount: 0, toolCallCount: 0, deferredTool: false, userText: '' });
    expect(flags).not.toContain('no_tool');
  });

  it('[edge/EC-4] a whitespace-only userText never sets no_tool', () => {
    const flags = computeMissFlags({ searchAttempted: false, cardCount: 0, toolCallCount: 0, deferredTool: false, userText: '   \n\t  ' });
    expect(flags).not.toContain('no_tool');
  });
});

describe('deleteTurnLogsOlderThan (BR-4 retention)', () => {
  it('[normal] deletes rows older than the given day count (default 90) and returns the count', async () => {
    mockDeleteMany.mockResolvedValueOnce({ count: 7 });
    const before = Date.now();

    const deleted = await deleteTurnLogsOlderThan();

    expect(deleted).toBe(7);
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    const arg = mockDeleteMany.mock.calls[0][0] as { where: { createdAt: { lt: Date } } };
    const cutoffMs = arg.where.createdAt.lt.getTime();
    const expectedCutoffMs = before - 90 * 24 * 60 * 60 * 1000;
    // Allow a small margin for real wall-clock time elapsed during the test.
    expect(Math.abs(cutoffMs - expectedCutoffMs)).toBeLessThan(5000);
  });

  it('[boundary] a custom day count is honored', async () => {
    mockDeleteMany.mockResolvedValueOnce({ count: 0 });
    await deleteTurnLogsOlderThan(30);
    const arg = mockDeleteMany.mock.calls[0][0] as { where: { createdAt: { lt: Date } } };
    const daysAgo = (Date.now() - arg.where.createdAt.lt.getTime()) / (24 * 60 * 60 * 1000);
    expect(daysAgo).toBeGreaterThan(29);
    expect(daysAgo).toBeLessThan(31);
  });
});

/* -------------------------------------------------------------------------- */
/* AC-1/AC-3, BR-5 — runAssistantTurnFromMessages path + userIdHash            */
/* -------------------------------------------------------------------------- */

describe('runAssistantTurnFromMessages — AssistantTurnLog capture (AC-1/AC-3/BR-5)', () => {
  it('[normal] a guest turn (ctx.userId absent) writes exactly one row: path="guest_nonstream", userIdHash=null, clean userText (no <user_message> fence)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('สวัสดีครับ มีอะไรให้ช่วยไหมครับ')));
    vi.stubGlobal('fetch', mockFetch);

    const result = await runAssistantTurnFromMessages([{ role: 'user', content: 'สวัสดี' }]);
    expect(result).toEqual({ ok: true, answer: 'สวัสดีครับ มีอะไรให้ช่วยไหมครับ', cards: [] });

    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.path).toBe('guest_nonstream');
    expect(data.userIdHash).toBeNull();
    expect(data.userText).toBe('สวัสดี');
    expect(data.assistantText).toBe('สวัสดีครับ มีอะไรให้ช่วยไหมครับ');
    expect(data.toolCalls).toEqual([]);
    expect(typeof data.model).toBe('string');
    expect(data.model.length).toBeGreaterThan(0);
    expect(typeof data.roundCount).toBe('number');
    expect(data.roundCount).toBeGreaterThanOrEqual(1);
    expect(typeof data.latencyMs).toBe('number');
  });

  it('[normal] an authed turn (ctx.userId present) writes path="authed" with a HASHED userIdHash, never the raw id', async () => {
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ตกลงครับ')));
    vi.stubGlobal('fetch', mockFetch);

    const result = await runAssistantTurnFromMessages([{ role: 'user', content: 'จองได้ไหม' }], { userId: USER_ID });
    expect(result.ok).toBe(true);

    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.path).toBe('authed');
    expect(data.userIdHash).toBe(hashUserId(USER_ID));
    expect(data.userIdHash).not.toBe(USER_ID);
  });

  it('[null/empty] a self-skipped turn (no OPENROUTER_API_KEY) writes NO row', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const result = await runAssistantTurnFromMessages([{ role: 'user', content: 'hi' }]);
    expect(result).toEqual({ ok: true, skipped: true });

    // Give any stray microtask a chance to run, then assert nothing fired.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* AC-2 — runAssistantTurnFromMessagesStreaming path                          */
/* -------------------------------------------------------------------------- */

describe('runAssistantTurnFromMessagesStreaming — AssistantTurnLog capture (AC-2)', () => {
  it('[normal] a streamed guest turn writes exactly one row: path="guest_sse"', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      sseResponse([dataLine(contentChunk('พบแคมป์ 2 แห่งครับ')), 'data: [DONE]\n\n'])
    );
    vi.stubGlobal('fetch', mockFetch);

    const events = await drain(runAssistantTurnFromMessagesStreaming([{ role: 'user', content: 'หาแคมป์' }]));
    expect(events.some((e) => e.type === 'meta')).toBe(true);

    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.path).toBe('guest_sse');
    expect(data.userIdHash).toBeNull();
    expect(data.userText).toBe('หาแคมป์');
    expect(data.assistantText).toBe('พบแคมป์ 2 แห่งครับ');
  });
});

/* -------------------------------------------------------------------------- */
/* AC-4 — a forced log-write throw does not break the chat                    */
/* -------------------------------------------------------------------------- */

describe('AC-4/EC-3 — a forced AssistantTurnLog write failure never breaks the chat response', () => {
  it('[error/validation] runAssistantTurnFromMessages still returns the normal answer when the DB insert throws', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreate.mockRejectedValueOnce(new Error('connection refused'));
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('คำตอบปกติครับ')));
    vi.stubGlobal('fetch', mockFetch);

    const result = await runAssistantTurnFromMessages([{ role: 'user', content: 'ทดสอบ' }]);

    // The camper's answer is byte-identical to the success path — the write
    // failure is never surfaced into the response (AC-4).
    expect(result).toEqual({ ok: true, answer: 'คำตอบปกติครับ', cards: [] });

    // The write was genuinely attempted (and threw) — proves the failure
    // path was actually exercised, not merely skipped.
    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('ai_turn_log_write_failed'))
    );

    consoleErrorSpy.mockRestore();
  });

  it('[error/validation] a rejected write never produces an unhandled promise rejection (no secret/PII in the swallowed log line)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreate.mockRejectedValueOnce(new Error('super-secret-connection-string-should-never-leak'));
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ok')));
    vi.stubGlobal('fetch', mockFetch);

    await runAssistantTurnFromMessages([{ role: 'user', content: 'ทดสอบ' }], { userId: USER_ID });

    await vi.waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    const loggedLine = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(loggedLine).not.toContain('super-secret-connection-string-should-never-leak');
    expect(loggedLine).not.toContain(USER_ID);

    consoleErrorSpy.mockRestore();
  });
});

/* -------------------------------------------------------------------------- */
/* AC-5 — zero_result miss flag                                               */
/* -------------------------------------------------------------------------- */

describe('AC-5 — zero_result miss flag (a search tool ran, 0 cards back)', () => {
  it('[normal] a searchCampsites call that returns 0 cards sets missFlags to include "zero_result"', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('call_1', 'searchCampsites')])))
      .mockResolvedValueOnce(res(assistantMessage('ไม่พบแคมป์ที่ตรงเลยครับ')));
    vi.stubGlobal('fetch', mockFetch);
    mockDispatchTool.mockResolvedValueOnce({ ok: true, data: { cards: [] } });

    const result = await runAssistantTurnFromMessages([{ role: 'user', content: 'หาแคมป์ริมทะเลเชียงใหม่' }]);
    expect(result.ok).toBe(true);
    expect(result.searchAttempted).toBe(true);
    expect(result.cards).toEqual([]);

    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.missFlags).toContain('zero_result');
    expect(data.missFlags).not.toContain('no_tool'); // a tool DID run this turn
    expect(data.toolCalls).toEqual([{ tool: 'searchCampsites', params: {} }]);
  });
});

/* -------------------------------------------------------------------------- */
/* AC-6 — deferred_tool miss flag                                             */
/* -------------------------------------------------------------------------- */

describe('AC-6 — deferred_tool miss flag (the model requested a tool that does not exist)', () => {
  it('[normal] dispatchTool reporting unknown_tool sets missFlags to include "deferred_tool"', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('call_1', 'bookCampsiteNow')])))
      .mockResolvedValueOnce(res(assistantMessage('ขอโทษครับ ยังจองผ่านแชทไม่ได้')));
    vi.stubGlobal('fetch', mockFetch);
    mockDispatchTool.mockResolvedValueOnce({ ok: false, code: 'unknown_tool', message: 'Unknown tool: bookCampsiteNow' });

    const result = await runAssistantTurnFromMessages([{ role: 'user', content: 'จองให้เลยได้ไหม' }]);
    expect(result.ok).toBe(true);

    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.missFlags).toContain('deferred_tool');
    // Security/PDPA — the persisted toolCalls entry is exactly {tool,params};
    // the transient `unknownTool` bookkeeping field never leaks into storage.
    expect(data.toolCalls).toEqual([{ tool: 'bookCampsiteNow', params: {} }]);
    expect(Object.keys(data.toolCalls[0]).sort()).toEqual(['params', 'tool']);
  });
});
