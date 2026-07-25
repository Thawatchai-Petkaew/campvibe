/**
 * CAM-507 (S4b) — unit tests for the guardrail gate's PURE, mock-free pieces
 * (`scripts/ai-eval/guardrail-retry.ts`). Zero model calls, zero `vi.mock`,
 * zero network — every `runOnce` here is a STUB. Picked up by the default
 * `vitest.config.ts` (`**\/*.test.ts`); never by `vitest.guardrail.config.ts`
 * (`guardrail-gate.eval.ts` only), so this file never makes real spend.
 *
 * Coverage matrix (story.md Self-verify + AC-1..AC-6):
 *  - BR-1  filterGuardrailCases: a fixture with mixed cases -> only guardrail cases selected
 *  - BR-3/EC-3 assertApiKeyPresent: unset key -> throws (fail-closed); present key -> no throw
 *  - BR-2/EC-2 runWithRetry: fail->fail->pass => pass + "recovered after 2 retries" notice
 *  - AC-3/BR-4 runWithRetry: fail x3 (retries=2) => fail, all 3 attempts recorded
 *  - EC-1      runWithRetry: a THROWING runOnce counts as a failed attempt, never a pass
 *  - normal    runWithRetry: pass on the first attempt => no retry notice fired
 *  - boundary  resolveGuardrailRetries: default/invalid/explicit env values
 */
import { describe, it, expect, vi } from 'vitest';
import {
  filterGuardrailCases,
  assertApiKeyPresent,
  MissingApiKeyError,
  resolveGuardrailRetries,
  runWithRetry,
  DEFAULT_GUARDRAIL_RETRIES,
  GUARDRAIL_RETRIES_ENV_VAR,
  type AttemptOutcome,
} from '../scripts/ai-eval/guardrail-retry';
import { API_KEY_ENV_VAR } from '../scripts/ai-eval/guards';
import type { GoldenCase } from '../scripts/ai-eval/case-schema';

/* -------------------------------------------------------------------------- */
/* BR-1 — the guardrail-only filter                                           */
/* -------------------------------------------------------------------------- */

function makeCase(id: string, guardrail?: boolean): GoldenCase {
  return {
    id,
    group: 'G',
    zone: 'A',
    utterance: 'x',
    expected: { kind: 'no_tool' },
    ...(guardrail !== undefined ? { guardrail } : {}),
  };
}

describe('CAM-507 filterGuardrailCases — BR-1', () => {
  it('[normal] a fixture with mixed cases selects only guardrail === true', () => {
    const mixed = [makeCase('a', true), makeCase('b', false), makeCase('c'), makeCase('d', true)];
    const result = filterGuardrailCases(mixed);
    expect(result.map((c) => c.id)).toEqual(['a', 'd']);
  });

  it('[null/empty] zero guardrail cases in the input -> an empty array (EC-4 is enforced by the caller, not here)', () => {
    const result = filterGuardrailCases([makeCase('a', false), makeCase('b')]);
    expect(result).toHaveLength(0);
  });

  it('[boundary] an empty input array -> an empty array', () => {
    expect(filterGuardrailCases([])).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* BR-3/EC-3 — fail-closed on a missing OPENROUTER_API_KEY                    */
/* -------------------------------------------------------------------------- */

describe('CAM-507 assertApiKeyPresent — BR-3/EC-3 fail-closed', () => {
  it('[edge] an unset key THROWS a named MissingApiKeyError, never a silent pass', () => {
    expect(() => assertApiKeyPresent({})).toThrow(MissingApiKeyError);
    try {
      assertApiKeyPresent({});
      expect.unreachable('assertApiKeyPresent must throw when the key is absent');
    } catch (error) {
      expect(error).toBeInstanceOf(MissingApiKeyError);
      expect((error as Error).message).toContain(API_KEY_ENV_VAR);
    }
  });

  it('[normal] a present key does not throw', () => {
    expect(() => assertApiKeyPresent({ [API_KEY_ENV_VAR]: 'sk-or-fake' })).not.toThrow();
  });

  it('[edge] an empty-string key is treated as absent -> throws (guards against a blank secret passing silently)', () => {
    expect(() => assertApiKeyPresent({ [API_KEY_ENV_VAR]: '' })).toThrow(MissingApiKeyError);
  });
});

/* -------------------------------------------------------------------------- */
/* resolveGuardrailRetries — env override / default / invalid                 */
/* -------------------------------------------------------------------------- */

describe('CAM-507 resolveGuardrailRetries', () => {
  it('[boundary] default is 2 (=> up to 3 attempts) when unset', () => {
    expect(resolveGuardrailRetries({})).toBe(DEFAULT_GUARDRAIL_RETRIES);
    expect(DEFAULT_GUARDRAIL_RETRIES).toBe(2);
  });

  it('[normal] a valid GUARDRAIL_RETRIES env override is honored', () => {
    expect(resolveGuardrailRetries({ [GUARDRAIL_RETRIES_ENV_VAR]: '0' })).toBe(0);
    expect(resolveGuardrailRetries({ [GUARDRAIL_RETRIES_ENV_VAR]: '5' })).toBe(5);
  });

  it('[edge] an invalid/negative GUARDRAIL_RETRIES falls back to the default', () => {
    expect(resolveGuardrailRetries({ [GUARDRAIL_RETRIES_ENV_VAR]: 'not-a-number' })).toBe(DEFAULT_GUARDRAIL_RETRIES);
    expect(resolveGuardrailRetries({ [GUARDRAIL_RETRIES_ENV_VAR]: '-1' })).toBe(DEFAULT_GUARDRAIL_RETRIES);
  });
});

/* -------------------------------------------------------------------------- */
/* BR-2/EC-1/EC-2/BR-4 — the retry loop itself, with a STUBBED runOnce        */
/* (no real model calls; this is the "never call the real model" unit test)  */
/* -------------------------------------------------------------------------- */

function stubSequence(outcomes: Array<AttemptOutcome | Error>): () => Promise<AttemptOutcome> {
  let i = 0;
  return async () => {
    const next = outcomes[i];
    i += 1;
    if (next instanceof Error) throw next;
    return next;
  };
}

describe('CAM-507 runWithRetry — BR-2 retry-guard (stub, zero model calls)', () => {
  it('[normal] first attempt passes -> pass, attempts=1, no recovery notice fired', async () => {
    const runOnce = stubSequence([{ pass: true, reason: 'ok' }]);
    const onRecovered = vi.fn();
    const outcome = await runWithRetry(runOnce, 2, onRecovered);
    expect(outcome).toEqual({ pass: true, attempts: 1, reasons: ['ok'] });
    expect(onRecovered).not.toHaveBeenCalled();
  });

  it('[normal] fail -> fail -> pass (2 retries used) => green + a loud "recovered after 2 retries" notice', async () => {
    const runOnce = stubSequence([
      { pass: false, reason: 'tool leaked' },
      { pass: false, reason: 'tool leaked again' },
      { pass: true, reason: 'clean on attempt 3' },
    ]);
    const onRecovered = vi.fn();
    const outcome = await runWithRetry(runOnce, 2, onRecovered);

    expect(outcome.pass).toBe(true);
    expect(outcome.attempts).toBe(3);
    expect(outcome.reasons).toEqual(['tool leaked', 'tool leaked again', 'clean on attempt 3']);
    expect(onRecovered).toHaveBeenCalledTimes(1);
    // attempt=3, retriesUsed=2 — this is the "recovered after N retries" signal.
    expect(onRecovered).toHaveBeenCalledWith(3, 2, 'clean on attempt 3');
  });

  it('[edge] AC-3/BR-4: fail x3 with retries=2 (3 attempts total) => red, every attempt recorded, no recovery notice', async () => {
    const runOnce = stubSequence([
      { pass: false, reason: 'attempt 1 fail' },
      { pass: false, reason: 'attempt 2 fail' },
      { pass: false, reason: 'attempt 3 fail' },
    ]);
    const onRecovered = vi.fn();
    const outcome = await runWithRetry(runOnce, 2, onRecovered);

    expect(outcome.pass).toBe(false);
    expect(outcome.attempts).toBe(3);
    expect(outcome.reasons).toHaveLength(3);
    expect(onRecovered).not.toHaveBeenCalled();
  });

  it('[edge] EC-1: a THROWING runOnce (simulated model-call error/outage) counts as a failed attempt, never a pass', async () => {
    const runOnce = stubSequence([
      new Error('network blip'),
      new Error('network blip again'),
      { pass: true, reason: 'recovered' },
    ]);
    const onRecovered = vi.fn();
    const outcome = await runWithRetry(runOnce, 2, onRecovered);

    expect(outcome.pass).toBe(true);
    expect(outcome.attempts).toBe(3);
    expect(outcome.reasons[0]).toMatch(/threw: network blip/);
    expect(outcome.reasons[1]).toMatch(/threw: network blip again/);
    expect(onRecovered).toHaveBeenCalledWith(3, 2, 'recovered');
  });

  it('[edge] EC-1: every attempt throws (an outage never recovers) => red, fail-closed, never treated as pass', async () => {
    const runOnce = stubSequence([new Error('outage'), new Error('outage'), new Error('outage')]);
    const outcome = await runWithRetry(runOnce, 2, vi.fn());

    expect(outcome.pass).toBe(false);
    expect(outcome.attempts).toBe(3);
    expect(outcome.reasons.every((r) => r.includes('threw: outage'))).toBe(true);
  });

  it('[boundary] retries=0 => exactly 1 attempt, no retry ever happens', async () => {
    const runOnce = stubSequence([{ pass: false, reason: 'only attempt' }]);
    const outcome = await runWithRetry(runOnce, 0, vi.fn());
    expect(outcome.attempts).toBe(1);
    expect(outcome.pass).toBe(false);
  });
});
