/**
 * CAM-507 (S4b) — pure, unit-testable pieces of the BLOCKING guardrail gate
 * (BR-1/BR-2/BR-3). Zero I/O, zero model calls — safe to exercise directly
 * with a STUB `runOnce` in a plain `*.test.ts` file. Deliberately kept
 * separate from `guardrail-gate.eval.ts` (which owns the `vi.mock` wiring +
 * the real `replayCase`/`scoreCase` calls) so this module can be imported
 * from `__tests__/cam-507-guardrail-gate.test.ts` with no mock-registration
 * risk and no `server-only` transitive import.
 */
import { API_KEY_ENV_VAR, type EnvLike } from './guards';
import type { GoldenCase } from './case-schema';

/** BR-1 — the guardrail-only filter; a fixture with mixed cases selects only `guardrail === true`. */
export function filterGuardrailCases(cases: GoldenCase[]): GoldenCase[] {
  return cases.filter((kase) => kase.guardrail === true);
}

/** Distinct error type so the entrypoint (or a caller) can tell a fail-closed refusal apart from any other throw. */
export class MissingApiKeyError extends Error {}

/**
 * BR-3/EC-3 — fail-closed: unlike the advisory `run.eval.ts` harness, which
 * SELF-SKIPS (exit 0) when the key is absent, this gate THROWS. A guardrail
 * gate that silently passes with zero model calls made is a false green —
 * never acceptable for a blocking check.
 */
export function assertApiKeyPresent(env: EnvLike = process.env): void {
  if (!env[API_KEY_ENV_VAR]) {
    const message = `${API_KEY_ENV_VAR} missing — guardrail gate cannot run`;
    console.error(`::error::${message}`);
    throw new MissingApiKeyError(message);
  }
}

export const GUARDRAIL_RETRIES_ENV_VAR = 'GUARDRAIL_RETRIES';
/** BR-2 default — 2 retries -> up to 3 attempts total per guardrail case. */
export const DEFAULT_GUARDRAIL_RETRIES = 2;

/** `GUARDRAIL_RETRIES` from env, falling back to `DEFAULT_GUARDRAIL_RETRIES` on absent/invalid/negative input. */
export function resolveGuardrailRetries(env: EnvLike = process.env): number {
  const raw = env[GUARDRAIL_RETRIES_ENV_VAR]?.trim();
  if (!raw) return DEFAULT_GUARDRAIL_RETRIES;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_GUARDRAIL_RETRIES;
}

export interface AttemptOutcome {
  pass: boolean;
  reason: string;
}

export interface RetryOutcome {
  pass: boolean;
  /** Number of attempts actually made (1 when the first attempt passes, up to `retries + 1`). */
  attempts: number;
  /** One reason string per attempt made, in order — the last entry explains the final attempt. */
  reasons: string[];
}

/**
 * BR-2 — runs `runOnce` up to `retries + 1` times total, short-circuiting on
 * the first passing attempt. A case is FAILED only if every attempt fails.
 *
 * EC-1 — a THROWING `runOnce` (a model-call error, e.g. network/outage)
 * counts as a failed attempt, never treated as a pass (fail-closed).
 *
 * EC-2 — a pass on attempt >= 2 fires `onRecovered` with the attempt number
 * and the count of retries actually used, so the caller can print a loud
 * "recovered after N retries" notice (a visible flake signal, never hidden).
 */
export async function runWithRetry(
  runOnce: () => Promise<AttemptOutcome>,
  retries: number,
  onRecovered?: (attempt: number, retriesUsed: number, reason: string) => void
): Promise<RetryOutcome> {
  const maxAttempts = retries + 1;
  const reasons: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let outcome: AttemptOutcome;
    try {
      outcome = await runOnce();
    } catch (error) {
      // EC-1 — a thrown model-call error is a failed attempt, not a pass.
      outcome = {
        pass: false,
        reason: `attempt ${attempt} threw: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    reasons.push(outcome.reason);

    if (outcome.pass) {
      if (attempt > 1) onRecovered?.(attempt, attempt - 1, outcome.reason);
      return { pass: true, attempts: attempt, reasons };
    }
  }

  return { pass: false, attempts: maxAttempts, reasons };
}
