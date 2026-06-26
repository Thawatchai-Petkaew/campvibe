/**
 * setup-next-cache.ts — global vitest setup (CAM-195 / FRESH-1)
 *
 * Mocks next/cache so that revalidateTag, revalidatePath, and unstable_cache
 * are no-ops in the Node test environment. Without this, revalidateTag throws
 * "Invariant: static generation store missing" when called from route handlers
 * under test (outside a real Next.js request context).
 *
 * This mock is additive — existing tests that call write-path route handlers
 * continue to pass; the revalidation side-effect is simply a no-op in tests.
 * Correctness of the revalidation wiring is covered by freshness-guard.test.ts
 * (a static source-inspection test) and by integration testing on Staging.
 */
import { vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  // unstable_cache is used in PR B; stub it now so imports don't fail.
  unstable_cache: vi.fn(
    <T>(fn: () => Promise<T>) =>
      fn
  ),
  unstable_noStore: vi.fn(),
}));
