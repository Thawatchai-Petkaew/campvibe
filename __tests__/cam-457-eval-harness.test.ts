/**
 * CAM-457 — the eval harness's OWN unit tests. Mirrors the exact `vi.mock`
 * idiom `__tests__/cam-416-agent-loop.test.ts` uses (server-only stub +
 * dispatchTool recording mock) so this test file can dynamically import
 * `lib/ai/openrouter-client.ts` (via `scripts/ai-eval/replay-case.ts`) under
 * plain Vitest. `fetch` is STUBBED throughout (`vi.stubGlobal`) — zero real
 * spend, no real OpenRouter call ever made. Picked up by the DEFAULT
 * `vitest.config.ts` (`**\/*.test.ts`) — never by `vitest.eval.config.ts`
 * (`*.eval.ts` only), so this file never collides with `run.eval.ts`'s own
 * module-level mocks (they never share a test run).
 *
 * Coverage matrix (AC-1..AC-7 self-verify):
 *  - BR-1/EC-1  load-cases: malformed entry -> named load error, batch continues
 *  - BR-2/AC-2  score: subset match (default) + strictParams exact match
 *  - AC-3/EC-6  score: zone-A no_tool pass/fail (tool leaked)
 *  - BR-3/AC-4  score rollup: verdict PASS/REPORTING + guardrail flip
 *  - BR-5/AC-5/EC-4 guards+plan-run: self-skip prints the named var, fetch never called
 *  - BR-7/CAM-344   guards+plan-run: over-cap refused BEFORE any model call, fetch never called
 *  - BR-4/tech.md §1 replay-case (real seam): zone-A leaves `observed` empty; zone-B records {name,args}
 *  - CAM-417 tiering   replay-case: `auth:true` offers the authed tool schema; absent does not
 *  - BR-8 (CAM-484) openrouter-client (existing prod code): outgoing body carries `temperature: 0.2` (pinned)
 *  - EC-3           error bucket: a failed model call is scored as `error`, not silently dropped
 *  - tech.md §3     report: JSON + Markdown render from ONE object, numbers never diverge
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadCases, loadCasesFromFile } from '../scripts/ai-eval/load-cases';
import {
  checkApiKeyGuard,
  checkCaseCountGuard,
  resolveMaxEvalCases,
  DEFAULT_MAX_EVAL_CASES,
  API_KEY_ENV_VAR,
  MAX_CASES_ENV_VAR,
} from '../scripts/ai-eval/guards';
import { planEvalRun } from '../scripts/ai-eval/plan-run';
import {
  scoreCase,
  errorResult,
  computeRollup,
  computeGroupRollups,
  computeZoneRollups,
  TOOL_CALL_CORRECTNESS_THRESHOLD,
  GUARDRAIL_THRESHOLD,
  type CaseResult,
} from '../scripts/ai-eval/score';
import { renderJson, renderMarkdown, writeReports, type EvalReport } from '../scripts/ai-eval/report';
import type { GoldenCase } from '../scripts/ai-eval/case-schema';
import evalGlobalSetup from '../scripts/ai-eval/global-setup';

/* -------------------------------------------------------------------------- */
/* load-cases.ts (BR-1/EC-1) — pure, no mocking needed                        */
/* -------------------------------------------------------------------------- */

describe('CAM-457 load-cases — BR-1/EC-1', () => {
  it('[normal] valid fixture entries all load as cases', () => {
    const raw = [
      { id: 'a', group: 'G', zone: 'A', utterance: 'สวัสดี', expected: { kind: 'no_tool' } },
      { id: 'b', group: 'G', zone: 'B', utterance: 'หาแคมป์', expected: { kind: 'tool', tool: 'searchCampsites', params: {} } },
    ];
    const { cases, loadErrors } = loadCases(raw);
    expect(cases).toHaveLength(2);
    expect(loadErrors).toHaveLength(0);
  });

  it('[edge] EC-1 a malformed entry is a named load error; the batch continues (never a throw)', () => {
    const raw = [
      { id: 'good', group: 'G', zone: 'A', utterance: 'สวัสดี', expected: { kind: 'no_tool' } },
      { id: 'bad-missing-zone', group: 'G', utterance: 'x', expected: { kind: 'no_tool' } },
      { notEvenAnId: true },
    ];
    const { cases, loadErrors } = loadCases(raw);
    expect(cases).toHaveLength(1);
    expect(cases[0].id).toBe('good');
    expect(loadErrors).toHaveLength(2);
    expect(loadErrors[0].id).toBe('bad-missing-zone');
    expect(loadErrors[1].id).toBeUndefined();
  });

  it('[edge] a non-array fixture root is a whole-file load error, never a throw', () => {
    const { cases, loadErrors } = loadCases({ not: 'an array' });
    expect(cases).toHaveLength(0);
    expect(loadErrors).toHaveLength(1);
    expect(loadErrors[0].index).toBe(-1);
  });

  it('[edge] an unreadable/unparseable fixture FILE is a load error, never a throw', () => {
    const { cases, loadErrors } = loadCasesFromFile('/nonexistent/path/does-not-exist.json');
    expect(cases).toHaveLength(0);
    expect(loadErrors).toHaveLength(1);
    expect(loadErrors[0].message).toMatch(/failed to read\/parse/);
  });

  it('[normal] the shipped golden fixture (golden-cases.json) itself parses clean with zero load errors', () => {
    // CAM-475 — raised from the original 6-8 smoke-only ceiling to the real
    // fixture size once the full 40-case research §5 corpus was added
    // (8 retained smoke cases + 40 corpus cases, 9 of the 40 tagged
    // `group:"deferred"` for a not-yet-built capability). `DEFAULT_MAX_EVAL_CASES`
    // (guards.ts, BR-7/CAM-344 spend cap) is the real ceiling this must never
    // approach — asserted separately so a future fixture growth is caught
    // long before it risks the spend-cap guard.
    // CAM-479 — +5 single-weekday cases (group "P17") covering the F1 fix.
    // CAM-500 — +1 regression guardrail case (SMOKE-B3-NO-PROVINCE): a
    // terrain-only, no-province utterance must not have the model inject a
    // province (strictParams:true so an over-eager province param fails it).
    // CAM-501 — +2 regression guardrail cases (SMOKE-B4/B5): the P0
    // over-correction that dropped a user-named province/region must not
    // recur — the Place Resolver's mandatory hint keeps province/region set.
    const fixturePath = path.join(__dirname, '..', 'scripts', 'ai-eval', 'golden-cases.json');
    const { cases, loadErrors } = loadCasesFromFile(fixturePath);
    expect(loadErrors).toHaveLength(0);
    expect(cases.length).toBe(56);
    expect(cases.length).toBeLessThanOrEqual(DEFAULT_MAX_EVAL_CASES);
    expect(cases.some((c) => c.zone === 'A' && c.expected.kind === 'no_tool')).toBe(true);
    expect(cases.some((c) => c.guardrail === true)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Independent QA adversarial pass (CAM-457 verify) — malformed fixture rows, */
/* duplicate ids, empty file, over-cap boundary (per dispatch step 3)        */
/* -------------------------------------------------------------------------- */

describe('CAM-457 load-cases — adversarial gap-fill (QA re-derivation)', () => {
  it('[edge] duplicate case ids both load without crashing (BR-1 does not enforce id uniqueness)', () => {
    const raw = [
      { id: 'dup', group: 'G', zone: 'A', utterance: 'a', expected: { kind: 'no_tool' } },
      { id: 'dup', group: 'G', zone: 'A', utterance: 'b', expected: { kind: 'no_tool' } },
    ];
    const { cases, loadErrors } = loadCases(raw);
    expect(cases).toHaveLength(2);
    expect(loadErrors).toHaveLength(0);
    expect(cases[0].id).toBe(cases[1].id);
  });

  it('[null/empty] a valid empty-array fixture loads as zero cases with zero load errors (never a crash)', () => {
    const { cases, loadErrors } = loadCases([]);
    expect(cases).toHaveLength(0);
    expect(loadErrors).toHaveLength(0);
  });

  it('[edge] a genuinely empty (0-byte) fixture FILE is a load error, never a throw', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cam-457-empty-'));
    const emptyPath = path.join(dir, 'empty.json');
    writeFileSync(emptyPath, '');
    const { cases, loadErrors } = loadCasesFromFile(emptyPath);
    expect(cases).toHaveLength(0);
    expect(loadErrors).toHaveLength(1);
    expect(loadErrors[0].message).toMatch(/failed to read\/parse/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('[edge] an invalid `expected.kind` discriminant value is a named load error, batch continues', () => {
    const raw = [
      { id: 'bad-kind', group: 'G', zone: 'A', utterance: 'x', expected: { kind: 'bogus' } },
      { id: 'good', group: 'G', zone: 'A', utterance: 'y', expected: { kind: 'no_tool' } },
    ];
    const { cases, loadErrors } = loadCases(raw);
    expect(cases).toHaveLength(1);
    expect(cases[0].id).toBe('good');
    expect(loadErrors).toHaveLength(1);
    expect(loadErrors[0].id).toBe('bad-kind');
  });
});

/* -------------------------------------------------------------------------- */
/* guards.ts + plan-run.ts (BR-5/BR-7/CAM-344) — pure, no mocking needed       */
/* -------------------------------------------------------------------------- */

describe('CAM-457 guards — BR-5/AC-5/EC-4 self-skip', () => {
  it('[edge] unset OPENROUTER_API_KEY -> skip, notice NAMES the variable', () => {
    const result = checkApiKeyGuard({});
    expect(result.skip).toBe(true);
    if (result.skip) expect(result.notice).toContain(API_KEY_ENV_VAR);
  });

  it('[normal] a present key -> does not skip', () => {
    const result = checkApiKeyGuard({ [API_KEY_ENV_VAR]: 'sk-or-fake' });
    expect(result.skip).toBe(false);
  });
});

describe('CAM-457 global-setup — pins the loud-skip banner reaching raw stdout (EC-4 defect fix)', () => {
  const originalKey = process.env[API_KEY_ENV_VAR];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    if (originalKey === undefined) delete process.env[API_KEY_ENV_VAR];
    else process.env[API_KEY_ENV_VAR] = originalKey;
  });

  it('[edge] unset OPENROUTER_API_KEY -> globalSetup console.logs a banner naming the variable (Vitest globalSetup output is never swallowed by the default reporter, unlike a passing test\'s own console.log)', () => {
    delete process.env[API_KEY_ENV_VAR];
    evalGlobalSetup();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain(API_KEY_ENV_VAR);
  });

  it('[normal] a present key -> globalSetup logs nothing', () => {
    process.env[API_KEY_ENV_VAR] = 'sk-or-fake';
    evalGlobalSetup();
    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe('CAM-457 guards — BR-7/CAM-344 spend cap', () => {
  it('[boundary] default MAX_EVAL_CASES is 500 when unset', () => {
    expect(resolveMaxEvalCases({})).toBe(DEFAULT_MAX_EVAL_CASES);
  });

  it('[normal] a valid MAX_EVAL_CASES env override is honored', () => {
    expect(resolveMaxEvalCases({ [MAX_CASES_ENV_VAR]: '12' })).toBe(12);
  });

  it('[edge] an invalid MAX_EVAL_CASES falls back to the default', () => {
    expect(resolveMaxEvalCases({ [MAX_CASES_ENV_VAR]: 'not-a-number' })).toBe(DEFAULT_MAX_EVAL_CASES);
  });

  it('[boundary] over the cap -> refuse with a clear message', () => {
    const result = checkCaseCountGuard(501, 500);
    expect(result.refuse).toBe(true);
    if (result.refuse) expect(result.message).toMatch(/MAX_EVAL_CASES/);
  });

  it('[boundary] exactly at the cap -> does not refuse', () => {
    expect(checkCaseCountGuard(500, 500).refuse).toBe(false);
  });
});

describe('CAM-457 plan-run — composes the guards BEFORE any model call', () => {
  let dir: string;
  let fixturePath: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'cam-457-'));
    fixturePath = path.join(dir, 'cases.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('[edge] BR-5: self-skip -> action=skip, and a stubbed fetch is NEVER called', () => {
    writeFileSync(fixturePath, JSON.stringify([]));
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const plan = planEvalRun(fixturePath, {});

    expect(plan.action).toBe('skip');
    if (plan.action === 'skip') expect(plan.notice).toContain(API_KEY_ENV_VAR);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('[boundary] BR-7/CAM-344: over-cap -> action=refuse BEFORE any model call, fetch NEVER called', () => {
    writeFileSync(
      fixturePath,
      JSON.stringify([
        { id: 'a', group: 'G', zone: 'A', utterance: 'x', expected: { kind: 'no_tool' } },
        { id: 'b', group: 'G', zone: 'A', utterance: 'y', expected: { kind: 'no_tool' } },
      ])
    );
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const plan = planEvalRun(fixturePath, { [API_KEY_ENV_VAR]: 'sk-or-fake', [MAX_CASES_ENV_VAR]: '1' });

    expect(plan.action).toBe('refuse');
    if (plan.action === 'refuse') expect(plan.message).toMatch(/MAX_EVAL_CASES/);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('[normal] a valid fixture under the cap with a key present -> action=run, cases loaded', () => {
    writeFileSync(
      fixturePath,
      JSON.stringify([{ id: 'a', group: 'G', zone: 'A', utterance: 'x', expected: { kind: 'no_tool' } }])
    );
    const plan = planEvalRun(fixturePath, { [API_KEY_ENV_VAR]: 'sk-or-fake' });
    expect(plan.action).toBe('run');
    if (plan.action === 'run') {
      expect(plan.cases).toHaveLength(1);
      expect(plan.loadErrors).toHaveLength(0);
      expect(plan.maxCases).toBe(DEFAULT_MAX_EVAL_CASES);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* score.ts (BR-2/BR-3/AC-2/AC-3/AC-4/EC-6) — pure, no mocking needed          */
/* -------------------------------------------------------------------------- */

function toolCase(overrides: Partial<GoldenCase> = {}): GoldenCase {
  return {
    id: 'T1',
    group: 'G',
    zone: 'B',
    utterance: 'หาแคมป์ในเชียงใหม่',
    expected: { kind: 'tool', tool: 'searchCampsites', params: { province: 'เชียงใหม่' } },
    ...overrides,
  } as GoldenCase;
}

describe('CAM-457 score — BR-2 tool-call-correctness matching', () => {
  it('[normal] subset match (default): extra model-supplied params are tolerated', () => {
    const kase = toolCase();
    const result = scoreCase(kase, [{ tool: 'searchCampsites', args: { province: 'เชียงใหม่', petFriendly: true } }]);
    expect(result.result).toBe('pass');
  });

  it('[edge] a missing expected param key fails the match', () => {
    const kase = toolCase();
    const result = scoreCase(kase, [{ tool: 'searchCampsites', args: { petFriendly: true } }]);
    expect(result.result).toBe('fail');
  });

  it('[edge] wrong tool name fails, even with matching params', () => {
    const kase = toolCase();
    const result = scoreCase(kase, [{ tool: 'checkAvailability', args: { province: 'เชียงใหม่' } }]);
    expect(result.result).toBe('fail');
  });

  it('[normal] strictParams=true requires an EXACT key-set match', () => {
    const kase = toolCase({ expected: { kind: 'tool', tool: 'searchCampsites', params: { province: 'เชียงใหม่' }, strictParams: true } });
    const extra = scoreCase(kase, [{ tool: 'searchCampsites', args: { province: 'เชียงใหม่', keyword: 'x' } }]);
    expect(extra.result).toBe('fail');
    const exact = scoreCase(kase, [{ tool: 'searchCampsites', args: { province: 'เชียงใหม่' } }]);
    expect(exact.result).toBe('pass');
  });

  it('[normal] no tool dispatched when one was expected -> fail', () => {
    const result = scoreCase(toolCase(), []);
    expect(result.result).toBe('fail');
  });
});

describe('CAM-457 score — AC-3/EC-6 zone-A no_tool rule', () => {
  const zoneACase: GoldenCase = {
    id: 'A1',
    group: 'G',
    zone: 'A',
    utterance: 'เต็นท์คืออะไร',
    expected: { kind: 'no_tool' },
  };

  it('[normal] no tool dispatched -> pass', () => {
    expect(scoreCase(zoneACase, []).result).toBe('pass');
  });

  it('[edge] EC-6: a tool dispatched on a no_tool case -> fail, leaked tool name recorded', () => {
    const result = scoreCase(zoneACase, [{ tool: 'searchCampsites', args: {} }]);
    expect(result.result).toBe('fail');
    expect(result.reason).toContain('searchCampsites');
  });
});

describe('CAM-457 score — BR-3/AC-4 verdict + guardrail flip', () => {
  it('[normal] PASS only when both thresholds are met', () => {
    const results: CaseResult[] = Array.from({ length: 20 }, (_, i) => ({
      id: `p${i}`,
      group: 'G',
      zone: 'B' as const,
      guardrail: false,
      expected: { kind: 'no_tool' as const },
      actual: { dispatched: [] },
      result: 'pass' as const,
      reason: 'ok',
    }));
    const rollup = computeRollup(results);
    expect(rollup.toolCallCorrectnessPct).toBe(1);
    expect(rollup.guardrailPassPct).toBe(1);
    expect(rollup.verdict).toBe('PASS');
  });

  it('[edge] AC-4: a single guardrail fail flips the verdict to REPORTING even at >=95% tool-call correctness', () => {
    const nonGuardrail: CaseResult[] = Array.from({ length: 19 }, (_, i) => ({
      id: `p${i}`,
      group: 'G',
      zone: 'B' as const,
      guardrail: false,
      expected: { kind: 'no_tool' as const },
      actual: { dispatched: [] },
      result: 'pass' as const,
      reason: 'ok',
    }));
    const guardrailFail: CaseResult = {
      id: 'guard-1',
      group: 'G',
      zone: 'A',
      guardrail: true,
      expected: { kind: 'no_tool' },
      actual: { dispatched: [{ tool: 'searchCampsites', args: {} }] },
      result: 'fail',
      reason: 'leaked tool on a guardrail case',
    };
    const rollup = computeRollup([...nonGuardrail, guardrailFail]);
    expect(rollup.toolCallCorrectnessPct).toBe(1); // all non-guardrail cases passed
    expect(rollup.guardrailPassPct).toBeLessThan(GUARDRAIL_THRESHOLD);
    expect(rollup.verdict).toBe('REPORTING');
  });

  it('[normal] below the tool-call-correctness threshold -> REPORTING', () => {
    const results: CaseResult[] = [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `p${i}`, group: 'G', zone: 'B' as const, guardrail: false,
        expected: { kind: 'no_tool' as const }, actual: { dispatched: [] }, result: 'pass' as const, reason: 'ok',
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `f${i}`, group: 'G', zone: 'B' as const, guardrail: false,
        expected: { kind: 'no_tool' as const }, actual: { dispatched: [] }, result: 'fail' as const, reason: 'nope',
      })),
    ];
    const rollup = computeRollup(results);
    expect(rollup.toolCallCorrectnessPct).toBeLessThan(TOOL_CALL_CORRECTNESS_THRESHOLD);
    expect(rollup.verdict).toBe('REPORTING');
  });

  it('[normal] byGroup/byZone rollups partition correctly', () => {
    const results: CaseResult[] = [
      { id: '1', group: 'P1', zone: 'A', guardrail: false, expected: { kind: 'no_tool' }, actual: { dispatched: [] }, result: 'pass', reason: 'ok' },
      { id: '2', group: 'P1', zone: 'B', guardrail: false, expected: { kind: 'no_tool' }, actual: { dispatched: [] }, result: 'fail', reason: 'x' },
      { id: '3', group: 'P17', zone: 'B', guardrail: false, expected: { kind: 'no_tool' }, actual: { dispatched: [] }, result: 'pass', reason: 'ok' },
    ];
    const byGroup = computeGroupRollups(results);
    expect(byGroup.P1).toEqual({ pass: 1, fail: 1, error: 0, pct: 0.5 });
    expect(byGroup.P17).toEqual({ pass: 1, fail: 0, error: 0, pct: 1 });
    const byZone = computeZoneRollups(results);
    expect(byZone.A.pass).toBe(1);
    expect(byZone.B.pass).toBe(1);
    expect(byZone.B.fail).toBe(1);
  });
});

describe('CAM-457 score — BR-2 deep-equal on nested/object param values (adversarial gap-fill)', () => {
  it('[normal] a nested object param matches when every nested key/value is deep-equal', () => {
    const kase = toolCase({
      expected: { kind: 'tool', tool: 'searchCampsites', params: { filters: { minRating: 4, petFriendly: true } } },
    });
    const result = scoreCase(kase, [{ tool: 'searchCampsites', args: { filters: { minRating: 4, petFriendly: true } } }]);
    expect(result.result).toBe('pass');
  });

  it('[edge] a nested object param with one differing nested value fails the match', () => {
    const kase = toolCase({ expected: { kind: 'tool', tool: 'searchCampsites', params: { filters: { minRating: 4 } } } });
    const result = scoreCase(kase, [{ tool: 'searchCampsites', args: { filters: { minRating: 3 } } }]);
    expect(result.result).toBe('fail');
  });

  it('[edge] a type mismatch (string expected, number actual) on the same key fails the match', () => {
    const kase = toolCase({ expected: { kind: 'tool', tool: 'searchCampsites', params: { province: 'เชียงใหม่' } } });
    const result = scoreCase(kase, [{ tool: 'searchCampsites', args: { province: 123 } }]);
    expect(result.result).toBe('fail');
  });

  it('[edge] a null actual value vs a non-null object expected value fails the match', () => {
    const kase = toolCase({ expected: { kind: 'tool', tool: 'searchCampsites', params: { filters: { minRating: 4 } } } });
    const result = scoreCase(kase, [{ tool: 'searchCampsites', args: { filters: null } }]);
    expect(result.result).toBe('fail');
  });

  it('[edge] same-type differing primitive values fail the match', () => {
    const kase = toolCase({ expected: { kind: 'tool', tool: 'searchCampsites', params: { maxPrice: 500 } } });
    const result = scoreCase(kase, [{ tool: 'searchCampsites', args: { maxPrice: 900 } }]);
    expect(result.result).toBe('fail');
  });
});

describe('CAM-457 score — multiple dispatched calls + guardrail/error interaction (adversarial gap-fill)', () => {
  it('[concurrent/ordering] scoreCase finds the matching call among several dispatched tool calls, order-independent', () => {
    const kase = toolCase();
    const result = scoreCase(kase, [
      { tool: 'getMyProfile', args: {} },
      { tool: 'searchCampsites', args: { province: 'เชียงใหม่', extra: 1 } },
    ]);
    expect(result.result).toBe('pass');
  });

  it('[edge] an ERRORED guardrail case also flips the verdict (guardrailPassPct < 1.0, distinct from a guardrail fail)', () => {
    const kase = toolCase({ guardrail: true });
    const errored = errorResult(kase, [], 'model call failed: timeout');
    const rollup = computeRollup([errored]);
    expect(rollup.counts.error).toBe(1);
    expect(rollup.guardrailPassPct).toBeLessThan(GUARDRAIL_THRESHOLD);
    expect(rollup.verdict).toBe('REPORTING');
  });

  it('[boundary] computeRollup on zero cases is the vacuous PASS (0/0 -> 1); documented, not a bug (real corpus never ships empty)', () => {
    const rollup = computeRollup([]);
    expect(rollup.counts.total).toBe(0);
    expect(rollup.verdict).toBe('PASS');
  });
});

describe('CAM-457 score — EC-3 error bucket', () => {
  it('[edge] a model-call error is its own bucket, kept in the denominator, never silently dropped', () => {
    const kase = toolCase();
    const result = errorResult(kase, [], 'model call failed: assistant_unavailable');
    expect(result.result).toBe('error');
    const rollup = computeRollup([result]);
    expect(rollup.counts.error).toBe(1);
    expect(rollup.counts.total).toBe(1); // kept in the denominator
    expect(rollup.toolCallCorrectnessPct).toBe(0); // not counted as pass
  });
});

/* -------------------------------------------------------------------------- */
/* report.ts (tech.md §3) — pure, no mocking needed                           */
/* -------------------------------------------------------------------------- */

describe('CAM-457 report — JSON + Markdown render from ONE object, never diverge', () => {
  it('[normal] the same numbers appear in both renderings', () => {
    const results: CaseResult[] = [
      { id: 'P1-01', group: 'P1', zone: 'B', guardrail: false, expected: { kind: 'tool', tool: 'searchCampsites', params: {} }, actual: { dispatched: [{ tool: 'searchCampsites', args: {} }] }, result: 'pass', reason: 'ok' },
      { id: 'P1-02', group: 'P1', zone: 'A', guardrail: false, expected: { kind: 'no_tool' }, actual: { dispatched: [] }, result: 'fail', reason: 'leaked' },
    ];
    const rollup = computeRollup(results);
    const report: EvalReport = {
      header: {
        model: 'openai/gpt-4o-mini',
        generatedAt: '2026-07-21T00:00:00.000Z',
        gitSha: 'abc1234',
        caseCount: 2,
        thresholds: { toolCallCorrectness: TOOL_CALL_CORRECTNESS_THRESHOLD, guardrail: GUARDRAIL_THRESHOLD },
      },
      rollups: { overall: rollup, byGroup: computeGroupRollups(results), byZone: computeZoneRollups(results) },
      cases: results,
      loadErrors: [],
    };

    const json = JSON.parse(renderJson(report)) as EvalReport;
    const md = renderMarkdown(report);

    expect(json.rollups.overall.counts.pass).toBe(rollup.counts.pass);
    expect(json.rollups.overall.counts.fail).toBe(rollup.counts.fail);
    expect(md).toContain(rollup.verdict);
    expect(md).toContain('P1-01');
    expect(md).toContain('P1-02');
    expect(md).toContain(report.header.model);
  });
});

describe('CAM-457 report — writeReports persists both files to disk (AC-1 gap-fill)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'cam-457-report-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('[normal] writes baseline-report.json + baseline-report.md whose numbers match the source object', () => {
    const results: CaseResult[] = [
      { id: 'X1', group: 'G', zone: 'B', guardrail: false, expected: { kind: 'no_tool' }, actual: { dispatched: [] }, result: 'pass', reason: 'ok' },
    ];
    const rollup = computeRollup(results);
    const report: EvalReport = {
      header: {
        model: 'openai/gpt-4o-mini',
        generatedAt: '2026-07-21T00:00:00.000Z',
        gitSha: 'abc1234',
        caseCount: 1,
        thresholds: { toolCallCorrectness: TOOL_CALL_CORRECTNESS_THRESHOLD, guardrail: GUARDRAIL_THRESHOLD },
      },
      rollups: { overall: rollup, byGroup: computeGroupRollups(results), byZone: computeZoneRollups(results) },
      cases: results,
      loadErrors: [{ index: 2, id: 'bad-1', message: 'zone: Invalid enum value' }],
    };

    writeReports(dir, report);

    const jsonOnDisk = JSON.parse(readFileSync(path.join(dir, 'baseline-report.json'), 'utf-8')) as EvalReport;
    const mdOnDisk = readFileSync(path.join(dir, 'baseline-report.md'), 'utf-8');

    expect(jsonOnDisk.rollups.overall.counts.pass).toBe(rollup.counts.pass);
    expect(mdOnDisk).toContain('## Load errors');
    expect(mdOnDisk).toContain('bad-1');
  });

  it('[boundary] creates a nested report directory that does not yet exist', () => {
    const nestedDir = path.join(dir, 'nested', 'deep');
    const rollup = computeRollup([]);
    const report: EvalReport = {
      header: {
        model: 'openai/gpt-4o-mini',
        generatedAt: '2026-07-21T00:00:00.000Z',
        gitSha: 'abc1234',
        caseCount: 0,
        thresholds: { toolCallCorrectness: TOOL_CALL_CORRECTNESS_THRESHOLD, guardrail: GUARDRAIL_THRESHOLD },
      },
      rollups: { overall: rollup, byGroup: {}, byZone: {} },
      cases: [],
      loadErrors: [],
    };

    writeReports(nestedDir, report);

    expect(readFileSync(path.join(nestedDir, 'baseline-report.json'), 'utf-8')).toBeTruthy();
    expect(readFileSync(path.join(nestedDir, 'baseline-report.md'), 'utf-8')).toContain('AI eval baseline report');
  });
});

/* -------------------------------------------------------------------------- */
/* replay-case.ts — the REAL observation seam (BR-4/tech.md §1)               */
/* Mirrors __tests__/cam-416-agent-loop.test.ts's exact vi.mock idiom.        */
/* -------------------------------------------------------------------------- */

vi.mock('server-only', () => ({}));

const mockDispatchTool = vi.fn();
vi.mock('@/lib/ai/tool-registry', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/tool-registry')>('@/lib/ai/tool-registry');
  return {
    ...actual,
    dispatchTool: (...args: unknown[]) => mockDispatchTool(...args),
  };
});

const { replayCase } = await import('../scripts/ai-eval/replay-case');

const FAKE_KEY = 'sk-or-test-cam457-eval-harness';

function res(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
}

function assistantMessage(content: string | null, toolCalls?: unknown[]) {
  return { choices: [{ message: { role: 'assistant', content, tool_calls: toolCalls } }] };
}

function toolCall(id: string, name: string, args: Record<string, unknown> = {}) {
  return { id, type: 'function', function: { name, arguments: JSON.stringify(args) } };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENROUTER_API_KEY = FAKE_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_MODEL;
});

describe('CAM-457 replay-case — the real dispatchTool observation seam', () => {
  it('[normal] AC-3: a zone-A case with no tool_calls leaves `observed` (via the mock) empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(assistantMessage('เต็นท์คือที่พักชั่วคราวกลางแจ้งครับ'))));

    const kase: GoldenCase = {
      id: 'A1', group: 'smoke', zone: 'A', utterance: 'เต็นท์คืออะไร', expected: { kind: 'no_tool' },
    };
    const turnResult = await replayCase(kase);

    expect(turnResult.ok).toBe(true);
    expect(mockDispatchTool).not.toHaveBeenCalled();
    const scored = scoreCase(kase, []);
    expect(scored.result).toBe('pass');
  });

  it('[normal] AC-2: a zone-B case records the dispatched {name,args} exactly as dispatchTool received them', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('c1', 'searchCampsites', { province: 'เชียงใหม่' })])))
      .mockResolvedValueOnce(res(assistantMessage('พบแคมป์ในเชียงใหม่ครับ')));
    vi.stubGlobal('fetch', mockFetch);
    mockDispatchTool.mockResolvedValue({ ok: true, data: { cards: [] } });

    const kase: GoldenCase = {
      id: 'B1', group: 'smoke', zone: 'B', utterance: 'หาแคมป์ในเชียงใหม่',
      expected: { kind: 'tool', tool: 'searchCampsites', params: { province: 'เชียงใหม่' } },
    };
    const turnResult = await replayCase(kase);

    expect(turnResult.ok).toBe(true);
    expect(mockDispatchTool).toHaveBeenCalledTimes(1);
    const [name, args] = mockDispatchTool.mock.calls[0];
    expect(name).toBe('searchCampsites');
    expect(args).toEqual({ province: 'เชียงใหม่' });

    const dispatched = [{ tool: name as string, args }];
    expect(scoreCase(kase, dispatched).result).toBe('pass');
  });

  it('[normal] a context (multi-turn) case builds the real TurnMessage[] via buildTurnMessages and replays via runAssistantTurnFromMessages', async () => {
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ได้เลยค่ะ')));
    vi.stubGlobal('fetch', mockFetch);

    const kase: GoldenCase = {
      id: 'CTX1', group: 'smoke', zone: 'B',
      utterance: [
        { role: 'user', content: 'หาแคมป์ในเชียงใหม่' },
        { role: 'assistant', content: 'พบแคมป์หลายแห่งค่ะ' },
        { role: 'user', content: 'อันไหนรับสัตว์เลี้ยงได้บ้าง' },
      ],
      expected: { kind: 'no_tool' },
    };
    const turnResult = await replayCase(kase);

    expect(turnResult.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    // 1 system + 3 turns; every user turn is fenced as <user_message> (CAM-415 provenance rule).
    expect(body.messages).toHaveLength(4);
    expect(body.messages[1].content).toContain('<user_message>');
  });

  it('[normal] harness fidelity: seededShownResults injects the CAM-460 <shown_results> state (with campId) into the system prompt, so a "the one you showed me" reference can resolve to a real id', async () => {
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ได้เลยค่ะ')));
    vi.stubGlobal('fetch', mockFetch);

    const kase: GoldenCase = {
      id: 'FID1',
      group: 'P1',
      zone: 'B',
      utterance: [
        { role: 'user', content: 'หาแคมป์ในเชียงใหม่ให้หน่อย' },
        { role: 'assistant', content: 'พบ 2 แคมป์ค่ะ 1) ลานสนธรรมชาติ 2) ริมธารแคมป์' },
        { role: 'user', content: 'เอาอันที่สอง' },
      ],
      seededShownResults: [
        { ordinal: 1, campId: 'eval-camp-pine', name: 'ลานสนธรรมชาติ', priceLow: 500 },
        { ordinal: 2, campId: 'eval-camp-river', name: 'ริมธารแคมป์', priceLow: 800 },
      ],
      expected: { kind: 'tool', tool: 'getCampDetail', params: {} },
    };
    await replayCase(kase);

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    const systemPrompt = body.messages[0].content as string;
    expect(systemPrompt).toContain('<shown_results>');
    // the id the reference "อันที่สอง" must resolve to — absent before this fix.
    expect(systemPrompt).toContain('eval-camp-river');
  });

  it('[normal] harness fidelity: the SAME context case WITHOUT seededShownResults omits the <shown_results> block entirely (byte-identical to pre-seed; regression guard for every non-reference context case)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ได้เลยค่ะ')));
    vi.stubGlobal('fetch', mockFetch);

    const kase: GoldenCase = {
      id: 'FID2',
      group: 'P1',
      zone: 'B',
      utterance: [
        { role: 'user', content: 'หาแคมป์ในเชียงใหม่ให้หน่อย' },
        { role: 'assistant', content: 'พบ 2 แคมป์ค่ะ' },
        { role: 'user', content: 'เอาอันที่สอง' },
      ],
      expected: { kind: 'tool', tool: 'getCampDetail', params: {} },
    };
    await replayCase(kase);

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    const systemPrompt = body.messages[0].content as string;
    expect(systemPrompt).not.toContain('<shown_results>');
  });

  it('[normal] CAM-417 tiering: auth:true offers the authed getMyProfile schema; absent does not', async () => {
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('นี่คือโปรไฟล์ของคุณครับ')));
    vi.stubGlobal('fetch', mockFetch);

    const authedCase: GoldenCase = {
      id: 'AUTH1', group: 'smoke', zone: 'B', utterance: 'แสดงโปรไฟล์ของฉัน',
      expected: { kind: 'tool', tool: 'getMyProfile', params: {} }, auth: true,
    };
    await replayCase(authedCase);
    const authedBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    const authedToolNames = authedBody.tools.map((t: { function: { name: string } }) => t.function.name);
    expect(authedToolNames).toContain('getMyProfile');

    mockFetch.mockClear();
    const guestCase: GoldenCase = {
      id: 'GUEST1', group: 'smoke', zone: 'A', utterance: 'สวัสดี', expected: { kind: 'no_tool' },
    };
    await replayCase(guestCase);
    const guestBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    const guestToolNames = guestBody.tools.map((t: { function: { name: string } }) => t.function.name);
    expect(guestToolNames).not.toContain('getMyProfile');
  });

  it('[normal] BR-8 (CAM-484): the outgoing request body carries `temperature: 0.2` (pinned for deterministic tool routing)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('สวัสดีครับ')));
    vi.stubGlobal('fetch', mockFetch);

    const kase: GoldenCase = { id: 'T1', group: 'smoke', zone: 'A', utterance: 'สวัสดี', expected: { kind: 'no_tool' } };
    await replayCase(kase);

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.temperature).toBe(0.2);
  });

  it('[edge] EC-3: a failed model call (no key, or a network error) yields ok:false, scored as `error` by the runner (not silently dropped)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network blip')));

    const kase: GoldenCase = { id: 'ERR1', group: 'smoke', zone: 'A', utterance: 'สวัสดี', expected: { kind: 'no_tool' } };
    const turnResult = await replayCase(kase);

    expect(turnResult.ok).toBe(false);
    const scored = errorResult(kase, [], `model call failed: ${turnResult.ok ? '' : turnResult.error}`);
    expect(scored.result).toBe('error');
  });
});
