/**
 * CAM-462 (BR-6) — the system prompt no longer instructs the model to
 * "compute the absolute ISO date(s)" itself (CAM-408); it now tells the
 * model to call the new `resolveDates` tool for any relative/holiday Thai
 * date phrase and to ask the camper on `ok:false` rather than guess.
 *
 * Prompt-assertion test only (mirrors the CAM-405/CAM-411/CAM-437/CAM-459
 * precedent — fetch is mocked, zero real spend, no live model call); the
 * behavior contract (the model actually calling resolveDates) is proven by
 * the deterministic resolveDatesCore/resolveDatesTool unit tests
 * (cam-462-resolve-dates.test.ts), not re-tested here.
 *
 * Coverage: normal (the new instruction is present) + regression (the old
 * CAM-408 "compute the absolute ISO" instruction is gone, BR-6).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { runAssistantTurn } = await import('@/lib/ai/openrouter-client');

const FAKE_KEY = 'sk-or-test-cam-462';

function res(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function assistantMessage(content: string | null) {
  return { choices: [{ message: { role: 'assistant', content } }] };
}

async function getSystemPrompt(): Promise<string> {
  const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ok')));
  vi.stubGlobal('fetch', mockFetch);
  await runAssistantTurn('พรุ่งนี้มีที่ว่างไหม', {});
  const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(init.body as string);
  return body.messages.find((m: { role: string }) => m.role === 'system').content as string;
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = FAKE_KEY;
});

describe('buildSystemPrompt — BR-6 date instruction swap', () => {
  it('[unit] instructs the model to call resolveDates for a relative/holiday Thai date phrase', async () => {
    const content = await getSystemPrompt();
    expect(content).toContain('call resolveDates and use the ranges it returns');
    expect(content).toContain('ask the camper to specify the dates');
  });

  it('[regression] the old CAM-408 "compute the absolute ISO date(s)" instruction is gone', async () => {
    const content = await getSystemPrompt();
    expect(content).not.toContain('compute the absolute ISO date(s)');
  });

  it('[unit] the grounding rule (never state/assume availability without calling checkAvailability) is preserved', async () => {
    const content = await getSystemPrompt();
    expect(content).toContain('Never state or assume availability yourself');
  });
});
