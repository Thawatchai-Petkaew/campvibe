/**
 * CAM-457 — composes the guards (BR-5 self-skip -> BR-7 cap check -> BR-1
 * load) into ONE decision the entrypoint (`run.eval.ts`) acts on. Every
 * check here runs BEFORE any model call is ever made; a `skip`/`refuse`
 * result guarantees the caller never reaches the replay loop. Pure aside
 * from the file read inside `loadCasesFromFile` — zero network I/O, so this
 * module is safe to unit-test directly (no vi.mock needed).
 */
import { checkApiKeyGuard, checkCaseCountGuard, resolveMaxEvalCases, type EnvLike } from './guards';
import { loadCasesFromFile, type LoadError } from './load-cases';
import type { GoldenCase } from './case-schema';

export type RunPlan =
  | { action: 'skip'; notice: string }
  | { action: 'refuse'; message: string }
  | { action: 'run'; cases: GoldenCase[]; loadErrors: LoadError[]; maxCases: number };

export function planEvalRun(fixturePath: string, env: EnvLike = process.env): RunPlan {
  const apiKeyGuard = checkApiKeyGuard(env);
  if (apiKeyGuard.skip) {
    return { action: 'skip', notice: apiKeyGuard.notice };
  }

  const { cases, loadErrors } = loadCasesFromFile(fixturePath);
  const maxCases = resolveMaxEvalCases(env);
  const capGuard = checkCaseCountGuard(cases.length, maxCases);
  if (capGuard.refuse) {
    return { action: 'refuse', message: capGuard.message };
  }

  return { action: 'run', cases, loadErrors, maxCases };
}
