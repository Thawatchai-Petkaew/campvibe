import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * CAM-457 (tech.md §4, decision 4) — the REAL-model AI eval config, used
 * only by `npm run ai:eval`. Deliberately a standalone config (not merged
 * with `vitest.config.ts`): its `include` targets ONLY this file's own
 * `*.eval.ts` extension, so the default `vitest.config.ts`
 * (`include: ['**\/*.test.ts']`) never picks up the real-spend runner, and
 * running THIS config never re-runs the ordinary `*.test.ts` suite.
 *
 * `setupFiles` is intentionally NOT carried over — the default config's
 * setup stubs `next/cache` for the app's own unit tests, unrelated to this
 * dev-tooling runner. This config does NOT stub `fetch` — `ai:eval` makes
 * real OpenRouter model calls.
 *
 * `globalSetup` runs the self-skip banner (`global-setup.ts`) OUTSIDE the
 * test sandbox, so `OPENROUTER_API_KEY not set` always reaches the raw
 * terminal — a passing test's own console output is otherwise swallowed by
 * Vitest's default reporter (only shown on `--reporter=verbose` or on a
 * failing test), which was a "silent green" defect against EC-4.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/ai-eval/**/*.eval.ts'],
    exclude: ['node_modules', '.next', 'e2e/**', '.claude/**'],
    testTimeout: 1_200_000, // CAM-476: sized for the full 48-case real-model corpus (was 120_000 for the 8-case smoke fixture); parallel replay is the follow-up
    globalSetup: ['./scripts/ai-eval/global-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
