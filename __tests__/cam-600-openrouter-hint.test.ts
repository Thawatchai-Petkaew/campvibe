/**
 * CAM-600 — the MANDATORY sub-district hint block (`buildPlaceHintBlock` in
 * openrouter-client.ts), verified through the real system prompt the model
 * receives (same mocked-fetch pattern `cam-596-openrouter-hint.test.ts`
 * already uses for its own district hint wording). Proves the pre-pass
 * detection actually reaches the model as a MANDATORY instruction to set
 * BOTH `subDistrict` AND `district` together — the real-model behavioral
 * proof lives in the guardrail golden case (GEO-7-CAM600-SUBDISTRICT).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { runAssistantTurn } = await import('@/lib/ai/openrouter-client');

const FAKE_KEY = 'sk-or-test-cam-600';

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

describe('CAM-600 mandatory sub-district-hint wording', () => {
  it('[normal] "ลานกางเต็นท์แสนสุข" -> the prompt MUST set BOTH subDistrict="แสนสุข" AND district="เมืองชลบุรี"', async () => {
    const content = await getSystemPrompt('ลานกางเต็นท์แสนสุข');
    expect(content).toContain('MUST set');
    expect(content).toContain('subDistrict="แสนสุข"');
    expect(content).toContain('district="เมืองชลบุรี"');
  });

  it('[regression] a bare district (no shortlisted sub-district) keeps the pre-CAM-600 district-only wording, never mentioning subDistrict', async () => {
    const content = await getSystemPrompt('ลานกางเต็นท์แม่ริม');
    expect(content).toContain('district="แม่ริม"');
    expect(content).not.toContain('subDistrict=');
  });

  it('[regression] an unresolvable, unscoped colliding sub-district name never produces a subDistrict hint (falls through to whatever the next level resolves)', async () => {
    const content = await getSystemPrompt('ลานกางเต็นท์ในเมือง');
    expect(content).not.toContain('subDistrict=');
    expect(content).not.toContain('MUST set district=');
  });

  it('[regression] a turn with no place at all keeps the byte-identical no-hint prompt', async () => {
    const content = await getSystemPrompt('สวัสดีครับ');
    expect(content).not.toContain('MUST set subDistrict=');
    expect(content).not.toContain('MUST set district=');
    expect(content).not.toContain('MUST set province=');
    expect(content).not.toContain('MUST set near=');
    expect(content).not.toContain('MUST set region=');
  });
});
