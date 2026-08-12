/**
 * cam-714-reason-sentence-rewrite.test.ts — CAM-714
 *
 * "The reason sentence reads as human Thai, not a report." Full spec:
 * docs/specs/ai-assistant/in-chat-booking-completion/CAM-714-human-reason-sentence/story.md
 *
 * Root cause (owner-reported 2026-08-08 on CAM-709): the :700 reason-sentence
 * clause carried exactly ONE worked example ("เลือกมาจากเงื่อนไขที่ขอไว้ คือ
 * พาสัตว์เลี้ยงไปได้"), and the model parroted it verbatim on every real
 * turn. Fix = a 3-candidate x 3-judge research synthesis: (1) SHAPE — the
 * reason fuses INTO the found-sentence, no separate selection-report
 * preamble slot; (2) HONESTY SPINE — every CAM-709 constraint survives at
 * full strength, extended for petFriendly/type + bulkAvailability's
 * `ranges`-only sourcing; (3) ANTI-PARROT MECHANICS — a banned-opener list +
 * three never-copy examples + an in-clause voice spec.
 *
 * This file pins the mechanics NOT already covered by the updated
 * __tests__/cam-709-openrouter-honest-scope-extend.test.ts (which pins the
 * carried-forward honesty substrings). Source-level pins here are a static
 * regression net only — the decisive verify is the BEHAVIOURAL run against
 * the real model, recorded in
 * docs/specs/ai-assistant/in-chat-booking-completion/CAM-714-human-reason-sentence/test.md
 * (qa.md: "a prompt/model change verified by diff read alone is not
 * verified" — CAM-500 lesson).
 *
 * Coverage matrix (qa.md §7):
 *   - normal: shape/fusion framing present; no separate preamble language
 *   - normal: petFriendly + type dimensions enumerated (search-campsites.ts
 *     buildAppliedFilters echoes both; the OLD clause omitted both)
 *   - normal: bulkAvailability ranges-only sourcing + degrade-to-dates+count
 *   - normal: "never names an individual campsite" guard carried from A
 *   - boundary: the flat no-parenthesis rule + A's truncation carve-out
 *   - null/empty: old parroted exemplar string is fully absent
 *   - normal (BR-5 style, adjacent clause): :691's example sentences no
 *     longer end in ค่ะ (the register drift the dossier flagged)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

const { runAssistantTurn } = await import('@/lib/ai/openrouter-client');

const FAKE_KEY = 'sk-or-test-cam-714';

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

describe('CAM-714 (1) SHAPE — the reason fuses INTO the found-sentence, no separate preamble slot', () => {
  it('[normal] the clause frames ONE sentence doing both jobs (report + reason), not a selection-process preamble', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('fuses the reason INTO your report of what you found');
    expect(prompt).toContain('never a separate preamble that narrates a selection process');
    expect(prompt).toContain('One sentence does both jobs');
  });

  it('[normal] the sentence never names an individual campsite (A\'s guard, carried verbatim)', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('This sentence never names an individual campsite; the cards below the answer show them.');
  });

  it('[normal] CAM-714 (iteration 3, real-model verify): the no-invented-location guard sits EARLY in the clause as a FLAT rule (right after the never-names-a-campsite guard), not buried mid-paragraph — a nuanced "never infer" phrasing measurably under-held on the real model (see test.md), so it was rewritten to the same flat, absolute style as the parenthesis ban, which the dossier found is the style a small model actually follows', async () => {
    const prompt = await getSystemPrompt();
    const namesGuardIdx = prompt.indexOf('This sentence never names an individual campsite');
    const locationGuardIdx = prompt.indexOf('FLAT RULE: if `appliedFilters` carries no `province`/`near`/`region`/`district`/`subDistrict`');
    const bannedListIdx = prompt.indexOf('Never open with, or work in, any of these report-style formulas');
    expect(namesGuardIdx).toBeGreaterThan(-1);
    expect(locationGuardIdx).toBeGreaterThan(namesGuardIdx);
    expect(locationGuardIdx).toBeLessThan(bannedListIdx);
  });
});

describe('CAM-714 (2) HONESTY SPINE — full-strength constraints, extended coherently', () => {
  it('[normal] petFriendly and type are now enumerated dimensions (buildAppliedFilters echoes both, search-campsites.ts:603/:607); CAM-716 — the clause now covers searchCampsites OR bulkAvailability', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain(
      'price (priceMin/priceMax), taxonomy, location (province/near/region, plus district/subDistrict for searchCampsites only), keyword, petFriendly, type, and sort'
    );
  });

  it('[normal] CAM-716: bulkAvailability now ALSO sources location/taxonomy facts from its own `appliedFilters` (mirroring searchCampsites), and dates ONLY from its own `ranges` echo, never from memory', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain("for bulkAvailability specifically, ALSO source date facts from that same result's own `ranges`");
    expect(prompt).toContain('you may say the camps shown are free on those dates because the tool itself verified that');
    expect(prompt).toContain("when a bulkAvailability result's `appliedFilters` has nothing set at all, state only the dates and the count");
    expect(prompt).toContain('never a terrain/province/taxonomy criterion from memory');
  });

  it('[boundary] the flat no-parenthesis rule survives, WITH A\'s truncation provision for a labelTh that itself carries a parenthesis (e.g. CHIC = "สบาย (สายคุณหนู)")', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('This sentence must contain NO parenthesis of any kind — no code, no English word, no citation');
    expect(prompt).toContain('if a labelTh itself contains a parenthesis, keep only the plain Thai part before it');
    expect(prompt).toContain('if you are tempted to write a word followed by "(", stop and rephrase without the parenthesis');
  });

  it('[normal] the never-claim-the-unapplied rule + never-mirror-unapplied-mood rule are present, with the petFriendly/โรแมนติก worked scenario', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('never add, imply, or word this sentence so a criterion the camper asked about sounds applied when it was not actually echoed back by the tool result');
    expect(prompt).toContain('never restate or mirror the camper\'s own mood, vibe, or quality words');
    expect(prompt).toContain('So when the camper asks for a romantic camp that also allows pets and `appliedFilters` lists only petFriendly, this sentence speaks only of the pet criterion');
  });

  it('[normal] a location/province may never be inferred from where the returned camps merely happen to be — a FLAT rule (closes a behavioural gap found in the real-model verify across 3 iterations: "แนะนำที่กางเต็นท์หน่อย" and a glamping+price query both invented a province from unfiltered result data before this flat phrasing; see test.md)', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain(
      'FLAT RULE: if `appliedFilters` carries no `province`/`near`/`region`/`district`/`subDistrict` this turn, this sentence contains NO province, region, or place name at all'
    );
    expect(prompt).toContain('not even one the returned camps merely happen to share — full stop');
    expect(prompt).toContain('only ever name the ONE place `appliedFilters.province`/`near`/`region` actually carries');
    expect(prompt).toContain('the FLAT no-invented-location rule above applies here too');
  });

  it('[normal] the broad-search honesty branch is present, in-voice', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('When `appliedFilters` has nothing set at all');
    expect(prompt).toContain('รอบนี้เราหากว้างๆ ให้ก่อน ลองบอกทำเล ราคา หรือสไตล์ที่ชอบมาได้เลย');
    expect(prompt).toContain('never invent a reason');
  });

  it('[normal] the skip-when-no-call rule is unchanged', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('Skip this opening sentence only when the turn made no searchCampsites/bulkAvailability call at all.');
  });
});

describe('CAM-714 (3) ANTI-PARROT MECHANICS', () => {
  it('[null/empty] the old parroted exemplar sentence is fully absent from the prompt', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).not.toContain('เลือกมาจากเงื่อนไขที่ขอไว้ คือพาสัตว์เลี้ยงไปได้');
    expect(prompt).not.toContain('explaining why this set of camps was chosen');
  });

  it('[normal] the mechanically checkable banned-opener list contains exactly the 5 ratified strings', async () => {
    const prompt = await getSystemPrompt();
    const banned = ['เลือกมาจาก', 'คัดมาจาก', 'ตามเงื่อนไขที่', 'จากเงื่อนไขที่ระบุ', 'ผลการค้นหา'];
    for (const term of banned) {
      expect(prompt).toContain(`"${term}"`);
    }
    expect(prompt).toContain('Never open with, or work in, any of these report-style formulas');
  });

  it('[normal] THREE structurally different example sentences are present (verb-first / place-first / criterion-first), never one', async () => {
    const prompt = await getSystemPrompt();
    const examples = [
      'หาลานริมทะเลราคาไม่เกิน 800 บาทต่อคืนให้แล้วนะ มีให้เลือก 5 ที่เลย',
      'แถวเขาใหญ่มีลานสายลุยที่ยังว่างช่วงนี้อยู่ 3 ที่ ลองดูไหม',
      'ลานแบบแกลมปิ้งพาสัตว์เลี้ยงไปได้ เราเจอมาให้ 4 ที่ในจันทบุรี',
    ];
    for (const ex of examples) {
      expect(prompt).toContain(ex);
    }
    // Distinct first words -> distinct sentence heads (verb/place/noun).
    const heads = examples.map((e) => e.split(/[\s ]/)[0]);
    expect(new Set(heads).size).toBe(3);
  });

  it('[normal] explicit never-copy + vary-your-opening-words instruction is present', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('never scripts to copy: compose your own fresh wording every turn from the actual filters');
    expect(prompt).toContain('never reuse any of them word-for-word, and vary your opening words from one answer to the next');
  });

  it('[normal] the in-clause voice spec bans ค่ะ/ครับ/ฉัน/emoji/em-dash and names เรา + นะ/เลย/ดูไหม', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('first person เรา, never ฉัน');
    expect(prompt).toContain('no ค่ะ/ครับ or any other gender particle');
    expect(prompt).toContain('softeners like นะ/เลย/ดูไหม carry the warmth instead');
    expect(prompt).toContain('no emoji, no em-dash');
  });

  it('[normal] no listing/report-dump constructs (comma-enumeration, colon-list) are permitted', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('never a comma-separated string of values, and never a colon-introduced list');
    expect(prompt).toContain('a run-up like "มีตัวเลือกดังนี้"');
  });
});

describe('CAM-714 adjacent-clause fix (:691) — the honest-scope example sentences no longer end in ค่ะ', () => {
  it('[normal] the two example sentences are re-registered particle-free (เลย), never ค่ะ', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('ไม่มีลานริมน้ำในเชียงใหม่เลย');
    expect(prompt).toContain('ไม่พบลานใกล้จุดนั้นเลย');
    expect(prompt).not.toContain('ไม่มีลานริมน้ำในเชียงใหม่ค่ะ');
    expect(prompt).not.toContain('ไม่พบลานใกล้จุดนั้นเลยค่ะ');
  });

  it('[normal] the rest of the :691 clause (the pinned BR-4 prefix) is unchanged', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain(
      'When your searchCampsites or bulkAvailability call this turn applied a location or terrain filter (province, region, near/proximity, or terrain such as ริมทะเล/ริมแม่น้ำ/ภูเขา/ป่า), mention that scope naturally in your answer in plain Thai'
    );
  });
});

describe('CAM-714 must-survive neighbours (BR-5 style) — untouched, byte-identical', () => {
  it('[normal] MAX_TOKENS stays 680', async () => {
    const { MAX_TOKENS } = await import('@/lib/ai/openrouter-client');
    expect(MAX_TOKENS).toBe(680);
  });

  it('[normal] the anti-enumeration clause (:656) is unchanged', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain(
      'Do not list or enumerate the matching campsites by name or detail in your answer — the camper already sees them as cards below your answer.'
    );
  });

  it('[normal] the CAM-459 3-zone answer policy is unchanged', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain('Classify every camper question into one of three zones before answering.');
  });

  it('[normal] the CAM-564 matchedTag / taxonomy resolution machinery this clause depends on is untouched (labelTh sourcing lives in search-campsites.ts, not this prompt file)', async () => {
    const prompt = await getSystemPrompt();
    // The clause references `labelTh` as the ONLY sourcing field — proves the
    // clause did not regress to a raw-code or matchedTag-name source.
    expect(prompt).toContain('use ONLY its `labelTh` Thai label');
  });
});
