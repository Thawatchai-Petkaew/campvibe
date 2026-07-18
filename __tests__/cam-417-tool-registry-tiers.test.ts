/**
 * CAM-417 (ADR-013 D5) — tiered tool registry + server-bound ToolContext.
 *
 * Coverage matrix:
 *   - normal: getRegisteredTools('guest') returns only guest-tier tools; a
 *     session ctx composes guest+authed (the caller's job, exercised via
 *     openrouter-client's buildToolSchemas — asserted at the unit level here
 *     as "each tier call returns exactly that tier's tools")
 *   - error/validation: dispatchTool refuses an `authed`-tier tool when
 *     `ctx.userId` is absent — execute() never runs (defense-in-depth)
 *   - error/validation: a hallucinated tool name that was NEVER registered at
 *     all (guest calling an authed-sounding name no tool actually owns)
 *     resolves as `unknown_tool`, distinct from the authz refusal above
 *   - normal: an authed-tier tool WITH ctx.userId executes and receives ctx
 *   - security invariant (ADR-013 D3/D6 Confirmation): no tool in the WHOLE
 *     real registry exposes `userId` (or any caller-identity field) in its
 *     zod `parameters` or its `jsonSchema` — the model can never see, set,
 *     or forge a caller identity.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z, ZodObject } from 'zod';
import {
  registerTool,
  dispatchTool,
  getRegisteredTools,
  _resetRegistryForTests,
  type ToolDefinition,
} from '@/lib/ai/tool-registry';

const fakeArgsSchema = z.object({ id: z.string().uuid() });
type FakeArgs = z.infer<typeof fakeArgsSchema>;

function makeFakeTool(
  name: string,
  tier: 'guest' | 'authed',
  execute: (args: FakeArgs, ctx: { userId?: string }) => Promise<{ echoed: string }>
): ToolDefinition<FakeArgs, { echoed: string }> {
  return {
    name,
    description: `a fake ${tier} tool for tier tests`,
    tier,
    parameters: fakeArgsSchema,
    jsonSchema: { type: 'object', properties: { id: { type: 'string' } } },
    execute,
  };
}

const VALID_ARGS = { id: '123e4567-e89b-12d3-a456-426614174000' };

beforeEach(() => {
  _resetRegistryForTests();
});

describe('getRegisteredTools(tier) — tier filtering', () => {
  it('[unit] returns only guest-tier tools when called with "guest"', () => {
    registerTool(makeFakeTool('fakeGuestTool', 'guest', vi.fn()));
    registerTool(makeFakeTool('fakeAuthedTool', 'authed', vi.fn()));

    const guestTools = getRegisteredTools('guest');

    expect(guestTools.map((t) => t.name)).toEqual(['fakeGuestTool']);
  });

  it('[unit] returns only authed-tier tools when called with "authed"', () => {
    registerTool(makeFakeTool('fakeGuestTool', 'guest', vi.fn()));
    registerTool(makeFakeTool('fakeAuthedTool', 'authed', vi.fn()));

    const authedTools = getRegisteredTools('authed');

    expect(authedTools.map((t) => t.name)).toEqual(['fakeAuthedTool']);
  });

  it('[null/empty] returns [] for a tier with nothing registered', () => {
    registerTool(makeFakeTool('fakeGuestTool', 'guest', vi.fn()));

    expect(getRegisteredTools('authed')).toEqual([]);
  });
});

describe('dispatchTool — authed tool without ctx.userId is refused (CAM-417 defense-in-depth)', () => {
  it('[unit] returns { ok:false, code:"unauthorized_tool" }, execute() never called', async () => {
    const execute = vi.fn();
    registerTool(makeFakeTool('fakeAuthedTool', 'authed', execute));

    const result = await dispatchTool('fakeAuthedTool', VALID_ARGS, {});

    expect(result).toEqual({ ok: false, code: 'unauthorized_tool', message: expect.any(String) });
    expect(execute).not.toHaveBeenCalled();
  });

  it('[unit] the SAME refusal fires when no ctx is passed at all (default {})', async () => {
    const execute = vi.fn();
    registerTool(makeFakeTool('fakeAuthedTool', 'authed', execute));

    const result = await dispatchTool('fakeAuthedTool', VALID_ARGS);

    expect(result).toEqual({ ok: false, code: 'unauthorized_tool', message: expect.any(String) });
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('dispatchTool — authed tool WITH ctx.userId executes normally', () => {
  it('[unit] executes and receives the ctx unchanged', async () => {
    const execute = vi.fn().mockResolvedValue({ echoed: 'hi' });
    registerTool(makeFakeTool('fakeAuthedTool', 'authed', execute));

    const result = await dispatchTool('fakeAuthedTool', VALID_ARGS, { userId: 'user-1' });

    expect(result).toEqual({ ok: true, data: { echoed: 'hi' } });
    expect(execute).toHaveBeenCalledWith(VALID_ARGS, { userId: 'user-1' });
  });
});

describe('dispatchTool — hallucinated tool name never registered (distinct from the authz refusal)', () => {
  it('[unit] a guest calling a plausible authed-sounding name that no tool owns gets unknown_tool, not unauthorized_tool', async () => {
    // Only a guest tool is registered — "getMyBookings" is a name a model
    // could plausibly hallucinate (it is the real CAM-418 personal-tool
    // name) but does not exist in THIS registry at all.
    registerTool(makeFakeTool('fakeGuestTool', 'guest', vi.fn()));

    const result = await dispatchTool('getMyBookings', {}, {});

    expect(result).toEqual({ ok: false, code: 'unknown_tool', message: expect.any(String) });
  });
});

describe('CAM-417 invariant — no tool exposes userId (or any identity field) to the model', () => {
  it('[security] every REAL registered tool (guest + authed) has no "userId" in its jsonSchema or its zod parameters shape', async () => {
    // Import the real side-effect module that registers the shipped tools
    // (searchCampsites, checkAvailability) into the SAME module-level registry
    // this test file's beforeEach reset also targets — re-import after reset
    // so the real tools are present for this one assertion.
    await import('@/lib/ai/tools/index');

    const allTools = [...getRegisteredTools('guest'), ...getRegisteredTools('authed')];
    expect(allTools.length).toBeGreaterThan(0); // guard: the invariant is meaningless over an empty registry

    for (const tool of allTools) {
      // jsonSchema: no property named "userId" anywhere in the schema tree.
      const jsonSchemaText = JSON.stringify(tool.jsonSchema);
      expect(jsonSchemaText, `${tool.name}.jsonSchema must not mention userId`).not.toContain('"userId"');

      // zod parameters: for an object schema, the shape's keys must not include "userId".
      if (tool.parameters instanceof ZodObject) {
        const keys = Object.keys(tool.parameters.shape as Record<string, unknown>);
        expect(keys, `${tool.name}.parameters must not accept a userId field`).not.toContain('userId');
      }
    }
  });
});
