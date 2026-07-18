/**
 * CAM-270 — safe, read-only AI tool layer (ADR-009: tool-use over normalized
 * data). This registry is the ONLY place a model's tool-call request touches
 * real code: every call is looked up by name, its arguments are zod-validated
 * BEFORE execution, and an unknown tool / invalid args are rejected with NO
 * DB query and NO side-effect (BR-3, AC-3, AC-4, EC-2, EC-3, EC-7 — malformed
 * tool-call JSON from the model is untrusted output, treated identically to
 * an invalid-args rejection).
 */
import { z } from 'zod';

export interface ToolDefinition<TArgs = unknown, TResult = unknown> {
  /** Exact name the model must request (also the JSON-schema `function.name`). */
  name: string;
  /** Shown to the model in the tool schema — what the tool does. */
  description: string;
  /** zod schema every incoming arg object is validated against before execute() runs. */
  parameters: z.ZodType<TArgs>;
  /** Hand-written JSON Schema describing `parameters` for the OpenRouter tools array. */
  jsonSchema: Record<string, unknown>;
  /** READ-ONLY implementation. Only ever called with args that already passed `parameters.safeParse`. */
  execute: (args: TArgs) => Promise<TResult>;
}

export type ToolDispatchResult =
  | { ok: true; data: unknown }
  | { ok: false; code: 'unknown_tool' | 'invalid_args'; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- registry is intentionally heterogeneous; each entry's own generics are correct at registration time
const registry = new Map<string, ToolDefinition<any, any>>();

/** Register a tool. Called once per tool at module load (see lib/ai/tools/index.ts). */
export function registerTool<TArgs, TResult>(tool: ToolDefinition<TArgs, TResult>): void {
  registry.set(tool.name, tool);
}

/** Test-only: reset the registry between test files that register their own fakes. */
export function _resetRegistryForTests(): void {
  registry.clear();
}

/** The full set of registered tools, for building the OpenRouter `tools` array. */
export function getRegisteredTools(): ToolDefinition[] {
  return Array.from(registry.values());
}

/**
 * Validate + execute a model-requested tool call (BR-3).
 *  - unknown tool name → { ok:false, code:'unknown_tool' }, no execution
 *  - args fail the tool's own zod schema (or are malformed JSON, passed here
 *    as `undefined`/an unparseable shape) → { ok:false, code:'invalid_args' },
 *    no execution
 *  - otherwise → the tool's own `execute()` result, wrapped { ok:true, data }
 */
export async function dispatchTool(name: string, rawArgs: unknown): Promise<ToolDispatchResult> {
  const tool = registry.get(name);
  if (!tool) {
    return { ok: false, code: 'unknown_tool', message: `Unknown tool: ${name}` };
  }

  const parsed = tool.parameters.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, code: 'invalid_args', message: 'Tool arguments failed validation' };
  }

  const data = await tool.execute(parsed.data);
  return { ok: true, data };
}
