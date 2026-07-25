/**
 * CAM-457 (tech.md §1/§4/§5) — the REAL-model eval entrypoint. Only ever
 * runs via `npm run ai:eval` (`vitest run --config vitest.eval.config.ts`);
 * the default `vitest.config.ts` (`include: ['**\/*.test.ts']`) never picks
 * up this `*.eval.ts` file, so `npm test`/CI's quality-gate makes ZERO
 * model spend from this file (decision 4 Confirmation).
 *
 * `server-only` is a Next-bundler-only package, unresolvable outside
 * Next/Vitest (tech.md §1.1) — stubbed so `lib/ai/openrouter-client.ts`
 * (imported transitively via `replay-case.ts`) can load under plain Vitest.
 * `dispatchTool` is replaced with a recording mock — the byte-identical
 * `vi.mock` idiom `__tests__/cam-416-agent-loop.test.ts` already uses
 * (BR-4): real model call, mocked EXECUTION only. `...actual` keeps
 * `getRegisteredTools`/`registerTool` real, so the model sees the identical
 * tool schemas prod offers — only tool EXECUTION is intercepted, never the
 * model's tool-choice surface.
 */
import { describe, it, vi, expect } from 'vitest';
import path from 'node:path';

vi.mock('server-only', () => ({}));

interface Dispatched {
  name: string;
  args: unknown;
}
let observed: Dispatched[] = [];

/**
 * Eval-fidelity fix (availability tail): the mock must hand back a *chainable*
 * result for the name->id resolve step, or a single-turn "is <named camp>
 * available on <date>?" can never reach `checkAvailability` INSIDE the harness.
 * `checkAvailability` requires a `campSiteId` (uuid); with a camp referenced by
 * NAME and no seeded shown-result, the model's correct first move is
 * `searchCampsites(keyword=<name>)` to resolve name->id, then chain to
 * `checkAvailability(campSiteId=<resolved>)`. When every tool returns empty
 * `data: {}`, that chain is starved — the model gets no id back, so
 * `checkAvailability` is unreachable here even though it chains fine in
 * production (where searchCampsites returns real cards). Returning ONE minimal
 * card with a stable uuid restores production-identical chaining.
 *
 * Blast radius is nil: `scoreCase` scans the WHOLE dispatched sequence with
 * `.find()`, so a longer chain can never drop an already-expected match, and a
 * matched call's own params are recorded at call-time — canned data only ever
 * influences a SUBSEQUENT model call, never the params of the call that
 * matched. That covers every case shape: a `no_tool` guardrail dispatches
 * nothing so the mock is never invoked; a `tool`-kind (strictParams) guardrail
 * DOES invoke the mock on its first call, but that first call's params — the
 * ones scored — are already captured before the canned data is returned. Only
 * `searchCampsites` is made chainable — the exact starved step — every other
 * tool keeps the neutral `{}`.
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

import { DEFAULT_MODEL } from '@/lib/ai/openrouter-client';
import { planEvalRun } from './plan-run';
import { replayCase } from './replay-case';
import {
  scoreCase,
  errorResult,
  computeRollup,
  computeGroupRollups,
  computeZoneRollups,
  TOOL_CALL_CORRECTNESS_THRESHOLD,
  GUARDRAIL_THRESHOLD,
  type CaseResult,
} from './score';
import { writeReports } from './report';

const FIXTURE_PATH = path.join(__dirname, 'golden-cases.json');
const REPORT_DIR = path.join(
  'docs/specs/ai-assistant/assistant-answers-real-camper-asks-gap-closure-w1',
  'CAM-457-eval-harness-golden-cases-gate-assistant-changes'
);

/** BR-8 — the evaluated model is pinned via OPENROUTER_MODEL (env) and recorded in the report header; a baseline is comparable only against the SAME model. */
function resolveModelForReport(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

describe('AI eval harness (CAM-457) — advisory real-model replay', () => {
  it(
    '[eval] replays the golden-case fixture through the real agent loop (self-skips / refuses per the guards, never fails on below-threshold)',
    async () => {
      const plan = planEvalRun(FIXTURE_PATH);

      if (plan.action === 'skip') {
        // BR-5/AC-5/EC-4 — loud, named-var notice; exits success (Vitest's
        // own passing test IS the "exit success" here); zero network calls
        // ever made (nothing below this branch runs).
        console.warn(plan.notice);
        return;
      }

      if (plan.action === 'refuse') {
        // BR-7/CAM-344 — the ONE case the eval hard-fails: a safety refusal,
        // distinct from below-threshold (which stays advisory below).
        console.error(`::error::${plan.message}`);
        throw new Error(plan.message);
      }

      const { cases, loadErrors } = plan;
      const results: CaseResult[] = [];

      for (const kase of cases) {
        observed = []; // tech.md §1 — reset per case before each replay.
        const turnResult = await replayCase(kase);
        const dispatched = observed.map((o) => ({ tool: o.name, args: o.args }));

        if (!turnResult.ok) {
          // EC-3 — a model-call error is its own bucket, kept in the
          // denominator, never silently dropped.
          results.push(errorResult(kase, dispatched, `model call failed: ${turnResult.error ?? 'unknown'}`));
          continue;
        }
        results.push(scoreCase(kase, dispatched));
      }

      const overall = computeRollup(results);
      const report = {
        header: {
          model: resolveModelForReport(),
          generatedAt: new Date().toISOString(),
          gitSha: process.env.GITHUB_SHA?.slice(0, 7) ?? 'local',
          caseCount: cases.length,
          thresholds: { toolCallCorrectness: TOOL_CALL_CORRECTNESS_THRESHOLD, guardrail: GUARDRAIL_THRESHOLD },
        },
        rollups: {
          overall,
          byGroup: computeGroupRollups(results),
          byZone: computeZoneRollups(results),
        },
        cases: results,
        loadErrors,
      };

      writeReports(REPORT_DIR, report);
      console.log(`::notice::AI eval RAN: ${cases.length} cases, verdict ${overall.verdict}`);

      // AC-6/BR-6 — advisory: below-threshold NEVER fails this test; this
      // only proves the run completed and produced a verdict.
      expect(overall.verdict).toBeDefined();
    }
    // CAM-476 — NO inline 3rd-arg timeout here. Vitest's per-test 3rd-arg
    // timeout OVERRIDES the config `testTimeout`, so the inline 120_000 that
    // lived here silently kept the effective timeout at 120s even after #552
    // raised `vitest.eval.config.ts` testTimeout to 1_200_000 (a no-op) — the
    // real-model run over the full corpus needs >120s and was killed before
    // writeReports. The config is now the SINGLE source of truth; never
    // re-add an inline timeout that can drift from it.
  );
});
