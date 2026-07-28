/**
 * CAM-596 — the MANDATORY district hint block (`buildPlaceHintBlock` in
 * openrouter-client.ts), verified through the real system prompt the model
 * receives (same mocked-fetch pattern `cam-504-geo2.test.ts` already uses
 * for its own province/near hint wording) — proves the SECOND of the two
 * independent root causes this story fixes (the first is the tool's
 * headline description, asserted separately in
 * cam-596-tool-description.test.ts).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { runAssistantTurn } = await import('@/lib/ai/openrouter-client');

const FAKE_KEY = 'sk-or-test-cam-596';

function res(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function assistantMessage(content: string | null) {
  return { choices: [{ message: { role: 'assistant', content } }] };
}

async function getSystemPrompt(userText: string): Promise<string> {
  const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ok')));
  vi.stubGlobal('fetch', mockFetch);
  await runAssistantTurn(userText, {});
  const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(init.body as string);
  return body.messages.find((m: { role: string }) => m.role === 'system').content as string;
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = FAKE_KEY;
});

describe('CAM-596 mandatory district-hint wording', () => {
  it('[AC-1, normal] "ลานกางเต็นท์แม่ริม" -> the prompt MUST set district="แม่ริม"', async () => {
    const content = await getSystemPrompt('ลานกางเต็นท์แม่ริม');
    expect(content).toContain('MUST set');
    expect(content).toContain('district="แม่ริม"');
    expect(content).not.toContain('MUST set province=');
  });

  it('[AC-4, normal] a province AND a district named together -> the prompt MUST set BOTH, district for the filter and province for scoping', async () => {
    const content = await getSystemPrompt('เชียงใหม่ แม่ริม ลานกางเต็นท์');
    expect(content).toContain('district="แม่ริม"');
    expect(content).toContain('Also set province="Chiang Mai" alongside it');
  });

  it('[AC-3, regression] a bare province mention (no real district) keeps the pre-CAM-596 province wording, no district text at all', async () => {
    const content = await getSystemPrompt('ลานกางเต็นท์เชียงใหม่');
    expect(content).toContain('MUST set province="Chiang Mai"');
    expect(content).not.toContain('district=');
  });

  it('[regression] a turn with no place at all keeps the byte-identical no-hint prompt (no MUST-set place sentence)', async () => {
    const content = await getSystemPrompt('สวัสดีครับ');
    expect(content).not.toContain('MUST set district=');
    expect(content).not.toContain('MUST set province=');
    expect(content).not.toContain('MUST set near=');
    expect(content).not.toContain('MUST set region=');
  });
});
