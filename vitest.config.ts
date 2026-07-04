import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    // .claude/** keeps parallel agents' worktree checkouts (.claude/worktrees/*) out of
    // the glob — their node_modules-less copies fail resolution and pollute the run.
    exclude: ['node_modules', '.next', 'e2e/**', '.claude/**'],
    // CAM-195 / FRESH-1: mock next/cache globally so revalidateTag/revalidatePath
    // are no-ops in unit/integration tests (outside a real Next.js request context).
    setupFiles: ['./__tests__/setup-next-cache.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
