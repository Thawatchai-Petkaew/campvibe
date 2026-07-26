/**
 * CAM-507 (S4b) — the BLOCKING guardrail-only real-model gate. Only ever
 * runs via `npm run ai:guardrail-gate` (`vitest run --config
 * vitest.guardrail.config.ts`); the default `vitest.config.ts`
 * (`include: ['**\/*.test.ts']`) never picks up this `*.eval.ts` file, so
 * `npm test`/CI's quality-gate makes ZERO model spend from this file
 * (mirrors CAM-457's `run.eval.ts` decision).
 *
 * Reuses the exact `dispatchTool` recording-mock idiom `run.eval.ts`
 * already established (real model call, mocked EXECUTION only — the model
 * sees the identical tool schemas prod offers) and the same
 * `replayCase`/`scoreCase` seam — this file never re-implements the agent
 * loop (Seams & refs, story.md). The retry-loop mechanics (BR-2) live in
 * the pure `guardrail-retry.ts` module, unit-tested with a STUB in
 * `__tests__/cam-507-guardrail-gate.test.ts` (zero model calls there).
 *
 * BR-3/EC-3 — INVERTS `run.eval.ts`'s advisory self-skip: a missing
 * `OPENROUTER_API_KEY` THROWS here instead of skipping (fail-closed, never
 * a silent pass on a blocking gate).
 */
import { describe, it, vi } from 'vitest';
import path from 'node:path';

vi.mock('server-only', () => ({}));

interface Dispatched {
  name: string;
  args: unknown;
}
let observed: Dispatched[] = [];

/**
 * Mirrors `run.eval.ts`'s `cannedToolData` — keeps chaining fidelity for any
 * guardrail case that legitimately dispatches `searchCampsites` (e.g. a
 * strictParams "tool"-kind guardrail asserting NO over-eager param, rather
 * than a "no_tool" guardrail). Every other tool keeps the neutral `{}`.
 */
const STABLE_EVAL_CAMP_ID = '00000000-0000-4000-8000-000000000001';
function cannedToolData(name: string): unknown {
  if (name === 'searchCampsites') {
    return { cards: [{ id: STABLE_EVAL_CAMP_ID, name: 'ตัวอย่างแคมป์', remaining: 5 }] };
  }
  return {};
}

const mockDispatchTool = vi.fn(async (name: string, args: unknown) => {
  observed.push({ name, args });
  return { ok: true, data: cannedToolData(name) };
});
vi.mock('@/lib/ai/tool-registry', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/tool-registry')>('@/lib/ai/tool-registry');
  return { ...actual, dispatchTool: (...args: unknown[]) => mockDispatchTool(...(args as [string, unknown])) };
});

import { loadCasesFromFile } from './load-cases';
import { replayCase } from './replay-case';
import { scoreCase } from './score';
import {
  assertApiKeyPresent,
  categorizeFailureReason,
  filterGuardrailCases,
  resolveGuardrailRetries,
  runWithRetry,
  type AttemptOutcome,
} from './guardrail-retry';

const FIXTURE_PATH = path.join(__dirname, 'golden-cases.json');

describe('AI guardrail gate (CAM-507) — BLOCKING real-model replay of the guardrail subset', () => {
  it('[gate] every guardrail === true case passes within its retry budget, or the gate throws (BR-4)', async () => {
    // BR-3/EC-3 — fail-closed first, before any file read or model call.
    assertApiKeyPresent(process.env);

    const { cases, loadErrors } = loadCasesFromFile(FIXTURE_PATH);
    if (loadErrors.length > 0) {
      const message = `guardrail gate: ${loadErrors.length} fixture load error(s): ${loadErrors
        .map((e) => `${e.id ?? `#${e.index}`}: ${e.message}`)
        .join('; ')}`;
      console.error(`::error::${message}`);
      throw new Error(message);
    }

    const guardrailCases = filterGuardrailCases(cases);
    if (guardrailCases.length === 0) {
      // EC-4 — a guardrail gate with nothing to guard is a misconfiguration, not a vacuous pass.
      const message =
        'guardrail gate: zero guardrail cases in the golden fixture — misconfiguration, refusing to pass vacuously';
      console.error(`::error::${message}`);
      throw new Error(message);
    }

    const retries = resolveGuardrailRetries(process.env);
    // CAM-568 (AC-2/BR-2) — one categorized summary per failing case, built
    // from the LAST attempt's reason (the one that actually exhausted the
    // retry budget), never just an id with no context.
    const failures: Array<{ id: string; category: ReturnType<typeof categorizeFailureReason>; reason: string }> = [];

    for (const kase of guardrailCases) {
      const runOnce = async (): Promise<AttemptOutcome> => {
        observed = []; // reset per attempt (mirrors tech.md §1: reset before each replay)
        const turnResult = await replayCase(kase);
        if (!turnResult.ok) {
          // EC-1 — a model-call error counts as a failed attempt, never a pass.
          return { pass: false, reason: `model call failed: ${turnResult.error ?? 'unknown'}` };
        }
        const dispatched = observed.map((o) => ({ tool: o.name, args: o.args }));
        const scored = scoreCase(kase, dispatched);
        return { pass: scored.result === 'pass', reason: scored.reason };
      };

      const outcome = await runWithRetry(runOnce, retries, (attempt, retriesUsed, reason) => {
        // EC-2 — loud, visible flake signal, never hidden.
        console.warn(
          `::warning::guardrail case "${kase.id}" recovered after ${retriesUsed} retr${retriesUsed === 1 ? 'y' : 'ies'} (attempt ${attempt}/${retries + 1}): ${reason}`
        );
      });

      if (outcome.pass) {
        console.log(`::notice::guardrail case "${kase.id}": PASS after ${outcome.attempts} attempt(s)`);
        continue;
      }

      const finalReason = outcome.reasons[outcome.reasons.length - 1] ?? 'unknown';
      const category = categorizeFailureReason(finalReason);
      failures.push({ id: kase.id, category, reason: finalReason });
      // AC-1/AC-2 — the category is right in the notice, not just "FAIL".
      console.log(
        `::notice::guardrail case "${kase.id}": FAIL after ${outcome.attempts} attempt(s) — ${category}: ${finalReason}`
      );
    }

    if (failures.length > 0) {
      const environmentalCount = failures.filter((f) => f.category === 'environmental').length;
      const behavioralCount = failures.length - environmentalCount;
      // BR-4/AC-3 — the gate fails iff any guardrail case fails every attempt;
      // BR-2 — the summary states WHICH kind of failure this is, so an
      // environmental fault is never read as an assistant regression.
      const summary =
        environmentalCount > 0 && behavioralCount > 0
          ? `${environmentalCount} environmental, ${behavioralCount} behavioral`
          : environmentalCount > 0
            ? `all ${environmentalCount} environmental (the model was never actually reached — see the ai_primary_call_failed/ai_fallback_call_failed log lines above for the real cause; this is NOT evidence of an assistant regression)`
            : `all ${behavioralCount} behavioral (the model responded but violated the guardrail)`;
      const message = `guardrail gate FAILED: ${failures.length} case(s) failed all attempts (${summary}): ${failures
        .map((f) => `${f.id} [${f.category}: ${f.reason}]`)
        .join('; ')}`;
      console.error(`::error::${message}`);
      throw new Error(message);
    }
    // BR-4/AC-2 — every guardrail case passed within its retry budget; the gate is green.
  });
});
