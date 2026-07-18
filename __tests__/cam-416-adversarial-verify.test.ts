/**
 * CAM-416 — independent adversarial QA verify (fresh-context) of the
 * TERMINATION + SPEND invariants in `lib/ai/openrouter-client.ts`'s bounded
 * agent loop (ADR-013 D4). This file does NOT re-test what
 * `__tests__/cam-416-agent-loop.test.ts` already covers cleanly — it attacks
 * the invariants from angles that suite leaves open:
 *
 *  (a) the iteration cap holds even under HOSTILE model behavior: malformed
 *      tool_calls (schema-invalid shape) and a combined per-round + per-turn
 *      + iteration-cap "torture" scenario (max tool_calls every round, all
 *      the way to the forced-final iteration) — the loop must still never
 *      exceed MAX_AGENT_ITERATIONS fetch calls and never exceed
 *      MAX_TOOL_CALLS_PER_TURN dispatch calls, simultaneously.
 *  (b) forced-final with a NULL-content response (the model returns nothing
 *      but tool_calls on iteration 4) still terminates cleanly with an empty
 *      (not crashed) answer.
 *  (c) the per-turn cap's EXACT boundary: 3+3 spends the whole turn budget;
 *      a 3rd round requesting exactly ONE more call (the "7th") is rejected
 *      in full — proves the boundary is `>=`, not an off-by-one `>`.
 *  (d) the wall-clock deadline is not special-cased to "before iteration 2"
 *      — a breach detected before iteration 3 (after TWO prior tool rounds)
 *      is caught the same way: no 3rd network call, last content wins.
 *  (e) fallback pinning holds across MORE than one subsequent call — every
 *      iteration after the first uses the fallback model, never the primary
 *      again, across a 3-iteration turn.
 *  (f) suggestions are extracted ONLY from the FINAL completion — a mid-loop
 *      completion smuggling its own `<suggestions>` block (alongside
 *      tool_calls) must never leak into the turn's returned suggestions.
 *  (g) single final-assembly point (source inspection) — exactly one
 *      function (`finalizeAnswer`) ever calls `extractSuggestions`, and
 *      exactly two call sites (the two loop-exit branches) ever call
 *      `finalizeAnswer` — the structural precondition for a future
 *      single-flush-point streaming hook (D7) to slot in without a rewrite.
 *
 * All tests mock `fetch` (vi.stubGlobal) — zero real spend, no real
 * OpenRouter call is ever made, mirroring the sibling suite's convention.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
  MAX_TOOL_CALLS_PER_TURN,
  TURN_DEADLINE_MS,
} = await import('@/lib/ai/openrouter-client');

const FAKE_KEY = 'sk-or-test-cam416-adversarial';

function res(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

function assistantMessage(content: string | null, toolCalls?: unknown[]) {
  return { choices: [{ message: { role: 'assistant', content, tool_calls: toolCalls } }] };
}

function toolCall(id: string, name = 'searchCampsites') {
  return { id, type: 'function', function: { name, arguments: '{}' } };
}

function bodyOf(mockFetch: ReturnType<typeof vi.fn>, callIndex: number): Record<string, unknown> {
  return JSON.parse((mockFetch.mock.calls[callIndex][1] as RequestInit).body as string);
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

/* -------------------------------------------------------------------------- */
/* (a) iteration cap holds under hostile model behavior                       */
/* -------------------------------------------------------------------------- */

describe('CAM-416 adversarial (a) — iteration cap under hostile behavior', () => {
  it('[error/validation] schema-invalid tool_calls shape on BOTH primary and fallback (the turn\'s first completion) — exactly the one allowed fallback retry, then a handled stop, never a 3rd call', async () => {
    const malformed = res({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'x' }] } }] });
    const mockFetch = vi.fn().mockResolvedValueOnce(malformed).mockResolvedValueOnce(malformed);
    vi.stubGlobal('fetch', mockFetch);

    const result = await runAssistantTurn('question');

    // A schema-invalid response is treated as a call failure -> the SAME
    // one-shot fallback dance as a network failure (AC-6/BR-5), never a
    // bespoke retry loop of its own.
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockDispatchTool).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: GENERIC_ERROR }); // never a raw parse exception surfaced
  });

  it('[error/validation] well-formed round 1, schema-invalid round 2 — loop stops AT iteration 2, never attempts iteration 3/4', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('call_1')]))) // iteration 1: valid
      .mockResolvedValueOnce(
        res({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'bad', type: 'function' }] } }] })
      ); // iteration 2: missing function.{name,arguments} -> schema-invalid
    vi.stubGlobal('fetch', mockFetch);
    mockDispatchTool.mockResolvedValueOnce({ ok: true, data: {} });

    const result = await runAssistantTurn('question');

    expect(mockFetch).toHaveBeenCalledTimes(2); // never a 3rd or 4th call
    expect(mockDispatchTool).toHaveBeenCalledOnce(); // round 1 still executed before the failure
    expect(result).toEqual({ ok: false, error: GENERIC_ERROR });
  });

  it('[boundary/security] torture case — max tool_calls (3) requested EVERY round through the iteration cap: fetch never exceeds 4, dispatch never exceeds 6, forced-final ignores its own tool_calls', async () => {
    const round = (prefix: string) => [toolCall(`${prefix}_1`), toolCall(`${prefix}_2`), toolCall(`${prefix}_3`)];
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage(null, round('r1'))))
      .mockResolvedValueOnce(res(assistantMessage(null, round('r2'))))
      .mockResolvedValueOnce(res(assistantMessage(null, round('r3')))) // turn budget already spent — all 3 rejected
      .mockResolvedValueOnce(res(assistantMessage('ตอบสุดท้ายจริงๆครับ', round('r4')))); // forced final, still (hostilely) requests tools
    vi.stubGlobal('fetch', mockFetch);
    mockDispatchTool.mockResolvedValue({ ok: true, data: {} });

    const result = await runAssistantTurn('question designed to maximize spend on every axis at once');

    expect(mockFetch).toHaveBeenCalledTimes(MAX_AGENT_ITERATIONS); // hard ceiling holds
    expect(mockDispatchTool).toHaveBeenCalledTimes(MAX_TOOL_CALLS_PER_TURN); // 3+3+0+0(ignored) = 6
    expect(result).toEqual({ ok: true, answer: 'ตอบสุดท้ายจริงๆครับ', cards: [] });

    const forcedFinalBody = bodyOf(mockFetch, MAX_AGENT_ITERATIONS - 1);
    expect(forcedFinalBody.tool_choice).toBe('none');
  });
});

/* -------------------------------------------------------------------------- */
/* (b) forced-final with null content                                        */
/* -------------------------------------------------------------------------- */

describe('CAM-416 adversarial (b) — forced-final null-content edge', () => {
  it('[boundary] iteration 4 returns content:null alongside tool_calls — turn still terminates cleanly with an empty (not crashed) answer', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('c1')])))
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('c2')])))
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('c3')])))
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('c4')]))); // forced final, content is null
    vi.stubGlobal('fetch', mockFetch);
    mockDispatchTool.mockResolvedValue({ ok: true, data: {} });

    const result = await runAssistantTurn('question');

    expect(mockFetch).toHaveBeenCalledTimes(MAX_AGENT_ITERATIONS);
    expect(mockDispatchTool).toHaveBeenCalledTimes(3); // c4 never dispatched
    expect(result).toEqual({ ok: true, answer: '', cards: [] }); // no throw, no undefined leak
  });
});

/* -------------------------------------------------------------------------- */
/* (c) per-turn cap EXACT boundary                                            */
/* -------------------------------------------------------------------------- */

describe('CAM-416 adversarial (c) — per-turn cap exact boundary (3+3 then a 7th)', () => {
  it('[boundary] round 1 executes 3, round 2 executes 3 (budget fully spent), round 3 requests exactly ONE more call — it is fully rejected, never dispatched', async () => {
    const round1 = [toolCall('r1_a'), toolCall('r1_b'), toolCall('r1_c')];
    const round2 = [toolCall('r2_a'), toolCall('r2_b'), toolCall('r2_c')];
    const round3 = [toolCall('r3_seventh')]; // the exact 7th requested call
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage(null, round1)))
      .mockResolvedValueOnce(res(assistantMessage(null, round2)))
      .mockResolvedValueOnce(res(assistantMessage(null, round3)))
      .mockResolvedValueOnce(res(assistantMessage('จบครับ'))); // iteration 4, forced final, natural no-tool content
    vi.stubGlobal('fetch', mockFetch);
    mockDispatchTool.mockResolvedValue({ ok: true, data: {} });

    const result = await runAssistantTurn('question requesting exactly one call past the turn budget');

    expect(mockDispatchTool).toHaveBeenCalledTimes(6); // never 7
    expect(result.ok).toBe(true);

    const finalBody = bodyOf(mockFetch, 3);
    const toolMessages = (finalBody.messages as Array<{ role: string; tool_call_id?: string; content: string }>).filter(
      (m) => m.role === 'tool'
    );
    const seventh = toolMessages.find((m) => m.tool_call_id === 'r3_seventh');
    expect(seventh).toBeDefined();
    expect(JSON.parse(seventh!.content)).toEqual({ ok: false, code: 'too_many_tool_calls' });
  });
});

/* -------------------------------------------------------------------------- */
/* (d) deadline not special-cased to iteration 2                              */
/* -------------------------------------------------------------------------- */

describe('CAM-416 adversarial (d) — deadline breach generalizes past iteration 2', () => {
  it('[error/validation] two successful tool rounds run; the breach is detected before iteration 3 — no 3rd network call, the 2nd round content wins', async () => {
    const nowSpy = vi
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1_000) // turn start
      .mockReturnValueOnce(1_000 + 10_000) // iteration-2 check: NOT breached (10s elapsed)
      .mockReturnValueOnce(1_000 + 46_000); // iteration-3 check: breached

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('call_1')])))
      .mockResolvedValueOnce(res(assistantMessage('เนื้อหาระหว่างทางครับ', [toolCall('call_2')])));
    vi.stubGlobal('fetch', mockFetch);
    mockDispatchTool
      .mockResolvedValueOnce({ ok: true, data: { cards: [{ id: 'a' }] } })
      .mockResolvedValueOnce({ ok: true, data: { cards: [{ id: 'b' }] } });

    const result = await runAssistantTurn('question');

    expect(mockFetch).toHaveBeenCalledTimes(2); // never a 3rd call — the breach is caught before it
    expect(mockDispatchTool).toHaveBeenCalledTimes(2); // both prior rounds still executed
    expect(result).toEqual({ ok: true, answer: 'เนื้อหาระหว่างทางครับ', cards: [{ id: 'a' }, { id: 'b' }] });
    nowSpy.mockRestore();
  });
});

/* -------------------------------------------------------------------------- */
/* (e) fallback pin holds across MORE than one subsequent call                */
/* -------------------------------------------------------------------------- */

describe('CAM-416 adversarial (e) — fallback pin holds across every subsequent call in a 3-iteration turn', () => {
  it('[normal] primary fails once; ALL of iterations 2 and 3 call the pinned fallback model directly — primary is never attempted again', async () => {
    process.env.OPENROUTER_MODEL = 'primary/model';
    process.env.OPENROUTER_MODEL_FALLBACK = 'fallback/model';

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res({}, false, 500)) // primary fails (iteration 1 attempt 1)
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('call_1')]))) // fallback succeeds (iteration 1 attempt 2)
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('call_2')]))) // iteration 2, pinned
      .mockResolvedValueOnce(res(assistantMessage('ตอบจากโมเดลสำรองครับ'))); // iteration 3, pinned, natural stop
    vi.stubGlobal('fetch', mockFetch);
    mockDispatchTool.mockResolvedValue({ ok: true, data: {} });

    const result = await runAssistantTurn('question');

    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(bodyOf(mockFetch, 0).model).toBe('primary/model'); // the ONLY primary attempt, ever
    expect(bodyOf(mockFetch, 1).model).toBe('fallback/model');
    expect(bodyOf(mockFetch, 2).model).toBe('fallback/model'); // "ALL subsequent calls" — iteration 2
    expect(bodyOf(mockFetch, 3).model).toBe('fallback/model'); // "ALL subsequent calls" — iteration 3
    expect(result).toEqual({ ok: true, answer: 'ตอบจากโมเดลสำรองครับ', cards: [] });
  });
});

/* -------------------------------------------------------------------------- */
/* (f) suggestions extracted ONLY from the final completion                   */
/* -------------------------------------------------------------------------- */

describe('CAM-416 adversarial (f) — suggestions never leak from a mid-loop completion', () => {
  it('[security] a mid-loop completion smuggling its own <suggestions> block (alongside tool_calls) is discarded — only the FINAL completion\'s suggestions/answer survive', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        res(
          assistantMessage(
            'บางส่วนระหว่างทาง <suggestions>["คำถามลวงระหว่างทาง"]</suggestions>',
            [toolCall('call_1')]
          )
        )
      )
      .mockResolvedValueOnce(
        res(assistantMessage('คำตอบจริงครับ <suggestions>["คำถามจริงที่ควรถาม"]</suggestions>'))
      );
    vi.stubGlobal('fetch', mockFetch);
    mockDispatchTool.mockResolvedValueOnce({ ok: true, data: {} });

    const result = await runAssistantTurn('question');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    expect(result.answer).toBe('คำตอบจริงครับ');
    expect(result.suggestions).toEqual(['คำถามจริงที่ควรถาม']);
    // The mid-loop smuggled suggestion/markup must never survive into the answer or the returned suggestions.
    expect(result.answer).not.toContain('ลวง');
    expect(result.suggestions).not.toContain('คำถามลวงระหว่างทาง');
    expect(JSON.stringify(result)).not.toContain('<suggestions>');
  });
});

/* -------------------------------------------------------------------------- */
/* (g) single final-assembly point (source inspection)                        */
/* -------------------------------------------------------------------------- */

describe('CAM-416 — AC-7/BR-7 route config (maxDuration=60, headroom above the 45s turn deadline)', () => {
  it('[unit] app/api/ai/chat/route.ts exports maxDuration = 60 — route config only, no request/response contract change', async () => {
    const route = await import('@/app/api/ai/chat/route');
    expect(route.maxDuration).toBe(60);
    expect(route.maxDuration).toBeGreaterThan(TURN_DEADLINE_MS / 1000); // headroom above the 45s turn deadline
  });
});

describe('CAM-416 adversarial (g) — single final-assembly point (D7 streaming seam precondition)', () => {
  it('[architecture] extractSuggestions is defined once and called from exactly ONE place (finalizeAnswer); finalizeAnswer itself is called from exactly the two loop-exit branches', () => {
    const source = readFileSync(join(process.cwd(), 'lib/ai/openrouter-client.ts'), 'utf-8');

    const extractSuggestionsDefs = source.match(/function extractSuggestions\(/g) ?? [];
    const extractSuggestionsCalls = source.match(/\bextractSuggestions\(/g) ?? [];
    expect(extractSuggestionsDefs).toHaveLength(1);
    // Exactly 1 definition + 1 call site (inside finalizeAnswer) = 2 total occurrences of the identifier-with-paren.
    expect(extractSuggestionsCalls).toHaveLength(2);

    const finalizeAnswerDefs = source.match(/function finalizeAnswer\(/g) ?? [];
    const finalizeAnswerCalls = source.match(/\bfinalizeAnswer\(lastRawContent/g) ?? [];
    expect(finalizeAnswerDefs).toHaveLength(1);
    // Exactly 2 call sites: the deadline-breach-with-content branch, and the natural/forced loop-stop branch.
    expect(finalizeAnswerCalls).toHaveLength(2);
  });
});
