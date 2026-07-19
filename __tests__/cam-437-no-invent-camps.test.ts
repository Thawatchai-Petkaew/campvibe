/**
 * cam-437-no-invent-camps.test.ts — CAM-437 (R2 flag, confirmed on staging):
 * root-cause fix for a system-prompt gap. On a zero-result search, the model
 * had no rule forbidding it from naming a campsite from its own training
 * knowledge, so a hallucinated recommendation could appear ABOVE the correct
 * "not found" empty-state banner (`searchAttempted && cards.length===0`).
 *
 * Source-of-truth is `buildSystemPrompt()` in lib/ai/openrouter-client.ts —
 * this is a prompt-assertion test only (mirrors the CAM-405/CAM-411 system
 * prompt test precedent: fetch is mocked, zero real spend, no live model
 * call). Card mapping (lib/read-models/ai-camp-card.ts) and the banner gate
 * (conversation.ts) are untouched by this story and are NOT re-tested here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

const { runAssistantTurn } = await import('@/lib/ai/openrouter-client');

const FAKE_KEY = 'sk-or-test-cam-437';

function res(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

function assistantMessage(content: string | null) {
  return { choices: [{ message: { role: 'assistant', content } }] };
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = FAKE_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
});

describe('buildSystemPrompt — CAM-437 no-invent-camps grounding rule', () => {
  it('[unit] the system prompt restricts naming/recommending a campsite to THIS turn\'s searchCampsites tool result', async () => {
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ok')));
    vi.stubGlobal('fetch', mockFetch);

    await runAssistantTurn('มีแคมป์ไหมคะ');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system');
    expect(systemMessage.content).toMatch(/only name, describe, or recommend a specific campsite/i);
    expect(systemMessage.content).toMatch(/searchcampsites tool call made this turn/i);
  });

  it('[unit] the system prompt explicitly forbids inventing/recalling a campsite from the model\'s own knowledge', async () => {
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ok')));
    vi.stubGlobal('fetch', mockFetch);

    await runAssistantTurn('มีแคมป์ไหมคะ');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system');
    expect(systemMessage.content).toMatch(/never name, suggest, or recommend a campsite from your own training knowledge or memory/i);
  });

  it('[unit] the system prompt gives an explicit zero-result instruction: say so plainly, invite adjusting filters, never substitute a campsite', async () => {
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ok')));
    vi.stubGlobal('fetch', mockFetch);

    await runAssistantTurn('มีแคมป์ไหมคะ');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system');
    expect(systemMessage.content).toMatch(/if searchcampsites returns zero matching campsites, say plainly that nothing matched/i);
    expect(systemMessage.content).toMatch(/invite the camper to adjust their search/i);
    expect(systemMessage.content).toMatch(/never substitute or invent a campsite/i);
  });

  it('[unit] the pre-existing anti-enumeration line (CAM-405) is unchanged and still appears exactly once (regression guard)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ok')));
    vi.stubGlobal('fetch', mockFetch);

    await runAssistantTurn('มีแคมป์ไหมคะ');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system');
    const antiEnumerationLine =
      'Do not list or enumerate the matching campsites by name or detail in your answer — the camper already sees them as cards below your answer. Only refer to the result in summary form (for example, mention how many were found or a general theme), never a per-place rundown.';
    const occurrences = systemMessage.content.split(antiEnumerationLine).length - 1;
    expect(occurrences).toBe(1);
  });
});
