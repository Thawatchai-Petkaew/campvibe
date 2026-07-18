/**
 * cam-410-adversarial-seam.test.ts — CAM-410 QA adversarial pass on the
 * untrusted-suggestions seam (BR-3/BR-4/BR-5/EC-5, security.md §6 AI/LLM:
 * "model output is untrusted").
 *
 * Every reproduction below is wrapped in `it.fails()` (same convention as
 * `cam-272-ai-chat-contract-reconciliation.test.ts` Section B): the ASSERTED
 * expectation is the SPEC's promise (BR-5 — "the answer shown to the camper
 * never contains the raw suggestions block"); the assertion currently fails
 * against the real `runAssistantTurn`, so `it.fails()` inverts that into a
 * passing test — the suite stays green while the defect is open, and the
 * moment `lib/ai/openrouter-client.ts`'s `extractSuggestions` is hardened,
 * these tests will start passing for real, which flips `it.fails()` itself
 * to FAIL — loudly signalling "update this file, the fix landed."
 *
 * Root cause (all 3 share it): `SUGGESTIONS_BLOCK_REGEX.exec()` is a single,
 * non-`g`, non-greedy match — it finds only the FIRST `<suggestions>...
 * </suggestions>` span in the raw completion and slices exactly that span
 * out of the answer. Any completion shape where that first-match span is
 * NOT the one true well-formed block (duplicated block, no closing tag at
 * all, or a forged closing tag nested inside a candidate string) leaves raw
 * delimiter markup sitting in the text the camper reads — a direct BR-5
 * violation, and for the truncation case, an EC-5 violation too ("the
 * camper never sees JSON or delimiter markup").
 *
 * QA does not fix production code (qa.md §5) — see the `defects` return /
 * test.md for the sub-ticket write-up. This file only proves each
 * reproduction is real, not a test-authoring mistake (Prove-It, qa.md §7).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

const { runAssistantTurn } = await import('@/lib/ai/openrouter-client');

const FAKE_KEY = 'sk-or-test-adversarial-cam410';

function res(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}
function assistantMessage(content: string | null) {
  return { choices: [{ message: { role: 'assistant', content } }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENROUTER_API_KEY = FAKE_KEY;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
});

describe('QA DEFECT #1 (Critical) — a duplicated <suggestions> block leaks the SECOND raw block into the answer (BR-5)', () => {
  it.fails('[security] the answer never contains raw <suggestions> markup, even when the model repeats the block', async () => {
    const raw = 'ans <suggestions>["q1"]</suggestions> middle <suggestions>["q2"]</suggestions> end';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(assistantMessage(raw))));

    const result = await runAssistantTurn('q');

    // ACTUAL today: result.answer === 'ans  middle <suggestions>["q2"]</suggestions> end'
    // — the second raw block survives verbatim, visible to the camper.
    expect(result.answer).not.toContain('<suggestions>');
    expect(result.answer).not.toContain('</suggestions>');
  });
});

describe('QA DEFECT #2 (Critical) — a truncated block (MAX_TOKENS cutoff, no closing tag) leaks the raw open tag + partial JSON into the answer (BR-5/EC-5)', () => {
  it.fails('[error/validation] a completion cut off mid-<suggestions>-block still yields a clean answer with no raw markup', async () => {
    // Plausible in normal operation, not just adversarially: MAX_TOKENS=680
    // caps the WHOLE completion (answer + suggestions block together), so a
    // longer answer can push the block's closing tag past the cap.
    const raw = 'สวัสดีครับ พบแคมป์ 2 แห่ง <suggestions>["เอาที่ถูกกว่านี้ไหม", "ว่างเสาร';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(assistantMessage(raw))));

    const result = await runAssistantTurn('q');

    // ACTUAL today: extractSuggestions finds no closing tag -> no match at all
    // -> returns rawContent.trim() UNCHANGED, so the raw "<suggestions>[...\""
    // fragment is literally shown in the chat bubble (EC-5 promises "the
    // camper never sees JSON or delimiter markup" even on a parse failure).
    expect(result.answer).not.toContain('<suggestions>');
    expect('suggestions' in result).toBe(false);
  });
});

describe('QA DEFECT #3 (Critical, security) — a forged nested closing tag INSIDE a suggestion candidate breaks the extraction boundary (BR-3/BR-5, security.md §6 untrusted model output)', () => {
  it.fails('[security] a candidate string carrying its own <suggestions>/</suggestions> text cannot smuggle raw markup into the answer or corrupt the real block', async () => {
    const candidates = JSON.stringify(['<suggestions>["evil"]</suggestions>', 'ok คำถาม']);
    const raw = `ok<suggestions>${candidates}</suggestions>`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(assistantMessage(raw))));

    const result = await runAssistantTurn('q');

    // ACTUAL today: the non-greedy regex stops at the FIRST "</suggestions>"
    // it finds — the one forged inside the candidate string — so:
    //  (a) result.answer === 'ok,"ok คำถาม"]</suggestions>' (raw JSON tail +
    //      a raw closing tag leak straight into the visible answer), AND
    //  (b) the legitimately-generated "ok คำถาม" suggestion is silently lost
    //      entirely (the captured group is invalid JSON, so ALL candidates
    //      are dropped, not just the forged one).
    expect(result.answer).not.toContain('</suggestions>');
    expect(result.answer).not.toContain('<suggestions>');
    expect(result.suggestions).toEqual(['ok คำถาม']);
  });
});
