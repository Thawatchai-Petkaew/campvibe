/**
 * CAM-270 AC-3/AC-4, BR-3 — lib/ai/tool-registry.ts
 *
 * Coverage matrix:
 *   - normal: a registered tool with valid args executes and returns { ok:true, data }
 *   - error/validation: invalid args (fails the tool's own zod schema) → rejected, execute() never called
 *   - error/validation: unknown tool name → rejected, no tool's execute() is ever reached
 *   - null/empty: malformed (undefined) args from unparseable model JSON → treated as invalid args
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import {
  registerTool,
  dispatchTool,
  getRegisteredTools,
  _resetRegistryForTests,
  type ToolDefinition,
} from '@/lib/ai/tool-registry';

const fakeArgsSchema = z.object({ id: z.string().uuid() });
type FakeArgs = z.infer<typeof fakeArgsSchema>;

function makeFakeTool(execute: (args: FakeArgs) => Promise<{ echoed: string }>): ToolDefinition<FakeArgs, { echoed: string }> {
  return {
    name: 'fakeTool',
    description: 'a fake read-only tool for registry tests',
    parameters: fakeArgsSchema,
    jsonSchema: { type: 'object', properties: { id: { type: 'string' } } },
    execute,
  };
}

beforeEach(() => {
  _resetRegistryForTests();
});

describe('dispatchTool — normal (valid args, registered tool)', () => {
  it('[unit] executes the tool and returns { ok:true, data }', async () => {
    const execute = vi.fn().mockResolvedValue({ echoed: 'hi' });
    registerTool(makeFakeTool(execute));

    const result = await dispatchTool('fakeTool', { id: '123e4567-e89b-12d3-a456-426614174000' });

    expect(result).toEqual({ ok: true, data: { echoed: 'hi' } });
    expect(execute).toHaveBeenCalledWith({ id: '123e4567-e89b-12d3-a456-426614174000' });
  });

  it('[unit] getRegisteredTools lists every registered tool', () => {
    registerTool(makeFakeTool(vi.fn()));
    const tools = getRegisteredTools();
    expect(tools.map((t) => t.name)).toEqual(['fakeTool']);
  });
});

describe('dispatchTool — invalid args (AC-3, EC-2)', () => {
  it('[unit] rejects args that fail the zod schema, execute() never called', async () => {
    const execute = vi.fn();
    registerTool(makeFakeTool(execute));

    const result = await dispatchTool('fakeTool', { id: 'not-a-uuid' });

    expect(result).toEqual({ ok: false, code: 'invalid_args', message: expect.any(String) });
    expect(execute).not.toHaveBeenCalled();
  });

  it('[unit] rejects missing required args, execute() never called', async () => {
    const execute = vi.fn();
    registerTool(makeFakeTool(execute));

    const result = await dispatchTool('fakeTool', {});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_args');
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('dispatchTool — malformed/undefined args (EC-7, model returned unparseable JSON)', () => {
  it('[unit] treats args:undefined as invalid, no execution', async () => {
    const execute = vi.fn();
    registerTool(makeFakeTool(execute));

    const result = await dispatchTool('fakeTool', undefined);

    expect(result).toEqual({ ok: false, code: 'invalid_args', message: expect.any(String) });
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('dispatchTool — unknown tool name (AC-4, EC-3)', () => {
  it('[unit] rejects an unregistered tool name with no DB/side-effect', async () => {
    // registry is empty (reset in beforeEach) — nothing registered at all
    const result = await dispatchTool('doesNotExist', { anything: true });
    expect(result).toEqual({ ok: false, code: 'unknown_tool', message: expect.any(String) });
  });

  it('[unit] a registered tool of a different name is never reached for an unknown request', async () => {
    const execute = vi.fn();
    registerTool(makeFakeTool(execute));

    const result = await dispatchTool('otherTool', { id: '123e4567-e89b-12d3-a456-426614174000' });

    expect(result).toEqual({ ok: false, code: 'unknown_tool', message: expect.any(String) });
    expect(execute).not.toHaveBeenCalled();
  });
});
