/**
 * CAM-457 — Vitest `globalSetup` for the real-model eval config
 * (`vitest.eval.config.ts` only). Fixes a "silent green" defect (EC-4):
 * `console.warn`/`console.log` called from INSIDE a passing test is
 * swallowed by Vitest's default reporter (only a verbose reporter, or a
 * FAILING test, surfaces it) — so `env -u OPENROUTER_API_KEY npm run
 * ai:eval` printed nothing naming `OPENROUTER_API_KEY`, even though the
 * run correctly self-skipped and made zero network calls.
 *
 * `globalSetup` runs once, in its OWN Node process, entirely OUTSIDE any
 * test file's sandbox/reporter capture — anything it logs goes straight to
 * the real stdout of the `vitest run` process, every run, pass or fail.
 * This file ONLY prints the banner; it does not decide anything and does
 * not replace the in-test guard — `run.eval.ts`'s own `planEvalRun` call
 * remains the sole source of truth for the skip/refuse/run branch and the
 * zero-network guarantee (BR-5/BR-7).
 *
 * The over-cap refuse path (BR-7/CAM-344) does NOT have the same
 * visibility problem: refusing THROWS inside the test, which fails it, and
 * Vitest's default reporter DOES print a failing test's thrown error
 * (including its message, which already names `MAX_EVAL_CASES`) — verified
 * manually (`OPENROUTER_API_KEY=... MAX_EVAL_CASES=1 npm run ai:eval`
 * prints the message and the test fails). No change needed there.
 */
import { checkApiKeyGuard } from './guards';

export default function setup(): void {
  const guard = checkApiKeyGuard(process.env);
  if (guard.skip) {
    console.log(guard.notice);
  }
}
