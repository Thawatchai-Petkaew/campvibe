/**
 * CAM-457 (tech.md §1) — replays ONE golden case through the REAL bounded
 * agent loop (BR-4: "REPLAYED, never re-implemented"). Deliberately carries
 * NO `vi.mock` calls of its own — those live only in the entrypoint that
 * collects this module as part of a Vitest spec file (`run.eval.ts` for the
 * real-model run; the harness's own unit test for the mocked-fetch tests),
 * which is what lets this same file be imported from either without any
 * mock-registration conflict.
 *
 * The caller owns resetting + reading the mocked `dispatchTool`'s observed
 * calls around this function (tech.md §1: "Reset `observed = []` per case
 * before each replay") — this module has zero knowledge of the mock.
 */
import { runAssistantTurn, runAssistantTurnFromMessages, type AssistantTurnResult } from '@/lib/ai/openrouter-client';
import { buildTurnMessages } from '@/lib/ai/build-turn-messages';
import type { ToolContext } from '@/lib/ai/tool-registry';
import type { GoldenCase } from './case-schema';

/** tech.md §4 `auth` addition to BR-1 — authed cases run with a synthetic userId so authed-tier getMy* tools are offered and dispatchTool won't reject them; absent/false = guest ctx={} (default, matches prod). */
export function contextForCase(kase: GoldenCase): ToolContext {
  return kase.auth ? { userId: 'eval-user' } : {};
}

/**
 * Single-utterance case -> `runAssistantTurn`. Ordered prior-turn (context)
 * case -> build the prod-identical `TurnMessage[]` via the real
 * `buildTurnMessages`, then `runAssistantTurnFromMessages` — never a
 * hand-rolled message array.
 */
export async function replayCase(kase: GoldenCase): Promise<AssistantTurnResult> {
  const ctx = contextForCase(kase);
  if (typeof kase.utterance === 'string') {
    return runAssistantTurn(kase.utterance, ctx);
  }
  const turnMessages = buildTurnMessages(kase.utterance);
  return runAssistantTurnFromMessages(turnMessages, ctx);
}
