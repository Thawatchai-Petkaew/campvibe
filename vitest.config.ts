import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next', 'e2e/**'],
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
