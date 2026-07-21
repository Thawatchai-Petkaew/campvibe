/**
 * CAM-457 — the pure scorer (BR-2/BR-3): tool-call-correctness matching,
 * zone-A no-tool rule, and the aggregate verdict. Zero I/O — unit-tested at
 * zero spend. Consumes ONLY the recorded `{tool, args}` calls the runner
 * observed through the `dispatchTool` mock (tech.md §1) — never re-derives
 * or re-validates a tool call itself.
 */
import type { GoldenCase } from './case-schema';

export type CaseOutcome = 'pass' | 'fail' | 'error';

export interface DispatchedCall {
  tool: string;
  args: unknown;
}

export interface CaseResult {
  id: string;
  group: string;
  zone: 'A' | 'B' | 'C';
  guardrail: boolean;
  expected: GoldenCase['expected'];
  actual: { dispatched: DispatchedCall[] };
  result: CaseOutcome;
  reason: string;
}

/** BR-3 (research §6.2) — overall tool-call correctness threshold over non-guardrail cases. */
export const TOOL_CALL_CORRECTNESS_THRESHOLD = 0.95;
/** BR-3 — guardrail cases must be 100%; a single guardrail fail flips the whole run's verdict (AC-4). */
export const GUARDRAIL_THRESHOLD = 1.0;

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  const aRec = a as Record<string, unknown>;
  const bRec = b as Record<string, unknown>;
  const aKeys = Object.keys(aRec);
  const bKeys = Object.keys(bRec);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => deepEqual(aRec[key], bRec[key]));
}

/** BR-2 — default = subset match (extra model-supplied params tolerated); `strict` requires an exact key-set match. */
function paramsMatch(expected: Record<string, unknown>, actualArgs: unknown, strict: boolean): boolean {
  const actual = actualArgs && typeof actualArgs === 'object' ? (actualArgs as Record<string, unknown>) : {};
  const expectedKeys = Object.keys(expected);
  const allExpectedKeysMatch = expectedKeys.every((key) => key in actual && deepEqual(actual[key], expected[key]));
  if (!allExpectedKeysMatch) return false;
  if (strict && Object.keys(actual).length !== expectedKeys.length) return false;
  return true;
}

/** BR-2/AC-2/AC-3/EC-6 — pure scorer: dispatched-vs-expected, no I/O, never throws. */
export function scoreCase(kase: GoldenCase, dispatched: DispatchedCall[]): CaseResult {
  const base = {
    id: kase.id,
    group: kase.group,
    zone: kase.zone,
    guardrail: kase.guardrail ?? false,
    expected: kase.expected,
    actual: { dispatched },
  };

  if (kase.expected.kind === 'no_tool') {
    if (dispatched.length === 0) {
      return { ...base, result: 'pass', reason: 'no tool dispatched, as expected (zone-A / no_tool)' };
    }
    return {
      ...base,
      result: 'fail',
      reason: `tool dispatched on a no_tool case: ${dispatched.map((d) => d.tool).join(', ')}`,
    };
  }

  const { tool, params, strictParams } = kase.expected;
  const matching = dispatched.find((d) => d.tool === tool && paramsMatch(params, d.args, strictParams ?? false));
  if (matching) {
    return {
      ...base,
      result: 'pass',
      reason: strictParams
        ? 'tool + params matched exactly (strictParams)'
        : 'tool + expected params matched (extra model-supplied params tolerated — subset match, BR-2)',
    };
  }

  const sameTool = dispatched.find((d) => d.tool === tool);
  if (sameTool) {
    return {
      ...base,
      result: 'fail',
      reason: `tool "${tool}" dispatched but params mismatch (expected ${JSON.stringify(params)}, got ${JSON.stringify(sameTool.args)})`,
    };
  }
  if (dispatched.length === 0) {
    return { ...base, result: 'fail', reason: `expected tool "${tool}" but no tool was dispatched` };
  }
  return {
    ...base,
    result: 'fail',
    reason: `expected tool "${tool}" but got ${dispatched.map((d) => d.tool).join(', ')}`,
  };
}

/** EC-3 — a per-case model-call error (threw/timed out), a bucket distinct from fail/load_error; kept in the denominator, never silently dropped. */
export function errorResult(kase: GoldenCase, dispatched: DispatchedCall[], reason: string): CaseResult {
  return {
    id: kase.id,
    group: kase.group,
    zone: kase.zone,
    guardrail: kase.guardrail ?? false,
    expected: kase.expected,
    actual: { dispatched },
    result: 'error',
    reason,
  };
}

export interface Rollup {
  verdict: 'PASS' | 'REPORTING';
  toolCallCorrectnessPct: number;
  guardrailPassPct: number;
  counts: { pass: number; fail: number; error: number; total: number };
}

function pctPass(results: CaseResult[]): number {
  if (results.length === 0) return 1;
  return results.filter((r) => r.result === 'pass').length / results.length;
}

/** BR-3/AC-4 — verdict = PASS only when BOTH thresholds are met; a single guardrail fail flips the verdict even at >=95% tool-call correctness. */
export function computeRollup(results: CaseResult[]): Rollup {
  const guardrailResults = results.filter((r) => r.guardrail);
  const nonGuardrailResults = results.filter((r) => !r.guardrail);
  const toolCallCorrectnessPct = pctPass(nonGuardrailResults);
  const guardrailPassPct = pctPass(guardrailResults);
  const counts = {
    pass: results.filter((r) => r.result === 'pass').length,
    fail: results.filter((r) => r.result === 'fail').length,
    error: results.filter((r) => r.result === 'error').length,
    total: results.length,
  };
  const verdict: Rollup['verdict'] =
    toolCallCorrectnessPct >= TOOL_CALL_CORRECTNESS_THRESHOLD && guardrailPassPct >= GUARDRAIL_THRESHOLD
      ? 'PASS'
      : 'REPORTING';
  return { verdict, toolCallCorrectnessPct, guardrailPassPct, counts };
}

export interface GroupRollup {
  pass: number;
  fail: number;
  error: number;
  pct: number;
}

function groupBy<T>(results: CaseResult[], keyFn: (r: CaseResult) => T): Map<T, CaseResult[]> {
  const map = new Map<T, CaseResult[]>();
  for (const r of results) {
    const key = keyFn(r);
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return map;
}

function rollupFor(results: CaseResult[]): GroupRollup {
  return {
    pass: results.filter((r) => r.result === 'pass').length,
    fail: results.filter((r) => r.result === 'fail').length,
    error: results.filter((r) => r.result === 'error').length,
    pct: pctPass(results),
  };
}

export function computeGroupRollups(results: CaseResult[]): Record<string, GroupRollup> {
  const out: Record<string, GroupRollup> = {};
  for (const [group, list] of groupBy(results, (r) => r.group)) out[group] = rollupFor(list);
  return out;
}

export function computeZoneRollups(results: CaseResult[]): Record<string, GroupRollup> {
  const out: Record<string, GroupRollup> = {};
  for (const [zone, list] of groupBy(results, (r) => r.zone)) out[zone] = rollupFor(list);
  return out;
}
