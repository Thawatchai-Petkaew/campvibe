/**
 * cam-709-openrouter-honest-scope-extend.test.ts — CAM-709 BR-4/BR-5
 *
 * "The assistant says why these camps were chosen, from the filters it
 * really applied." Full spec:
 * docs/specs/ai-assistant/in-chat-booking-completion/CAM-709-why-these-camps/story.md
 *
 * Pins `lib/ai/openrouter-client.ts`'s system-prompt EXTENSION at the
 * honest-scope clause (BR-4): a new, additional instruction requiring the
 * answer's opening sentence to be sourced from the tool result's
 * `appliedFilters`. Proves the extension is present WITHOUT disturbing the
 * lines BR-5 names as deliberately untouched (anti-enumeration :656,
 * plain-text :655, MAX_TOKENS, the pre-existing honest-scope sentence
 * itself) — the byte-round-trip pin for the CAM-415 guard-line rewording
 * (__tests__/cam-415-adversarial-verify.test.ts) already proves the REST of
 * the prompt is untouched at the string level; this file proves the new
 * content's presence and shape directly.
 *
 * Coverage matrix (qa.md §7):
 *   - normal: the new opening-sentence instruction is present and references
 *     `appliedFilters`
 *   - normal (BR-5): the pre-existing honest-scope sentence (:691) is still
 *     present, byte-identical
 *   - normal (BR-5): the anti-enumeration (:656) and plain-text (:655)
 *     clauses are still present, byte-identical
 *   - boundary (BR-5): MAX_TOKENS is unchanged (680)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

const { runAssistantTurn, MAX_TOKENS } = await import('@/lib/ai/openrouter-client');

const FAKE_KEY = 'sk-or-test-cam-709';

function res(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = FAKE_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
});

async function getSystemPrompt(): Promise<string> {
  const mockFetch = vi.fn().mockResolvedValue(res({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }));
  vi.stubGlobal('fetch', mockFetch);

  await runAssistantTurn('มีแคมป์ไหมคะ');

  const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(init.body as string);
  return body.messages[0].content as string;
}

describe('buildSystemPrompt — CAM-709 BR-4: the new opening-sentence instruction is present', () => {
  it('[normal] the prompt instructs an opening reason sentence sourced from appliedFilters', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('open your answer with exactly ONE sentence');
    expect(prompt).toContain('`appliedFilters` field in the tool result');
    expect(prompt).toContain('use ONLY each entry\'s `labelTh` Thai label');
    expect(prompt).toContain('NEVER its raw `code`');
    expect(prompt).toContain('say plainly that this was a broad, general search with no specific criteria applied');
  });

  it('[normal] the prompt forbids restating the camper\'s own unfiltered mood/vibe wording (EC-1 honesty)', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('Do NOT restate, acknowledge, or mirror the camper\'s own request wording in this sentence');
    expect(prompt).toContain('NEVER contain the word โรแมนติก or any paraphrase of it');
  });
});

describe('buildSystemPrompt — CAM-709 BR-5: deliberately untouched lines still present, byte-identical', () => {
  it('[normal] the pre-existing honest-scope sentence (:691) is unchanged', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain(
      'When your searchCampsites or bulkAvailability call this turn applied a location or terrain filter (province, region, near/proximity, or terrain such as ริมทะเล/ริมแม่น้ำ/ภูเขา/ป่า), mention that scope naturally in your answer in plain Thai'
    );
  });

  it('[normal] the anti-enumeration clause (:656) is unchanged', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain(
      'Do not list or enumerate the matching campsites by name or detail in your answer — the camper already sees them as cards below your answer.'
    );
  });

  it('[normal] the plain-text clause (:655) is unchanged', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('Write your answer as plain text only.');
  });

  it('[boundary] MAX_TOKENS stays 680', () => {
    expect(MAX_TOKENS).toBe(680);
  });
});
