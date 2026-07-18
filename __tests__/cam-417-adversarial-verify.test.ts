/**
 * CAM-417 (ADR-013 D5) — independent adversarial QA verify (fresh-context) of
 * the tiered tool registry's excessive-agency control point. The shipped
 * suites (__tests__/cam-417-tool-registry-tiers.test.ts,
 * __tests__/cam-270-tool-registry.test.ts, __tests__/cam-270-openrouter-client.test.ts)
 * already cover: tier filtering at the registry level, dispatchTool's
 * unauthorized_tool/unknown_tool refusals, and the no-userId invariant over
 * TODAY's two real tools. This file closes the gaps a fresh-context review
 * found — real gaps, not re-tests of the same ground:
 *
 *  (a) STRUCTURAL generalization — the shipped invariant test proves today's
 *      2 real tools are clean, but never proves the CHECK itself would catch
 *      a tool that doesn't exist yet. Registers a rogue "future" tool
 *      carrying `userId` in both its zod schema and its jsonSchema directly
 *      into the real registry (alongside the real shipped tools) and shows
 *      the same detection logic flags it BY NAME — the invariant is a
 *      property of the check, not a fixed list (EC-5).
 *  (b)+(f) WIRE-LEVEL exact isolation — cam-270-openrouter-client.test.ts's
 *      only tools-array assertion uses `arrayContaining` against a registry
 *      that has NO authed tool yet, so it can never prove an authed tool
 *      would be EXCLUDED for a guest request — the exact regression this
 *      story exists to prevent. Registers a fake guest + a fake authed tool
 *      and asserts the EXACT wire-level `tools` array sent to the model for
 *      ctx={} (default, guest — AC-1) vs ctx={userId} (AC-2), plus the
 *      no-authed-tool-registered case (EC-2).
 *  (c) END-TO-END refusal through the REAL bounded-loop engine (not the
 *      mocked-dispatchTool suite) — a model that hallucinates a tool_call
 *      for a REGISTERED authed tool while ctx stays the real production
 *      default {} must be refused by the REAL dispatchTool, the fake tool's
 *      own execute() spy never invoked, and the turn still completes with a
 *      normal answer (no crash, no leak of the refusal's internals).
 *  (g) PROVENANCE — source-inspection proof that `POST /api/ai/chat`'s
 *      LEGACY branch passes NO ctx argument at all to
 *      `runAssistantTurnFromMessages` (resolves to the {} default), and that
 *      no source file under lib/ai/** ever ASSIGNS a value into `userId`
 *      from request args/body/tool-call arguments/model output — only
 *      dispatchTool's own guard READS `ctx.userId` (which is fine and
 *      expected). CAM-420 UPDATE (2026-07-19): the route now has a SECOND,
 *      session-bound branch that legitimately DOES pass a real ctx — that is
 *      this story's whole point (D5's tiered registry finally gets a real
 *      caller). The invariant that actually matters, re-verified below: the
 *      v2 branch's `ctx.userId` can ONLY ever be `session.user.id` from
 *      `auth()` — never from the request body/args/model output.
 *
 * All tests mock `fetch` only (vi.stubGlobal) — zero real spend. `server-only`
 * is stubbed to allow importing openrouter-client.ts under Vitest's node env
 * (mirrors every sibling AI suite).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z, ZodObject } from 'zod';
import type { ToolDefinition, ToolContext } from '@/lib/ai/tool-registry';

vi.mock('server-only', () => ({}));

const { runAssistantTurn } = await import('@/lib/ai/openrouter-client');
const { registerTool, getRegisteredTools, _resetRegistryForTests } = await import('@/lib/ai/tool-registry');

const fakeArgsSchema = z.object({ echo: z.string().optional() });
type FakeArgs = z.infer<typeof fakeArgsSchema>;

function makeProbeGuestTool(
  execute: (args: FakeArgs, ctx: ToolContext) => Promise<unknown> = vi.fn().mockResolvedValue({ ran: 'guest' })
): ToolDefinition<FakeArgs, unknown> {
  return {
    name: 'probeGuestTool',
    description: 'adversarial-verify probe guest tool',
    tier: 'guest',
    parameters: fakeArgsSchema,
    jsonSchema: { type: 'object', properties: { echo: { type: 'string' } } },
    execute,
  };
}

function makeProbeAuthedTool(
  execute: (args: FakeArgs, ctx: ToolContext) => Promise<unknown> = vi.fn().mockResolvedValue({ ran: 'authed' })
): ToolDefinition<FakeArgs, unknown> {
  return {
    name: 'probeAuthedTool',
    description: 'adversarial-verify probe authed tool',
    tier: 'authed',
    parameters: fakeArgsSchema,
    jsonSchema: { type: 'object', properties: { echo: { type: 'string' } } },
    execute,
  };
}

function res(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function assistantMessage(content: string | null, toolCalls?: unknown[]) {
  return { choices: [{ message: { role: 'assistant', content, tool_calls: toolCalls } }] };
}

function toolNamesFromFirstCall(mockFetch: { mock: { calls: unknown[][] } }): string[] {
  const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(init.body as string) as { tools: Array<{ function: { name: string } }> };
  return body.tools.map((t) => t.function.name);
}

/* -------------------------------------------------------------------------- */
/* (a) structural generalization                                              */
/* -------------------------------------------------------------------------- */

describe('(a) the no-userId invariant is a property of the CHECK, not a fixed list of today\'s tools', () => {
  it('[security] a rogue future tool carrying userId in BOTH its zod schema and jsonSchema is flagged by name, alongside the real shipped tools staying clean', () => {
    // The real shipped tools (searchCampsites, checkAvailability) are already
    // registered — openrouter-client.ts's own side-effect import of
    // lib/ai/tools/index ran once at this file's module-load time (top of
    // file), before this test. Explicit precondition, not an assumption.
    const before = getRegisteredTools('guest').map((t) => t.name);
    expect(before).toEqual(expect.arrayContaining(['searchCampsites', 'checkAvailability']));

    const rogueSchema = z.object({ userId: z.string(), campSiteId: z.string() });
    const rogueTool: ToolDefinition<z.infer<typeof rogueSchema>, unknown> = {
      name: 'rogueFutureTool',
      description: 'a hypothetical CAM-418+ tool that leaks userId by mistake (EC-5)',
      tier: 'guest',
      parameters: rogueSchema,
      jsonSchema: { type: 'object', properties: { userId: { type: 'string' }, campSiteId: { type: 'string' } } },
      execute: async () => ({}),
    };
    registerTool(rogueTool);

    const allTools = [...getRegisteredTools('guest'), ...getRegisteredTools('authed')];
    const leaking = allTools.filter((tool) => {
      const jsonLeaks = JSON.stringify(tool.jsonSchema).includes('"userId"');
      const zodLeaks = tool.parameters instanceof ZodObject && Object.keys(tool.parameters.shape).includes('userId');
      return jsonLeaks || zodLeaks;
    });

    // The check catches EXACTLY the rogue tool — a tool that did not exist
    // when the invariant was written — proving the detection generalizes,
    // not just "today's registry happens to be clean".
    expect(leaking.map((tool) => tool.name)).toEqual(['rogueFutureTool']);
  });
});

/* -------------------------------------------------------------------------- */
/* (b)+(f) wire-level exact tier isolation                                    */
/* -------------------------------------------------------------------------- */

describe('(b)+(f) wire-level tier isolation is EXACT — not "contains", proven with a REAL authed tool present', () => {
  const FAKE_KEY = 'sk-or-test-adversarial-417';

  beforeEach(() => {
    _resetRegistryForTests();
    process.env.OPENROUTER_API_KEY = FAKE_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENROUTER_API_KEY;
  });

  it('[security] AC-1: ctx={} (the real production default) NEVER includes a registered authed tool — exact set', async () => {
    registerTool(makeProbeGuestTool());
    registerTool(makeProbeAuthedTool());
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ok')));
    vi.stubGlobal('fetch', mockFetch);

    await runAssistantTurn('hi'); // no ctx argument — the real wire path today

    expect(toolNamesFromFirstCall(mockFetch)).toEqual(['probeGuestTool']);
  });

  it('[normal] AC-2: ctx.userId set composes guest+authed — both offered, tier order preserved', async () => {
    registerTool(makeProbeGuestTool());
    registerTool(makeProbeAuthedTool());
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ok')));
    vi.stubGlobal('fetch', mockFetch);

    await runAssistantTurn('hi', { userId: 'user-1' });

    expect(toolNamesFromFirstCall(mockFetch)).toEqual(['probeGuestTool', 'probeAuthedTool']);
  });

  it('[null/empty] EC-2: an authed ctx with no authed tool registered composes to guest-only — no crash, no phantom tool', async () => {
    registerTool(makeProbeGuestTool());
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ok')));
    vi.stubGlobal('fetch', mockFetch);

    await runAssistantTurn('hi', { userId: 'user-1' });

    expect(toolNamesFromFirstCall(mockFetch)).toEqual(['probeGuestTool']);
  });
});

/* -------------------------------------------------------------------------- */
/* (c) end-to-end refusal through the REAL bounded loop (real dispatchTool)   */
/* -------------------------------------------------------------------------- */

describe('(c) a hallucinated call to a REGISTERED authed tool is refused by the REAL dispatchTool inside the bounded loop', () => {
  const FAKE_KEY = 'sk-or-test-adversarial-417-e2e';

  beforeEach(() => {
    _resetRegistryForTests();
    process.env.OPENROUTER_API_KEY = FAKE_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENROUTER_API_KEY;
  });

  it('[security] execute() is never invoked; the turn still completes with a normal answer, no crash, tool_call_id stays matched', async () => {
    const authedExecute = vi.fn().mockResolvedValue({ should: 'never run' });
    registerTool(makeProbeAuthedTool(authedExecute));
    registerTool(makeProbeGuestTool());

    let call = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      call++;
      if (call === 1) {
        return res(
          assistantMessage(null, [
            { id: 'call_1', type: 'function', function: { name: 'probeAuthedTool', arguments: '{}' } },
          ])
        );
      }
      return res(assistantMessage('ขอโทษค่ะ ไม่พบข้อมูลที่ต้องการ'));
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await runAssistantTurn('question'); // ctx defaults to {} — the real wire path today

    expect(authedExecute).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, answer: 'ขอโทษค่ะ ไม่พบข้อมูลที่ต้องการ', cards: [] });

    // The follow-up completion call must carry a well-formed tool message for
    // call_1 — the refusal is handled, never silently dropped (which would
    // desync the next completion's messages array).
    const [, secondInit] = mockFetch.mock.calls[1] as [string, RequestInit];
    const secondBody = JSON.parse(secondInit.body as string) as { messages: Array<{ role: string; tool_call_id?: string; content: string }> };
    const toolMsg = secondBody.messages.find((m) => m.role === 'tool' && m.tool_call_id === 'call_1');
    expect(toolMsg).toBeDefined();
    expect(JSON.parse(toolMsg!.content)).toEqual({ ok: false, code: 'unauthorized_tool', message: expect.any(String) });
  });
});

/* -------------------------------------------------------------------------- */
/* (g) provenance — ctx.userId is never derived from untrusted input          */
/* -------------------------------------------------------------------------- */

describe('(g) provenance — ctx.userId can only ever come from a server-side session, never args/body/model output', () => {
  it('[security] the LEGACY branch (handleLegacyTurn) still passes NO ctx argument to runAssistantTurnFromMessages (resolves to the {} default)', () => {
    const routeSource = readFileSync(join(process.cwd(), 'app/api/ai/chat/route.ts'), 'utf-8');
    const legacyCallMatch = routeSource.match(/runAssistantTurnFromMessages\(turnMessages\)/);
    expect(legacyCallMatch).not.toBeNull(); // exactly one argument, no ctx
  });

  it("[security] CAM-420 UPDATE: the v2 branch's ctx is built as `{ userId }` from a LOCAL `session`/`userId` binding — never from `data`/args/model output", () => {
    const routeSource = readFileSync(join(process.cwd(), 'app/api/ai/chat/route.ts'), 'utf-8');
    const v2CtxMatch = routeSource.match(/const ctx: ToolContext = \{\s*userId\s*\}/);
    expect(v2CtxMatch).not.toBeNull();
    // `userId` itself is destructured from `session?.user?.id` (auth()'s own
    // return value) earlier in the SAME function — never `data.userId` or
    // any request-body/tool-arg/model-output field.
    expect(routeSource).toMatch(/const userId = session\?\.user\?\.id/);
    expect(routeSource).not.toMatch(/userId\s*[:=]\s*data\./);
  });

  it('[security] no source file under lib/ai/** assigns a value INTO userId from args/body/model output — only dispatchTool\'s own guard READS ctx.userId', () => {
    const files = [
      'lib/ai/tool-registry.ts',
      'lib/ai/openrouter-client.ts',
      'lib/ai/tools/search-campsites.ts',
      'lib/ai/tools/check-availability.ts',
      'lib/ai/tools/index.ts',
    ];
    // A read-guard like `ctx.userId` or `!ctx.userId` is fine and expected
    // (dispatchTool's tier check, buildToolSchemas' tier composition) — the
    // defect this looks for is an ASSIGNMENT into a `userId` key sourced
    // from untrusted input (tool args, request body, parsed model output).
    const assignmentFromUntrustedInput = /userId\s*[:=]\s*(args|rawArgs|body|req\.|parsed\.data|toolCalls?|call\.function)/;
    for (const relPath of files) {
      const source = readFileSync(join(process.cwd(), relPath), 'utf-8');
      expect(source, `${relPath} must never assign a value to userId from untrusted input`).not.toMatch(
        assignmentFromUntrustedInput
      );
    }
  });
});
