import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * CAM-507 (S4b) — the BLOCKING guardrail-only real-model gate config, used
 * only by `npm run ai:guardrail-gate`. Mirrors `vitest.eval.config.ts`
 * (CAM-457) but `include` targets ONLY `guardrail-gate.eval.ts`, and this
 * config is wired to a DIFFERENT CI workflow (`ai-guardrail-gate.yml`,
 * blocking) than the advisory `ai-eval.yml`.
 *
 * `globalSetup` is deliberately NOT reused from `vitest.eval.config.ts` —
 * that banner announces a SELF-SKIP, which this gate must never do (BR-3
 * inverts the advisory self-skip into a fail-closed throw); reusing it here
 * would print a misleading "skipped" notice on a run that is about to throw.
 *
 * Does NOT stub `fetch` — `ai:guardrail-gate` makes real OpenRouter model
 * calls (tool EXECUTION only is mocked, inside `guardrail-gate.eval.ts`).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/ai-eval/guardrail-gate.eval.ts'],
    exclude: ['node_modules', '.next', 'e2e/**', '.claude/**'],
    // BR-6: worst case ~18 model calls (6 guardrail cases x up to 3 attempts) — generous headroom for network latency.
    testTimeout: 300_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
