/**
 * cam-718-grounded-availability-claims.test.ts — CAM-718
 *
 * "An availability claim in the answer comes from a real availability check,
 * never prose." Full spec:
 * docs/specs/ai-assistant/in-chat-booking-completion/CAM-718-grounded-availability-claims/story.md
 *
 * Root cause (found by the orchestrator's live staging probe after CAM-716,
 * 2026-08-12): the owner's exact query (ริมแม่น้ำ แถวๆสระบุรี เสาร์หน้า) kept
 * returning the right Saraburi camps, but the answer sometimes claimed
 * "มีที่ว่างสำหรับการเข้าพักในวันที่ 19 สิงหาคม 2026" — a Wednesday, not the
 * Saturday asked for — on a turn where NO checkAvailability/bulkAvailability
 * call ever joined (CAM-716's own test.md: bulkAvailability joins only 3/8 on
 * this phrasing family). The CAM-714 reason-sentence clause already sources
 * bulkAvailability's dates from that result's own `ranges` echo, but only for
 * ONE opening sentence — nothing stopped a LATER sentence in the same short
 * answer from stating a date/availability fact out of nowhere.
 *
 * ONE discipline shipped in buildSystemPrompt() (prompt-only change, same
 * pattern as CAM-437/459/501/709/714 — source-of-truth is
 * lib/ai/openrouter-client.ts; fetch is mocked, zero real spend):
 *   1. GROUNDING CLAUSE — a ว่าง/เหลือที่/converted-absolute-date claim
 *      ANYWHERE in the answer must be sourced from THIS turn's own
 *      checkAvailability or bulkAvailability result; when neither ran, the
 *      answer must not claim availability at all and instead offers to check
 *      (three never-copy example sentences, particle-free voice, mirroring
 *      CAM-714's own anti-parrot mechanics).
 *
 * A SECOND discipline (a routing nudge: a find/recommend request that also
 * names a stay date SHOULD chain into bulkAvailability) was BUILT, tested
 * locally (1/15 dispatch-behaviour change — negligible), pushed, and
 * REVERTED after a real CI guardrail run showed it destabilizing the
 * pre-existing, already-shipped GEO-8-CAM716-DATE-NEAR-SARABURI pin (the
 * nudge's own worked example quoted the owner's incident phrase verbatim —
 * GEO-8's own utterance — and the model skipped searchCampsites entirely,
 * 0/3 attempts). Per the ticket's own escape valve ("if the model cannot be
 * made to reliably join an availability call, say so and scope the fix to
 * discipline-only"): GROUNDING CLAUSE alone already closes the incident
 * (proven below), so the nudge was cut rather than kept as a net-negative,
 * unproven addition. See test.md's "Routing nudge — built, tested, reverted"
 * section for the full story.
 *
 * A static prompt-string pin CANNOT prove the model actually behaves this
 * way (qa.md: "a prompt/model change verified by diff read alone is not
 * verified" — CAM-500 lesson) — the decisive verify is the BEHAVIOURAL run
 * against the real model (owner's exact query x5 + the CAM-714 four cases),
 * recorded in this story's test.md.
 *
 * Coverage matrix (qa.md §7):
 *   - normal: the grounding clause names all three claim shapes (ว่าง/
 *     เหลือที่/date) and both real sources (checkAvailability args+result,
 *     bulkAvailability ranges+cell)
 *   - normal: the grounding clause forbids sourcing from resolveDates alone,
 *     memory, or searchCampsites
 *   - normal: the no-call fallback forbids ANY availability/date-free claim
 *     and requires the offer-to-check path instead
 *   - normal: anti-parrot mechanics present (3 never-copy examples, vary
 *     instruction, particle-free voice spec)
 *   - null/empty: the reverted routing-nudge sentence stays absent; the
 *     pre-existing CAM-505 MUST sentence is unchanged, byte-identical
 *   - null/empty: neither new clause disturbs the pre-existing CAM-714/CAM-709
 *     honesty-spine strings (byte-identical regression guard)
 *   - boundary: MAX_TOKENS unchanged (680)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

const { runAssistantTurn, MAX_TOKENS } = await import('@/lib/ai/openrouter-client');

const FAKE_KEY = 'sk-or-test-cam-718';

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

describe('CAM-718 (1) GROUNDING CLAUSE — a date/availability claim must be sourced from a real tool result this turn', () => {
  it('[normal] the clause names all three claim shapes (ว่าง / เหลือที่ / a converted absolute date) and gates them on THIS turn\'s checkAvailability/bulkAvailability result', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('A statement anywhere in your answer that a campsite is ว่าง (available), has เหลือที่ (remaining spots), or a specific converted/absolute date (for example "22-23 สิงหาคม") tied to a stay');
    expect(prompt).toContain("may appear ONLY when THIS turn's own checkAvailability or bulkAvailability call actually returned that fact");
  });

  it('[normal] checkAvailability sourcing is its own queried dates + a real free result; bulkAvailability sourcing is its own `ranges` echo + a free cell', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('for checkAvailability, the exact start/end dates you queried it with, together with a result showing real remaining spots and not blocked');
    expect(prompt).toContain('for bulkAvailability, only a date from its own `ranges` echo paired with a cell that call itself marked free');
  });

  it('[normal] resolveDates alone, memory, and searchCampsites are all explicitly excluded as valid sources', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('Never state or imply availability from resolveDates alone (it only converts a date phrase, it never checks availability), from your own memory of a date the camper mentioned, or from a searchCampsites call');
    expect(prompt).toContain('searchCampsites never checks availability');
  });

  it('[normal] when no availability call joined this turn, the answer must not state a converted/absolute date, nor claim/state/imply any open/free/space date', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('When this turn made no checkAvailability or bulkAvailability call at all, your answer must not state a converted/absolute date at all and must not claim, state, or imply that any date is open, free, or has space');
  });

  it('[normal] the camper\'s own requested date phrase may still be named EXACTLY as said (never resolved to an absolute date) while making the offer, just never asserted as available', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain("you may still name the camper's own requested date phrase EXACTLY as they said it (for example เสาร์หน้า, never resolved into an absolute date) while making the offer below, just never assert it is available");
  });

  it('[normal] a concrete negative worked contrast (say only เสาร์หน้า, never the resolved 22-23 สิงหาคม figure) reinforces the rule, even when the figure is correct', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('say only "...สำหรับเสาร์หน้า..." and never "...สำหรับวันที่ 22-23 สิงหาคม..."');
    expect(prompt).toContain('the number itself may be correct and it is STILL forbidden here, because stating it reads as availability whether you meant that or not');
  });

  it('[normal] the fallback instructs describing the camps found + closing with ONE offer to check dates', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('describe the camps searchCampsites did find, in your own words, and close with ONE natural offer to check the dates for them');
  });
});

describe('CAM-718 (2) ANTI-PARROT MECHANICS — mirrors CAM-714\'s own (three never-copy examples, vary instruction, particle-free voice)', () => {
  it('[normal] three structurally different never-copy example offer-sentences are present', async () => {
    const prompt = await getSystemPrompt();
    const examples = [
      'เดี๋ยวเช็ควันว่างให้อีกทีได้ไหม บอกวันที่มาได้เลยนะ',
      'อยากรู้ว่าช่วงนั้นว่างไหมก็ทักมาบอกได้เลย',
      'ถ้าอยากทราบว่าวันไหนว่างจริง บอกช่วงที่สนใจมาได้เลยนะ',
    ];
    for (const ex of examples) {
      expect(prompt).toContain(ex);
    }
  });

  it('[normal] the examples are explicitly marked illustrative-only, never scripts to copy, with a vary-your-wording instruction', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('these three sentences only illustrate the range of ways to make that offer, never scripts to copy');
    expect(prompt).toContain('compose your own fresh wording every turn and vary it from one answer to the next');
  });

  it('[normal] the same particle-free voice spec applies: เรา, no ค่ะ/ครับ, no emoji, no em-dash', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('Same voice as the opening sentence above: เรา, no ค่ะ/ครับ or any other gender particle, no emoji, no em-dash.');
  });
});

describe('CAM-718 (3) ROUTING NUDGE — tried and REVERTED (regression guard: stays reverted)', () => {
  it('[normal] the pre-existing MUST availability-trigger sentence (CAM-505) is unchanged, byte-identical', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain(
      'Any question about availability or openness — for example using words like "ว่างไหม", "วันไหนว่าง", "โล่งสุด", "ช่วงไหนว่าง", or "เต็มไหม" — MUST end this turn with a checkAvailability or bulkAvailability call; resolveDates only converts a date phrase into ISO ranges, it never reports availability, and it is NEVER a sufficient final step for such a question by itself. If the question needs date conversion, call resolveDates first, then IMMEDIATELY chain into checkAvailability or bulkAvailability with the ranges it returned — never stop, summarize, or answer after resolveDates alone. Use checkAvailability for one specific named or referenced camp over a single date range; use bulkAvailability for an open-ended "which camps are free" or a "which of several dates/weekends is freest" question (for example "ปลายเดือนไปไหนดีที่ยังว่าง"). If resolveDates returns ok:false, ask the camper for the dates instead — never call an availability tool on a guessed date.'
    );
  });

  it('[null/empty] the reverted SHOULD-nudge sentence stays absent — a real CI guardrail run (GEO-8) showed it destabilizing a pre-existing pinned case for negligible local reliability gain (1/15); the grounding clause alone (BR-1/BR-2) already closes the incident', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).not.toContain('SHOULD also chain into bulkAvailability this turn');
  });
});

describe('CAM-718 must-survive neighbours — CAM-714/CAM-709 honesty spine untouched, byte-identical', () => {
  it('[null/empty] MAX_TOKENS stays 680', async () => {
    expect(MAX_TOKENS).toBe(680);
  });

  it('[normal] the CAM-714 reason-sentence bulkAvailability ranges-sourcing rule is unchanged', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain("for bulkAvailability specifically, ALSO source date facts from that same result's own `ranges`");
    expect(prompt).toContain('you may say the camps shown are free on those dates because the tool itself verified that');
  });

  it('[normal] the CAM-714 skip-when-no-call rule for the opening sentence is unchanged', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('Skip this opening sentence only when the turn made no searchCampsites/bulkAvailability call at all.');
  });

  it('[normal] the anti-enumeration clause (:656) and the CAM-459 3-zone policy are unchanged', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain(
      'Do not list or enumerate the matching campsites by name or detail in your answer — the camper already sees them as cards below your answer.'
    );
    expect(prompt).toContain('Classify every camper question into one of three zones before answering.');
  });

  it('[normal] "Keep the answer to about 2-3 short sentences." still appears exactly once, after both new CAM-718 clauses', async () => {
    const prompt = await getSystemPrompt();
    const marker = 'Keep the answer to about 2-3 short sentences.';
    const occurrences = prompt.split(marker).length - 1;
    expect(occurrences).toBe(1);
    // Both new clauses land BEFORE this line (order matters: the model reads
    // the availability discipline before the length cap).
    const groundingIdx = prompt.indexOf('A statement anywhere in your answer that a campsite is ว่าง');
    const keepShortIdx = prompt.indexOf(marker);
    expect(groundingIdx).toBeGreaterThan(-1);
    expect(groundingIdx).toBeLessThan(keepShortIdx);
  });
});
