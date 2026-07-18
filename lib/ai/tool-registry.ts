/**
 * CAM-270 — safe, read-only AI tool layer (ADR-009: tool-use over normalized
 * data). This registry is the ONLY place a model's tool-call request touches
 * real code: every call is looked up by name, its arguments are zod-validated
 * BEFORE execution, and an unknown tool / invalid args are rejected with NO
 * DB query and NO side-effect (BR-3, AC-3, AC-4, EC-2, EC-3, EC-7 — malformed
 * tool-call JSON from the model is untrusted output, treated identically to
 * an invalid-args rejection).
 *
 * CAM-417 (ADR-013 D5) — tiered registry + server-bound identity:
 *  - Every tool now carries a `tier` (`'guest' | 'authed'`, a union left open
 *    for a future `'write'` seam — no write machinery is added here).
 *    `getRegisteredTools(tier)` returns ONLY that tier's tools; the caller
 *    (openrouter-client.ts) composes guest+authed when a session exists.
 *  - `ToolContext` is the ONLY way a tool's `execute()` learns who is
 *    asking. `userId` is built server-side from the NextAuth session per
 *    request — it is NEVER a field in any tool's zod `parameters` or
 *    `jsonSchema`, so the model can never see, set, or forge a caller
 *    identity (OWASP excessive-agency control point; the D3/D6 ADR-013
 *    Confirmation invariant).
 *  - `dispatchTool` REFUSES an `authed`-tier tool when `ctx.userId` is
 *    absent — defense-in-depth on top of the tier-filtered schema list: even
 *    if a model hallucinates a call to a tool it was never offered, the
 *    dispatcher itself still enforces the tier, never relying solely on
 *    "the model wasn't shown the schema."
 *  - This story wires the plumbing only — no personal (`authed`-tier) tool
 *    is added yet (CAM-418/419) and the chat route does not yet read
 *    `auth()` (CAM-420), so every real request today still resolves to
 *    `ctx = {}` (guest) end-to-end. Behavior on the wire is unchanged.
 */
import { z } from 'zod';

/** Left open for a future `'write'` tier (ADR-013 D5) — not implemented here. */
export type ToolTier = 'guest' | 'authed';

/**
 * Built server-side from the NextAuth session for the current request —
 * NEVER derived from client input and NEVER a parameter in any tool's zod
 * schema. `userId` absent means "no session" (guest).
 */
export interface ToolContext {
  userId?: string;
}

export interface ToolDefinition<TArgs = unknown, TResult = unknown> {
  /** Exact name the model must request (also the JSON-schema `function.name`). */
  name: string;
  /** Shown to the model in the tool schema — what the tool does. */
  description: string;
  /** Which callers ever see this tool offered: guest (always) or authed (session required). */
  tier: ToolTier;
  /** zod schema every incoming arg object is validated against before execute() runs. */
  parameters: z.ZodType<TArgs>;
  /** Hand-written JSON Schema describing `parameters` for the OpenRouter tools array. */
  jsonSchema: Record<string, unknown>;
  /** READ-ONLY implementation. Only ever called with args that already passed `parameters.safeParse`. `ctx` is server-bound identity — never model-supplied. */
  execute: (args: TArgs, ctx: ToolContext) => Promise<TResult>;
}

export type ToolDispatchResult =
  | { ok: true; data: unknown }
  | { ok: false; code: 'unknown_tool' | 'invalid_args' | 'unauthorized_tool'; message: string };

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

/**
 * The tools registered at exactly this tier — for building the OpenRouter
 * `tools` array for that tier. Callers compose tiers themselves (e.g. an
 * authed request offers `getRegisteredTools('guest')` + `getRegisteredTools('authed')`);
 * this function never returns tools from a different tier.
 */
export function getRegisteredTools(tier: ToolTier): ToolDefinition[] {
  return Array.from(registry.values()).filter((tool) => tool.tier === tier);
}

/**
 * Validate + execute a model-requested tool call (BR-3). `ctx` defaults to
 * `{}` (guest, no identity) — every real caller today passes no ctx, so the
 * default is the ONLY path exercised end-to-end until CAM-420 wires `auth()`
 * into the route.
 *  - unknown tool name → { ok:false, code:'unknown_tool' }, no execution
 *  - an `authed`-tier tool requested without `ctx.userId` → { ok:false,
 *    code:'unauthorized_tool' }, no execution (CAM-417 defense-in-depth —
 *    holds even if the tool was never offered to this caller's tier list)
 *  - args fail the tool's own zod schema (or are malformed JSON, passed here
 *    as `undefined`/an unparseable shape) → { ok:false, code:'invalid_args' },
 *    no execution
 *  - otherwise → the tool's own `execute()` result, wrapped { ok:true, data }
 */
export async function dispatchTool(
  name: string,
  rawArgs: unknown,
  ctx: ToolContext = {}
): Promise<ToolDispatchResult> {
  const tool = registry.get(name);
  if (!tool) {
    return { ok: false, code: 'unknown_tool', message: `Unknown tool: ${name}` };
  }

  if (tool.tier === 'authed' && !ctx.userId) {
    return { ok: false, code: 'unauthorized_tool', message: 'This tool requires an authenticated session' };
  }

  const parsed = tool.parameters.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, code: 'invalid_args', message: 'Tool arguments failed validation' };
  }

  const data = await tool.execute(parsed.data, ctx);
  return { ok: true, data };
}
