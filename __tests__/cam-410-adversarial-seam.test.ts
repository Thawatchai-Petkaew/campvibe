/**
 * cam-410-adversarial-seam.test.ts — CAM-410 QA adversarial pass on the
 * untrusted-suggestions seam (BR-3/BR-4/BR-5/EC-5, security.md §6 AI/LLM:
 * "model output is untrusted").
 *
 * FIXED (backend hardening landed in lib/ai/openrouter-client.ts's
 * `extractSuggestions`): all 3 reproductions below were originally wrapped
 * in `it.fails()` Prove-It repros (see git history) — the promised
 * behavior (BR-5 — "the answer shown to the camper never contains the raw
 * suggestions block") now holds for real, so each is flipped to a normal
 * `it()` per the fix-author's own rule ("flip `it.fails` -> `it` there",
 * cam-272-ai-chat-contract-reconciliation.test.ts). A regression here means
 * the fix regressed.
 *
 * Root cause (all 3 shared it): the ORIGINAL `SUGGESTIONS_BLOCK_REGEX.exec()`
 * was a single, non-`g`, non-greedy match — it found only the FIRST
 * `<suggestions>...</suggestions>` span in the raw completion and sliced
 * exactly that span out of the answer. Any completion shape where that
 * first-match span was NOT the one true well-formed block (duplicated
 * block, no closing tag at all, or a forged closing tag nested inside a
 * candidate string) left raw delimiter markup sitting in the text the
 * camper reads — a direct BR-5 violation, and for the truncation case, an
 * EC-5 violation too ("the camper never sees JSON or delimiter markup").
 * The fix resolves the block boundary by JSON-VALIDITY (trying each
 * `</suggestions>` occurrence in order until one yields a parseable JSON
 * array) instead of "whichever closing tag comes first textually", plus a
 * global cleanup pass for any further stray tag/pair, plus a per-candidate
 * guard that drops (never sanitizes-and-keeps) a candidate smuggling its
 * own delimiter tag.
 *
 * QA does not fix production code (qa.md §5) — see the `defects` return /
 * test.md for the sub-ticket write-up.
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

describe('QA DEFECT #1 (Critical, FIXED) — a duplicated <suggestions> block no longer leaks the SECOND raw block into the answer (BR-5)', () => {
  it('[security] the answer never contains raw <suggestions> markup, even when the model repeats the block', async () => {
    const raw = 'ans <suggestions>["q1"]</suggestions> middle <suggestions>["q2"]</suggestions> end';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(assistantMessage(raw))));

    const result = await runAssistantTurn('q');

    // FIXED: the primary (first well-formed) block is removed, and a global
    // cleanup pass strips the second, duplicated block too — no raw markup
    // of any kind survives into the visible answer.
    expect(result.answer).not.toContain('<suggestions>');
    expect(result.answer).not.toContain('</suggestions>');
  });
});

describe('QA DEFECT #2 (Critical, FIXED) — a truncated block (MAX_TOKENS cutoff, no closing tag) no longer leaks the raw open tag + partial JSON into the answer (BR-5/EC-5)', () => {
  it('[error/validation] a completion cut off mid-<suggestions>-block still yields a clean answer with no raw markup', async () => {
    // Plausible in normal operation, not just adversarially: MAX_TOKENS=680
    // caps the WHOLE completion (answer + suggestions block together), so a
    // longer answer can push the block's closing tag past the cap.
    const raw = 'สวัสดีครับ พบแคมป์ 2 แห่ง <suggestions>["เอาที่ถูกกว่านี้ไหม", "ว่างเสาร';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(assistantMessage(raw))));

    const result = await runAssistantTurn('q');

    // FIXED: no closing tag anywhere -> extractSuggestions strips from the
    // orphan open tag to the END of the text (EC-5: never raw JSON/delimiter
    // markup shown), and no candidates are parsed from the unterminated block.
    expect(result.answer).not.toContain('<suggestions>');
    expect('suggestions' in result).toBe(false);
  });
});

describe('QA DEFECT #3 (Critical, security, FIXED) — a forged nested closing tag INSIDE a suggestion candidate no longer breaks the extraction boundary (BR-3/BR-5, security.md §6 untrusted model output)', () => {
  it('[security] a candidate string carrying its own <suggestions>/</suggestions> text cannot smuggle raw markup into the answer or corrupt the real block', async () => {
    const candidates = JSON.stringify(['<suggestions>["evil"]</suggestions>', 'ok คำถาม']);
    const raw = `ok<suggestions>${candidates}</suggestions>`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(assistantMessage(raw))));

    const result = await runAssistantTurn('q');

    // FIXED: the block boundary is resolved by JSON-validity, so the TRUE
    // (outer) closing tag is found despite the forged nested one -> the
    // whole block is stripped from the answer cleanly, AND the smuggling
    // candidate itself is dropped outright (never sanitized-and-kept) while
    // the legitimate "ok คำถาม" suggestion survives.
    expect(result.answer).not.toContain('</suggestions>');
    expect(result.answer).not.toContain('<suggestions>');
    expect(result.suggestions).toEqual(['ok คำถาม']);
  });
});
