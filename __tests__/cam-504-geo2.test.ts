/**
 * CAM-504 (GEO-2 fix) — a small precision refinement to the Place Resolver
 * (CAM-498 epic). Golden case GEO-2 ("ในกรุงเทพ", exact) failed: the model
 * dispatched `searchCampsites{near:"กรุงเทพ"}` (proximity) instead of
 * `{province:"Bangkok"}` (exact). Root cause: `resolvePlace`'s bare-Bangkok
 * detection (`isBareBangkokMention`) fired ONLY under proximity mode, so a
 * bare/exact "ในกรุงเทพ" mention resolved to `{}` — no hint at all — leaving
 * the model free to reach for the `near` capability P2 (CAM-502) had just
 * taught it, even though the camper meant an EXACT province.
 *
 * Fix: `resolvePlace` now checks the bare-Bangkok case unconditionally
 * (with and without a proximity marker) so it always resolves to a
 * deterministic hint — `near` under proximity (GEO-1, unchanged), `province`
 * otherwise (GEO-2, fixed) — mirroring how every other province already
 * resolves to `province` by default. The MANDATORY province hint block
 * (openrouter-client.ts) also now explicitly tells the model NOT to set
 * `near` instead, mirroring the symmetric wording the `near` branch already
 * had against `province`.
 *
 * Coverage: normal (exact/bare Bangkok -> province hint, near hint absent)
 * + regression (GEO-1 proximity Bangkok still -> near, unaffected) +
 * regression (DEF-1 ambiguous-word guard still holds, no false match) +
 * fixture (GEO-2 case shape + the new GEO-4 bare-province case).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolvePlace } from '@/lib/ai/place-resolver';

// ---------------------------------------------------------------------------
// resolvePlace — deterministic pre-pass (pure, no mocks needed)
// ---------------------------------------------------------------------------

describe('CAM-504 resolvePlace — "ใน X" / bare province resolves EXACT, not near', () => {
  it('[normal/GEO-2] "ในกรุงเทพ" -> province="Bangkok" (exact, no proximity marker)', () => {
    expect(resolvePlace('ในกรุงเทพ')).toEqual({ province: 'Bangkok' });
  });

  it('[normal] bare "กรุงเทพ" with no "ใน" and no proximity marker -> province="Bangkok"', () => {
    expect(resolvePlace('กรุงเทพมีลานกางเต็นท์ไหม')).toEqual({ province: 'Bangkok' });
  });

  it('[regression/GEO-1] "ลานกางเต็นท์ใกล้กรุงเทพ" (proximity marker present) -> near="กรุงเทพ", unchanged', () => {
    expect(resolvePlace('ลานกางเต็นท์ใกล้กรุงเทพ')).toEqual({ near: 'กรุงเทพ' });
  });

  it('[regression] a full formal Bangkok name with no proximity marker also resolves exact', () => {
    expect(resolvePlace('อยากไปเที่ยวกรุงเทพมหานคร')).toEqual({ province: 'Bangkok' });
  });

  it('[regression/non-Bangkok, CAM-501 pinned] a regular province with no proximity marker still resolves exact, unaffected', () => {
    expect(resolvePlace('แคมป์ริมน้ำเชียงใหม่')).toEqual({ province: 'Chiang Mai' });
  });

  it('[regression/DEF-1] the ambiguous-word guard still holds — no false Bangkok match on an unrelated sentence', () => {
    expect(resolvePlace('ไปตากผ้าใกล้ๆ บ้าน')).toEqual({});
  });

  it('[null/empty] empty string -> {}, never throws', () => {
    expect(resolvePlace('')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// buildPlaceHintBlock (via the real system prompt) — mandatory hint wording
// ---------------------------------------------------------------------------

vi.mock('server-only', () => ({}));

const { runAssistantTurn } = await import('@/lib/ai/openrouter-client');

const FAKE_KEY = 'sk-or-test-cam-504';

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

describe('CAM-504 mandatory place-hint wording — exact province vs near', () => {
  it('[normal/GEO-2] "ในกรุงเทพ" -> the prompt MUST set province="Bangkok" and explicitly says NOT near', async () => {
    const content = await getSystemPrompt('ในกรุงเทพ');
    expect(content).toContain('MUST set province="Bangkok"');
    expect(content).toContain('do NOT set `near` for this place instead');
  });

  it('[regression/GEO-1] "ลานกางเต็นท์ใกล้กรุงเทพ" -> the prompt MUST set near, not the exact-province wording', async () => {
    const content = await getSystemPrompt('ลานกางเต็นท์ใกล้กรุงเทพ');
    expect(content).toContain('MUST set near="กรุงเทพ"');
    expect(content).not.toContain('MUST set province="Bangkok"');
  });

  it('[normal] a regular exact province (no Bangkok involved) also gets the "do NOT set near" guard', async () => {
    const content = await getSystemPrompt('แคมป์ริมน้ำเชียงใหม่');
    expect(content).toContain('MUST set province="Chiang Mai"');
    expect(content).toContain('do NOT set `near` for this place instead');
  });
});
