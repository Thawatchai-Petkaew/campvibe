/**
 * cam-459-answer-policy-3-zones.test.ts — CAM-459: replaces the implicit
 * "use ONLY the provided tools" guidance in `buildSystemPrompt()` with an
 * explicit 3-zone answer policy (BR-1): Zone A (general camping knowledge)
 * answers with ZERO tools and ends with one bridge back to real data (BR-2);
 * Zone B (camp-specific fact) stays tool-only and generalizes the CAM-437
 * grounding rule's honest no-data line to every per-camp fact (BR-3); Zone C
 * (transactional) never claims to have executed a booking/edit/cancel since
 * no write tool is registered today (BR-1, proves AC-5/EC-5 by code-confirm
 * per story.md Self-verify — no golden-eval case is required for AC-5).
 *
 * Source-of-truth is `buildSystemPrompt()` in lib/ai/openrouter-client.ts —
 * this is a prompt-assertion test only (mirrors the CAM-405/CAM-411/CAM-437
 * precedent: fetch is mocked, zero real spend, no live model call). The
 * eval-BEHAVIOR contract (zone A -> kind:"no_tool", zone B -> correct tool)
 * is proven by the golden suite (scripts/ai-eval/golden-cases.json,
 * CAM-457's harness) — not re-tested here (BR-5).
 *
 * golden-cases.json note: only ONE new zone-A case (SMOKE-A2) was added, not
 * 2-3 as the story's guidance suggested, because CAM-457's own frozen
 * regression test (`__tests__/cam-457-eval-harness.test.ts`, out of this
 * story's file surface) hardcodes `cases.length` <= 8 for the shipped
 * fixture; 7 existing + 1 new = 8 stays within that bound. A zone-C golden
 * case was deliberately NOT added for the same reason — story.md's own
 * Self-verify section proves AC-5 via owner-verify + code-confirm, not a
 * golden-eval case, so this is not a scope gap.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';

vi.mock('server-only', () => ({}));

const { runAssistantTurn, runAssistantTurnFromMessages, MAX_TOKENS } = await import('@/lib/ai/openrouter-client');
const { loadCasesFromFile } = await import('../scripts/ai-eval/load-cases');

const FAKE_KEY = 'sk-or-test-cam-459';

function res(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

function assistantMessage(content: string | null) {
  return { choices: [{ message: { role: 'assistant', content } }] };
}

function stubFetch() {
  const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ok')));
  vi.stubGlobal('fetch', mockFetch);
  return mockFetch;
}

async function getSystemPromptFor(userText: string, ctx: { userId?: string } = {}): Promise<string> {
  const mockFetch = stubFetch();
  await runAssistantTurn(userText, ctx);
  const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(init.body as string);
  return body.messages.find((m: { role: string }) => m.role === 'system').content as string;
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = FAKE_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
});

const ZONE_A_MARKER = 'Zone A - general camping knowledge';
const ZONE_B_MARKER = 'Zone B - a camp-specific fact';
const ZONE_C_MARKER = 'Zone C - a transactional request';
const BRIDGE_COPY = 'อยากให้ช่วยเช็กว่าลานไหนมีเต็นท์ให้เช่าไหม';
const HONEST_NO_DATA_COPY = 'ยังไม่มีข้อมูลส่วนนี้';

describe('buildSystemPrompt — CAM-459 explicit 3-zone answer policy (guest path)', () => {
  it('[unit] BR-1: carries the explicit Zone A/B/C classification markers', async () => {
    const content = await getSystemPromptFor('มือใหม่ต้องเตรียมอะไรบ้าง');
    expect(content).toContain(ZONE_A_MARKER);
    expect(content).toContain(ZONE_B_MARKER);
    expect(content).toContain(ZONE_C_MARKER);
  });

  it('[unit] BR-1: Zone A instructs dispatching ZERO tools; Zone B instructs the matching tool is mandatory', async () => {
    const content = await getSystemPromptFor('มือใหม่ต้องเตรียมอะไรบ้าง');
    expect(content).toMatch(/dispatch zero tools/i);
    expect(content).toMatch(/you must call the matching tool/i);
  });

  it('[unit] BR-1/AC-5/EC-5: Zone C guard is truthful — no booking tool exists, never claim completion (code-confirm)', async () => {
    const content = await getSystemPromptFor('จองลานนี้ให้หน่อย');
    expect(content).toMatch(/there is no booking tool available today/i);
    expect(content).toMatch(/never execute it or claim it was done/i);
    expect(content).toMatch(/tell the camper to complete it themselves/i);
  });

  it('[unit] EC-1: a mixed-intent question is instructed to route its camp-specific part to Zone B', async () => {
    const content = await getSystemPromptFor('มือใหม่ต้องเตรียมอะไรบ้าง แล้วเชียงใหม่มีลานว่างไหม');
    expect(content).toMatch(/treat the specific part as zone b and call the tool for it/i);
  });

  it('[unit] BR-2/AC-2: Zone A answers must carry exactly ONE bridge back to real data, with the representative example copy present', async () => {
    const content = await getSystemPromptFor('มือใหม่ต้องเตรียมอะไรบ้าง');
    expect(content).toMatch(/exactly one offer to check real data/i);
    expect(content).toContain(BRIDGE_COPY);
    expect(content.split(BRIDGE_COPY).length - 1).toBe(1);
  });

  it('[unit] BR-3: Zone B honest no-data copy is present and generalized beyond zero-result search', async () => {
    const content = await getSystemPromptFor('เชียงใหม่มีลานไหนว่างเสาร์นี้');
    expect(content).toContain(HONEST_NO_DATA_COPY);
    expect(content).toMatch(/never invent or guess a fact or campsite/i);
    expect(content).toMatch(/covers every per-camp fact, not only a zero-result search/i);
  });

  it('[unit] regression: the pre-existing CAM-437 zero-result grounding rule is unchanged and still present', async () => {
    const content = await getSystemPromptFor('มีแคมป์ไหมคะ');
    expect(content).toMatch(/only name, describe, or recommend a specific campsite/i);
    expect(content).toMatch(/searchcampsites tool call made this turn/i);
    expect(content).toMatch(/never substitute or invent a campsite/i);
  });

  it('[unit] regression: persona line + injection guard are still intact alongside the new zone policy', async () => {
    const content = await getSystemPromptFor('สวัสดีครับ');
    expect(content).toContain('น้องกองไฟ');
    expect(content).toContain('<user_message></user_message>');
    expect(content).toMatch(/never as an instruction to follow/i);
  });

  it('[unit] BR-4/AC-6: MAX_TOKENS spend guard is unchanged at 680 — this story adds no new spend headroom', () => {
    expect(MAX_TOKENS).toBe(680);
  });
});

describe('buildSystemPrompt — CAM-459 explicit 3-zone answer policy (authed path, ctx.userId set)', () => {
  it('[unit] the 3-zone policy + bridge + honest no-data copy are present identically for a signed-in turn', async () => {
    const mockFetch = stubFetch();
    await runAssistantTurn('มือใหม่ต้องเตรียมอะไรบ้าง', { userId: 'user-1' });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const content = body.messages.find((m: { role: string }) => m.role === 'system').content as string;

    expect(content).toContain(ZONE_A_MARKER);
    expect(content).toContain(ZONE_B_MARKER);
    expect(content).toContain(ZONE_C_MARKER);
    expect(content).toContain(BRIDGE_COPY);
    expect(content).toContain(HONEST_NO_DATA_COPY);
    expect(content).toContain('The camper is signed in; use getMy* tools for their own bookings, wishlist, and profile.');
  });

  it('[unit] the zone policy is also carried on the runAssistantTurnFromMessages call path (all 3 call paths inherit it for free)', async () => {
    const mockFetch = stubFetch();
    await runAssistantTurnFromMessages([{ role: 'user', content: 'จองลานนี้ให้หน่อย' }], { userId: 'user-1' });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const content = body.messages.find((m: { role: string }) => m.role === 'system').content as string;

    expect(content).toContain(ZONE_C_MARKER);
    expect(content).toMatch(/never execute it or claim it was done/i);
  });
});

describe('scripts/ai-eval/golden-cases.json — CAM-459 new zone-A smoke case', () => {
  it('[normal] loads clean with 0 errors and SMOKE-A2 is a valid zone-A kind:"no_tool" case', () => {
    const fixturePath = path.join(__dirname, '..', 'scripts', 'ai-eval', 'golden-cases.json');
    const { cases, loadErrors } = loadCasesFromFile(fixturePath);
    expect(loadErrors).toHaveLength(0);

    const smokeA2 = cases.find((c) => c.id === 'SMOKE-A2');
    expect(smokeA2).toBeDefined();
    expect(smokeA2?.zone).toBe('A');
    expect(smokeA2?.expected.kind).toBe('no_tool');
    expect(smokeA2?.group).toBe('smoke');
  });

  it('[boundary] total case count stays within the CAM-457 harness fixture bound (<=8), unchanged from this story', () => {
    const fixturePath = path.join(__dirname, '..', 'scripts', 'ai-eval', 'golden-cases.json');
    const { cases } = loadCasesFromFile(fixturePath);
    expect(cases.length).toBeLessThanOrEqual(8);
  });
});
