/**
 * cam-717-chained-filter-carryover.test.ts — CAM-717
 *
 * "A chained date search can drop the terrain filter while the answer still
 * names it." Full spec:
 * docs/specs/ai-assistant/in-chat-booking-completion/CAM-717-chained-filter-carryover/story.md
 *
 * Root cause (found during CAM-716's own behavioural verify, re-confirmed
 * live by CAM-718's guardrail sampling, EC-4): when a turn dispatches BOTH
 * searchCampsites AND bulkAvailability for the SAME request (the CAM-716
 * Run-1 shape — search first to show camps, then bulk to check the dates
 * the camper also asked for), a taxonomy/structured filter the MODEL itself
 * chose on the FIRST call (for example terrain "RIVE" from "ริมแม่น้ำ")
 * sometimes did not survive onto the SECOND call, even though the answer
 * still named the criterion. `near`/`province`/`region` are already pinned
 * on BOTH tools by the mandatory, server-detected place-hint block
 * (CAM-501/CAM-716) — this gap is specifically the filters the model
 * inferred itself, which no server-side hint can carry because nothing
 * outside the model's own prior tool call recorded them.
 *
 * THREE disciplines shipped (prompt-only + one tool `description` string —
 * no tool schema/behaviour change; source-of-truth is
 * lib/ai/openrouter-client.ts and lib/ai/tools/bulk-availability.ts; fetch
 * is mocked, zero real spend):
 *   1. CARRY-OVER PIN (system prompt) — names the full bulkAvailability
 *      filter vocabulary and instructs the model to copy every argument
 *      from its own earlier call in the SAME turn onto the second call,
 *      rather than composing it fresh.
 *   2. ANSWER-SIDE BACKSTOP (system prompt) — a criterion may be named in
 *      the answer only when it appears in the `appliedFilters` echo of
 *      EVERY call the answer draws from, closing the harm (a mislabeled
 *      result) even on a turn where the carry-over pin itself fails.
 *   3. TOOL-DESCRIPTION CARRY-OVER NOTE (bulkAvailabilityTool.description)
 *      — added after real-model sampling showed BOTH system-prompt
 *      disciplines above are not 100% reliable on their own (measured: 5/5
 *      on the direct CAM-716 zero-result repro via the CAM-505
 *      resolveDates->bulk MUST chain, but repeated failures on the OPTIONAL
 *      search-then-bulk chain the bare owner phrasing takes — see
 *      test.md). Placed as the tool's own SECOND description sentence, at
 *      the exact point the model composes THIS call's arguments — closer
 *      to the decision than a system-prompt paragraph buried among ~40
 *      others, and the established idiom this codebase already uses for
 *      per-argument guidance (jsonSchema `description` fields).
 *
 * A static prompt-string pin CANNOT prove the model actually behaves this
 * way (qa.md: "a prompt/model change verified by diff read alone is not
 * verified" — CAM-500 lesson) — the decisive verify is the BEHAVIOURAL run
 * against the real model (10+ chained runs across the three iterations),
 * recorded in this story's test.md, including the honest record of what
 * DIDN'T fully close the gap before the tool-description layer was added.
 *
 * Coverage matrix (qa.md §7):
 *   - normal: the carry-over pin names the full bulkAvailability filter
 *     vocabulary and states the MUST-repeat rule for a same-turn
 *     search+bulk pair
 *   - normal: the carry-over pin names the "copy your own previous call's
 *     arguments" mechanism explicitly, not just the abstract rule
 *   - normal: the carry-over pin covers `dates`/`guests` as the only fields
 *     that may change between the two calls
 *   - normal: the answer-side backstop requires a criterion to appear on
 *     EVERY call's `appliedFilters`, not just the call that named it first
 *   - normal: the answer-side backstop explicitly covers the exact failure
 *     mode (a `terrain` word carried on the FIRST call's `appliedFilters`
 *     but not the SECOND's)
 *   - normal: the tool-description note names the full argument list and
 *     states the MUST-copy rule, and is the tool's SECOND sentence
 *   - null/empty: neither new clause disturbs the pre-existing CAM-505/
 *     CAM-714/CAM-716/CAM-718 chaining/grounding/reason-sentence strings
 *     (byte-identical regression guard); the tool's own jsonSchema/
 *     parameters/execute are unchanged (description-only edit)
 *   - boundary: MAX_TOKENS unchanged (680); the carry-over pin lands between
 *     the existing bulk-routing rule and the structured-filter-preference
 *     rule; the answer-side backstop lands between the CAM-714 reason
 *     sentence and the CAM-718 grounding clause
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

const { runAssistantTurn, MAX_TOKENS } = await import('@/lib/ai/openrouter-client');
const { bulkAvailabilityTool } = await import('@/lib/ai/tools/bulk-availability');

const FAKE_KEY = 'sk-or-test-cam-717';

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

describe('CAM-717 (1) CARRY-OVER PIN — a same-turn search+bulk pair repeats every filter argument', () => {
  it('[normal] names the full bulkAvailability filter vocabulary as identical to searchCampsites', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain(
      'bulkAvailability accepts the exact same filter arguments as searchCampsites: `near`, `province`, `region`, `terrain`, `access`, `activities`, `facilities`, `annotatedFeatures`, `camperStyle`, `type`, `priceMin`/`priceMax`, `petFriendly`, `keyword`.'
    );
  });

  it('[normal] states the MUST-repeat rule for a same-turn searchCampsites + bulkAvailability pair', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain(
      'When this turn makes BOTH a searchCampsites call and a bulkAvailability call for the SAME request, every one of those filter arguments set on the FIRST of the two calls MUST be repeated identically on the SECOND call'
    );
    expect(prompt).toContain(
      'never drop, narrow, or forget one just because you switched tools, and never let the answer name a criterion (for example a terrain word) that you then failed to carry onto the call whose result you are reporting'
    );
  });

  it('[normal] names the mechanism explicitly — copy your own previous call\'s arguments, never compose from scratch', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain(
      "The reliable way to do this: before composing the second call's arguments, copy every argument from the tool call you already made this turn for this same request, then only add or change `dates`/`guests`"
    );
    expect(prompt).toContain('never compose the second call\'s filter arguments from scratch or from memory of the camper\'s words alone.');
  });
});

describe('CAM-717 (2) ANSWER-SIDE BACKSTOP — a criterion may only be named when every call the answer draws from echoes it', () => {
  it('[normal] states the every-call rule for a same-turn search-then-bulk (or reverse) pair', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain(
      'When your answer is describing the result of a bulkAvailability call that followed a searchCampsites call this turn for the SAME request (or the reverse order), you are drawing from BOTH calls together, not just one'
    );
    expect(prompt).toContain(
      'a criterion (terrain, taxonomy, price, petFriendly, keyword, type, location) may be named anywhere in your answer, including the opening sentence above, ONLY when it appears in the `appliedFilters` echo of EVERY one of those calls — never a criterion that only ONE of the two calls actually carried, even if the OTHER call named it'
    );
  });

  it('[normal] explicitly covers the exact failure mode — a criterion carried on the FIRST call but dropped on the SECOND', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain(
      'This matters even when the FIRST call\'s `appliedFilters` carried it (for example a terrain word from searchCampsites): if the SECOND call\'s own `appliedFilters` does not also carry that same filter, the count or availability you are about to report was actually computed over a wider set of camps than that criterion implies, so naming it here would misdescribe the result you are reporting.'
    );
  });

  it('[normal] forbids repairing the gap by assuming the missing call "must have" applied the filter too', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain(
      'When the two calls disagree this way, describe only the criteria BOTH calls\' `appliedFilters` actually share — never repair the gap by assuming the missing call "must have" filtered on it too.'
    );
  });

  it('[normal] the backstop lands between the CAM-714 reason sentence and the CAM-718 grounding clause', async () => {
    const prompt = await getSystemPrompt();
    const reasonSentenceIdx = prompt.indexOf('Skip this opening sentence only when the turn made no searchCampsites/bulkAvailability call at all.');
    const backstopIdx = prompt.indexOf('When your answer is describing the result of a bulkAvailability call that followed a searchCampsites call');
    const groundingIdx = prompt.indexOf('A statement anywhere in your answer that a campsite is ว่าง');
    expect(reasonSentenceIdx).toBeGreaterThan(-1);
    expect(backstopIdx).toBeGreaterThan(reasonSentenceIdx);
    expect(groundingIdx).toBeGreaterThan(backstopIdx);
  });
});

describe('CAM-717 (3) TOOL-DESCRIPTION CARRY-OVER NOTE — bulkAvailabilityTool.description, closer to the actual call-composing decision', () => {
  it('[normal] the description states the MUST-copy rule and names the full argument list', () => {
    expect(bulkAvailabilityTool.description).toContain(
      'If you already called searchCampsites earlier THIS turn for the SAME request, you MUST copy every filter argument that call used onto THIS call too (province, near, region, terrain, access, activities, facilities, annotatedFeatures, camperStyle, type, price, petFriendly, keyword) — never drop, narrow, or forget one just because you are switching tools; only `dates`/`guests` are new here.'
    );
  });

  it('[normal] the note is the SECOND sentence — right after the tool\'s own one-line purpose statement, before the CAM-505 one-camp-many-dates clause', () => {
    const description = bulkAvailabilityTool.description;
    const purposeSentence =
      'Check LIVE availability for MANY published CampVibe campsites across MULTIPLE date ranges in ONE call';
    const carryOverSentence = 'If you already called searchCampsites earlier THIS turn for the SAME request';
    const oneCoreCampSentence = 'This also applies to ONE specific named camp when the question spans multiple candidate dates';
    const purposeIdx = description.indexOf(purposeSentence);
    const carryOverIdx = description.indexOf(carryOverSentence);
    const oneCoreCampIdx = description.indexOf(oneCoreCampSentence);
    expect(purposeIdx).toBe(0);
    expect(carryOverIdx).toBeGreaterThan(purposeIdx);
    expect(oneCoreCampIdx).toBeGreaterThan(carryOverIdx);
  });

  it('[null/empty] the tool\'s name/tier/parameters/jsonSchema/execute are unchanged — description-only edit', () => {
    expect(bulkAvailabilityTool.name).toBe('bulkAvailability');
    expect(bulkAvailabilityTool.tier).toBe('guest');
    expect(bulkAvailabilityTool.jsonSchema).toMatchObject({ required: ['dates'], additionalProperties: false });
  });
});

describe('CAM-717 must-survive neighbours — CAM-505/CAM-716/CAM-718 chaining + grounding strings untouched, byte-identical', () => {
  it('[null/empty] MAX_TOKENS stays 680', async () => {
    expect(MAX_TOKENS).toBe(680);
  });

  it('[normal] the CAM-505 MUST availability-trigger sentence is unchanged', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain(
      'Any question about availability or openness — for example using words like "ว่างไหม", "วันไหนว่าง", "โล่งสุด", "ช่วงไหนว่าง", or "เต็มไหม" — MUST end this turn with a checkAvailability or bulkAvailability call'
    );
  });

  it('[normal] the CAM-505 checkAvailability-vs-bulkAvailability routing rule is unchanged, and the carry-over pin lands immediately after it', async () => {
    const prompt = await getSystemPrompt();
    const routingSentence =
      'checkAvailability is for ONE specific named camp over ONE single date range only.';
    const carryOverSentence = 'bulkAvailability accepts the exact same filter arguments as searchCampsites';
    const structuredPrefSentence = 'Prefer the structured filter arguments on searchCampsites';
    expect(prompt).toContain(routingSentence);
    const routingIdx = prompt.indexOf(routingSentence);
    const carryOverIdx = prompt.indexOf(carryOverSentence);
    const structuredPrefIdx = prompt.indexOf(structuredPrefSentence);
    expect(routingIdx).toBeGreaterThan(-1);
    expect(carryOverIdx).toBeGreaterThan(routingIdx);
    expect(structuredPrefIdx).toBeGreaterThan(carryOverIdx);
  });

  it('[normal] the CAM-501/CAM-716 place-hint mandatory-set pin idiom is unaffected (no place hint this turn -> prompt has no ResolvedPlace text)', async () => {
    const prompt = await getSystemPrompt();
    // No place resolved for this turn's message ('มีแคมป์ไหมคะ' has no
    // province/near/district) — the place-hint block contributes NOTHING,
    // exactly as CAM-501 BR-2 designed it. This guards that the new
    // CAM-717 pin (always present) is independent of that null-contributes-
    // nothing idiom, never accidentally coupled to it.
    expect(prompt).not.toContain('detected deterministically server-side, not a guess');
  });

  it('[normal] the CAM-718 grounding clause (never state availability with no real check) is unchanged', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain(
      'A statement anywhere in your answer that a campsite is ว่าง (available), has เหลือที่ (remaining spots), or a specific converted/absolute date'
    );
  });

  it('[normal] the CAM-716 near-hint bulkAvailability wording is unchanged', async () => {
    const prompt = await getSystemPrompt();
    expect(prompt).toContain(
      'checkAvailability for one specific named or referenced camp over a single date range; use bulkAvailability for an open-ended'
    );
  });

  it('[normal] "Keep the answer to about 2-3 short sentences." still appears exactly once, after the new CAM-717 clause', async () => {
    const prompt = await getSystemPrompt();
    const marker = 'Keep the answer to about 2-3 short sentences.';
    const occurrences = prompt.split(marker).length - 1;
    expect(occurrences).toBe(1);
    const carryOverIdx = prompt.indexOf('bulkAvailability accepts the exact same filter arguments as searchCampsites');
    const keepShortIdx = prompt.indexOf(marker);
    expect(carryOverIdx).toBeGreaterThan(-1);
    expect(carryOverIdx).toBeLessThan(keepShortIdx);
  });
});
