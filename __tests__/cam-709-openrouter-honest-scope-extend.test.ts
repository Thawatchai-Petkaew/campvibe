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
 * CAM-714 (2026-08-12) UPDATE: the reason-sentence clause's WORDING was
 * rewritten (root cause — the clause's single worked example was being
 * parroted verbatim; see the CAM-714 comment in openrouter-client.ts and
 * __tests__/cam-714-reason-sentence-rewrite.test.ts for the new mechanics).
 * The assertions below are updated to the NEW clause text — every honesty
 * constraint the old assertions checked still holds, just phrased
 * differently (verified against the CAM-714 dossier's honesty-spine
 * requirement); nothing here is a weakening.
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

describe('buildSystemPrompt — CAM-709 BR-4 (CAM-714 rewrite): the opening-sentence instruction is present', () => {
  it('[normal] the prompt instructs an opening reason sentence sourced from appliedFilters', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('open your answer with exactly ONE sentence');
    expect(prompt).toContain('`appliedFilters` field in the tool result');
    expect(prompt).toContain('use ONLY its `labelTh` Thai label');
    expect(prompt).toContain('NEVER its raw `code`');
    expect(prompt).toContain('this was a broad look around with no specific criteria applied');
  });

  it('[normal] the prompt forbids restating the camper\'s own unfiltered mood/vibe wording (EC-1 honesty)', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('never restate or mirror the camper\'s own mood, vibe, or quality words');
    expect(prompt).toContain('the word โรแมนติก or any paraphrase of it never appears');
  });

  it('[normal] CAM-714: the dimension list now covers petFriendly and type (buildAppliedFilters echoes both)', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('keyword, petFriendly, type, and sort');
  });

  it('[normal] CAM-714: the old parroted worked example is gone', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).not.toContain('เลือกมาจากเงื่อนไขที่ขอไว้ คือพาสัตว์เลี้ยงไปได้');
  });

  it('[normal] CAM-714: a mechanically checkable banned-opener list is present', async () => {
    const prompt = await getSystemPrompt();
    for (const banned of ['"เลือกมาจาก"', '"คัดมาจาก"', '"ตามเงื่อนไขที่"', '"จากเงื่อนไขที่ระบุ"', '"ผลการค้นหา"']) {
      expect(prompt).toContain(banned);
    }
  });

  it('[normal] CAM-714: three structurally different never-copy example sentences are present, and the in-clause voice spec bans ค่ะ/ครับ/emoji/em-dash', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('never reuse any of them word-for-word');
    expect(prompt).toContain('no ค่ะ/ครับ');
    expect(prompt).toContain('no emoji, no em-dash');
    expect(prompt).toContain('หาลานริมทะเลราคาไม่เกิน 800 บาทต่อคืนให้แล้วนะ');
    expect(prompt).toContain('แถวเขาใหญ่มีลานสายลุยที่ยังว่างช่วงนี้อยู่ 3 ที่');
    expect(prompt).toContain('ลานแบบแกลมปิ้งพาสัตว์เลี้ยงไปได้');
  });

  it('[normal] CAM-714: the flat no-parenthesis rule keeps its truncation provision for a labelTh that itself carries one', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('NO parenthesis of any kind');
    expect(prompt).toContain('if a labelTh itself contains a parenthesis, keep only the plain Thai part before it');
  });

  it('[normal] CAM-714: bulkAvailability sources date facts from its own `ranges` echo, degrading to dates+count with no filter echo', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('whose result carries no `appliedFilters` echo, source date facts ONLY from that result\'s own `ranges`');
    expect(prompt).toContain('state only the dates and the count, never a terrain/province/taxonomy criterion from memory');
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
