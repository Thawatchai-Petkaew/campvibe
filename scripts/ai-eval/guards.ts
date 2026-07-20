/**
 * CAM-457 — pure, mock-free decision guards checked BEFORE any model call.
 * Kept dependency-free (no `server-only`, no tool-registry import) so the
 * harness's own unit test can exercise these directly with zero Vitest
 * module-mocking — a stubbed `global.fetch` in the test can assert it is
 * NEVER called as a structural consequence of these functions containing no
 * fetch/network code at all (BR-5/BR-7 self-verify).
 */

export const API_KEY_ENV_VAR = 'OPENROUTER_API_KEY';
export const MAX_CASES_ENV_VAR = 'MAX_EVAL_CASES';

/** BR-7 default ceiling — headroom above the real 40-case corpus; the ~2,000-case paraphrase tier is a separate, out-of-scope run. */
export const DEFAULT_MAX_EVAL_CASES = 500;

/** Loosely typed on purpose (vs `NodeJS.ProcessEnv`, which requires `NODE_ENV`) — callers/tests only ever need to supply the 1-2 keys these guards read. */
export type EnvLike = Record<string, string | undefined>;

export type ApiKeyGuardResult = { skip: true; notice: string } | { skip: false };

/** BR-5/AC-5/EC-4 — no OPENROUTER_API_KEY -> the whole run self-skips with a notice NAMING the variable; never a silent green. */
export function checkApiKeyGuard(env: EnvLike = process.env): ApiKeyGuardResult {
  const key = env[API_KEY_ENV_VAR];
  if (!key) {
    return {
      skip: true,
      notice: `::notice::${API_KEY_ENV_VAR} not set — AI eval skipped (zero network calls, zero spend).`,
    };
  }
  return { skip: false };
}

/** `MAX_EVAL_CASES` from env, falling back to `DEFAULT_MAX_EVAL_CASES` on absent/invalid input. */
export function resolveMaxEvalCases(env: EnvLike = process.env): number {
  const raw = env[MAX_CASES_ENV_VAR]?.trim();
  if (!raw) return DEFAULT_MAX_EVAL_CASES;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_MAX_EVAL_CASES;
}

export type CaseCountGuardResult = { refuse: true; message: string } | { refuse: false };

/** BR-7/CAM-344 — a hard MAX_EVAL_CASES ceiling checked BEFORE the replay loop runs; over the cap the harness refuses with a clear message and makes zero model calls. */
export function checkCaseCountGuard(caseCount: number, maxCases: number): CaseCountGuardResult {
  if (caseCount > maxCases) {
    return {
      refuse: true,
      message: `Refusing to run: ${caseCount} cases exceeds ${MAX_CASES_ENV_VAR}=${maxCases}. Reduce the fixture size or raise ${MAX_CASES_ENV_VAR}.`,
    };
  }
  return { refuse: false };
}
