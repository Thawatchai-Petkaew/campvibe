/**
 * FRESH-1 freshness guard — CAM-195 PR A
 *
 * Static manifest test: for each write-path file that participates in the
 * FRESH-1 revalidation map, assert that the source file contains at least one
 * revalidateTag() or revalidatePath() call.
 *
 * This test fails fast if a future PR accidentally removes or omits a call,
 * ensuring the cache invalidation wiring is never silently dropped.
 *
 * Intentionally excluded: app/api/upload/route.ts
 * Upload is not a catalog mutation — it is a file storage operation. The camp
 * PUT (edit) that consumes the uploaded URL fires revalidateTag after that
 * write. Per the CAM-195 owner decision (OQ-1 Option B), upload does NOT call
 * revalidateTag directly; the PUT path covers freshness.
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');

const WRITE_PATHS: { file: string; description: string }[] = [
  {
    file: 'app/api/campsites/route.ts',
    description: 'POST /api/campsites (create campsite)',
  },
  {
    file: 'app/api/campsites/[id]/route.ts',
    description: 'PUT/DELETE /api/campsites/[id] (edit / publish / unpublish / delete)',
  },
  {
    file: 'app/api/reviews/route.ts',
    description: 'POST /api/reviews (create review — fires after AGG-1 transaction)',
  },
  {
    file: 'app/api/seed/route.ts',
    description: 'GET /api/seed (seed run replaces catalog)',
  },
  {
    file: 'app/api/bulk-seed/route.ts',
    description: 'POST /api/bulk-seed (bulk synthetic data load)',
  },
  {
    file: 'app/api/scrape-seed/route.ts',
    description: 'POST /api/scrape-seed (scraper-based seed)',
  },
];

describe('FRESH-1 freshness guard (CAM-195)', () => {
  test.each(WRITE_PATHS)(
    '$description contains a revalidateTag or revalidatePath call',
    ({ file }: { file: string; description: string }) => {
      const src = readFileSync(path.join(root, file), 'utf8');
      const hasRevalidate =
        src.includes('revalidateTag(') || src.includes('revalidatePath(');
      expect(hasRevalidate).toBe(true);
    }
  );
});
